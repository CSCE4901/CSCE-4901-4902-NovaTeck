import { useId, useState } from 'react';
import { compactLocation, splitLocations } from './jobLocations';
export { compactLocation } from './jobLocations';

export default function JobLocation({ location, jobType }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const label = compactLocation(location).replace(/,\s*(?:Texas|TX)(?:,\s*(?:United States(?: of America)?|USA))?/gi, ', TX').replace(/,\s*(?:United States(?: of America)?|USA)\b/gi, '');
  const multiLocation = splitLocations(location).length > 1;
  const remote = /\bremote\b/i.test(`${location || ''} ${jobType || ''}`) && !/\b(?:not|no)\s+remote\b/i.test(`${location || ''} ${jobType || ''}`);
  const prefix = [remote && 'Remote', multiLocation && 'Multi-location'].filter(Boolean).join(' · ');
  return <span className="nova-location-toggle">
    {prefix && <span className="nova-location-kind">{prefix} · </span>}
    {multiLocation ? <><button type="button" className="text-button" aria-expanded={expanded} aria-controls={listId} title={`Show all locations: ${location}`} onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide locations' : label}</button>{expanded && <span id={listId} className="nova-full-location-list">{location}</span>}</> : <span>{label}</span>}
  </span>;
}
