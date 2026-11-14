import { plainJobText } from './jobDescriptionText.js';

export const NOVA_MESSAGE_LIMIT = 2000;
export const novaStarters = [
  { prompt: 'Help me build a learning plan', hint: 'Find a clear path to your next skill.', icon: 'plan' },
  { prompt: 'Practice a tech interview', hint: 'Build confidence, one answer at a time.', icon: 'interview' },
  { prompt: 'Improve my resume bullet points', hint: 'Turn your experience into a stronger story.', icon: 'resume' },
];
export function novaSkillNames(skills) {
  if (!Array.isArray(skills)) return [];
  const seen = new Set();
  return skills.filter(skill => typeof skill === 'string').map(skill => skill.trim().replace(/\s+/g,' ')).filter(skill => {
    const key = skill.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function novaQuestion(question, includedSkills = []) {
  const skills = novaSkillNames(includedSkills);
  return String(question).trim() + (skills.length ? `\n\nProfile skills (included for this question only): ${skills.join(', ')}` : '');
}
export function novaRequestHistory(messages, question, includedSkills = []) {
  const content = novaQuestion(question, includedSkills);
  if (!String(question).trim()) throw new Error('Write a question first.');
  if (content.length > NOVA_MESSAGE_LIMIT) throw new Error('Your question and selected skills exceed 2,000 characters. Shorten the question or turn off profile skills.');
  // Past user content is the typed question, without any earlier skill attachment.
  // Whitelist the API fields so local UI metadata never enters a request.
  return [...messages.map(message => ({ role: message.role, content: message.content })), { role: 'user', content }].slice(-19);
}
export function novaInline(text) {
  const parts = [], expression = /\*\*([^*\n]+)\*\*/g;
  let start = 0, match;
  while ((match = expression.exec(text))) {
    if (match.index > start) parts.push({type:'text',text:text.slice(start,match.index)});
    parts.push({type:'bold',text:match[1]}); start = expression.lastIndex;
  }
  if (start < text.length) parts.push({type:'text',text:text.slice(start)});
  return parts;
}
export function novaReplyBlocks(reply) {
  const blocks = [], paragraph = [];
  let list = null;
  const flush = () => { if (paragraph.length) { blocks.push({type:'paragraph',text:paragraph.join('\n')}); paragraph.length=0; } list=null; };
  for (const line of plainJobText(reply).split('\n')) {
    if (!line.trim()) { flush(); continue; }
    const bullet = line.match(/^\s*(?:([-*•])|\d+[.)])\s+(.+)$/);
    if (bullet) {
      if (paragraph.length) flush();
      const type = bullet[1] ? 'list' : 'ordered';
      if (!list || list.type !== type) { list={type,items:[]}; blocks.push(list); }
      list.items.push(bullet[2]);
    } else {
      list=null;
      const heading = line.match(/^\s*#{1,6}\s+(.+)$/);
      if (heading) { flush(); blocks.push({type:'heading',text:heading[1]}); }
      else paragraph.push(line);
    }
  }
  flush(); return blocks;
}
export function novaCopyText(reply) {
  return novaReplyBlocks(reply).map(block => block.items ? block.items.map((item,index)=>`${block.type==='ordered' ? `${index+1}.` : '•'} ${novaInline(item).map(part=>part.text).join('')}`).join('\n') : novaInline(block.text).map(part=>part.text).join('')).join('\n\n');
}
export function novaMotionMs(value) {
  const duration = Number.parseFloat(value);
  return Number.isFinite(duration) ? Math.max(0, value.trim().endsWith('ms') ? duration : duration * 1000) : 0;
}
