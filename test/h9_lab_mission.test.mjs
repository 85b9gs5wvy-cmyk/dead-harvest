/**
 * Research Station H-9 upper floor and the in-base keycard finale.
 * The floor, stairs, door locks, and step order are the shared spec in
 * test.html and plot-viewer.html. This does not play the mission by hand.
 * One headless Chrome load checks that both pages boot without an exception.
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
const indexHtml = read('index.html');
const campaignHtml = read('campaign-test.html');
const functionalHtml = read('functional-test.html');

function between(html, start, end) {
  const i = html.indexOf(start);
  assert.ok(i >= 0, start);
  const j = html.indexOf(end, i + start.length);
  assert.ok(j > i, end);
  return html.slice(i, j + end.length);
}

function loadLab(html) {
  const src = between(html, '/* H9_LAB_BEGIN */', '/* H9_LAB_END */');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.H9_LAB;
}

function script(html, id) {
  const open = `<script id="${id}">`;
  const i = html.indexOf(open);
  assert.ok(i >= 0, id);
  const j = html.indexOf('</script>', i);
  return html.slice(i + open.length, j);
}

const lab = loadLab(testHtml);
const ORDER = ['h9-gate', 'h9-power', 'h9-card', 'h9-stairs', 'h9-director', 'h9-seal', 'h9-boss'];

function push(p, b) {
  if (!(p.y < b.y1 && p.y + 1.8 > b.y0)) return;
  const r = 0.4;
  const dx = p.x - b.x;
  const dz = p.z - b.z;
  const ox = b.hw + r - Math.abs(dx);
  const oz = b.hd + r - Math.abs(dz);
  if (ox > 0 && oz > 0) {
    if (ox < oz) p.x += Math.sign(dx || 1) * ox;
    else p.z += Math.sign(dz || 1) * oz;
  }
}

/** Same vertical step as the game: up to 12*dt, down to 14*dt, dt 0.05. */
function walk(state, x, y, z, pts) {
  const boxes = lab.colliders(state);
  const p = { x, y, z };
  for (const [tx, tz] of pts) {
    for (let i = 0; i < 500; i++) {
      const dx = tx - p.x;
      const dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.06) break;
      const step = Math.min(0.05, d);
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      for (const b of boxes) push(p, b);
      const ty = lab.floorLocal(p.x, p.z, p.y);
      const fy = ty == null ? 0 : ty;
      const dt = 0.05;
      p.y = fy > p.y ? Math.min(fy, p.y + 12 * dt) : Math.max(fy, p.y - 14 * dt);
    }
  }
  return p;
}

test('test play and the plot viewer share one upper-floor spec', () => {
  assert.equal(between(viewerHtml, '/* H9_LAB_BEGIN */', '/* H9_LAB_END */'), between(testHtml, '/* H9_LAB_BEGIN */', '/* H9_LAB_END */'));
  for (const html of [indexHtml, campaignHtml, functionalHtml]) {
    assert.equal(html.includes('/* H9_LAB_BEGIN */'), false);
    assert.equal(html.includes('h9-boss'), false);
  }
  assert.equal(testHtml.includes("box('steel',0,6.15,-4,31,.3,23);"), false);
  assert.equal(indexHtml.includes("box('steel',0,6.15,-4,31,.3,23);"), true);
  assert.match(viewerHtml, /function h9Go\(level\)/);
  assert.match(viewerHtml, /name==='yard'\?'Yard':name/);
});

test('each upper room has a floor, and the corridor is not a step up from the ground', () => {
  assert.equal(Array.from(lab.rooms, (r) => r.id).join(','), 'stairwell,corridor,security,records,lab,director');
  for (const r of lab.rooms) {
    const y = lab.floorLocal(r.x, r.z, r.y + 0.4);
    assert.ok(Math.abs(y - r.y) < 0.05, `${r.id} floor ${y}`);
  }
  assert.equal(lab.floorLocal(1.2, 4.8, 0), null);
  assert.equal(lab.floorLocal(1.2, 4.8, 6.2), 6.3);
  assert.ok(lab.floorLocal(-13.7, 3.2, 7) < 4);
  assert.equal(lab.L1, 6.3);
});

