import Link from 'next/link';
import { AuthForm } from '../start/form';

export default function Login() {
  return <main className="auth-shell"><Link className="brand" href="/">W<span>•</span> Wallet Loyalty</Link><div className="auth-panel"><p className="eyebrow">BIENVENIDO DE VUELTA</p><h1>Hagamos<br />que vuelvan.</h1><p className="muted">Entra al panel de tu negocio.</p><AuthForm mode="login" /><p className="helper">¿Aún no tienes cuenta? <Link href="/start">Crea tu negocio</Link></p></div><div className="auth-aside"><div className="aside-mark">✳</div><p>Cada cliente<br />tiene una historia.</p></div></main>;
}
