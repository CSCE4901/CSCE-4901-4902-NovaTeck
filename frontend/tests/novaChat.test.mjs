import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NOVA_MESSAGE_LIMIT,novaQuestion,novaRequestHistory,novaSkillNames,novaReplyBlocks,novaCopyText,novaMotionMs,novaStarters} from '../src/components/novaChatModel.js';

test('chat payload has no automatic context and only whitelisted message fields',()=>{
 const history=[{role:'user',content:'First question',includedSkills:['Python'],profile:{name:'Private name'},resume:'Private resume',job:'Private job'},{role:'assistant',content:'A helpful answer.'}];
 const payload=novaRequestHistory(history,'Next question');
 assert.deepEqual(payload,[{role:'user',content:'First question'},{role:'assistant',content:'A helpful answer.'},{role:'user',content:'Next question'}]);
 const serialized=JSON.stringify(payload);
 for(const privateValue of ['Python','Private name','Private resume','Private job','includedSkills'])assert.ok(!serialized.includes(privateValue));
 assert.equal(novaQuestion(' Question '),'Question');
});
test('explicit skills are plain text on this question only and fit the existing endpoint limit',()=>{
 assert.deepEqual(novaSkillNames([' Python ','python',' SQL\nServer ',null,{name:'not a skill'}]),['Python','SQL Server']);
 const payload=novaRequestHistory([],'Help me learn',['Python','SQL']);
 assert.equal(payload[0].content,'Help me learn\n\nProfile skills (included for this question only): Python, SQL');
 const next=novaRequestHistory([{role:'user',content:'Help me learn',includedSkills:['Python','SQL']}],'Another question');
 assert.equal(next[0].content,'Help me learn');assert.equal(next[1].content,'Another question');
 assert.throws(()=>novaRequestHistory([],'x'.repeat(NOVA_MESSAGE_LIMIT),['Python']),/exceed 2,000/);
 assert.throws(()=>novaRequestHistory([],'   ',['Python']),/question first/);
 assert.equal(novaRequestHistory([],'x'.repeat(NOVA_MESSAGE_LIMIT))[0].content.length,NOVA_MESSAGE_LIMIT);
 assert.equal(novaRequestHistory(Array.from({length:30},(_,i)=>({role:i%2?'assistant':'user',content:`message ${i}`})),'latest').length,19);
});
test('Nova formatting preserves paragraphs, bullets, bold and numbered lists without HTML execution',()=>{
 const reply='Hello **Jamie**.\n\n- Learn **React**\n- Build a project\n\n1. Practice\n2. Reflect\n\n## Next step\n<p>Keep going.</p><script>alert(1)</script><img src=x onerror="bad()">';
 const blocks=novaReplyBlocks(reply);
 assert.deepEqual(blocks.map(block=>block.type),['paragraph','list','ordered','heading','paragraph']);
 const copy=novaCopyText(reply);
 assert.ok(copy.includes('Hello Jamie.'));assert.ok(copy.includes('• Learn React'));assert.ok(copy.includes('1. Practice'));
 for(const raw of ['**','<script','<img','onerror','alert(1)'])assert.ok(!copy.includes(raw));
 assert.equal(novaMotionMs('220ms'),220);assert.equal(novaMotionMs('.22s'),220);assert.equal(novaMotionMs('0ms'),0);
 assert.deepEqual(novaStarters.map(row=>row.prompt),['Help me build a learning plan','Practice a tech interview','Improve my resume bullet points']);
});
test('rendered replies use semantic safe markup and message controls expose copy and used skills',async()=>{
 const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
 try{
  const {NovaReply,NovaMessage,NovaWelcome}=await server.ssrLoadModule('/src/components/NovaChatContent.jsx');
  const html=renderToStaticMarkup(createElement(NovaReply,{content:'Hello **friend**.\n\n• First\n• Second\n\n&lt;img src=x onerror="bad()"&gt;<script>bad()</script>'}));
  assert.ok(html.includes('<strong>friend</strong>'));assert.ok(html.includes('<ul><li>First</li><li>Second</li></ul>'));
  for(const raw of ['<img','<script','onerror','bad()'])assert.ok(!html.includes(raw));
  const reply=renderToStaticMarkup(createElement(NovaMessage,{message:{role:'assistant',content:'Safe answer'},index:1}));
  assert.ok(reply.includes('Copy Nova reply 2'));assert.ok(reply.includes('Safe answer'));
  const user=renderToStaticMarkup(createElement(NovaMessage,{message:{role:'user',content:'Question',includedSkills:['Python','SQL']},index:0}));
  assert.ok(user.includes('Skills included in this question'));assert.ok(user.includes('Python, SQL'));
  const welcome=renderToStaticMarkup(createElement(NovaWelcome,{}));
  for(const prompt of novaStarters)assert.ok(welcome.includes(prompt.prompt));
 }finally{await server.close();}
});
