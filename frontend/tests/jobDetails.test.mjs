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
    const html = renderToStaticMarkup(createElement(JobDetailContent, {job, gap:{match_pct:50}, goJob(){}, setPage(){}}));
    for (const text of ['67% skill match', '(2/3)', 'React / TypeScript', 'Observability', 'GitHub', 'Dallas +5 more', 'Hybrid', 'Responsibilities', 'Employer notices']) assert.ok(html.includes(text), text);
    assert.ok(!html.includes('50%'));
    assert.ok(!html.match(/<dl>[\s\S]*?<\/dl>/)[0].includes('Not provided'));
    assert.ok(!html.includes('Work type not provided'));
    assert.ok(html.includes('<details><summary>Source metadata'));
    assert.ok(html.includes('href="https://example.com/job"'));
    assert.ok(!html.includes('job-description-nav'));
    assert.ok(html.includes('<summary>Responsibilities</summary>'));
    assert.ok(html.includes('<summary>Employer notices</summary>'));
    assert.ok(html.indexOf('Your match') < html.indexOf('<summary>Responsibilities'));

  } finally { await server.close(); }
});

test('similar rows omit card details and thin matches disclose limited data', async () => {
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: CompactSimilarJob } = await server.ssrLoadModule('/src/components/CompactSimilarJob.jsx');
    const job = { job_id: 42, title: 'Software Engineer', company_name: 'Company', location: 'Dallas, TX', resume_match_pct: 67, resume_required_count: 3, resume_matched_count: 2, salary_range: '$100,000', source_url: 'https://example.com/job', resume_missing_skills: ['sql'] };
    const html = renderToStaticMarkup(createElement(CompactSimilarJob, {job, goJob(){}}));
    for (const text of ['Software Engineer', 'Company', 'Dallas, TX', '67%']) assert.ok(html.includes(text));
    for (const text of ['Apply', '$100,000', 'Shared requirements', 'Missing', 'Matched']) assert.ok(!html.includes(text), text);
    let opened;
    const row = CompactSimilarJob({job, goJob:id=>{opened=id;}});
    row.props.children[1].props.children[0].props.children.props.onClick();
    assert.equal(opened, 42);
    const thin = renderToStaticMarkup(createElement(CompactSimilarJob, {job:{...job,resume_match_pct:100,resume_required_count:1,resume_matched_count:1},goJob(){}}));
    assert.ok(thin.includes('1 skill listed'));
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
