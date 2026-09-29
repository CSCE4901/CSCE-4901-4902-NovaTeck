// Group job descriptions by heading.
export function splitJobDescription(text = '') {
  const pattern = /(?:^|\s)(Job Description|Job ID|Position Title|Company\/?Employer|Location|Job Duties(?: and Responsibilities)?|(?:Key |Primary )?Responsibilities|What (?:you['’]ll|you will) do|Project Scope\s*&\s*Description|Examples of projects|Required qualifications|Preferred qualifications|Minimum (?:Education\/)?(?:Certifications\/)?Experience Requirements|Requirements|Qualifications|Benefits(?: & Compensation)?|About (?:the )?(?:Company|Role)|Equal Opportunity|Privacy Notice)\s*:+\s*/gi;
  const matches = [...text.matchAll(pattern)];
  const sections = [];
  if (!matches.length) sections.push({ heading: '', content: text.trim() });
  else {
    if (matches[0].index > 0) sections.push({ heading: '', content: text.slice(0, matches[0].index).trim() });
    matches.forEach((match, index) => sections.push({ heading: match[1], content: text.slice(match.index + match[0].length, matches[index + 1]?.index ?? text.length).trim() }));
  }
  const responsibilities = [], description = [];
  for (const section of sections.filter(section => section.content)) {
    (/responsibilit|job duties|what .* do|project scope|examples of projects/i.test(section.heading) ? responsibilities : description).push(section);
  }
  return { description, responsibilities };
}
