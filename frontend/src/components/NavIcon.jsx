const paths = {
  projects: 'M3 7h7l2 2h9v12H3V7ZM3 7V4h7l2 3M8 14l-2 2 2 2m8-4 2 2-2 2m-3-5-2 6',
  skills: 'M14 6a5 5 0 0 0-6-4l3 3-3 3-3-3a5 5 0 0 0 6 6l8 8a2 2 0 0 0 3-3l-8-8Z',
  upload: 'M14 2H5v20h14V7l-5-5ZM14 2v5h5M12 18v-7m-3 3 3-3 3 3',
  experience: 'M8 7V4h8v3M3 7h18v14H3V7ZM3 12c6 3 12 3 18 0M10 12h4v4h-4Z',
  applications: 'M14 2H5v20h14V7l-5-5ZM14 2v5h5M8 14l3 3 5-6',
  saved: 'M6 3h12v18l-6-4-6 4V3Z',
  requirements: 'M9 5h12M9 12h12M9 19h12M2 4l2 2 3-3M2 11l2 2 3-3M2 18l2 2 3-3',
  match: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0',
  actions: 'M13 2 4 14h7l-1 8 10-13h-7l1-7Z',
  home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  jobs: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  dashboard: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  profile: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2Z',
  skillgap: 'M4 12h3v9H4zM10 4h3v17h-3zM16 8h3v13h-3z',
  admin: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7ZM8 12l3 3 5-6',
  logout: 'M10 4H4v16h6M9 12h12m-5-5 5 5-5 5',
  login: 'M14 4h6v16h-6M3 12h12m-5-5 5 5-5 5',
  register: 'M12 3v18M3 12h18',
};

export default function NavIcon({ name }) {
  return <svg className="nova-nav-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
