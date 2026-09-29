import { useEffect, useState } from 'react';
import ResumeSkills, { PendingSkills, AdminReview } from './ResumeSkills';
import JobDescription from './JobDescription';

const statuses = ['Opened employer site', 'Applied', 'Interviewing', 'Offer', 'Closed'];
const emptyExperience = () => ({ company: '', title: '', start: '', end: '', description: '' });
const firstName = name => (name || '').trim().split(/\s+/)[0] || 'there';
const date = value => value ? String(value).split('T')[0] : 'Not provided';
function Message({ children }) { return children ? <p className="wf-message" role="status">{children}</p> : null; }
function Tags({ values = [] }) { return <div className="wf-tags">{values.length ? values.map(value => <span key={value} className="wf-tag">{value}</span>) : <span className="wf-muted">None listed</span>}</div>; }
function Field({ label, children }) { return <label className="wf-field"><span>{label}</span><span>{children}</span></label>; }
function JobRow({ job, goJob, children }) { return <article className="wf-job-row"><div><button className="text-button wf-job-title" onClick={() => goJob(job.job_id)}>{job.title}</button><p>{job.company_name}{job.location ? ` · ${job.location}` : ''}</p>{job.match_pct != null && <small>{job.match_pct}% required skill match</small>}</div>{children}</article>; }
function download(name, content, type = 'text/plain') { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

export function WireDashboard({ auth, request, goJob, setPage }) {
  const [saved, setSaved] = useState([]), [recommended, setRecommended] = useState([]), [applications, setApplications] = useState([]);
  const [message, setMessage] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all(['saved-jobs', 'recommendations', 'applications'].map(path => request(`/students/${auth.user_id}/${path}`, {}, auth.token)))
      .then(([saved, recommended, applications]) => { if (active) { setSaved(saved); setRecommended(recommended); setApplications(applications); } })
      .catch(error => active && setMessage(error.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [auth.user_id, auth.token]);
  async function remove(id) { try { await request(`/saved-jobs/${id}`, { method: 'DELETE' }, auth.token); setSaved(items => items.filter(job => job.job_id !== id)); } catch (error) { setMessage(error.message); } }
  async function updateApplication(job_id, status) { try { await request(`/students/${auth.user_id}/applications`, { method: 'POST', body: JSON.stringify({ job_id, status }) }, auth.token); setApplications(rows => rows.map(row => row.job_id === job_id ? { ...row, status } : row)); } catch (error) { setMessage(error.message); } }
  return <main className="wf-page"><h1>Welcome back, {firstName(auth.name)}!</h1><p className="wf-muted">Your NovaTeck dashboard</p><Message>{message}</Message>
    {loading ? <p role="status">Loading dashboard…</p> : <>
      <h2>Statistics</h2><div className="wf-stats wf-stats--three">{[['Saved Jobs', saved.length], ['Applications', applications.filter(row => row.status !== 'Opened employer site').length], ['Profile Views', 'Not tracked']].map(([label, value]) => <div className="wf-card" key={label}><strong>{label}</strong><p>{value}</p></div>)}</div>
      <div className="wf-two-columns"><section><h2>Saved Jobs</h2>{saved.length ? saved.map(job => <JobRow job={job} goJob={goJob} key={job.job_id}><button className="wf-secondary" onClick={() => remove(job.job_id)}>Remove</button></JobRow>) : <p className="wf-empty">No saved jobs yet.</p>}</section>
        <section><h2>Recommended Jobs</h2>{recommended.length ? recommended.map(job => <JobRow job={job} goJob={goJob} key={job.job_id} />) : <p className="wf-empty">Add skills in your profile to see matching jobs.</p>}</section>
        <section><h2>Recent Applications</h2>{applications.length ? applications.map(job => <JobRow job={job} goJob={goJob} key={job.job_id}><select aria-label={`Application status for ${job.title}`} value={job.status} onChange={event => updateApplication(job.job_id, event.target.value)}>{statuses.map(status => <option key={status}>{status}</option>)}</select></JobRow>) : <p className="wf-empty">No recent applications.</p>}</section>
        <section><h2>Quick Actions</h2><div className="wf-quick-actions">{[['Update Profile', 'profile'], ['Skill Gap Analysis', 'skillgap'], ['Job Search', 'jobs']].map(([label, page]) => <div key={page}><span>{label}</span><button className="primary-button" onClick={() => setPage(page)}>Open</button></div>)}</div></section>
      </div>
    </>}
  </main>;
}

export function WireProfile({ auth, request, onNameChange, setPage }) {
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [details, setDetails] = useState({ phone: '', location: '', photo: '', experience: [emptyExperience()], work_types: [], salary_range: '', preferred_location: '', proficiency: {} });
  const [skills, setSkills] = useState([]), [newSkill, setNewSkill] = useState(''), [level, setLevel] = useState('Intermediate');
  const [message, setMessage] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([request(`/students/${auth.user_id}`, {}, auth.token), request(`/students/${auth.user_id}/profile-details`, {}, auth.token)])
      .then(([user, extra]) => { if (active) { setProfile({ name: user.name, email: user.email }); setSkills((user.skills || '').split(',').map(s => s.trim()).filter(Boolean)); setDetails(current => ({ ...current, ...extra, experience: extra.experience?.length ? extra.experience : [emptyExperience()] })); } })
      .catch(error => active && setMessage(error.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [auth.user_id, auth.token]);
  const change = (key, value) => setDetails(current => ({ ...current, [key]: value }));
  function addSkill() { const skill = newSkill.trim(); if (!skill || skills.some(value => value.toLowerCase() === skill.toLowerCase())) return; setSkills(current => [...current, skill]); setDetails(current => ({ ...current, proficiency: { ...current.proficiency, [skill]: level } })); setNewSkill(''); }
  async function photo(event) { const file = event.target.files?.[0]; if (!file) return; if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 500000) { setMessage('Choose a PNG or JPEG photo smaller than 500 KB.'); return; } const reader = new FileReader(); reader.onload = () => change('photo', reader.result); reader.readAsDataURL(file); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await request(`/students/${auth.user_id}/profile-details`, { method: 'PUT', body: JSON.stringify({ ...profile, details }) }, auth.token);
      onNameChange(result.name);
      await request(`/students/${auth.user_id}/skills`, { method: 'PUT', body: JSON.stringify({ skills }) }, auth.token);
      setMessage('Your profile and skills have been saved.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  function experience(index, key, value) { change('experience', details.experience.map((entry, i) => i === index ? { ...entry, [key]: value } : entry)); }
  return <main className="wf-page wf-profile"><h1>Manage Account</h1><Message>{message}</Message>{loading ? <p role="status">Loading profile…</p> : <form onSubmit={save}>
    <section><h2 className="wf-section-title">Profile Photo</h2><div className="wf-photo-row">{details.photo ? <img src={details.photo} alt="Your profile" /> : <div className="wf-avatar" aria-label="No profile photo">{firstName(profile.name).slice(0, 1).toUpperCase()}</div>}<label>Photo Upload <input type="file" accept="image/png,image/jpeg" onChange={photo} /></label></div></section>
    <section><h2 className="wf-section-title">Personal Information</h2><div className="wf-personal-fields">
      <Field label="Full Name"><input required value={profile.name} onChange={event => setProfile(current => ({ ...current, name: event.target.value }))} autoComplete="name" maxLength={255} /></Field>
      <Field label="Email Address"><input required type="email" value={profile.email} onChange={event => setProfile(current => ({ ...current, email: event.target.value }))} autoComplete="email" /></Field>
      <Field label="Phone Number"><input type="tel" value={details.phone} onChange={event => change('phone', event.target.value)} autoComplete="tel" maxLength={50} /></Field>
      <Field label="Location"><input value={details.location} onChange={event => change('location', event.target.value)} maxLength={255} /></Field>
    </div></section>
    <section><h2 className="wf-section-title">Skills Management</h2><div className="wf-field"><span>Your Skills</span><div className="wf-tags">{skills.map(skill => <button type="button" className="wf-tag" key={skill} aria-label={`Remove ${skill}`} title={`${details.proficiency?.[skill] || 'Intermediate'} — click to remove`} onClick={() => setSkills(current => current.filter(value => value !== skill))}>{skill} ×</button>)}</div></div>
      <Field label="Add Skill"><span className="wf-inline"><input value={newSkill} onChange={event => setNewSkill(event.target.value)} maxLength={100} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addSkill(); } }} /><button type="button" className="wf-secondary" onClick={addSkill}>Add</button></span></Field>
      <Field label="Proficiency"><select value={level} onChange={event => setLevel(event.target.value)}>{['Beginner', 'Intermediate', 'Advanced'].map(value => <option key={value}>{value}</option>)}</select></Field>
    </section>
    <section><h2 className="wf-section-title">Resume Upload</h2><ResumeSkills token={auth.token} profileUpload /></section>
    <section><h2 className="wf-section-title">Experience</h2>{details.experience.map((entry, index) => <div className="wf-experience" key={index}>
      <Field label="Company"><input value={entry.company} onChange={event => experience(index, 'company', event.target.value)} /></Field><Field label="Job Title"><input value={entry.title} onChange={event => experience(index, 'title', event.target.value)} /></Field>
      <Field label="Start Date"><input type="date" value={entry.start} onChange={event => experience(index, 'start', event.target.value)} /></Field><Field label="End Date"><input type="date" value={entry.end} onChange={event => experience(index, 'end', event.target.value)} /></Field>
      <div className="wf-span-all"><Field label="Description"><textarea rows={3} value={entry.description} onChange={event => experience(index, 'description', event.target.value)} /></Field></div>
      <button type="button" className="text-button" onClick={() => change('experience', details.experience.filter((_, i) => i !== index))}>Remove experience</button>
    </div>)}<button type="button" className="wf-secondary" onClick={() => change('experience', [...details.experience, emptyExperience()])}>+ Add Experience</button></section>
    <section><h2 className="wf-section-title">Job Preferences</h2><div className="wf-field"><span>Work Type</span><div className="wf-inline">{['Full-time', 'Part-time', 'Contract'].map(type => <label key={type}><input type="checkbox" checked={details.work_types.includes(type)} onChange={event => change('work_types', event.target.checked ? [...details.work_types, type] : details.work_types.filter(value => value !== type))} /> {type}</label>)}</div></div>
      <Field label="Salary Range"><input value={details.salary_range} onChange={event => change('salary_range', event.target.value)} maxLength={100} /></Field><Field label="Preferred Location"><input value={details.preferred_location} onChange={event => change('preferred_location', event.target.value)} maxLength={255} /></Field>
    </section><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button><div className="wf-account-settings"><h2 className="wf-section-title">Account Settings</h2><button type="button" className="wf-secondary" onClick={() => setPage('forgot')}>Reset Password</button></div>
  </form>}</main>;
}

export function WireJobDetail({ auth, request, jobId, goJob, setPage }) {
  const [job, setJob] = useState(null), [gap, setGap] = useState(null), [similar, setSimilar] = useState([]), [saved, setSaved] = useState(false), [message, setMessage] = useState('');
  useEffect(() => {
    let active = true; setJob(null); setSaved(false); setMessage('');
    Promise.all([request(`/jobs/${jobId}`, {}, auth.token), request(`/students/${auth.user_id}/skill-gap?job_id=${jobId}`, {}, auth.token), request(`/students/${auth.user_id}/saved-jobs`, {}, auth.token)])
      .then(async ([job, gap, saved]) => { if (!active) return; setJob(job); setGap(gap); setSaved(saved.some(row => row.job_id === jobId)); const skill = job.skills?.find(row => row.requirement_type === 'required')?.skill_name; const rows = await request(`/jobs?limit=4${skill ? `&skill=${encodeURIComponent(skill)}` : `&company_id=${job.company_id}`}`, {}, auth.token); if (active) setSimilar(rows.filter(row => row.job_id !== jobId).slice(0, 3)); })
      .catch(error => active && setMessage(error.message));
    return () => { active = false; };
  }, [jobId, auth.token]);
  async function save() { try { await request('/saved-jobs', { method: 'POST', body: JSON.stringify({ job_id: jobId }) }, auth.token); setSaved(true); setMessage('Job saved.'); } catch (error) { setMessage(error.message); } }
  async function trackOpening() { try { const existing = await request(`/students/${auth.user_id}/applications`, {}, auth.token); if (!existing.some(row => row.job_id === jobId)) await request(`/students/${auth.user_id}/applications`, { method: 'POST', body: JSON.stringify({ job_id: jobId, status: 'Opened employer site' }) }, auth.token); } catch (error) { setMessage(error.message); } }
  const url = job?.source_url && /^https?:\/\//i.test(job.source_url) ? job.source_url : null;
  return <main className="wf-page"><Message>{message}</Message>{!job ? <p role="status">{message ? 'Job details could not be loaded.' : 'Loading job…'}</p> : <>
    <h1>{job.title}</h1><p className="wf-muted">{job.company_name} · {job.location || 'Location not provided'} · {job.job_type || 'Work type not provided'}</p>
    <div className="wf-inline wf-job-actions">{url && <a className="primary-button" href={url} target="_blank" rel="noopener noreferrer" onClick={trackOpening}>Apply Now ↗</a>}<button className="wf-secondary" disabled={saved} onClick={save}>{saved ? 'Saved' : 'Save Job'}</button></div>
    <div className="wf-detail-columns"><div>
      <JobDescription description={job.description} />
      <section><h2>Required Skills</h2><Tags values={(job.skills || []).filter(row => row.requirement_type === 'required').map(row => row.skill_name)} /></section>
      {(job.skills || []).some(row => row.requirement_type === 'preferred') && <section><h2>Preferred Skills</h2><Tags values={job.skills.filter(row => row.requirement_type === 'preferred').map(row => row.skill_name)} /></section>}
      <section><h2>Skill Match</h2><div className="wf-match-bar" role="meter" aria-label="Required skill match" aria-valuemin={0} aria-valuemax={100} aria-valuenow={gap?.match_pct || 0}><span style={{ width: `${gap?.match_pct || 0}%` }} /><strong>{gap?.match_pct || 0}%</strong></div></section>
      <section><h2>Similar Jobs</h2>{similar.length ? similar.map(row => <JobRow job={row} goJob={goJob} key={row.job_id} />) : <p className="wf-empty">No similar active jobs found.</p>}</section>
    </div><aside className="wf-card wf-overview"><h2>Job Overview</h2><dl>{[['Posted', date(job.date_posted)], ['Type', job.job_type], ['Location', job.location], ['Salary', job.salary_range], ['Company', job.company_name], ['Industry', job.company_industry], ['Experience', job.experience_level], ['Company Size', job.company_size]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl><details><summary>Source metadata</summary><p>HTTP status (source feed): {job.source_http_status ?? 'Not recorded'}</p><p>Fetched: {date(job.date_crawled)}</p><p>Last verified: {date(job.last_seen_at)}</p>{url && <a href={url} target="_blank" rel="noreferrer">Original posting</a>}</details></aside></div>
    <button className="text-button wf-back" onClick={() => setPage('jobs')}>← Back to Jobs</button>
  </>}</main>;
}

export function WireSkillGap({ auth, request, setPage }) {
  const categories = [['', 'All Career Categories'], ['software', 'Software Development'], ['data_ai', 'Data Science & AI'], ['it_cloud_security', 'IT, Cloud & Cybersecurity'], ['electrical_hardware', 'Electrical & Computer Engineering'], ['mechanical', 'Mechanical Engineering'], ['aerospace', 'Aerospace Engineering'], ['quality_systems', 'Systems & Quality Engineering']];
  const [selected, setSelected] = useState(''), [data, setData] = useState(null), [message, setMessage] = useState(''), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true; setMessage(''); setData(null);
    request(`/students/${auth.user_id}/skill-gap${selected ? `?discipline=${encodeURIComponent(selected)}` : ''}`, {}, auth.token).then(data => active && setData(data)).catch(error => active && setMessage(error.message));
    return () => { active = false; };
  }, [auth.token, selected, refresh]);
  const own = data?.user_skills || [], missing = data?.missing_skills || [];
  const required = [...(data?.matched_skills || []), ...(data?.missing_skills || [])].map(row => row.skill_name);
  const pct = Math.max(0, Math.min(100, data?.overall_match_pct || 0));
  return <main className="wf-page"><h1>Skill Gap Analysis</h1><p className="wf-muted">Compare your skills with DFW jobs in your chosen career category.</p><Message>{message}</Message>
    <section><h2>Career Focus</h2><label className="wf-inline">Career Category <select value={selected} onChange={event => setSelected(event.target.value)}>{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></section>
    <ResumeSkills token={auth.token} onProcessed={() => setRefresh(value => value + 1)} compact />
    <div className="wf-two-columns"><section><h2>Your Skills</h2><Tags values={own} /><button className="wf-secondary wf-update-skills" onClick={() => setPage('profile')}>Update skills in Profile</button></section><section><h2>Required Skills</h2><Tags values={required} /></section></div>
    <div className="wf-gap-columns"><section><h2>Match Percentage</h2><div className="wf-donut" style={{ background: `conic-gradient(#1e40af ${pct}%, #e5e7eb 0)` }} role="meter" aria-label="Skill match" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span>{pct}%</span></div></section>
      <section><h2>Skills Gap</h2>{missing.length ? missing.map((row, index) => <div className="wf-job-row" key={row.skill_name}><strong>{row.skill_name}</strong><span className="wf-muted">{row.demand_count == null ? 'Required' : `${row.demand_count} jobs`} · Priority {index + 1}</span></div>) : <p className="wf-empty">{data ? 'No missing skills identified.' : 'Loading skill comparison…'}</p>}</section></div>
    <PendingSkills skills={data?.unverified_skills} token={auth.token} onAdded={() => setRefresh(value => value + 1)} />
    <section><h2>Learning Recommendations</h2>{missing.slice(0, 4).map(row => <article className="wf-job-row" key={row.skill_name}><div><strong>{row.skill_name}</strong><p>Find tutorials and official documentation for this skill.</p></div><a href={`https://www.google.com/search?q=${encodeURIComponent(row.skill_name + ' official documentation tutorial')}`} target="_blank" rel="noreferrer">Find resources ↗</a></article>)}</section>
    <button className="wf-secondary" disabled={!data} onClick={() => download('novateck-skill-gap.txt', `NovaTeck Skill Gap Report\nTarget: ${categories.find(([value]) => value === selected)?.[1]}\nMatch: ${pct}%\nYour skills: ${own.join(', ')}\nRequired skills: ${required.join(', ')}\nMissing: ${missing.map(row => row.skill_name).join(', ')}\nSkills to add: ${(data?.unverified_skills || []).map(row => row.skill_name).join(', ')}`)}>Export Report</button>
  </main>;
}

export function WireAdmin({ auth, request, onForbidden }) {
  const [overview, setOverview] = useState(null), [message, setMessage] = useState(''), [roles, setRoles] = useState(false), [exporting, setExporting] = useState(false);
  useEffect(() => { request('/admin/overview', {}, auth.token).then(setOverview).catch(error => { if (error.status === 403) onForbidden(); else setMessage(error.message); }); }, [auth.token]);
  async function exportJobs() {
    setExporting(true);
    try { let rows = []; for (let offset = 0; ; offset += 500) { const page = await request(`/jobs?limit=500&offset=${offset}`, {}, auth.token); rows.push(...page); if (page.length < 500) break; } const columns = ['title', 'company_name', 'location', 'job_type', 'salary_range', 'source_url']; const cell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"'; download('novateck-jobs.csv', [columns.join(','), ...rows.map(row => columns.map(key => cell(row[key])).join(','))].join('\r\n'), 'text/csv'); }
    catch (error) { setMessage(error.message); } finally { setExporting(false); }
  }
  return <main className="wf-page"><h1>Admin Dashboard</h1><p className="wf-muted">Administrator overview</p><Message>{message}</Message>
    <h2>Statistics</h2><div className="wf-stats">{[['Total Jobs', overview?.counts.total_jobs], ['Registered Users', overview?.counts.registered_users], ['Crawler Runs', overview?.counts.crawler_runs], ['System Health', overview?.database === 'ok' ? 'Database connected' : 'Checking…']].map(([label, value]) => <div className="wf-card" key={label}><strong>{label}</strong><p>{value ?? '—'}</p></div>)}</div>
    <section><h2>Crawler Activity</h2><div className="table-scroll"><table><thead><tr><th>Source</th><th>Jobs Found</th><th>Timestamp</th><th>Status</th></tr></thead><tbody>{overview?.runs.map(run => <tr key={run.sync_run_id}><td>{run.provider}</td><td>{run.fetched_count}</td><td>{run.started_at}</td><td>{run.status}</td></tr>)}</tbody></table>{overview && !overview.runs.length && <p>No crawler runs recorded.</p>}</div></section>
    <section><h2>User Registrations</h2><div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Date</th>{roles && <th>Role</th>}</tr></thead><tbody>{overview?.users.map(user => <tr key={user.user_id}><td>{user.name}</td><td>{user.email}</td><td>{date(user.created_at)}</td>{roles && <td>{user.role}</td>}</tr>)}</tbody></table></div></section>
    <section><h2>Quick Actions</h2><div className="wf-quick-actions"><div><span>Trigger Crawler</span><button className="wf-secondary" disabled title="Crawler execution is managed by the deployment scheduler">Scheduled by operator</button></div><div><span>Export Jobs CSV</span><button className="primary-button" disabled={exporting} onClick={exportJobs}>{exporting ? 'Exporting…' : 'Export'}</button></div><div><span>Manage User Roles</span><button className="wf-secondary" onClick={() => setRoles(value => !value)}>View Roles</button></div></div>{roles && <p className="wf-muted">Role assignments are managed by the deployment operator; the registration table now shows current roles.</p>}</section>
    <section><h2>System Health</h2><div className="wf-card"><p>Database: {overview?.database || 'Checking…'}</p><p>EC2 CPU: monitoring not connected</p><p>RDS storage: monitoring not connected</p><p>Host memory: monitoring not connected</p></div></section>
    <section><h2>Recent Errors</h2><div className="table-scroll"><table><thead><tr><th>Timestamp</th><th>Type</th><th>Message</th></tr></thead><tbody>{overview?.runs.filter(run => run.error_count || run.error_message).map(run => <tr key={run.sync_run_id}><td>{run.started_at}</td><td>Job collection</td><td>{run.error_message || `${run.error_count} source errors`}</td></tr>)}</tbody></table></div></section>
    <section><h2>Collection Analytics</h2><div className="wf-card">{overview?.runs.slice(0, 5).map(run => <div className="wf-inline" key={run.sync_run_id}><span>{date(run.started_at)} · {run.provider}</span><meter aria-label={`${run.fetched_count} jobs collected`} min={0} max={Math.max(1, ...overview.runs.map(row => row.fetched_count))} value={run.fetched_count} /><span>{run.fetched_count} jobs</span></div>)}</div></section>
    <AdminReview token={auth.token} onForbidden={onForbidden} embedded />
  </main>;
}
