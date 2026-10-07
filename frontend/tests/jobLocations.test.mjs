import test from 'node:test';
import assert from 'node:assert/strict';
import { compactLocation, splitLocations, isDfwLocation } from '../src/components/jobLocations.js';

test('multi-location feeds prioritize a DFW office even without a state suffix', () => {
  assert.equal(compactLocation('Boston; Charlotte; Chicago; Dallas; New York; San Francisco'), 'Dallas +5 more');
  assert.equal(compactLocation('Boston, MA; Plano, TX; Chicago, IL'), 'Plano, TX +2 more');
});

test('location parsing preserves commas in city/state pairs and parenthetical regions', () => {
  assert.deepEqual(splitLocations('Boston, MA, Dallas, TX'), ['Boston, MA', 'Dallas, TX']);
  assert.deepEqual(splitLocations('Remote (US/Canada); Dallas, TX; Dallas, TX'), ['Remote (US/Canada)', 'Dallas, TX']);
  assert.equal(compactLocation(null), 'Location not provided');
});

test('other-state cities are not labelled DFW', () => {
  assert.equal(isDfwLocation('Dallas, OR'), false);
  assert.equal(isDfwLocation('Arlington, VA'), false);
  assert.equal(isDfwLocation('Arlington'), false);
  assert.equal(isDfwLocation('Arlington, TX'), true);
});
