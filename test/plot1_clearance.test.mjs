/**
 * Plot 1 (Riverside Apartments) walking clearance.
 * Geometry is the same model makeModel2 uses: furniture sol() sizes, partition
 * gaps of ±0.55 m, shell interior faces at x=±12.7 and z=±7.7, player radius 0.4 m.
 * index.html is the gameplay source. test.html, campaign-test.html, and
 * functional-test.html keep the previous coordinates. plot-viewer.html is
 * generated from index.html, so it carries the same furniture.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ROOT = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, ROOT), 'utf8');
const PAGES = ['index.html', 'test.html', 'campaign-test.html', 'functional-test.html', 'plot-viewer.html'];
const html = Object.fromEntries(PAGES.map((n) => [n, read(n)]));
const index = html['index.html'];

const NEED = 0.8;

function dims(kind, a, b) {
  const table = {
    bed: [2.1, 1.5], sofa: [1.9, 0.85], wardrobe: [1.2, 0.55], desk: [1.6, 0.75],
    plant: [0.4, 0.4], wc: [0.5, 0.7], sink: [0.55, 0.4], bath: [1.7, 0.75],
    fridge: [0.72, 0.7], stove: [0.6, 0.6], tv: [1.3, 0.4], bench: [1.6, 0.45],
    vend: [0.9, 0.8], washer: [0.8, 0.75], bin: [1.4, 0.9], drum: [0.6, 0.6],
    pool: [2.3, 1.3], arcade: [0.78, 0.82], jukebox: [1.06, 0.68], dresser: [1.5, 0.58],
  };
  if (table[kind]) return table[kind];
  if (kind === 'table') return [a || 1.4, b || 0.8];
  if (kind === 'counter') return [a || 2, 0.6];
  if (kind === 'shelf') return [a || 1.6, 0.4];
  if (kind === 'dining') return [a || 2.6, 1.3];
  if (kind === 'regdesk') return [a || 3, 0.8];
  return null;
}

function boxOf(e) {
  const d = dims(e[0], e[4], e[5]);
  if (!d) return null;
  let [A, B] = d;
  const rot = e[3] || 0;
  if (rot & 1) [A, B] = [B, A];
  return { kind: e[0], x0: e[1] - A / 2, x1: e[1] + A / 2, z0: e[2] - B / 2, z1: e[2] + B / 2 };
}

function mz(e) {
  const o = e.slice();
  o[2] = -e[2];
  if (e.length > 3) {
    const r = e[3] | 0;
    o[3] = e[0] === 'bed' ? (r === 1 ? 3 : r === 3 ? 1 : r) : (r === 0 ? 2 : r === 2 ? 0 : r);
  }
  return o;
}

const BWbath = [['wc', -12.1, -7.35, 0], ['sink', -9.8, -7.45, 0], ['bath', -12.3, -5.6, 1]];
const BW = [
  ['bed', -7.3, -6.6, 1], ['table', -8.45, -7.3, 0, 0.5, 0.45], ['table', -6.15, -7.3, 0, 0.5, 0.45],
  ['wardrobe', -10.2, -1.65, 2], ['desk', -12.3, -2.1, 1], ['dresser', -5.4, -6.0, 3], ['plant', -5.55, -1.7],
  ...BWbath,
  ['fridge', -4.5, -7.33, 0], ['counter', -3.0, -7.4, 0, 2.0], ['stove', -1.55, -7.38, 0], ['counter', -0.15, -7.4, 0, 1.6],
  ['dining', -1.0, -4.7, 0, 2.6],
  ['sofa', -2.5, -2.95, 1], ['table', -1.45, -2.95, 1, 1.0, 0.6], ['tv', 0.7, -3.0, 3], ['shelf', -4.1, -1.5, 2, 1.2], ['plant', 0.55, -1.8],
];
const FC = [
  ['wc', 2.55, 1.55, 0], ['sink', 2.58, 2.15, 0], ['bath', 1.525, 2.05, 1],
  ['stove', 4.65, 1.52, 0], ['counter', 5.6, 1.5, 0, 1.2], ['fridge', 6.05, 2.4, 3],
  ['bed', 5.25, 4.9, 2], ['table', 5.95, 3.6, 0, 0.5, 0.45], ['wardrobe', 5.85, 6.45, 1], ['tv', 1.35, 6.4, 1],
  ['sofa', 3.6, 6.4, 3], ['plant', 6.0, 7.3],
];
const EU = [
  ['fridge', 12.0, -1.7, 0], ['counter', 10.4, -1.75, 0, 2.0], ['stove', 8.5, -1.78, 0], ['counter', 7.3, -1.75, 0, 1.4],
  ['table', 7.7, 1.9, 0, 1.4, 0.9],
  ['sofa', 9.6, -0.2, 1], ['table', 10.9, -0.2, 1, 1.0, 0.6], ['tv', 12.4, -0.2, 3], ['plant', 12.2, 0.85],
  ['bed', 9.35, 5.5, 2], ['table', 10.1, 4.4, 0, 0.5, 0.45], ['table', 10.1, 6.65, 0, 0.5, 0.45],
  ['wardrobe', 6.9, 6.5, 1], ['dresser', 7.7, 3.65, 0, 1.5], ['plant', 7.0, 7.3],
  ['wc', 11.2, 7.35, 2], ['sink', 10.85, 4.6, 1], ['bath', 12.3, 5.6, 1],
];
const HALL = [['plant', 5.9, 0.7]];
const LOBBY = [['regdesk', -0.5, 3.4, 0, 3], ['bench', -3.4, 7.2, 2], ['bench', 3.4, 7.2, 2], ['plant', -4.4, 7.3], ['plant', 5.9, 7.4], ['vend', 6.0, 6.2, 3]];
const LAUNDRY = [
  ['washer', -11.7, 1.65, 0], ['washer', -10.7, 1.65, 0], ['washer', -7.6, 1.65, 0], ['washer', -6.6, 1.65, 0],
  ['table', -7.8, 4.0, 0, 2.0, 0.8], ['bin', -5.7, 7.0, 3], ['shelf', -5.35, 5.0, 3, 1.6],
  ...BWbath.map(mz),
];
const CLOSET = [['shelf', -10.6, -0.78, 0, 2.4], ['drum', -12.2, 0.6], ['bin', -6.2, 0.2, 0]];
const COMM = [
  ['counter', 8.5, -1.75, 0, 2.2], ['fridge', 10.3, -1.7, 0], ['stove', 11.2, -1.78, 0],
  ['table', 9.5, 1.0, 0, 2.4, 1.0],
  ['pool', 9.0, 5.6, 0], ['arcade', 10.55, 6.9, 2], ['arcade', 11.5, 6.9, 2], ['jukebox', 12.2, 4.2, 3],
  ['sofa', 8.4, 2.7, 1], ['tv', 12.4, -0.2, 3], ['plant', 7.0, 7.3],
];
const T6 = new Set([1, 2, 3, 4, 5, 6]);
const G0 = new Set([0]);
const P = [
  ['x', -1.1, -12.7, 1.0, [-2.0], null], ['z', 1.0, -5.2, -1.1, [], null],
  ['z', 6.5, -2.2, 7.7, [-0.6], T6], ['z', 6.5, -2.2, 7.7, [-0.6, 4.5], G0], ['x', -2.2, 6.5, 12.7, [], null],
  ['x', 1.1, -12.7, 6.5, [-2.0, 3.7], T6], ['x', 1.1, -12.7, -5.0, [-9.0], G0], ['z', -5.0, -1.1, 1.1, [], G0], ['z', 1.0, 1.1, 7.7, [], T6],
  ['z', -5.0, -7.7, -1.1, [-3.0], null], ['z', -9.0, -7.7, -4.6, [], null], ['x', -4.6, -12.7, -9.0, [-10.8], null],
  ['z', -5.0, 1.1, 7.7, [3.0], null], ['z', -9.0, 4.6, 7.7, [], null], ['x', 4.6, -12.7, -9.0, [-10.8], null],
  ['z', 3.0, 1.1, 4.0, [], T6], ['x', 4.0, 1.0, 3.0, [2.2], T6],
  ['x', 3.2, 6.5, 12.7, [9.6, 11.8], T6], ['z', 10.5, 3.2, 7.7, [], T6],
];

function furniture(floor) {
  const src = floor === 0
    ? [...BW, ...LOBBY, ...LAUNDRY, ...CLOSET, ...COMM, ...HALL]
    : [...BW, ...BW.map(mz), ...FC, ...EU, ...HALL];
  return src.map(boxOf).filter(Boolean);
}

function doors(floor) {
  const out = [];
  for (const [ax, pos, , , gaps, lvs] of P) {
    if (lvs && !lvs.has(floor)) continue;
    for (const g of gaps) out.push({ ax, pos, g });
  }
  return out;
}

function overlap(a, b) {
  const x = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const z = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  return x > 0.02 && z > 0.02 ? [x, z] : null;
}

function clearWidth(door, boxes, reach) {
  const u0 = door.g - 0.55;
  const u1 = door.g + 0.55;
  const cuts = [];
  for (const b of boxes) {
    const near = door.ax === 'x'
      ? b.z0 < door.pos + reach && b.z1 > door.pos - reach
      : b.x0 < door.pos + reach && b.x1 > door.pos - reach;
    if (!near) continue;
    const lo = Math.max(u0, door.ax === 'x' ? b.x0 : b.z0);
    const hi = Math.min(u1, door.ax === 'x' ? b.x1 : b.z1);
    if (hi > lo) cuts.push([lo, hi, b.kind]);
  }
  cuts.sort((p, q) => p[0] - q[0]);
  let cur = u0;
  let best = 0;
  for (const [lo, hi] of cuts) {
    if (lo > cur) best = Math.max(best, lo - cur);
    cur = Math.max(cur, hi);
  }
  if (cur < u1) best = Math.max(best, u1 - cur);
  return best;
}

const NEW_STRINGS = [
  "['sofa',-2.5,-2.95,1],['table',-1.45,-2.95,1,1.0,.6]",
  "['wc',2.55,1.55,0],['sink',2.58,2.15,0],['bath',1.525,2.05,1]",
  "['wardrobe',5.85,6.45,1]",
  "['plant',12.2,0.85]",
  "['arcade',10.55,6.9,2],['arcade',11.5,6.9,2]",
  "['sofa',8.4,2.7,1]",
];
const OLD_STRINGS = [
  "['sofa',-4.05,-3.0,1]",
  "['arcade',12.4,7.3,2]",
  "['bath',1.55,3.0,1]",
  "['wardrobe',1.4,4.75,1]",
  "['plant',12.2,2.5]",
  "['sofa',7.2,3.4,1]",
];
const UNCHANGED = ['campaign-test.html', 'functional-test.html'];
const SAME_AS_INDEX = ['test.html', 'plot-viewer.html'];

test('Plot 1 clearance is in the main game only', () => {
  for (const s of NEW_STRINGS) assert.equal(index.includes(s), true, 'index missing ' + s);
  for (const s of OLD_STRINGS) assert.equal(index.includes(s), false, 'index still has ' + s);
  assert.match(index, /sol\(1\.9,\.85\)/);
  assert.match(index, /sol\(\.78,\.82\)/);
  assert.match(index, /KEY='dhSave',VKEY='dhSaveVer'/);
  assert.match(index, /core:\{x0:6\.5,x1:12\.7,z0:-7\.7,z1:-2\.3,land:1\.7\}/);
  for (const name of UNCHANGED) {
    for (const s of OLD_STRINGS) assert.equal(html[name].includes(s), true, name + ' lost pre-fix ' + s);
    for (const s of NEW_STRINGS) assert.equal(html[name].includes(s), false, name + ' picked up a layout edit ' + s);
  }
  for (const name of SAME_AS_INDEX) {
    for (const s of NEW_STRINGS) assert.equal(html[name].includes(s), true, name + ' missing ' + s);
  }
  assert.match(html['test.html'], /KEY='dhSaveTest'/);
  assert.match(html['campaign-test.html'], /KEY='dhSaveHarness'/);
  assert.match(html['functional-test.html'], /KEY='dhSaveFunctional'/);
  assert.equal(html['plot-viewer.html'].includes('dhSaveFunctional'), false);
  for (const s of NEW_STRINGS) assert.equal(html['plot-viewer.html'].includes(s), true, 'viewer missing ' + s);
  for (const s of OLD_STRINGS) assert.equal(html['plot-viewer.html'].includes(s), false, 'viewer kept ' + s);
});

function oldBedroomSofa() { return boxOf(['sofa', -4.05, -3.0, 1]); }
function oldArcade() { return boxOf(['arcade', 12.4, 7.3, 2]); }

test('the reported main-game defects were real, and the new placement clears them on every floor', () => {
  const bedroom = { ax: 'z', pos: -5, g: -3 };
  const oldBoxes = [oldBedroomSofa()];
  assert.ok(clearWidth(bedroom, oldBoxes, 0.55) < NEED, 'old sofa should block the bedroom door');
  const arcade = oldArcade();
  assert.ok(arcade.x1 - 12.7 > 0.08 && arcade.x1 - 12.7 < 0.1, 'old arcade east protrusion ' + (arcade.x1 - 12.7));
  assert.ok(arcade.z1 > 7.7, 'old arcade also crossed the north face');

  for (let floor = 0; floor < 7; floor++) {
    const boxes = furniture(floor);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const hit = overlap(boxes[i], boxes[j]);
        assert.equal(hit, null, `f${floor} ${boxes[i].kind} overlaps ${boxes[j].kind}`);
      }
    }
    for (const door of doors(floor)) {
      const w = clearWidth(door, boxes, 0.55);
      assert.ok(w >= NEED, `f${floor} door ${door.ax}@${door.pos} gap ${door.g} clear ${w.toFixed(2)}`);
    }
  }
  const outer = boxOf(['arcade', 11.5, 6.9, 2]);
  assert.ok(outer.x1 < 12.7 - 0.5, 'outer arcade still inside the east wall');
  assert.ok(outer.z1 < 7.7 - 0.3, 'arcade inside the north wall');
});
