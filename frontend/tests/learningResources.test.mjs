import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {curatedLearningResources,findLearningResource} from '../src/components/learningResources.js';
import {learningResources} from '../src/components/skillGapModel.js';

test('catalog contains 30 distinct skills with complete provider and HTTPS resource metadata',()=>{
 assert.equal(curatedLearningResources.length,30);
 assert.equal(new Set(curatedLearningResources.map(row=>row.skill.toLowerCase())).size,30);
 for(const row of curatedLearningResources){
  assert.ok(row.skill&&row.name&&row.provider);
  assert.ok(['Course','Documentation','Tutorial','Video'].includes(row.type));
  const url=new URL(row.url);assert.equal(url.protocol,'https:');assert.ok(!url.searchParams.has('query'),'Curated resources must be direct pages');
 }
 assert.equal(findLearningResource('  pYtHon  ').name,'The Python Tutorial');
 assert.equal(findLearningResource('Git / Subversion').skill,'Git');
 assert.equal(findLearningResource('Imaginary Platform'),null);
});

test('cards expose direct versus search links, provider, type and demand without invented counts',async()=>{
 const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
 try{
  const {LearningRecommendations}=await server.ssrLoadModule('/src/components/SkillGapPage.jsx');
  const rows=learningResources({},[{skill_name:'Python',demand_count:53},{skill_name:'SQL Server'},{skill_name:'Git',demand_count:1}]);
  const html=renderToStaticMarkup(createElement(LearningRecommendations,{resources:rows,hasTarget:true}));
  assert.equal((html.match(/<article/g)||[]).length,3);
  assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g)||[]).length,3);
  assert.ok(html.includes('The Python Tutorial'));assert.ok(html.includes('Python Software Foundation'));
  assert.ok(html.includes('sg-resource-type">Tutorial'));
  assert.ok(html.includes('Required in 53 listed jobs.'));assert.ok(html.includes('Required in 1 listed job.'));
  assert.equal((html.match(/Why this matters:/g)||[]).length,2);
  assert.ok(html.includes('Search courses for SQL Server'));
  assert.ok(html.indexOf('>Python</h3>')<html.indexOf('>SQL Server</h3>'));
 }finally{await server.close();}
});
