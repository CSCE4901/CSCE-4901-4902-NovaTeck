import MatchExplanation from "./MatchExplanation";
import { careerCategories, collegeMajors } from '../careerCategories';
import BookmarkIcon from './BookmarkIcon';
import SupportInbox from './SupportInbox';
import NavIcon from './NavIcon';
import ResumeMatch from './ResumeMatch';
import CompanyLogo from './CompanyLogo';
import { useEffect, useRef, useState } from 'react';
import ResumeSkills, { PendingSkills, AdminReview } from './ResumeSkills';
import JobDescription from './JobDescription';
import { Confetti, SkillReward } from './Celebration';

const statuses = ['Opened employer site', 'Applied', 'Interviewing', 'Offer', 'Closed'];
const salaryRanges = ['No preference', 'Under $40,000 / year', '$40,000–$59,999 / year', '$60,000–$79,999 / year', '$80,000–$99,999 / year', '$100,000–$119,999 / year', '$120,000+ / year'];
const emptyExperience = () => ({ company: '', title: '', start: '', end: '', description: '' });
const firstName = name => (name || '').trim().split(/\s+/)[0] || 'there';
const date = value => value ? String(value).split('T')[0] : 'Not provided';
function PageHeading({ eyebrow, title, subtitle }) { return <header className="nova-page-header"><div><p className="nova-eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p className="wf-muted">{subtitle}</p>}</div></header>; }
function SectionHeading({ name, children, className = '' }) { return <h2 className={`nova-unified-heading ${className}`}><span className="nova-heading-icon" aria-hidden="true"><NavIcon name={name} /></span>{children}</h2>; }
function Message({ children }) { return children ? <p className="wf-message" role="status">{children}</p> : null; }
function Tags({ values = [] }) { return <div className="wf-tags">{values.length ? values.map(value => <span key={value} className="wf-tag">{value}</span>) : <span className="wf-muted">None listed</span>}</div>; }
function Field({ label, children }) { return <label className="wf-field"><span>{label}</span><span>{children}</span></label>; }
function JobRow({ job, goJob, children }) { return <article className="wf-job-row"><div className="nova-job-identity"><CompanyLogo job={job} /><div><button className="text-button wf-job-title" onClick={() => goJob(job.job_id)}>{job.title}</button><p>{job.company_name}{job.location ? ` · ${job.location}` : ''}</p><div className="nova-card-match"><ResumeMatch job={job} /></div><MatchExplanation job={job} /></div></div>{children}</article>; }
function download(name, content, type = 'text/plain') { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

export function WireDashboard({ auth, request, goJob, setPage }) {
  const [saved, setSaved] = useState([]), [recommended, setRecommended] = useState([]), [applications, setApplications] = useState([]);
  const [message, setMessage] = useState(''), [loading, setLoading] = useState(true);
  const [celebration, setCelebration] = useState(0);
  const [completion, setCompletion] = useState(null);
  const [lastHidden, setLastHidden] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      ...['saved-jobs', 'recommendations', 'applications'].map(path => request(`/students/${auth.user_id}/${path}`, {}, auth.token)),
      request(`/students/${auth.user_id}`, {}, auth.token),
      request(`/students/${auth.user_id}/profile-details`, {}, auth.token),
      request('/resume/saved', {}, auth.token),
    ])
      .then(([saved, recommended, applications, user, details, resume]) => { if (active) {
        setSaved(saved); setRecommended(recommended); setApplications(applications);
        const filled = value => typeof value === 'string' && value.trim().length > 0;
        const sections = [filled(user.name), filled(user.email), filled(details.phone), filled(details.location),
          filled(details.photo), filled(user.skills), Boolean(resume?.filename), filled(details.college_major),
          (details.work_types || []).length > 0, filled(details.preferred_location)];
        setCompletion(Math.round(sections.filter(Boolean).length / sections.length * 100));
      } })
      .catch(error => active && setMessage(error.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [auth.user_id, auth.token]);
  const [savingJob, setSavingJob] = useState(null);
  useEffect(() => {
    const refresh = () => { setLastHidden(null); request(`/students/${auth.user_id}/recommendations`, {}, auth.token).then(setRecommended).catch(error => setMessage(error.message)); };
    window.addEventListener('novateck-recommendations-refresh', refresh);
    return () => window.removeEventListener('novateck-recommendations-refresh', refresh);
  }, [auth.user_id, auth.token]);
  async function hideRecommended(job, undo = false) {
    if (savingJob !== null) return;
    setSavingJob(job.job_id); setMessage('');
    try {
      await request(`/hidden-jobs/${job.job_id}`, { method: undo ? 'DELETE' : 'PUT', ...(!undo ? { body: JSON.stringify({}) } : {}) }, auth.token);
      setLastHidden(undo ? null : job);
      if (!undo) setRecommended(items => items.filter(item => item.job_id !== job.job_id));
      try { setRecommended(await request(`/students/${auth.user_id}/recommendations`, {}, auth.token)); }
      catch { setMessage('Preference saved. Reload to refresh recommendations.'); }
    } catch (error) { setMessage(error.message); }
    finally { setSavingJob(null); }
  }
  async function toggleRecommended(job) {
    if (savingJob !== null) return;
    setSavingJob(job.job_id);
    const alreadySaved = saved.some(item => item.job_id === job.job_id);
    try {
      await request(alreadySaved ? `/saved-jobs/${job.job_id}` : '/saved-jobs', { method: alreadySaved ? 'DELETE' : 'POST', ...(alreadySaved ? {} : { body: JSON.stringify({ job_id: job.job_id }) }) }, auth.token);
      setSaved(current => alreadySaved ? current.filter(item => item.job_id !== job.job_id) : [...current, job]);
      setRecommended(current => current.filter(item => item.job_id !== job.job_id));
      try { setRecommended(await request(`/students/${auth.user_id}/recommendations`, {}, auth.token)); }
      catch { setMessage('Job saved. Recommendations could not refresh; try reloading the dashboard.'); }
    } catch (error) { setMessage(error.message); }
    finally { setSavingJob(null); }
  }
  async function remove(id) { try { await request(`/saved-jobs/${id}`, { method: 'DELETE' }, auth.token); setSaved(items => items.filter(job => job.job_id !== id)); setRecommended(await request(`/students/${auth.user_id}/recommendations`, {}, auth.token)); } catch (error) { setMessage(error.message); } }
  async function updateApplication(job_id, status) {
    try {
      await request(`/students/${auth.user_id}/applications`, { method: 'POST', body: JSON.stringify({ job_id, status }) }, auth.token);
      setApplications(rows => rows.map(row => row.job_id === job_id ? { ...row, status } : row));
      const appreciation = {
        Applied: 'Application recorded! You took the next step — we’re cheering you on.',
        Interviewing: 'Interview time! Your hard work is opening doors — you’ve got this.',
        Offer: 'You got an offer! Congratulations on this exciting milestone!',
      };
      if (appreciation[status] && applications.find(row => row.job_id === job_id)?.status !== status) {
        setCelebration(value => value + 1);
        setMessage(appreciation[status]);
      } else setMessage('');
    } catch (error) { setMessage(error.message); }
  }
  return <main className="wf-page"><Confetti trigger={celebration} /><PageHeading eyebrow="YOUR CAREER COMMAND CENTER" title={`Welcome back, ${firstName(auth.name)}!`} subtitle="Track your opportunities and keep your next move in sight." /><Message>{message}</Message>
    {loading ? <p role="status">Loading dashboard…</p> : <>
      <h2>Statistics</h2><div className="wf-stats wf-stats--three">{[['Saved Jobs', saved.length], ['Applications', applications.filter(row => row.status !== 'Opened employer site').length], ['Profile Completion', completion === null ? 'Unavailable' : `${completion}%`]].map(([label, value]) => <div className="wf-card" key={label}><strong>{label}</strong><p>{value}</p></div>)}</div>
      <div className="wf-two-columns"><section><SectionHeading name="saved">Saved Jobs</SectionHeading>{saved.length ? saved.map(job => <JobRow job={job} goJob={goJob} key={job.job_id}><button className="wf-secondary nova-bookmark-button" onClick={() => remove(job.job_id)} aria-label={`Unsave ${job.title}`} title="Remove from saved jobs"><BookmarkIcon saved /></button></JobRow>) : <p className="wf-empty">No saved jobs yet.</p>}</section>
        <section><SectionHeading name="jobs">Recommended Jobs</SectionHeading>{lastHidden && <p className="nova-hide-feedback" role="status">Job hidden from recommendations. <button className="text-button" type="button" disabled={savingJob !== null} onClick={() => hideRecommended(lastHidden, true)}>Undo</button></p>}{recommended.length ? recommended.map(job => <JobRow job={job} goJob={goJob} key={job.job_id}><button type="button" className="wf-secondary nova-bookmark-button" disabled={savingJob !== null} aria-label={saved.some(item => item.job_id === job.job_id) ? `Unsave ${job.title}` : `Save ${job.title}`} title={saved.some(item => item.job_id === job.job_id) ? "Remove from saved jobs" : "Save job"} onClick={() => toggleRecommended(job)}><BookmarkIcon saved={saved.some(item => item.job_id === job.job_id)} /></button><button type="button" className="text-button nova-hide-job" disabled={savingJob !== null} aria-label={`Hide ${job.title} from recommendations`} title="Hide job from recommendations" onClick={() => hideRecommended(job)}>Hide</button></JobRow>) : <p className="wf-empty">No recommendations available. Add skills or browse Jobs for more opportunities.</p>}</section>
        <section><SectionHeading name="applications">Recent Applications</SectionHeading>{applications.length ? applications.map(job => <div key={job.job_id}><JobRow job={job} goJob={goJob}><select aria-label={`Application status for ${job.title}`} value={job.status} onChange={event => updateApplication(job.job_id, event.target.value)}>{statuses.map(status => <option key={status}>{status}</option>)}</select></JobRow></div>) : <p className="wf-empty">No recent applications.</p>}</section>
        <section><SectionHeading name="actions">Quick Actions</SectionHeading><div className="wf-quick-actions">{[['Update Profile', 'profile'], ['Skill Gap Analysis', 'skillgap'], ['Job Search', 'jobs']].map(([label, page]) => <div key={page}><span>{label}</span><button className="primary-button" onClick={() => setPage(page)}>Open</button></div>)}</div></section>
      </div>
    </>}
  </main>;
}

export function WireProfile({ auth, request, onNameChange, setPage }) {
  const photoInput = useRef(null);
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [details, setDetails] = useState({ phone: '', location: '', photo: '', projects: [], experience: [emptyExperience()], work_types: [], salary_range: '', preferred_location: '', proficiency: {}, career_focus: '' });
  const [skills, setSkills] = useState([]), [newSkill, setNewSkill] = useState(''), [level, setLevel] = useState('Intermediate');
  const [message, setMessage] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([request(`/students/${auth.user_id}`, {}, auth.token), request(`/students/${auth.user_id}/profile-details`, {}, auth.token)])
      .then(([user, extra]) => { if (active) { setProfile({ name: user.name, email: user.email }); setSkills((user.skills || '').split(',').map(s => s.trim()).filter(Boolean)); setDetails(current => ({ ...current, ...extra, experience: extra.experience?.length ? extra.experience : [emptyExperience()] })); } })
      .catch(error => active && setMessage(error.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [auth.user_id, auth.token]);
  useEffect(() => {
    if (message !== 'Your profile and skills have been saved.') return;
    const timer = setTimeout(() => setMessage(''), 3500);
    return () => clearTimeout(timer);
  }, [message]);
  const change = (key, value) => setDetails(current => ({ ...current, [key]: value }));
  function addSkill() { const skill = newSkill.trim(); if (!skill || skills.some(value => value.toLowerCase() === skill.toLowerCase())) return; setSkills(current => [...current, skill]); setDetails(current => ({ ...current, proficiency: { ...current.proficiency, [skill]: level } })); setNewSkill(''); }
  async function photo(event) { const file = event.target.files?.[0]; if (!file) return; if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 500000) { event.target.value = ''; setMessage('Photo was not uploaded. Choose a PNG or JPEG smaller than 500 KB.'); return; } setMessage(''); const reader = new FileReader(); reader.onload = () => change('photo', reader.result); reader.onerror = () => { if (photoInput.current) photoInput.current.value = ''; setMessage('Photo could not be read. Please choose another image.'); }; reader.readAsDataURL(file); }
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
  return <main className="wf-page wf-profile"><PageHeading eyebrow="YOUR STORY, YOUR NEXT STEP" title="Manage Account" subtitle="Build a profile that reflects your skills, experience, and goals." />{message && message !== "Your profile and skills have been saved." && <p className="wf-message nova-profile-error" role="alert">{message}</p>}{loading ? <p role="status">Loading profile…</p> : <form onSubmit={save} onChange={() => { if (message === "Your profile and skills have been saved.") setMessage(""); }}>
    <section><SectionHeading name="profile" className="wf-section-title">Profile Photo</SectionHeading><div className="wf-photo-row"><button type="button" className="nova-photo-edit" onClick={() => photoInput.current?.click()} aria-label={details.photo ? "Change profile photo" : "Add profile photo"} title={details.photo ? "Change profile photo" : "Add profile photo"}>{details.photo ? <img src={details.photo} alt="Your profile" /> : <span className="wf-avatar">{profile.name.trim().split(/\s+/).filter(Boolean).filter((_, index, names) => index === 0 || index === names.length - 1).map(name => name[0]).join("").toUpperCase() || "?"}</span>}<span className="nova-photo-edit-label" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 5 5-12 12-6 1 1-6Z" /><path d="m14 5 5 5" /></svg></span></button><label>Photo Upload <input ref={photoInput} type="file" accept="image/png,image/jpeg" onChange={photo} /><small className="wf-muted">PNG or JPEG · Under 500 KB</small></label>{details.photo && <button type="button" className="wf-secondary" onClick={() => { change("photo", ""); if (photoInput.current) photoInput.current.value = ""; setMessage(""); }}>Remove Photo</button>}</div></section>
    <section><SectionHeading name="profile" className="wf-section-title">Personal Information</SectionHeading><div className="wf-personal-fields">
      <Field label="Full Name"><input required value={profile.name} onChange={event => setProfile(current => ({ ...current, name: event.target.value }))} autoComplete="name" maxLength={255} /></Field>
      <Field label="Email Address"><input required type="email" value={profile.email} onChange={event => setProfile(current => ({ ...current, email: event.target.value }))} autoComplete="email" /></Field>
      <Field label="Phone Number"><input type="tel" value={details.phone} onChange={event => change('phone', event.target.value)} autoComplete="tel" maxLength={50} /></Field>
      <Field label="Location"><input value={details.location} onChange={event => change('location', event.target.value)} maxLength={255} /></Field>
    </div></section>
    <section><SectionHeading name="skills" className="wf-section-title">Skills Management</SectionHeading><div className="wf-field"><span>Your Skills</span><div className="wf-tags">{skills.map(skill => <button type="button" className="wf-tag" key={skill} aria-label={`Remove ${skill}`} title={`${details.proficiency?.[skill] || 'Intermediate'} — click to remove`} onClick={() => setSkills(current => current.filter(value => value !== skill))}>{skill} ×</button>)}</div></div>
      <Field label="Add Skill"><span className="wf-inline"><input value={newSkill} onChange={event => setNewSkill(event.target.value)} maxLength={100} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addSkill(); } }} /><button type="button" className="wf-secondary" onClick={addSkill}>Add</button></span></Field>
      <Field label="Proficiency"><select value={level} onChange={event => setLevel(event.target.value)}>{['Beginner', 'Intermediate', 'Advanced'].map(value => <option key={value}>{value}</option>)}</select></Field>
    </section>
    <section><SectionHeading name="upload" className="wf-section-title">Resume Upload</SectionHeading><ResumeSkills token={auth.token} profileUpload /></section>
    <section><SectionHeading name="experience" className="wf-section-title">Experience</SectionHeading>{details.experience.map((entry, index) => <div className="wf-experience" key={index}>
      <Field label="Company"><input value={entry.company} onChange={event => experience(index, 'company', event.target.value)} /></Field><Field label="Job Title"><input value={entry.title} onChange={event => experience(index, 'title', event.target.value)} /></Field>
      <Field label="Start Date"><input type="date" value={entry.start} onChange={event => experience(index, 'start', event.target.value)} /></Field><Field label="End Date"><input type="date" value={entry.end} onChange={event => experience(index, 'end', event.target.value)} /></Field>
      <div className="wf-span-all"><Field label="Description"><textarea rows={3} value={entry.description} onChange={event => experience(index, 'description', event.target.value)} /></Field></div>
      <button type="button" className="text-button" onClick={() => change('experience', details.experience.filter((_, i) => i !== index))}>Remove experience</button>
    </div>)}<button type="button" className="wf-secondary" onClick={() => change('experience', [...details.experience, emptyExperience()])}>+ Add Experience</button></section>
    <section><SectionHeading name="projects" className="wf-section-title">Projects</SectionHeading><p className="wf-muted">Showcase coursework, personal projects, or team projects.</p>{(details.projects || []).map((project, index) => <div className="wf-experience" key={index}>
      {['title', 'technologies', 'url', 'description'].map(key => <div className={key === 'description' ? 'wf-span-all' : ''} key={key}><Field label={{title:'Project Title', technologies:'Tools / Skills', url:'Project Link', description:'Description'}[key]}>{key === 'description' ? <textarea value={project[key]} maxLength={3000} onChange={event => change('projects', details.projects.map((item, i) => i === index ? {...item, [key]:event.target.value} : item))} /> : <input type={key === 'url' ? 'url' : 'text'} required={key === 'title'} maxLength={key === 'url' ? 1000 : key === 'technologies' ? 500 : 255} placeholder={key === 'url' ? 'https://github.com/…' : undefined} value={project[key]} onChange={event => change('projects', details.projects.map((item, i) => i === index ? {...item, [key]:event.target.value} : item))} />}</Field></div>)}
      <button type="button" className="text-button wf-span-all" onClick={() => change('projects', details.projects.filter((_, i) => i !== index))}>Remove project</button>
    </div>)}<button type="button" className="wf-secondary" disabled={(details.projects || []).length >= 20} onClick={() => change('projects', [...(details.projects || []), {title:'', technologies:'', url:'', description:''}])}>+ Add Project</button></section>
    <section><SectionHeading name="jobs" className="wf-section-title">Job Preferences</SectionHeading><Field label="College Major"><select value={details.college_major || ""} onChange={event => setDetails(current => ({ ...current, college_major: event.target.value, career_focus: collegeMajors.find(([major]) => major === event.target.value)?.[1] || '' }))}><option value="">Select your major</option>{collegeMajors.map(([major]) => <option key={major} value={major}>{major}</option>)}</select></Field><div className="wf-field"><span>Work Type</span><div className="wf-inline">{['Full-time', 'Part-time', 'Contract', 'Internship'].map(type => <label key={type}><input type="checkbox" checked={details.work_types.includes(type)} onChange={event => change('work_types', event.target.checked ? [...details.work_types, type] : details.work_types.filter(value => value !== type))} /> {type}</label>)}</div></div>
      <Field label="Salary Range"><select value={details.salary_range} onChange={event => change('salary_range', event.target.value)}><option value="">Select salary preference</option>{details.salary_range && !salaryRanges.includes(details.salary_range) && <option value={details.salary_range}>{details.salary_range}</option>}{salaryRanges.map(range => <option key={range} value={range}>{range}</option>)}</select></Field><Field label="Preferred Location"><input value={details.preferred_location} onChange={event => change('preferred_location', event.target.value)} maxLength={255} /></Field>
    </section><div className="nova-profile-save"><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>{message === 'Your profile and skills have been saved.' && <p className="is-success" role="status">✓ Changes saved</p>}</div><div className="wf-account-settings"><h2 className="wf-section-title">Account Settings</h2><button type="button" className="wf-secondary" onClick={() => setPage('forgot')}>Reset Password</button> <button type="button" className="wf-secondary" onClick={() => window.dispatchEvent(new Event("novateck-contact-support"))}>Contact Support</button></div>
  </form>}</main>;
}

