import LaunchpadJobCard from './components/LaunchpadJobCard';
import { sortJobsByProfileMatch } from './components/profileMatch';
import { JobsSkeleton, JobsEmpty, JobsError } from './components/JobsStates';
import { careerCategories } from './careerCategories';
import ContactSupport from "./components/ContactSupport";
import CareerChat from "./components/CareerChat";
import NavIcon from "./components/NavIcon";
import NovaLogo from "./components/NovaLogo";
import NovaBadge from "./components/NovaBadge";
import HomePage from "./components/HomePage";
import { responseError } from "./apiErrors";
import { useState, useEffect, useRef, useMemo, createContext, useContext } from "react";
import { WireDashboard, WireProfile, WireJobDetail, WireSkillGap, WireAdmin } from "./components/WireframePages";
import "./styles.css";
import "./launchpad-shared.css";
import "./components/JobsPage.css";

const API = "/api";
const AuthContext = createContext(null);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const SESSION_IDLE_MINUTES = 5;
const SESSION_IDLE_MS = SESSION_IDLE_MINUTES * 60 * 1000;
const SESSION_ACTIVITY_KEY = "nt_last_activity";

function sessionTimeRemaining(lastActivity = Number(sessionStorage.getItem(SESSION_ACTIVITY_KEY))) {
  const elapsed = Date.now() - lastActivity;
  return elapsed >= 0 ? SESSION_IDLE_MS - elapsed : 0;
}

function clearSession() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem("nt_token");
    storage.removeItem("nt_user");
  }
  sessionStorage.removeItem(SESSION_ACTIVITY_KEY);
}

// helpers
function useAuth() { return useContext(AuthContext); }

async function apiFetch(path, options = {}, token = null) {
  if (token && sessionTimeRemaining() <= 0) {
    window.dispatchEvent(new Event("novateck-session-expired"));
    const error = new Error("Your session expired. Please sign in again.");
    error.status = 401;
    throw error;
  }
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
  if (/^\/students\/\d+\/skills$/.test(path) && options.method === 'PUT') {
    const userId = Number(path.split('/')[2]);
    const submitted = JSON.parse(options.body || '{}').skills;
    window.dispatchEvent(new CustomEvent('novateck-profile-skills-saved', { detail: { userId, skills: submitted } }));
  }
  return data;
}

