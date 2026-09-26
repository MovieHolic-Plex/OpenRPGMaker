> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

## 절벽 높이 도구 — read_relief · sculpt_relief · check_relief (2026-09-26)

`src/editor/tools/reliefTools.ts`, 레지스트리에는 `withDomain(RELIEF_TOOLS, "map")`. 왜: 절벽을 타일 번호로 깔면 윗단·몸통·대각선 모서리를 칸마다
골라야 해서 조수가 거의 항상 틀렸다. 높이 칸만 정하면 렌더러가 벽·대각선·가림을 그린다 — 조수는 「어디가 몇 단인가」만 말한다.

| 도구 | 인자 | 동작 |
|---|---|---|
| `read_relief` (읽기) | `mapId` | `data.matrix` 36진수 행렬(한 줄=한 행, 0~9·a=10…e=14) + `data.check` 검사 글. relief 없는 맵은 전부 0 |
| `sculpt_relief` (쓰기) | `mapId`, `ops[]`, `seed?`, `reset?` | ops DSL(`src/project/relief/ops.ts` `RELIEF_OPS_SPEC` — fill·rect·plateau·mountain·ridge·canyon·terraces·rough·smooth)을 **지금 높이 위에** 차례로 적용(`reset:true` 면 0단에서). 모르는 op 은 `warnings`. 결과가 평지면 `relief` 삭제. 검사 글을 `data.check` 로 돌려준다 |
| `check_relief` (읽기) | `mapId` | 규칙에 깎인 칸·남쪽 땅에 가려진 구역·12칸 이상 일직선 벽 + 고칠 방향 |

- `ops` 가 `{op:string}` 객체 배열이 아니면 `ToolError` `invalid-args`(예시 포함).
- `sculpt_relief` 는 `MAP_ONLY_WRITE_TOOLS`(`applyChangesetToStore.ts`·`editorToolHook.ts`)에 있어 맵 단위 체크포인트를 쓴다. 변경은 맵 속성 변경으로 잡혀 검토 대상이다.
- 타일을 고르지 않으므로 `tilesetReferenceTools` 의 WRITERS/TILE_CHOOSERS, 패널 `MAP_TILE_TOOLS` 에는 넣지 않았다.
- `docs/tool-catalog.md` 는 손으로 세 줄을 넣었다(생성 스크립트가 vitest 를 돌려 실행하지 않음) — 다음 재생성 때 확인.

## 조수 쓰기 도구의 네 층 — 1~4층·그림자 (MZ식 4층, 2026-09-25)

조수가 2층(바닥 장식)·4층(물체 위 물체)·그림자를 쓴다. 층 번호와 맵 칸 이름의 대응은 `src/project/mapLayers.ts` 가 정본이고,
층을 칠하는 본 도구(paint_tiles·stamp_layer_block) 설명은 `mapHelpers.FOUR_LAYER_GUIDANCE` 한 문장을,
층을 고르기만 하거나 층 설명이 곁가지인 도구(tile_erase·paint_shadow·fill_region·show_map_region)는 같은 뜻의 짧은
`FOUR_LAYER_GUIDANCE_SHORT` 를 쓴다 — 도구 설명은 MZ 가 아닌 프로젝트에도 매번 실리므로 긴 문장은 두 곳에만 둔다
(fill_region 은 「1층을 칠하면 그 칸의 2층 장식을 비운다」를 따로 말한다).
**1층 칠하기 규칙은 하나다:** 1층을 쓰면 그 칸 2층이 지워진다(paint_tiles·fill_region·stamp_layer_block·paint_road 흙길·마을 길
모두). paint_tiles 1층만 옛 동작대로 `setLower` 로 3·4층·그림자까지 비운다 — 안내 문장에 그대로 적혀 있다.
계획: `docs/superpowers/plans/2026-09-25-mz-layers-assistant.md` Task 2·3.

| 도구 | 층 인자 | 계약 |
|---|---|---|
| `paint_tiles` | `layer: "lower"\|"upper"\|"1"\|"2"\|"3"\|"4"` (lower=1, upper=3) | 홈 레이어 라우팅은 1/3층 요청에만 — 2·4층은 명시 선택 그대로. 2·4층은 클러스터 동반 규칙 없이 칸 그대로. `fill` 은 1·2층만 — 2층 fill 은 (1층, 2층) 쌍이 시작 칸과 같은 칸으로만 번진다(빈 2층이 맵 전체로 새지 않게). 3층을 -1 로 비우면 그 칸 4층도 비운다. 통행 경고는 어느 층을 칠해도 낸다. 1층 칠하기는 `setLower` 라 그 칸 2·3·4층·그림자를 비운다. 결과 `data.effectiveLayer` 는 `"1".."4"`(옛 영수증 `"lower"/"upper"` 는 `proposalCompleteness` 가 계속 읽는다). |
| `fill_region` | 같은 enum, 기본 1 | 2층에 채우면 1층은 그대로. 1층 채우기는 그 칸 2층을 비우고, `clearUpper` 는 3·4층을 함께 비운다. |
| `stamp_layer_block` (새) | `layers: {"1"?,"2"?,"3"?,"4"?,shadow?}` 행 배열 | -1 = 건드리지 않음, -2 = 그 층에서 비움. 범위 밖 번호·맵 밖 쓰기 칸이 하나라도 있으면 **아무것도 쓰지 않는다**(맵 밖 -1 칸은 괜찮다). 1층 칸은 그 칸 2층을 비우되 같은 블록의 2층 값이 이긴다. 3·4층은 준 칸만. `reshape:false` 면 1·2층 자동타일을 재성형하지 않는다(참고 예제 번호 그대로). 요약·`data.cells` 에 층별 칸 수. 기존 내용 보호 영역은 1~4층 격자에서 실제로 쓰는 칸(≠ -1)만 — `shadow` 격자는 세지 않는다(`buildSpec.layerBlockRegions`; 그림자만 찍는 블록은 보호할 칸 없음, paint_shadow 와 같다). |
| `paint_shadow` (새) | `cells[{x,y,quarters?,bits?}]`, `mode: set\|add\|clear` | bit0 좌상·bit1 우상·bit2 좌하·bit3 우하. 맵 밖 칸이 섞이면 아무것도 쓰지 않는다. `clear` 에서 quarters/bits 를 빼면 그 칸 그림자 전부. |
| `tile_erase` | `both\|all\|lower\|upper\|1\|2\|3\|4\|shadow` (1=lower, 3=upper) | both=all=칸 전체(1층 바닥 복원 + 2·3·4층·그림자). lower=1층 복원 + 2층, upper=3·4층, 2/4/shadow=그 층만. `kind:"market"` 은 both/lower/upper 만. |
| `clear_region` / `clear_map` | (그대로) | lower 쪽은 2층·그림자, upper 쪽은 4층까지 비운다. |
| `mirror_region` | (그대로) | 선택 층도 옮기고 그림자 사분면을 축에 맞춰 뒤집는다(좌우 tl↔tr·bl↔br). |
| `copy_map_region` | `layers: all\|lower\|upper` | all = 1~4층·그림자, lower = 1·2층, upper = 3·4층. 보호 칸 되돌리기도 다섯 값을 되돌린다. |

- **오토타일 재성형은 칠한 층 배열에서, 바닥 층(1·2층)에서만** 한다(`autotileEngine.autotileLayerView(map, layer)`).
  2층 풀 장식은 2층 이웃 기준으로 가장자리가 잡히고 1층은 안 바뀐다. 1층을 칠한 칸은 2층도 비웠으므로 둘레 2층 장식도 다시 잡는다.
  3·4층은 적은 번호 그대로 둔다 — 옛 `upper` 칠하기와 같다(수관 같은 상위 그룹을 모델이 고른 칸째 보존).
- **옛 맵(선택 칸 없음)은 어떤 도구를 거쳐도 새 키가 생기지 않는다.** 쓰기는 `setLayerTileAt`/`setShadowAt`(빈 값이면 배열을 만들지 않음),
  비운 뒤엔 도구마다 `compactMapLayers`, 그리고 공유 헬퍼(`setLower`)를 쓰는 다른 도구를 위해 `toolRunner.runToolDefinition` 이
  쓰기 실행 직후 한 번 정리한다(`compactTouchedMapLayers`). **정리는 이 도구가 건드린 맵만** — 새 맵, 칸이 바뀐 맵
  (`changeset.tileBuffersDiffer`, 2·4층·그림자 포함), 이번에 선택 칸 키가 새로 생긴 맵. 손대지 않은 맵에 원래 있던 빈 배열은 남긴다
  (지우면 `event_command_assist` 의 「명령 외의 변경」 비교와 맵 단위 되돌리기 스냅샷이 어긋난다).
- **옛 프로젝트에도 보이는 paint_tiles 변화(의도):** 3층(upper) 칠하기도 통행 경고를 낸다(나무·바위를 upper 에 칠하면
  「통행 불가가 되었습니다」), 요약 층 이름표가 `1층 lower` / `3층 upper`, 결과 `data.effectiveLayer` 가 `"1"`..`"4"`
  (옛 `"lower"`/`"upper"` 대신 — 지금 유일한 독자 `proposalCompleteness` 는 둘 다 읽는다). `classifyProposalSafety` 는 새 경고를
  unsafe 로 볼 수 있지만 생산 호출자가 없어 자동 적용에는 영향이 없다.
- 두 새 도구는 맵 단위 되돌리기 목록(`applyChangesetToStore`·`editorToolHook` 의 `MAP_ONLY_WRITE_TOOLS`)과 맵 타일 도구 목록
  (`aiChatPanelHelpers.MAP_TILE_TOOLS`)에 있고, `firstMapWithTileDiff` 는 2·4층·그림자만 바뀐 제안에도 미리보기 맵을 준다
  (없는 칸 = 빈칸).
- 두 새 도구는 참고문서 게이트 목록(`TILESET_REFERENCE_TILE_CHOOSERS`)에 있다. `stamp_layer_block` 은 1·3층을 덮으므로
  기존 내용 보호(`buildSpec.TILE_WRITE_TOOLS`, 영향 영역은 값 ≠ -1 인 칸의 가로 줄)를 받고, 그림자만 쓰는 `paint_shadow` 는 받지 않는다.
- Pi 고스트 증분(`mapDelta.ts`)·`agentGhostPreview`·`changeset.tileBuffersDiffer` 의 네 층 처리는 아래 「조수가 보는 네 층」 표.

### 실행기 계약 — 업로드 타일셋 칩셋 바꿔치기 거부 (2026-09-25)

`toolRunner.runToolDefinition` 은 쓰기 도구가 끝난 draft 를 보고, **사용자가 올린 타일셋(`image.type === "uploaded"`)을 쓰던 기존 맵의
`tilesetId` 가 바뀌었는데 인자 `tilesetId` 가 그 새 값이 아니면** `ToolError` `code: "uploaded-tileset-replaced"`(mapId 포함)로 거부한다
(`rejectUploadedTilesetSwap`). 거부는 draft 를 버리므로 프로젝트는 그대로다. 오류 문장은 모델에게 참고문서(list_tileset_references)를 읽고
paint_tiles·stamp_layer_block 으로 직접 깔라고, 정말 바꾸려면 tilesetId 를 명시하라고 말한다.

- 왜: 실측(2026-09-25 Rasak 얼음 동굴 시험) — 조수가 `run_dungeon_room_pipeline` 을 불러 업로드 타일셋 맵이 `easyrpg_chipset_dungeon` 으로
  바뀌었고, 사용자 타일셋과 그 참고문서는 한 번도 쓰이지 않았다. 번들 전용 시공기(castleBuilder·villageClimate·defaultTileset 등)는
  칩셋을 스스로 정하므로, 도구마다가 아니라 실행기 한 곳에서 막는다.
- 번들 타일셋 맵·새 맵은 검사 대상이 아니다. 칩셋을 일부러 바꾸는 호출(`set_map_properties{tilesetId}` 등)은 인자에 새 id 가 있어 통과한다.
- **빠지는 법(`ToolDefinition.allowsTilesetChange: true`):** 프로젝트를 통째로 되돌리거나 갈아 끼우는 도구만 켠다 — 지금은
  `revert_last_edit`(이전 스냅샷 복원)·`reset_project`(빈 프로젝트로 교체; 같은 맵 id `map_blank_start` 가 기본 칩셋으로 돌아간다) 둘.
  둘 다 tilesetId 인자를 받을 수 없어, 빠지지 않으면 「되돌려」·새 프로젝트가 막힌다(최종 리뷰 Important 1 probe).
  맵 하나를 시공하는 새 도구가 업로드 타일셋 맵의 칩셋을 바꿔야 하면 플래그 대신 `tilesetId` 인자를 받게 하라.
  공간 저작 도구(`apply_spatial_build`·`edit_spatial_occurrence`·`place_concept` canonical)도 프로젝트를 `Object.assign` 으로 바꾸지만
  설계에서 맵을 컴파일하는 도구라 빼지 않았다 — 거기서 칩셋이 바뀌면 역시 말없는 바꿔치기다.
- 회귀: `test/uploadedTilesetSwapGuard.test.ts` — 시험 도구(거부 / tilesetId 명시 통과 `ok:true` / 번들 맵), 실제 회귀
  `run_dungeon_room_pipeline{mapId, replaceExisting:true}` 거부 + 프로젝트 불변, `reset_project`·`revert_last_edit` 통과, 플래그 목록.

### 실행기 계약 — 칩셋 계열 검사 `tileset-family-change` 와 `ask_tileset_change` (2026-09-25)

- `ToolContext` 에 선택 `currentMapId`(사용자가 보고 있는 맵)·`approvedTilesetFamilies`(대화에서 승인한 목표 계열)가 있다.
  Pi 요청 같은 이름 필드 → 워커 ctx, 채팅 세션은 게터로 매 호출 최신 값. 둘 다 없으면 아래 동작이 꺼진다(옛 동작).
- 쓰기 도구 실행 뒤 `rejectTilesetFamilyChange`: 새 맵·`tilesetId` 가 바뀐 맵의 계열(`src/project/tilesetFamily.ts`)이 지금 보는 맵과 다르고
  승인 목록에 없으면 `ToolError{code:"tileset-family-change", mapId}`. 메시지 = 지금 칩셋(이름·계열) → 쓰려던 칩셋, 같은 계열 후보 ≤8,
  「후보로 다시 / 없으면 ask_tileset_change 로 묻고 턴 끝」. `allowsTilesetChange` 도구는 건너뛴다, 읽기 도구는 검사 없음, dryRun 도 검사.
- `ToolDefinition.defaultTilesetId(project)`(create_map 만): tilesetId 없이 불리고 이 기본값이 지금 보는 맵과 다른 계열이면 실행기가 인자에
  지금 보는 맵의 tilesetId 를 넣는다. 같은 계열이면 도구 기본값(숲마을) 그대로.
- `ToolDefinition.fillsCurrentMapId`(ask_tileset_change 만): 비어 있는 `mapId` 인자를 `ctx.currentMapId` 로 채운다.
- `ask_tileset_change{toTilesetId, reason, purpose?, mapId?}` — 읽기·core. 오류 `tileset-not-found`·`tileset-same-family`·`map-not-found`.
  data `{kind:"tileset-change-question", mapId, fromTilesetId, toTilesetId, fromFamily, toFamily, fromLabel, toLabel, reason, purpose}` — 패널
  `aiTilesetChangeCard.ts` 가 턴 끝에 견본 두 장 카드로 띄운다. 전체 흐름은 [teaching-assistant-tilesets.md](teaching-assistant-tilesets.md) 「칩셋 계열 규칙」.
- 회귀: `test/tilesetFamilyGuard.test.ts`(업로드 계열 맵 + 던전 파이프라인 거부 / 같은 계열 통과 / 승인 통과 / currentMapId 없음 / reset·revert /
  create_map 기본 칩셋 두 경우 / easyrpg 통과 / dryRun / ask_tileset_change), `test/tilesetFamily.test.ts`, `test/aiTilesetChangeCard.test.ts`.

### 남은 일 (네 층)

- `scripts/qa-game/render.mts:92` 이식(graft) 원본은 늘 번들로 취급된다 — 업로드 타일셋이 이식 원본이면 기본 칩셋 그림으로 말없이 대신한다.
  옛 동작이지만 새 「기본 칩셋 대체 금지」 주석과 어긋난다(최종 리뷰 Minor 6, 보류).
- 헤드리스 도구 이미지 `renderToolRegionPngBase64` 상한이 1024px 이라 전체 맵 `show_map_region` 한 장이 base64 약 2MB 다. 시험 토큰 비용을
  줄이려면 브라우저와 같은 512 를 검토(최종 리뷰 Minor 9, 보류).
- `show_tile_grid` 는 아직 1·3층만 본다(아래 절).

회귀: `test/mzLayerWriteTools.test.ts`(도구별 + 옛 맵 11 호출 + 「고침 2차」 정리 범위·그림자 보호·목록), `test/uploadedTilesetSwapGuard.test.ts`, `test/autotileLayerView.test.ts`, `test/tilesetTeachingGuards.test.ts`.

## 조수가 보는 네 층 — 읽기 도구·도구 이미지 (MZ식 4층, 2026-09-25)

계획 `docs/superpowers/plans/2026-09-25-mz-layers-assistant.md` Task 1. 쓰기(위 절)와 짝이다.

| 표면 | 계약 |
|---|---|
| `show_map_region` 배열 | 맵에 그 칸이 **있을 때만** `layer2`·`layer4`·`shadow`(사분면 비트 0~15) 2D 배열을 더 싣는다. 없으면 키도 없다 — 옛 맵 출력은 바이트 단위로 같다. 설명에 짧은 `FOUR_LAYER_GUIDANCE_SHORT`. |
| 도구 이미지(브라우저·Pi 동반) | `src/ai/toolImageRenderer.ts` `renderTileGridPayload` 가 payload 의 선택 층을 받아 1 → 2 → 그림자(`mapTileDraw.drawShadowQuarters`) → 캐릭터 아래 이벤트 → 3 → 4 → 나머지 이벤트로 그린다. `renderToolImages`(get_map_region·preview_house·look_at_houses 등)는 payload 에 선택 층이 없으면 예전과 같다. |
| 헤드리스 이미지 | `scripts/pi-agent.mts` 도 `gen.mts` 처럼 `renderToolImage` → `scripts/qa-game/render.mts` `renderToolRegionPngBase64` 를 넘긴다(전에는 show_map_region 이 「맵 이미지 전달 경로가 없습니다」로 실패했다). 이 렌더러는 에디터 `drawMapTileLayer` 를 쓰므로 4층 + 그림자를 그리고, `PngContext` 가 그림자용 save/restore/fillRect(rgba)를 갖는다. |
| 업로드 타일셋(헤드리스) | `render.mts` 는 업로드 그림판을 **그리는 프로젝트의** `assets.uploaded[id]` 에서 찾는다. 전에는 `tilesetBaseImageUrl(tileset)` 가 전역 store 를 봐서, store 에 없는 그림판(Rasak 48px)이 기본 칩셋 조각으로 그려졌다. 자산이 없거나 ref 만 있고 해석기가 없으면 기본 칩셋으로 대신하지 않고 `note` → 도구 이미지는 `map-rendering-unavailable` 로 실패한다. PNG dataUrl 만 읽는다. |
| `get_map_region` 기호 | 2·4층이 있는 칸은 4 → 3 → 2 → 1 로 맨 위부터 첫 물(`~`)·나무(`T`) 칸이 기호를 정한다(4층 수관이 1층 늪물을 덮으면 T). 2·4층이 없는 칸(옛 맵 전부)은 옛 규칙(1·3층 어느 쪽이든 물이면 `~`)이다. |
| `analyze_map_tile_usage` | `tiles[].layers` 는 옛 이름 `lower`(1층)·`upper`(3층)에 `layer2`·`layer4` 를 더한다. 인접 통계의 합성 칸은 4 → 1 맨 위. 선택 층이 있는 맵만 `data.layerCells {1,2,3,4,shadow}`. |
| `mapVisualContent` | 선택 층이 있을 때만 투영에 넣는다 → 2·4층·그림자만 바뀌어도 `requiresVisualReview` 가 참. 옛 맵 투영 문자열은 그대로. |

| 턴 시작 뷰포트 이미지 | `mapRegionImagePayload`(`src/ai/mapViewportContext.ts`)가 show_map_region 과 같은 규칙으로 `layer2`·`layer4`·`shadow` 를 싣는다(있을 때만). |
| `get_map_region` `water.bounds` | 1~4층 어느 층이든 물이면 센다(없는 층은 -1 → 옛 맵은 그대로). |
| Pi 고스트 증분 | `src/ai/piAgent/mapDelta.ts` 층 유니온 `lower`·`upper`·`layer2`·`layer4`·`shadow`. 선택 층은 두 맵 어느 쪽에도 없으면 항목이 없고(옛 맵 증분 JSON 불변), 사라지면 `{layer, absent:true}` 로 키를 지운다. 크기가 바뀐 맵은 선택 층도 `full`. 생산 `scripts/lib/piAgentRuntime.ts` `emitMapDelta`, 소비 `aiPiGhostBridge`·`aiLaneGhost` 는 `applyMapDeltas` 만 부르므로 그대로 따라간다. |
| 고스트 칸 | `agentGhostPreview.collectTileDiffCells` 가 2층·그림자 변화는 lower, 4층 변화는 upper 칸으로 **표시만** 한다(tileId 없음 → 칸 테두리). 같은 칸의 1·3층 셀이 있으면 그 셀을 둔다. 2·4층 그림을 고스트에 그리는 일은 PR ②. 적용 전 `paint_tiles` 영역 고스트는 `layer` `"3"`·`"4"`·`"upper"` → upper, 그 밖 → lower. |
| 변경 집계 | `changeset.ts` `countTileChanges`(칸당 1, 2·4층·그림자 포함 — `src/headless/index.ts` 도 같은 규칙)·`tileBuffersDiffer`(→ `tileChangedMapIds` 재검사 대상). 선택 층은 `comparableMapProperties` 에서 뺐다 — 층 칠하기가 `mapPropertiesChanged` 로 잡혀 `proposalSafety` ZERO_COUNT_KEYS 에 걸리던 길을 막는다. |

남은 1·3층 전용 표면: `show_tile_grid`.
회귀: `test/mzLayerVision.test.ts`, `test/qaGameRender.test.ts`(업로드 그림판·층 순서·못 찾음), `test/mzLayerGhostAccounting.test.ts`(증분 왕복·옛 맵 불변·집계·고스트 칸·뷰포트 재료).

## 충격 연출 (2026-09-22)

이벤트 명령 조수(`buildEventAssistPrompt`)와 스튜디오 조수(시스템 프롬프트 고정 블록)는 같은 순서를 본다. 함정·피격·마법·폭발·사망은 대사로 시작하지 않는다. `playAudio`(효과음, `loop:false`)와 `showAnimation`(`wait:true`)이 먼저고, 그 다음 HP·스위치·이동·`killPlayer`, 마지막이 설명 대사다. 마법학교처럼 화면을 덮는 컨셉이면 단발 타격이 아니라 화면을 덮는 애니메이션 id(목록에 «화면을 덮음»)를 쓴다. 게임오버 그림·제목은 `get_game_over` / `set_game_over` / `generate_game_over_image` 다. `killPlayer.message` 는 그 순간의 한 줄이다.

계약: `test/eventCommandAssist.test.ts`, `test/aiToolCapabilityIndex.test.ts`.

## 단독 조수의 병렬 도구 실행 (2026-09-21)

기본 조수도 팀 없이 독립적인 조회·웹 검색·Writer 초안을 한 모델 응답의 여러 호출로
묶는다. `piAgent/systemPrompt.ts`가 이 규칙과 결과·생성 ID 의존성의 다음 턴 대기를 지시한다.
`toolAdapter.ts`는 레지스트리 `mode=read`를 Pi 코어 `concurrency=shared`, 쓰기를
`exclusive`로 매핑한다. 최초 노출·find_tools 승격·미노출 직접 호출이 모두 같은 매핑을 쓴다.
웹 검색과 Writer는 shared, `finish_stage`는 exclusive다. 팀 배정·메일함의 기존 실행 정책은 유지한다.

`scripts/lib/piAgentRuntime.ts`의 전체 도구용 `executionQueue`는 제거했다. 이 큐 때문에
DEFAULT/AUTO/YOLO/단계별 적용에서는 검색까지 직렬 실행됐다. 이제 코어가 연속된 읽기를
함께 실행하고, 쓰기는 앞선 호출의 종료를 기다려 실행·checkpoint 적용까지 단독 점유한다.
뒤의 조회/쓰기는 승인된 최신 프로젝트를 보며, 검토 후 적용에서도 쓰기는 순서를 지킨다.
승인 거절이나 중단은 후속 쓰기를 막는다. 초안 작성 후 checkpoint가 실패하면 이전의
성공 영수증보다 코어 실패를 우선하여 `tool_end.ok=false`로 보고한다.

병렬화는 비동기 대기 시간을 겹치는 것이며 동기 타일 연산을 여러 CPU에서 돌리는 기능은 아니다.
도구 결과가 필요한 후속 모델 판단은 다음 턴에 실행한다. 제공자별 다중 호출 제한은 변경하지 않는다.
증거·명령·제약: `reports/2026-09-21-ai-tool-parallel.md`, `.omo/evidence/ai-tool-parallel/`.
회귀: `test/piToolConcurrency.bun.test.ts`(실제 Pi 루프 + 제어된 모델/검색 전송),
`piApplyModes.bun.test.ts`, `piAgentToolAdapter.test.ts`.
실제 모델/실제 검색 재현: `bun scripts/qa/ai-tool-parallel-live.mts` (연결된 제공자 필요,
읽기 도구만 허용하고 프로젝트 적용이 발생하면 실패한다).

### 검색 중 사용자에게 보이는 것 (2026-09-21 실측)
## AI 새 야외·마을의 기본 칩셋 (2026-09-21)

- `defaults/forestHarmony.ts::defaultOutdoorTilesetId`가 새 프로젝트·새 맵·AI 새 야외의 기본값을 소유한다.
  기본 제공 `forest_harmony`(숲마을 · 거리별 잔디)를 우선하며, 번들이 없는 축소된 옛 프로젝트만
  합본 마을로 폴백한다. `createBlankProject`의 시작 맵, 맵 만들기 대화의 빈 맵, `addMap`/`addChildMap`의
  생략 칩셋이 같은 값을 쓴다. 「부모와 같게」는 부모 칩셋을 유지한다.
  `DEFAULT_TILESET_ID`는 기존 데이터·번호 계약이므로 바꾸지 않는다.
- `create_map`, `generate_map`의 village/forest, `author_village`와 내부 마을 생성,
  `build_world`의 town/field가 같은 정책을 쓴다. 명시 칩셋은 우선한다.
  `generate_map` cave는 고정 입구/POI 유무와 관계없이 던전 칩셋을 기본으로 한다.
  기존 맵, 집에 연결되는 실내, 별도 공간/월드 컴파일러의 명시 재료 계약은 유지한다.
- `author_village.target.tilesetId`는 **new 전용**이다. 스키마·파서·생성·변이 전 호환성 검사에
  모두 전달한다. 기존 맵은 해당 맵 칩셋을 검사하며 자동 교체하지 않는다.
- 숲마을은 합본 마을 0~479의 집·길 번호와 레트로 절벽 구간을 보존하므로 호환 판정에 포함한다.
  `isCombinedTownTileset` 자체를 바꾸거나 합본 마을 하네스로 숲마을 저작 정의를 덮지 않는다.
  숲마을 언덕도 morphology + relief 경로를 사용한다.
- 나무는 `treeKitForTileset`이 숲마을 `tileGroups[].previewMap`의 완성 조립과 셀별 레이어를 읽는다.
  일반/compact/형태 마을·과수원·지형 패스와 그래픽 비교 화면이 같은 킷을 쓴다.
  옛 2×4 dark-tree와 직사각형 숲 벽 반복을 숲마을 킷에 넣지 않는다.
  개별 나무·과수원은 이 조립을 유지하고, 넓은 숲 군락은 아래 연결 수관 문법을 쓴다.
  길·물은 호환 번호의 기존 시공 알고리즘을 유지한다.
- 회귀 계약: `test/aiOutdoorTilesetDefaults.test.ts`. 기존 합본 마을 팔레트/파사드 검사는
  타일셋을 명시해 본래 검사 대상을 유지한다. 이번 세션에서는 vitest/gates/typecheck 미실행.
  브라우저 관측: `reports/2026-09-21-ai-forest-default.md`.


## 마을 군락 — 굽이숲 절벽마을 조립 (2026-09-21)

- 마을 외곽은 `forestGroves.ts` → `forestContour.ts`로 이어지는 **1칸 단위** 경계다.
  연속 함수로 만든 공터의 좌표를 fBm으로 휘고, 큰 굴곡과 작은 경계 변화를 별도로 합성한다.
  실제 길·집·마당·수역·이벤트와 기존 스택을 보호하고 집 주변 여백도 둥글게 제외한다.
  몸통은 `forestTrunkTiles.ts`의 **기존 굽이숲 3행 조립**만 사용한다. 경계를 굽히기 위해
  `forest-trees:tree` 같은 개별 나무로 교체하면 안 된다(사용자 반려). 공통 끝마감·반복부를
  온전히 놓고 수관이 가린다. 완성 몸통이 들어가지 않는 돌출부만 1행씩 후퇴시킨다.
  연구의 적용 범위·출처는 `village-layout-research.md`, 복구 화면은
  `reports/2026-09-21-restore-original-forest-trunks.md` 참조.
- 명시된 숲 띠·compact 마스크는 기존 2열×3행 조립을 유지한다. 이 경로는 남쪽 노출 경계
  **같은 행**에서 밑동을 시작한다. `forest-cabin`의 좌/우 끝마감과
  2열 반복부 `[[1425,1350],[1429,1428],[1433,1432]]`를 사용하며 항상 3행 전체를 놓는다.
  끝마감이 안 들어가는 돌출부는 수관 마스크에서 제거한다. 밑동·뿌리를 잘라 맞추지 않는다.
- 시공 draft의 `prepareVillageTreeKit`만 `defaults/forestGrove.ts`로 어휘를 확장한다.
  참조 칩셋의 47개 연결 조각은 기존 `tileGrafts` 경로로 현재 마지막 타일 뒤에 추가한다.
  `forest_harmony_grove_47`은 독립 그룹이다. 옛 1617·수관 그룹·잠긴 메타데이터·기존 graft는
  덮지 않으며, 사용자 확장 슬롯이 있어도 그 뒤에 추가한다. 조회/그래픽 미리보기는 변이하지 않는다.
  47칸 뒤 11칸은 수관 속의 깊이 변형(`interiorVariants`, 잎 채움)이다. 페인터가 끝에 `shadeForestCanopy` 로 고른다.
- 승인 원본은 `forest-cliff-village-atlas.png`; 새 그림 생성이나 참조 맵 수정은 없다.
  Phaser preload·공통 graft bake·내보내기가 같은 번들 소스를 사용한다.
  `authorVillageScope`는 이 결정론적 추가 결과만 허용하며 다른 칩셋 변경은 계속 거부한다.
- 일반·compact·형태별 마을과 지형 숲 패스가 같은 페인터를 쓴다. 과수원/집 주변의 개별 나무는
  완성 나무 스탬프를 유지한다. 합본 마을은 기존 산포 경로를 유지한다.
- 숲 실측은 실제 타일셋 그룹으로 수관 칸을 센다. 기존 `tree2x2Clusters`에 가짜 나무 개수를
  더하지 않으며, 필수 숲 검사는 3개 완성 활엽수 또는 36칸 연결 수관을 큰 군락으로 인정한다.
- 관측: `reports/2026-09-21-forest-groves.md`; 계약: `test/forestGroves.test.ts`(미실행).


검색은 실제로 길다 — 실측 31.18초. 그동안 사용자에게 보이는 것은 세 겹이다.

1. **작업 카드 상태 문구.** 검색이 시작되면 `웹에서 참고 작품을 찾는 중… (십 초 정도 걸릴 수 있어요)` 로 바뀐다.
   이전에는 `작업 중…` 만 보여 멈춘 것처럼 읽혔다. 실행 턴과 계획 턴 두 경로에 모두 걸었다 —
   「해리포터 같은 게임」 시나리오가 검색하는 자리가 바로 계획 턴이다.
2. **작업 과정 타임라인.** 툴마다 `◌ 웹 검색 · 실행 중` → `✓ 웹 검색 · 완료 · 31.18초` 행이 남고,
   행에는 `00:12 · 조수 · 31.18초` 처럼 트레이스 시작 기준 경과가 붙는다(`aiActivityView` 의 `clock`).
   기본 표시 수준은 「간단히 보기」(brief)이고, 설정에서 생략·자세히·매우 자세히로 바꾼다.
3. **중지 버튼.** 턴이 도는 동안 계속 보인다(`ai-run-stop`).

`web_search` 라벨이 사전에 없으면 타임라인이 `web search` 라는 영문을 그대로 보여 준다(2026-09-21 실측:
`label="web search" icon=wrench group=build`). 지금은 `웹 검색` · 돋보기 아이콘 · 조회 그룹이다.

## 참조 작품 비유 → 자율 웹 검색 (2026-09-21)

사용자가 실존 작품을 비유하면(「해리포터 같은 게임 만들고 싶다」) 조수가 **설계 전에 스스로 검색**하고
그 사실로 계획을 세운다. 이전에는 `mode=other` 로 분류되며 참조가 조용히 사라져 검색 계기가 없었다.

- **`referenceWork` 는 의도 선언의 사실이다.** `IntentDeclaration.referenceWork`(문자열|null)에 작품명이 남고,
  `formatIntentNote` 가 `[참조 작품]` 계약을 붙인다 — 검색하라, 암기로 추정하지 마라, 고유명사는 그대로 쓰지 마라.
- **authoring 게이트에 묶지 마라.** 파서가 `create|modify` 에만 실어 보내면 「만들고 싶다」(mode=other) 발화에서
  조용히 사라진다(2026-09-21 실측: referenceWork=null, tools=[]). 지금은 모든 모드에서 보존한다.
- 장르·스타일 설명(「중세 판타지 RPG」)은 작품명이 아니다 — 선언 프롬프트가 그 경계를 가르친다.
- 시스템 프롬프트(`piAgent/systemPrompt.ts`)도 같은 규칙을 말한다: 지식밖의 사실은 (a) 최신 사실,
  (b) 실존 작품 비유 두 갈래로 검색한다.

### 죽은 Codex 자격이 검색·완성을 영구히 막던 문제

편집기 저장본(`~/.oprn/oh-my-pi-auth.json`)의 Codex 자격이 만료되면 갱신을 시도하는데, `codex` CLI 같은
다른 도구가 먼저 갱신했으면 `refresh_token_reused` 로 실패한다. 그때 CLI 로그인은 더 신선할 수 있는데도
`resolveRequestApiKey` 가 저장본만 보고 던져서 **모든 검색·완성이 그 행에 묶여 죽었다**(2026-09-21 실측).
지금은 갱신 실패 시 `adoptCodexCliCredentials` 로 CLI 자격 채용을 한 번 시도하고, 그것도 못 쓰면 원래
오류를 올린다.

### 검증

`~/.bun/bin/bun run scripts/ai-reference-work-live-test.mts` — 의도 선언 → 참조 노트 → Pi 루프를
편집기와 같은 경로로 통과시킨다. 판정은 실제 실행된 툴 호출과 출처 URL 이다.
실측 2026-09-21: `referenceWork="해리포터"`, 실행 툴 `["web_search","get_project_summary","read_project_wiki"]`,
출처 `harrypotter.com/features/everything-a-first-year-should-know-about-hogwarts` 외 2건, 판정 PASS.
회귀: `test/intentDeclaration.test.ts` 의 「참조 작품 비유 — 검색을 부르는 계약」 6케이스.

## 조수 웹 검색 도구 (2026-09-21)

조수가 `web_search({query})` 로 인터넷을 검색한다. 레지스트리 등록은 `src/editor/tools/webSearchTool.ts`,
업스트림 계약은 `scripts/lib/codexWebSearchRuntime.ts`, Pi 배선은 `scripts/lib/piAgentRuntime.ts` 다.

- **검색 엔진은 Codex(ChatGPT) 백엔드다.** 조수 제공자가 Antigravity(Gemini, 공장 기본)여도 검색은
  ChatGPT 구독 자격으로 나간다 — `tools:[{type:"web_search"}]` + `stream:true` 계약을 실측으로 고정했다
  (`stream:false` 는 업스트림이 400 "Stream must be set to true" 로 거절한다. 비스트리밍은 존재하지 않는다).
- **자격은 서버 경계에만 있다.** `resolveRequestApiKey("openai-codex")` 가 동반 서비스에서 해결해
  워커로 넘기고(`codexApiKey`), 브라우저로는 나가지 않는다. Codex 미로그인이면 툴이 "Codex 로그인 필요"
  로 정직하게 실패한다 — 검색 때문에 다른 턴이 죽지 않는다.
