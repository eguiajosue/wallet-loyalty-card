import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { checkVisit, VisitRules } from './rules';

const now = new Date('2026-09-23T12:00:00.000Z');
const base: VisitRules = {
  status: 'active', endsAt: new Date('2026-10-01T00:00:00.000Z'), state: 'active',
  visitCount: 8, targetVisits: 10, minPurchaseCents: 5000, cooldownMinutes: 1440, lastVisitAt: null,
};

test('accepts a valid visit and rejects the financial and time boundaries', () => {
  assert.equal(checkVisit(base, 5000, now), null);
  assert.match(checkVisit(base, 4999, now)!, /importe/);
  assert.match(checkVisit({ ...base, lastVisitAt: new Date('2026-09-22T12:00:01.000Z') }, 5000, now)!, /tiempo/);
  assert.equal(checkVisit({ ...base, lastVisitAt: new Date('2026-09-22T12:00:00.000Z') }, 5000, now), null);
});

test('blocks completed, paused and expired cards', () => {
  assert.match(checkVisit({ ...base, visitCount: 10 }, 5000, now)!, /completó/);
  assert.match(checkVisit({ ...base, status: 'paused' }, 5000, now)!, /activa/);
  assert.match(checkVisit({ ...base, endsAt: now }, 5000, now)!, /activa/);
});
