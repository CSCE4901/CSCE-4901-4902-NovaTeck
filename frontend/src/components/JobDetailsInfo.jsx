import { profileMatchExplanation } from './profileMatch';
import { formatPostedDate } from './jobDescriptionText';
import { skillDisplayName } from './skillDisplay';

export function DetailChevron() { return <svg className="nova-detail-chevron" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>; }
export function JobMatchInfo({ match }) {
  const matchedSkills = [...new Set(match.groups.filter(group => group.status === 'matched').flatMap(group => group.matchedSkills))];
  const matchedExamples = [...new Set(match.groups.filter(group => group.kind === 'examples').flatMap(group => group.matchedSkills || []))];
  const partialSql = match.groups.some(group => group.status === 'partial' && !group.matchedSkills?.length);
  return <>
    {match.state === 'ready' && match.percent > 0 && <div className="nova-matched-skills">
      <h3>Matched skills</h3>
      {matchedSkills.length ? <ul className="wf-tags" role="list">
        {matchedSkills.map(skill => <li key={skill} className="wf-tag">{skillDisplayName(skill)}</li>)}
      </ul> : <p>No full matches.</p>}
      {matchedExamples.length > 0 && <p>Matched examples (half credit) · {matchedExamples.map(skillDisplayName).join(', ')}</p>}
      {partialSql && <p>Partial match · SQL counts toward SQL Server.</p>}
    </div>}
    <div className="nova-match-info"><span>Based on saved profile skills.</span><details><summary>How it’s calculated <DetailChevron /></summary><div><p>{profileMatchExplanation(match)}</p><p>Fully matched groups earn one point. Partial matches earn half a point. Divide the points by all required groups to get the percentage.</p></div></details></div>
  </>;
}
export function JobSkillEvidence({ evidence }) {
  const entries = Object.entries(evidence || {});
  if (!entries.length) return null;
  const excerpts = new Map();
  for (const [skill, excerpt] of entries) {
    if (!excerpts.has(excerpt)) excerpts.set(excerpt, []);
    excerpts.get(excerpt).push(skillDisplayName(skill));
  }
  return <details className="nova-source-info">
    <summary>See skills in the employer’s wording <DetailChevron /></summary>
    <dl>{[...excerpts].map(([excerpt, skills]) => <div key={excerpt}>
      <dt>{skills.join(', ')}</dt><dd>{excerpt}</dd>
    </div>)}</dl>
  </details>;
}
export function JobSourceInfo({ job }) {
  const url = /^https?:\/\//i.test(job.source_url || '') ? job.source_url : null;
  let source = job.source_provider;
  if (!source && url) { try { source = new URL(url).hostname.replace(/^www\./,''); } catch { /* Keep missing source explicit. */ } }
  const readable = value => formatPostedDate(value) || 'Not listed';
  return <details className="nova-source-info"><summary><span>Source: {source || 'Not listed'}, posted {readable(job.date_posted)}</span><DetailChevron /></summary><div className="nova-source-metadata">
    {job.closing_date && <p>Application deadline: {readable(job.closing_date)}</p>}
    <p>HTTP status (source feed): {job.source_http_status ?? 'Not recorded'}</p><p>Fetched: {readable(job.date_crawled)}</p><p>Last verified: {readable(job.last_seen_at)}</p>
    {url && <a href={url} target="_blank" rel="noopener noreferrer">Original posting ↗</a>}
  </div></details>;
}
