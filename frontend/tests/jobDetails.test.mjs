import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('card navigation and loaded job details render with bookmark and similar jobs', async () => {
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { JobDetailContent } = await server.ssrLoadModule('/src/components/WireframePages.jsx');
    const job = { job_id: 284, title: 'Software Engineer 3', company_name: 'Berkshire', description: 'Build reliable software.', skills: [{ skill_name: 'c#', requirement_type: 'required' }] };
    const html = renderToStaticMarkup(createElement(JobDetailContent, { job, similar: [{ job_id: 279, title: 'Senior Software Engineer', company_name: 'Kunai' }], saved: false, goJob() {}, setPage() {} }));
    for (const text of ['Job Description', 'Build reliable software.', 'Save job', 'Similar Jobs', 'Senior Software Engineer', 'Back to Jobs']) assert.ok(html.includes(text), text);
    const { default: JobCard } = await server.ssrLoadModule('/src/components/JobCard.jsx');
    let clicked = null;
    const card = JobCard({ job, goJob: id => { clicked = id; } });
    card.props.onClick({ target: { closest: () => null } });
    assert.equal(clicked, 284);
    clicked = null;
    card.props.onClick({ target: { closest: () => ({ tagName: 'BUTTON' }) } });
    assert.equal(clicked, null);
    card.props.onKeyDown({ target: card, currentTarget: card, key: 'Enter', preventDefault() {} });
    assert.equal(clicked, 284);
    const { FlaggedSkillGrid } = await server.ssrLoadModule('/src/components/ResumeSkills.jsx');
    const grid = renderToStaticMarkup(createElement(FlaggedSkillGrid, { skills: [{ unmatched_id: 1, skill_name: 'nlp' }, { unmatched_id: 2, skill_name: 'sql' }], selected: [1], jobCounts: { '1': 9 }, onToggle() {}, onAdd() {}, onDismiss() {} }));
    for (const text of ['NLP', 'SQL', 'Appears in 9 active jobs', 'Dismiss NLP suggestion', 'type="checkbox"']) assert.ok(grid.includes(text), text);
    assert.ok(!grid.includes('nova-dismiss-skill'));
  } finally { await server.close(); }
});

test('detail uses grouped card requirements, consistent names, notices, and compact overview', async () => {
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { JobDetailContent } = await server.ssrLoadModule('/src/components/WireframePages.jsx');
    const job = { job_id: 293, title: 'Senior Software Engineer', company_name: 'Company', location: 'Boston; Charlotte; Chicago; Dallas; New York; San Francisco', work_arrangement: 'Hybrid', source_url: 'https://example.com/job', resume_match_pct: 67, resume_matched_count: 2, resume_required_count: 3, resume_match_source: 'resume', resume_requirement_groups: [{skills:['python'],status:'matched'}, {skills:['react','typescript'],status:'matched'}, {skills:['observability'],status:'missing'}], skills: [{skill_name:'github',requirement_type:'preferred'}], description_sections: [{title:'What You’ll Do',html:'<p>Build applications.</p>'}, {title:'Company Overview',html:'<p>Company description.</p>'}, {title:'THIS POSTING IS FOR A CURRENT VACANCY',html:'<p>Vacancy notice.</p>'}] };
    const html = renderToStaticMarkup(createElement(JobDetailContent, {job, profileSkills:['python','react'], gap:{match_pct:50}, goJob(){}, setPage(){}}));
    for (const text of ['67% skill match', '2 of 3 skills', 'React / TypeScript', 'Observability', 'GitHub', 'Dallas +5 more', 'Hybrid', 'Responsibilities', 'About the company']) assert.ok(html.includes(text), text);
    assert.ok(!html.includes('50%'));
    assert.ok(!html.match(/<dl>[\s\S]*?<\/dl>/)[0].includes('Not provided'));
    assert.ok(!html.includes('Work type not provided'));
    assert.ok(html.includes('class="nova-source-info"'));
    assert.ok(html.includes('href="https://example.com/job"'));
    assert.ok(!html.includes('job-description-nav'));
    assert.ok(html.includes('<h2>Responsibilities</h2>'));
    assert.ok(html.includes('<h3>THIS POSTING IS FOR A CURRENT VACANCY</h3>'));
    const mainOrder = ['Job Description', 'Responsibilities', 'What we&#x27;re looking for', 'Required Skills', 'Skill Match', 'Similar Jobs', 'About the company'];
    let previous = -1;
    for (const heading of mainOrder) {
      const position = html.indexOf(`>${heading}</`);
      assert.ok(position > previous, `${heading} follows the preceding section`);
      previous = position;
    }
    const overview = html.match(/<dl>[\s\S]*?<\/dl>/)[0];
    for (const label of ['Posted', 'Type', 'Location', 'Salary', 'Company', 'Industry', 'Experience', 'Company Size']) assert.ok(overview.includes(`<dt>${label}</dt>`));
    assert.equal((overview.match(/<dt>/g) || []).length, 8);
    assert.ok(overview.includes('class="nova-not-listed">Not listed'));
    assert.ok(html.includes('<span>Save Job</span>'));

  } finally { await server.close(); }
});

