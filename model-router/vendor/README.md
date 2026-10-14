# vendor/

Third-party files bundled with the extension so the canvas works offline.

## `three.module.min.js`

| | |
|---|---|
| Package | [`three`](https://www.npmjs.com/package/three) |
| Version | `0.180.0` |
| Source | `https://unpkg.com/three@0.180.0/build/three.module.min.js` |
| Companion | `three.core.min.js` (381,124 bytes) — imported by the module build, same source and version |
| Size | 338,908 bytes (module) + 381,124 bytes (core) |
| License | MIT |

Used by the **3D** tab of the model router canvas to draw the model landscape
(price × quality × speed). The extension serves this file over its own loopback
server as `GET /vendor/three.module.min.js`, and the tab imports it on demand the
first time it is opened. If the import fails the tab shows a short message and
points at the **Comparativa** tab, which carries the same data in 2D.

Nothing here is modified from the published build. To upgrade, re-download the
file from the URL above and update the version and size in this table.
