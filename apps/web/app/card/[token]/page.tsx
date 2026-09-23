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
  const status = card.state === 'redeemed' ? 'RECOMPENSA ENTREGADA' : !card.campaignActive ? 'CAMPAÑA FINALIZADA' : card.state === 'reward_ready' ? 'PREMIO LISTO' : 'SIGUE SUMANDO';
  return <main className="card-page"><Link className="brand" href="/">W<span>•</span> Wallet Loyalty</Link><div className="digital-card"><header><span>{card.businessName.toUpperCase()}</span><span>✳</span></header><div className="card-main"><p className="eyebrow">{card.campaignName.toUpperCase()}</p><h1>{card.rewardDescription}</h1><div className="stamp-grid">{Array.from({ length: card.targetVisits }, (_, index) => <span className={index < card.visitCount ? 'stamp filled' : 'stamp'} key={index}>{index < card.visitCount ? '✦' : String(index + 1).padStart(2, '0')}</span>)}</div></div><footer><strong>{card.visitCount} / {card.targetVisits} VISITAS</strong><span>{status}</span></footer></div>
    <section className="card-details"><p className="eyebrow">{card.state === 'redeemed' ? 'GRACIAS POR VOLVER' : 'MUÉSTRALA EN MOSTRADOR'}</p><h2>{card.state === 'redeemed' ? 'Disfruta tu recompensa.' : card.campaignActive ? 'Tu tarjeta, lista para sumar.' : 'Esta campaña ha finalizado.'}</h2>
    {card.state === 'redeemed' ? <p>La recompensa ya fue entregada. Tu participación en esta campaña ha terminado.</p> : <img src={qr} width={210} height={210} alt="Código QR de tu tarjeta" />}
    <p>Válida hasta el {new Date(card.endsAt).toLocaleDateString('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })}.</p><small>Este enlace da acceso a tu tarjeta. Compártelo únicamente con personal del negocio.</small><p><a className="text-link" href={`/card/${token}`}>Actualizar tarjeta ↻</a></p></section>
  </main>;
}
