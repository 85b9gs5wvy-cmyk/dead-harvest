/**
 * Chapter 1 on Test Play only: no night countdown, no quarry or sawmill
 * missions, a one-time resource note after the plant, and save migration.
 * index.html, campaign-test.html, functional-test.html, and plot-viewer.html
 * keep the previous campaign.
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
  'calm', 'surge', 'barn', 'barnLights', 'plant', 'hymnal', 'hymnalHold', 'fort',
  'courier-wreck', 'courier-case', 'courier-return',
  'h9-gate', 'h9-power', 'h9-card', 'h9-stairs', 'h9-director', 'h9-seal', 'h9-boss',
];
const OLD = [
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

const rules = between(testHtml, '/*CAMPAIGN_REWORK_BEGIN*/', '/*CAMPAIGN_REWORK_END*/');
const ruleBox = {};
vm.createContext(ruleBox);
vm.runInContext(`${rules}\nthis.migrateStoryIdx=migrateStoryIdx;this.resTipShouldShow=resTipShouldShow;this.migratedResTip=migratedResTip;`, ruleBox);

test('chapter 1 drops quarry and sawmill and keeps the hymnal and H-9 chain', () => {
  const steps = loadSteps(testHtml);
  const ids = Array.from(steps, (s) => s.id);
  assert.equal(ids.join(','), ORDER.join(','));
  assert.equal(ids.includes('quarry'), false);
  assert.equal(ids.includes('sawmill'), false);
  assert.equal(ids.includes('end'), false);
  assert.match(script(testHtml, 'story-config'), /H9_CHAIN_HOOK/);
  const fort = ids.indexOf('fort');
  const gate = ids.indexOf('h9-gate');
  assert.equal(ids.slice(fort, gate).join(','), 'fort,courier-wreck,courier-case,courier-return');
  assert.equal(ids.slice(gate).join(','), 'h9-gate,h9-power,h9-card,h9-stairs,h9-director,h9-seal,h9-boss');
  for (const html of [indexHtml, campaignHtml, functionalHtml, viewerHtml]) {
    const kept = script(html, 'story-config');
    assert.match(kept, /id:'quarry'/);
    assert.match(kept, /id:'sawmill'/);
  }
});

test('no story step runs a night countdown', () => {
  const steps = loadSteps(testHtml);
  for (const step of steps) {
    assert.notEqual(step.clock, 'countdown', step.id);
    assert.equal(step.countdownSec, undefined, step.id);
  }
  const runtime = script(testHtml, 'story-runtime');
  assert.equal(runtime.includes('nightfall in'), false);
  assert.equal(runtime.includes('countdownSec'), false);
  assert.equal(runtime.includes("clock==='countdown'"), false);
  assert.equal(runtime.includes('C.text.nightfall'), false);
  assert.match(runtime, /const clockFor=s=>\{if\(s\.clock==='hold'\)\{hold=true;speed=1\}else\{hold=false;speed=1\}\}/);
  const plant = steps.find((s) => s.id === 'plant');
  assert.equal(plant.clock, 'free');
});

