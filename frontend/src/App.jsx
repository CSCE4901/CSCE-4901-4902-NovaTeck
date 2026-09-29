import HomePage from "./components/HomePage";
import { responseError } from "./apiErrors";
import { useState, useEffect, createContext, useContext } from "react";
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
  const [page, setPage] = useState(() => new URLSearchParams(window.location.search).get("resetToken") ? "reset" : (auth ? (["/admin", "/admin/flagged-skills"].includes(window.location.pathname) ? "admin" : "jobs") : "login"));
  const [selectedJobId, setSelectedJobId] = useState(null);

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

  useEffect(() => { window.scrollTo(0, 0); }, [page, selectedJobId]);

  function goJob(id) { setSelectedJobId(id); setPage("detail"); }

  return (
    <AuthContext.Provider value={auth}>
      <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "Segoe UI, sans-serif" }}>
        {!["login", "register"].includes(page) && <Navbar page={page} setPage={setPage} logout={logout} auth={auth} />}
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
          {page === "login"     && <LoginPage onLogin={login} setPage={setPage} />}
          {page === "register"  && <RegisterPage onLogin={login} setPage={setPage} />}
          {page === "forgot"    && <ForgotPasswordPage setPage={setPage} />}
          {page === "reset"     && <ResetPasswordPage setPage={setPage} />}
          {page === "home" && auth && <HomePage setPage={setPage} />}
          {page === "jobs"      && <JobListingsPage goJob={goJob} />}
          {page === "detail"    && <WireJobDetail auth={auth} request={apiFetch} jobId={selectedJobId} goJob={goJob} setPage={setPage} />}
          {page === "dashboard" && <WireDashboard auth={auth} request={apiFetch} goJob={goJob} setPage={setPage} />}
          {page === "profile" && <WireProfile auth={auth} request={apiFetch} onNameChange={updateDisplayName} setPage={setPage} />}
          {page === "skillgap"  && <WireSkillGap auth={auth} request={apiFetch} setPage={setPage} />}
          {page === "admin" && auth && <WireAdmin auth={auth} request={apiFetch} onForbidden={() => { window.history.replaceState({}, "", "/"); setPage("dashboard"); }} />}
        </div>
      </div>
    </AuthContext.Provider>
  );
}

