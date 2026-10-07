import JobCard from './components/JobCard';
import { careerCategories } from './careerCategories';
import ContactSupport from "./components/ContactSupport";
import CareerChat from "./components/CareerChat";
import NavIcon from "./components/NavIcon";
import NovaLogo from "./components/NovaLogo";
import HomePage from "./components/HomePage";
import { responseError } from "./apiErrors";
import { useState, useEffect, useRef, createContext, useContext } from "react";
import { WireDashboard, WireProfile, WireJobDetail, WireSkillGap, WireAdmin } from "./components/WireframePages";
import "./styles.css";

const API = "/api";
const AuthContext = createContext(null);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// helpers
function useAuth() { return useContext(AuthContext); }

async function apiFetch(path, options = {}, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(API + path, { ...options, headers: { ...headers, ...options.headers } });
  } catch {
    throw new Error("Cannot reach NovaTeck. Check your connection and make sure the local app servers are running.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event("novateck-session-expired"));
    const error = new Error(responseError(res.status, data.error)); error.status = res.status; throw error;
  }
  return data;
}

// App shell
export default function App() {
  const [auth, setAuth] = useState(() => {
    const storage = localStorage.getItem("nt_token") ? localStorage : sessionStorage;
    const t = storage.getItem("nt_token");
    const u = storage.getItem("nt_user");
    try { return t && u ? { token: t, ...JSON.parse(u) } : null; } catch { return null; }
  });
  const [homeFocus,setHomeFocus]=useState(null);
  const [profileFocus, setProfileFocus] = useState(null);
  const [page, setPage] = useState(() => new URLSearchParams(window.location.search).get("resetToken") ? "reset" : (auth ? (["/admin", "/admin/flagged-skills"].includes(window.location.pathname) ? "admin" : "jobs") : "login"));
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobReturnPage, setJobReturnPage] = useState("jobs");
  const [theme, setTheme] = useState(() => localStorage.getItem("nt_theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  const [deviceTheme, setDeviceTheme] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  useEffect(() => {
    const device = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { const detected = device.matches ? 'dark' : 'light'; setDeviceTheme(detected); document.documentElement.dataset.theme = theme === 'system' ? detected : theme; };
    apply(); localStorage.setItem('nt_theme', theme); device.addEventListener('change', apply);
    return () => device.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    if (!auth) return;
    let active = true;
    const token = auth.token;
    apiFetch(`/students/${auth.user_id}`, {}, token).then(user => {
      if (!active) return;
      const profile = { user_id: user.user_id, name: user.name, role: user.role };
      for (const storage of [localStorage, sessionStorage]) {
        if (storage.getItem("nt_token") === token) storage.setItem("nt_user", JSON.stringify(profile));
      }
      setAuth(current => current?.token === token ? { ...current, ...profile } : current);
    }).catch(error => { if (active && error.status === 401) logout(); });
    return () => { active = false; };
  }, [auth?.token]);

  useEffect(() => {
    window.addEventListener("novateck-session-expired", logout);
    return () => window.removeEventListener("novateck-session-expired", logout);
  }, []);

  function login(token, user, remember = false) {
    const storage = remember ? localStorage : sessionStorage;
    for (const store of [localStorage, sessionStorage]) { store.removeItem("nt_token"); store.removeItem("nt_user"); }
    storage.setItem("nt_token", token);
    storage.setItem("nt_user", JSON.stringify(user));
    setAuth({ token, ...user });
    setPage(user.role === "admin" ? "admin" : "jobs");
  }

  function logout() {
    for (const store of [localStorage, sessionStorage]) { store.removeItem("nt_token"); store.removeItem("nt_user"); }
    setAuth(null);
    setPage("login");
  }

  function updateDisplayName(name) {
    setAuth(current => {
      const updated = { ...current, name };
      const storage = localStorage.getItem("nt_token") ? localStorage : sessionStorage;
      storage.setItem("nt_user", JSON.stringify({ user_id: updated.user_id, name }));
      return updated;
    });
  }

  useEffect(() => {
    if (/^#(?::r|job-section-)/.test(window.location.hash)) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    window.scrollTo(0, 0);
  }, [page, selectedJobId]);

  useEffect(() => {
    const restorePage = event => {
      if (!event.state?.novaPage) return;
      setSelectedJobId(event.state.novaJobId || null);
      setPage(event.state.novaPage);
    };
    window.addEventListener('popstate', restorePage);
    return () => window.removeEventListener('popstate', restorePage);
  }, []);
  function goJob(id) {
    setJobReturnPage(page);
    window.history.replaceState({ ...window.history.state, novaPage: page, novaJobId: selectedJobId }, '', window.location.href);
    window.history.pushState({ novaPage: 'detail', novaJobId: id }, '', window.location.href);
    setSelectedJobId(id); setPage('detail');
  }
  function backFromJob() {
    if (window.history.state?.novaPage === 'detail') window.history.back();
    else setPage(jobReturnPage === 'detail' ? 'jobs' : jobReturnPage);
  }

  return (
    <AuthContext.Provider value={auth}>
      <div className="app-shell">
        {!["login", "register"].includes(page) && <Navbar page={page} setPage={setPage} logout={logout} auth={auth} theme={theme} deviceTheme={deviceTheme} setTheme={setTheme} />}
        <div className="nova-page-container">
          {page === "login"     && <LoginPage onLogin={login} setPage={setPage} />}
          {page === "register"  && <RegisterPage onLogin={login} setPage={setPage} />}
          {page === "forgot"    && <ForgotPasswordPage setPage={setPage} />}
          {page === "reset"     && <ResetPasswordPage setPage={setPage} />}
          {page === "home" && auth && <HomePage browseField={field=>{setHomeFocus(field);setPage('jobs');}} setPage={setPage} auth={auth} request={apiFetch} goJob={goJob} />}
          {page === "jobs"      && <JobListingsPage initialFocus={homeFocus} goJob={goJob} />}
          {page === "detail"    && <WireJobDetail auth={auth} request={apiFetch} jobId={selectedJobId} goJob={goJob} setPage={setPage} onBack={backFromJob} returnPage={jobReturnPage} />}
          {page === "dashboard" && <WireDashboard auth={auth} request={apiFetch} goJob={goJob} setPage={(next, field) => { setProfileFocus(field || null); setPage(next); }} />}
          {page === "profile" && <WireProfile focusField={profileFocus} auth={auth} request={apiFetch} onNameChange={updateDisplayName} setPage={setPage} />}
          {page === "skillgap"  && <WireSkillGap auth={auth} request={apiFetch} setPage={setPage} />}
          {page === "admin" && auth && <WireAdmin auth={auth} request={apiFetch} onForbidden={() => { window.history.replaceState({}, "", "/"); setPage("dashboard"); }} />}
        </div>
        <ContactSupport token={auth?.token} />
      </div>
    </AuthContext.Provider>
  );
}