test('the west stair reaches Level 1, and locked doors stop the body', () => {
  const open = { power: true, badge: 1, upstairs: true, office: true, seal: true };
  const top = walk(open, -13.55, 0, 1.15, [
    [-13.55, 2.4], [-13.55, 5.7], [-12.05, 5.7], [-12.05, 2.4], [-8.7, 4.8],
  ]);
  assert.ok(top.y > 6, 'climbed to ' + top.y);
  assert.ok(top.z > 4.2, 'landed in the corridor at ' + top.z);

  const director = walk(open, 10.85, 6.3, 4.8, [[10.85, -1.2]]);
  assert.ok(director.z < -0.8, 'director office ' + director.z);
  assert.ok(director.y > 6);

  const shutter = walk({ power: false, badge: 0 }, 0, 0, 10, [[0, 4]]);
  assert.ok(shutter.z > 7.5, 'shutter ' + shutter.z);
  const through = walk({ power: true, badge: 1, upstairs: true, office: true }, 0, 0, 10, [[0, 4]]);
  assert.ok(through.z < 5, 'open shutter ' + through.z);

  const stair = walk({ power: true, badge: 0 }, -13.55, 0, 1.15, [[-13.55, 4]]);
  assert.ok(stair.z < 2.1, 'stair door ' + stair.z);
  const office = walk({ power: true, badge: 1, upstairs: true, office: false }, 10.85, 6.3, 4.8, [[10.85, 0]]);
  assert.ok(office.z > 3.2, 'director door ' + office.z);
});

