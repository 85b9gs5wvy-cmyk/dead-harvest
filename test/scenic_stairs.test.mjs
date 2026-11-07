/**
 * Sawmill booth stairs and Ridgeline site-office stairs.
 * Scripted only: this loads the shared stair spec from the test pages in Node
 * and steps a point with the same floor rule as step(). It does not click
 * through the game and it is not a manual walk.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, ROOT), 'utf8');
const pages = ['test.html', 'campaign-test.html', 'functional-test.html'];
const INDEX_SHA = 'ec826263e621833f1dc39d581e3f7ac037095442764207e93017ef67bb13b3b6';

function between(html, start, end) {
  const i = html.indexOf(start);
  assert.ok(i >= 0, start);
  const j = html.indexOf(end, i + start.length);
  assert.ok(j > i, end);
  return html.slice(i, j);
}

function loadScenic(html) {
  const src = between(html, '/* SCENIC_STAIR_BEGIN */', '/* SCENIC_STAIR_END */');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.DH_SCENIC;
}

function overlap(a0, a1, b0, b1) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function floorY(surfs, x, z, py) {
  let b = 0;
  for (const s of surfs) {
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    if (s.y <= py + 0.7 && s.y > b) b = s.y;
  }
  return b;
}

function push(p, b) {
  if (b.y0 !== undefined && !(p.y < b.y1 && p.y + 1.8 > b.y0)) return;
  const dx = p.x - b.x, dz = p.z - b.z, r = 0.4;
  const ox = b.hw + r - Math.abs(dx), oz = b.hd + r - Math.abs(dz);
  if (ox > 0 && oz > 0) {
    if (ox < oz) p.x += Math.sign(dx || 1) * ox;
    else p.z += Math.sign(dz || 1) * oz;
  }
}

/** Same vertical integration as step(): up to 12*dt, down to 14*dt. */
function climb(surfs, boxes, x0, z0, x1, z1) {
  const p = { x: x0, y: 0, z: z0 };
  for (let i = 0; i < 900; i++) {
    const dx = x1 - p.x, dz = z1 - p.z, d = Math.hypot(dx, dz) || 1;
    const st = Math.min(0.05, d);
    p.x += (dx / d) * st;
    p.z += (dz / d) * st;
    for (const b of boxes) push(p, b);
    const ty = floorY(surfs, p.x, p.z, p.y);
    const dt = 0.05;
    p.y = ty > p.y ? Math.min(ty, p.y + 12 * dt) : Math.max(ty, p.y - 14 * dt);
    if (d < 0.08 && Math.abs(p.y - ty) < 0.03) break;
  }
  return p;
}

test('index.html is unchanged and still has the old stair lines', () => {
  const index = read('index.html');
  assert.equal(createHash('sha256').update(index).digest('hex'), INDEX_SHA);
  assert.equal(index.includes('SCENIC_STAIR_BEGIN'), false);
  assert.equal(index.includes('Z+.7-i*0'), true);
  assert.equal(index.includes('jS([.15,-.02],[2.55,2.54],z)'), true);
});

test('the three test pages share one stair spec, mesh emit, and floor hook', () => {
  const scenic = pages.map((n) => between(read(n), '/* SCENIC_STAIR_BEGIN */', '/* SCENIC_STAIR_END */'));
  const emit = pages.map((n) => between(read(n), '/* SCENIC_STAIR_END */', '// === JIM FIX END: 5a-stairs ==='));
  const quarry = pages.map((n) => between(read(n), '{const S=window.DH_SCENIC,L=S.land;', 'qSign(X,Z+1.24'));
  const floor = pages.map((n) => between(read(n), 'function floorAt_o(px,pz,py){', 'function renderMenu(){'));
  for (const group of [scenic, emit, quarry, floor]) {
    assert.equal(group[0], group[1]);
    assert.equal(group[0], group[2]);
  }
  for (const name of pages) {
    const html = read(name);
    assert.equal(html.includes('Z+.7-i*0'), false);
    assert.equal(html.includes('jS([-4.95,-.16],[-2.25,2.54],z)'), true);
    assert.equal(html.includes('sb(mBu,-1.6,2.6,-3.2,2.8,.2,2.8)'), true);
    assert.equal(html.includes('qb(mWh,X,1.3,Z,6,2.6,2.4)'), true);
    assert.equal(html.includes('qb(mGr,X-.4,3.9,Z,6,2.6,2.4)'), true);
  }
});

