const entities = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', bull:'•', ndash:'–', mdash:'—', rsquo:'’', lsquo:'‘', ldquo:'“', rdquo:'”', hellip:'…' };
const decodeEntities = text => text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, key) => {
  if (key[0] !== '#') return entities[key.toLowerCase()] ?? entity;
  const code = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2),16) : Number(key.slice(1));
  return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '�';
});

// Text-only tokenizer: tags never enter React markup, even with malformed input.
// Quote-aware scanning handles '>' in attributes without turning attributes into text.
export function plainJobText(value) {
  const source = decodeEntities(String(value ?? '').replace(/\r\n?/g,'\n'));
  let output = '', blocked = '', index = 0;
  while (index < source.length) {
    if (source[index] !== '<') { if (!blocked) output += source[index]; index++; continue; }
    if (source.startsWith('<!--',index)) {
      const end = source.indexOf('-->',index + 4); index = end < 0 ? source.length : end + 3; continue;
    }
    const opening = source.slice(index).match(/^<\/?([a-z][\w:-]*)(?=[\s/>]|$)/i);
    if (!opening) { if (!blocked) output += source[index]; index++; continue; }
    let end = index + opening[0].length, quote = '';
    for (; end < source.length; end++) {
      const char = source[end];
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    const tag = opening[1].toLowerCase(), closing = source[index + 1] === '/';
    index = Math.min(source.length,end + 1);
    if (blocked) { if (closing && tag === blocked) blocked = ''; continue; }
    if (['script','style','iframe','object','template','svg','math'].includes(tag) && !closing) { blocked = tag; continue; }
    if (/^h[1-6]$/.test(tag)) output += closing ? '\n\n' : '\n\n## ';
    else if (tag === 'li') output += closing ? '\n' : '\n• ';
    else if (['p','div','section','article','ul','ol','blockquote','br','hr','table','tr'].includes(tag)) output += '\n\n';
  }
  return output.replace(/[ \t]*[•●▪][ \t]*/g,'\n• ').replace(/\n+[ \t]*(?=• )/g,'\n').replace(/[ \t]+\n/g,'\n').trim();
}
const inlineText = text => text.trim().replace(/\*\*([^*]+)\*\*/g,'$1').replace(/__([^_]+)__/g,'$1').replace(/`([^`]+)`/g,'$1');
const headingText = text => inlineText(text.replace(/^#{1,6}\s*/, '').replace(/\s+#+\s*$/, ''));
export function descriptionBlocks(text) {
  const blocks = []; let paragraph = [], items = [];
  const flushParagraph = () => { if (paragraph.length) { blocks.push({type:'paragraph',text:inlineText(paragraph.join(' '))}); paragraph = []; } };
  const flushList = () => { if (items.length) { blocks.push({type:'list',items}); items = []; } };
  for (const line of text.split('\n')) {
    const bullet = line.match(/^\s*(?:[•●▪*\-]|\d+[.)])\s+(.+)$/);
    if (!line.trim()) { flushParagraph(); flushList(); }
    else if (bullet) { flushParagraph(); items.push(inlineText(bullet[1])); }
    else if (/^\s*#{2,6}\s+/.test(line)) { flushParagraph(); flushList(); blocks.push({type:'heading',text:headingText(line)}); }
    else { flushList(); paragraph.push(line.trim()); }
  }
  flushParagraph(); flushList(); return blocks;
}
export function descriptionKind(title) {
  if (/responsibilit|what you[’']ll (?:do|be doing)|your duties|key duties|job duties/i.test(title)) return 'responsibilities';
  if (/preferred|nice.to.have|bonus|desirable/i.test(title)) return 'preferred';
  if (/qualifications?|requirements?|required skills|we[’']re looking|you (?:have|are)\b|who you are|your (?:background|experience)|what (?:you|we)[’']?(?:re|ll)? (?:bring|need|looking)|minimum|must.have/i.test(title)) return 'qualifications';
  if (/\b(?:current vacancy|equal opportunity|legal notice|privacy notice|export control|accommodation|non.discrimination)\b/i.test(title)) return 'notice';
  if (/^(?:c[efiotp]o\b|why\b|on a mission\b|what you[’']ll get\b|what we offer\b|about\s+(?!(?:the |this )?(?:role|job|position)\b)|company\b|benefits?\b|perks?\b|our\b|life at\b|who we are\b|join us\b)/i.test(title)) return 'company';
  return 'general';
}
function splitSections(text) {
  const lines = text.split('\n');
  const depth = Math.min(...lines.map(line => line.match(/^\s*(#{2,6})\s+\S/)?.[1].length).filter(Boolean));
  const result = []; let title = '', body = [];
  const flush = () => { const blocks = descriptionBlocks(body.join('\n')); if (blocks.length) result.push({title,blocks,kind:descriptionKind(title)}); body = []; };
  for (const line of lines) {
    const heading = line.match(/^\s*(#{2,6})\s+(.+)$/);
    if (heading && heading[1].length === depth) { flush(); title = headingText(heading[2]); }
    else body.push(line);
  }
  flush(); return result;
}
export function parseJobDescription(description, sections = []) {
  const raw = plainJobText(description);
  let parts;
  if (/^\s*#{2,6}\s+/m.test(raw) || !sections.length) parts = splitSections(raw);
  else {
    parts = sections.map(section => ({title:headingText(plainJobText(section.title)),blocks:descriptionBlocks(plainJobText(section.html ?? section.text ?? ''))})).filter(section => section.blocks.length).map(section => ({...section,kind:descriptionKind(section.title)}));
    // Preserve any opening prose preceding the first structured section.
    const lines = raw.split('\n');
    const firstTitle = lines.findIndex(line => parts.some(part => part.title.toLowerCase() === line.trim().toLowerCase()));
    if (firstTitle > 0) parts.unshift({title:'',blocks:descriptionBlocks(lines.slice(0,firstTitle).join('\n')),kind:'general'});
    else if (firstTitle < 0 && raw && !parts.some(part => part.kind === 'general')) {
      const starts = parts.map(part => {
        const first = part.blocks.find(block => block.type === 'paragraph' || block.type === 'list');
        const text = first?.text || first?.items[0] || '';
        return text.length >= 12 ? raw.indexOf(text.slice(0,60)) : -1;
      }).filter(index => index >= 0);
      const intro = starts.length ? raw.slice(0,Math.min(...starts)).trim() : raw;
      if (intro) parts.unshift({title:'',blocks:descriptionBlocks(intro),kind:'general'});
    }
    if (!parts.length && raw) parts = splitSections(raw);
  }
  return Object.fromEntries(['general','responsibilities','qualifications','preferred','company','notice'].map(kind => [kind,parts.filter(part => part.kind === kind)]));
}
export function formatPostedDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const parsed = match ? new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]))) : new Date(value);
  if (Number.isNaN(parsed.valueOf()) || match && (parsed.getUTCFullYear() !== Number(match[1]) || parsed.getUTCMonth() !== Number(match[2])-1 || parsed.getUTCDate() !== Number(match[3]))) return null;
  return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(parsed);
}
