import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AuthService } from './auth';
import { recordAudit } from './audit';
import { Database } from './db';
import { LoyaltyService } from './loyalty';
import { parse, uuid } from './validation';

const keySchema = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);
const reasonSchema = z.string().trim().min(3).max(500);
const requestSchema = z.object({ reason: reasonSchema }).strict();
const decisionSchema = z.object({ decision: z.enum(['approved', 'rejected']), reason: reasonSchema }).strict();
const redeemSchema = z.object({ branchId: uuid }).strict();

@Injectable()
export class RewardService {
  constructor(@Inject(Database) private readonly db: Database, @Inject(AuthService) private readonly auth: AuthService,
    @Inject(LoyaltyService) private readonly loyalty: LoyaltyService) {}

  async history(tenantId: string, token: string, header: string | undefined) {
    const actor = await this.auth.authorize(header, tenantId, ['owner', 'manager', 'employee']);
    return this.db.transaction(async client => {
      const card = await this.loyalty.tenantCard(client, tenantId, token);
      const visits = await client.query(`SELECT v.id, v.ticket_number AS "ticketNumber", v.amount_cents AS "amountCents",
        v.created_at AS "createdAt", v.actor_id AS "actorId", b.name AS "branchName",
        cr.id AS "cancellationId", cr.status AS "cancellationStatus", cr.reason AS "cancellationReason",
        cr.decision_reason AS "decisionReason"
        FROM visits v JOIN branches b ON b.id = v.branch_id AND b.tenant_id = v.tenant_id
        LEFT JOIN cancellation_requests cr ON cr.visit_id = v.id AND cr.tenant_id = v.tenant_id
        WHERE v.tenant_id = $1 AND v.enrollment_id = $2 ORDER BY v.created_at DESC, v.id DESC`, [tenantId, card.id]);
      const redemption = await client.query(`SELECT id, created_at AS "createdAt", reward_description AS "rewardDescription"
        FROM redemptions WHERE tenant_id = $1 AND enrollment_id = $2`, [tenantId, card.id]);
      const events = await client.query(`SELECT id, kind, actor_id AS "actorId", payload, created_at AS "createdAt"
        FROM audit_events WHERE tenant_id = $1 AND enrollment_id = $2 ORDER BY sequence DESC LIMIT 100`, [tenantId, card.id]);
      return {
        card: { id: card.id, campaignName: card.name, rewardDescription: card.reward_description, visitCount: card.visit_count,
          targetVisits: card.target_visits, state: card.state, endsAt: card.ends_at,
          campaignActive: card.status === 'active' && card.ends_at > new Date() },
        permissions: { canDecideCancellation: actor.role === 'owner' || actor.role === 'manager' },
        visits: visits.rows, redemption: redemption.rows[0] ?? null, events: events.rows,
      };
    });
  }

