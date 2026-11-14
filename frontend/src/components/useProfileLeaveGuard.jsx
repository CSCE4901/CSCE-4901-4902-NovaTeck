import { useEffect, useRef, useState } from 'react';

export function isProfileNavigation(target) {
  const control = target?.closest?.('button,a');
  if (!control) return false;
  if (control.matches('[data-profile-leave]')) return true;
  if (control.closest('.nova-nav')) {
    return control.matches('.nova-brand,.nova-nav-exit,.nova-nav-tab:not([aria-current]):not([aria-expanded])') ||
      (control.matches('.nova-settings-option') && control.textContent.trim() === 'Reset Password');
  }
  return control.tagName === 'A' && control.target !== '_blank' && control.hasAttribute('href') && !control.getAttribute('href').startsWith('#');
}
export default function useProfileLeaveGuard(unsaved) {
  const [pending, setPending] = useState(null);
  const dialog = useRef(null), allowNext = useRef(false), cancel = useRef(null), lastFocus = useRef(null), restoringHistory = useRef(false);
  useEffect(() => {
    if (!unsaved) { setPending(null); return; }
    const unload = event => { event.preventDefault(); event.returnValue = ''; };
    const click = event => {
      if (allowNext.current) { allowNext.current = false; return; }
      if (!isProfileNavigation(event.target)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      lastFocus.current = document.activeElement;
      setPending(event.target.closest('button,a'));
    };
    // Browser Back can also trigger the shell's existing popstate navigation.
    const back = event => {
      if (restoringHistory.current) { event.stopImmediatePropagation(); restoringHistory.current = false; return; }
      if (window.confirm('Leave without saving your profile changes?')) return;
      event.stopImmediatePropagation();
      restoringHistory.current = true; window.history.go(1);
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', back, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true); window.removeEventListener('popstate', back, true); };
  }, [unsaved]);
  useEffect(() => {
    if (!pending) return;
    dialog.current?.showModal(); cancel.current?.focus();
    return () => { dialog.current?.close(); lastFocus.current?.focus(); };
  }, [pending]);
  return pending && <dialog ref={dialog} className="lp-profile-leave" aria-labelledby="profile-leave-title" aria-describedby="profile-leave-description" onCancel={event => { event.preventDefault(); setPending(null); }}>
    <h2 id="profile-leave-title">Leave without saving?</h2><p id="profile-leave-description">Your unsaved profile edits will be lost. An uploaded resume is saved separately.</p>
    <div><button type="button" className="wf-secondary" ref={cancel} onClick={() => setPending(null)}>Keep editing</button><button type="button" className="primary-button" onClick={() => { dialog.current?.close(); allowNext.current = true; const target = pending; setPending(null); target.click(); }}>Leave without saving</button></div>
  </dialog>;
}
