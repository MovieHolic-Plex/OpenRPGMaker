# OPRN-OUT-020 — named map location layer (browser evidence)

Captured against `http://127.0.0.1:9854/?blankProject=1` at 1440x900, editor standard mode.
No page errors were raised during the run (the Vite HMR websocket and the intentional
`?blankProject=1` autosave-disabled notices are filtered as environment noise).

- `01-toolbar-toggle.png` — Location layer toggle sits in the canvas toolbar in every edit mode.
- `02-layer-on-empty.png` — Layer on: inspector explains that dragging an empty area creates a named area.
- `03-drawing-drag.png` — Drag preview shows the live tile size while the rectangle is drawn.
- `04-drawn-and-selected.png` — Released drag creates the area, selects it and focuses the name field.
- `05-named.png` — Named the area. ID loc1 — 이름을 바꿔도 이 ID 를 가리키는 조건·인카운터는 그대로입니다.
- `06-renamed-same-id.png` — Renamed to 중앙 광장 — the stable id line is unchanged.
- `07-pan-tool-moves-map.png` — 화면 밀기 드래그: 카메라 -407,-268 → -337,-228 · 구역 3,3,9,7 유지 · 상자 508,287
- `08-space-pan-keeps-location.png` — 스페이스 팬: 구역 3,3,9,7 · 구역 수 1 유지 · 상자 448,227
- `09-wheel-pan-follows.png` — 휠 팬 scrollY -198 → -132, Ctrl+휠 zoom 2 → 3 · 상자 324,-96
- `10-layer-draw-still-works.png` — 레이어 자신의 제스처 유지: 구역 1 → 2개
- `11-referenced-by-encounter.png` — Random encounter now points at the named area: 이 구역을 가리키는 참조 1건.
- `12-broken-reference-repair.png` — Deleting a referenced area surfaces the diagnostic and its repair buttons.

Replay: `npm run dev:worktree` then
`MAP_LOCATION_QA_URL=http://127.0.0.1:9854 node scripts/qa/map-location-layer.mjs`.
