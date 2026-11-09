# TEST-ONLY viewer parity — not a plot inspection

**The 58/58 table in this file is the original jsdom construction sweep.** It was not re-run after the dead-tree colour fix, and it is not a browser, pixel, or GPU frame-rate result. A later headless Chrome load with SwiftShader is recorded in `NOTE.md`. That check used software WebGL. It does not replace this sweep and it is not a discrete-GPU measurement.

The paragraphs below are the attached handoff. Where they say no browser was started, that describes the jsdom sweep, not the later Chrome check.

Baseline: `/workspace/campaign_nov5/dead-harvest-main/index.html`, MD5 **`1aea5a0a56af8c85ddb2d465342cf72b`**. The generator now refuses another baseline or an output equal to its source.

## Explicit source comparison

`gen_viewer.js` reads the original HTML, applies exactly five unique checked anchors, and appends/inserts the four viewer sources. It then reverses every replacement and requires **byte-for-byte equality with the original HTML string** (`anchors.json: verbatimSourceRoundTrip=true`). This proves that all non-anchor production source is reused verbatim; it is not a rewritten/recreated model approximation. The checked file is UTF-8; the on-disk original checksum is checked independently again at the end.

Production line numbers below refer to the unchanged baseline, not to the longer generated viewer. `anchors.json` also contains generated intermediate line numbers, `sourceLine`, reasons and build checksums.

| Anchor | Production line | Reuse/change in TEST-ONLY artifact |
|---|---:|---|
| A1-boot | 81 | Before the original bundled three.js r128 script: insert `src/region.js` and `src/boot.js`; no bundled renderer/library code changed. Defines region formula, query parsing, in-memory storage and graphics tier seed. |
| A2-plotloop | 51314 | Insert a guard and placement tracking in the original `for(const p of PLOTS)` loop. Default `mode=cull` executes every original plot branch. Optional `mode=gen` skips unrelated plots and is NOT world-parity-approved. |
| A3-save | 55841 | At `const KEY='dhSave',VKEY='dhSaveVer',VER=2;`, insert an early stub/return for the viewer, before save loading, autosave and Continue setup. Original real saves are not read. |
| A4-story | 55643 | After the original story enable guard, add a viewer-only `story=0` return. Default `story=1` reuses the story builder/runtime; story-added colliders/props remain present. |
| A5-runtime | 56190 | Before the final closing body/html: append `src/manifest.js` and `src/runtime.js`, after all original production builders. |

The original production model constructors, model clone/place routine (`index.html:51211–51222`), lot placement branches (`51314` onward), compound builders, `floorAt`, `blockedAt`, doors, ramps, terrain and collision definitions are not edited or substituted. The original production graphics code is reused; only the viewer's in-memory setting defaults to High, never a user's saved graphics setting.

Added runtime behavior (`src/runtime.js:16–41`, plus its UI/teleport sections): disable zombie spawn/raids in this viewer; remove unrelated top-level objects from the **viewer scene graph** by region AABB; compact safe top-level shared-world instance groups; retain selected/context nested building groups intact; add TEST ONLY UI, orbit controls, teleport helpers, optional collision overlay and readouts. All-height/full-world colliders are retained, including outside the pruned view. Excluded-neighbor/boundary checks are labelled invalid. This is not an alternate production game build.

### Geometry/collider integrity: precise meaning

The viewer does **not** edit original model/terrain geometry vertex, normal, UV, colour or index arrays, geometry groups/draw ranges, building transforms, materials, door definitions, `boxes`, `I.cols`, model collision arrays, ramps or ground-hole definitions. Selected and context building hierarchies are not compacted. Optional collision overlays add new viewer-tagged geometry only.

Intentional exception to “untouched”: the viewer removes unrelated scene roots and **mutates safe shared-world `instanceMatrix`/`instanceColor` arrays and `.count` in its own in-memory scene** to compact instances; originals are backed up and restored by Unprune. That is not a production-file or geometry-attribute edit, and not an assertion that all instance buffers stay byte-identical while pruned. Production runtime animations still run normally and may change transforms/particles/materials after construction.

`verify_integrity.js` tests P6 and quarry by restoring the generated full scene, taking SHA-256 hashes of every original geometry attribute/index array plus groups/draw ranges, repruning, and checking the **same geometry object references**. It also compares all collider/door-membership/ground-hole data and verifies every original instance buffer/count is restored afterward. See `integrity_evidence.json`: 7,617 geometries and 86 instance groups in each check. This complements source round-trip verification, rather than claiming a browser/pixel proof.

