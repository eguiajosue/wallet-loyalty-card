import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PoolClient } from 'pg';
import { AuthService, digest } from './auth';
import { Database } from './db';
import { checkVisit } from './rules';
import { parse, uuid } from './validation';
import { recordAudit } from './audit';

const campaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  rewardDescription: z.string().trim().min(2).max(240),
  targetVisits: z.number().int().min(2).max(50),
  minPurchaseCents: z.number().int().min(0).max(100_000_000),
  cooldownMinutes: z.number().int().min(0).max(525_600),
  endsAt: z.iso.datetime({ offset: true }),
}).strict();

const visitSchema = z.object({
  branchId: uuid,
  ticketNumber: z.string().trim().min(1).max(100),
  amountCents: z.number().int().min(0).max(100_000_000),
}).strict();

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const keySchema = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);

type CardRow = {
  id: string; tenant_id: string; campaign_id: string; visit_count: number; state: string;
  name: string; reward_description: string; target_visits: number; min_purchase_cents: number;
  cooldown_minutes: number; ends_at: Date; status: string; business_name: string;
};

@Injectable()
export class LoyaltyService {
  constructor(@Inject(Database) private readonly db: Database, @Inject(AuthService) private readonly auth: AuthService) {}

  async createCampaign(tenantId: string, header: string | undefined, input: unknown) {
    await this.auth.authorize(header, tenantId, ['owner', 'manager']);
    const data = parse(campaignSchema, input);
    if (new Date(data.endsAt) <= new Date()) throw new BadRequestException('La caducidad debe ser futura');
    const id = randomUUID();
    await this.db.query(
      `INSERT INTO campaigns (id, tenant_id, name, reward_description, target_visits, min_purchase_cents, cooldown_minutes, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, tenantId, data.name, data.rewardDescription, data.targetVisits, data.minPurchaseCents, data.cooldownMinutes, data.endsAt],
    );
    return { id, tenantId, ...data, status: 'active' };
  }

  async listCampaigns(tenantId: string, header: string | undefined) {
    await this.auth.authorize(header, tenantId, ['owner', 'manager', 'employee']);
    const result = await this.db.query(
      `SELECT id, name, reward_description AS "rewardDescription", target_visits AS "targetVisits",
        min_purchase_cents AS "minPurchaseCents", cooldown_minutes AS "cooldownMinutes",
        ends_at AS "endsAt", status FROM campaigns WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId],
    );
    return result.rows;
  }

  async enroll(campaignId: string) {
    parse(uuid, campaignId);
    const token = randomBytes(32).toString('base64url');
    const id = randomUUID();
    const result = await this.db.query<{ tenant_id: string }>(
      `INSERT INTO enrollments (id, tenant_id, campaign_id, token_hash)
       SELECT $1, tenant_id, id, $2 FROM campaigns
       WHERE id = $3 AND status = 'active' AND ends_at > now()
       RETURNING tenant_id`, [id, digest(token), campaignId],
    );
    if (!result.rowCount) throw new NotFoundException('Campaña no disponible');
    const base = (process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    return { id, cardUrl: `${base}/card/${token}`, token };
  }

  private async cardRow(client: PoolClient | Database, token: string, lock = false, tenantId?: string): Promise<CardRow> {
    parse(tokenSchema, token);
    const sql = `SELECT e.id, e.tenant_id, e.campaign_id, e.visit_count, e.state, c.name,
         c.reward_description, c.target_visits, c.min_purchase_cents, c.cooldown_minutes,
         c.ends_at, c.status, t.name AS business_name
       FROM enrollments e JOIN campaigns c ON c.id = e.campaign_id AND c.tenant_id = e.tenant_id
       JOIN tenants t ON t.id = e.tenant_id WHERE e.token_hash = $1 ${tenantId ? 'AND e.tenant_id = $2' : ''}
       ${lock ? 'FOR UPDATE OF e' : ''}`;
    const result = client instanceof Database
      ? await client.query<CardRow>(sql, tenantId ? [digest(token), tenantId] : [digest(token)])
      : await client.query<CardRow>(sql, tenantId ? [digest(token), tenantId] : [digest(token)]);
    const card = result.rows[0];
    if (!card) throw new NotFoundException('Tarjeta no encontrada');
    return card;
  }

  tenantCard(client: PoolClient, tenantId: string, token: string) {
    return this.cardRow(client, token, true, tenantId);
  }

  async getCard(token: string) {
    const c = await this.cardRow(this.db, token);
    return {
      businessName: c.business_name,
      campaignName: c.name,
      rewardDescription: c.reward_description,
      visitCount: c.visit_count,
      targetVisits: c.target_visits,
      state: c.state,
      endsAt: c.ends_at,
      campaignActive: c.status === 'active' && c.ends_at > new Date(),
    };
  }

  async visit(tenantId: string, token: string, header: string | undefined, idempotencyKey: string | undefined, input: unknown) {
    const actor = await this.auth.authorize(header, tenantId, ['owner', 'manager', 'employee']);
    const data = parse(visitSchema, input);
    const key = parse(keySchema, idempotencyKey);
    try {
      return await this.db.transaction(async (client) => {
        const card = await this.tenantCard(client, tenantId, token);
        const prior = await client.query<{ id: string; enrollment_id: string; branch_id: string; ticket_number: string; amount_cents: number; resulting_count: number }>(
          'SELECT id, enrollment_id, branch_id, ticket_number, amount_cents, resulting_count FROM visits WHERE tenant_id = $1 AND idempotency_key = $2', [tenantId, key],
        );
        if (prior.rows[0]) {
          const p = prior.rows[0];
          if (p.enrollment_id !== card.id || p.branch_id !== data.branchId || p.ticket_number !== data.ticketNumber || p.amount_cents !== data.amountCents) {
            throw new ConflictException('La clave de idempotencia ya se usó para otra operación');
          }
          return { visitId: p.id, visitCount: p.resulting_count, rewardReady: p.resulting_count >= card.target_visits, replayed: true };
        }
        const branch = await client.query('SELECT 1 FROM branches WHERE id = $1 AND tenant_id = $2', [data.branchId, tenantId]);
        if (!branch.rowCount) throw new BadRequestException('Sucursal no válida para este negocio');
        const last = await client.query<{ created_at: Date }>(`SELECT v.created_at FROM visits v WHERE v.enrollment_id = $1
          AND NOT EXISTS (SELECT 1 FROM cancellation_requests cr WHERE cr.visit_id = v.id AND cr.status = 'approved')
          ORDER BY v.created_at DESC LIMIT 1`, [card.id]);
        const now = new Date();
        const reason = checkVisit({
          status: card.status, endsAt: card.ends_at, state: card.state, visitCount: card.visit_count,
          targetVisits: card.target_visits, minPurchaseCents: card.min_purchase_cents,
          cooldownMinutes: card.cooldown_minutes, lastVisitAt: last.rows[0]?.created_at ?? null,
        }, data.amountCents, now);
        if (reason) throw new ConflictException(reason);
        const count = card.visit_count + 1;
        const visitId = randomUUID();
        await client.query(
          `INSERT INTO visits (id, tenant_id, enrollment_id, branch_id, actor_id, ticket_number,
             amount_cents, idempotency_key, resulting_count, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [visitId, tenantId, card.id, data.branchId, actor.user_id, data.ticketNumber, data.amountCents, key, count, now],
        );
        await client.query("UPDATE enrollments SET visit_count = $1, state = $2 WHERE id = $3", [count, count >= card.target_visits ? 'reward_ready' : 'active', card.id]);
        await recordAudit(client, tenantId, card.id, actor.user_id, 'visit.recorded', { visitId, visitCount: count });
        if (count >= card.target_visits) await recordAudit(client, tenantId, card.id, actor.user_id, 'reward.unlocked', { visitId, visitCount: count });
        return { visitId, visitCount: count, rewardReady: count >= card.target_visits, replayed: false };
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Ticket o clave de idempotencia ya registrados');
      throw error;
    }
  }
}
