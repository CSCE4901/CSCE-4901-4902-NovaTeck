import { skillDisplayName } from './skillDisplay';
import { DetailChevron } from './JobDetailsInfo';
import { parseJobDescription } from './jobDescriptionText';

export function JobTextBlocks({ blocks, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`;
  return blocks.map((block,index) => block.type === 'list' ? <ul key={index}>{block.items.map((item,itemIndex) => <li key={itemIndex}>{item}</li>)}</ul> : block.type === 'heading' ? <Heading key={index}>{block.text}</Heading> : <p key={index}>{block.text}</p>);
}
export function DescriptionSections({ sections, hideTitles = false }) {
  return sections.map((section,index) => <div className="nova-job-text-section" key={index}>{!hideTitles && section.title && !/^(?:job )?description$/i.test(section.title) && <h3>{section.title}</h3>}<JobTextBlocks blocks={section.blocks} /></div>);
}
export default function JobDescription({ description, sections = [], content }) {
  const parsed = content || parseJobDescription(description, sections);
  return <>
    <section className="job-description-section" aria-label="Job Description"><h2>Job Description</h2><div className="job-description-content nova-job-prose">{parsed.general.length ? <DescriptionSections sections={parsed.general} /> : <p>{parsed.responsibilities.length ? 'Explore the responsibilities and requirements for this role below.' : 'No job description was provided by the employer.'}</p>}</div></section>
    <section className="job-description-section" aria-label="Responsibilities"><h2>Responsibilities</h2><div className="job-description-content nova-job-prose">{parsed.responsibilities.length ? <DescriptionSections sections={parsed.responsibilities} hideTitles /> : <p className="nova-not-listed">Not provided in this posting.</p>}</div></section>
  </>;
}
function RequirementSections({ sections, title }) {
  return <div className="nova-job-text-section"><h3>{title}</h3>{sections.length ? sections.map((section,index) => <div key={index}>{section.title && section.title.toLowerCase() !== title.toLowerCase() && <h4>{section.title}</h4>}<JobTextBlocks blocks={section.blocks} headingLevel={4} /></div>) : <p className="nova-not-listed">Not provided in this posting.</p>}</div>;
}
export function JobQualifications({ content, preferredSkills = [] }) {
  return <section className="job-description-section nova-job-qualifications" aria-label="What we're looking for"><h2>What we're looking for</h2><div className="nova-job-prose">
    <RequirementSections title="Qualifications" sections={content.qualifications} />
    <div className="nova-job-text-section"><h3>Preferred Skills</h3>{content.preferred.length ? content.preferred.map((section,index) => <div key={index}>{section.title && !/^preferred skills$/i.test(section.title) && <h4>{section.title}</h4>}<JobTextBlocks blocks={section.blocks} headingLevel={4} /></div>) : !preferredSkills.length && <p className="nova-not-listed">Not provided in this posting.</p>}
      {preferredSkills.length > 0 && <div className="wf-tags">{preferredSkills.map(skill => <span key={skill} className="wf-tag">{skillDisplayName(skill)}</span>)}</div>}
    </div>
  </div></section>;
}
export function EmployerDetails({ content }) {
  const sections = [...content.company, ...content.notice];
  if (!sections.length) return null;
  return <div className="nova-employer-details"><details className="nova-employer-group"><summary><h2>About the company</h2><DetailChevron /></summary><div className="nova-job-prose">
    {sections.map((section,index) => {
      const long = section.blocks.reduce((length,block) => length + (block.text?.length || 0) + (block.items || []).join(' ').length,0) > 1000;
      return <details className="nova-company-section" key={index} open={index === 0}><summary><h3>{section.title || 'Company information'}</h3>{long && <span className="nova-company-disclosure"><span className="when-closed">Show more</span><span className="when-open">Show less</span></span>}<DetailChevron /></summary><JobTextBlocks blocks={section.blocks} headingLevel={4} /></details>;
    })}
  </div></details></div>;
}
