export type VisitRules = {
  status: string;
  endsAt: Date;
  state: string;
  visitCount: number;
  targetVisits: number;
  minPurchaseCents: number;
  cooldownMinutes: number;
  lastVisitAt: Date | null;
};

export function checkVisit(rules: VisitRules, amountCents: number, now: Date): string | null {
  if (rules.status !== 'active' || now >= rules.endsAt) return 'La campaña no está activa';
  if (rules.state !== 'active' || rules.visitCount >= rules.targetVisits) return 'La tarjeta ya completó sus visitas';
  if (amountCents < rules.minPurchaseCents) return 'El importe no alcanza el mínimo de la campaña';
  if (rules.lastVisitAt && now.getTime() - rules.lastVisitAt.getTime() < rules.cooldownMinutes * 60_000) {
    return 'Aún no transcurre el tiempo mínimo entre visitas';
  }
  return null;
}
