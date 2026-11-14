import { skillDisplayName } from './skillDisplay';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { responseError } from '../apiErrors';

export default function ResumeSkills({ token, onProcessed, compact = false, profileUpload = false, wireframe = false, onProfile, onSavedState, onUploadBusyChange }) {
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
  const [savedLoading, setSavedLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadState, setUploadState] = useState('idle');
  const [skills, setSkills] = useState([]);
  async function loadSaved() {
    const response = await fetch('/api/resume/saved', { headers: { Authorization: `Bearer ${token}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(response.status === 404 ? 'Saved resumes are temporarily unavailable. Please try again.' : responseError(response.status, result.error));
    setSaved(result); setSkills(result?.skills || []); setLoadError(''); onSavedState?.({ready:true,resume:result,error:''});
  }
  async function retrySaved() {
    setMessage(''); setLoadError(''); setSavedLoading(true);
    try { await loadSaved(); }
    catch (error) { setLoadError(error.message); onSavedState?.({ready:true,resume:null,error:error.message}); }
    finally { setSavedLoading(false); }
  }
  useEffect(() => { retrySaved(); }, [token]);
  async function previewSaved() {
    try {
      const isPdf = saved.filename.toLowerCase().endsWith('.pdf');
      const response = await fetch(isPdf ? '/api/resume/saved/file' : '/api/resume/saved/preview', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Could not open your saved resume. Please try again.');
      setPreview(isPdf ? { filename: saved.filename, url: URL.createObjectURL(await response.blob()) }
                          : { filename: saved.filename, text: (await response.json()).text });
    } catch (error) { setMessage(error.message); setUploadState('error'); }
  }
  async function scan(uploadFile = file) {
    if (!uploadFile && !saved) return;
    setBusy(true); setUploadState('uploading'); onUploadBusyChange?.(true); setMessage(profileUpload ? 'Saving your resume…' : 'Scanning resume for skills…');
    const form = new FormData(); if (uploadFile) form.append('resume', uploadFile);
    try {
      const response = await fetch(uploadFile ? '/api/resume/upload' : '/api/resume/saved/scan', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, ...(uploadFile ? { body: form } : {}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Resume processing failed.');
      const replaced = Boolean(uploadFile && saved);
      const saveMessage = replaced ? 'Resume replaced.' : 'Resume saved.';
      await loadSaved();
      setSkills(result.skills);
      setFile(null);
      setMessage(result.message || saveMessage);
      setUploadState('success');
      await onProcessed?.(result);
    } catch (error) { setMessage(error.message); setUploadState('error'); }
    finally { setBusy(false); onUploadBusyChange?.(false); }
  }
  function selectResume(selected) {
    if (!selected || busy) return;
    if (!/\.(pdf|docx)$/i.test(selected.name) || selected.size > 5 * 1024 * 1024) {
      setMessage('Choose a PDF or DOCX file up to 5 MB.'); setUploadState('error'); return;
    }
    scan(selected);
  }
  const chooseResume = () => uploadInput.current?.click();
  const immediateUploadInput = <input ref={uploadInput} type="file" accept=".pdf,.docx" hidden disabled={busy} aria-label={saved ? 'Replace resume' : 'Upload resume'} onChange={event => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    selectResume(selected);
  }} />;
  const previewModal = preview && createPortal(<dialog ref={previewDialog} className="nova-resume-preview" aria-labelledby="nova-preview-title" onCancel={() => setPreview(null)} onClick={event => { if (event.target === event.currentTarget) setPreview(null); }}>
    <header><div><h2 id="nova-preview-title">Resume Preview</h2><span>{preview.filename}</span></div><button type="button" aria-label="Close resume preview" onClick={() => setPreview(null)}>×</button></header>
    {preview.url ? <iframe title="Saved resume PDF" src={preview.url} /> : <div className="nova-resume-text"><p>Text preview · original formatting may differ</p><pre>{preview.text}</pre></div>}
  </dialog>, document.body);
  if (profileUpload) return <div className={`profile-resume-upload is-${uploadState}`} aria-busy={busy}>{previewModal}
    <div className="profile-resume-row">
      {immediateUploadInput}
      <button type="button" className={`profile-resume-dropzone${dragging ? ' is-dragging' : ''}`} disabled={busy} aria-describedby="profile-resume-limits profile-resume-privacy"
        onClick={chooseResume}
        onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); if (busy) return; if (event.dataTransfer.files.length !== 1) { setMessage('Choose one resume at a time.'); setUploadState('error'); return; } selectResume(event.dataTransfer.files[0]); }}>
        <span className="lp-profile-upload-icon" aria-hidden="true">{busy ? '…' : uploadState === 'success' ? '✓' : uploadState === 'error' ? '!' : '↑'}</span>
        <strong>{busy ? 'Uploading your resume…' : dragging ? 'Drop your resume here' : saved ? 'Replace Resume' : 'Upload Resume'}</strong>
        <span>{busy ? 'Your file is being saved securely.' : 'Choose a file or drag and drop it here'}</span>
        <small id="profile-resume-limits">PDF or DOCX · Up to 5 MB · One file at a time</small>
      </button>
      <div className="profile-current-resume"><p className="lp-profile-kicker">CURRENT RESUME</p>
        {savedLoading ? <p role="status">Loading saved resume…</p> : saved ? <><button type="button" className="text-button lp-profile-resume-name" onClick={previewSaved}>{saved.filename}</button><button type="button" className="wf-secondary" onClick={previewSaved} disabled={busy}>Preview</button></> : <p>No resume uploaded yet. Add a file to complete this part of your profile.</p>}
      </div>
    </div>
    <p className="lp-profile-help" id="profile-resume-privacy">NovaTeck saves the uploaded file and uses it to detect skills. <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a></p>
    {loadError && <p className="lp-profile-field-error" role="alert">{loadError} <button type="button" className="wf-secondary" onClick={retrySaved}>Retry</button></p>}
    {message && <p className={`lp-profile-upload-feedback${uploadState === 'error' ? ' is-error' : ''}`} role={uploadState === 'error' ? 'alert' : 'status'}>{message}</p>}
  </div>;
  if (wireframe) return <>{previewModal}{immediateUploadInput}<ResumeDetectionCard saved={saved} loading={savedLoading} error={loadError} busy={busy} skills={skills} message={message} onScan={() => scan()} onReplace={chooseResume} onProfile={onProfile} onPreview={previewSaved} onRetry={retrySaved} /></>;
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

export function ResumeDetectionCard({ saved, loading, error, busy, skills = [], message, onScan, onReplace, onProfile, onPreview, onRetry }) {
  return <section className="sg-resume" aria-labelledby="sg-resume-heading" aria-busy={loading || busy}>
    <div><p className="sg-kicker">02 / READ YOUR EXPERIENCE</p><h2 id="sg-resume-heading">Resume Skill Detection</h2><p>Discover skills in the resume already on file.</p></div>
    {loading ? <div className="sg-skeleton" role="status">Loading saved resume…</div> : error ? <p role="alert">{error} <button type="button" className="wf-secondary" onClick={onRetry}>Retry saved resume</button></p> : saved ? <>
      <div className="sg-resume-meta"><div><span>Saved file</span><button type="button" className="text-button" onClick={onPreview}>{saved.filename}</button></div><div><span>Skills detected</span><strong>{skills.length}</strong></div></div>
      <div className="wf-inline">
        <button type="button" className="wf-secondary" disabled={busy} onClick={onReplace}>Replace Resume</button>
        <button type="button" className="primary-button" disabled={busy} onClick={onScan}>{busy ? 'Scanning…' : 'Scan Resume for Skills'}</button>
      </div>
    </> : <p className="sg-no-resume">No resume on file - upload one from your <button type="button" role="link" className="text-button" onClick={onProfile}>Profile</button></p>}
    {message && <p role="status">{message}</p>}
  </section>;
}

export function FlaggedSkillGrid({ skills, selected = [], busy = false, leaving = [], jobCounts = {}, onToggle, onDismiss, onAdd }) {
  return <div className="nova-flagged-grid">{skills.map(skill => {
    const name = skillDisplayName(skill.skill_name);
    const count = jobCounts[String(skill.unmatched_id)];
    return <div key={skill.unmatched_id} className={`pending-skill${selected.includes(skill.unmatched_id) ? ' is-selected' : ''}${leaving.includes(skill.unmatched_id) ? ' is-leaving' : ''}`}>
      <label className="nova-flagged-choice"><input type="checkbox" disabled={busy} checked={selected.includes(skill.unmatched_id)} onChange={() => onToggle(skill.unmatched_id)} /><span><strong>{name}</strong>{typeof count === 'number' && <small className="nova-skill-relevance">Appears in {count} active job{count === 1 ? '' : 's'} in this category</small>}</span></label>
      {onAdd && <button type="button" className="wf-secondary sg-flag-add" disabled={busy} onClick={() => onAdd(skill)} aria-label={`Add to Profile: ${name}`}>Add to Profile</button>}
      <button type="button" className="text-button nova-flagged-dismiss" disabled={busy} onClick={() => onDismiss(skill)} aria-label={`Dismiss ${name} suggestion`} title="Dismiss this suggestion; your resume and profile stay unchanged">Dismiss</button>
    </div>;
  })}</div>;
}

export function PendingSkills({ skills = [], token, onAdded, discipline = '', request, noNewDetected = false, extrasTargetId }) {
  const [busy, setBusy] = useState(false), [failure, setFailure] = useState('');
  const [extrasTarget, setExtrasTarget] = useState(null);
  useEffect(() => { if (extrasTargetId) setExtrasTarget(document.getElementById(extrasTargetId)); }, [extrasTargetId]);
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
  const extras = <div className="sg-review-extras">
    <h3>Review actions</h3>
    {message && <div className="nova-skill-feedback" role="status">{message} {dismissed && <button type="button" className="text-button" disabled={busy} onClick={undo}>Undo</button>}</div>}
    {visible.length > 0 && <footer className="nova-flagged-bulk"><div><button type="button" className={chosen.length ? 'primary-button' : 'wf-secondary'} disabled={busy || !chosen.length} onClick={() => add(chosen)}>{busy ? 'Working…' : `Add selected (${chosen.length})`}</button><button type="button" className="text-button" disabled={busy} onClick={() => add(visible)}>Add all ({visible.length})</button></div>
    <div aria-live="polite">{estimating ? <p>Calculating market match impact…</p> : impact?.job_count > 0 && <p>Market-wide preview: {impact.current_market_match}% → {impact.projected_market_match}%. This preview is separate from your selected-job match.</p>}</div></footer>}
  </div>;
  return <><section className="resume-panel nova-flagged-panel" aria-labelledby="sg-flagged-heading">
    <header className="nova-flagged-header"><div><p className="sg-kicker">05 / REVIEW NEW SKILLS</p><h2 id="sg-flagged-heading">Flagged Skills: Not In System</h2></div><span>{visible.length} to review</span></header>
    {failure && <p role="alert">{failure}</p>}
    {noNewDetected && <p role="status">No new skills detected</p>}
    {!visible.length && !noNewDetected && <p>{addedCount && !dismissedIds.length ? 'All listed resume skills are in your profile.' : 'No skills waiting for review. Scan your saved resume to check for new skills.'}</p>}
    <FlaggedSkillGrid skills={visible} selected={selected} busy={busy} leaving={leaving} jobCounts={impact?.skill_job_counts} onToggle={id => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])} onAdd={skill => add([skill])} onDismiss={dismiss} />
  </section>{extrasTargetId ? extrasTarget && createPortal(extras, extrasTarget) : extras}</>;

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
