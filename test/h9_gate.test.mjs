/**
 * Research Station H-9 perimeter gate.
 * The yard switch stays inside. A second switch on the road side uses the same toggle.
 * Reach, the 1.9 m cap, and the closed leaf stay in force. Main Play has the same road switch.
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
const pages = ['test.html', 'campaign-test.html', 'functional-test.html'];
const htmls = Object.fromEntries(pages.map((name) => [name, read(name)]));
const indexHtml = read('index.html');

const SNIP = `const gateWord=()=>gate.open?'close the perimeter gate':'open the perimeter gate';
const toggleGate=()=>{gate.open=!gate.open;say(gate.open?'Perimeter gate opening.':'Perimeter gate closing.')};
// Yard switch stays at local z 33.5. The closed leaf occupies z 37.5–38.5 and blocks reach(), and every station prompt is capped at 1.9 m, so the road approach gets its own switch past that leaf.
N(0,33.5,gateWord,toggleGate,0,5);
N(0,40,gateWord,toggleGate,0,1.9);`;

const OX = -335;
const OZ = -824;
const PLAYER_R = 0.4;

const walls = [
  { x: -24, z: 38, hw: 22, hd: 0.4, y0: 0, y1: 2.8, name: 'front-left' },
  { x: 24, z: 38, hw: 22, hd: 0.4, y0: 0, y1: 2.8, name: 'front-right' },
  { x: -46, z: 0, hw: 0.4, hd: 38, y0: 0, y1: 2.8, name: 'west' },
  { x: 46, z: 0, hw: 0.4, hd: 38, y0: 0, y1: 2.8, name: 'east' },
  { x: 0, z: -38, hw: 46, hd: 0.4, y0: 0, y1: 2.8, name: 'back' },
];

function gateLeaf(open) {
  return { x: 0, z: 38, hw: open ? 0 : 2.1, hd: 0.5, y0: 0, y1: 3, name: 'gate' };
}

function push(pl, b, r) {
  if (!(b.hw > 0 && b.hd > 0)) return;
  const dx = pl.x - b.x;
  const dz = pl.z - b.z;
  const ox = b.hw + r - Math.abs(dx);
  const oz = b.hd + r - Math.abs(dz);
  if (ox > 0 && oz > 0) {
    if (ox < oz) pl.x += Math.sign(dx || 1) * ox;
    else pl.z += Math.sign(dz || 1) * oz;
  }
}

function walk(from, to, open) {
  const pl = { x: from.x, y: 0, z: from.z };
  const boxes = [...walls, gateLeaf(open)];
  for (let i = 0; i < 800; i++) {
    const dx = to.x - pl.x;
    const dz = to.z - pl.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) break;
    pl.x += (dx / d) * 0.12;
    pl.z += (dz / d) * 0.12;
    for (const b of boxes) {
      if (pl.y < b.y1 && pl.y + 1.8 > b.y0) push(pl, b, PLAYER_R);
    }
  }
  return pl;
}

function tallBoxes(open) {
  return [...walls, gateLeaf(open)].filter((b) => b.y1 - b.y0 >= 2.2);
}

/** Same ray test as the station reach() helper, in local station coordinates. */
function reach(pl, node, tall) {
  const dx = node.x - pl.x;
  const dz = node.z - pl.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.7) return true;
  const eye = pl.y + 1.2;
  for (let t = 0; t < d - 0.7; t += 0.2) {
    const x = pl.x + (dx * t) / d;
    const z = pl.z + (dz * t) / d;
    for (const b of tall) {
      if (Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd && eye > b.y0 && eye < b.y1) return false;
    }
  }
  return true;
}

function nearest(pl, nodes, tall) {
  let best = null;
  let bd = 3.6;
  for (const n of nodes) {
    const d = Math.hypot(n.x - pl.x, n.z - pl.z);
    const amt = reach(pl, n, tall) ? 1 : 0;
    if (d < bd && d < n.rad && amt > 0 && Math.abs(pl.y - (n.yl || 0)) < 2.3) {
      bd = d;
      best = n;
    }
  }
  return best;
}

