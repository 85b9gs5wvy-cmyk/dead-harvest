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
- `campaign-test.html`: developer campaign tester only. Potato graphics and on-screen diagnostics, not the normal game graphics. Its campaign saves use `dhSaveHarness` and `dhSaveVerHarness`, separate from the live `dhSave`. [Campaign tester](https://85b9gs5wvy-cmyk.github.io/dead-harvest/campaign-test.html) (not normal graphics).

TEST PLAY uses the same browser save names as PLAY (`dhSave`, `dhSaveVer`, `dhGfx2`). On this site those two pages share storage, so a test session can read or write the live Play save. The campaign tester does not write those save keys.
