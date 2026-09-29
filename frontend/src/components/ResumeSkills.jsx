import { useState, useEffect, useRef } from 'react';
import { responseError } from '../apiErrors';

export default function ResumeSkills({ token, onProcessed, compact = false, profileUpload = false }) {
  const uploadInput = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [saved, setSaved] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [skills, setSkills] = useState([]);
  async function loadSaved() {
    const response = await fetch('/api/resume/saved', { headers: { Authorization: `Bearer ${token}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(response.status === 404 ? 'Saved resumes are temporarily unavailable. Please try again.' : responseError(response.status, result.error));
    setSaved(result); setSkills(result?.skills || []); setLoadError('');
  }
  async function retrySaved() {
    setMessage(''); setLoadError('');
    try { await loadSaved(); }
    catch (error) { setLoadError(error.message); }
  }
  useEffect(() => { retrySaved(); }, [token]);
  async function previewSaved() {
    try {
      const response = await fetch('/api/resume/saved/file', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Could not open your saved resume. Please try again.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url;
      if (saved.filename.toLowerCase().endsWith('.pdf')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      else link.download = saved.filename;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { setMessage(error.message); }
  }
  async function scan(uploadFile = file) {
    if (!uploadFile && !saved) return;
    setBusy(true); setMessage('Scanning resume for skills…');
    const form = new FormData(); if (uploadFile) form.append('resume', uploadFile);
    try {
      const response = await fetch(uploadFile ? '/api/resume/upload' : '/api/resume/saved/scan', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, ...(uploadFile ? { body: form } : {}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Resume processing failed.');
      await loadSaved(); setSkills(result.skills); setFile(null); setMessage(profileUpload ? 'Resume saved.' : result.message); onProcessed?.();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  function selectResume(selected) {
    if (!selected || busy) return;
    if (!/\.(pdf|docx)$/i.test(selected.name) || selected.size > 5 * 1024 * 1024) {
      setMessage('Choose a PDF or DOCX file up to 5 MB.'); return;
    }
    scan(selected);
  }
  if (profileUpload) return <div className="profile-resume-upload">
    <div className="profile-resume-row">
      <input ref={uploadInput} type="file" accept=".pdf,.docx" hidden disabled={busy} aria-label="Upload resume" onChange={event => { selectResume(event.target.files?.[0]); event.target.value = ''; }} />
      <button type="button" className={`profile-resume-dropzone${dragging ? ' is-dragging' : ''}`} disabled={busy}
        onClick={() => uploadInput.current?.click()}
        onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length > 1) { setMessage('Choose one resume at a time.'); return; } selectResume(event.dataTransfer.files[0]); }}>
        <span>{busy ? 'Saving resume…' : 'Drag & drop or click to upload'}</span>
        <small>Accepted formats: PDF or DOCX · Up to 5 MB</small>
      </button>
      <div className="profile-current-resume"><span>Current Resume</span>
        {saved ? <button type="button" className="text-button" onClick={previewSaved}>{saved.filename}</button> : <span className="wf-muted">No resume uploaded</span>}
      </div>
    </div>
    {loadError && <p role="alert">{loadError} <button type="button" className="wf-secondary" onClick={retrySaved}>Retry</button></p>}
    {message && <p role="status">{message}</p>}
  </div>;
  return <section className={`resume-panel ${compact ? "resume-panel--compact" : ""}`} aria-labelledby="resume-heading">
    <h3 id="resume-heading">Resume Skill Detection</h3>
    <p>Choose your PDF or DOCX resume (up to 5 MB). Review detected skills and choose which ones to add to your profile.</p>
    {loadError && <p role="alert">{loadError} <button type="button" className="wf-secondary" onClick={retrySaved}>Retry</button></p>}
    {saved && <p><strong>Saved resume:</strong> {saved.filename} <button type="button" className="text-button" onClick={previewSaved}>{saved.filename.toLowerCase().endsWith('.pdf') ? 'Preview' : 'Download'}</button></p>}
    <label>{saved ? 'Replace resume' : 'Resume file'} <input key={saved?.updated_at || 'new'} type="file" accept=".pdf,.docx" disabled={busy} onChange={event => { setFile(event.target.files?.[0] || null); setMessage(''); setSkills([]); }} /></label>
    <button type="button" className="primary-button" disabled={(!file && !saved) || busy} onClick={() => scan()}>{busy ? 'Scanning…' : 'Scan Resume for Skills'}</button>
    <p role="status" aria-live="polite">{message}</p>
    {skills.length > 0 && <p><strong>Detected skills:</strong> {skills.join(', ')}</p>}
    {file?.type === 'application/pdf' && <button type="button" onClick={() => { const url = URL.createObjectURL(file); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60000); }}>Preview selected PDF</button>}
    <small>Your latest resume is saved to your account for previewing and rescanning. Uploading a new file replaces it.</small>
  </section>;
}

export function PendingSkills({ skills = [], token, onAdded }) {
  const [busy, setBusy] = useState(null);
  const [failure, setFailure] = useState(null);
  async function add(skill) {
    setBusy(skill.unmatched_id); setFailure(null);
    try {
      const response = await fetch(`/api/resume/skills/${skill.unmatched_id}/add`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(responseError(response.status, result.error));
      onAdded?.();
    } catch (error) { setFailure({ text: error.message }); }
    finally { setBusy(null); }
  }
  return <section className="resume-panel"><h3>Flagged skills: Not in System</h3>
    {skills.length > 0 && <p>These resume skills are missing from your profile. Choose the ones you want to add.</p>}
    {failure?.text && <p role="alert">{failure.text}</p>}
    {!skills.length && <p className="flagged-skills-empty">No new skills to add. Scan your resume to check for more.</p>}
    {skills.map(skill => <div key={skill.unmatched_id} className="pending-skill">
      <strong>{skill.skill_name}</strong><button type="button" className="primary-button" disabled={busy !== null} onClick={() => add(skill)} aria-label={`Add ${skill.skill_name} to profile`}>{busy === skill.unmatched_id ? 'Adding…' : 'Add to Profile'}</button>
    </div>)}
  </section>;
}

export function AdminReview({ token, onForbidden, embedded = false }) {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/flagged-skills', { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 403) { onForbidden(); return; }
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setRows(data); setMessage(data.length ? '' : 'No resume skills are pending review. Scan your resume to check for skills missing from your profile.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [token]);
  async function review(id, action) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/${action}-skill/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 403) { onForbidden(); return; }
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      await load();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section>{!embedded && <h1>Admin Dashboard</h1>}<h2>Flagged Skills Review</h2>
    <button type="button" className="primary-button" onClick={load} disabled={busy}>Load / Refresh Queue</button>
    <p role="status">{message}</p>
    <div className="table-scroll"><table><thead><tr>{['Skill Name', 'Submitted By', 'Date Flagged', 'Actions'].map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.unmatched_id}><td>{row.skill_name}</td><td>{row.submitted_by}</td><td>{row.date_flagged}</td><td>
        <button type="button" className="approve-button" disabled={busy} onClick={() => review(row.unmatched_id, 'approve')}>Approve {row.skill_name}</button>{' '}
        <button type="button" className="reject-button" disabled={busy} onClick={() => review(row.unmatched_id, 'reject')}>Reject {row.skill_name}</button>
      </td></tr>)}</tbody></table></div>
  </section>;
}
