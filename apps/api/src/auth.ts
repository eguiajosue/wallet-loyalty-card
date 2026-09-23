import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { Database } from './db';
import { parse, uuid } from './validation';

const scrypt = promisify(scryptCallback);
const registerSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60),
  email: z.email().max(254),
  password: z.string().min(12).max(256),
}).strict();
const loginSchema = z.object({ email: z.email(), password: z.string() }).strict();

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected || expected.length !== 128) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

@Injectable()
export class AuthService {
  constructor(@Inject(Database) private readonly db: Database) {}

  async register(input: unknown) {
    const data = parse(registerSchema, input);
    const email = data.email.trim().toLowerCase();
    const passwordHash = await hashPassword(data.password);
    const token = newToken();
    const tenantId = randomUUID();
    const userId = randomUUID();
    const branchId = randomUUID();
    try {
      await this.db.transaction(async (client) => {
        await client.query('INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)', [tenantId, data.businessName, data.slug]);
        await client.query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)', [userId, email, passwordHash]);
        await client.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')", [tenantId, userId]);
        await client.query('INSERT INTO branches (id, tenant_id, name) VALUES ($1, $2, $3)', [branchId, tenantId, 'Principal']);
        await client.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '7 days')", [digest(token), userId]);
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('El correo o identificador del negocio ya está registrado');
      throw error;
    }
    return { token, tenantId, branchId, userId };
  }

  async login(input: unknown) {
    const data = parse(loginSchema, input);
    const result = await this.db.query<{ id: string; password_hash: string }>('SELECT id, password_hash FROM users WHERE email = $1', [data.email.trim().toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await verifyPassword(data.password, user.password_hash))) throw new UnauthorizedException('Credenciales incorrectas');
    const token = newToken();
    await this.db.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '7 days')", [digest(token), user.id]);
    const tenants = await this.db.query<{ tenant_id: string; role: string; branch_id: string }>(
      `SELECT m.tenant_id, m.role, (SELECT b.id FROM branches b WHERE b.tenant_id = m.tenant_id ORDER BY b.created_at LIMIT 1) AS branch_id
       FROM memberships m WHERE m.user_id = $1`, [user.id]);
    return { token, tenants: tenants.rows };
  }

  async authorize(header: string | undefined, tenantId: string, allowed: Array<'owner' | 'manager' | 'employee'>) {
    parse(uuid, tenantId);
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header ?? '');
    if (!match) throw new UnauthorizedException('Sesión requerida');
    const result = await this.db.query<{ user_id: string; role: 'owner' | 'manager' | 'employee' }>(
      `SELECT s.user_id, m.role FROM sessions s JOIN memberships m ON m.user_id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND m.tenant_id = $2`,
      [digest(match[1]), tenantId],
    );
    const actor = result.rows[0];
    if (!actor) throw new UnauthorizedException('Sesión vencida o sin acceso al negocio');
    if (!allowed.includes(actor.role)) throw new ForbiddenException('Permisos insuficientes');
    return actor;
  }

  async logout(header: string | undefined) {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header ?? '');
    if (!match) throw new BadRequestException('Sesión requerida');
    await this.db.query('DELETE FROM sessions WHERE token_hash = $1', [digest(match[1])]);
    return { ok: true };
  }
}
