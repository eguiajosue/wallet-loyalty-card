import 'reflect-metadata';
import { test, TestContext } from 'node:test';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app';
import { Database } from './db';

async function fixture(t: TestContext) {
  if (!process.env.DATABASE_URL) throw new Error('Use a disposable PostgreSQL database for integration tests');
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const db = app.get(Database);
  const base = await app.getUrl();
  const send = async (path: string, body?: unknown, token?: string, key?: string) => {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const account = async () => {
    const id = randomUUID();
    const result = await send('/auth/register', { businessName: 'Café Prueba', slug: `cafe-${id}`, email: `${id}@example.test`, password: 'integration-password-2026' });
    assert.equal(result.status, 201);
    return result.body as { token: string; tenantId: string; branchId: string; userId: string };
  };
  const owner = await account();
  const campaign = await send(`/tenants/${owner.tenantId}/campaigns`, { name: 'Dos visitas', rewardDescription: 'Un café', targetVisits: 2,
    minPurchaseCents: 1000, cooldownMinutes: 0, endsAt: new Date(Date.now() + 86400000).toISOString() }, owner.token);
  assert.equal(campaign.status, 201);
  const enrollment = await send(`/campaigns/${campaign.body.id}/enrollments`, {});
  assert.equal(enrollment.status, 201);
  const path = `/tenants/${owner.tenantId}/enrollments/${enrollment.body.token}`;
  const visit = (ticket = randomUUID()) => send(`${path}/visits`, { branchId: owner.branchId, ticketNumber: ticket, amountCents: 1000 }, owner.token, randomUUID());
  const redeem = (key = randomUUID()) => send(`${path}/redemptions`, { branchId: owner.branchId }, owner.token, key);
  return { db, send, account, owner, campaignId: campaign.body.id, enrollmentId: enrollment.body.id, cardToken: enrollment.body.token, path, visit, redeem };
}

test('only one reward can be redeemed, even concurrently; replay is safe and ledger is immutable', async t => {
  const f = await fixture(t);
  assert.equal((await f.redeem()).status, 409);
  const visit = await f.visit();
  assert.equal(visit.status, 201);
  assert.equal((await f.visit()).status, 201);
  await f.db.query("UPDATE campaigns SET status = 'paused' WHERE id = $1", [f.campaignId]);
  assert.equal((await f.redeem()).status, 409);
  await f.db.query("UPDATE campaigns SET status = 'active', ends_at = now() - interval '1 second' WHERE id = $1", [f.campaignId]);
  assert.equal((await f.redeem()).status, 409);
  await f.db.query("UPDATE campaigns SET ends_at = now() + interval '1 day' WHERE id = $1", [f.campaignId]);
  const keys = [randomUUID(), randomUUID()];
  const concurrent = await Promise.all(keys.map(key => f.redeem(key)));
  assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409]);
  const winner = concurrent.findIndex(r => r.status === 201);
  const replay = await f.redeem(keys[winner]);
  assert.equal(replay.status, 201);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.redemptionId, concurrent[winner].body.redemptionId);
  assert.equal((await f.visit()).status, 409);
  assert.equal((await f.send(`${f.path}/visits/${visit.body.visitId}/cancellation`, { reason: 'Ticket equivocado' }, f.owner.token)).status, 409);
  const history = await f.send(f.path, undefined, f.owner.token);
  assert.equal(history.body.card.state, 'redeemed');
  assert.equal(history.body.redemption.rewardDescription, 'Un café');
  assert.equal(history.body.events.filter((event: { kind: string }) => event.kind === 'reward.redeemed').length, 1);
  const publicCard = await f.send(`/cards/${f.cardToken}`);
  assert.equal(publicCard.body.state, 'redeemed');
  assert.equal(publicCard.body.visits, undefined);
  for (const table of ['visits', 'redemptions', 'audit_events']) {
    await assert.rejects(f.db.query(`DELETE FROM ${table} WHERE enrollment_id = $1`, [f.enrollmentId]), { code: '55000' });
  }
  await assert.rejects(f.db.query("UPDATE visits SET amount_cents = 0 WHERE enrollment_id = $1", [f.enrollmentId]), { code: '55000' });
  assert.equal((await f.db.query('SELECT count(*)::int AS count FROM redemptions WHERE enrollment_id = $1', [f.enrollmentId])).rows[0].count, 1);
});

