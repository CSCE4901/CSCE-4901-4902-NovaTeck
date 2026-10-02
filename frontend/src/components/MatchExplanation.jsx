export default function MatchExplanation({ job }) {
  const missing = job.resume_missing_skills;
  if (!Array.isArray(missing) || !missing.length) return null;
  return <div className="nova-missing-job-skills"><span>Missing skills</span><div>{missing.map(skill => <span key={skill}>{skill}</span>)}</div></div>;
}
