import NavIcon from './NavIcon';
import JobCard from './JobCard';
import { useEffect, useState } from 'react';

export default function HomePage({ setPage, auth, request, goJob, browseField }) {
  const [content,setContent]=useState(null), [error,setError]=useState('');
  useEffect(()=>{let active=true;request('/home',{},auth.token).then(data=>active&&setContent(data)).catch(error=>active&&setError(error.message));return()=>{active=false;};},[auth.token,request]);
  const steps = [
    { page: 'profile', icon: 'profile', title: 'Build your profile', description: 'Add your interests, experience, and skills so NovaTeck can help you find relevant opportunities.', label: 'Set Up Profile' },
    { page: 'profile', icon: 'upload', title: 'Upload your resume', description: 'Have a resume ready? Upload it to discover skills you can add to your profile.', label: 'Add Resume' },
    { page: 'skillgap', icon: 'match', title: 'Discover your matches', description: 'Once you’ve added your skills, compare them with job requirements and see what to learn next.', label: 'Explore Skill Gap' },
  ];
  return <main className="wf-page home-page">
    <header className="home-intro">
      <p className="home-eyebrow">FOR DFW STUDENTS AND NEW GRADS</p>
      <h1>Find your first tech role in DFW.</h1>
      <p className="home-description">See real internships and entry-level jobs, and learn exactly which skills to build next.</p>
      <div className="home-hero-actions"><button className="primary-button" onClick={() => setPage('jobs')}>Browse Jobs</button><button className="wf-secondary" onClick={() => setPage('profile')}>Build your profile</button></div>
      <p className="home-start-note">Start exploring now. Add your profile and resume whenever you’re ready.</p>
    </header>
    <section className="home-stats" aria-label="Live DFW job statistics">{error ? <p role="alert">{error}</p> : [['jobs','DFW jobs'],['companies','Companies hiring'],['internships','Internships']].map(([key,label])=><div key={key}><strong>{content ? content.stats[key].toLocaleString() : '…'}</strong><span>{label}</span></div>)}</section>
    <section className="home-get-started"><p className="nova-eyebrow">GET STARTED AT YOUR OWN PACE</p><h2>Three steps toward your next opportunity</h2></section>
    <div className="home-actions">
      {steps.map((step, index) => <section className="home-action wf-card" key={step.title}>
        <span className="home-step" aria-hidden="true">0{index + 1}</span>
        <h2><NavIcon name={step.icon} />{step.title}</h2>
        <p>{step.description}</p>
        <button className="wf-secondary" onClick={() => setPage(step.page)}>{step.label}</button>
      </section>)}
    </div>
    <section className="home-students"><div className="home-section-header"><h2>Fresh internships and entry-level jobs</h2><button type="button" className="text-button" onClick={()=>setPage('jobs')}>See all jobs →</button></div><div className="home-student-jobs">{content?.student_jobs.map(job=><JobCard key={job.job_id} job={job} goJob={goJob} compact />)}</div>{!content && !error && <p role="status">Loading student opportunities…</p>}{content && !content.student_jobs.length && <p className="wf-empty">No fresh internships or entry-level roles listed yet. Explore all jobs for more opportunities.</p>}</section>
    <section className="home-careers"><p className="nova-eyebrow">MORE THAN ONE PATH INTO TECH</p><h2>Find your field</h2><p>From software to spacecraft, explore opportunities across different technology careers.</p><div>{[['software','Software Development'],['data_ai','Data & AI'],['it_cloud_security','IT & Cybersecurity'],['electrical_hardware','Electrical Engineering'],['mechanical','Mechanical Engineering'],['aerospace','Aerospace Engineering']].map(([value,area]) => <button type="button" key={value} onClick={()=>browseField(value)}>{area}</button>)}</div></section>
    <section className="home-closing"><div><h2>Ready to see how your skills match?</h2><p>Compare your profile to real DFW job requirements.</p></div><button type="button" className="primary-button" onClick={()=>setPage('skillgap')}>Explore Skill Gap</button></section>
  </main>;
}
