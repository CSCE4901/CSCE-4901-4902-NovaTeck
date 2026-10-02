import { useId } from 'react';

export default function NovaLogo() {
  const arc = useId();
  return <svg className="nova-logo" viewBox="0 0 120 100" role="img" aria-label="NovaTeck">
    <defs><path id={arc} d="M19 61 A41 35 0 0 1 101 61" /></defs>
    <text fill="currentColor" fontSize="17" fontWeight="700" letterSpacing=".7"><textPath href={`#${arc}`} startOffset="50%" textAnchor="middle">NovaTeck</textPath></text>
    <text x="60" y="78" textAnchor="middle" fontSize="47" style={{ fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" }}>🚀</text>
  </svg>;
}