// App shell
export default function App() {
  const [auth, setAuth] = useState(() => {
    localStorage.removeItem("nt_token");
    localStorage.removeItem("nt_user");
    const token = sessionStorage.getItem("nt_token");
    const user = sessionStorage.getItem("nt_user");
    if (token && user && sessionTimeRemaining() > 0) {
      try { return { ...JSON.parse(user), token }; } catch { /* Clear invalid stored session below. */ }
    }
    clearSession();
    return null;
  });
  const [sessionMessage, setSessionMessage] = useState("");
  const [homeFocus,setHomeFocus]=useState(null);
  const [profileFocus, setProfileFocus] = useState(null);
  const [registrationLink] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    return { token: params.get("registrationToken"), email: params.get("email") || "" };
  });
  useEffect(() => {
    if (registrationLink.token) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [registrationLink]);
  const [page, setPage] = useState(() => !auth && registrationLink.token ? "register" : new URLSearchParams(window.location.search).get("resetToken") ? "reset" : (auth ? (["/admin", "/admin/flagged-skills"].includes(window.location.pathname) ? "admin" : "home") : "login"));
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

  const profileSkillsRevision = useRef(0);
  useEffect(() => {
    if (!auth) return;
    let active = true;
    const token = auth.token;
    const revision = profileSkillsRevision.current;
    apiFetch(`/students/${auth.user_id}`, {}, token).then(user => {
      if (!active) return;
      const profile = { user_id: user.user_id, name: user.name, role: user.role };
      if (sessionStorage.getItem("nt_token") === token) sessionStorage.setItem("nt_user", JSON.stringify(profile));
      setAuth(current => current?.token === token ? { ...current, ...profile, ...(revision === profileSkillsRevision.current ? { profileSkills: (user.skills || '').split(',').map(skill => skill.trim()).filter(Boolean), profileSkillsError: false } : {}) } : current);
    }).catch(error => { if (active && error.status === 401) logout(); else if (active) setAuth(current => current?.token === token ? { ...current, profileSkillsError: true } : current); });
    return () => { active = false; };
  }, [auth?.token]);

  useEffect(() => {
    const expire = () => logout("Your session expired. Please sign in again.");
    window.addEventListener("novateck-session-expired", expire);
    return () => window.removeEventListener("novateck-session-expired", expire);
  }, []);

  useEffect(() => {
    if (!auth?.token) return;
    let timer;
    let lastActivity = Number(sessionStorage.getItem(SESSION_ACTIVITY_KEY));
    const activityEvents = ["pointerdown", "touchstart", "keydown", "input", "scroll"];

    function checkSession() {
      window.clearTimeout(timer);
      const remaining = sessionTimeRemaining(lastActivity);
      if (remaining <= 0) {
        logout(`You were signed out after ${SESSION_IDLE_MINUTES} minutes of inactivity.`);
        return false;
      }
      timer = window.setTimeout(checkSession, remaining);
      return true;
    }

    function recordActivity(event) {
      if (!event.isTrusted || document.hidden || !checkSession()) return;
      const now = Date.now();
      if (now - lastActivity < 1000) return;
      lastActivity = now;
      sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
      checkSession();
    }

    checkSession();
    for (const event of activityEvents) document.addEventListener(event, recordActivity, { capture: true, passive: true });
    document.addEventListener("visibilitychange", checkSession);
    window.addEventListener("pageshow", checkSession);
    window.addEventListener("pagehide", checkSession);
    window.addEventListener("focus", checkSession);
    return () => {
      window.clearTimeout(timer);
      for (const event of activityEvents) document.removeEventListener(event, recordActivity, true);
      document.removeEventListener("visibilitychange", checkSession);
      window.removeEventListener("pageshow", checkSession);
      window.removeEventListener("pagehide", checkSession);
      window.removeEventListener("focus", checkSession);
    };
  }, [auth?.token]);

  useEffect(() => {
    const updateSkills = event => {
      profileSkillsRevision.current += 1;
      setAuth(current => String(current?.user_id) === String(event.detail.userId) ? { ...current, profileSkills: Array.isArray(event.detail.skills) ? event.detail.skills : String(event.detail.skills || '').split(',').map(skill => skill.trim()).filter(Boolean), profileSkillsError: false } : current);
    };
    window.addEventListener('novateck-profile-skills-saved', updateSkills);
    return () => window.removeEventListener('novateck-profile-skills-saved', updateSkills);
  }, []);

  function login(token, user) {
    clearSession();
    sessionStorage.setItem("nt_token", token);
    sessionStorage.setItem("nt_user", JSON.stringify(user));
    sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
    setSessionMessage("");
    setAuth({ token, ...user });
    setPage("home");
  }

  function logout(message = "") {
    clearSession();
    setSessionMessage(message);
    setSelectedJobId(null);
    window.history.replaceState(null, "", "/");
    setAuth(null);
    setPage("login");
  }

  function updateDisplayName(name) {
    setAuth(current => {
      const updated = { ...current, name };
      sessionStorage.setItem("nt_user", JSON.stringify({ user_id: updated.user_id, name, role: updated.role }));
      return updated;
    });
  }

  useEffect(() => {
    if (/^#(?::r|job-section-)/.test(window.location.hash)) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    window.scrollTo(0, 0);
  }, [page, selectedJobId]);

  useEffect(() => {
    const restorePage = event => {
      if (!auth?.token || !event.state?.novaPage) return;
      setSelectedJobId(event.state.novaJobId || null);
      setPage(event.state.novaPage);
    };
    window.addEventListener('popstate', restorePage);
    return () => window.removeEventListener('popstate', restorePage);
  }, [auth?.token]);
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
      <div className={`app-shell${["home", "jobs", "detail", "dashboard", "profile", "skillgap"].includes(page) ? " lp-aligned-shell" : ""}`}>
        {!["login", "register"].includes(page) && <Navbar page={page} setPage={setPage} logout={() => logout()} auth={auth} theme={theme} deviceTheme={deviceTheme} setTheme={setTheme} />}
        <div className="nova-page-container">
          {page === "login"     && <LoginPage onLogin={login} setPage={setPage} sessionMessage={sessionMessage} />}
          {page === "register"  && <RegisterPage onLogin={login} setPage={setPage} registrationLink={registrationLink} />}
          {page === "forgot"    && <ForgotPasswordPage setPage={setPage} />}
          {page === "reset"     && <ResetPasswordPage setPage={setPage} />}
          {page === "home" && auth && <HomePage browseField={field=>{setHomeFocus(field);setPage('jobs');}} setPage={setPage} auth={auth} request={apiFetch} goJob={goJob} />}
          {page === "jobs"      && <JobListingsPage initialFocus={homeFocus} goJob={goJob} onProfile={() => setPage('profile')} />}
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
      <button className="nova-brand nova-logo-button" onClick={() => setPage(auth ? 'home' : 'login')} aria-label="NovaTeck home"><NovaBadge size={64} /></button>
      <button type="button" className="nova-mobile-menu" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="nova-navigation-links" onClick={() => setMobileOpen(value => !value)}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={mobileOpen ? 'M6 6l12 12M6 18 18 6' : 'M4 6h16M4 12h16M4 18h16'} /></svg></button>
      <div className="nova-nav-links" id="nova-navigation-links">
        {auth && tabs.map(([key, label]) => <button key={key} className="nova-nav-tab" aria-current={page === key ? 'page' : undefined} onClick={() => setPage(key)}><NavIcon name={key} />{label}</button>)}
        {auth && <CareerChat key={auth.user_id} token={auth.token} profileSkills={auth.profileSkills} />}
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
function LoginPage({ onLogin, setPage, sessionMessage }) {
  const [form, setForm] = useState({ email: "", password: "" });
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
      onLogin(data.token, { user_id: data.user_id, name: data.name, role: data.role });
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <AuthLayout title="Sign In" variant="login" setPage={setPage}>
      <form className="auth-form" onSubmit={event => { event.preventDefault(); handleSubmit(); }}>
        {(err || sessionMessage) && <div className="auth-form-message"><Alert msg={err || sessionMessage} /></div>}
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
  const [token, setToken] = useState(() => !auth && registrationLink.token ? "register" : new URLSearchParams(window.location.search).get("resetToken") || "");
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
function RegisterPage({ onLogin, setPage, registrationLink }) {
  const [verificationToken, setVerificationToken] = useState(registrationLink.token);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", email: registrationLink.email, password: "", confirmPassword: "" });
  const [err, setErr] = useState("");
  const [errors, setErrors] = useState({});
  function updateField(field, value) {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: "", ...(field === "password" ? { confirmPassword: "" } : {}) }));
    setErr("");
    if (field === "email") {
      setVerificationToken(null);
      setNotice("");
    }
  }
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setErr("");
    setNotice("");
    const nextErrors = {};
    if (!EMAIL_PATTERN.test(form.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!form.name.trim()) nextErrors.name = "Enter your full name.";
    if (!PASSWORD_PATTERN.test(form.password)) nextErrors.password = "Use 8+ characters with uppercase, lowercase, and a number.";
    if (!form.confirmPassword || form.confirmPassword !== form.password) nextErrors.confirmPassword = "Passwords do not match.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setLoading(true);
    try {
      if (verificationToken) {
        const { name, email, password } = form;
        const data = await apiFetch("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password, verification_token: verificationToken }) });
        onLogin(data.token, { user_id: data.user_id, name: data.name });
      } else {
        const data = await apiFetch("/auth/register/request", { method: "POST", body: JSON.stringify({ email: form.email }) });
        setNotice(data.message);
      }
    } catch (error) {
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  }

  const strength = !form.password ? 0 : !PASSWORD_PATTERN.test(form.password) ? 1 : form.password.length < 12 ? 2 : 3;
  const strengthLabel = ["Weak", "Weak", "Medium", "Strong"][strength];
  return (
    <AuthLayout title="Create an Account" variant="register" setPage={setPage}>
      <form className="auth-form" noValidate onSubmit={event => { event.preventDefault(); handleSubmit(); }}>
        {err && <div className="auth-form-message"><Alert msg={err} /></div>}
        {notice && <p className="auth-form-message" role="status">{notice}</p>}
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
        <div className="auth-actions">
          <button className="primary-button auth-submit" type="submit" disabled={loading}>
            {loading ? (verificationToken ? "Creating account…" : "Sending verification link…") : "Create Account"}
          </button>
          {verificationToken && <button className="text-button" type="button" disabled={loading} onClick={() => { setVerificationToken(null); setErr(""); }}>Request a New Link</button>}
        </div>
        <div className="auth-links">
          <p className="nova-policy-links"><a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a> · <a href="/terms.html" target="_blank" rel="noopener">Terms of Use</a></p>
          <p>Already have an account? <button className="text-button" type="button" onClick={() => setPage("login")}>Sign In Here</button></p>
          <p><button className="text-button" type="button" onClick={() => setPage("forgot")}>Forgot Password?</button></p>
        </div>
      </form>
    </AuthLayout>
  );
}

// JobListingsPage
function JobListingsPage({ goJob, initialFocus, onProfile }) {
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
  const displayedJobs = useMemo(() => sort === 'match'
    ? sortJobsByProfileMatch(jobs, auth?.profileSkills).slice(page * 20, (page + 1) * 20)
    : jobs, [jobs, sort, page, auth?.profileSkills]);
  const [msg, setMsg]           = useState("");
  const [listError, setListError] = useState('');
  const [applied, setApplied] = useState({ query: '', skill: [], location: '', companyId: '', experience: '', workTypes: [], focus: initialFocus ? [initialFocus] : [] });
  const lastAttempt = useRef(null);
  const loadSequence = useRef(0);

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
  async function load(nextPage = page, resetFilters = false, nextSort = sort, nextFocus = focus, override = null) {
    const selected = override || (resetFilters ? { query: '', skill: [], location: '', companyId: '', experience: '', workTypes: [], focus: [] } : { query, skill, location, companyId, experience, workTypes, focus: nextFocus });
    lastAttempt.current = { selected, nextPage, nextSort };
    const sequence = ++loadSequence.current;
    setListError('');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("sort", nextSort);
      selected.focus.forEach(value => params.append("discipline", value));
      if (selected.query) params.append("q", selected.query);
      selected.skill.forEach(value => params.append("skill", value));
      if (selected.location) params.append("location", selected.location);
      if (selected.companyId) params.append("company_id", selected.companyId);
      if (selected.experience) params.append("experience", selected.experience);
      if (selected.workTypes.length) params.append("work_type", selected.workTypes.join(","));
      params.append("limit", nextSort === "match" ? "500" : "20");
      params.append("offset", nextSort === "match" ? "0" : String(nextPage * 20));
      const [data, count] = await Promise.all([
        apiFetch(`/jobs?${params}`, {}, auth?.token),
        apiFetch(`/jobs/count?${params}`, {}, auth?.token),
      ]);
      if (sequence !== loadSequence.current) return;
      const rows = Array.isArray(data) ? [...data] : [];
      if (nextSort === 'match') {
        for (let offset = 500; offset < (count.total || 0); offset += 500) {
          params.set('offset', String(offset));
          const more = await apiFetch(`/jobs?${params}`, {}, auth?.token);
          if (sequence !== loadSequence.current) return;
          if (!Array.isArray(more) || !more.length) break;
          rows.push(...more);
        }
      }
      setApplied(selected);
      setJobs(rows);
      setTotal(count.total || 0);
      setPage(nextPage);
      setMsg("");
      setLoading(false);
      return count.total || 0;
    } catch (error) { if (sequence !== loadSequence.current) return; setJobs([]); setTotal(0); setListError(error.message); }
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

  function retryJobs() {
    const attempt = lastAttempt.current;
    if (attempt) load(attempt.nextPage, false, attempt.nextSort, attempt.selected.focus, attempt.selected);
    else load(0);
  }
  function removeFilter(key, value) {
    const next = { ...applied };
    if (Array.isArray(next[key])) next[key] = next[key].filter(item => item !== value);
    else if (key === 'experience') next.experience = next.experience.split(',').filter(item => item !== value).join(',');
    else next[key] = '';
    setQuery(next.query); setSkill(next.skill); setLocation(next.location); setCompanyId(next.companyId); setExperience(next.experience); setWorkTypes(next.workTypes); setFocus(next.focus);
    load(0, false, sort, next.focus, next);
  }
  const activeChips = [
    ...(applied.query ? [{ key: 'query', value: applied.query, label: `Search: ${applied.query}` }] : []),
    ...applied.focus.map(value => ({ key: 'focus', value, label: careerCategories.find(([key]) => key === value)?.[1] || value })),
    ...applied.skill.map(value => ({ key: 'skill', value, label: value })),
    ...applied.workTypes.map(value => ({ key: 'workTypes', value, label: value })),
    ...applied.experience.split(',').filter(Boolean).map(value => ({ key: 'experience', value, label: ({ entry: 'Entry / intern', mid: 'Mid-level', senior: 'Senior / lead' })[value] || value })),
    ...(applied.location ? [{ key: 'location', value: applied.location, label: applied.location }] : []),
    ...(applied.companyId ? [{ key: 'companyId', value: applied.companyId, label: options.companies.find(company => String(company.company_id) === String(applied.companyId))?.name || 'Selected company' }] : []),
  ];

  return (
    <main className="wf-page lp-jobs">
      <p className="nova-eyebrow">FIND YOUR NEXT MOVE</p><h1>Your next opportunity.</h1>
      <p className="nova-jobs-subtitle">Explore technology roles in DFW. Find the work that moves you forward.</p>

      <form className="wf-search-row nova-job-search" role="search" onSubmit={event => { event.preventDefault(); applyFilters(); }}><div className="nova-job-search-input"><NavIcon name="jobs" /><input id="job-search" aria-label="Search jobs" placeholder="Search job titles, companies, or keywords" value={query} onChange={event => setQuery(event.target.value)} /></div><button type="submit" className="primary-button" disabled={loading}>Search jobs <span aria-hidden="true">↗</span></button></form>
      <div className="nova-filter-toolbar"><button type="button" className="wf-secondary" aria-expanded={filtersOpen} aria-controls="job-filters" onClick={() => setFiltersOpen(open => !open)}>Filters ({filterCount})</button><button type="button" className="text-button" onClick={clearFilters} disabled={loading}>Clear all</button><span role="status">{filterFeedback || "Select filters, then apply to update your search."}</span></div>
      {activeChips.length > 0 && <div className="lp-active-filters" aria-label="Active filters">{activeChips.map(chip => <button type="button" disabled={loading} key={`${chip.key}:${chip.value}`} onClick={() => removeFilter(chip.key, chip.value)} aria-label={`Remove filter: ${chip.label}`}>{chip.label}<span aria-hidden="true">×</span></button>)}</div>}
      <section id="job-filters" hidden={!filtersOpen} className="wf-filters nova-filter-panel"><header className="nova-filter-heading"><div className="nova-filter-title"><span className="nova-filter-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6" /></svg></span><div><h2>Filters</h2><p>Fine-tune your next opportunity.</p></div></div><span className="nova-filter-count">{filterCount} selected</span></header>
        <div className="wf-field"><span id="job-focus-label">Career Focus</span><details className="nova-skill-select"><summary aria-labelledby="job-focus-label job-focus-summary"><span id="job-focus-summary">{focus.length === 1 ? careerCategories.find(([value]) => value === focus[0])?.[1] : focus.length ? `${focus.length} career fields selected` : 'All Career Categories'}</span><span aria-hidden="true">⌄</span></summary><div className="nova-skill-options"><button type="button" className="text-button" onClick={() => setFocus([])}>All Career Categories</button>{careerCategories.filter(([value]) => value).map(([value, label]) => <label key={value}><input type="checkbox" checked={focus.includes(value)} onChange={event => setFocus(current => event.target.checked ? [...current, value] : current.filter(item => item !== value))} />{label}</label>)}</div></details></div><div className="wf-field"><span>Work Type</span><div className="wf-inline">{['Full-time', 'Part-time', 'Contract', 'Internship'].map(type => <button type="button" className="nova-filter-pill" key={type} aria-pressed={workTypes.includes(type)} onClick={() => setWorkTypes(current => current.includes(type) ? current.filter(t => t !== type) : [...current, type])}>{type}</button>)}</div></div>
        <div className="wf-field"><span id="job-skill-label">Skills</span><details className="nova-skill-select"><summary aria-labelledby="job-skill-label job-skill-summary"><span id="job-skill-summary">{skill.length ? `${skill.length} skills selected` : 'All skills'}</span><span aria-hidden="true">⌄</span></summary><div className="nova-skill-options"><button type="button" className="text-button" onClick={() => setSkill([])}>Clear selected skills</button>{options.skills.map(value => <label key={value}><input type="checkbox" checked={skill.includes(value)} onChange={event => setSkill(current => event.target.checked ? [...current, value] : current.filter(item => item !== value))} />{value}</label>)}</div></details></div>
        <div className="wf-field"><span>Experience</span><div className="wf-inline">{[['entry','Entry / intern'],['mid','Mid-level'],['senior','Senior / lead']].map(([value,label]) => <button type="button" className="nova-filter-pill" key={value} aria-pressed={experience.split(',').includes(value)} onClick={() => setExperience(current => current.split(',').includes(value) ? current.split(',').filter(v => v !== value).join(',') : [...current.split(',').filter(Boolean), value].join(','))}>{label}</button>)}</div></div>
        <div className="wf-field"><span>Location / Company</span><div className="wf-inline"><input placeholder="City or location" aria-label="Filter by location" value={location} onChange={e => setLocation(e.target.value)} list="location-options" /><datalist id="location-options">{options.locations.map(value => <option key={value} value={value} />)}</datalist><select aria-label="Filter by company" value={companyId} onChange={e => setCompanyId(e.target.value)}><option value="">All companies</option>{options.companies.map(c => <option key={c.company_id} value={c.company_id}>{c.name}</option>)}</select></div></div>
      <footer className="nova-filter-footer"><span role="status" className={filterFeedback ? "nova-filter-success" : ""}>{filterFeedback || (loading ? "Applying your filters…" : "Choose your filters, then apply to update results.")}</span><div><button className="wf-secondary" onClick={clearFilters} disabled={loading}>Reset</button><button className="primary-button" onClick={applyFilters} disabled={loading}>{loading ? 'Applying…' : 'Apply Filters'}</button></div></footer>
      </section>
      {msg && <p className="lp-job-action-message" role="alert">{msg}</p>}

      {loading ? <JobsSkeleton /> : listError ? <JobsError message={listError} onRetry={retryJobs} /> : (
        <>
          <div className="nova-results-heading"><div className="nova-results-title"><h2>Results</h2><p role="status">{total} opportunities in DFW</p><small className="lp-sort-note">Best match uses your profile skills. Scored jobs appear first; jobs without enough skill data follow.</small></div><label>Sort by <select value={sort} onChange={event => { setSort(event.target.value); load(0, false, event.target.value); }}><option value="match">Best match</option><option value="newest">Newest posted</option></select></label></div>
          {jobs.length === 0 ? <JobsEmpty onClear={clearFilters} /> : <div className="lp-jobs-grid">
            {displayedJobs.map(job => (
              <LaunchpadJobCard profileSkills={auth?.profileSkills} profileError={auth?.profileSkillsError} onProfile={onProfile} key={job.job_id} job={job} goJob={goJob} saved={savedIds.includes(job.job_id)} onSave={toggleSave} busy={!savedReady || saving !== null} onApply={trackOpening} applicationStatus={applicationStatuses[job.job_id]} />
            ))}
          </div>}
          {jobs.length > 0 && <div className="lp-jobs-pagination">
            <button onClick={() => sort === 'match' ? setPage(page - 1) : load(page - 1)} disabled={page === 0} className="wf-secondary">Previous</button>
            <span>Page {page + 1} of {Math.max(1, Math.ceil(total / 20))}</span>
            <button onClick={() => sort === 'match' ? setPage(page + 1) : load(page + 1)} disabled={(page + 1) * 20 >= total} className="wf-secondary">Next</button>
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
