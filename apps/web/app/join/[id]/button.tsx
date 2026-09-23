'use client';

import { useState } from 'react';

export function JoinButton({ campaignId }: { campaignId: string }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true); setError('');
    const response = await fetch('/api/enroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId }) }).catch(() => null);
    if (!response?.ok) { setBusy(false); return setError('Esta campaña no está disponible en este momento.'); }
    const data = await response.json();
    window.location.assign(data.cardUrl);
  }
  return <><button className="button" onClick={create} disabled={busy}>{busy ? 'Preparando tarjeta…' : 'Crear mi tarjeta ↗'}</button>{error && <p className="error" role="alert">{error}</p>}</>;
}
