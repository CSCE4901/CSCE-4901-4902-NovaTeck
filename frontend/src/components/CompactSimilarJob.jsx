import CompanyLogo from './CompanyLogo';
import JobLocation from './JobLocation';
import ResumeMatch from './ResumeMatch';
import BookmarkIcon from './BookmarkIcon';

export default function CompactSimilarJob({ job, goJob, saved = false, onSave, busy = false, limitedLabel }) {
  return <article className="nova-similar-row">
    <CompanyLogo job={job} />
    <div className="nova-similar-identity"><h3><button type="button" role="link" className="text-button" title={job.title} onClick={() => goJob(job.job_id)}>{job.title}</button></h3><p>{job.company_name} · <JobLocation location={job.location} jobType={job.work_arrangement || job.job_type} /></p></div>
    <ResumeMatch job={job} compact limitedLabel={limitedLabel} />
    {onSave && <button type="button" className="wf-secondary nova-bookmark-button" disabled={busy} aria-label={`${saved ? 'Unsave job' : 'Save job'}: ${job.title}`} aria-pressed={saved} title={saved ? 'Remove from saved jobs' : 'Save job'} onClick={() => onSave(job)}><BookmarkIcon saved={saved} /></button>}
  </article>;
}
