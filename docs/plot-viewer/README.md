# Dead Harvest: isolated plot viewer (TEST ONLY, read-only placement audit)

**The attached jsdom sweep below was not a browser test.** A later headless Chrome + SwiftShader load of `plot-viewer.html` is recorded in `NOTE.md`. Those frame rates are software-rendered, not a discrete GPU.

**Artifact:** `viewer.html`, one self-contained file of about 2.07 MB. three.js r128 is inlined, as in production. It loads no CDN, asset, font or network files, so it can be published as a single file under any name.
**Generated from:** `/workspace/campaign_nov5/dead-harvest-main/index.html` (md5 `1aea5a0a56af8c85ddb2d465342cf72b`). The generator only reads this file, and its md5 is the same before and after every build (see `anchors.json`).
**Rebuild:** `node gen_viewer.js` (optional args: `[src] [out]`). Each of the 5 anchors must match exactly once, otherwise the build aborts.

## URLs (query string)
| param | values | default | meaning |
|---|---|---|---|
| `plot` | 1–24 | 1 | selected plot |
| `comp` | farm, sawmill, quarry, cemetery, h9 | – | select a compound instead of a plot |
| `ctx` | 0 / 1 / 2 | 1 | neighbour context: 0 = own lot only, 1 = plus same-row neighbour lots, 2 = plus lots across the street, behind and diagonal |
| `mode` | cull / gen | cull | **cull** (recommended): the original world is generated in full, then everything outside the region is removed from the scene graph. **gen**: unrelated plots are never generated (see parity: this changes the apoc-world dressing near the selection) |
| `gfx` | 0 High, 1 Med, 2 Low (production default), 3 Potato | 0 | production graphics tier, injected into an in-memory store only |
| `margin` | 0–80 m | 12 | region margin around each lot |
| `story` | 0 / 1 | 1 | the story runtime runs by default, because it adds world objects such as the Plot 15 breaker and farm colliders. `story=0` turns it off |
| `zombies` | 1 | off | zombies stay off unless set |

Examples: `viewer.html?plot=1`, `viewer.html?plot=1&ctx=0`, `viewer.html?plot=15&ctx=2`, `viewer.html?comp=h9`

## Isolation
- `window.localStorage` and `sessionStorage` are replaced, before any game script runs, by in-memory stores that are thrown away on reload. `Storage.prototype.setItem/removeItem/clear` are also blocked on the real storage objects; `__DHV.blockedWrites` counts the attempts. As a result the viewer cannot read or write production saves, graphics, controls, FPS or mute settings, including on a shared GitHub Pages origin.
- `will-save` is stubbed (`dhSave.disabledByViewer=true`). There is no autosave interval, no save on pagehide, and no Continue menu.
- A red TEST ONLY banner is always shown. It names the excluded neighbour plots, for which cross-plot checks are not valid.

## What the viewer changes (viewer file only)
1. Region prune (cull mode). After every production builder has run, top-level scene objects whose world AABB misses the region are removed from the scene graph; they remain in memory. Instanced meshes with complete colour attributes are compacted to their in-region instances, using the same in-place method as production LOD. A group whose colour buffer is shorter than its instance count is kept whole so colours are not reassigned. The dead-tree builder used to be one of those groups; it now allocates a full colour buffer, and the guard remains. Lights, camera, Points and Lines are always kept. The selected and context plots' nested objects and geometry attributes are never touched. Top-level shared-world instance matrices/colours are remapped only in the viewer and restored by Unprune. Colliders (`boxes`, `insts`, `bdoors`) are not modified, so pruned areas keep invisible colliders.
2. Zombie spawn spots are emptied and raids disabled.
3. On load the player teleports to the selected plot's front door, using the same spot as production admin `goH`.

## Controls (left panel)
- **Selection**: plots 1–24 and the 5 compounds, plus ctx, mode and gfx. Changing any of these reloads the page.
- **Teleport**: Front, Rear, West, East, then Floor 1..lv and Roof for enterable models. A floor spot is the free point nearest the entrance where production `floorAt` returns that level and `blockedAt` is clear. Filler houses have no floors. Compounds only have an entry spawn: their interiors and floors (H-9 B1, quarry pit, barn loft) have no teleports, so use the production Admin (P) teleports.
- **Camera**: Walk (original game movement and collision) or Orbit (drag to rotate, shift or right drag to pan, wheel or pinch to zoom), with presets front, rear, west, east, top and iso, and target ±1 floor.
- **Collision overlay**: wireframes of `boxes`, `I.cols` (all-height and per-level), door colliders (open or closed), ramps or holes, and `GROUND_HOLES`. It has a per-floor filter and an x-ray toggle, and rebuilds when a door changes state.
- **Scene/parity**: restore the full scene, re-prune, or log the manifest to the console (`window.DHV_COLLECT`). The panel shows the in-browser pre- and post-prune region parity and a live rAF FPS readout, which is a measurement only when it comes from a real browser.

## Files
- `viewer.html`: the artifact to publish.
- `gen_viewer.js`, `src/{region,boot,manifest,runtime}.js`: the generator and its injected sources.
- `static_parity.js`: deterministic 60 Hz, seeded jsdom Plot 1 construction parity + separate tick/API smoke checks; written to `parity_plot1.json`. No wall-clock timing is used to advance the game.
- `sweep_all.js`, `run_sweep.sh`: smoke and parity sweep of all 24 plots and 5 compounds, written to a fresh `sweep_results.jsonl` (override with `SWEEP_OUT`). Comparisons use construction snapshots before scheduled ticks; the later tick/API checks do not assert matching camera-dependent animation states.
- `anchors.json`: build report (anchors, line numbers, md5s).
- `PARITY.md`: source comparison, root causes, exact checks, two-run table and evidence paths. A static sweep is **not a plot inspection**.
- `diagnose_causes.js`, `verify_integrity.js`: reproducible causal probes and SHA-256 byte-level geometry/collider integrity checks.
- `sweep_run{1,2}.{jsonl,log}`: final deterministic sweeps; `determinism.json`: cross-run exact-row comparison.
- `root_cause_evidence.{json,log}`, `integrity_evidence.{json,log}`: causal and integrity evidence.
