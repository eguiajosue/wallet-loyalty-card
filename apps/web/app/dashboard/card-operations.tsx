'use client';

import { FormEvent, useRef, useState } from 'react';

type Visit = {
  id: string; ticketNumber: string; amountCents: number; createdAt: string; branchName: string;
  cancellationId: string | null; cancellationStatus: 'pending' | 'approved' | 'rejected' | null;
  cancellationReason: string | null; decisionReason: string | null;
};
type CardHistory = {
  card: { campaignName: string; rewardDescription: string; visitCount: number; targetVisits: number;
    state: 'active' | 'reward_ready' | 'redeemed'; campaignActive: boolean };
  visits: Visit[];
  permissions: { canDecideCancellation: boolean };
  redemption: { createdAt: string; rewardDescription: string } | null;
  events: { id: string; kind: string; createdAt: string }[];
};
type Action = { kind: 'redeem' } | { kind: 'request' | 'approved' | 'rejected'; visit: Visit };
const labels: Record<string, string> = {
  'visit.recorded': 'Visita registrada', 'reward.unlocked': 'Recompensa desbloqueada',
  'reward.redeemed': 'Recompensa entregada', 'cancellation.requested': 'Cancelación solicitada',
  'cancellation.approved': 'Cancelación aprobada', 'cancellation.rejected': 'Cancelación rechazada',
};
const date = (value: string) => new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

async function operation(data: Record<string, unknown>, key?: string): Promise<Response> {
  return fetch('/api/card-operations', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(data) });
}

