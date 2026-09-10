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
- `07-right-drag-yielding.png` — 우클릭 영역 드래그: 오버레이가 is-yielding 으로 물러나며 캔버스로 실시간 영역 피드백을 전달.
- `08-right-drag-chips-visible.png` — 우클릭 드래그 완료: 선택 영역 확정 및 선택 액션 칩 바(AI 칩 포함) 노출, 구역 좌표/카메라 불변.
- `09-right-click-spoid.png` — 우클릭 타일 집기(스포이트): 탭한 자리에 따라 결과가 갈린다(심은 타일 360 ≠ 잔디 240) · 구역 생성 없음.
- `10-paste-preview-confirm.png` — 붙여넣기 미리보기 클릭 확정: 레이어가 켜져 있어도 타일 클릭 시 붙여넣기가 확정되고 새 구역이 생성되지 않음.
- `10-pan-tool-moves-map.png` — 화면 밀기 드래그: 카메라 -407,-268 → -337,-228 · 구역 3,3,9,7 유지 · 상자 508,287
- `11-space-pan-keeps-location.png` — 스페이스 팬: 구역 3,3,9,7 · 구역 수 1 유지 · 상자 448,227
- `12-wheel-pan-follows.png` — 휠 팬 scrollY -198 → -132, Ctrl+휠 zoom 2 → 3 · 상자 324,-96
- `13-select-drag-outside-pans.png` — 선택 도구 + 맵 밖 드래그: 맵 경계 밖 좌클릭 드래그가 카메라를 팬하고 구역을 만들거나 옮기지 않음.
- `14-gesture-disable-layer-and-redraw.png` — 제스처 중 레이어 끄기: is-yielding 정리 후 재활성화 빈 곳 드래그 구역 1 → 2개 생성 정상.
- `15-referenced-by-encounter.png` — Random encounter now points at the named area: 이 구역을 가리키는 참조 1건.
- `16-broken-reference-repair.png` — Deleting a referenced area surfaces the diagnostic and its repair buttons.

Replay: `npm run dev:worktree` then
`MAP_LOCATION_QA_URL=http://127.0.0.1:9854 node scripts/qa/map-location-layer.mjs`.
