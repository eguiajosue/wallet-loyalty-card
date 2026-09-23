import { NextRequest, NextResponse } from 'next/server';
import { backend } from '@/lib/api';

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (action !== 'register' && action !== 'login' && action !== 'logout') return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (action === 'logout') {
    const token = request.cookies.get('loyalty_session')?.value;
    if (token) await backend('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    const result = NextResponse.json({ ok: true });
    for (const name of ['loyalty_session', 'loyalty_tenant', 'loyalty_branch']) result.cookies.delete(name);
    return result;
  }
  const body = await request.text();
  const response = await backend(`/auth/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const data = await response.json();
  if (!response.ok) return NextResponse.json(data, { status: response.status });
  const tenant = action === 'register' ? data.tenantId : data.tenants?.[0]?.tenant_id;
  const branch = action === 'register' ? data.branchId : data.tenants?.[0]?.branch_id;
  const result = NextResponse.json({ tenantId: tenant, branchId: branch });
  for (const [name, value] of [['loyalty_session', data.token], ['loyalty_tenant', tenant], ['loyalty_branch', branch]]) {
    if (value) result.cookies.set(name, value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 604800 });
  }
  return result;
}
