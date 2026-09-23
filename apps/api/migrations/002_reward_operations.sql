ALTER TABLE visits ADD CONSTRAINT visits_id_tenant_unique UNIQUE (id, tenant_id);

CREATE TABLE redemptions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  reward_description text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (enrollment_id, tenant_id) REFERENCES enrollments(id, tenant_id),
  FOREIGN KEY (branch_id, tenant_id) REFERENCES branches(id, tenant_id),
  UNIQUE (tenant_id, enrollment_id),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE cancellation_requests (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  visit_id uuid NOT NULL,
  requested_by uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by uuid REFERENCES users(id),
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (visit_id, tenant_id) REFERENCES visits(id, tenant_id),
  UNIQUE (tenant_id, visit_id),
  CHECK ((status = 'pending' AND decided_by IS NULL AND decided_at IS NULL AND decision_reason IS NULL)
    OR (status <> 'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND decision_reason IS NOT NULL))
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  tenant_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK (kind IN ('visit.recorded', 'reward.unlocked', 'reward.redeemed',
    'cancellation.requested', 'cancellation.approved', 'cancellation.rejected')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (enrollment_id, tenant_id) REFERENCES enrollments(id, tenant_id)
);
CREATE INDEX audit_events_enrollment_idx ON audit_events(tenant_id, enrollment_id, created_at DESC);

-- Preserve the history of visits created before this migration.
INSERT INTO audit_events (id, tenant_id, enrollment_id, actor_id, kind, payload, created_at)
SELECT gen_random_uuid(), tenant_id, enrollment_id, actor_id, 'visit.recorded',
  jsonb_build_object('visitId', id, 'visitCount', resulting_count, 'backfilled', true), created_at
FROM visits;

CREATE FUNCTION prevent_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Ledger records cannot be changed or deleted' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_ledger_mutation();
CREATE TRIGGER visits_immutable BEFORE UPDATE OR DELETE ON visits
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
CREATE TRIGGER visits_no_truncate BEFORE TRUNCATE ON visits
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_ledger_mutation();
CREATE TRIGGER redemptions_immutable BEFORE UPDATE OR DELETE ON redemptions
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
CREATE TRIGGER redemptions_no_truncate BEFORE TRUNCATE ON redemptions
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_ledger_mutation();