function loadSwitches(html) {
  const i = html.indexOf('const gateWord=');
  const j = html.indexOf('N(-9.5,32,', i);
  assert.ok(i >= 0 && j > i);
  const calls = [];
  const said = [];
  const ctx = {
    gate: { open: false },
    say(m) { said.push(m); },
    N(lx, lz, lb, fn, yl, rad) {
      calls.push({ lx, lz, yl, rad, label: lb, fn });
    },
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(i, j), ctx);
  return { calls, said, ctx };
}

test('Main Play and the three test pages share the road-side gate switch', () => {
  for (const name of pages) assert.ok(htmls[name].includes(SNIP), name);
  assert.equal(htmls['test.html'].includes(SNIP), true);
  assert.ok(indexHtml.includes(SNIP));
  assert.equal(indexHtml.includes("N(0,33.5,()=>gate.open?'close the perimeter gate'"), false);
  for (const html of [...pages.map((name) => htmls[name]), indexHtml]) {
    assert.match(html, /Math\.min\(rad\|\|1\.7,1\.9\)/);
    assert.match(html, /gate\.col\.hw=gate\.p>\.6\?0:2\.1/);
    assert.match(html, /const gate=\{open:false,p:0,col:colW\(0,38,2\.1,\.5,0,3\)\}/);
  }
});

test('both switches run one toggle, and lockdown does not move the perimeter gate', () => {
  for (const src of [...pages.map((name) => htmls[name]), indexHtml]) {
    const { calls, said, ctx } = loadSwitches(src);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((c) => [c.lx, c.lz, c.rad]), [[0, 33.5, 5], [0, 40, 1.9]]);
    assert.equal(calls[0].fn, calls[1].fn);
    assert.equal(calls[0].label(), 'open the perimeter gate');
    calls[1].fn();
    assert.equal(ctx.gate.open, true);
    assert.deepEqual(said, ['Perimeter gate opening.']);
    assert.equal(calls[0].label(), 'close the perimeter gate');
    calls[0].fn();
    assert.equal(ctx.gate.open, false);
    assert.equal(said[1], 'Perimeter gate closing.');
    const body = calls[0].fn.toString();
    assert.equal(/lockdown|badge|POWER|mainD/.test(body), false);
  }
});

test('a body stopped on the closed gate can use the road switch and cannot use the yard switch', () => {
  const stopped = walk({ x: 0, z: 50 }, { x: 0, z: 20 }, false);
  assert.ok(stopped.z >= 38.89 && stopped.z <= 38.91, stopped.z);
  assert.ok(Math.abs(stopped.x) < 0.05);
  const nodes = [
    { name: 'yard', x: 0, z: 33.5, rad: Math.min(5, 1.9), yl: 0 },
    { name: 'road', x: 0, z: 40, rad: Math.min(1.9, 1.9), yl: 0 },
  ];
  const tall = tallBoxes(false);
  const hit = nearest(stopped, nodes, tall);
  assert.equal(hit && hit.name, 'road');
  assert.equal(reach(stopped, nodes[0], tall), false);
  const yard = { x: 0, y: 0, z: 34.5 };
  assert.equal(nearest(yard, nodes, tall) && nearest(yard, nodes, tall).name, 'yard');
  assert.equal(reach({ x: 0, y: 0, z: 39.2 }, nodes[0], tall), false);
});

test('the closed leaf blocks the gap, an open leaf lets a body through, and closing blocks again', () => {
  const inside = walk({ x: 0, z: 50 }, { x: 0, z: 20 }, true);
  assert.ok(inside.z < 25, inside.z);
  const backOut = walk({ x: inside.x, z: inside.z }, { x: 0, z: 50 }, false);
  assert.ok(backOut.z < 37.2, backOut.z);
  const throughWall = walk({ x: -10, z: 50 }, { x: -10, z: 20 }, true);
  assert.ok(throughWall.z > 38.7, throughWall.z);
});

