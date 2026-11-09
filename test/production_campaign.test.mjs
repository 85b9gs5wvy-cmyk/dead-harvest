/**
 * Production-function checks for the test builds.
 * Loads goalMet from test.html and campaign-test.html and runs the return-goal cases.
 * Raid night is audited, not changed: the HUD label is the calendar day, separate from the spawn queue.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, ROOT), 'utf8');
const testHtml = read('test.html');
const harnessHtml = read('campaign-test.html');
const indexHtml = read('index.html');

const GOAL_AT = { x: 10, z: 18 };
const FARM_SPAWN = { x: -23.7, z: -1.4 };
const CAR_DEATH = { x: 0, z: 18 };
const RETURN_R = 30;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function extract(html, start, end) {
  const i = html.indexOf(start);
  assert.ok(i >= 0, `missing ${start.slice(0, 40)}`);
  const j = html.indexOf(end, i);
  assert.ok(j > i);
  return html.slice(i, j);
}

function loadGoalMet(html) {
  const src = extract(html, 'const goalMet=s=>', '\n// ===== v0.23.1 SIDE MISSION');
  const toasts = [];
  const context = {
    window: {},
    S: { cur: { id: 'return' }, t: 0 },
    carry: { w: 0, s: 0, m: 0 },
    MS: {},
    POWER: { on: false },
    C: { places: { barn: { radius: 9 }, fort: { radius: 7 } } },
    baseInfo: () => ({ done: false }),
    FG: () => null,
    toast: (msg) => { toasts.push(msg); },
    player: { ...FARM_SPAWN },
    reached(target, radius) {
      const p = target && typeof target === 'object' ? target : GOAL_AT;
      return dist(context.player, p) < radius;
    },
  };
  context.window = context.window;
  vm.createContext(context);
  vm.runInContext(`${src}\nthis.goalMet = goalMet;`, context);
  return { goalMet: context.goalMet, context, toasts };
}

const RETURN = { id: 'return', goal: { reach: { ...GOAL_AT }, radius: RETURN_R } };

test('farm foot-spawn is outside the return circle and inside the old r+50 ring', () => {
  const d = dist(FARM_SPAWN, GOAL_AT);
  assert.ok(d > RETURN_R, d);
  assert.ok(d < RETURN_R + 50, d);
  assert.ok(dist(CAR_DEATH, GOAL_AT) < RETURN_R);
});

test('death outside the circle no longer blocks a later empty walk-in', () => {
  for (const html of [testHtml, harnessHtml, read('functional-test.html'), indexHtml]) {
    const { goalMet, context } = loadGoalMet(html);
    context.window.__willRsp = 1;
    context.player = { ...FARM_SPAWN };
    context.carry.w = context.carry.s = context.carry.m = 0;
    assert.equal(goalMet(RETURN), false);
    assert.equal(context.window.__willRsp, 0);
    context.player = { ...GOAL_AT };
    assert.equal(goalMet(RETURN), true);
  }
});

test('death already inside the circle still requires a haul or a real re-entry', () => {
  const { goalMet, context, toasts } = loadGoalMet(testHtml);
  context.window.__willRsp = 1;
  context.window.__willRspNote = 0;
  context.player = { ...CAR_DEATH };
  assert.equal(goalMet(RETURN), false);
  assert.equal(context.window.__willRsp, 1);
  assert.equal(toasts.length, 1);
  assert.equal(goalMet(RETURN), false);
  assert.equal(toasts.length, 1);

  context.carry.w = 1;
  assert.equal(goalMet(RETURN), true);
  assert.equal(context.window.__willRsp, 0);
});

test('leaving the real circle clears the guard; walking back in completes empty', () => {
  const { goalMet, context } = loadGoalMet(testHtml);
  context.window.__willRsp = 1;
  context.player = { ...CAR_DEATH };
  assert.equal(goalMet(RETURN), false);
  context.player = { x: GOAL_AT.x + 31, z: GOAL_AT.z };
  assert.equal(goalMet(RETURN), false);
  assert.equal(context.window.__willRsp, 0);
  context.player = { ...GOAL_AT };
  assert.equal(goalMet(RETURN), true);
});

test('a normal empty arrival is still allowed when the death guard is off', () => {
  const { goalMet, context } = loadGoalMet(testHtml);
  context.window.__willRsp = 0;
  context.player = { ...GOAL_AT };
  assert.equal(goalMet(RETURN), true);
});

test('fort reach is not held by the return haul guard', () => {
  const { goalMet, context } = loadGoalMet(testHtml);
  context.window.__willRsp = 1;
  context.S.cur = { id: 'fort' };
  context.player = { ...GOAL_AT };
  context.reached = () => true;
  assert.equal(goalMet({ id: 'fort', goal: { reach: 'fort' } }), true);
  assert.equal(context.window.__willRsp, 0);
});

test('both test pages share the same goalMet and still use separate save keys', () => {
  const a = extract(testHtml, 'const goalMet=s=>', '\n');
  const b = extract(harnessHtml, 'const goalMet=s=>', '\n');
  const c = extract(read('functional-test.html'), 'const goalMet=s=>', '\n');
  assert.equal(a, b);
  assert.equal(a, c);
  assert.match(a, /!reached\(g\.reach,r\)/);
  assert.doesNotMatch(a, /r\+50/);
  assert.match(testHtml, /KEY='dhSaveTest',VKEY='dhSaveVerTest'/);
  assert.match(testHtml, /localStorage\.getItem\('dhGfxTest'\)/);
  assert.match(harnessHtml, /KEY='dhSaveHarness',VKEY='dhSaveVerHarness'/);
  assert.match(harnessHtml, /localStorage\.getItem\('dhGfxHarness'\)/);
  assert.match(harnessHtml, /else\{qi=3\}/);
  assert.match(testHtml, /window\.__willRsp=1;window\.__willRspNote=0;/);
  assert.match(harnessHtml, /window\.__willRsp=1;window\.__willRspNote=0;/);
});

test('index.html uses the real reach radius and the death toast, and keeps live save keys', () => {
  const line = extract(indexHtml, 'const goalMet=s=>', '\n');
  assert.match(line, /if\(!reached\(g\.reach,r\)\)window\.__willRsp=0/);
  assert.doesNotMatch(line, /r\+50/);
  assert.match(line, /__willRspNote/);
  assert.match(line, /Death put you on the farm empty-handed/);
  assert.doesNotMatch(line, /S\.cur\.id==='return'/);
  assert.match(indexHtml, /window\.__willRsp=1;window\.__willRspNote=0;/);
  assert.match(indexHtml, /KEY='dhSave',VKEY='dhSaveVer'/);
  assert.doesNotMatch(indexHtml, /dhSaveTest|dhSaveHarness|dhSaveFunctional/);
});

function raidConsts(html) {
  const m = html.match(/const RAID_ATK_SLOTS=(\d+),RAID_BATCH=(\d+),RAID_GAP=([\d.]+),RAID_TC_LOYAL=(\d+)/);
  assert.ok(m);
  return { slots: +m[1], batch: +m[2], gap: +m[3], loyal: +m[4] };
}

function banner(day) {
  return day % 5 === 0 ? '⚠ RAID NIGHT' : `Raid in ${5 - (day % 5)}d`;
}

function shouldStart(day, raidDay, dayT) {
  return day % 5 === 0 && raidDay !== day && dayT >= 0.55;
}

/** Mirrors startRaid's first batch plus the zTick queue drain. */
function drainQueue(n, { batch, gap }, dt = 0.05) {
  let queue = n;
  let gapT = 0;
  let spawned = 0;
  const take = () => {
    let k = 0;
    while (k < batch && queue > 0) { queue--; spawned++; k++; }
  };
  take();
  gapT = gap;
  let t = 0;
  const limit = gap * (Math.ceil(n / batch) + 3);
  while (queue > 0 && t < limit) {
    t += dt;
    gapT -= dt;
    if (gapT <= 0) { take(); gapT = gap; }
  }
  return { queue, spawned, t };
}

