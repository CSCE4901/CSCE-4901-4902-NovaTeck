import CompanyLogo from './CompanyLogo';
import JobLocation from './JobLocation';
import ResumeMatch from './ResumeMatch';
import BookmarkIcon from './BookmarkIcon';

export default function CompactSimilarJob({ job, goJob, saved = false, onSave, busy = false, showRemove = false, limitedLabel, profileSkills }) {
  return <article className="nova-similar-row">
    <CompanyLogo job={job} />
    <div className="nova-similar-identity"><h3><button type="button" role="link" className="text-button" title={job.title} onClick={() => goJob(job.job_id)}>{job.title}</button></h3><p>{job.company_name} · <JobLocation location={job.location} jobType={job.work_arrangement || job.job_type} /></p></div>
    <ResumeMatch job={job} profileSkills={profileSkills} compact limitedLabel={limitedLabel} />
    {onSave && <button type="button" className={`wf-secondary nova-bookmark-button${showRemove && saved ? ' nova-saved-remove' : ''}`} disabled={busy} aria-label={`${showRemove && saved ? 'Remove saved job' : saved ? 'Unsave job' : 'Save job'}: ${job.title}`} aria-pressed={saved} title={saved ? 'Remove from saved jobs' : 'Save job'} onClick={() => onSave(job)}>{showRemove && saved ? 'Remove' : <BookmarkIcon saved={saved} />}</button>}
  </article>;
}
