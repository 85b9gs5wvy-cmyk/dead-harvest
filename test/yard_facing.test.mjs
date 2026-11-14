/**
 * Hollow Creek headstones face the east gate, sign text does not contain a
 * literal \u escape, and the chapel bell rope can be reached from the ground.
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
const viewerHtml = read('plot-viewer.html');

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

test('every recorded marker faces the gate, and signs have no literal backslash-u', () => {
  const face = between(testHtml, '/*CEM_FACE_BEGIN*/', '/*CEM_FACE_END*/');
  assert.equal(face, between(viewerHtml, '/*CEM_FACE_BEGIN*/', '/*CEM_FACE_END*/'));
  const box = {};
  vm.createContext(box);
  vm.runInContext(`${face}\nthis.cemYaw=cemYaw;this.cemFaceDeg=cemFaceDeg;`, box);
  for (const [x, z] of [[8, 0], [-30, 20], [20, -40], [0, 12], [-7.4, 9.2]]) {
    const yaw = box.cemYaw(x, z);
    const deg = box.cemFaceDeg(x, z, yaw);
    assert.ok(deg < 0.01, `${x},${z} off by ${deg}`);
  }
  const yard = between(testHtml, '// ===== GRAVEYARD (v0.19.3)', "console.error('graveyard build failed'");
  assert.equal(yard, between(viewerHtml, '// ===== GRAVEYARD (v0.19.3)', "console.error('graveyard build failed'"));
  assert.match(yard, /cemRec\(x,z,cemYaw\(x,z\),'angel'/);
  assert.match(yard, /cemRec\(x,z,cemYaw\(x,z\),'stone'/);
  assert.match(yard, /cemRec\(x\+1\.15,z,cemYaw\(x\+1\.15,z\),'plot'/);
  assert.match(yard, /cemRec\(x,z,cemYaw\(x,z\),'cross'/);
  assert.match(yard, /cemRec\(pos,z,cemYaw\(pos,z\),key\)/);
  assert.equal(/\\\\u[0-9a-fA-F]{4}/.test(testHtml), false);
  assert.equal(/\\\\u[0-9a-fA-F]{4}/.test(viewerHtml), false);
  assert.match(testHtml, /UNIT 1 · UNIT 2/);
  assert.match(viewerHtml, /UNIT 1 · UNIT 2/);
});

test('the bell rope is on the tower floor and the step can be saved', () => {
  const yard = between(testHtml, 'const CEM_ROPE=', ';gy.userData.cemBell');
  const rope = {};
  vm.createContext(rope);
  vm.runInContext(`${yard}\nthis.CEM_ROPE=CEM_ROPE;this.CEM_ROPE_STAND=CEM_ROPE_STAND;`, rope);
  const stand = rope.CEM_ROPE_STAND;
  const spot = rope.CEM_ROPE;
  const dist = Math.hypot(stand.x - spot.x, stand.z - spot.z);
  assert.ok(dist < 2.2, `stand is ${dist.toFixed(2)} m from the rope`);
  assert.ok(stand.x < -13.4 && stand.x > -17.6, 'stand is inside the tower, past the east door');
  assert.ok(Math.abs(stand.z) < 1.05, 'stand is inside the east-door opening');
  assert.ok(spot.y < 1.8 && spot.y > 0.6, 'rope handle is at hand height');
  assert.match(testHtml, /cemNode\('bell',P\.bell,/);
  assert.equal(testHtml.includes("cemNode('bell',P.bell") && /cemNode\('bell',P\.bell,[\s\S]{0,220}\);/.test(testHtml), true);
  const call = testHtml.match(/cemNode\('bell',P\.bell,[\s\S]*?\);/);
  assert.ok(call);
  assert.equal(call[0].includes(',0)') || call[0].includes(',8'), false);

  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(between(testHtml, '/* H9_LAB_BEGIN */', '/* H9_LAB_END */'), sandbox);
  vm.runInContext(script(testHtml, 'story-config'), sandbox);
  vm.runInContext(between(testHtml, '/*CEM_QUEST_BEGIN*/', '/*CEM_QUEST_END*/') + '\nthis.cemBlank=cemBlank;this.cemLoad=cemLoad;this.cemMet=cemMet;this.cemReduce=cemReduce;', sandbox);
  const ids = sandbox.window.STORY_CONFIG.steps.map((s) => s.id);
  const lectern = ids.indexOf('cem-lectern');
  const bell = ids.indexOf('cem-bell');
  const hold = ids.indexOf('hymnalHold');
  const { cemBlank, cemLoad, cemMet, cemReduce } = sandbox;
  let q = cemBlank();
  for (const ev of ['journal', 'key', 'pages', 'cover', 'laid']) q = cemReduce(q, ev).q;
  assert.equal(cemMet('cem-lectern', q), true);
  assert.equal(cemMet('cem-bell', q), false);
  const early = cemReduce(q, 'bell');
  assert.equal(early.why, 'bell');
  q = early.q;
  assert.equal(cemMet('cem-bell', q), true);
  assert.equal(cemMet('hymnalHold', q), false);
  for (let i = 0; i < 5; i++) q = cemReduce(q, 'wave').q;
  q = cemReduce(q, 'boss').q;
  assert.equal(cemMet('hymnalHold', q), true);

  const midLectern = cemLoad({ journal: 1, key: 1, pages: 1, cover: 1, laid: 0 }, lectern, hold);
  assert.equal(midLectern.laid, false);
  assert.equal(midLectern.bell, false);
  assert.equal(cemMet('cem-lectern', midLectern), false);
  const midBell = cemLoad({ journal: 1, key: 1, pages: 1, cover: 1, laid: 1, bell: 0 }, bell, hold);
  assert.equal(midBell.laid, true);
  assert.equal(midBell.bell, false);
  assert.equal(cemMet('cem-bell', midBell), false);
  const rung = cemLoad({ journal: 1, key: 1, pages: 1, cover: 1, laid: 1, bell: 1, hold: 0 }, bell, hold);
  assert.equal(cemMet('cem-bell', rung), true);
  assert.equal(cemMet('hymnalHold', rung), false);
});

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

test('built cemetery marks all face the gate within 15 degrees', { timeout: 120000 }, async () => {
  const server = createServer((req, res) => {
    if (req.url.split('?')[0] !== '/plot-viewer.html') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(viewerHtml);
  });
  const port = await listen(server);
  const profile = mkdtempSync(`${tmpdir()}/dh-face-`);
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--user-data-dir=${profile}`, '--remote-debugging-port=9344', '--remote-allow-origins=*',
    '--window-size=1280,720', 'about:blank',
  ], { stdio: 'ignore' });
  let ws;
  try {
    const deadline = Date.now() + 20000;
    let list = [];
    while (Date.now() < deadline) {
      try {
        const res = await fetch('http://127.0.0.1:9344/json/list');
        if (res.ok) { list = await res.json(); if (list.length) break; }
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 200));
    }
    const page = list.find((t) => t.type === 'page') || list[0];
    assert.ok(page, 'chrome did not start');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
    };
    const send = (method, params) => new Promise((resolve) => {
      const n = ++id;
      pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/plot-viewer.html?comp=cemetery&gfx=3` });
    const readyDeadline = Date.now() + 60000;
    let marks = null;
    while (Date.now() < readyDeadline) {
      const msg = await send('Runtime.evaluate', {
        expression: `(() => window.CEM_MARK && window.CEM_MARK.length ? window.CEM_MARK : null)()`,
        returnByValue: true,
      });
      marks = msg.result && msg.result.result && msg.result.result.value;
      if (marks && marks.length) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(marks && marks.length > 40, 'marker count ' + (marks && marks.length));
    const worst = [];
    for (const m of marks) {
      const dx = 36 - m.x, dz = -m.z, L = Math.hypot(dx, dz) || 1;
      const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw);
      const deg = Math.acos(Math.max(-1, Math.min(1, (fx * dx + fz * dz) / L))) * 180 / Math.PI;
      if (deg > 15) worst.push({ ...m, deg });
    }
    assert.equal(worst.length, 0, JSON.stringify(worst.slice(0, 5)));
    const kinds = new Set(marks.map((m) => m.kind));
    for (const k of ['angel', 'stone', 'plot', 'cross', 'ledger']) assert.ok(kinds.has(k), k);
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});
