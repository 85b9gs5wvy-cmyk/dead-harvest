/**
 * DH-SALLY-004 — vehicle death must stay at the farm respawn, and reach
 * goals must use the active position (car while driving, feet on foot).
 *
 * Runtime is assisted instrumented browser execution: Chrome loads the page
 * and an injected classic script calls hurt, carStep, zTick, step, env, and
 * _frame. Pointer lock is not used.
 *
 * test.html is executed. campaign-test.html and functional-test.html must
 * carry the same patched snippets; index.html and plot-viewer.html stay on
 * the pre-fix goal and death lines.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, ROOT), 'utf8');
const PAGES = ['test.html', 'campaign-test.html', 'functional-test.html'];
const html = Object.fromEntries(PAGES.map((n) => [n, read(n)]));
const indexHtml = read('index.html');
const viewerHtml = read('plot-viewer.html');
const INDEX_SHA = 'ec826263e621833f1dc39d581e3f7ac037095442764207e93017ef67bb13b3b6';

const DEATH_SNAP = 'if(foot)farmSpawn();else{if(drv){drv.x=0;drv.z=18;drv.spd=0;drv.steer=0}spd=0;car.position.set(0,pitH(0,18),18);window.__vehRsp=1}';
const DRIVE_SNAP = 'if(drv!==v){window.__vehRsp=0;return}if(window.__vehRsp){window.__vehRsp=0;v.x=0;v.z=18;v.spd=0;v.steer=0;spd=0}spd=v.spd;';
const EXIT_CLEAR = 'function exitV(){if(window.__vehRsp)window.__vehRsp=0;const v=drv;if(!v)return;';
const REACHED = "const actP=()=>!foot&&typeof car!=='undefined'&&car?car.position:pl;const reached=(t,r)=>{const p=place(t);const q=actP();return p&&Math.hypot(q.x-p.x,q.z-p.z)<r};";
const METER = "Math.hypot(S.tgt.x-actP().x,S.tgt.z-actP().z)";
const SAVE_FIELDS = 'willRsp:window.__willRsp?1:0,willRspNote:window.__willRspNote?1:0';
const LOAD_FIELDS = 'window.__willRsp=d.willRsp?1:0;window.__willRspNote=d.willRspNote?1:0;';
const OLD_DEATH = 'if(foot)farmSpawn();else car.position.set(0,0,18);';
const OLD_REACHED = 'const reached=(t,r)=>{const p=place(t);return p&&Math.hypot(pl.x-p.x,pl.z-p.z)<r};';
const GUARD = 'if(!reached(g.reach,r))window.__willRsp=0;else if(S.cur&&S.cur.id===\'return\'&&!(carry.w+carry.s+carry.m>0))';

function scriptsOf(text) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(text))) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    if (m[2].trim()) out.push(m[2]);
  }
  return out;
}

test('patched death, reach, and save snippets match on the three test pages', () => {
  for (const name of PAGES) {
    const src = html[name];
    for (const piece of [DEATH_SNAP, DRIVE_SNAP, EXIT_CLEAR, REACHED, METER, SAVE_FIELDS, LOAD_FIELDS, GUARD]) {
      assert.equal(src.includes(piece), true, name + ' missing ' + piece.slice(0, 70));
    }
    assert.equal(src.includes(OLD_DEATH), false, name);
    assert.equal(src.includes(OLD_REACHED), false, name);
    assert.equal(src.includes('r+50'), false, name);
  }
  assert.equal(html['test.html'].includes(DEATH_SNAP), true);
  assert.equal(html['campaign-test.html'].includes(DEATH_SNAP), html['test.html'].includes(DEATH_SNAP));
  assert.equal(html['functional-test.html'].includes(REACHED), html['test.html'].includes(REACHED));
  assert.equal(html['test.html'].match(/const goalMet=s=>[\s\S]*?\n/)[0], html['campaign-test.html'].match(/const goalMet=s=>[\s\S]*?\n/)[0]);
  assert.equal(html['test.html'].match(/const goalMet=s=>[\s\S]*?\n/)[0], html['functional-test.html'].match(/const goalMet=s=>[\s\S]*?\n/)[0]);
});

test('test pages keep their own save keys and startup defaults', () => {
  assert.match(html['test.html'], /KEY='dhSaveTest',VKEY='dhSaveVerTest'/);
  assert.match(html['test.html'], /localStorage\.getItem\('dhGfxTest'\)/);
  assert.match(html['campaign-test.html'], /KEY='dhSaveHarness',VKEY='dhSaveVerHarness'/);
  assert.match(html['campaign-test.html'], /localStorage\.getItem\('dhGfxHarness'\)/);
  assert.match(html['campaign-test.html'], /else\{qi=3\}/);
  assert.match(html['functional-test.html'], /KEY='dhSaveFunctional',VKEY='dhSaveVerFunctional'/);
  assert.match(html['functional-test.html'], /localStorage\.getItem\('dhGfxFunctional'\)/);
  assert.doesNotMatch(html['test.html'], /dhSaveHarness|dhSaveFunctional|dhGfx2/);
  assert.doesNotMatch(html['campaign-test.html'], /dhSaveTest|dhSaveFunctional/);
  assert.doesNotMatch(html['functional-test.html'], /dhSaveTest|dhSaveHarness/);
});

test('production index and the plot viewer keep the pre-fix death and reach lines', () => {
  assert.equal(createHash('sha256').update(indexHtml).digest('hex'), INDEX_SHA);
  for (const src of [indexHtml, viewerHtml]) {
    assert.equal(src.includes(OLD_DEATH), true);
    assert.equal(src.includes(OLD_REACHED), true);
    assert.equal(src.includes('__vehRsp'), false);
    assert.equal(src.includes('const actP='), false);
    assert.equal(src.includes(SAVE_FIELDS), false);
  }
  assert.match(indexHtml, /if\(!reached\(g\.reach,r\+50\)\)window\.__willRsp=0/);
  assert.doesNotMatch(indexHtml, /dhSaveTest|dhSaveHarness|dhSaveFunctional|__willRspNote/);
});

test('inline scripts on the three test pages still parse', () => {
  for (const name of PAGES) {
    const bodies = scriptsOf(html[name]);
    assert.ok(bodies.length >= 5, name + ' scripts ' + bodies.length);
    bodies.forEach((code, i) => {
      try { new vm.Script(code, { filename: name + '#' + i }); }
      catch (e) { assert.fail(name + ' script ' + i + ' ' + e.message); }
    });
  }
});

test('death while driving sticks, reach uses the driven position, Continue keeps the guard', { timeout: 180000 }, async () => {
  const server = createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0].slice(1));
    if (!html[name]) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html[name]);
  });
  const port = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
  const profile = mkdtempSync(tmpdir() + '/dh-vdg-');
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=9341', '--remote-allow-origins=*',
    '--window-size=1280,720', 'about:blank',
  ], { stdio: 'ignore' });
  let ws;
  try {
    const list = await waitForList();
    const page = list.find((t) => t.type === 'page') || list[0];
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    const logs = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
      if (msg.method === 'Runtime.exceptionThrown') logs.push(String(msg.params.exceptionDetails && msg.params.exceptionDetails.text || 'exception'));
    };
    const send = (method, params) => new Promise((resolve) => {
      const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params }));
    });
    await send('Runtime.enable', {});
    await send('Page.enable', {});
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.dhPaused=true' });
    const report = await runPage(send, port, 'test.html');
    assert.equal(report.pointerLock, false);
    assert.deepEqual(report.fails, [], JSON.stringify({ fails: report.fails, trace: report.trace, logs }, null, 2).slice(0, 8000));
    assert.equal(report.continue.will, 1);
    assert.ok(Math.hypot(report.continue.pl.x - 0, report.continue.pl.z - 18) < 0.2, JSON.stringify(report.continue));
    assert.equal(report.continue.foot, true);
    assert.equal(report.continue.story, 'return');
    assert.equal(report.continue.menu, false);
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});

async function runPage(send, port, name) {
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/${name}?vdg=1` });
  const deadline = Date.now() + 90000;
  let state = {};
  while (Date.now() < deadline) {
    const res = await send('Runtime.evaluate', {
      expression: '({hurt:typeof hurt==="function",step:typeof carStep==="function",veh:typeof VEH!=="undefined"?VEH.length:0,story:!!(window.STORY&&STORY.cur)})',
      returnByValue: true,
    });
    state = res.result && res.result.result && res.result.result.value || {};
    if (state.hurt && state.step && state.veh >= 3 && state.story) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  assert.equal(state.hurt && state.story && state.veh >= 3, true, name + ' boot ' + JSON.stringify(state));
  await send('Runtime.evaluate', { expression: 'window.dhPaused=true', returnByValue: true });
  const injected = await send('Runtime.evaluate', { expression: INJECT, returnByValue: true });
  if (injected.result && injected.result.exceptionDetails) {
    assert.fail(injected.result.exceptionDetails.text + ' ' + (injected.result.exceptionDetails.exception && injected.result.exceptionDetails.exception.description || ''));
  }
  const read = await send('Runtime.evaluate', { expression: 'window.__VDG', returnByValue: true });
  const probe = read.result && read.result.result && read.result.result.value;
  assert.ok(probe && !probe.error, JSON.stringify(probe && (probe.error || probe)).slice(0, 2000));
  await send('Page.reload', { ignoreCache: true });
  const again = Date.now() + 90000;
  let menu = {};
  while (Date.now() < again) {
    const res = await send('Runtime.evaluate', {
      expression: '({hurt:typeof hurt==="function",menu:!!document.getElementById("willCont"),story:!!(window.STORY&&STORY.cur)})',
      returnByValue: true,
    });
    menu = res.result && res.result.result && res.result.result.value || {};
    if (menu.hurt && menu.story && menu.menu) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  assert.equal(menu.menu, true, 'Continue menu missing ' + JSON.stringify(menu));
  await send('Runtime.evaluate', {
    expression: "document.getElementById('willCont').dispatchEvent(new MouseEvent('click',{bubbles:true}))",
    returnByValue: true,
  });
  await new Promise((r) => setTimeout(r, 300));
  await send('Runtime.evaluate', { expression: 'window.dhPaused=true', returnByValue: true });
  const cont = await send('Runtime.evaluate', {
    expression: `(() => { const s=document.createElement('script'); s.textContent=${JSON.stringify(CONT)}; document.documentElement.appendChild(s); s.remove(); return window.__VDG_CONT; })()`,
    returnByValue: true,
  });
  probe.continue = cont.result && cont.result.result && cont.result.result.value;
  probe.pointerLock = probe.pointerLock === true;
  return probe;
}

async function waitForList() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch('http://127.0.0.1:9341/json/list');
      if (res.ok) {
        const list = await res.json();
        if (list.length) return list;
      }
    } catch { /* chrome still starting */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('chrome debug port not ready');
}

