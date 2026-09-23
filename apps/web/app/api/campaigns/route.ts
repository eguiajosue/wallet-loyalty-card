import { cookies } from 'next/headers';
import { backendWithSession, relay } from '@/lib/api';

async function forward(method: string, body?: string) {
  const tenant = (await cookies()).get('loyalty_tenant')?.value;
  if (!tenant) return Response.json({ message: 'Sesión requerida' }, { status: 401 });
  const response = await backendWithSession(`/tenants/${tenant}/campaigns`, { method, headers: { 'Content-Type': 'application/json' }, body });
  return response ? relay(response) : Response.json({ message: 'Sesión requerida' }, { status: 401 });
}

export async function GET() { return forward('GET'); }
export async function POST(request: Request) { return forward('POST', await request.text()); }