## Root causes and changes

### P5/P6 original `groupGeomHash/groupXfHash/groupMatHash` differences

**Harness state mismatch, not nested-group compaction.** P5's context plot and P6 itself both refer to P6, Riverside Power Station. The old harness compared post-tick production at the farm with the viewer after its front-door teleport. Production `plTick` (`index.html:54023`) returns when the camera is over 230 m from the station; in the viewer it runs. It animates particle vertex positions, machinery/searchlight transforms and material colours (`54026–54055`). The original hashes include those animated Points and meshes; they do not isolate static building structure or even hash top-level instance matrices. Comparing them at different positions/times cannot diagnose compaction.

Causal evidence in `root_cause_evidence.json`: without any viewer pruning, a production station record remains unchanged after a far-camera tick (`geom=7b657af0`, `xf=c6126917`), but changes after two near-camera ticks (`geom=2f511d60`, `xf=fc1eb531`). Thus the same class of difference occurs in unmodified production. Wall-clock build duration, rAF timer polling/overshoot, particle evolution and other animation timing added further variability in the previous harness.

**Comparison fix:** `static_parity.js` now fixes `Math.random`, `Date`, `performance.now`, rAF and timers. Exactly the requested number of 60 Hz frames is advanced manually, with stable timer ordering and no real sleeps/rAF overshoot. `sweep_all.js` and Plot 1 comparisons use construction snapshots **before scheduled ticks**, with matching gfx/story/region/seed. Tick/API errors are checked separately, not passed off as animation-state parity. After-tick manifests remain diagnostic only because player/camera positions intentionally differ.

**Stronger check:** `src/manifest.js` additionally fingerprints every geometry attribute and full index, world transforms, scalar material state/texture metadata, visibility/shadow flags, and region-selected instance matrices/colours. Tokens and instance sets are order-normalized; comparisons use the same in-region set before/after compaction, not compacted arrays against full-world arrays. These are 32-bit diagnostic fingerprints, not cryptographic pixel equivalence; texture pixels/shaders are not covered. Legacy scene sigs, plot records, colliders and holes are checked too.

### Separate real defect discovered by the stronger check

Production's tree builder (`index.html:51521`) starts with `.count=0`, increments it before its first `setColorAt`, and thereby allocates a colour buffer for only one instance. The group later has many instances but still only one colour. Compaction used to move a tree at source index 40 (no colour entry) to index 0 (a defined colour), changing its attribute association. This was a genuine **viewer-only rendered-state hazard**, not the cause of the original nested P6 group hash differences.

**Viewer fix:** preserve all three truncated-colour groups whole; never compact them or attempt to repair an undersized attribute. On the unfixed builder this kept about 75k extra geometry-estimate triangles in Plot 1 and preserved original instance indexing. `integrity_evidence.json` records each group's instance/colour capacity from that sweep.

The production builder is fixed in this repo: each dead-tree mesh allocates one instance colour per tree before `setColorAt`. The viewer guard is unchanged. In the headless Chrome check, Plot 1's initial prune reported `unsafeColorGroupsKept` 0, and forcing one full-colour group back to a 1-colour buffer made the guard keep that group (`unsafeColorGroupsKept` 1) until the full buffer was restored. The old 75k-triangle note was not remeasured.

Pruning also no longer constructs temporary `THREE.Mesh` objects just to calculate geometry bounds: it uses the existing read-only geometry bounds helper, avoiding unnecessary UUID allocations that consumed the game's random stream.

### Quarry one-off `plots=false`

**Historical cause cannot be proved from the available artifacts.** `evidence_initial/sweep.log:27` contains the isolated false line, but the preserved later `evidence_initial/sweep_results.jsonl` quarry row and `evidence_initial/sweep_comp.log` say true. The false run's manifests/plot diff/source revision were not saved. Do not claim a diagnosed random/story defect, or claim the old event was conclusively fixed.

For the current source, quarry's region is x=-200..0, z=-580..-430 after the default margin. No city-plot centre falls inside it (`src/region.js:25`), so both production and viewer plot arrays are **empty**. `JSON.stringify([])===JSON.stringify([])` cannot yield false. Current compound tests now compare actual region render fingerprints and colliders too, rather than treating an empty plot-array equality as meaningful quarry coverage. Two independent quarry causal probes show empty plot arrays before/after 60 simulated frames and identical initial region hashes; both complete sweeps repeat this. Fixed clocks and fresh-per-run JSONL outputs remove the known timing/append ambiguity. The historical line remains an unresolved provenance limitation, not a current reproducible placement failure.

