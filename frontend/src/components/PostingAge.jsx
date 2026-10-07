export function postingAge(value, now = new Date()) {
  if (!value) return 'Posting date not provided';
  const posted = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(posted.getTime())) return 'Posting date not provided';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((today - posted) / 86400000);
  if (days < 0) return `Posted ${String(value).slice(0, 10)}`;
  if (days === 0) return 'Posted today';
  const [amount, unit] = days >= 365 ? [Math.floor(days / 365), 'year'] : days >= 30 ? [Math.floor(days / 30), 'month'] : days >= 7 ? [Math.floor(days / 7), 'week'] : [days, 'day'];
  return `Posted ${amount} ${unit}${amount === 1 ? '' : 's'} ago`;
}
export default function PostingAge({ date }) {
  return <span className="nova-posted-date" title={date ? `Posted: ${String(date).slice(0, 10)}` : undefined}>{postingAge(date)}</span>;
}
