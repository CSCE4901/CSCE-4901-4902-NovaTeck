import { useEffect, useRef, useState } from 'react';
import ResumeSkills from './ResumeSkills';
import { collegeMajors } from '../careerCategories';
import { ProfileField, ProfileSection, ProfileHeader, ProfileSkills, ProfileEntry } from './ProfileParts';
import { emptyExperience, emptyProject, emptyProfileDetails, profileCompletion, profileSnapshot, profileValidation } from './profileModel';
import useProfileLeaveGuard from './useProfileLeaveGuard';
import './ProfilePage.css';

const salaryRanges = ['No preference', 'Under $40,000 / year', '$40,000–$59,999 / year', '$60,000–$79,999 / year', '$80,000–$99,999 / year', '$100,000–$119,999 / year', '$120,000+ / year'];
const initials = name => name.trim().split(/\s+/).filter(Boolean).filter((_,i,names) => i === 0 || i === names.length-1).map(part => part[0]).join('').toUpperCase() || '?';
export default function ProfilePage({ auth, request, onNameChange, setPage, focusField }) {
  const photoInput = useRef(null), form = useRef(null);
  const [profile,setProfile] = useState({name:'',email:''}), [details,setDetails] = useState(emptyProfileDetails), [skills,setSkills] = useState([]);
  const [baseline,setBaseline] = useState(''), [loading,setLoading] = useState(true), [loadError,setLoadError] = useState(''), [retry,setRetry] = useState(0);
  const [busy,setBusy] = useState(false), [uploadBusy,setUploadBusy] = useState(false), [message,setMessage] = useState(''), [saveError,setSaveError] = useState('');
  const [photoError,setPhotoError] = useState(''), [editingEmail,setEditingEmail] = useState(false);
  const [newSkill,setNewSkill] = useState(''), [level,setLevel] = useState('Intermediate'), [skillError,setSkillError] = useState('');
  const [touched,setTouched] = useState({}), [submitted,setSubmitted] = useState(false), [editing,setEditing] = useState({experience:[],project:[]});
  const [resumeState,setResumeState] = useState({ready:false,resume:null,error:''});
  useEffect(() => {
    let active = true; setLoading(true); setLoadError('');
    Promise.all([request(`/students/${auth.user_id}`,{},auth.token),request(`/students/${auth.user_id}/profile-details`,{},auth.token)])
      .then(([user,extra]) => { if (!active) return; const personal={name:user.name || '',email:user.email || ''}; const savedSkills=(user.skills || '').split(',').map(s=>s.trim()).filter(Boolean); const savedDetails={...emptyProfileDetails,...extra,projects:Array.isArray(extra.projects)?extra.projects:[],work_types:Array.isArray(extra.work_types)?extra.work_types:[],experience:(extra.experience || []).filter(entry=>Object.values(entry).some(Boolean))}; setProfile(personal);setSkills(savedSkills);setDetails(savedDetails);setBaseline(profileSnapshot(personal,savedDetails,savedSkills)); })
      .catch(error=>{if(active)setLoadError(error.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[auth.user_id,auth.token,retry]);
  useEffect(()=>{if(!loading&&focusField==='location'){const field=document.getElementById('profile-location');field?.focus({preventScroll:true});field?.scrollIntoView({block:'center'});}},[loading,focusField]);
  const dirty = Boolean(baseline && (profileSnapshot(profile,details,skills)!==baseline || newSkill.trim()));
  const leaveDialog = useProfileLeaveGuard(dirty || busy || uploadBusy);
  useEffect(()=>{if(dirty)setMessage('');},[dirty]);
  const allErrors = profileValidation(profile,details);
  const errors = Object.fromEntries(Object.entries(allErrors).filter(([key])=>submitted||touched[key]));
  const mark = key => setTouched(current=>({...current,[key]:true}));
  const change = (key,value) => {setDetails(current=>({...current,[key]:value}));setMessage('');};
  const saved = baseline ? JSON.parse(baseline) : null;
  function resumeProcessed({ added_skills: added = [] }) {
    if (!added.length) return;
    const appendSkills = current => [...current, ...added.filter(skill =>
      !current.some(existing => existing.trim().toLowerCase() === skill.trim().toLowerCase()))];
    setSkills(appendSkills);
    setBaseline(current => {
      const snapshot = JSON.parse(current);
      return profileSnapshot(snapshot.profile, snapshot.details, appendSkills(snapshot.skills));
    });
    window.dispatchEvent(new CustomEvent('novateck-profile-skills-saved', {
      detail: { userId: auth.user_id, skills: appendSkills(saved.skills) },
    }));
  }
  const completion = saved && resumeState.ready && !resumeState.error ? profileCompletion({...saved.profile,skills:saved.skills.join(',')},saved.details,resumeState.resume) : null;
  function focusInvalid() {requestAnimationFrame(()=>form.current?.querySelector('[aria-invalid="true"]')?.focus());}
  function addSkill(){const value=newSkill.trim();if(!value){setSkillError('Enter a skill to add.');return;}if(skills.some(skill=>skill.toLowerCase()===value.toLowerCase())){setSkillError('That skill is already in your profile.');return;}setSkills(current=>[...current,value]);change('proficiency',{...details.proficiency,[value]:level});setNewSkill('');setSkillError('');document.getElementById('profile-add-skill')?.focus();}
  async function photo(event){const file=event.target.files?.[0];if(!file)return;if(!['image/png','image/jpeg'].includes(file.type)||file.size>500000){setPhotoError('Choose a PNG or JPEG under 500 KB.');event.target.value='';return;}setPhotoError('');const reader=new FileReader();reader.onload=()=>change('photo',reader.result);reader.onerror=()=>{setPhotoError('Could not read this photo. Try another image.');if(photoInput.current)photoInput.current.value='';};reader.readAsDataURL(file);}
  async function save(event){
    event.preventDefault();setSubmitted(true);setSaveError('');setMessage('');
    if(newSkill.trim()){setSkillError('Choose Add Skill to include this skill, or clear the input before saving.');document.getElementById('profile-add-skill')?.focus();return;}
    if(Object.keys(allErrors).length){setEditing(current=>({...current,experience:[...new Set([...current.experience,...Object.keys(allErrors).filter(key=>key.startsWith('experience-')).map(key=>Number(key.split('-')[1]))])],project:[...new Set([...current.project,...Object.keys(allErrors).filter(key=>key.startsWith('project-')).map(key=>Number(key.split('-')[1]))])]}));focusInvalid();return;}
    setBusy(true);
    const snapshot=profileSnapshot(profile,details,skills);
    try{const result=await request(`/students/${auth.user_id}/profile-details`,{method:'PUT',body:JSON.stringify({...profile,details})},auth.token);onNameChange(result.name);await request(`/students/${auth.user_id}/skills`,{method:'PUT',body:JSON.stringify({skills})},auth.token);setBaseline(snapshot);setEditingEmail(false);setSubmitted(false);setMessage('Your profile and skills have been saved.');}
    catch(error){setSaveError(error.message);}finally{setBusy(false);}
  }
  function discard(){if(!saved)return;setProfile(saved.profile);setDetails(saved.details);setSkills(saved.skills);setNewSkill('');setSkillError('');setPhotoError('');setSaveError('');setSubmitted(false);setTouched({});setEditing({experience:[],project:[]});setMessage('Unsaved edits discarded. Your saved resume is unchanged.');}
  function updateEntry(kind,index,key,value){const field=kind==='experience'?'experience':'projects';change(field,details[field].map((entry,i)=>i===index?{...entry,[key]:value}:entry));}
  function editEntry(kind,index){const invalid=Object.keys(allErrors).filter(key=>key.startsWith(`${kind}-${index}-`));if(editing[kind].includes(index)&&invalid.length){setTouched(current=>({...current,...Object.fromEntries(invalid.map(key=>[key,true]))}));focusInvalid();return;}setEditing(current=>({...current,[kind]:current[kind].includes(index)?current[kind].filter(i=>i!==index):[...current[kind],index]}));}
  function removeEntry(kind,index){const field=kind==='experience'?'experience':'projects';change(field,details[field].filter((_,i)=>i!==index));setEditing(current=>({...current,[kind]:current[kind].filter(i=>i!==index).map(i=>i>index?i-1:i)}));setTouched({});}
  function addEntry(kind){const field=kind==='experience'?'experience':'projects';change(field,[...details[field],kind==='experience'?emptyExperience():emptyProject()]);setEditing(current=>({...current,[kind]:[...current[kind],details[field].length]}));}
  function accountLink(event){event.preventDefault();const section=document.getElementById('profile-account-settings');section?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});section?.focus({preventScroll:true});}
  return <main className="wf-page wf-profile lp-profile"><ProfileHeader name={profile.name || auth.name} completion={completion}/>{leaveDialog}
    {loading ? <div className="lp-profile-loading" role="status">Loading your saved profile…<div/><div/><div/></div> : loadError ? <div className="lp-profile-feedback is-error" role="alert">Could not load your profile. {loadError}<button type="button" className="wf-secondary" onClick={()=>setRetry(n=>n+1)}>Retry profile</button></div> : <form ref={form} noValidate onSubmit={save}>
      <fieldset className="lp-profile-form-fields" disabled={busy}><legend className="lp-profile-sr-only">Profile information</legend>
        <ProfileSection number="01" id="profile-personal" title="Photo and Personal Information" subtitle="A familiar face. A clear introduction.">
          <div className="lp-profile-photo"><button type="button" className="lp-profile-avatar" aria-label={details.photo?'Change profile photo':'Add profile photo'} onClick={()=>photoInput.current?.click()}>{details.photo?<img src={details.photo} alt="Your profile"/>:<span aria-hidden="true">{initials(profile.name)}</span>}<span className="lp-profile-avatar-edit" aria-hidden="true">＋</span></button><div><strong>Profile photo</strong><p>PNG or JPEG, under 500 KB</p><div className="lp-profile-photo-actions"><button type="button" className="text-button" onClick={()=>photoInput.current?.click()}>Upload new photo</button>{details.photo&&<button type="button" className="text-button" onClick={()=>{change('photo','');setPhotoError('');if(photoInput.current)photoInput.current.value='';}}>Remove Photo</button>}</div></div><input ref={photoInput} hidden type="file" accept="image/png,image/jpeg" aria-label="Choose profile photo" onChange={photo}/></div>{photoError&&<p className="lp-profile-field-error" role="alert">{photoError}</p>}
          <div className="lp-profile-fields"><ProfileField id="profile-name" label="Full Name" required autoComplete="name" maxLength={255} value={profile.name} onChange={e=>setProfile(p=>({...p,name:e.target.value}))} onBlur={()=>mark('name')} error={errors.name}/><div><ProfileField id="profile-email" label="Email Address" required type="email" autoComplete="email" value={profile.email} readOnly={!editingEmail} onChange={e=>setProfile(p=>({...p,email:e.target.value}))} onBlur={()=>mark('email')} error={errors.email}/>{editingEmail?<p className="lp-profile-help">Save Changes to update your sign-in email.</p>:<button type="button" className="text-button lp-profile-change-email" onClick={()=>{setEditingEmail(true);document.getElementById('profile-email')?.focus();}}>Change email</button>}</div><ProfileField id="profile-phone" label="Phone Number" type="tel" autoComplete="tel" maxLength={50} value={details.phone} onChange={e=>change('phone',e.target.value)} onBlur={()=>mark('phone')} error={errors.phone}/><ProfileField id="profile-location" label="Location" autoComplete="address-level2" maxLength={255} value={details.location} onChange={e=>change('location',e.target.value)} /></div>
        </ProfileSection>
        <ProfileSection number="02" id="profile-skills" title="Skills" subtitle="Make what you know easy to discover."><ProfileSkills skills={skills} proficiency={details.proficiency||{}} newSkill={newSkill} onNewSkill={value=>{setNewSkill(value);setSkillError('');}} level={level} onLevel={setLevel} onAdd={addSkill} onRemove={skill=>setSkills(current=>current.filter(value=>value!==skill))} error={skillError}/></ProfileSection>
        <ProfileSection number="03" id="profile-resume" title="Resume" subtitle="Your experience, ready for its next chapter."><ResumeSkills token={auth.token} profileUpload onSavedState={setResumeState} onUploadBusyChange={setUploadBusy} onProcessed={resumeProcessed}/><p className="lp-profile-help">Resume uploads save immediately. Use Save Changes for your other profile edits.</p></ProfileSection>
        <ProfileSection number="04" id="profile-experience" title="Experience" subtitle="Every role adds to your story." action={<button type="button" className="wf-secondary" onClick={()=>addEntry('experience')}>＋ Add Experience</button>}>{details.experience.length?details.experience.map((entry,index)=><ProfileEntry kind="experience" key={index} index={index} entry={entry} editing={editing.experience.includes(index)} onEdit={()=>editEntry('experience',index)} onRemove={()=>removeEntry('experience',index)} onChange={(key,value)=>updateEntry('experience',index,key,value)} errors={errors} onBlur={mark}/>):<p className="lp-profile-empty">No experience added yet. Start with a job, internship, volunteer role, or campus position.</p>}</ProfileSection>
        <ProfileSection number="05" id="profile-projects" title="Projects" subtitle="Showcase coursework, personal projects, and team projects." action={<button type="button" className="wf-secondary" disabled={details.projects.length>=20} onClick={()=>addEntry('project')}>＋ Add Project</button>}>{details.projects.length?details.projects.map((entry,index)=><ProfileEntry kind="project" key={index} index={index} entry={entry} editing={editing.project.includes(index)} onEdit={()=>editEntry('project',index)} onRemove={()=>removeEntry('project',index)} onChange={(key,value)=>updateEntry('project',index,key,value)} errors={errors} onBlur={mark}/>):<p className="lp-profile-empty">No projects yet. Share something you built or helped bring to life.</p>}<p className="lp-profile-help">Up to 20 projects. Descriptions: up to 3,000 characters.</p></ProfileSection>
        <ProfileSection number="06" id="profile-preferences" title="Job Preferences" subtitle="Point your search in the right direction."><div className="lp-profile-fields"><ProfileField id="profile-major" label="College Major" as="select" value={details.college_major||''} onChange={e=>setDetails(current=>({...current,college_major:e.target.value,career_focus:collegeMajors.find(([major])=>major===e.target.value)?.[1]||''}))}><option value="">Select your major</option>{collegeMajors.map(([major])=><option key={major}>{major}</option>)}</ProfileField><ProfileField id="profile-salary" label="Salary Range" as="select" value={details.salary_range} onChange={e=>change('salary_range',e.target.value)}><option value="">Select salary preference</option>{details.salary_range&&!salaryRanges.includes(details.salary_range)&&<option>{details.salary_range}</option>}{salaryRanges.map(range=><option key={range}>{range}</option>)}</ProfileField><ProfileField id="profile-preferred-location" label="Preferred Location" maxLength={255} value={details.preferred_location} onChange={e=>change('preferred_location',e.target.value)}/><fieldset className="lp-profile-work-types"><legend>Work Type</legend>{['Full-time','Part-time','Contract','Internship'].map(type=><label key={type}><input type="checkbox" checked={details.work_types.includes(type)} onChange={e=>change('work_types',e.target.checked?[...details.work_types,type]:details.work_types.filter(value=>value!==type))}/>{type}</label>)}</fieldset></div></ProfileSection>
        <div className={`lp-profile-savebar${dirty?' is-dirty':''}`}><div aria-live="polite"><strong>{busy?'Saving your changes…':uploadBusy?'Saving your resume…':dirty?'You have unsaved changes':'Your profile is up to date'}</strong><p>Profile edits save together. Resume uploads save separately.</p></div><div className="lp-profile-save-actions">{dirty&&<button type="button" className="wf-secondary" onClick={discard} disabled={busy||uploadBusy}>Discard Changes</button>}<button className="primary-button" type="submit" disabled={busy||uploadBusy||!dirty}>{busy?'Saving…':'Save Changes'}</button></div></div>
        {saveError&&<p className="lp-profile-feedback is-error" role="alert">Could not save your profile. {saveError} Your edits are still here.</p>}{message&&<p className="lp-profile-feedback" role="status">{message}</p>}
        <a className="text-button lp-profile-account-link" href="#profile-account-settings" onClick={accountLink}>Account Settings ↓</a>
        <ProfileSection number="07" id="profile-account-settings" title="Account Settings" subtitle="Keep your account secure and get help when you need it."><div className="lp-profile-account-actions"><button type="button" className="wf-secondary" data-profile-leave onClick={()=>setPage('forgot')}>Reset Password</button><button type="button" className="wf-secondary" onClick={()=>window.dispatchEvent(new Event('novateck-contact-support'))}>Contact Support</button></div></ProfileSection>
      </fieldset>
    </form>}
  </main>;
}
