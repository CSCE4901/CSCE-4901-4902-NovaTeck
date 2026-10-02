import NavIcon from './NavIcon';

export default function HomePage({ setPage }) {
  const steps = [
    { page: 'profile', icon: 'profile', title: 'Build your profile', description: 'Add your interests, experience, and skills so NovaTeck can help you find relevant opportunities.', label: 'Set Up Profile' },
    { page: 'profile', icon: 'requirements', title: 'Upload your resume', description: 'Have a resume ready? Upload it to discover skills you can add to your profile.', label: 'Add Resume' },
    { page: 'skillgap', icon: 'match', title: 'Discover your matches', description: 'Once you’ve added your skills, compare them with job requirements and see what to learn next.', label: 'Explore Skill Gap' },
  ];
  return <main className="wf-page home-page">
    <header className="home-intro">
      <p className="home-eyebrow">WELCOME TO NOVATECK</p>
      <h1>Your next tech opportunity starts here.</h1>
      <p className="home-description">Explore DFW technology jobs, discover your strengths, and build the skills for your next role.</p>
      <button className="primary-button" onClick={() => setPage('jobs')}>Browse Jobs</button>
      <p className="home-start-note">Start exploring now. Add your profile and resume whenever you’re ready.</p>
    </header>
    <section className="home-get-started"><p className="nova-eyebrow">GET STARTED AT YOUR OWN PACE</p><h2>Three steps toward your next opportunity</h2></section>
    <div className="home-actions">
      {steps.map((step, index) => <section className="home-action wf-card" key={step.title}>
        <span className="home-step" aria-hidden="true">0{index + 1}</span>
        <h2><NavIcon name={step.icon} />{step.title}</h2>
        <p>{step.description}</p>
        <button className="wf-secondary" onClick={() => setPage(step.page)}>{step.label}</button>
      </section>)}
    </div>
    <section className="home-careers"><p className="nova-eyebrow">MORE THAN ONE PATH INTO TECH</p><h2>Find your field</h2><p>From software to spacecraft, explore opportunities across different technology careers.</p><div>{['Software Development', 'Data & AI', 'IT & Cybersecurity', 'Electrical Engineering', 'Mechanical Engineering', 'Aerospace Engineering'].map(area => <span key={area}>{area}</span>)}</div></section>
  </main>;
}
