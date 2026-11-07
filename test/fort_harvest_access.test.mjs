/**
 * Fort Harvest (plot 22) access checks. Code-verified only: this file loads
 * the builders from test.html in Node. It does not open a browser.
 *
 * Shared builders are compared with index.html so a Fort-only floor wrapper
 * cannot silently change makeModel2 or floorAt0.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, ROOT), 'utf8');
const INDEX_MD5 = '845ea6d9dfde1776ac0b5dc52ba8e31f';
const FH = 4;
const RAD = 0.4;

function between(text, start, end, from = 0) {
  const s = text.indexOf(start, from);
  assert.ok(s >= 0, start);
  const e = text.indexOf(end, s + start.length);
  assert.ok(e > s, end);
  return text.slice(s, e);
}

function buildMilb(html) {
  const lines = html.split('\n');
  const slice = (start, end, fromLine) => {
    let s = -1;
    for (let i = fromLine; i < lines.length; i++) if (lines[i].includes(start)) { s = i; break; }
    assert.ok(s >= 0, start);
    let e = -1;
    for (let i = s + 1; i < lines.length; i++) if (lines[i].includes(end)) { e = i; break; }
    assert.ok(e > s, end);
    return lines.slice(s, e).join('\n');
  };
  const mm = slice('function makeModel2(s){', 'const APTM=', 49000).replace(
    'glass:!!DR.glass}}}',
    'glass:!!DR.glass},_B:B}}'
  );
  const milx = slice('const MILX=(()=>{', 'const MILB=makeModel2', 50000);
  const milb = slice('const MILB=makeModel2({w:36', 'MILB.name=', 50000);
  const access = between(html, '/* FORT_ACCESS_BEGIN */', '/* FORT_ACCESS_END */');
  const sb = {
    Object, Array, Math, Number, String, Boolean, JSON, console, isNaN, parseInt, undefined,
    FH, sr: () => 0.2, R: (a, b) => (a + b) / 2, window: {},
    M2: new Proxy({}, { get: () => ({}) }), mSpill: {}, tex: () => ({}),
    mergeBoxes: () => ({}), wt2: () => ({}),
    jimSignGeo: () => ({ attributes: { uv: { count: 0, setXY() {}, getX: () => 0, getY: () => 0 } }, translate() { return this; } }),
    T: {}
  };
  class Geo {
    constructor() { this.attributes = { uv: { count: 1, setXY() {}, getX: () => 0, getY: () => 0 } }; }
    translate() { return this; } rotateX() { return this; } rotateY() { return this; }
  }
  class Obj { constructor() { this.position = { set() {} }; this.rotation = {}; this.children = []; } add() {} }
  sb.T.BoxGeometry = Geo; sb.T.PlaneGeometry = Geo; sb.T.TorusGeometry = Geo;
  sb.T.Group = Obj; sb.T.Mesh = Obj; sb.T.MeshStandardMaterial = class {}; sb.T.MeshBasicMaterial = class {};
  vm.createContext(sb);
  vm.runInContext(`${mm}\nthis.makeModel2=makeModel2;\n${milx}\nthis.MILX=MILX;\n${milb}\nthis.MILB=MILB;\n${access}\nthis.fortAccess=fortAccess;`, sb);
  return sb;
}

function rampH(r, lx) {
  const span = r.x1 - r.x0;
  return (r.y0 !== undefined ? r.y0 : r.k * FH) + (r.dir < 0 ? (r.x1 - lx) : (lx - r.x0)) / span * (r.h !== undefined ? r.h : FH);
}

/** floorAt0 for one building placed at the origin, before the Fort wrapper. */
function baseFloor(m, lx, lz, py) {
  if (Math.abs(lx) > m.hw || Math.abs(lz) > m.hd) return 0;
  const c = [0.06];
  for (let k = 1; k < m.lv; k++) {
    const r = m.ramps[k - 1];
    if (!(lx > r.x0 - 0.05 && lx < r.x1 + 0.05 && lz > r.z0 - 0.05 && lz < r.z1 + 0.05)) c.push(k * FH);
  }
  for (const r of m.ramps) {
    if (!r.hole && lx >= r.x0 && lx <= r.x1 && lz >= r.z0 && lz <= r.z1) c.push(rampH(r, lx));
  }
  let b = 0;
  for (const v of c) if (v <= py + 0.7 && v > b) b = v;
  return b;
}

function bodyHits(box, x, z, y) {
  if (box.y0 !== undefined && !(y < box.y1 && y + 1.8 > box.y0)) return false;
  return Math.abs(x - box.x) < box.hw + RAD && Math.abs(z - box.z) < box.hd + RAD;
}
function colHits(c, x, z, y) {
  if (!(c.lv === undefined || Math.abs(y - c.lv * FH) < 2.5)) return false;
  if (!(c.hw > 0 && c.hd > 0)) return false;
  return Math.abs(x - c.x) < c.hw + RAD && Math.abs(z - c.z) < c.hd + RAD;
}

function session(html) {
  const sb = buildMilb(html);
  const m = sb.MILB;
  sb.boxes = [];
  sb.floorAt = (px, pz, py) => baseFloor(m, px, pz, py);
  sb.MI = { x: 0, z: 0, s: 1, m };
  vm.runInContext('fortAccess(MI);', sb);
  return { m, boxes: sb.boxes, floorAt: () => sb.floorAt, r: m.ramps[0], door: m.door };
}

function aperture(m, door) {
  const y = door.l * FH + 0.06;
  let best = 0, run = 0;
  for (let u = door.g0 + 0.02; u <= door.g1 - 0.02 + 1e-9; u += 0.02) {
    const pts = door.ax === 'z'
      ? [[door.pos, u], [door.pos - 0.6, u], [door.pos + 0.6, u]]
      : [[u, door.pos], [u, door.pos - 0.6], [u, door.pos + 0.6]];
    const open = pts.every(([x, z]) => !m.cols.some(c => colHits(c, x, z, y)));
    if (open) { run += 0.02; best = Math.max(best, run); }
    else run = 0;
  }
  return +best.toFixed(3);
}

