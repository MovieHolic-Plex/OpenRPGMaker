# 조수에게 타일셋 까는 법 가르치기

> 2026-09-24 조사. 새 타일셋(번들이든 사용자 업로드든)을 **에디터 AI 조수가 제대로 깔게** 하려면
> 무엇을 넣어야 하는지 정리한 입구 문서다. 참고문서 저장·읽기 계약의 세부는
> [tileset-reference-documents.md](tileset-reference-documents.md), 레이어 판정은
> [tile-layer-policy.md](tile-layer-policy.md), 칸 크기·격자는 [tile-geometry.md](tile-geometry.md).

## 한 줄 요약

**조수는 타일셋 그림을 보지 않는다. 타일셋에 붙은 글(참고문서·칸 이름표·묶음)과 도구가 돌려주는 값만 보고 깐다.**
그래서 새 타일셋을 조수에게 가르치는 일은 곧 「글과 번호로 된 지식을 타일셋 정의에 붙이는 일」이다.
그림만 넣고 끝내면 조수는 뜻 모르는 번호를 칠한다.

## 조수가 실제로 받는 것

조수 채팅의 실행 경로는 Pi 다(`aiChatPanel` → `runPiTurn` → Bun 워커 → `runPiAgent`).
시스템 프롬프트는 `src/ai/piAgent/systemPrompt.ts` `buildPiAgentSystemPrompt` 이고
(`scripts/lib/piAgentRuntime.ts` 가 요청에 `systemPrompt` 가 없을 때 부른다), 여기에 들어가는 타일셋 정보는 이것뿐이다.

| 들어가는 것 | 위치 |
|---|---|
| 대상 맵의 id·이름·크기 (타일셋 id·칸 크기는 **없음**) | `systemPrompt.ts:16`, `:32` |
| 새 야외·마을의 기본 칩셋 이름, 「기존 맵 칩셋은 유지」 | `systemPrompt.ts:43` |
| 「타일 배치 전 참고문서를 조회·정독하라」 한 줄 | `systemPrompt.ts:47` |
| 대상 타일셋이 네 층 타일셋일 때만 「MZ 네 층 + 그림자 … stamp_layer_block」 한 줄 | `systemPrompt.ts` `fourLayerTilesetLines` (아래 「네 층 타일셋 가르치기」) |

칸 번호의 뜻, tileMeta, tileGroups, 팔레트, 참고문서 본문, 아틀라스 그림, 맵 스크린숏은 **처음부터 주지 않는다.**
옛 세션 경로의 `src/ai/contextBuilder.ts`(프리셋·승인 묶음·사용자 설명 요약)는 Pi 경로에서 쓰이지 않는다.
나머지는 전부 조수가 **도구를 불러서** 알아낸다.

| 도구 | 조수가 얻는 것 | 비고 |
|---|---|---|
| `list_tileset_references` → `read_tileset_reference` | 용도별 MD 전 페이지 + 첨부 그림(실제 이미지 입력) | 도구 목록을 줄여도 항상 노출(`piAgentRuntime.ts`) |
| `tile_query`, `get_tile_info` | 칸 이름표·설명·배치 규칙 | 비어 있으면 `Tile N` / "No tile meaning has been recorded yet." (`tilesetSemanticChecker.ts:111`) |
| 재료 이름 도구 `build_wall`·`build_roof`·`fill_region`·`lay_path`·`place_props` 등 | 「흰 집 벽」 같은 **이름표 문자열**로 묶음을 찾아 전개 | `resolveMaterialByLabel`(`src/project/tileVocabulary.ts:361`) — 이름표가 없으면 재료를 못 찾는다 |
| `paint_tiles`, `paint_road`, `stamp_structure` | **번호 직접 입력** | 뜻을 모르면 추측 번호가 된다 |
| `stamp_tile_recipe`, `inspect_tile_recipe` | 조립법(두 레이어 배열·접근칸) 원형 배치 | **forest_harmony 전용** — `publicRecipe` 가 `compileForestRecipe` 로 숲마을 아틀라스를 강제(`publicTileRecipes.ts:11`) |
| `list_tileset_objects`, `stamp_tileset_object` | 팩 프리셋 물체(가로등·자판기·문·차선) 이름·크기·종류, 원형 배치 | `learnedFrom:"pack-preset"` 킷만. 아래 「MV/MZ 팩 프리셋」 |
| `show_map_region` | 이미 칠한 **맵** 그림 (+ 맵에 있으면 2층·4층·그림자 배열) | Pi 에서 모델이 보는 유일한 렌더 그림. 타일셋 자체 그림은 아니다 |
| `stamp_layer_block`, `paint_shadow` | 네 층 배열 찍기·그림자 | 칠하기 게이트 안(`TILESET_REFERENCE_TILE_CHOOSERS`) |
| `show_tiles`, `show_tile_grid` | 모델에겐 **JSON 텍스트만** | 그림은 채팅 창의 사람에게만 그려진다 |
| `find_similar_tiles` | 시트 위치·메타 점수 | 그림 비교가 아니다 |

### 참고문서 읽기 게이트

칠하기 도구(`TILESET_REFERENCE_TILE_CHOOSERS`: paint_tiles·fill_region·build_wall·place_door·place_window·build_roof·
lay_path·place_props·arrange_rows·paint_road·stamp_structure·build_house·stamp_forest_recipe·stamp_tile_recipe,
`src/editor/tools/tilesetReferenceTools.ts:24`)는 그 타일셋에 참고문서가 있으면 **전부 읽기 전에는 거부**된다.
참고문서가 **없으면 게이트가 아예 걸리지 않는다**(`src/ai/tilesetReferenceEvidence.ts:74` `if (!groups.length) continue;`).
즉 참고문서 없는 타일셋에서 조수는 아무 제약 없이 번호를 칠한다. 게이트는 「전달」만 확인하고 이해·품질은 보장하지 않는다.

2026-10-04: `stamp_object`도 `kit:<tileset>/<kit>`의 `ai.role=terrain`이면 재질 선택으로 판정한다. `terrainStampSource`가 원본 칩셋을 해석하고, graft 대상이 다른 칩셋이어도 원본의 선택한 용도 MD 전체·이미지 전달을 요구한다. 일반 완성 소품은 기존 결정론 도구 경로를 유지한다. 실제 자동 인터뷰에서 `fill_region`의 선행 읽기 거절을 피하려고 하수도용 다리 한 칸을 산책길처럼 반복 스탬프한 우회를 막기 위한 것이다. 이 게이트는 장소별 미적 적합성을 자동으로 증명하지 않는다.

## 타일셋 종류별로 조수가 아는 정도

| | 번들 타일셋(forest_harmony·성·Slates 등) | 사용자 업로드 커스텀 |
|---|---|---|
| 칸 이름표(tileMeta) | 테마 팩·시맨틱 표가 채운다 | **없음** — `themePackForTileset` 이 번들 이미지만 받는다(`themePacks.ts:396`) |
| 묶음(tileGroups)·재료 도구 | 작동 | 이름표가 없어 재료를 못 찾는다 |
| 참고문서 | 번들이 들고 태어난다(`ensure*References`) | **0개** → 게이트 없음 |
| `generate_map` | 전용 프로필 | 「전용 맵 생성 로직이 아직 없습니다」로 실패(`mapGenerationProfiles.ts:166`) |
| 문법 프로필 | 타일셋별 | 없으면 RM2k 문법 `RM_TYPE_GRAMMAR_PROFILE` 로 떨어진다(`grammarProfiles.ts:105`) |
| 조립법 도구 | forest_harmony 만 | 사용 불가 |

업로드 경로 `makeTilesetFromUpload`(`src/editor/panels/resourceManager.ts:81`)는 칸 수만 계산하고
전부 통행 가능·하위 레이어·지형 0 으로 만든다. 메타는 아무것도 유도하지 않는다.

## 가르치는 수단 — 효과 큰 순

1. **참고문서(`referenceDocuments`) — 제일 먼저.** 붙이는 순간 게이트가 걸려 조수가 반드시 읽는다.
   용도(카테고리)를 작업 단위로 나눈다(예: 「도시 거리」「건물 외관」「병원」「사무실」).
   한 용도에 들어갈 것은 [AI-REFERENCE-CONTRACT](../tiledata/AI-REFERENCE-CONTRACT.md) 가 정한다 — 요점:
   - 0기준 칸 번호 사전(다른 칩셋 번호 섞지 않기), 칸 크기, 하위/상위 배열
   - 부품별 조립 순서·반복식·모서리 방향·최소 크기·금지 조건 (「적절히」로 끝내지 않기)
   - **완성 예제 = 두 레이어 번호 배열 + 원본 해상도 그림.** 조수는 예시를 따라 할 때 가장 잘 깐다
     (조각 조립 실험: 예시 기반 13/13 vs 규칙 생성 3/13).
   - 정상/오류 나란한 그림(잘린 뿌리·잘못된 레이어·막힌 입구)
   - 그림은 한 장에 담긴 칸이 조수가 읽을 수 있는 해상도여야 한다. 아틀라스 통째(수천 칸)는 소용없다.
