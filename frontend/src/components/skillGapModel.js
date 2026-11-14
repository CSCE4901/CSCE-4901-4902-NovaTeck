import { findLearningResource } from './learningResources.js';
import { profileMatch, profileMatchExplanation } from './profileMatch.js';

const normalize = value => String(value ?? '').trim().toLowerCase();
export function skillGapView(data, own, mode) {
  if (!data || !Array.isArray(own)) return { required: [], missing: [], percent: null, reason: 'Choose a target job or the market-wide view.' };
  const market = mode === 'market';
  const marketRows = [...(data.matched_skills || []), ...(data.missing_skills || [])];
  const target = market ? { skills: marketRows.map(row => ({ ...row, requirement_type: 'required' })) } : data;
  const match = profileMatch(target, own);
  const required = match.groups.map(group => ({
    ...(market ? marketRows.find(row => normalize(row.skill_name) === group.skills[0]) : {}),
    skill_name: group.skills.join(' / '), matched: group.status === 'matched', partial: group.status === 'partial'
  }));
  const total = market ? data.requested_skill_count ?? required.length : required.length;
  const percent = market
    ? (Number.isFinite(data.overall_match_pct) ? Math.max(0, Math.min(100, data.overall_match_pct)) : null)
    : match.percent ?? (required.length ? Math.round(100 * (match.matched + .5 * match.partial) / required.length) : null);
  return { required, missing: required.filter(row => !row.matched), percent,
    matched: match.matched, total,
    reason: market
      ? 'Market match uses saved profile skills and demand across all required market skills. The list shows matched skills and the top 10 missing skills.'
      : required.length
        ? `Based on saved profile skills: ${match.matched} of ${required.length} required skill groups fully matched. Partial matches, including listed examples, earn half credit. Explicit alternatives count as one group.`
        : profileMatchExplanation(match) };

}
export function learningResources(_data, missing) {
  // Keep exactly the gap-list order, including skills beyond the former four-card limit.
  return missing.map((skill,index) => {
    const resource = findLearningResource(skill.skill_name);
    const demandCount = Number.isInteger(skill.demand_count) && skill.demand_count >= 0 ? skill.demand_count : null;
    return { skill: skill.skill_name, priority: index + 1, name: resource?.name || null,
      type: resource?.type || null, provider: resource?.provider || 'Coursera', resourceSkill: resource?.skill || null,
      curated: Boolean(resource), demandCount,
      url: resource?.url || `https://www.coursera.org/search?query=${encodeURIComponent(skill.skill_name)}` };
  });
}
export function skillGapReport({ label, mode, own, view, flags, resources }) {
  return `NovaTeck Skill Gap Report\nTarget: ${label}\nMode: ${mode === 'market' ? 'Market-wide category' : 'Selected job'}\nBasis: Saved profile skills\nMatch: ${view.percent == null ? 'Unavailable' : view.percent + '%'}\n${view.reason}\nYour skills: ${own.join(', ')}\nRequired skills: ${view.required.map(row => `${row.skill_name}${row.matched ? ' (matched)' : row.partial ? ' (partial)' : ''}`).join(', ')}\nSkills gap:\n${view.missing.map((row, index) => `${index + 1}. ${row.skill_name} (${mode === 'market' ? 'demand order' : 'review order; employer priority not supplied'})`).join('\n')}\nFlagged skills: ${flags.map(row => row.skill_name).join(', ')}\nLearning resources:\n${resources.map(row => `${row.skill}: ${row.name || 'Course search (not a curated resource)'} | ${row.type || 'Search'} | ${row.provider} | ${row.url}`).join('\n')}`;
}
