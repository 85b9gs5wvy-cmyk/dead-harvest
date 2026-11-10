/**
 * Approved main-game clearance moves live only in index.html.
 * Plot 3 ceiling and Plot 4 beds are intentionally unchanged.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const index = read('index.html');
const viewer = read('plot-viewer.html');

test('index.html carries the approved Plot 5 and Plot 6 moves', () => {
  assert.equal(index.includes("['bench',-4.05,7.45,2]"), true);
  assert.equal(index.includes("['barr',-4.05,4.7,0]"), true);
  assert.equal(index.includes("['bin',4.65,2.45,3]"), true);
  assert.equal(index.includes('tr(-.8,-18.2,5.4,0)'), true);
  assert.equal(index.includes('bm.position.set(-8.2,1.05,18.4)'), true);
  assert.equal(index.includes('8.4+i*.4,.07,17.2'), true);
});

test('the generated viewer matches index.html and the play pages do not', () => {
  assert.equal(index.includes("['sink',-.2,1.5,0]"), true);
  assert.equal(index.includes("['hbed',-10,5.4,1,1]"), true);
  assert.equal(viewer.includes("['bench',-4.05,7.45,2]"), true);
  assert.equal(viewer.includes("['bin',4.65,2.45,3]"), true);
  assert.equal(viewer.includes('tr(-.8,-18.2,5.4,0)'), true);
  assert.equal(read('test.html').includes("['bench',-4.05,7.45,2]"), true);
  assert.equal(index.includes('__DH_ONE'), false);
  assert.equal(viewer.includes('__DH_ONE'), true);
});

test('index.html hash matches the vehicle-page pin', () => {
  const sha = createHash('sha256').update(index).digest('hex');
  const pin = read('test/vehicle_death_goal.test.mjs');
  assert.match(pin, new RegExp(sha));
});