2. **칸 이름표·묶음(`tileMeta`·`tileGroups`).** 「차도」「인도」「병원 타일 바닥」「회색 칸막이 벽」처럼
   사람 말 이름을 붙이면 재료 이름 도구와 `tile_query` 가 살아난다. 이어지는 바닥·길은 `autotileGroups`
   (8비트 이웃 마스크 → 칸 번호)로 묶어야 대충 칠해도 이음새가 맞는다.
3. **실행형 조립법.** 두 레이어 배열·역할·접근칸을 가진 조립법이면 조수가 원형 그대로 찍고 도구가 검사한다.
   지금은 forest_harmony 전용(`publicTileRecipes.ts`)이라, 다른 타일셋에 쓰려면 조립법 카탈로그를 타일셋별로
   받도록 도구를 넓혀야 한다. 성채·숲 마감의 `get_tile_assembly_part`/`validate_tile_assembly`
   (`src/project/tileAssemblyGuide.ts`)도 같은 방향의 선례다.
4. **결정론 파이프라인·프로필.** `author_village`·`generate_map`·실내 방 하네스처럼 코드가 칸을 고르는 경로.
   품질은 가장 안정적이지만 타일셋마다 전용 코드가 필요하다. 1~3 이 갖춰진 다음 단계다.

## 새 타일셋을 넣을 때 점검표

- [ ] 참고문서 용도 ≥1개, 각 용도에 번호 사전 + 조립 규칙 + 완성 예제(배열+그림) + 오류 예
- [ ] 자주 쓰는 칸에 tileMeta 이름표, 재료 단위 tileGroups, 이어지는 바닥·길은 autotileGroups
- [ ] 통행(passability)·홈 레이어(priority)를 픽셀·용도에서 유도해 검토 — 전부 lower/통행 기본값으로 두지 않는다
- [ ] 16px 전용 자동 보정에서 빠지는지 확인(아래 함정)
- [ ] 번들이면 AGENTS 「새 타일·타일 학습은 공용에 추가한다」 절대로 `tiledata/tilesets/<id>/` + `prepare-*-references` + `ensureBundledTilesets` 배선
- [ ] 조수에게 실제로 시켜 보고(`bun scripts/pi-agent.mts ... --task`) 결과 맵을 기준 그림과 나란히 비교

## 재배포 금지 서드파티 팩 (예: Rasak Modern)

