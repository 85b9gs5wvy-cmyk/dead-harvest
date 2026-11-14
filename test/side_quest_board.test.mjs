/**
 * Side quest board, Test Play only. One quest per placed gun, the farm board,
 * accept/complete unlocking that gun, and save v7 round-trip plus old-save migration.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const rules = between(testHtml, '/*SIDE_QUEST_RULES_BEGIN*/', '/*SIDE_QUEST_RULES_END*/');
const world = between(testHtml, '/*SIDE_QUEST_WORLD_BEGIN*/', '/*SIDE_QUEST_WORLD_END*/');
const box = {};
vm.createContext(box);
vm.runInContext(`${rules}\nthis.SQ_BOARD=SQ_BOARD;this.SQ_DEFS=SQ_DEFS;this.sqBlank=sqBlank;this.sqLoad=sqLoad;this.sqSnap=sqSnap;this.sqReduce=sqReduce;this.sqLocked=sqLocked;this.sqCanOpen=sqCanOpen;this.sqStatus=sqStatus;this.sqMarker=sqMarker;this.sqLine=sqLine;`, box);

const GUNS = [...testHtml.match(/const GUN_DEF=\[([\s\S]*?)\];/)[1].matchAll(/id:'(\w+)'/g)].map((m) => m[1]);

