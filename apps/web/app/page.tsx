import Link from 'next/link';

export default function Home() {
  return <main className="landing">
    <nav className="topbar"><Link className="brand" href="/">W<span>•</span> Wallet Loyalty</Link><div className="navlinks"><Link href="/login">Iniciar sesión</Link><Link className="button small" href="/start">Crear negocio</Link></div></nav>
    <section className="hero"><div className="eyebrow"><span className="live-dot" /> Lealtad que cabe en el bolsillo</div>
      <h1>Cada visita<br />cuenta<span className="accent">.</span></h1>
      <p>Convierte visitas frecuentes en recompensas reales. Crea una campaña, comparte tu tarjeta digital y registra sellos desde el mostrador.</p>
      <div className="hero-actions"><Link className="button" href="/start">Crear mi negocio <span>↗</span></Link><a className="text-link" href="#como-funciona">Ver cómo funciona ↓</a></div>
    </section>
    <section className="preview"><div className="preview-caption">UNA EXPERIENCIA SIMPLE PARA TU CLIENTE</div><div className="sample-card">
      <div className="sample-top"><span>CASA & CAFÉ</span><span>✦</span></div>
      <div><p className="sample-label">TU TARJETA DE VISITAS</p><h2>Tu décimo café<br />va por nuestra cuenta.</h2></div>
      <div className="stamp-grid">{Array.from({ length: 10 }, (_, i) => <div className={i < 6 ? 'stamp filled' : 'stamp'} key={i}>{i < 6 ? '✦' : String(i + 1).padStart(2, '0')}</div>)}</div>
      <div className="sample-bottom"><span>6 DE 10 VISITAS</span><span>UN SELLO MÁS CERCA ↗</span></div>
    </div></section>
    <section id="como-funciona" className="steps"><div className="section-heading"><p className="eyebrow">DE LA IDEA AL MOSTRADOR</p><h2>Listo en tres movimientos.</h2></div><div className="step-grid">
      <article><span>01 /</span><h3>Crea tu campaña</h3><p>Define visitas, importe mínimo, vigencia y recompensa.</p></article>
      <article><span>02 /</span><h3>Comparte la tarjeta</h3><p>El cliente abre un enlace y guarda su progreso en el celular.</p></article>
      <article><span>03 /</span><h3>Registra visitas</h3><p>El empleado valida el ticket y suma un sello al instante.</p></article>
    </div></section>
    <footer>WALLET LOYALTY CARD <span>© 2026</span></footer>
  </main>;
}