test('cancellation requires manager permission, preserves tickets and updates progress exactly once', async t => {
  const f = await fixture(t);
  const ticket = randomUUID();
  const first = await f.visit(ticket);
  const second = await f.visit();
  assert.equal(second.status, 201);
  const outsider = await f.account();
  const otherPath = `/tenants/${outsider.tenantId}/enrollments/${f.cardToken}`;
  assert.equal((await f.send(otherPath, undefined, outsider.token)).status, 404);
  assert.equal((await f.send(`${otherPath}/redemptions`, { branchId: outsider.branchId }, outsider.token, randomUUID())).status, 404);
  assert.equal((await f.send(`${otherPath}/visits/${first.body.visitId}/cancellation`, { reason: 'No es mi tarjeta' }, outsider.token)).status, 404);
  assert.equal((await f.send(f.path, undefined, outsider.token)).status, 401);

  const employee = await f.account();
  await f.db.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'employee')", [f.owner.tenantId, employee.userId]);
  const requestPath = `${f.path}/visits/${first.body.visitId}/cancellation`;
  const request = await f.send(requestPath, { reason: 'Ticket capturado por error' }, employee.token);
  assert.equal(request.status, 201);
  assert.equal((await f.send(requestPath, { reason: 'Ticket capturado por error' }, employee.token)).body.replayed, true);
  assert.equal((await f.redeem()).status, 409);
  const decisionPath = `${f.path}/cancellations/${request.body.requestId}/decision`;
  const decision = { decision: 'approved', reason: 'Ticket revisado y no corresponde' };
  assert.equal((await f.send(decisionPath, decision, employee.token)).status, 403);
  assert.equal((await f.send(`${otherPath}/cancellations/${request.body.requestId}/decision`, decision, outsider.token)).status, 404);
  const manager = await f.account();
  await f.db.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'manager')", [f.owner.tenantId, manager.userId]);
  const approvals = await Promise.all([f.send(decisionPath, decision, manager.token), f.send(decisionPath, decision, manager.token)]);
  assert.deepEqual(approvals.map(r => r.status), [201, 201]);
  assert.deepEqual(approvals.map(r => r.body.replayed).sort(), [false, true]);
  let history = await f.send(f.path, undefined, f.owner.token);
  assert.equal(history.body.card.visitCount, 1);
  assert.equal(history.body.card.state, 'active');
  assert.equal(history.body.visits.length, 2);
  assert.equal(history.body.visits.find((v: { id: string }) => v.id === first.body.visitId).cancellationStatus, 'approved');
  assert.equal(history.body.events.filter((event: { kind: string }) => event.kind === 'cancellation.approved').length, 1);
  assert.equal((await f.visit(ticket)).status, 409, 'a cancelled ticket cannot earn another visit');
  assert.equal((await f.redeem()).status, 409);

  const rejected = await f.send(`${f.path}/visits/${second.body.visitId}/cancellation`, { reason: 'Solicito otra revisión' }, employee.token);
  const rejectPath = `${f.path}/cancellations/${rejected.body.requestId}/decision`;
  assert.equal((await f.send(rejectPath, { decision: 'rejected', reason: 'Compra válida confirmada' }, f.owner.token)).status, 201);
  assert.equal((await f.send(rejectPath, decision, manager.token)).status, 409, 'decisions cannot be overwritten');
  assert.equal((await f.visit()).status, 201);
  assert.equal((await f.redeem()).status, 201);
  history = await f.send(f.path, undefined, f.owner.token);
  assert.equal(history.body.card.state, 'redeemed');
  assert.equal(history.body.card.visitCount, 2);
});

test('a racing cancellation and redemption cannot both commit', async t => {
  const f = await fixture(t);
  const visit = await f.visit();
  await f.visit();
  const results = await Promise.all([
    f.send(`${f.path}/visits/${visit.body.visitId}/cancellation`, { reason: 'Revisión de ticket' }, f.owner.token),
    f.redeem(),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const history = await f.send(f.path, undefined, f.owner.token);
  const pending = history.body.visits.some((v: { cancellationStatus: string }) => v.cancellationStatus === 'pending');
  assert.equal(history.body.card.state === 'redeemed', !pending);
});

test('an approved cancellation removes the visit from the cooldown calculation', async t => {
  const f = await fixture(t);
  await f.db.query('UPDATE campaigns SET cooldown_minutes = 60 WHERE id = $1', [f.campaignId]);
  const visit = await f.visit();
  assert.equal(visit.status, 201);
  assert.equal((await f.visit()).status, 409);
  const request = await f.send(`${f.path}/visits/${visit.body.visitId}/cancellation`, { reason: 'Visita registrada por error' }, f.owner.token);
  assert.equal((await f.send(`${f.path}/cancellations/${request.body.requestId}/decision`,
    { decision: 'approved', reason: 'Error confirmado' }, f.owner.token)).status, 201);
  assert.equal((await f.visit()).status, 201);
  assert.equal((await f.send(f.path, undefined, f.owner.token)).body.card.visitCount, 1);
});
