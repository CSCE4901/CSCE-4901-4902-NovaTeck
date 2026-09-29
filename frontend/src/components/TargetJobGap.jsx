import { useEffect, useState } from 'react';

export default function TargetJobGap({ token, userId }) {
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState('');
  const [gap, setGap] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/jobs?limit=200', { headers: { Authorization: `Bearer ${token}` } })
      .then(response => { if (!response.ok) throw new Error('Could not load target jobs.'); return response.json(); })
      .then(setJobs).catch(error => setError(error.message));
  }, [token]);
  useEffect(() => {
    if (!selected) { setGap(null); return; }
    const controller = new AbortController(); setGap(null); setError('');
    fetch(`/api/students/${userId}/skill-gap?job_id=${selected}`, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
      .then(response => { if (!response.ok) throw new Error('Could not compare this job.'); return response.json(); })
      .then(setGap).catch(error => { if (error.name !== 'AbortError') setError(error.message); });
    return () => controller.abort();
  }, [selected, token, userId]);
  return <section className="target-comparison">
    <label htmlFor="target-job">Target Job</label>{' '}
    <select id="target-job" value={selected} onChange={event => setSelected(event.target.value)}>
      <option value="">Choose a job to compare</option>
      {jobs.map(job => <option key={job.job_id} value={job.job_id}>{job.title} — {job.company_name}</option>)}
    </select>
    {error && <p role="alert">{error}</p>}
    {gap && <div><h3>Target Job Match: {gap.match_pct}%</h3>
      <progress aria-label="Target job skill match" value={gap.match_pct} max="100" />
      <p><strong>Matched skills:</strong> {gap.matched.join(', ') || 'None'}</p>
      <p><strong>Missing required skills:</strong> {gap.missing.join(', ') || 'None'}</p>
      <p><strong>Preferred skills:</strong> {gap.preferred.join(', ') || 'None listed'}</p>
    </div>}
  </section>;
}
