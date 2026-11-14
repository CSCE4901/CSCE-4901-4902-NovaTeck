import CompanyLogo from './CompanyLogo';
import JobLocation from './JobLocation';
import JobFreshness, { isJobUnavailable } from './JobFreshness';
import PostingAge from './PostingAge';
import BookmarkIcon from './BookmarkIcon';
import ProfileMatchRing from './ProfileMatchRing';
import { profileMatch } from './profileMatch';

export default function LaunchpadJobCard({ job, goJob, saved = false, onSave, busy = false, onApply, applicationStatus, profileSkills, profileError, onProfile }) {
  const match = profileMatch(job, profileSkills);
  const open = () => goJob(job.job_id);
  return <article data-job-id={job.job_id} data-required-count={match.groups.length} className="lp-job-card" tabIndex={0} role="link" aria-label={`View details for ${job.title}`} onKeyDown={event => {
    if (event.target === event.currentTarget && event.key === 'Enter') { event.preventDefault(); open(); }
  }} onClick={event => { if (!event.target.closest('a,button,input,select,textarea,summary')) open(); }}>
    <div className="lp-job-main">
      <header className="lp-job-heading"><CompanyLogo job={job} /><div><p className="lp-job-company">{job.company_name}</p><h3><button type="button" onClick={open} title={job.title}>{job.title}</button></h3></div></header>
      <div className="lp-job-location"><JobLocation location={job.location} jobType={job.job_type} />{job.work_arrangement && <span className="lp-job-tag">{job.work_arrangement}</span>}{job.job_type && <span className="lp-job-tag">{job.job_type}</span>}</div>
      <div className="lp-job-compensation"><span className="lp-job-small-label">SALARY</span><strong className={job.salary_range ? undefined : 'is-unlisted'}>{job.salary_range || 'Not listed'}</strong></div>
      <footer className="lp-job-footer"><div className="lp-job-recency"><PostingAge date={job.date_posted} /><JobFreshness job={job} />{applicationStatus && <span role="status">{applicationStatus === 'Opened employer site' ? 'Application page opened' : applicationStatus}</span>}</div>
        {!isJobUnavailable(job) && /^https?:\/\//i.test(job.source_url || '') && <a className="lp-job-apply" aria-label={`Apply for ${job.title} on the employer site`} href={job.source_url} target="_blank" rel="noopener noreferrer" onClick={() => onApply?.(job)}>Apply <span aria-hidden="true">↗</span></a>}
      </footer>
    </div>
    <aside className="lp-job-side"><button type="button" className="lp-job-save" disabled={busy} onClick={() => onSave(job)} aria-label={`${saved ? 'Unsave job' : 'Save job'}: ${job.title}`} aria-pressed={saved}><BookmarkIcon saved={saved} /><span>{saved ? 'Saved' : 'Save'}</span></button><ProfileMatchRing match={match} onProfile={onProfile} profileError={profileError} /></aside>
  </article>;
}
