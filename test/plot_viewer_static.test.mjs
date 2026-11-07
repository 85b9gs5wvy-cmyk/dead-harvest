/**
 * Static checks for the isolated plot viewer. No browser, pixels, or FPS.
 * The 58/58 figure is the attached jsdom sweep, not something this file re-runs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, ROOT), 'utf8');
const viewer = read('plot-viewer.html');
const indexHtml = read('index.html');
const ATTACHED_SHA256 = '8eab8a4aa70229d8bfebd6310c451d0db705958299c2687d8579b4a67e5add19';

test('plot-viewer is the attached file plus the scope bridge only', () => {
  const marker = '/* DHV_SCOPE_BRIDGE:';
  const end = '</script>\n<script id="story-config">';
  const i = viewer.indexOf(marker);
  const j = viewer.indexOf(end, i);
  assert.ok(i > 0 && j > i);
  const restored = viewer.slice(0, i) + viewer.slice(j);
  assert.equal(createHash('sha256').update(restored).digest('hex'), ATTACHED_SHA256);
  assert.equal(viewer.includes('DHV_SCOPE_BRIDGE'), true);
});

test('inline scripts parse and the page does not load external files', () => {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0;
  while ((m = re.exec(viewer))) {
    assert.equal(/\bsrc\s*=/i.test(m[1]), false);
    const file = join(tmpdir(), `plot-viewer-${n}.js`);
    writeFileSync(file, m[2]);
    execFileSync('node', ['--check', file], { stdio: 'pipe' });
    n++;
  }
  assert.equal(n, 9);
  assert.equal(/<link\b[^>]*\bhref\s*=/i.test(viewer), false);
  assert.equal(/<img\b[^>]*\bsrc\s*=/i.test(viewer), false);
});

test('storage is in-memory and the save API returns before real saves', () => {
  assert.match(viewer, /function MemStorage/);
  assert.match(viewer, /Object\.defineProperty\(window,'localStorage'/);
  assert.match(viewer, /Object\.defineProperty\(window,'sessionStorage'/);
  assert.match(viewer, /Storage\.prototype/);
  assert.match(viewer, /V\.blockedWrites\+\+/);
  assert.match(viewer, /disabledByViewer:true/);
  assert.match(viewer, /if\(window\.__DHV\)\{window\.dhSave=/);
  const boot = viewer.slice(viewer.indexOf('id="dhv-boot"'), viewer.indexOf('three.js r128'));
  assert.equal(boot.includes('dhSave'), false);
});

test('query bounds match the audit tool, not the functional-test page', () => {
  assert.match(viewer, /plot:comp\?0:num\('plot',1,1,24\)/);
  assert.match(viewer, /ctx:num\('ctx',1,0,2\)/);
  assert.match(viewer, /gfx:num\('gfx',0,0,3\)/);
  for (const name of ['farm', 'sawmill', 'quarry', 'cemetery', 'h9']) {
    assert.match(viewer, new RegExp(name + ':\\{label:'));
  }
  assert.equal(viewer.includes('id="dh-functional-boot"'), false);
  assert.equal(viewer.includes('dhSaveFunctional'), false);
});

test('index.html is unchanged and is not this viewer', () => {
  assert.equal(createHash('sha256').update(indexHtml).digest('hex'), 'ec826263e621833f1dc39d581e3f7ac037095442764207e93017ef67bb13b3b6');
  assert.equal(indexHtml.includes('DHV_SCOPE_BRIDGE'), false);
  assert.equal(indexHtml.includes('__DHV'), false);
});

test('a later strict script can see let/const only through the global bridge', () => {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`
    const scene = { id: 1 };
    let yaw = 0;
    let foot = false;
    Object.defineProperties(globalThis, {
      scene: { configurable: true, get() { return scene; } },
      yaw: { configurable: true, get() { return yaw; }, set(v) { yaw = v; } },
      foot: { configurable: true, get() { return foot; }, set(v) { foot = v; } }
    });
  `, sandbox);
  let missing = '';
  try { vm.runInContext(`'use strict'; hiddenConst`, sandbox); } catch (err) { missing = String(err && err.message || err); }
  assert.match(missing, /not defined/);
  vm.runInContext(`
    'use strict';
    if (scene.id !== 1) throw new Error('scene');
    yaw = 1.25;
    foot = true;
  `, sandbox);
  const got = vm.runInContext('yaw + (foot ? 1 : 0)', sandbox);
  assert.equal(got, 2.25);
});