// Navbar
export function Navbar({ page, setPage, logout, auth, theme, deviceTheme, setTheme }) {
  const navRef = useRef(null);
  const [scrollHidden, setScrollHidden] = useState(false);
  const [navHeight, setNavHeight] = useState(84);
  useEffect(() => {
    const nav = navRef.current;
    const measure = () => setNavHeight(nav.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setScrollHidden(false);
    let previousY = Math.max(0, window.scrollY);
    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      const nav = navRef.current;
      if (y <= navHeight || nav?.querySelector(':focus-visible, [aria-expanded="true"]')) {
        setScrollHidden(false);
        previousY = y;
        return;
      }
      if (Math.abs(y - previousY) < 8) return;
      setScrollHidden(y > previousY);
      previousY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [page, navHeight]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [restoring, setRestoring] = useState(false), [restoreMessage, setRestoreMessage] = useState('');
  async function restoreHidden() {
    setRestoring(true); setRestoreMessage('');
    try { const result = await apiFetch('/hidden-jobs/restore', {method:'POST', body:JSON.stringify({})}, auth.token); setRestoreMessage(result.count ? 'Hidden jobs restored.' : 'No hidden jobs to restore.'); window.dispatchEvent(new Event('novateck-recommendations-refresh')); }
    catch (error) { setRestoreMessage(error.message); }
    finally { setRestoring(false); }
  }
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); setSettingsOpen(false); }, [page]);
  const tabs = [
    ['home', 'Home'], ['jobs', 'Jobs'], ['dashboard', 'Dashboard'],
    ['skillgap', 'Skill Gap'], ['profile', 'Profile'],
    ...(auth?.role === 'admin' ? [['admin', 'Admin']] : []),
  ];
  return (
    <nav ref={navRef} style={{ "--nova-nav-height": `${navHeight}px` }} className={`nova-nav${mobileOpen ? " is-mobile-open" : ""}${scrollHidden ? " is-scroll-hidden" : ""}`} onFocusCapture={() => setScrollHidden(false)} aria-label="Main navigation" onKeyDown={event => { if (event.key === "Escape") setMobileOpen(false); }}>
      <button className="nova-brand nova-logo-button" onClick={() => setPage(auth ? 'home' : 'login')} aria-label="NovaTeck home"><NovaLogo /></button>
      <button type="button" className="nova-mobile-menu" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="nova-navigation-links" onClick={() => setMobileOpen(value => !value)}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={mobileOpen ? 'M6 6l12 12M6 18 18 6' : 'M4 6h16M4 12h16M4 18h16'} /></svg></button>
      <div className="nova-nav-links" id="nova-navigation-links">
        {auth && tabs.map(([key, label]) => <button key={key} className="nova-nav-tab" aria-current={page === key ? 'page' : undefined} onClick={() => setPage(key)}><NavIcon name={key} />{label}</button>)}
        {auth && <CareerChat key={auth.user_id} token={auth.token} />}
      </div>
      <div className="nova-nav-account">
        <div className="nova-settings-wrap"><button type="button" className="nova-theme-toggle" aria-label="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(value => !value)}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9.5 3h5l.7 2.6 2 .9 2.4-.7 2.5 4.4-1.8 1.9v2l1.8 1.9-2.5 4.4-2.4-.7-2 .9-.7 2.4h-5l-.7-2.4-2-.9-2.4.7-2.5-4.4 1.8-1.9v-2L2 10.2l2.5-4.4 2.4.7 2-.9Z" /><circle cx="12" cy="12.5" r="3.3" /></svg></button>{settingsOpen && <><button className="nova-settings-backdrop" type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)} /><div className="nova-settings-panel" onKeyDown={event => { if (event.key === 'Escape') setSettingsOpen(false); }}><header><h2>Settings</h2><button type="button" className="text-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>×</button></header><p>Appearance</p><select className="nova-settings-option" aria-label="Appearance" value={theme} onChange={event => setTheme(event.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">Use device theme</option></select>{auth && <><p>Job preferences</p><button type="button" className="wf-secondary nova-settings-option" disabled={restoring} onClick={restoreHidden}>{restoring ? 'Restoring…' : 'Restore Hidden Jobs'}</button>{restoreMessage && <small className="nova-device-theme-note" role="status">{restoreMessage}</small>}</>}<p>Account & help</p><button type="button" className="wf-secondary nova-settings-option" onClick={() => { setSettingsOpen(false); setPage('forgot'); }}>Reset Password</button><button type="button" className="wf-secondary nova-settings-option" onClick={() => { setSettingsOpen(false); window.dispatchEvent(new Event('novateck-contact-support')); }}>Contact Support</button></div></>}</div>
        {auth ? <button className="nova-nav-exit" onClick={logout}><NavIcon name="logout" />Logout</button> : <>
          <button className="nova-nav-exit" onClick={() => setPage('login')}><NavIcon name="login" />Login</button>
          <button className="nova-nav-exit" onClick={() => setPage('register')}><NavIcon name="register" />Register</button>
        </>}
      </div>
    </nav>
  );
}