test('building door, badge doors, elevator, and the suit lock stay as they were', () => {
  const doorAuth = `if(st.lockdown&&d.lv>0&&st.badge<3){ok=false;why='Door sealed: facility lockdown. Use a lockdown override panel.'}
  else if(st.badge<d.lv){ok=false;why='Access denied: Level '+d.lv+' badge required.'}`;
  const ops = `N(0,9,()=>mainD.open?'secure the operations entrance':'unlock the operations entrance',()=>{if(st.lockdown){say('Access denied: facility lockdown is active.');return}mainD.open=!mainD.open;say(mainD.open?'Operations entrance unlocked.':'Operations entrance secured.')},0,3.4);`;
  const lift = `if(here){if(playerTop&&st.badge<1){say('Access denied: collect a visitor badge from reception first.');return}`;
  const suit = `door(-9,-28,'z',2.4,2,-1,()=>st.ppe,'Sterile lab: put on a hazmat suit from the PPE room first.');`;
  const cells = `door(9,-28,'z',2.4,3,1);`;
  for (const html of [...pages.map((n) => htmls[n]), indexHtml]) {
    assert.ok(html.includes(doorAuth));
    assert.ok(html.includes(ops));
    assert.ok(html.includes(lift));
    assert.ok(html.includes(suit));
    assert.ok(html.includes(cells));
  }
  const st = { lockdown: true, badge: 1, ppe: false };
  let ok = true;
  let why = '';
  const d = { lv: 2, req: null, msg: '' };
  if (st.lockdown && d.lv > 0 && st.badge < 3) { ok = false; why = 'Door sealed: facility lockdown. Use a lockdown override panel.'; }
  else if (st.badge < d.lv) { ok = false; why = 'Access denied: Level ' + d.lv + ' badge required.'; }
  assert.equal(ok, false);
  assert.match(why, /lockdown/);
  st.lockdown = false;
  st.badge = 1;
  ok = true;
  if (st.lockdown && d.lv > 0 && st.badge < 3) ok = false;
  else if (st.badge < d.lv) ok = false;
  assert.equal(ok, false);
  st.badge = 3;
  ok = !(st.badge < d.lv);
  assert.equal(ok, true);
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

test('headless functional page builds a closed gate and both switches', async () => {
  const html = htmls['functional-test.html'];
  const server = createServer((req, res) => {
    if (req.url.split('?')[0] !== '/functional-test.html') {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  const port = await listen(server);
  const profile = mkdtempSync(`${tmpdir()}/dh-h9-gate-`);
  const debug = 9347;
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${debug}`, '--remote-allow-origins=*',
    'about:blank',
  ], { stdio: 'ignore' });
  let ws;
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
    };
    const send = (method, params) => new Promise((resolve) => {
      const n = ++id;
      pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
    await send('Runtime.enable', {});
    await send('Page.enable', {});
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/functional-test.html` });
    const deadline = Date.now() + 50000;
    let state = null;
    while (Date.now() < deadline) {
      const res = await send('Runtime.evaluate', {
        expression: `(() => {
          const R = window.RESBASE;
          if (!R || !R.root || !R.gate) return null;
          const marks = [];
          R.root.traverse(o => {
            if (o.parent !== R.root) return;
            const p = o.position;
            if (Math.abs(p.x) < 0.001 && Math.abs(p.y) < 0.001 && (Math.abs(p.z - 33.5) < 0.001 || Math.abs(p.z - 40) < 0.001)) marks.push(p.z);
          });
          return {
            open: R.gate.open,
            hw: R.gate.col.hw,
            hd: R.gate.col.hd,
            x: R.gate.col.x,
            z: R.gate.col.z,
            badge: R.st.badge,
            lockdown: R.st.lockdown,
            mainOpen: R.mainD.open,
            mainHw: R.mainD.col.hw,
            marks
          };
        })()`,
        returnByValue: true,
      });
      state = res.result && res.result.result && res.result.result.value;
      if (state && state.marks && state.marks.length >= 2) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    assert.ok(state, 'RESBASE did not appear');
    assert.equal(state.open, false);
    assert.equal(state.hw, 2.1);
    assert.equal(state.hd, 0.5);
    assert.equal(state.x, OX);
    assert.equal(state.z, OZ + 38);
    assert.equal(state.badge, 0);
    assert.equal(state.lockdown, false);
    assert.equal(state.mainOpen, false);
    assert.equal(state.mainHw, 1.8);
    assert.deepEqual(state.marks.slice().sort((a, b) => a - b), [33.5, 40]);
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});
