import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app';

test('registers a tenant and records visits once, with tenant isolation', async (t) => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for integration tests');
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const base = await app.getUrl();
  const send = async (path: string, body?: unknown, token?: string, key?: string) => {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const suffix = randomUUID().slice(0, 12);
  const owner = await send('/auth/register', { businessName: 'Café Uno', slug: `cafe-${suffix}`, email: `${suffix}@example.test`, password: 'correct-horse-battery-2026' });
  assert.equal(owner.status, 201);
  const { tenantId, branchId, token } = owner.body;
  const campaign = await send(`/tenants/${tenantId}/campaigns`, {
    name: 'Café frecuente', rewardDescription: 'Un café gratis', targetVisits: 2,
    minPurchaseCents: 1000, cooldownMinutes: 0, endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  }, token);
  assert.equal(campaign.status, 201);
  const enrollment = await send(`/campaigns/${campaign.body.id}/enrollments`, {});
  assert.equal(enrollment.status, 201);
  const cardToken = enrollment.body.token;
  assert.equal((await send(`/cards/${cardToken}`)).body.visitCount, 0);

  const path = `/tenants/${tenantId}/enrollments/${cardToken}/visits`;
  const first = { branchId, ticketNumber: `T-${suffix}-1`, amountCents: 1000 };
  assert.equal((await send(path, { ...first, amountCents: 999 }, token, randomUUID())).status, 409);
  const key = randomUUID();
  const visit = await send(path, first, token, key);
  assert.equal(visit.status, 201);
  assert.equal(visit.body.visitCount, 1);
  const replay = await send(path, first, token, key);
  assert.equal(replay.body.visitCount, 1);
  assert.equal(replay.body.replayed, true);
  assert.equal((await send(path, first, token, randomUUID())).status, 409);

  const other = await send('/auth/register', { businessName: 'Café Dos', slug: `otro-${suffix}`, email: `other-${suffix}@example.test`, password: 'correct-horse-battery-2026' });
  assert.equal(other.status, 201);
  assert.equal((await send(`/tenants/${other.body.tenantId}/enrollments/${cardToken}/visits`, { ...first, branchId: other.body.branchId, ticketNumber: `X-${suffix}` }, other.body.token, randomUUID())).status, 404);

  const second = await send(path, { ...first, ticketNumber: `T-${suffix}-2` }, token, randomUUID());
  assert.equal(second.status, 201);
  assert.equal(second.body.rewardReady, true);
  assert.equal((await send(`/cards/${cardToken}`)).body.state, 'reward_ready');
  assert.equal((await send(path, { ...first, ticketNumber: `T-${suffix}-3` }, token, randomUUID())).status, 409);
});