// LoginPage
function LoginPage({ onLogin, setPage }) {
  const [form, setForm] = useState({ email: "", password: "", remember: false });
  const [err, setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setErr("");
    if (!EMAIL_PATTERN.test(form.email.trim())) {
      setErr("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify(form) });
      onLogin(data.token, { user_id: data.user_id, name: data.name, role: data.role }, form.remember);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <AuthLayout title="Sign In" variant="login" setPage={setPage}>
      <form className="auth-form" onSubmit={event => { event.preventDefault(); handleSubmit(); }}>
        {err && <div className="auth-form-message"><Alert msg={err} /></div>}
        <AuthField id="login-email" label="Email address" type="email" autoComplete="username" value={form.email} onChange={email => setForm(current => ({ ...current, email }))} />
        <AuthField id="login-password" label="Password" type="password" autoComplete="current-password" value={form.password} onChange={password => setForm(current => ({ ...current, password }))} />
        <div className="auth-actions"><button className="primary-button auth-submit" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign In"}</button></div>
        <div className="auth-links">
          <p>Don't have an account? <button className="text-button" type="button" onClick={() => setPage("register")}>Register Here</button></p>
          <p><button className="text-button" type="button" onClick={() => setPage("forgot")}>Forgot Password?</button></p>
        </div>
      </form>
    </AuthLayout>
  );
}

function AuthLayout({ title, variant, setPage, children }) {
  return <main className={`auth-layout auth-layout--${variant}`}>
    <header className="auth-brand-row"><button type="button" className="auth-brand nova-logo-button" onClick={() => setPage("login")} aria-label="NovaTeck home"><NovaLogo /></button></header>
    <h1 className="auth-title">{title}</h1>
    {children}
  </main>;
}

function AuthField({ id, label, type = "text", value, onChange, autoComplete, placeholder, children, describedBy, error }) {
  return <div className="auth-field">
    <label htmlFor={id}>{label} :</label>
    <div className="auth-field-control">
      <input id={id} name={id} type={type} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} placeholder={placeholder} required aria-invalid={error ? true : undefined} aria-describedby={[describedBy, error && `${id}-error`].filter(Boolean).join(" ") || undefined} />
      {children}
      {error && <p id={`${id}-error`} className="auth-field-error" role="alert">{error}</p>}
    </div>
  </div>;
}

export function ForgotPasswordPage({ setPage }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (!EMAIL_PATTERN.test(email.trim())) return setMessage("Enter a valid email address.");
    setLoading(true);
    try { setMessage((await apiFetch("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) })).message); }
    catch (e) { setMessage(e.message); }
    setLoading(false);
  }
  return <div style={{ maxWidth: 420, margin: "60px auto" }}><Card>
    <h2 style={hStyle}>Reset Password</h2>
    <p style={{ color: "#6b7280", textAlign: "center", marginBottom: 24 }}>Enter your email and we’ll send a reset link.</p>
    {message && <p style={{ color: "#047857", fontSize: 14 }}>{message}</p>}
    <Label>Email</Label><Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
    <Btn onClick={submit} loading={loading} full>Send Reset Link</Btn>
    <p style={{ textAlign: "center", marginTop: 16 }}><button className="text-button" type="button" style={linkStyle} onClick={() => setPage("login")}>Back to sign in</button></p>
  </Card></div>;
}

export function ResetPasswordPage({ setPage }) {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get("resetToken") || "");
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  async function submit() {
    setSuccess(false);
    if (!PASSWORD_PATTERN.test(password)) return setMessage("Use 8+ characters with uppercase, lowercase, and a number.");
    if (password !== confirm) return setMessage("Passwords do not match.");
    try { setMessage((await apiFetch("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, password }) })).message); setSuccess(true); window.history.replaceState({}, "", window.location.pathname); setToken(""); setTimeout(() => setPage("login"), 1200); }
    catch (e) { setMessage(e.message); }
  }
  return <div style={{ maxWidth: 420, margin: "60px auto" }}><Card>
    <h2 style={hStyle}>Choose a New Password</h2>{message && <p role={success ? "status" : "alert"} style={{ color: success ? "#047857" : "#b91c1c", fontSize: 14 }}>{message}</p>}
    <p style={{ color: "#6b7280", marginBottom: 24 }}>Enter and confirm your new password below.</p>
    <Label>New password</Label><Input label="New password" type={showPassword ? "text" : "password"} value={password} onChange={setPassword} />
    <Label>Confirm password</Label><Input label="Confirm password" type={showPassword ? "text" : "password"} value={confirm} onChange={setConfirm} />
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer" }}><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />Show passwords</label>
    <Btn onClick={submit} full>Update Password</Btn>
  </Card></div>;
}

// RegisterPage
function RegisterPage({ onLogin, setPage }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [err, setErr] = useState("");
  const [errors, setErrors] = useState({});
  function updateField(field, value) {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: "", ...(field === "password" ? { confirmPassword: "" } : {}) }));
    setErr("");
  }
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setErr("");
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Enter your full name.";
    if (!EMAIL_PATTERN.test(form.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!PASSWORD_PATTERN.test(form.password)) nextErrors.password = "Use 8+ characters with uppercase, lowercase, and a number.";
    if (!form.confirmPassword || form.password !== form.confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setLoading(true);
    try {
      const { confirmPassword, ...registration } = form;
      const data = await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(registration) });
      onLogin(data.token, { user_id: data.user_id, name: data.name });
    } catch (e) {
      if (/email.*(already|registered|exists)/i.test(e.message)) setErrors({ email: e.message });
      else setErr(e.message);
    }
    setLoading(false);
  }

  const strength = !form.password ? 0 : !PASSWORD_PATTERN.test(form.password) ? 1 : form.password.length < 12 ? 2 : 3;
  const strengthLabel = ["Weak", "Weak", "Medium", "Strong"][strength];
  return (
    <AuthLayout title="Create an Account" variant="register" setPage={setPage}>
      <form className="auth-form" noValidate onSubmit={event => { event.preventDefault(); handleSubmit(); }}>
        {err && <div className="auth-form-message"><Alert msg={err} /></div>}
        <AuthField id="register-name" label="Full Name" autoComplete="name" placeholder="Jane Doe" value={form.name} error={errors.name} onChange={name => updateField("name", name)} />
        <AuthField id="register-email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} error={errors.email} onChange={email => updateField("email", email)} />
        <AuthField id="register-password" label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} error={errors.password} onChange={password => updateField("password", password)} describedBy="password-strength">
          <div id="password-strength" className="auth-password-strength" data-strength={strengthLabel.toLowerCase()} aria-live="polite" title="Use 8+ characters with uppercase, lowercase, and a number.">
            <span>Password Strength:</span>
            <span className="auth-strength-meter" role="meter" aria-valuemin={0} aria-valuemax={3} aria-valuenow={strength} aria-valuetext={strengthLabel} aria-label="Password strength"><span style={{ width: `${strength / 3 * 100}%` }} /></span>
            <span className="auth-strength-label">{strengthLabel}</span>
          </div>
        </AuthField>
        <AuthField id="register-confirm" label="Confirm Password" type="password" autoComplete="new-password" placeholder="Re-enter your password" value={form.confirmPassword} error={errors.confirmPassword} onChange={confirmPassword => updateField("confirmPassword", confirmPassword)} />
        <div className="auth-actions"><button className="primary-button auth-submit" type="submit" disabled={loading}>{loading ? "Creating account…" : "Create Account"}</button></div>
        <div className="auth-links">
          <p>Already have an account? <button className="text-button" type="button" onClick={() => setPage("login")}>Sign In Here</button></p>
          <p><button className="text-button" type="button" onClick={() => setPage("forgot")}>Forgot Password?</button></p>
        </div>
      </form>
    </AuthLayout>
  );
}

// JobListingsPage
function JobListingsPage({ goJob, initialFocus }) {
  const auth = useAuth();
  const [focus, setFocus] = useState(initialFocus ? [initialFocus] : []);
  const [sort, setSort] = useState("match");
  const [jobs, setJobs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery] = useState("");
  const [skill, setSkill]       = useState([]);
  const [location, setLocation] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [experience, setExperience] = useState("");
  const [workTypes, setWorkTypes] = useState([]);
  const [options, setOptions]   = useState({ skills: [], companies: [], locations: [] });
  const [page, setPage]         = useState(0);
  const [total, setTotal]       = useState(0);
  const [msg, setMsg]           = useState("");

  const [savedIds, setSavedIds] = useState([]), [saving, setSaving] = useState(null), [savedReady, setSavedReady] = useState(false);
  const [applicationStatuses, setApplicationStatuses] = useState({});
  useEffect(() => {
    let active = true;
    if (!auth) return;
    apiFetch(`/students/${auth.user_id}/applications`, {}, auth.token).then(rows => { if (active) setApplicationStatuses(Object.fromEntries(rows.map(row => [row.job_id, row.status]))); }).catch(error => active && setMsg(error.message));
    apiFetch(`/students/${auth.user_id}/saved-jobs`, {}, auth.token).then(rows => { if (active) { setSavedIds(rows.map(row => row.job_id)); setSavedReady(true); } }).catch(error => active && setMsg(error.message));
    return () => { active = false; };
  }, [auth?.user_id, auth?.token]);
  async function toggleSave(job) {
    if (!auth || saving !== null || !savedReady) return;
    setSaving(job.job_id); setMsg('');
    const saved = savedIds.includes(job.job_id);
    try {
      await apiFetch(saved ? `/saved-jobs/${job.job_id}` : '/saved-jobs', { method: saved ? 'DELETE' : 'POST', ...(saved ? {} : { body: JSON.stringify({ job_id: job.job_id }) }) }, auth.token);
      setSavedIds(current => saved ? current.filter(id => id !== job.job_id) : [...current, job.job_id]);
    } catch (error) { setMsg(error.message); } finally { setSaving(null); }
  }
  async function trackOpening(job) {
    if (!auth) return;
    try {
      const applications = await apiFetch(`/students/${auth.user_id}/applications`, {}, auth.token);
      const existing = applications.find(row => row.job_id === job.job_id);
      if (!existing) await apiFetch(`/students/${auth.user_id}/applications`, { method: 'POST', body: JSON.stringify({ job_id: job.job_id, status: 'Opened employer site' }) }, auth.token);
      setApplicationStatuses(current => ({ ...current, [job.job_id]: existing?.status || 'Opened employer site' }));
      await load(page);
    } catch (error) { setMsg(error.message); }
  }
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount = workTypes.length + experience.split(',').filter(Boolean).length + skill.length + focus.length + [location.trim(), companyId].filter(Boolean).length;
  const [filterFeedback, setFilterFeedback] = useState('');
  useEffect(() => { setFilterFeedback(''); }, [focus, skill, workTypes, experience, location, companyId, query]);
  useEffect(() => {
    if (!filterFeedback) return;
    const timer = setTimeout(() => setFilterFeedback(''), 4000);
    return () => clearTimeout(timer);
  }, [filterFeedback]);
  async function applyFilters() {
    setFilterFeedback('');
    const count = await load(0);
    if (count !== undefined) setFilterFeedback(`✓ Filters applied · ${count} jobs found`);
  }
  async function load(nextPage = page, resetFilters = false, nextSort = sort, nextFocus = focus) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("sort", nextSort);
      if (!resetFilters) nextFocus.forEach(value => params.append("discipline", value));
      if (!resetFilters && query) params.append("q", query);
      if (!resetFilters) skill.forEach(value => params.append("skill", value));
      if (!resetFilters && location) params.append("location", location);
      if (!resetFilters && companyId) params.append("company_id", companyId);
      if (!resetFilters && experience) params.append("experience", experience);
      if (!resetFilters && workTypes.length) params.append("work_type", workTypes.join(","));
      params.append("limit", "20");
      params.append("offset", String(nextPage * 20));
      const [data, count] = await Promise.all([
        apiFetch(`/jobs?${params}`, {}, auth?.token),
        apiFetch(`/jobs/count?${params}`, {}, auth?.token),
      ]);
      setJobs(Array.isArray(data) ? data : []);
      setTotal(count.total || 0);
      setPage(nextPage);
      setMsg("");
      setLoading(false);
      return count.total || 0;
    } catch (error) { setJobs([]); setTotal(0); setMsg(error.message); }
    setLoading(false);
  }

  useEffect(() => {
    apiFetch("/search-options", {}, auth?.token).then(setOptions).catch(() => {});
    if (initialFocus) { load(0, false, sort, [initialFocus]); }
    else apiFetch(`/students/${auth.user_id}/profile-details`, {}, auth.token).then(details => { const savedFocus = details.career_focus ? [details.career_focus] : []; setFocus(savedFocus); load(0, false, sort, savedFocus); }).catch(() => load(0));
  }, []);

  function clearFilters() {
    setFocus([]); setWorkTypes([]); setQuery(""); setSkill([]); setLocation(""); setCompanyId(""); setExperience("");
    load(0, true);
  }

  return (
    <main className="wf-page">
      <p className="nova-eyebrow">FIND YOUR NEXT MOVE</p><h1>DFW Tech Jobs</h1>
      <p className="nova-jobs-subtitle">Browse roles with DFW locations.</p>

      <div className="wf-search-row nova-job-search"><div className="nova-job-search-input"><NavIcon name="jobs" /><input id="job-search" aria-label="Search jobs" placeholder="Search job titles, companies, or keywords" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === "Enter" && applyFilters()} /></div><button className="primary-button" disabled={loading} onClick={applyFilters}>Search</button></div>
      <div className="nova-filter-toolbar"><button type="button" className="wf-secondary" aria-expanded={filtersOpen} aria-controls="job-filters" onClick={() => setFiltersOpen(open => !open)}>Filters ({filterCount})</button><button type="button" className="text-button" onClick={clearFilters} disabled={loading}>Clear all</button><span role="status">{filterFeedback || "Results update when you apply filters."}</span></div>
      <section id="job-filters" hidden={!filtersOpen} className="wf-filters nova-filter-panel"><header className="nova-filter-heading"><div className="nova-filter-title"><span className="nova-filter-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6" /></svg></span><div><h2>Filters</h2><p>Fine-tune your next opportunity.</p></div></div><span className="nova-filter-count">{filterCount} selected</span></header>
        <div className="wf-field"><span id="job-focus-label">Career Focus</span><details className="nova-skill-select"><summary aria-labelledby="job-focus-label job-focus-summary"><span id="job-focus-summary">{focus.length === 1 ? careerCategories.find(([value]) => value === focus[0])?.[1] : focus.length ? `${focus.length} career fields selected` : 'All Career Categories'}</span><span aria-hidden="true">⌄</span></summary><div className="nova-skill-options"><button type="button" className="text-button" onClick={() => setFocus([])}>All Career Categories</button>{careerCategories.filter(([value]) => value).map(([value, label]) => <label key={value}><input type="checkbox" checked={focus.includes(value)} onChange={event => setFocus(current => event.target.checked ? [...current, value] : current.filter(item => item !== value))} />{label}</label>)}</div></details></div><div className="wf-field"><span>Work Type</span><div className="wf-inline">{['Full-time', 'Part-time', 'Contract', 'Internship'].map(type => <button type="button" className="nova-filter-pill" key={type} aria-pressed={workTypes.includes(type)} onClick={() => setWorkTypes(current => current.includes(type) ? current.filter(t => t !== type) : [...current, type])}>{type}</button>)}</div></div>
        <div className="wf-field"><span id="job-skill-label">Skills</span><details className="nova-skill-select"><summary aria-labelledby="job-skill-label job-skill-summary"><span id="job-skill-summary">{skill.length ? `${skill.length} skills selected` : 'All skills'}</span><span aria-hidden="true">⌄</span></summary><div className="nova-skill-options"><button type="button" className="text-button" onClick={() => setSkill([])}>Clear selected skills</button>{options.skills.map(value => <label key={value}><input type="checkbox" checked={skill.includes(value)} onChange={event => setSkill(current => event.target.checked ? [...current, value] : current.filter(item => item !== value))} />{value}</label>)}</div></details></div>
        <div className="wf-field"><span>Experience</span><div className="wf-inline">{[['entry','Entry / intern'],['mid','Mid-level'],['senior','Senior / lead']].map(([value,label]) => <button type="button" className="nova-filter-pill" key={value} aria-pressed={experience.split(',').includes(value)} onClick={() => setExperience(current => current.split(',').includes(value) ? current.split(',').filter(v => v !== value).join(',') : [...current.split(',').filter(Boolean), value].join(','))}>{label}</button>)}</div></div>
        <div className="wf-field"><span>Location / Company</span><div className="wf-inline"><input placeholder="City or location" aria-label="Filter by location" value={location} onChange={e => setLocation(e.target.value)} list="location-options" /><datalist id="location-options">{options.locations.map(value => <option key={value} value={value} />)}</datalist><select aria-label="Filter by company" value={companyId} onChange={e => setCompanyId(e.target.value)}><option value="">All companies</option>{options.companies.map(c => <option key={c.company_id} value={c.company_id}>{c.name}</option>)}</select></div></div>
      <footer className="nova-filter-footer"><span role="status" className={filterFeedback ? "nova-filter-success" : ""}>{filterFeedback || (loading ? "Applying your filters…" : "Choose your filters, then apply to update results.")}</span><div><button className="wf-secondary" onClick={clearFilters} disabled={loading}>Reset</button><button className="primary-button" onClick={applyFilters} disabled={loading}>{loading ? 'Applying…' : 'Apply Filters'}</button></div></footer>
      </section>
      {msg && <div style={{ background: "#d1fae5", color: "#065f46", padding: "10px 16px", borderRadius: 8, marginBottom: 16 }}>{msg}</div>}

      {loading ? <Spinner /> : (
        <>
          <div className="nova-results-heading"><div className="nova-results-title"><h2>Results</h2><p>{total} jobs found</p></div><label>Sort by <select value={sort} onChange={event => { setSort(event.target.value); load(0, false, event.target.value); }}><option value="match">Highest match</option><option value="newest">Newest posted</option></select></label></div>
          <div style={{ display: "grid", gap: 16 }}>
            {jobs.map(job => (
              <JobCard key={job.job_id} job={job} goJob={goJob} saved={savedIds.includes(job.job_id)} onSave={toggleSave} busy={!savedReady || saving !== null} onApply={trackOpening} applicationStatus={applicationStatuses[job.job_id]} />
            ))}
          </div>
          {<div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 24 }}>
            <button onClick={() => load(page - 1)} disabled={page === 0} style={paginationButton(page === 0)}>Previous</button>
            <span style={{ color: "#6b7280", fontSize: 13 }}>Page {page + 1} of {Math.max(1, Math.ceil(total / 20))}</span>
            <button onClick={() => load(page + 1)} disabled={(page + 1) * 20 >= total} style={paginationButton((page + 1) * 20 >= total)}>Next</button>
          </div>}
        </>
      )}
    </main>
  );
}