export function CardOperations() {
  const [history, setHistory] = useState<CardHistory | null>(null);
  const [cardUrl, setCardUrl] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const url = String(new FormData(event.currentTarget).get('cardUrl')).trim();
    pending.current = true; setBusy(true); setError(''); setMessage(''); setHistory(null); setAction(null);
    try {
      const response = await operation({ action: 'inspect', cardUrl: url });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'No se pudo consultar la tarjeta');
      setCardUrl(url); setHistory(data);
    } catch (err) { setError(err instanceof Error ? err.message : 'No pudimos conectar'); }
    finally { pending.current = false; setBusy(false); }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || pending.current) return;
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
    const payload: Record<string, unknown> = { cardUrl };
    if (action.kind === 'redeem') payload.action = 'redeem';
    else if (action.kind === 'request') Object.assign(payload, { action: 'requestCancellation', visitId: action.visit.id, reason });
    else Object.assign(payload, { action: 'decideCancellation', requestId: action.visit.cancellationId, decision: action.kind, reason });
    const fingerprint = JSON.stringify(payload);
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const response = await operation(payload, retry.current.key);
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Revisa el motivo y vuelve a intentarlo');
      retry.current = null; setAction(null);
      setMessage(action.kind === 'redeem' ? 'Recompensa entregada. La tarjeta ha finalizado.' : 'Solicitud guardada. El historial se ha actualizado.');
      const updated = await operation({ action: 'inspect', cardUrl });
      if (!updated.ok) { setHistory(null); throw new Error('La operación se guardó. Consulta la tarjeta de nuevo para ver su estado.'); }
      setHistory(await updated.json());
    } catch (err) { setError(err instanceof Error ? err.message : 'No pudimos confirmar el resultado. Puedes reintentar.'); }
    finally { pending.current = false; setBusy(false); }
  }

  const hasPending = history?.visits.some(v => v.cancellationStatus === 'pending');
  return <section className="operations-section" aria-labelledby="operations-title">
    <p className="eyebrow">03 / TARJETAS Y RECOMPENSAS</p><h2 id="operations-title">Cada movimiento, claro.</h2>
    <form className="lookup-form" onSubmit={lookup}>
      <label htmlFor="history-url">Enlace de la tarjeta del cliente</label>
      <div><input id="history-url" name="cardUrl" type="url" required placeholder="https://…/card/…" disabled={busy} /><button className="button" disabled={busy}>Consultar tarjeta ↗</button></div>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status" className="success">{message}</p>}
    {history && <div className="operations-content">
      <div className="card-summary"><div><p className="eyebrow">{history.card.state === 'redeemed' ? 'TARJETA FINALIZADA' : 'TARJETA DEL CLIENTE'}</p><h3>{history.card.campaignName}</h3><p>{history.card.rewardDescription}</p><small>{history.card.visitCount} de {history.card.targetVisits} visitas válidas</small></div>
        <div>{history.redemption ? <p className="redeemed-label">Entregada el {date(history.redemption.createdAt)}</p> : <>
          <button type="button" className="button" disabled={busy || history.card.state !== 'reward_ready' || !history.card.campaignActive || hasPending} onClick={() => { setAction({ kind: 'redeem' }); setError(''); }}>Entregar recompensa ↗</button>
          {hasPending && <p className="helper">Primero resuelve las cancelaciones pendientes.</p>}
          {!history.card.campaignActive && <p className="helper">La campaña no está activa.</p>}
        </>}</div>
      </div>
      {action && <form onSubmit={confirm} className="action-confirm" key={action.kind === 'redeem' ? 'redeem' : `${action.kind}-${action.visit.id}`}>
        <h3>{action.kind === 'redeem' ? 'Confirmar entrega' : action.kind === 'request' ? 'Solicitar cancelación' : action.kind === 'approved' ? 'Aprobar cancelación' : 'Rechazar cancelación'}</h3>
        <p>{action.kind === 'redeem' ? `Premio: ${history.card.rewardDescription}. Al confirmar, esta tarjeta quedará finalizada.` : `Ticket ${action.visit.ticketNumber}. ${action.kind === 'approved' ? 'Se retirará una visita válida de la tarjeta.' : 'La decisión y su motivo quedarán en el historial.'}`}</p>
        {action.kind === 'redeem' ? <label className="check-label"><input type="checkbox" required disabled={busy} /> Confirmo que estoy entregando la recompensa al cliente.</label> : <label>Motivo<textarea name="reason" required minLength={3} maxLength={500} rows={3} disabled={busy} placeholder="Explica el motivo de la operación" /></label>}
        <div className="action-buttons"><button className="button" disabled={busy}>{busy ? 'Guardando…' : 'Confirmar'}</button><button className="button outline" type="button" disabled={busy} onClick={() => setAction(null)}>Volver</button></div>
      </form>}
      <h3 className="history-title">Visitas y tickets</h3>
      {!history.visits.length && <p className="empty-state">Todavía no hay visitas registradas.</p>}
      <ul className="visit-ledger">{history.visits.map(visit => <li key={visit.id}>
        <div><span className={`visit-badge ${visit.cancellationStatus ?? 'valid'}`}>{visit.cancellationStatus === 'approved' ? 'Cancelada' : visit.cancellationStatus === 'pending' ? 'Cancelación pendiente' : 'Válida'}</span>
          <h4>Ticket {visit.ticketNumber}</h4><p>{date(visit.createdAt)} · {visit.branchName} · {(visit.amountCents / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
          {visit.cancellationReason && <p>Solicitud: {visit.cancellationReason}</p>}{visit.decisionReason && <p>Decisión: {visit.decisionReason}</p>}
        </div><div className="ledger-actions">
          {!visit.cancellationId && history.card.state !== 'redeemed' && <button type="button" disabled={busy} onClick={() => setAction({ kind: 'request', visit })}>Solicitar cancelación</button>}
          {visit.cancellationStatus === 'pending' && history.permissions.canDecideCancellation && <><button type="button" disabled={busy} onClick={() => setAction({ kind: 'approved', visit })}>Aprobar</button><button type="button" disabled={busy} onClick={() => setAction({ kind: 'rejected', visit })}>Rechazar</button></>}
        </div>
      </li>)}</ul>
      <details className="audit-details"><summary>Historial de movimientos · últimos 100</summary><ol>{history.events.map(event => <li key={event.id}><span>{labels[event.kind] ?? event.kind}</span><time dateTime={event.createdAt}>{date(event.createdAt)}</time></li>)}</ol></details>
    </div>}
  </section>;
}
