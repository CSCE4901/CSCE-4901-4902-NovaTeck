export default function HomePage({ setPage }) {
  const actions = [
    { page: 'jobs', title: 'Find your next opportunity', description: 'Explore DFW technology jobs and filter opportunities to fit your interests.', label: 'Browse Jobs' },
    { page: 'dashboard', title: 'Keep track of your progress', description: 'Return to your saved jobs, application activity, and recommendations.', label: 'View Dashboard' },
    { page: 'skillgap', title: 'Plan your next step', description: 'Compare your skills with your career category and see where you can grow.', label: 'Analyze Skills' },
  ];
  return <main className="wf-page home-page">
    <header className="home-intro">
      <p className="home-eyebrow">DFW TECH JOB TRACKER</p>
      <h1>Welcome to NovaTeck</h1>
      <p className="home-description">Discover opportunities, organize your job search, and build the skills for your next role.</p>
    </header>
    <div className="home-actions">
      {actions.map((action, index) => <section className="home-action wf-card" key={action.page}>
        <span className="home-step" aria-hidden="true">0{index + 1}</span>
        <h2>{action.title}</h2>
        <p>{action.description}</p>
        <button className={index === 0 ? 'primary-button' : 'wf-secondary'} onClick={() => setPage(action.page)}>{action.label} <span aria-hidden="true">→</span></button>
      </section>)}
    </div>
  </main>;
}
