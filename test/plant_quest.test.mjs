/**
 * Riverside Power Station restart quest on Test Play, and the same site
 * geometry in the low-graphics plot viewer (?comp=plant).
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, ROOT), 'utf8');
const testHtml = read('test.html');
const viewerHtml = read('plot-viewer.html');
const indexHtml = read('index.html');

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

const ORDER = [
  'calm', 'surge', 'barn', 'barnLights',
  'plant-arrive', 'plant-keycard', 'plant-prep', 'plant-control',
  'cem-gate', 'cem-journal', 'cem-key', 'cem-crypt', 'cem-cover', 'cem-lectern', 'cem-bell', 'hymnalHold',
  'fort', 'fort-log', 'fort-power', 'fort-gate', 'fort-yard', 'fort-key', 'fort-boss',
  'courier-wreck', 'courier-case', 'courier-return',
  'h9-gate', 'h9-power', 'h9-card', 'h9-stairs', 'h9-director', 'h9-seal', 'h9-boss',
];

const rules = between(testHtml, '/*PLANT_QUEST_BEGIN*/', '/*PLANT_QUEST_END*/');
const box = {};
vm.createContext(box);
vm.runInContext(`${rules}\nthis.plantBlank=plantBlank;this.plantLoad=plantLoad;this.plantReady=plantReady;this.plantGoal=plantGoal;this.plantReduce=plantReduce;this.plantLeft=plantLeft;`, box);

test('the plant chain replaces the single switch and the viewer shares the site', () => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(between(testHtml, '/* H9_LAB_BEGIN */', '/* H9_LAB_END */'), sandbox);
  vm.runInContext(script(testHtml, 'story-config'), sandbox);
  const ids = Array.from(sandbox.window.STORY_CONFIG.steps, (s) => s.id);
  assert.equal(ids.join(','), ORDER.join(','));
  assert.equal(ids.includes('plant'), false);
  const byId = Object.fromEntries(sandbox.window.STORY_CONFIG.steps.map((s) => [s.id, s]));
  assert.equal(byId['plant-arrive'].target, 'plantGate');
  assert.equal(byId['plant-keycard'].target, 'plantCard');
  assert.equal(byId['plant-keycard'].onEnter, 'plantZombies');
  assert.equal(byId['plant-prep'].target, 'plantPrep');
  assert.equal(byId['plant-control'].target, 'plantConsole');
  assert.equal(byId['plant-control'].onExit, 'restoreBarn');
  assert.equal(byId['plant-control'].goal.plantBreaker, true);
  assert.equal(byId['plant-arrive'].goal, undefined);
  for (const id of ['plant-arrive', 'plant-keycard', 'plant-prep', 'plant-control']) {
    assert.equal(byId[id].clock, 'free', id);
  }
  assert.equal(between(testHtml, '/* PLANT_SITE_BEGIN */', '/* PLANT_SITE_END */'), between(viewerHtml, '/* PLANT_SITE_BEGIN */', '/* PLANT_SITE_END */'));
  assert.match(viewerHtml, /comp==='plant'/);
  assert.match(viewerHtml, /plant:1/);
  assert.match(viewerHtml, /one\.plantShot/);
  assert.equal(indexHtml.includes('plant-arrive'), false);
  assert.equal(indexHtml.includes('/* PLANT_SITE_BEGIN */'), false);
  assert.match(script(testHtml, 'will-save'), /plant:window\.PLANTQ/);
  assert.match(script(testHtml, 'will-save'), /VER=7/);
  const site = between(testHtml, '/* PLANT_SITE_BEGIN */', '/* PLANT_SITE_END */');
  assert.equal(site.includes('new T.PointLight'), false);
  assert.equal(site.includes('new T.SpotLight'), false);
  assert.equal(site.includes('castShadow=true'), false);
});