const CONT = `window.__VDG_CONT={foot:!!foot,will:window.__willRsp||0,note:window.__willRspNote||0,pl:{x:pl.x,y:pl.y,z:pl.z},drv:drv?drv.S.n:null,story:window.STORY&&STORY.cur&&STORY.cur.id,menu:!!document.getElementById('willSaveMenu'),carry:(carry.w||0)+(carry.s||0)+(carry.m||0)};`;

const PROBE = `
window.__VDG = (function(){
  const fails = [], trace = {};
  const num = (v) => Math.round(v * 1000) / 1000;
  const near = (p, x, z, e) => !!p && Math.abs(p.x - x) < (e || 0.08) && Math.abs(p.z - z) < (e || 0.08);
  function snap(){
    const v = drv;
    return { foot:!!foot, pHP:num(pHP), will:window.__willRsp||0, flag:window.__vehRsp||0,
      pl:{x:num(pl.x),y:num(pl.y),z:num(pl.z)},
      car:{x:num(car.position.x),y:num(car.position.y),z:num(car.position.z)},
      drv:v?{n:v.S.n,t:v.t,x:num(v.x),z:num(v.z),spd:num(v.spd)}:null };
  }
  function check(ok, msg, extra){ if(!ok) fails.push(extra ? msg + ' ' + JSON.stringify(extra) : msg); }
  function clearInput(){
    for (const k of ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight']) K[k]=false;
    gasBtn=0; revBtn=0; JX=0; JY=0; btnBrake=false;
  }
  function placeDrive(v, x, z){
    clearInput();
    if (foot || drv !== v) enterV(v);
    v.x=x; v.z=z; v.h=0; v.spd=0; v.steer=0; spd=0;
    carStep(0.05); vTick(0.05);
  }
  function atFarm(s){ return near(s.car,0,18) && near(s.drv,0,18) && s.foot===false && s.pHP===100 && s.will===1; }
  function shownM(text){ const m=String(text||'').match(/(\\d+) m/); return m?+m[1]:null; }
  try {
    window.dhPaused = true; ADM.god = false; clearInput();
    trace.pointerLock = !!document.pointerLockElement;
    const carV = VEH.find(v => v.t==='car' && v.S.n==='Car');
    const bikeV = VEH.find(v => v.t==='motorbike' && v.S.n==='Motorbike');
    const busV = VEH.find(v => v.S && String(v.S.n).indexOf('School Bus')>=0);
    check(!!carV && !!bikeV && !!busV, 'vehicle types', VEH.map(v=>v.S.n));
    if (!foot) exitV();
    const veh0 = VEH.map(v => v.S.n + ':' + num(v.x) + ',' + num(v.z));
    pl.set(400, 0, -800);
    pHP = 8; window.__willRsp = 0; window.__willRspNote = 0;
    hurt(40);
    const footNow = snap();
    step(0.05);
    const footAfter = snap();
    const veh1 = VEH.map(v => v.S.n + ':' + num(v.x) + ',' + num(v.z));
    trace.foot = { footNow, footAfter };
    check(footNow.foot===true && near(footNow.pl, FS.x, FS.z) && near(footAfter.pl, FS.x, FS.z), 'on-foot death stays at farm spawn', trace.foot);
    check(footNow.drv===null && veh0.join('|')===veh1.join('|'), 'on-foot death moves a vehicle', {veh0, veh1});
    check(footNow.will===1, 'on-foot death sets the return guard');

    function dieFar(v, x, z){
      placeDrive(v, x, z);
      pl.set(400, 0, -800);
      carry.w = carry.s = carry.m = 0;
      pHP = 8; window.__willRsp = 0; window.__willRspNote = 0;
      const before = snap();
      hurt(40);
      const immediate = snap();
      carStep(0.05); vTick(0.05);
      const after = snap();
      window.dhPaused = false; try { clock.getDelta(); } catch (e) {}
      _frame();
      window.dhPaused = true;
      const frame = snap();
      return { before, immediate, after, frame };
    }
    trace.car = dieFar(carV, 250, -600);
    trace.car2 = dieFar(carV, 180, -420);
    trace.bike = dieFar(bikeV, 220, -640);
    trace.bus = dieFar(busV, 260, -580);
    for (const [k, exp] of [['car','Car'],['car2','Car'],['bike','Motorbike'],['bus','District 7 School Bus #16']]) {
      const row = trace[k];
      check(row.before.drv && row.before.drv.n===exp && !near(row.before.car,0,18), k+' setup', row.before);
      check(atFarm(row.immediate) && row.immediate.flag===1, k+' immediate farm', row.immediate);
      check(atFarm(row.after) && row.after.flag===0, k+' after carStep', row.after);
      check(atFarm(row.frame) && row.frame.flag===0, k+' after _frame', row.frame);
      check(row.immediate.drv.n===exp && row.frame.drv.n===exp, k+' still that vehicle', row.frame.drv);
    }

    {
      const wall = { x:80, z:40, hw:4, hd:4, y0:0, y1:5 };
      boxes.push(wall);
      clearInput(); enterV(carV);
      carV.hp = carV.S.hp; carV.fb = carV.fmax;
      carV.x = 96; carV.z = 40; carV.h = Math.PI/2; carV.spd = 18; spd = 18;
      pHP = 1; window.__willRsp = 0; window.__vehRsp = 0;
      let steps = 0;
      while (steps < 50 && pHP < 50) { carStep(0.05); steps++; }
      vTick(0.05);
      trace.crash = { steps, pos: snap(), hp: num(carV.hp) };
      const wi = boxes.indexOf(wall); if (wi>=0) boxes.splice(wi, 1);
      check(steps>0 && steps<50, 'crash never called a killing hurt', trace.crash);
      check(atFarm(trace.crash.pos) && trace.crash.pos.flag===0, 'crash death stayed at the impact', trace.crash);
      check(trace.crash.hp < carV.S.hp, 'crash did not damage the car', trace.crash);
    }

    {
      placeDrive(carV, 300, -700);
      pHP = 8; window.__willRsp = 0;
      const z = addZ(car.position.x, car.position.z, null, false, null);
      z.dmg = 80; z.cd = 0; z.al = true;
      zTick(0.05);
      const immediate = snap();
      carStep(0.05);
      const after = snap();
      trace.zombie = { immediate, after };
      try { rmZ(z); } catch (e) {}
      check(atFarm(immediate) && immediate.flag===1 && atFarm(after) && after.flag===0, 'zombie death while driving', trace.zombie);
    }

    function obj(){ const el=document.getElementById('sObj'); return el ? el.textContent : ''; }
    function pulse(){
      const id0 = STORY.cur.id, idx0 = STORY.idx, w0 = window.__willRsp||0;
      env(0.016);
      return { id0, id1: STORY.cur.id, advanced: STORY.idx!==idx0, will0:w0, will1:window.__willRsp||0, obj:obj(), s:snap() };
    }
    if (!foot) exitV();
    pl.set(12.6, 0, 18); window.__willRsp = 0; carry.w=carry.s=carry.m=0;
    STORY.goto('return');
    trace.footIn = pulse();
    check(trace.footIn.advanced && shownM(trace.footIn.obj)===Math.round(Math.hypot(12.6-10,0)), 'on foot inside return', trace.footIn);

    pl.set(400, 0, -800); window.__willRsp = 0;
    STORY.goto('return');
    trace.footOut = pulse();
    check(!trace.footOut.advanced && shownM(trace.footOut.obj)===Math.round(Math.hypot(400-10,-800-18)), 'on foot outside return', trace.footOut);

    placeDrive(carV, 10, 18); pl.set(400, 0, -800); window.__willRsp = 0; carry.w=carry.s=carry.m=0;
    STORY.goto('return');
    trace.driveIn = pulse();
    check(trace.driveIn.advanced && trace.driveIn.s.foot===false && shownM(trace.driveIn.obj)===Math.round(Math.hypot(trace.driveIn.s.car.x-10, trace.driveIn.s.car.z-18)) && Math.hypot(trace.driveIn.s.pl.x-10, trace.driveIn.s.pl.z-18)>30, 'driving inside uses feet', trace.driveIn);

    placeDrive(carV, 250, -600); pl.set(12.6, 0, 18); window.__willRsp = 0;
    STORY.goto('return');
    trace.driveOut = pulse();
    check(!trace.driveOut.advanced && shownM(trace.driveOut.obj)===Math.round(Math.hypot(trace.driveOut.s.car.x-10, trace.driveOut.s.car.z-18)) && Math.hypot(trace.driveOut.s.pl.x-10, trace.driveOut.s.pl.z-18)<30 && Math.hypot(trace.driveOut.s.car.x-10, trace.driveOut.s.car.z-18)>30, 'driving away completes from feet', trace.driveOut);

    const kp = nodes.find(n => { try { return String(n.pr()).indexOf('Gate keypad')>=0; } catch(e){ return false; } });
    check(!!kp, 'no gate keypad');
    if (kp) {
      if (!foot) exitV();
      pl.set(kp.x, 0, kp.z); window.__willRsp = 0;
      STORY.goto('fort');
      trace.footFort = pulse();
      check(trace.footFort.advanced, 'on foot at fort', trace.footFort);

      placeDrive(carV, kp.x, kp.z); pl.set(400, 0, -800); window.__willRsp = 0;
      STORY.goto('fort');
      trace.driveFort = pulse();
      trace.driveFort.dist = num(Math.hypot(car.position.x-kp.x, car.position.z-kp.z));
      check(trace.driveFort.advanced && trace.driveFort.dist < 7 && shownM(trace.driveFort.obj)===Math.round(trace.driveFort.dist) && Math.hypot(trace.driveFort.s.pl.x-kp.x, trace.driveFort.s.pl.z-kp.z)>30, 'driving onto fort', trace.driveFort);

      placeDrive(carV, 250, -600); pl.set(kp.x, 0, kp.z); window.__willRsp = 0;
      STORY.goto('fort');
      trace.driveFortAway = pulse();
      check(!trace.driveFortAway.advanced, 'fort completes from feet while driving away', trace.driveFortAway);
    }

    placeDrive(carV, 250, -600); pl.set(400, 0, -800); carry.w=carry.s=carry.m=0;
    pHP = 8; window.__willRsp = 0; window.__willRspNote = 0;
    hurt(40); carStep(0.05);
    STORY.goto('return');
    trace.guardEmpty = pulse();
    check(!trace.guardEmpty.advanced && trace.guardEmpty.will1===1 && near(trace.guardEmpty.s.car,0,18), 'empty vehicle death bypasses return guard', trace.guardEmpty);

    placeDrive(carV, 250, -600); window.__willRsp = trace.guardEmpty.will1;
    trace.guardLeave = pulse();
    check(!trace.guardLeave.advanced && trace.guardLeave.will1===0, 'leaving the circle clears the guard', trace.guardLeave);
    placeDrive(carV, 10, 18);
    trace.guardBack = pulse();
    check(trace.guardBack.advanced && trace.guardBack.will0===0, 'driving back in completes empty', trace.guardBack);

    STORY.goto('return');
    placeDrive(carV, 250, -600); pl.set(400,0,-800); carry.w=1; carry.s=carry.m=0;
    pHP=8; window.__willRsp=0;
    hurt(40); carStep(0.05);
    STORY.goto('return');
    trace.guardHaul = pulse();
    check(trace.guardHaul.advanced && trace.guardHaul.will1===0, 'haul still clears a vehicle death inside the circle', trace.guardHaul);

    if (!foot) exitV();
    pl.set(400, 0, -800); carry.w=carry.s=carry.m=0; pHP=8; window.__willRsp=0;
    hurt(40);
    STORY.goto('return');
    trace.footGuard = pulse();
    check(!trace.footGuard.advanced && trace.footGuard.will1===0 && near(trace.footGuard.s.pl, FS.x, FS.z), 'on-foot death outside still clears the guard', trace.footGuard);
    pl.set(10, 0, 18);
    trace.footWalk = pulse();
    check(trace.footWalk.advanced, 'on-foot walk-in still completes', trace.footWalk);

    STORY.goto('return');
    placeDrive(carV, 250, -600); pl.set(400,0,-800); carry.w=carry.s=carry.m=0;
    pHP=8; window.__willRsp=0; window.__willRspNote=0;
    hurt(40); carStep(0.05); vTick(0.05);
    STORY.goto('return');
    trace.preSave = snap();
    const saved = !!(window.dhSave && dhSave.save('manual'));
    const raw = dhSave.read();
    trace.save = { saved, pl: raw && raw.pl, will: raw && raw.willRsp, note: raw && raw.willRspNote, idx: raw && raw.story && raw.story.idx };
    check(saved && near(raw.pl, 0, 18) && raw.willRsp===1 && raw.story.idx===STORY.cfg.steps.findIndex(s=>s.id==='return'), 'save stored the farm respawn and the guard', trace.save);
    trace.pointerLock = !!document.pointerLockElement;
  } catch (e) {
    return { fails: fails.concat(['threw '+(e&&e.stack||e)]), trace, error: String(e&&e.stack||e), pointerLock: !!document.pointerLockElement };
  }
  return { fails, trace, pointerLock: !!document.pointerLockElement };
})();
`;

const INJECT = `(function(){const s=document.createElement('script');s.textContent=${JSON.stringify(PROBE)};document.documentElement.appendChild(s);s.remove();return true;})()`;