- **레지스트리 `run` 은 순수 핸드오프다.** 툴 규약(`types.ts`)이 브라우저 전역 접근을 금지하므로
  레지스트리 쪽은 `status:"ui-required"` 만 만들고, 실제 네트워크 실행은 Pi 런타임이 같은 이름으로
  갈아 끼운다(`generate_image_asset` → `imageAssetGeneration` 과 같은 분업). 그래서 레지스트리 셰이프와
  실행 셰이프가 **둘 다 선언되면 안 된다** — Pi 런타임이 레지스트리 셰이프를 이름으로 걸러낸다.
- **노출은 도메인과 무관하다.** "최신 정보가 필요하다" 는 UI 상태로 예측할 수 없어서 `core` 도메인에
  상시 노출된다. `find_tools` 발견 경로도 같은 실행 셰이프로 간다(`shapeFor`).
- 팀 실행에서도 하위 에이전트가 검색을 쓴다(`piTeamRuntime.ts` 의 `child()` 가 `codexApiKey` 를 내려보낸다).
  빠뜨리면 팀장만 최신 사실을 보고 팀원은 추정하게 된다.

검증(2026-09-21, 실제 ChatGPT 구독 자격): 레지스트리 노출·인자 거절(빈 검색어·401자)·
`codex-required` 실패 경로, Pi 루프에서 `web_search` 선언과 실제 검색 실행(PostgREST v16.3 답변 +
GitHub 출처 6건), `find_tools` 발견 후 다음 턴 실행까지 실측했다.

## 감사 후속: 부분 갱신과 미사용 삭제 (2026-09-20)

- DB 공용 `mergeRecord`는 `mergeRecordPatch`로 중첩 객체의 생략된 필드를 보존한다. 전달한 배열은 교체하며, `kind` 변경은 이전 유니온 변형을 버린다. 빈 객체는 중첩 필드 전체 삭제가 아니다.
- 생활 스킬/가축 종 갱신은 기존 보상/그래픽/수치를 보존한다. 제작법은 기존 ID에서 미전달 필드를 보존하고, 신규 레시피의 outputItemId는 실행 시 검증한다. 날씨 패치는 계절 규칙을 병합 후 기존 정규화 경로를 탄다.
- 기본 DB 9종 삭제는 `projectDatabaseReferenceMessage(draft, ...)`, 제작법 삭제는 `craftRecipeReferenceMessage(draft, id)`를 거친다. 전역 UI store를 검사하면 다른 초안을 보호하게 되므로 반드시 draft를 전달한다.
- `prune_unused`는 로더 아이템 참조 수집기를 사용한다. 상점/전투/승급/진화/여관 분기와 동적 필드 스폰도 수집하고, 삭제 대상 트룹을 제외한 프로젝트에 남는 적 조건 참조를 보존한다. 미사용 슬롯 이름 삭제 역시 공용 스위치/변수 가드에 걸리면 생략한다.
- 자세한 범위와 남은 rename/repair 문제: `docs/reviews/2026-09-20-data-integrity-fixes.md`. 테스트 작성만 했으며 gates/vitest 미실행.

## 전투 저작 입력 수정 (2026-09-20)

## 이벤트 명령 AI 공용 도구 (2026-09-20)

`event_command_assist({mapId,eventId,pageId,prompt,mode?})`는 기존 이벤트의 한 페이지
명령을 자연어로 수정하는 `event` 도메인의 쓰기 도구다. `get_event`로 실제 페이지 ID를
먼저 조회한다. 새 이벤트 생성·다른 페이지·페이지 조건/그래픽 변경은 하지 않는다.

- `eventCommandAssistTool.ts`가 스키마와 대상 조회를 소유한다. `asyncToolRunner.ts`가
  `runEventCommandAssist`로 생성한 후 `runToolDefinition`의 공용 draft/lint/commit 경계를 탄다.
  AssistantSession과 Pi toolAdapter가 이 비동기 경로를 호출한다. 동기 `runTool` 직접 호출은
  `async-tool-required`로 거부하며, 생성됐다고 보고하지 않는다.
- 이벤트 편집기 생성기의 리소스·참조·착지·세계관 검증 및 최대 3회 생성/수정을 재사용한다.
  세션에서는 기존 chat 함수·설정·프로젝트 성향 키를 전달한다. 조수의 도구 결과/감사/제안 흐름을
  그대로 통과하며, 생성기가 store를 직접 수정하지 않는다.
- 기본 `mode: edit`는 최종 명령 목록 전체를 교체한다. 명령 JSON이 기존 생성기의 12,000자
  상한을 넘으면 생성 전에 거부한다. `mode: append`를 명시하면 기존 목록 끝에 추가한다. 이벤트 편집기의 선택 경로가 있으면 선택 명령 바로 뒤에 추가한다.
  모호한 수정 요청을 자동으로 추가 요청으로 바꾸지 않는다.
- 생성 전 프로젝트 사본을 사용하고, 완료 시 프로젝트 identity와 내용을 재확인한다.
  취소 또는 프로젝트 변경 시 적용하지 않는다. `dryRun`은 ctx.project도 갱신하지 않는다.
- `test/eventCommandAssistTool.test.ts`: 페이지/기존 데이터 보존, dryRun, 누락 대상,
  긴 페이지, 명시 추가, 취소/오래된 결과, 실제 공용 생성기의 검증 재시도 계약.
  실행 결과와 브라우저 근거는 `reports/2026-09-20-event-command-assistant.md`에 기록한다.

이벤트 편집기의 생성 버튼도 `sendAiAssistantMessage` → `aiChatPanel.sendText` →
`aiTurnRunner` → `AssistantSession.sendUserMessage` 공용 경로를 사용한다.
호스트가 전달하는 `eventCommandScope`는 맵·이벤트·페이지와 선택 경로/라벨, edit/append 모드를
고정한다. **이 스코프가 봉인하는 것은 쓰기다** — `onlyEventPageCommandsChanged` 가 지정 페이지
밖의 변경을 거부하므로 읽기는 넓혀도 계약이 약해지지 않는다. 쓰기는 `event_command_assist`
하나뿐이고 다른 대상과 모드 변경은 거부한다. 이 턴에서는 자율 적용·위키 저작·NPC 자동 보완이
금지된다.

**읽기 툴은 2026-09-20 에 넓혔다.** 종전 허용은 `get_event`·`get_database_records`·`run_lint`
뿐이라 **맵을 조회할 방법이 없었다.** 조수 세션은 `eventScopeAllowsTool` 로 툴 목록을 거르므로
여기 없으면 노출조차 안 되고, 그래서 모델은 프롬프트에 실린 맵 한 줄
(`이름 (가로 W × 세로 H, 밟을 수 있는 칸 예: x,y)`)만 보고 대사를 지어야 했다 — "이 마을
광장에서"·"여관 안에서" 같은 지시를 받아도 그 자리가 어떤지 볼 수 없었다. 지금은
`get_map_region`(시맨틱 문자 그리드 + 물 바운딩 박스)·`get_project_summary`·`find_events`·
`find_layout_regions`·`list_resources` 가 읽기로 허용된다(모두 `mode: "read"`). 프롬프트를
키우지 않고 모델이 필요한 만큼 파고든다. 계약: `test/eventCommandScopedSession.test.ts`
("맵을 읽는 툴이 허용된다" + "쓰기 툴은 여전히 봉인된다").

공용 브리지는 바쁜 턴이나 대기 제안이 있으면 이벤트 요청을 거부한다. 생성 결과는
`deferApply`로 공용 검토를 거친 뒤 before/after 스냅샷을 이벤트 모달에 넘기고 공용 제안을
해제한다(채팅에 두 번째 적용 권한을 남기지 않는다). 모달은 해당 페이지 외 변경 여부와
생성 전 명령 목록을 재확인하고 기존 diff/줄 제외/직접 수정/replaceAll 한 번 적용을 유지한다.
진행 표시는 공용 상태를 읽으며 중단 및 편집기 닫기는 공용 턴을 취소한다.

검증: `test/eventCommandScopedSession.test.ts`는 실제 공용 세션의 도구 루프·범위 위반 거부·
검토를 검증한다. `test/e2e/event-ai-shared-assistant.spec.ts`는 LLM 응답만 고정하고 실제
브리지·세션·도구·모달에서 검토 전 미변경, 다른 페이지 보존, 적용과 한 번 되돌리기를 확인한다.

## 전투 저작 입력 수정 (2026-09-20)

`upsert_troop`의 기존 id에 `enemyIds`만 전달하면 로스터 교체다. 기존 `members`를
상속해 입력을 무시하지 않고 새 members를 합성한다. 이름 등 다른 필드만 바꾸면 기존
수동 배치·숨김·페이지를 보존한다. `members`를 명시하면 기존처럼 그것을 정본으로 삼는다.

M2 명령의 `commandId`와 객체 `fields`는 공통 command shape 검증에서 필수다.
중첩 분기에도 적용되며 저수준 툴은 기존 `invalid-args` 오류로 반환한다.
`COMMAND_SCHEMA`의 예시는 실제 전투 명령 `m2-098-change-enemy-hp`와 fields를 사용한다.
회귀 코드는 `dbToolsIntegrity`와 `battleReviewIntegrity`에 추가했으며 이번 세션에서는 미실행.

## NPC 공용 얼굴 매핑 연결 (2026-09-18)

`place_npc` / `make_villager`와 `eventCompile`은 `sharedCharacterFaceResolver`의 공용 자료를 사용한다.
브라우저 조수는 턴 시작 시 `/__oprn/shared-character-graphics`를 no-store로 다시 읽고,
실패하면 오래된 매핑으로 저작하지 않고 턴 오류로 처리한다. DB 탭의 읽기·저장 성공도 같은 캐시를 갱신한다.
헤드리스 동기 도구의 초기 자료는 서버 초기값과 같은 `defaultSharedCharacterGraphics()`다.
자동 얼굴은 각 페이지의 실제 charset/frame으로 찾는다. `mapped`만 changeFace를 생성하고,
`pending` / `no-face` / 없는 항목은 시트 번호나 나이로 추정하지 않는다.
명시한 최상위 face > 페이지 face > 공용 매핑 순서를 유지한다. 명시 textureKey도 공용 매핑으로 해석한다.
기존 저장 이벤트를 소급 변경하지 않는다. 회귀 계약: `test/npcSharedFaceMapping.test.ts`.

# Editor AI Tools & Vocabulary

## 이식 타일 최초 검수 준비 대기 (2026-09-18)

집 시공 후 합성 아틀라스 캐시가 비어 있으면 검수가 즉시
`tileset-graft-rendering-unavailable`로 실패하던 경로를 수정했다.
`src/ai/toolImageCanvas.ts`의 `loadTilesetImage`는 기존
`awaitGraftedTilesetImageUrl`로 정확한 입력의 완전 합성을 최대 5초 기다린다.
원본 시트로 대체하지 않으며, 시간 초과와 소스 누락/합성 실패를 구분한다.
대기 종료 시 타이머·abort listener를 정리하고, 공유 베이크는 계속 진행하므로
뒤늦게 로드가 완료되면 다음 검수에서 캐시를 사용할 수 있다.
회귀 케이스: `test/toolImageGraftWait.test.ts` (최초 로드·실패·시간 초과 후 재시도).
테스트 실행은 사용자 지시에 따른다.

## paint_tiles 타일 인덱스 검증 — 유일하게 빠져 있던 가드 (2026-09-16)

실측 경로: 실제 모델(gemini-3.7-flash)에게 「타일 id 99999 를 (3,3) 에 칠해줘」를 시켰다.
모델은 먼저 `tile_query` 로 **`타일 인덱스 범위 밖: 99999 (0~479)`** 를 정직하게 받았는데,
이어서 호출한 `paint_tiles` 는 그 값을 **성공(초록 체크)** 으로 통과시켰고, 적용 후 그리드 실측에서
`map.lowerTiles[(3,3)] = 99999` 가 그대로 기록됐다(타일셋에 없는 칸이라 렌더되지 않고 «빈 칸» 이 된다).

원인: `tile` 범위 검사를 **`paint_tiles` 만** 하지 않았다. 형제 도구들은 모두 거부한다 —
`palettePresetTools` · `groupSampleTool` · `visionQueryTools` · `tileMetadataTools` ·
`v3/vocabularyTools` 가 `tile-out-of-range` 를 던진다.

계약(고정된 것): `paint_tiles` 의 합법 정의역은 **-1(비움) 과 0~count-1** 뿐이고, 그 밖은
`tile-out-of-range` 로 거부된다. 거부는 **지도를 그대로 둔다**(부분 적용 없음). `tileLayerHome()` 이
범위 밖 값에 대해 `priority[tile] ?? "lower"` 로 조용히 lower 를 돌려주던 폴백은 이제 검증을 통과한
값에만 적용된다.

회귀 고정: `test/tileToolsV2.test.ts` 의 «paint_tiles 타일 인덱스 계약» 4건
(범위 밖·음수 상한 밖 거부 / -1 허용 / 경계값 count-1 정상).

## 오프닝 미디어 배선 — 스틸 카탈로그·배경음악·부분 편집 (2026-09-14)

사용자 지적: "이미지 생성이야 codex cli 나 뭐 그런것들로 만들게 할 수 있잖아". 맞았다 — 생성 인프라는 이미 범용인데
**오프닝만 배선이 빠져** 그 산출물을 못 받고 있었다.

- 실측(빈 프로젝트): 오프닝 그림 슬롯이 보던 `image` 카탈로그는 **457개 전부 아이템 아이콘**(`cc0-jetrel-*`)이고,
  전체화면 아트인 `backdrop` 29 / `title` 13 은 탭과 툴 양쪽에서 **거부**됐다(런타임은 멀정히 렌더한다).
  생성 버튼(`AI_GENERATABLE_PICKER_KINDS`)도 title/backdrop/monster 에만 붙어 오프닝 슬롯엔 없었다.
- 시네마틱 전용 picker kind **`still`** 을 신설(`resourceOptions.ts`): 배경화 → 타이틀 아트 → 생성·업로드 그림 순으로 앞에 놓고,
  마지막에 기존 `image` 카탈로그를 통째로 이어 붙인다. 즉 `still ⊇ image` — **아이콘으로 저작해 둔 기존 오프닝·게임오버 배경이
  "종류 불일치"로 사라지지 않는다**(동일 함정을 `cc0-se-` 주석이 이미 경고하고 있었다). 탭(`databaseCinematicMediaFields/Actions`)과
  툴(`cinematicTools`)이 같은 kind 를 쓴다. 아이콘·이미지 슬롯 동작은 불변.
- `AI_GENERATABLE_PICKER_KINDS` 에 `still: "backdrop"` 추가 → 오프닝 그림 슬롯의 피커에 기존 "AI로 만들기"가 그대로 붙는다.
- 새 툴 2개:
  - `edit_opening`(write) — `op: append|insert|update|remove|move|settings`. 전체 재작성 없이 장면 하나·순서·
    시퀀스 설정만 고친다. **건드리지 않은 기존 장면은 재검증하지 않는다** — 삭제된 업로드를 참조하는 오래된 장면이
    새 편집을 통째로 막는 사도를 피한다.
  - `generate_opening_image`(세션 쓰기) — 프롬프트를 전체화면 지시로 감싸 이미지 모델을 호출하고,
    등록은 **기존 `upsert_resource` 쓰기 툴로** 한다(제안·diff 회계를 그대로 타고 dataUrl 은 전사에 남지 않는다).
    헤드리스에서는 `status:"ui-required"` 만 돌려준다(`generate_character_appearance` 과 같은 계약).
    세션 드래프트에 쓰는 이유: 세션은 `cloneDetachedDraft` 위에서 돌아서 **스토어에 직접 써다 넣으면
    뒤이어 호출되는 `set_opening` 이 그 id 를 못 찾는다**.
- `CinematicSequence.musicResourceId`(시퀀스 배경음악)을 툴·탭·런타임에 함께 배선. `list_opening_media` 에 `kind:"music"` 추가,
  그림 후보는 `group`(배경화/타이틀 아트/그림/아이콘)을 함께 돌려 모델이 전체화면에 아이콘을 고르지 않게 한다.
- **툴을 늘릴 때의 새 제약(2026-09-14 실측)**: 툴 카탈로그 228툴 = **98,357 토큰**이다. 모델 창이 128,000인 경우
  (카탈로그의 `gpt-5.3-codex-spark`, 그리고 **모르는 id 의 보수 폴백**) 예비분 16,384 를 뺀 약 13,000 토큰이
  대화·원본 매니페스트의 전부다. 이번 툴 2개(+약 470토큰)만으로 `test/aiWorkItemOutcomeGateSmoke.test.ts` 가
  `original-context-window-exceeded: no room for the original context manifest` 로 **턴 자체가 죽는** 상태가 됐다
  (`contextBuilder.buildGroundedRequest` → `originalContext.message`). 그 픽스처는 임의 모델 id 를 쓰고 있어
  실제 카탈로그 모델로 바꿨 복구했고, 천장은 `test/aiToolCatalogBudget.test.ts` 래칧(99,000토큰)으로 드러냈다.
  좀은 창에서 툴을 줄이거나(도메인 스코핑) 매니페스트를 줄이는 결정은 **아직 없다 — 다음 툴 추가 전에 필요하다**.
- 계약: `test/openingStillCatalog.test.ts`(스틸 순서·호환 꼬리·기존 카탈로그 불변),
  `test/openingEditTools.test.ts`(부분 편집 5종 op · 경계 14가지 거부 · 음악 저장·참조 검증·내보내기 수집),
  `test/openingMusicRuntime.test.ts`(반복 재생·장면 전환 유지·종료/건너뛰기 정지·재생 불가 시 진행 보장),
  `test/e2e/database-opening-still-media.spec.ts`(탭에서 배경화 선택·AI 생성 버튼·배경음악 저장),
  `scripts/qa/runtime/ai-opening.scenario.mjs`(출하 플레이어에서 배경화 스틸 + `cinematic-music` 존재·종료 후 소멸).

## 오프닝 시네마틱 AI 저작 — system.opening (2026-09-14)

2026-09-22: `list_opening_media(kind:"image")`는 반드시 `still` 피커를 조회한다.
일반 `image` 피커를 조회하던 누락을 수정했다. 검수된 스틸에는 실제 그림 설명
`description`, 분위기 `mood`, 서사 용도 `useCases`, 같은 세계관 `series`, 제약
`cautions`, 오프닝 적합 여부 `suitableForOpening`가 함께 반환된다. 공백으로 나눈
검색어를 모두 일치시키므로 `겨울 신전`, `해저 비밀`로 찾을 수 있다. 생성 계획과
미검수 이미지는 후보에 넣지 않는다. 상세: [opening-still-pack.md](opening-still-pack.md).

사용자 요청: "사용자가 커스텀한 오프닝을 에디터 내에 있는 ai 를 통해 할 수 있게 만들고싶음".

- 실측 공백: `system.opening` 은 DB 「오프닝」 탭(`db-tab-opening`, `databaseCinematic*`)으로만 저작됐고
  **어떤 AI 툴도 쓰지 못했다**. `script_cutscene_preset` 은 이벤트 커맨드 프리셋(회상/엔딩)이라
  New Game 재생 경로가 다르고, `set_title_screen` 은 타이틀 화면 전용이다. `list_resources` 는
  kind `tile/charset/monster/backdrop/bgm/se` 만 지원해 업로드 `picture`/`movie` 를 발견할 경로가 없었다.
- 새 툴(`src/editor/tools/cinematicTools.ts`, domain `system`):
  - `get_opening`(read) — 없으면 `opening:null` 이며 기본값을 만들지 않는다. 꺼진 시퀀스·미존재 참조를 warning 으로 보고.
  - `set_opening`(write) — 장면 목록 **전체 교체**. `kind`는 `text|image|video`,
    장면당 `id`(생략 시 `opening-scene-<순번>`)·`narration`·`durationMs`(0~120000 정수, 0=확인 입력/영상 끝)·
    `resourceId`(image/video 필수)·`motion`(image 전용 `none/fade/pan/zoom`)·`narrationAudioResourceId`.
    장면 100개 상한, 빈 id·중복 id·없는 리소스 id·종류에 맞지 않는 필드(`text`의 `resourceId`, `video`의 `motion`)를 거부한다.
    `enabled` 생략 시 기존 값 유지(없던 시퀀스면 true) — 꺼진 채 장면만 쌓이면 warning 으로 알린다.
  - `remove_opening`(write) — 시퀀스 자체를 제거(장면 일부 삭제는 2026-09-14 이후 `edit_opening(op:"remove")`).
  - `list_opening_media`(read) — `kind:"image"|"movie"|"sound"` 후보. 이미지 장면은 DB 이미지 슬롯과 같은 목록을 쓴다
    (2026-09-14부터 그림은 `still` 카탈로그, `kind:"music"` 추가 — 위 절 참조).
- 리소스 후보 정본: `listDatabaseResourceOptions`(+kind 매칭)를 `src/editor/resourceOptions.ts` 로 옮겨
  DB 피커와 AI 툴이 **같은 목록**을 본다. 툴 레이어가 DOM/스토어를 무는 피커 모듈을 집어오지 않도록 순수 모듈로 분리했고,
  `databaseResourcePickerDialog` 는 그대로 re-export 하므로 기존 import 경로는 유지된다.
- 노출: 레지스트리(system) + 툴 능력 색인(`TASK_RECIPES` `opening-cinematic` 레시피) + 시스템 프롬프트 규칙 25.
  `remove_opening` 은 `ESCALATION_DENYLIST` 에 넣었다 — 이름이 스쳤다는 이유로 자동 승격되면 작성 장면이 통째로 사라진다.
- 계약: `test/cinematicTools.test.ts`(3장면 저작 + `serialize/deserialize` 왕복, 경계·오류, DB 피커 목록 패리티),
  `test/aiEditorReachParity.test.ts` REQUIRED_FACADES 에 `set_opening → system.opening`,
  `test/aiToolCapabilityIndex.test.ts` 색인 상한 4,800 → 4,900(실측 4,811자/활성 226툴 — 조용한 상향 금지 규칙에 따라 함께 기록).
- 런타임 소비는 기존 그대로다: `player.ts` 가 New Game 직전에 시퀀스를 재생한다(`runtime-sessions.md`).

## 도면 문법에 wing(세로 복도) 추가 — 실루엣 변주와 물건 대체군 (2026-09-11)

사용자 지적: "저 화톳불이랑 집의 구조 뭐 이런걸 좀 변주해야하는 게 아닌가". 실측이 맞았다.

- 도면 문법이 `row` / `double-row` 둘뿐이었고 **둘 다 "북쪽 방 줄 → 가로 복도 → 남쪽 홀"** 로 가로 밴드를
  쌓는다 → 어떤 시설을 지어도 같은 샌드위치 실루엣(`conceptLayoutDoubleRow.ts`).
- 물건은 카탈로그 55종인데 초안 19종이 쓰는 건 47종이고, 그마저 `window·box·crate·table_chairs·counter·
  cabinet·bookshelf·stove·barrel·bed_v·clock·plant` 12종에 쏠려 있다. **난방 계열(`hearth`,
  `stone_hearth_lit`, `stone_hearth_unlit`, `flue`)은 정의돼 있으나 어느 초안도 안 쓴다**(미사용 8종 중 4종).
  칩셋 실측: 그림 있는 타일 478칸 중 물건이 쓰는 건 129칸 → 349칸이 미사용(새 물건 재료).

변경:

1. **`layout: "wing"`** — `src/editor/conceptLayoutWing.ts`. 방이 **세로 복도** 좌우(동·서)에 남북으로
   늘어서고 홀이 맨 남쪽에 선다. 방마다 복도 쪽 열에 문(innerDoors)을 내고, 벽·천장은 파이프라인이
   바닥 마스크에서 파생하므로 기존 벽 문법이 그대로 성립한다(실측: 18×27 wing, 방 8개, 문에서 BFS 로
   전 방 도달). `CONCEPT_LAYOUT_KINDS` 에 추가 → plan 스키마 enum·DB UI 라벨·검증이 자동으로 따라온다.
2. **`get_concept_facility` 응답에 `vocabularyGroups`** — 같은 역할의 대체 물건군(잠자리/난방·조리/
   식사·작업대/수납/좌석/바닥깔개/벽장식/층계). designHint 에 "템플릿 물건을 그대로 베끼면 모든 실내가
   같은 구조물로 채워진다 — 같은 역할의 다른 물건을 최소 둘 이상 골라라" 를 명시. levers 에
   `shape rect|l|alcove`(ㄱ자·벽감)와 `layout wing` 도 실었다.

회귀: `test/conceptWingLayout.test.ts`(복도 동·서 배치, 세로 복도, 홀 남단, 문에서 전 방 도달, 미지 layout 거절).

아직: 새 물건 정의(미사용 349칸)와 배치 문법 변주(같은 물건의 벽·러그·구석 배치를 시드로 흔들기).
### 후속: 석조 화로는 복도 끝 알코브에 (2026-09-11)

사용자 지적: "석조 난로의 위치는 거실이나 복도의 끝 이런 데에 있어야하지 않겠냐".

- 3×3 석조 화로는 방 하나를 다 먹는 설비인데도 아무 자리에나(작은 객실 벽 등) 앉았다. 카탈로그 role 을
  손대는 대신 **id 계열**(`hearth`·`stone_hearth_lit`·`stone_hearth_unlit`)로 규칙을 세웠다 — 카탈로그
  role 은 타일 의미 계약(`test/interiorObjectCatalog.test.ts` 의 role↔타일 세트 검증)이라 임의 값을 넣으면 깨진다.
- composer: 복도(`walkway`)의 화로는 `north-end` 슬롯(= 복도 끝)으로 보낸다. 거실·홀에서는 종전대로
  `wall-north` 로 북벽에 앉는다.
- wing 도면에 **복도 끝 알코브**(`CORRIDOR_NOOK_H = 4`)를 미리 비워 둔다 — 3열 복도를 3칸 막으면 통행이
  끊기므로, 화로 자리를 방 구간 위에 따로 둔다. 화로가 없으면 넓은 복도 끝으로 남는다.
- 통행선(lane) 예외: 복도 lane 은 복도 전체를 덮어 막는 물건이 설 자리가 없다. 끝 알코브 전용
  `freeForEndNook` 이 lane 을 점유로 보지 않되, `preservesAccess` 는 그대로 돌려 **화로 뒤쪽에 남는
  상호작용(문·계단)이 있으면 후보에서 탈락**시킨다(통로를 끊는 배치는 안 된다).
- 회귀: `test/conceptWingLayout.test.ts` — 화로가 복도 북단(끝)에 서고, 자리 없음 경고 0, 문에서 모든 방 도달.


### 팔레트 확장 — 안 쓰던 칩셋 그림 16종을 물건으로 (2026-09-11)

실측: 실내 칩셋은 그림 있는 타일 **478칸**인데 물건 55종이 쓰던 건 **129칸**뿐이었다. 그래서 어떤 실내든
`window·box·crate·table_chairs·counter·cabinet·bookshelf·stove·barrel·bed_v·clock·plant` 12종이 돌아왔다.

`INTERIOR_TILE_SEMANTICS` 의 라벨로 미사용 타일을 골라 **16종을 새로 정의**했다:
`window_white`(54) · `window_lattice`(174) · `glass_pane`(81) · `curtain_red`(142,143,172,173 2×2) ·
`curtain_tail`(202) · `chair_back`(267) · `chair_red`(446,476) · `chair_fallen`(384) · `table_round`(236) ·
`altar_stone`(374) · `vase_flowers`(296) · `bottle_set`(237) · `glass_shards`(417) · `armor_leather`(292) ·
`ladder_tall`(473) · `stairs_plain`(475). 전부 role=null 로 선언한다 — role 은 타일 의미 계약
(`test/interiorObjectCatalog.test.ts`)이라 임의 값을 넣으면 그 테스트가 깨진다.

**함정(실측):** `INTERIOR_TILE_SEMANTICS` 는 라벨 묶음들을 이어 붙여 만든 **밀집 배열**이라
`forEach` 의 인덱스(배열 위치) ≠ 타일 id 다. 진짜 id 는 `entry.index` 다. 배열 위치로 고르면
창문 자리에 풀숲·돌이 나온다(카드 렌더로 16종을 한 장씩 뽑아 눈으로 잡았다 — 이 검증 단계를 건너뛰면
그림이 깨진 물건이 카탈로그에 들어간다).

`CONCEPT_VOCABULARY_GROUPS`(place_concept 응답)에 새 id 를 연결해 모델이 고를 수 있게 했고,
갤러리 렌더 16장(문법 3종 × 시설 15종 × 시드)으로 확인했다.

## 실내는 찍어내지 않는다 — place_concept 은 설계를 요구하고, author_house 는 interiorPlan 을 받는다 (2026-09-11)

사용자 지적: "왜 실내를 건설할라 하면 다 똑같이 나오냐 / 도면 기반으로 똑같은 것만 찍어내는 게 문제리라".
실측이 맞았다 — `oprn-f51b995ac9`(30채 마을)의 집 실내 12개는 전부 13×10 이고 **lower 레이어 해시가 12/12 동일**,
`oprn-b3ce25d38a`(집 6채)는 전부 16×16·문 (8,13) 에 셀 차이 0.8~7%(침실 러그 유무·침대/시계 자리)뿐이었다.

원인은 두 AI 경로 모두 "설계 없이 시공" 이 기본값이었던 것이다.

- `place_concept` 은 `plan` 을 생략하면 `facilityAsPlan(템플릿)` 을 그대로 지었고(`designNote` 경고만 남겼다),
  `author_house(interior:"linked-interior")` 는 실내 설계 인자 자체가 없어 `resolveHouseConcept` 이 고른
  시설 템플릿 1장(민가)을 매번 찍었다. 시드가 흔드는 것은 러그·침대 위치뿐이고, 실내 도면은 코드가
  `layoutConceptFacility` 로 결정론적으로 만든다(같은 장소 목록 ⇒ 항상 같은 방 배치).
- 코드에 이미 있던 절차 도면 21종(`buildHouseInteriorPlan`, scale 4 × program 6)은 프로젝트가 있으면
  전부 우회된다(`resolveHouseConcept` 이 코드 초안으로도 성공한다).

변경:

1. `place_concept` — `plan` 생략은 `concept-plan-required` 로 **거부**하고, 템플릿과 구조가 같은 plan 은
   `concept-plan-identical` 로 거부한다(`plansStructurallyEqual`). 설계를 요구하는 오류 문구가
   `get_concept_facility` 로 읽을 것(장소 수·크기·구역·층·물건)을 그대로 알려 준다.
   사용자가 "템플릿 그대로" 를 명시했을 때만 `template: true` 로 통과하며, 결과에
   `data.designSource: "template"` + `designNote` 가 실린다.
2. `author_house` — 집마다 `interiorPlan`(place_concept plan 과 같은 모양, 공용 스키마
   `schemaShapes.CONCEPT_PLAN_SCHEMA`)을 받아 그 도면을 짓는다(`resolveDesignedInterior` →
   `createHouseInteriorMap({interiorConcept})`).
3. 프롬프트(`contextBuilder` 규칙 11)도 같은 문장을 싣는다: 실내는 매번 설계한다.

회귀: `test/placeConceptTool.test.ts`(생략/복사 거부 + `template:true` 탈출구), `test/interiorConceptRoutes.test.ts`
(`interiorPlan` 이 템플릿 대신 서고, 생략은 경고). 초안 자체를 검사하는 테스트(시설 초안 묶음·타일 계약·inn
물리 계약 12개 파일)는 이제 `template: true` 로 의도를 명시한다. `docs/tool-catalog.md` 재생성 필요
(`node scripts/generateToolCatalog.mjs`).

## 초안은 씨앗이고 저작본만 도면 정본이다 — 절차 도면 되살리기 + 실내 다양성 리포트 (2026-09-12)

위 절의 두 미착수 항목을 끝냈다. `createHouseInteriorMap` 의 도면 정본은 이제 세 갈래다
(`InteriorMapResult.interiorSource`):

- **designed** — 호출자가 `interiorPlan` 을 넘겼다(`resolveDesignedInterior`). 최우선.
- **authored** — 프로젝트 꾸러미의 시설이 코드 초안과 **구조가 다르다**(`isCodeDraftFacility`:
  layout·wall·`plansStructurallyEqual` 비교. 라벨만 바꾼 초안은 여전히 초안). 저작본의 도면을 그대로 짓는다.
- **seed** — 꾸러미가 없거나 초안 그대로다(복제본이 scratch 에 얹혀 있어도 구조가 같으면 초안).
  절차 도면(`buildHouseInteriorPlan`, scale×program)으로 실루엣을 내고 초안의 장소·물건을 방 테마에
  묶는다(`bindInteriorConceptPlan` → concept 오버레이는 `facilityId:"composed"`). 씨앗 바인딩이
  `ToolError` 로 실패하면(테마에 맞는 장소 없음) 도면만 두고 어휘 문법으로 꾸민다.

`build_village` 의 연결 실내도 같은 경로를 탄다(`VillageHouseInteriorRef.designSource`).

실내 다양성 리포트(`src/editor/tools/interiorVariety.ts`)는 외장 `houseVariety` 와 같은 관찰 고리다:
시공 직후 각 층 맵의 `roomHarnessPlan` 을 되읽어 도면 서명(방 배치·문 — 가구 위치 흔들림은 제외)과
물건 세트(concept 오버레이 objectId 합집합)를 집계한다. 도면 기록이 없는 맵은 하부 레이어 자체가
서명이다(최초 실측이 lower 해시 비교였던 계보). `author_house` 는 `data.interiorVariety` + summary
한 줄(`실내 N채 · 도면 M종 → verdict`)에 싣고, `build_village` 는 `data.interiorVariety` + 경고에 싣는다.
verdict 는 `diverse`/`mixed`/`monotonous` — 도면 60% 미만이 고유하면 mixed, 1종이면 monotonous 다.
경고 문구는 반복 도면 라벨×횟수, 물건 세트 동일(`vocabularyGroups` 로 갈라라), seed 출처 채수를 짚는다.

회귀: `test/interiorSeedFallback.test.ts`(초안 판정·seed/authored/designed 출처·리포트 verdict·물건 세트).
저작본 경로를 검사하던 기존 테스트는 "구조를 고친 꾸러미" 를 쓰도록 고쳤다 — 초안 그대로면 이제
seed 경로이므로(여관 다층·저택 폴백·`facilityId:"composed"` 단언).

## 맵 생성 테두리 옵션은 모델에게 주지 않는다 (2026-09-11)

사용자 보고: "맵을 AI 조수에게 생성시키면 맵 외곽에 벽을 친다". 실측으로 원인은
`mapTools.ts` `create_map` / `generateMapTool.ts` `generate_map` 의 `border: "wall"` **옵션 자체**였다.

- 기본값은 두 툴 다 `none` 이고, 실제 세션 62건 중 `wall` 은 7건 — 전부 **동굴·던전·지하실** 맵이다.
  사용자가 벽을 요청한 적은 없다(같은 로그의 사용자 발화 128건에서 테두리 요청 0건). 모델이
  "동굴이면 막아야 한다"고 스스로 판단해 골랐다.
- 설명문을 "명시 요청 때만" 으로 바꾸는 것만으로는 멈추지 않는다. 같은 발화·같은 모델에서
  스키마에 enum 이 있으면 3/3 `wall`, 없으면 0/3 (동반 서비스 직접 호출 A/B, `gemini-3.7-flash`).
  **선택지를 주는 것 자체가 유인**이다.
- 그래서 `toOpenAiTools()` 가 내보내는 파라미터에서 `border` 를 뺐다. `run()` 은 인자를 계속
  받는다 — 스크립트·테스트·과거 대화 재생이 같은 결과를 내야 하기 때문(`ai-tools-deprecation-roadmap`
  1~2단계와 같은 형태). 오타 값은 스키마 검증 대신 `run()` 안에서 `invalid-args` 로 거부한다.
- 회귀: `test/toolsMapManagement.test.ts`("모델 노출 스키마에서 border 를 뺐다"),
  `test/generateMap.test.ts`(같은 이름). 런타임 케이스(`border:"wall"` 봉인, 오타 거부)는 그대로 남는다.
- 참고: `create_map` 의 테두리는 타일셋과 무관하게 `TILE.WALL`(306) 을 쓴다 — 다른 칩셋에서는
  다른 그림이므로 애초에 일반 옵션이 아니었다. 실내(place_concept / 실내 세션)의 벽은 설계상 정상이며
  이 변경과 무관하다.

## 맵 전체 청소 `clear_map` — 파괴적 한 콜 + 사용자 허가 모달 (2026-09-11)

`src/editor/tools/mapTools.ts`(MAP_TOOLS) · 승인 페이로드 `src/ai/mapDestructionConfirm.ts` ·
적용 게이트 `src/editor/tools/applyChangesetToStore.ts` · 표면 `src/editor/panels/aiProposalCard.ts`.