test('keycard and restart progress persist, and a finished save opens the door', () => {
  const { plantBlank, plantLoad, plantReady, plantGoal, plantReduce, plantLeft } = box;
  let q = plantBlank();
  assert.equal(plantGoal('plant-keycard', q), false);
  assert.equal(plantGoal('plant-prep', q), false);
  assert.equal(plantReduce(q, 'door').why, 'nokey');
  let r = plantReduce(q, 'card');
  assert.equal(r.why, 'card');
  assert.equal(r.q.card, true);
  q = r.q;
  r = plantReduce(q, 'death');
  assert.equal(r.why, 'kept');
  assert.equal(r.q.card, true);
  assert.equal(r.q.door, false);
  q = r.q;
  assert.equal(plantReduce(q, 'card').why, 'held');
  r = plantReduce(q, 'door');
  assert.equal(r.why, 'door');
  q = r.q;
  for (const ev of ['gen', 'b0', 'b1']) {
    r = plantReduce(q, ev);
    assert.equal(r.why, ev);
    q = r.q;
    assert.equal(plantReady(q), false);
  }
  assert.equal(plantLeft(q).join(','), 'cooling-water valve');
  r = plantReduce(q, 'b2');
  q = r.q;
  assert.equal(plantReady(q), true);
  assert.equal(plantGoal('plant-prep', q), true);
  assert.equal(plantReduce(q, 'b2').why, 'done');
  assert.equal(plantGoal('plant-control', q), false);

  const fresh = plantLoad(null, 4, 7);
  assert.equal(fresh.card, false);
  assert.equal(plantLoad({ card: 1, b0: 1 }, 5, 7).card, true);
  assert.equal(plantLoad({ card: 1, b0: 1 }, 5, 7).b0, true);
  assert.equal(plantLoad({ card: 1 }, 5, 7).gen, false);
  const past = plantLoad(null, 8, 7);
  assert.equal(past.card && past.door && past.gen && past.b0 && past.b1 && past.b2, true);
  assert.equal(plantLoad(null, 7, 7).card, false);
});

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

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

