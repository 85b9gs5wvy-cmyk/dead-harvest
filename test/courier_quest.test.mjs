/**
 * The Courier, Test Play only: a fetch between Fort Harvest and the H-9 chain.
 * Step order, each goal, death without a softlock, and save migration by mission id.
 * One headless load checks test.html boots and the live F actions advance the steps.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, ROOT), 'utf8');
const testHtml = read('test.html');
const indexHtml = read('index.html');
const campaignHtml = read('campaign-test.html');
const functionalHtml = read('functional-test.html');
const viewerHtml = read('plot-viewer.html');

const ORDER = [
  'calm', 'surge', 'barn', 'barnLights',
  'plant-arrive', 'plant-keycard', 'plant-prep', 'plant-control',
  'cem-gate', 'cem-journal', 'cem-key', 'cem-crypt', 'cem-cover', 'cem-lectern', 'cem-bell', 'hymnalHold',
  'fort', 'fort-log', 'fort-power', 'fort-gate', 'fort-yard', 'fort-key', 'fort-boss',
  'courier-wreck', 'courier-case', 'courier-return',
  'h9-gate', 'h9-power', 'h9-card', 'h9-stairs', 'h9-director', 'h9-seal', 'h9-boss',
];
const V3 = [
  'calm', 'surge', 'barn', 'barnLights', 'plant', 'hymnal', 'hymnalHold', 'fort',
  'h9-gate', 'h9-power', 'h9-card', 'h9-stairs', 'h9-director', 'h9-seal', 'h9-boss',
];
const V2 = [
  'calm', 'surge', 'barn', 'barnLights', 'plant', 'quarry', 'sawmill', 'hymnal',
  'hymnalHold', 'fort', 'h9-gate', 'h9-power', 'h9-card', 'h9-stairs', 'h9-director',
  'h9-seal', 'h9-boss',
];

function between(html, start, end) {
  const i = html.indexOf(start);
  assert.ok(i >= 0, start);
  const j = html.indexOf(end, i + start.length);
  assert.ok(j > i, end);
  return html.slice(i, j);
}

function script(html, id) {
  const open = `<script id="${id}">`;
  const i = html.indexOf(open);
  assert.ok(i >= 0, id);
  const j = html.indexOf('</script>', i);
  return html.slice(i + open.length, j);
}

function loadSteps(html) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(between(html, '/* H9_LAB_BEGIN */', '/* H9_LAB_END */'), sandbox);
  vm.runInContext(script(html, 'story-config'), sandbox);
  return sandbox.window.STORY_CONFIG.steps;
}

const rules = between(testHtml, '/*COURIER_RULES_BEGIN*/', '/*COURIER_RULES_END*/');
const box = {};
vm.createContext(box);
vm.runInContext(`${rules}\nthis.courierLoad=courierLoad;this.courierReduce=courierReduce;this.courierGoal=courierGoal;this.COURIER_CODE=COURIER_CODE;this.COURIER_STEPS=COURIER_STEPS;this.COURIER_PLACES=COURIER_PLACES;this.COURIER_SPAWN=COURIER_SPAWN;`, box);

const migrateSrc = between(testHtml, '/*CAMPAIGN_REWORK_BEGIN*/', '/*CAMPAIGN_REWORK_END*/');
const mig = {};
vm.createContext(mig);
vm.runInContext(`${migrateSrc}\nthis.migrateStoryIdx=migrateStoryIdx;`, mig);

const steps = loadSteps(testHtml);

test('the courier steps sit after fort and before the H-9 chain', () => {
  const ids = Array.from(steps, (s) => s.id);
  assert.equal(ids.join(','), ORDER.join(','));
  const hook = script(testHtml, 'story-config');
  const fortAt = hook.indexOf("id:'fort'");
  const wreckAt = hook.indexOf("id:'courier-wreck'");
  const hookAt = hook.indexOf('H9_CHAIN_HOOK');
  const spreadAt = hook.indexOf('window.H9_LAB');
  assert.ok(fortAt < wreckAt && wreckAt < hookAt && hookAt < spreadAt);
  assert.equal(ids.includes('end'), false);
  for (const html of [indexHtml, campaignHtml, functionalHtml, viewerHtml]) {
    assert.equal(html.includes('courier-wreck'), false);
    assert.equal(html.includes('COURIER_RULES_BEGIN'), false);
  }
  const world = between(testHtml, '/*COURIER_WORLD_BEGIN*/', '/*COURIER_WORLD_END*/');
  assert.equal(world.includes('PointLight'), false);
  assert.equal(world.includes('castShadow=true'), false);
  assert.equal(world.includes('addZ('), true);
});

