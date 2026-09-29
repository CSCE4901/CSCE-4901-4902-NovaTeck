import { useEffect, useState } from 'react';

export default function MarketInsights({ token, userId, goJob }) {
  const [jobs, setJobs] = useState([]);
  const [trends, setTrends] = useState([]);
  const [skill, setSkill] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const read = async path => {
      const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Market insights could not be loaded. Please refresh.');
      return response.json();
    };
    Promise.all([read(`/api/students/${userId}/recommendations`), read('/api/market-trends')])
      .then(([jobs, trends]) => { setJobs(jobs); setTrends(trends); setSkill(trends[0]?.skill_name || ''); })
      .catch(error => setError(error.message));
  }, [token, userId]);
  const rows = trends.filter(row => row.skill_name === skill).sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  const maximum = Math.max(1, ...rows.map(row => row.active_job_count));
  return <section>
    {error && <p role="alert">{error}</p>}
    <h2>Recommended Jobs</h2>
    {jobs.length ? jobs.map(job => <article key={job.job_id} className="target-comparison"><button className="text-button" onClick={() => goJob(job.job_id)}><strong>{job.title}</strong></button><p>{job.company_name} · {job.location} · {job.match_pct}% required skill match</p></article>) : <p>Add your skills to see matching opportunities from active listings.</p>}
    <h2>Market Trends</h2>
    {trends.length ? <><label htmlFor="trend-skill">Skill </label><select id="trend-skill" value={skill} onChange={event => setSkill(event.target.value)}>{[...new Set(trends.map(row => row.skill_name))].sort().map(name => <option key={name}>{name}</option>)}</select>
      <div className="table-scroll"><table><caption>Recorded demand over the last 90 days</caption><thead><tr><th>Date</th><th>Active jobs</th><th>Demand</th><th>Average salary</th></tr></thead><tbody>{rows.map(row => <tr key={row.snapshot_date}><td>{row.snapshot_date}</td><td>{row.active_job_count}</td><td><meter aria-label={`${row.active_job_count} active jobs`} min="0" max={maximum} value={row.active_job_count} /></td><td>{row.avg_salary == null ? 'Not available' : `$${Number(row.avg_salary).toLocaleString()}`}</td></tr>)}</tbody></table></div></> : <p>No historical snapshots yet. Trends appear as scheduled job collections complete.</p>}
  </section>;
}
