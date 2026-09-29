import { splitJobDescription } from './jobDescriptionSections';

export default function JobDescription({ description }) {
  const decoder = document.createElement('textarea');
  decoder.innerHTML = description || '';
  const sections = splitJobDescription(decoder.value.replace(/\u00a0/g, ' '));
  return <>
    <DescriptionSection title="Job Description" sections={sections.description} empty="No separate job description was provided by the employer." />
    <DescriptionSection title="Responsibilities" sections={sections.responsibilities} empty="The employer has not listed responsibilities separately. See the job description for the full posting." />
  </>;
}

function DescriptionSection({ title, sections, empty }) {
  return <section aria-label={title} className="job-description-section">
    <h2>{title}</h2>
    <div className="wf-card job-description-content">
      {sections.length ? sections.map((section, index) => <div key={index}>
        {section.heading && !/^(job description|responsibilities|job duties(?: and responsibilities)?|what .* do)$/i.test(section.heading) && <h3>{section.heading.replace(/:+$/, '')}</h3>}
        {section.content.split(/\n+/).filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      </div>) : <p className="wf-muted">{empty}</p>}
    </div>
  </section>;
}
