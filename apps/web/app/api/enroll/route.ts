import { backend, relay } from '@/lib/api';

export async function POST(request: Request) {
  const { campaignId } = await request.json();
  if (typeof campaignId !== 'string' || !/^[0-9a-f-]{36}$/.test(campaignId)) return Response.json({ message: 'Campaña inválida' }, { status: 400 });
  return relay(await backend(`/campaigns/${campaignId}/enrollments`, { method: 'POST' }));
}
