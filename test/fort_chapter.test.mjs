/**
 * Fort Harvest chapter on Test Play: the old gate-breaker side quest is a
 * main step, the chapter ends on Quartermaster Voss, and a new game starts
 * with the pistol only. Plot-viewer mirrors the new geometry.
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

const ORDER = [
  'calm', 'surge', 'barn', 'barnLights',
  'plant-arrive', 'plant-keycard', 'plant-prep', 'plant-control',
  'hymnal', 'hymnalHold',
  'fort', 'fort-log', 'fort-power', 'fort-gate', 'fort-yard', 'fort-key', 'fort-boss',
  'courier-wreck', 'courier-case', 'courier-return',
  'h9-gate', 'h9-power', 'h9-card', 'h9-stairs', 'h9-director', 'h9-seal', 'h9-boss',
];
const V5 = [
  'calm', 'surge', 'barn', 'barnLights',
  'plant-arrive', 'plant-keycard', 'plant-prep', 'plant-control',
  'hymnal', 'hymnalHold', 'fort',
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
vm.runInContext(between(testHtml, '/*FORT_QUEST_BEGIN*/', '/*FORT_QUEST_END*/') + '\nthis.fortBlank=fortBlank;this.fortLoad=fortLoad;this.fortMet=fortMet;this.fortReduce=fortReduce;this.FORT_YARD_NEED=FORT_YARD_NEED;', sandbox);

test('the fort chapter replaces the single reach step and keeps courier and H-9', () => {
  const ids = sandbox.window.STORY_CONFIG.steps.map((s) => s.id);
  assert.equal(ids.join(','), ORDER.join(','));
  const by = Object.fromEntries(sandbox.window.STORY_CONFIG.steps.map((s) => [s.id, s]));
  assert.equal(by.fort.goal.reach, 'fort');
  assert.equal(by['fort-log'].goal.fort, 'log');
  assert.equal(by['fort-power'].goal.fort, 'power');
  assert.equal(by['fort-power'].target, 'fortPower');
  assert.equal(by['fort-gate'].goal.fort, 'gate');
  assert.equal(by['fort-yard'].onEnter, 'fortYard');
  assert.equal(by['fort-key'].target, 'fortKey');
  assert.equal(by['fort-boss'].goal.fort, 'rifle');
  assert.equal(by['fort-boss'].onEnter, 'fortBoss');
  for (const id of ['fort', 'fort-log', 'fort-power', 'fort-gate', 'fort-yard', 'fort-key', 'fort-boss']) {
    assert.equal(by[id].clock, 'free', id);
  }
  assert.equal(indexHtml.includes('fort-log'), false);
  assert.equal(indexHtml.includes('WORLD_LOOT_BEGIN'), false);
  assert.match(testHtml, /SIDE MISSION/);
  assert.equal(script(testHtml, 'story-runtime').includes("title:'&#9889; SIDE MISSION'"), false);
});

test('fort rules, save migration, and the pistol-only loadout', () => {
  const { fortBlank, fortLoad, fortMet, fortReduce, FORT_YARD_NEED, migrateStoryIdx } = sandbox;
  assert.equal(FORT_YARD_NEED, 4);
  let q = fortBlank();
  assert.equal(fortMet('fort-log', q), false);
  q = fortReduce(q, 'log').q;
  assert.equal(fortMet('fort-log', q), true);
  assert.equal(fortReduce(q, 'rifle').why, 'locked');
  q = fortReduce(q, 'power').q;
  q = fortReduce(q, 'gate').q;
  for (let i = 0; i < 4; i++) q = fortReduce(q, 'yard').q;
  assert.equal(fortMet('fort-yard', q), true);
  q = fortReduce(q, 'key').q;
  q = fortReduce(q, 'boss').q;
  assert.equal(fortMet('fort-boss', q), false);
  const rifle = fortReduce(q, 'rifle');
  assert.equal(rifle.why, 'rifle');
  assert.equal(fortMet('fort-boss', rifle.q), true);
  const kept = fortReduce(rifle.q, 'death');
  assert.equal(kept.q.rifle, true);
  const bossAt = ORDER.indexOf('fort-boss');
  const past = fortLoad(null, ORDER.indexOf('courier-wreck'), bossAt);
  assert.equal(past.rifle, true);
  assert.equal(past.power, true);
  const fresh = fortLoad(null, ORDER.indexOf('fort'), bossAt);
  assert.equal(fresh.log, false);
  assert.equal(fortLoad({ power: 1, yard: 2 }, ORDER.indexOf('fort-yard'), bossAt).yard, 2);

  assert.equal(ORDER[migrateStoryIdx(5, V5.indexOf('fort'))], 'fort');
  assert.equal(ORDER[migrateStoryIdx(5, V5.indexOf('courier-wreck'))], 'courier-wreck');
  assert.equal(ORDER[migrateStoryIdx(5, V5.indexOf('h9-boss'))], 'h9-boss');
  assert.equal(ORDER[migrateStoryIdx(6, ORDER.indexOf('fort-boss'))], 'fort-boss');
  assert.equal(ORDER[migrateStoryIdx(2, 9)], 'fort');

  const save = script(testHtml, 'will-save');
  assert.match(save, /VER=6/);
  assert.match(save, /fortq:window\.FORTQ/);
  assert.match(save, /own:w\.own\?1:0/);
  assert.match(between(testHtml, '/* WORLD_LOOT_BEGIN */', '/* WORLD_LOOT_END */'), /w\.id==='pistol'/);
  assert.match(testHtml, /Grant /);
  assert.match(testHtml, /window\.grantWeapon/);
});

