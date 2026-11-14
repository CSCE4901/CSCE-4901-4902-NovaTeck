import { profileMatchCount } from './profileMatch';
import { skillDisplayName } from './skillDisplay';

export default function ProfileMatchRing({ match, onProfile, profileError = false }) {
  const ready = match.state === 'ready';
  const noMatch = ready && match.percent === 0;
  const label = ready ? (noMatch ? 'No match' : `${match.percent}% profile skill match. ${match.matched} of ${match.groups.length} requirements fully matched${match.partial ? `, plus ${match.partial} partial at half credit` : ''}.`) :
    match.state === 'empty' ? 'Add profile skills to see your match' : match.state === 'unavailable' ? 'Skills not listed' : profileError ? 'Profile skills unavailable' : 'Loading profile skills';
  const missing = match.missing[0];
  return <div className="lp-job-match">
    <div className={`lp-match-ring${ready ? '' : ' is-neutral'}`} role="img" aria-label={label} style={{ '--lp-ring-progress': ready ? match.percent : 0 }}>
      <svg viewBox="0 0 80 80" aria-hidden="true"><circle className="lp-ring-track" cx="40" cy="40" r="34" /><circle className="lp-ring-fill" cx="40" cy="40" r="34" pathLength="100" /></svg>
      <span aria-hidden="true">{ready && !noMatch ? <>{match.percent}<small>%</small></> : '–'}</span>
    </div>
    <span className="lp-match-label">{ready ? (noMatch ? 'No match' : 'PROFILE MATCH') : match.state === 'empty' ? 'YOUR POTENTIAL' : match.state === 'unavailable' ? 'Skills not listed' : profileError ? 'PROFILE UNAVAILABLE' : 'LOADING PROFILE'}</span>
    {ready ? missing ? <span className="lp-missing-chip" title="First unmatched required-skill group in the job data. Employer priority is not provided.">{missing.status === 'partial' ? 'Build on: ' : 'Focus next: '}{skillDisplayName(missing.skills.join(' / '))}</span> : <span className="lp-match-complete">All listed skills matched</span> :
      (match.state === 'empty' || profileError) && <button type="button" className="lp-profile-link" onClick={onProfile}>{match.state === 'empty' ? 'Add skills in Profile' : 'Open Profile'} <span aria-hidden="true">↗</span></button>}
    {ready && <span className="lp-match-count">{profileMatchCount(match)}</span>}
  </div>;
}
