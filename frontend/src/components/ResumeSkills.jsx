import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { responseError } from '../apiErrors';

export default function ResumeSkills({ token, onProcessed, compact = false, profileUpload = false }) {
  const uploadInput = useRef(null), previewDialog = useRef(null);
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!preview) return;
    previewDialog.current?.showModal();
    return () => { if (preview.url) URL.revokeObjectURL(preview.url); };
  }, [preview]);
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
      const isPdf = saved.filename.toLowerCase().endsWith('.pdf');
      const response = await fetch(isPdf ? '/api/resume/saved/file' : '/api/resume/saved/preview', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Could not open your saved resume. Please try again.');
      setPreview(isPdf ? { filename: saved.filename, url: URL.createObjectURL(await response.blob()) }
                          : { filename: saved.filename, text: (await response.json()).text });
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
  const previewModal = preview && createPortal(<dialog ref={previewDialog} className="nova-resume-preview" aria-labelledby="nova-preview-title" onCancel={() => setPreview(null)} onClick={event => { if (event.target === event.currentTarget) setPreview(null); }}>
    <header><div><h2 id="nova-preview-title">Resume Preview</h2><span>{preview.filename}</span></div><button type="button" aria-label="Close resume preview" onClick={() => setPreview(null)}>×</button></header>
    {preview.url ? <iframe title="Saved resume PDF" src={preview.url} /> : <div className="nova-resume-text"><p>Text preview · original formatting may differ</p><pre>{preview.text}</pre></div>}
  </dialog>, document.body);
  if (profileUpload) return <div className="profile-resume-upload">{previewModal}
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
  return <section className={`resume-panel nova-resume-scanner ${compact ? "resume-panel--compact" : ""}`} aria-labelledby="resume-heading">
    {previewModal}
    <header className="nova-scanner-header"><div><span className="nova-reward-label">BUILD YOUR SKILL STACK</span><h3 id="resume-heading">Resume Skill Detection</h3><p>Turn your resume into skills you can add to your profile.</p></div><span className="nova-scanner-format">PDF / DOCX</span></header>
    {loadError && <p role="alert">{loadError} <button type="button" className="wf-secondary" onClick={retrySaved}>Retry</button></p>}
    {saved && <div className="nova-saved-resume"><span className="nova-document-icon" aria-hidden="true">▤</span><div><small>SAVED RESUME</small><strong>{saved.filename}</strong></div><button type="button" className="wf-secondary" onClick={previewSaved}>Preview</button></div>}
    <input ref={uploadInput} type="file" accept=".pdf,.docx" hidden disabled={busy} aria-label="Choose resume to scan" onChange={event => { const selected = event.target.files?.[0]; event.target.value = ''; if (!selected) return; if (!/\.(pdf|docx)$/i.test(selected.name) || selected.size > 5 * 1024 * 1024) { setMessage('Choose a PDF or DOCX file up to 5 MB.'); return; } setFile(selected); setMessage(''); }} />
    <button type="button" className={`nova-scan-upload${dragging ? ' is-dragging' : ''}`} disabled={busy} onClick={() => uploadInput.current?.click()}
      onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); if (busy) return; const selected = event.dataTransfer.files[0]; if (event.dataTransfer.files.length !== 1 || !selected || !/\.(pdf|docx)$/i.test(selected.name) || selected.size > 5 * 1024 * 1024) { setMessage('Choose one PDF or DOCX file up to 5 MB.'); return; } setFile(selected); setMessage(''); }}>
      <span className="nova-upload-icon" aria-hidden="true">↑</span><span><strong>{file ? file.name : saved ? 'Replace your resume' : 'Upload your resume'}</strong><small>{file ? 'Ready to scan · click to choose another file' : 'Drag & drop or browse files · Up to 5 MB'}</small></span><span aria-hidden="true">＋</span>
    </button>
    <div className="nova-scan-actions"><span>{file ? 'Scan your selected file for skills.' : saved ? 'Uses your saved resume. No re-upload needed.' : 'Choose a file to discover your skills.'}</span><button type="button" className="primary-button" disabled={(!file && !saved) || busy} onClick={() => scan()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 12h10" /></svg>{busy ? 'Scanning…' : 'Scan Resume for Skills'}</button></div>
    {message && <p className="nova-scan-status" role="status" aria-live="polite">{message}</p>}
    {skills.length > 0 && <div className="nova-detected-skills"><div><strong>Detected skills</strong><span>{skills.length} found</span></div><div className="wf-tags">{skills.map(skill => <span className="wf-tag" key={skill}>{skill}</span>)}</div></div>}
    <small className="nova-scan-footnote">Your resume is saved for previewing and rescanning. A new upload replaces it.</small>
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
  async function dismiss(skill) {
    setBusy(skill.unmatched_id); setFailure(null);
    try {
      const response = await fetch(`/api/resume/skills/${skill.unmatched_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(responseError(response.status, result.error));
      onAdded?.();
    } catch (error) { setFailure({ text: error.message }); }
    finally { setBusy(null); }
  }
  return <section className="resume-panel nova-flagged-panel">
    <header className="nova-flagged-header"><div className="nova-flagged-title"><span className="nova-flagged-icon" aria-hidden="true">◎</span><div><span className="nova-reward-label">DISCOVER YOUR SKILL STACK</span><h3>Flagged Skills</h3></div></div><span className="nova-flagged-count">{skills.length ? `${skills.length} to review` : 'All caught up'}</span></header>
    {skills.length > 0 && <p>These resume skills are missing from your profile. Choose the ones you want to add.</p>}
    {failure?.text && <p role="alert">{failure.text}</p>}
    {!skills.length && <div className="nova-flagged-empty"><span className="nova-empty-check" aria-hidden="true">✓</span><div><strong>You’re all caught up!</strong><p>No new skills to add. Scan your resume to discover more skills for your profile.</p></div></div>}
    {skills.map(skill => <div key={skill.unmatched_id} className="pending-skill">
      <strong>{skill.skill_name}</strong><div className="nova-flagged-actions"><button type="button" className="primary-button" disabled={busy !== null} onClick={() => add(skill)} aria-label={`Add ${skill.skill_name} to profile`}>{busy === skill.unmatched_id ? 'Working…' : '＋ Add to Profile'}</button><button type="button" className="nova-dismiss-skill" disabled={busy !== null} onClick={() => dismiss(skill)} aria-label={`Dismiss ${skill.skill_name}`} title="Dismiss skill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></svg></button></div>
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
