export default function ResumeMatch({ job, compact = false, limitedLabel }) {
  const pct = job.resume_match_pct;
  const available = typeof pct === 'number';
  const thin = available && job.resume_required_count > 0 && job.resume_required_count < 3;
  const source = job.resume_match_source === 'profile' ? 'profile' : 'resume';
  const label = thin ? limitedLabel || `${job.resume_required_count} skill${job.resume_required_count === 1 ? '' : 's'} listed` : available ? `${pct}%${compact ? '' : ' skill match'}` : job.resume_match_status === 'no_requirements' ? 'Match unavailable' : 'Match loading…';
  const partial = job.resume_partial_count || 0;
  const partialDetail = partial ? `; ${partial} partial match${partial === 1 ? '' : 'es'} at 50% credit (SQL experience toward SQL Server)` : '';
  const detail = available ? `${job.resume_matched_count} of ${job.resume_required_count} extracted skill requirements fully match${partialDetail} using your saved ${source === 'profile' ? 'profile skills' : 'resume'}` : job.resume_match_status === 'no_requirements' ? 'This job has no listed required skills to compare.' : 'Your match will appear when the job comparison is available.';
  return <span className={`nova-resume-match${available && !thin ? pct >= 80 ? ' is-high' : pct >= 50 ? ' is-medium' : ' is-low' : ''}`} title={thin ? `Limited data: ${detail}. Fewer than 3 requirements were extracted; this is not a reliable overall fit score.` : detail}>
    <span aria-hidden="true">{available ? '◎' : '▤'}</span> {label} {available && !thin && !compact && <small>({job.resume_matched_count}/{job.resume_required_count}{partial ? ' + partial' : ''})</small>}
  </span>;
}