test('sawmill flight meets the booth floor and the ground, and the feet can climb it', () => {
  const S = loadScenic(read('test.html'));
  const slab = { x0: -3, x1: -0.2, y0: 2.5, y1: 2.7, z0: -4.6, z1: -1.8 };
  const tops = S.saw.map((t) => ({
    x0: t.x - t.w / 2, x1: t.x + t.w / 2,
    z0: t.z - t.d / 2, z1: t.z + t.d / 2,
    top: t.y + t.h / 2, bot: t.y - t.h / 2,
  }));
  const top = tops[tops.length - 1];
  assert.ok(overlap(top.x0, top.x1, slab.x0, slab.x1) >= 0.5);
  assert.ok(overlap(top.z0, top.z1, slab.z0, slab.z1) >= 0.2);
  assert.ok(Math.abs(top.top - slab.y1) < 0.02);
  for (let i = 1; i < tops.length; i++) {
    const gap = tops[i].z1 - tops[i - 1].z0;
    assert.ok(Math.abs(gap) < 0.02, 'plan gap ' + gap);
    const rise = tops[i].top - tops[i - 1].top;
    assert.ok(rise > 0.05 && rise < 0.45);
  }
  for (const s of S.sawStr) {
    const [x, , y0, z1, y1] = s;
    assert.ok(y0 <= 0);
    assert.ok(x > slab.x0 && x < slab.x1 && z1 > slab.z0 && z1 < slab.z1 && y1 > slab.y0 && y1 < slab.y1);
  }
  const SMX = 50, SMZ = -505;
  const x = SMX + S.saw[0].x;
  const under = floorY(S.surfs, SMX - 1.6, SMZ - 3.2, 0);
  assert.equal(under, 0);
  const climbed = climb(S.surfs, [], x, SMZ - 0.05, x, SMZ - 2.6);
  assert.ok(Math.abs(climbed.x - x) < 0.05);
  assert.ok(climbed.y > 2.6, 'scripted climb y ' + climbed.y);
});

test('quarry office flight is a run of treads onto the container roof, not a vertical stack', () => {
  const S = loadScenic(read('test.html'));
  const X = 31.5, Z = -14.5;
  const lower = { x0: X - 3, x1: X + 3, z0: Z - 1.2, z1: Z + 1.2, top: 2.6 };
  const upperEast = (X - 0.4) + 3;
  const treads = S.qt.map((t) => ({
    x0: t.x - t.w / 2, x1: t.x + t.w / 2,
    z0: t.z - t.d / 2, z1: t.z + t.d / 2,
    top: t.top, bot: t.y - t.h / 2,
  })).sort((a, b) => a.top - b.top);
  const zs = new Set(treads.map((t) => t.z0.toFixed(3)));
  assert.equal(zs.size, treads.length);
  assert.ok(treads[0].bot <= 0.05);
  for (let i = 1; i < treads.length; i++) {
    const gap = treads[i - 1].z0 - treads[i].z1;
    assert.ok(Math.abs(gap) < 0.02, 'plan gap ' + gap);
    const rise = treads[i].top - treads[i - 1].top;
    assert.ok(rise > 0.05 && rise < 0.45);
  }
  const land = {
    x0: S.land.x - S.land.w / 2, x1: S.land.x + S.land.w / 2,
    z0: S.land.z - S.land.d / 2, z1: S.land.z + S.land.d / 2,
    top: S.land.top,
  };
  assert.ok(overlap(land.x0, land.x1, lower.x0, lower.x1) >= 0.2);
  assert.ok(overlap(land.z0, land.z1, lower.z0, lower.z1) >= 0.8);
  assert.ok(Math.abs(land.top - lower.top) <= 0.03);
  assert.ok(land.x0 <= upperEast + 0.02);
  const high = treads[treads.length - 1];
  assert.ok(overlap(high.x0, high.x1, land.x0, land.x1) >= 0.5);
  assert.ok(overlap(high.z0, high.z1, land.z0, land.z1) >= 0.08);
  assert.ok(land.top - high.top < 0.45);
  for (const s of S.qStr) {
    const [x, , y0, z1, y1] = s;
    assert.ok(y0 <= 0);
    assert.ok(x > land.x0 && x < land.x1 && z1 > land.z0 && z1 < land.z1 && y1 > S.land.y - S.land.h / 2 && y1 < S.land.top);
  }
  const QX = -55, QZ = -505;
  const boxes = S.office.map((b) => ({ x: QX + b.x, z: QZ + b.z, hw: b.hw, hd: b.hd, y0: b.y0, y1: b.y1 }));
  // East perimeter fence beside the office. The flight has to stay inside it.
  boxes.push({ x: QX + 38, z: QZ - 13.75, hw: 0.2, hd: 6.3 });
  const x = QX + S.qt[0].x;
  const climbed = climb(S.surfs, boxes, x, QZ - 10.6, x, QZ - 14.3);
  assert.ok(climbed.y > 2.5, 'scripted climb y ' + climbed.y);
  assert.ok(Math.abs(climbed.x - x) < 0.15, 'pushed to ' + climbed.x);
  assert.ok(climbed.z < QZ - 14);
});