function chromeSession(port, debug) {
  const profile = mkdtempSync(`${tmpdir()}/dh-plant-${debug}-`);
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${debug}`, '--remote-allow-origins=*',
    '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });
  const logs = [];
  return { chrome, logs, profile, port };
}

async function connect(debug, logs) {
  const list = await waitForList(debug);
  const page = list.find((t) => t.type === 'page') || list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
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
  return { ws, send };
}

test('headless test play runs the plant quest and the new walls stop the body', { timeout: 180000 }, async () => {
  const server = createServer((req, res) => {
    if (req.url.split('?')[0] !== '/test.html') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(testHtml);
  });
  const port = await listen(server);
  const debug = 9411;
  const { chrome, logs } = chromeSession(port, debug);
  let ws;
  try {
    const conn = await connect(debug, logs);
    ws = conn.ws;
    const send = conn.send;
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/test.html` });
    const readyExpr = `(() => !!(window.STORY && window.STORY.cur && window.PLANT_SITE && window.PLANTQ && document.querySelector('canvas')))()`;
    const deadline = Date.now() + 90000;
    let ready = false;
    while (Date.now() < deadline) {
      const res = await send('Runtime.evaluate', { expression: readyExpr, returnByValue: true });
      ready = !!(res.result && res.result.result && res.result.result.value);
      if (ready) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    assert.equal(logs.length, 0, logs.join('\n').slice(0, 1500));
    assert.equal(ready, true);
    const played = await send('Runtime.evaluate', {
      expression: `(() => {
        const out = { siteError: window.PLANT_SITE_ERROR || '', storyError: window.STORY_ERROR ? String(window.STORY_ERROR) : '', caught: (window.DH_ERRORS || []).map(e => e.k) };
        const S = window.PLANT_SITE;
        out.tri = S.tri; out.draws = S.draws;
        setGrid(false);
        STORY.goto('plant-arrive');
        out.arrive = STORY.cur.id;
        S.place(0, 8, 0.1);
        out.near = plantNear();
        if (out.near && STORY.cur.id === 'plant-arrive') STORY.skip();
        out.afterArrive = STORY.cur.id;
        out.zombies = (typeof zs !== 'undefined' ? zs : []).filter(z => z.plant && !z.dead).length;
        const consoleNode = nodes.find(n => { try { return String(n.pr()).includes('Control Room console') || String(n.pr()).includes('START the grid'); } catch (e) { return false; } });
        out.consoleBefore = consoleNode ? consoleNode.pr() : '';
        if (consoleNode) consoleNode.act();
        out.powerAfterRefuse = !!POWER.on;
        S.place(12.5, 3.15, 0.1);
        out.doorBlocked = S.walkTo(12.5, 5.6);
        out.doorShot = S.blockedLocal(12.5, 4.02, 1.1);
        out.gapShot = S.blockedLocal(10.2, 4.02, 1.1);
        out.boilerWall = S.blockedLocal(4.3, -20, 1.2);
        S.place(-14.85, 8.4, 0.1);
        out.stairLow = S.walkTo(-14.85, 4.8);
        out.stair = S.walkTo(-14.85, 1.2);
        out.cat = S.walkTo(-15.9, 0.5);
        S.place(-15.45, -7.05, 0.1);
        out.locker = S.walkTo(-15.5, -8.55);
        S.place(8.2, -17.7, 0.1);
        out.boiler = S.walkTo(8.2, -19.7);
        S.place(-11.6, -18.35, 0.1);
        out.pump = S.walkTo(-11.55, -20.3);
        const took = PLANTQ.take();
        out.took = took && took.why;
        out.afterCard = STORY.cur.id;
        out.card = !!PLANTQ.card;
        for (const ev of ['gen', 'b0', 'b1', 'b2']) PLANTQ.hit(ev);
        out.afterPrep = STORY.cur.id;
        out.ready = PLANTQ.ready();
        if (consoleNode) consoleNode.act();
        out.powerBeforeDoor = !!POWER.on;
        const door = PLANTQ.useDoor();
        out.doorWhy = door && door.why;
        out.doorOpen = !!PLANTQ.door;
        out.doorFlag = !!S.doorOpen;
        const sx = S.world(1,0).x - S.world(0,0).x, sz = S.world(0,1).z - S.world(0,0).z;
        const ox = S.world(0,0).x, oz = S.world(0,0).z;
        const loc = (x,z) => ({lx:+((x-ox)/sx).toFixed(2), lz:+((z-oz)/sz).toFixed(2)});
        out.blockers = boxes.filter(b => { const p=loc(b.x,b.z); return Math.abs(p.lx-12.5)<2.2 && Math.abs(p.lz-4)<1.4; }).map(b => Object.assign(loc(b.x,b.z), {hw:b.hw, hd:b.hd, y0:b.y0, y1:b.y1, door:!!b.plantDoor}));
        out.cols = S.inst.cols.filter(c => { const p=loc(c.x,c.z); return Math.abs(p.lx-12.5)<2.2 && Math.abs(p.lz-4)<1.4; }).map(c => Object.assign(loc(c.x,c.z), {hw:+c.hw.toFixed(2), hd:+c.hd.toFixed(2), lv:c.lv, top:c.top}));
        S.place(12.5, 3.15, 0.1);
        out.doorOpenWalk = S.walkTo(12.5, 5.5);
        if (consoleNode) consoleNode.act();
        out.powerOn = !!POWER.on;
        if (STORY.cur.id === 'plant-control' && POWER.on) STORY.skip();
        out.afterPower = STORY.cur.id;
        const tip = document.getElementById('resTip');
        const btn = document.getElementById('resTipOk');
        const box = tip ? tip.getBoundingClientRect() : null;
        out.tip = !!(tip && btn && btn.textContent === 'Got it');
        out.tipCovers = box ? box.width >= innerWidth - 4 && box.height >= innerHeight - 4 : true;
        out.cardKept = !!PLANTQ.card;
        if (window.dhSave) window.dhSave.save();
        const saved = window.dhSave && window.dhSave.read();
        out.saved = saved && saved.plant;
        out.savedIdx = saved && saved.story && saved.story.idx;
        const base = window.dhSave.snap();
        base.v = 4; base.story.idx = 4; delete base.plant;
        localStorage.setItem('dhSaveTest', JSON.stringify(base));
        localStorage.setItem('dhSaveVerTest', '4');
        const old = window.dhSave.read();
        out.oldIdx = old && old.story && old.story.idx;
        const ids = STORY.steps();
        out.hymnal = ids.indexOf('cem-gate');
        out.arriveIdx = ids.indexOf('plant-arrive');
        base.v = 5; base.story.idx = 14; base.plant = { card: 1 };
        localStorage.setItem('dhSaveTest', JSON.stringify(base));
        localStorage.setItem('dhSaveVerTest', '5');
        const later = window.dhSave.read();
        out.laterIdx = later && later.story && later.story.idx;
        return out;
      })()`,
      returnByValue: true,
    });
    const play = played.result && played.result.result && played.result.result.value;
    assert.equal(logs.length, 0, logs.join('\n').slice(0, 1500));
    assert.ok(play, JSON.stringify(played.result && played.result.result));
    assert.equal(play.siteError, '');
    assert.equal(play.storyError, '');
    assert.deepEqual(play.caught, []);
    assert.ok(play.tri > 2000 && play.tri < 80000, 'tri ' + play.tri);
    assert.ok(play.draws > 4 && play.draws < 80, 'draws ' + play.draws);
    assert.equal(play.arrive, 'plant-arrive');
    assert.equal(play.near, true);
    assert.equal(play.afterArrive, 'plant-keycard');
    assert.ok(play.zombies >= 5, 'zombies ' + play.zombies);
    assert.match(play.consoleBefore, /locked|keycard/i);
    assert.equal(play.powerAfterRefuse, false);
    assert.ok(play.doorBlocked.lz < 4.15, JSON.stringify(play.doorBlocked));
    assert.equal(play.doorShot, true);
    assert.equal(play.boilerWall, true);
    assert.ok(play.stairLow.y > 1.2, JSON.stringify(play.stairLow));
    assert.ok(play.stair.y > 3.6, JSON.stringify(play.stair));
    assert.ok(play.cat.y > 3.6, JSON.stringify(play.cat));
    assert.ok(play.locker.lz < -8.2, JSON.stringify(play.locker));
    assert.ok(play.boiler.lz < -18.7, JSON.stringify(play.boiler));
    assert.ok(play.pump.lz < -19.3, JSON.stringify(play.pump));
    assert.equal(play.took, 'card');
    assert.equal(play.afterCard, 'plant-prep');
    assert.equal(play.card, true);
    assert.equal(play.afterPrep, 'plant-control');
    assert.equal(play.ready, true);
    assert.equal(play.powerBeforeDoor, false);
    assert.equal(play.doorWhy, 'door');
    assert.equal(play.doorOpen, true);
    assert.ok(play.doorOpenWalk.lz > 4.8, JSON.stringify({walk:play.doorOpenWalk, flag:play.doorFlag, blockers:play.blockers, cols:play.cols}));
    assert.equal(play.powerOn, true);
    assert.equal(play.afterPower, 'cem-gate');
    assert.equal(play.tip, true);
    assert.equal(play.tipCovers, false);
    assert.equal(play.cardKept, true);
    assert.equal(play.saved.card, 1);
    assert.equal(play.saved.door, 1);
    assert.equal(play.saved.gen, 1);
    assert.equal(play.saved.b0, 1);
    assert.equal(play.saved.b1, 1);
    assert.equal(play.saved.b2, 1);
    assert.equal(play.oldIdx, play.arriveIdx);
    assert.equal(play.laterIdx, ORDER.indexOf('h9-gate'));
    assert.equal(play.hymnal, ORDER.indexOf('cem-gate'));
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});