test('keycard steps stay in order and the boss step does not complete itself', () => {
  assert.equal(Array.from(lab.steps, (s) => s.id).join(','), ORDER.join(','));
  assert.equal(Array.from(lab.ORDER).join(','), ORDER.join(','));
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(between(testHtml, '/* H9_LAB_BEGIN */', '/* H9_LAB_END */'), sandbox);
  vm.runInContext(script(testHtml, 'story-config'), sandbox);
  const ids = Array.from(sandbox.window.STORY_CONFIG.steps, (s) => s.id);
  const fort = ids.indexOf('fort');
  assert.ok(fort > 0);
  assert.equal(ids.slice(fort + 1).join(','), ORDER.join(','));
  assert.equal(ids.includes('end'), false);
  assert.match(testHtml, /H9_CHAIN_HOOK/);
  assert.match(indexHtml, /End of Chapter 1/);
  assert.equal(indexHtml.includes('H9_CHAIN_HOOK'), false);
  assert.match(campaignHtml, /End of Chapter 1/);
  assert.match(functionalHtml, /End of Chapter 1/);

  const s = {};
  assert.equal(lab.met('h9-gate', s), false);
  s.gate = true;
  assert.equal(lab.met('h9-gate', s), true);
  assert.equal(lab.met('h9-power', s), false);
  s.power = true;
  assert.equal(lab.met('h9-power', s), true);
  assert.equal(lab.met('h9-card', s), false);
  s.badge = 1;
  assert.equal(lab.met('h9-card', s), true);
  s.upstairs = true;
  s.y = 2;
  assert.equal(lab.met('h9-stairs', s), false);
  s.y = 6.3;
  assert.equal(lab.met('h9-stairs', s), true);
  assert.equal(lab.met('h9-director', s), false);
  s.director = true;
  assert.equal(lab.met('h9-director', s), true);
  assert.equal(lab.met('h9-seal', s), false);
  s.seal = true;
  assert.equal(lab.met('h9-seal', s), true);
  s.bossDead = true;
  assert.equal(lab.met('h9-boss', s), false);

  assert.equal(lab.doorOpen('front', {}), false);
  assert.equal(lab.doorOpen('front', { power: true }), true);
  assert.equal(lab.doorOpen('stair', { badge: 0 }), false);
  assert.equal(lab.doorOpen('stair', { badge: 1 }), true);
  assert.equal(lab.doorOpen('director', { badge: 1 }), false);
  assert.equal(lab.doorOpen('director', { office: true }), true);
  assert.equal(lab.doorOpen('seal', { director: true }), false);
  assert.equal(lab.doorOpen('seal', { seal: true }), true);
  assert.equal(lab.doorOpen('arena', { arena: true }), false);
  assert.equal(lab.doorOpen('arena', { arena: true, bossDead: true }), true);
  assert.equal(lab.doorOpen('front', { inspect: true }), true);

  const zs = lab.zombies;
  assert.ok(zs.some((z) => z.z > 40 && z.y === 0));
  assert.ok(zs.some((z) => z.y > 5));
  assert.ok(zs.some((z) => z.y < 0));
  assert.match(testHtml, /You survived Dead Harvest/);
  assert.match(testHtml, /Continue free-roam/);
  assert.match(testHtml, /Main menu/);
  assert.match(testHtml, /Days survived/);
  const upper = between(testHtml, 'function h9Ensure(){', 'function h9Tick(');
  assert.equal(upper.includes('PointLight'), false);
  assert.equal(upper.includes('castShadow=true'), false);
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

test('headless test play and the plot viewer boot the upper floor', { timeout: 180000 }, async () => {
  const files = {
    '/test.html': testHtml,
    '/plot-viewer.html': viewerHtml,
  };
  const server = createServer((req, res) => {
    const path = req.url.split('?')[0];
    const body = files[path];
    if (!body) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(body);
  });
  const port = await listen(server);
  const profile = mkdtempSync(`${tmpdir()}/dh-h9-lab-`);
  const debug = 9361;
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

    async function boot(url, expr, ready) {
      logs.length = 0;
      await send('Page.navigate', { url });
      const deadline = Date.now() + 90000;
      let state = null;
      while (Date.now() < deadline) {
        const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
        state = res.result && res.result.result && res.result.result.value;
        if (state && ready(state)) break;
        await new Promise((r) => setTimeout(r, 400));
      }
      assert.equal(logs.length, 0, logs.join('\n').slice(0, 1200));
      assert.ok(state && ready(state), JSON.stringify(state));
      return state;
    }

    const play = await boot(`http://127.0.0.1:${port}/test.html`, `(() => {
      const R = window.RESBASE, L = window.H9_LAB;
      if (!R || !L || !L.ensure) return null;
      try { L.ensure(); } catch (e) { return { ensure: String(e && e.stack || e) }; }
      let upper = 0;
      if (R.root) R.root.traverse(o => { if (o.name === 'H9Upper') upper++; });
      const ids = (window.STORY && window.STORY.cfg && window.STORY.cfg.steps || []).map(s => s.id);
      return {
        canvas: document.querySelectorAll('canvas').length,
        baseErr: window.RESBASE_ERROR ? String(window.RESBASE_ERROR) : '',
        upperErr: window.H9_UPPER_ERR ? String(window.H9_UPPER_ERR) : '',
        storyErr: window.STORY_ERROR ? String(window.STORY_ERROR) : '',
        floor: R.floor(-335 + 1.2, -824 + 4.8, 6.5),
        upper,
        last: ids[ids.length - 1] || '',
        fort: ids.indexOf('fort')
      };
    })()`, (s) => s && s.canvas && s.upper && s.last);
    assert.equal(play.ensure || '', '');
    assert.equal(play.baseErr, '');
    assert.equal(play.upperErr, '');
    assert.equal(play.storyErr, '');
    assert.ok(Math.abs(play.floor - 6.3) < 0.05, play.floor);
    assert.equal(play.last, 'h9-boss');
    assert.ok(play.fort > 0);

    const view = await boot(`http://127.0.0.1:${port}/plot-viewer.html?comp=h9&gfx=3`, `(() => {
      const one = window.__DH_ONE, R = window.RESBASE, L = window.H9_LAB;
      if (!one || !one.ready || !R || !L) return null;
      let upper = 0;
      if (R.root) R.root.traverse(o => { if (o.name === 'H9Upper') upper++; });
      const buttons = Array.from(document.querySelectorAll('#dhOneBanner button')).map(b => b.textContent);
      return {
        boot: one.bootError || '',
        baseErr: window.RESBASE_ERROR ? String(window.RESBASE_ERROR) : '',
        upperErr: window.H9_UPPER_ERR ? String(window.H9_UPPER_ERR) : '',
        floor: R.floor(-335 + 1.2, -824 + 4.8, 6.5),
        upper,
        buttons,
        level: one.h9Level || ''
      };
    })()`, (s) => s && s.upper && s.buttons && s.buttons.length);
    assert.equal(view.boot, '');
    assert.equal(view.baseErr, '');
    assert.equal(view.upperErr, '');
    assert.ok(Math.abs(view.floor - 6.3) < 0.05, view.floor);
    for (const name of ['Yard', 'L0', 'L1', 'B1']) assert.ok(view.buttons.includes(name), view.buttons.join(','));
    assert.equal(view.level, 'yard');
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});
