'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export function AuthForm({ mode }: { mode: 'register' | 'login' }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setLoading(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).catch(() => null);
    setLoading(false);
    if (!response) return setError('No pudimos conectar. Intenta de nuevo.');
    if (!response.ok) { const body = await response.json(); return setError(typeof body.message === 'string' ? body.message : 'Revisa los datos e intenta de nuevo.'); }
    router.push('/dashboard'); router.refresh();
  }
  return <form className="stack-form" onSubmit={submit}>
    {mode === 'register' && <><label>Nombre de negocio<input name="businessName" required minLength={2} maxLength={120} placeholder="Ej. Casa & Café" /></label><label>Identificador público<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={60} placeholder="casa-cafe" /><small>Solo letras minúsculas, números y guiones.</small></label></>}
    <label>Correo electrónico<input name="email" type="email" required autoComplete="email" placeholder="tu@negocio.com" /></label>
    <label>Contraseña<input name="password" type="password" required minLength={mode === 'register' ? 12 : undefined} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="Mínimo 12 caracteres" /></label>
    {error && <p role="alert" className="error">{error}</p>}
    <button className="button" disabled={loading}>{loading ? 'Un momento…' : mode === 'register' ? 'Crear mi cuenta ↗' : 'Entrar al panel ↗'}</button>
  </form>;
}
