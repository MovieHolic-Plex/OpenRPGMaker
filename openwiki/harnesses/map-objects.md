# 하네스 · 맵 기물 (`map-objects`, 2026-10-07)

지금 맵의 칩셋(16px)에 없는 물건을 **그 칩셋의 색과 화풍**으로 공방에서 그려, 사람이 고른 것을 **그 칩셋 끝에 굽는다**.
조수의 「없는 타일」 카드에서 「직접 그려 줘」를 누르면 열린다(손 도트 실내 맵은 `interior-props` 가 맡는다).
공방 공용 구조(엔진·저장·모델 표면)는 `openwiki/editor-workshop.md`.

## 흐름

1. **어느 공방인가** — `src/editor/workshop/mapObjectTarget.ts` `currentDrawTarget()`: 지금 맵 칩셋이 `atlas_biome_interior` 면 `interior-props`, 그 밖의 16px 칩셋이면 `map-objects`, 16px 이 아니면 그릴 수 없다(카드가 이유를 말하고 조수가 있는 타일로 대안을 만든다).
2. **정의** — 새 기물 폼(`workshopItemForm.ts`, `session.harnessId === "map-objects"`)이 지금 맵 칩셋 id 와 **팔레트**를 정의에 적는다(`ItemDefinition.tilesetId`·`palette`). 팔레트 = `paletteFromImages`: 이름·설명이 닮은 칩셋 물체 색(가중치 8) + 시트 전체 색, 거의 같은 색(RGB 거리 ≤10)은 하나, 최대 48색, 어두운 것부터. 정의에 넣어 두므로 칩셋이 나중에 바뀌어도 후보 카드는 같은 색으로 그려진다.
3. **그리기** — 실행기 `src/harnesses/map-objects/editor/runner.ts`. 후보 3장(방향 A 칩셋 충실 · B 설명 충실 · C 단순·또렷). 화풍 기준 그림은 그릴 때마다 `WorkshopEnv.tilesetSource(tilesetId)`(편집기 `pixels.ts`: 이식 없는 바탕 시트, 투명색 키 뺌, 구조 킷)에서 잘라 붙인다: 닮은 칩셋 물체 최대 4개(8배, 그 칩셋의 땅 색 위) + 색이 가장 다양한 시트 조각 1장(3배). 칩셋을 못 읽으면 기준 그림 없이 그린다.
4. **검사** — `checks.ts`: 크기, 빈 그림, 위 패딩, 접지선(서 있는 물건은 캔버스 맨 아래), 네 귀퉁이 모두 칠함 = 배경(바닥 무늬는 면제). 검수 코드 STYLE·READ·FRONT·TOPDOWN·MESSY·BG. 꼭대기 행 수 규칙(실내의 `TOP_MIN`)은 없다 — 칩셋마다 3/4 결이 달라서다.
5. **굽기** — `workshopBake.ts` `workshopTargetTileset(item)` = 정의의 칩셋. `project/workshopTiles.ts` `bakeWorkshopObject` 그대로(번들 끝 뒤 이식 + 구조 킷 `workshop:<이름>`). 16px 이 아닌 칩셋이면 거절.
6. **조수가 놓기** — 카드가 `[사용자가 공방에서 그려 넣음] … 물체 id workshop:…` 후속 요청을 보내고, 조수는 `stamp_tileset_object` 의 `objectId` 로 놓는다(`list_tileset_objects` 에도 나온다).

## 번호 이주

번들 칩셋은 판이 바뀌면 칸이 끝에 덧붙는다. 공방 칸이 그 자리를 먼저 차지하면 겹치므로
`ensureBundledTilesets`(`src/project/defaults/defaultAssets.ts`)가 번들 칩셋마다 ensure 들을 돌리기 전에 공방 칸을 떼어 두고(`detachWorkshopTiles`)
끝난 뒤 새 끝 뒤에 다시 붙인다(`attachWorkshopTiles`, 번호가 바뀌면 그 칩셋을 쓰는 맵의 네 층과 킷을 고친다).
손 도트 실내는 자기 ensure(`ensureAtlasBiomeInteriorCurrent`)가 같은 일을 하므로 건너뛴다. 업로드 칩셋은 번들 ensure 를 타지 않아 이주가 필요 없다.
공방 칸 뒤에 다른 이식(생성 건물 시트 등)이 붙어 있으면 `detachWorkshopTiles` 가 손대지 않는다(null).

## 시험

- `test/workshop/mapObjectsRunner.test.ts` — 팔레트 뽑기·물체 고르기·깨짐 검사·실행기 지시문(칩셋 그림 첨부, 칩셋 없을 때).
- `test/workshop/workshopTiles.test.ts` 「맵 기물: 실내가 아닌 칩셋에 굽기」 — 빈 프로젝트 첫 맵 칩셋에 굽고 `ensureBundledTilesets` 뒤에도 칸·맵이 그대로, 조수 도구로 놓기.
