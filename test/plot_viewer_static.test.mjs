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
/* Game, boot, manifest, and story bytes. dhv-runtime is the only viewer control surface this branch edits. */
const FROZEN_WITHOUT_RUNTIME_SHA256 = '52f7e0c20378b80d1c837732e444fdd6a102e1514cbd7c54a1346a40c6033733';

function withoutBridge(src) {
  const marker = '/* DHV_SCOPE_BRIDGE:';
  const end = '</script>\n<script id="story-config">';
  const i = src.indexOf(marker);
  const j = src.indexOf(end, i);
  assert.ok(i > 0 && j > i);
  return src.slice(0, i) + src.slice(j);
}

test('plot-viewer game body is the attached file; only dhv-runtime changed', () => {
  const restored = withoutBridge(viewer);
  const a = restored.indexOf('<script id="dhv-runtime">');
  const b = restored.indexOf('</script>', a);
  assert.ok(a > 0 && b > a);
  const frozen = restored.slice(0, a) + '<script id="dhv-runtime"></script>' + restored.slice(b + '</script>'.length);
  assert.equal(createHash('sha256').update(frozen).digest('hex'), FROZEN_WITHOUT_RUNTIME_SHA256);
  assert.equal(viewer.includes('DHV_SCOPE_BRIDGE'), true);
  assert.notEqual(createHash('sha256').update(restored).digest('hex'), ATTACHED_SHA256);
  const runtime = restored.slice(a, b);
  assert.match(runtime, /proto\.requestPointerLock=wrapped/);
  assert.match(runtime, /function camPreset/);
  assert.match(runtime, /function tpBasement/);
  assert.match(runtime, /zIndex='9600'/);
  assert.match(runtime, /data-dhv/);
  assert.equal(runtime.includes("orbSet(nm);orbToggle(true)"), false);
});

test('orbit mask does not sit above the pause Menu button', () => {
  const a = viewer.indexOf('<script id="dhv-runtime">');
  const b = viewer.indexOf('</script>', a);
  const runtime = viewer.slice(a, b);
  const overlay = runtime.match(/dhvOrbit[\s\S]{0,220}/);
  assert.ok(overlay, 'orbit overlay missing');
  assert.match(overlay[0], /z-index:9000/);
  assert.match(runtime, /querySelector\('button\[title="Pause menu \(Esc\)"\]'\)/);
  assert.match(runtime, /menuBtn\.style\.zIndex='9100'/);
  const gameMenu = viewer.slice(0, a);
  assert.match(gameMenu, /mb\.style\.cssText='position:fixed;right:152px;top:50px;z-index:40/);
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

test('index.html is not this viewer, and the viewer keeps the pre-port lines', () => {
  assert.equal(indexHtml.includes('DHV_SCOPE_BRIDGE'), false);
  assert.equal(indexHtml.includes('__DHV'), false);
  assert.match(viewer, /if\(!reached\(g\.reach,r\+50\)\)/);
  assert.equal(viewer.includes('FORT_ACCESS_BEGIN'), false);
  assert.equal(viewer.includes('SCENIC_STAIR_BEGIN'), false);
  assert.equal(viewer.includes('const gateWord='), false);
  assert.equal(viewer.includes('__vehRsp'), false);
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
