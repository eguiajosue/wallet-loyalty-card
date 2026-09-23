import { cookies } from 'next/headers';

const base = process.env.API_URL ?? 'http://localhost:4000';

export async function backend(path: string, init: RequestInit = {}) {
  return fetch(`${base}${path}`, { ...init, cache: 'no-store' });
}

export async function backendWithSession(path: string, init: RequestInit = {}) {
  const session = (await cookies()).get('loyalty_session')?.value;
  if (!session) return null;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session}`);
  return backend(path, { ...init, headers });
}

export async function relay(response: Response) {
  return new Response(await response.text(), {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' },
  });
}
