export default function BookmarkIcon({ saved = false }) {
  return <svg viewBox="0 0 24 24" width="21" height="21" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4V3Z" /></svg>;
}
