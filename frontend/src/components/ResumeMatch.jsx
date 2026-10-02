export default function ResumeMatch({ job }) {
  const pct = job.resume_match_pct;
  const available = typeof pct === 'number';
  const source = job.resume_match_source === 'profile' ? 'profile' : 'resume';
  const label = available ? `${pct}% ${source} match` : job.resume_match_status === 'no_requirements' ? 'Match unavailable' : 'Match loading…';
  const detail = available ? `${job.resume_matched_count} of ${job.resume_required_count} required skills match your saved ${source === 'profile' ? 'profile skills' : 'resume'}` : job.resume_match_status === 'no_requirements' ? 'This job has no listed required skills to compare.' : 'Your match will appear when the job comparison is available.';
  return <span className={`nova-resume-match${available ? pct >= 80 ? ' is-high' : pct >= 50 ? ' is-medium' : ' is-low' : ''}`} title={detail}>
    <span aria-hidden="true">{available ? '◎' : '▤'}</span> {label}
  </span>;
}
