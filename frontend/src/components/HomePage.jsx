import NavIcon from './NavIcon';
import { useEffect, useState } from 'react';
import './HomePage.css';

const fields = [
  { value: 'software', title: 'Software Development', detail: 'Build what comes next.', icon: 'projects' },
  { value: 'data_ai', title: 'Data & AI', detail: 'Turn information into possibility.', icon: 'skillgap' },
  { value: 'it_cloud_security', title: 'IT & Cybersecurity', detail: 'Keep the connected world running.', icon: 'admin' },
  { value: 'electrical_hardware', title: 'Electrical Engineering', detail: 'Power ideas into reality.', icon: 'actions' },
  { value: 'mechanical', title: 'Mechanical Engineering', detail: 'Design things that move the world.', icon: 'skills' },
  { value: 'aerospace', title: 'Aerospace Engineering', detail: 'Take your curiosity further.', icon: 'jobs' },
];

function CountUp({ value }) {
  return <strong className="lp-stat-value">
    {Number.isFinite(value) ? <><span className="lp-count" aria-hidden="true" style={{ '--lp-count-to': value }} /><span className="lp-sr-only">{value.toLocaleString()}</span></> : <span aria-hidden="true">—</span>}
  </strong>;
}

export default function HomePage({ setPage, auth, request, browseField }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    request('/home', {}, auth.token).then(data => active && setContent(data)).catch(error => active && setError(error.message));
    return () => { active = false; };
  }, [auth.token, request]);

  const steps = [
    { page: 'profile', icon: 'profile', title: 'Make it personal', description: 'Add your interests and skills. Give your next opportunity a starting point.', label: 'Build your profile' },
    { page: 'profile', icon: 'upload', title: 'Bring your experience', description: 'Scan your resume to find skills you already have and add them to your profile.', label: 'Add your resume' },
    { page: 'skillgap', icon: 'match', title: 'See your next move', description: 'Compare your skills with real job requirements and see where to focus next.', label: 'Explore your skill gap' },
  ];

  return <main className="nt-home lp-home">
    <header className="nt-hero">
      <div className="nt-hero-copy">
        <p className="nt-eyebrow">YOUR CAREER LAUNCHPAD</p>
        <h1>Your next move.<br /><span>Starts here.</span></h1>
        <p className="nt-hero-description">Find your place in DFW tech. Discover local jobs and the skills that will take you further.</p>
        <button className="nt-primary" onClick={() => setPage('jobs')}>Explore DFW jobs <span aria-hidden="true">↗</span></button>
      </div>
      <div className="lp-city-wrap">
        <svg className="lp-trajectory" viewBox="0 0 540 80" fill="none" aria-hidden="true"><path d="M470 4C430 12 435 35 350 46S160 65 52 68" /><circle cx="350" cy="46" r="5" /></svg>
        <figure className="nt-city">
        <img src="/images/dfw-skyline.webp" alt="An illustrated photographic view of the Dallas skyline and Margaret Hunt Hill Bridge" width="1200" height="800" fetchpriority="high" />
        <figcaption className="nt-city-caption"><span>Room to grow.<br /><strong>Right here in DFW.</strong></span><span className="nt-location">DALLAS / FORT WORTH</span></figcaption>
        </figure>
      </div>
    </header>

    <div className="nt-market" aria-label="Live DFW job statistics" aria-busy={!content && !error}>
      <p className="lp-market-intro"><span className="lp-market-mark" aria-hidden="true">↗</span><span>A world of possibility.<br /><strong>A little closer to home.</strong></span></p>
      {error ? <p role="alert">{error}</p> : <div className="nt-market-counts">{[['jobs', 'DFW jobs'], ['companies', 'Companies hiring']].map(([key, label]) => <div key={key}><CountUp value={content?.stats[key]} /><span>{label}</span></div>)}</div>}
    </div>

    <section className="nt-journey" aria-labelledby="nt-journey-title">
      <header className="nt-section-heading"><h2 id="nt-journey-title">You bring the ambition.<br /><span>We’ll help with the direction.</span></h2><p>Start with what you know. See where you can go. Take it at your own pace.</p></header>
      <ol className="nt-steps">{steps.map(step => <li key={step.title}>
        <div className="lp-step-top"><span className="nt-step-icon"><NavIcon name={step.icon} /></span><span className="lp-step-route" aria-hidden="true">{step.page === 'skillgap' ? 'YOUR NEXT MOVE' : step.icon === 'upload' ? 'YOUR EXPERIENCE' : 'YOUR STARTING POINT'}</span></div>
        <h3>{step.title}</h3><p>{step.description}</p>
        <button className="nt-text-link" onClick={() => setPage(step.page)}>{step.label}<span aria-hidden="true">↗</span></button>
      </li>)}</ol>
    </section>

    <section className="nt-fields" aria-labelledby="nt-fields-title">
      <header className="nt-fields-intro"><h2 id="nt-fields-title">Choose your<br />direction.</h2><p>From software to spacecraft, find the field that feels like you.</p></header>
      <div className="nt-field-grid">{fields.map(field => <button className="nt-field" type="button" key={field.value} onClick={() => browseField(field.value)}>
        <NavIcon name={field.icon} /><span className="nt-field-copy"><strong>{field.title}</strong><span>{field.detail}</span></span><span className="nt-field-arrow" aria-hidden="true">↗</span>
      </button>)}</div>
    </section>

    <aside className="nt-bottom-note"><NavIcon name="match" /><p>You don’t need to have it all figured out.<br /><strong>Just a place to start.</strong></p><button className="nt-text-link" onClick={() => setPage('jobs')}>Explore all opportunities <span aria-hidden="true">↗</span></button></aside>
  </main>;
}
