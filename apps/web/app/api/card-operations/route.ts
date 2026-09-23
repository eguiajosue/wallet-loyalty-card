import { cookies } from 'next/headers';
import { backendWithSession, relay } from '@/lib/api';
import { cardTokenFromUrl } from '@/lib/card-url';

// Keep private card URLs out of query strings and use only the authenticated tenant.
export async function POST(request: Request) {
  const jar = await cookies();
  const tenant = jar.get('loyalty_tenant')?.value;
  if (!tenant) return Response.json({ message: 'Sesión requerida' }, { status: 401 });
  const data = await request.json().catch(() => null);
  const token = cardTokenFromUrl(data?.cardUrl);
  if (!token) return Response.json({ message: 'Enlace de tarjeta inválido' }, { status: 400 });
  let path = `/tenants/${encodeURIComponent(tenant)}/enrollments/${token}`;
  let method = 'POST';
  let body: unknown;
  const isId = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
  if (data.action === 'inspect') method = 'GET';
  else if (data.action === 'redeem') {
    path += '/redemptions'; body = { branchId: jar.get('loyalty_branch')?.value };
  } else if (data.action === 'requestCancellation' && isId(data.visitId)) {
    path += `/visits/${data.visitId}/cancellation`; body = { reason: data.reason };
  } else if (data.action === 'decideCancellation' && isId(data.requestId)) {
    path += `/cancellations/${data.requestId}/decision`; body = { decision: data.decision, reason: data.reason };
  } else return Response.json({ message: 'Operación inválida' }, { status: 400 });
  try {
    const response = await backendWithSession(path, { method,
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.headers.get('idempotency-key') ?? '' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return response ? relay(response) : Response.json({ message: 'Sesión requerida' }, { status: 401 });
  } catch { return Response.json({ message: 'No pudimos confirmar el resultado. Puedes reintentar la misma operación.' }, { status: 503 }); }
}