test('similar rows omit card details and thin matches disclose limited data', async () => {
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: CompactSimilarJob } = await server.ssrLoadModule('/src/components/CompactSimilarJob.jsx');
    const job = { job_id: 42, title: 'Software Engineer', company_name: 'Company', location: 'Dallas, TX', resume_match_pct: 67, resume_required_count: 3, resume_matched_count: 2, salary_range: '$100,000', source_url: 'https://example.com/job', resume_missing_skills: ['sql'], resume_requirement_groups:[{skills:['python']},{skills:['react']},{skills:['sql']}] };
    const html = renderToStaticMarkup(createElement(CompactSimilarJob, {job, profileSkills:['python','react'], goJob(){}}));
    for (const text of ['Software Engineer', 'Company', 'Dallas, TX', '67%']) assert.ok(html.includes(text));
    for (const text of ['Apply', '$100,000', 'Shared requirements', 'Missing', 'Matched']) assert.ok(!html.includes(text), text);
    let opened;
    const row = CompactSimilarJob({job, goJob:id=>{opened=id;}});
    row.props.children[1].props.children[0].props.children.props.onClick();
    assert.equal(opened, 42);
    const thin = renderToStaticMarkup(createElement(CompactSimilarJob, {job:{...job,resume_match_pct:100,resume_required_count:1,resume_matched_count:1,resume_requirement_groups:[{skills:['python']}]},profileSkills:['python'],goJob(){}}));
    assert.ok(thin.includes('Skills not listed'));
    assert.ok(!thin.includes('100%'));
    assert.ok(!thin.includes('is-high'));
  } finally { await server.close(); }
});

test('forgot-password form renders without a shared Card crash', async () => {
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { ForgotPasswordPage } = await server.ssrLoadModule('/src/App.jsx');
    const html = renderToStaticMarkup(createElement(ForgotPasswordPage, {setPage(){}}));
    for (const text of ['Reset Password', 'Send Reset Link', 'Back to sign in', 'you@example.com']) assert.ok(html.includes(text), text);
  } finally { await server.close(); }
});

test('missing responsibilities stay explicit and saved rows expose a named Remove action', async () => {
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const {JobDetailContent} = await server.ssrLoadModule('/src/components/WireframePages.jsx');
    const job = {job_id:42, title:'Frontend Engineer', description:'Build accessible products.'};
    const detail = renderToStaticMarkup(createElement(JobDetailContent,{job,saved:true,goJob(){},setPage(){}}));
    assert.ok(detail.includes('Not provided in this posting.'));
    assert.ok(detail.includes('<span>Saved</span>'));
    assert.equal((detail.match(/<dl>[\s\S]*?<\/dl>/)[0].match(/class="nova-not-listed">Not listed/g)||[]).length,8);
    const {default:Row} = await server.ssrLoadModule('/src/components/CompactSimilarJob.jsx');
    let removed;
    const props={job,saved:true,showRemove:true,onSave:item=>{removed=item.job_id;},goJob(){}};
    const html=renderToStaticMarkup(createElement(Row,props));
    assert.ok(html.includes('aria-label="Remove saved job: Frontend Engineer"'));
    assert.ok(html.includes('>Remove</button>'));
    Row(props).props.children[3].props.onClick();
    assert.equal(removed,42);
    const recommendation=renderToStaticMarkup(createElement(Row,{...props,showRemove:false}));
    assert.ok(!recommendation.includes('>Remove</button>'));
  } finally {await server.close();}
});

