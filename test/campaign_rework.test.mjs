/**
 * Chapter 1 on Test Play only: no night countdown, no quarry or sawmill
 * missions, a one-time resource note after the plant, and save migration.
 * index.html, campaign-test.html, functional-test.html, and plot-viewer.html
 * keep the previous campaign.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
  assert.equal(ids.slice(fort, gate).join(','), 'fort,fort-log,fort-power,fort-gate,fort-yard,fort-key,fort-boss,courier-wreck,courier-case,courier-return');
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
  for (const id of ['plant-arrive', 'plant-keycard', 'plant-prep', 'plant-control']) {
    assert.equal(steps.find((s) => s.id === id).clock, 'free', id);
  }
});

test('the resource note opens once after the plant, and old quarry saves move to the hymnal', () => {
  const { migrateStoryIdx, resTipShouldShow, migratedResTip } = ruleBox;
  assert.equal(resTipShouldShow(false, 'plant'), true);
  assert.equal(resTipShouldShow(false, 'plant-control'), true);
  assert.equal(resTipShouldShow(true, 'plant'), false);
  assert.equal(resTipShouldShow(false, 'hymnal'), false);
  assert.equal(resTipShouldShow(false, 'plant-arrive'), false);
  assert.equal(resTipShouldShow(false, 'quarry'), false);
  assert.equal(migratedResTip(2, 5, false), true);
  assert.equal(migratedResTip(2, 6, false), true);
  assert.equal(migratedResTip(2, 6, true), false);
  assert.equal(migratedResTip(2, 7, false), false);
  assert.equal(migratedResTip(3, 6, false), false);

  for (let i = 0; i < OLD.length; i++) {
    const want = OLD[i] === 'quarry' || OLD[i] === 'sawmill' || OLD[i] === 'hymnal' || OLD[i] === 'hymnalHold' ? 'cem-gate' : OLD[i] === 'plant' ? 'plant-arrive' : OLD[i];
    assert.equal(ORDER[migrateStoryIdx(2, i)], want, `v2 index ${i} ${OLD[i]}`);
  }
  assert.equal(ORDER[migrateStoryIdx(3, 6)], 'cem-gate');
  assert.equal(migrateStoryIdx(3, 6), ORDER.indexOf('cem-gate'));
  assert.equal(ORDER[migrateStoryIdx(4, 4)], 'plant-arrive');
  assert.equal(ORDER[migrateStoryIdx(4, 5)], 'cem-gate');
  assert.equal(migrateStoryIdx(5, ORDER.indexOf('plant-control')), ORDER.indexOf('plant-control'));
  assert.equal(ORDER[migrateStoryIdx(1, 5)], 'cem-gate');
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
  assert.match(save, /VER=7/);
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

test('the resource card caps its height and keeps Got it outside the scrolling body', () => {
  const runtime = script(testHtml, 'story-runtime');
  const tipAt = runtime.indexOf("el.id='resTip'");
  assert.ok(tipAt >= 0);
  const tip = runtime.slice(tipAt, runtime.indexOf('window.showResTip', tipAt));
  assert.match(tip, /max-height:calc\(100vh - 24px/);
  assert.match(tip, /max-height:calc\(100dvh - 24px/);
  assert.match(tip, /env\(safe-area-inset-top/);
  assert.match(tip, /env\(safe-area-inset-bottom/);
  assert.equal(tip.includes('inset:0'), false);
  const bodyAt = tip.indexOf('id="resTipBody"');
  const footAt = tip.indexOf('dhCardFoot');
  const btnAt = tip.indexOf('id="resTipOk"');
  assert.ok(bodyAt > 0 && footAt > bodyAt && btnAt > footAt, 'Got it stays in the footer, after the scrolling body');
  assert.match(tip, /ev\.key!=='Escape'&&ev\.key!=='Enter'/);
  assert.match(testHtml, /\.dhScroll\{[^}]*overflow-y:auto/);
  assert.match(testHtml, /\.dhScroll\{[^}]*-webkit-overflow-scrolling:touch/);
  assert.match(testHtml, /\.dhScroll\{[^}]*touch-action:pan-y/);
  assert.match(testHtml, /function dhBindCard/);
  assert.match(testHtml, /touchmove',stop/);
  assert.match(testHtml, /id="h9EndBody"/);
  assert.match(testHtml, /id="dhNoteBody"/);
  assert.match(testHtml, /id="h9Roam"/);
  assert.match(testHtml, /Put it away/);
  const pop = runtime.slice(runtime.indexOf("css.textContent="), runtime.indexOf('document.head.appendChild(css)'));
  assert.match(pop, /#sPop\{[^}]*max-height:calc\(100vh - 24px/);
  assert.match(pop, /#sPop\{[^}]*max-height:calc\(100dvh - 24px/);
});

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
        const first = STORY.goto('plant-control');
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
        STORY.goto('plant-control');
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
    assert.equal(play.open.step, 'cem-gate');
    assert.equal(play.open.shown, true);
    assert.equal(play.open.button, 'Got it');
    assert.equal(play.open.flag, 1);
    assert.equal(play.open.blocksCorner, false);
    assert.equal(play.open.covers, false);
    assert.equal(play.gone, true);
    assert.equal(play.again, false);
    assert.equal(play.midBlocked, false);
    assert.equal(play.saved.resTip, 1);
    assert.equal(play.saved.v, 7);
    assert.equal(play.saved.idx, ORDER.indexOf('cem-gate'));
    assert.deepEqual(play.quarry, { idx: ORDER.indexOf('cem-gate'), tip: 1 });
    assert.deepEqual(play.saw, { idx: ORDER.indexOf('cem-gate'), tip: 1 });
    assert.deepEqual(play.hymnal, { idx: ORDER.indexOf('cem-gate'), tip: 0 });
    assert.equal(play.fort, ORDER.indexOf('fort'));
    assert.equal(play.boss, ORDER.indexOf('h9-boss'));
    assert.deepEqual(play.hold, { idx: ORDER.indexOf('cem-gate'), tip: 0 });
    assert.deepEqual(play.seen, { idx: ORDER.indexOf('cem-gate'), tip: 0 });
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});

test('resource card keeps Got it on screen at phone sizes', { timeout: 180000 }, async () => {
  const server = createServer((req, res) => {
    if (req.url.split('?')[0] !== '/test.html') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(testHtml);
  });
  const port = await listen(server);
  const profile = mkdtempSync(`${tmpdir()}/dh-res-card-`);
  const debug = 9394;
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${debug}`, '--remote-allow-origins=*',
    '--window-size=390,844', 'about:blank',
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
    });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/test.html` });

    const readyExpr = `(() => !!(window.showResTip && document.querySelector('canvas') && window.STORY && window.STORY.cur))()`;
    const deadline = Date.now() + 90000;
    let ready = false;
    while (Date.now() < deadline) {
      const res = await send('Runtime.evaluate', { expression: readyExpr, returnByValue: true });
      ready = !!(res.result && res.result.result && res.result.result.value);
      if (ready) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    assert.equal(logs.length, 0, logs.join('\n').slice(0, 1200));
    assert.equal(ready, true);

    const measureExpr = `(() => {
      window.__resTip = 0;
      const old = document.getElementById('resTip');
      if (old) old.remove();
      POWER.on = true;
      if (window.STORY) window.STORY.goto('plant-control');
      if (!document.getElementById('resTip') && window.showResTip) window.showResTip();
      const tip = document.getElementById('resTip');
      const btn = document.getElementById('resTipOk');
      const body = document.getElementById('resTipBody');
      const foot = tip && tip.querySelector('.dhCardFoot');
      if (!tip || !btn || !body || !foot) return { missing: true, hasTip: !!tip, hasBtn: !!btn, hasBody: !!body };
      const cs = getComputedStyle(body);
      const tipCs = getComputedStyle(tip);
      const fit = (r) => ({
        top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
        inView: r.width > 8 && r.height > 8 && r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1
      });
      const before = fit(btn.getBoundingClientRect());
      body.scrollTop = body.scrollHeight;
      const after = fit(btn.getBoundingClientRect());
      const cx = (after.left + after.right) / 2, cy = (after.top + after.bottom) / 2;
      const hit = document.elementFromPoint(cx, cy);
      let reached = 0;
      const fn = () => { reached++; };
      document.addEventListener('touchmove', fn);
      const ev = new Event('touchmove', { bubbles: true, cancelable: true });
      body.dispatchEvent(ev);
      document.removeEventListener('touchmove', fn);
      const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 40 });
      body.dispatchEvent(wheel);
      return {
        missing: false,
        vw: innerWidth, vh: innerHeight,
        overflowY: cs.overflowY,
        touchAction: cs.touchAction,
        webkitScroll: cs.webkitOverflowScrolling || '',
        maxHeight: tipCs.maxHeight,
        buttonInBody: body.contains(btn),
        buttonInFoot: foot.contains(btn),
        card: fit(tip.getBoundingClientRect()),
        button: after,
        buttonMoved: Math.abs(after.top - before.top) > 1,
        bodyScrolls: body.scrollHeight > body.clientHeight + 2,
        hit: hit ? (hit.id || hit.className || hit.tagName) : '',
        hitButton: !!(hit && (hit.id === 'resTipOk' || (hit.closest && hit.closest('#resTipOk')))),
        touchReachedDocument: reached,
        touchDefaultPrevented: ev.defaultPrevented,
        wheelDefaultPrevented: wheel.defaultPrevented
      };
    })()`;

    async function measure(w, h) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w, height: h, deviceScaleFactor: 1, mobile: true,
      });
      await new Promise((r) => setTimeout(r, 80));
      const res = await send('Runtime.evaluate', { expression: measureExpr, returnByValue: true });
      const value = res.result && res.result.result && res.result.result.value;
      assert.ok(value && !value.missing, JSON.stringify(value || res.result));
      assert.equal(value.vw, w);
      assert.equal(value.vh, h);
      assert.equal(value.overflowY, 'auto');
      assert.match(value.touchAction, /pan-y/);
      assert.equal(value.buttonInBody, false);
      assert.equal(value.buttonInFoot, true);
      assert.equal(value.button.inView, true, JSON.stringify(value.button));
      assert.equal(value.card.inView, true, JSON.stringify(value.card));
      assert.equal(value.buttonMoved, false);
      assert.equal(value.hitButton, true, value.hit);
      assert.equal(value.touchReachedDocument, 0);
      assert.equal(value.touchDefaultPrevented, false);
      assert.equal(value.wheelDefaultPrevented, false);
      assert.match(value.maxHeight, /px$/);
      const maxPx = parseFloat(value.maxHeight);
      assert.ok(maxPx <= h - 20, value.maxHeight);
      return value;
    }

    const phone = await measure(390, 844);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const b64 = shot.result && shot.result.data;
    assert.ok(b64 && b64.length > 1000, 'screenshot missing');
    mkdirSync('/opt/cursor/artifacts', { recursive: true });
    writeFileSync('/opt/cursor/artifacts/resources-card-390x844.png', Buffer.from(b64, 'base64'));

    const click = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.getElementById('resTipOk');
        if (btn) btn.click();
        return { gone: !document.getElementById('resTip') };
      })()`,
      returnByValue: true,
    });
    const clicked = click.result && click.result.result && click.result.result.value;
    assert.equal(clicked && clicked.gone, true);

    async function keyCloses(key) {
      await send('Runtime.evaluate', {
        expression: `(() => { window.__resTip = 0; const old = document.getElementById('resTip'); if (old) old.remove(); window.showResTip(); return !!document.getElementById('resTip'); })()`,
        returnByValue: true,
      });
      await send('Runtime.evaluate', {
        expression: `document.dispatchEvent(new KeyboardEvent('keydown', {key:${JSON.stringify(key)}, code:${JSON.stringify(key === 'Enter' ? 'Enter' : 'Escape')}, bubbles:true, cancelable:true}))`,
        returnByValue: true,
      });
      const res = await send('Runtime.evaluate', {
        expression: `(() => ({ gone: !document.getElementById('resTip'), paused: !!window.dhPaused }))()`,
        returnByValue: true,
      });
      return res.result && res.result.result && res.result.result.value;
    }
    const esc = await keyCloses('Escape');
    assert.equal(esc && esc.gone, true, JSON.stringify(esc));
    assert.equal(esc.paused, false);
    const enter = await keyCloses('Enter');
    assert.equal(enter && enter.gone, true, JSON.stringify(enter));

    const narrow = await measure(360, 640);
    const wide = await measure(844, 390);
    assert.equal(narrow.button.inView, true);
    assert.equal(wide.button.inView, true);
    assert.equal(wide.bodyScrolls || wide.button.inView, true);
    assert.equal(phone.button.inView, true);
    assert.equal(logs.length, 0, logs.join('\n').slice(0, 1200));
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});
