# LOC-ADOPT — layout-region adoption workbench (browser evidence)

Captured against `http://127.0.0.1:9862/?blankProject=1` at 1440x960, editor standard mode.
Two builder maps were seeded through the real store with the exact `layoutPlan` shape
`village/builder.ts` and `largeRiverMarketVillageBuild.ts` write. No page errors were
raised (the Vite HMR websocket and the intentional `?blankProject=1` autosave-disabled
notices are filtered as environment noise).

- `01-layer-inline-survey.png` — Location layer inspector counts before anything is written: 이 맵의 기본 역할(광장 · 장터·상점가) 승격 후보 2개
- `02-survey-readonly.png` — Survey window: per-map candidates, role filter, nothing selected. "설계 기록이 있는 맵 2개 · 지금 필터로 승격 후보 3개. 고른 맵이 없어 실행해도 아무것도 바뀌지 않습니다."
- `03-role-filter-widened.png` — Turning 집 롯 on re-counts live — 3 → 5 candidates. "설계 기록이 있는 맵 2개 · 지금 필터로 승격 후보 5개. 고른 맵이 없어 실행해도 아무것도 바뀌지 않습니다."
- `04-adopted-one-map.png` — Adopted 2 areas into map_blank_start only; the other builder map is untouched. 실행 결과구역 2개 생성.되돌리기 한 번(Ctrl+Z, '설계 영역 이관')이면 이 실행 전체가 사라집니다.
- `05-idempotent-second-run.png` — Second run created nothing: "실행 결과이미 전부 승격돼 있습니다(2개 건너뜀). 두 번 돌려도 늘지 않습니다.되돌리기 한 번(Ctrl+Z, '설계 영역 이관')이면 이 실행 전체가 사라집니다." — still 2 areas.
- `06-single-undo.png` — One undo removed the entire multi-area adoption; layoutPlan still has its five regions.

Machine assertions that ran alongside the shots:
- seeding a `layoutPlan` creates **no** `locations` field;
- opening the survey adopts nothing (`locations` still absent on every map);
- `house` is off by default and the panel states `houseProtection` as the reason;
- adopting with one map checked leaves the other builder map at `locations == null`;
- `layoutPlan.regions` still holds all five regions after the run and after undo;
- the second run reports "이미 전부 승격돼 있습니다" and the count stays at 2;
- a single `undoMapEdit()` removes the whole adoption.

Replay: `DEV_SERVER_PORT=9862 npm run dev:worktree` then
`ADOPTION_QA_URL=http://127.0.0.1:9862 node scripts/qa/map-location-adoption.mjs`.
