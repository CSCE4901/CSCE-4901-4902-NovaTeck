import ProfilePage from './ProfilePage';
import CompactSimilarJob from './CompactSimilarJob';
import JobLocation from './JobLocation';
import ResumeMatch from './ResumeMatch';
import { skillDisplayName } from './skillDisplay';
import BookmarkIcon from './BookmarkIcon';
import JobCard from './JobCard';
import JobFreshness, { isJobUnavailable } from "./JobFreshness";
import SupportInbox from './SupportInbox';
import NavIcon from './NavIcon';
import { useEffect, useRef, useState } from 'react';
import { AdminReview } from './ResumeSkills';
import JobDescription, { EmployerDetails, JobQualifications } from './JobDescription';
import './WireframeGaps.css';
import CompanyLogo from './CompanyLogo';
import { parseJobDescription, formatPostedDate } from './jobDescriptionText';
import './JobDetailsPolish.css';
import { profileMatch, sortJobsByProfileMatch } from './profileMatch';
import { JobMatchInfo, JobSkillEvidence, JobSourceInfo } from './JobDetailsInfo';
import SkillGapPage from './SkillGapPage';
import { Confetti, SkillReward } from './Celebration';

const statuses = ['Opened employer site', 'Applied', 'Interviewing', 'Offer', 'Closed'];
const firstName = name => (name || '').trim().split(/\s+/)[0] || 'there';
const date = value => value ? String(value).split('T')[0] : 'Not provided';
function PageHeading({ eyebrow, title, subtitle }) { return <header className="nova-page-header"><div>{eyebrow && <p className="nova-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{subtitle && <p className="wf-muted">{subtitle}</p>}</div></header>; }
function SectionHeading({ name, children, className = '' }) { return <h2 className={`nova-unified-heading ${className}`}><span className="nova-heading-icon" aria-hidden="true"><NavIcon name={name} /></span>{children}</h2>; }
function Message({ children, error = false }) { return children ? <p className={`wf-message${error ? " wf-message-error" : ""}`} role={error ? "alert" : "status"}>{children}</p> : null; }
function Tags({ values = [] }) { return <div className="wf-tags">{values.length ? values.map(value => <span key={value} className="wf-tag">{skillDisplayName(value)}</span>) : <span className="wf-muted">None listed</span>}</div>; }

function download(name, content, type = 'text/plain') { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

export function WireDashboard({ auth, request, goJob, setPage }) {
  const [saved, setSaved] = useState([]), [recommended, setRecommended] = useState([]), [applications, setApplications] = useState([]);
  const [message, setMessage] = useState(''), [loading, setLoading] = useState(true);
  const [celebration, setCelebration] = useState(0);
  const [reminderJob, setReminderJob] = useState(''), [reminderDates, setReminderDates] = useState({deadline:'',follow_up:''}), [savingDates,setSavingDates]=useState(false);
  async function chooseReminderJob(id) {
    setReminderJob(id); setReminderDates({deadline:'',follow_up:''});
    if (id) try { setReminderDates(await request(`/students/${auth.user_id}/job-reminder-dates/${id}`,{},auth.token)); } catch(error) { setReminderError(error.message); }
  }
  async function saveReminderDates() {
    setSavingDates(true);
    try {
      await request(`/students/${auth.user_id}/job-reminder-dates/${reminderJob}`,{method:'PUT',body:JSON.stringify(reminderDates)},auth.token);
      setReminders(await request(`/students/${auth.user_id}/reminders`,{},auth.token)); setReminderError(''); setMessage('Reminder dates saved.');
    } catch(error) { setReminderError(error.message); }
    finally {setSavingDates(false);}
  }
  const [reminders, setReminders] = useState([]), [reminderError, setReminderError] = useState('');
  useEffect(() => {
    let active = true;
    const load = () => request(`/students/${auth.user_id}/reminders`, {}, auth.token).then(rows => { if (active) { setReminders(rows); setReminderError(''); } }).catch(error => active && setReminderError(error.message));
    load();
    window.addEventListener('focus', load);
    const timer = setInterval(load, 60000);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', load); };
  }, [auth.user_id, auth.token, saved, applications]);
  const [completion, setCompletion] = useState(null);
  const [profileHint, setProfileHint] = useState('');
  const savedSection = useRef(null), applicationsSection = useRef(null);
  const [showAllApplications, setShowAllApplications] = useState(false);
  function openSection(ref) { ref.current?.scrollIntoView({ block: 'start' }); ref.current?.focus({ preventScroll: true }); }
  const [jobListView, setJobListView] = useState(null);
  async function seeAllJobs(kind) {
    try {
      if (kind === 'recommended') setRecommended(await request(`/students/${auth.user_id}/recommendations?all=1`, {}, auth.token));
      setJobListView(kind);
      window.scrollTo(0, 0);
    } catch (error) { setMessage(error.message); }
  }
  const rankedRecommendations = sortJobsByProfileMatch(recommended, auth.profileSkills);
  const compactRow = (job, showRemove = false) => <CompactSimilarJob key={job.job_id} job={job} profileSkills={auth.profileSkills} goJob={goJob} saved={saved.some(item => item.job_id === job.job_id)} showRemove={showRemove} onSave={toggleRecommended} busy={savingJob !== null} limitedLabel="Limited data" />;
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
        const needs = [!resume?.filename && 'Scan your resume to discover skills for your profile', !filled(user.skills) && 'Add skills to improve matches', !filled(details.college_major) && 'Choose your career focus', !filled(details.location) && 'Add your location', !filled(details.phone) && 'Add your phone number', !filled(details.photo) && 'Add a profile photo', !(details.work_types || []).length && 'Choose preferred work types', !filled(details.preferred_location) && 'Choose a preferred location'];
        setProfileHint(needs.find(Boolean) || 'Your profile is complete');
      } })
      .catch(error => active && setMessage(error.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [auth.user_id, auth.token]);
  const [savingJob, setSavingJob] = useState(null);
  useEffect(() => {
    const refresh = () => { request(`/students/${auth.user_id}/recommendations`, {}, auth.token).then(setRecommended).catch(error => setMessage(error.message)); };
    window.addEventListener('novateck-recommendations-refresh', refresh);
    return () => window.removeEventListener('novateck-recommendations-refresh', refresh);
  }, [auth.user_id, auth.token]);
  async function toggleRecommended(job) {
    if (savingJob !== null) return;
    setSavingJob(job.job_id);
    const alreadySaved = saved.some(item => item.job_id === job.job_id);
    try {
      await request(alreadySaved ? `/saved-jobs/${job.job_id}` : '/saved-jobs', { method: alreadySaved ? 'DELETE' : 'POST', ...(alreadySaved ? {} : { body: JSON.stringify({ job_id: job.job_id }) }) }, auth.token);
      setSaved(current => alreadySaved ? current.filter(item => item.job_id !== job.job_id) : [...current, job]);
      setRecommended(current => current.filter(item => item.job_id !== job.job_id));
      try { setRecommended(await request(`/students/${auth.user_id}/recommendations${jobListView === 'recommended' ? '?all=1' : ''}`, {}, auth.token)); }
      catch { setMessage('Job saved. Recommendations could not refresh; try reloading the dashboard.'); }
    } catch (error) { setMessage(error.message); }
    finally { setSavingJob(null); }
  }
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
  return <main className="wf-page lp-dashboard"><Confetti trigger={celebration} /><PageHeading title={`Welcome back, ${firstName(auth.name)}!`} subtitle="Track your opportunities and keep your next move in sight." /><Message>{message}</Message>
    {loading ? <p role="status">Loading dashboard…</p> : jobListView ? <section className="nova-dashboard-all-jobs"><button type="button" className="text-button wf-back" onClick={() => { setJobListView(null); window.scrollTo(0, 0); }}>← Back to dashboard</button><h2>{jobListView === 'saved' ? 'Saved Jobs' : 'Recommended Jobs'}</h2>{(jobListView === 'saved' ? saved : rankedRecommendations).map(job => compactRow(job, jobListView === 'saved'))}{!(jobListView === 'saved' ? saved : recommended).length && <p className="wf-empty">No jobs available.</p>}</section> : <>
      <div className="wf-stats wf-stats--three">
        <button type="button" className="wf-card nova-stat-link" onClick={() => openSection(savedSection)}><strong>Saved Jobs</strong><p>{saved.length}</p><small>View your saved jobs →</small></button>
        <button type="button" className="wf-card nova-stat-link" onClick={() => { setShowAllApplications(true); openSection(applicationsSection); }}><strong>Applications</strong><p>{applications.filter(row => row.status !== 'Opened employer site').length}</p><small>View recent applications →</small></button>
        <button type="button" className="wf-card nova-stat-link" onClick={() => setPage('profile', profileHint === 'Add your location' ? 'location' : null)}><strong>Profile Completion</strong><p>{completion === null ? 'Unavailable' : `${completion}%`}</p><progress aria-label="Profile completion" max="100" value={completion || 0} /><small>{profileHint} →</small></button>
      </div>

      <p className="nova-profile-match-note">Job matches use your saved profile skills and listed required skill groups.</p>
      <div className="wf-two-columns nova-dashboard-job-lists">
        <section ref={savedSection} tabIndex={-1} aria-labelledby="dashboard-saved-title"><h2 id="dashboard-saved-title" className="nova-unified-heading"><span className="nova-heading-icon" aria-hidden="true"><NavIcon name="saved" /></span>Saved Jobs</h2>{saved.length ? saved.slice(0, 5).map(job => compactRow(job, true)) : <p className="wf-empty">No saved jobs yet.</p>}<button type="button" className="text-button nova-widget-see-all" onClick={() => seeAllJobs('saved')}>See all saved jobs</button></section>
        <section><SectionHeading name="jobs">Recommended Jobs</SectionHeading>
          {recommended.length ? rankedRecommendations.slice(0, 5).map(job => compactRow(job)) : <p className="wf-empty">No matches available. Add skills or browse Jobs for more opportunities.</p>}
          <button type="button" className="text-button nova-widget-see-all" onClick={() => seeAllJobs('recommended')}>See all recommended jobs</button>
        </section>
      </div>
      <div className="wf-two-columns nova-dashboard-activity">
      <section ref={applicationsSection} tabIndex={-1} className="nova-dashboard-applications" aria-labelledby="dashboard-applications-title">
        <h2 id="dashboard-applications-title">Recent Applications</h2>
        {applications.length ? <>
          <div className="nova-recent-applications">{applications.slice(0, showAllApplications ? applications.length : 4).map(job => <div className="nova-application-summary" key={job.job_id}>
            <div><button type="button" className="text-button wf-job-title" onClick={() => goJob(job.job_id)}>{job.title}</button><p>{job.company_name}</p></div>
            <label>Status<select aria-label={`Application status for ${job.title}`} value={job.status} onChange={event => updateApplication(job.job_id, event.target.value)}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
          </div>)}</div>
          {applications.length > 4 && <button type="button" className="text-button" onClick={() => setShowAllApplications(value => !value)}>{showAllApplications ? 'Show recent only' : `View all ${applications.length} tracked openings`}</button>}
        </> : <p className="wf-empty">No applications yet. Open an employer’s application page, then update its status here.</p>}
      </section>
      <section><SectionHeading name="actions">Quick Actions</SectionHeading><div className="wf-quick-actions">{[['Update Profile', 'profile'], ['Skill Gap Analysis', 'skillgap'], ['Job Search', 'jobs']].map(([label, page]) => <div key={page}><span>{label}</span><button className="primary-button" onClick={() => setPage(page)}>Open</button></div>)}</div></section>
      </div>
      <section className="wf-card nova-reminders" aria-labelledby="reminders-title"><h2 id="reminders-title" className="nova-unified-heading"><span className="nova-heading-icon" aria-hidden="true"><NavIcon name="alerts" /></span>Job alerts &amp; reminders</h2><details className="nova-reminder-editor"><summary>Set reminder dates</summary><label>Saved job or application<select value={reminderJob} onChange={event=>chooseReminderJob(event.target.value)} disabled={savingDates}><option value="">Choose a job</option>{[...new Map([...saved,...applications].map(job=>[job.job_id,job])).values()].map(job=><option key={job.job_id} value={job.job_id}>{job.title}</option>)}</select></label>{reminderJob && <div className="wf-inline"><label>Deadline<input type="date" value={reminderDates.deadline} onChange={event=>setReminderDates(current=>({...current,deadline:event.target.value}))} /></label><label>Follow-up date<input type="date" value={reminderDates.follow_up} onChange={event=>setReminderDates(current=>({...current,follow_up:event.target.value}))} /></label><button className="primary-button" type="button" disabled={savingDates} onClick={saveReminderDates}>{savingDates?'Saving…':'Save reminder dates'}</button></div>}</details><p className="wf-muted">New jobs posted within 7 days.</p>{reminderError ? <Message error>{reminderError}</Message> : reminders.length ? reminders.map(row => <div className="nova-reminder-row" key={row.id}><div><strong>{row.kind}{row.overdue ? ' · Overdue' : ''}</strong><button type="button" className="text-button wf-job-title" onClick={() => goJob(row.job_id)}>{row.title}</button><small>{row.company} · {row.message}</small></div><time dateTime={row.date}>{row.date}</time></div>) : <p className="wf-empty">No new matching jobs, upcoming deadlines, or follow-ups.</p>}</section>
    </>}
  </main>;
}

export function WireProfile(props) { return <ProfilePage {...props} />; }

export function WireJobDetail({ auth, request, jobId, goJob, setPage, onBack, returnPage = "jobs" }) {
  const [job, setJob] = useState(null), [similar, setSimilar] = useState([]), [saved, setSaved] = useState(false), [message, setMessage] = useState('');
  const [similarTotal, setSimilarTotal] = useState(0), [showAllSimilar, setShowAllSimilar] = useState(false);
  async function loadAllSimilar() {
    try { const result = await request(`/jobs/${jobId}/similar?all=1`, {}, auth.token); setSimilar(result.jobs); setShowAllSimilar(true); } catch (error) { setMessage(error.message); }
  }
  useEffect(() => {
    let active = true; setSimilarTotal(0); setShowAllSimilar(false); setJob(null); setSimilar([]); setSaved(false); setMessage('');
    Promise.all([request(`/jobs/${jobId}`, {}, auth.token), request(`/students/${auth.user_id}/saved-jobs`, {}, auth.token)])
      .then(async ([job, saved]) => { if (!active) return; setJob(job); setSaved(saved.some(row => row.job_id === jobId)); const result = await request(`/jobs/${jobId}/similar?limit=3`, {}, auth.token); if (active) { setSimilar(result.jobs); setSimilarTotal(result.total); } })
      .catch(error => active && setMessage(error.message));
    return () => { active = false; };
  }, [jobId, auth.token]);
  async function save() { try { await request('/saved-jobs', { method: 'POST', body: JSON.stringify({ job_id: jobId }) }, auth.token); setSaved(true); setMessage('Job saved.'); } catch (error) { setMessage(error.message); } }
  async function trackOpening() { try { const existing = await request(`/students/${auth.user_id}/applications`, {}, auth.token); if (!existing.some(row => row.job_id === jobId)) await request(`/students/${auth.user_id}/applications`, { method: 'POST', body: JSON.stringify({ job_id: jobId, status: 'Opened employer site' }) }, auth.token); } catch (error) { setMessage(error.message); } }
  const backLabel = `← Back to ${returnPage === 'detail' ? 'previous job' : returnPage === 'dashboard' ? 'Dashboard' : returnPage === 'home' ? 'Home' : 'Jobs'}`;
  return <main className="wf-page nova-job-detail"><button type="button" className="text-button wf-back nova-detail-back" onClick={onBack || (() => setPage('jobs'))}>{backLabel}</button><Message>{message}</Message>{!job ? <p role="status">{message ? 'Job details could not be loaded.' : 'Loading job…'}</p> : <JobDetailContent job={job} profileSkills={auth.profileSkills} similar={similar} saved={saved} save={save} trackOpening={trackOpening} goJob={goJob} setPage={setPage} onBack={onBack} backLabel={backLabel} similarTotal={similarTotal} showAllSimilar={showAllSimilar} loadAllSimilar={loadAllSimilar} />}</main>;
}

export function JobDetailContent({ job, profileSkills, similar = [], saved, save, trackOpening, goJob, setPage, onBack, backLabel = "← Back to Jobs", similarTotal = 0, showAllSimilar = false, loadAllSimilar }) {
  const url = job.source_url && /^https?:\/\//i.test(job.source_url) ? job.source_url : null;
  const jobId = job.job_id;
  const descriptionContent = parseJobDescription(job.description, job.description_sections || []);
  const requiredSkills = profileMatch(job, profileSkills).groups.map(group => group.skills.join(' / '));
  const preferredSkills = (job.skills || []).filter(row => row.requirement_type === 'preferred').map(row => row.skill_name);
  const match = profileMatch(job, profileSkills);
  const pct = match.percent;
  const listed = value => value != null && (typeof value !== 'string' || value.trim());
  const overview = [['Posted', formatPostedDate(job.date_posted)], ['Type', [job.job_type, job.work_arrangement].filter(Boolean).join(' · ')], ['Location', job.location?.trim() && <JobLocation location={job.location} jobType={job.work_arrangement || job.job_type} />], ['Salary', job.salary_range], ['Company', job.company_name], ['Industry', job.company_industry], ['Experience', job.experience_level], ['Company Size', job.company_size]];

  return <>
    <header className="nova-detail-header"><div className="nova-detail-company"><CompanyLogo job={job} /><span>{job.company_name || 'Company'}</span></div><h1>{job.title}</h1><p>{job.location && <JobLocation location={job.location} jobType={job.work_arrangement || job.job_type} />}{job.location && (job.work_arrangement || job.job_type) && ' · '}{[job.job_type, job.work_arrangement].filter(Boolean).join(' · ')}</p></header>
    <JobFreshness job={job} formatDate={formatPostedDate} /><div className="wf-inline wf-job-actions">{url && !isJobUnavailable(job) && <a className="primary-button" href={url} target="_blank" rel="noopener noreferrer" onClick={trackOpening}>Apply Now</a>}<button className="wf-secondary nova-bookmark-button nova-detail-save" disabled={saved} onClick={save} aria-label={saved ? "Job saved" : "Save job"} aria-pressed={saved} title={saved ? "Job saved" : "Save job"}><BookmarkIcon saved={saved} /><span>{saved ? 'Saved' : 'Save Job'}</span></button></div>
    <div className="wf-detail-columns"><div>
      <JobDescription content={descriptionContent} />
      <JobQualifications content={descriptionContent} preferredSkills={preferredSkills} />
      <section className="wf-card nova-detail-skills"><SectionHeading name="skills">Required Skills</SectionHeading><Tags values={requiredSkills} /><JobSkillEvidence evidence={job.skill_evidence} /></section>
      <section className="wf-card nova-detail-skills nova-your-match"><SectionHeading name="match">Skill Match</SectionHeading><ResumeMatch job={job} profileSkills={profileSkills} />{pct > 0 && <div className="nova-detail-match-row"><div className="wf-match-bar" role="meter" aria-label="Skill match" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span style={{ width: `${pct}%` }} /></div><strong>{pct}%</strong></div>}<JobMatchInfo match={match} /><SkillReward percent={pct} eligible={pct === 100 && match.groups.length >= 3 && match.matched === match.groups.length} name="Job Ready" scope={jobId} celebrate={false} /></section>
      <section><h2>Similar Jobs</h2><p className="nova-profile-match-note">Matches use your saved profile skills.</p>{similar.length ? similar.map(row => <CompactSimilarJob job={row} profileSkills={profileSkills} goJob={goJob} key={row.job_id} />) : <p className="wf-empty">No similar active jobs with matching skills found.</p>}{similarTotal > 3 && !showAllSimilar && <button type="button" className="text-button nova-view-similar" onClick={loadAllSimilar}>View all similar ({similarTotal})</button>}</section>
      <EmployerDetails content={descriptionContent} />
    </div><aside className="wf-card wf-overview"><h2>Job Overview</h2><dl>{overview.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{listed(value) ? value : <span className="nova-not-listed">Not listed</span>}</dd></div>)}</dl></aside></div>
    <footer className="nova-detail-footer"><JobSourceInfo job={job} /><button type="button" className="text-button wf-back" onClick={onBack || (() => setPage('jobs'))}>{backLabel}</button></footer>
  </>;
}

export function WireSkillGap(props) { return <SkillGapPage {...props} />; }

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
