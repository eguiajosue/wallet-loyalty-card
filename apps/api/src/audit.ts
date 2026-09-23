import { randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';

type Kind = 'visit.recorded' | 'reward.unlocked' | 'reward.redeemed'
  | 'cancellation.requested' | 'cancellation.approved' | 'cancellation.rejected';

// Always use the same transaction as the operation being recorded.
export async function recordAudit(client: PoolClient, tenantId: string, enrollmentId: string,
  actorId: string, kind: Kind, payload: Record<string, unknown>) {
  await client.query(`INSERT INTO audit_events (id, tenant_id, enrollment_id, actor_id, kind, payload)
    VALUES ($1, $2, $3, $4, $5, $6)`, [randomUUID(), tenantId, enrollmentId, actorId, kind, payload]);
}
