# Plot viewer handoff note

`plot-viewer.html` is the attached Will viewer (`dhv-1.1`, built `2026-11-06T23:20:02.486Z`, baseline campaign file md5 `1aea5a0a56af8c85ddb2d465342cf72b`). That baseline is not repo `index.html`.

One addition was required for a normal browser: `DHV_SCOPE_BRIDGE` at the end of the game script. Later `<script>` tags cannot see that script’s `let`/`const` bindings (`scene`, `cam`, `ren`, and the rest). The bridge publishes those existing objects. It does not copy meshes, rewrite geometry attributes, or edit collider arrays.

`PARITY.md` and `README.md` in this folder are the attached reports. Their **58/58** rows are static jsdom construction checks from that handoff. This repository did not re-run them, and they are not a browser, pixel, or frame-rate result. The page is not hosted until the review PR is merged.