test('each courier step has a goal, a waypoint, a free clock, and an F prompt', () => {
  const want = {
    'courier-wreck': { goal: 'note', target: 'courierBus', prompt: 'Search the crashed courier bus' },
    'courier-case': { goal: 'case', target: 'courierCase', prompt: 'Take the H-9 courier case' },
    'courier-return': { goal: 'open', target: 'courierRadio', prompt: 'Open the H-9 courier case' },
  };
  for (const id of box.COURIER_STEPS) {
    const step = steps.find((s) => s.id === id);
    assert.ok(step, id);
    assert.equal(step.clock, 'free', id);
    assert.equal(step.countdownSec, undefined, id);
    assert.equal(step.goal.courier, want[id].goal, id);
    assert.equal(step.target, want[id].target, id);
    assert.match(step.objective, /\S/);
    assert.match(testHtml, new RegExp(want[id].prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const gate = steps.find((s) => s.id === 'h9-gate');
  assert.match(gate.objective, /H9-4417/);
  assert.match(gate.popup.text, /H9-4417/);
  assert.equal(box.COURIER_CODE, 'H9-4417');
  const places = box.COURIER_PLACES;
  assert.equal(places.courierBus.building, 'Blackpine High School');
  assert.equal(places.courierCase.building, 'Blackpine High School');
  assert.equal(places.courierRadio.building, 'Fort Harvest Military Outpost');
  assert.match(testHtml, /Blackpine High School/);
  assert.match(testHtml, /Fort Harvest Military Outpost/);
  assert.match(testHtml, /District 7 School Bus/);
  const counts = Object.fromEntries(Object.entries(box.COURIER_SPAWN).map(([k, v]) => [k, v.length]));
  assert.deepEqual(counts, { wreck: 3, case: 4, return: 3 });
});

test('death keeps the case, and a missed pickup can still be taken', () => {
  const { courierReduce, courierGoal } = box;
  let c = { note: false, carried: false, opened: false, step: 'fort' };
  let r = courierReduce(c, 'search');
  assert.equal(r.why, 'early');
  assert.equal(r.c.note, false);
  assert.equal(courierGoal('courier-wreck', r.c), false);

  c = { note: false, carried: false, opened: false, step: 'courier-wreck' };
  r = courierReduce(c, 'search');
  assert.equal(r.why, 'note');
  assert.equal(r.advance, true);
  assert.equal(courierGoal('courier-wreck', r.c), true);
  r = courierReduce(r.c, 'death');
  assert.equal(r.why, 'kept');
  assert.equal(r.c.note, true);
  assert.equal(r.advance, false);
  c = Object.assign({}, r.c, { step: 'courier-case' });
  r = courierReduce(c, 'take');
  assert.equal(r.why, 'took');
  assert.equal(r.c.carried, true);
  assert.equal(courierGoal('courier-case', r.c), true);

  r = courierReduce(r.c, 'death');
  assert.equal(r.c.carried, true);
  assert.equal(r.c.opened, false);
  assert.equal(courierGoal('courier-return', r.c), false);
  c = Object.assign({}, r.c, { step: 'courier-return' });
  r = courierReduce(c, 'open');
  assert.equal(r.why, 'code');
  assert.equal(r.code, 'H9-4417');
  assert.equal(r.c.opened, true);
  assert.equal(r.c.carried, false);
  assert.equal(courierGoal('courier-return', r.c), true);
  assert.equal(courierGoal('h9-gate', r.c), false);

  const empty = courierReduce({ note: true, carried: false, opened: false, step: 'courier-return' }, 'open');
  assert.equal(empty.why, 'empty');
  assert.equal(empty.c.opened, false);
  const again = courierReduce({ note: true, carried: false, opened: false, step: 'courier-case' }, 'take');
  assert.equal(again.why, 'took');
});

test('a save already on an H-9 step stays on that step', () => {
  const { migrateStoryIdx } = mig;
  const { courierLoad } = box;
  for (let i = 0; i < V3.length; i++) {
    const at = migrateStoryIdx(3, i);
    const want = V3[i] === 'plant' ? 'plant-arrive' : (V3[i] === 'hymnal' || V3[i] === 'hymnalHold') ? 'cem-gate' : V3[i];
    assert.equal(ORDER[at], want, `v3 ${i} ${V3[i]}`);
    if (V3[i].startsWith('h9-')) assert.ok(at >= ORDER.indexOf('h9-gate'));
  }
  assert.equal(migrateStoryIdx(3, 7), ORDER.indexOf('fort'));
  assert.equal(migrateStoryIdx(3, 8), ORDER.indexOf('h9-gate'));
  assert.equal(migrateStoryIdx(3, 14), ORDER.indexOf('h9-boss'));
  assert.equal(migrateStoryIdx(4, 4), ORDER.indexOf('plant-arrive'));
  assert.equal(migrateStoryIdx(4, 8), ORDER.indexOf('courier-wreck'));
  assert.equal(migrateStoryIdx(4, 11), ORDER.indexOf('h9-gate'));
  assert.equal(ORDER[migrateStoryIdx(4, 17)], 'h9-boss');
  assert.equal(ORDER[migrateStoryIdx(5, 13)], 'courier-return');
  assert.equal(ORDER[migrateStoryIdx(5, 10)], 'fort');
  assert.equal(ORDER[migrateStoryIdx(6, 16)], 'fort-boss');
  assert.equal(ORDER[migrateStoryIdx(6, 8)], 'cem-gate');

  for (let i = 0; i < V2.length; i++) {
    const want = V2[i] === 'quarry' || V2[i] === 'sawmill' || V2[i] === 'hymnal' || V2[i] === 'hymnalHold' ? 'cem-gate' : V2[i] === 'plant' ? 'plant-arrive' : V2[i];
    assert.equal(ORDER[migrateStoryIdx(2, i)], want, `v2 ${i}`);
  }

  const ret = ORDER.indexOf('courier-return');
  const past = courierLoad(null, ORDER.indexOf('h9-gate'), ret);
  assert.equal(JSON.stringify(past), JSON.stringify({ note: true, carried: false, opened: true, step: '' }));
  assert.equal(courierLoad(null, ORDER.indexOf('fort'), ret).opened, false);
  assert.equal(courierLoad({ carried: 1 }, ret, ret).carried, true);
  assert.equal(courierLoad({ carried: 1 }, ret, ret).opened, false);
  assert.equal(courierLoad({ opened: 1 }, ORDER.indexOf('courier-case'), ret).opened, true);

  const save = script(testHtml, 'will-save');
  assert.match(save, /VER=7/);
  assert.match(save, /vk!==1&&vk!==2&&vk!==3&&vk!==4&&vk!==5&&vk!==6&&vk!==7/);
  assert.match(save, /courier:window\.COURIER\?/);
  assert.match(save, /window\.COURIER\.load\(d\.courier/);
});

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

async function waitForList(port) {
  const deadline = Date.now() + 15000;
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

test('headless test play boots the courier quest without a death softlock', { timeout: 180000 }, async () => {
  const server = createServer((req, res) => {
    if (req.url.split('?')[0] !== '/test.html') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(testHtml);
  });
  const port = await listen(server);
  const profile = mkdtempSync(`${tmpdir()}/dh-courier-`);
  const debug = 9383;
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${debug}`, '--remote-allow-origins=*',
    '--window-size=1280,720', 'about:blank',
  ], { stdio: 'ignore' });
  let ws;
  const logs = [];
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
    await send('Runtime.enable', {});
    await send('Page.enable', {});
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/test.html` });

    const deadline = Date.now() + 90000;
    let state = null;
    const expr = `(() => {
      const S = window.STORY, Q = window.COURIER;
      if (!S || !S.cur || !Q || !Q.nodes || !Q.nodes.bus || !Q.nodes.case || !Q.nodes.radio || !window.dhSave) return null;
      const spotOk = ['courierBus','courierCase','courierRadio'].every(k => Q.spots[k] && Number.isFinite(Q.spots[k].x) && Number.isFinite(Q.spots[k].z));
      S.goto('courier-wreck');
      const bus = Q.nodes.bus.pr();
      Q.nodes.bus.act();
      const afterSearch = S.cur && S.cur.id;
      const locker = Q.nodes.case.pr();
      Q.nodes.case.act();
      const afterTake = { id: S.cur && S.cur.id, carried: Q.carried ? 1 : 0 };
      hurt(500);
      const afterDeath = { id: S.cur && S.cur.id, carried: Q.carried ? 1 : 0, opened: Q.opened ? 1 : 0, died: window.__willRsp ? 1 : 0 };
      const gate = Q.nodes.radio.pr();
      Q.nodes.radio.act();
      const afterOpen = { id: S.cur && S.cur.id, objective: S.cur && S.cur.objective, opened: Q.opened ? 1 : 0, carried: Q.carried ? 1 : 0 };
      const base = dhSave.snap();
      function put(v, idx) {
        const d = JSON.parse(JSON.stringify(base));
        d.v = v;
        d.story.idx = idx;
        delete d.courier;
        localStorage.setItem('dhSaveTest', JSON.stringify(d));
        localStorage.setItem('dhSaveVerTest', String(v));
        return dhSave.read();
      }
      const oldGate = put(3, 8);
      const oldFort = put(3, 7);
      const oldBoss = put(3, 14);
      const fresh = put(4, 9);
      return {
        spotOk,
        ids: S.steps(),
        clocks: S.cfg.steps.map(s => s.clock),
        bus, afterSearch, locker, afterTake, afterDeath, gate, afterOpen,
        spawned: Q.spawned,
        storyErr: window.STORY_ERROR ? String(window.STORY_ERROR) : '',
        caught: (window.DH_ERRORS || []).map(e => e.k),
        oldGate: oldGate && oldGate.story.idx,
        oldFort: oldFort && oldFort.story.idx,
        oldBoss: oldBoss && oldBoss.story.idx,
        fresh: fresh && fresh.story.idx,
        ver: base.v
      };
    })()`;
    while (Date.now() < deadline) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      state = res.result && res.result.result && res.result.result.value;
      if (state && state.ids) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    assert.equal(logs.length, 0, logs.join('\n').slice(0, 1200));
    assert.ok(state && state.ids, JSON.stringify(state));
    assert.equal(state.storyErr, '');
    assert.deepEqual(state.caught, []);
    assert.equal(state.spotOk, true);
    assert.deepEqual(state.ids, ORDER);
    assert.equal(state.clocks.includes('countdown'), false);
    assert.equal(state.bus, 'F: Search the crashed courier bus');
    assert.equal(state.afterSearch, 'courier-case');
    assert.equal(state.locker, 'F: Take the H-9 courier case');
    assert.deepEqual(state.afterTake, { id: 'courier-return', carried: 1 });
    assert.deepEqual(state.afterDeath, { id: 'courier-return', carried: 1, opened: 0, died: 1 });
    assert.equal(state.gate, 'F: Open the H-9 courier case');
    assert.equal(state.afterOpen.id, 'h9-gate');
    assert.match(state.afterOpen.objective, /H9-4417/);
    assert.equal(state.afterOpen.opened, 1);
    assert.equal(state.afterOpen.carried, 0);
    assert.equal(state.spawned.wreck, 1);
    assert.equal(state.spawned.case, 1);
    assert.equal(state.spawned.return, 1);
    assert.equal(state.ver, 7);
    assert.equal(state.oldGate, ORDER.indexOf('h9-gate'));
    assert.equal(state.oldFort, ORDER.indexOf('fort'));
    assert.equal(state.oldBoss, ORDER.indexOf('h9-boss'));
    assert.equal(state.fresh, ORDER.indexOf('courier-case'));
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});
