# Previous site page (kept for the record)

This is the README text from before the four-button page. It is not the current instructions.

# Dead Harvest

<p align="center">
  <a href="https://85b9gs5wvy-cmyk.github.io/dead-harvest/"><img src="https://img.shields.io/badge/%E2%96%B6%20PLAY%20DEAD%20HARVEST-2ea44f?style=for-the-badge" alt="Play Dead Harvest" height="40"></a>
  &nbsp;
  <a href="https://85b9gs5wvy-cmyk.github.io/dead-harvest/test.html"><img src="https://img.shields.io/badge/%E2%96%B6%20TEST%20PLAY-0969da?style=for-the-badge" alt="Test Play" height="40"></a>
</p>

A single-file 3D survival game that runs in your browser. Click **PLAY** above to launch it, no install needed.

**PLAY** opens the live game (`index.html` on GitHub Pages). **TEST PLAY** opens a separate test build at `/test.html`. The live Play page stays as it is until a main release is explicitly ready.

**Current version:** v0.26.0

Live Play (`index.html`) is v0.26.0. The test builds are titled v0.26.0-campaign-nov5 (`test.html`, `campaign-test.html`, `functional-test.html`, and `plot-viewer.html`).

## Controls (PC)
- Click the game to lock the mouse, then move with WASD and look with the mouse.
- Esc or ☰ opens the menu (graphics, sound, mouse sensitivity, shortcuts).
- F4 or the GFX button raises the graphics level. The game starts on LOW.

## Files
- `index.html`: the whole game. GitHub Pages serves it at the PLAY link above. Dead-tree instances each get their own colour tint. Vehicle death respawn and driving reach are in this build (ported into Main Play in PR #20). Plot 1 doorway clearance, Plot 5 lobby seating, the rear pumper, the upstairs restroom bin, and the Plot 6 front-gate approach are in this file. Plot 3’s upper ceiling and Plot 4’s ward beds were checked in source and left unchanged. The test pages and `plot-viewer.html` still have the previous coordinates.
- `test.html`: separate test build. TEST PLAY links to `/test.html`. It does not replace `index.html`. PR #16 fixed vehicle death respawn and driving reach on this page: dying in a car, bike, or bus moves that vehicle to the farm, later driving keeps it there, and reach checks follow the driven vehicle. The same fix is in `campaign-test.html` and `functional-test.html`. The dead-tree colour fix is included here too.
- `campaign-test.html`: developer campaign tester only. Potato graphics and on-screen diagnostics, not the normal game graphics. Its saves and settings use harness keys only (`dhSaveHarness`, `dhSaveVerHarness`, `dhGfxHarness`, `dhCtlHarness`, `dhLockV1Harness`, `dhFpsHarness`, `dhSensHarness`, `dhMuteHarness`). [Campaign tester](https://85b9gs5wvy-cmyk.github.io/dead-harvest/campaign-test.html) (not normal graphics). Includes the PR #16 vehicle fix and the dead-tree colour fix.
- `functional-test.html`: diagnostic ultra-low renderer for campaign, build, and raid checks. Not the normal game look, and not a graphics setting in the playable builds. [Low graphics test](https://85b9gs5wvy-cmyk.github.io/dead-harvest/functional-test.html) (diagnostic). It cannot verify lighting, shadows, fog, glows, or distant scenery. Its saves and settings use `dhSaveFunctional`, `dhSaveVerFunctional`, `dhGfxFunctional`, `dhCtlFunctional`, `dhLockV1Functional`, `dhFpsFunctional`, `dhSensFunctional`, and `dhMuteFunctional` only. Includes the PR #16 vehicle fix and the dead-tree colour fix.
- `plot-viewer.html`: isolated plot and compound viewer, not the game and not the low-graphics gameplay page. Loaded in headless Chrome with SwiftShader (software WebGL, not a discrete GPU) for `?plot=1`, `?plot=15&ctx=2`, `?plot=24`, `?gfx=0`, `?gfx=3`, and `?comp=farm`, `sawmill`, `quarry`, `cemetery`, and `h9`. Each of those loads reached the viewer ready state, reported in-viewer region parity PASS, kept storage in memory (`blockedWrites` 0), and produced a screenshot. Measured frame rate on that software renderer was about 1–4 frames per second at 1280×720 depending on the selection. That number is not a real GPU frame rate. The attached 58/58 figure is still only the old static jsdom construction sweep; it was not re-run after the dead-tree colour fix. [Developer viewer](https://85b9gs5wvy-cmyk.github.io/dead-harvest/plot-viewer.html). Query: `?plot=1` through `24`, `?ctx=0`, `1`, or `2`, `?gfx=0` through `3`, and `?comp=farm`, `sawmill`, `quarry`, `cemetery`, or `h9`. Example: `plot-viewer.html?plot=15&ctx=2`. It keeps saves in memory and does not write the live Play save. Notes: `docs/plot-viewer/`.
- `test/`: Node regression checks for the pages above. They do not change save-key names.
- `docs/plot-viewer/`: source notes and the browser-check record for the viewer.

Live Play saves and settings stay on `index.html` keys: `dhSave`, `dhSaveVer`, `dhGfx2`, `dhCtl`, `dhLockV1`, `dhFps`, `dhSens`, and `dhMute`. TEST PLAY uses `dhSaveTest`, `dhSaveVerTest`, `dhGfxTest`, `dhCtlTest`, `dhLockV1Test`, `dhFpsTest`, `dhSensTest`, and `dhMuteTest`. The low graphics test uses only the `Functional` keys above. Neither that page nor the developer viewer writes the live Play keys.
