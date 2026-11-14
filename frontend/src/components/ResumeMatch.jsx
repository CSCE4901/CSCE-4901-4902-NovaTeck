import { profileMatch, profileMatchExplanation, profileMatchCount } from './profileMatch';

// Compatibility name retained; scores always use the shared saved-profile calculation.
export default function ResumeMatch({ job, profileSkills, compact = false }) {
  const match = profileMatch(job, profileSkills);
  const ready = match.state === 'ready';
  const label = ready ? (match.percent === 0 ? 'No match' : `${match.percent}%${compact ? '' : ' skill match'}`) : match.state === 'unavailable' ? 'Skills not listed' : match.state === 'empty' ? 'Add profile skills' : 'Loading profile skills';
  return <span className={`nova-resume-match${ready ? match.percent >= 80 ? ' is-high' : match.percent >= 50 ? ' is-medium' : ' is-low' : ''}`} title={profileMatchExplanation(match)} aria-label={`${label}. ${profileMatchExplanation(match)}`}>
    <span aria-hidden="true">{ready ? '◎' : '–'}</span> {label} {ready && <small>{profileMatchCount(match)}{match.partial ? ' · partial credit included' : ''}</small>}
  </span>;
}