test('plot viewer opens the power plant and captures the new rooms', { timeout: 180000 }, async () => {
  const server = createServer((req, res) => {
    const path = req.url.split('?')[0];
    if (path !== '/plot-viewer.html') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(viewerHtml);
  });
  const port = await listen(server);
  const debug = 9422;
  const { chrome, logs } = chromeSession(port, debug);
  let ws;
  try {
    const conn = await connect(debug, logs);
    ws = conn.ws;
    const send = conn.send;
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/plot-viewer.html?comp=plant&shot=overview&gfx=3` });
    const readyExpr = `(() => {
      if (window.__DH_ONE && window.__DH_ONE.bootError) return { err: window.__DH_ONE.bootError };
      if (!(window.__DH_ONE && window.__DH_ONE.ready && window.PLANT_SITE && window.PLANT_SITE.views)) return null;
      return { comp: window.__DH_ONE.comp, tri: window.PLANT_SITE.tri, draws: window.PLANT_SITE.draws, siteError: window.PLANT_SITE_ERROR || '', shots: Object.keys(window.PLANT_SITE.views) };
    })()`;
    const deadline = Date.now() + 90000;
    let info = null;
    while (Date.now() < deadline) {
      const res = await send('Runtime.evaluate', { expression: readyExpr, returnByValue: true });
      info = res.result && res.result.result && res.result.result.value;
      if (info) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    assert.equal(logs.length, 0, logs.join('\n').slice(0, 1500));
    assert.ok(info && !info.err, JSON.stringify(info));
    console.log('PLANT_DELTA', JSON.stringify({ tri: info.tri, draws: info.draws }));
    assert.equal(info.comp, 'plant');
    assert.equal(info.siteError, '');
    assert.deepEqual(info.shots.sort(), ['control', 'keycard', 'overview', 'switchyard', 'turbine']);
    mkdirSync('/opt/cursor/artifacts', { recursive: true });
    const shots = ['overview', 'turbine', 'control', 'switchyard', 'keycard'];
    for (const name of shots) {
      const switched = await send('Runtime.evaluate', {
        expression: `(() => { var b=document.getElementById('dhOneBanner'); if(b)b.style.visibility='hidden'; return !!(window.__DH_ONE.plantShot && window.__DH_ONE.plantShot(${JSON.stringify(name)})); })()`,
        returnByValue: true,
      });
      assert.equal(switched.result.result.value, true, name);
      await new Promise((r) => setTimeout(r, 600));
      const cap = await send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(cap.result.data, 'base64');
      assert.ok(buf.length > 5000, name + ' bytes ' + buf.length);
      writeFileSync(`/opt/cursor/artifacts/plant-${name}.png`, buf);
    }
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});
