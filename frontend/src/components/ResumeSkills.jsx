import { skillDisplayName } from './skillDisplay';
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
    {skills.length > 0 && <div className="nova-detected-skills"><div><strong>Detected skills</strong><span>{skills.length} found</span></div><div className="wf-tags">{skills.map(skill => <span className="wf-tag" key={skill}>{skillDisplayName(skill)}</span>)}</div></div>}
    <small className="nova-scan-footnote">Your resume is saved for previewing and rescanning. A new upload replaces it.</small>
  </section>;
}

export function FlaggedSkillGrid({ skills, selected = [], busy = false, leaving = [], jobCounts = {}, onToggle, onDismiss }) {
  return <div className="nova-flagged-grid">{skills.map(skill => {
    const name = skillDisplayName(skill.skill_name);
    const count = jobCounts[String(skill.unmatched_id)];
    return <div key={skill.unmatched_id} className={`pending-skill${selected.includes(skill.unmatched_id) ? ' is-selected' : ''}${leaving.includes(skill.unmatched_id) ? ' is-leaving' : ''}`}>
      <label className="nova-flagged-choice"><input type="checkbox" disabled={busy} checked={selected.includes(skill.unmatched_id)} onChange={() => onToggle(skill.unmatched_id)} /><span><strong>{name}</strong>{typeof count === 'number' && <small className="nova-skill-relevance">Appears in {count} active job{count === 1 ? '' : 's'} in this category</small>}</span></label>
      <button type="button" className="text-button nova-flagged-dismiss" disabled={busy} onClick={() => onDismiss(skill)} aria-label={`Dismiss ${name} suggestion`} title="Dismiss this suggestion; your resume and profile stay unchanged">Dismiss</button>
    </div>;
  })}</div>;
}

