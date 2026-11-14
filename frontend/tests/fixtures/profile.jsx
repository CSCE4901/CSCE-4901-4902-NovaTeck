// Isolated UI QA: no real account data or network requests are used.
import React from 'react';
import {createRoot} from 'react-dom/client';
import ProfilePage from '../../src/components/ProfilePage';
import '../../src/styles.css';
import '../../src/launchpad-shared.css';
const state={user:{name:'Jamie Rivera',email:'jamie@example.com',skills:'Python, SQL'},details:{phone:'2145550123',location:'Dallas, TX',photo:'',college_major:'Computer Science',work_types:['Full-time'],salary_range:'No preference',preferred_location:'Dallas, TX',proficiency:{Python:'Advanced',SQL:'Intermediate'},experience:[{company:'Launch Lab',title:'Student Developer',start:'2025-06-01',end:'2025-08-01',description:'Built accessible interfaces.'}],projects:[{title:'Campus Connect',technologies:'React',url:'https://example.com',description:'Helped students find study groups.'}]},resume:{filename:'Jamie-Resume.docx',skills:['Python','SQL']},failSave:false,failUpload:false,requests:[]};
const clone=value=>JSON.parse(JSON.stringify(value));
const delay=()=>new Promise(resolve=>setTimeout(resolve,180));
async function request(path,options={}){
 await delay();
 if(options.method==='PUT'){
  state.requests.push({path,body:JSON.parse(options.body)});
  if(state.failSave)throw new Error('Fixture save failed.');
  if(path.endsWith('/profile-details')){const body=JSON.parse(options.body);state.details=clone(body.details);state.user.name=body.name;state.user.email=body.email;return {name:body.name};}
  if(path.endsWith('/skills')){state.user.skills=JSON.parse(options.body).skills.join(',');return {};}
 }
 if(path==='/students/7')return clone(state.user);
 if(path==='/students/7/profile-details')return clone(state.details);
 throw new Error('Unexpected fixture request: '+path);
}
window.fetch=async(path,options={})=>{
 await delay();
 if(path==='/api/resume/saved')return new Response(JSON.stringify(clone(state.resume)));
 if(path==='/api/resume/saved/preview')return new Response(JSON.stringify({text:'Jamie Rivera\nStudent Developer\nPython, SQL'}));
 if(path==='/api/resume/upload'){
  if(state.failUpload)return new Response(JSON.stringify({error:'Fixture upload failed.'}),{status:500});
  state.resume={filename:options.body.get('resume').name,skills:['Python','SQL']};return new Response(JSON.stringify({skills:['Python','SQL']}));
 }
 throw new Error('Real network access blocked by profile fixture: '+path);
};
function Fixture(){const [page,setPage]=React.useState('profile'),[notice,setNotice]=React.useState(''),[records,setRecords]=React.useState('');return <div className="app-shell lp-aligned-shell"><nav className="nova-nav" aria-label="Main navigation"><button className="nova-nav-tab" onClick={()=>setPage('home')}>Home</button><button className="nova-nav-tab" aria-current={page==='profile'?'page':undefined} onClick={()=>setPage('profile')}>Profile</button></nav><aside style={{padding:20,display:'flex',gap:12,flexWrap:'wrap'}}><strong>Isolated Profile QA — mocked data</strong><button onClick={()=>{state.failSave=!state.failSave;setNotice(state.failSave?'Save failures on':'Save failures off');}}>Toggle save failure</button><button onClick={()=>{state.failUpload=!state.failUpload;setNotice(state.failUpload?'Upload failures on':'Upload failures off');}}>Toggle upload failure</button><button onClick={()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';}}>Toggle fixture theme</button><button onClick={()=>setRecords(JSON.stringify(state.requests,null,2))}>Show saved request records</button><p role="status">{notice}</p><pre style={{maxWidth:"100%",overflow:"auto",flexBasis:"100%"}}>{records}</pre></aside><div className="nova-page-container">{page==='profile'?<ProfilePage auth={{user_id:7,token:'fixture-only',name:state.user.name}} request={request} onNameChange={()=>{}} setPage={setPage}/>:<div><h1>Navigation completed</h1><p>{page}</p><button onClick={()=>setPage('profile')}>Return to Profile</button></div>}</div></div>;}
const root=createRoot(document.getElementById('root'));
root.render(<Fixture/>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
