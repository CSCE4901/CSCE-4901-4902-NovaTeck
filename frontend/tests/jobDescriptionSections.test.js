import test from 'node:test';
import assert from 'node:assert/strict';
import { splitJobDescription } from '../src/components/jobDescriptionSections.js';

test('co-op headings preserve introductory and qualification text and group responsibilities', () => {
  const result = splitJobDescription("Company introduction. Job Description: Paid placement.\nWhat you'll do:: Own a project.\nExamples of projects:: Design circuits.\nRequired qualifications:: Electrical degree.");
  assert.deepEqual(result.description.map(s => s.content), ['Company introduction.', 'Paid placement.', 'Electrical degree.']);
  assert.deepEqual(result.responsibilities.map(s => s.content), ['Own a project.', 'Design circuits.']);
});
test('intern project scope maps to responsibilities, not qualifications', () => {
  const result = splitJobDescription('Job Description: Internship.\nProject Scope & Description:: Build avionics.\nPreferred qualifications:: Python.');
  assert.equal(result.responsibilities[0].content, 'Build avionics.');
  assert.equal(result.description[1].content, 'Python.');
});
test('unstructured text is preserved and no duties are invented', () => {
  assert.deepEqual(splitJobDescription('Complete employer text.'), { description: [{heading:'',content:'Complete employer text.'}], responsibilities: [] });
  assert.deepEqual(splitJobDescription(''), { description: [], responsibilities: [] });
});
