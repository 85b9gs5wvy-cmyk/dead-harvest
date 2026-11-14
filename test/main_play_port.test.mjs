/**
 * Main Play (index.html) ports of the published test-page fixes.
 * The test pages, the campaign harness, the functional page, and the plot
 * viewer are locked to the bytes in this revision, including the dead-tree
 * instance-colour fix. This file does not play the game by hand: goal checks
 * run in Node, and one headless Chrome load confirms index.html boots.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, ROOT), 'utf8');
const indexHtml = read('index.html');

const FROZEN = {
  'test.html': '721ea57b2ca987ce55aa5ebd885715c80230694f77d616968dcfddfbb83bb757',
  'campaign-test.html': '1cc4e86f2b1a64a40e6188d57509fc49acf23a66fe0b1ab4625a7c634b1c421a',
  'functional-test.html': 'aaaad9fe062b4032c4ba265128f1231124bb13c9da7f1ec0f7e7e85b31275976',
};

const GOAL_AT = { x: 10, z: 18 };
const FARM_SPAWN = { x: -23.7, z: -1.4 };
const CAR_DEATH = { x: 0, z: 18 };
const RETURN_R = 30;
const RETURN = { id: 'return', goal: { reach: { ...GOAL_AT }, radius: RETURN_R } };
const TOAST = 'Death put you on the farm empty-handed. Step outside this area and walk back in, or bring a haul.';

const DEATH_SNAP = 'if(foot)farmSpawn();else{if(drv){drv.x=0;drv.z=18;drv.spd=0;drv.steer=0}spd=0;car.position.set(0,pitH(0,18),18);window.__vehRsp=1}';
const DRIVE_SNAP = 'if(drv!==v){window.__vehRsp=0;return}if(window.__vehRsp){window.__vehRsp=0;v.x=0;v.z=18;v.spd=0;v.steer=0;spd=0}spd=v.spd;';
const EXIT_CLEAR = 'function exitV(){if(window.__vehRsp)window.__vehRsp=0;const v=drv;if(!v)return;';
const REACHED = "const actP=()=>!foot&&typeof car!=='undefined'&&car?car.position:pl;const reached=(t,r)=>{const p=place(t);const q=actP();return p&&Math.hypot(q.x-p.x,q.z-p.z)<r};";
const METER = 'Math.hypot(S.tgt.x-actP().x,S.tgt.z-actP().z)';
const SAVE_FIELDS = 'willRsp:window.__willRsp?1:0,willRspNote:window.__willRspNote?1:0';
const LOAD_FIELDS = 'window.__willRsp=d.willRsp?1:0;window.__willRspNote=d.willRspNote?1:0;';

function lineFrom(html, start) {
  const i = html.indexOf(start);
  assert.ok(i >= 0, start.slice(0, 40));
  return html.slice(i, html.indexOf('\n', i));
}

function loadGoalMet(html) {
  const src = lineFrom(html, 'const goalMet=s=>');
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
      return Math.hypot(context.player.x - p.x, context.player.z - p.z) < radius;
    },
  };
  vm.createContext(context);
  vm.runInContext(`${src}\nthis.goalMet = goalMet;`, context);
  return { goalMet: context.goalMet, context, toasts };
}

test('test pages and the plot viewer match the locked bytes', () => {
  for (const [name, sha] of Object.entries(FROZEN)) {
    const got = createHash('sha256').update(read(name)).digest('hex');
    assert.equal(got, sha, name);
  }
});

test('Main Play return guard uses the 30 m circle and shows the death toast once', () => {
  const line = lineFrom(indexHtml, 'const goalMet=s=>');
  assert.match(line, /if\(!reached\(g\.reach,r\)\)window\.__willRsp=0/);
  assert.doesNotMatch(line, /r\+50/);
  assert.match(indexHtml, /window\.__willRsp=1;window\.__willRspNote=0;/);
  // Pre-existing Main Play difference: the empty-carry block is not limited to the return step,
  // and a haul does not clear the flag. Those test-page branches were not copied.
  assert.doesNotMatch(line, /S\.cur\.id==='return'/);
  assert.doesNotMatch(line, /else window\.__willRsp=0/);

  const { goalMet, context, toasts } = loadGoalMet(indexHtml);
  context.window.__willRsp = 1;
  context.window.__willRspNote = 0;
  context.player = { ...CAR_DEATH };
  assert.equal(goalMet(RETURN), false);
  assert.equal(context.window.__willRsp, 1);
  assert.deepEqual(toasts, [TOAST]);
  assert.equal(goalMet(RETURN), false);
  assert.equal(toasts.length, 1);

  context.player = { x: GOAL_AT.x + 31, z: GOAL_AT.z };
  assert.equal(goalMet(RETURN), false);
  assert.equal(context.window.__willRsp, 0);

  context.window.__willRsp = 1;
  context.player = { ...FARM_SPAWN };
  assert.equal(goalMet(RETURN), false);
  assert.equal(context.window.__willRsp, 0);
  context.player = { ...GOAL_AT };
  assert.equal(goalMet(RETURN), true);

  const haul = loadGoalMet(indexHtml);
  haul.context.window.__willRsp = 1;
  haul.context.player = { ...CAR_DEATH };
  haul.context.carry.w = 1;
  assert.equal(haul.goalMet(RETURN), true);
  assert.equal(haul.context.window.__willRsp, 1);

  const fort = loadGoalMet(indexHtml);
  fort.context.window.__willRsp = 1;
  fort.context.S.cur = { id: 'fort' };
  fort.context.player = { ...GOAL_AT };
  fort.context.reached = () => true;
  assert.equal(fort.goalMet({ id: 'fort', goal: { reach: 'fort' } }), false);
  assert.equal(fort.context.window.__willRsp, 1);
});

test('Main Play vehicle death, driven reach, and Continue keep the published snippets', () => {
  for (const piece of [DEATH_SNAP, DRIVE_SNAP, EXIT_CLEAR, REACHED, METER, SAVE_FIELDS, LOAD_FIELDS]) {
    assert.equal(indexHtml.includes(piece), true, piece.slice(0, 70));
  }
  assert.equal(indexHtml.includes('else car.position.set(0,0,18);'), false);
  assert.equal(indexHtml.includes('const reached=(t,r)=>{const p=place(t);return p&&Math.hypot(pl.x-p.x,pl.z-p.z)<r};'), false);
  assert.match(indexHtml, /KEY='dhSave',VKEY='dhSaveVer'/);
  assert.doesNotMatch(indexHtml, /dhSaveTest|dhSaveHarness|dhSaveFunctional|dhGfxTest|dhGfxHarness|dhGfxFunctional/);

  const context = {
    foot: false,
    car: { position: { x: 0, z: 18 } },
    pl: { x: 400, z: 400 },
    place: () => ({ ...GOAL_AT }),
  };
  vm.createContext(context);
  vm.runInContext(`${REACHED}\nthis.reached = reached; this.actP = actP;`, context);
  assert.equal(context.reached('farm', RETURN_R), true);
  context.foot = true;
  assert.equal(context.reached('farm', RETURN_R), false);
  context.pl = { x: GOAL_AT.x, z: GOAL_AT.z };
  assert.equal(context.reached('farm', RETURN_R), true);
});

test('Main Play inline scripts parse', () => {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  let n = 0;
  while ((m = re.exec(indexHtml))) {
    if (/\bsrc\s*=/i.test(m[1] || '')) continue;
    if (!m[2].trim()) continue;
    const file = join(tmpdir(), `index-script-${n}.js`);
    writeFileSync(file, m[2]);
    execFileSync('node', ['--check', file], { stdio: 'pipe' });
    n++;
  }
  assert.equal(n, 6);
});

test('headless Chrome boots index.html without story or research-base errors', { timeout: 120000 }, async () => {
  const server = createServer((req, res) => {
    if (req.url.split('?')[0] !== '/index.html') {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(indexHtml);
  });
  const port = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
  const profile = mkdtempSync(tmpdir() + '/dh-index-boot-');
  const debug = 9353;
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
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
    const deadline = Date.now() + 90000;
    let state = {};
    while (Date.now() < deadline) {
      const res = await send('Runtime.evaluate', {
        expression: `(() => {
          const R = window.RESBASE;
          const marks = [];
          if (R && R.root) R.root.traverse(o => {
            if (o.parent !== R.root) return;
            const p = o.position;
            if (Math.abs(p.x) < 0.001 && Math.abs(p.y) < 0.001 && (Math.abs(p.z - 33.5) < 0.001 || Math.abs(p.z - 40) < 0.001)) marks.push(p.z);
          });
          const office = window.DH_SCENIC && window.DH_SCENIC.office;
          return {
            canvas: document.querySelectorAll('canvas').length,
            story: !!(window.STORY && window.STORY.cur),
            storyErr: window.STORY_ERROR ? String(window.STORY_ERROR) : '',
            baseErr: window.RESBASE_ERROR ? String(window.RESBASE_ERROR) : '',
            hurt: typeof hurt === 'function',
            officeY: office && office[0] && office[0].y1,
            marks
          };
        })()`,
        returnByValue: true,
      });
      state = res.result && res.result.result && res.result.result.value || {};
      if (state.canvas && state.story && state.hurt && state.officeY === 2.6 && state.marks && state.marks.length >= 2) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    assert.equal(logs.length, 0, logs.join('\n').slice(0, 1200));
    assert.equal(state.storyErr, '', JSON.stringify(state));
    assert.equal(state.baseErr, '', JSON.stringify(state));
    assert.ok(state.canvas >= 1, JSON.stringify(state));
    assert.equal(state.story, true, JSON.stringify(state));
    assert.equal(state.hurt, true, JSON.stringify(state));
    assert.equal(state.officeY, 2.6, JSON.stringify(state));
    assert.deepEqual(state.marks.slice().sort((a, b) => a - b), [33.5, 40]);
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
