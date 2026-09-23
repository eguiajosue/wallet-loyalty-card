import { cookies } from 'next/headers';
import { backendWithSession, relay } from '@/lib/api';

export async function POST(request: Request) {
  const tenant = (await cookies()).get('loyalty_tenant')?.value;
  if (!tenant) return Response.json({ message: 'Sesión requerida' }, { status: 401 });
  const { cardUrl, ticketNumber, amountCents } = await request.json();
  let token: string;
  try { token = new URL(cardUrl).pathname.split('/').filter(Boolean).at(-1) ?? ''; }
  catch { return Response.json({ message: 'Enlace de tarjeta inválido' }, { status: 400 }); }
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return Response.json({ message: 'Enlace de tarjeta inválido' }, { status: 400 });
  const branchId = (await cookies()).get('loyalty_branch')?.value;
  const key = request.headers.get('idempotency-key');
  const response = await backendWithSession(`/tenants/${tenant}/enrollments/${token}/visits`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key ?? '' },
    body: JSON.stringify({ branchId, ticketNumber, amountCents }),
  });
  return response ? relay(response) : Response.json({ message: 'Sesión requerida' }, { status: 401 });
}
