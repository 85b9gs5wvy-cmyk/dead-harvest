/**
 * Hollow Creek cemetery chapter on Test Play: more steps, same fort handoff,
 * and the plot viewer carries the same yard geometry.
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

const CEM = ['cem-gate', 'cem-journal', 'cem-key', 'cem-crypt', 'cem-cover', 'cem-lectern', 'cem-bell', 'hymnalHold'];
const V6 = [
  'calm', 'surge', 'barn', 'barnLights',
  'plant-arrive', 'plant-keycard', 'plant-prep', 'plant-control',
  'hymnal', 'hymnalHold', 'fort',
  'fort-log', 'fort-power', 'fort-gate', 'fort-yard', 'fort-key', 'fort-boss',
  'courier-wreck', 'courier-case', 'courier-return',
  'h9-gate', 'h9-power', 'h9-card', 'h9-stairs', 'h9-director', 'h9-seal', 'h9-boss',
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

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(between(testHtml, '/* H9_LAB_BEGIN */', '/* H9_LAB_END */'), sandbox);
vm.runInContext(script(testHtml, 'story-config'), sandbox);
vm.runInContext(between(testHtml, '/*CAMPAIGN_REWORK_BEGIN*/', '/*CAMPAIGN_REWORK_END*/') + '\nthis.migrateStoryIdx=migrateStoryIdx;', sandbox);
vm.runInContext(between(testHtml, '/*CEM_QUEST_BEGIN*/', '/*CEM_QUEST_END*/') + '\nthis.cemBlank=cemBlank;this.cemLoad=cemLoad;this.cemMet=cemMet;this.cemReduce=cemReduce;this.cemRestart=cemRestart;this.CEM_HOLD_NEED=CEM_HOLD_NEED;', sandbox);

test('the cemetery chapter sits between the plant and Fort Harvest', () => {
  const ids = sandbox.window.STORY_CONFIG.steps.map((s) => s.id);
  const gate = ids.indexOf('cem-gate');
  const fort = ids.indexOf('fort');
  assert.equal(ids.slice(gate, fort).join(','), CEM.join(','));
  assert.equal(ids[gate - 1], 'plant-control');
  assert.equal(ids[fort], 'fort');
  const by = Object.fromEntries(sandbox.window.STORY_CONFIG.steps.map((s) => [s.id, s]));
  assert.equal(by['cem-gate'].goal.reach, 'cemGate');
  assert.equal(by['cem-journal'].goal.cem, 'journal');
  assert.equal(by['cem-key'].goal.cem, 'key');
  assert.equal(by['cem-crypt'].goal.cem, 'pages');
  assert.equal(by['cem-cover'].goal.cem, 'cover');
  assert.equal(by['cem-lectern'].goal.cem, 'laid');
  assert.equal(by['cem-bell'].goal.cem, 'bell');
  assert.equal(by.hymnalHold.goal.cem, 'hold');
  assert.equal(by.hymnalHold.onEnter, 'cemHold');
  for (const id of CEM) assert.equal(by[id].clock, 'free', id);
  assert.equal(indexHtml.includes('cem-gate'), false);
  assert.match(indexHtml, /id:'quarry'/);
});

test('cemetery rules and v6 saves restart at the gate', () => {
  const { cemBlank, cemLoad, cemMet, cemReduce, cemRestart, migrateStoryIdx, CEM_HOLD_NEED } = sandbox;
  assert.equal(CEM_HOLD_NEED, 5);
  let q = cemBlank();
  assert.equal(cemReduce(q, 'key').why, 'locked');
  q = cemReduce(q, 'journal').q;
  q = cemReduce(q, 'key').q;
  assert.equal(cemReduce(q, 'pages').why, 'pages');
  q = cemReduce(q, 'pages').q;
  q = cemReduce(q, 'cover').q;
  q = cemReduce(q, 'laid').q;
  q = cemReduce(q, 'bell').q;
  for (let i = 0; i < 5; i++) q = cemReduce(q, 'wave').q;
  assert.equal(cemMet('hymnalHold', q), false);
  q = cemReduce(q, 'boss').q;
  assert.equal(cemMet('hymnalHold', q), true);
  const ids = sandbox.window.STORY_CONFIG.steps.map((s) => s.id);
  const past = cemLoad(null, ids.indexOf('fort'), ids.indexOf('hymnalHold'));
  assert.equal(past.laid, true);
  assert.equal(past.boss, true);
  const fresh = cemLoad(null, ids.indexOf('cem-journal'), ids.indexOf('hymnalHold'));
  assert.equal(fresh.journal, false);

  assert.equal(ids[migrateStoryIdx(6, V6.indexOf('hymnal'))], 'cem-gate');
  assert.equal(ids[migrateStoryIdx(6, V6.indexOf('hymnalHold'))], 'cem-gate');
  assert.equal(ids[migrateStoryIdx(6, V6.indexOf('fort'))], 'fort');
  assert.equal(ids[migrateStoryIdx(6, V6.indexOf('h9-boss'))], 'h9-boss');
  assert.equal(ids[migrateStoryIdx(7, ids.indexOf('cem-crypt'))], 'cem-crypt');
  assert.equal(ids[migrateStoryIdx(7, ids.indexOf('fort-boss'))], 'fort-boss');
  assert.equal(cemRestart(6, V6.indexOf('hymnalHold')), true);
  assert.equal(cemRestart(6, V6.indexOf('fort')), false);
  assert.equal(cemRestart(7, ids.indexOf('cem-bell')), false);

  const save = script(testHtml, 'will-save');
  assert.match(save, /VER=7/);
  assert.match(save, /cem:window\.CEMQ/);
  assert.match(save, /cemRestart/);
});

