# Dead Harvest

<p align="center">
  <a href="https://85b9gs5wvy-cmyk.github.io/dead-harvest/"><img src="https://img.shields.io/badge/%E2%96%B6%20PLAY%20DEAD%20HARVEST-2ea44f?style=for-the-badge" alt="Play Dead Harvest" height="40"></a>
  &nbsp;
  <a href="https://85b9gs5wvy-cmyk.github.io/dead-harvest/test.html"><img src="https://img.shields.io/badge/%E2%96%B6%20TEST%20PLAY-0969da?style=for-the-badge" alt="Test Play" height="40"></a>
</p>

A single-file 3D survival game that runs in your browser. Click **PLAY** above to launch it, no install needed.

**PLAY** opens the live game (`index.html` on GitHub Pages). **TEST PLAY** opens a separate test build at `/test.html`. The live Play page stays as it is until a main release is explicitly ready.

**Current version:** v0.24.1

## Controls (PC)
- Click the game to lock the mouse, then move with WASD and look with the mouse.
- Esc or ☰ opens the menu (graphics, sound, mouse sensitivity, shortcuts).
- F4 or the GFX button raises the graphics level. The game starts on LOW.

## Files
- `index.html`: the whole game. GitHub Pages serves it at the PLAY link above.
- `test.html`: separate test build. TEST PLAY links to `/test.html`. It does not replace `index.html`.
- `campaign-test.html`: developer campaign tester only. Potato graphics and on-screen diagnostics, not the normal game graphics. Its saves and settings use harness keys only (`dhSaveHarness`, `dhSaveVerHarness`, `dhGfxHarness`, `dhCtlHarness`, `dhLockV1Harness`, `dhFpsHarness`, `dhSensHarness`, `dhMuteHarness`). [Campaign tester](https://85b9gs5wvy-cmyk.github.io/dead-harvest/campaign-test.html) (not normal graphics).
- `functional-test.html`: diagnostic ultra-low renderer for campaign, build, and raid checks. Not the normal game look, and not a graphics setting in the playable builds. [Functional test](https://85b9gs5wvy-cmyk.github.io/dead-harvest/functional-test.html) (diagnostic). It cannot verify lighting, shadows, fog, glows, or distant scenery. Its saves and settings use `dhSaveFunctional`, `dhSaveVerFunctional`, `dhGfxFunctional`, `dhCtlFunctional`, `dhLockV1Functional`, `dhFpsFunctional`, `dhSensFunctional`, and `dhMuteFunctional` only.

Live Play saves and settings stay on `index.html` keys: `dhSave`, `dhSaveVer`, `dhGfx2`, `dhCtl`, `dhLockV1`, `dhFps`, `dhSens`, and `dhMute`. TEST PLAY uses `dhSaveTest`, `dhSaveVerTest`, `dhGfxTest`, `dhCtlTest`, `dhLockV1Test`, `dhFpsTest`, `dhSensTest`, and `dhMuteTest`. Neither test page writes the live keys, so a test session leaves the live Play save untouched. The functional page does not write those keys either.
