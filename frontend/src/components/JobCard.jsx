import CompanyLogo from './CompanyLogo';
import JobLocation from './JobLocation';
import ResumeMatch from './ResumeMatch';
import MatchExplanation from './MatchExplanation';
import JobFreshness, { isJobUnavailable } from './JobFreshness';
import PostingAge from './PostingAge';
import BookmarkIcon from './BookmarkIcon';

export default function JobCard({ job, goJob, saved = false, onSave, busy = false, onHide, onApply, applicationStatus, children, compact = false }) {
  const perfect = job.resume_match_pct === 100 && job.resume_required_count > 0 && !(job.resume_partial_count > 0);
  return <article className="nova-modern-job" tabIndex={0} role="link" aria-label={`View details for ${job.title}`} onKeyDown={event => {
    if (event.target === event.currentTarget && event.key === 'Enter') { event.preventDefault(); goJob(job.job_id); }
  }} onClick={event => {
    if (!event.target.closest('a,button,input,select,textarea,summary')) goJob(job.job_id);
  }}>
    <header className="nova-job-card-header">
      <CompanyLogo job={job} />
      <div className="nova-job-card-identity">
        <h3><button type="button" className="text-button wf-job-title" title={job.title} onClick={() => goJob(job.job_id)}>{job.title}</button></h3>
        <p>{job.company_name} · <JobLocation location={job.location} jobType={job.job_type} /></p>
        {perfect && <p className="nova-perfect-match">All {job.resume_required_count} extracted skill requirements matched</p>}
      </div>
      <div className="nova-job-card-aside"><ResumeMatch job={job} />
      {(onSave || onHide) && <div className="nova-job-card-actions">
        {onSave && <button type="button" className="wf-secondary nova-bookmark-button" disabled={busy} onClick={() => onSave(job)} aria-label={`${saved ? 'Unsave job' : 'Save job'}: ${job.title}`} aria-pressed={saved} title={saved ? 'Remove from saved jobs' : 'Save job'}><BookmarkIcon saved={saved} /></button>}
        {onHide && <button type="button" className="text-button nova-hide-job" disabled={busy} onClick={() => onHide(job)} aria-label={`Hide ${job.title} from recommendations`}>Hide</button>}
      </div>}
      </div>
    </header>
    <MatchExplanation job={job} maxChips={compact ? 2 : 4} />
    <footer className="nova-modern-job-footer">
      <div className="nova-job-metadata">
        {job.salary_range ? <span className="nova-job-salary">Salary: {job.salary_range}</span> : <span className="nova-salary-unlisted">Salary not listed</span>}
        <PostingAge date={job.date_posted} /><JobFreshness job={job} />
        {applicationStatus && <span className="nova-application-card-status" role="status">{applicationStatus === 'Opened employer site' ? 'Application page opened' : applicationStatus}</span>}
      </div>
      {!isJobUnavailable(job) && /^https?:\/\//i.test(job.source_url || '') && <a className="primary-button nova-apply-button" aria-label={`Apply for ${job.title} on the employer site`} href={job.source_url} target="_blank" rel="noopener noreferrer" onClick={() => onApply?.(job)}>Apply</a>}
      {children}
    </footer>
  </article>;
}