itch.io 의 [Rasak Modern](https://rasak.itch.io/rasak-modern)처럼 「사용·수정은 되지만 재배포 금지, 링크만 허용」인 팩은
위 hard rule 대로 번들에 그림을 넣을 수 **없다.** 이때 방향:

- 저장소에는 **그림 없이** 번호·이름표·조립 규칙·예시 번호 배열만 둔다.
- 사용자가 원본을 올리면 파일명·해시로 판본을 알아보고, 에디터가 원본에서 아틀라스를 **결정적으로** 구워
  칸 번호를 고정한다(판본이 다르면 번호가 어긋나므로 해시로 막는다). 참고문서의 그림도 이때 사용자 원본에서 잘라 만든다.
- RPG Maker MV/MZ 48px 팩은 에디터가 A1~A4 오토타일 규격을 해석하지 못한다(`TilesetKind` 는 rpg2k|custom).
  굽는 단계에서 오토타일 형태를 전부 평타일로 펼쳐야 한다. 2026-09-24 실측: rpg_core 쿼터 표로 펼친 아틀라스로
  제작자 프리뷰 5장을 칸 단위로 역재구성해 픽셀 일치 98.0~99.98% 를 냈다(작업물은 저장소 밖).
- 한 칸 세 겹 이상(바닥+장식+소품+그림자)은 이제 MZ식 네 층 + 그림자로 싣는다(PR ① #1447, 설계
  `docs/superpowers/specs/2026-09-24-mz-four-layer-design.md`). 합성 칸을 따로 굽지 않는다. 조수에게 가르치는 법은
  아래 「네 층 타일셋 가르치기」. (옛 `tileStackAt` 스택 경로는 여전히 비활성 — `src/project/mapOverlayTiles.ts`.)

## 네 층 타일셋 가르치기

> 2026-09-25, 계획 `docs/superpowers/plans/2026-09-25-mz-layers-assistant.md`. RPG Maker MZ 식 팩(Rasak Fantasy 48px)처럼
> 한 칸에 바닥·바닥 장식·물체·물체 위 물체·그림자가 겹치는 타일셋. 층 번호와 맵 칸의 대응은 [tile-layer-policy.md](tile-layer-policy.md)
> 「층 번호 ↔ 맵 칸 ↔ 도구 인자」 표.

### 조수가 지금 받는 것

| 무엇 | 어디 | 내용 |
|---|---|---|
| 층 인자 | `paint_tiles`·`fill_region` `layer`, `tile_erase` `layer` | 문자열 enum `"lower"\|"upper"\|"1"\|"2"\|"3"\|"4"`(lower=1, upper=3). `tile_erase` 는 `both`·`all`·`shadow` 도. Gemini 때문에 정수 enum 은 쓰지 않는다 |
| 한 번에 여러 층 찍기 | `stamp_layer_block {mapId,x,y,layers:{"1"?,"2"?,"3"?,"4"?,shadow?}, reshape?}` | 층별 2차원 배열. -1 건드리지 않음, -2 비움. 번호가 범위 밖이거나 맵 밖 칸이면 호출 전체 거부(부분 쓰기 없음). 1·2층 자동타일 멤버는 찍은 뒤 이웃에 맞춰 다시 모양을 잡는다(`reshape:false` 면 그대로) |
| 그림자 | `paint_shadow {mapId,cells:[{x,y,quarters?,bits?}],mode?}` | 사분면 tl=1 tr=2 bl=4 br=8 |
| 층 뜻 한 문장 | `FOUR_LAYER_GUIDANCE`(`src/editor/tools/mapHelpers.ts`) — 층 인자를 받는 도구 설명이 모두 같은 문장을 쓴다 | 1층 바닥 자동타일 / 2층 바닥 장식(캐릭터 아래) / 3층 물체(★ 은 캐릭터 위) / 4층 물체 위 물체 / 그림자 |
| 보기 | `show_map_region` | 맵에 그 칸이 있을 때만 `layer2`·`layer4`·`shadow` 배열이 붙고, 그림은 1 → 2 → 그림자 → 캐릭터 아래 이벤트 → 3 → 4 순으로 그린다(`src/ai/toolImageRenderer.ts`). 헤드리스 `scripts/pi-agent.mts` 도 그림을 받는다. 턴 시작 뷰포트 그림(`mapRegionImagePayload`)도 같은 층을 싣는다 |
| 시스템 프롬프트 한 줄 | `buildPiAgentSystemPrompt`(`src/ai/piAgent/systemPrompt.ts` `fourLayerTilesetLines`) | 대상 맵의 타일셋이 **네 층 타일셋**일 때만: 「MZ 네 층 + 그림자 … 참고문서 용도를 먼저 읽고 예제 배열을 stamp_layer_block 로 그대로 찍어라, 바닥 종류는 대표 타일로 칠하면 가장자리가 저절로 잡힌다」. 판정은 ① 같은 tilesetId 맵 중 하나라도 2층·4층·그림자가 있다, 또는 ② 그 타일셋(참고문서 원본) 용도의 **첫 문서 첫 줄이 `layer-model: mz4`**. 둘 다 아니면 줄이 없다 — 옛 프로젝트 프롬프트는 글자까지 같다(`test/piAgentSystemPromptFourLayer.test.ts`) |
| 고스트·변경 집계 | `mapDelta.ts`(layer2/layer4/shadow, 사라지면 `absent`), `changeset.ts` `countTileChanges`·`tileBuffersDiffer` | 2층만 바꾼 쓰기도 `tilesChanged > 0`·재검사 대상. 고스트는 선택 층 변화 칸을 테두리로만 표시(그 층 그림은 PR ②) |

빈 맵에서도 한 줄이 붙게 하려면 표지 ②를 쓴다 — 맵에 아직 2층이 없으면 ①로는 알 수 없다.

### 네 층 팩을 가르치는 순서

1. **칸 이름표(`tileMeta`).** 자동타일 종류(kind)마다 사람 말 이름·역할(물·바닥·벽·지붕·바닥 장식)·권장 층(1 또는 2),
   물체는 이름·크기·권장 층(3/4)·통행. `A2 kind 8 shape 0` 같은 기술 이름만 두면 조수는 뜻 모를 번호를 칠한다(r0 실측).
2. **이어지는 바닥은 `autotileGroups`(8이웃).** MZ 바닥 모양 0~47·벽 0~15·폭포 0~3 을 `AUTOTILE_DIR` 비트
   (N1 E2 S4 W8 NE16 SE32 SW64 NW128, `src/project/defaults/autotileEngine.ts`) 마스크 → 칸 번호 `variantMap` 으로 싣는다.
   모양 표는 `scripts/content/rasak/mz_autotile.py` 의 사분면 표(rmmz_core.js 와 같은 순서)에서 유도한다.
   이게 있어야 조수가 대표 번호 하나로 칠해도 도구(`paint_tiles`·`fill_region`·`stamp_layer_block`)가 1·2층 가장자리를 맞춘다.
   3·4층은 다시 모양을 잡지 않는다 — B~E 물체는 찍은 번호 그대로다.
3. **참고문서 용도 = 작업 단위**(예: 늪지 / 일본 정원·성 / 절벽·폭포 숲 / 얼음 동굴 / 용암 동굴). 용도마다
   [AI-REFERENCE-CONTRACT](../tiledata/AI-REFERENCE-CONTRACT.md) 항목을 채우되 네 층용으로:
   - 첫 문서 첫 줄 `layer-model: mz4`(위 프롬프트 표지) + 네 층 규칙 + 그 팩의 층별 실측 분포
   - 번호 사전: 자동타일 종류 → 칠할 대표 번호, 물체 → 칸 배열·층
   - 조립 순서: 1층 바탕 → 2층 장식 → 3층 물체 → 4층 겹침 → 그림자
   - **완성 예제는 `stamp_layer_block` 인자 그대로의 층별 배열**(10×8 안팎 창) + 원본 해상도 그림 + 층별 분해 그림.
     조수는 예시를 베낄 때 가장 잘 깐다(조각 조립 실험 13/13 vs 3/13).
   - 정상/오류 나란한 그림: 물체를 1층에(바닥이 사라짐), 장식을 3층에(캐릭터 위로 뜸), 2층 없이 자동타일(가장자리 끊김)
4. **용도 하나는 MD ≤5페이지(페이지 약 6000자 `REFERENCE_PAGE_SIZE` — 문단·코드 블록 경계에서 끊으며 한 코드 블록은 최대 3배까지 한 페이지, `referencePageStarts`)·그림 ≤8장.** 게이트가 칠하기 전에 용도 전부를
   읽게 하므로(위 「참고문서 읽기 게이트」) 용도가 크면 첫 턴이 그만큼 무거워진다. 크면 용도를 쪼갠다.

### Rasak Fantasy 파이프라인 (저장소 밖 그림)

그림·아틀라스·맵은 저장소에 넣지 않는다(재배포 금지). 저장소에는 스크립트와 텍스트만:
`scripts/content/rasak/bake_atlas.py`(사용자 원본 → 굽기 아틀라스, `mz_autotile.py` 표로 오토타일 펼침) →
`stack_to_layers.py`·`fold_layers.py`(프리뷰 → 4층·그림자) → 조수 지식 묶음 `scripts/content/rasak/build_assistant_pack.py` +
`scripts/content/rasak/apply-assistant-pack.mts`(이름표·묶음·autotileGroups·참고문서를 로컬 연구 프로젝트에 저장; 계획 Task 6·7).
`apply` 는 저장 직전 `fuser` 로 `project.sqlite`(-wal/-shm)를 연 다른 프로세스(호스트·편집기)가 있으면 저장하지 않고 멈춘다(fuser 가 없어도 멈춘다).
팩이 소유한 것만 갈아 끼운다 — 참고문서는 팩의 용도 id, `tileGroups`·`autotileGroups` 는 `rasak_` 접두어 id. 저자가 쓴 용도·그룹은 남는다. 판본은 `tiledata/rasak-fantasy/bundles.json` sha256,
이름·번호 같은 텍스트만 `tiledata/rasak-fantasy/` 에 둔다. 작업물은 `~/third-party-assets/rasak/`.

> REFMAP 「町の外観」 프리셋과 그 타일로 깐 맵 3장의 공용 DB 게시(장소·오브젝트)는 `openwiki/refmap-town-outside.md`.

### MV/MZ 팩 프리셋 — 구현 (2026-09-24, Rasak Modern 도시 야외)

사용자가 팩 시트 여러 장을 자원 관리자(칩셋)에 **한꺼번에** 올리면 알려진 프리셋과 해시로 맞춰 타일셋 하나로 굽는다.
그림은 사용자 원본에서만 만든다. 저장소에는 이름·좌표·해시뿐이다.

**내부 브라우저로 받기(2026-09-27, 데스크톱 앱).** 자원 관리자 → 칩셋 → 「제작자 페이지」 머리줄에 프리셋마다 바로가기 버튼
(`asset-source-pack-<프리셋 id>`)이 있다. itch 페이지에서 사용자가 Download 를 누르면 `electron/main/assetBrowser.ts` 가 받고,
RAR(Rasak Modern 은 RAR5 한 파일 15MB)이면 `electron/main/rarPack.ts` 가 `node-unrar-js`(2.0.2 고정, wasm 은 `dist-electron/unrar.wasm`)로
그림만 꺼내 무압축 zip 으로 렌더러에 넘긴다. `assetSourceBrowser.ts` 는 zip 안에서 프리셋 시트(폴더/파일명)를 절반 이상 찾으면
시트 한 장 고르기 대신 `importMvPackFiles` 로 통째로 굽는다. 다운로드 상한 64MB·풀린 그림 합계 96MB. 그림은 사용자 PC 에서만 풀린다(재배포 없음).
실측: xvfb 의 실제 Electron 앱에서 바로가기 → Download → 「타일셋 추가됨: Rasak Modern · 도시 야외 — 재료 208종·물체 157개」.

| 파일 | 하는 일 |
|---|---|
| `src/project/rpgmakerMv/autotile.ts` | rpg_core 쿼터 표(FLOOR 48·WALL 16·WATERFALL 4), 이웃 마스크 → MV 모양 번호, `autotileVariantMap` |
| `src/project/rpgmakerMv/layout.ts` | 시트 목록 → 64칸 폭 아틀라스 칸 번호(결정적). **배치 규칙을 바꾸면 모든 프리셋 번호가 어긋난다** |
| `src/project/rpgmakerMv/bake.ts` | RGBA 시트 → 아틀라스 RGBA(브라우저·Node 공용). Python 판과 칸 8,696개 픽셀 동일 |
| `src/project/rpgmakerMv/packPreset.ts` · `packs/*.ts` | 프리셋 형식과 팩별 지식(시트 sha256, 오토타일 종류 이름·쓰임새, A5 평타일, 물체 좌표·종류, 까는 순서 MD) |
| `src/project/rpgmakerMv/tilesetPreset.ts` | 프리셋+원본 → `TilesetDef`: 통행·★·잠근 홈 레이어, `autotileGroups`+이름 붙은 `tileGroups`(fill_region 재료), 물체 구조물 킷(`learnedFrom:"pack-preset"`), 참고문서 1용도(MD 5쪽 + 재료·물체 견본·예시 블록 그림) |
| `src/editor/mvPackImport.ts` | 브라우저 가져오기(sha256·디코드·굽기·자산 등록). `resourceManager.ts` 가 여러 장을 모아 팩 시트 3장 이상이면 이쪽으로 보낸다 |
| `src/editor/tools/tilesetObjectTools.ts` | `list_tileset_objects` · `stamp_tileset_object`(게이트 대상). `base` = 땅에 닿는 칸, 막힌 밑칸이 옥상·외벽·물·차도 위면 거부 |
| `scripts/content/mv-pack/build-project.mts` | 헤드리스: 팩 폴더 → 프로젝트 JSON(시험용). 결과물은 저장소 밖에 둔다 |

규칙 몇 가지:
- **홈 레이어는 잠근 `tileMeta.defaultLayer`, ★ 는 `priority`.** 커스텀 타일셋은 잠긴 메타가 없으면 priority 를 홈으로 읽는다
  (`tileLayerClassification.ts`). 바닥 표시(차선)는 위층이면서 캐릭터 아래(priority lower·통행)여야 해서 둘을 갈랐다.
- **위층 오토타일**(`AutotileGroup.layer:"upper"`): MV A2 오른쪽 절반(울타리·주차선·균열)은 바닥 위 겹침이다. `paint_tiles`·`fill_region`·편집기 붓이
  위층에서 이웃을 센다(`autotileLayerView`). `fill_region` 은 재료가 upper 면 layer 를 안 줘도 위층에 깐다.
- **`fill_region` 은 칠한 재료 칸의 모양을 구조물 보호보다 먼저 맞춘다** — 벽·지붕 재료는 칠한 순간 「구조물」이라 전엔 가장자리를 영영 못 맞췄다.
- `TilesetDef.mvPack` 이 있으면 16px 하네스(`applyCustomChipsetMinimalHarness`)에서 빠진다.
- **MV 팩에서만 켜는 동작 (2026-09-25 적대적 화면 검수 후).** 내장 타일셋 결과는 그대로 두려고 `tileset.mvPack` 으로 갈랐다.
  - `fill_region`·`tile_erase` 는 칠하거나 지운 칸 둘레의 **다른 재료까지** 다시 맞춘다(`shapeAllAutotileGroupsAround`).
    MV 는 맞닿은 두 재료가 저마다 가장자리를 그린다. 보도 끝의 **연석**도 보도 재료가 차도 쪽 가장자리에 그리는 것이라,
    보도를 먼저 깔고 차도를 나중에 깔면 전엔 연석이 없었고, 흙 공터 안 잔디는 경계가 칼로 자른 직선이었다.
  - `fill_region` 의 「벽과 1칸 틈 메우기」(`expandCellsAgainstWalls`)를 끈다 — 울타리·물체도 막힌 칸이라 7×3 옥상이 울타리 쪽으로 혹처럼 자라 30칸이 됐다.
  - `AutotileGroup.outsideConnects:true` — 맵 밖을 같은 재료로 센다(RPG Maker 규칙). 맵 끝까지 깐 보도·물에 테두리가 그려지지 않는다.
  - `mvPack.plainWalls` — 창 난 벽돌 외벽 → 같은 모양의 민짜 벽돌. `stamp_tileset_object` 가 문·창·간판·차양 밑 벽을 바꾼다
    (물체 그림의 투명한 틈으로 밑 창이 비쳐 두 겹으로 보였다). 문은 차양 그늘 칸을 덮어써도 된다.
  - `stamp_tileset_object` 경고: 차선 화살표가 반대 차로(우측통행)면, 중앙선이 짝수 폭 차도·가운데가 아닌 줄이면(중앙선은 칸 한가운데에 선이 있다).
- **물체 좌표는 시트에서 이웃과 붙은 것을 조심.** 차양은 1칸짜리(1,0)와 3칸짜리(2,0)가 붙어 있어 4칸으로 묶으면 가운데 이음매가 보였다.
  칸 좌표를 새로 붙이면 한 칸 여백을 두고 잘라 본 그림으로 확인한다.
- 헤드리스 `scripts/pi-agent.mts` 는 이제 `show_map_region` 그림을 `scripts/qa-game/render.mts` 로 그려 모델에게 준다(전엔 「맵 이미지 전달 경로가 없습니다」로 실패).

헤드리스 실측(gemini-3.7-flash, 40×30, 한 번에 3~5분·도구 80~90회): 교차로 블록·강변 상점가를 요청대로 깔았다.
처음 시험에서 나온 실수 두 가지(가로등 at 을 밑칸으로 줘 옥상 위에 세움, 정지 표지판을 차도 한가운데 세움)는 도구가 거부하게 막았다.
남은 한계: 한 칸 세 겹(예: 바닥+얼룩+물체)은 두 레이어라 못 그린다(MZ 4층 작업이 풀 예정), 애니 물은 첫 프레임만, 이름 붙인 물체는 City 폴더 80개뿐.

### 건물 문법과 마을 짜임 (2026-09-25)

- **건물은 층 띠로 쌓는다**(작가 예시에서 뽑음): 옥상 1~3줄 → 창 난 외벽 한 줄 = 한 층 → 창 없는 다른 벽 1층 띠 1~2줄.
  문은 1층 맨 아래 줄, 차양은 그 윗줄(차양 줄무늬가 문 윗칸을 덮고 문 아랫칸은 차양 그늘 위). 창 난 벽 위 문·차양·창은
  `mvPack.plainWalls` 짝으로 창 없는 벽으로 바뀐다. 화풍은 일본이 아니라 서양 혼합(영어 간판·미국식 표지 + 독일식 광고 기둥) — 우측통행.
- **마을 한 장은 `build_pack_town`**(`src/editor/tools/packTownTools.ts`, 본체 `src/project/rpgmakerMv/townLayout.ts`).
  조수가 칸마다 좌표를 고르면 같은 간격 네모 건물이 빈 보도 바다에 떴고(65툴콜, 부하에서 턴마다 끊김), 도시 생성 문헌
  (Parish&Müller 2001 → SimWorld 2025, CityCraft 2024, CityGenAgent 2026)도 「LLM 은 땅 쓰임, 배치는 절차」로 수렴한다.
  순서: 길(큰길 7·골목길 5·뒷골목, 둘째 골목길은 큰길 T) → 블록 → 필지 → 건물 → 거리 물체.
  치수(1칸 ≈ 1.5m): 가게 4~6칸(가끔 7~9)·벽 맞댐·모퉁이 3~4층·이웃과 폭/층/재료 다르게·차양 65%, 가게 뒤 뒷주차 칸 선(짝수 열만 — 이웃 선이 붙으면 오토타일이 「8」로 이어진다),
  주택 필지 8~11·집 5~7·앞마당 3~5·현관길 1·진입로 2·뒷마당 울타리·텃밭, 연석→잔디 띠 1→보도,
  주택가 블록은 **필지 섞기**(2026-09-27): 칸마다 단독주택(8~10, 이웃 틈 2~3·필지 가운데) · 중층 주거 한 동(폭 ≤10) · 주차장(칸 선 + 세로 차) · 쌈지 녹지(나무·벤치)를 고르고
  같은 종류가 셋 이상 잇따르지 않는다. 예전엔 블록을 같은 높이 건물 한 줄(줄아파트·줄집)로 통째 채워 벽처럼 보였다.
  주택·중층 주거 문은 유리문(`glass_door_dark/bright`). 옛 `house_door_a/b/d` 는 Street 시트 10~13열 0~1줄 = 교통 콘이라 뺐다.
  가로수 3~7 지터(모통이·진입로·공원 입구에서 끊김)·가로등 6~10, 횡단보도는 교차로 재료로만, 맨 윗줄은 뒷마당 울타리(맵 끝 빈 띠 금지), 공원 8~16칸.
  공원(`buildPark`, r2): 공원 잔디(`parkLawn`)는 가로 띠와 다른 재료, 낮은 관목 테두리(`tallGrass`) + 보도에 닿은 변에만 입구 2~3,
  산책로는 입구→입구(사선·ㄱ·ㄹ자, 큰 공원은 2칸 폭), 큰 공원만 가끔 광장+분수, 벤치는 길 옆, 나무는 2~3그루 무리(밑동 간격·세로 쌓기 금지).
  나무 수종은 맵 전체 45% 상한. 녹지는 별도 난수 흐름(`grng`)이라 나무를 바꿔도 같은 시드의 건물 배치가 흔들리지 않는다.
  재료 이름·물체 id 는 프리셋의 `town`(`MvTownRecipe`) — 다른 팩은 recipe 를 채우면 같은 도구를 쓴다.
- **`check_town_map`**(읽기): 물체 없이 36칸 넘게 이어진 같은 바닥, 맵 끝 2줄 이상 빈 띠, 보도 25% 초과를 issues 로.
- 참고문서 「까는 순서」 0절이 「마을은 build_pack_town 부터 + 손으로 고칠 때 규칙」. 참고문서는 올릴 때 구워지므로
  `refreshMvPackGuide`(ensureBundledTilesets 에서 호출)가 이미 올린 프로젝트의 지침 글만 지금 프리셋으로 바꾼다.
- **편집기 경로의 숲마을 가로채기.** 편집기 채팅은 의도 선언이 「마을」에 author_village 를 고르면 마을 계약(author_village 외 쓰기 거부)을
  건다 — Rasak 타일셋을 문장에 적어도 68×44 숲마을(forest_harmony)이 지어졌다(헤드리스 pi-agent 는 계약이 없어 멀쩡했다).
  `src/ai/piAgent/packTownRoute.ts` 가 요청이 부른(또는 대상 맵이 쓰는) 팩 도시 타일셋을 찾으면 계약을 걸지 않고
  의도 노트를 「create_map(그 타일셋) → build_pack_town → check_town_map」 으로 바꾼다.
- 헤드리스 실측(t1, 50×40 한 문장 요청): 조수가 첫 호출로 build_pack_town → 참고문서 읽기 → check_town_map 과 화단·나무를
  번갈아 issues 0 까지. 연구 정리 원본: 세션 산출 `/tmp/town-layout-research.md`(요지는 이 절).
- **부품 보강(2026-09-26, kits 레인).** 작가 건물에 쓰였는데 이름이 없던 칸에 이름을 붙였다 —
  1줄 1층 띠(`door_row_*`, `shopfront_row_left/_row/_right` = CityShopping 0~4,8), 옥상 설비(`roof_vent`·`roof_fan`·`roof_vent_slat`·`roof_ac_large`,
  BuildingExtras 13~14,0~2), `wall_ladder`, 나무 수종(`poplar_tree`·`round_tree`·`round_tree_small`·`bush_wide`, Park), `bus_shelter`(PublicTransportation 0,6 3×3).
  좌표는 구운 아틀라스 칸과 원본 시트를 픽셀 비교(불일치 0)로 확인했다. 작가 맵의 `scene-composites(…)` 칸은 복원 아틀라스의
  합성 패널이라 팩 시트 좌표가 아니다 — 프리셋에 넣지 않는다.
  `MvTownRecipe` 의 선택 필드: `MvTownFacade.shopfrontEnds`(1×1 쇼윈도 줄 양끝), `objects.streetTrees`(거리마다 한 수종),
  `parkTrees`, `roofGear`(건물마다 0~2), `streetProps`(가게 앞 보도 가운데 줄 35%), `busStop`(큰길 남쪽 보도 한 곳). 비어 있으면 이전 동작 그대로.
- **자동차(2026-09-26, cars 레인).** 타일 시트에는 승용차가 없다 — PublicTransportation 3장은 버스·전차 차체뿐이고
  Slums 판 13~15,13~15 는 부서진 폐차 더미다. 그래서 캐릭터 시트 `Animations/Vehicles/ModernCars/!Car1.png`(2304×1152, 8색)를
  프리셋 `sheets` **맨 끝**에 물체 시트로 붙였다(앞 시트 칸 번호는 그대로 — 기존 물체 100개 칸 번호 불변 확인).
  색 블록(12×12칸)마다 가운데 정지 프레임: 가로 4×3(x4~7, 왼쪽 y3~5·오른쪽 y6~8, 아래 두 줄만 막힘), 세로 2×3(x5~6, 아래 y0~2·위 y9~11).
  `car_{red,white,blue,black,green}_{left,right,down,up}` 20개, 모두 `onRoad`. 조립 필드 `objects.carsHorizontal`·`carsVertical`.
  townLayout 배선: 가게 사이 통로(rear-lot) 세로 차, 세로 골목길 양 차선 길가 주차(서쪽 _down·동쪽 _up),
  로컬 도로 연석 쪽(북 _left·남 _right, 진입로 앞 제외), 큰길 1~2대. 교차로·그 위아래 1줄은 비운다.
  뒷마당 주차 칸은 옥상이 깊이를 채워 0~2줄뿐이라 3칸 차가 들어가지 않는다.

**마을·실내 묶음(2026-09-25).** `rasak_town`(A1~A5 City + Town·Building·Structure·Market + 울타리·정원·밭·작물·여름 나무)과
`rasak_interior`(A2_Inside·A4/A5_House + HouseInterieur·LivingRoom·Tavern·Storage + 대장간·재봉·왕실). 제작자 프리뷰가 없으므로
기준 맵은 `scripts/content/rasak/compose_examples.py`(+`_specs.py`)가 MZ 자동타일 규칙으로 조립한다(마을·광장·민가 방·주점 4장).
참고문서 용도 `town_village`·`town_city`·`interior_house`·`interior_tavern`. 시험에서 배운 것 — 조수는 예제를 **통째로 복사**하고
(방 하나를 stamp_layer_block 한 번으로 붙였다) 창을 지붕 줄에 단다. 그래서 문서에 집·방 **뼈대 배열**(작은 집·2층 집·방)과
「통째로 붙이지 않는다」, 오류 ⑦「창·문을 지붕 줄에」를 넣었다. 지원 시트 45/176 — 남은 큰 것은 Special_Buildings·Forestfolk·Dungeon.

**예제가 허접하면 조수도 허접하다(적대적 시각 QA 2026-09-25).** 첫 예제 네 장은 빈 바닥 46~60%·도시 좌우 대칭·방 하나 상자·의자 없는 식탁이었고,
조수 결과는 그보다 더 비었다(빈 바닥 50~88%, 대칭 배수 7~18). 예제를 제작자 수준으로 다시 조립하고 `scripts/content/rasak/check_examples.py`
(빈 바닥·빈 정사각형·대칭·허공, 제작자 맵으로 잰 기준)를 넘게 했다. 두 검수(구성 / 타일 칸 단위)를 따로 돌리면 서로 다른 결함을 잡는다 —
타일 검수가 엔진 결함(맵 가장자리 자동타일 = 끊김 → `AutotileGroup.edgeConnects`)과 조립기 버그(3줄 벽에서 뜨는 문)를 찾았다.
숫자만 보고 끝내지 않는다: 밀도 기준을 1칸 덤불로 채운 숲은 통과했지만 죽은 숲처럼 보였다.

**문장 규칙은 예제를 못 이긴다 — 완성 건물(2026-09-25).** Rasak 특수 건물 43채를 `structureKits`(`sb_*`)로 싣고 조리법 첫머리에
「완성 건물이 먼저」를 적었지만 조수는 예제대로 A3 조립 집만 지었다(시험 E). 마을 용도의 기준 맵을 완성 건물 마을로 바꾸자
같은 모델이 `stamp_object(kit:…)` 로 건물 넷을 찍었다(E2). 예제 배열에서 킷 칸은 -1 로 비우고 「비운 자리 = 킷 원점」 줄을 단다 —
그래야 수백 칸 배열을 조각내 옮기지 않는다. 길이 지붕으로 가던 문제는 `stamp_object` 가 킷의 입구 부위를 맵 좌표로 돌려주게 해서 고쳤다(E3).
새 도구·새 자료를 가르칠 때는 문장보다 **예제 맵을 먼저** 바꾼다.

**물체가 있어도 예제가 없으면 조수는 그 장소를 못 짓는다 — 상점·성 실내(2026-09-25).** Rasak 실내 묶음에는 대장간·재봉·왕실 물체 376개가
이름표까지 있었지만 예제 방이 민가·여관뿐이라 쓰이지 않았다. 용도 셋(`interior_smithy`·`interior_tailor`·`interior_castle`)과 예제 맵을 더하자
헤드리스 조수가 세 곳 모두 방을 나누고 방마다 맞는 가구 한 벌(화덕+풀무+모루+담금통 / 마네킹 줄+재봉 책상+베틀 / 왕좌 축+융단+서재)을 깔았다.
남은 약점은 예전과 같다 — 예제 방 구성을 거의 그대로 옮기고, 맵이 예제보다 크면 한 방을 늘려 깔개를 흩어 채운다. 성은 칩셋 A4 에 돌벽이 없어
**A5 평면 벽면 3줄**로 짓는다 — 조립기·검사기·오류 그림이 A5 막힌 벽면 그룹을 벽으로 봐야 했고, 사전 대표 번호가 성에 맞지 않아 조리법에 실제 번호를 적었다.

**새 묶음은 이름표 → 예제 → 용도 순서로 한 번에 — 던전·성곽(2026-09-26).** A-슬롯이 묶음당 하나라 던전 A4·성 A4 를 한 묶음에 못 넣어
`rasak_dungeon`·`rasak_castle` 두 묶음을 새로 만들었다. 기존 연구 프로젝트에는 `apply-assistant-pack.mts add` 로 타일셋만 더하고(다시 열어 확인), 그 뒤 팩 `apply --example-maps`.
이름표를 서브에이전트에 나눠 맡길 때 그림 첨부가 비어 오는 세션이 있다 — 첫 단계에서 그림이 보이는지 확인하게 하고, 안 보이면 지어내지 말고 멈추게 한다(Ruins 두 장이 그랬다).
참고문서 용도 하나는 그림 8장이 한도라 예제 창은 넷 이하로 둔다.

**문서·예제만으로는 전체 배치가 옮겨지지 않는다 → 끝에서 한 번 수리 권고(2026-09-25).** 예제를 고친 뒤에도 조수 마을은 빈 바닥 44%였다.
Pi 런타임(`scripts/lib/piAgentRuntime.ts`)은 모델이 끝났다고 할 때 `src/ai/piAgent/layoutQuality.ts` 로 이번 실행이 1층을 25% 넘게 칠한 맵
(새 맵 포함, 마을 계약 맵 제외, 150칸·바닥 40칸 미만 제외)을 잰다. 정의·한도는 `check_examples.py` 와 같다(빈 바닥 ≤30%·빈 정사각형 ≤5·대칭 ≤2.2).
넘으면 가장 빈 6×6 창 좌표와 함께 **수리 프롬프트를 한 번** 보낸다. 거부·되돌리기는 없고, 두 번째 결과는 `execution_status layout_quality` 로 알리기만 한다.
헤드리스 D4(같은 프로젝트·과제): 마을 빈 바닥 58→44%, 도시 38%→통과, 민가 빈 바닥 38%→통과(대칭 5.2→4.8, 식탁 둘레 의자처럼 원래 대칭인 덩이가 끌어올린다).
같은 실행에 **무변화 반복 차단**(`src/ai/piAgent/repeatBreaker.ts`)도 붙였다 — 키 순서만 바꾼 같은 호출이 맵을 안 바꾸면 3번째에 한 번 일러 주고 12번째에 멈춘다
(실측: stamp_layer_block 같은 칸 137번 → 시간 상한 사망).

## 알려진 함정

- **16px 표가 48px 업로드를 건드린다.** `ensureTilesetHarnesses` → `applyCustomChipsetMinimalHarness`
  (`src/project/tilesetHarness/combinedTown.ts`)가 합본 마을이 아닌 모든 타일셋(번들 성·LPC 가구·`mvPack` 프리셋만 예외)에
  RM2k3 투명 칩 번호표 `isTransparentChipsetTile` 로 `priority="upper"` 를 강제한다. 다른 규격의 업로드에선 엉뚱한 칸이 상위로 간다.
- **참고문서가 없으면 시스템 프롬프트의 「참고문서 읽어라」가 빈 목록만 돌려준다** — 조수는 그대로 번호를 칠한다.
- **`show_tiles` 그림은 조수가 못 본다.** 조수에게 칸 모양을 보여 주려면 참고문서 그림으로 넣는다.
- **`generate_map` 은 프로필 없는 타일셋에서 실패**하고, 문법 프로필은 RM2k 로 조용히 떨어진다.
- 새 칠하기 도구를 추가하면 `TILESET_REFERENCE_TILE_CHOOSERS` 목록에도 넣어야 게이트가 걸린다.

## 강제 장치 (이 문서를 안 읽어도 걸리는 것)

위키는 LLM 이 반드시 읽는다는 보장이 없다. 그래서 핵심 두 가지는 테스트가 막는다 — `test/tilesetTeachingGuards.test.ts`:

- **칠하기 도구가 게이트 밖에 있으면 실패.** `mapId` 와 칸 선택 인자(tile·tiles·tileId(s)·material(s)·recipeId·presetId·paletteRole·template)를
  함께 받는 쓰기 도구(objectId·kitId 포함)는 `TILESET_REFERENCE_TILE_CHOOSERS` 에 있거나, 코드가 칸을 고르는 도구 목록 `CODE_PICKS_TILES`
  (지금 author_village·place_concept·place_storage_chest)에 있어야 한다. 게이트 목록의 이름 오타·삭제도 잡는다.
- **새 번들 타일셋에 참고문서가 없으면 실패.** 2026-09-24 기준 참고문서 없는 번들 16개는 `BUNDLED_WITHOUT_REFERENCES` 에
  적어 두었고, 이 목록은 **줄어들기만** 한다(참고문서가 생기면 목록에서 빼라고 실패한다).

그리고 Claude Code 가 `AGENTS.md` 를 자동으로 읽도록 저장소 루트 `CLAUDE.md` 가 한 줄짜리 가져오기(골뱅이 + AGENTS.md)로 불러온다
(Claude Code 는 `CLAUDE.md` 만 자동 로드한다. Codex 는 `AGENTS.md` 를 직접 읽는다).
`tilesetReferenceTools.ts` 머리 주석도 이 문서를 가리킨다.

## 칩셋 계열 규칙 (2026-09-25 사용자 결정)

사용자 말: 「지금 보고 있는 칩에서 파생된 걸 쓰던가(easyrpg 계열이면 easyrpg), 타일이 달라지는 경우에는 사용자에게 말해야 한다 —
견본까지 보여 줘야 한다.」 그래서 조수는 **사용자가 보고 있는 맵과 같은 계열**로만 맵을 만들고 칩셋을 바꾼다.

- **계열 판정** `src/project/tilesetFamily.ts` `tilesetFamily(project, tilesetId)` — 순서: (1) `TilesetDef.family`(선택 문자열, 예
  `"rasak-fantasy"`) (2) `referenceSourceTilesetId` 를 따라 뿌리로 가서 다시 판정 (3) 업로드 칩셋이고 family 가 없으면 `uploaded:<뿌리 id>`
  (4) 번들은 `tilesetArtStyle()` 값(`easyrpg`·`castle`·`slates`·`lpc`·`modern`·`oga`·`scarloxy`·`other`; forest_harmony·기후 시트·tibo 는
  easyrpg). 없는 id 는 `unknown:<id>`. 사람용 이름은 `tilesetFamilyLabel`, 같은 계열 목록은 `sameFamilyTilesets`.
  업로드 팩 여러 장을 한 계열로 묶으려면 각 타일셋에 같은 `family` 를 적는다(Rasak 묶음은 `rasak-fantasy`).
- **실행기 검사** `toolRunner.rejectTilesetFamilyChange` — 기준 = `ctx.currentMapId` 맵의 계열, 대상 = 이번 호출로 새로 생긴 맵 +
  `tilesetId` 가 바뀐 맵. 계열이 다르고 `ctx.approvedTilesetFamilies` 에도 없으면 `tileset-family-change` 로 거부(draft 버림).
  메시지는 같은 계열 후보(최대 8개)를 주고 「후보를 tilesetId 로 다시 불러라(못 받는 도구면 create_map(tilesetId=후보) 후 칠하기 도구) ·
  없으면 ask_tileset_change 로 묻고 턴을 끝내라」고 지시한다. `currentMapId` 가 없으면(옛 호출자·MCP·헤드리스 `--current` 없음) 검사하지 않는다.
  `allowsTilesetChange` 도구(`revert_last_edit`·`reset_project`)와 읽기 도구는 빠지고, dryRun 은 같은 검사를 탄다.
  업로드 바꿔치기 검사(`uploaded-tileset-replaced`)는 currentMapId 없이도 도는 안전망으로 그대로 있다.
- **create_map 기본 칩셋**: `tilesetId` 없이 불리면 도구 기본값(숲마을 `defaultOutdoorTilesetId`)이 지금 보는 맵과 **다른 계열일 때만**
  실행기가 지금 보는 맵의 `tilesetId` 를 넣는다(`ToolDefinition.defaultTilesetId`, create_map 만 켬). 같은 계열이면 도구 기본값을 둔다 —
  EasyRPG 실내를 보며 만든 새 야외 맵이 실내 칩셋이 되지 않게(결정 기록: 규칙 1 을 「같은 계열」로 읽었다). 업로드 칩셋은
  `isCombinedTownCompatibleTileset` 이 아니라 빈 칸으로 채워진다(없는 번호를 깔지 않는다). generate_map·던전/실내 파이프라인·성 시공기처럼
  EasyRPG 번호를 가정하는 도구에는 주입하지 않는다 — 계열 검사가 막는다.
- **묻기** `ask_tileset_change{toTilesetId, reason, purpose?, mapId?}`(읽기, core 로 늘 노출) — 실행기가 비어 있는 `mapId` 를 지금 보는 맵으로
  채운다(`ToolDefinition.fillsCurrentMapId`; `run(draft,args)` 가 ctx 를 못 받아서 고른 가장 작은 길). 같은 계열이면 `tileset-same-family` 로
  거부한다. 결과 `data.kind:"tileset-change-question"`, 요약은 「답을 기다리며 이 턴을 끝내라」.
- **질문 카드** `src/editor/panels/aiTilesetChangeCard.ts` — Pi 턴 이벤트에서 성공한 `ask_tileset_change` 를 잡아(`tilesetQuestionFromEvent`,
  팀 `agent_event` 포장도 푼다) 턴이 끝난 뒤 대화 끝에 붙인다. 왼쪽 「지금」 = 지금 맵 가운데 최대 16×10칸을 `drawMapTileLayers` 로 그린 것,
  오른쪽 「바뀐 뒤」 = 대상 칩셋 참고문서 그림(purpose 가 맞는 용도, 없으면 그림 있는 첫 용도의 첫 그림), 없으면 아틀라스 앞 12×8칸.
  「이 타일로 바꿔도 좋아요」 → 패널 대화 상태 `approvedTilesetFamilies` 에 toFamily 추가 + `[사용자 승인] 칩셋 계열 변경 허용: … 원래 요청을 이어서 하라.`
  전송, 「아니요, 지금 타일로」 → `[사용자 거절] … 계열 안에서만 만들어라 …` 전송. 승인 목록은 새 대화에서 비운다.
- **ctx 가 받는 곳**: Pi 요청 `currentMapId`·`approvedTilesetFamilies`(`protocol.ts`) → 워커 `runPiAgent` 가 도구 ctx 에 싣는다(팀 레인은 요청을 펼쳐 그대로 받는다).
  채팅 세션은 `AssistantSession.toolContext` 의 게터가 `contextOptions.getCurrentMapId`·`getApprovedTilesetFamilies` 를 매 호출 읽는다.
- **헤드리스**: `bun scripts/pi-agent.mts --current <mapId> --approve-tileset-family <계열>`(반복 가능). `--current` 가 없으면 계열 검사가 꺼진다.
- 프롬프트: `promptPolicies.TILESET_FAMILY_POLICY_LINE`(채팅·Pi 공통 한 줄). 회귀: `test/tilesetFamily.test.ts`·`test/tilesetFamilyGuard.test.ts`·
  `test/aiTilesetChangeCard.test.ts`.

## 문서의 번호가 새 프로젝트에 있어야 한다 (2026-09-25)

조수 시험에서 문서대로 칠한 번호가 새 프로젝트에 없었다 — 숲마을 시트는 2550칸인데 장소 문서는 2550~2759(굽이숲 수관·절벽·계단·
폭포·다리·배·말뚝·생활 소품·판타지 폐성)를 쓰고, 던전 문서는 새 프로젝트에 없는 `oprn_dungeon_*` 타일셋으로 그렸다.

- **forest_harmony 공용 뒤쪽 칸**: `src/project/defaults/forestHarmonyExtension.ts` 가 새 프로젝트(번들 생성 경로)와 옛 프로젝트
  (`ensureBundledTilesets`, 로드 때)에 2550~2759 이식·칸 규칙·굽이숲 그룹·항구 조각 그룹·생활 소품 킷 19종을 붙인다. 끝 뒤 칸과
  빈 칸(원본 시트 밖, 이식 없음)만 쓰고, 그 자리에 다른 이식(생성 건물 등)이 있는 프로젝트는 건드리지 않는다.
  원본 `src/assets/forestHarmonyVillageExtension.json` ← `node scripts/content/extract-forest-harmony-extension.mjs`
  (너울목 + 판타지 폐성 내려받기). `createForestHarmonyTileset()` 자체는 원본 2550칸 그대로다(테스트 계약).
- **던전 재칠 시트**: `src/project/defaults/dungeonSheetTilesets.ts` 의 `ensureDocumentedTileset` 이 `create_map`·`set_map_properties`
  ·`import_region_reference` 에서 처음 쓸 때 `oprn_dungeon_cave|stone|desert|sea|lair` 를 프로젝트의 `easyrpg_chipset_dungeon`
  바탕으로 만든다(칸 번호 같음, 뒤 30칸 계단·보물상자 이식, 문서는 `referenceSourceTilesetId` 로 원본과 공유).
  원본 `src/assets/dungeonSheetTilesets.json` ← `node scripts/content/extract-dungeon-sheet-tilesets.mjs`.
- **`stamp_forest_recipe`** 는 원본 칸(0~2549)의 이식만 비교한다 — 전에는 칸 수가 2550이 아니면 번들 원본도 「파생판」으로 거부했다.
- 새 문서가 새 칸 번호를 쓰면 위 두 JSON 을 다시 뽑아 번들한다. 기후 시트(3030칸, 고목 2880~)는 이미 구운 시트라 해당 없음.

## 몬스터 마을 부품 (scarloxy_chipset_monster_town_kit, 2026-09-28)

포켓몬풍 게임의 마을·도로에 Scarloxy 팩에 없는 부품(도구 상점·연구소·동굴 입구·조우 풀숲·흰 울타리·풀밭 턱·나무 다리·
표지판·우체통·벤치·화단·가로등·베는 나무·밀 바위·상자)을 더한 960칸 시트다.

- **한 장인 이유**: 맵 하나는 타일셋 하나만 쓴다. 위 480칸(0~479)을 초원 마을 시트 그대로 두고 아래 480칸에 부품을 붙여,
  잔디·집·센터와 새 부품을 한 맵에 깐다(합본 마을 + 레트로 월드맵과 같은 방식). 위 반쪽 번호는 `scarloxy_chipset_grassland` 와 같다.
- **그림**: 이미지 생성 모델로 Scarloxy 집·센터를 화풍 기준으로 그렸다(생성 자산, 팩 원본 아님 — `public/assets/ATTRIBUTION.md`).
  원본 `tiledata/monster-town-kit/raw/` → `python3 scripts/content/build-monster-town-kit.py` → 시트 + `src/assets/monsterTownKitManifest.json`.
- **칸 규칙**: `scarloxyPack.ts` 의 `MONSTER_TOWN_KIT_LABELS` 가 부품마다 그룹 하나를 만든다. 전부 3층(가장자리 투명). 풀숲·턱·다리는 통행 가능.
  조우는 타일이 아니라 맵 `encounterTable` 의 `conditions.region` 으로 풀숲 사각형에만 건다. 한 방향 턱은 칸마다 점프 playerTouch 이벤트.
- **참고문서**: `node scripts/content/prepare-monster-town-kit-references.mjs` → `src/assets/monsterTownKitReferences.json`
  (칸 사전·조립 순서·완성 예제 전체 배열, 실제 타일로 합성한 정상/오류 그림 `public/assets/monster-town-kit/references/`).
  완성 예제 배열은 데모 맵 덤프가 있을 때만 들어간다 — 먼저 `node_modules/.bin/vite-node --root . scripts/content/dump-pokemon-demo-maps.mts`.
  `ensureMonsterTownKitReferences` 가 새 프로젝트와 로드 보정 양쪽에서 심는다.
  출하 player 확인: `vite-node --root . scripts/qa/runtime/monster-town-kit-fixture.mts` 후 `npm run qa:runtime -- --scenario monster-town-kit`.
- **데모**: `createScarloxyPokemonDemoProject` 의 새싹 마을·초원 1번 길이 이 시트로 그려진다. 이미 저장된 데모 맵은 바꾸지 않는다(저작 콘텐츠).
- **없는 것**: 동굴·체육관 내부, 바다·해변, 다리 난간. 실내는 `easyrpg_chipset_interior`, 동굴 맵은 `easyrpg_chipset_dungeon`.

## 몬스터 실내 (scarloxy_chipset_monster_interior, 2026-09-28)

포켓몬풍 게임의 건물 안(회복 센터·도구 상점·주인공 집·연구소)을 Scarloxy 화풍으로 까는 480칸 시트다.
`scarloxy_chipset_indoor` 는 타일 정렬 아틀라스가 아니라서(문·창이 칸 경계를 가로지른다) 벽·바닥 런을 만들 수 없었다.

- **그림**: 바닥(나무 마루·흰 타일)·민트/라벤더 벽 색·틀 규칙(검은 바깥 + 회색 선 + 흰 띠 3px)은 Scarloxy 실내 원본을
  원래 해상도(1/4)로 되돌려 떴다. 카펫·깔개·문 매트·크림 벽은 같은 팔레트의 손 도트. 가구·벽 장식·계단은 생성 자산이다
  (`public/assets/ATTRIBUTION.md` 「Generated monster interior」). 원본 `tiledata/pkmn-interior/raw/` →
  `python3 scripts/content/build-monster-interior.py` → 시트 + `src/assets/monsterInteriorManifest.json`(블록 + 이름 붙은 한 칸).
- **층 규칙**: 바닥·깔개·문 매트·계단·벽·틀은 불투명 1층, 가구·벽 장식은 3층. **문 매트와 계단은 밟는 칸이라 1층**이다 —
  3층 ○ 칸은 ★ 로 판정돼 캐릭터 위에 그려진다(`src/player/characterDepth.ts`). 그래서 매트는 마루용·타일용으로 바닥을 미리 합성해 두었다.
- **칸 규칙**: `scarloxyPack.ts` 의 `MONSTER_INTERIOR_LABELS` 가 블록마다 그룹을 만든다(벽 틀 바깥·안쪽은 한 그룹, 문 매트는 바닥별 한 그룹).
  `mapGenerationProfiles` 는 `rooms` 라서 `generate_map` 은 개념 시공으로 돌려보낸다.
- **참고문서**: `node scripts/content/prepare-monster-interior-references.mjs` → `src/assets/monsterInteriorReferences.json`.
  스크립트가 방 네 개를 조립하고 구조 검사(틀 방향·층·블록 완결성·벽 장식 위치·문 매트에서 조사 앞칸까지 도보 연결)를 돌린다.
  정답 방이 오류를 내거나 변조 방 다섯 개가 기대 코드를 안 내면 실패로 끝난다. 그림은 `public/assets/monster-interior/references/`.
  `ensureMonsterInteriorReferences` 가 새 프로젝트와 로드 보정 양쪽에서 심는다.
- **이벤트 자리**: 카운터 너머 말 걸기는 엔진에 없으므로 회복·상점 조사 이벤트는 카운터 아랫줄 가운데 칸 자체에 둔다.
  스타터는 받침대 아랫줄 칸마다 하나. 출구는 문 매트 칸의 밟기 이벤트, 들어올 때 도착 칸은 매트 한 칸 위.
- **데모**: `scarloxyPokemonInteriors.ts` 의 기존 실내 3종은 그대로 `easyrpg_chipset_interior` 를 쓴다(저작 콘텐츠).
- **없는 것**: 계단 난간, 실내 쪽 문짝 그림, 창밖 풍경, 체육관·동굴 내부.

- **없는 것**: 동굴 내부, 다리 난간. 체육관 내부·해변은 아래 `scarloxy_chipset_monster_gym_coast`. 실내는 `easyrpg_chipset_interior`, 동굴 맵은 `easyrpg_chipset_dungeon`.

## 몬스터 체육관·해변 부품 (scarloxy_chipset_monster_gym_coast, 2026-09-28)

포켓몬풍 게임의 체육관 내부(풀·불·물 속성 바닥·벽·문장 벽·천장 테두리·관장 단상·배지 조각상·화분·화로·분수대·트레이너 위치 표시·바닥 스위치·차단기·입구 매트)와
해변·항구(젖은 모래·해안 파도 테두리·모래 경계·부두 판자·부두 앞면 말뚝·등대·나룻배·계류 기둥·부표·밧줄·야자 덤불·야자열매·파라솔·조개·불가사리·바다 바위·유목)를 더한 960칸 시트다.

- **한 장인 이유**: 위 480칸(0~479)을 Scarloxy 사막/설원 시트 그대로 두고 아래 480칸에 부품을 붙였다. 모래 34·바다 204·야자·아레나 외관(체육관 바깥)과
  새 부품을 한 맵에 깐다. 위 반쪽 번호는 `scarloxy_chipset_wilds` 와 같다.
- **그림**: 바닥·벽·단상·소품은 이미지 생성 모델 출력(`tiledata/pkmn-gym-coast/raw/`, 생성 자산 — `public/assets/ATTRIBUTION.md`)을
  `python3 scripts/content/build-monster-gym-coast.py` 가 잘라 16px 로 줄인다. **이어 깔리는 칸은 코드로 합성한다** —
  젖은 모래·해안 파도 3×3+안모서리·모래 경계 3×3+안모서리는 위 반쪽의 실제 모래 34·바다 204 를 좌표 mod 16 으로 샘플링해서 그 칸들과 이음새가 정확히 맞고,
  체육관 천장 8칸도 합성이다. 벽 기둥은 원본 가운데 한 줄을 늘려 가로 반복이 이어지게 했다.
- **칸 규칙**: 층·통행은 매니페스트 블록이 들고 있다(`layer`·`passage`·`overRows`·`openCells`). `scarloxyPack.ts` 의 `monsterGymCoastGroupSeeds` 가
  블록마다 그룹 하나, 그리고 통행이 다른 부분을 별도 그룹으로 낸다: 조각상·화분·화로·파라솔의 윗줄 「… 머리」(○), 단상 가운데 아래 「… 계단」(○),
  해안 3×3 가운데 「… 가운데」(○). 한 그룹은 통행값이 하나라서 섞으면 머리 칸이 벽이 된다.
  1층 = 바닥·벽·천장·부두·모래·해안(불투명), 3층 = 단상·조각상·표시·퍼즐·항구·해변 소품(투명 가장자리).
- **이어 깔기 문법**: 해안·모래는 모서리 재료(sea / wet / dry) 조합으로 칸을 고른다. sea 와 dry 는 한 칸에서 만나지 못해 사이에 wet 이 한 줄 이상 있어야 하고,
  대각 조합 칸은 없다(해안선은 줄마다 ±1). 표는 참고문서 「칸 사전 · 모서리 재료」.
- **참고문서**: `node scripts/content/prepare-monster-gym-coast-references.mjs` → `src/assets/monsterGymCoastReferences.json`
  (칸 사전·조립 순서·풀 체육관 14×15·해변과 부두 24×16 전체 배열·자동 구조 검사). 예제는 스크립트가 조립하고 바로 구조 검사
  (E_BLOCK_CUT · E_WRONG_LAYER · E_LOWER_EMPTY · E_EDGE_MISMATCH · E_UNREACHABLE · E_PUZZLE_BYPASS)를 통과해야 문서를 쓴다. 정상/오류 그림 4쌍은 예제를 실제로 변조해 만든다.
  그림 렌더러는 `scripts/content/render-monster-gym-coast-references.py`, 출력 `public/assets/monster-gym-coast/references/`.
  `ensureMonsterGymCoastReferences` 가 새 프로젝트와 로드 보정 양쪽에서 심는다.
- **퍼즐 배선**: 스위치 칸 playerTouch 이벤트가 `changeTile`(layer upper)로 스위치 → 켜짐, 차단기 → 열림 칸을 바꾼다. 예제 문서에 좌표·타일 번호가 있다.
- **없는 것**: 파도 애니메이션(해안 조각은 정지), 체육관 외벽(바깥은 위 반쪽 아레나 7×7), 실내 계단, 얼음·바위 속성 체육관, 배 갑판, 편집기 저작 데모 맵(예제 배열은 문서에만 있다).

- **없는 것**: 동굴·체육관 내부, 바다·해변, 다리 난간. 실내는 `easyrpg_chipset_interior`, 동굴 맵은 아래 「몬스터 동굴」(`scarloxy_chipset_monster_cave`).

## 몬스터 동굴 (scarloxy_chipset_monster_cave, 2026-09-28)

포켓몬풍 게임의 동굴 맵용 480칸 한 장이다. 바위 벽·고지대·동굴 물·자갈 47칸 블롭 네 세트, 절벽 앞면(2줄),
오르는 돌계단·사다리(오르기)·사다리 구멍(내려가기)·내려가는 계단·어두운 굴·밝은 출구, 흙 위에 구운 바닥 장식(물웅덩이·균열·빛 이끼·반짝이 2프레임),
3층 소품(석순 2종·밀 바위·깨는 바위·광석·수정·돌무더기)이 들어 있다.

- **그림**: 이미지 생성 모델로 Scarloxy 절벽 링·바위를 화풍 기준으로 그렸다(생성 자산, 팩 원본 아님 — `public/assets/ATTRIBUTION.md`).
  원본 `tiledata/pkmn-cave/raw/`(이음매 없는 견본 6장·절벽 앞면 띠·입구류·소품·작은 장식) → `python3 scripts/content/build-monster-cave.py`
  → `public/assets/monster-cave/monster-cave.png` + `src/assets/monsterCaveManifest.json`.
- **가장자리는 47칸 블롭**(3×3 아님): 견본 질감에서 모양마다 칸을 픽셀 합성한다(열린 변은 흙 띠·1px 외곽선·북쪽 밝은 테).
  솟은 세트(벽·고지대)는 남쪽 띠가 없고 그 아래 두 줄에 절벽 앞면을 따로 깐다. 대각 비트는 양옆 직교가 모두 이어졌을 때만 남긴다.
  `monsterCaveAutotiles.ts` 가 네 세트를 8방 오토타일 그룹으로 등록한다(몸통 156·164·172·336 로 칠하면 모양이 잡힌다). 벽·고지대는 앞면 줄 칸을 이웃으로 본다.
- **칸 규칙**: `scarloxyPack.ts` 의 `MONSTER_CAVE_LABELS`. 블록 하나에 통행이 섞이면(고지대 테두리 ×, 사다리·굴 윗칸 ×, 큰 석순 윗칸 ★) 통행 값별 그룹 두 개로 가른다 —
  팩 그룹 계약이 칸 통행을 적는 유일한 경로다. 바닥 장식은 **흙에 구운 불투명 1층 칸**이다. 투명한 채 3층 ○ 로 두면 ★ 이 되어 발을 덮는다.
- **참고문서**: `node scripts/content/prepare-monster-cave-references.mjs` → `src/assets/monsterCaveReferences.json`
  (칸 사전·47칸 마스크 표 네 세트·조립 순서·완성 예제 24×20 전체 배열·변조 오류 그림 4쌍, 그림 `public/assets/monster-cave/references/`).
  예제는 글자 배치에서 엔진 규칙으로 배열을 계산하고, 구조 검사(`checkCave`: 블롭 모양·앞면 순서·층·잘린 소품)와 입구→계단·굴·사다리 도달 검사를 통과해야 저장된다.
  변조 그림은 같은 검사가 오류 코드를 내지 않으면 생성이 실패한다. `ensureMonsterCaveReferences` 가 새 프로젝트와 로드 보정 양쪽에서 심는다.
- **생성 프로필**: `generate_map` 은 dungeon 레이아웃으로 흙 24·잔돌 25·벽 몸통 156·자갈 336 만 칠한다(가장자리·앞면은 그리지 않는다).
- **없는 것**: 나무 다리·난간, 동굴 안 건물, 얼음·용암 동굴, 비밀 문, 폭포. 바깥 입구 그림은 몬스터 마을 부품의 cave-entrance.

- **쿼터 합성 제외(2026-09-28)**: Scarloxy 시트(grassland·wilds 와 그 위 반쪽을 쓰는 monster_town_kit·monster_gym_coast)는
  `COMBINED_TOWN_WATER_BLOCK_TEXTURES`(`src/editor/chipsetComposition.ts`)에서 뺐다. 0/30/60/90 자리가 물이 아니라 모래·절벽 조각이라,
  모래 34(수로 프레임 번호)·모래 패치 0~2/30~32 가 호수·수로 쿼터로 합성돼 출하 player 에서 세로 줄무늬로 보였다.
  이 네 칩셋 전부를 한 게임에서 쓰는 예는 `openwiki/pokemon-full-game.md`.


