// No real Gemini requests, profile writes, or other network access are allowed here.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Navbar} from '../../src/App';
import '../../src/styles.css';
import '../../src/launchpad-shared.css';
const requests=[];
let failNext=false,slow=false;
window.fetch=async(path,options={})=>{
 if(path!=='/api/chat')throw new Error('Network access blocked in Nova fixture: '+path);
 const data=JSON.parse(options.body);requests.push(data);
 await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,slow?1600:350);options.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});
 if(failNext){failNext=false;return new Response(JSON.stringify({error:'Fixture service unavailable. Your question is still here.'}),{status:503});}
 return new Response(JSON.stringify({reply:'A good next step is to **start small**.\n\n- Choose one skill\n- Build a small project\n- Practice explaining your work\n\nKeep going. <script>bad()</script><img src=x onerror="bad()">'}));
};
function Fixture(){
 const [page,setPage]=React.useState('home'),[theme,setTheme]=React.useState('light'),[skills,setSkills]=React.useState(['Python','SQL','React']),[payloads,setPayloads]=React.useState(''),[notice,setNotice]=React.useState('');
 React.useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
 return <div className="app-shell lp-aligned-shell"><Navbar page={page} setPage={setPage} logout={()=>setNotice('Logout clicked')} auth={{user_id:7,name:'Never send this private name',email:'never-send@example.com',profileSkills:skills}} theme={theme} setTheme={setTheme}/><main style={{maxWidth:1160,padding:20,margin:'auto'}}><h1>Nova isolated QA</h1><p>All replies are mocked. No messages reach Google Gemini.</p><div style={{display:'flex',gap:16,flexWrap:'wrap'}}><button onClick={()=>{failNext=true;setNotice('Next reply will fail');}}>Fail next reply</button><button onClick={()=>{slow=!slow;setNotice(slow?'Slow replies on':'Slow replies off');}}>Toggle slow replies</button><button onClick={()=>setSkills(skills.length?[]:['Python','SQL','React'])}>Toggle saved skills</button><button onClick={()=>setPayloads(JSON.stringify(requests,null,2))}>Show sent payloads</button><button onClick={()=>setTheme(theme==='light'?'dark':'light')}>Toggle fixture theme</button><button onClick={()=>window.dispatchEvent(new CustomEvent('novateck-ask-nova',{detail:{prompt:'Help me plan my next skill'}}))}>Open from learning plan</button></div><p role="status">{notice}</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{payloads}</pre><p>Current page: {page}</p></main></div>;
}
const root=createRoot(document.getElementById('root'));root.render(<Fixture/>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
