import { novaInline, novaReplyBlocks, novaStarters } from './novaChatModel';

function Inline({text}) { return novaInline(text).map((part,index)=>part.type==='bold'?<strong key={index}>{part.text}</strong>:part.text); }
export function NovaReply({content}) {
  return <div className="lp-nova-reply">{novaReplyBlocks(content).map((block,index)=>block.items ? (block.type==='ordered'?<ol key={index}>{block.items.map((item,i)=><li key={i}><Inline text={item}/></li>)}</ol>:<ul key={index}>{block.items.map((item,i)=><li key={i}><Inline text={item}/></li>)}</ul>) : <p key={index}>{block.type==='heading'?<strong><Inline text={block.text}/></strong>:<Inline text={block.text}/>}</p>)}</div>;
}
export function NovaIcon({kind}) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='plan'?<><path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3"/></>:kind==='interview'?<><path d="M4 4h16v12H9l-5 4zM8 8h8M8 12h5"/></>:<><path d="M6 3h9l4 4v14H6zM14 3v5h5M10 12h5M10 16h5"/></>}</svg>;
}
export function NovaWelcome({busy,onPrompt}) {
  return <div className="lp-nova-welcome"><p className="lp-nova-eyebrow">A LITTLE DIRECTION</p><h3>What’s your next move?</h3><div className="lp-nova-starters">{novaStarters.map(starter=><button type="button" key={starter.prompt} disabled={busy} aria-label={starter.prompt} onClick={()=>onPrompt(starter.prompt)}><span className="lp-nova-starter-icon"><NovaIcon kind={starter.icon}/></span><span><strong>{starter.prompt}</strong></span><span aria-hidden="true">↗</span></button>)}</div></div>;
}
export function NovaMessage({message,index,onCopy,copied,copyError}) {
  const assistant = message.role==='assistant';
  return <article className={`lp-nova-message is-${message.role}`} aria-label={assistant?`Nova reply ${index+1}`:'Your question'}><header><span>{assistant?'Nova':'You'}</span>{assistant&&<button type="button" className="lp-nova-copy" onClick={onCopy} aria-label={copied?'Reply copied':`Copy Nova reply ${index+1}`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>{copied?'Copied':'Copy'}</button>}</header>{assistant?<NovaReply content={message.content}/>:<><p>{message.content}</p>{message.includedSkills?.length>0&&<details className="lp-nova-sent-skills"><summary>Skills included in this question</summary><p>{message.includedSkills.join(', ')}</p></details>}</>}{copyError&&<p className="lp-nova-copy-feedback" role="status">Copy isn’t available here. Select the reply text to copy it.</p>}</article>;
}
export function NovaTyping() {
  return <div className="lp-nova-typing" role="status"><span aria-hidden="true"><i/><i/><i/></span>Nova is thinking…</div>;
}
