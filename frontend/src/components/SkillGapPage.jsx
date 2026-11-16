import { useEffect, useState } from 'react';
import ResumeSkills, { PendingSkills } from './ResumeSkills';
import { skillDisplayName } from './skillDisplay';
import { skillGapView, learningResources, skillGapReport } from './skillGapModel';
import { careerCategories } from '../careerCategories';
import { SkillReward } from './Celebration';
import './SkillGapPage.css';

export default function SkillGapPage({ auth, request, setPage }) {
  const [category, setCategory] = useState('');
  const [comparison, setComparison] = useState({ key: '', data: null, loading: false, error: '' });
  const own = auth.profileSkills ?? null;
  const [flags, setFlags] = useState([]), [baseError, setBaseError] = useState('');
  const [flagsReady, setFlagsReady] = useState(false), [refresh, setRefresh] = useState(0), [baseRetry, setBaseRetry] = useState(0), [noNewDetected, setNoNewDetected] = useState(false);
  const userPath = `/students/${auth.user_id}`;
  useEffect(() => {
    const controller = new AbortController(); setBaseError(''); setFlagsReady(false);
    Promise.all([request(userPath, { signal: controller.signal }, auth.token), request(`${userPath}/skill-gap`, { signal: controller.signal }, auth.token)])
      .then(([user, summary]) => { if (!controller.signal.aborted) { setFlags(summary.unverified_skills || []); setFlagsReady(true); } })
      .catch(error => { if (!controller.signal.aborted) setBaseError(error.message); });
    return () => controller.abort();
  }, [userPath, auth.token, request, baseRetry]);
  useEffect(() => {
    if (!category) return;
    const controller = new AbortController();
    setComparison({ key: category, data: null, loading: true, error: '' });
    const query = category === 'all' ? '' : `?discipline=${encodeURIComponent(category)}`;
    request(`${userPath}/skill-gap${query}`, { signal: controller.signal }, auth.token)
      .then(data => {
        if (!controller.signal.aborted) setComparison({ key: category, data, loading: false, error: '' });
      })
      .catch(error => {
        if (!controller.signal.aborted) setComparison({ key: category, data: null, loading: false, error: error.message });
      });
    return () => controller.abort();
  }, [category, userPath, auth.token, request, refresh]);
  async function refreshFlags() {
    const summary = await request(`${userPath}/skill-gap`, {}, auth.token);
    setFlags(summary.unverified_skills || []); setFlagsReady(true);
  }
  async function afterScan(result) {
    setNoNewDetected(result.flagged_count === 0 && !result.added_skills?.length);
    if (result.added_skills?.length) {
      const user = await request(userPath, {}, auth.token);
      window.dispatchEvent(new CustomEvent('novateck-profile-skills-saved', {
        detail: { userId: auth.user_id, skills: user.skills },
      }));
    }
    await refreshFlags();
  }
  async function afterReview({ scrollToMatch = true } = {}) {
    await refreshFlags();
    if (scrollToMatch) {
      const user = await request(userPath, {}, auth.token);
      const skills = (user.skills || '').split(',').map(s => s.trim()).filter(Boolean);
      setNoNewDetected(false); setRefresh(value => value + 1);
      window.dispatchEvent(new CustomEvent('novateck-profile-skills-saved', { detail: { userId: auth.user_id, skills } }));
    }
  }
  const mode = 'market';
  const data = comparison.key === category ? comparison.data : null;
  const loading = Boolean(category) && (comparison.key !== category || comparison.loading || own === null && !baseError);
  const view = skillGapView(data, own, mode);
  if (!category) { view.reason = 'Select a career category to see your market match.'; view.prompt = 'Select a category'; }
  const categoryName = careerCategories.find(([id]) => (id || 'all') === category)?.[1];
  const label = category === 'all' ? 'All DFW jobs' : categoryName || 'Choose a comparison';
  const resources = learningResources(data, view.missing);
  function exportReport() {
    const report = skillGapReport({ label, mode, own: own || [], view, flags, resources });
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'novateck-skill-gap.txt'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="wf-page sg-page">
    <header className="sg-header"><p className="sg-kicker">YOUR CAREER LAUNCHPAD</p><h1>Know your next move.</h1><p>Skill Gap Analysis · Find the skills between where you are and where you want to go.</p></header>
    <section className="sg-target" aria-labelledby="sg-market-heading">
      <p className="sg-kicker">01 / CHOOSE YOUR DESTINATION</p>
      <h2 id="sg-market-heading">Skill Comparison</h2>
      <label htmlFor="career-category">Compare your skills with
        <select id="career-category" value={category} onChange={event => {
          setCategory(event.target.value);
          setComparison({ key: '', data: null, loading: true, error: '' });
          setNoNewDetected(false);
        }}>
          <option value="" disabled>Choose a category</option>
          {careerCategories.map(([id, name]) => <option key={id || 'all'} value={id || 'all'}>{id ? name : 'All DFW jobs'}</option>)}
        </select>
      </label>
    </section>
    <ResumeSkills token={auth.token} wireframe onProfile={() => setPage('profile')} onProcessed={afterScan} />
    {baseError && <div className="sg-error" role="alert">Could not load your profile or flagged skills. {baseError} <button type="button" className="wf-secondary" onClick={() => setBaseRetry(n => n + 1)}>Retry profile and flags</button></div>}
    <SkillGapContent own={own} view={view} mode={mode} label={label} loading={loading} error={comparison.error} profileError={baseError} onRetry={() => setRefresh(n => n + 1)} onProfile={() => setPage('profile')} resources={resources} />
    {flagsReady ? <PendingSkills skills={flags} discipline={category} token={auth.token} request={request} onAdded={afterReview} noNewDetected={noNewDetected} extrasTargetId="sg-review-extras" /> : <section className="sg-skeleton" role="status">{baseError ? 'Flagged skills unavailable until the profile request succeeds.' : 'Loading flagged skills…'}</section>}
    <LearningRecommendations resources={resources} loading={loading} error={comparison.error || baseError} hasTarget={Boolean(data)} />
    <div className="sg-export"><button type="button" className="primary-button" disabled={!data || loading || Boolean(comparison.error) || own === null} onClick={exportReport}>Export Report <span aria-hidden="true">↗</span></button></div>
    <section className="sg-extras" aria-labelledby="sg-extras-heading"><p className="sg-kicker">KEEP BUILDING</p><h2 id="sg-extras-heading">Additional tools</h2>
      {view.percent != null && <div className="sg-milestones"><h3>Your milestones</h3><ol>{[25,50,80,100].map(value => <li key={value}><span aria-hidden="true">{view.percent >= value ? '✓' : '○'}</span> {value}% · {view.percent >= value ? 'Reached' : 'Ahead'}</li>)}</ol><SkillReward percent={view.percent} eligible={view.percent === 100 && !view.missing.length && view.required.length >= 3} scope={`market-${category}`} celebrate={false} /></div>}
      {view.missing[0] && <div><h3>A learning plan for your next skill</h3><p>{skillDisplayName(view.missing[0].skill_name)}</p><button type="button" className="wf-secondary" onClick={() => window.dispatchEvent(new CustomEvent('novateck-ask-nova', { detail: { prompt: `Help me build a beginner learning plan for ${view.missing[0].skill_name} for ${label}. Suggest a practice project and how to check my understanding.` } }))}>Ask Nova for a learning plan</button></div>}
      <div id="sg-review-extras" />
    </section>
  </main>;
}

export function SkillGapContent({ own, view, mode, label, loading, error, profileError, onRetry, onProfile }) {
  return <>
    <div className="sg-skills-pair"><section><p className="sg-kicker">03 / YOUR FOUNDATION</p><h2>Your Skills</h2>{own === null ? <p role={profileError ? 'alert' : 'status'}>{profileError ? 'Profile skills unavailable. Retry the profile request above.' : 'Loading profile skills…'}</p> : <SkillChips rows={own.map(skill_name => ({ skill_name }))} empty="No skills saved yet." />}<button type="button" className="text-button" onClick={onProfile}>Update skills in Profile ↗</button></section>
      <section><p className="sg-kicker">THE DESTINATION</p><h2>Required Skills</h2>{loading ? <div className="sg-skeleton" role="status">Loading requirements…</div> : <SkillChips rows={view.required} markMatches empty={error ? 'Requirements unavailable. Retry the comparison below.' : mode === 'market' ? 'Select a career category to see in-demand skills.' : 'Choose a target with listed requirements.'} />}</section></div>
    <div className="sg-match-layout" aria-busy={loading}>
      <section className="sg-match" aria-labelledby="sg-match-heading"><p className="sg-kicker">04 / YOUR TRAJECTORY</p><h2 id="sg-match-heading">{mode === 'market' ? 'Market-wide match' : 'Selected-job match'}</h2>
        {loading ? <div className="sg-donut sg-skeleton" role="status">Loading match…</div> : <MatchDonut percent={error ? null : view.percent} label={mode === 'market' ? 'Market match' : 'Job match'} prompt={view.prompt} />}
        <p className="sg-target-name">{label}</p><p className="sg-muted">{error ? 'Your comparison could not be loaded.' : profileError ? 'Profile skills are unavailable. Retry your profile above.' : view.reason}</p><span className="sg-basis">Based on saved profile skills</span>
      </section>
      <section className="sg-gap"><h2>Skills Gap</h2>{profileError ? <p className="sg-muted">Skills gap unavailable until your profile loads. Use Retry profile and flags above.</p> : error ? <div className="sg-error" role="alert">{error}<button type="button" className="wf-secondary" onClick={onRetry}>Retry comparison</button></div> : loading ? <div className="sg-skeleton" role="status">Loading skills gap…</div> : view.missing.length ? <><p className="sg-muted">{mode === 'market' ? 'Prioritized by demand.' : 'Priority numbers show review order. Employer-assigned priorities are not supplied.'}</p><ol>{view.missing.map((row, index) => <li key={row.skill_name}><span className="sg-priority">{String(index + 1).padStart(2, '0')}</span><div><strong>{skillDisplayName(row.skill_name)}</strong><p>Priority {index + 1}{row.partial ? ' · Partial match' : ''}{row.demand_count != null ? ` · ${row.demand_count} jobs` : ''}</p></div></li>)}</ol></> : <p className="sg-empty">{view.required.length ? 'No missing skills identified for this comparison.' : mode === 'market' ? 'Select a career category to see your skill gaps.' : 'Choose a job to see your skill gaps.'}</p>}</section>
    </div>
  </>;
}
export function SkillChips({ rows, markMatches = false, empty }) {
  return <div className="sg-chips">{rows.length ? rows.map(row => <span key={row.skill_name} className={row.matched ? 'is-matched' : ''}>{markMatches && row.matched && <span aria-hidden="true">✓ </span>}{skillDisplayName(row.skill_name)}{markMatches && <span className="sg-chip-status">{row.matched ? ' · Matched' : row.partial ? ' · Partial' : ' · Missing'}</span>}</span>) : <p className="sg-muted">{empty}</p>}</div>;
}
export function MatchDonut({ percent, label, prompt }) {
  const scored = typeof percent === 'number';
  return <div className={`sg-donut${scored ? '' : ' is-neutral'}`} role="img" aria-live="polite" aria-label={scored ? `${percent}% ${label}` : prompt || `${label} unavailable`} style={{ '--sg-match': scored ? percent : 0 }}><svg viewBox="0 0 200 200" aria-hidden="true"><circle className="sg-donut-track" cx="100" cy="100" r="86" /><circle className="sg-donut-fill" cx="100" cy="100" r="86" pathLength="100" /></svg><div><strong>{scored ? `${percent}%` : '—'}</strong><span>{scored ? label : prompt || 'Not enough data'}</span></div></div>;
}
export function LearningRecommendations({ resources, loading, error, hasTarget }) {
  return <section className="sg-learning" aria-labelledby="sg-learning-heading"><p className="sg-kicker">06 / BUILD WHAT’S NEXT</p><h2 id="sg-learning-heading">Learning Recommendations</h2>{loading ? <div className="sg-skeleton" role="status">Loading learning recommendations…</div> : error ? <p className="sg-muted">Learning recommendations are unavailable until the comparison succeeds.</p> : resources.length ? <>
    <p className="sg-muted">A starting point for every skill in your gap, in the same priority order.</p>
    <div className="sg-resources">{resources.map(row => <article key={row.skill}>
      <div className="sg-resource-top"><span className="sg-resource-priority">GAP {String(row.priority).padStart(2,'0')}</span><span className="sg-resource-type">{row.type || 'Course search'}</span></div>
      <h3>{skillDisplayName(row.skill)}</h3>
      <p className="sg-resource-name">{row.name || 'Find a course for your next step'}</p>
      <p className="sg-resource-provider">{row.provider}</p>
      {row.resourceSkill && row.skill.includes(' / ') && <p className="sg-muted">One option for this skill group: {skillDisplayName(row.resourceSkill)}.</p>}
      {row.demandCount != null && <p className="sg-resource-why"><strong>Why this matters:</strong> Required in {row.demandCount} listed {row.demandCount === 1 ? 'job' : 'jobs'}.</p>}
      <a href={row.url} target="_blank" rel="noopener noreferrer" aria-label={`${row.curated ? `Open ${row.name} for ${skillDisplayName(row.skill)}` : `Search courses for ${skillDisplayName(row.skill)}`} (opens in a new tab)`}>{row.curated ? 'Open resource' : `Search courses for ${skillDisplayName(row.skill)}`} <span aria-hidden="true">↗</span></a>
    </article>)}</div>
  </> : <p className="sg-muted">{hasTarget ? 'No learning resources are needed for the listed gaps. Explore another career category to keep growing.' : 'Select a career category to see learning resources.'}</p>}</section>;
}