export function PendingSkills({ skills = [], token, onAdded, discipline = '', request }) {
  const [busy, setBusy] = useState(false), [failure, setFailure] = useState('');
  const [selected, setSelected] = useState([]), [hidden, setHidden] = useState([]), [leaving, setLeaving] = useState([]);
  const [message, setMessage] = useState(''), [dismissed, setDismissed] = useState(null);
  const [dismissedIds, setDismissedIds] = useState([]), [addedCount, setAddedCount] = useState(0);
  const [impact, setImpact] = useState(null), [estimating, setEstimating] = useState(false);
  const visible = skills.filter(skill => !hidden.includes(skill.unmatched_id));
  const chosen = visible.filter(skill => selected.includes(skill.unmatched_id));
  const preview = chosen.length ? chosen : visible;
  const previewIds = preview.map(skill => skill.unmatched_id).join(',');
  useEffect(() => {
    if (!message || dismissed) return;
    const timer = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(timer);
  }, [message, dismissed]);
  async function call(path, options = {}) {
    if (request) return request(path, options, token);
    const response = await fetch(`/api${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    const result = await response.json();
    if (!response.ok) throw new Error(response.status === 404 ? 'This skill action is unavailable. Restart the backend and refresh; if it persists, refresh the suggestions.' : responseError(response.status, result.error));
    return result;
  }
  useEffect(() => {
    if (!previewIds) { setImpact(null); setEstimating(false); return; }
    let active = true;
    const controller = new AbortController();
    setEstimating(true);
    const timer = setTimeout(() => {
      call('/resume/skills/impact', { method: 'POST', body: JSON.stringify({ flag_ids: previewIds.split(',').map(Number), discipline }), signal: controller.signal })
        .then(result => { if (active) setImpact(result); })
        .catch(() => { if (active) setImpact(null); })
        .finally(() => { if (active) setEstimating(false); });
    }, 350);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [previewIds, discipline, token]);
  async function removeAfterFeedback(rows, scrollToMatch = true) {
    const ids = rows.map(skill => skill.unmatched_id);
    setLeaving(ids);
    await new Promise(resolve => setTimeout(resolve, 180));
    setHidden(current => [...current, ...ids]); setLeaving([]);
    setSelected(current => current.filter(id => !ids.includes(id)));
    await onAdded?.({ scrollToMatch });
  }
  async function add(rows) {
    if (!rows.length || busy) return;
    setBusy(true); setFailure('');
    try {
      await call('/resume/skills/add', { method: 'POST', body: JSON.stringify({ flag_ids: rows.map(skill => skill.unmatched_id) }) });
      setDismissed(null); setAddedCount(current => current + rows.length);
      setMessage(rows.length === 1 ? `${skillDisplayName(rows[0].skill_name)} added to your profile.` : `${rows.length} skills added to your profile.`);
      await removeAfterFeedback(rows);
    } catch (error) { setFailure(error.message); }
    finally { setBusy(false); }
  }
  async function dismiss(skill) {
    if (busy) return;
    setBusy(true); setFailure('');
    try {
      await call(`/resume/skills/${skill.unmatched_id}`, { method: 'DELETE' });
      setDismissed(skill); setDismissedIds(current => [...current, skill.unmatched_id]); setMessage(`${skillDisplayName(skill.skill_name)} dismissed.`);
      await removeAfterFeedback([skill], false);
    } catch (error) { setFailure(error.message); }
    finally { setBusy(false); }
  }
  async function undo() {
    setBusy(true); setFailure('');
    try {
      await call(`/resume/skills/${dismissed.unmatched_id}/restore`, { method: 'POST', body: JSON.stringify({}) });
      setHidden(current => current.filter(id => id !== dismissed.unmatched_id));
      setDismissedIds(current => current.filter(id => id !== dismissed.unmatched_id));
      setDismissed(null); setMessage('Suggestion restored.'); await onAdded?.({ scrollToMatch: false });
    } catch (error) { setFailure(error.message); }
    finally { setBusy(false); }
  }
  return <section className="resume-panel nova-flagged-panel">
    <header className="nova-flagged-header"><div className="nova-flagged-title"><span className="nova-flagged-icon" aria-hidden="true">⚑</span><div><span className="nova-reward-label">DISCOVER YOUR SKILL STACK</span><h3>Flagged Skills</h3></div></div><span className="nova-flagged-count">{visible.length ? `${visible.length} to review` : 'All caught up'}</span></header>
    {visible.length > 0 && <p>Found in your resume, not in your profile. Select skills you want to add.</p>}
    {failure && <p role="alert">{failure}</p>}
    {message && <div className="nova-skill-feedback" role="status">{message} {dismissed && <button type="button" className="text-button" disabled={busy} onClick={undo}>Undo</button>}</div>}
    {!visible.length && <div className="nova-flagged-empty"><span className="nova-empty-check" aria-hidden="true">✓</span><div><strong>{dismissedIds.length || !addedCount ? 'All suggestions reviewed' : 'All listed resume skills are in your profile'}</strong><p>Scan an updated resume whenever you have more skills to add.</p></div></div>}
    <FlaggedSkillGrid skills={visible} selected={selected} busy={busy} leaving={leaving} jobCounts={impact?.skill_job_counts} onToggle={id => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])} onDismiss={dismiss} />
    {visible.length > 0 && <footer className="nova-flagged-bulk">
      <div><button type="button" className={chosen.length ? "primary-button" : "wf-secondary"} disabled={busy || !chosen.length} onClick={() => add(chosen)}>{busy ? 'Working…' : `Add selected (${chosen.length})`}</button><button type="button" className="text-button" disabled={busy} onClick={() => add(visible)}>Add all ({visible.length})</button></div>
      <div aria-live="polite">{estimating ? <small>Calculating profile match impact…</small> : impact?.job_count > 0 && <><p>Adding {chosen.length ? 'these selected' : 'all'} skills would change your <strong>Market skill match from {impact.current_market_match}% to {impact.projected_market_match}%</strong>.</p>{impact.has_saved_resume && <small>For job-specific resume matches, upload an updated resume that includes your new skills.</small>}</>}</div>
    </footer>}
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
