import { useEffect, useRef } from 'react';
import { skillDisplayName } from './skillDisplay';
import { profileSkillOptions } from './profileModel';
import { formatPostedDate } from './jobDescriptionText';

export function ProfileField({ id, label, error, as = 'input', children, ...props }) {
  const Control = as;
  return <div className="lp-profile-field"><label htmlFor={id}>{label}</label><Control id={id} {...props} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-error` : props['aria-describedby']}>{children}</Control>{error && <p id={`${id}-error`} className="lp-profile-field-error" role="alert">{error}</p>}</div>;
}
export function ProfileSection({ sectionLabel, title, subtitle, id, children, action }) {
  return <section className="lp-profile-card" id={id} aria-labelledby={`${id}-heading`} tabIndex={id === 'profile-account-settings' ? -1 : undefined}>
    <header className="lp-profile-card-header"><div><p className="lp-profile-kicker">{sectionLabel}</p><h2 id={`${id}-heading`}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header>{children}
  </section>;
}
export function ProfileHeader({ name, completion }) {
  return <header className="lp-profile-header"><div><p className="lp-profile-kicker">YOUR CAREER LAUNCHPAD</p><h1>{name || 'Your profile'}</h1><p>Bring your experience into focus. Give your next opportunity a starting point.</p></div><div className="lp-profile-completion"><div><span>Profile completion</span><strong>{completion == null ? '—' : `${completion}%`}</strong></div><progress max="100" value={completion ?? 0} aria-label="Saved profile completion" aria-valuetext={completion == null ? 'Saved profile completion unavailable' : `${completion}% complete`} /><p>Based on your saved profile, just like your Dashboard.</p></div></header>;
}
export function ProfileSkills({ skills, proficiency, newSkill, onNewSkill, level, onLevel, onAdd, onRemove, error }) {
  const available = profileSkillOptions.filter(skill => !skills.some(own => own.toLowerCase() === skill));
  return <>
    <p className="lp-profile-help">Your saved profile skills drive match scores on Jobs, Job Details, and Skill Gap. Resume suggestions count only after you add them to your profile.</p>
    <ul className="lp-profile-skills" aria-label="Your Skills">{skills.map(skill => <li key={skill}><span><strong>{skillDisplayName(skill)}</strong><small>{proficiency[skill] || 'Intermediate'}</small></span><button type="button" className="lp-profile-remove-skill" aria-label={`Remove ${skillDisplayName(skill)}`} onClick={() => onRemove(skill)}><span aria-hidden="true">×</span></button></li>)}</ul>
    {!skills.length && <p className="lp-profile-empty">Your skills start here. Add what you know, from coursework to your first role.</p>}
    <div className="lp-profile-skill-add"><ProfileField id="profile-add-skill" label="Add Skill" value={newSkill} onChange={event => onNewSkill(event.target.value)} list="profile-skill-suggestions" maxLength={100} placeholder="Start typing a skill" error={error} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onAdd(); } }} />
      <datalist id="profile-skill-suggestions">{available.map(skill => <option value={skillDisplayName(skill)} key={skill} />)}</datalist>
      <ProfileField id="profile-new-proficiency" label="Proficiency" as="select" value={level} onChange={event => onLevel(event.target.value)}>{['Beginner','Intermediate','Advanced'].map(option => <option key={option}>{option}</option>)}</ProfileField>
      <button type="button" className="primary-button" onClick={onAdd}>Add Skill <span aria-hidden="true">＋</span></button>
    </div>
  </>;
}
export function ProfileEntry({ kind, index, entry, editing, onEdit, onRemove, onChange, errors, onBlur }) {
  const container = useRef(null);
  useEffect(() => { if (editing) container.current?.querySelector('input')?.focus(); }, [editing]);
  const experience = kind === 'experience';
  const fields = experience ? [['company','Company'],['title','Job Title'],['start','Start Date'],['end','End Date'],['description','Description']] : [['title','Project Title'],['technologies','Tools / Skills'],['url','Project Link'],['description','Description']];
  return <article className="lp-profile-entry" ref={container} aria-label={`${experience ? 'Experience' : 'Project'} ${index+1}`}><header><div><p className="lp-profile-kicker">{experience ? 'EXPERIENCE' : 'PROJECT'} {String(index+1).padStart(2,'0')}</p><h3>{entry.title || (experience ? 'New experience' : 'New project')}</h3>{experience && entry.company && <p>{entry.company}</p>}</div><div className="lp-profile-entry-actions"><button type="button" className="wf-secondary" aria-expanded={editing} aria-controls={`${kind}-${index}-fields`} onClick={onEdit}>{editing ? 'Done editing' : 'Edit'}</button><button type="button" className="text-button" aria-label={`Remove ${experience ? 'experience' : 'project'} ${entry.title || index+1}`} onClick={onRemove}>Remove</button></div></header>
    {editing ? <div className="lp-profile-entry-fields" id={`${kind}-${index}-fields`}>{fields.map(([key,label]) => <div key={key} className={key === 'description' ? 'lp-profile-full' : undefined}><ProfileField id={`${kind}-${index}-${key}`} label={label} as={key === 'description' ? 'textarea' : 'input'} required={!experience && key === 'title'} type={key === 'start' || key === 'end' ? 'date' : key === 'url' ? 'url' : undefined} value={entry[key] || ''} onChange={event => onChange(key,event.target.value)} onBlur={() => onBlur(`${kind}-${index}-${key}`)} error={errors[`${kind}-${index}-${key}`]} rows={key === 'description' ? 4 : undefined} maxLength={key === 'description' ? (experience ? undefined : 3000) : key === 'url' ? 1000 : key === 'technologies' ? 500 : key === 'start' || key === 'end' ? undefined : 255} /></div>)}</div> : <div id={`${kind}-${index}-fields`} className="lp-profile-entry-summary">{experience && <p>{formatPostedDate(entry.start) || 'Start date not set'} — {formatPostedDate(entry.end) || 'Present / not set'}</p>}{!experience && entry.technologies && <p>{entry.technologies}</p>}{entry.description && <p>{entry.description}</p>}{!experience && entry.url && <p className="lp-profile-project-url">{entry.url}</p>}</div>}
  </article>;
}
