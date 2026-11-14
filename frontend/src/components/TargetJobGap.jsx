import { useEffect, useState } from 'react';

export default function TargetJobGap({ token, userId, request, value, onSelectionChange, onComparisonChange, refresh = 0, discipline = '', disabled = false }) {
  const [jobs, setJobs] = useState([]), [listError, setListError] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setListError('');
    (async () => {
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const batch = await request(`/jobs?limit=500&offset=${offset}`, { signal: controller.signal }, token);
        rows.push(...batch);
        if (batch.length < 500) break;
      }
      if (!controller.signal.aborted) setJobs(rows);
    })().catch(error => { if (!controller.signal.aborted) setListError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, request, retry]);
  useEffect(() => {
    if (!value) { onComparisonChange({ key: value, data: null, loading: false, error: '' }); return; }
    const controller = new AbortController();
    onComparisonChange({ key: value, data: null, loading: true, error: '' });
    const query = value === 'market' ? (discipline ? `?discipline=${encodeURIComponent(discipline)}` : '') : `?job_id=${encodeURIComponent(value)}`;
    request(`/students/${userId}/skill-gap${query}`, { signal: controller.signal }, token)
      .then(data => { if (!controller.signal.aborted) onComparisonChange({ key: value, data, loading: false, error: '' }); })
      .catch(error => { if (!controller.signal.aborted) onComparisonChange({ key: value, data: null, loading: false, error: error.message }); });
    return () => controller.abort();
  }, [value, discipline, token, userId, request, onComparisonChange, refresh, retry]);
  const selectedJob = jobs.find(job => String(job.job_id) === value);
  return <section className="sg-target" aria-labelledby="sg-target-heading">
    <div><p className="sg-kicker">01 / CHOOSE YOUR DESTINATION</p><h2 id="sg-target-heading">Target Job</h2></div>
    <label htmlFor="target-job">Compare your skills with<select id="target-job" aria-label="Target Job" value={value} disabled={disabled} onChange={event => onSelectionChange(event.target.value)} aria-describedby="sg-mode-description">
      <option value="">Choose a target job</option><option value="market">Market-wide view — DFW career categories</option>
      {jobs.map(job => <option key={job.job_id} value={String(job.job_id)}>{job.title} — {job.company_name}</option>)}
    </select></label>
    <p id="sg-mode-description">{value === 'market' ? 'Market-wide mode compares your profile with category demand, not a single job.' : selectedJob ? `Selected job: ${selectedJob.title} at ${selectedJob.company_name}. Compares saved profile skills with this job’s requirements.` : 'Choose a specific role, or explicitly switch to the market-wide category view.'}</p>
    {loading && <p role="status" className="sg-loading-line">Loading available jobs…</p>}
    {listError && <p role="alert">Could not load target jobs. {listError} <button type="button" className="wf-secondary" onClick={() => setRetry(n => n + 1)}>Retry target jobs</button></p>}
    {!loading && !listError && !jobs.length && <p>No target jobs are available. The market-wide view is still available.</p>}
  </section>;
}
