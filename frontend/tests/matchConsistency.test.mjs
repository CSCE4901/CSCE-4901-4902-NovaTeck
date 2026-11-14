import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

// Current Accordion requirements, deliberately paired with its conflicting resume score.
const job={job_id:148,title:'Technical Architect & Engagement Lead, NetSuite',company_name:'Accordion',resume_match_pct:67,resume_matched_count:2,resume_required_count:3,resume_match_source:'resume',resume_requirement_groups:[{skills:['communication'],status:'missing'},{skills:['git'],status:'matched'},{skills:['sql'],status:'matched'}]};

test('Accordion uses identical profile percentage and skill counts on every job surface',async()=>{
 const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
 try {
  const {default:Card}=await server.ssrLoadModule('/src/components/LaunchpadJobCard.jsx');
  const {default:Row}=await server.ssrLoadModule('/src/components/CompactSimilarJob.jsx');
  const {JobDetailContent}=await server.ssrLoadModule('/src/components/WireframePages.jsx');
  const {SkillGapContent}=await server.ssrLoadModule('/src/components/SkillGapPage.jsx');
  const {skillGapView}=await server.ssrLoadModule('/src/components/skillGapModel.js');
  for(const [profileSkills,percent,count] of [[['Communication','Git','SQL'],100,3],[['Git','SQL'],67,2],[['Communication'],33,1]]){
   // Different endpoint representations must not change the result.
   const variants=[job,{...job,resume_requirement_groups:undefined,skills:['SQL','Git','Communication'].map(skill_name=>({skill_name,requirement_type:'required'}))},{...job,resume_requirement_groups:undefined,skill_summary:'Communication, Git, SQL'}];
   for(const current of variants){
    const props={job:current,profileSkills,goJob(){},setPage(){}};
    const surfaces=[['Jobs card',createElement(Card,props)],['Job Details',createElement(JobDetailContent,props)],['Dashboard saved',createElement(Row,{...props,saved:true,showRemove:true,onSave(){}})],['Dashboard recommended',createElement(Row,{...props,onSave(){}})],['Similar Jobs',createElement(Row,props)],['Skill Gap',createElement(SkillGapContent,{own:profileSkills,view:skillGapView(current,profileSkills,'job'),mode:'job',label:job.title})]];
    for(const [name,element] of surfaces){
     const html=renderToStaticMarkup(element).replace(/<!--.*?-->/g,'');
     assert.ok(html.includes(`${percent}%`)||html.includes(`${percent}<small>%`),`${name}: ${percent}%`);
     const countLabel = name === 'Skill Gap' ? 'required skill groups fully matched' : 'skills';
     assert.ok(html.includes(`${count} of 3 ${countLabel}`),`${name}: ${count} of 3 ${countLabel}`);
     assert.match(html,/profile/i,name);
    }
   }
  }
 }finally{await server.close();}
});

test('Skill Gap consumes the same shell profile snapshot rather than its own fetched copy',async()=>{
 const source=await readFile(new URL('../src/components/SkillGapPage.jsx',import.meta.url),'utf8');
 assert.match(source,/const own = auth\.profileSkills/);
 assert.ok(!source.includes('setOwn'));
 const app=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
 assert.match(app,/<AuthContext.Provider value=\{auth\}>/);
 assert.match(app,/<LaunchpadJobCard profileSkills=\{auth\?\.profileSkills\}/);
 assert.match(app,/<WireSkillGap auth=\{auth\}/);
});