맵 전체를 한 번에 비우는 툴이 없어서, 모델이 `tile_erase`/`clear_region` 로 **맵 크기를 먼저
조회해 사각형을 계산**한 뒤 호출했다. `clear_map` 은 그 왕복을 없애고, 대신 "타일만 지운다"는
경계를 이름에 못박는다.

| 계약 | 값 |
|---|---|
| 인자 | `mapId`(필수), `fill`(`grass` 기본 / `empty`=허공), `events`(`keep` 기본 / `remove`), `confirmDestroy`(**true 여야 실행**) |
| `confirmDestroy` 없이 호출 | 커밋 없이 `invalid-args` + 예시 문구(맵 이름·칸 수를 함께 알려준다) |
| 지우는 것 | 하위·상위 타일 전량, 타일 스택 |
| 안 지우는 것 | 필드 스폰·명명 로케이션·`layoutPlan`·`structurePlacements`·맵 속성·맵 자체(= `remove_map`) |
| `fill:"empty"` + 시작/전송 칸 | 그 칸은 **남기고** 경고한다(`passageProtectedCells`, `tile_erase` 와 같은 정책). 시작 위치가 통행 불가면 `start-position` lint 가 커밋을 막기 때문이다 |
| 완성된 집 | 기록된 소유 영역이 있으면 `protected-house-write` 로 **거부**(선언·승인과 무관한 러너 불변식) |
| 되돌리기 범위 | `MAP_ONLY_WRITE_TOOLS` 에 등록 → undo 스냅샷 1개가 그 맵만 되돌린다 |

**왜 이 툴만 사용자 허가 모달인가.** 2026-09 정책은 "변경 확인 팝업 없음, 복구는 되돌리기"다
(`src/ai/approvalPolicy.ts` 머리말). 그 판단의 전제는 *무엇이 사라졌는지 사용자가 화면에서 봤다*이고,
맵 규모 파괴는 그 전제를 깬다 — 한 콜로 맵 전체가 바뀌므로 적용 전 화면과 결과가 다른 맵이다.
그래서 소실 규모가 승인 UX 를 가르고, 등록 지점은 하나다:

- `MAP_DESTRUCTION_TOOLS`(`approvalPolicy.ts`) — **이름 기반** 판정. 모달 문안을 만들 때 쓴다.
- `removedMapIds`·`emptiedEventMapIds`(같은 파일) — **내용 기반** 판정. base ↔ 제안의 실제 차이를
  본다. 툴 이름이 무엇이든, 아니 이름을 아예 안 넘겨도 맵·이벤트가 사라지면 걸린다.
- 채팅 표면: `aiProposalCard` 가 적용 **직전** `showConfirm` 을 띄운다. 취소는 적용도 되돌리기도
  아니다(무변경). 모달 요청은 `applyingCalls.add` **앞**에서 만들어 취소가 재시도를 막지 않는다.
- 자율 런: `AssistantSession.maybeAutoApplyMilestone` 이 이 배치를 **자동 적용하지 않는다**
  (모달을 띄울 사람이 없다). 초안은 남고 표면에서 확인 후 적용된다.
- 안전망: `applyProposedProject` 가 **(a)** base 대비 맵이 사라졌거나 이벤트가 전멸했거나
  **(b)** `toolNames` 에 맵 규모 파괴가 있으면, `mapDestructionApproved !== true` 일 때
  `map-destruction-unapproved` 로 거부한다.

  > **2026-09-17 정정.** 여기엔 원래 "`/pi` 처럼 자기 검토 카드를 가진 표면은 실제 툴 이름을
  > 넘기지 않아 스스로 빠진다"라고 적혀 있었다. 틀렸다 — Pi 에는 그 카드가 없었다. 실측에서
  > 「맵 전부 지워줘」 한 줄이 맵 16개를 4개로 줄였는데, `toolNames` 가 `["pi_agent"]` 라
  > 이름 게이트가 한 번도 울리지 않았고 확인 모달도 거부도 없이 곧장 「적용 완료」였다.
  > 이름만 보는 게이트는 "이름을 안 넘기는 경로"를 전부 놓친다. 그래서 내용 기반 판정을 더했다.

  내용 판정이 5개 호출자 전부에 걸리므로, **적용 직전에 확인을 띄우는 책임도 5곳에 있다**:
  `aiPiAgentCommand`(Pi 채팅)·`aiProposalCard`(제안 카드)·`clusterAiModal`(군집)은 `showConfirm`,
  `assistantSession.maybeAutoApplyMilestone`(자율 런)은 **건너뛰고**(사람이 없다),
  `aiLaneManager`(레인)은 **거부**한다 — 무인 레인은 소실을 자동 확정하지 않는다.

모달 문안의 맵 이름·칸 수는 **툴 실행 결과(`result.data`)** 에서 온다 — 모델 문장이 아니다.
수치를 못 꺼내도 요청은 만든다(fail-closed).

**일부러 넣지 않은 것:** `SPATIAL_BUILD_TOOLS`/`TILE_WRITE_TOOLS`(밑그림 게이트). 그 게이트가 아는
허가 형식은 `set_build_spec` 의 `clear`+`confirmDestroy` 이고 이 툴은 자기 인자로 같은 허가를 이미
요구한다. 둘을 겹치면 「이 맵 다 지워」가 명세 제출 왕복을 강제당한다. 대신 파괴성 레지스트리
(`approvalPolicy.DESTRUCTIVE_TOOLS`·`overInsertionReview.DESTRUCTIVE_CALLS`)와 승격 금지 목록
(`capabilityEscalation.ESCALATION_DENYLIST`)에는 등록했다 — 자연어가 스쳤다는 이유로 얹히지 않는다.

회귀: `test/clearMap.test.ts`(9건 — 등록/도메인, 잔디·허공 채움, 스택 제거, `confirmDestroy` 없이
거부, 이벤트 유지+경고, `events:"remove"` 의 diff, 빈 채움에서 시작 칸 보존, 완성된 집 거부),
`test/clearMapApproval.test.ts`(7건 — 모달 페이로드의 실측 수치, `applyProposedProject` 게이트 거부와
승인 후 적용, 그리고 내용 기반 판정 2건: 툴 이름이 `pi_agent` 여도 맵이 사라지면 거부 / 맵은 남아도
이벤트가 전멸하면 거부), `test/clearMapPanelApproval.test.ts`(4건 — 취소=무변경, 취소 후 재시도 가능,
확인 시 `mapDestructionApproved`, 비파괴 배치는 무질문).
브라우저 증거: `test/e2e/clear-map-approval.spec.ts` → `.omo/evidence/clear-map-approval/`.
그 스펙은 **실제 `clear_map` 드라이런 결과 → 실제 페이로드 → 실제 모달**을 검증하고, AI 턴 전체
(플래너 → 수용 기준 → 독립 검수)의 대본화는 하지 않는다 — 그 프로토콜의 정본은 vitest 하네스다.

## 명명 로케이션 툴 7종 (OPRN-OUT-020 + LOC-ADOPT, 2026-09-10)

`src/editor/tools/mapLocationTools.ts`. 목표 하나다: 사용자가 "정문 광장"이라고 말하면 조수가
좌표를 되묻지 않고 그 사각형을 쓴다.

| 툴 | 모드 | 하는 일 |
|---|---|---|
| `list_map_locations` | read | 맵의 명명 로케이션 전량(ID·이름·사각형·메모·태그·출처) |
| `resolve_map_location` | read | 이름/ID/부분일치, 또는 `x,y` 로 그 칸을 덮는 **가장 구체적인** 구역 |
| `create_map_location` | write | 이름 붙은 구역 생성(겹침 허용) |
| `update_map_location` | write | 이름 또는 사각형 변경. **이름을 바꿔도 ID 는 그대로** |
| `delete_map_location` | write | 삭제. 참조가 있으면 `brokenReferences` 로 복구 방식을 밝혀야 한다 |
| `survey_layout_adoption` | read | 프로젝트 전체에서 아직 안 옮긴 설계 영역을 맵별로 **센다**(아무것도 안 바꾼다) |
| `adopt_layout_regions` | write | 빌더 `layoutPlan.regions` → 로케이션 **복사**(멱등, layoutPlan 불변) |

- **이관은 조사 → 실행 두 단계다 (LOC-ADOPT).** 사용자가 "어느 맵을 이관해야 하나" 를 물으면
  `survey_layout_adoption` 을 먼저 써라 — 읽기 전용이고 맵별 (후보 / 이미 승격 / 재시공 재바인딩 /
  이름 충돌 / 고아) 를 준다. `adopt_layout_regions` 의 `roles` 기본값은 **「전부」가 아니라**
  `DEFAULT_ADOPTION_ROLES`(`plaza`, `market`) 다: `house` 는 시공·보호 단위라 한 마을에 20~40개가
  나오고, 기본으로 켜면 저작자가 쓴 적 없는 이름 수십 개를 게임에 실어 버린다. 사용자가 명시적으로
  요청할 때만 넓혀라. `collisionPolicy` 는 `suffix`(기본, 밀린 이름을 `renamedFrom` 으로 보고) 와
  `skip` 중 하나이며, 어느 쪽이든 기존 로케이션의 이름·ID 는 바뀌지 않는다.
  반환의 `skipped` 는 `skippedAlreadyAdopted` / `skippedNameCollision` / `rebound` 세 이유로
  갈라졌다 — `rebound` 는 빌더 재시공으로 region ID 만 바뀐 같은 장소를 **새로 만들지 않고**
  기존 로케이션에 다시 묶었다는 뜻이다(로케이션 ID 불변 = 참조 생존).
  사람 경로는 편집기의 「설계 영역 이관」 창이다.
- **`find_layout_regions` 와 층이 다르다.** 그쪽은 마을 빌더의 설계 기록만 본다. 이쪽은 사람이 저작한
  로케이션 층이다. 두 층의 관계·마이그레이션은 `openwiki/runtime-project-schema.md` 의
  「명명 로케이션 레이어」 절이 소유한다.
- **`delete_map_location` 은 참조가 있으면 그냥 지우지 않는다.** `brokenReferences` 로
  `remap`(+`replacementLocationId`) / `detach` / `freezeRect` 중 하나를 밝혀야 하고, 밝히지 않으면
  `location-referenced` 로 거부한다. 이유는 실측이다: 툴 러너의 커밋 게이트가 «이 변경이 새로 만든
  error» 를 막으므로 참조를 남긴 삭제는 애초에 커밋되지 않는다. 그리고 참조를 끊는 것은 사용자에게
  물어야 하는 결정이다. 사람은 편집기 레이어에서 그냥 지우고 나중에 복구 UI 로 고칠 수 있다 —
  두 경로의 비대칭은 의도된 것이다(조수는 한 턴에 원상복구까지 끝낸다).
- 회귀: `test/mapLocationTools.test.ts`(12건 — 등록 모드, 이름/부분일치/점 해석, 이름 변경 후 ID 불변,
  참조 있는 삭제 거부, detach/freezeRect/remap 복구, 승격 멱등 + layoutPlan 불변,
  `find_layout_regions` 가 사람 층을 보지 않음).

## Exact project values and sourced declarations (2026-09-08)

The existing acceptance ledger supports `projectTitle` (exact `meta.title` and
`system.titleScreen.title`), `itemValues` (one exact item ID, with requested
name/price), and `projectPreserve` (the immutable request baseline outside an
explicit finite list of title/item changes). `scope:"project"` includes wiki
content; `scope:"authored"` reuses the existing coordinator-owned wiki exclusion
and must not be described as whole-project or wiki preservation. Missing,
duplicate or wrong targets and unauthorized changes fail.

`wikiDeclaration` takes `documentId`, `combatMode` and `sourceQuote`. It requires
one unsuperseded explicit declaration with that mode, a unique quote in the
ledger-owned original request, and a canonical user source whose full text
matches that request. This proves a stored preference, not working combat or
visible monsters. Unresolved runtime requirements remain unresolved.

All four criteria evaluate actual current data and retain the applied/draft
distinction. Model success flags or supplied provenance are not evidence.
Implementation: `src/ai/assistantAcceptance{,Evaluation,Ledger,Tools}.ts`.

The separate `gameTitle` criterion proves exact displayed title-screen text,
including the runtime settings fallback and exclusion of hidden graphic-only
text. It does not check `meta.title` and is rechecked on canonical reload.
`projectTitle` instead checks both stored title fields, even when their exact
requested value is empty; it does not prove visibility. Keep both criteria when
both contracts are requested. Their shared provider `title` field is a string;
the runtime parser enforces the distinct kind-specific validity rules.

## Measured zero-prop rejection diagnostics (2026-09-07)

`placePropsDomain.ts` and the shared pattern engine in `placementTools.ts` retain
the existing single/pattern admission rules, material resolution, sampling,
packing, event opt-out and unconditional house/stamp ownership protections.
Zero placement still throws `placement-zero`; neither rejection nor diagnosis
changes tile arrays, shared tile rules, authored overrides or requested count.

On zero placement, `PropPlacementError.diagnostics` measures candidate origins
with the same admission predicates, collecting all vetoes instead of stopping at
the first. The unchanged runner transports the machine record as one standalone
`placement_diagnostics: <JSON>` line in the **full** `issues[].message`. Parse that
sentinel and JSON, not cause/recovery prose or the clipped `summary`. This track
does not add error `data` transport or an automatic retry consumer.

- `unit: "candidate-origin"`: each geometrically fitting object origin counts
  once, not once per footprint cell, rejected prop, or placement attempt.
  `footprint.w/h` are tile-cell dimensions. `candidateOrigins = rejectedOrigins
  + eligibleOrigins`; `rejectedBy` counts each origin once per reason, so its
  overlapping values must **not** be summed as a rejected-origin total.
- `scope: "area-candidate-origins"` is a census of the area on zero placement,
  not a claim that the natural sampler tried every origin. Single-tile natural
  sampling can miss eligible cells; `eligibleOrigins` is not packing capacity.
  Pattern origins must fit the area and map. No fitting geometry yields zero
  origins and empty reasons, not an invented occupancy cause. Single-tile
  domain calls also count out-of-map origins as `outOfBounds` (the public v3
  boundary still rejects out-of-map rectangles before placement).
- Internal dense explicit origins use `scope: "explicit-candidate-origins"`;
  repeated coordinates count once and outside-area/map footprints are rejected.
  Tree visibility and first-step bag footprints retain their actual policies.
- Reasons distinguish `upperOccupied`, `lowerImpassable`, `protectedSurface`
  (road/sand/cobble), `blockedLowerSurface` (the existing water/wall mask),
  `lowerIncompatible` (the lower footprint's placement rule, not necessarily
  impassability), `protectedEvent` (start/event/transfer), `protectedOwnership`
  (house/stamp), `outOfBounds`, and `trunkVisibility`.
  An upper-occupied origin also checks the lower ground that clearing upper
  would expose, across the entire footprint; `lowerImpassable` includes that
  recovery blocker. Existing trunk-supported canopy overlap is preserved.
- `upperErase.upperOnlyOrigins` counts origins whose only blocker is upper
  occupancy. `upperErase.recommended` is true only when **every** census origin
  is upper-only and at least one exists. Mixed causes, blocked lower, protected
  surfaces, events/ownership, insufficient geometry and missed samples get no
  erase recommendation. When applicable the hint explicitly uses
  `tile_erase(layer:"upper")`, never its destructive default `both`. This is
  advice, not permission to bypass approval, ownership or the commit gate.

The captured regenerated-cellar area `(7,5) 3x3` contains six passable lower423
and three passable lower360 cells, with empty upper. Its diagnostic is exactly
`candidateOrigins:9, rejectedOrigins:9, eligibleOrigins:0,
rejectedBy:{protectedSurface:9}` with upper erase disabled, even for count2/3.
The older tall-grass forest test actually writes incompatible **lower**
vegetation: its 30x30 area has 870 rejected 1x2 origins, not occupied upper.
Its former prose expectation requiring upper erase was replaced by those exact
machine counters and whole-project non-mutation assertions.

Contracts: `test/propRejectionDiagnostics.test.ts` and
`test/placePropsZeroPlacement.test.ts`. Real runner countercases preserve exact
2/2 combined-town crates237 on ground222/240 and interior crates295 on floor72;
they assert unchanged lower material and tileset rules, not reduced counts or
material substitution. Diagnostics are offline engine/tool evidence, not a
repair of Round10 content or proof of live-model recovery.

Verification receipt for task `st_01a079e9`, exact base
`ecae43ffca8714cb1a13b073c0825c65e8ae8c30`:

- RED: the initial 22-case diagnostic suite had 19 missing-diagnostics failures
  and three passing exact 2/2 crate controls. Additional countercases caught
  blocked lower furniture backing and incorrectly labeled explicit-origin scope.
- GREEN: `npm test -- test/propRejectionDiagnostics.test.ts
  test/placePropsZeroPlacement.test.ts --maxWorkers=2` passed all 29 tests.
  No timeout, sleep, polling or expected placement-count relaxation was added.
- Protected run: 19 files, 201 passing / 14 failing tests. An untouched archived
  base run of the 18 pre-existing files had 174 passing / the **same 14 failing
  test identities**, giving zero new failures. Existing failures remain visible:
  `scatterObject` six (legacy tree origin/count expectations),
  `clusterRulePlacement` five (legacy tile-layer expectations), `forestDensity`
  two (`0.3003472222222222 < 0.3`), and `houseProtectionForest` one (puddle
  fixture `Cannot read properties of undefined (reading 'type')`).
- `npm run typecheck:app` and `npm run build:app` exited 0. Build emitted circular
  re-export, mixed static/dynamic import and large-chunk warnings. The shared LSP
  client timed out on refreshed files; a dedicated local TypeScript `tsserver`
  completed syntax, semantic and suggestion diagnostics for all four changed TS
  files, with zero diagnostics and no missing completion events. No Markdown
  LSP is configured; the wiki passed `git diff --check`.
- An offline `vite-node --config vitest.config.ts` exercise called the real
  `runTool` boundary: the nine-cell sand/road case rejected without mutation,
  while ground222, ground240 and interior floor72 each placed exactly 2/2 crates
  with original lower tiles and tileset rules intact. No live DB, model, UI,
  gameplay session, push, PR or remote merge was part of verification.
- Raw local receipts: `/tmp/st_01a079e9-receipts/`. `red.log` SHA256
  `7f7540b4dc729563aed45506bc5d43e3fd47d3436dbde54a07ad81f033bb0886`;
  `green-focused-final.log` SHA256
  `a14b6b58cd6b6fff6a6e2a5770151833cb7b60bf4254b638a32a50245795c95a`.
  Those temporary logs are not shipped source; the tests and this receipt are
  the durable reproduction contract. Full-suite gates and player/standalone
  builds were not run for this bounded editor-only repair.

## Logical walkthrough versus real player traversal (2026-09-07)

`play_walkthrough`의 `moveTo`는 좌표를 이동시키지만 `playerTouch`/`eventTouch`를 발동하지 않는다.
이동문 명령을 검사하려면 해당 이벤트 ID로 `interact`한 뒤 `mapId`를 확인한다.
따라서 이동문 좌표에 `moveTo`한 직후 다른 맵을 기대하는 시나리오의 실패만으로 전송 엔진 결함을 단정하지 않는다.
논리 검사 통과와 실제 키보드 이동·터치 발동은 별도 증거다. 런타임 QA 하네스에서 실제 왕복을 확인한다.
이 설명은 도구 사용 계약의 명확화이며 실행기·전송·통행 판정의 동작 변경이 아니다.

## Tile-query selector and filter boundaries (2026-09-07)

`tile_query`의 `similar`/`unclassified`는 `labels`/`vocab`/`unapproved`와 같은 선택 순서를 쓴다:
명시 `tilesetId` → 명시 `mapId`의 타일셋 → 시작 맵의 타일셋 → `DEFAULT_TILESET_ID`.
선택한 명시 ID가 없거나 비어 있으면 오류이며, 다른 맵/타일셋으로 조용히 대체하지 않는다.
`labels`의 비어 있지 않은 검색어가 일치하지 않으면 `labels: []`를 반환한다. 생략/빈 문자열/공백은
기존 제한 개수 탐색을 유지하며, 빈 검색에서만 설명 전용 타일의 전체 스캔 폴백을 허용한다.
의미 매칭·통행·카탈로그 라벨은 변경하지 않는다. 회귀: `test/tileQueryBoundaries.test.ts`
(시작/대상/명시 타일셋 분리, 잘못된 선택자, 검색 실패와 빈 검색 탐색).
## Action enemy profile edits (2026-09-07)

`make_action_enemy` patches an existing enemy's `actionProfile`: omitted fields,
including `attack`, retain their authored values. A supplied `attack` replaces
that attack and must contain its complete required fields. Existing stats,
rewards and other enemy fields are not reset by a profile edit. New contact-only
enemies remain supported.

The tool validates the profile and its nested attack before preparing any
mutation. Unknown keys (including a literal quoted `"attack"` key), unsupported
attack kinds, missing attack fields, wrong value types and non-finite numbers
return `invalid-args` rather than becoming a successful lossy normalization.
The shared project-load normalizer retains its legacy behavior; this stricter
contract belongs to the authoring boundary.

Regression seam: `test/actionTools.test.ts`, through the real `runTool` path and
the canonical serialize/deserialize round trip.

## Explicit field-spawn mutations (2026-09-07)

New AI authoring should specify top-level `spawnMode` on `make_action_enemy`.
`"add"` requires a spawn and rejects an ID already present on the selected map.
`"update"` requires a nonblank existing `spawn.id` on that exact map; an unknown
ID fails with `spawn-not-found` without changing the enemy or adding a spawn.
Both operations retain the existing required map, troop and area payload.
Successful results include `mapId`, `spawnId` and `spawnOutcome`.

Omitting `spawnMode` deliberately preserves legacy upsert/append behavior.
That compatibility path is not duplicate-proof: use explicit modes for new
creation and correction. Deliberate multiple spawns remain supported, including
multiple spawns of the same enemy or troop.

`remove_field_spawn({mapId, spawnId})` removes only that authored map entry.
It never deletes enemy records, rewards, troops or other spawns. Missing targets
fail, and references from `roguelikeRoom.encounterSlots` block removal with
`spawn-in-use`; callers must update those references explicitly.

Regression seam: `test/actionAuthoringPrerequisites.test.ts`, including direct
handler rejection without mutation, real runner results and published schemas.

Canonical spatial hierarchy tools, detached proposal ownership, legacy adapters and
real-runner evidence: [spatial-ai-tools.md](spatial-ai-tools.md). In active spatial
mode this supersedes the legacy concept-catalog ownership notes below.

## Monster resource discovery and AI appearance evidence (2026-09-07)

`list_monster_resources({})` returns the entire current monster index, without a default
20/50-entry cap. Optional `query`, exact `ids`, `include: "index" | "full"`, `offset`
and `limit` allow filtered/paged reads. The response contains `resources`, `include`,
`total`, `returned`, `nextOffset`, `complete` and `unknownIds`. `complete` means the
response covers the entire filtered result (offset zero and no next page); it does
not claim that unknown requested IDs exist. Index entries omit description; full
entries preserve the entire effective description. `get_monster_resource({resourceId})`
returns `{resource}` with the exact current full entry or fails, never a substitute.
All entries come from `assets/monsterResourceCatalog`, including project metadata
overrides. Metadata-only stored keys do not register resources; explicit non-monster
uploads cannot masquerade as monsters through prefixes or profiles.

The three appearance writers (`upsert_enemy`, `define_monster_species`,
`make_action_enemy`) accept root-level, tool-only `appearanceTags`. For a new/changed
visible AI selection, use a raw exact monster ID, read its full current metadata,
then declare 1-32 desired visible identity tags (each 1-64 characters). Every declared
tag must match an effective resource tag after NFKC/case/outer-whitespace
normalization. Tags are whole values, not fuzzy queries, substrings or enemy names.
At least one matched tag must also contain a letter-bearing identity word outside
`GENERIC_APPEARANCE_WORDS` in `ai/monsterAppearanceEvidence.ts`. This bounded exclusion
set covers common creature/class labels (monster/enemy/creature/beast/animal/humanoid/
undead/boss/minion and Korean counterparts), basic English/Korean colors, broad
size/appearance words and asset-origin words. Whitespace/hyphen/underscore-separated
combinations of these words do not evade the rule; numbers alone do not count.
Specific user-authored tags remain legal: there is no closed species-name catalog.
An arbitrary boss display name with goblin art is valid; declared goblin identity
with slime art is not. The envelope is never persisted in enemy/species records.
Existing unchanged art/stat edits and intentional transparency remain valid.
Non-AI explicit-art/rename and reliable legacy identity-query behavior are preserved.

`ToolReadEvidence` enforces this independently of the generic read-before-write
contract. The session registers current-request read call IDs, then consumes only
full successful results actually present in the post-compaction model request.
Registration alone grants no credit: native and monster reads are credited only
after that writer request succeeds without cancellation, before its response executes.
Index pages, missing/failed results, unreturned IDs, stale metadata, historical user
requests and same-batch unobserved reads cannot authorize a new selection. Budget
compaction cannot turn an executed-but-undelivered full read into permission.
`monsterAppearanceSession` tests the actual model-facing serialized catalog, not
only the read tool; `monsterAppearanceTransport` tests budget loss explicitly.

An appearance-read refusal leaves a newly declared record unavailable even though
the producer did not execute. `AssistantSession` tracks that absent ID for the
current batch, so dependent troops and transitive encounter writes receive
`record-dependency-failed` deferrals rather than consuming their own retry targets.
Unrelated writes continue. A successful creation clears the unavailable ID;
a failed/deferred update does not invalidate a record that already exists.
`assistantDependencyRetry` covers both generic-read modes, delivered appearance
reads, transitive recovery and existing-record references.

Full entries also include `assetIdentity`, a compact SHA-256 digest shared by the
read response and current authorization snapshot (`ai/monsterResourceSnapshot.ts`).
It hashes the raw resource ID plus the upload's encoded image source and render
metadata, never returning base64. Replacing `assets.uploaded[id].dataUrl` at the
same ID invalidates old evidence for new/changed assignments even when effective
name/tags/description are unchanged; a fresh full read restores eligibility.
The index remains compact and unchanged. Existing unchanged-art/stat-only edits
still bypass selection evidence deliberately: this is not a gate on upload editing.
Bundled/profile image sources are assumed fixed within the running asset build;
this token does not fetch/revalidate remote bytes behind an unchanged URL.
`monsterAppearanceAssetIdentity` covers replacement/reread across all three writers,
both full-read paths, and the actual assistant session.

**Limits of this check:** tags are the assistant's declared visible identity, not
machine vision and not proof of the user's intent. Generic/shared tags may match
many resources. The finite generic-word policy rejects known generic-only declarations,
not every synonym, compound or invented vague phrase; a nonexcluded tag is not a
semantic proof. Incorrect or adversarially edited metadata may be internally
consistent but visually wrong. The guard cannot prove that a model honestly chose
tags from the user request rather than retrofitting them to an arbitrary resource.
Names, tags and descriptions (including prompt-like text) are untrusted reference
data, never instructions or a permission to change the user's request. Human/vision
review of actual artwork is separate; reviewed status is owned by the catalog lane,
not inferred by these tools. Provider image delivery is a separate transport gate.

## House-site tree clearance before ownership (2026-09-07)

`author_house` checks all requested lots before stamping or sealing any house.
Canopy/trunk tiles in the completed-house footprint, including the north ridge
and gaps between wings, return `house-tree-clearance-required` with coordinates.
Clear the entire tree atom explicitly before construction or choose another site.
The producer does not erase beyond its requested footprint or bypass completed
house protection. Unrelated trees/errors outside the requested sites do not block
construction. Real facade and `runTool` atomicity, batch, clear-then-build and
ownership controls are in `test/authorHouseTreeClearance.test.ts`.

## Flower-yard material in house lots (2026-09-07)

The high-level `author_house` lots path translates `yard:"flowers"` to the
canonical bundled material label `꽃/자연 소품`. The former bare `꽃` did not resolve
in the shipped catalog and caused the entire construction to fail. This does not
ignore yard shortfalls or bypass structure protection. The actual producer path
is covered by `test/houseLotFlowerMaterial.test.ts`.

Generated `place_npc({guide:"action-controls"})` guides omit automatic portraits;
an explicit `face` still uses the normal authoring contract. This avoids shipping
an inferred faceset ID absent from the project while preserving the canonical
controls, existing guide identity and position.

## Pre-write original grounding (2026-09-06)

`originalContext.ts` exports a detached authored-state extractor reusable for before/after
review. The session captures it before planning or tools, retains its snapshot ID across
continuations, and recaptures on a new request (including a fresh Ask). Retaining P2
canonical goal evidence across questions does not freeze the question's original-data
snapshot. Target selection uses structured intent,
actual selection and current map, never new natural-language keyword routing. A missing
explicit target is reported, not replaced with the start map. Target map metadata, complete
tile layers/stacks, complete events/pages/commands, authored system settings and relevant
full database records are included. Actual record IDs are followed transitively, including
common-event cycles; declared database/battle/system and quest/world tasks broaden the
authored context. Runtime session, credentials/configuration and asset transport blobs are
outside this projection. Existing resource tools remain the resource lookup surface.

The authored `ProjectStartState` (`startStateOf(project)`, serialized as `project.session`)
and authored `project.testPresets` are complete `/session` and `/testPresets` entries,
not live `PlaySession` data. Both use the same whole-entry budget and exact paging route.
Their keys/values seed the reference closure, including inventory IDs, party actors/classes,
flag definitions and referenced maps/events/common-event cycles. Referenced maps reuse the
target-map projection; maps and shared tilesets appear once. Summary/map-tree navigation
does not expand unrelated maps. Runtime-exclusion tests mutate a separate `startSession` result.

Independent review supplies explicit `mapReferenceRoots` from the current/changed maps
and actual before/after edits. `reviewMapReferenceRoots` compares presets by authored ID:
changed/added/deleted presets include their complete old/new references and effective start
maps, not unchanged sibling maps. Changed start state/position includes the effective start
maps. Other changed collections are compared recursively, cancelling unchanged array
members with multiplicity before descending into changed records/commands. Coordinate-only
edits retain their containing map target; edited world entities retain their own refs,
not unchanged sibling entities. Explicit review roots can follow common-event call chains,
but an included map is evidence, not a traversal root for its unchanged transfers or calls.
Only the default writer mode traverses referenced map contents transitively. Complete `/session`
and `/testPresets` values and record references remain in both projections. The writer's
default start/preset closure and exact paging are unchanged. This prevents the R5+R6
six-map rename overflow without a map cap, truncation or capacity-guard change. Contracts:
`independentReviewMapDeltas`, `independentReviewReferenceScope`, `assistantIndependentReviewCapacity`,
`independentReviewLinkedMaps` (chain/star rename, changed transfers/calls, world-record scope).

`buildGroundedRequest` appends JSON `originalContext` after history compaction, so the
first writer sees its original values even with `budgetChars: 1`. It accounts for complete
native schemas, history, originals and the existing 16,384-token response reserve against
the actual supported bundled model window. The small browser-safe capacity table is
checked against installed pi-catalog; the 9 MB provider catalog/runtime is not bundled.
History compaction also reserves the original paging manifest and reconciles its character
clamp with token-weighted messages and tool-call arguments. An expanded native catalog must
not strand otherwise pageable originals at a nearly full history boundary.
Unknown native IDs use the companion's provider-default fallback; injected unknown models
retain the conservative legacy estimate. Token counting remains an estimate, not a tokenizer.

Whole entries that do not fit remain explicitly omitted with a `get_original_context`
list/read route, stable entry paths, snapshot ID and UTF-16 offsets. Concatenate exact JSON
pages before parsing. Only successfully delivered whole originals or fully covered page
ranges count at the existing `ToolReadEvidence` seam; partial/omitted/failed reads do not.
Malformed or rewritten historical tool JSON is refused as evidence without aborting the
model response; original text, total length and pagination metadata must match exactly.
Original receipts cannot replace a subsequent fresh read; existing fingerprint/reference
checks and ask-mode refusal remain. Irreducible mandatory requests fail explicitly without
pruning tools. A huge latest write result may still exceed a small window; paging originals
does not claim arbitrary tool-result paging. Task recipes accompany the catalog for NPC,
map/interior, database/battle, quest/world and life read-write-verify work. Tests:
`originalContext`, `assistantOriginalContext`, `assistantReadContract`, `aiToolDiscoveryEscalation`.

Native reads follow the same delivery boundary: `ToolReadEvidence.queue` captures the
executed result without granting credit. After the actual writer request returns, before
its tools execute, `observeDelivered` matches the pending call ID/name and complete exact
data against the outgoing messages. Execution, summarizer/reviewer context, sampled grids,
stripped data and same-response reads cannot grant first-delivery credit. Previously
delivered credit survives history compaction, but existing current-record fingerprints still
invalidate changed data. Pending receipts share the goal lifecycle (`begin` clears them;
genuine continuations retain them), and project switching drops the session as before.
Regressions: `assistantNativeReadDelivery`, `toolReadDelivery`; the 512,029-character native
read plus six summaries is refused after real compaction/clamping, then complete original
paging or a complete current native result enables the subsequent writer response.

## Hybrid native tool exposure (2026-09-19)

The default editor chat uses **Pi**, not `AssistantSession`. The first hybrid change
(`eb5c5bea5`) affected only the legacy session; its passing tests did not prove normal chat.
The production chain is `aiChatPanel.plainPiTurn → runPiCommand → PiAgentRequest →
runPiAgent`. The panel now uses the shared `sessionToolExposure` candidate builder and
passes `initialToolNames` through every normal send, queued send, kickoff and bridge path.
It includes core/control tools, the intent's named tools, adventure foundation tools, and
natural-language matches. `AssistantSession` additionally supplies its plan/read contracts.
A failed intent declaration sends the full catalog. Read-only/plan requests retain the
full read catalog; explicit `/pi` and team members retain their existing role/domain seeds.

`initialToolNames` is a schema-exposure hint, **not** a permission list. The worker's
`options.toolNames` and `readOnly` remain hard boundaries. A successful `find_tools` result
adds allowed native schemas to the same live array before the next Agent request. A successful
empty search restores the entire permitted catalog. Direct calls to unexposed registered
tools are still rescued within those boundaries. The old 16-tool promotion cap is removed:
search success must not silently omit the seventeenth schema. Registry names are deduplicated,
superseded definitions stay hidden, and an explicitly empty role allowlist allows nothing.
Team children clear the parent's shortlist and choose their own role/domain catalog.

The Pi prompt carries the compact capability index when discovery is available, filtered by
its read/role boundary. Candidate selection does not bypass argument validation, detached
project drafts, publication, approval, cancellation or scope checks. Full-catalog fallback is
for routing misses; provider validation errors are not silently retried with another catalog.

Evidence: `.omo/evidence/ai-tool-exposure/README.md`. The fixed RPG intent fixture sends
34 initial registry schemas versus 236 unique active definitions; JSON schema characters
fall from 337,554 to 72,620 (78.5%). These are character counts, not billed tokens, and the
intent is a fixed test input. Browser screenshots use a scripted model with the actual
editor → HTTP request → Pi Agent → registry execution chain. They do not prove live-model
intent or authoring quality. Live OAuth providers were disconnected during this verification.

Regression seams: `aiChatPanelComposerMode`, `piAgentRunOutcome`, `piAgentToolAdapter`,
`piAgentTeamRuntime`, `piAgentToolEscalation.bun.test.ts`, `piApplyModes.bun.test.ts`,
`aiToolExposureHybrid`, and `aiToolCapabilityIndex`. Reproducible browser QA:
`bun scripts/qa/ai-tool-exposure-worker.mts`, then
`BASE=http://127.0.0.1:<worktree-port> node scripts/qa/ai-tool-exposure-browser.mjs`.

## Review approval lifetime (R3, 2026-09-06)

`AssistantSession.runTurnLoop` owns each attempt's original abort signal and wraps
the writer/review execution. Non-final stops, cancellation, failed milestone apply
and thrown execution/subscriber errors retire that attempt's approval permanently.
Replacing the UI's active signal cannot revive a completed approval whose original
signal was aborted. `result_review` publishes the independent verdict, not immediate
apply authority: admission follows the callback, current-candidate/owner checks and
the existing output budget check. Review evidence and audit entries remain retained.

`retryLastTurn` re-enters the existing writer/review loop when unapplied, unapproved
draft calls remain, even without a provider error. It preserves the draft and original
request; application requires a fresh current review. `canRetryLastTurn` retains its
provider-error meaning. Already-applied persistence-proof retries still avoid writer,
reviewer and edit replay. Regression: `assistantReviewApprovalLifecycle` drives real
session, direct proposal host, autonomous apply, undo and local save/read proof paths;
`assistantIndependentReview` retains held late-approval and budget/error cases.

