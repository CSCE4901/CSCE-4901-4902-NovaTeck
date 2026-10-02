import { useEffect, useRef, useState } from 'react';

export default function ContactSupport({ token }) {
  const dialog = useRef(null);
  const [subject, setSubject] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState('');
  const [view, setView] = useState('new'), [requests, setRequests] = useState([]), [loading, setLoading] = useState(false), [historyError, setHistoryError] = useState('');
  async function loadRequests() {
    if (!token) return;
    setLoading(true); setHistoryError('');
    try {
      const response = await fetch('/api/support', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load requests.');
      setRequests(data);
    } catch (error) { setHistoryError(error.message); } finally { setLoading(false); }
  }
  function open() { dialog.current?.showModal(); }
  useEffect(() => { setRequests([]); setFeedback(''); setView('new'); }, [token]);
  useEffect(() => {
    window.addEventListener('novateck-contact-support', open);
    return () => window.removeEventListener('novateck-contact-support', open);
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (!token || busy) return;
    setBusy(true); setFeedback('');
    try {
      const response = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ subject, message }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send your request. Please try again.');
      setFeedback(`Request #${data.support_id} sent! Our support team can now review it.`);
      setSubject(''); setMessage('');
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }
  return <>
    <footer className="nova-footer"><span>NovaTeck · Your next opportunity starts here</span><button type="button" className="text-button" onClick={open}>Contact Support</button></footer>
    <dialog ref={dialog} className="nova-support-dialog" aria-labelledby="support-title">
      <header><div><span className="nova-eyebrow">WE’RE HERE TO HELP</span><h2 id="support-title">Contact Support</h2></div><button type="button" className="wf-secondary" aria-label="Close contact support" onClick={() => dialog.current?.close()}>×</button></header>
      <p>Have a question or found a problem? Tell us what happened. Please leave out passwords and sensitive details.</p>
      <div className="nova-support-tabs"><button type="button" className="wf-secondary" aria-pressed={view === 'new'} onClick={() => setView('new')}>New Request</button><button type="button" className="wf-secondary" aria-pressed={view === 'history'} onClick={() => { setView('history'); loadRequests(); }}>My Support Requests</button></div>
      {view === 'new' ? <form onSubmit={submit}><label htmlFor="support-subject">Subject</label><input id="support-subject" value={subject} onChange={event => setSubject(event.target.value)} maxLength={150} required placeholder="What can we help with?" />
        <label htmlFor="support-message">Message</label><textarea id="support-message" value={message} onChange={event => setMessage(event.target.value)} maxLength={3000} rows={6} required placeholder="Describe the issue and the steps that led to it…" />
        <p className="wf-muted">{token ? 'Your request goes directly to the NovaTeck support inbox.' : 'Please sign in to send a support request.'}</p>
        <p role="status">{feedback}</p><button className="primary-button" type="submit" disabled={!token || busy}>{busy ? "Sending…" : "Send Request"}</button>
      </form> : <div>{!token ? <p>Please sign in to view your requests.</p> : <><button className="wf-secondary" disabled={loading} onClick={loadRequests}>{loading ? 'Loading…' : 'Refresh'}</button>{historyError && <p role="alert">{historyError}</p>}{!loading && !historyError && !requests.length && <p>No support requests yet.</p>}{requests.map(row => <article className="nova-user-request" key={row.support_id}><span className="nova-count">#{row.support_id} · {row.status}</span><h3>{row.subject}</h3><p className="nova-support-message">{row.message}</p><small>{row.created_at}</small>{row.replies?.length ? row.replies.map(reply => <div className="nova-support-reply" key={reply.reply_id}><strong>{reply.admin_name} · Support</strong><p>{reply.message}</p><small>{reply.created_at}</small></div>) : <p>Waiting for a support reply.</p>}</article>)}</>}</div>}
    </dialog>
  </>;
}
