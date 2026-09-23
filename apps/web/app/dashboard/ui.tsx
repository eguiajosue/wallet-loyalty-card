'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import type { Campaign } from './page';

export function Dashboard({ initialCampaigns }: { initialCampaigns: Campaign[] }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [error, setError] = useState('');
  const [visitResult, setVisitResult] = useState('');
  const [busy, setBusy] = useState(false);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const body = { name: data.name, rewardDescription: data.rewardDescription, targetVisits: Number(data.targetVisits), minPurchaseCents: Math.round(Number(data.minPurchase) * 100), cooldownMinutes: Math.round(Number(data.cooldownHours) * 60), endsAt: new Date(String(data.endsAt)).toISOString() };
    const response = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) return setError('No se pudo crear la campaña. Revisa sus datos.');
    setCampaigns([await response.json(), ...campaigns]); form.reset();
  }

  async function registerVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setVisitResult('');
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const response = await fetch('/api/visits', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ cardUrl: data.cardUrl, ticketNumber: data.ticketNumber, amountCents: Math.round(Number(data.amount) * 100) }) }).catch(() => null);
    setBusy(false);
    if (!response) return setError('Sin conexión. Confirma si la visita se registró antes de intentar de nuevo.');
    const body = await response.json();
    if (!response.ok) return setError(typeof body.message === 'string' ? body.message : 'No se pudo registrar la visita.');
    setVisitResult(`Visita ${body.visitCount} registrada${body.rewardReady ? '. ¡Recompensa desbloqueada!' : '.'}`);
    form.reset();
  }

  return <main className="dashboard"><header className="dash-header"><Link className="brand" href="/">W<span>•</span> Wallet Loyalty</Link><div className="dash-user"><span>Panel de negocio</span><button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); router.refresh(); }}>Salir ↗</button></div></header>
    <div className="dash-intro"><p className="eyebrow">ESPACIO DE TRABAJO</p><h1>Haz que vuelvan.</h1><p>Configura tu campaña y registra cada visita desde aquí.</p></div>
    <div className="dash-grid"><section className="panel"><div className="panel-title"><span className="round-icon">✳</span><div><p className="eyebrow">01 / CONFIGURACIÓN</p><h2>Nueva campaña</h2></div></div><form onSubmit={createCampaign} className="stack-form"><label>Nombre<input name="name" required minLength={2} placeholder="La décima visita cuenta" /></label><label>Recompensa<input name="rewardDescription" required minLength={2} placeholder="Un café gratis" /></label><div className="form-row"><label>Visitas objetivo<input name="targetVisits" type="number" defaultValue="10" min="2" max="50" required /></label><label>Compra mínima (MXN)<input name="minPurchase" type="number" defaultValue="0" min="0" step="0.01" required /></label></div><div className="form-row"><label>Horas entre visitas<input name="cooldownHours" type="number" defaultValue="24" min="0" step="1" required /></label><label>Vigencia<input name="endsAt" type="datetime-local" required /></label></div><button className="button" disabled={busy}>Crear campaña ↗</button></form></section>
    <section className="panel"><div className="panel-title"><span className="round-icon">↗</span><div><p className="eyebrow">02 / MOSTRADOR</p><h2>Registrar visita</h2></div></div><p className="muted">Abre la tarjeta del cliente y pega su enlace. Usa el folio de ticket real para evitar duplicados.</p><form onSubmit={registerVisit} className="stack-form"><label>Enlace de tarjeta<input name="cardUrl" type="url" required placeholder="https://…/card/…" /></label><label>Folio del ticket<input name="ticketNumber" required placeholder="Ej. A-000123" /></label><label>Importe (MXN)<input name="amount" type="number" min="0" step="0.01" required placeholder="0.00" /></label><button className="button outline" disabled={busy}>Registrar sello ↗</button></form>{visitResult && <p role="status" className="success">{visitResult}</p>}</section></div>
    {error && <p role="alert" className="error global-error">{error}</p>}
    <section className="campaign-section"><div><p className="eyebrow">TUS CAMPAÑAS</p><h2>En circulación.</h2></div><div className="campaign-list">{campaigns.length ? campaigns.map(c => <article className="campaign-item" key={c.id}><div><span className="status"><span className="live-dot" /> {c.status}</span><h3>{c.name}</h3><p>{c.targetVisits} visitas · {c.rewardDescription}</p></div><Link href={`/join/${c.id}`}>Abrir inscripción ↗</Link></article>) : <div className="empty-state">Tu primera campaña aparecerá aquí.</div>}</div></section>
  </main>;
}
