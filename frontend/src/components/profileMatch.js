// Only saved profile skills are used here. Resume status/percentage is intentionally ignored.
const normalize = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export function profileMatch(job, profileSkills) {
  const supplied = Array.isArray(job.resume_requirement_groups) ? job.resume_requirement_groups : [];
  const raw = supplied.length ? supplied :
    Array.isArray(job.skills) ? job.skills.filter(skill => skill.requirement_type === 'required').map(skill => ({ skills: [skill.skill_name] })) :
    (job.skill_summary || '').split(',').filter(Boolean).map(skill => ({ skills: [skill] }));
  const seen = new Set();
  const required = raw.map(group => ({
    skills: [...new Set((Array.isArray(group?.skills) ? group.skills : []).map(normalize).filter(Boolean))],
    kind: group?.kind,
  })).filter(({ skills }) => { const key = [...skills].sort().join('\0'); if (!skills.length || seen.has(key)) return false; seen.add(key); return true; });
  const neutral = { percent: null, groups: required, missing: [], matched: 0, partial: 0 };
  if (!required.length) return { ...neutral, state: 'unavailable' };
  if (!Array.isArray(profileSkills)) return { ...neutral, state: 'loading' };
  const owned = new Set(profileSkills.map(normalize).filter(Boolean));
  const groups = required.map(({ skills, kind }) => {
    const matchedSkills = skills.filter(skill => owned.has(skill));
    const status = matchedSkills.length ? (kind === 'examples' ? 'partial' : 'matched') :
      skills.includes('sql server') && owned.has('sql') ? 'partial' : 'missing';
    return { skills, kind, status, matchedSkills };
  });
  const matched = groups.filter(group => group.status === 'matched').length;
  const partial = groups.filter(group => group.status === 'partial').length;
  const state = !owned.size ? 'empty' : 'ready';
  return { state, percent: state !== 'ready' ? null : matched === groups.length ? 100 : Math.min(99, Math.round(100 * (matched + .5 * partial) / groups.length)), groups,
    missing: [...groups.filter(group => group.status === 'missing'), ...groups.filter(group => group.status === 'partial')], matched, partial };
}

// Rank the complete filtered result set before taking any UI page slices.
export function sortJobsByProfileMatch(jobs, profileSkills) {
  return jobs.map((job, index) => ({ job, index, match: profileMatch(job, profileSkills) }))
    .sort((a, b) => {
      const aScored = a.match.state === 'ready';
      const bScored = b.match.state === 'ready';
      if (aScored !== bScored) return aScored ? -1 : 1;
      return (aScored ? b.match.percent - a.match.percent : 0) || a.index - b.index;
    }).map(row => row.job);
}

export function profileMatchExplanation(match) {
  if (match.state === 'unavailable') return 'This posting has no listed required skills to compare.';
  if (match.state === 'empty') return 'Add saved profile skills to compare with this job’s required skill groups.';
  if (match.state !== 'ready') return 'Your saved profile skills are loading.';
  if (!match.matched && !match.partial) return 'None of your saved profile skills match the listed requirements.';
  return `${profileMatchCount(match)} fully matched using saved profile skills${match.partial ? `, plus ${match.partial} partial at half credit` : ''}. Explicit alternatives count as one group. Matching a listed example gives half credit. SQL earns half credit toward SQL Server.`;
}

export function profileMatchCount(match) {
  return `${match.matched} of ${match.groups.length} skills`;
}
