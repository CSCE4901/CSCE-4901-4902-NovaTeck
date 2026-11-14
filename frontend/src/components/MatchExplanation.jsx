import { useState } from 'react';
import { profileMatch } from './profileMatch';
import { skillDisplayName } from './skillDisplay';

export default function MatchExplanation({ job, maxChips = 4, profileSkills }) {
  const [expandedGroups, setExpandedGroups] = useState({});
  const match = profileMatch(job, profileSkills);
  const outcomes = match.groups;
  const groupName = group => group.skills.join(' / ');
  const missingNames = new Set(outcomes.filter(group => group.status === 'missing').map(groupName));
  const partialNames = new Set(outcomes.filter(group => group.status === 'partial').map(groupName));
  const skills = outcomes.map(groupName);
  const groups = [
    { label: match.state === 'ready' ? 'Matched' : 'Required skills', skills: skills.filter(skill => !missingNames.has(skill.toLowerCase()) && !partialNames.has(skill.toLowerCase())), missing: false },
    { label: 'Partial match', skills: skills.filter(skill => partialNames.has(skill.toLowerCase())), partial: true },
    { label: 'Missing', skills: skills.filter(skill => missingNames.has(skill.toLowerCase())), missing: true },
  ];
  if (!skills.length) return null;
  return <div className={`nova-required-job-skills${groups.filter(group => group.skills.length).length === 1 ? " is-single-group" : ""}`}>
    {groups.map(group => {
      const expanded = Boolean(expandedGroups[group.label]);
      const visible = expanded ? group.skills : group.skills.slice(0, maxChips);
      const overflow = group.skills.length - maxChips;
      if (!group.skills.length) return null;
      return <div className={`nova-skill-group ${group.missing ? 'is-missing-group' : group.partial ? 'is-partial-group' : 'is-matched-group'}`} key={group.label}>
        <span className="nova-skill-group-label">{group.label} ({group.skills.length})</span>
        {visible.length > 0 && <div className="nova-job-skill-chips">{visible.map(skill => <span key={skill.toLowerCase()} className={group.missing ? 'is-missing' : group.partial ? 'is-partial' : undefined} title={group.partial ? 'SQL experience earns 50% credit; SQL Server experience has not been confirmed.' : undefined} aria-label={`${skillDisplayName(skill)}: ${group.label.toLowerCase()}`}>{(group.missing || group.partial || group.label === 'Matched') && <span aria-hidden="true">{group.partial ? '◐ ' : group.missing ? '○ ' : '✓ '}</span>}{skillDisplayName(skill)}</span>)}{overflow > 0 && <button type="button" className="nova-more-skills" aria-expanded={expanded} aria-label={expanded ? `Show fewer ${group.label.toLowerCase()} skills` : `Show ${overflow} more ${group.label.toLowerCase()} skills`} onClick={() => setExpandedGroups(current => ({ ...current, [group.label]: !current[group.label] }))}>{expanded ? 'Show less' : `+${overflow} more`}</button>}</div>}
      </div>;
    })}
  </div>;
}