## Exact validated scope

- Default `mode=cull`, ctx=1 for P1–P24, compounds farm/sawmill/quarry/cemetery/h9, gfx=0 High, story=1, default 12 m margin, same seed.
- Construction equality of selected/context plot records, region scene signatures and enhanced render fingerprints, region boxes and ground holes; initial in-viewer pre/post-prune parity.
- Exactly 60 scheduled simulated frames per full-sweep selection, plus front/floor/roof teleport and collision-overlay API smoke checks; no reported game/viewer errors or no-spot failures is required to pass.
- In-memory storage isolation and disabled save API asserted. No user-origin real storage or real user saves are involved in these jsdom sessions.
- Plot 1 additional ctx0/ctx1 and High/Low comparisons; optional `mode=gen` and `story=0` are diagnostics, not production-region parity promises.

## Not validated / not an inspection

- **No real browser load, actual FPS/frame cost, WebGL rendering, GPU memory, shaders, texture/canvas pixels, shadows or lighting fidelity.** Stub renderer calls and geometry triangle estimates are not FPS or rendered-pixel evidence.
- No visual placement inspection: clipping, floating/sunken models, topology, rotations/scales, doors/access and actual collision traversal remain unaudited. Existing partial external audit reports are not upgraded by this sweep. No screenshots were created by these headless tests.
- No mouse/pointer-lock/touch/phone viewport controls, audio, long-play/story progression, saving/Continue, or changing graphics tiers live. Full sweep is default ctx1/gfx0 only; other contexts/tiers need their own tests.
- No pixel equivalence guarantee for boundaries or shadows from removed objects. Prune uses conservative bounds; distant Points/Lines/lights and three unsafe tree groups are retained, so isolation is not minimal. Collider checks outside retained visual context are invalid. `mode=gen` changes RNG/world dressing; `story=0` omits story props. Neither is approved for production parity.
- Construction parity compares equal scene-building states, not matched-camera dynamic simulations. Deterministic test scheduling is a test-only abstraction, not a browser timing model. The historical quarry false cannot be reconstructed from a log line alone.

## Final two-run results

<!-- RESULTS -->
**58/58 selection-runs PASS; 29/29 full result rows identical across both runs; zero recorded viewer/game/reference errors.** Each uses 60 simulated frames, not measured browser frames. Plot 1 approved cull ctx1 High, ctx0 High and ctx1 Low comparisons also pass. Optional gen/story-off diagnostics are intentionally not parity-approved.

| Selection | Run 1 | Run 2 | Exact row repeat |
|---|---|---|---|
| P1 | PASS | PASS | identical |
| P2 | PASS | PASS | identical |
| P3 | PASS | PASS | identical |
| P4 | PASS | PASS | identical |
| P5 | PASS | PASS | identical |
| P6 | PASS | PASS | identical |
| P7 | PASS | PASS | identical |
| P8 | PASS | PASS | identical |
| P9 | PASS | PASS | identical |
| P10 | PASS | PASS | identical |
| P11 | PASS | PASS | identical |
| P12 | PASS | PASS | identical |
| P13 | PASS | PASS | identical |
| P14 | PASS | PASS | identical |
| P15 | PASS | PASS | identical |
| P16 | PASS | PASS | identical |
| P17 | PASS | PASS | identical |
| P18 | PASS | PASS | identical |
| P19 | PASS | PASS | identical |
| P20 | PASS | PASS | identical |
| P21 | PASS | PASS | identical |
| P22 | PASS | PASS | identical |
| P23 | PASS | PASS | identical |
| P24 | PASS | PASS | identical |
| farm | PASS | PASS | identical |
| sawmill | PASS | PASS | identical |
| quarry | PASS | PASS | identical |
| cemetery | PASS | PASS | identical |
| h9 | PASS | PASS | identical |

Plot 1 geometry-estimate scene total: 2009400 → 380256. This includes the deliberately retained unsafe-colour tree groups; it is not a GPU render/FPS measurement.
<!-- /RESULTS -->

## Reproduce (headless only)

