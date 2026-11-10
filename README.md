# Dead Harvest

<p align="center">
  <a href="https://85b9gs5wvy-cmyk.github.io/dead-harvest/"><img src="https://img.shields.io/badge/%E2%96%B6%20PLAY-2ea44f?style=for-the-badge" alt="Play" height="40"></a>
  &nbsp;
  <a href="https://85b9gs5wvy-cmyk.github.io/dead-harvest/test.html"><img src="https://img.shields.io/badge/%E2%96%B6%20TEST%20PLAY-0969da?style=for-the-badge" alt="Test Play" height="40"></a>
  &nbsp;
  <a href="https://85b9gs5wvy-cmyk.github.io/dead-harvest/functional-test.html"><img src="https://img.shields.io/badge/%E2%96%B6%20LOW%20GRAPHICS%20PLAY-6e7781?style=for-the-badge" alt="Low Graphics Play" height="40"></a>
  &nbsp;
  <a href="https://85b9gs5wvy-cmyk.github.io/dead-harvest/plot-viewer.html"><img src="https://img.shields.io/badge/%E2%96%B6%20PLOT%20VIEWER-9a6700?style=for-the-badge" alt="Plot Viewer" height="40"></a>
</p>

A browser survival game. No install.

**PLAY** is the full game (`index.html`).

**TEST PLAY** is the separate mission test (`test.html`). It is not the full game.

**LOW GRAPHICS PLAY** is the existing simpler renderer (`functional-test.html`) for machines that struggle with the full game. It is a playable page with its own save keys. Shadows, fog, and fine lighting are simplified, so it does not look like the full game. It has not been timed on a phone or a discrete GPU here.

**PLOT VIEWER** is a low-graphics inspection page (`plot-viewer.html`). It loads one plot or one compound from the game’s building code so doors, furniture, and stairs can be checked. It is not a way to play the game, and it does not save.

Download the viewer file: [plot-viewer.html](https://github.com/85b9gs5wvy-cmyk/dead-harvest/blob/main/plot-viewer.html) ([raw](https://github.com/85b9gs5wvy-cmyk/dead-harvest/raw/main/plot-viewer.html)). The generator is `node tools/build-plot-viewer.mjs`. It reads `index.html` and does not keep a second copy of the layouts.

## Plot viewer controls

Open `plot-viewer.html?plot=1` or pick a plot in the box at the bottom. `?plot=7` and `?plot=15` work, including buildings that have no facade sign. `?comp=farm`, `sawmill`, `quarry`, `cemetery`, or `h9` opens that compound.

Click the view, then WASD to walk and the mouse to look. F uses doors. `[` and `]` change floor. `=` switches Walk and Orbit. Drag to look around in Orbit. Shift-drag moves the look point. `C` or Cutaway hides the roof and upper floors for the current storey. That hide is only visual. Collision and the building stay as they are in the game. Graphics stay simple: no shadows, no fog, no gun model, no story box.

The farm, sawmill, quarry, and cemetery still get built in the background because the game code expects them. Other city buildings are not built. The page keeps saves in memory and does not write the Play, Test Play, or Low Graphics Play saves.

## Notes

Older notes about the site, the test pages, and earlier viewer checks are in `docs/plot-viewer/`. Campaign testing remains at `campaign-test.html` for developers. It is not one of the four buttons above.
