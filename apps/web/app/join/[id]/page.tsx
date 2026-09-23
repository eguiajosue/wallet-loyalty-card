import Link from 'next/link';
import { JoinButton } from './button';

export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="join-shell"><div className="join-card"><Link className="brand" href="/">W<span>•</span> Wallet Loyalty</Link><div className="join-mark">✳</div><p className="eyebrow">TU PRÓXIMA RECOMPENSA EMPIEZA AQUÍ</p><h1>Bienvenido<br />a tu tarjeta.</h1><p>Guarda este enlace en tu celular: es la llave para consultar tus visitas y mostrar tu tarjeta en el negocio.</p><JoinButton campaignId={id} /><small>Esta primera versión emite tarjetas anónimas. Si pierdes el enlace, no podrás recuperar tu progreso.</small></div></main>;
}