// Shared UI primitives
const hStyle = { fontSize: 22, fontWeight: 700, color: "#1e3a8a", textAlign: "center", marginBottom: 8 };
const linkStyle = { color: "#1e40af", cursor: "pointer", fontWeight: 600 };
const filterInput = { flex: 1, minWidth: 160, border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" };

function paginationButton(disabled) {
  return { background: disabled ? "#e5e7eb" : "#1e40af", color: disabled ? "#9ca3af" : "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 };
}

function tagStyle(bg, color, filled = false) {
  return { background: bg, color, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, display: "inline-block" };
}

function Card({ children, title, padding = 24 }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", marginBottom: 20 }}>
      {title && <h3 style={{ margin: "0 0 16px", color: "#1e3a8a", fontSize: 16 }}>{title}</h3>}
      {children}
    </div>
  );
}

function Alert({ msg }) {
  return <div role="alert" style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{msg}</div>;
}

function Spinner() {
  return <div role="status" style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Loading...</div>;
}

function Label({ children }) {
  return <label htmlFor={children} style={{ display: "block", margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#374151" }}>{children}</label>;
}

function Input({ type = "text", value, onChange, placeholder, label }) {
  return (
    <input id={label} aria-label={label} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginBottom: 16, boxSizing: "border-box", outline: "none" }} />
  );
}

function Btn({ children, onClick, loading, full, type = "button" }) {
  return (
    <button type={type} onClick={onClick} disabled={loading}
      style={{ width: full ? "100%" : "auto", background: loading ? "#93c5fd" : "#1e40af", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
      {loading ? "Please wait..." : children}
    </button>
  );
}
