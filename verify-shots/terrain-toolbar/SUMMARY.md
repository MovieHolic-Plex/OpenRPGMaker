# Terrain icon dock and modal guide

Actual Firefox editor capture in an isolated 40×30 Beodeul map. The canonical host project was not changed.

- Ten SVG tool buttons have accessible names and preserve selected/toggle states.
- Height settings are grouped above the fixed tool row; surface/river only show their relevant settings.
- Returning to a basic brush closes the design panel. Native Beodeul house palette has six adjustable styles.
- Four help pages, keyboard tooltip, Tab wrapping, Escape closing only help, opener focus restoration, background shortcut isolation and backdrop dismissal were confirmed.
- Real pointer gestures raised 497 cells, produced one editable road, and painted a river; reachability toggles remain functional.
- At 1024×768 every bottom tool button is on screen and wins its actual hit test. Browser page errors: zero.
- `project.sqlite` AI conversations and isolated browser AI record stores were empty.

## Screen evidence

| File | View |
|---|---|
| 01-height-dock.png | Compact icon dock and grouped height settings |
| 02-surface-dock.png | Material/width only |
| 03-native-house.png | Native house styles |
| 04-help-order.png | Terrain creation order and readable note |
| 05-help-house-road.png | House, roof and road instructions |
| 06-hill.png | Height brush result |
| 07-terrain-result.png | Height/road/river gestures |
| 08-compact-dock.png | Narrow editor |
| 09-compact-help.png | Narrow modal |

Replay: `TERRAIN_TOOLBAR_BROWSER=firefox TERRAIN_TOOLBAR_URL=http://127.0.0.1:9833 node scripts/capture/capture-terrain-toolbar.mjs`.
The capture defaults to Chromium with a real 2× screencast. Development Chromium module loads were interrupted by `ERR_NETWORK_CHANGED`; Firefox completed this check. Installed Chromium replay/MP4 uses `scripts/capture/capture-terrain-toolbar-host.mjs` and checks the shipped package.

Per AGENTS.md, gates, vitest and full typecheck were not run. Changed TypeScript files passed syntax transpilation; capture scripts passed `node --check`. Packaged web and Electron builds completed; the export player is built before deployment.
