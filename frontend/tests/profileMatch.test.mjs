import test from 'node:test';
import assert from 'node:assert/strict';
import { profileMatch, sortJobsByProfileMatch } from '../src/components/profileMatch.js';

const job = { resume_match_pct: 100, resume_requirement_groups: [{skills:['React','TypeScript'],status:'matched'},{skills:['SQL Server'],status:'matched'},{skills:['Python'],status:'matched'}] };
test('profile score ignores resume outcomes and supports alternatives and half credit', () => {
  const result = profileMatch(job, [' REACT ', 'sql']);
  assert.equal(result.percent, 50);
  assert.equal(result.matched, 1);
  assert.equal(result.partial, 1);
  assert.deepEqual(result.groups.map(group => group.status), ['matched','partial','missing']);
  assert.deepEqual(result.missing[0].skills, ['python']);
});
test('all alternatives are one requirement, never double counted', () => {
  assert.equal(profileMatch(job, ['react','typescript','SQL SERVER','python']).percent, 100);
  assert.equal(profileMatch(job, ['react','typescript']).percent, 33);
});
test('empty, pending, unavailable and zero matches are distinct', () => {
  assert.equal(profileMatch(job, undefined).state, 'loading');
  assert.equal(profileMatch(job, [' ', '']).state, 'empty');
  assert.equal(profileMatch({}, ['python']).state, 'unavailable');
  assert.equal(profileMatch(job, ['java']).percent, 0);
});
test('required-only fallback, duplicate requirements and exact matching', () => {
  const fallback = { skills: [{ skill_name:'JavaScript',requirement_type:'required' },{skill_name:'javaSCRIPT',requirement_type:'required'},{skill_name:'Python',requirement_type:'preferred'}] };
  assert.equal(profileMatch(fallback, ['java']).percent, null);
  assert.equal(profileMatch(fallback, ['javascript']).groups.length, 1);
  assert.equal(profileMatch({skill_summary:'React, SQL Server, Python'},['react','sql']).percent, 50);
});
test('first missing chip preserves supplied requirement order without inventing priority', () => {
  const result = profileMatch({ resume_requirement_groups:[{skills:['Terraform']},{skills:['AWS']},{skills:['Python']}] }, ['python']);
  assert.deepEqual(result.missing.map(group => group.skills[0]), ['terraform','aws']);
});
test('malformed and empty groups do not create fake zero-percent requirements', () => {
  assert.equal(profileMatch({resume_requirement_groups:[null,{skills:[]},{skills:null},{skills:['  ']}]},['python']).state,'unavailable');
});

test('fewer than three deduplicated requirements never show a percentage', () => {
  for (const skills of ['', 'React', 'React, Python', 'React, react']) {
    for (const profile of [undefined, [], ['react', 'python']]) {
      const match = profileMatch({skill_summary: skills}, profile);
      assert.equal(match.state, 'unavailable');
      assert.equal(match.percent, null);
    }
  }
});
test('rounding cannot produce 100 unless every requirement is fully matched', () => {
  const skills = Array.from({length:199}, (_, i) => `skill${i}`);
  const job = {skill_summary:[...skills, 'SQL Server'].join(',')};
  assert.equal(profileMatch(job, [...skills, 'sql']).percent, 99);
  assert.equal(profileMatch(job, [...skills, 'sql server']).percent, 100);
});

test('global Best match sorts real percentages before sparse jobs, including zero percent', () => {
  const sparse = {job_id:1, skill_summary:'react', resume_match_pct:100};
  const zero = {job_id:2, skill_summary:'java, go, rust', resume_match_pct:100};
  const high = {job_id:3, skill_summary:'react, python, sql', resume_match_pct:0};
  const low = {job_id:4, skill_summary:'react, java, go'};
  const rows = [...Array.from({length:25}, (_, i) => ({...sparse,job_id:100+i})), zero, low, high];
  const result = sortJobsByProfileMatch(rows, ['react','python','sql']);
  assert.deepEqual(result.slice(0,3).map(job => job.job_id), [3,4,2]);
  assert.equal(result.slice(0,20).filter(job => profileMatch(job,['react','python','sql']).state==='ready').length,3);
  assert.equal(rows[0].job_id,100, 'input remains unchanged');
  assert.deepEqual(sortJobsByProfileMatch(rows, []).map(job=>job.job_id),rows.map(job=>job.job_id), 'neutral profiles preserve ordering');
});
