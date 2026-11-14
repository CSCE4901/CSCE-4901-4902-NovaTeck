import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { skillGapView, learningResources, skillGapReport } from '../src/components/skillGapModel.js';

async function modules(run) {
  const server = await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
  try { await run(server); } finally { await server.close(); }
}
const job = {title:'Engineer',company_name:'DFW Employer',resume_match_pct:100,resume_match_source:'resume',resume_requirement_groups:[{skills:['React','TypeScript'],status:'matched'},{skills:['Python'],status:'matched'},{skills:['SQL Server'],status:'matched'}]};
test('selected job uses profile skills consistently and accepted skills update its score', () => {
  const before=skillGapView(job,['react'],'job');
  assert.equal(before.percent,33);
  assert.deepEqual(before.required.map(row=>row.matched),[true,false,false]);
  const after=skillGapView(job,['react','python'],'job');
  assert.equal(after.percent,67);
  assert.deepEqual(after.missing.map(row=>row.skill_name),['sql server']);
  assert.equal(skillGapView(job,['react','python','sql'],'job').percent,83);
  assert.equal(skillGapView({skill_summary:'React'},['react'],'job').percent,100);
});
test('market view uses the full demand-weighted API percentage even when the list is truncated', () => {
  const view=skillGapView({overall_match_pct:41,requested_skill_count:100,matched_skills:[{skill_name:'python'}],missing_skills:[{skill_name:'go',demand_count:12}]},['python'],'market');
  assert.equal(view.percent,41); assert.equal(view.total,100); assert.equal(view.required.length,2);assert.equal(view.missing[0].demand_count,12);
  const complete=skillGapView({overall_match_pct:100,requested_skill_count:3,matched_skills:[{skill_name:'python'},{skill_name:'go'},{skill_name:'rust'}]},['python'],'market');
  assert.equal(complete.percent,100); assert.equal(complete.matched,1);
  assert.match(complete.reason,/saved profile skills/);
});
test('job percentages include small requirement sets and empty profiles', () => {
  assert.equal(skillGapView({skill_summary:'React,Python'},['react'],'job').percent,50);
  assert.equal(skillGapView({skill_summary:'React'},[],'job').percent,0);
  assert.equal(skillGapView({skill_summary:''},['react'],'job').percent,null);
  assert.equal(skillGapView({},['react'],'market').percent,null);
});
test('curated resources cover gaps in order, including every item and honest search fallbacks', () => {
  const gaps=[{skill_name:'Unknown skill & tools',demand_count:12},{skill_name:'Python'},{skill_name:'React / TypeScript'},{skill_name:'SQL Server'},{skill_name:'Git'},{skill_name:'Java'}];
  const rows=learningResources({learning_resources:[{skill_name:'Python',resource_name:'Unverified',url:'javascript:alert(1)'}]},gaps);
  assert.equal(rows.length,6);
  assert.deepEqual(rows.map(row=>row.skill),gaps.map(row=>row.skill_name));
  assert.deepEqual(rows.map(row=>row.priority),[1,2,3,4,5,6]);
  assert.equal(rows[0].curated,false);assert.equal(rows[0].demandCount,12);
  assert.equal(new URL(rows[0].url).searchParams.get('query'),'Unknown skill & tools');
  assert.equal(rows[1].name,'The Python Tutorial');assert.equal(rows[1].provider,'Python Software Foundation');
  assert.equal(rows[1].demandCount,null);assert.equal(rows[2].resourceSkill,'React');
  assert.equal(rows[3].curated,false,'SQL Server is not silently treated as SQL');
  assert.ok(rows.every(row=>new URL(row.url).protocol==='https:'));
});
test('resume card replaces Scan with a Profile link when no resume exists',()=>modules(async server=>{
  const {ResumeDetectionCard}=await server.ssrLoadModule('/src/components/ResumeSkills.jsx');
  const empty=renderToStaticMarkup(createElement(ResumeDetectionCard,{saved:null}));
  assert.ok(empty.includes('No resume on file - upload one from your'));assert.ok(empty.includes('role="link"'));assert.ok(!empty.includes('Scan Resume for Skills'));
  let scanned=false, replacing=false;
  const props={saved:{filename:'resume.pdf'},skills:['react','python'],onScan:()=>{scanned=true;},onReplace:()=>{replacing=true;}};
  const html=renderToStaticMarkup(createElement(ResumeDetectionCard,props));
  assert.ok(html.includes('resume.pdf'));assert.ok(html.includes('<strong>2</strong>'));assert.ok(html.includes('Scan Resume for Skills'));
  assert.ok(html.includes('Replace Resume'));
  const [replace,scan]=ResumeDetectionCard(props).props.children[1].props.children[1].props.children;
  replace.props.onClick();assert.equal(replacing,true);
  scan.props.onClick();assert.equal(scanned,true);
}));
test('flag rows provide individual add and dismiss callbacks and the no-new state stays explicit',()=>modules(async server=>{
  const {FlaggedSkillGrid,PendingSkills}=await server.ssrLoadModule('/src/components/ResumeSkills.jsx');
  let added, dismissed;
  const skill={unmatched_id:9,skill_name:'python'};
  const grid=FlaggedSkillGrid({skills:[skill],onAdd:row=>{added=row;},onDismiss:row=>{dismissed=row;},onToggle(){}});
  const row=grid.props.children[0];row.props.children[1].props.onClick();row.props.children[2].props.onClick();assert.equal(added,skill);assert.equal(dismissed,skill);
  const html=renderToStaticMarkup(grid);assert.ok(html.includes('Add to Profile: Python'));assert.ok(html.includes('Dismiss Python suggestion'));
  assert.ok(renderToStaticMarkup(createElement(PendingSkills,{skills:[],noNewDetected:true})).includes('No new skills detected'));
}));
test('comparison follows wireframe order, distinguishes modes and includes loading/error states',()=>modules(async server=>{
  const {SkillGapContent,LearningRecommendations,MatchDonut}=await server.ssrLoadModule('/src/components/SkillGapPage.jsx');
  const props={own:['react'],view:skillGapView(job,['react'],'job'),mode:'job',label:'Engineer — DFW Employer'};
  const html=renderToStaticMarkup(createElement(SkillGapContent,props));
  const labels=['Your Skills','Required Skills','Selected-job match','Skills Gap'];
  let previous=-1;for(const label of labels){const position=html.indexOf(`>${label}</h2>`);assert.ok(position>previous,label);previous=position;}
  assert.ok(html.includes('✓ '));assert.ok(html.includes(' · Matched'));assert.ok(html.includes('Priority 1'));assert.ok(html.includes('33% Job match'));
  assert.ok(renderToStaticMarkup(createElement(SkillGapContent,{...props,loading:true})).includes('Loading skills gap'));
  assert.ok(renderToStaticMarkup(createElement(SkillGapContent,{...props,error:'Comparison unavailable'})).includes('Retry comparison'));
  assert.ok(renderToStaticMarkup(createElement(MatchDonut,{percent:null,label:'Job match'})).includes('Job match unavailable'));
  const resources=learningResources({},props.view.missing);
  const resourceHtml=renderToStaticMarkup(createElement(LearningRecommendations,{resources,hasTarget:true}));
  assert.ok(resourceHtml.includes('The Python Tutorial'));assert.ok(resourceHtml.includes('Python Software Foundation'));assert.ok(resourceHtml.includes('Search courses for SQL Server'));assert.ok(resourceHtml.includes('target="_blank"'));assert.ok(resourceHtml.includes('rel="noopener noreferrer"'));assert.ok(!resourceHtml.includes('Resource name not provided'));
}));
test('report preserves the target, percentage and unavailable resource details',()=>{
  const view=skillGapView(job,['react'],'job');
  const report=skillGapReport({label:'Engineer',mode:'job',own:['react'],view,flags:[],resources:learningResources({},view.missing)});
  for(const text of ['Target: Engineer','Mode: Selected job','Match: 33%','review order; employer priority not supplied','The Python Tutorial','Python Software Foundation','Course search (not a curated resource)'])assert.ok(report.includes(text),text);
});
