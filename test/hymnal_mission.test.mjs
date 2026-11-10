/**
 * Eliza Hollow hymnal step on Main Play (index.html).
 * Replaces the old story index 7 ("Take your haul back to the farm") and
 * index 8 ("Build a 2×1 shelter"). Fort Harvest stays at index 9.
 * The build menu and death respawn stay. State checks run in Node.
 * The browser test teleports and calls the real interact path; it does not
 * walk the campaign by hand.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const indexHtml = readFileSync(new URL('index.html', ROOT), 'utf8');
const EXPECTED = ['calm', 'surge', 'barn', 'barnLights', 'plant', 'quarry', 'sawmill', 'hymnal', 'hymnalHold', 'fort', 'end'];

function between(html, start, end) {
  const i = html.indexOf(start);
  assert.ok(i >= 0, start.slice(0, 48));
  const j = html.indexOf(end, i + start.length);
  assert.ok(j > i, end.slice(0, 48));
  return html.slice(i + start.length, j);
}

function storyConfig() {
  const src = between(indexHtml, '<script id="story-config">', '</script>');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(src, context);
  return context.window.STORY_CONFIG;
}

function rules() {
  const src = between(indexHtml, '/*HYMNAL_RULES_START*/', '/*HYMNAL_RULES_END*/');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${src}\nthis.hymnalLoad=hymnalLoad;this.hymnalReduce=hymnalReduce;this.hymnalMarker=hymnalMarker;this.hymnalActive=hymnalActive;this.hymnalSkip=hymnalSkip;this.HYMNAL_LOCAL=HYMNAL_LOCAL;`, context);
  return context;
}

function goalMetFn() {
  const line = indexHtml.slice(indexHtml.indexOf('const goalMet=s=>'), indexHtml.indexOf('\n', indexHtml.indexOf('const goalMet=s=>')));
  const context = {
    window: {},
    S: { cur: { id: 'hymnal' }, t: 0 },
    carry: { w: 0, s: 0, m: 0 },
    MS: {},
    POWER: { on: false },
    C: { places: { barn: { radius: 9 }, fort: { radius: 7 } } },
    baseInfo: () => ({ done: true, tc: true, f: 2, need: 6, have: 6, door: true }),
    FG: () => null,
    toast() {},
    reached: () => true,
  };
  vm.createContext(context);
  vm.runInContext(`${line}\nthis.goalMet=goalMet;`, context);
  return context;
}

const cfg = storyConfig();
const R = rules();