```sh
cd /workspace/campaign_nov5/plot_audit/viewer
node gen_viewer.js > build.log
SWEEP_OUT=sweep_run1.jsonl node sweep_all.js 60 > sweep_run1.log 2>&1
SWEEP_OUT=sweep_run2.jsonl node sweep_all.js 60 > sweep_run2.log 2>&1
node static_parity.js 1 60 > parity_plot1.log 2>&1
node diagnose_causes.js > root_cause_evidence.log 2>&1
node verify_integrity.js > integrity_evidence.log 2>&1
node finalize_evidence.js
```

`http://dhv.test/` in logs is only a jsdom origin string, not an HTTP listener or reachable hosted viewer.

## Handoff files — staged locally only, not published

All paths below are relative to **`/workspace/campaign_nov5/plot_audit/viewer/`**. The corrected artifact is **`/workspace/campaign_nov5/plot_audit/viewer/viewer.html`**. Nothing here authorizes a push/publication; someone else may prepare a test-only PR/hosting after the hold is lifted.

<!-- FILES -->
Artifact and reproduction sources:
- `/workspace/campaign_nov5/plot_audit/viewer/PARITY.md`
- `/workspace/campaign_nov5/plot_audit/viewer/README.md`
- `/workspace/campaign_nov5/plot_audit/viewer/diagnose_causes.js`
- `/workspace/campaign_nov5/plot_audit/viewer/finalize_evidence.js`
- `/workspace/campaign_nov5/plot_audit/viewer/gen_viewer.js`
- `/workspace/campaign_nov5/plot_audit/viewer/run_sweep.sh`
- `/workspace/campaign_nov5/plot_audit/viewer/static_parity.js`
- `/workspace/campaign_nov5/plot_audit/viewer/sweep_all.js`
- `/workspace/campaign_nov5/plot_audit/viewer/verify_integrity.js`
- `/workspace/campaign_nov5/plot_audit/viewer/viewer.html`
- `/workspace/campaign_nov5/plot_audit/viewer/src/boot.js`
- `/workspace/campaign_nov5/plot_audit/viewer/src/manifest.js`
- `/workspace/campaign_nov5/plot_audit/viewer/src/region.js`
- `/workspace/campaign_nov5/plot_audit/viewer/src/runtime.js`

Evidence files (initial artifacts explicitly historical, final runs authoritative):
- `/workspace/campaign_nov5/plot_audit/viewer/anchors.json`
- `/workspace/campaign_nov5/plot_audit/viewer/build.log`
- `/workspace/campaign_nov5/plot_audit/viewer/checksum_evidence.json`
- `/workspace/campaign_nov5/plot_audit/viewer/determinism.json`
- `/workspace/campaign_nov5/plot_audit/viewer/diagnostic_p56_comp.jsonl`
- `/workspace/campaign_nov5/plot_audit/viewer/diagnostic_p56_comp.log`
- `/workspace/campaign_nov5/plot_audit/viewer/final_summary.log`
- `/workspace/campaign_nov5/plot_audit/viewer/integrity_evidence.json`
- `/workspace/campaign_nov5/plot_audit/viewer/integrity_evidence.log`
- `/workspace/campaign_nov5/plot_audit/viewer/parity_plot1.json`
- `/workspace/campaign_nov5/plot_audit/viewer/parity_plot1.log`
- `/workspace/campaign_nov5/plot_audit/viewer/root_cause_evidence.json`
- `/workspace/campaign_nov5/plot_audit/viewer/root_cause_evidence.log`
- `/workspace/campaign_nov5/plot_audit/viewer/sweep_results.jsonl`
- `/workspace/campaign_nov5/plot_audit/viewer/sweep_run1.jsonl`
- `/workspace/campaign_nov5/plot_audit/viewer/sweep_run1.log`
- `/workspace/campaign_nov5/plot_audit/viewer/sweep_run2.jsonl`
- `/workspace/campaign_nov5/plot_audit/viewer/sweep_run2.log`
- `/workspace/campaign_nov5/plot_audit/viewer/evidence_initial/parity_plot1.log`
- `/workspace/campaign_nov5/plot_audit/viewer/evidence_initial/sweep.log`
- `/workspace/campaign_nov5/plot_audit/viewer/evidence_initial/sweep_comp.log`
- `/workspace/campaign_nov5/plot_audit/viewer/evidence_initial/sweep_results.jsonl`
- `/workspace/campaign_nov5/plot_audit/viewer/FILE_MANIFEST.json`
<!-- /FILES -->
