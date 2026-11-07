/**
 * functional-test.html is the main-branch test build plus a diagnostic renderer.
 * Gameplay bytes match test.html except the labeled return-fix, storage names,
 * Potato-start default, and the functional boot/runtime blocks.
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
const testHtml = read('test.html');
const funcHtml = read('functional-test.html');
const indexHtml = read('index.html');

const RETURN_FIX = '4c1ff358140a69ea757714fb198864ad6cdd1409';
const GAMEPLAY = 'c06a10260cc37775945efc584ebe500b863744ae';

function stripScripts(html, ids) {
  let out = html;
  for (const id of ids) {
    const re = new RegExp(`<script id="${id}">[\\s\\S]*?</script>\\n?`, 'g');
    const n = (out.match(re) || []).length;
    assert.equal(n, 1, id);
    out = out.replace(re, '');
  }
  return out;
}

function normalizeFunctional(html) {
  let out = stripScripts(html, ['dh-functional-boot', 'dh-functional-runtime']);
  const scope = '\n/* DH_FUNC_SCOPE_START */\nwindow.__DH_FUNC_SCOPE={scene:scene,ren:ren,cam:cam,ground:ground,zs:function(){return zs},pieces:function(){return pieces},ghost:function(){return ghost},boxes:function(){return boxes},zAlive:function(){return zAlive}};\n/* DH_FUNC_SCOPE_END */\n';
  assert.equal(out.includes(scope), true);
  out = out.replace(scope, '');
  const qiNew = "let qi=3;try{const t=localStorage.getItem('dhGfxFunctional');if(t!==null){const v=+t;if(v>=0&&v<4)qi=v|0}else qi=3}catch(e){qi=3}   // FUNCTIONAL PAGE only: Potato instance distance at first paint. Lighting and resolution stay capped by dh-functional-boot.";
  const qiOld = "let qi=2;try{const t=localStorage.getItem('dhGfxFunctional');if(t!==null){const v=+t;if(v>=0&&v<4)qi=v|0}}catch(e){}   // starts on LOW until you pick otherwise";
  assert.equal(out.includes(qiNew), true);
  out = out.replace(qiNew, qiOld);
  const newHurt = "if(pHP<=0){window.__willRsp=1;window.__willRspNote=0;toast('You died. Back at the farm.',4);";
  const oldHurt = "if(pHP<=0){window.__willRsp=1;toast('You died. Back at the farm.',4);";
  assert.equal(out.includes(newHurt), true);
  out = out.replace(newHurt, oldHurt);
  const newGoal = "if(window.__willRsp){/* RETURN FIX from PR10 4c1ff358140a69ea757714fb198864ad6cdd1409. Death respawn counts as arriving only inside the real return circle. Farm foot-spawn is outside that circle, so clear there; empty-handed completion stays blocked while still inside, and any haul clears it. */if(!reached(g.reach,r))window.__willRsp=0;else if(S.cur&&S.cur.id==='return'&&!(carry.w+carry.s+carry.m>0)){if(!window.__willRspNote){window.__willRspNote=1;try{toast('Death put you on the farm empty-handed. Step outside this area and walk back in, or bring a haul.',5)}catch(e){}}return false}else window.__willRsp=0}";
  const oldGoal = "if(window.__willRsp){if(!reached(g.reach,r+50))window.__willRsp=0;else if(S.cur&&S.cur.id==='return'&&!(carry.w+carry.s+carry.m>0))return false;else window.__willRsp=0}";
  assert.equal(out.includes(newGoal), true);
  out = out.replace(newGoal, oldGoal);
  for (const [b, a] of [
    ['dhSaveVerFunctional', 'dhSaveVerTest'],
    ['dhSaveFunctional', 'dhSaveTest'],
    ['dhGfxFunctional', 'dhGfxTest'],
    ['dhLockV1Functional', 'dhLockV1Test'],
    ['dhCtlFunctional', 'dhCtlTest'],
    ['dhFpsFunctional', 'dhFpsTest'],
    ['dhMuteFunctional', 'dhMuteTest'],
    ['dhSensFunctional', 'dhSensTest'],
  ]) out = out.replaceAll(b, a);
  out = out.replace(
    'if ( material.emissive && uniforms.emissive ) {',
    'if ( material.emissive ) {',
  );
  out = out.replace(
    '<title>TEST ONLY FUNCTIONAL — not normal graphics — Dead Harvest v0.26.0-campaign-nov5',
    '<title>Dead Harvest v0.26.0-campaign-nov5',
  );
  return out;
}

test('functional page matches test.html except the labeled renderer and return fix', () => {
  const norm = normalizeFunctional(funcHtml);
  assert.equal(norm, testHtml);
});