test('raid label stays on a raid day after the queue and the living raiders are gone', () => {
  for (const html of [testHtml, harnessHtml]) {
    assert.match(html, /rt=day%5===0\?'⚠ RAID NIGHT':'Raid in '\+\(5-day%5\)\+'d'/);
    assert.match(html, /shouldStart:\(d,rd,t\)=>d%5===0&&rd!==d&&t>=\.55/);
    assert.match(html, /if\(z\.raid&&dayT>\.02&&dayT<\.2&&dp>60\)\{rmZ\(z\);continue\}/);
  }
  assert.equal(banner(5), '⚠ RAID NIGHT');
  assert.equal(banner(6), 'Raid in 4d');
  assert.equal(shouldStart(5, 5, 0.8), false);
  assert.equal(shouldStart(5, 0, 0.55), true);
  assert.equal(shouldStart(5, 0, 0.54), false);
  assert.equal(shouldStart(6, 5, 0.8), false);
});

test('killing the current batch does not finish a raid that still has a queue', () => {
  const { batch, gap } = raidConsts(testHtml);
  assert.deepEqual(raidConsts(harnessHtml), raidConsts(testHtml));
  const n = Math.min(45, 10 + 5 * 2);
  let queue = n;
  let alive = 0;
  const spawn = (k) => { while (k > 0 && queue > 0) { queue--; alive++; k--; } };
  spawn(Math.min(batch, queue));
  alive = 0;
  assert.ok(queue > 0);
  assert.equal(banner(5), '⚠ RAID NIGHT');
  const done = drainQueue(n, { batch, gap });
  assert.equal(done.queue, 0);
  assert.equal(done.spawned, n);
  assert.equal(shouldStart(5, 5, 0.9), false);
  assert.equal(banner(5), '⚠ RAID NIGHT');
});

test('the calendar day, not a zombie kill, is what retires the RAID NIGHT label', () => {
  const DAY_SECS = 405;
  let day = 5;
  let dayT = 0.99;
  const dt = DAY_SECS * 0.02;
  dayT += dt / DAY_SECS;
  assert.ok(dayT >= 1);
  while (dayT >= 1) { dayT -= 1; day++; }
  assert.equal(day, 6);
  assert.equal(banner(day), 'Raid in 4d');
  assert.match(testHtml, /const DAY_SECS=405/);
  assert.match(testHtml, /dayT\+=dt\/DAY_SECS;if\(dayT>=1\)/);
});