test('the notice board stands at the starting farm', () => {
  assert.equal(box.SQ_BOARD.landmark.includes('farm'), true);
  assert.ok(Math.hypot(box.SQ_BOARD.x - 10, box.SQ_BOARD.z - 18) < 12, 'board should sit beside the farm car');
  assert.match(testHtml, /g\.name='sqBoard'/);
  assert.match(testHtml, /F: Side quest board/);
  assert.match(world, /posts|1\.22,1\.125/);
  assert.equal(world.includes('PointLight'), false);
  assert.equal(world.includes('castShadow=true'), false);
  assert.match(world, /castShadow=false/);
  assert.match(testHtml, /window\.SQ_DRAW=\{board:3/);
  for (const html of ['index.html', 'campaign-test.html', 'functional-test.html']) {
    assert.equal(read(html).includes('SIDE_QUEST_RULES_BEGIN'), false, html);
  }
});

test('one side quest per placed weapon, and not the pistol or the fort rifle', () => {
  assert.equal([...box.SQ_DEFS.map((q) => q.id)].join(','), GUNS.join(','));
  assert.equal(GUNS.includes('pistol'), false);
  assert.equal(GUNS.includes('rifle'), false);
  assert.equal(box.SQ_DEFS.some((q) => q.id === 'pistol' || q.id === 'rifle'), false);
  const types = new Set(box.SQ_DEFS.map((q) => q.type));
  for (const t of ['fetch', 'hold', 'clear', 'search']) assert.equal(types.has(t), true, t);
  for (const q of box.SQ_DEFS) {
    assert.match(q.name, /\S/);
    assert.match(q.hook, /\S/);
    assert.match(q.landmark, /\S/);
    assert.ok(q.gun && Number.isFinite(q.gun.x) && Number.isFinite(q.gun.z), q.id);
  }
  assert.match(testHtml, /Locked - side quest/);
});

test('accepting and finishing a quest awards that weapon', () => {
  let s = box.sqBlank();
  let r = box.sqReduce(s, { type: 'accept', id: 'revolver' });
  assert.equal(r.ok, true);
  assert.equal(r.state.active, 'revolver');
  assert.equal(box.sqStatus(r.state, 'revolver'), 'Active');
  assert.equal(box.sqLocked(r.state, 'revolver'), true);
  const busy = box.sqReduce(r.state, { type: 'accept', id: 'shotgun' });
  assert.equal(busy.why, 'busy');
  assert.equal(busy.state.active, 'revolver');
  r = box.sqReduce(r.state, { type: 'take', id: 'revolver' });
  assert.equal(r.state.quests.revolver.item, 1);
  assert.equal(box.sqMarker(r.state).x, box.SQ_BOARD.x);
  r = box.sqReduce(r.state, { type: 'turnin', id: 'revolver' });
  assert.equal(r.award, 'revolver');
  assert.equal(r.state.quests.revolver.st, 'complete');
  assert.equal(r.state.active, '');
  assert.equal(box.sqLocked(r.state, 'revolver'), false);
  assert.equal(box.sqStatus(r.state, 'revolver'), 'Complete');

  s = box.sqBlank();
  s = box.sqReduce(s, { type: 'accept', id: 'shotgun' }).state;
  for (let i = 0; i < 3; i++) s = box.sqReduce(s, { type: 'kill', id: 'shotgun' }).state;
  assert.equal(s.quests.shotgun.st, 'active');
  const done = box.sqReduce(s, { type: 'kill', id: 'shotgun' });
  assert.equal(done.award, 'shotgun');
  assert.equal(box.sqLocked(done.state, 'shotgun'), false);

  s = box.sqBlank();
  s = box.sqReduce(s, { type: 'accept', id: 'smg' }).state;
  assert.equal(box.sqCanOpen(s, 'smg'), false);
  s = box.sqReduce(s, { type: 'take', id: 'smg' }).state;
  assert.equal(box.sqCanOpen(s, 'smg'), true);
  const opened = box.sqReduce(s, { type: 'open', id: 'smg' });
  assert.equal(opened.award, 'smg');

  s = box.sqBlank();
  s = box.sqReduce(s, { type: 'accept', id: 'pump' }).state;
  s = box.sqReduce(s, { type: 'hold', id: 'pump', dt: 5, inside: false }).state;
  assert.equal(s.quests.pump.prog, 0);
  s = box.sqReduce(s, { type: 'hold', id: 'pump', dt: 19, inside: true }).state;
  assert.equal(s.quests.pump.st, 'active');
  const held = box.sqReduce(s, { type: 'hold', id: 'pump', dt: 1.2, inside: true });
  assert.equal(held.award, 'pump');
  assert.match(world, /grantWeapon\(id\)/);
});

test('side quest state round-trips through the v7 save and old saves start available', () => {
  let s = box.sqBlank();
  s = box.sqReduce(s, { type: 'accept', id: 'ak' }).state;
  s = box.sqReduce(s, { type: 'kill', id: 'ak' }).state;
  s = box.sqReduce(s, { type: 'kill', id: 'ak' }).state;
  const snap = box.sqSnap(s);
  const back = box.sqLoad(JSON.parse(JSON.stringify(snap)));
  assert.equal(back.active, 'ak');
  assert.equal(back.quests.ak.st, 'active');
  assert.equal(back.quests.ak.prog, 2);
  assert.equal(back.quests.revolver.st, 'available');
  const again = box.sqLoad(box.sqSnap(back));
  assert.equal(again.quests.ak.prog, back.quests.ak.prog);
  assert.equal(again.active, back.active);

  s = box.sqReduce(box.sqBlank(), { type: 'accept', id: 'sar' }).state;
  s = box.sqReduce(s, { type: 'hold', id: 'sar', dt: 7.25, inside: true }).state;
  const held = box.sqLoad(box.sqSnap(s));
  assert.equal(held.quests.sar.prog, 7.3);
  assert.equal(held.quests.sar.st, 'active');

  for (const raw of [null, undefined, {}, { v: 6 }, { active: 'nope', quests: { revolver: { st: 'nope', prog: 9 } } }]) {
    const old = box.sqLoad(raw);
    assert.equal(old.active, '');
    for (const q of box.SQ_DEFS) {
      assert.equal(old.quests[q.id].st, 'available', q.id);
      assert.equal(old.quests[q.id].prog, 0, q.id);
      assert.equal(box.sqLocked(old, q.id), true);
    }
  }
  const partial = box.sqLoad({ quests: { thompson: { st: 'complete', item: 1, prog: 1 } } });
  assert.equal(partial.quests.thompson.st, 'complete');
  assert.equal(partial.quests.sar.st, 'available');
  assert.equal(partial.active, '');

  const save = between(testHtml, '<script id="will-save">', '</script>');
  assert.match(save, /VER=7/);
  assert.match(save, /sq:window\.SIDEQ\?window\.SIDEQ\.snap\(\):null/);
  assert.match(save, /if\(window\.SIDEQ\)window\.SIDEQ\.load\(d\.sq\)/);
});

test('the plot viewer can frame the farm board', () => {
  assert.match(viewerHtml, /farmboard:1/);
  assert.match(viewerHtml, /comp=farmboard|name==='farmboard'/);
  assert.match(viewerHtml, /g\.name='sqBoard'/);
  assert.match(viewerHtml, /one\.comp==='farmboard'/);
  assert.match(viewerHtml, /cam\.lookAt\(6\.4,1\.4,23\.6\)/);
  assert.equal(viewerHtml.includes('SIDE_QUEST_RULES_BEGIN'), false);
  assert.equal(viewerHtml.includes('PointLight'), true); // the game still has its own lights
  const board = between(viewerHtml, "if(one.comp==='farmboard'&&typeof M2", 'one.board=g;');
  assert.equal(board.includes('PointLight'), false);
  assert.equal(board.includes('castShadow=true'), false);
});
