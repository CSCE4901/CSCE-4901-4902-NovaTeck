import { useEffect, useRef, useState } from 'react';

export default function CareerChat({ token }) {
  const [open, setOpen] = useState(false), [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const input = useRef(null), bottom = useRef(null), launcher = useRef(null), controller = useRef(null);
  useEffect(() => {
    const ask = event => { setOpen(true); if (typeof event.detail?.prompt === 'string') setQuestion(event.detail.prompt.slice(0, 2000)); };
    window.addEventListener('novateck-ask-nova', ask);
    return () => window.removeEventListener('novateck-ask-nova', ask);
  }, []);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { if (open) bottom.current?.scrollIntoView({ block: 'nearest' }); }, [messages, busy, open]);
  function close() { setOpen(false); launcher.current?.focus(); }
  async function send(text = question) {
    const value = text.trim(); if (!value || busy) return;
    const history = [...messages, { role: 'user', content: value }].slice(-19);
    setMessages(history); setQuestion(''); setBusy(true); setError('');
    controller.current = new AbortController();
    const timer = setTimeout(() => controller.current?.abort(), 50000);
    try {
      const response = await fetch('/api/chat', { method: 'POST', signal: controller.current.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ messages: history }) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) window.dispatchEvent(new Event('novateck-session-expired'));
        throw new Error(data.error || 'Nova could not respond. Please try again.');
      }
      setMessages([...history, { role: 'assistant', content: data.reply }]);
    } catch (failure) { setMessages(history.slice(0, -1)); setQuestion(value); setError(failure.name === 'AbortError' ? 'The response took too long. Please try again.' : failure.message); }
    finally { clearTimeout(timer); setBusy(false); }
  }
  return <div className="nova-nav-chat">
    {open && <section className="nova-chat-panel" aria-label="Nova AI career assistant" onKeyDown={event => { if (event.key === 'Escape') close(); }}>
      <header><div><strong>Nova AI</strong><span>Your career copilot</span></div><div><button disabled={busy} onClick={() => { setMessages([]); setError(''); setQuestion(''); }} aria-label="Clear chat">↻</button><button onClick={close} aria-label="Close chat">×</button></div></header>
      <div className="nova-chat-history" role="log" aria-live="polite">
        {!messages.length && <div className="nova-chat-welcome"><span aria-hidden="true">◎</span><h3>What’s your next move?</h3><p>Let’s plan your skills, sharpen your resume, or practice for an interview.</p>{['Help me build a learning plan', 'Practice a tech interview', 'Improve my resume bullet points'].map(prompt => <button disabled={busy} key={prompt} onClick={() => send(prompt)}>{prompt} ↗</button>)}</div>}
        {messages.map((message, index) => <div className={`nova-chat-message is-${message.role}`} key={index}><small>{message.role === 'user' ? 'You' : 'Nova'}</small><p>{message.content}</p></div>)}
        {busy && <p role="status" className="nova-chat-thinking">Nova is thinking…</p>}<div ref={bottom} />
      </div>
      {error && <p className="nova-chat-error" role="alert">{error}</p>}
      <form onSubmit={event => { event.preventDefault(); send(); }}><label className="nova-chat-input-label" htmlFor="nova-chat-question">Ask Nova</label><div><input id="nova-chat-question" ref={input} value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} placeholder="Ask about your next career step…" disabled={busy} /><button type="submit" disabled={busy || !question.trim()} aria-label="Send message">↑</button></div><small>Messages are sent to Google Gemini. Avoid sharing sensitive details; your profile and resume aren’t attached automatically.</small></form>
    </section>}
    <button className="nova-nav-tab" ref={launcher} aria-expanded={open} aria-label={open ? 'Close Nova AI chat' : 'Chat with Nova AI'} onClick={() => open ? close() : setOpen(true)}>
      <svg className="nova-nav-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-13.2 8L3 21l1.5-4.8A9 9 0 1 1 21 11.5Z"/><path d="M8 10h8M8 14h5"/></svg>Nova
    </button>
  </div>;
}