  async redeem(tenantId: string, token: string, header: string | undefined, idempotencyKey: string | undefined, input: unknown) {
    const actor = await this.auth.authorize(header, tenantId, ['owner', 'manager', 'employee']);
    const data = parse(redeemSchema, input);
    const key = parse(keySchema, idempotencyKey);
    try {
      return await this.db.transaction(async client => {
        // Every mutation locks the enrollment first: visits, redemption and cancellation serialize here.
        const card = await this.loyalty.tenantCard(client, tenantId, token);
        const prior = await client.query<{ id: string; enrollment_id: string; branch_id: string; created_at: Date }>(
          'SELECT id, enrollment_id, branch_id, created_at FROM redemptions WHERE tenant_id = $1 AND idempotency_key = $2', [tenantId, key]);
        if (prior.rows[0]) {
          const row = prior.rows[0];
          if (row.enrollment_id !== card.id || row.branch_id !== data.branchId) throw new ConflictException('La clave ya pertenece a otro canje');
          return { redemptionId: row.id, redeemedAt: row.created_at, state: 'redeemed', replayed: true };
        }
        if (card.state !== 'reward_ready' || card.visit_count < card.target_visits) throw new ConflictException('La tarjeta no tiene una recompensa disponible');
        if (card.status !== 'active' || card.ends_at <= new Date()) throw new ConflictException('La campaña no está activa');
        const pending = await client.query(`SELECT 1 FROM cancellation_requests cr JOIN visits v ON v.id = cr.visit_id
          WHERE cr.tenant_id = $1 AND v.enrollment_id = $2 AND cr.status = 'pending'`, [tenantId, card.id]);
        if (pending.rowCount) throw new ConflictException('Resuelve las solicitudes de cancelación antes del canje');
        const branch = await client.query('SELECT 1 FROM branches WHERE id = $1 AND tenant_id = $2', [data.branchId, tenantId]);
        if (!branch.rowCount) throw new BadRequestException('Sucursal no válida para este negocio');
        const id = randomUUID();
        const result = await client.query<{ created_at: Date }>(`INSERT INTO redemptions
          (id, tenant_id, enrollment_id, branch_id, actor_id, reward_description, idempotency_key)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING created_at`,
        [id, tenantId, card.id, data.branchId, actor.user_id, card.reward_description, key]);
        await client.query("UPDATE enrollments SET state = 'redeemed' WHERE id = $1 AND tenant_id = $2", [card.id, tenantId]);
        await recordAudit(client, tenantId, card.id, actor.user_id, 'reward.redeemed', { redemptionId: id, branchId: data.branchId, rewardDescription: card.reward_description });
        return { redemptionId: id, redeemedAt: result.rows[0].created_at, state: 'redeemed', replayed: false };
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Canje o clave de idempotencia ya registrados');
      throw error;
    }
  }

  async requestCancellation(tenantId: string, token: string, visitId: string, header: string | undefined, input: unknown) {
    const actor = await this.auth.authorize(header, tenantId, ['owner', 'manager', 'employee']);
    parse(uuid, visitId);
    const data = parse(requestSchema, input);
    return this.db.transaction(async client => {
      const card = await this.loyalty.tenantCard(client, tenantId, token);
      const visit = await client.query('SELECT 1 FROM visits WHERE id = $1 AND tenant_id = $2 AND enrollment_id = $3', [visitId, tenantId, card.id]);
      if (!visit.rowCount) throw new NotFoundException('Visita no encontrada');
      const prior = await client.query<{ id: string; status: string; reason: string; requested_by: string }>(
        'SELECT id, status, reason, requested_by FROM cancellation_requests WHERE tenant_id = $1 AND visit_id = $2', [tenantId, visitId]);
      if (prior.rows[0]) {
        if (prior.rows[0].reason !== data.reason || prior.rows[0].requested_by !== actor.user_id) throw new ConflictException('Esta visita ya tiene una solicitud');
        return { requestId: prior.rows[0].id, status: prior.rows[0].status, replayed: true };
      }
      if (card.state === 'redeemed') throw new ConflictException('No se pueden cancelar visitas después del canje');
      const id = randomUUID();
      await client.query(`INSERT INTO cancellation_requests (id, tenant_id, visit_id, requested_by, reason)
        VALUES ($1, $2, $3, $4, $5)`, [id, tenantId, visitId, actor.user_id, data.reason]);
      await recordAudit(client, tenantId, card.id, actor.user_id, 'cancellation.requested', { requestId: id, visitId, reason: data.reason });
      return { requestId: id, status: 'pending', replayed: false };
    });
  }

  async decideCancellation(tenantId: string, token: string, requestId: string, header: string | undefined, input: unknown) {
    const actor = await this.auth.authorize(header, tenantId, ['owner', 'manager']);
    parse(uuid, requestId);
    const data = parse(decisionSchema, input);
    return this.db.transaction(async client => {
      const card = await this.loyalty.tenantCard(client, tenantId, token);
      const result = await client.query<{ id: string; visit_id: string; status: string; decision_reason: string | null }>(
        `SELECT cr.id, cr.visit_id, cr.status, cr.decision_reason FROM cancellation_requests cr
         JOIN visits v ON v.id = cr.visit_id AND v.tenant_id = cr.tenant_id
         WHERE cr.id = $1 AND cr.tenant_id = $2 AND v.enrollment_id = $3 FOR UPDATE OF cr`, [requestId, tenantId, card.id]);
      const request = result.rows[0];
      if (!request) throw new NotFoundException('Solicitud no encontrada');
      if (request.status !== 'pending') {
        if (request.status !== data.decision || request.decision_reason !== data.reason) throw new ConflictException('Esta solicitud ya fue resuelta');
        return { requestId, status: request.status, replayed: true };
      }
      if (card.state === 'redeemed') throw new ConflictException('No se pueden cambiar visitas después del canje');
      await client.query(`UPDATE cancellation_requests SET status = $1, decided_by = $2, decided_at = now(), decision_reason = $3
        WHERE id = $4 AND tenant_id = $5`, [data.decision, actor.user_id, data.reason, requestId, tenantId]);
      const count = data.decision === 'approved' ? card.visit_count - 1 : card.visit_count;
      if (data.decision === 'approved') {
        await client.query('UPDATE enrollments SET visit_count = $1, state = $2 WHERE id = $3 AND tenant_id = $4',
          [count, count >= card.target_visits ? 'reward_ready' : 'active', card.id, tenantId]);
      }
      await recordAudit(client, tenantId, card.id, actor.user_id, `cancellation.${data.decision}`,
        { requestId, visitId: request.visit_id, reason: data.reason, previousCount: card.visit_count, visitCount: count });
      return { requestId, status: data.decision, replayed: false };
    });
  }
}