## Audio description tools and event candidates

Audio identity is `{ kind: "music" | "sound", resourceId: rawId }`. Search-result prefixes
`bgm:` and `se:` aren't valid override keys or detail/write tool IDs.
`src/editor/tools/audioDescriptionTools.ts` defines:

| Tool | Contract |
| --- | --- |
| `get_audio_resource` | Read an existing resource's full description and source from the current project. The resource is returned at `data.resource`, with its raw `id`. |
| `set_audio_description` | Write through the existing draft/proposal/approval path. `action: "set"` requires a string; `""` clears. `action: "reset"` removes the override and rejects a supplied `description`. |
| `upsert_resource` | `resource.description` is optional and allowed only for music/sound. Omission preserves the override; an explicit string uses the same writer. Description-only edits don't need a new asset or `dataUrl`. |

New strings are trimmed at the write boundary and limited to 4,000 UTF-16 code units after
trimming. Internal line breaks survive. Kind/ID existence and input validation happen before
applying the edit. `src/editor/tools/resourceTools.ts` owns upload integration.
`audioDescriptionsChanged` counts changed kind/raw-ID states, including clears and resets.
The changeset, preview, commit summary and meaningful-change checks retain description-only
proposals; they aren't tile-only auto-apply work. Approval and project undo/redo use the
existing transaction path.

### Search pages and full detail

`list_resources` in `src/editor/tools/queryTools.ts` keeps search kinds `bgm`/`se`, existing
prefixed result IDs and the default 20 results. `offset` defaults to 0 and must be a
nonnegative safe integer; `limit` is an integer from 1 through 50. The response contains
`data.matches`, `data.total` and `data.nextOffset`, which is `null` at the end.
Non-audio search meaning stays unchanged.

Audio matches also contain raw `resourceId`, `description`, `descriptionSource` and
`descriptionTruncated`. Lists expose at most 240 UTF-16 code units per description;
`get_audio_resource` returns the full value. Search ranking uses the full effective
description in `src/assets/resourceSearch.ts`, including text beyond that excerpt.
Overridden or cleared catalog descriptions aren't secretly appended as search terms.

### Event prompt projection is not ID authority

`src/ai/eventAudioPrompt.ts` builds at most 40 candidates per music/sound slot:

1. Up to 20 positive-score request matches, ranked using names, tags and full descriptions.
   Equal scores retain existing event catalog order.
2. Up to 10 still-unselected project-override or uploaded candidates.
3. All remaining places use still-unselected candidates in existing scene/category order.

Zero matches consume no first-group quota; duplicate IDs don't consume later quotas.
Each JSON entry includes raw ID, name, tags, a 240-unit description excerpt, source and
truncation flag. `src/ai/eventCommandAssist.ts` forwards the submitted request into this
projection. Validation still uses the full `eventResourceIdSet()` in
`src/ai/eventResourceCatalog.ts`, so a valid ID outside the visible 40 remains valid.
Keep description-heavy prompt imports in the prompt module, not the shared eligibility
module used by other consumers.

Descriptions are JSON-escaped reference data, not instructions or proof of listening.
Source `ai-listening` means **AI 분석 초안**, not verified acoustic facts. The static editor-only
overlay retains model/review/evidence provenance in `src/assets/audioAiDescriptions.json`;
instrument, vocal and numerical claims are not independent measurements. Most drafts are
Flash outputs; the Pro recoveries and human-corrected Vanguard remain drafts. Project
overrides, including explicit empty strings, take precedence; reset inherits the draft again.
Escaping doesn't replace write approval or tool validation. `src/ai/contextBuilder.ts`
directs fresh detail reads when full/current evidence is needed, including after conversation
compaction. Each request uses the current project rather than a description cache or an
old tool-result excerpt. Automatic `recommendMapBgm` selection is unchanged.

Focused coverage: `test/audioDescriptionTools.test.ts`,
`test/audioDescriptionDiff.test.ts`, `test/audioDescriptionToolStore.test.ts`,
`test/audioDescriptionToolExposure.test.ts`, `test/audioResourceToolPagination.test.ts`,
`test/audioDescriptionPrompt.test.ts`, `test/audioDescriptionPromptTransport.test.ts`,
`test/audioDescriptionSessionPrompt.test.ts`.

## list_resources picture 검색 (2026-09-21)

`list_resources`의 `kind`는 이제 `tile/charset/monster/backdrop/bgm/se/picture` 7종이다.
`picture`는 시맨틱 카탈로그가 아니라 DB 피커와 같은 단일 정본
`listDatabaseResourceOptions("picture", project)`(`src/editor/resourceOptions.ts`)에서
name·id·searchTerms 부분 일치로 찾는다 — 업로드 그림과 promoted 생성 그림이 모두 잡힌다.
`query="*"`(또는 `all`/`전체`)는 전체 훑어보기 관례를 따른다. 결과는 기존과 같은
`data.matches`(id/label)+`total`+`nextOffset` 봉투다. 모델이 `kind:"image"`/`"icon"`으로
부치면 여전히 enum 검증 실패다 — 시스템 프롬프트(`src/ai/contextBuilder.ts` RESOURCE_HINT)에
허용 kind 7종과 '새 그림은 generate_image_asset' 안내를 심어 두었다. 회귀 지점:
`src/editor/tools/queryTools.ts`의 listResources.

## P3 captured proposal base (2026-09-07)

`applyProposedProject(proposed, options)` requires both `options.base: ProposalBase`
and `options.baseline: AuthoredProjectBaseline`. Both are captured before authoring:
lineage/content ownership and the reviewed authored-world partition are independent
requirements, not alternative ways to authorize an old draft.
The proposal owner calls `captureProposalBase(project)` before authoring and carries
that base through approval/application. Session callers use `getProposalBase()`;
`rebaseProject()` replaces it, while context refresh and pending-draft inspection
don't. Never capture a new live base at apply time to legitimize an old snapshot.

`ProposalBase` holds frozen `version`, `identity`, `content` and `world` fields.
`ProjectStore.getVersionToken()` is a read-only frozen `{ lineage, generation }`
snapshot. It isn't an accepted-save receipt or remote lease. Application checks
lineage and project identity, then the authored values that it will replace, even
when generation hasn't changed. A generation change alone isn't rejection:
no-op updates and own saves remain valid when content and lineage still match.
Replacing the project invalidates old lineage even if the bytes are identical.

Content comparison uses the existing `canonicalJsonString` after JSON projection,
not remote schema normalization. Recursive object-key insertion order is ignored;
array order and authored value changes aren't. The authored baseline uses the same
JSON value comparison, including world registrations and relations but excluding
coordinator-owned wiki documents. Ordinary proposals reconcile the reviewed authored
world graph with the live wiki documents; they do not replace either partition with
an entire old world. `resetProject:true` requires the complete captured world to match.
The wiki document-delta coordinator keeps its independent apply/save ownership.

The adapter checks at entry and again immediately before undo snapshot/replacement,
after integrity validation and annotation preparation. The final client-local write
section has no await or external callback between that guard, snapshot and replacement.
Cluster approval captures operation, base and proposal before its confirmation awaits.
Later commit/wiki awaits don't write the old whole-project snapshot again, and no
global queue makes B wait for an uncooperative A commit response.

| Adapter result | Meaning |
| --- | --- |
| `{ ok:false, reason:"stale-base" }` | Captured base no longer matches. No undo entry, replacement, commit or `onApplied` callback is created. Recalculation is new authorized work, not automatic replay. |
| `{ ok:false, reason:"stale-baseline" }` | The reviewed authored partition changed, including world registrations or relations. No application occurs. |
| `{ ok:false, reason:"retired-run" }` | The supplied operation was retired before application. |
| `{ ok:false, reason:"commit-rejected" }` | Existing house protection or integrity validation refused the proposal. |
| `{ ok:true, ... }` | Local application occurred. Later cancellation preserves that fact; commit-history persistence and P1 project-save/current proof remain separate. |