export function WireJobDetail({ auth, request, jobId, goJob, setPage }) {
  const [job, setJob] = useState(null), [gap, setGap] = useState(null), [similar, setSimilar] = useState([]), [saved, setSaved] = useState(false), [message, setMessage] = useState('');
  useEffect(() => {
    let active = true; setJob(null); setGap(null); setSimilar([]); setSaved(false); setMessage('');
    Promise.all([request(`/jobs/${jobId}`, {}, auth.token), request(`/students/${auth.user_id}/skill-gap?job_id=${jobId}`, {}, auth.token), request(`/students/${auth.user_id}/saved-jobs`, {}, auth.token)])
      .then(async ([job, gap, saved]) => { if (!active) return; setJob(job); setGap(gap); setSaved(saved.some(row => row.job_id === jobId)); const skill = job.skills?.find(row => row.requirement_type === 'required')?.skill_name; const rows = await request(`/jobs?limit=4${skill ? `&skill=${encodeURIComponent(skill)}` : `&company_id=${job.company_id}`}`, {}, auth.token); if (active) setSimilar(rows.filter(row => row.job_id !== jobId).slice(0, 3)); })
      .catch(error => active && setMessage(error.message));
    return () => { active = false; };
  }, [jobId, auth.token]);
  async function save() { try { await request('/saved-jobs', { method: 'POST', body: JSON.stringify({ job_id: jobId }) }, auth.token); setSaved(true); setMessage('Job saved.'); } catch (error) { setMessage(error.message); } }
  async function trackOpening() { try { const existing = await request(`/students/${auth.user_id}/applications`, {}, auth.token); if (!existing.some(row => row.job_id === jobId)) await request(`/students/${auth.user_id}/applications`, { method: 'POST', body: JSON.stringify({ job_id: jobId, status: 'Opened employer site' }) }, auth.token); } catch (error) { setMessage(error.message); } }
  const url = job?.source_url && /^https?:\/\//i.test(job.source_url) ? job.source_url : null;
  return <main className="wf-page"><Message>{message}</Message>{!job ? <p role="status">{message ? 'Job details could not be loaded.' : 'Loading job…'}</p> : <>
    <PageHeading eyebrow="EXPLORE YOUR NEXT OPPORTUNITY" title={job.title} subtitle={`${job.company_name} · ${job.location || "Location not provided"} · ${job.job_type || "Work type not provided"}`} />
    <div className="wf-inline wf-job-actions">{url && <a className="primary-button" href={url} target="_blank" rel="noopener noreferrer" onClick={trackOpening}>Apply Now</a>}<button className="wf-secondary nova-bookmark-button" disabled={saved} onClick={save} aria-label={saved ? "Job saved" : "Save job"} title={saved ? "Job saved" : "Save job"}><BookmarkIcon saved={saved} /></button></div>
    <div className="wf-detail-columns"><div>
      <JobDescription description={job.description} />
      <section><SectionHeading name="requirements">Required Skills</SectionHeading><Tags values={(job.skills || []).filter(row => row.requirement_type === 'required').map(row => row.skill_name)} /></section>
      {(job.skills || []).some(row => row.requirement_type === 'preferred') && <section><SectionHeading name="requirements">Preferred Skills</SectionHeading><Tags values={job.skills.filter(row => row.requirement_type === 'preferred').map(row => row.skill_name)} /></section>}
      <section><SectionHeading name="match">Skill Match</SectionHeading><div className="wf-match-bar" role="meter" aria-label="Required skill match" aria-valuemin={0} aria-valuemax={100} aria-valuenow={gap?.match_pct || 0}><span style={{ width: `${gap?.match_pct || 0}%` }} /><strong>{gap?.match_pct || 0}%</strong></div><SkillReward percent={gap?.match_pct} eligible={gap?.total_required > 0 && gap?.missing?.length === 0} name="Job Ready" scope={jobId} celebrate={false} /></section>
      <section><h2>Similar Jobs</h2>{similar.length ? similar.map(row => <JobRow job={row} goJob={goJob} key={row.job_id} />) : <p className="wf-empty">No similar active jobs found.</p>}</section>
    </div><aside className="wf-card wf-overview"><h2>Job Overview</h2><dl>{[['Posted', date(job.date_posted)], ['Type', job.job_type], ['Location', job.location], ['Salary', job.salary_range], ['Company', job.company_name], ['Industry', job.company_industry], ['Experience', job.experience_level], ['Company Size', job.company_size]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl><details><summary>Source metadata</summary><p>HTTP status (source feed): {job.source_http_status ?? 'Not recorded'}</p><p>Fetched: {date(job.date_crawled)}</p><p>Last verified: {date(job.last_seen_at)}</p>{url && <a href={url} target="_blank" rel="noreferrer">Original posting</a>}</details></aside></div>
    <button className="text-button wf-back" onClick={() => setPage('jobs')}>← Back to Jobs</button>
  </>}</main>;
}

export function WireSkillGap({ auth, request, setPage }) {
  const categories = careerCategories;
  const [selected, setSelected] = useState(null), [data, setData] = useState(null), [message, setMessage] = useState(''), [refresh, setRefresh] = useState(0), [adding, setAdding] = useState(null);
  useEffect(() => {
    let active = true;
    request(`/students/${auth.user_id}/profile-details`, {}, auth.token).then(details => { if (active) setSelected(details.career_focus || ''); }).catch(() => active && setSelected(''));
    return () => { active = false; };
  }, [auth.user_id, auth.token]);
  useEffect(() => {
    if (selected === null) return;
    let active = true; setData(null);
    request(`/students/${auth.user_id}/skill-gap${selected ? `?discipline=${encodeURIComponent(selected)}` : ''}`, {}, auth.token).then(data => active && setData(data)).catch(error => active && setMessage(error.message));
    return () => { active = false; };
  }, [auth.token, selected, refresh]);
  const own = data?.user_skills || [], missing = data?.missing_skills || [];
  const required = [...(data?.matched_skills || []), ...(data?.missing_skills || [])].map(row => row.skill_name);
  async function addRequiredSkill(skill) {
    if (adding !== null || own.some(value => value.toLowerCase() === skill.toLowerCase())) return;
    setAdding(skill); setMessage('');
    try {
      const profile = await request(`/students/${auth.user_id}`, {}, auth.token);
      const current = (profile.skills || '').split(',').map(value => value.trim()).filter(Boolean);
      if (!current.some(value => value.toLowerCase() === skill.toLowerCase())) {
        await request(`/students/${auth.user_id}/skills`, { method: 'PUT', body: JSON.stringify({ skills: [...current, skill] }) }, auth.token);
      }
      setMessage(`${skill} added to your profile.`);
      setRefresh(value => value + 1);
    } catch (error) { setMessage(error.message); }
    finally { setAdding(null); }
  }
  const pct = Math.max(0, Math.min(100, data?.overall_match_pct || 0));
  const matchColor = pct >= 80 ? "#16a34a" : pct >= 50 ? "#eab308" : "#dc2626";
  const requiredToAdd = required.filter(skill => !own.some(value => value.toLowerCase() === skill.toLowerCase()));
  const complete = pct === 100 && required.length > 0 && missing.length === 0;
  const encouragement = !data ? 'Checking your skill match…'
    : !required.length ? 'Choose a category with skills to compare'
    : complete ? '100% match — you’ve got every skill!'
    : pct >= 80 ? 'Strong match — you’re almost there!'
    : pct >= 50 ? 'Over halfway — getting there!'
    : pct >= 25 ? 'You’ve made a start — keep growing!'
    : pct > 0 ? 'Every skill counts — build your foundation!'
    : 'Start your journey — add your first matching skill!';
  return <main className="wf-page nova-skill-page">
    <header className="nova-page-header"><div><p className="nova-eyebrow">YOUR CAREER, LEVELLED UP</p><h1>Skill Gap Analysis</h1><p className="wf-muted">See how your skills compare to what DFW employers need.</p></div><aside className="nova-tip"><span aria-hidden="true">💡</span><p>Add skills to your profile to increase your match and discover more relevant opportunities.</p></aside></header><Message>{message}</Message>
    <section className="nova-focus"><h2><span aria-hidden="true">◎</span> Career Focus</h2><label className="wf-inline">Career Category <select value={selected || ""} disabled={adding !== null} onChange={event => { setMessage(''); setSelected(event.target.value); }}>{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></section>
    <ResumeSkills token={auth.token} onProcessed={() => setRefresh(value => value + 1)} compact />
    <div className="wf-two-columns nova-skill-cards"><section className="nova-owned"><div className="nova-section-heading"><h2><span className="nova-heading-icon" aria-hidden="true">✓</span> Your Skills</h2><span className="nova-count">{own.length} in your profile</span></div><p className="nova-caption">Your skill stack is the foundation of your next opportunity.</p><Tags values={own} /><button className="wf-secondary wf-update-skills" onClick={() => setPage('profile')}>＋ Update skills in Profile</button></section><section className="nova-required"><div className="nova-section-heading"><h2><span className="nova-heading-icon" aria-hidden="true">✦</span> Required Skills</h2><span className="nova-count">{requiredToAdd.length} skills to add</span></div><p className="nova-caption">Click a skill you already have to add it to your profile.</p><div className="wf-tags">{requiredToAdd.length ? requiredToAdd.map(skill => {
      const saved = own.some(value => value.toLowerCase() === skill.toLowerCase());
      return <button type="button" className="wf-tag nova-add-skill" key={skill} disabled={saved || adding !== null} aria-label={saved ? `${skill} already in your profile` : `Add ${skill} to your profile`} onClick={() => addRequiredSkill(skill)}><span aria-hidden="true">{saved ? '✓' : '＋'}</span> {adding === skill ? 'Adding…' : skill}</button>;
    }) : <span className="wf-muted">{data ? required.length ? 'You already have all listed required skills in your profile.' : 'No required skills listed for this category.' : 'Loading required skills…'}</span>}</div></section></div>
    <div className="wf-gap-columns nova-gap-panels"><section className="nova-match-panel"><h2>Match Percentage</h2><div className="nova-match-content"><div className="wf-donut" style={{ background: `conic-gradient(${matchColor} 0% ${pct}%, #e5e7eb ${pct}% 100%)` }} role="meter" aria-label="Skill match" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span><strong>{pct}%</strong><small>Match</small></span></div><div><h3>{encouragement}</h3><p className="nova-caption">{data ? required.length ? 'Your match reflects how often your skills appear in DFW job requirements.' : 'No job requirements found for this category yet.' : 'Loading your career comparison…'}</p><div className="nova-progress" aria-hidden="true"><span style={{ width: `${pct}%`, background: matchColor }} /></div><span className="nova-match-note">{categories.find(([value]) => value === selected)?.[1]}</span></div></div><SkillReward percent={pct} eligible={complete} scope={selected} />
      {data && required.length > 0 && <div className="nova-milestone"><span className="nova-eyebrow">YOUR NEXT MILESTONE</span><h3>{pct === 100 ? 'All milestones reached!' : `${[25, 50, 80, 100].find(value => value > pct)}% match is your next target`}</h3><ol className="nova-milestone-steps">{[25, 50, 80, 100].map(value => <li key={value} className={pct >= value ? 'is-reached' : value === [25, 50, 80, 100].find(target => target > pct) ? 'is-next' : ''}><span aria-hidden="true">{pct >= value ? '✓' : '○'}</span><strong>{value}%</strong><small>{pct >= value ? 'Reached' : value === [25, 50, 80, 100].find(target => target > pct) ? 'Next target' : 'Ahead'}</small></li>)}</ol>
        {missing[0] ? <div className="nova-milestone-focus"><span>FOCUS NEXT</span><strong>{missing[0].skill_name}</strong><p>Explore this skill, then add it to your profile when you’re confident using it.</p><button type="button" className="wf-secondary" onClick={() => window.dispatchEvent(new CustomEvent('novateck-ask-nova', { detail: { prompt: `Help me build a beginner learning plan for ${missing[0].skill_name} for ${categories.find(([value]) => value === selected)?.[1]}. Suggest a practice project and how to check my understanding.` } }))}>Ask Nova for a learning plan</button></div> : <p className="nova-caption">Keep exploring new skills and career categories.</p>}
      </div>}
      </section>
      <section className="nova-missing"><div className="nova-section-heading"><h2><span className="nova-heading-icon" aria-hidden="true">ϟ</span> Skills Gap</h2><span className="nova-count">{missing.length ? `${missing.length} shown to improve` : 'Keep growing'}</span></div><p className="nova-caption">Focus on these skills to open more doors.</p>{missing.length ? missing.map((row, index) => <div className="wf-job-row" key={row.skill_name}><strong><span aria-hidden="true">＋ </span>{row.skill_name}</strong><span className="wf-muted">{row.demand_count == null ? 'Required' : `${row.demand_count} jobs`} · Priority {index + 1}</span></div>) : <p className="wf-empty">{data ? 'No missing skills identified.' : 'Loading skill comparison…'}</p>}<div className="nova-why"><span aria-hidden="true">▤</span><div><strong>Why these skills?</strong><p>They appear in job requirements for your category and can guide what you learn next.</p></div></div></section></div>
    <PendingSkills skills={data?.unverified_skills} token={auth.token} onAdded={() => setRefresh(value => value + 1)} />
    <section className="nova-learning"><h2><span className="nova-heading-icon" aria-hidden="true">▤</span> Learning Recommendations</h2><p className="nova-caption">Small steps, bigger opportunities. Explore resources for your next skill.</p><div className="nova-resource-grid">{missing.slice(0, 4).map(row => <a className="nova-resource" key={row.skill_name} href={`https://www.google.com/search?q=${encodeURIComponent(row.skill_name + ' official documentation tutorial')}`} target="_blank" rel="noreferrer"><div><strong>{row.skill_name}</strong><p>Find documentation & tutorials</p></div></a>)}</div>{!missing.length && <p className="nova-learning-empty">{data ? 'Explore a new career category or keep developing the skills in your profile.' : 'Your learning suggestions will appear after the comparison loads.'}</p>}</section>
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
  return <main className="wf-page"><PageHeading eyebrow="NOVATECK OPERATIONS" title="Admin Dashboard" subtitle="Manage the community, skills, and opportunities in one place." /><Message>{message}</Message>
    <h2>Statistics</h2><div className="wf-stats">{[['Total Jobs', overview?.counts.total_jobs], ['Registered Users', overview?.counts.registered_users], ['Crawler Runs', overview?.counts.crawler_runs], ['System Health', overview?.database === 'ok' ? 'Database connected' : 'Checking…']].map(([label, value]) => <div className="wf-card" key={label}><strong>{label}</strong><p>{value ?? '—'}</p></div>)}</div>
    <section><h2>Crawler Activity</h2><div className="table-scroll"><table><thead><tr><th>Source</th><th>Jobs Found</th><th>Timestamp</th><th>Status</th></tr></thead><tbody>{overview?.runs.map(run => <tr key={run.sync_run_id}><td>{run.provider}</td><td>{run.fetched_count}</td><td>{run.started_at}</td><td>{run.status}</td></tr>)}</tbody></table>{overview && !overview.runs.length && <p>No crawler runs recorded.</p>}</div></section>
    <section><h2>User Registrations</h2><div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Date</th>{roles && <th>Role</th>}</tr></thead><tbody>{overview?.users.map(user => <tr key={user.user_id}><td>{user.name}</td><td>{user.email}</td><td>{date(user.created_at)}</td>{roles && <td>{user.role}</td>}</tr>)}</tbody></table></div></section>
    <section><SectionHeading name="actions">Quick Actions</SectionHeading><div className="wf-quick-actions"><div><span>Trigger Crawler</span><button className="wf-secondary" disabled title="Crawler execution is managed by the deployment scheduler">Scheduled by operator</button></div><div><span>Export Jobs CSV</span><button className="primary-button" disabled={exporting} onClick={exportJobs}>{exporting ? 'Exporting…' : 'Export'}</button></div><div><span>Manage User Roles</span><button className="wf-secondary" onClick={() => setRoles(value => !value)}>View Roles</button></div></div>{roles && <p className="wf-muted">Role assignments are managed by the deployment operator; the registration table now shows current roles.</p>}</section>
    <section><h2>System Health</h2><div className="wf-card"><p>Database: {overview?.database || 'Checking…'}</p><p>EC2 CPU: monitoring not connected</p><p>RDS storage: monitoring not connected</p><p>Host memory: monitoring not connected</p></div></section>
    <section><h2>Recent Errors</h2><div className="table-scroll"><table><thead><tr><th>Timestamp</th><th>Type</th><th>Message</th></tr></thead><tbody>{overview?.runs.filter(run => run.error_count || run.error_message).map(run => <tr key={run.sync_run_id}><td>{run.started_at}</td><td>Job collection</td><td>{run.error_message || `${run.error_count} source errors`}</td></tr>)}</tbody></table></div></section>
    <section><h2>Collection Analytics</h2><div className="wf-card">{overview?.runs.slice(0, 5).map(run => <div className="wf-inline" key={run.sync_run_id}><span>{date(run.started_at)} · {run.provider}</span><meter aria-label={`${run.fetched_count} jobs collected`} min={0} max={Math.max(1, ...overview.runs.map(row => row.fetched_count))} value={run.fetched_count} /><span>{run.fetched_count} jobs</span></div>)}</div></section>
    <SupportInbox token={auth.token} request={request} />
    <AdminReview token={auth.token} onForbidden={onForbidden} embedded />
  </main>;
}
