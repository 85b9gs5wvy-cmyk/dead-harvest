/**
 * The walk inspect page is generated from index.html.
 * It must carry the current Plot 1 furniture and the viewer-only presentation
 * hooks, and index.html must stay free of those hooks.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const index = read('index.html');
const viewer = read('walk-inspect.html');
const plotViewer = read('plot-viewer.html');
const md5 = createHash('md5').update(index).digest('hex');

test('viewer is generated from this index.html and does not fork Plot 1', () => {
  assert.match(viewer, new RegExp('md5 ' + md5));
  assert.equal(index.includes('__DH_ONE'), false);
  assert.equal(index.includes('dh-inspect'), false);
  assert.equal(viewer.includes("'sofa',-2.5,-2.95,1"), true);
  assert.equal(viewer.includes("'arcade',11.5,6.9,2"), true);
  assert.equal(viewer.includes("'sofa',-4.05,-3.0,1"), false);
  assert.equal(index.includes("'sofa',-4.05,-3.0,1"), false);
  assert.equal(plotViewer.includes("'sofa',-4.05,-3.0,1"), true);
});

test('viewer hides weapon and story chrome and can draw collision lines', () => {
  assert.match(viewer, /vm\.visible=window\.__DH_ONE\?false:foot/);
  assert.match(viewer, /#sPop/);
  assert.match(viewer, /#pcx/);
  assert.match(viewer, /inspect collision overlay/);
  assert.match(viewer, /one\.toggleCut/);
  assert.match(viewer, /STORY_CONFIG\.enabled=false/);
  assert.match(viewer, /sign:\['RIVERSIDE POWER STATION'/);
});

test('approved layout moves are only in index.html', () => {
  assert.equal(index.includes("['bench',-4.05,7.45,2]"), true);
  assert.equal(index.includes("['bin',4.65,2.45,3]"), true);
  assert.equal(index.includes('tr(-.8,-18.2,5.4,0)'), true);
  assert.equal(index.includes('bm.position.set(-8.2,1.05,18.4)'), true);
  assert.equal(index.includes("['hbed',-10,5.4,1,1]"), true);
  assert.equal(index.includes("['sink',-.2,1.5,0]"), true);
  assert.equal(plotViewer.includes("['bench',-3.4,7.9,2]"), true);
  assert.equal(plotViewer.includes("['bin',4.7,.6,3]"), true);
  assert.equal(viewer.includes("['bench',-4.05,7.45,2]"), true);
  assert.equal(viewer.includes("['bin',4.65,2.45,3]"), true);
});

test('viewer scripts parse', () => {
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, i = 0;
  while ((m = re.exec(viewer))) {
    i++;
    new vm.Script(m[1], { filename: 'walk-inspect.html#' + i });
  }
  assert.ok(i >= 6);
});
