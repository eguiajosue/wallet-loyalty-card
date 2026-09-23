import { cookies } from 'next/headers';
import { backendWithSession, relay } from '@/lib/api';
import { cardTokenFromUrl } from '@/lib/card-url';

export async function POST(request: Request) {
  const tenant = (await cookies()).get('loyalty_tenant')?.value;
  if (!tenant) return Response.json({ message: 'Sesión requerida' }, { status: 401 });
  const data = await request.json().catch(() => null);
  const token = cardTokenFromUrl(data?.cardUrl);
  if (!token) return Response.json({ message: 'Enlace de tarjeta inválido' }, { status: 400 });
  const { ticketNumber, amountCents } = data;
  const branchId = (await cookies()).get('loyalty_branch')?.value;
  const key = request.headers.get('idempotency-key');
  const response = await backendWithSession(`/tenants/${tenant}/enrollments/${token}/visits`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key ?? '' },
    body: JSON.stringify({ branchId, ticketNumber, amountCents }),
  });
  return response ? relay(response) : Response.json({ message: 'Sesión requerida' }, { status: 401 });
}
