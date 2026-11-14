import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

async function withModules(run) {
  const server = await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
  try { await run(server); } finally { await server.close(); }
}
const sample = {job_id:12,title:'Software Engineer',company_name:'Nova Employer',location:'Dallas, TX',salary_range:'$80,000 - $110,000',work_arrangement:'Hybrid',job_type:'Full-time',source_url:'https://example.com/job',resume_match_pct:100,resume_requirement_groups:[{skills:['react']},{skills:['python']},{skills:['sql']}]};
test('Jobs card exposes profile ring, one missing chip, location, salary, save and apply',()=>withModules(async server=>{
  const {default:Card}=await server.ssrLoadModule('/src/components/LaunchpadJobCard.jsx');
  const html=renderToStaticMarkup(createElement(Card,{job:sample,goJob(){},onSave(){},onProfile(){},profileSkills:['react']}));
  for(const text of ['33% profile skill match','Focus next: ','Python','Hybrid','$80,000 - $110,000','Save job: Software Engineer','Apply for Software Engineer','PROFILE MATCH','1 of 3 skills'])assert.ok(html.includes(text),text);
  assert.ok(!html.includes('100%'));
  let opened=0,savedId=null;
  const card=Card({job:sample,goJob:()=>opened++,onSave:job=>{savedId=job.job_id;},profileSkills:['react']});
  card.props.children[1].props.children[0].props.onClick();assert.equal(savedId,12);
  const savedHtml=renderToStaticMarkup(createElement(Card,{job:sample,goJob(){},onSave(){},saved:true,busy:true,profileSkills:['react']}));
  assert.ok(savedHtml.includes('Unsave job: Software Engineer'));assert.ok(savedHtml.includes('aria-pressed="true"'));assert.ok(savedHtml.includes('disabled=""'));
  card.props.onClick({target:{closest:()=>null}});assert.equal(opened,1);
  card.props.onClick({target:{closest:()=>({})}});assert.equal(opened,1);
  card.props.onKeyDown({target:card,currentTarget:card,key:'Enter',preventDefault(){}});assert.equal(opened,2);
}));
test('empty profile invites Profile and does not show zero percent',()=>withModules(async server=>{
  const {default:Card}=await server.ssrLoadModule('/src/components/LaunchpadJobCard.jsx');
  const html=renderToStaticMarkup(createElement(Card,{job:sample,goJob(){},onSave(){},onProfile(){},profileSkills:[]}));
  assert.ok(html.includes('Add skills in Profile'));assert.ok(!html.includes('0%'));
  const {default:Ring}=await server.ssrLoadModule('/src/components/ProfileMatchRing.jsx');
  let opened=false;
  const element=Ring({match:{state:'empty',missing:[]},onProfile:()=>{opened=true;}});
  element.props.children[2].props.onClick();assert.equal(opened,true);
}));
test('loading, empty and retry states expose appropriate semantics and actions',()=>withModules(async server=>{
  const {JobsSkeleton,JobsEmpty,JobsError}=await server.ssrLoadModule('/src/components/JobsStates.jsx');
  assert.ok(renderToStaticMarkup(createElement(JobsSkeleton)).includes('Loading job opportunities'));
  let cleared=false,retried=false;
  const empty=JobsEmpty({onClear:()=>{cleared=true;}}),error=JobsError({message:'Try again later',onRetry:()=>{retried=true;}});
  empty.props.children[3].props.onClick();error.props.children[3].props.onClick();
  assert.equal(cleared,true);assert.equal(retried,true);
  assert.ok(renderToStaticMarkup(createElement(JobsError,{message:'Try again later',onRetry(){}})).includes('role="alert"'));
}));

test('job cards distinguish zero, one and two listed requirements',()=>withModules(async server=>{
  const {default:Card}=await server.ssrLoadModule('/src/components/LaunchpadJobCard.jsx');
  for (const count of [0,1,2]) {
    const job={...sample,resume_requirement_groups:sample.resume_requirement_groups.slice(0,count)};
    const html=renderToStaticMarkup(createElement(Card,{job,goJob(){},onSave(){},profileSkills:['react','python','sql']}));
    if (count === 0) assert.ok(html.includes('Skills not listed'));
    else assert.match(html, /100<small>%/);
    if (count > 0) {
      const noMatch = renderToStaticMarkup(createElement(Card,{job,goJob(){},onSave(){},profileSkills:['unrelated skill']}));
      assert.ok(noMatch.includes('No match'));
    }
  }
}));
