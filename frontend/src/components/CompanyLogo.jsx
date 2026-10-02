import { useState } from 'react';

function websiteIcon(website) {
  try {
    const url = new URL(website);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (['jobs.lever.co', 'job-boards.greenhouse.io', 'boards.greenhouse.io'].includes(url.hostname)) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=128`;
  } catch { return null; }
}

export default function CompanyLogo({ job }) {
  const src = websiteIcon(job.company_website);
  // Remount on company changes so one failed logo cannot hide the next company's image.
  return <LogoImage key={`${job.company_name}:${src}`} name={job.company_name || 'Company'} src={src} />;
}

function LogoImage({ name, src }) {
  const [failed, setFailed] = useState(false);
  const initials = name.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'CO';
  return <span className="company-logo" title={name}>
    {src && !failed ? <img src={src} alt={`${name} logo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span className="company-logo-initials" role="img" aria-label={name}>{initials}</span>}
  </span>;
}
