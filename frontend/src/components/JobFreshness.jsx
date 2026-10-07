export function isJobUnavailable(job, now = new Date()) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return job.is_active === false || job.is_active === 0 || Boolean(job.closing_date && String(job.closing_date).slice(0, 10) < today);
}

export default function JobFreshness({ job }) {
  const unavailable = isJobUnavailable(job);
  if (!unavailable && !job.closing_date) return null;
  return <div className="nova-job-freshness">
    {unavailable && <span className="nova-job-unavailable">No longer available</span>}
    {!unavailable && job.closing_date && <span>Apply by {String(job.closing_date).slice(0, 10)}</span>}
  </div>;
}
