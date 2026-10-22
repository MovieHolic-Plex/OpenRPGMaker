# 하네스 · 맵 기물 (`map-objects`, 2026-10-07)

지금 맵의 칩셋(16px)에 없는 물건을 **그 칩셋의 색과 화풍**으로 공방에서 그려, 사람이 고른 것을 **그 칩셋 끝에 굽는다**.
조수의 「없는 타일」 카드에서 「직접 그려 줘」를 누르면 열린다(손 도트 실내 맵은 `interior-props` 가 맡는다).
공방 공용 구조(엔진·저장·모델 표면)는 `openwiki/editor-workshop.md`.

## 흐름

1. **어느 공방인가** — `src/editor/workshop/mapObjectTarget.ts` `currentDrawTarget()`: 지금 맵 칩셋이 `atlas_biome_interior` 면 `interior-props`, 그 밖의 16px 칩셋이면 `map-objects`, 16px 이 아니면 그릴 수 없다(카드가 이유를 말하고 조수가 있는 타일로 대안을 만든다).
2. **정의** — 새 기물 폼(`workshopItemForm.ts`, `session.harnessId === "map-objects"`)이 지금 맵 칩셋 id 와 **팔레트**를 정의에 적는다(`ItemDefinition.tilesetId`·`palette`). 팔레트 = `paletteFromImages`: 이름·설명이 닮은 칩셋 물체 색(가중치 8) + 시트 전체 색, 거의 같은 색(RGB 거리 ≤10)은 하나, 최대 48색, 어두운 것부터. 정의에 넣어 두므로 칩셋이 나중에 바뀌어도 후보 카드는 같은 색으로 그려진다.
3. **그리기** — 실행기 `src/harnesses/map-objects/editor/runner.ts`. 후보 3장(방향 A 칩셋 충실 · B 설명 충실 · C 단순·또렷). 화풍 기준 그림은 그릴 때마다 `WorkshopEnv.tilesetSource(tilesetId)`(편집기 `pixels.ts`: 이식 없는 바탕 시트, 투명색 키 뺌, 구조 킷)에서 잘라 붙인다: 닮은 칩셋 물체 최대 4개(8배, 그 칩셋의 땅 색 위) + 색이 가장 다양한 시트 조각 1장(3배). 칩셋을 못 읽으면 기준 그림 없이 그린다.
4. **그리기·검사·검수 = object-gen 흐름**(2026-10-21) — 맵 기물은 모두 새 기물이라 `objectGenFlow.ts` 로 돈다: 참고 그림 2장 → 원본 draw_brief(방향 A·B 후보 둘) → 미리보기 고치기(원본 기계 검사 `ogCheck`) → 숨긴 반려 표본을 섞은 블라인드 판정 유효 3판 다수결 → 불통과 한 번 다시 → 고르기 3판 다수결. 예전 한국어 지시문·`mapObjectHardCheck`·`mapObjectGate`(`checks.ts`·`prompts.ts`)는 실행기에서 빠졌다. 다 그린 후보에 3/4 관문 조언 배지가 붙는다(막지 않음). 자세히: `openwiki/editor-workshop.md` 「새 기물은 object-gen 흐름 그대로 그린다」.
5. **크기·큰 물건**(2026-10-22) — 칸 수는 조수 도구가 크기 사전으로 정한다(`footprint.ts`, `openwiki/editor-ai-tools.md` 「크기 결정」). 한도 6×(발밑 4)+위 64px, 전체 6칸 키(`items.ts` `MAX_TILES_W/H`·`MAX_RISE`, `objectGenLimits`). 5×4 노점·4×3 분수·2×3 나무까지 한 격자로 그려 한 킷으로 굽는다(발밑 줄 막힘·위 줄 지나감). 참고 그림 견본은 물체 비율 캔버스에 이름 맞는 칩셋 물체 + object-gen 견본(`runner.referenceAnchor`).
5. **굽기** — `workshopBake.ts` `workshopTargetTileset(item)` = 정의의 칩셋. `project/workshopTiles.ts` `bakeWorkshopObject` 그대로(번들 끝 뒤 이식 + 구조 킷 `workshop:<이름>`). 16px 이 아닌 칩셋이면 거절.
6. **조수가 놓기** — 카드가 `[사용자가 공방에서 그려 넣음] … 물체 id workshop:…` 후속 요청을 보내고, 조수는 `stamp_tileset_object` 의 `objectId` 로 놓는다(`list_tileset_objects` 에도 나온다).

7. **조수 도구 경로**(2026-10-21) — 조수가 `generate_missing_object` 를 부르면 카드가 폼 없이 같은 정의(팔레트 `mapObjectPalette`)로 판을 돌린다. `openwiki/editor-ai-tools.md` 「없는 기물 그리기」.

## 번호 이주

번들 칩셋은 판이 바뀌면 칸이 끝에 덧붙는다. 공방 칸이 그 자리를 먼저 차지하면 겹치므로
`ensureBundledTilesets`(`src/project/defaults/defaultAssets.ts`)가 번들 칩셋마다 ensure 들을 돌리기 전에 공방 칸을 떼어 두고(`detachWorkshopTiles`)
끝난 뒤 새 끝 뒤에 다시 붙인다(`attachWorkshopTiles`, 번호가 바뀌면 그 칩셋을 쓰는 맵의 네 층과 킷을 고친다).
손 도트 실내는 자기 ensure(`ensureAtlasBiomeInteriorCurrent`)가 같은 일을 하므로 건너뛴다. 업로드 칩셋은 번들 ensure 를 타지 않아 이주가 필요 없다.
공방 칸 뒤에 다른 이식(생성 건물 시트 등)이 붙어 있으면 `detachWorkshopTiles` 가 손대지 않는다(null).

## 시험

- `test/workshop/mapObjectsRunner.test.ts` — 팔레트 뽑기·물체 고르기·깨짐 검사·실행기 지시문(칩셋 그림 첨부, 칩셋 없을 때).
- `test/workshop/workshopTiles.test.ts` 「맵 기물: 실내가 아닌 칩셋에 굽기」 — 빈 프로젝트 첫 맵 칩셋에 굽고 `ensureBundledTilesets` 뒤에도 칸·맵이 그대로, 조수 도구로 놓기.