function stepY(floorAt, x, z, y) {
  const ty = floorAt(x, z, y);
  return ty > y ? Math.min(ty, y + 12 / 60) : Math.max(ty, y - 14 / 60);
}

const pages = ['test.html', 'campaign-test.html', 'functional-test.html'];

test('index.html is unchanged and shared builders match it', () => {
  const indexHtml = read('index.html');
  assert.equal(createHash('md5').update(indexHtml).digest('hex'), INDEX_MD5);
  assert.equal(indexHtml.includes('FORT_ACCESS_BEGIN'), false);
  const testHtml = read('test.html');
  assert.equal(
    between(testHtml, 'function makeModel2(s){', 'const APTM='),
    between(indexHtml, 'function makeModel2(s){', 'const APTM=')
  );
  assert.equal(
    between(testHtml, 'function floorAt0(px,pz,py){', '// ===== farm base'),
    between(indexHtml, 'function floorAt0(px,pz,py){', '// ===== farm base')
  );
});

test('the three test pages carry the same Fort access hook', () => {
  const bodies = pages.map(name => between(read(name), '/* FORT_ACCESS_BEGIN */', '/* FORT_ACCESS_END */'));
  assert.equal(bodies[0], bodies[1]);
  assert.equal(bodies[0], bodies[2]);
  for (const name of pages) assert.match(read(name), /if\(MI\)\{fortAccess\(MI\);/);
});

for (const page of pages) {
  test(`${page}: upstairs wall blocks, ground door stays open, closed door blocks`, () => {
    const { m, boxes, floorAt, door } = session(read(page));
    const lintel = boxes.find(b => b.fortLintel);
    assert.ok(lintel, 'lintel box');
    assert.equal(lintel.y0, door.dh);
    assert.ok(lintel.y1 >= m.lv * FH);
    const z = door.pm;
    assert.equal(bodyHits(lintel, 0, z, 0.06), false);
    assert.equal(bodyHits(lintel, 0, z, 4), true);
    assert.equal(floorAt()(0, z, 4), 4);
    const closed = { x: 0, z, hw: (door.b - door.a) / 2, hd: (door.po - door.pi) / 2, lv: undefined };
    assert.equal(colHits(closed, 0, z, 0.06), true);
    assert.equal(bodyHits(lintel, 0, z, 0.06) || colHits(closed, 0, z, 0.06), true);
    // Open door: no door collider, and the lintel does not reach the ground body.
    assert.equal(bodyHits(lintel, 0, z, 0.06), false);
  });

  test(`${page}: stairs climb to floor 2 and walk back down, code-verified`, () => {
    const { floorAt, r } = session(read(page));
    const fa = floorAt();
    const z = -10;
    // Stable feet inside the flight are the ramp, not the ground inside the tread.
    const mid = fa(14, z, 0.06);
    assert.ok(Math.abs(mid - rampH(r, 14)) < 1e-6, `mid ${mid}`);
    assert.ok(mid > 2);
    let y = 0.06;
    for (let i = 0; i < 40; i++) y = stepY(fa, 14, z, y);
    assert.ok(y > 2, `stood inside flight at ${y}`);

    // From the low end, walk up. Then walk back down.
    let x = 16.9;
    y = fa(x, z, 0.2);
    assert.ok(y < 1, `bottom start ${y}`);
    for (let i = 0; i < 500 && x > 11.6; i++) {
      x -= 3.6 / 60;
      y = stepY(fa, x, z, y);
    }
    assert.ok(x < 11.7, `climbed to x=${x}`);
    assert.ok(y > 3.5, `climbed to y=${y}`);
    for (let i = 0; i < 500 && x < 16.8; i++) {
      x += 3.6 / 60;
      y = stepY(fa, x, z, y);
    }
    assert.ok(y < 0.8, `walked down to y=${y} at x=${x}`);
  });

  test(`${page}: standing on the landing seam does not fall`, () => {
    const { floorAt, r } = session(read(page));
    const fa = floorAt();
    const x = r.x0 - 0.025;
    assert.ok(x > r.x0 - 0.05 && x < r.x0);
    let y = 4;
    for (let i = 0; i < 60; i++) y = stepY(fa, x, -10, y);
    assert.ok(y > 3.9, `seam y=${y}`);
    // A point outside the fort still uses the previous floor (ground).
    assert.equal(fa(400, 400, 1), 0);
  });

  test(`${page}: upper doors keep a 0.30 m channel and every interior door blocks when shut`, () => {
    const { m } = session(read(page));
    assert.equal(m.idoors.length, 16);
    const yOf = d => d.l * FH + 0.06;
    for (const d of m.idoors) {
      const closed = {
        x: d.ax === 'x' ? d.g : d.pos,
        z: d.ax === 'x' ? d.pos : d.g,
        hw: d.ax === 'x' ? 0.55 : 0.12,
        hd: d.ax === 'x' ? 0.12 : 0.55,
        lv: d.l
      };
      assert.equal(colHits(closed, closed.x, closed.z, yOf(d)), true, `closed ${d.ax} ${d.pos} ${d.g} lv ${d.l}`);
    }
    const dresserDoor = m.idoors.find(d => d.ax === 'x' && d.pos === 3 && d.g === -12 && d.l === 1);
    assert.ok(dresserDoor);
    const dresserGap = aperture(m, dresserDoor);
    assert.ok(dresserGap >= 0.3, `dresser door channel ${dresserGap}`);
  });
}