test('campaign order replaces the farm return and the 2×1 shelter without moving Fort Harvest', () => {
  const ids = JSON.parse(JSON.stringify(cfg.steps.map((s) => s.id)));
  assert.deepEqual(ids, EXPECTED);
  assert.equal(ids.indexOf('hymnal'), 7);
  assert.equal(ids.indexOf('hymnalHold'), 8);
  assert.equal(ids.indexOf('fort'), 9);
  assert.equal(ids.indexOf('end'), 10);
  assert.equal(ids.includes('return'), false);
  assert.equal(ids.includes('build'), false);
  const saw = cfg.steps[6];
  const hymnal = cfg.steps[7];
  const hold = cfg.steps[8];
  const fort = cfg.steps[9];
  assert.equal(saw.id, 'sawmill');
  assert.equal(saw.goal.on, 'sawmill');
  assert.equal(hymnal.goal.hymnal, true);
  assert.equal(hymnal.goal.reach, undefined);
  assert.equal(hold.goal.hymnal, true);
  assert.equal(hold.goal.reach, undefined);
  for (const step of [hymnal, hold]) {
    assert.match(step.objective, /Eliza Hollow/);
    assert.match(step.objective, /Hollow Creek Cemetery/);
    assert.match(step.objective, /chapel lectern/);
    assert.doesNotMatch(step.objective, /farm|haul|shelter|2×1/i);
    assert.doesNotMatch(step.popup.text, /head home|Time to build|Tool Cupboard/i);
  }
  assert.match(hymnal.popup.text, /\(F\)/);
  assert.equal(fort.objective, 'Go to Fort Harvest and find out what happened in the city');
  assert.equal(fort.goal.reach, 'fort');
  const runtime = between(indexHtml, '<script id="story-runtime">', '</script>');
  for (const step of cfg.steps) {
    const blob = JSON.stringify(step.goal || {}) + ' ' + step.objective;
    assert.doesNotMatch(blob, /baseBuilt|2×1|Take your haul|x":10/);
  }
  assert.equal(cfg.steps.some((s) => s.goal && s.goal.reach && s.goal.reach.x === 10), false);
  assert.doesNotMatch(runtime, /o=C\.text\.nightfallObjective/);
  assert.match(runtime, /findIndex\(s=>s\.id==='hymnal'\)/);
  assert.match(indexHtml, /if\(foot\)farmSpawn\(\)/);
  assert.match(indexHtml, /function renderMenu/);
  assert.match(indexHtml, /Place your Tool Cupboard first/);
  assert.match(indexHtml, /KEY='dhSave',VKEY='dhSaveVer',VER=2/);
  assert.match(indexHtml, /SIDE MISSION/);
});

test('each story step has a completion path the runtime actually checks', () => {
  const goalLine = indexHtml.slice(indexHtml.indexOf('const goalMet=s=>'), indexHtml.indexOf('\n', indexHtml.indexOf('const goalMet=s=>')));
  const barnFlip = indexHtml.includes("S.cur.id==='barn'") && indexHtml.includes('advance();return');
  assert.equal(barnFlip, true);
  for (const step of cfg.steps) {
    const g = step.goal || {};
    if (step.id === 'barn') {
      assert.equal(step.goal, undefined);
      assert.equal(step.target, 'barnBox');
      continue;
    }
    if (step.id === 'end') {
      assert.equal(step.goal, undefined);
      continue;
    }
    const kind = g.wait != null ? 'wait' : g.on ? 'on' : g.plantBreaker ? 'plant' : g.reach ? 'reach' : g.hymnal ? 'hymnal' : g.baseBuilt ? 'base' : '';
    assert.notEqual(kind, '', step.id);
    assert.notEqual(kind, 'base', step.id);
    if (kind === 'wait') assert.match(goalLine, /g\.wait!=null/);
    if (kind === 'on') assert.match(goalLine, /g\.on/);
    if (kind === 'plant') assert.match(goalLine, /g\.plantBreaker/);
    if (kind === 'reach') assert.match(goalLine, /g\.reach/);
    if (kind === 'hymnal') assert.match(goalLine, /g\.hymnal/);
  }
});

test('pickup does not finish the step, early delivery does not, and the lectern pays off once', () => {
  let h = { carried: false, delivered: false, rewarded: false, step: true };
  let r = R.hymnalReduce(h, 'goal');
  assert.equal(r.met, false);
  r = R.hymnalReduce(h, 'deliver');
  assert.equal(r.why, 'empty');
  assert.equal(r.advance, false);
  assert.equal(r.reward, 0);
  r = R.hymnalReduce(h, 'pickup');
  assert.equal(r.ok, true);
  assert.equal(r.advance, false);
  assert.equal(r.reward, 0);
  h = r.h;
  assert.equal(R.hymnalMarker(h), 'lectern');
  assert.equal(R.hymnalReduce(h, 'goal').met, false);
  r = R.hymnalReduce(h, 'pickup');
  assert.equal(r.why, 'held');
  const early = R.hymnalReduce({ ...h, step: false }, 'deliver');
  assert.equal(early.why, 'early');
  assert.equal(early.h.delivered, false);
  assert.equal(early.reward, 0);
  const dead = R.hymnalReduce(h, 'death');
  assert.equal(dead.h.carried, true);
  assert.equal(dead.h.delivered, false);
  assert.equal(dead.met, false);
  assert.equal(dead.reward, 0);
  r = R.hymnalReduce(h, 'deliver');
  assert.equal(r.why, 'laid');
  assert.equal(r.advance, true);
  assert.equal(r.reward, 1);
  assert.equal(r.h.delivered, true);
  assert.equal(R.hymnalMarker(r.h), null);
  const again = R.hymnalReduce(r.h, 'deliver');
  assert.equal(again.why, 'done');
  assert.equal(again.reward, 0);
  assert.equal(again.advance, false);
  assert.equal(R.hymnalReduce(again.h, 'pickup').why, 'resting');
});

test('goalMet stays false until the hymnal is delivered on that step', () => {
  const ctx = goalMetFn();
  const step = { id: 'hymnal', goal: { hymnal: true } };
  assert.equal(ctx.goalMet(step), false);
  ctx.window.HYMNAL = { delivered: false, carried: true };
  assert.equal(ctx.goalMet(step), false);
  ctx.window.HYMNAL.delivered = true;
  ctx.S.cur = { id: 'return' };
  assert.equal(ctx.goalMet(step), false);
  ctx.S.cur = { id: 'hymnal' };
  assert.equal(ctx.goalMet(step), true);
  ctx.S.cur = { id: 'hymnalHold' };
  assert.equal(ctx.goalMet(step), true);
  ctx.reached = () => false;
  ctx.S.cur = { id: 'fort' };
  ctx.window.HYMNAL = { delivered: true, carried: false };
  assert.equal(ctx.goalMet({ id: 'fort', goal: { reach: 'fort' } }), false);
  assert.equal(ctx.goalMet({ id: 'hymnal', goal: { hymnal: true } }), false);
});

test('older saves keep their index, and a hymnal already in hand is not wiped', () => {
  const hi = 8;
  const load = (...args) => JSON.parse(JSON.stringify(R.hymnalLoad(...args)));
  assert.equal(R.hymnalSkip('hymnal', { delivered: true }), false);
  assert.equal(R.hymnalSkip('hymnalHold', { delivered: false }), false);
  assert.equal(R.hymnalSkip('hymnalHold', { delivered: true }), true);
  assert.equal(R.hymnalSkip('fort', { delivered: true }), false);
  assert.equal(R.hymnalActive('hymnal') && R.hymnalActive('hymnalHold') && !R.hymnalActive('fort'), true);
  assert.deepEqual(load(undefined, 6, hi), { carried: false, delivered: false, rewarded: false });
  assert.deepEqual(load(undefined, 7, hi), { carried: false, delivered: false, rewarded: false });
  assert.deepEqual(load(undefined, 8, hi), { carried: false, delivered: false, rewarded: false });
  assert.deepEqual(load(undefined, 9, hi), { carried: false, delivered: true, rewarded: true });
  assert.deepEqual(load(undefined, 10, hi), { carried: false, delivered: true, rewarded: true });
  assert.deepEqual(load({ carried: 1 }, 7, hi), { carried: true, delivered: false, rewarded: false });
  assert.deepEqual(load({ carried: 1 }, 8, hi), { carried: true, delivered: false, rewarded: false });
  assert.deepEqual(load({ delivered: 1 }, 8, hi), { carried: false, delivered: true, rewarded: true });
  assert.deepEqual(load({ carried: 1 }, 9, hi), { carried: false, delivered: true, rewarded: true });
  assert.equal(R.hymnalMarker({ step: true, carried: false, delivered: false }), 'eliza');
  assert.equal(R.hymnalMarker({ step: false, carried: false, delivered: false }), null);
  const local = R.HYMNAL_LOCAL;
  const outside = (x, z, x0, x1, z0, z1, pad) => x < x0 - pad || x > x1 + pad || z < z0 - pad || z > z1 + pad;
  assert.equal(outside(local.eliza.x, local.eliza.z, 6.5, 9.5, -1.5, 1.5, 0.4), true);
  assert.equal(outside(local.lectern.x, local.lectern.z, -32.7, -31.3, -1.4, 1.4, 0.4), true);
  assert.match(indexHtml, /angel\(8,0,1\.3,Math\.PI\/2,'reach','ELIZA HOLLOW/);
  assert.match(indexHtml, /hymnal:window\.HYMNAL\?\{carried:/);
  assert.match(indexHtml, /window\.HYMNAL&&d\.story\)window\.HYMNAL\.load/);
});

test('headless Chrome runs the hymnal interact, save, death, and fort handoff', { timeout: 150000 }, async () => {
  const server = createServer((req, res) => {
    if (req.url.split('?')[0] !== '/index.html') {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(indexHtml);
  });
  const port = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
  const profile = mkdtempSync(tmpdir() + '/dh-hymnal-');
  const shots = '/opt/cursor/artifacts';
  mkdirSync(shots, { recursive: true });
  const debug = 9364;
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${debug}`, '--remote-allow-origins=*',
    '--window-size=1280,720', 'about:blank',
  ], { stdio: 'ignore' });
  let ws;
  const logs = [];
  const shot = async (send, name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const data = res.result && res.result.data;
    assert.equal(typeof data, 'string');
    writeFileSync(join(shots, name), Buffer.from(data, 'base64'));
  };
  try {
    const list = await waitForList(debug);
    const page = list.find((t) => t.type === 'page') || list[0];
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params && msg.params.exceptionDetails;
        logs.push(String(d && (d.text || (d.exception && d.exception.description)) || 'exception'));
      }
    };
    const send = (method, params) => new Promise((resolve) => {
      const n = ++id;
      pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
    const evalJson = async (expression) => {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (res.result && res.result.exceptionDetails) {
        throw new Error(JSON.stringify(res.result.exceptionDetails).slice(0, 800));
      }
      return res.result && res.result.result && res.result.result.value;
    };
    await send('Runtime.enable', {});
    await send('Page.enable', {});
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
    const boot = await waitUntil(evalJson, (s) => s && s.story && s.hymnal && !s.storyErr, 90000);
    assert.equal(boot.storyErr || '', '');
    assert.equal(logs.length, 0, logs.join('\n').slice(0, 800));

    const prep = await evalJson(`(() => {
      ADM.god = true;
      const note = STORY.goto('hymnal');
      const pop = document.getElementById('sPop');
      if (pop) pop.style.opacity = '0';
      const spot = HYMNAL.spots.eliza;
      const g = GYG.position, b = HYMNAL.book.position;
      pl.set(spot.x, 0, spot.z);
      yaw = Math.atan2(-(g.x + b.x - spot.x), -(g.z + b.z - spot.z));
      pit = -0.35;
      return { note, id: STORY.cur.id, blocked: blockedAt(spot.x, 0.5, spot.z), book: HYMNAL.book.visible, sign: HYMNAL.sign.visible };
    })()`);
    assert.equal(prep.id, 'hymnal');
    assert.equal(prep.blocked, false, JSON.stringify(prep));
    assert.equal(prep.book, true);
    await new Promise((r) => setTimeout(r, 600));
    const atAngel = await evalJson(`(() => {
      const n = nearest();
      return { id: STORY.cur.id, carried: HYMNAL.carried, delivered: HYMNAL.delivered, prompt: n && n.pr ? n.pr() : '', obj: document.getElementById('sObj').innerText, marker: STORY.tgt, mkr: (typeof mkr!=='undefined') };
    })()`);
    assert.equal(atAngel.id, 'hymnal');
    assert.equal(atAngel.carried, false);
    assert.match(atAngel.prompt, /Take Eliza Hollow/);
    assert.match(atAngel.obj, /reaching angel/);
    assert.ok(atAngel.marker, JSON.stringify(atAngel));
    assert.ok(Math.abs(atAngel.marker.x - boot.elizaX) < 0.05, JSON.stringify(atAngel.marker));
    await shot(send, 'hymnal-angel.png');

    const took = await evalJson(`(() => { interact(); return { id: STORY.cur.id, carried: HYMNAL.carried, delivered: HYMNAL.delivered, book: HYMNAL.book.visible, rewarded: HYMNAL.rewarded }; })()`);
    assert.equal(took.carried, true);
    assert.equal(took.delivered, false);
    assert.equal(took.id, 'hymnal');
    assert.equal(took.book, false);
    assert.equal(took.rewarded, false);
    const saved = await evalJson(`(() => { const ok = dhSave.save(); const raw = JSON.parse(localStorage.getItem('dhSave')); return { ok, idx: raw.story.idx, hymnal: raw.hymnal, v: raw.v, key: localStorage.getItem('dhSaveVer') }; })()`);
    assert.equal(saved.ok, true);
    assert.equal(saved.v, 2);
    assert.equal(saved.key, '2');
    assert.equal(saved.idx, 7);
    assert.deepEqual(saved.hymnal, { carried: 1, delivered: 0 });

    await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
    const resumed = await waitUntil(evalJson, (s) => s && s.menu, 90000);
    assert.equal(resumed.storyErr || '', '');
    const loaded = await evalJson(`(() => { document.getElementById('willCont').click(); return true; })()`);
    assert.equal(loaded, true);
    const afterLoad = await waitUntil(evalJson, (s) => s && s.carried && s.id === 'hymnal' && !s.menu, 15000);
    assert.equal(afterLoad.carried, true);
    assert.equal(afterLoad.delivered, false);
    assert.equal(afterLoad.id, 'hymnal');
    assert.match(afterLoad.obj, /chapel lectern/);

    const died = await evalJson(`(() => {
      ADM.god = false;
      const before = STORY.cur.id;
      hurt(250);
      return { before, id: STORY.cur.id, carried: HYMNAL.carried, delivered: HYMNAL.delivered, hp: pHP, x: pl.x, z: pl.z };
    })()`);
    assert.equal(died.id, 'hymnal');
    assert.equal(died.carried, true);
    assert.equal(died.delivered, false);
    assert.equal(died.hp, 100);
    assert.ok(Math.hypot(died.x + 23.7, died.z + 1.4) < 2, JSON.stringify(died));

    const laidPrep = await evalJson(`(() => {
      ADM.god = true;
      const spot = HYMNAL.spots.lectern;
      const g = GYG.position, stand = HYMNAL.onStand.parent.position;
      pl.set(spot.x, 0, spot.z);
      yaw = Math.atan2(-(g.x + stand.x - spot.x), -(g.z + stand.z - spot.z));
      pit = -0.25;
      const n = nearest();
      return { blocked: blockedAt(spot.x, 0.5, spot.z), prompt: n && n.pr ? n.pr() : '', id: STORY.cur.id, marker: STORY.tgt && { x: STORY.tgt.x, z: STORY.tgt.z } };
    })()`);
    assert.equal(laidPrep.blocked, false, JSON.stringify(laidPrep));
    assert.match(laidPrep.prompt, /Lay Eliza Hollow/);
    assert.equal(laidPrep.id, 'hymnal');
    await evalJson(`(() => { const p=document.getElementById('sPop'); if(p)p.style.opacity='0'; if(typeof msgEl!=='undefined') msgEl.style.opacity='0'; return true; })()`);
    await new Promise((r) => setTimeout(r, 400));
    await shot(send, 'hymnal-lectern.png');
    const laid = await evalJson(`(() => { interact(); return { id: STORY.cur.id, delivered: HYMNAL.delivered, rewarded: HYMNAL.rewarded, onStand: HYMNAL.onStand.visible, pop: document.getElementById('sPop').innerText }; })()`);
    assert.equal(laid.delivered, true);
    assert.equal(laid.rewarded, true);
    assert.equal(laid.onStand, true);
    assert.match(laid.pop, /Fort Harvest/);
    const next = await waitUntil(evalJson, (s) => s && s.id === 'fort' && /Fort Harvest/.test(s.obj || ''), 8000);
    assert.equal(next.id, 'fort');
    assert.match(next.obj, /Fort Harvest/);
    assert.equal(next.delivered, true);
    const twice = await evalJson(`(() => { const idx = STORY.idx; HYMNAL.lect.act(); return { id: STORY.cur.id, idx, same: STORY.idx === idx, lectAmt: HYMNAL.lect.amt }; })()`);
    assert.equal(twice.id, 'fort');
    assert.equal(twice.same, true);
    assert.equal(twice.lectAmt, 0);
    await shot(send, 'hymnal-fort.png');
    const migrated = await evalJson(`(() => {
      function jump(idx){
        const raw = dhSave.snap();
        raw.story.idx = idx;
        delete raw.hymnal;
        localStorage.setItem('dhSave', JSON.stringify(raw));
        localStorage.setItem('dhSaveVer', '2');
        let err = '';
        let ok = false;
        try { ok = !!dhSave.load(); } catch (e) { err = String(e); }
        const step = STORY.cfg.steps[STORY.idx] || {};
        const nxt = STORY.cfg.steps[STORY.idx + 1];
        return { ok, err, id: STORY.cur && STORY.cur.id, idx: STORY.idx, carried: !!HYMNAL.carried, delivered: !!HYMNAL.delivered, obj: step.objective || '', next: nxt && nxt.id || '' };
      }
      const back = jump(7);
      const built = jump(8);
      const fort = jump(9);
      const end = jump(10);
      const saw = jump(6);
      HYMNAL.delivered = true; HYMNAL.rewarded = false; HYMNAL.carried = false;
      STORY.goto('hymnalHold');
      return { back, built, fort, end, saw, skip: { id: STORY.cur.id, idx: STORY.idx, rewarded: !!HYMNAL.rewarded } };
    })()`);
    assert.equal(migrated.back.ok, true, JSON.stringify(migrated.back));
    assert.equal(migrated.back.id, 'hymnal');
    assert.equal(migrated.back.idx, 7);
    assert.equal(migrated.back.delivered, false);
    assert.match(migrated.back.obj, /Eliza Hollow/);
    assert.doesNotMatch(migrated.back.obj, /farm|haul|shelter/i);
    assert.equal(migrated.built.id, 'hymnalHold');
    assert.equal(migrated.built.idx, 8);
    assert.equal(migrated.built.delivered, false);
    assert.match(migrated.built.obj, /chapel lectern/);
    assert.equal(migrated.fort.id, 'fort');
    assert.equal(migrated.fort.idx, 9);
    assert.equal(migrated.fort.delivered, true);
    assert.match(migrated.fort.obj, /Fort Harvest/);
    assert.equal(migrated.end.id, 'end');
    assert.equal(migrated.end.idx, 10);
    assert.equal(migrated.saw.id, 'sawmill');
    assert.equal(migrated.saw.next, 'hymnal');
    assert.equal(migrated.skip.id, 'fort');
    assert.equal(migrated.skip.idx, 9);
    assert.equal(migrated.skip.rewarded, false);
    assert.equal(logs.length, 0, logs.join('\n').slice(0, 800));
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});

async function waitForList(port) {
  const deadline = Date.now() + 20000;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        if (list.length) return list;
      }
    } catch (e) { last = String(e); }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('chrome debug port not ready ' + last);
}

async function waitUntil(evalJson, pred, ms) {
  const deadline = Date.now() + ms;
  let last = null;
  while (Date.now() < deadline) {
    last = await evalJson(`(() => {
      const pop = document.getElementById('sPop');
      const obj = document.getElementById('sObj');
      return {
        story: !!(window.STORY && STORY.cur),
        id: window.STORY && STORY.cur && STORY.cur.id,
        hymnal: !!window.HYMNAL,
        carried: window.HYMNAL && HYMNAL.carried,
        delivered: window.HYMNAL && HYMNAL.delivered,
        storyErr: window.STORY_ERROR ? String(window.STORY_ERROR) : '',
        menu: !!document.getElementById('willCont'),
        obj: obj ? obj.innerText : '',
        elizaX: window.HYMNAL && HYMNAL.spots && HYMNAL.spots.eliza.x
      };
    })()`);
    if (pred(last)) return last;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('timed out ' + JSON.stringify(last));
}
