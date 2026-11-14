/**
 * The plot viewer is generated from index.html. It is a low-graphics
 * inspection page, not the playable low-graphics game (functional-test.html).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, ROOT), 'utf8');
const viewer = read('plot-viewer.html');
const indexHtml = read('index.html');
const INDEX_SHA = 'b2307d1e6289ce15e07547424f3b1dcc2b4d5f44677817419019151bc6db15c5';
const TEST_SHA = 'b6d5a5fa78c0821f6c25eb6484972899a7874ff713b6757ccd13fa7f3f61cfad';
const FUNC_SHA = 'aaaad9fe062b4032c4ba265128f1231124bb13c9da7f1ec0f7e7e85b31275976';

test('playable pages are the published files', () => {
  assert.equal(createHash('sha256').update(indexHtml).digest('hex'), INDEX_SHA);
  assert.equal(createHash('sha256').update(read('test.html')).digest('hex'), TEST_SHA);
  assert.equal(createHash('sha256').update(read('functional-test.html')).digest('hex'), FUNC_SHA);
  assert.equal(indexHtml.includes('__DH_ONE'), false);
  assert.equal(read('functional-test.html').includes("KEY='dhSaveFunctional'"), true);
});

test('viewer is generated from this index and stays one file', () => {
  assert.match(viewer, new RegExp('sha256 ' + INDEX_SHA));
  assert.equal(viewer.includes("['sofa',-2.5,-2.95,1]"), true);
  assert.equal(viewer.includes("['bench',-4.05,7.45,2]"), true);
  assert.equal(viewer.includes('buildOf[plot]'), true);
  assert.equal(viewer.includes('"7":9'), true);
  assert.equal(viewer.includes('"15":16'), true);
  assert.match(viewer, /comp!=='h9'/);
  assert.match(viewer, /one\.toggleCut/);
  assert.match(viewer, /shadowMap,'enabled'/);
  assert.match(viewer, /STORY_CONFIG\.enabled=false/);
  assert.match(viewer, /vm\.visible=window\.__DH_ONE\?false:foot/);
  assert.equal(/<script\b[^>]*\bsrc\s*=/i.test(viewer), false);
  assert.equal(/<link\b[^>]*\bhref\s*=/i.test(viewer), false);
});

test('viewer scripts parse', () => {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0;
  while ((m = re.exec(viewer))) {
    assert.equal(/\bsrc\s*=/i.test(m[1]), false);
    const file = join(tmpdir(), 'plot-viewer-' + n + '.js');
    writeFileSync(file, m[2]);
    execFileSync('node', ['--check', file], { stdio: 'pipe' });
    n++;
  }
  assert.equal(n, 7);
});

test('viewer storage is in memory and does not use the other pages keys', () => {
  assert.match(viewer, /Object\.defineProperty\(window,'localStorage'/);
  assert.match(viewer, /Object\.defineProperty\(window,'sessionStorage'/);
  assert.equal(viewer.includes("KEY='dhSaveTest'"), false);
  assert.equal(viewer.includes("KEY='dhSaveHarness'"), false);
  assert.equal(viewer.includes("KEY='dhSaveFunctional'"), false);
});
