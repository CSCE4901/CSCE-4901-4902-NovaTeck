import { useEffect, useState } from 'react';
export default function SupportInbox({ token, request }) {
  const [drafts, setDrafts] = useState({});
  const [rows, setRows] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError('');
    try { setRows(await request('/admin/support', {}, token)); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [token]);
  async function update(row) {
    setBusy(true); setError('');
    const status = row.status === 'Open' ? 'Resolved' : 'Open';
    try { await request(`/admin/support/${row.support_id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token); setRows(current => current.map(item => item.support_id === row.support_id ? { ...item, status } : item)); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function reply(row) {
    if (!drafts[row.support_id]?.trim()) return;
    setBusy(true); setError('');
    try {
      await request(`/admin/support/${row.support_id}/replies`, { method: 'POST', body: JSON.stringify({ message: drafts[row.support_id] }) }, token);
      setDrafts(current => ({ ...current, [row.support_id]: '' }));
      await load();
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <section className="nova-support-inbox resume-panel"><div className="nova-section-heading"><h2>Support Inbox</h2><button className="wf-secondary" onClick={load} disabled={busy}>{busy ? 'Loading…' : 'Refresh'}</button></div><p className="wf-muted">Latest 200 requests · {rows.filter(row => row.status === 'Open').length} open</p>{error && <p role="alert">{error}</p>}{!busy && !rows.length && !error && <p className="wf-empty">No support requests yet.</p>}{rows.map(row => <article className="wf-job-row" key={row.support_id}><div><span className="nova-count">#{row.support_id} · {row.status}</span><h3>{row.subject}</h3><p>{row.name} · {row.email} · {row.created_at}</p><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{row.message}</p>{row.replies?.map(reply => <div className="nova-support-reply" key={reply.reply_id}><strong>{reply.admin_name} · Support</strong><p>{reply.message}</p><small>{reply.created_at}</small></div>)}<label htmlFor={`support-reply-${row.support_id}`}>Reply to user</label><textarea id={`support-reply-${row.support_id}`} rows={3} maxLength={3000} value={drafts[row.support_id] || ''} onChange={event => setDrafts(current => ({ ...current, [row.support_id]: event.target.value }))} /><button className="primary-button" disabled={busy || !drafts[row.support_id]?.trim()} onClick={() => reply(row)}>Send Reply</button></div><button className="wf-secondary" disabled={busy} onClick={() => update(row)}>{row.status === 'Open' ? 'Mark Resolved' : 'Reopen'}</button></article>)}</section>;
}
