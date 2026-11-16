import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NovaMessage, NovaTyping, NovaWelcome } from './NovaChatContent';
import { NOVA_MESSAGE_LIMIT, novaCopyText, novaMotionMs, novaQuestion, novaRequestHistory, novaSkillNames } from './novaChatModel';
import './CareerChat.css';

export default function CareerChat({ token, profileSkills }) {
  const [open,setOpen] = useState(false), [mounted,setMounted] = useState(false);
  const [messages,setMessages] = useState([]), [question,setQuestion] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [includeSkills,setIncludeSkills] = useState(false), [copied,setCopied] = useState(null), [copyError,setCopyError] = useState(null);
  const input = useRef(null), history = useRef(null), launcher = useRef(null), dialog = useRef(null), closeButton = useRef(null);
  const controller = useRef(null), inFlight = useRef(false), copyTimer = useRef(null);
  const skills = novaSkillNames(profileSkills);
  const includedSkills = includeSkills ? skills : [];
  const payload = novaQuestion(question,includedSkills);
  const overLimit = payload.length > NOVA_MESSAGE_LIMIT;
  const canSend = Boolean(question.trim()) && !busy && !overLimit;
  useEffect(()=>{if(!skills.length)setIncludeSkills(false);},[skills.length]);
  function launch() { setMounted(true);setOpen(true); }
  function close() { setOpen(false); }
  function finishClose() { dialog.current?.close();setMounted(false);launcher.current?.focus({preventScroll:true}); }

  useEffect(()=>{
    const ask=event=>{launch();setIncludeSkills(false);if(typeof event.detail?.prompt==='string')setQuestion(event.detail.prompt.slice(0,NOVA_MESSAGE_LIMIT));requestAnimationFrame(()=>input.current?.focus());};
    window.addEventListener('novateck-ask-nova',ask);
    return()=>window.removeEventListener('novateck-ask-nova',ask);
  },[]);
  useEffect(()=>()=>{controller.current?.abort();clearTimeout(copyTimer.current);},[]);
  useEffect(()=>{
    if(!mounted)return;
    const modal=dialog.current;
    if(!modal.open)modal.showModal();
    const previousOverflow=document.body.style.overflow, previousPadding=document.body.style.paddingRight;
    const scrollbar=window.innerWidth-document.documentElement.clientWidth;
    const padding=Number.parseFloat(getComputedStyle(document.body).paddingRight)||0;
    document.body.style.overflow='hidden';
    if(scrollbar)document.body.style.paddingRight=`${padding+scrollbar}px`;
    return()=>{modal.close();document.body.style.overflow=previousOverflow;document.body.style.paddingRight=previousPadding;};
  },[mounted]);
  useEffect(()=>{
    if(!mounted||open)return;
    const duration=novaMotionMs(getComputedStyle(dialog.current).getPropertyValue('--lp-duration-base'));
    const timer=setTimeout(finishClose,duration);
    return()=>clearTimeout(timer);
  },[mounted,open]);
  useEffect(()=>{if(open&&mounted)(busy?closeButton.current:input.current)?.focus();},[open,mounted,busy]);
  useEffect(()=>{if(open&&history.current)history.current.scrollTop=messages.length||busy||error?history.current.scrollHeight:0;},[messages,busy,error,open]);
  useLayoutEffect(()=>{
    if(!input.current)return;
    const field=input.current, style=getComputedStyle(field);
    const max=4*Number.parseFloat(style.lineHeight)+Number.parseFloat(style.paddingTop)+Number.parseFloat(style.paddingBottom);
    field.style.height='auto';field.style.height=`${Math.min(field.scrollHeight,max)}px`;field.style.overflowY=field.scrollHeight>max?'auto':'hidden';
  },[question,mounted]);

  async function send(text=question) {
    const value=text.trim();if(!value||inFlight.current)return;
    let requestHistory;
    try{requestHistory=novaRequestHistory(messages,value,includedSkills);}catch(failure){setQuestion(value);setError(failure.message);input.current?.focus();return;}
    const before=messages;
    const sentSkills=[...includedSkills];
    const localHistory=[...messages,{role:'user',content:value,...(sentSkills.length?{includedSkills:sentSkills}:{})}].slice(-19);
    inFlight.current=true;setMessages(localHistory);setQuestion('');setIncludeSkills(false);setBusy(true);setError('');
    const attempt=new AbortController();controller.current=attempt;
    const timer=setTimeout(()=>attempt.abort(),50000);
    try{
      const response=await fetch('/api/chat',{method:'POST',signal:attempt.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({messages:requestHistory})});
      const data=await response.json();
      if(!response.ok){if(response.status===401)window.dispatchEvent(new Event('novateck-session-expired'));throw new Error(data.error||'Nova could not respond. Please try again.');}
      if(typeof data.reply!=='string'||!data.reply.trim())throw new Error('Nova returned an empty reply. Please try again.');
      setMessages([...localHistory,{role:'assistant',content:data.reply}]);
    }catch(failure){setMessages(before);setQuestion(value);setIncludeSkills(sentSkills.length>0);setError(failure.name==='AbortError'?'The response took too long. Please try again.':failure.message);}
    finally{clearTimeout(timer);inFlight.current=false;setBusy(false);}
  }
  function reset(){setMessages([]);setQuestion('');setError('');setIncludeSkills(false);setCopied(null);setCopyError(null);clearTimeout(copyTimer.current);input.current?.focus();}
  async function copyReply(message,index){
    try{await navigator.clipboard.writeText(novaCopyText(message.content));setCopied(index);setCopyError(null);clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopied(null),2200);}
    catch{setCopyError(index);}
  }
  function keyboard(event){
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
    if(event.key!=='Tab')return;
    const controls=[...dialog.current.querySelectorAll('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),a[href],summary,[tabindex="0"]')].filter(element=>element.getClientRects().length);
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  const panel=mounted&&<dialog ref={dialog} className={`lp-nova-panel${open?' is-open':' is-closing'}`} aria-labelledby="nova-chat-title" aria-describedby="nova-chat-privacy" aria-modal="true" onCancel={event=>{event.preventDefault();close();}} onKeyDown={keyboard} onAnimationEnd={event=>{if(event.target===event.currentTarget&&!open)finishClose();}} onClick={event=>{if(event.target!==event.currentTarget)return;const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}}>
    <header className="lp-nova-header"><div className="lp-nova-identity"><span className="lp-nova-mark"><img src="/assets/rocket-twemoji.svg" width="32" height="32" alt=""/></span><div><h2 id="nova-chat-title">Nova</h2>{busy && <p><span className="is-thinking" aria-hidden="true"/>Thinking…</p>}</div></div><div className="lp-nova-header-actions"><button type="button" disabled={busy} onClick={reset} aria-label="Clear chat" title="Reset conversation">↻</button><button type="button" ref={closeButton} onClick={close} aria-label="Close chat" title="Close Nova">×</button></div></header>
    <div className="lp-nova-history" ref={history} role="region" aria-label="Chat history" tabIndex={0}>
      {!messages.length&&<NovaWelcome busy={busy} onPrompt={send}/>}
      <div role="log" aria-label="Conversation with Nova" aria-live="polite" aria-relevant="additions text">{messages.map((message,index)=><NovaMessage key={index} message={message} index={index} onCopy={()=>copyReply(message,index)} copied={copied===index} copyError={copyError===index}/>)}</div>
      {busy&&<NovaTyping/>}
      {error&&<div className="lp-nova-error" role="alert"><strong>Let’s try that again.</strong><p>{error}</p><button type="button" disabled={!canSend} onClick={()=>send()}>Retry</button></div>}
    </div>
    <form className="lp-nova-composer" onSubmit={event=>{event.preventDefault();send();}}>
      <label className="lp-nova-context-toggle"><input type="checkbox" checked={includeSkills} disabled={busy||!skills.length} onChange={event=>setIncludeSkills(event.target.checked)}/><span>Include my profile skills in this question</span><small>{includeSkills?'On':'Off'}</small></label>
      {!skills.length&&<p className="lp-nova-skills-note">{Array.isArray(profileSkills)?'No saved profile skills yet.':'Profile skills are loading.'}</p>}
      {includeSkills&&<section className="lp-nova-context-preview" tabIndex={0} aria-label="Skills to include in this question"><strong>Added to this question only:</strong><p>{skills.join(', ')}</p></section>}
      <div className="lp-nova-input-label"><label htmlFor="nova-chat-question">Ask Nova</label><span aria-label={`${payload.length} of ${NOVA_MESSAGE_LIMIT} characters`}>{payload.length} / {NOVA_MESSAGE_LIMIT}</span></div>
      <div className="lp-nova-input-row"><textarea id="nova-chat-question" ref={input} rows={1} value={question} onChange={event=>{setQuestion(event.target.value);if(error)setIncludeSkills(false);setError('');}} maxLength={NOVA_MESSAGE_LIMIT} placeholder="What would you like to work on?" disabled={busy} aria-describedby={`nova-chat-keyboard nova-chat-privacy${overLimit?' nova-chat-limit':''}`} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(canSend)send();}}}/><button type="submit" disabled={!canSend} aria-label="Send message"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></div>
      {overLimit&&<p className="lp-nova-limit" id="nova-chat-limit" role="alert">Your question and skills exceed 2,000 characters. Shorten the question or turn off profile skills.</p>}
      <p id="nova-chat-keyboard" className="lp-nova-keyboard">Enter to send · Shift+Enter for a new line</p>
      <p id="nova-chat-privacy" className="lp-nova-privacy">Messages are sent to Google Gemini. Avoid sensitive details. Profile, resume, and job data aren’t attached automatically.</p>
    </form>
  </dialog>;
  return <div className="nova-nav-chat">{mounted&&createPortal(panel,document.querySelector('.app-shell')||document.body)}<button type="button" className="nova-nav-tab lp-nova-launcher" ref={launcher} aria-expanded={open} aria-haspopup="dialog" aria-label={open?'Close Nova AI chat':'Chat with Nova AI'} onClick={()=>open?close():launch()}><svg className="nova-nav-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-13.2 8L3 21l1.5-4.8A9 9 0 1 1 21 11.5Z"/><path d="M8 10h8M8 14h5"/></svg>Nova</button></div>;
}
