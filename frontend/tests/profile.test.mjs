import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {emptyProfileDetails,profileCompletion,profileValidation,profileSnapshot,profileSkillOptions} from '../src/components/profileModel.js';
const user={name:'Jamie Rivera',email:'jamie@example.com',skills:'Python'};
const details={...emptyProfileDetails,phone:'2145550123',location:'Dallas',photo:'data:image/png;base64,x',college_major:'Computer Science',work_types:['Full-time'],preferred_location:'Dallas'};

test('Profile completion counts the nine visible profile checks and ignores extras',()=>{
 const resume={filename:'resume.pdf'};
 assert.equal(profileCompletion(user,details,resume),100);
 assert.equal(profileCompletion({},emptyProfileDetails,null),0);
 for(const [type,key] of [['user','name'],['user','email'],['user','skills'],['details','phone'],['details','location'],['details','photo'],['details','work_types'],['details','preferred_location'],['resume','filename']]){
  const currentUser={...user},currentDetails={...details},currentResume={...resume};
  ({user:currentUser,details:currentDetails,resume:currentResume})[type][key]=key==='work_types'?[]:' ';
  // Dashboard treats a resume filename by presence, while text fields are trimmed.
  if(type==='resume')currentResume.filename='';
  assert.equal(profileCompletion(currentUser,currentDetails,currentResume),89,`${type}.${key}`);
 }
 assert.equal(profileCompletion(user,{...details,projects:[],experience:[],salary_range:'',proficiency:{},college_major:''},resume),100);
});
test('inline validation rejects invalid contact data, reversed dates and unsafe project URLs',()=>{
 const errors=profileValidation({name:' ',email:'bad'}, {...details,phone:'-------',experience:[{start:'2026-05-01',end:'2025-04-01'}],projects:[{title:'',url:'javascript:alert(1)'}]});
 assert.deepEqual(Object.keys(errors).sort(),['email','experience-0-end','name','phone','project-0-title','project-0-url']);
 assert.deepEqual(profileValidation(user,{...details,phone:'+1 (214) 555-0123 ext. 4',experience:[{start:'2025-01-01',end:''}],projects:[{title:'Portfolio',url:'https://example.com'}]}),{});
});
test('unsaved snapshot includes removals and proficiency but stays independent of resume saves',()=>{
 const original=profileSnapshot(user,details,['Python']);
 assert.notEqual(profileSnapshot(user,details,[]),original);
 assert.notEqual(profileSnapshot(user,{...details,proficiency:{Python:'Advanced'}},['Python']),original);
 assert.equal(profileSnapshot({...user},{...details},['Python']),original);
 assert.ok(profileSkillOptions.includes('docker'));assert.ok(profileSkillOptions.includes('mechanical engineering'));
});
test('Profile controls retain labels, visible removal, proficiency, entry editing and resume limits',async()=>{
 const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
 try{
  const {ProfileField,ProfileSkills,ProfileEntry,ProfileHeader}=await server.ssrLoadModule('/src/components/ProfileParts.jsx');
  const field=renderToStaticMarkup(createElement(ProfileField,{id:'email',label:'Email Address',value:'bad',error:'Enter a valid email.',onChange(){}}));
  assert.ok(field.includes('for="email"'));assert.ok(field.includes('aria-invalid="true"'));assert.ok(field.includes('aria-describedby="email-error"'));
  const skills=renderToStaticMarkup(createElement(ProfileSkills,{skills:['Python'],proficiency:{Python:'Advanced'},newSkill:'',level:'Intermediate'}));
  for(const text of ['Remove Python','Advanced','Add Skill','Proficiency','profile-skill-suggestions','match scores on Jobs, Job Details, and Skill Gap'])assert.ok(skills.includes(text),text);
  const entry=renderToStaticMarkup(createElement(ProfileEntry,{kind:'experience',index:0,entry:{company:'Launch Lab',title:'Developer',start:'2025-01-01',end:'',description:'Build products.'},editing:true,errors:{},onBlur(){}}));
  for(const label of ['Company','Job Title','Start Date','End Date','Description','Done editing','Remove experience Developer'])assert.ok(entry.includes(label),label);
  const project=renderToStaticMarkup(createElement(ProfileEntry,{kind:'project',index:0,entry:{title:'Portfolio',technologies:'React',url:'https://example.com',description:'My work'},editing:false,errors:{},onBlur(){}}));
  assert.ok(project.includes('>Edit</button>'));assert.ok(project.includes('Remove project Portfolio'));assert.ok(project.includes('My work'));
  const header=renderToStaticMarkup(createElement(ProfileHeader,{name:user.name,completion:90}));assert.ok(header.includes('90%'));assert.ok(header.includes('Saved profile completion'));
  const {default:ResumeSkills}=await server.ssrLoadModule('/src/components/ResumeSkills.jsx');
  const resume=renderToStaticMarkup(createElement(ResumeSkills,{profileUpload:true,token:'fixture'}));
  for(const text of ['PDF or DOCX','Up to 5 MB','One file at a time','Upload resume','Loading saved resume'])assert.ok(resume.includes(text),text);
 }finally{await server.close();}
});
