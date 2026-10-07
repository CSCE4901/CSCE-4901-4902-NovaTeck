import { useEffect, useId } from 'react';

export default function JobDescription({ description, sections = [] }) {
  const prefix = `job-section-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  useEffect(() => {
    if (/^#(?::r|job-section-)/.test(window.location.hash)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);
  if (!sections.length) {
    return <section className="job-description-section" aria-label="Job Description">
      <h2>Job Description</h2><div className="wf-card job-description-content">
        {description ? description.split(/\n+/).filter(line => line.trim()).map((line, index) => <p key={index}>{line}</p>)
          : <p>No job description was provided by the employer.</p>}
      </div>
    </section>;
  }
  const isNotice = section => /\b(?:current vacancy|equal opportunity|legal notice|privacy notice|export control compliance)\b/i.test(section.title || '');
  const notices = sections.filter(isNotice);
  const content = sections.filter(section => !isNotice(section));
  const sectionTitle = title => /^what you[’']ll do$|^what you[’']ll be doing(?: in this role)?$/i.test(title || '') ? 'Responsibilities' : title;
  const initiallyOpen = section => /^(?:about (?:the )?role|responsibilities)$/i.test(sectionTitle(section.title) || '');
  const ordered = [...content.filter(initiallyOpen), ...content.filter(section => !initiallyOpen(section))];
  return <div className="job-description-organized" aria-label="Job Description">
    {ordered.map((section, index) => <details key={`${prefix}-${index}`} open={initiallyOpen(section)} className="job-description-accordion">
      <summary>{sectionTitle(section.title) || 'Job Description'}</summary>
      <div className="job-description-content job-html" dangerouslySetInnerHTML={{ __html: section.html }} />
    </details>)}
    {notices.length > 0 && <details className="job-description-accordion job-description-notices"><summary>Employer notices</summary>{notices.map((section, index) => <aside className="job-description-notice" key={index}><p>{section.title}</p><div className="job-html" dangerouslySetInnerHTML={{ __html: section.html }} /></aside>)}</details>}
  </div>;
}
