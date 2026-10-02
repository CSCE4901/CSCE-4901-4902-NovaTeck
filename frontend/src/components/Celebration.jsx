import { useEffect, useState } from 'react';

export function Confetti({ trigger }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!trigger) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(timer);
  }, [trigger]);
  return visible ? <div key={trigger} className="nova-confetti" aria-hidden="true">{Array.from({ length: 48 }, (_, i) => <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--delay': `${(i % 8) * 0.08}s`, '--spin': `${i % 2 ? 540 : -540}deg`, '--drift': `${(i % 7 - 3) * 35}px`, background: ['#2563eb', '#06b6d4', '#fbbf24', '#10b981'][i % 4] }} />)}</div> : null;
}

export function SkillReward({ percent, eligible, name = 'Career Ready', scope, celebrate = true }) {
  const [burst, setBurst] = useState(0);
  const earned = percent === 100 && eligible;
  useEffect(() => { if (earned && celebrate) setBurst(value => value + 1); }, [earned, scope, celebrate]);
  if (!earned) return null;
  return <>{celebrate && <Confetti trigger={burst} />}<div className="nova-reward" role="status">
    <span className="nova-reward-icon" aria-hidden="true">🏆</span>
    <div><span className="nova-reward-label">BADGE UNLOCKED</span><strong>{name} · 100% match</strong><p>You’ve matched every required skill. Your hard work is paying off!</p></div>
  </div></>;
}