test('scripts parse and storage keys stay off the live, test, and harness names', () => {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0;
  while ((m = re.exec(funcHtml))) {
    if (/\bsrc=/i.test(m[1] || '')) continue;
    const file = join(tmpdir(), `functional-script-${n}.js`);
    writeFileSync(file, m[2]);
    execFileSync('node', ['--check', file], { stdio: 'pipe' });
    n++;
  }
  assert.equal(n, 8);
  const live = ["'dhSave'", "'dhSaveVer'", "'dhGfx2'", "'dhCtl'", "'dhLockV1'", "'dhFps'", "'dhSens'", "'dhMute'", "'dhSaveTest'", "'dhSaveVerTest'", "'dhGfxTest'", "'dhCtlTest'", "'dhSaveHarness'", "'dhSaveVerHarness'", "'dhGfxHarness'", "'dhCtlHarness'"];
  for (const k of live) assert.equal(funcHtml.includes(k), false, k);
  for (const k of ["'dhSaveFunctional'", "'dhSaveVerFunctional'", "'dhGfxFunctional'", "'dhCtlFunctional'", "'dhLockV1Functional'", "'dhFpsFunctional'", "'dhSensFunctional'", "'dhMuteFunctional'"]) {
    assert.equal(funcHtml.includes(k), true, k);
  }
});

test('index.html and test.html bytes are the current main game and test build', () => {
  assert.equal(createHash('sha256').update(indexHtml).digest('hex'), 'ec826263e621833f1dc39d581e3f7ac037095442764207e93017ef67bb13b3b6');
  assert.equal(createHash('sha256').update(testHtml).digest('hex'), '3cd3c0ed8e88bb0093ddeacdc4fd8ebc19f211e7df36145d331dae88c9f9016e');
  assert.equal(funcHtml.includes(GAMEPLAY), true);
  assert.equal(funcHtml.includes(RETURN_FIX), true);
});

function loadGoalMet(html) {
  const i = html.indexOf('const goalMet=s=>');
  const j = html.indexOf('\n', i);
  const src = html.slice(i, j);
  const context = {
    window: {},
    S: { cur: { id: 'return' }, t: 0 },
    carry: { w: 0, s: 0, m: 0 },
    MS: {},
    POWER: { on: false },
    C: { places: { barn: { radius: 9 }, fort: { radius: 7 } } },
    baseInfo: () => ({ done: false }),
    FG: () => null,
    toast() {},
    player: { x: -23.7, z: -1.4 },
    reached(target, radius) {
      const p = target && typeof target === 'object' ? target : { x: 10, z: 18 };
      return Math.hypot(context.player.x - p.x, context.player.z - p.z) < radius;
    },
  };
  vm.createContext(context);
  vm.runInContext(`${src}\nthis.goalMet=goalMet;`, context);
  return context;
}

const RETURN = { id: 'return', goal: { reach: { x: 10, z: 18 }, radius: 30 } };

test('return fix matches PR10 behavior on this page only', () => {
  const ctx = loadGoalMet(funcHtml);
  ctx.window.__willRsp = 1;
  assert.equal(ctx.goalMet(RETURN), false);
  assert.equal(ctx.window.__willRsp, 0);
  ctx.player = { x: 10, z: 18 };
  assert.equal(ctx.goalMet(RETURN), true);

  const inside = loadGoalMet(funcHtml);
  inside.window.__willRsp = 1;
  inside.player = { x: 0, z: 18 };
  assert.equal(inside.goalMet(RETURN), false);
  assert.equal(inside.window.__willRsp, 1);
  inside.carry.w = 1;
  assert.equal(inside.goalMet(RETURN), true);
});

test('renderer pass does not delete collision boxes or skip raid and zombie ticks', () => {
  const boot = funcHtml.slice(funcHtml.indexOf('<script id="dh-functional-boot">'), funcHtml.indexOf('</script>', funcHtml.indexOf('dh-functional-boot')) );
  const run = funcHtml.slice(funcHtml.indexOf('<script id="dh-functional-runtime">'), funcHtml.indexOf('</script>', funcHtml.indexOf('dh-functional-runtime')));
  for (const block of [boot, run]) {
    assert.equal(/boxes\.splice|raidQueue|zTick\s*=|delete window\.STORY/.test(block), false);
  }
  assert.match(boot, /antialias = false/);
  assert.match(boot, /shadowMap/);
  assert.match(boot, /MeshStandardMaterial/);
  assert.match(run, /isPoints/);
  assert.match(run, /90 \* 90/);
  assert.match(funcHtml, /collision boxes/);
});
