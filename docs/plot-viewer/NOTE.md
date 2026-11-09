# Plot viewer handoff note

`plot-viewer.html` is the attached Will viewer (`dhv-1.1`, built `2026-11-06T23:20:02.486Z`, baseline campaign file md5 `1aea5a0a56af8c85ddb2d465342cf72b`). That baseline is not repo `index.html`.

One addition was required for a normal browser: `DHV_SCOPE_BRIDGE` at the end of the game script. Later `<script>` tags cannot see that script’s `let`/`const` bindings (`scene`, `cam`, `ren`, and the rest). The bridge publishes those existing objects. It does not copy meshes, rewrite geometry attributes, or edit collider arrays.

`PARITY.md` and `README.md` in this folder still contain the attached reports. Their **58/58** rows are static jsdom construction checks from that handoff. This repository did not re-run that sweep. It is not a browser, pixel, or frame-rate result, and it predates the dead-tree colour fix in the embedded game copy.

## Browser check (headless Chrome, SwiftShader)

The page was loaded in headless Chrome. The in-game readout reported the GPU as SwiftShader (`Google, Vulkan 1.3.0 (SwiftShader Device (Subzero))`), software WebGL, window about 1280×720. That is not a discrete-GPU frame rate.

| Query | Loaded | In-viewer parity | Storage | Approx. rAF |
|---|---|---|---|---|
| `?plot=1` | yes | PASS | in memory, 0 real writes | 1.4 fps |
| `?plot=15&ctx=2` | yes | PASS | in memory, 0 real writes | 1.6 fps |
| `?plot=24` | yes | PASS | in memory, 0 real writes | 3.2 fps |
| `?gfx=0` (Plot 1, High) | yes | PASS | in memory, 0 real writes | 1.1 fps |
| `?gfx=3` (Plot 1, Potato) | yes | PASS | in memory, 0 real writes | 4.2 fps |
| `?comp=farm` | yes | PASS | in memory, 0 real writes | 2.4 fps |
| `?comp=sawmill` | yes | PASS | in memory, 0 real writes | 1.9 fps |
| `?comp=quarry` | yes | PASS | in memory, 0 real writes | 1.6 fps |
| `?comp=cemetery` | yes | PASS | in memory, 0 real writes | 2.2 fps |
| `?comp=h9` | yes | PASS | in memory, 0 real writes | 3.6 fps |

No console errors or warnings were recorded on these loads. Screenshots were taken. The frame times above are a few software-rendered frames after load, so they are a rough order of magnitude only.

Not checked in a browser: the other plots, `mode=gen`, `story=0`, other margins, pointer lock, audio, long play, or a real GPU. The Chapter 1 intro popup still describes the farm car even when the viewer opens on another plot or compound. That text is the story script, not a failed load. The page is not hosted until the review PR is merged.
