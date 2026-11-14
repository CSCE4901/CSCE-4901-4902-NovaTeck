import NavIcon from './NavIcon';

export function JobsSkeleton() {
  return <div className="lp-jobs-loading" role="status"><span className="lp-sr-only">Loading job opportunities…</span><div className="lp-jobs-grid" aria-hidden="true">{[0,1,2,3].map(key => <div className="lp-job-skeleton" key={key}><div className="lp-skeleton-line is-logo" /><div className="lp-skeleton-line is-title" /><div className="lp-skeleton-line" /><div className="lp-skeleton-line is-short" /><div className="lp-skeleton-line is-footer" /></div>)}</div></div>;
}
export function JobsEmpty({ onClear }) {
  return <div className="lp-jobs-state" role="status"><NavIcon name="jobs" /><h2>A different direction might help.</h2><p>No jobs match this search. Try a broader keyword or fewer filters to discover more DFW opportunities.</p><button type="button" className="wf-secondary" onClick={onClear}>Clear search and filters</button></div>;
}
export function JobsError({ message, onRetry }) {
  return <div className="lp-jobs-state is-error" role="alert"><NavIcon name="alerts" /><h2>We couldn’t load these opportunities.</h2><p>{message}</p><button type="button" className="wf-secondary" onClick={onRetry}>Try again</button></div>;
}