`options.operation?: RunOperation` carries the captured asynchronous owner;
`onApplied?` reports the actual local mutation before synchronous activity/store
observers, not merely before fallible commit/save awaits. The adapter passes that
callback into `ProjectStore.replace` or `replaceProject`; the store invokes it
after installing the project and updating mutation counters. If a subscriber then
retires A and starts B, A already owns the application in the existing session ledger.
If the accounting outcome observer throws, `finally` still records activity, emits
the store notification and schedules autosave; the original error propagates.
Its provisional `commitId:null, persisted:false` isn't proof of saving. A retired
post-commit continuation starts no wiki update or replacement-session rebase.
See [publication accounting](editor-observability.md#p3-owner-bound-publication-2026-09-07).

This is conservative single-client stale-snapshot rejection, not field-level merging,
a durable checkpoint, remote schema/version protocol, or distributed/two-tab writer
exclusivity. Separate region approval and advisory diagnostics retain their policies.
Non-house cells don't acquire house locks, but general stale-base rejection now also
protects their intervening human edits. Current-base malicious house changes still
fail the independent house guard.

Sources: [adapter and base](../src/editor/tools/applyChangesetToStore.ts),
[store token](../src/project/store.ts), [key comparator](../src/project/legacyDbProjectSync.ts),
[proposal host](../src/editor/panels/aiProposalCard.ts),
[cluster approval](../src/editor/panels/clusterAiModal.ts).
Controls: `test/aiMutationApplyAccounting.test.ts`, `test/aiStaleProposal.test.ts`,
`test/applyProposedProjectHouseProtection.test.ts`,
`test/applyChangesetToStore.test.ts`, `test/projectWikiApplication.test.ts` and
`test/clusterAiModalHouseProtection.test.ts`. [P3 evidence](../output/evidence/ai-harness/p3/README.md)
separates unit contracts, native races and remaining approval work.

## Project wiki application ownership (2026-09-07)

`AssistantSessionOptions.prepareProjectWiki` is an awaited editor-owned checkpoint
before intent selection and authoring. Failure stops that turn before tools run.
The callback refreshes only the detached session's world documents.
Ordinary `applyProposedProject` calls retain the live `project.world`, because a
map/title proposal does not own codex edits made after its preview. Explicit
`resetProject` keeps its replacement semantics, subject to the captured world/base
check above. Tests:
`projectWikiSession.test.ts` and `projectWikiApplication.test.ts`. P2 projects checkpoint
failure/cancellation as `failed`/`cancelled`, never successful response completion.
Explicit Ask/Plan retains the coordinator's read-only path; intent is still selected
after the wiki checkpoint, and blocked-work reactivation remains after that decision.
## Character appearance image candidates v1 (2026-09-06)

`get_database_records` exposes `characterAppearances` for real set IDs.
`generate_character_appearance {appearanceId,slot?}` generates only a missing
`face` (default) or `bust`; it never generates or modifies walking charsets.
Generic synchronous runners return an honest `ui-required` preparation result.
The in-app assistant awaits the registered Database-opening callback, checks
the session's actual ProjectIdentity and current record, then starts the shared
`characterAppearanceGeneration` controller. Ask mode excludes and rejects this
capability even though its generic preparation is read-only.
`AssistantSession` imports the generation controller only inside this tool's
execution branch. Ordinary sessions and load-recovery imports must not initialize
the image UI or its history/store subscriptions.

Candidates remain outside the project until explicit DB Apply. Occupied slots
can only be replaced through the human slot action; fresh asset IDs preserve
old images. Apply rechecks the target snapshot and project identity, updates the
current cloned store draft atomically, and creates one undo checkpoint.
Cancelled, late, failed and stale requests do not write project assets.
Leaving the set/tab/modal disposes UI subscriptions and cancels its candidate.

The image request carries at most two bounded raster references: a read-only
crop of the selected manual charset cell and an existing face when present.
Appearance generation uses full-sentence paragraphs rather than keyword lists.
The prompt separates the character brief from composition/background rules:
explicit written traits take priority, then detailed face identity, then walking
sprite clothing/palette. Reference backgrounds and occupation-related scenery
must not be copied. It requests a square dialogue asset, complete headwear and
shoulders with safety margins, restrained cel shading, and an opaque uniform
sRGB #D9D9D9 background without scenery, texture, gradients or cast shadows.
These are model instructions, not an alpha-channel or exact-pixel guarantee;
judge generated images separately and do not pin prompt prose with unit tests.
`imageReferences.ts` validates the external payload;
`ohMyPiImageRuntime.ts` sends real SDK image parts and marks this image-generation
model as vision-capable so the SDK does not replace them with omission text.
Image provider/model selections are independent AI settings. Antigravity uses
the selected catalog model and rejects unknown explicit IDs without a fallback;
response metadata identifies the resolved model. Its default is
gemini-3.1-flash-image. Pro Image is unavailable on the tested subscription routes.
The worker also dispatches openai-codex / codex-image-default to
codexImageRuntime.ts, using the existing server-side Codex OAuth credentials.
That native route is text-only: nonempty references fail explicitly with 409,
not silently omitted. The internal selection ID is never sent upstream; the
request pins model gpt-image-2, quality/background/size auto, and n: 1, following
the [official Codex source](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/ext/image-generation/src/tool.rs#L420-L429)
(its omitted n defaults to one). GeneratedImage.model returns gpt-image-2 as the
requested upstream alias, not a dated snapshot, which the provider does not
report. Historical model-omitted images keep their original metadata. Original raster bytes remain
unchanged, with a 180-second request/body deadline and no provider fallback.
Client cancellation discards output; it does not claim upstream work has stopped.

`TurnResult.appearanceGeneration` is a per-turn handoff receipt, not an applied
write. `aiTurnRunner` uses it to report the DB request without false zero-change
retry warnings; global proposal auto-apply is unchanged. Contracts:
`characterAppearanceGeneration`, `characterAppearanceReferences`,
`characterAppearanceAssistant`, `characterAppearanceLifecycle`,
`aiTurnAppliedAccounting`, and the existing provider SDK suite.

## Completed-house transaction protection - Phase 1 (2026-09-05)

`src/editor/tools/houseProtection.ts` is the shared completed-house ownership rule.
Every write through `runToolDefinition` captures the **current accepted project**,
not the assistant session's initial baseline, then checks the detached draft after
**global tree-pair repair and before commit**, including dry-run. There is no
selection, BuildSpec, map-target, or tool-name exemption. A rejected transaction
returns `protected-house-write` or `house-overlap` and commits none of its maps,
events, interiors, or map-tree additions. Human direct editing is unchanged.

Final application also checks the current live store before history or replacement.
`applyProposedProject` covers chat proposals, autonomous milestones, and cluster
AI acceptance. `applyRegionProjectWithHistory` covers full and partial region
approval after seam polishing. A safe detached tool result is not permission to
overwrite a later human house edit or to commit protected-cell changes introduced
by region postprocessing. Rejection leaves both the live project and undo history
untouched; see `applyProposedProjectHouseProtection`, `regionTaskHouseProtection`,
and `clusterAiModalHouseProtection` tests. Region tasks also retain newly completed
house snapshots from the full session proposal before clipping. Full, partial,
and immediate application check those snapshots after review polishing, so a
selection that excludes the north ridge cannot commit a damaged new house.
The selection is not expanded; unsafe candidates reject atomically.
`regionTaskCompletedHouse` covers clipping, approval-time re-polishing, and intact
house controls.

Completion is metadata-defined: `layoutPlan.regions` with `role:"house"` protect
the full bbox (including empty gaps between wings) plus its full-width north
ridge row `y-1`, clipped to the map. Human `structurePlacements` protect their
recorded rectangles, without an extra ridge. Both base layers and both persisted
sparse stack entries are compared exactly, including empty cells and absent
stacks. Stack rendering is deprecated, but that is not permission to erase saved
stack data. Non-house layout regions and raw wall/roof tiles do not acquire this
lock; existing fill role protections and incremental wall/door/window/roof
construction without completion metadata remain unchanged.

Roof-deck attachment protection requires recorded deck evidence (`shape:
"rooftop-deck"`, `shape:rooftop-deck` tag, or `roof-deck` tag), a recorded door,
and an existing upper ladder tile at the shared authored attachment coordinate.
Only that one ground attachment outside the bbox is added, not the whole yard;
an arbitrary nearby tile 322 is not evidence of a house attachment. The shared
ladder calculation is also used by `village/houses.ts` when authoring decks.

`houseKitDomain` preflights standalone/lots house footprints and records each
completed house after house-owned finishing, before subsequent yard work and
runner postprocessing. A draft-local seal retains those exact registration-time
values; it is never refreshed to accept later corruption. Legacy `build_house`
also preflights and registers. Durable ownership uses existing layout fields
and survives serialize/deserialize; no schema or lock UI was added. The next
transaction snapshots any accepted human edits, not original kit artwork.

Map deletion, changing the protected map's tileset ID/tile size, cropping, and
removing/shrinking/moving away/reclassifying recorded protection are rejected.
Descriptive labels, notes, and tags may change when protection is preserved.
New overlapping house geometry is rejected even when tile IDs are identical;
pre-existing overlaps are tolerated only while their overlap does not expand.
Village registration retains every earlier layout region and allocates unique
IDs. Phase 2 now seals village houses internally before environmental work;
see the construction contract below. The Phase 1 final guard remains unchanged.

Cluster approval (`clusterAiModal.ts`, including palette range classification) uses
`applyProposedProject` against the live store, not direct snapshot/replacement.
That common boundary owns house validation, undo, AI-attributed replacement,
focus and commit logging. A stale proposal that would overwrite human house
edits or remove a newly completed house leaves store/history and session draft
unchanged; the modal reports failure and keeps the proposal available. Safe
metadata-only proposals apply once and then rebase. Existing destructive/rule
confirmation hooks are unchanged. Regression: `test/clusterAiModalHouseProtection.test.ts`.

Focused contracts: `test/houseProtection.test.ts`, `test/toolHouseProtection.test.ts`,
`test/houseKitDomainSeam.test.ts`, `test/villageBuilderSeam.test.ts`,
`test/assistantMapPreservationGuard.test.ts`, `test/constructionToolsV3.test.ts`.
The session matrix covers accepted, same-turn, same-session, and newly created
maps against selection, `confirmDestroy`, and both `overExisting` values.

## Completed-house construction protection - Phase 2 (2026-09-06)

`village/builder.ts` finishes doors, ridge/roof/deck, banners, shop signs, and
linked interiors before publishing house regions. It captures exact layer/stack
snapshots once, locally to that builder invocation. Roads, yard fences, terrain,
environmental decor, landscape, placement cleanup, NPC placement, and snow ground
are checked against those same values after each stage. Road sub-stages also
check before retry rollback. No post-environment door/ridge restoration remains;
a damaged stage fails the whole tool with `protected-house-write`.

Village seals do not accumulate in the standalone producer's project WeakMap.
A discarded pipeline attempt discards its local snapshots; the accepted attempt
still passes the unchanged transaction guard after global tree repair. The
accepted start cell is excluded from new candidates so facade start restoration
cannot reopen a sealed house. Existing metadata houses and human stamp bounds
exclude new candidates and direct road/plaza/decor/landscape/snow writes, including
autotile neighbors. Roof-deck metadata also records custom deck templates through
the existing `roof-deck` tag. Only the existing bbox/ridge/recorded ladder geometry
is owned, not the whole yard. Exact counts, connected-road checks and explicit
capacity failure keep their existing contracts.

`fill_region` skips metadata-owned cells before passage previews, lower/upper
painting, `clearUpper`, and neighbor autotile writes. The fill-only structure-role
fallback checks both layers without creating ownership metadata. `filled` counts
permitted paint candidates; `mutatedCells` counts distinct final changed cells
(including unprotected reshaped neighbors); `skipped.structure` counts protected
requested candidates once. All-protected fills truthfully report zero change.

`forestComposition.ts` preflights floor tone/litter, bushes, gap closure, edge
feathering, undergrowth, full puddle candidates, and autotile neighbors. Tree
placement rejects the whole footprint. The supported ungrouped tree-base path
also excludes the repair canopy one row north before placing its trunk. Useful
work outside houses still succeeds. No force option, schema, lock UI, raw-wall
completion inference, human-brush restriction, or final-guard exemption was added.

Primary regressions: `houseProtectionFill`, `houseProtectionForest`,
`houseProtectionLifecycle`, and `villageHouseProtection`. Runnable integrated
50x50/100x100 evidence: `.omo/evidence/house-protection/p2/exercise.mts`.

## 퀘스트 입력과 완주 증거 계약 (2026-09-05)

`create_quest`는 `QuestDef`의 단계 정의와 이벤트/플래그를 만들며 graph를 만들지 않는다. `questToolSchemas.ts`가 giver/target의 `{mapId,eventId}` 또는 `{create:{mapId,x,y,name}}`, collect의 `itemId/count/sources`, kill의 `troopId/at`, reach의 `mapId/x/y`를 모델 스키마에 모두 노출한다. 공통 runner의 검사는 얕으므로 `parseQuestDef`가 실제 kind별 중첩 구조를 컴파일 전에 검증한다. 오류에는 `def.steps[0].at.mapId` 같은 경로와 올바른 형태를 싣는다. provider용 키 합집합 때문에 공통 좌표 정규화가 reach/talk에도 `at`를 합성할 수 있어, 단계 파서는 해당 kind의 필드만 검증한다.

`define_quest.completesWhen`은 이벤트용 `CONDITION_SCHEMA`와 다르다. **switch/variable/storyFlag 3종**과 `{all:[조건,...]}`만 모델에 노출한다. gold/item/selfSwitch 또는 `{kind:"all",conditions:[...]}`는 지원하지 않는다. 아이템 획득이나 전투 결과를 조건으로 쓰려면 이벤트가 switch/variable에 기록한 값을 참조한다. 같은 ID의 단계 정의를 graph로 교체하는 호출은 `quest-kind-conflict`로 거부한다. 성공을 만들기 위해 원래 단계 메타를 지울 수 없다.

`verify_quest`는 **선언된 graph 노드만** 검사한다. 미선언 목표의 완성도나 전체 게임 완주를 뜻하지 않는다. walkthrough에 `manualHints` 또는 debug `set` 단계가 있으면 read 도구 실행은 정상이어도 `data.ok=false`, `verificationStatus:"manual-required"`이며 요약은 `미검증`이다. `simulationOk`는 디버그 대체를 포함한 시뮬레이션 결과이고, `verifiedNodeIds`는 완주 증거가 있는 노드 목록이다. `workItemOutcome.verifyAuthoredQuestsPlayable`도 동일하게 수동/강제 세팅을 완료 근거에서 제외한다. 단계형 퀘스트의 자동 완주 검증은 아직 지원하지 않으며, 기존 정의를 보존한 실제 플레이 검증이 필요하다고 안내한다. 같은 ID의 `define_quest` 재등록을 권하지 않는다.

회귀: `test/questToolContract.test.ts`(중첩 입력·실제 예시·overwrite 거부), `test/questGraph.test.ts`(전투·맵 이동의 debug 대체는 미검증), `test/bossPhaseQuestOutcomeGate.test.ts`(직접 완료 게이트). Provider 계약은 `test/toolSchemaProviderCompat.test.ts`.

## DB 조회 페이지와 마을 전체 범위 (2026-09-05)

`get_database_records`는 collection/include 외에 `ids`, `limit`(1~500), `offset`을 받는다. 응답은 실제 `records`, 필터 후 `total`, 이어 읽을 `nextOffset`(없으면 null)이다. 대규모 DB에서 ID 목록을 먼저 읽고 기존 레코드 변경 직전 `ids:[실제 ID], include:"full"`로 필요한 원본만 조회할 수 있다. 페이지에 반환되지 않은 ID는 조회 증거로 인정하지 않는다.

`author_village`의 target.fullMap 또는 루트 fullMap이 true이면 세션이 뷰포트 20×20 bounds를 끼워 넣지 않는다. 전체 맵 요청과 부분 bounds를 함께 전달하면 `village-scope-conflict`로 거부해 둘 중 하나를 고르게 한다(사람 승인 단계가 아니라 모델의 인자 수정). bounds를 조용히 넓히거나 전체 요청을 부분 시공으로 완료하지 않는다. Tests: `authorVillageViewportBounds`, `authorVillageScopeGate`.



> **Encoding note:** Some Korean descriptive text has EUC-KR→UTF-8 mojibake from the original source commit. English terms, file paths, and code references are intact. For accurate Korean, consult the referenced source files. Partial automated restoration applied; remaining garbled CJK is irreversibly corrupted.

Soft-confirm vocabulary, region task routing, AI visual polish, dock modes, tool exposure caps, and MCP bridge.

- **루트 컨테이너의 게임 느낌은 `src/editor/lootFeedback.ts` 한 곳에서 낸다 (2026-09-04 실측 결함 수정):** `place_chest` 와 `place_concept` 의 `loot` 칩(나무 상자·잡화 상자·캨비닛·술통·진열대)이 「지급 + 텍스트」만 뻑어 상자를 열어도 소리 하나 없고 열림 페이지가 **닫힌 그림**을 그대로 썼고, 공지 문장은 raw `item_potion` id 를 노출했다. 이제 닫힘 페이지는 `chestOpenCommands`(개방 SE `cc0-se-osx-wooded-box-open` → `setEventGraphicPattern` right(반개방) → up(개방), 각 `wait`) → `lootGrantCommands`(아이템 징글 `…nes09` → `changeItem` → 사이 → 동전 `cc0-se-orp-inventory-coin` → `changeGold`) → DB 이름으로 쓴 `text` → `setSelfSwitch` 순이고, 열림 페이지 그래픽은 `chestOpenedGraphic`(같은 슬롯의 up 프레임)이다. 타일 가구인 개념 loot 는 `lootRummageCommands`(같은 나무 SE + wait) 다음 동전→금화→문장. RM2k3 Object 차셋의 상자 슬롯은 **방향 행**이 개방 단계다(down=닫힘, right=반개방, up=개방 — Object1.png 슬롯 6 실측). SE id 는 전부 CC0 카탈로그라 참조 검증을 통과하고 `test/lootFeedback.test.ts` 가 `isSeCatalogResourceId` 로 오타 회귀를 잡는다. 출하 플레이어 증명은 `npm run qa:runtime -- --scenario chest-open`(`openwiki/testing.md`).

- **의도 라우팅은 모델이 한 번 선언한다 (2026-09-03, 키워드 분류기 7종 삭제):** 턴 시작에 `intentDeclarationClient.createLlmIntentDeclarer` 가 lite 모델·`json_object` 로 사용자 원문을 읽어 `{mode, space, facility, targetMapId, useSelection, clarify, needsPlan, resetsContext, tools}` 를 선언하고(`src/ai/intentDeclaration.ts`, 1.7~2초), 세션은 그 선언만 소비한다 — 되묻기(chat 에서만, 모델이 낸 질문 그대로), 플래너 스킵(selection·question·single-step), 플래너 direct 존중, 볼륨 막대(플래너가 `new_plan.volume` 으로 선언한 것만), 하이브리드 툴 노출(코어·조회 제어면 + 선언/계획/자연어 후보, 검색 승격, 실패 시 전체 카탈로그 fallback), 수정 대상 맵, 완성도 린트. 본문 모델에는 **의도 노트**(「대장간 = place_concept(query:"대장간"), 야외/실내 다시 묻지 말 것」 등)와 **선택 영역 노트**가 오케스트레이션 메시지로 간다. 「도구 규칙」 가이드 17줄과 카테고리 가이드는 **툴 설명 40곳으로 옮겼고** 메시지는 사용자 발화 + `[컨텍스트]` 사실만 싣는다. 삭제: `modifyIntent`(→`contextFooter.ts`)·`intentClarify`·`plannerSkip`·`regionIntentRouter`·`INTENT_KEYWORDS` 문장 스캔·볼륨 정규식/강제 계획·`detectConstructionIntent`. 근거는 2026-09-03 감사(52문장 매트릭스·브라우저 17회): 가이드(기계 텍스트)를 분류기가 사용자 말로 읽어 chat 되묻기 22/52 오탐, 플래너 protocol-lock 오발, 「이 마을에 상인 하나 추가해줘」 93초·맵 3장 폭주. 설계 노트 `docs/superpowers/specs/2026-09-03-llm-intent-routing-design.md`, 진단 스펙 `test/e2e/_intent-router-cases.spec.ts`(CASES/AGENT_MODE/CASES_OUT). 아래 「도구 규칙 공유」「영역 라우터」「되묻기 정규식」「볼륨 계약 코드 강제」 서술은 이 날짜 이전 상태다.
- **시설은 모델이 설계하고 코드가 시공한다 — 「AI 는 소비만」 철회 (2026-09-03):** 「여관 지어줘」가 매번 픽셀 단위로 같은 맵을 냈다. `place_concept` 경로(도면 `layoutConceptFacility` → 구성 `composeConceptRoom` → 카탈로그 그림)에 난수가 한 곳도 없었고 `seed` 는 테마 가구 경로에서만 소비돼 죽어 있었으며, 모델은 시설명 외에 넣을 인자가 없었다. 이제 DB 「맵 → 타일셋 → 개념 꾸러미」의 시설은 **템플릿(출발점)**이다: 모델이 `get_concept_facility(query)` 로 템플릿(plan 모양)·물건 어휘·여관 `variants[]`(시골 단층 / 2층 / double-row)를 읽고, 수식어가 없어도 규모·layout 을 정한 `plan` 을 `place_concept({query, mapId, plan})` 에 넘긴다. 좌표·벽·문·이벤트는 여전히 코드 몫이다(모델이 bbox 를 찍던 옛 경로의 실패를 되풀이하지 않기 위해). 경계는 `src/editor/conceptPlan.ts` `parseConceptPlan` 이 한 번만 검증한다 — 어휘에 없는 objectId·모르는 칩·없는 장소 참조·범위 밖 count/level 은 `invalid-plan` 으로 거절하고 허용값을 문장에 담는다. 템플릿의 `required` 물건을 설계에서 빼면 **경고**(거부 아님). 템플릿에 없는 시설(「목욕탕」)도 plan 이 있으면 짓는다. `plan` 생략 시 종전과 같이 템플릿 그대로. `composeConceptRoom` 은 `seed` 를 받아 방마다(`deterministicRng(seed, "concept", roomId)`) 첫 가구의 좌우, 동률 후보, 구석·러그 자리를 흔든다 — 자리 채움을 깨지 않도록 「가장자리 시작」 규약은 유지하고 서↔동만 뒤집는다. `seed` 생략 시 mapId 해시에서 파생(같은 mapId 는 같은 배치). 의도 선언의 시설 `tools` 는 `[get_concept_facility, place_concept]`. 프롬프트 절 「개념 꾸러미 — 시설 템플릿」과 툴 설명이 같은 순서를 말한다. Tests: `test/placeConceptTool.test.ts` 「place_concept plan」 9건(3객실+주방 설계, 필수 누락 경고, invalid-plan 3종, 템플릿 없는 시설, 2층 설계, seed 변주·재현, 전 seed 자리 채움).
- **시설 실내는 place_concept 가 개념 꾸러미를 읽는다 (2026-09-02):** 사용자가 데이터베이스 「맵 → 타일셋 → 개념 꾸러미」에서 고친 시설→장소→물건→칩 나무가 정본이다. `place_concept({query, mapId})` 가 그 나무를 풀어 실내 맵을 시공하고, 테마 하드코딩 가구는 끈다. 빈 배열(`[]`)은 재시드하지 않는다. 「여관 지어줘」는 실내 시설로 라우팅하고 야외/실내 되묻기를 하지 않는다(「여관 주인」은 직업이라 빼다). 40툴 상한에는 핀하지 않고, 설명 낱말 승격·`find_tools` 로 손에 넣는다. **시공은 도면·구성·칩 집행까지 한다(2026-09-02 개편):** 장소 `role/size/count` 로 홀(정문)→복도→방 3단 도면(`layoutConceptFacility`), 슬롯 구성(`interiorConceptCompose.ts` — 벽걸이는 벽면, 계단은 복도 끝, 문 앞 통로 비움, 못 놓은 물건은 `concept: … 자리 없음` 경고), 칩 이벤트(`interiorConceptEvents.ts` — sleep=`inn`, transfer=계단 연결 지점, loot=1회 노획, event=조사). 툴 결과 `data.rooms`·`data.connections`(미연결 계단은 대상이 같은 맵 정문) 을 싣는다. 실제 조수 턴 증거 스펙: `test/e2e/_place-concept-inn-evidence.spec.ts`(진단), 보고서 `scripts/gen-place-concept-report.mts`. **두 턴 사이 DB 수정은 세션이 다시 읽는다 (2026-09-02 실측 수정):** 세션 draft 는 마지막 적용 시점 사본이라 사용자가 임시 탭에서 여관→주막으로 고친 뒤 「주막을 새 맵으로 지어줘」가 「찾지 못했다」로 실패했다. 패널 `sendText` 가 새 턴 직전 승인 대기 제안이 없으면 `AssistantSession.syncBaselineFromStoreIfClean(store.getCurrent())` 로 기준을 맞추고 시스템 프롬프트를 재조립한다(`rebaseProject` 는 이제 `turnProposals` 도 비운다). 실측 함정: 「주막 만들어줘」는 여관 맵이 이미 있으면 모델이 기존 맵 단장(`furnish_interior_space`)으로 읽는다 — 새 맵이면 문장에 「새 맵으로」. 영역 라우터(`regionIntentRouter`)는 여관 같은 실내 시설 낱말이 있으면 structure 가이드를 떼지만, 야외 자리 단서(공터·부지·마당·들판·야외)가 함께 오면 남긴다(「이 공터에 여관을 짓고…」는 야외 건물 + 실내). WorkPlan `complete_work_item` 이 직전 `place_concept` 성공을 「기록 없음」으로 거부하던 false negative 는 고쳤다(2026-09-03): 원인은 라운드 끝 successTools 자동 완료가 성공 툴 집합을 비운 뒤 모델이 같은 항목을 명시 완료한 것 — 이미 done/skipped 인 항목은 `completeWorkItemById` 가 `alreadyDone` 으로 idempotent 하게 받고 「다시 시공하지 마세요」라고 답한다(`test/workPlan.test.ts`). 거부 → 재시공으로 같은 맵을 두 번 짓던 실측이 `reports/place-concept-inn/e2e/receipt.json` 에 있다. Tests: `test/placeConceptTool.test.ts`, `test/placeConceptAssistant.test.ts`(스텁 LLM 첫 라운드 노출·호출), `test/placeConceptRender.test.ts`, `test/intentClarify.test.ts`. **시설 아홉 종 (2026-09-02 다양화):** 실내 칩셋 초안은 여관·민가·상점·술집·서재·대장간·교회·창고·길드(`CONCEPT_FACILITY_TEMPLATES`)다. 툴 설명에 그 시설명과 별칭(주막·도서관·성당)을 낱말로 박아 「상점 지어줘」「대장간 만들어줘」가 승격(matchScore ≥ 20)된다 — 설명의 낱말을 지우면 승격이 죽는다(`test/conceptFacilityTemplates.test.ts` 가 모든 초안 라벨로 잠근다). 시스템 프롬프트 개념 꾸러미 절은 **두 단계**다(2026-09-03): 초안 그대로(칩셋에 `scratchConceptBundles` 가 없음)면 시설명 한 줄(`query=시설명`), 사용자가 고친 나무(배열 있음)면 시설마다 한 줄(`query="…"`, 장소 `[역할·크기 ×개수·바닥]`, 물건 라벨 + 표식 `*필수 ⌂수면 $노획 ↔맵 연결`, 벽 재질은 기본값이 아닐 때만, 9시설 ≈ 1,500자). 빈 프로젝트 프롬프트는 20,000자 예산 중 약 19,250자를 이미 써서 초안에도 시설별 줄을 싣자 뒤의 「게임 스타일 문서(발췌)」가 밀려났다(`test/worldAiExclusion.test.ts`) — 프롬프트 절을 늘릴 때 이 테스트가 예산 카나리아다. 찾지 못한 시설명은 오류 문구에 지금 부를 수 있는 시설 목록을 싣는다. **층(2026-09-03):** 장소 `level`(1~3) 이 둘 이상이면 `place_concept` 이 층마다 맵(`<mapId>_2f`, 「<시설명> 2층」)을 짓고 코드가 잇는다 — 아래층 계단(transfer 칩) → 위층 문 자리 북쪽 착지, 위층 정문 이벤트 → 「계단(아래)」 → 아래층 계단 앞. 층마다 밴드 폭을 가장 넓은 층에 맞춘다(`minBandWidth`). 결과 `data.floors`. 아래층에 계단이 없으면 정문 앞으로 내려오고 경고. 초안 아홉 종은 한 층이다(`test/conceptFacilityLevels.test.ts`). **볼륨 계약 폭주의 근인(2026-09-03 수정):** 패널이 매 턴 붙이는 「도구 규칙」 가이드의 마을·상점·NPC 낱말이 의도 스캔에 섞여 모든 공간 요청이 마을 막대를 받았다 — `stripContextFooter` 가 가이드 블록(「도구 규칙:」/「(영역 작업: …)」 첫 줄부터)을 뗀다. `buildVolumeWorkPlan` 은 막대가 요구하는 축만 항목으로 둔다. 실측 「여관 지어줘」 66초·툴 19회 → 10초·툴 3회(`test/e2e/_concept-inn-audit.spec.ts`, 감사 로그 전체 덤프 진단 스펙). **의도 라우터·되묻기에는 여관 외 시설명을 넣지 않았다** — 「대장간 지어줘」는 야외 건물일 수 있어 기존대로 실내/야외를 되묻고, 실내로 답하면 place_concept 이 짓는다(코퍼스 `blacksmith-full` 은 structure+npc-shop 을 기대한다).

- **조수 예산은 후하다 (2026-09-01):** 채팅 기본 `maxTokens=200000` · `maxToolCalls=2000`. 영역 AI 천장도 2000 (`REGION_SURFACE_MAX_TOOL_CALLS`). 저장된 옛 공장 기본(토큰 32768/툴콜 200)은 로드 시 새 기본으로 승격. WorkPlan Ralph 자동 이어가기 256단계. 시스템 프롬프트 문자 예산 100000. 타일셋 분석의 `max_tokens` 8192 핀은 그대로다(동반 서비스/Antigravity 는 제한 없음). Tests: `test/aiLlmClient.test.ts`, `test/assistantEndpoint.test.ts`, `test/regionTaskRun.test.ts`.
- **볼륨 오케스트레이션은 코드가 강제한다 (2026-09-01):** 예산만 올려서는 모델이 한 줄 NPC 로 퇴장한다. `volumeContract.ts` 가 턴 시작 스냅샷 대비 델타 막대(RPG=맵3·상태별 NPC6·상점1·퀘스트1 / 마을=맵1·NPC3·상점1)를 재고, 플래너 `direct` 를 거부하며, 툴 없는 종료에 `HARNESS CONTINUE` 를 최대 8회 재주입한다. 사용자 「계속」은 안전 상한(Ralph 256 / 자율 런 48) 뒤에만 남는다. Tests: `test/volumeContract.test.ts`, `test/volumeContractSession.test.ts`.
- **런이 끝나면 토큰·시간을 남긴다 (2026-09-01):** `runRecap.ts` 가 호출 지점 토큰 델타와 경과, 플래너/Ralph/볼륨/툴 과정을 감사 `run-recap` JSON 과 활동 로그에 기록한다. 채팅에는 토큰 한 줄만 보인다. Tests: `test/runRecap.test.ts`.
- **복잡한 NPC 는 조회 후 상태별 다중 페이지 (2026-09-01):** 한 줄 인사 `place_npc` 만 부르는 단편 저작을 막는다. 프롬프트 블록 `EVENT_PAGE_SEMANTICS_BLOCK` + 수칙 8이 조회 순서(`find_events`/`get_event`/`get_story_state`/`get_database_records`)와 상태별 페이지 패턴을 고정하고, `place_npc.characterId`·페이지별 `name`/`graphic`, `make_villager` 의 `pages`/`dialogue.when`(switch·selfSwitch·friendship) 이 그 패턴을 실제로 받는다. `find_events` 매치는 pageCount/conditionKinds 를 포함한다. 상세는 `openwiki/editor-event-authoring.md`. Tests: `test/aiEventPageSemantics.test.ts`, `test/toolsMapManagement.test.ts`.

- **들어가서 걷는 집은 `author_house(interior:"linked-interior")` 한 번이 정답 (2026-09-04):** 외장만 짓고 `create_transfer_pair`/`start_interior_room_session` 으로 잇는 3단계는 가짜 출입구(같은 맵 teleport)와 점유된 문 칸에서 깨진다. `linked-interior` 는 실내맵+문/출구 양방향 전이를 원자적으로 만든다(`houseKitDomain` → `createHouseInteriorMap`). `interior` 생략도 이 모드가 기본. `space:"both"`·야외 집·영역 위 집은 이 경로, 외장 없는 독립 실내만 세션, 개념 시설은 `place_concept`. Tests: `test/intentDeclaration.test.ts`, `test/proposalCompleteness.test.ts`, `test/interiorRoomPipeline.test.ts`, `test/constructionContracts.test.ts`.
- **다층 linked-interior 의 상층에는 정문 이벤트가 없다 (2026-09-13 실측 수정):** 실내 파이프라인은 맵마다 `ev_entrance_<id>` 를 두는데, 상층 플랜엔 `returnMapId/X/Y` 가 없어 이 이벤트가 **자기 맵의 남벽 칸**을 가리키는 미연결 전이가 됐다 — `transfer-impassable` 로 시공이 통째로 거부됐다. 작사 계단(`authoredDescent`)이 없는 상층에서는 `ev_entrance_` 를 지우고, 상층→하층 하강은 `placeStairTransfer` 의 `ev_exit_f*` 가 소유한다. **하강 착지는 계단 칸이 아니라 그 옆 바닥이다**(`stairFootCell`): 상승 계단 칸에 내리면 playerTouch 위에 선 상태가 된다. 날개별 `stories` 가 선언된 계단식 집의 실내 층수는 가장 높은 날개 층수를 따른다 — 높이 휴리스틱이 선언을 덮어쓰지 않는다(`houseInteriorStories`). 회귀: `test/houseKit.test.ts` 「계단식 2층 linked-interior…」「날개 선언 층수…」.
- **집 문은 기본 개방 — 걸어 들어가면 열린다 (2026-09-05 갱신):** 실외 집 시공(`author_house`/`build_village`/`build_house_kit`)의 집 문은 문 스프라이트(벽 칸, below 장식) + 문 앞 통행 칸의 투명 발판(`<doorEventId>_step`, playerTouch+below) 두 이벤트다. 문 칸은 벽이라 밟히지 않으므로 playerTouch 발판은 문 앞에만 둔다 — 시작집 문(STARTER_HOUSE_DOOR_APPROACH)과 같은 배치. 발판은 `callMapEvent(doorEventId)`로 문 본체의 활성 페이지를 실행한다. 이전에는 발판이 `transfer`만 가져 문 본체의 열림 SE·프레임·대기를 전부 건너뛰었다. 본체 페이지를 복사하지 않아 이후 사용자가 바꾼 소리·조건·명령도 그대로 따른다. 기존 문을 고칠 때는 발판의 단일 transfer를 문 ID를 가리키는 callMapEvent로 바꾸고 문 그림·페이지·실내·출구는 보존한다. **귀환 착지가 발판과 같아도 즉시 재전이하지 않는다:** `transferTo`는 도착 후 auto만 실행하고 playerTouch는 걸음 완료 때 평가한다. 벽 위 문 그림의 통행 경고와 착지 발판 경고만으로 런타임 불량을 단정하지 말 것. Tests: `test/houseDoorOpen.test.ts`(실제 생성→호출→열림 순서·원본 편집 보존·귀환 시 접촉 미실행).

- **죽은 callMapEvent 경고 — 조용한 무시 종결 (2026-09-20):** 웹 워크스페이스 프로젝트에서 AI 마을 시공으로 만든 집 문 본체 12개의 페이지 명령이 전부 비어 있고, 전이 대상 실내 맵도 사라진 상태가 발견됐다. 런타임은 이런 호출을 조용히 건너뛰므로 발판을 밟아도 아무 일 없이 지나갔다. 경고 노출은 네 곳: (1) 호출부 명령 행 — 대상 페이지가 비어 있으면 `callMapEvent.target-inert`, 대상의 transfer 목적 맵이 사라졌으면 `callMapEvent.transfer-target-missing` 경고(`validateEventDraft`). (2) 대상 이벤트 — 이 이벤트를 부르는 caller가 있는데 페이지 명령이 비어 있으면 `page.empty`가 `callMapEvent.target-page-empty` 경고로 격상(`validateEventDraft`). (3) 마커 툴팁과 좌측 이벤트 목록 호버 — 각 이벤트의 경고를 `⚠` 줄로 가져와 검사 없이도 보이게 한다(`collectCallTargetWarnings`). 판정 정본은 `src/editor/eventCallTargetStatus.ts`의 `callMapEventTargetStatus`. Tests: `test/callMapEventWarnings.test.ts`.
- **출입구·타일은 벽에 바짝 붙인다 (2026-08-31):** 모델이 벽·맵 끝에서 1칸 안쪽에 좌표를 잡는 버릇이 있다. `create_transfer_pair` 는 `snapFlushToWall`(`src/editor/tools/wallFlush.ts`)로 그 1칸을 당긴다 — 맵 가장자리(x=0 / width-1)와 벽 바로 앞 통행 칸. playerTouch+below 는 벽 칸 위에서 발동하지 않으므로(`openwiki/runtime-sessions.md`) 벽 위 요청도 바로 앞 통행 칸으로 옮긴다. 문 자리 자체가 이벤트에 점유됐으면(여관 문 이벤트 등) 1칸 안쪽을 gate로 쓰지 않는다 — 스냅이 밀려난 자리를 radius=0에서 제외하고 옆 flush 칸을 먼저 찾으며, 착지가 점유된 후보도 버린다(2026-09-04). `fill_region` / `paint_tiles` rect 는 맵 **안 벽** 과의 1칸 틈만 메운다(맵 가장자리까지 늘리면 원형 호수가 남쪽으로 샌다). 프롬프트 정책 「벽 밀착」과 도구 description 이 같은 말을 한다. Tests: `test/wallFlush.test.ts`, `test/transferGateOccupied.test.ts`, `test/agentUxPolicyPrompt.test.ts`.

- **구조물 스탬프는 사람 팔레트 전용 (2026-08-31):** 구조물 스탬프는 LLM 비노출이고 사람 팔레트에서만 쓴다. 프롬프트 수칙 11과 「구조물 스탬프는 사람 팔레트 전용」 절이 같은 금지를 말한다. 집=`author_house`, 마을=`author_village`, 벽=`build_wall`, 지형=`fill_region`, 소품=`place_props`. 사람 팔레트 선반·`applyPaletteStamp` 경로는 그대로다. Tests: `test/structureKitTools.test.ts` 「제거된 구조물 스탬프 호출은 미등록으로 거부된다」.
- **`author_house.templateId` 는 두 카탈로그를 가리킨다 — 날개 템플릿 + 저작 형태(셀 레시피) (2026-09-13):** 날개 문법(`stampFootprintHouseKit`, 열당 지붕+벽 밴드 하나)으로는 벽→지붕→벽이 세로로 쌓이는 형태를 못 만든다 — 계단 사선 지붕·발코니·2층 문이 있는 저택이 그 예다. 그래서 `src/project/defaults/authoredHouseFormCatalog.ts` 가 고정 셀 레시피(`rows` = 하위/상위 행렬, `-1`=불변, 문 칸은 벽으로 두고 `doorAt` 선언)를 들고, `parseHouseRequest` 가 날개 카탈로그 조회 실패 시 형태 카탈로그를 본다(형태면 wings[0]=앵커, wings 는 형태 bbox 단일 rect 로 전개). 실제 스탬프 선택은 `src/editor/authoredHouseFormStamp.ts` 의 `stampHouseExterior` — 도메인은 한 줄만 부르고 결과의 `formId` 로 요약을 갈라 「창문 레시피」를 적는다(도메인 파일은 220 LOC 상한 — `test/houseKitDomainSeam.test.ts`). 내부 맵·문 이벤트·보호 등록·diff 는 기존 `buildHouseKit` 경로 그대로 — 형태는 `stories` 를 스스로 선언해 실내 층수도 맞는다(manor-balcony=2). 새 형태 추가는 레시피를 카탈로그에 싣고 `test/authoredHouseForm.test.ts` 계약(치수·레이어 정책·JSON 왕복)을 통과시키면 된다. 마을 슬롯 카탈로그(`houseTemplateCatalog`, w≤8)와는 분리됐으므로 자동 배치에 섞이지 않는다.

- **"여기에 마을"은 보고 있는 화면에 지어진다 — 타일 사각형 규약은 좌상단 기준·칸 수·마지막 칸 x+w-1 (2026-08-30):** `author_village` 가 `kind:"existing"` 이면서 `target.bounds` 가 없으면, **호출 경계**가 라이브 뷰포트 스냅샷 중심에 `MIN_SIZE`(20, `tools/village/constants.ts`) 정방형을 만들어 맵 안쪽으로 밀어 넣은 뒤 구체적인 좌표로 인자에 박는다(`AssistantSession.resolveToolCallArgs` → `viewportVillageBounds`, `src/editor/tools/authorVillageSupport.ts`). **툴 자신은 `(draft, args)` 의 순수 함수로 남는다** — bounds 가 없으면 툴은 여전히 맵 전체를 재포장한다. 라이브 상태를 툴 안에서 읽으면 같은 인자가 카메라 위치에 따라 다른 영역을 시공해, `applyToolSequenceToStore` 재적용과 감사 재생이 사용자가 검토한 영역과 달라진다. 채팅 경로 전체로 보면 맵 전체 재포장은 **그 맵에 맞는 스냅샷이 없을 때만** 일어난다. 왜 필요했나: 라우팅 예시 문구가 모델에게 bounds 를 생략하라고 말하므로, 예전 기본값은 사용자가 한 화면만 가리킨 맵을 (0,0) 부터 다 덮었다. **함정:** 뷰포트 스냅샷은 한 변이 최대 16타일로 재단되고(`DEFAULT_VIEWPORT_MAX_SPAN`, `src/ai/mapViewportContext.ts:35`) rect 파서는 w/h 20 미만을 거부하므로(`MIN_SIZE`), 스냅샷 사각형을 **그대로 넘길 수가 없다** — 그 부정합이 헬퍼가 자기 정방형을 따로 만드는 이유다. 사각형 규약은 이제 `set_build_spec` 스키마 설명과 시스템 프롬프트의 뷰포트 블록에 명시된다: 좌상단 원점, w/h 는 타일 **칸 수**, 마지막 칸은 x+w-1 / y+h-1. `가시 영역` 줄은 그에 맞춰 마지막 칸을 **포함해** 찍는다 — 예전엔 반열림 끝값을 찍어, 그것을 그대로 베낀 모델이 한 칸 밀렸다. 스냅샷의 타일 크기는 `TILE_SIZE`(16) 고정이지 `map.tileSize` 가 아니다 — 그리기·`pointerToTile` 이 전부 16 단위라 여기서만 `map.tileSize` 를 쓰면 스냅샷과 나머지 사이에 좌표계가 쪼개진다. Tests: `test/authorVillageViewportBounds.test.ts`, `test/mapViewportContext.test.ts`.

- **AI reach: prompt capability index + natural-language escalation + authored-data facades (2026-08-27):** three separate walls kept the assistant out of editor areas that already existed, and all three are now closed.
  1. **The model could not see what exists.** The registry holds 148 LLM-reachable tools but only 40 schemas ride each round, and `buildSystemPrompt` listed none of them — an unexposed tool was indistinguishable from a missing feature, which is exactly how the 2026-08-23/24 "그 기능이 없습니다" incidents below happened. `src/ai/toolCapabilityIndex.ts` now builds a **names-only** index of `activeTools()` grouped by editor area (핵심/맵/타일·배치/이벤트/데이타버이스/퓠스트/월드 그래프/전통/시스템 + 기타 catch-all; a multi-domain tool appears under its first domain only, every live tool exactly once) and `buildSystemPrompt` emits it directly after `INTRO`, before the budget slicer's reach. **The index's own char cost is added to the effective budget** because the empty-project prompt already measured 11,978 chars against `DEFAULT_BUDGET_CHARS` 12,000 — without that, the index would have silently evicted the map-region tail. It also survives the smallest calibrated budget (`tokenBudget` clamps to 0.5x = 6,000). Its rule block states that every listed name exists, that a missing schema means `find_tools(query)` then call it next round, that reporting a listed capability as unsupported is a defect, and that the UX-policy engine limits (3D, real-time action battle, external API/plugins, real deployment) still stand. Contract: `test/aiToolCapabilityIndex.test.ts` — exact-once coverage against the LIVE registry (a newly registered tool cannot fall out silently), no deprecated name advertised, pre-existing sections still render, deterministic output, and a char ceiling that fails loudly when the index balloons.
  2. **Escalation only fired on exact tool names.** `mentionedToolSchemas` needs the user to type the registry name, so "타이틀 화면 바곶줘" (domains core|map|system, `set_title_screen` not in the 40) escalated nothing. `src/ai/capabilityEscalation.ts` scores the request against the whole active registry with **the same matcher `find_tools` uses** (`matchScore`, now exported from `discoveryTools.ts` — one matcher, so auto-escalation and model-driven discovery never disagree), requires score >= 20 so a single incidental word cannot drag a tool in, drops already-exposed names, and returns at most 6 schemas. Those join the required set outside the domain cap while the base slice shrinks by the same count, so the round's unreserved working set stays 40; `clampTurnToolSchemas` keeps the whole request inside the provider's 128 and **drops escalated guesses first** so a guess can never evict a mentioned/plan-required/core tool. Observable via `tools:escalated <names> (capability)` and the `| capability:<names>` suffix on `tools:exposed`. Contract: `test/aiCapabilityEscalation.test.ts` (asserts the premise — tool absent from both the domain slice and name-mention escalation — before asserting recovery).
  3. **Some editor areas had no tool at all.** A full audit of every top-level `Project` field, every `ProjectDatabaseRecords` collection and every `SystemRecords` field against the registry (`.omo/evidence/ai-editor-reach-20260827/coverage-audit.md`) found **32 authored-data surfaces the editor UI writes and no tool could touch** — the life-sim/economy half of `SystemRecords` was the largest hole. New typed facades: `upsert_craft_recipe`/`delete_craft_recipe`/`upsert_item_upgrade`/`set_sell_prices`/`upsert_tool_action`/`configure_life_economy` (`lifeEconomyTools.ts`); `upsert_fish_species`/`delete_fish_species`/`configure_fishing`/`configure_seasonal_forage`/`configure_museum`/`configure_collections` (`lifeCollectionTools.ts`); `upsert_farm_building_type`/`upsert_home_decoration_type`/`upsert_farm_animal_building`/`set_session_farm_state` (`farmSpatialTools.ts`); `configure_game_systems`/`set_project_genre` (`gameSystemToggleTools.ts` — genre on the EXISTING project, because `reset_project(genrePreset)` wipes it); `create_tileset`/`set_tileset_properties`/`upsert_autotile_group`/`delete_autotile_group`/`set_animation_strips`/`set_tile_grafts` (`tilesetAtlasTools.ts` — before this, no tool could create a tileset at all); `upsert_map_connection`/`delete_map_connection`/`upsert_village_document`/`delete_village_document`/`upsert_resource_profile`/`delete_resource_profile`/`upsert_character_profile`/`upsert_test_preset`/`delete_test_preset`/`manage_flag_slot` (`authoringMiscTools.ts`; `manage_flag_slot` is the first way to add a plain switch/variable slot or delete one with a reference check — `prune_unused` only blanked names). `delete_database_record`/`duplicate_database_record` now reach `monsterSpecies`/`crops`/`lifeSkills`/`farmAnimalSpecies`/`fishSpecies`/`farmBuildingTypes`/`homeDecorationTypes`, and `set_title_screen` reaches `backgroundLayers`/`particles`/`intro`. Every section in a `configure_*` facade is independent: passing one section must not clear its siblings. Contracts: `test/aiEditorReachParity.test.ts` (names + provider-compatible schemas + index/registry reachability for all of them) plus one behavioral test per facade file. **Sections deliberately left uncovered:** `session.placeables`, `assets.sprites`, `project.flags` — no editor UI writes them, so a tool there would be ahead of the editor.
  Runtime proof (not just unit tests): `test/e2e/ai-editor-reach.spec.ts` loads the real editor, imports the live modules in the page, and asserts the assembled prompt indexes every active tool and that the natural-language request escalates the tool the domain slice dropped. **Registration seam note:** the six facade modules were registered in `toolRegistry.ts` as empty arrays *before* implementation so parallel agents never had to edit the registry — that prevented git conflicts, but a broken intermediate module still breaks every sibling's test run through the shared import, so each module must stay compiling after every save.

- **AI 배치 툴은 통행 가능 칸에 자동 착지한다 (2026-08-27):** `place_battle_blocker`는 `inMapBounds` + `troopId` 만 검사해 몬스터를 벽 위에 그냥 세웠다. 이제 모든 이벤트 배치 툴은 `resolveEventPlacement`(`src/editor/tools/eventTools.ts`)를 지난다 — 캐릭터형(몬스터·추격자·NPC)과 밟아서 발동하는 트리거는 반경 3 자동 착지로 `isPassable` 칸을 강제하고 `위치 자동 조정: (a,b) → (c,d)` 경고와 `data.adjusted` 를 낸다. action 트리거 오브젝트(문·상자·간판)는 RM2K3 의미대로 벽 위를 허용하되, 인접 칸이 전부 막혔으면 착지시키거나 `*-impassable` `ToolError` 로 거부한다. 그래도 사면이 막힌 채 남은 이벤트는 `projectLint` 의 `event-unreachable` 경고가 잡는다. 실면 증거(배포 데모 맵 5개 × `runTool`): `npx vite-node scripts/prove-ai-placement-passability.mts`, 로그는 `.omo/evidence/ai-place-passable-20260827/`. 계약 테스트: `test/aiEventPlacementPassability.test.ts`, `test/projectLint.test.ts`.

- **보물상자의 벽감 예외는 수면 허용이 아니다 (2026-09-05):** `place_chest`는 `assertChestDrySurface`로 요청 좌표와 자동 착지 결과를 검사한다. 현재 타일셋의 `tileMeta.role`/물 그룹으로 수면을 식별하고, 메타가 없는 기본 칩셋에만 기본 물 타일 번호를 적용한다. 다른 칩셋의 같은 번호를 물로 단정하지 않는다. 수면은 이웃 지면에서 조사 가능하거나 통행 설정을 열어도 `chest-on-water`로 거부하며, 오류는 지면·다리 좌표를 안내한다. O 상층 다리/발판은 지지면으로 허용하고 ★ 장식은 하층 물을 덮지 않는다. 기존 벽감 상자와 다른 action 이벤트의 접근 정책은 그대로다. 사전 `get_map_region` 호출 여부와 무관하게 검사한다. 회귀: `test/treasureChestPlacement.test.ts` — 숲 던전 (19,6) 물가 재현의 `runTool` 실패·무변경, 통행 가능한 물, 다리/★ 장식, 타일셋별 역할, 자동 착지 수면 거부.

- **배치 계약이 이제 정말 전수 적용된다 + 구조 게이트 (2026-08-30):** 위 2026-08-27 항목의 "이제 **모든** 이벤트 배치 툴은 `resolveEventPlacement`를 지난다"는 실측과 달랐다. 계약을 지나지 않고 `map.events` 에 직접 쓰던 경로가 7곳 남아 있었고, 그것이 "AI 가 물 위에 NPC 를 세운다"는 신고의 실제 원인이었다: `set_lighting_volume`/`set_scene_mood`(applyMode "event")가 area 전 칸에 playerTouch 이벤트를 무조건 생성, `author_story_arc`, 퀘스트 컴파일러 7개 생성 지점(대화 NPC·기버·드롭 전투·도달 마커·수집물·게이트), `copy_map_region`(withEvents)의 목적지 무검사 복제, 조사 퍼즐 4개 컴파일러(특히 push-switches **발판**은 playerTouch 라 물 위면 퍼즐이 풀리지 않는다), `give_starter_monsters`, 그리고 계약 자신의 파일에 있던 `ensureMapCheckpointEvent`(0,0 고정)·`script_cutscene`. 지금은 전부 계약을 지난다 — 캐릭터형·밟기형은 통행 가능 칸 강제, action 트리거는 인접 통행 가능 칸 필수.
  - **단일 대상 vs 영역/대량의 처리가 다르다.** 단일 대상은 기존대로 반경 3 자동 착지 + `위치 자동 조정` 경고, 실패 시 `*-impassable` ToolError. 영역/대량(조명 볼륨·분위기·퍼즐 발판·영역 복제)은 **전체를 실패시키지 않고** 통행 불가 칸을 건너뛰고 `통행 불가 칸 N개를 건너뛰었습니다: (x,y)...` 로 보고한다(죽은 이벤트를 만들지 않는 것이 목적이므로). `copy_map_region` 은 `data.eventsCopied`/`data.eventsSkipped` 로도 센다.
  - **auto 트리거는 throw 하지 않는다.** `ensureMapCheckpointEvent` 를 캐릭터형으로 걸었더니 좌상단 반경 3이 전부 막힌 맵(동굴·두꺼운 벽)에서 ToolError 가 `place_trap(respawnCheckpoint)`/`make_chase_scene(checkpointOnEntry)` **전체**를 죽였다 — auto 는 좌표와 무관하게 발동하므로 원래 (0,0) 배치는 기능 버그가 아니라 린트 경고였고, 고치려던 것보다 나쁜 회귀였다. `checkpointSpot` 은 착지 시도 → 실패 시 맵 전체 첫 통행 칸 → 그것도 없으면 (0,0) 이며 절대 throw 하지 않는다.
  - **지형 편집이 이벤트를 조용히 좌초시키지 않는다.** `mapHelpers.passabilityWarning` 은 칸 수만 세던 것에서 그 칸에 남은 이벤트 id·좌표(최대 5건 + "외 N건")를 함께 말하도록 바뀌었다. `paint_tiles` 로 NPC 위에 물을 칠하면 그 자리에서 알 수 있다.
  - **「오른쪽 위」는 화면 기준 좌표로 확정한다.** `src/ai/viewRelativeLocation.ts` — 가시 카메라 상자(`viewX/Y/W/H`)를 사분면으로 자르고, 턴 프롬프트와 암묵 명세와 마을 `forestAnchor`가 그 상자를 쓴다. 맵 전체 구석·강 반대편 숲 띠로 추측하지 않는다. Tests: `test/viewRelativeLocation.test.ts`.
  - **모델이 물을 먼저 본다.** `formatViewportContextBlock` 이 `pass:x,y` 머리 + 행마다 `#`(통행 불가)/`.` 한 글자 그리드를 붙인다(칸당 1자, 행당 1줄). 판정은 `isPassable` — `get_map_region` 의 `passable` 은 `passageMarkForTile(...) !== "x"` 라서 합성 레이어를 무시하는 **다른 출처**다. 함정: `project` 인자가 optional 이라 호출부가 안 넘기면 그리드가 조용히 사라진다. 실측으로 `contextBuilder.ts`·`assistantSession.ts` 두 호출부가 안 넘겨서 기능이 죽어 있었고, 단위 테스트는 인자를 직접 넘기므로 그 누락을 못 봤다. 회귀: `test/aiMapContextPassabilityWiring.test.ts` 가 `buildSystemPrompt` 와 세션 턴 블록 **양쪽**을 고정한다.
  - **회귀를 막는 건 게이트다.** `test/aiEventPlacementSurfaceGate.test.ts` 가 TypeScript 컴파일러 API 로 `src/editor/tools/**`·`src/project/quest/**` 를 AST 스캔해 `.events.push`/`events = [...]`/`events[i] =`, 별칭 push(`const queue = map.events` 와 구조 분해 `const { events: queue } = map` 둘 다), 그리고 래퍼 `upsertEventIntoMap(...)` 호출을 찾고, 같은 함수(중첩 콜백 포함) 또는 그 함수가 부르는 같은 파일 헬퍼에 계약 호출이 없으면 file:line 을 지목하며 실패한다. 허용목록 키는 `file#function` 이라 줄이 이동해도 살아남고, 항목마다 한국어 이유가 필수이며 쓰이지 않는 예외는 stale 로 실패한다. 주석·문자열에 계약 이름만 적어두는 위장은 통과하지 못한다. 변이 증명: `actionTools.ts` 에 무검사 push 를 넣으면 `actionTools.ts:268 (zzProbeUnguardedInsertion, events.push)` 로 RED.
  - 계약 테스트: `test/aiEventPlacementPassability.test.ts`(기존 11건) + 신규 `aiPlacementLighting`·`aiPlacementStoryArc`·`aiPlacementQuestCompiler`·`aiPlacementCopyRegion`·`aiPlacementInvestigationPuzzles`·`aiPlacementStarterMonsters`·`aiPlacementCutsceneCheckpoint`·`aiMapContextPassability`·`aiMapContextPassabilityWiring`·`aiEventPlacementSurfaceGate`.

- **Authored-data capability parity (2026-08-26):** remaining Database/resource/map mutations that the editor already persisted but the assistant could not name now have typed facades: `upsert_life_skill`, `upsert_life_system` (daily weather + farm animal species), `upsert_battle_animation`, `upsert_resource` / `delete_resource`, `register_structure_kit`, and `shift_map`. `get_database_records` accepts `include:"full"` and lists `lifeSkills` / `farmAnimalSpecies` / `crops`. Intent keywords `생활`/`레시피`/`가축`/`날씨` activate `database`; `포획`/`몬스터 시스템` activate `system`; `사냥터` activates `map`. Pins keep the new write tools inside the 40-tool cap. `delete_resource` is destructive. Isolated event-command assist and tileset vision remain specialized generators; authored mutations they need now exist on the shared registry. Contract: `test/aiEditorCapabilityParity.test.ts`.

- **Pi-path tool escalation (2026-09-13):** the Pi runtime now mounts tools mid-run instead of front-loading the whole registry. `runPiAgent` keeps `state.tools` as a live array (the core loop rebuilds each turn's request from it, so in-place `push` is next turn's declaration — `setTools` array replacement never reaches a running context). Two escalation paths share one resolver, `resolvePiToolShape` (`src/ai/piAgent/toolAdapter.ts`), which honors the run's hard boundaries (`readOnly` → read-mode only; `toolNames` → the role's list): (1) a successful `find_tools` result's `data.matches[].name` are harvested and pushed — declared from the next turn; (2) `resolveFallbackTool` rescues a direct call to an unexposed-but-registered name and also declares it. The original 16-tool declaration cap was removed on 2026-09-19; see Hybrid native tool exposure for initial candidates and empty-search recovery. `antigravityToolEnumPayload` re-walks the live tool list per request so late-escalated integer-enum tools still get the numeric-enum wire workaround, while capture-time validation still fails fast on a malformed initial set. Read-only escalation is impossible: a readOnly run's `find_tools` may *find* write tools but the resolver refuses to make their shapes. Contracts: `test/piAgentToolEscalation.bun.test.ts` (real Agent loop with a scripted `streamFn` — harvest declares next turn, fallback rescues, readOnly boundary holds on both paths), `test/piAgentToolAdapter.test.ts` (resolver/harvest units), `test/aiChatPanelComposerMode.test.ts` (intent→`toolDomains` seeding).

- **Editor-wide tool discovery and authored-data facades (2026-08-25; hybrid exposure updated 2026-09-19):** the normal `AssistantSession` request starts with a small control plane plus intent/plan/read-contract and natural-language candidates. `find_tools` searches the complete active registry by name/description/domain and returns up to six strict schemas; the session remembers discovered names for the current user turn and recomputes schemas on every LLM round. A successful empty search or neutral intent fallback restores the full native catalog on the next round. Discovery never bypasses registry mode, schema validation, approval classification, or deprecated-tool filtering. Canonical editor-wide mutations include `duplicate_map`, `manage_map_tree`, expanded `set_map_properties`, `duplicate_database_record`, destructive `delete_database_record`, `upsert_database_utility` for elements/terrains/battle commands, and `set_project_settings` for project identity, terms, resolution, system resources, initial party, and battle defaults. Keep broad editor concepts behind typed facades rather than adding one tool per form control. Contracts: `test/aiToolExposureHybrid.test.ts` and the existing editor reach/safety suites.

- **Canvas AI workbench (2026-08-25):** the expert canvas toolbar now exposes four real quick actions through `src/editor/panels/canvasAiWorkbench.ts`: `만들기` arms the existing deterministic build palette and selection tool, `다듬기` sends the current tile selection through the bounded `openRegionTaskModal` preview/apply flow with a constrained polish prompt, `검사` opens `canvasInspectionPanel.ts` over deterministic `projectLint` results with camera focus and bounded AI-repair handoff, and `AI 요청` opens the same region-task composer for the current selection or whole map. The toolbar wiring lives in `editorZoomToolbar.ts`; browser proof is `test/e2e/canvas-ai-workbench.spec.ts`.

- **Antigravity integer enums (2026-09-07):** keep local `type:"integer", enum:[1,2,3]` and sparse `[4,8]` numeric. Google CCA's legacy `parameters` protobuf encodes enum members as strings, not tool arguments. `scripts/lib/ohMyPiToolEnums.ts` retains source paths/membership and runs through `ohMyPiPiAiRuntime.ts`'s SDK **post-normalization `onPayload`** hook: Claude's numeric members are encoded; Gemini's stripped members are restored exactly. Only a fresh legacy payload copy changes. Unsupported numeric enums, lost fields, changed types or incompatible membership fail HTTP400 before fetch; Codex and `parametersJsonSchema` are not encoded. Never fix this by deleting constraints or stringifying local schemas/arguments. Regression: `ohMyPiNumericEnum.bun.test.ts` (full captured 48 tools and live corpus), `ohMyPiToolEnums.bun.test.ts` (real normalization/fail-closed seams), `ohMyPiNumericEnumLocal.test.ts` (shipped normalization and actual house/interior parsers). Earlier browser-aborted planner calls remain a separate unresolved observation, not a reason to change deadlines.

- **Tool JSON schemas must be strict-provider compatible (2026-08-14 실측):** array-typed tool params MUST carry `items`, and union-typed items must not use bare `oneOf` without a `type` — Gemini-backed gateways reject the whole request with 400 `upstream_request_rejected ... properties[yard].items: missing field`, killing every chat turn while OpenAI-style backends accept the same payload. Two such bugs shipped (`build_house_lots` yard items as `oneOf`, `author_house` yard array with no `items`); both fixed in `src/editor/tools/houseLotTools.ts` / `src/editor/tools/authorHouseToolDef.ts`. When adding tool params, run a catalog audit: every `{type:"array"}` node must have `items`, and validate the full exposed tool list through the real gateway (one gateway capped `tools` at 128; session exposure cap 40 stays within it).

- **객체 타입 파라미터는 `properties` 를 반드시 선언한다 (2026-08-23 실측):** `{ type: "object" }` 만 적고 실제 필드를 `description` 문자열에만 써 두면 400 은 안 나지만 strict function-calling 경로에서 모델이 그 객체의 필드를 **표현할 방법이 없어 `{}` 만 보낸다.** 실측 턴: `set_work_plan` 이 `layers:[{}]` 8회, `set_build_spec` 이 `assets:[{}]` 10회 연속 → 계획 폐기 → 스펙 게이트가 `fill_region`/`place_npc` 까지 차단 → 31콜 중 21콜 실패. 배열 길이만 1,2,3,6,5 로 바뀌고 내용은 늘 비어 있었다는 게 모델이 아니라 스키마가 벽이라는 증거다. 카탈로그 전역 109개 노드를 고쳤고(재사용 조각은 `src/editor/tools/schemaShapes.ts`: `COORD_SCHEMA`/`RECT_SCHEMA`/`COMMAND_SCHEMA`/`SIMPLE_PAGE_SCHEMA`/`CUTSCENE_BEAT_SCHEMA`/`CONDITION_SCHEMA`/`LIGHT_SOURCE_SCHEMA`/`VILLAGE_*_PLAN_SCHEMA`), 감사는 `test/toolSchemaProviderCompat.test.ts` 가 고정한다. 유니온 shape 은 `oneOf` 금지 → **키 합집합을 전부 선택 필드로**. 진짜 동적 키 맵(`elementRates`, `priceBySeason`, `inventory` 등)만 `additionalProperties: true` 로 명시 면제. 커맨드 `kind` 는 자유 문자열로 두지 말고 `COMMAND_KINDS`/`CONDITION_KINDS` enum 을 노출한다(자유 문자열이면 모델이 없는 kind 를 만들어 보낸다).
- **NPC command contract / repair (2026-09-06):** `COMMAND_SCHEMA.kind` exposes only `COMMAND_KINDS`; `CONDITION_SCHEMA.kind` exposes only `CONDITION_KINDS`. `item` and `selfSwitch` are page conditions, not executable commands. Item grants use `{kind:"changeItem",itemId,op:"+=",amount}`; switch writes use `setSelfSwitch` or `setSwitch`. Command `op` is declared explicitly. Command/condition `value` fields are declared without a single-type restriction so boolean, numeric, and supported variable operands are not falsely advertised as strings. This uses no `oneOf`, `anyOf`, or array-valued provider `type`; `jsonSchema.matchesType` treats an omitted type as unconstrained, while the existing command/condition shape validators remain responsible for variant validity. Existing internal type-array consumers remain supported. Rejected `item`/`changeItems`/`gainItem` commands return an `invalid-args` issue containing a standalone `repair: <JSON>` line with `{path,example}`. The example uses canonical `changeItem`, preserves a supplied string item ID and finite numeric amount (otherwise lookup placeholder / amount 1), and is guidance only: none of these names becomes an alias. Read the full issue message, not the 200-character summary. Replace only the command at `path` and use an ID obtained from `get_database_records`; do not remove the grant to make the call succeed. `test/npcCommandContract.test.ts` parses the repair JSON, checks schema/compiler/shape acceptance, and retries through the real `place_npc` runner. Evidence: `.omo/evidence/assistant-tool-reliability/schema`. Live Gemini acceptance is not established by the local provider-compatibility audit.
  - Audit NPC repairs (entries 170/174/196): the real runner keeps missing `pages` invalid. Only an otherwise recognized `place_npc` call with a sole nonempty `dialogue.text` receives `{path:"pages",example:[{lines:[originalText]}]}`; the hint distinguishes dialogue NPCs from object gimmicks. The optional `ToolDefinition.invalidArgsRepair` callback supplies input-specific schema-error guidance without running or mutating the project. Missing-kind `{commandId,fields:{lines}}` for Show Text (`m2-001-show-text`, or the audited invalid `m2-101-show-text`) remains rejected and suggests native `{kind:"text",body:lines.join("\n")}`. This is not an M2 ID alias, and no other ID or extra/conflicting field is guessed away. Sole `{selfSwitch:"A"}` condition shorthand receives canonical `{kind:"selfSwitch",key:"A",value:true}`; explicit boolean false/true is retained (the same omitted-value default as `make_villager.dialogue.when`). Singleton corrections target the actual `pages[i].conditions` field with an array; array corrections target only `pages[i].conditions[j]`, preserving siblings. Extra or malformed conditions get no lossy repair, including `kind:"none"` with additional fields (only bare `{kind:"none"}` still normalizes away). Apply the parsed `example` at `path`, retain other pages and dialogue, and retry through the runner. No story text is invented and canonical pages/condition arrays are unchanged. Focused contract: `test/npcAuditRepair.test.ts`; RED/GREEN and correction evidence: `.omo/evidence/assistant-audit-pr/npc/`.
- **`kind` 로 허용 키가 갈리는 툴은 스키마가 아니라 파서에서 정규화한다.** `oneOf` 를 못 쓰므로 모델은 두 모드 키를 섞어 보낸다 — 실측: `author_house` 에 `kind:"lots"` + 최상위 `kitId/wings` 를 한 턴에 33회 연속 전송. 에러 문구에 허용 키 전체를 실어도(`rejectUnknownKeys` 개선) 같은 턴에서 교정되지 않았다. `parseAuthorHouseRequest` 의 `normalizeRequestShape` 가 shape 로 모드를 추론하고 단일 모드 키를 `houses[0]` 로 접는다 — 같은 파일의 wings 클램프·`windows:true` 보정과 동일 방침. 실측 결과 33회 실패 → 성공 1회.
- **동료 저작 전용 툴 (`src/editor/tools/companionTools.ts`).** `add_companion` 은 `target.eventId` 면 그 이벤트의 **마지막 페이지**(RM 계열은 조건을 만족하는 마지막 페이지가 실행된다 — 첫 페이지에 넣으면 조건 가드용 빈 페이지에 박힌다)에 `addFollower` 를 붙이고, `target.mapId/x/y` 면 이벤트를 만든다(`trigger:"talk"` = 말 걸어 합류 + `setSelfSwitch A` 로 사라짐, `"autorun"` = `{kind:"auto"}` + 스위치 가드로 1회). `who` 는 `{actorId}` / `{query}` / `{textureKey, characterIndex}` 이고 그래픽은 항상 `charsetFollowerGraphic` 을 거친다. `configure_companion_rules` 는 `system.companions`(대형·간격·인원 상한·초과 정책·맵 이동 시 해제)를 쓰며 `domains: ["system"]` 로 선언해 event 도메인 자리를 잡아먹지 않는다. 동료는 DB 레코드가 아니라 세션 상태이므로 `DB_TOOLS`/database 도메인에는 넣지 않는다. 노출 경로 확보를 위해 `assistantToolMode` event 의도 키워드에 `동료/동행/펫/따라오/따라다니/companion/follower/pet` 을 추가했다 — 키워드가 없으면 40툴 트림에서 잘려 모델이 "그 기능이 없다"고 오보한다.
- **노출되지 않은 툴은 모델에게 "없는 기능"이다 (2026-08-23 실측).** "상성표/엔딩 조건" 요청에서 `set_type_chart`·`define_ending`·`get_database_records`·`script_cutscene` 가 도메인 스코핑·40툴 상한에 밀려 노출되지 않았고, 모델은 사용자에게 **"그 기능이 없습니다"** 라고 보고하며 작업 3건을 skip 했다. 툴콜 실패보다 나쁘다 — 사용자가 제품 한계로 오해한다. 수정: 참조 id 조회(`get_database_records`)를 `CORE_TOOL_NAMES` 로 승격(모든 쓰기의 전제), 의도 키워드에 `상성/상성표/속성`(battle+database) · `엔딩/ending/결말`(event+quest) · `컷신/cutscene/연출/선택지`(event) 추가, `PINNED_TOOLS_BY_DOMAIN` 에 `set_type_chart`/`define_ending`/`list_endings`/`script_cutscene(_preset)` 핀. **핀은 `tool.domains` 기준이다** — 엔딩 툴은 `withDomain(ENDING_TOOLS,"event")` 이므로 quest 에 핀해도 효과가 없다. 회귀 고정: `test/aiEndingToolExposure.test.ts`. 매 턴 노출 목록은 `tools:exposed <n> — <names>` 감사 라인으로 확인한다.
- **도메인 핀 맵에는 같은 키를 두 번 선언하지 않는다 (2026-08-24 실측).** `new Map([...])` 의 `system` 항목이 앞에서 `reset_project`/`configure_time_system`, 뒤에서 `evaluate_game_quality` 로 두 번 선언되어 뒤 항목이 앞 세트를 통째로 덮었다. 단일 도메인 요청에서는 우연히 시간 툴이 40개 안에 들지만, 길+NPC+상자+시간 복합 턴에서는 밀려 모델이 "시간 시스템 활성화 기능이 없다"고 오보했다. 시스템 핀은 한 `Set` 에 세 툴을 함께 둔다. 회귀 고정: `test/toolDomainScoping.test.ts`의 복합 요청 노출 계약.
- **플래너 응답이 잘리면 무관한 폴백 템플릿으로 갈아탄다 (2026-08-23 실측).** 6개 산출물 요청에서 플래너 JSON 이 출력 한도로 끊겨 `parseOrchestratorDecision` 이 `null` 을 돌려주자, 세션이 `buildDefaultWorkPlan` 의 장르 템플릿(moon-cutscene 1항목)으로 대체했고 모델이 "던전·적·물약·상성표·선택지는 추가되지 않았습니다"라고 말하면서도 턴은 성공으로 끝났다. 수정: 파서가 실패 **사유**를 반환하고(`OrchestratorParseResult`), 잘린 JSON 은 괄호를 닫아 도착한 layer 만이라도 복구하며, 폴백 진입 시 사용자에게 상태 메시지로 알린다. 플래너 프롬프트에 간결성(goal/instruction ≤200자)과 "모든 산출물은 항목으로 표현" 규칙을 넣었다.
- **완료 게이트는 읽기 툴도 세고, 없는 툴은 successTools 에서 버린다.** `successTools:["get_map_region"]`(읽기) 이나 `["configure_element_table"]`(존재하지 않음) 같은 항목은 쓰기만 세던 게이트에서 **영구 미완료**가 되어 skip 밖에 답이 없었다. `turnSuccessfulTools`(읽기 포함)로 판정하고, `sanitizeToolNames` 가 레지스트리에 없는 이름을 제거한다. `get_work_plan` 은 계획이 없어도 `ok:true`("활성 WorkPlan 없음") — 정상 상태를 실패로 세지 않는다.
- **거부 메시지는 유효값을 실어야 한다.** `speciesId does not exist.` / `elementRates key does not exist` / `알 수 없는 trigger.` 처럼 무엇이 유효한지 알려주지 않으면 모델이 같은 인자를 반복 전송하거나 "기능이 없다"며 포기한다. 이제 유효 id 표본(최대 12개)·허용 trigger 목록·허용 키 목록을 함께 반환한다(`references.ts` `knownIdsHint`, `shapeReferenceFields.ts` `TRIGGER_KINDS`, `boundary.ts` `rejectUnknownKeys`). `define_ending` 은 없는 스위치/변수를 거부하지 않고 `ensureNamed*` 로 만든다(엔딩 조건은 "앞으로 켜질" 플래그를 가리키므로 존재 검사가 순서 교착을 만든다).
- **린트·커밋 경로는 불완전한 저작 데이터에서 throw 하면 안 된다.** 모델이 이벤트 레벨 trigger 만 주고 페이지에는 `conditions/commands` 만 담아 `upsert_event` 를 호출하면 `projectLint` 의 `isSteppableTouch` 가 `page.trigger.kind` 를 읽다 TypeError → 커밋이 "후처리 실패: Cannot read properties of undefined" 로 끝나 원인이 가려졌다(3회 재전송). `fillRequiredPageFields` 가 `id/name/conditions/graphic/trigger/priority/movement` 를 보완하고(경고 표시), 린트 헬퍼는 `trigger?: undefined` 를 허용한다. 회귀 고정: `test/eventPageRequiredFields.test.ts`.
- **기존 이벤트 저수준 수정은 top-level patch 계약이다 (2026-08-24 실측).** `upsert_event` 가 입력 객체로 기존 레코드를 통째로 교체하면 스케줄을 붙이는 후속 턴이 NPC의 `pages`/그래픽/`characterId` 를 지우고, `place_chest` 뒤의 위치 보정이 50G 보상과 셀프스위치 페이지를 지울 수 있다. 기존 id에는 입력에 실제 포함한 최상위 키만 덮고 생략한 좌표·트리거·커맨드·페이지·인물 키는 보존한다. 새 id일 때만 `x/y` 가 필수다. `make_villager` 는 같은 맵의 정확한 event id 또는 `characterId` 를 우선 재사용하며, 스케줄-only 재호출은 기존 위치와 대사 페이지를 보존한다. 스케줄만 바꿀 때는 여전히 `set_npc_schedule` 이 우선 경로다. 회귀 고정: `test/toolsMapManagement.test.ts`, `test/stardewAuthoringTools.test.ts`.
- **부분 수용이 전체 거부보다 낫다 (2026-08-23 실측).** `elementRates:{fire:"C",water:"A",grass:"D"}` 에서 `grass` 만 DB 속성이 아니었는데 커밋 전체가 거부되고, 모델의 재시도는 `elementRates` 를 아예 빼버려 "불에 강하고 물에 약한" 의도가 조용히 사라졌다(전 속성 기본 C). `dropUnknownElementRates`(dbTools)가 무효 키만 버리고 유효 등급은 살린 뒤 사용 가능한 속성 id 와 함께 경고한다 — `fill_region` 이 보호 셀만 건너뛰는 방침과 같다. 회귀: `test/elementRatesPartialAccept.test.ts`. **`enemy.elementRates`(= `database.elements` id)와 `set_type_chart.types`(= `monsterSpecies.types`)는 다른 네임스페이스다** — 모델이 자주 혼동하므로 툴 description 에 명시했다.
- **실내 방 세션이 시작 맵을 교체하면 시작 좌표가 벽이 된다 (2026-08-23 실측).** `createEmptyRoomMap` 이 전면 VOID 였기 때문에 `start_interior_room_session` 직후 커밋이 `시작 위치가 통행 불가 타일입니다: (10, 8)` 로 거부됐고, 원인이 자기 인자가 아닌 줄 모르는 모델이 좌표만 바꿔 4회 재시도했다. 이제 계획된 바닥 footprint(rooms/wings)를 기본 바닥 타일로 선칠하고(바닥 레이어가 뒤에서 정식 재칠 — 최종 결과 불변), `reconcilePlayerStart`(roomHarness/engine)가 시작 좌표를 방 안 통행 가능 칸으로 옮기며 경고한다. 시작이 곧 실내인 게임(침실에서 깨어나기)을 막지 않기 위해 거부가 아니라 보정을 택했다.
- **`upsert_enemy` 는 이 호출이 새로 가리키는 참조를 먼저 검사하고, 커밋 거부 요약은 첫 사유를 싣는다 (2026-09-03).** DB AI 바 턴 실측: 모델이 조회 없이 `actions[].skillId: "skill_0001"` · `rewards.dropItemId: "item_0001"` 자리표시 id 를 넣자 일반 무결성 게이트(`commitChangeset` → reference-validation)가 쓰기 전체를 `'upsert_enemy' 커밋 거부(무결성 오류)` **한 줄로** 반려했다 — 함께 보낸 스탯·보상까지 버려지고 사유는 `issues` 에만 있어 모델·사용자 모두 이유를 못 봤다. 수정 둘: (1) `rejectUnknownEnemyReferences`(`dbTools.ts`)가 `skillIds`/`actions[].skillId`/`rewards.dropItemId`/`actions[].switch*AfterAction.switchId` 중 **이 호출의 args 가 넘긴 것만** 검사해 `enemy-reference-not-found` 로 위반 목록(먼저) + 허용 예시 5개 + `get_database_records` 안내(뒤)를 돌려준다(`upsert_troop` enemyIds · `define_monster_species` skillId 와 같은 패턴). 기존 레코드의 선재 깨진 참조는 보지 않는다 — 커밋 게이트가 기준선으로 용인하는 오류라 스탯 한 줄 고치기를 막으면 안 된다. (2) `toolRunner.commitRejectionSummary` 가 `'<tool>' 커밋 거부(무결성 오류) — <첫 위반 메시지> (+N건)` 을 만든다(접두어 유지 — 기존 `toContain("커밋 거부")` 계약). `activityLog.deriveAiActivityDiagnostics` 는 요약에 이미 든 이슈를 다시 붙이지 않는다. 회귀 고정: `test/dbToolsIntegrity.test.ts`(세 참조 거부·선재 오류 무시·정상 참조 통과·일반 게이트 요약).
- **NPC·몬스터는 이미지 없이 생산되지 않는다 (2026-08-30).** 모델은 `upsert_enemy` / `define_monster_species` 에서 `monsterResourceId` 를 상습적으로 생략했고, 통과된 레코드는 전투에서 `skinEnemySpriteUrl()` 공용 스프라이트로 대체되어 **모든 적이 같은 모습**이 됐다(`src/player/battleFieldDom.ts:547`). 원인은 둘이다: (1) 생략이 그대로 통과했고, (2) 리소스 id 는 전부 영어 어간이어서 `searchResources("monster","슬라임")` 가 0건 — 한국어로 넣으면 `invalid-args` 로 튕기니 모델은 필드를 아예 부치지 않는 것을 학습한다. 수정: `src/assets/monsterResourceSemantics.ts` 가 한국어 ↔ 어간 색인(종류·속성·재질·역할)을 들고 `monsterCandidates()` 태그에 주입되어 "해골 궁수" → `generated-enemy-skeleton-archer` 로 해석되고, `assignMonsterResourceId`(`src/editor/tools/monsterGraphicAssignment.ts`)가 생략 시 **정규화한 정확한 정체성 또는 모든 검색 낱말이 라벨/태그에 정확히 일치하는 경우에만** 이름으로 붙이고 경고한다. **2026-09-06: 해시 폴백을 제거했다.** `enemy_leaf_fox` / `풀잎여우`가 검색 0건 뒤 해골로 저장되던 결함이다. 부분 문자열·일부 낱말·`*`/`all`/`전체`·일반 카테고리만으로는 자동 지정하지 않는다. 넓은 `searchResources`는 조회용으로 유지한다. 세 쓰기 경로는 공용 `ensureMonsterGraphic`을 거쳐, 확실한 외형이 없으면 `monster-graphic-required`로 원자적으로 거부하고 `list_resources(kind:"monster", query:"*")` 조회 후 명시 ID를 넣도록 안내한다. 명시한 미등록 값/불확실한 검색어는 `invalid-args`이며, 확실한 검색어는 계속 해석한다. 등록된 명시 ID·기존 ID는 덮지 않고, `transparent:true`는 이미지 생략을 허용한다. 종족 `graphic` 부분 변경은 기존 ID와 투명 상태를 보존한다. `make_action_enemy`는 선택 `monsterResourceId`/`transparent` 인자를 받아 오류에서 복구할 수 있고 기존 적 수정에도 같은 검사를 적용한다. 회귀: `test/monsterGraphicReliability.test.ts`의 실제 `runTool` 생성·수정·거부 후 무변경 계약. 이 보장은 `make_action_enemy` 생성 경로에도 적용되어 이후 `make_hunting_ground` 필드 스폰이 같은 몬스터 외형을 쓰며, `place_battle_blocker` / `make_chase_scene` 는 그래픽 생략 시 `query:"monster"` charset 과 경고를 낸다. `add_companion` 의 actor 경로는 액터 `characterResourceId` 를 `charsetFollowerGraphic` 으로 해석하고, 값이 없으면 NPC 페이지와 같은 `resolveGraphicQuery("villager")` 주민 charset으로 폴백하므로 인간 동료가 몬스터 열차 charset으로 보이지 않는다. 같은 이유로 `upsert_event` 는 **대화가 있는 `action` 페이지가 그래픽 없이** 잡힐 때 먼저 그래픽이 있는 sibling page의 charset을 재사용하고, sibling이 없을 때만 주민 charset을 붙인다 — 셀프스위치 전환으로 NPC 정체성이 바뀌지 않는다. 말을 걸어야 하는데 안 보이는 이벤트는 플레이어가 찾을 수 없으므로 의도된 저작이 아니다. `priority:"below"`인 바닥 조사 마커는 보완하지 않으며, 투명 이벤트의 명시 경로는 `graphic:{transparent:true}` 이고 `auto`/`parallel` 컷신 이벤트도 그대로 둔다. 회귀 고정: `test/aiGraphicAutofill.test.ts`.
- **적대적 인자 스윕은 상시 게이트다.** `test/toolHostileArgs.test.ts` 가 전 쓰기 툴(100+)에 `empty`/`nulls`/`wrongTypes`/`deepHoles` 4종 인자를 먹이고, **거부는 허용하되 크래시·`후처리 실패`·`Cannot read properties` 는 금지**한다. 계약은 성공이 아니라 읽을 수 있는 실패다 — 모델이 고칠 수 없는 메시지는 그 자체로 버그다.

- **Soft-confirm (목록 확인) replaces hard unapproved-vocabulary blocks for construction.** `resolveVocabForBuild` in `src/project/tileVocabulary.ts` returns `approved | soft | missing`. Existing groups/tiles soft-allow and paint the map with `data.vocabSoftConfirm`; only missing ids hard-fail. Soft construction proposals set `requiresApproval` and show **cropped** map before/after thumbs (change bbox) plus 상세 재료·배치를 확인할 수 있는 UI; accept (`그대로 적용`) runs `applyVocabSoftConfirmApprovals` so `origin:user` is marked only on explicit accept (autoApprove still blocked). Card-level material warnings skip the second `confirmRuleApproval` modal. `place_props` identical args are deduped once per turn (`writeDedupeKey`). Login modal z-index stays below the proposal modal; proposal open forces guest identity if needed. Region AI (`runRegionTask`) shows no chat proposal card, but its default apply gate is `"approval"` (`runRegionTask.ts:831`) — the change lands only through the `pendingRegionApply` review modal (approve/discard); it auto-applies only via the legacy `gate:"immediate"` path (:850). Region runs also cap the session at `REGION_TASK_MAX_TOOL_CALLS = 24` tool calls (`runRegionTask.ts:50,:222`), and still mark soft vocab on apply and seed harness groups.
- AI activity/conversation persistence is not best-effort when LegacyDb is configured. Missing dedicated tables must surface `LegacyDbMigrationRequiredError`; apply and verify schema with `npm run db:migrate` / `npm run db:verify-ai`. Historical `ai_analysis_runs` fallback rows remain readable, but new activity logs only write `ai_activity_logs`, and remote log diagnostics are always scoped to the configured project id.
- Tile v3 includes `fill_region` in `src/editor/tools/v3/constructionTools.ts` for water/floor/ground surface fills with autotile or animated-terrain groups (soft-confirm when not yet origin:user). Use `fill_region` for lakes, rivers, floors, and terrain areas; keep `place_props` for scattered objects such as trees, rocks, and flowers. `build_wall` requires a supported expandable pattern with defined parts; fixed fence props without that pattern use `place_props`, not `build_wall` or `fill_region`. `fill_region` and `tile_erase` skip only protected start/transfer-destination cells that would become impassable and return a warning for the skipped coordinates instead of rejecting the whole edit.
- **Erase restoration ground (2026-09-07):** `tile_erase(kind:"all")` ranks only observed compatible lower ground, outside the rectangle first and inside second (row-major ties). Tileset role/group semantics, authored tile-role and layer overrides, metadata passage, and runtime passability must agree; floor/terrain/ground/path can qualify, not walls, roofs, props, water, upper homes, or blocked tiles. An explicit authored ground role can supersede inherited group vocabulary, but cannot bypass runtime layer/passage or completed-house protection. No candidate means `erase-ground-unresolved` before either layer changes, not a grass fallback or a fabricated atlas tile. Inspect the selected tileset and explicitly paint a valid ground surface before retrying. `layer:"upper"` needs no ground and reports `groundTile:null`; start/transfer support and transaction ownership guards still apply. `kind:"market"` retains its separate selective demolition contract. Regressions: `test/tileEraseGround.test.ts` (fresh 12x10 border, captured wall distribution, real crate placement on town222/240 and interior72, authored rules, atomic failure, ownership), plus `test/constructionToolsV3.test.ts` (upper-support passage protection and market behavior).
- Live MCP bridge for external agents: `src/editor/aiAssistantBridge.ts` registers from `aiChatPanel` and long-polls `http://127.0.0.1:17831` (see `npm run mcp:assistant` / `scripts/oprn-assistant-mcp.mjs`). Same chat session as the UI; tools are `assistant_send` / `status` / `audit` / `harness` / `abort`. Dev auto-connects; `?aiBridge=0` disables. `agy mcp add oprn-assistant node scripts/oprn-assistant-mcp.mjs` registers the bridge in AGY. AGY 1.1.x uses newline-delimited stdio JSON-RPC while older repo clients use `Content-Length`; `scripts/lib/mcpStdioFraming.mjs` detects the first inbound frame and replies in the same format. Keep both paths covered by `test/mcpStdioFraming.node.test.mjs`; a mere `agy mcp list` is not a health check—verify `assistant_ping` and `assistant_status` against an open editor.
- **상점 저작은 모든 활성 페이지에서 런타임이 열려야 한다 (2026-08-24 실측):** 런타임 `resolveEventPage`는 조건이 맞는 마지막 페이지를 선택한다. `make_villager`가 첫 페이지에만 `shop`을 넣고 뒤의 무조건 대사 페이지를 남기면 DB에는 상점 명령이 있어도 플레이에서는 상점이 열리지 않는다. `make_villager`와 `set_shop_stock`은 이제 이벤트의 모든 페이지에 동일 재고의 `shop` 명령을 추가/갱신한다. `runSceneTest(... expect.shopStock)`로 활성 페이지를 검증한다.
- **상점 의도와 명시 툴은 노출 상한 밖에서도 보존한다 (2026-08-24 실측):** `상점`/`상인`/`재고` 및 `shop`/`merchant`/`stock`은 event 도메인을 연다. `set_shop_stock`은 event 대표 pinned tool이다. 사용자가 `get_event`처럼 정확한 레지스트리 이름을 프롬프트에 썼다면 `mentionedToolSchemas`가 40-tool 도메인 trimming 뒤 다시 합쳐 준다. 그렇지 않으면 타일 UI + 복합 보존 문구가 핀을 채워, 모델이 실제로 존재하는 조회 툴을 “없다”고 오보하고 work item을 skip할 수 있다.
- **길 존재 판정은 autotile 패밀리 전체를 본다 (2026-08-24):** `aiAgentBrief.mapHasPath`와 원격 검증기는 단일 `TILE.PATH` id만 비교하지 않고 `isRoadTile`을 쓴다. 실제 dirt-road edge/corner id(예: 390/391/392/420/450)만 있는 맵을 “길 없음”으로 안내하면 안 된다.
- The AI chat panel owns user-visible turn controls and wires sibling modules: `src/editor/panels/aiChatPanel.ts` (turn pipeline, selection task, chrome/layout assembly), `aiChatPanelHelpers.ts` (pure helpers/audit export), `aiSettingsModal.ts` + `aiAuthSettings.ts` (config/auth surface), `aiProposalCard.ts` (proposal card + accept/reject/fusion), `aiConversationLog.ts` (bubbles/reasoning/tool activity/tile visuals), plus thinner shells `aiProposalSummary.ts` / `aiChatRenderers.ts` / `aiProposalFusion.ts`. (`aiCommandBar.ts` 는 커버이서 재구축으로, `aiProposalModal.ts` 는 승인 게이트 폐지로 삭제된 파일이다 — 찾지 마라.) Public test imports stay on `aiChatPanel` via re-export. Readiness is auth-mode-aware: ChatGPT mode requires a model and a reachable companion/login, while API-key mode preflights endpoint + key. The panel opens settings with focus, restores the latest same-project conversation asynchronously from IndexedDB `oprn-ai-records` (`src/ai/aiRecordDb.ts`; the old `oprn:ai-conversations` localStorage key is migrated on first access — see `editor-ai-panel.md` 「대화 기록의 로컬 정본은 IndexedDB 다」), shows elapsed time plus a visible tool counter during running turns, and wires the visible abort button to `AssistantSession`/`llmClient` AbortSignal. Keep browser UI in the panel layer; `src/ai/assistantSession.ts` should remain browser-independent and only accept the optional signal.
- **세션의 순수 표면은 `src/ai/session/` 이 소유한다 (2026-09-09 분할):** `src/ai/assistantSession.ts` 는 6,391줄이었고
  그중 클래스 밖 top-level 선언이 930줄이었다. 그 100개 선언을 책임별 14개 모듈로 옮겼다 —
  `session/types.ts`(공개 타입) · `sessionTools.ts`(세션 전용 툴 스키마·쓰기 툴 판정) · `assistantText.ts`(어시스턴트
  텍스트 위생) · `orchestration.ts`(주입 메시지 판별) · `proposalApproval.ts`(승인 필요 판정·경고) ·
  `buildSpecGate.ts`(밑그림 게이트 판정) · `toolResultWarnings.ts` · `eventTargets.ts`(이동 후 최종 좌표 접기) ·
  `toolPayload.ts`(툴콜 파싱·결과 축약) · `recordReference.ts` · `budgets.ts`(수치 상한) · `transientRetry.ts` ·
  `workItemLookup.ts` · `unknownValue.ts`. `estimateOutputTokens` 는 `sessionUsage.ts`, `npcRewardTargetSnapshot` 은
  `npcRewardWitness.ts` 로 갔다. **`assistantSession.ts` 는 기존 32개 export 를 전부 re-export 한다** — 61개 소비자의
  import 경로(`@/ai/assistantSession`)는 그대로다. 새 심볼을 추가할 때 이 파일에 top-level 선언을 다시 쌓지 말고
  해당 `session/*` 모듈에 넣고 필요하면 re-export 만 늘려라.
- **남은 5,072줄은 `class AssistantSession` 이고, 이건 파일 분할로 안 풀린다 (실측):** 필드 144개·메서드 173개이며
  `executeTurnLoop`(732줄)이 필드 46개를 읽고 메서드 57개를 부르고, `executeUserTurn`(358줄)은 필드 144개 중
  **73개**를 만진다. 상위 결합 필드는 `workPlan`(43개 메서드) · `ctx`(37) · `runOperation`(32) 로 클래스 전역이다.
  즉 이 클래스는 세션 쓰기 파이프라인(`recordToolResult`·`upsertProposal`·`pushAudit`·`pushOrchestrationMessage`)을
  공유하는 **코디네이터**라서, 도메인 클러스터(NPC 캐스트 저작 161줄 등)를 떼려 해도 협력자 15개를 실어야 한다.
  협력 객체로 뽑을 수 있는 것은 상태가 클러스터 안에 갇힌 것뿐이다. 후보와 그 비용:
  볼륨 계약(필드 3개·메서드 5개·약 40줄 — 단 `exportRuntime`/`restoreCheckpoint` 왕복을 건드린다),
  레이어 자문 검증(필드 4개·약 81줄), 압축(필드 6개·약 109줄 — `messages`·`config` 공유가 걸림돌).
  선례는 이미 있다: `ToolVerificationEvidence`·`AssistantAcceptanceLedger` 의 `exportRecovery`/`restoreRecovery` 쌍.
  **`executeTurnLoop`·`executeUserTurn` 재작성은 그 분기를 잠글 세밀한 테스트가 생긴 뒤에 해라** — 지금 하면
  리팩터가 아니라 회귀 도박이다.
- **AI visual polish (?쒖븞 6):** start cards use fixed 16px icons + uniform 48px row height and 2/3-column grids; start screen stays top-aligned (no vertical center abyss). Header has a thin accent gradient bar. Status badge uses `data-status-tone` (`idle`/`running`/`review`/`error`/`ok`) via `statusToneOf` ??same token colors as the collapsed FAB rail dots. Full history groups prior turns into collapsible `.ai-turn-group` with day dividers (`.ai-day-divider`); mini-stream still hides `.is-prior-turn`. Styles live mainly in `tabs-b-assistant-panel.css`; tests: `test/aiVisualPolish.test.ts`.
- **AI shared surface + dock modes:** Basic/expert editor chrome must not fork the AI panel. Start screen is the minimal empty-hint surface (`ai-start-screen` + `ai-start-empty-hint`, optional ?댁뼱媛湲? in both modes; there is no `ai-expert-board`. Chat layout is **side** (default full-height right column, accent border, header ?쒖궗?대뱶??chip) vs **float** (map-over command capsule, ?쒗뵆濡쒗똿??chip + ?쒗뵆濡쒗똿 諛?쨌 留????낅젰??label). Visible dock mode buttons: `ai-dock-mode-btn` / `ai-dock-mode-btn-header`; menu copy: ?쒗뵆濡쒗똿 바로 ?꾪솚??/ ?쒖궗?대뱶 ?⑤꼸濡?고정?? Tests: `test/aiSharedSurface.test.ts`.
- **툴콜 응답 파싱은 프로토콜 계약의 일부다 (2026-08-30):** 툴 실패로 보이던 신고 중 상당수는 공급자 응답 파싱 결함이었다 — `index` 없는 스트리밍 delta 가 병렬 툴콜을 한 호출로 이어붙이고, id 없는 응답이 중복/빈 `tool_call_id` 를 만들고, 잘린 인자 JSON 이 `필수 인자 누락` 으로 위장됐다. 세부·회귀는 `openwiki/editor-ai-panel.md` 의 «툴콜 프로토콜은 경계에서 보정한다» 항목과 `test/aiToolCallProtocol.test.ts` / `test/aiToolCallSessionProtocol.test.ts` 를 보라. 툴 스키마 계약(array items·oneOf 금지)과 달리 이 계층은 **모델이 아니라 전송/파싱**의 문제이므로, 툴 실패를 조사할 때 스키마보다 먼저 여기를 확인한다.
- AI chat streaming retry is split by layer: `src/ai/llmClient.ts` normalizes stream reader disconnects and early SSE termination into retryable `LlmError`s, while `src/ai/assistantSession.ts` owns LLM-round retries, disables the client's internal retry for those calls, clears partial stream UI with `assistant_stream_reset`, and emits Korean retry status text. User AbortSignal cancellation must still return `aborted` without retry.
- Failed tool rows in `src/editor/panels/aiChatRenderers.ts` must expose the real `ToolResult.summary` plus the first issue message before appending the internal retry count; do not mask actionable errors behind a retry-only label.
- Main chat model orchestration is owned by `src/ai/assistantSession.ts`, with UI status display in `src/editor/panels/aiChatPanel.ts`. Orchestration is enabled when `agentMode === "auto"` (planner always on, single model or not) or when `liteModel` differs from `model` (`orchestrationEnabled()`, assistantSession.ts:1508); only `chat` mode keeps the pure legacy `model !== liteModel` test. When active, `sendUserMessage` emits `phase` events for `plan`/`execute`/`review`: plan and review use the supervisor `model`, write-tool execution uses `configForLiteModel`, and review may send one `?ъ떎??` repair pass back to execution before final response. Phase-control prompts are transient `role:"user"` messages prefixed `[?ㅼ??ㅽ듃?덉씠??` and are removed from `messages` at turn end; review calls omit tools and `tool_choice`. If orchestration is active, `requestLikelyExpectsChange()` is true, no write tool was attempted, and the assistant is about to end with non-question text, `AssistantSession` injects one transient `[?ㅼ??ㅽ듃?덉씠?? ?ъ슜?먮뒗 蹂경을 湲곕??⑸땲??..` user message to re-kick planning; the second zero-change ending is allowed to finish. Assistant final text must suppress raw provider tool-call markup such as `<tool_call>`/`<invoke name=` and route review-time markup corruption through the one repair pass. The status ticker should fuse the phase label into elapsed/tool progress, e.g. "계획 以?m3) ??12珥?쨌 ?꾧뎄 3/200". `runRegionTask` creates sessions with an already-lite config and should remain a lite-only path. `configForLiteModel` (`src/ai/llmClient.ts`) falls back to `config.model` (supervisor) when `liteModel` is unset — this unifies region-task execution across authModes (ChatGPT OAuth routes via `/v1` codex proxy; apiKey routes via `config.baseUrl`). `loadAiConfig()` fills a missing `liteModel` with the stored `model`, not `DEFAULT_LITE_MODEL`, so changing the supervisor model alone propagates to region-task execution without a separate liteModel setting. Explicit `liteModel` is still respected when set.
- Assistant skills were removed (2026-08-27): there is no slash skill list, skill drawer, or skill pin bar. The chat header stays light (title, status/abort, font/settings/dock, collapse) and the composer takes free text only. Do not reintroduce skill surfaces or always-visible header mode badges.
- AI tool reachability is scoped by active domain union, not a single mode. `src/editor/assistantToolMode.ts` computes `core + uiDomain + deterministic intent keywords + recent successful tool domains`, with recent domains kept by a short TTL and reset by explicit task-switch wording. Tile intent keywords include placement words such as `?섎Т`/`?뚰뭹`/`吏?/`嫄대Ъ` so region construction stays on the tile domain. `src/editor/tools/toolRegistry.ts` accepts `{ domains }`, keeps deprecated tools hidden, caps exposed tools at 40 (`MAX_EXPOSED_TOOLS`, `toolRegistry.ts:219`) by domain priority, and preserves all database tools once the database domain is active.
- Tool exposure caps (default 40) drop only weak/recent domains wholesale; strong tile+event intent stays and is trimmed with pinned write tools (`place_props`, `place_npc`, `author_house`, `start_interior_room_session`, `run_interior_room_pipeline`, `advance_interior_room_build`, `evaluate_interior_room`, ??.
- Region AI (`src/editor/regionTask/runRegionTask.ts`) may still seed build-palette harness groups; soft-confirm means existing tree/prop group ids work without prior origin:user. Prompt lists available group ids. `place_npc`/`make_villager` default graphic to villager when omitted. Each run builds a `RegionTaskLogExport` (audit + toolCalls + uiEvents + harness) on `result.log`, publishes `window.__rpgzzuRegionTaskLog` / `__rpgzzuLastRegionTaskLog()`, and the region modal header has a small **로그** button (`region-task-copy-log`) next to ?뚯쁺???묒뾽??that copies the JSON to the clipboard after a run.
- AI tool argument normalization is centralized in `src/editor/tools/jsonSchema.ts` before schema validation. It accepts common coordinate shape drift by flattening `{rect|region|area|bounds|at|pos|point:{x,y,w,h}}` into flat `x/y/w/h` tools, wrapping flat `x/y[/w/h]` into the single coordinate object required by v3 tools, and mapping `width/height` aliases to `w/h` (and back) based only on the declared schema.
- **Reachability coordinate boundary (2026-09-07):** `check_reachability` in `queryTools.ts` applies the existing `validateArgs(COORD_SCHEMA, point)` to `from` and every `targets[i]` before BFS. The shared runner validates only outer object/array types; missing, fractional, nonfinite, or structurally invalid coordinate fields must return `ok:false` / `invalid-args` with no reachability data, not `ok:true, reachable:false`. Existing schema normalization (including numeric strings and coordinate wrappers), extra point metadata, and empty target arrays remain supported. Valid queries still return real reachable/unreachable verdicts with adjacent-or-on semantics. `test/reachabilityArguments.test.ts` covers recorded wire114, nested object/array countercases, real `runTool` -> `ToolVerificationEvidence` retry history, and genuine negative evidence surviving another passing query. This is a local query-boundary fix, not recursive validation for other tools (including `run_lint` specs), verification ownership/canonicalization repair, or retroactive reclassification of an old session ledger.
- W5 team workflow UI shows current editor identity in the topbar, can reopen the mock login modal, and reads recent `project_commits` through `listProjectCommitsFromLegacyDb`. The mock login only updates the local editor owner label and last-login-method localStorage marker; real Auth/RLS session handling belongs to the Phase 8 switchover.
- For quick navigation, grep within `src/editor` first, then follow the feature-specific file groups above: map, event, database, resource, tile palette, save/import/export.



- Room harness automation may use the low-level typed `src/editor/roomHarness/facade.ts` API for deterministic start/advance/evaluate, lock, and room-only reroll operations. The user-facing quota-independent route is `src/editor/regionTask/runDirectRoomDraft.ts`, exposed by the region modal as **AI 없이 실내 초안** with structural presets and composable modifiers. It selects a world-reachable doorway, connects both transfer directions, and enters the same `pendingRegionApply` review/approval surface as AI work; LLM tool wrappers remain compatible but are not the only route to harness behavior.
- Tileset knowledge analysis uses `requestTilesetMapping` as a real multimodal OpenAI-compatible request: the user message contains a JSON task plus an `image_url` data URL for the rendered full atlas. `tilesetAiNativeAnalysis.ts` validates proposal tile ranges and executable template geometry before any review card is shown. The review/apply boundary is `tilesetAiNativeReviewApply.ts`; do not move `store.update` into Analyze or card rendering. High-confidence means `>=0.85`, uncertain means `>=0.5`, and lower results always require an explicit per-card decision.
- The tileset client follows the shared AI proxy-auth contract: relative `baseUrl` values are same-origin server-authenticated routes, require no browser API key, and must not receive an `Authorization` header. Absolute provider URLs still require the configured key. Review apply rejects overlapping lower-confidence candidates after deterministic confidence/id sorting.
- `author_village` preserves unsupported landmark intent truthfully at the existing theme→decor seam: normalized themes containing `fountain` or `분수` place the supported combined_town well tile `382` at the plaza and return a visible construction warning that the fountain asset is unavailable and the well was substituted. Ordinary themes retain the default single-well behavior without this warning; no fountain tile or asset-generation capability is implied.
- `author_village` pipeline ends with a placement-conflict scrub (`scrubPlacementConflicts` in `src/project/lint/layoutPlacementValidate.ts`, called from `village/builder.ts` after landscape): later stages (decor scatter, waterway/lake carving) can paint water or walls under tree canopies already in `upperTiles`, which the approval gate (`validateLayoutPlacement`) correctly rejects as `layout-prop-on-water` / `layout-tree-on-impassable`. The scrub removes exactly those upper cells with the same rule set as the gate, so a fresh `author_village` village passes first-accept without AI fix turns (verified: luna run17, T1 accepted on attempt 1).
- `build_village` 간선은 4갈래 중 1갈래가 광장이 아니라 인접 축 간선에 T자로 붙는다 (2026-09-04): 예전엔 4갈래가 전부 광장 rect 변에 닿아 매번 같은 plus 위상(= 십자가로 보임)이 반복됐다. `villageArteryRoutes` 가 시드별 분기 갈래를 돌리고(4-cycle, [N,S,W,E]에서 +2라 정반대 축이 아님), N/S 앵커는 가장자리 1/5 폭으로 흩어 일직선 세로축을 깬다. 앵커·분기 갈래는 원본 시드에 묶고 흔들림만 재시도 시드에 맡겨 layoutPlan.roadAnchors와 exitRoads 게이트가 어긋나지 않는다. 4변 출구는 유지되므로 `exitRoads=4` 게이트는 그대로 통과한다. Tests: `test/villageCrossRoad.test.ts`.
- `build_village`는 집을 찍기 전에 스케치 프리패스를 먼저 돌린다 (2026-09-04): `build_village`가 `buildHouses` 전에 `sketchHouseSites`를 뽑고, 스케치 후보를 분수 슬롯·격자보다 먼저 시도한다. 사이트 간격은 8폭+마진(10). 격자는 폴백이다. `villageArteryRoutes`는 다리당 내부 경유점 하나를 더 넣되 `host[1]` T-join과 4변 출구는 그대로 둔다. Tests: `test/villageSketch.test.ts`.
- `build_village` 대형 맵 대로 골격은 이제 곡선이다 (2026-09-05): `villageBoulevardPath`가 시드 고정 경유점으로 동서·남북 곡선을 그리고, 예약과 시공은 `boulevardCells` 한 칸 함수를 같이 쓴다. Tests: `test/villageBoulevard.test.ts`.
- `build_village` 자연형 길은 더 이상 십자가 아니다 (2026-09-17): 위 2026-09-04·09-05 항목이 만든 "4변 출구 + 광장 중심 4갈래 + 동서·남북 두 축 대로"는 시드가 무엇이든 플러스 위상으로 수렴했고(`exitRoads=4` 게이트가 그 위상을 강제했다), "집을 먼저 깔고 길을 잇는다"는 스케치 프리패스 뒤에도 길은 여전히 광장에서 뻗어 나가는 별 모양이었다. 이제 (1) `villageExitAnchors` 가 시드로 2~3변만 고르고 `layoutPlan.roadAnchors` 는 `${side}-exit` id 로 실제 앵커를 기록한다, (2) 72칸 이상 대로는 `villageBoulevardAxis` 가 시드·가로세로비로 한 축만 고른다(`street-grid` 만 두 축), (3) 집이 찍힌 뒤 `villageStreetNetwork` 가 광장 결절 + 집 앞 결절로 Prim MST 를 만들고 축 평행 골목(`alleyRoute`)으로 잇는다 — 세 구간 전부를 모든 집 footprint 와 대조해 고르므로 길이 집 몸통을 가르지 않고 대각선은 만들지 않는다, (4) 출구는 가장 가까운 결절에 붙는다, (5) `villageEvaluate` 의 exitRoads 게이트는 `layoutPlan.roadAnchors.length` 를 목표로 삼는다. 명시적 `street-grid` 는 예전 두 축 밴드 + 4변을 유지한다. Tests: `test/villageCrossRoad.test.ts`(골격·집 관통·축 평행 단언), `test/villageBoulevard.test.ts`, `test/villageBuilder.test.ts`.

## P2 requirement and exact-verdict inputs (2026-09-06)

Planner output and native `set_work_plan` accept optional `requirements` using
`{ id, title, required?, criteria }` and item `requirementIds`. They feed the same
`AssistantAcceptanceLedger` as existing explicit `acceptance`; item scheduling
isn't satisfaction authority. Required defaults true. Malformed criteria or
required flags remain required repair obligations, even if the model claims
optionality or supplies evidence. `repair_acceptance` can't replace valid original
criteria. See [requirement lifecycle and user actions](editor-ai-panel.md#canonical-requirements-and-genuine-user-actions).

The additional structural criterion is:

```ts
{ kind: "toolVerdict", tool: "check_reachability", args: {
  mapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 0 }]
} }
```

`tool` must belong to the existing verification family. `args` is the full native
invocation object, not a tool-name-only claim. For this native tool the field is
`targets`; the separate structural `reachability` criterion uses `to`.
[Acceptance parsing](../src/ai/assistantAcceptance.ts) reuses custom fail-closed
parsing, and [ToolVerificationEvidence.passedScope](../src/ai/toolVerificationEvidence.ts)
reads only previously adopted canonical scopes with exact native arguments and
`parseToolVerdict`. The acceptance ledger binds those scopes before execution;
a later declaration cannot borrow an earlier exploratory pass.

Canonical input now passes the registered tool schema AND native scenario/coordinate
validation before becoming immutable. Malformed arguments are actionable repair
obligations, even when declared optional; valid optional criteria remain optional.
For `toolVerdict/run_scene_test`, explicit `interact` steps also declare
`interactionTargets:[{stepIndex,mapId,eventId}]`. Arguments with unnamed interactions
are not an admissible canonical scope; repair their malformed specification first.
Valid fixed arguments with missing/partial ownership remain `pending-specification`.
`repair_acceptance` can complete only the missing ownership: it cannot change fixed
arguments, known targets, sibling criteria, source/owner or original baseline.
The host captures the same protected initial state as ordinary scene declarations,
including while scope is pending. Repair retains that state and requires fresh
post-resolution execution. A previous passing probe cannot fill ownership, and a
same-argument run through another map's same-ID NPC cannot satisfy the original.
Scenes without interactions have an empty ownership scope. No runtime state is
accepted from model-authored criteria. Regression: `canonicalAcceptanceOwnership`.

Only a current host-observed explicit pass satisfies that exact scope. Wrong targets, negative
verdicts, stale checks, model `passed` claims and advisory-only success don't.
A clean advisory check can retain an already-current explicit canonical pass,
but cannot renew it after a write. Writes stale passing required evidence; successful
unadopted probes do not become persistent obligations. Undo does not revive retired
proof. A passing verdict cannot verify an unapplied draft.

Scene finding correction preserves exact start, movement, debug state, ordered
assertions, choices, reward checkpoints and map-qualified host-observed ownership.
Only facing may change compatibly; never strip move/walk/position-only set or map
guards to equate scripts. `correct_verification` resolves a session-owned ID and
executes its original registered tool. A compatible passing rerun clears only its
own finding. Canonical `toolVerdict` still requires its exact invocation. Both `toolVerdict` and incoming `actionCombat`
are exposed in the flattened provider-safe criterion schema; runtime parsing still
requires each kind's exact fields and exclusive target.

Name-level scheduler queries and advisory reporting retain their existing roles.
Canonical acceptance also receives authoritative verification problems: adopted
requirements and genuine unresolved negatives remain blocking, except host-confirmed
unchanged pre-write default-lint findings seen only automatically outside adopted lint scope.
Those findings remain reported; see the provenance contract in `editor-ai-panel.md`.
Malformed/execution
failures are attempts, not artifact findings. Findings need not invent a goal item
to block false completion. Optional/host-withdrawn criteria retain their evidence
without becoming required scopes; item-declared verification remains independent.
Intent action obligations and current map-bound
runtime receipts remain independent of planner replacement and optional promises.
The ledger's existing evaluation receives the goal evidence store; absence of that
store fails tool-verdict criteria closed. No new verification ledger or dependency
was added. Withdrawal is a local user action, never a `withdraw_requirement` tool,
model note, `skip_work_item` effect or `resetsContext` permission.

## Project-wide quality evaluation

`evaluate_game_quality` is read-only. It combines project lint and tileset-palette findings with structural coverage across legacy event commands, event pages, common events, troop battle pages, and every nested command branch. It also reports quest/battle/ending/content counts, story-flag reads and writes, and optional caller-supplied walkthrough results. Objective project errors, unauthored secondary maps, and uninvoked ending definitions block its verdict; palette findings and caller-supplied walkthrough results remain explicit evidence. It never emits a numeric score and cannot measure fun, originality, emotional impact, pacing quality, or preferred difficulty.

**Ending invocation (2026-09-06):** `define_ending` stores a definition, not an automatic switch listener. An event must execute `triggerEnding`: a named `endingId` selects that definition directly, while an omitted id selects the highest-priority definition whose conditions match. Completion assessment reports `ending-uninvoked` errors and `coverage.endings.uninvokedIds` for definitions without a named or condition-selected invocation. It traverses nested branches/common events/troop pages but ignores obsolete root commands when event pages exist. Presence is only a structural lower bound: it does not establish branch reachability, satisfiable conditions, epilogue presentation or actual completion. Games without ending definitions (including native `ending` commands and open-ended games) acquire no new requirement.

This check lives in `qualityEvaluation.ts`, not `projectLint` or the write gate: defining an ending before wiring it remains valid. Never make `setSwitch` run endings automatically. The existing `define_ending` guidance calls for an explicit terminal command and, for item-consuming exits, a higher-priority completed-switch page that prevents same-run relock/repeated consumption. Regression: `test/aiEndingCompletionRegression.test.ts` exercises real tools, serialization, page selection, interpreter execution and the machine verdict consumer; historical broken content still does not end. Parent-owned real AI generation and exported-player walking remain required for game-completion proof.

**Verification evidence (2026-09-07):** `ToolResult.ok` means execution, not a passing artifact verdict. Existing `parseToolVerdict` semantics remain. `ToolVerificationEvidence` separates adopted requirements, unresolved findings and attempts; neither an explicit exploratory pass nor a malformed invocation invents an obligation. Accepted criteria and validated `WorkItem.verificationChecks` own requirements; absent scope remains pending specification. **Pending 은 사유로 갈린다 (`pendingReason`, 2026-09-11):** 선언 자체가 없는 계획의 공백은 `"omitted"` — 진단으로만 노출하고 완료를 막지 않는다(그렇지 않으면 통과한 `run_lint`·`check_reachability` 가 영구 미통과로 집계돼 완료 게이트가 교착한다). 선언은 했는데 스코프가 파싱되지 않은 것은 `"malformed"` — `passed()` 와 `problems("blocking")` 양쪽에서 **계속 차단한다**. 두 사건을 한 표현(`args === null`)으로 묶으면 malformed 스코프가 무관한 통과 기준에 얹혀 `verified` 로 집계된다(실측: `verificationPlanAtomicityReuse` 의 「a malformed new scope cannot silently reuse an unrelated accepted criterion」 2건이 `expected 'verified' to be 'blocked'` 로 실패). Session check IDs survive scheduling changes and appear in `data.verification` on plan/verification results. See [editor-ai-panel.md](editor-ai-panel.md), "Session-owned acceptance contract", for the small declaration and `correct_verification({checkId,args})` surfaces. Ordinary compatible reruns still resolve their own scope; unrelated maps/events and weaker assertions cannot. Writes retire passing adopted proof, while a successful unowned dummy probe can be removed without a recreation obligation. Genuine negative findings remain blocking until a compatible real pass. The sole report-only exception is an unchanged host-confirmed pre-write default-lint defect observed only automatically, with no active adopted lint requirement. Counts alone are never identity, and unknown provenance is blocking. Findings and failed verdicts remain intact; only terminal filtering distinguishes report-only baseline lint. Layer advisory scheduling remains unchanged.

`run_scene_test` returns host `interactions:[{stepIndex,mapId,eventId}]` (including movement-triggered transfers), structured `setupFailure`, and optional `failedSelection:{stepIndex,mapId,eventId}` for an explicitly intended event that could not be selected. Failed selection is separate from executed interactions, including wrong front/underfoot events, farm targets at either position, no target, game-over and missing-current-map returns. Finding deduplication and discharge include that intended map/event; a preceding transfer-door receipt cannot let a foreign-map pass clear it. Successful same-map target/facing repairs remain compatible. Only an unowned assertion-free interaction with no selected target receives the invalid-probe exception; explicitly missing targets and failed assertions do not. Facing corrections preserve all other steps and require matching map-owned trace. Movement/walk/set-position is never stripped from identity. No scene receipt is browser player, visual, persistence or action-combat proof. Tests: `assistantVerificationEvidence`, `assistantVerificationContinuation`, `sceneVerificationRepair`, `sceneTestRunner`, `verificationSelectionOwnership`, and the caller matrix in `aiAssistantSession`.

`play_walkthrough` exposes a single provider-safe scenario item object rather than JSON Schema unions. All runner fields are optional at the provider boundary because the valid required set depends on `do`/`expect`; the runner is the strict trust boundary and rejects unknown fields, mixed variants, bad types, and empty scenarios before executing any command. Provider-compat tests recursively reject both `oneOf` and `anyOf` anywhere in an exposed tool schema.

## prune_unused 의 참조 수집은 variableId 를 가진 명령 전부를 세야 한다 (2026-08-29 실측 결함 수정)

`src/editor/tools/refactorTools.ts` `addCommandRefs` 의 `switch` 가 다루던 kind 는
`setSwitch`/`setVariable`/`changeGold`/`changeExp`/`getFriendship`/`fork`/`changeItem`/
`battleProcessing`/`shop` **9종뿐**이었다. 스키마(`src/project/types/events.ts`)에서
`variableId` 를 지니는 kind 는 `wait`·`inputWait`·`inputNumber`·`setVariable`·`getFriendship` 이라
**앞의 세 개가 통째로 빠졌다.** `moveEvent` 경로 안의 `{ kind: "setSwitch" }` 무브도 누락됐다
(`databaseCommandReferences.ts:298` 은 그걸 센다).

왜 조용한가: 누락된 참조는 `findUnused` 를 지나 `prune_unused apply=true` 에서 **이름만 비우고
id 슬롯은 남긴다**(`def.name = ""`). id 가 지워지지 않으므로 `commandReferenceValidation.ts:205` 의
`inputNumber: variableId가 존재하지 않습니다` 단언은 **끝까지 안 뜬다.** 그리고 `actions.ts:438` 이
이름이 빈 슬롯을 다음 «변수 추가» 에 **재발급**한다 — 무관한 두 기능이 한 변수를 조용히 공유하게 된다.

계약 테스트: `test/refactorTools.test.ts` «prune_unused 참조 수집 누락» (inputNumber/inputWait/wait
각각 단독 참조 + moveEvent 경로 setSwitch + 진짜 미참조 변수는 여전히 보고되는 회귀 케이스).

- **이미지 생성은 Antigravity 한 경로뿐이다 (2026-08-30, 2026-09-03 갱신):** 동반 서비스에
  `POST /v1/images/generations` 가 붙었다(`ohMyPiHttp.mjs` → 어댑터 `generateImage` →
  Bun 워커 `/image` → `scripts/lib/ohMyPiImageRuntime.ts`). 브라우저 클라이언트는
  `src/ai/imageGenerationClient.ts` 이고 `/v1/chat/completions` 와 같은 같은-오리진 규약을 쓴다.
  요청 모델은 `gemini-3.8-flash`. 카탈로그에 없으면 워커가 `gemini-3.1-flash-image` 로 떨어진다.
  이벤트 「그림 표시」 폼의 `AI로 만들기`(`showPictureAiField`)가 같은 경로를 타고
  `insertGeneratedPictureAsset` 으로 업로드 그림 리소스를 심는다.
  실측 결과: `google-antigravity` + `gemini-3.1-flash-image` 에 `generationConfig.responseModalities`
  = `["TEXT","IMAGE"]` 를 pi-ai 의 `onPayload` 훅으로 주입하면 `v1internal:streamGenerateContent`
  가 `inlineData`(image/jpeg, 약 360KB base64) 를 200 으로 돌려준다.
  **Codex 는 못 한다** — 호스팅 `image_generation` 툴을 요청할 방법이 pi-ai 에 없다
  (`NativeToolMarker` 가 `{type:"computer"}` 하나뿐). 응답 쪽 `image_generation_call` 파서는
  있지만 요청을 만들 수 없으므로 살아 있는 경로가 아니다. 그래서 클라이언트는 대화 제공자가
  무엇이든 그림만 Antigravity 로 보내고, 모달이 그 사실을 안내한다.
  **함정 둘:** (1) pi-ai 의 Google 응답 파서는 `inlineData` 를 버린다(`type:"image"` 파트를
  만들지 않는다) — 그래서 이미지 바이트는 전송 계층에서 직접 줍는다. (2) 그때 재생하는
  `Response` 에 `url` 을 다시 심어야 한다. 없으면 pi-ai 가 `Missing request URL` 로 끊는다.


## Action controls guide (2026-09-07)

2D tile action combat is supported; 3D open worlds remain outside the engine.
`actionArenaAuthoring.ts` selects its recipe only for a structured creation
declaration with nonempty `actionCombat.targets` and no clarification. The
selector never parses user keywords. `buildActionArenaAuthoringGuide` is consumed
by the action welcome preset and the lead's context integration. It reads
existing maps/events/resources/party/enemies/troops before minimal terrain/start,
names the map and game, orders enemy before troop before spawn, and makes one
controls guide. Each target must pass `run_action_combat_test({mapId})` before
decorations; the async acceptance/runtime lane owns that tool's receipt.
`run_scene_test`, spawn counts and turn-based `simulate_battle` cannot substitute
for action proof. Unrequested quests, shops, bosses, rewards and multi-page
quotas are not part of this recipe. Existing arena modifications remain focused
repairs with retained acceptance targets, not a new-arena starter.
Free-text welcome handoff also preserves the requested scope rather than adding
the generic preset's NPC/item quotas before structured intent classification.

`make_action_enemy` prepares the enemy and validates its graphic, target map,
troop membership and spawn area before committing either record. `spawn.id`
upserts within the target map; omission appends a fresh ID. `set_action_combat`
validates its map before enabling the system and exposes the existing
`dodgeStaminaCost`, `dodgeIframesMs`, `guardDamageReductionPercent` and
`guardStaminaDrainPerSec` normalizers. Read resources first, create the enemy,
then `upsert_troop({troop:{id,name,enemyIds:[enemyId]}})`, then attach its spawn.
`test/actionAuthoringPrerequisites.test.ts` covers both direct-draft atomic
failure and the real runner's successful dependency order.

`place_npc` accepts `guide: "action-controls"` instead of authored `pages` for one
controls page only. `src/player/keyBindings.ts` exports `ACTION_CONTROL_BINDINGS`
(`id`, normalized `keys`, `label`) and `ACTION_CONTROLS_GUIDE`; the generated text
comes from those runtime predicates, not model-authored key descriptions.
The default identity is `ev_action_controls_<mapId>`. An explicit ID takes
precedence. Retries update that event's page without moving it, even when the
requested name or coordinates change. Nearby ordinary NPCs are not guide
identities, and distinct explicit ordinary NPC IDs still remain distinct.
Ordinary NPCs still require authored pages. The guide is the narrow exception to
the narrative multi-page recommendation, not a fallback for missing dialogue.

Regression: `test/actionControlsGuide.test.ts` exercises real tool dispatch,
repeat identity, explicit-ID priority, ordinary NPC separation, and shipped
command-body equality with the canonical guide.

## NPC 대사는 코드가 지어내지 않는다 — 캐스트 라이터 계약 (2026-09-03)

사용자 보고: "npc 대사가 생성할 때마다 비슷하다. 하드코딩이냐?" — 맞았다. `author_village` 는 인자에 대사 자리가 없어
(`npcCount` 만) 항상 `village/constants.ts DEFAULT_NPCS`(민재·소라·대길… 10명 고정 대사)를 돌려썼고, `make_villager`/`place_npc`
는 대사를 빼면 `"안녕하세요."`·`"일하는 중이야."`·호감 페이지 `"고마워…"` 를, 밑그림 npc 자동 배치는 `"${name}입니다."` 를,
`build_castle` 은 문지기·성주 고정 대사를 박았다. 그리고 `project.world`(세계관)는 AI 어디에도 실리지 않았다
(`buildWorldDigest` 호출자 0). 전부 제거했고 계약을 이렇게 바꿨다.

**계약**
- NPC 를 만드는 툴은 대사가 없으면 **text 커맨드 0 인 '대기' 페이지**를 만든다. 대체 문구 없음. `author_village`/`build_village`
  는 `대사 없는 NPC: N명` 경고를 그대로 낸다. 임시 이름은 `주민 N` 이며 캐스트 라이터가 이름까지 바꾼다(내부 맵 이름
  `주민 N의 집 내부` 도 함께 바뀐다). `make_villager` 의 활동 페이지·`friendshipUnlock` 페이지도 대사 없이 만들어지고
  `friendshipLines:{unlock, after}` 인자로만 채워진다.
- `author_village` 는 `residents:[{name, role?, lines?}]` 를 받는다(스키마·`parseAuthorVillageRequest`·`villageDomainArgs → npcs`).
  모델이 직접 쓰면 그대로 들어간다.
- 세션 훅 `AssistantSession.authorPendingNpcCast` — **턴 끝**(최종 응답·검수 종료·예산 종료 직전)에 기준선에 없던 대사 없는
  NPC 를 맵별로 모아 lite 모델(`configForLiteModel`, `response_format: json_object`)에게 **한 장의 캐스트 시트**를 받는다.
  프롬프트(`ai/npcCast.buildCastWriterMessages`)에는 테마(툴콜 `theme` 또는 밑그림 title)·요청문·세계관 다이제스트
  (`buildWorldDigest`, 600토큰)·같은 맵의 이미 대사 있는 주민·대기 페이지(pageId + 조건 라벨: 활동/시간대/호감도…)가 실린다.
- 검증은 코드가 한다(`parseCastSheet`): 대기 페이지 전원 ≥1줄, 주민 ≥2 이면 절반 이상이 **다른 주민 이름**을 언급, 세계관
  개체가 있으면 ≥1줄이 그 **이름**을 언급, placeholder 이름 금지, 모르는 eventId 거부. 실패 사유를 붙여 1회 재요청.
- 적용은 새 쓰기 툴 `author_npc_cast`(`tools/npcCastTools.ts`) — 페이지에 changeFace+text 를 앞에 넣고 **상점 등 비텍스트 커맨드는
  보존**, 페이지/이벤트 이름 변경, 주민을 `world` 의 `character` 개체(`w_npc_<eventId>`, refs event+map, origin ai) + 맵 `place`
  개체(`w_place_<mapId>`) + `locatedIn`/`knows` 관계로 등록(`castSheetToWorldPatch`, `normalizeWorld` 통과). 사용자(origin user)·
  잠긴 개체는 덮지 않는다. diff 에 `eventsModified`·`worldEntitiesAdded` 가 잡혀 제안·감사·되돌리기가 다른 쓰기와 같다.
- 실패(JSON 깨짐·검증 2회 실패·툴 거부)는 **재킥**: 감사 `npc-cast:failed`, 오케스트레이션 메시지 "HARNESS: 대사 없는 NPC N명…
  place_npc {id, dialogue} 로 직접 쓰라" 를 넣고 최종 응답 분기에서 라운드를 한 번 더 돈다(턴당 1회). 성공은 `npc-cast:applied`.
- 데모/샘플 콘텐츠(`src/editor/content/*`, `src/project/defaults/dewVillageDialogue.ts`)는 저작된 게임 데이터라 건드리지 않았다.
- 테스트: `test/npcCast.test.ts`(순수 검증·세계관 패치), `test/npcCastTools.test.ts`(대기 페이지·residents·friendshipLines·castle·
  author_npc_cast), `test/npcCastSession.test.ts`(훅 성공/재킥). `aiEventPageSemantics` 의 "still greets" 케이스는 새 계약으로 바꿨다.

## 「이 세계」 캐논은 문장 3채널에 강제된다 (2026-09-04)

`worldCanonContext.worldCanonPromptSection`(「이 세계(세계관 고정)」 블록)은 메인 어시스턴트 컨텍스트의 예산 밖 고정분
(`contextBuilder.withWorldCanon`)이었지만, 정작 문장을 쓰는 3채널에는 닿지 않았다. 공유 검사
`findWorldCanonAbsenceHits`(absences 부분일치, 빈 캐논→`[]`)로 세 채널에 주입+검증을 걸었다:
- NPC 캐스트 라이터(`ai/npcCast`): `CastContext.worldCanon`(`WorldCanon | undefined`, required)에 캐논 전문 + 시스템 금지줄,
  `parseCastSheet`가 이름·역할·요약·전 라인 금지어 검사 — 히트 시 재킥. 호출부(`assistantSession.authorPendingNpcCast`)는 `project.worldCanon` 전달.
- DB AI 생성(`editor/aiDatabaseGeneration`): `buildRecordPrompt(kind, brief, names, canon?)` 시스템 주입,
  `parseGeneratedRecord(kind, raw, canon?)`가 name+원시 description 검사 — 적 스키마에 description이 없어 필터 뒤가
  아니라 **원시 응답 기준**이다. `generateDatabaseRecordWithAi`는 `project.worldCanon` 전달.
- 이벤트 Assist(`ai/eventCommandAssist`): `buildEventAssistPrompt`에 캐논 섹션, `parseAndValidate`가 text body·화자·
  선택지 질문/문구·숫자 입력 안내·여관 인사/질문·killPlayer 메시지·엔딩 제목/본문 (중첩 fork/choices/loop 포함,
  `commandBranches` 순회) 금지어 검사 — 자가수정 루프가 고친다. 비노출 필드(label 이름 등)는 검사하지 않는다.
- 셋 다 빈 캐논이면 블록도 검증도 없이 기존과 동일. 테스트: 각 파일의 "worldCanon 강제" describe.

## 마을 설계서 (2026-09-05)

author_village와 buildVillageDomain이 DB 설계서의 고정값·집 수 범위·집 재료/층수 호환성을 시공 전에 검사한다. 기본 설계서가 있으면 ID·집 수 생략이 가능하다. 상세 계약과 경계는 [마을 설계서](village-design.md).

## 저수준 이벤트 입력은 명령 위치를 검증한다 (2026-09-05)

`upsert_event`의 `event.trigger.commands` 또는 `event.pages[n].trigger.commands`는 `invalid-args`로 거부한다.
명령은 trigger와 같은 객체의 `commands`에 둔다. 검사는 입력 patch를 병합·정규화하기 전에 수행한다.
실제 JRPG 재실행에서 잘못 중첩된 transfer를 도구가 무시하고 빈 commands로 저장해 던전 귀환이 사라졌기 때문이다.
`test/toolsMapManagement.test.ts`는 두 잘못된 위치를 모두 거부하고 기존 귀환 이벤트가 그대로 남는지 검증한다.

2026-09-06 R5: `schemaShapes.ts`의 실행 명령 enum은 `COMMAND_KINDS`만 노출한다.
아이템 차감은 `{kind:"changeItem",itemId,op:"-=",amount:1}`, 스위치 대입은
`{kind:"setSwitch",switchId,value:true}`, 아이템 조건은 `{kind:"item",itemId,present:true}`,
엔딩 호출은 `{kind:"triggerEnding",endingId}`(ID 생략 시 조건 선택)다. `op`/`endingId`/`present`를
선언하며 `find_tools`도 같은 등록 스키마를 반환한다. 다형 `value`는 거짓 `type:"string"` 대신
타입 제약 없이 필드를 노출하고 kind별 boolean/number/"toggle"/변수 피연산자를 설명한다.
이는 provider의 union type 및 oneOf/anyOf 금지를 유지하기 위한 경계 표현이며, 실제 타입·필수 값은
기존 컴파일러/shape 검증기가 검사한다. `test/aiCommandSchemaContract.test.ts`는 컴파일·직렬화 보존,
잘못된 명령/누락 조건 값의 원자적 거부, 참조 조회 선행을 검증한다. 실모델 복구·플레이 증명은 별도다.

2026-09-06 R10: `upsert_event.event.pages`는 `NATIVE_EVENT_PAGE_SCHEMA`이며 SimplePage 컴파일 경로가 아니다.
대사·선택·효과는 `page.commands`에 넣고, 선택 명령은
`{kind:"choices",options:[{text:"선택",branch:[{kind:"changeItem",itemId,op:"-=",amount:1},{kind:"triggerEnding",endingId}]}]}`다.
`page.choices/lines/showText/messages/text/face` 및 `graphic.query/textureKey/characterIndex`를 제출하면
병합 전에 `invalid-args`와 네이티브 수정 JSON 예시로 원자적 거부한다. 그래픽은 `graphic.sprite:{type,id}`를 사용한다.
기존 이벤트에서 생략한 최상위 필드는 정규화도 하지 않는다. `pages`를 제출하면 배열 전체 교체이며,
제출된 페이지의 필수 필드 보완과 R5 명령 검증은 유지한다. `place_npc`/`make_villager`의 SimplePage 컴파일은 그대로다.
회귀: `test/aiNativePageContract.test.ts`는 실제 round2 출구 입력 거부, 예시 재호출, 직렬화 후 선택·열쇠 1개 차감·
기록된 epilogue·`returnToTitle`, 취소 무효과, 생략 페이지 보존과 고수준 컴파일을 검증한다. 실브라우저 완주/원격 재로드는 별도 게이트다.

2026-09-07 R14: `list_resources(kind:"charset")`와 `list_npc_graphics`는 기존 필드·사용자 라벨/태그를
유지하면서 `nativeGraphic:{sprite:{type:"bundled",id},direction:"down",pattern}`을 추가한다.
이 객체를 `upsert_event.event.pages[n].graphic`에 그대로 넣는다. `pattern`은 characterIndex가 아니라
시트 프레임이며, 기존 `charsetFrameIndex`로 계산한 슬롯 0~7의 아래방향 정지 프레임은
25,28,31,34,73,76,79,82다. 작은 pattern 값도 슬롯으로 재해석하지 않는다. 고수준 SimplePage 컴파일과
카탈로그 라벨은 바꾸지 않는다. `test/nativeGraphicDiscovery.test.ts`는 두 조회 → 네이티브 업서트 →
직렬화/재로드 → 실제 `renderTiles`의 sprite 생성 인자를 독립 프레임 표와 대조한다(8슬롯·두 행·네 방향).

2026-09-22: 라벨이 있는 차셋 칸마다 `src/assets/charsetAppearances.ts` 의 아래 방향 정지 프레임 문장이 붙는다.
`list_npc_graphics` 는 `appearance`, `list_resources(kind:"charset")` 는 `description` 으로 그대로 돌려준다.
문장에 있는 두 글자 이상 낱말은 라벨·태그보다 낮은 점수로 검색에도 걸린다. 라벨 문자열 자체는 바꾸지 않는다.

## 보물상자는 노출된 수면을 거부한다 (2026-09-05)

`place_chest`는 요청 좌표와 자동 착지 결과를 모두 검사한다. 물 판정은 현재 타일셋의
`roleCapabilities(...).terrainTag`를 사용하고, 메타가 없는 기본 칩셋에만 칩 번호 폴백을 적용한다.
통행 가능한 O 상층 다리는 허용하지만 ★ 장식은 하층 물을 가리지 않는다. 벽감의 인접 조사 예외는 유지한다.
`test/treasureChestPlacement.test.ts`가 물·다리·다른 타일셋·자동 착지를 검증한다.

## 모험 저작 완료와 재시도 (2026-09-05)

Final-artifact assessment (2026-09-06, R12): `agentVerification` adds
`evaluate_game_quality` for authored endings and repeats earlier quality checks at
completion. `AssistantSession` assesses the current draft independently of the
once-per-layer sweep, including tool/token-budget termination. Its
`completion_assessment` event and `TurnResult.completionAssessment` retain the
acceptance snapshot (including R7 field diagnostics), adventure structure/icon/
image gaps, current check results, and unresolved verification findings together.
The same combined state reaches the model before bounded repair selection and is
composed into one terminal report, never replacing one failure category with another.
Repairing one category does not reset promises/baselines or replay applied milestones.
Missing `triggerEnding` invocation requests content repair; general advisory lint
does not become a fatal gate. Static checks and persistence receipts remain distinct
from actual playthrough proof.

의도 선언의 선택적 `adventure`(village/dungeon/party/battle)는 전체 모험 저작 요청에만 붙인다. 단순 NPC 추가·질문·DB 시드 요청에 키워드로 덧붙이지 않는다. 세션은 선언을 자동 계속과 계획 교체 뒤에도 보존하고, 최종 경로 양쪽에서 `adventureCompletionProblems`를 실행한다. 구조 타일 없는 시작 마을, 도달 가능한 탐험 맵 전이·전투 연결 부재, 시작 파티/합류 부재를 보완 지시로 돌려주며 4회 뒤에도 미완성이면 완료 응답을 대체한다. 최종 쓰기 뒤 모든 맵 전체 show_map_region 조회와 저작 아이템 아이콘도 요구한다. 이것은 정적 최소 조건이며 페이지 조건·미술 완성도·재미를 증명하지 않는다. 출하 런타임과 직접 시각 검사는 별도로 한다.

place_npc는 NPC의 name을 페이지 제목과 분리해 저장한다. 이름 없는 재시도는 가까운 동명 이벤트를, 같은 명시 ID는 해당 이벤트를 재사용하며 위치·일정을 보존한다. 다른 명시 ID는 의도적 복수 배치다. 새 착용 장비는 upsert_equipment를 써야 하며 upsert_item의 레거시 장비 종류 신규 생성은 거절한다(기존 레거시 수정은 허용). 저수준 text.body의 문자형 역슬래시+n은 실제 줄바꿈으로 고치도록 거절하되 배우 이름 제어문자는 유지한다.

모험 보완 검사는 도달 가능한 보물/전투 이벤트 및 시작 맵 복귀 전이를 요구하고, 상호작용 이벤트의 타일 통행·접근을 검사한다. 던전 외형은 `list_dungeon_room_themes` → `run_dungeon_room_pipeline`로 저작하도록 안내하며 기존 맵 무단 교체는 금지한다. 이 검사는 동굴 미술을 자동 인증하지 않는다. 전체 맵 시각 조회는 반환 영역 기준으로 합산한다(1회 최대 24×24).

`set_project_settings({startActorIds})`는 system 메타데이터와 `project.session.partyActorIds` 시작 상태를 함께 갱신한다. 런타임 `startSession` 및 모험 완료 검사는 `startStateOf(project)`를 정본으로 읽는다. system만 4인으로 바꿔도 실제 플레이가 1인으로 남던 오류를 저장/재로드/새 세션 테스트로 보호한다.

NPC 고수준 commands의 `text.lines`는 실제 줄바꿈을 포함한 `text.body`로 정규화한다. 저수준 text 명령의 body 누락은 거절한다. 맵 충돌 검사는 스프라이트가 있는 NPC/상자의 막힌 바닥을 검사하며, 타일에 부착된 투명 조사 이벤트는 인접 접근을 허용한다.

선언된 adventure 계약의 도구는 `adventureToolNames`에서 실제 호출 스키마로 승격되어 첫 실행부터 노출된다. 안내문에서 언급만 하고 도메인 쿼터에 숨기는 것을 금지한다. 조건 kind 누락 오류는 실행 가능한 selfSwitch/switch 예시를 반환한다.

시각 재검증에서 장비 아이콘 누락이 발견돼 모험 완료 검사의 저작 레코드 추적을 items와 equipment로 확장했다. 두 컬렉션의 동일 ID도 따로 추적한다. 그림 없는 장비를 생성하고 완료라고 답하는 통합 회귀를 유지한다.

## 실제 이미지 입력 보존 (2026-09-07)

`scripts/lib/ohMyPiPiAiRuntime.ts`의 `openaiToContext`는 사용자 메시지의 텍스트와
`image_url` 순서를 보존한다. PNG/JPEG/WebP base64 data URL을 pi-ai의 이미지 블록으로
변환하며 바이트를 텍스트 요약으로 대체하지 않는다. 잘못된 base64, 지원하지 않는 MIME,
원격 이미지 URL과 잘못된 detail 값은 HTTP 400 입력 오류로 거부한다.

이전 구현은 `textOf`로 이미지 부분을 버렸다. HTTP 200과 그럴듯한 외형 설명만으로는
이미지를 실제로 전달했다는 증거가 아니다. `test/ohMyPiVision.bun.test.ts`가 바이트·순서,
실제 pi-ai 직렬화와 worker의 잘못된 입력 거부를 검증한다. 실제 제공자 검증에서는
서로 다른 단색 이미지가 구분되는지 먼저 확인한 뒤 원본 그림을 전달한다.
몬스터 카탈로그의 원본 해시와 관측 근거는 `src/assets/monsterCatalogReview.json` 및
`output/evidence/monster-catalog/README.md`를 참조한다.

## Physical tile passage exposure (2026-09-08)

`set_tile_passability({tilesetId?, tile, passable})` is an active native write tool
again. `V1_TILE_SUPERSEDED` no longer redirects this technical primitive to the
hidden `propose_tile_vocabulary`, whose semantic items cannot express passage.
The full `toOpenAiTools` catalog, capability index and ordinary `find_tools`
(exact name or `특정 타일 통행`) now reach the same registered setter.

This edits one tileset chip's four direction flags together, affecting every map
using that chip, not a selected map cell. It does not author vocabulary, names,
roles, groups, layers or generic metadata. Semantic teaching and superseded
painting tools remain hidden. The native setter and its existing persistent
passage metadata/provenance are unchanged: `markUserTileRuntimeMetadata` records
the passage override so reload/harness seeding cannot silently undo it. Those
native user-origin metadata flags are not a new approval or acceptance receipt.
Normal argument validation, detached dispatch, ask-mode refusal, transaction
ownership and acceptance/application checks are unchanged.

`test/tilePassabilityExposure.test.ts` covers real catalog/discovery schemas,
normal session dispatch in both directions on a three-chip fixture, unrelated
project/meta equality, native refusals and JSON/harness persistence. The offline
session fixture stops after dispatch; it neither applies to a live project nor
claims final acceptance. Real AI repair and final build/gates remain parent-owned.

## NPC 자율 이동 아키타입 추론 (2026-09-17)

`place_npc`/`make_villager`의 `movement` 생략 시 이름으로 추론한다(명시 우선).
구현: `src/editor/tools/eventTools.ts`의 `inferNpcMovementArchetype` + `resolveNpcMovement`.

- 추격/습격/매복/스토커 → `approach` (플레이어에게 다가옴)
- 상점 주인·문지기·간판·안내 + `isShopRoleNpcName` → `fixed` (대화 거점)
- 아이·행상·떠돌이·동물(개·새는 독립 단어일 때만) → `random` (배회)
- 그 외 모호 → `fixed` (오판 비용 비대칭: 통로 막힘 방지)
- 추론 결과는 `diff.warnings`에 기록 ("이동 추론 → random(배회)…") — 모델이 다음 호출에서 명시하도록 유도
- `movement` enum에 `approach` 추가 (`fixed|random|approach`)
- `place_battle_blocker`에 `fightMovement` (`fixed|random`, 생략 시 fixed) 추가 — "길을 지키는" 원형 유지 + 순찰 옵션
- `make_hunting_ground`의 `chase` 생략 시 기본값 `true`로 변경 (명시 `false` 존중) — 보이는 몬스터는 추격이 자연스러움

Acceptance 게이트 완화 (`src/ai/assistantAcceptanceEvaluation.ts`):
이전에는 `movement ≠ fixed` 이벤트 하나라도 있으면 reachability 전체를 포기
(`conditional-movement-unsupported`)해 모델이 fixed만 고르는 인센티브가 됐다.
이제는 이동형을 정적 차단자에서 제외하고, 시작 셀에 from/to가 겹칠 때만
`cell-moving-event-start` 실패. 프롬프트(`src/ai/eventPageSemantics.ts`)도
"생략 시 fixed"에서 "생략 시 아키타입 추론"으로 갱신.

Tests: `test/npcMovementInference.test.ts` (8건).
런타임 증거: `scripts/qa/runtime/npc-movement.probe.mjs` + `verify-shots/runtime-qa/npc-movement/`
(배회 NPC 4명 전원 이동 확인, before/after PNG).

런타임 증거 디렉토리 분리 (2026-09-17):
`npc-movement` 시나리오 하네스 실행과 probe 직접 실행은 같은 `verify-shots/runtime-qa/npc-movement/`를
쓰면 서로 덮어쓴다(실측). probe는 `QA_OUT_DIR=verify-shots/runtime-qa/npc-movement-probe`로 분리 실행한다.
하네스 쪽은 플레이어 고정 + NPC 배치 차이 샷 2장, probe 쪽은 스프라이트 좌표 직접 판정(results.json) + before/after PNG.

## Full RPG first-turn foundation (2026-09-19)

A request such as “중세 게임 RPG를 만들어줘” is a cross-domain authoring request.
The intent declaration now opens the world, database, system, map and event domains
even when the model's short `tools` list omits one of them. The adventure preflight
catalog includes `read_project_wiki`, `set_world_canon`, `upsert_character_profile`,
`upsert_actor`, `list_resources`, `upsert_equipment`, and `set_project_settings`.
The expected order is world canon → named character profiles → protagonist actor
appearance/loadout → database → maps/events → playable verification. `upsert_actor`
must set real `faceResourceId`, `characterResourceId`/`characterIndex`, battle graphic,
and `initialEquipment`; creating a weapon record alone does not equip it.

`set_world_canon` stores the concise world backbone (premise, era, tone, technology
ceiling, absences, and power/gods/death/money laws) as a partial merge in
`Project.worldCanon`. Full adventure declarations may opt into `world`, `characters`,
and `appearance`; the completion report then calls out missing lore, profiles, or
starting-party appearance instead of silently accepting map-only output.

## Party, actor appearance, and event-linked inventory tools (2026-09-19)

`set_party({scope:"start",actorIds})` is the narrow party facade. It validates every
actor id, rejects duplicates, writes both the authoritative `system.startActorIds`
and the current session party, and permits an explicit empty list. `scope:"session"`
only changes `session.partyActorIds`; it does not rewrite a future New Game. The
older `set_project_settings({startActorIds})` and `set_session_start({partyActorIds})`
remain compatible routes for combined settings/test setup. Runtime join/leave still
uses an event `changeParty` command; `add_companion` is only a visual follower.

`upsert_actor` now exposes the actor's shared `appearanceId` and charset
`characterIndex` (0–7) in addition to face, charset, and battle resource ids. A
shared appearance id must exist in the character appearance catalog or the write is
rejected; normalization preserves the selected slot. `delete_character_profile`
removes only `Project.characters[characterId]` and never deletes the actor or event.

`adventureCompletionProblems` treats a referenced shared appearance's face and
charset as satisfying the start-party appearance contract; a direct face/charset
pair is not required when the shared record supplies both.

## Opening, game-over, and audio discovery tools (2026-09-19)

The opening route is live through `get_opening`, `set_opening`, `edit_opening`,
`list_opening_media`, and `generate_opening_image`. `recommend_bgm` and
`get_audio_resource` are registered system tools, so the assistant can search
music by scene or mood and then inspect the full description before assigning a
`musicResourceId`. The audio tool family was previously implemented but missing
from the central registry; registration is required for model tool calls.

`create_map` / `generate_map` automatic BGM uses those same descriptions.
`recommendMapBgm` matches the map name (and `generate_map`'s theme, when the name
has no hit) against each track's title, category, tags, catalog brief, and
listening draft. A project `audioDescriptions.music` override replaces that
draft for the track. Seamless loops are still preferred, and an unmatched name
falls back to the field category instead of scanning the whole catalog.

Game-over now has an AI route as well: `get_game_over` reads `system.gameOver`,
`set_game_over` writes its title/message/button labels and background resource,
and `generate_game_over_image` creates a clean 16:9 backdrop. Generation returns
a resource id; the assistant must connect it with `set_game_over` so the image is
actually used. Background validation shares the cinematic `still` catalog and
accepts existing game-over, backdrop, title, picture, and uploaded resources.

Items and event effects already have typed routes. `set_session_start` seeds the
new-game gold/inventory state, while `upsert_item` and
`upsert_equipment` author the records; `upsert_event` commands use canonical
`changeItem`/`changeGold`/`changeParty`/`setSwitch`/`choices` branches; `place_chest`
and `place_storage_chest` package one-time loot and inventory changes; `make_villager`
and `set_shop_stock` author shop interactions; `define_quest`/`verify_quest` connect
items, switches, maps, and rewards. New RPG authoring must read the real item,
actor, and event ids before writing references, then verify the interaction with a
walkthrough rather than treating a successful tool call as runtime proof.

## 범용 이미지 에셋 생성 (2026-09-19)

`generate_image_asset`는 특정 화면에 묶이지 않은 이미지 저작 경로다. `kind`는
`picture`(아이템·소품 아이콘), `title`(타이틀 아트), `backdrop`(맵·전투 배경),
`monster`(몬스터 스프라이트) 중 하나이며, 이미지 안의 글자·로고·UI·워터마크는
금지한다. `monster`에는 구체적 외형 `tags`가 필요하며 이름·태그·설명도 몬스터
메타데이터로 함께 저장한다. 생성 결과는 자동으로 `upsert_resource`에 등록되고 반환된 `resourceId`를
`upsert_item.iconResourceId`, `upsert_enemy.monsterResourceId`,
`set_title_screen`, `set_game_over` 또는 해당 이벤트 그래픽 필드에 연결한다.
오프닝과 게임오버의 전용 생성 툴은 각각의 화면 설정과 연결 검증을 유지하고,
일반 에셋 생성은 여러 데이터베이스 레코드에서 재사용할 수 있는 리소스를 만든다.

## Feature16 combat and climate authoring tools (2026-09-21)

`upsert_skill` exposes formulas, crit, hit sequences, turn cooldowns and action profiles.
`upsert_enemy` exposes expanded conditions and conditional drops. New nested inputs
are validated before normalization: invalid formulas/condition kinds/array overflow
are rejected atomically. Partial action updates preserve omitted values; top-level
`clearActionSkill`, `clearActionFieldStatus`, `clearActionItemCost` explicitly clear.
`set_map_properties` accepts climate or clearClimate. Drop item and condition state/
switch references participate in load validation, deletion guards and switch rename.
Tests: `feature16AiToolIntegration.test.ts`; schemas: `combatAuthoringSchemas.ts`.
## 마을 시공 후 완료 계약 (2026-09-21)

`author_village`의 집 수는 기본 DB 설계서가 채울 수 있다. 고정 숲 없음 설계서에는
`forestDensity`를 넣지 않는다. `resolveVillageContract`가 평문 단일 마을 요청의 수량과
대상/bounds를 먼저 고정하고 facade와 같은 DB resolver를 쓴다.

빌더 결과의 `village.residentEventIds`는 NPC 배치 전후 이벤트 ID 차이,
`village.doorFronts`는 이번에 만든 집의 실제 문앞 좌표다. 계약 완료 검사는
이 증거로 대사와 통행을 검사하며 ID 접두사나 전체 맵의 미감 점수에 의존하지 않는다.
`residents[].lines`로 대사를 한 번에 넘기거나 같은 Agent가 `author_npc_cast`로 보충한다.
무언 주민 요청과 주민 0명은 대사를 강제하지 않는다.

`evaluate_village_look`는 미감 참고 도구로 남는다. 단일 마을 계약 경로에서는 그 점수를
필수 완료 조건으로 쓰지 않는다. 옛 explicit/team 경로의 `inspectPiVillageCompletion`과
혼동하지 않는다. 복합 작업까지 이 계약으로 전환한 것은 아니다.

공개 평가 안내는 `find_tools`로 실제 수정 도구를 찾도록 한다. `plant_tree_clusters`,
`revise_village_plan`, `run_village_pipeline`은 내부 호환용이며 Pi에서 노출·복구되지 않는다.
재시공이 필요해도 사용자 범위와 DB 설계서를 유지한 `author_village`를 사용한다.
평가를 통과하려고 고정 설정을 바꾸거나 전체 맵 재시공을 임의로 허가하지 않는다.


## 타일 참고문서 선행 조회 (2026-09-21)

[타일셋 참고문서](tileset-reference-documents.md): 프로젝트 소유의 용도별 MD·이미지, 파생 타일셋의 원본 공유, Pi/레거시 AI 전달 확인, 저장·내보내기 계약.
빈 시작 맵 전체 시공에서 예전 좌표가 고립되면 `restoreExistingTargetStart`가 검증된 새
시작점을 유지한다. 기존 콘텐츠 또는 bounds 요청은 이 예외가 아니다.


### 저장된 AI 계획 본문 조회 (2026-09-23)

present_doc로 저장한 aiDocuments를 list_ai_docs로 찾는다. 목록은 본문을 반환하지 않는다. read_ai_doc(documentId, blockIndex=0, offset=0)로 블록당 최대6000자를 읽고 nextOffset 및 blockCount까지 순회한다. markdown 원문/나머지 블록 JSON을 반환하며 실행하지 않는다. 조회는 프로젝트 불변이며 없는 ID와 잘못된 정수·범위는 오류다. 공용 타일 참고문서는 계속 read_tileset_reference를 쓴다.

### 호스트 공용 DB 참고문서 갱신 (2026-09-23)

브라우저 편집기 부팅 시 팀 인증 후 `/__oprn/shared-tile-references`를 조회한다. 서버는
호스트의 `OPRN_SHARED_CONTENT_SQLITE`(기본 XDG data/oprn/shared-content.sqlite)를 읽기 전용으로 열며
프로젝트 ID로 필터하지 않는다. GET 전용이며 팀 인증/동일 출처 검사를 기존 호스트와 공유한다.
`store.normalizeCurrentProject`의 `sharedTileReferences` 단계는 설치된 `shared_` 타일셋의
ID·타일 크기·열 수·개수·업로드 이미지 ID와 SHA256이 모두 맞을 때 참고문서 카테고리만 갱신한다.
맵·타일 픽셀·충돌·미설치 타일셋은 변경하지 않고 프로젝트 전용 카테고리는 유지한다.
외부 asset ref의 byte SHA와 인라인 dataURL의 SHA 경로를 각각 지원한다. 기하/그림이 다르면 건너뛴다.
갱신은 기존 정규화의 변경 계측·저장 경로를 따른다. 공용 DB 변경 후 프로젝트를 다시 열어야 반영되며,
진행 중인 조수 실행의 문서 판독 증거를 무효화하는 실시간 변경은 하지 않는다.
HTTP 경로가 없는 환경(현재 Electron 직접 실행 등)은 저장된 문서를 유지한다. 공유문서 자동 갱신은
현재 로컬/팀 웹 호스트 경로에서 제공하며 다른 실행 경로까지 지원했다고 보고하지 않는다.


## 실제 타일 규칙 수정 도구 노출 (2026-09-23)

`set_tile_rules`는 활성 도구다. `propose_tile_vocabulary`는 어휘 승인 제안이며 기존 타일의 priority·통행·지면 규칙을 즉시 수정하는 대체재가 아니다. V1_TILE_SUPERSEDED에 넣으면 getTool에는 존재해도 LLM 스키마에서 사라져 공용 문서의 조립 절차를 실행할 수 없다. 레이어 수정의 confirmedByUser 검사와 잠긴 항목 보호는 유지한다. 실제 요청이 레이어 정정을 승인한 경우에만 사용한다. 수정 후 홈 레이어와 실제 lower/upper 배열을 재조회하고, 적용·저장 표시만으로 성공 판정하지 않는다.


### 타일셋별 맵 의미 조회 (2026-09-23)

`get_map_region`의 물·나무·벽 상수는 합본 마을과 호환된 번들 그림에만 적용한다. 커스텀 그림에서는 실제 타일셋의 category/role/팔레트/그룹 정보를 사용하고, 물 role이 없으면 타일 번호만으로 물이라고 추측하지 않는다. ASCII 격자와 water.bounds는 동일한 판별을 쓴다. LPC 실내의 침대·가구를 기본 칩셋 번호와 겹친다는 이유로 물로 반환하던 오류를 교정했다. `isMapWaterTile(number)`는 기존 합본 마을 저작기용 숫자 함수이며 새 커스텀 타일 조회에 단독 사용하지 않는다.

## Pi 완성 맵 이미지 반환 경로 (2026-09-23)

기존 `show_map_region`의 활동 썸네일은 사용자 UI용이었다. Pi 어댑터는 배열 텍스트만 반환하여
조수가 새 맵을 봤다는 근거가 되지 않았다. `read_tileset_reference` 이미지 전달과 별개다.

`piAgentRuntime`은 이제 현재 초안 사본을 `piRenderBroker` → `render_request`로 보내고,
브라우저 `piAgent/client`가 `renderPiMapImage`로 그린 PNG를 인증된 `/v1/agent/render`로 돌려준다.
PNG는 도구 결과의 image content에 붙어 다음 모델 호출로 전달된다. 검토/읽기 전용 실행도 같은 경로다.
적용·저장 승인과 무관하며 store의 현재 맵을 바꾸지 않는다. 변하지 않은 무거운 키는 최초 요청
프로젝트를 기준으로 생략·복원한다. 초안 atlas는 명시적인 프로젝트에서 읽으며, 읽을 수 없으면
기본 칩셋으로 대신하지 않는다. 일회성 요청 ID는 완료·취소·45초 시간 초과 후 폐기된다.

현재 PNG 경로는 기존 렌더러가 정확히 지원하는 타일/이벤트에 한정한다. 다중 타일 스택,
쿼터 합성, 초안 graft는 정확한 렌더링을 보장할 때까지 명시적으로 오류를 반환한다.
일반 네이티브 LPC 오토타일 변형은 완성 타일로 그린다. 오류를 시각 검토 완료로 보고하지 않는다.
`map.image.delivered`는 도구 응답에 PNG를 포함한 증거이며 모델의 미적 판단이 옳다는 증거는 아니다.

회귀: `test/piAgentMapImages.bun.test.ts`는 실제 Agent 루프의 다음 모델 호출에서 image content를
검사한다(스크립트 모델, 외부 LLM 아님). 실제 Gemini 호출과 브라우저 전달은 별도 확인한다.

실호출 증거(작업 전용 호스트): Gemini 3.8 Flash/high가 주택08을 조회한 응답에 PNG base64
49,472자가 포함됐고 이어 색·위치·가구 관계를 설명했다. 기존 맵 배열은 불변이었다.
단, 칸막이 끝의 정상 2행 벽면을 잘못 깔린 바닥으로 오인했다. 이미지 전달 성공은
설계 이해나 비평 정확도의 보장이 아니며, 단면 배열·통행 증거와 대조해야 한다.

`tile_query`의 `tile_info`와 `palette`도 동일 선택자 규약(명시 tilesetId → 명시 mapId → startMap)을
따른다. 이 두 분기만 기존 v1 기본값에 맡겨 실내 맵 ID를 줘도 combined-town 번호를 해석하던
누락을 실제 Gemini 수정 호출에서 발견했다. `test/tileQueryBoundaries.test.ts`의 선택자 우선순위와
없는 명시 맵 회귀가 이를 잠근다. LPC 138/139 조회의 직접 전후 재현으로 정정 확인.

## 공용 LPC 자료 정리와 지역·오브젝트 조회 (2026-09-23)

호스트 `shared-content.sqlite`의 `lpc-modified-native-interior`에 실전 지침, 전체 부품 사전,
하위/상위 예제 배열을 보관한다. 긴 제작 이력은 `interior-native-history`로 분리한다.
공용 `structureKits` 20종(native32 가구18·러그2)과 `regionReferences` 2종(소형주택·민박),
실제 원본 `maps`/`previews`를 함께 등록했다. 사례는 감독 보정이 포함된 정적 배치 참고이며
독립 설계·미적 정답·출입 이벤트를 보증하지 않는다.

`sharedTileReferencesSqlite`는 공용 문서와 함께 선택적으로 공간 카탈로그를 읽는다.
`sharedSpatialReferences`는 프로젝트와 무관한 지역 목록/원본 배열을 보유하며 브라우저와
Pi worker 모두 로드한다. `read_region_reference`의 목록/페이지 조회 및 지역 UI가 같은 자료를
쓴다. 신규 프로젝트에는 누락된 공유 타일/asset을 설치한다. 기존 프로젝트에는 atlas 신원 확인 뒤
공용 예약 ID의 문서/킷만 갱신하며 tile priority/passability와 맵을 덮어쓰지 않는다.

오브젝트 공용 카드의 복사는 일반 section-kit 복사를 사용하여 하위 받침과 상위 부품,
32px 기하를 유지한다. 사용자 사본은 새 ID로 만들어 공용 갱신과 분리한다. 속성의
「조립·배치 규칙」에서 설치 면·접근·반복/마감 계약을 읽는다.

증거: `output/lpc-shared-organized-20260923/shared-proof.json`, 격리 작업트리의
`output/shared-spatial-catalog/probe.mts`. 새 프로젝트 설치, 기존 규칙/맵 불변,
두 지역의 전체 페이지 배열 일치, 가구 복사 레이어/크기 보존을 직접 확인했다.
전체 테스트 게이트와 운영 배포 확인은 별도이며 이 기록으로 대체하지 않는다.

### 공용 저작 장면 → 명시적인 복사 요청 (2026-09-25)

새 설계/직접 배치를 이 경로로 대체하지 않는다. 시스템 프롬프트와 도구 설명 모두
사용자가 저장 장면 복사/동일 재현을 명시할 때만 이 도구를 쓰도록 한다.

`sharedSceneTools.ts`의 `list_shared_scenes`(20개 페이지), `inspect_shared_scene`,
`build_shared_scene`는 설치된 공용 장소를 실제 맵으로 복사한다. `sharedSceneAuthoring.ts`가
전체 두 레이어·독립 타일셋/그림·events를 유지하고 내부 mapId를 재연결한다.
필수 revision/namespace/links로 낡은 카탈로그와 덮어쓰기를 거절한다.
`include`는 전이 목적맵 폐쇄, `omit`은 외부 전이를 가진 이벤트 전체 제외와 목록 보고,
`reject`는 외부 연결이 있으면 실패다. 모든 의존성과 착지 이동 가능성을 확인한 뒤 한 번에 적용한다.
기존 runner의 draft/commit/공간 계층 검증을 통과한다. 사용자 원본을 내려받거나 원격에 쓰지 않는다.

Pi는 find_tools로 발견한 뒤 장소/지역 자체의 `read_spatial_reference` MD/그림을 읽고 실행한다.
임의 번호를 선택하는 paint가 아니라 저장 예제를 복제하므로 타일 선택 선행 게이트는 적용하지 않는다.
후속 타일 변경은 원래 타일 참고문서 읽기 게이트가 적용된다. 반환 `tilesetIdMapping`과
사본 참고문서 첫 문서의 번호 대응을 따른다. 시작점 변경은 `setStart:true`일 때만 한다.

PAW는 기존46장소 + 학교28실 = 74장소. 도시 include는12맵, 학교 omit은4맵/외부출구1개 제외.
[사용 절차·배치 규칙·범위](../tiledata/pixel-art-world/AI-SCENE-AUTHORING.md).
자료 존재/결정론 검사/실제 모델 재현/임의 새 평면 설계를 같은 주장으로 합치지 않는다.
실제 모델7종류/21맵 생성, 별도SQLite 저장·재오픈, 실제player 전이32건의 근거와
실패한 관측기 시도는 [SCENE-AI-VERIFICATION](../tiledata/pixel-art-world/SCENE-AI-VERIFICATION.md)에 기록한다.

### 실내 직접 배치와 읽기 전용 검사 (2026-09-25)

`interiorPlacementTools.ts`의 `inspect_interior_layout`은 `interiorPlacementAudit.ts`를 호출한다.
mapId/wallMaterial/entry, 선택 rooms[{id,seed,doorways}]를 받는 read 도구다. 설치된 타일셋의
`direct-authoring/dictionary`에서 재료·단일 가구 배열·지지칸·천장47변형을 읽는다.
완성 맵 정답이나 자동 배치 코드는 없다. 조수가 직접 paint_tiles로 고친다.

천장 남단 아래 벽 전체/맵 밖 벽/미칠한 바닥/가구 조립·접지/벽걸이/엔진 통행/가구 조작면을 검사한다.
독립방은 rooms에 선언한 것만 검사한다. 문턱을 닫은 바닥 연결성(가구 무시)으로 현관 및 다른 방과
분리되는지, 폭1~2칸의 각 문이 공용 공간으로 직접 열리는지 확인한다.
모델이 독립방 선언을 빼먹거나 방 이름만 바꿔 요구조건을 축소할 수 있으므로 요청 조건과 별도로 대조한다.
도구 ok:true는 조회 성공이며 data.valid:false면 구조 오류다. valid:true도 밀도/좌석 수/미적 품질/
이벤트 성공 판정은 아니다. 128×128 이하, 단일 벽 재료, 스택 없는 맵만 지원한다.

직접 배치 관찰기는 완성 맵/장면 배열/래스터 킷/복사 도구를 제거한 빈 프로젝트에서 실제 runPiAgent를
호출한다. 65개 가구의 전체 배열은 부품 조립용이며 완성 방 좌표는 제공하지 않는다.
실패·감독 피드백·재검사·SQLite 재오픈 근거는
[직접 배치 검증](../tiledata/pixel-art-world/DIRECT-AUTHORING-VERIFICATION.md)에 분리 기록한다.

### 현대 맵의 PAW 전용 소재 선택 (2026-09-25)

`ai/modernTilesetPolicy.ts`를 일반 조수 지침과 Pi 시스템 프롬프트가 함께 쓴다.
현대/모던/modern/contemporary 맵 요청은 설치된 Pixel Art World 원본 및 공용 파생 칩셋만 쓴다.
기본 야외/마을·일반 실내 자동 생성 경로가 다른 소재를 고르게 하는 규칙보다 우선한다.
원본을 추가 배포하거나 자동 다운로드하지 않는다. 미설치이면 기존 외부 타일셋 다운로드/가져오기 UI를 안내한다.
새 설계를 완성 장면 복사로 대신하지 않는 이전 계약도 유지한다.

Pi 실행은 요청의 현대 표지+맵 용도(또는 현재 맵 스타일 변경), 기존 PAW 맵의 후속 맵 작업으로
전용 제약을 정한다. 명시적인 중세/판타지 전환은 후속 PAW 추론을 하지 않는다.
임의 자연어의 시대/부정/복합 요청을 모두 이해하는 의미 분석기는 아니다.
팀 하위 작업은 `modernTilesetOnly`를 상속하여 작업 재서술로 제약이 사라지지 않는다.
기존 forest 기본 `villageContract`는 현대 요청에서 만들지 않으며, 런타임도 낡은 계약을 적용하지 않는다.

실행 시작 때 PAW 식별자(`paw-`, `shared_paw_`, 공용 사본 이름)의 실제 설치 자산과
타일 크기/열 수/칸 수를 고정한다. 이는 기존 설치 카탈로그의 소속 판정이며 라이선스·출처 해시 검증을
새로 수행하는 보안 경계는 아니다. 설치 자체의 원본 검증은 기존 importer 계약이다.
`toolAdapter`는 각 쓰기 도구 실행 뒤 변경된 맵의 이미지/격자 규격이 이 목록에 속하는지 확인한다.
다른 칩셋의 맵 생성/타일·스택 변경/이미지 교체면 전체 도구 초안을 되돌리고 오류로 응답한다.
ID만 PAW처럼 바꿔도 시작 시 승인된 그림/격자가 아니면 통과하지 않는다. 같은 그림·격자의 사본은 허용한다.
팀 checkpoint 및 최종 병합에도 최초 팀 기준을 적용한다. 미설치이면 허용 시트0이므로 기본 칩셋 대체가 거부된다.
기존 무관한 맵과 이벤트만 수정하는 작업은 타일 변경으로 판정하지 않는다.
새 혼합 아틀라스는 기존 승인 시트가 아니므로 별도 준비/설치 없이 자동 승인하지 않는다.

이번 변경은 소재 선택 경로와 적용 차단이다. 이전 직접 배치의 식당/의원 성공·주택 실패를
새 성공으로 바꾸지 않으며, 새로운 실제 LLM 배치 실험은 하지 않았다. 전체 테스트/게이트도 실행하지 않았다.
현대 제작 턴의 초기 도구도 설치 목록/참고문서 조회→create_map/paint_tiles/실제 이미지/실내 검사로
선택한다. 다른 도구는 find_tools로 발견할 수 있지만 소재 제한은 같은 적용 경계를 통과한다.

### 실내 요구조건과 같은 실행 안의 재검사 (2026-09-25 후속)

`inspect_interior_layout.requirements`에 objects[{ids,min,max?,roomId?,side?}], roomIds,
maxArea, maxEmptySquare, southExit를 선택적으로 선언한다. 완전체 인식 결과와 실제 문턱을 닫은
바닥 성분을 대조하므로 방 이름만 붙이거나 가구 일부만 놓아서 수량을 채울 수 없다.
욕조의 남쪽 조작면도 검사한다. largestEmptySquare는 가구 없는 연속 바닥의 최대 정사각형이며
복도 폭/미학의 대용물이 아니다. 기준이 없는 요청에 임의의 밀도 상한을 강제하지 않는다.

Pi의 `interiorCompletion.ts`는 PAW 현대 실행에서 수정된 direct-authoring 사전 보유 맵을
종료 시 다시 검사하고, 검사 누락/현재 전체 그림 누락/구조 및 선언 요구조건 오류를 최대2회
같은 Agent 대화로 돌려준다. 같은 오류 반복·턴/시간 상한이면 중단하고 미완료 error를 낸다.
이 과정은 좌표를 생성하거나 대신 칠하지 않는다. 기존 중간 checkpoint/초안 저장을
트랜잭션으로 취소하는 기능은 아니므로 미완료 결과를 승인본으로 게시하면 안 된다.

최초 선언 requirements를 유지한다. 헤드리스 관찰의 `RunPiAgentOptions.interiorRequirements`는
감독자가 원문에서 만든 고정 조건으로, 모델이 인자를 생략/완화해도 완료 검사에서 유지한다.
일반 조수에서는 모델의 최초 선언이며 자연어의 모든 조건을 자동 추출·검증하는 기능은 아니다.
모델이 방 구획을 고칠 수 있도록 rooms의 seed/문턱은 최신 선언으로 갱신한다.
이 경로는 직접 배치 사전이 없는 도시·학교에 실내 검사를 억지로 적용하지 않는다.

최종 프로토콜의 `done.interiorCompletion`에 남은 맵별 문제를 실어 보낸다. 브라우저 클라이언트는
이 값이 비어 있지 않으면 done이 있어도 성공 반환하지 않는다. 팀 런타임은 해당 자식의 ledger와
agent_done을 실패로 남기고 최종 결과에 문제를 전달한다. 이는 미완료 초안을 없애는 기능이 아니다.
`pixel-art-world-interior-contract-check.mts`는 실제 과거 실패/성공 출력으로 구조·요구조건·그림
신선도를 검사하고, `pixel-art-world-completion-client-check.mts`는 합성 NDJSON으로 실패 done의
클라이언트 거부를 확인한다. 후자는 실제 모델 실행 성적이 아니다.

이미지 렌더 경로가 연결된 Pi 실행은 `inspect_interior_layout` 결과에도 현재 전체 맵 PNG를
함께 전달한다. 숫자 좌표만 보고 막힌 문을 반복 수정하지 않도록 구조 오류와 실제 모습을 같이
본다. 이것은 실제 현재 배열의 렌더이며 모형 그림이 아니다. 후속 지시는 show_map_region도 요청하지만,
완료 검사 자체는 검사 도구에 붙인 최신 전체 PNG 역시 현재 그림으로 인정한다.
## Isaiah 물 태그 판정 보완 (2026-09-24)

기존 타일셋별 물 판정을 유지하며 `tileMeta.tags`의 정확한 `water`도 읽는다. Isaiah 공용 자료는 role 대신 tags를 쓰므로 이 경로가 필요하다. 기본 합본 마을 호환 그림의 숫자 판정과 category/role/팔레트/그룹 판정은 보존한다. 별도9897 구버전 워커에서 잔디0번을 물38칸으로 보고한 재현 및 갱신 여부는 `docs/qa/saesol-three-hour-ai-authoring.md`에 기록했다.

## 전투 결과 분기의 퀘스트 완료 플래그 (2026-09-24)

`storyFlagUsage.scanCommand`는 battleProcessing의 victoryBranch/defeatBranch/escapeBranch도
재귀 순회해 읽기·쓰기 위치를 기록한다. 이 분기를 빠뜨리면 실제 전투 승리로 설정되는 플래그가
「write site 없음」으로 오인되어 define_quest의 초안 커밋이 거부되고, AI가 정상 전투 이벤트를
불필요하게 수정하려 한다. 기존 이벤트를 평탄화해 이 검사 오류에 맞추지 않는다.
`questGraph.commandAtNestedPath`도 같은 세 경로를 해석한다. 전투 결과 분기 안의 위치는
`isBattleGatedWrite`가 수동 검증으로 분류한다. write site 발견은 실제 승리·탈출·패배 증거가 아니다.
정본532 사례와 수정 전후 위치 비교는 `docs/qa/saesol-three-hour-ai-authoring.md` 요청64 이후 기록 참조.

## Monster follower graphic authoring (2026-09-25)

`define_monster_species` accepts `graphic.fieldGraphic` (the persisted
`EventPageGraphic` shape) and the legacy `fieldCharsetId`. A partial
`{species:{id,graphic:{fieldGraphic:{scale:0.5}}}}` merges recursively, preserving
sprite ID/type, direction, pattern and other species data. Scale uses the shared
character scale bounds (0.25–8); `scaleMode` accepts auto/manual. These are field
settings, not front/back battle image settings. A new field graphic needs a sprite
ID to survive species normalization; a scale-only patch requires an existing
field graphic. Field sprite IDs come from registered resources, not texture keys.

Saesol authoring request75 exposed the missing tool schema: stored species and
runtime followers supported the setting, but the AI tool rejected `fieldGraphic`
and returned a prose draft with no project change. This schema change closes that
input gap; publishing it does not itself change any canonical game data.

## 기존 서사 플래그의 설명 수정 (2026-09-25)

`declare_story_flag`의 `action:"update"`는 기존 플래그의 `description`만 수정한다.
입력은 `action`, `id`, 비어 있지 않은 `description`뿐이며 추가 필드는 거부한다.
ID·kind·targetId·questId·tags·retired·스위치 이름과 값·세션·이벤트/퀘스트 참조를 유지한다.
retired된 플래그도 설명은 고칠 수 있으나 다시 활성화하지 않는다. 없는 ID는 생성하지 않는다.

사용 예: `{action:"update",id:"sr-camp-ridge-heard",description:"새솔마을 현장 조사 완료"}`.
설명을 바꾸기 위해 retire 후 재등록하거나 rename을 쓰지 않는다. 기존 declare/rename/retire
계약은 유지한다. 새솔 저작 요청80에서 설명 교정 대신 retired=true 초안이 생성되어 폐기된
사례 때문에 추가했다. 회귀 정의: `test/storyFlags.test.ts` (이번 세션에서 실행하지 않음).