// Navbar
function Navbar({ page, setPage, logout, auth }) {
  const active = p => ({
    cursor: "pointer", padding: "8px 16px", borderRadius: 6,
    background: page === p ? "#1e40af" : "transparent",
    color: "#fff", fontWeight: page === p ? 700 : 400,
    border: "none", fontSize: 14,
  });
  return (
    <nav style={{ background: "#1e3a8a", padding: "0 24px", display: "flex", alignItems: "center", gap: 4, height: 56 }}>
      <span style={{ color: "#93c5fd", fontWeight: 800, fontSize: 18, marginRight: 24 }}>
        🚀 NovaTeck
      </span>
      {auth && <button style={active("home")} onClick={() => setPage("home")}>Home</button>}
      {auth && <button style={active("jobs")} onClick={() => setPage("jobs")}>Jobs</button>}
      {auth && <button style={active("dashboard")} onClick={() => setPage("dashboard")}>Dashboard</button>}
      {auth && <button style={active("profile")} onClick={() => setPage("profile")}>Profile</button>}
      {auth && <button style={active("skillgap")} onClick={() => setPage("skillgap")}>Skill Gap</button>}
      {auth?.role === "admin" && <button style={active("admin")} onClick={() => setPage("admin")}>Admin</button>}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        {auth ? (
          <>
            <button onClick={logout} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>Logout</button>
          </>
        ) : (
          <>
            <button onClick={() => setPage("login")} style={{ background: "transparent", color: "#bfdbfe", border: "1px solid #3b82f6", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>Login</button>
            <button onClick={() => setPage("register")} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>Register</button>
          </>
        )}
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
    <header className="auth-brand-row"><button type="button" className="auth-brand" onClick={() => setPage("login")} aria-label="NovaTeck home">🚀 NovaTeck</button></header>
    <h1 className="auth-title">{title}</h1>
    {children}
  </main>;
}

function AuthField({ id, label, type = "text", value, onChange, autoComplete, children, describedBy }) {
  return <div className="auth-field">
    <label htmlFor={id}>{label} :</label>
    <div className="auth-field-control">
      <input id={id} name={id} type={type} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} required aria-describedby={describedBy} />
      {children}
    </div>
  </div>;
}

function ForgotPasswordPage({ setPage }) {
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

function ResetPasswordPage({ setPage }) {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get("resetToken") || "");
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [message, setMessage] = useState("");
  async function submit() {
    if (!PASSWORD_PATTERN.test(password)) return setMessage("Use 8+ characters with uppercase, lowercase, and a number.");
    if (password !== confirm) return setMessage("Passwords do not match.");
    try { setMessage((await apiFetch("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, password }) })).message); window.history.replaceState({}, "", window.location.pathname); setToken(""); setTimeout(() => setPage("login"), 1200); }
    catch (e) { setMessage(e.message); }
  }
  return <div style={{ maxWidth: 420, margin: "60px auto" }}><Card>
    <h2 style={hStyle}>Choose a New Password</h2>{message && <p style={{ color: "#047857", fontSize: 14 }}>{message}</p>}
    <Label>Reset token</Label><Input label="Reset token" value={token} onChange={setToken} placeholder="From your reset email" />
    <Label>New password</Label><Input label="New password" type="password" value={password} onChange={setPassword} />
    <Label>Confirm password</Label><Input label="Confirm password" type="password" value={confirm} onChange={setConfirm} />
    <Btn onClick={submit} full>Update Password</Btn>
  </Card></div>;
}

// RegisterPage
function RegisterPage({ onLogin, setPage }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [err, setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setErr("");
    if (!EMAIL_PATTERN.test(form.email.trim())) {
      setErr("Enter a valid email address.");
      return;
    }
    if (!PASSWORD_PATTERN.test(form.password)) {
      setErr("Use 8+ characters with uppercase, lowercase, and a number.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { confirmPassword, ...registration } = form;
      const data = await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(registration) });
      onLogin(data.token, { user_id: data.user_id, name: data.name });
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  const strength = !form.password ? 0 : !PASSWORD_PATTERN.test(form.password) ? 1 : form.password.length < 12 ? 2 : 3;
  const strengthLabel = ["", "Weak", "Medium", "Strong"][strength];
  return (
    <AuthLayout title="Create an Account" variant="register" setPage={setPage}>
      <form className="auth-form" onSubmit={event => { event.preventDefault(); handleSubmit(); }}>
        {err && <div className="auth-form-message"><Alert msg={err} /></div>}
        <AuthField id="register-name" label="Full Name" autoComplete="name" value={form.name} onChange={name => setForm(current => ({ ...current, name }))} />
        <AuthField id="register-email" label="Email address" type="email" autoComplete="email" value={form.email} onChange={email => setForm(current => ({ ...current, email }))} />
        <AuthField id="register-password" label="Password" type="password" autoComplete="new-password" value={form.password} onChange={password => setForm(current => ({ ...current, password }))} describedBy="password-strength">
          <div id="password-strength" className="auth-password-strength" aria-live="polite" title="Use 8+ characters with uppercase, lowercase, and a number.">
            <span>Password Strength:</span>
            <meter min="0" max="3" low="1.5" high="2.5" optimum="3" value={strength} aria-label={`Password strength${strengthLabel ? `: ${strengthLabel}` : ': not entered'}`} />
            <span>{strengthLabel}</span>
          </div>
        </AuthField>
        <AuthField id="register-confirm" label="Confirm Password" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={confirmPassword => setForm(current => ({ ...current, confirmPassword }))} />
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
function JobListingsPage({ goJob }) {
  const auth = useAuth();
  const [jobs, setJobs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery] = useState("");
  const [skill, setSkill]       = useState("");
  const [location, setLocation] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [experience, setExperience] = useState("");
  const [workTypes, setWorkTypes] = useState([]);
  const [options, setOptions]   = useState({ skills: [], companies: [], locations: [] });
  const [page, setPage]         = useState(0);
  const [total, setTotal]       = useState(0);
  const [msg, setMsg]           = useState("");

  async function load(nextPage = page, resetFilters = false) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!resetFilters && query) params.append("q", query);
      if (!resetFilters && skill) params.append("skill", skill);
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
    } catch (error) { setJobs([]); setTotal(0); setMsg(error.message); }
    setLoading(false);
  }

  useEffect(() => {
    apiFetch("/search-options", {}, auth?.token).then(setOptions).catch(() => {});
    load(0);
  }, []);

  function clearFilters() {
    setWorkTypes([]); setQuery(""); setSkill(""); setLocation(""); setCompanyId(""); setExperience("");
    load(0, true);
  }

  return (
    <main className="wf-page">
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e3a8a", marginBottom: 4 }}>DFW Tech Jobs</h1>
      <p style={{ color: "#6b7280", marginBottom: 20 }}>Browse and filter jobs from top DFW technology companies</p>

      <div className="wf-search-row"><label htmlFor="job-search">Search</label><input id="job-search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === "Enter" && load(0)} /><button className="primary-button" onClick={() => load(0)}>Search</button></div>
      <section className="wf-filters"><h2>Filters</h2>
        <div className="wf-field"><span>Work Type</span><div className="wf-inline">{['Full-time', 'Part-time', 'Contract'].map(type => <label key={type}><input type="checkbox" checked={workTypes.includes(type)} onChange={e => setWorkTypes(e.target.checked ? [...workTypes, type] : workTypes.filter(t => t !== type))} /> {type}</label>)}</div></div>
        <div className="wf-field"><span>Skills</span><div className="wf-tags">{['Python', 'SQL', 'React', 'Java'].map(value => <button className="wf-tag" aria-pressed={skill === value} key={value} onClick={() => setSkill(skill === value ? '' : value)}>{value}</button>)}<input aria-label="Filter by skill" value={skill} onChange={e => setSkill(e.target.value)} list="skill-options" /><datalist id="skill-options">{options.skills.map(value => <option key={value} value={value} />)}</datalist></div></div>
        <div className="wf-field"><span>Experience</span><div className="wf-inline">{[['entry','Entry / intern'],['mid','Mid-level'],['senior','Senior / lead']].map(([value,label]) => <label key={value}><input type="checkbox" checked={experience.split(',').includes(value)} onChange={e => setExperience(e.target.checked ? [...experience.split(',').filter(Boolean),value].join(',') : experience.split(',').filter(v => v !== value).join(','))} /> {label}</label>)}</div></div>
        <div className="wf-field"><span>Location / Company</span><div className="wf-inline"><input aria-label="Filter by location" value={location} onChange={e => setLocation(e.target.value)} list="location-options" /><datalist id="location-options">{options.locations.map(value => <option key={value} value={value} />)}</datalist><select aria-label="Filter by company" value={companyId} onChange={e => setCompanyId(e.target.value)}><option value="">All companies</option>{options.companies.map(c => <option key={c.company_id} value={c.company_id}>{c.name}</option>)}</select><button className="wf-secondary" onClick={clearFilters}>Clear Filters</button></div></div>
      </section>
      <h2>Results</h2>
      {msg && <div style={{ background: "#d1fae5", color: "#065f46", padding: "10px 16px", borderRadius: 8, marginBottom: 16 }}>{msg}</div>}

      {loading ? <Spinner /> : (
        <>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>{total} jobs found</p>
          <div style={{ display: "grid", gap: 16 }}>
            {jobs.map(job => (
              <div key={job.job_id} style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                      <button type="button" className="text-button wf-job-title" onClick={() => goJob(job.job_id)}>{job.title}</button>
                    </h3>
                    <p style={{ margin: "4px 0 0", color: "#374151", fontSize: 14 }}>
                      {job.company_name} · {job.location}
                    </p>
                    {job.skill_summary && <p style={{ margin: "8px 0 0", color: "#1e40af", fontSize: 12 }}>Required skills: {job.skill_summary.split(", ").slice(0, 5).join(" · ")}</p>}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    {job.salary_range && <span style={tagStyle("#d1fae5", "#065f46")}>Salary: {job.salary_range}</span>}
                  </div>
                </div>
                <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>Posted: {job.date_posted || "N/A"}</span>

                </div>
              </div>
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