test('plot viewer mirrors the cemetery yard and adds no new real lights', () => {
  const start = '// ===== GRAVEYARD (v0.19.3)';
  const end = "console.error('graveyard build failed',e)";
  const a = between(testHtml, start, end);
  const b = between(viewerHtml, start, end);
  assert.equal(a, b);
  const added = a.slice(a.indexOf('CEMETERY DETAIL'));
  assert.equal(added.includes('new T.PointLight'), false);
  assert.equal(added.includes('new T.SpotLight'), false);
  assert.match(a, /TorusGeometry\(\.38/);
  assert.match(a, /cryptJobs/);
  assert.equal(a.includes('ball(M,.2,0,y0+2.8'), false);
});

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

test('headless cemetery steps run in order', { timeout: 180000 }, async () => {
  const server = createServer((req, res) => {
    if (req.url.split('?')[0] !== '/test.html') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(testHtml);
  });
  const port = await listen(server);
  const profile = mkdtempSync(`${tmpdir()}/dh-cem-`);
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--user-data-dir=${profile}`, '--remote-debugging-port=9395', '--remote-allow-origins=*',
    '--window-size=1280,720', 'about:blank',
  ], { stdio: 'ignore' });
  let ws;
  const logs = [];
  try {
    const deadline = Date.now() + 20000;
    let list = [];
    while (Date.now() < deadline) {
      try {
        const res = await fetch('http://127.0.0.1:9395/json/list');
        if (res.ok) { list = await res.json(); if (list.length) break; }
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 200));
    }
    const page = list.find((t) => t.type === 'page') || list[0];
    assert.ok(page, 'chrome page');
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
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params && msg.params.type === 'error') {
        logs.push(msg.params.args.map((a) => a.value || a.description || '').join(' '));
      }
    };
    const send = (method, params) => new Promise((resolve) => {
      const n = ++id; pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
    const evalJs = async (expression) => {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true });
      return res.result && res.result.result && res.result.result.value;
    };
    await send('Runtime.enable', {});
    await send('Page.enable', {});
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/test.html` });
    const bootBy = Date.now() + 90000;
    let boot = null;
    while (Date.now() < bootBy) {
      boot = await evalJs(`(() => {
        if (!window.STORY || !window.STORY.cur || !window.CEMQ || !window.GYG || !window.CEM_GEO) return null;
        return { id: STORY.cur.id, storyErr: window.STORY_ERROR ? String(window.STORY_ERROR) : '', geo: CEM_GEO, crypt: !!(GYG.userData.cem && GYG.userData.cem.spots && GYG.userData.cem.spots.crypt) };
      })()`);
      if (boot && boot.id) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    assert.equal(logs.filter((l) => /SyntaxError|ReferenceError|TypeError|graveyard build failed/.test(l)).join('\n'), '');
    assert.ok(boot && boot.id, JSON.stringify(boot));
    assert.equal(boot.storyErr, '');
    assert.equal(boot.crypt, true);
    assert.equal(boot.geo.lights, 3);

    const play = await evalJs(`(() => {
      const ids = [];
      STORY.goto('cem-gate');
      ids.push(STORY.cur.id);
      const g = CEMQ.spot('cemGate');
      pl.set(g.x, 0, g.z);
      env(0.05);
      ids.push(STORY.cur.id);
      CEMQ.nodes.journal.act();
      ids.push(STORY.cur.id);
      CEMQ.nodes.key.act();
      ids.push(STORY.cur.id);
      const c = CEMQ.spot('cemCrypt');
      pl.set(c.x, c.y, c.z);
      const floor = floorAt(c.x, c.z, c.y);
      CEMQ.nodes.pages.act();
      ids.push(STORY.cur.id);
      window.cemAngel();
      ids.push(STORY.cur.id);
      window.cemLectern();
      ids.push(STORY.cur.id);
      window.cemBell();
      ids.push(STORY.cur.id);
      const spawned = zs.filter(z => z.cemHold && !z.dead);
      spawned.forEach(z => { z.hp = 0; killZ(z); });
      ids.push(STORY.cur.id);
      const chapel = blockedAt(-125, 1, -264.5);
      return { ids, floor, spawned: spawned.length, boss: spawned.filter(z => z.cemBoss).length, chapel, laid: CEMQ.state.laid, bell: CEMQ.state.bell };
    })()`);
    assert.deepEqual(play.ids, ['cem-gate', 'cem-journal', 'cem-key', 'cem-crypt', 'cem-cover', 'cem-lectern', 'cem-bell', 'hymnalHold', 'fort']);
    assert.equal(play.spawned, 6);
    assert.equal(play.boss, 1);
    assert.equal(play.laid, true);
    assert.equal(play.bell, true);
    assert.ok(play.floor < -2, 'crypt floor ' + play.floor);
    assert.equal(play.chapel, true);
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});