test('the resource note opens once after the plant, and old quarry saves move to the hymnal', () => {
  const { migrateStoryIdx, resTipShouldShow, migratedResTip } = ruleBox;
  assert.equal(resTipShouldShow(false, 'plant'), true);
  assert.equal(resTipShouldShow(true, 'plant'), false);
  assert.equal(resTipShouldShow(false, 'hymnal'), false);
  assert.equal(resTipShouldShow(false, 'quarry'), false);
  assert.equal(migratedResTip(2, 5, false), true);
  assert.equal(migratedResTip(2, 6, false), true);
  assert.equal(migratedResTip(2, 6, true), false);
  assert.equal(migratedResTip(2, 7, false), false);
  assert.equal(migratedResTip(3, 6, false), false);

  for (let i = 0; i < OLD.length; i++) {
    const want = OLD[i] === 'quarry' || OLD[i] === 'sawmill' ? 'hymnal' : OLD[i];
    assert.equal(ORDER[migrateStoryIdx(2, i)], want, `v2 index ${i} ${OLD[i]}`);
  }
  assert.equal(ORDER[migrateStoryIdx(3, 6)], 'hymnalHold');
  assert.equal(migrateStoryIdx(3, 6), 6);
  assert.equal(ORDER[migrateStoryIdx(1, 5)], 'hymnal');
  assert.equal(ORDER[migrateStoryIdx(2, 16)], 'h9-boss');

  const runtime = script(testHtml, 'story-runtime');
  assert.match(runtime, /id="resTipOk"/);
  assert.match(runtime, />Got it</);
  assert.match(runtime, /el\.remove\(\)/);
  const tipCss = runtime.slice(runtime.indexOf("el.id='resTip'"), runtime.indexOf("el.id='resTip'") + 700);
  assert.equal(tipCss.includes('inset:0'), false);
  assert.match(runtime, /if\(window\.__resTip\)return/);
  const save = script(testHtml, 'will-save');
  assert.match(save, /resTip:window\.__resTip\?1:0/);
  assert.match(save, /VER=4/);
  assert.match(save, /vk!==1&&vk!==2&&vk!==3/);
  assert.match(save, /if\(d\.resTip\)window\.__resTip=1/);
  assert.match(save, /if\(d\._showResTip&&window\.showResTip\)window\.showResTip\(\)/);
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

test('headless test play boots, shows the resource note once, and migrates saves', { timeout: 180000 }, async () => {
  const server = createServer((req, res) => {
    if (req.url.split('?')[0] !== '/test.html') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(testHtml);
  });
  const port = await listen(server);
  const profile = mkdtempSync(`${tmpdir()}/dh-campaign-rework-`);
  const debug = 9377;
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
      const S = window.STORY;
      if (!S || !S.cur || !window.dhSave || !document.querySelector('canvas')) return null;
      return {
        id: S.cur.id,
        ids: S.steps(),
        clocks: S.cfg.steps.map(s => s.clock),
        storyErr: window.STORY_ERROR ? String(window.STORY_ERROR) : '',
        caught: (window.DH_ERRORS || []).map(e => e.k)
      };
    })()`;
    while (Date.now() < deadline) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      state = res.result && res.result.result && res.result.result.value;
      if (state && state.id) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    assert.equal(logs.length, 0, logs.join('\n').slice(0, 1200));
    assert.ok(state && state.id, JSON.stringify(state));
    assert.equal(state.storyErr, '');
    assert.deepEqual(state.caught, []);
    assert.deepEqual(state.ids, ORDER);
    assert.equal(state.clocks.includes('countdown'), false);

    const played = await send('Runtime.evaluate', {
      expression: `(() => {
        POWER.on = true;
        const first = STORY.goto('plant');
        const tip = document.getElementById('resTip');
        const btn = document.getElementById('resTipOk');
        const box = tip ? tip.getBoundingClientRect() : null;
        const corner = document.elementFromPoint(2, 2);
        const open = {
          step: STORY.cur && STORY.cur.id,
          goto: first,
          shown: !!tip,
          blocksCorner: !!(corner && tip && tip.contains(corner)),
          covers: box ? box.width >= innerWidth - 4 && box.height >= innerHeight - 4 : true,
          button: btn ? btn.textContent : '',
          flag: window.__resTip ? 1 : 0
        };
        if (btn) btn.click();
        const gone = !document.getElementById('resTip');
        STORY.goto('plant');
        const again = !!document.getElementById('resTip');
        const mid = document.elementFromPoint(innerWidth / 2, innerHeight * 0.2);
        dhSave.save();
        const saved = dhSave.read();
        const base = dhSave.snap();
        function put(v, idx, resTip) {
          const d = JSON.parse(JSON.stringify(base));
          d.v = v;
          d.story.idx = idx;
          if (resTip) d.resTip = 1; else delete d.resTip;
          localStorage.setItem('dhSaveTest', JSON.stringify(d));
          localStorage.setItem('dhSaveVerTest', String(v));
          return dhSave.read();
        }
        const quarry = put(2, 5, 0);
        const saw = put(2, 6, 0);
        const hymnal = put(2, 7, 0);
        const fort = put(2, 9, 0);
        const boss = put(2, 16, 0);
        const hold = put(3, 6, 0);
        const seen = put(2, 6, 1);
        return {
          open, gone, again,
          midBlocked: !!(mid && mid.id === 'resTip'),
          saved: saved && { v: saved.v, idx: saved.story && saved.story.idx, resTip: saved.resTip },
          quarry: quarry && { idx: quarry.story.idx, tip: quarry._showResTip ? 1 : 0 },
          saw: saw && { idx: saw.story.idx, tip: saw._showResTip ? 1 : 0 },
          hymnal: hymnal && { idx: hymnal.story.idx, tip: hymnal._showResTip ? 1 : 0 },
          fort: fort && fort.story.idx,
          boss: boss && boss.story.idx,
          hold: hold && { idx: hold.story.idx, tip: hold._showResTip ? 1 : 0 },
          seen: seen && { idx: seen.story.idx, tip: seen._showResTip ? 1 : 0 }
        };
      })()`,
      returnByValue: true,
    });
    const play = played.result && played.result.result && played.result.result.value;
    assert.equal(logs.length, 0, logs.join('\n').slice(0, 1200));
    assert.ok(play, JSON.stringify(played.result));
    assert.equal(play.open.step, 'hymnal');
    assert.equal(play.open.shown, true);
    assert.equal(play.open.button, 'Got it');
    assert.equal(play.open.flag, 1);
    assert.equal(play.open.blocksCorner, false);
    assert.equal(play.open.covers, false);
    assert.equal(play.gone, true);
    assert.equal(play.again, false);
    assert.equal(play.midBlocked, false);
    assert.equal(play.saved.resTip, 1);
    assert.equal(play.saved.v, 4);
    assert.equal(play.saved.idx, ORDER.indexOf('hymnal'));
    assert.deepEqual(play.quarry, { idx: ORDER.indexOf('hymnal'), tip: 1 });
    assert.deepEqual(play.saw, { idx: ORDER.indexOf('hymnal'), tip: 1 });
    assert.deepEqual(play.hymnal, { idx: ORDER.indexOf('hymnal'), tip: 0 });
    assert.equal(play.fort, ORDER.indexOf('fort'));
    assert.equal(play.boss, ORDER.indexOf('h9-boss'));
    assert.deepEqual(play.hold, { idx: ORDER.indexOf('hymnalHold'), tip: 0 });
    assert.deepEqual(play.seen, { idx: ORDER.indexOf('hymnal'), tip: 0 });
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});