test('new geometry is instanced, unlit, and mirrored in the plot viewer', () => {
  for (const block of ['/* FORT_BREAKER_GEO_BEGIN */', '/* FORT_CHAPTER_GEO_BEGIN */', '/* WORLD_LOOT_BEGIN */']) {
    const end = block.replace('BEGIN', 'END');
    assert.equal(between(testHtml, block, end), between(viewerHtml, block, end));
    const src = between(testHtml, block, end);
    assert.equal(src.includes('new T.PointLight'), false, block);
    assert.equal(src.includes('new T.SpotLight'), false, block);
    assert.equal(src.includes('castShadow=true'), false, block);
  }
  assert.match(viewerHtml, /one\.fortShot/);
  assert.match(between(testHtml, '/* FORT_CHAPTER_GEO_BEGIN */', '/* FORT_CHAPTER_GEO_END */'), /fortBoss/);
  assert.match(between(testHtml, '/* FORT_CHAPTER_GEO_BEGIN */', '/* FORT_CHAPTER_GEO_END */'), /QUARTERMASTER VOSS/);
  assert.match(between(testHtml, '/* WORLD_LOOT_BEGIN */', '/* WORLD_LOOT_END */'), /InstancedMesh/);
  assert.match(between(testHtml, '/* WORLD_LOOT_BEGIN */', '/* WORLD_LOOT_END */'), /smallWood/);
  assert.match(between(testHtml, '/* WORLD_LOOT_BEGIN */', '/* WORLD_LOOT_END */'), /houseCrates/);
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

test('headless new game is pistol-only and the fort chapter pays out the rifle', { timeout: 180000 }, async () => {
  const server = createServer((req, res) => {
    const path = req.url.split('?')[0];
    if (path !== '/test.html' && path !== '/plot-viewer.html') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(path === '/test.html' ? testHtml : viewerHtml);
  });
  const port = await listen(server);
  const profile = mkdtempSync(`${tmpdir()}/dh-fort-`);
  const debug = 9391;
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
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params && msg.params.type === 'error') {
        logs.push(msg.params.args.map((a) => a.value || a.description || '').join(' '));
      }
    };
    const send = (method, params) => new Promise((resolve) => {
      const n = ++id;
      pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
    const evalJs = async (expression) => {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true });
      return res.result && res.result.result && res.result.result.value;
    };
    await send('Runtime.enable', {});
    await send('Page.enable', {});
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/test.html` });
    const deadline = Date.now() + 90000;
    let boot = null;
    const bootExpr = `(() => {
      if (!window.STORY || !window.STORY.cur || !window.FORTQ || !window.GUN_LOOT || !window.HOUSE_CRATES || !window.SMALL_WOOD || !window.WORLD_LOOT) return null;
      const pistol = WP.find(w => w.id === 'pistol');
      return {
        id: STORY.cur.id,
        owned: WP.filter(w => w.own).map(w => w.id),
        mag: pistol && pistol.mag, res: pistol && pistol.res,
        guns: GUN_LOOT.list.map(g => ({ id: g.id, where: g.where, x: +g.x.toFixed(2), z: +g.z.toFixed(2), y: +g.y.toFixed(2) })),
        crates: HOUSE_CRATES.list.map(c => ({ where: c.where, spot: c.spot, plot: c.plot, x: +c.x.toFixed(2), z: +c.z.toFixed(2), y: +c.y.toFixed(2) })),
        wood: SMALL_WOOD.list.map(n => ({ where: n.where, kind: n.kind, plot: n.plot || 0, x: +n.x.toFixed(2), z: +n.z.toFixed(2), amt: n.amt, max: n.max })),
        stats: WORLD_LOOT.stats,
        fort: window.FORT_CHAPTER && { draws: window.FORT_CHAPTER.draws, tris: Math.round(window.FORT_CHAPTER.tris) },
        breaker: window.FORT_BREAKER && window.FORT_BREAKER.draws,
        errs: (window.DH_ERRORS || []).map(e => e.k),
        storyErr: window.STORY_ERROR ? String(window.STORY_ERROR) : '',
        lootErr: window.WORLD_LOOT_ERROR || '',
        fortErr: window.FORT_CHAPTER_ERROR || '',
        calls: (window.ren && ren.info && ren.info.render && ren.info.render.calls) || 0
      };
    })()`;
    while (Date.now() < deadline) {
      boot = await evalJs(bootExpr);
      if (boot && boot.id) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    assert.equal(logs.filter((l) => /SyntaxError|ReferenceError|TypeError/.test(l)).join('\n'), '');
    assert.ok(boot && boot.id, JSON.stringify(boot));
    assert.equal(boot.storyErr, '');
    assert.equal(boot.lootErr, '');
    assert.equal(boot.fortErr, '');
    assert.deepEqual(boot.errs, []);
    assert.deepEqual(boot.owned, ['pistol']);
    assert.equal(boot.mag, 10);
    assert.ok(boot.res >= 60);
    assert.deepEqual(boot.guns.map((g) => g.id), ['revolver', 'shotgun', 'pump', 'smg', 'thompson', 'ak', 'sar']);
    assert.equal(boot.crates.length, 48);
    assert.equal(boot.wood.length, 20);
    assert.ok(boot.wood.every((n) => n.amt === 24 && n.max === 24));
    assert.equal(boot.stats.draws, 3);
    assert.ok(boot.fort.draws > 0 && boot.fort.tris > 0);
    console.log(JSON.stringify({ guns: boot.guns, wood: boot.wood, crates: boot.crates.length, crateSpots: boot.crates.reduce((m, c) => (m[c.spot] = (m[c.spot] || 0) + 1, m), {}), stats: boot.stats, fort: boot.fort, calls: boot.calls }));

    const play = await evalJs(`(() => {
      const FQ = window.FORTQ;
      STORY.goto('fort');
      const kp = nodes.find(n => { try { return String(n.pr()).indexOf('Gate keypad') >= 0; } catch (e) { return false; } });
      if (!foot) exitV();
      pl.set(kp.x, 0, kp.z);
      env(0.05);
      const afterReach = STORY.cur.id;
      FQ.nodes.log.act();
      const afterLog = STORY.cur.id;
      const br = nodes.find(n => { try { return String(n.pr()).indexOf('keycard breaker') >= 0; } catch (e) { return false; } });
      br.act();
      const afterPower = STORY.cur.id;
      FORT_GATE.unlock();
      env(0.05);
      const afterGate = STORY.cur.id;
      const yard = zs.filter(z => z.fortYard && !z.dead);
      yard.forEach(z => { z.hp = 0; killZ(z); });
      const afterYard = STORY.cur.id;
      FQ.nodes.key.act();
      const afterKey = STORY.cur.id;
      FQ.kill();
      FQ.nodes.rifle.act();
      const rifle = WP.find(w => w.id === 'rifle');
      const pistol = WP.find(w => w.id === 'pistol');
      return {
        afterReach, afterLog, afterPower, afterGate, yard: yard.length, afterYard, afterKey,
        afterRifle: STORY.cur.id,
        bossHp: FQ.z && FQ.z.hp, bossSc: FQ.z && FQ.z.sc, bossDead: !!(FQ.z && FQ.z.dead),
        rifleOwn: !!(rifle && rifle.own), rifleDmg: rifle.g.dmg, rifleRange: rifle.g.range,
        pistolDmg: pistol.g.dmg, pistolRange: pistol.g.range,
        owned: WP.filter(w => w.own).map(w => w.id),
        errs: (window.DH_ERRORS || []).map(e => e.k)
      };
    })()`);
    assert.deepEqual(play.errs, []);
    assert.equal(play.afterReach, 'fort-log');
    assert.equal(play.afterLog, 'fort-power');
    assert.equal(play.afterPower, 'fort-gate');
    assert.equal(play.afterGate, 'fort-yard');
    assert.equal(play.yard, 4);
    assert.equal(play.afterYard, 'fort-key');
    assert.equal(play.afterKey, 'fort-boss');
    assert.equal(play.bossDead, true);
    assert.equal(play.bossSc, 1.75);
    assert.equal(play.afterRifle, 'courier-wreck');
    assert.equal(play.rifleOwn, true);
    assert.ok(play.rifleDmg > play.pistolDmg);
    assert.ok(play.rifleRange > play.pistolRange);
    assert.deepEqual(play.owned, ['pistol', 'rifle']);
    globalThis.__FORT_BOOT = { guns: boot.guns, crates: boot.crates, wood: boot.wood, stats: boot.stats, fort: boot.fort, calls: boot.calls };
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});
