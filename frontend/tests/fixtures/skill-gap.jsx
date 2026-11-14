// Isolated manual regression fixture. Every request is mocked; no account data is changed.
import React from 'react';
import { createRoot } from 'react-dom/client';
import SkillGapPage from '../../src/components/SkillGapPage';
import '../../src/styles.css';
import '../../src/launchpad-shared.css';
const state = { skills:['react'], flags:[{unmatched_id:1,skill_name:'python'},{unmatched_id:2,skill_name:'sql'}], dismissed:[], fail:false };
const job={job_id:42,title:'QA Engineer',company_name:'Fixture Company',resume_requirement_groups:[{skills:['react']},{skills:['python']},{skills:['sql']}],resume_match_pct:100,resume_match_source:'resume'};
const summary=()=>({user_skills:[...state.skills],overall_match_pct:Math.round(state.skills.length/3*100),requested_skill_count:3,matched_skills:state.skills.map(skill_name=>({skill_name})),missing_skills:['react','python','sql'].filter(s=>!state.skills.includes(s)).map(skill_name=>({skill_name,demand_count:10})),unverified_skills:[...state.flags]});
async function request(path,options={}) {
  await new Promise(resolve=>setTimeout(resolve,50));
  if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
  if(path.startsWith('/jobs?'))return [job];
  if(path==='/students/7')return {skills:state.skills.join(',')};
  if(path.startsWith('/students/7/skill-gap')) {
    if(state.fail)throw new Error('Fixture comparison error');
    return path.includes('job_id')?{...job,unverified_skills:[...state.flags]}:summary();
  }
  if(path==='/resume/skills/impact')return {job_count:1,current_market_match:33,projected_market_match:100};
  if(path==='/resume/skills/add') {
    const ids=JSON.parse(options.body).flag_ids;
    state.flags.filter(flag=>ids.includes(flag.unmatched_id)).forEach(flag=>state.skills.push(flag.skill_name));
    state.flags=state.flags.filter(flag=>!ids.includes(flag.unmatched_id));return {};
  }
  const id=Number(path.split('/')[3]);
  if(path.endsWith('/restore')) {state.flags.push(...state.dismissed.filter(flag=>flag.unmatched_id===id));state.dismissed=state.dismissed.filter(flag=>flag.unmatched_id!==id);return {};}
  if(options.method==='DELETE') {state.dismissed.push(...state.flags.filter(flag=>flag.unmatched_id===id));state.flags=state.flags.filter(flag=>flag.unmatched_id!==id);return {};}
  throw new Error('Unexpected fixture request: '+path);
}
window.fetch=async path=>{
  if(path==='/api/resume/saved')return new Response(JSON.stringify({filename:'fixture-resume.pdf',skills:['react','python','sql']}));
  if(path==='/api/resume/saved/scan')return new Response(JSON.stringify({skills:['react','python','sql'],flagged_count:0,message:'Saved resume scanned. No new skills detected.'}));
  throw new Error('Network access blocked by isolated fixture: '+path);
};
function Fixture() {const [profileSkills,setProfileSkills]=React.useState(state.skills);React.useEffect(()=>{const update=event=>setProfileSkills(event.detail.skills);window.addEventListener('novateck-profile-skills-saved',update);return()=>window.removeEventListener('novateck-profile-skills-saved',update);},[]);return <div className="app-shell lp-aligned-shell"><aside style={{padding:20,display:'flex',gap:16,flexWrap:'wrap'}}><strong>Isolated QA — mocked data</strong><button onClick={()=>{state.fail=true;}}>Fail next comparison</button><button onClick={()=>{state.fail=false;}}>Recover comparison</button><button onClick={()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';}}>Toggle fixture theme</button></aside><div className="nova-page-container"><SkillGapPage auth={{user_id:7,token:'fixture-only',profileSkills}} request={request} setPage={()=>{document.title='Profile link activated';}} /></div></div>;}
createRoot(document.getElementById('root')).render(<Fixture />);