test('safe description renders semantic sections and closing-company expansion', async () => {
  const server = await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
  try {
    const {JobDetailContent}=await server.ssrLoadModule('/src/components/WireframePages.jsx');
    const job={job_id:8,title:'Engineer',company_name:'NovaTeck',date_posted:'2026-10-20',description:'Build products.\n\n## Responsibilities\n• Write code\n• Review changes\n\n## Qualifications\nKnow JavaScript.\n\n## Why NovaTeck\n'+ 'A long company story with meaningful details. '.repeat(40)};
    const html=renderToStaticMarkup(createElement(JobDetailContent,{job,goJob(){},setPage(){}}));
    assert.ok(html.includes('<li>Write code</li>'));assert.ok(html.includes('<li>Review changes</li>'));assert.ok(html.includes('Oct 20, 2026'));assert.ok(!html.includes('##'));assert.ok(!html.includes('•'));
    assert.ok(!html.includes('EXPLORE YOUR NEXT OPPORTUNITY'));assert.ok(html.includes('nova-detail-company'));assert.ok(html.includes('company-logo'));
    const order=['Job Description','Responsibilities','What we&#x27;re looking for','Qualifications','Preferred Skills','Required Skills','Skill Match','Similar Jobs','About the company','Why NovaTeck'];let position=-1;
    for(const title of order){const next=html.indexOf(`>${title}</`);assert.ok(next>position,title);position=next;}
    assert.ok(html.includes('<details class="nova-employer-group"'));assert.ok(html.includes('<details class="nova-company-section" open=""'));assert.equal((html.match(/class="nova-employer-group"/g)||[]).length,1);assert.ok(!html.match(/<section class="job-description-section" aria-label="Responsibilities"[\s\S]*?<\/section>/)[0].includes('Not provided in this posting.'));
    const qualifications = html.match(/<section class="job-description-section nova-job-qualifications"[\s\S]*?<\/section>/)[0];
    assert.ok(!qualifications.includes('<details'));
    assert.ok(!qualifications.includes('Show more'));
    assert.ok(qualifications.includes('Know JavaScript.'));
    assert.ok(html.indexOf('class="nova-source-info"') < html.lastIndexOf('Back to Jobs'));
    assert.ok(html.indexOf('About the company') < html.indexOf('class="nova-source-info"'));
    const malicious=renderToStaticMarkup(createElement(JobDetailContent,{job:{...job,description:'<p>Safe</p><script>alert(1)</script><img onerror="bad()" src=x>\n## Responsibilities\n• <b>Build</b>'},goJob(){},setPage(){}}));
    assert.ok(!malicious.includes('<script'));assert.ok(!malicious.includes('onerror'));assert.ok(!malicious.includes('bad()'));assert.ok(malicious.includes('<li>Build</li>'));
  } finally {await server.close();}
});

test('all job match surfaces ignore conflicting resume scores and use saved profile skills', async () => {
  const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
  try {
    const {JobDetailContent}=await server.ssrLoadModule('/src/components/WireframePages.jsx');
    const {default:Row}=await server.ssrLoadModule('/src/components/CompactSimilarJob.jsx');
    const {default:Card}=await server.ssrLoadModule('/src/components/LaunchpadJobCard.jsx');
    const job={job_id:9,title:'Engineer',resume_match_pct:100,resume_required_count:3,resume_matched_count:3,resume_requirement_groups:[{skills:['react'],status:'matched'},{skills:['python'],status:'matched'},{skills:['sql'],status:'matched'}]};
    const props={job,profileSkills:['react'],goJob(){},setPage(){},onProfile(){}};
    for(const Component of [JobDetailContent,Row,Card]){
      const html=renderToStaticMarkup(createElement(Component,props));
      assert.ok(html.includes('33%')||html.includes('33<'),Component.name);
      assert.ok(!html.includes('100% skill match')&&!html.includes('>100%<'),Component.name);
      assert.ok(/profile/i.test(html),Component.name);
    }
    const {JobSourceInfo}=await server.ssrLoadModule('/src/components/JobDetailsInfo.jsx');
    const source=renderToStaticMarkup(createElement(JobSourceInfo,{job:{source_provider:'Employer',date_posted:'2026-06-04',date_crawled:'2026-06-05',last_seen_at:'2026-06-06',closing_date:'2026-07-01'}}));
    for(const date of ['Jun 4, 2026','Jun 5, 2026','Jun 6, 2026','Jul 1, 2026'])assert.ok(source.includes(date));
    assert.ok(!source.includes('2026-06'));
    const {parseJobDescription}=await server.ssrLoadModule('/src/components/jobDescriptionText.js');
    const {EmployerDetails,JobQualifications}=await server.ssrLoadModule('/src/components/JobDescription.jsx');
    const content=parseJobDescription('## CFO Technology\nCompany story.\n## You Have\nExperience.\n## You Are\nCurious.');
    const employer=renderToStaticMarkup(createElement(EmployerDetails,{content}));
    assert.ok(employer.includes('<h3>CFO Technology</h3>'));
    const qualifications=renderToStaticMarkup(createElement(JobQualifications,{content}));
    for(const heading of ['You Have','You Are'])assert.ok(qualifications.includes(`<h4>${heading}</h4>`));
    assert.ok(!qualifications.includes('<details'));
    assert.equal((employer.match(/<summary>/g)||[]).length,2);
  }finally{await server.close();}
});
