import Link from 'next/link';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { backend } from '@/lib/api';

type Card = { businessName: string; campaignName: string; rewardDescription: string; visitCount: number; targetVisits: number; state: string; endsAt: string; campaignActive: boolean };

export default async function CardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const response = await backend(`/cards/${token}`);
  if (!response.ok) notFound();
  const card = await response.json() as Card;
  const cardUrl = `${(process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/card/${token}`;
  const qr = await QRCode.toDataURL(cardUrl, { margin: 2, width: 280, errorCorrectionLevel: 'M' });
  return <main className="card-page"><Link className="brand" href="/">W<span>•</span> Wallet Loyalty</Link><div className="digital-card"><header><span>{card.businessName.toUpperCase()}</span><span>✳</span></header><div className="card-main"><p className="eyebrow">{card.campaignName.toUpperCase()}</p><h1>{card.rewardDescription}</h1><div className="stamp-grid">{Array.from({ length: card.targetVisits }, (_, index) => <span className={index < card.visitCount ? 'stamp filled' : 'stamp'} key={index}>{index < card.visitCount ? '✦' : String(index + 1).padStart(2, '0')}</span>)}</div></div><footer><strong>{card.visitCount} / {card.targetVisits} VISITAS</strong><span>{card.state === 'reward_ready' ? 'PREMIO LISTO' : card.campaignActive ? 'SIGUE SUMANDO' : 'CAMPAÑA FINALIZADA'}</span></footer></div>
    <section className="card-details"><p className="eyebrow">MUÉSTRALA EN MOSTRADOR</p><h2>Tu tarjeta, lista para sumar.</h2><img src={qr} width={210} height={210} alt="Código QR de tu tarjeta" /><p>Válida hasta el {new Date(card.endsAt).toLocaleDateString('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })}.</p><small>Este QR da acceso a tu tarjeta. Compártelo únicamente con personal del negocio.</small></section>
  </main>;
}
