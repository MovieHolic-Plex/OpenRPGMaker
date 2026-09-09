# source-build-ui input lifecycle + visual corrections

Independent RED preserved:
- `independent/BoundaryVerify.json`
- `independent/VisualVerify.json` and its PNGs

## 3 RED → GREEN controls (`test/spatialSourceBuildUiBoundary.test.ts`)

1. SBUI-BOUNDARY-01 — `store.replaceProject` coincident map: fields bind to `spatialProjectKey()`, B cannot Build/Apply with A's dest.
2. SBUI-BOUNDARY-02 — empty/`1.5`/unsafe seed rejected; field keeps the typed text; explicit `0` builds.
3. SBUI-BOUNDARY-03 — entry X=-1 rejected **before** `previewSpatialSourceBuild` pins input; correcting to 1 Builds.

No backend lineage/ownership/controller change. No silent cancel.

## Visual (V-*)

- V-SELECTOR-GROUP: original `.spatial-mode/.spatial-action` group restored; seed has own rules.
- V-JSON-TOOLBAR: frozen input is a 24px nowrap summary + `data-*` attrs, not JSON in `.spatial-actions`. Build height 32px (was 112).
- V-1024-TARGET-OFFSCREEN: 시공 대상 lives in chrome `spatial-build-panel`; map box y=216 at 1024 (was 726).
- V-1024-CANVAS-COLLAPSE: drawer canvas `min-height: 160px`; 1024 objects canvas height 281 (was 24).
- V-CJK-FIELD-WRAP: field labels `white-space: nowrap`; 너비/높이/진입 stay one line.

## Verification

- vitest 14/14 `spatialSourceBuildUi*.test.ts` (lock, original deadlines)
- `npm run typecheck:app` exit 0
- css gate hexLiterals 1668→1668 exit 0 (no baseline bump)
- Chromium `:44191` 1024/1280/1440 Playwright `fill`+`click`, cleanup true, 9888 untouched

Layout/control placement changed (targets in chrome panel). Independent visual reviewer should recapture; this is not a silent CSS-only tweak.
