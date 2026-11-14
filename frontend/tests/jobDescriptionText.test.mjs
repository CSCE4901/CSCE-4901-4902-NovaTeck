import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJobDescription, plainJobText, formatPostedDate } from '../src/components/jobDescriptionText.js';
const description = `Build thoughtful products.\n\n## About the Role\nWork with a small team.\n\n## Responsibilities\n• Build interfaces\n• Review code\n\n## Qualifications\n• Know JavaScript\n\n## Preferred Skills\n• Know React\n\n## Why NovaTeck\nGrow with us.`;
test('markdown headings and literal bullets become classified sections and list items', () => {
  const parsed = parseJobDescription(description);
  assert.equal(parsed.general.length,2);assert.equal(parsed.responsibilities.length,1);
  assert.deepEqual(parsed.responsibilities[0].blocks,[{type:'list',items:['Build interfaces','Review code']}]);
  assert.equal(parsed.qualifications[0].title,'Qualifications');assert.equal(parsed.preferred[0].title,'Preferred Skills');assert.equal(parsed.company[0].title,'Why NovaTeck');
});
test('HTML and encoded tags become inert text while scripts, style and attributes are discarded', () => {
  const text = plainJobText(`<h2 title="a > b">Responsibilities</h2><ul><li>Build &amp; learn</li><li>&lt;img src=x onerror=alert(1)&gt;Review</li></ul><script>alert('bad')</script><style>body{display:none}</style><!-- hidden --><p>Keep this.</p>`);
  for (const forbidden of ['<h2','<img','onerror','alert','display:none','hidden'])assert.ok(!text.includes(forbidden),forbidden);
  const parsed = parseJobDescription(text);
  assert.equal(parsed.responsibilities.length,1);assert.ok(text.includes('Build & learn'));assert.ok(text.includes('Review'));assert.ok(text.includes('Keep this.'));
  assert.equal(plainJobText('Safe <script src="unterminated'), 'Safe');
  assert.equal(plainJobText('C++ uses x < 20 and y > 5.'),'C++ uses x < 20 and y > 5.');
});
test('structured HTML fallback preserves headings and lists without duplicating markdown text', () => {
  const structured=[{title:'Responsibilities',html:'<p>Own delivery.</p><ul><li>Ship code</li></ul>'},{title:'Why Company',html:'<p>Company story.</p>'}];
  const parsed=parseJobDescription('An introductory paragraph.\nResponsibilities\nOwn delivery.\nWhy Company\nCompany story.',structured);
  assert.equal(parsed.general[0].blocks[0].text,'An introductory paragraph.');
  assert.equal(parsed.responsibilities[0].blocks[1].type,'list');assert.equal(parsed.company[0].blocks[0].text,'Company story.');
  assert.equal(parseJobDescription(description,structured).responsibilities[0].blocks[0].items.length,2);
});
test('nested subheadings remain with their parent section',()=>{
  const parsed=parseJobDescription('## Responsibilities\n### Daily work\n• Build interfaces\n## Qualifications\nBring experience.');
  assert.equal(parsed.responsibilities[0].blocks[0].type,'heading');assert.equal(parsed.responsibilities[0].blocks[0].text,'Daily work');assert.equal(parsed.qualifications.length,1);
});
test('posted dates are readable and do not shift with local time zones',()=>{
  assert.equal(formatPostedDate('2026-10-20'),'Oct 20, 2026');assert.equal(formatPostedDate('2026-10-20T00:00:00Z'),'Oct 20, 2026');
  assert.equal(formatPostedDate('2026-02-30'),null);assert.equal(formatPostedDate('invalid'),null);assert.equal(formatPostedDate(null),null);
});

test('common recruiting headings are qualifications, not introductory prose',()=>{
  const parsed=parseJobDescription('## The Basics\nBuild products.\n## We’re looking for someone with\n• Engineering experience\n## Responsibilities\n• Own delivery');
  assert.equal(parsed.general.length,1);assert.equal(parsed.qualifications[0].title,'We’re looking for someone with');assert.equal(parsed.responsibilities.length,1);
});

test('a standalone introduction is preserved alongside structured responsibilities',()=>{
  const parsed=parseJobDescription('Build products for students.',[{title:'Responsibilities',html:'<p>Collaborate across the engineering team.</p>'}]);
  assert.equal(parsed.general[0].blocks[0].text,'Build products for students.');assert.equal(parsed.responsibilities.length,1);
});

test('closing mission and benefits headings stay out of the main introduction',()=>{
  const parsed=parseJobDescription('## The Basics\nBuild products.\n## On a mission. Together.\nOur company mission.\n## What you’ll get\n• Benefits and support');
  assert.equal(parsed.general.length,1);assert.equal(parsed.company.length,2);
});
