CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'employee')),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE branches (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id)
);

CREATE TABLE campaigns (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  reward_description text NOT NULL,
  target_visits int NOT NULL CHECK (target_visits BETWEEN 2 AND 50),
  min_purchase_cents int NOT NULL CHECK (min_purchase_cents >= 0),
  cooldown_minutes int NOT NULL CHECK (cooldown_minutes >= 0),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id)
);

CREATE TABLE enrollments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  visit_count int NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'reward_ready', 'redeemed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (campaign_id, tenant_id) REFERENCES campaigns(id, tenant_id),
  UNIQUE (id, tenant_id)
);
CREATE INDEX enrollments_campaign_idx ON enrollments(campaign_id);

CREATE TABLE visits (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  ticket_number text NOT NULL,
  amount_cents int NOT NULL CHECK (amount_cents >= 0),
  idempotency_key text NOT NULL,
  resulting_count int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (enrollment_id, tenant_id) REFERENCES enrollments(id, tenant_id),
  FOREIGN KEY (branch_id, tenant_id) REFERENCES branches(id, tenant_id),
  UNIQUE (tenant_id, ticket_number),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX visits_enrollment_recent_idx ON visits(enrollment_id, created_at DESC);
