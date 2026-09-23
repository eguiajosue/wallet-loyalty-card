import Link from 'next/link';
import { AuthForm } from './form';

export default function Start() {
  return <main className="auth-shell"><Link className="brand" href="/">W<span>•</span> Wallet Loyalty</Link><div className="auth-panel"><p className="eyebrow">EMPIEZA AQUÍ</p><h1>Tu negocio.<br />Más visitas.</h1><p className="muted">Configura tu espacio y emite tu primera tarjeta digital.</p><AuthForm mode="register" /><p className="helper">¿Ya tienes una cuenta? <Link href="/login">Inicia sesión</Link></p></div><div className="auth-aside"><div className="aside-mark">✳</div><p>Haz que volver<br />sea la mejor parte.</p></div></main>;
}
