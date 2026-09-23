import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { backendWithSession } from '@/lib/api';
import { Dashboard } from './ui';

export type Campaign = { id: string; name: string; rewardDescription: string; targetVisits: number; minPurchaseCents: number; cooldownMinutes: number; endsAt: string; status: string };

export default async function DashboardPage() {
  const tenant = (await cookies()).get('loyalty_tenant')?.value;
  if (!tenant) redirect('/login');
  const response = await backendWithSession(`/tenants/${tenant}/campaigns`);
  if (response?.status === 401) redirect('/login');
  if (!response?.ok) throw new Error('No se pudieron cargar las campañas');
  const campaigns = await response.json() as Campaign[];
  return <Dashboard initialCampaigns={campaigns} />;
}
