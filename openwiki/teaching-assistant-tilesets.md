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
| 대상 맵의 id·이름·크기 (타일셋 id·칸 크기는 **없음**) | `systemPrompt.ts:14`, `:30` |
| 새 야외·마을의 기본 칩셋 이름, 「기존 맵 칩셋은 유지」 | `systemPrompt.ts:41` |
| 「타일 배치 전 참고문서를 조회·정독하라」 한 줄 | `systemPrompt.ts:45` |

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
| `show_map_region` | 이미 칠한 **맵** 그림 | Pi 에서 모델이 보는 유일한 렌더 그림. 타일셋 자체 그림은 아니다 |
| `show_tiles`, `show_tile_grid` | 모델에겐 **JSON 텍스트만** | 그림은 채팅 창의 사람에게만 그려진다 |
| `find_similar_tiles` | 시트 위치·메타 점수 | 그림 비교가 아니다 |

### 참고문서 읽기 게이트

칠하기 도구(`TILESET_REFERENCE_TILE_CHOOSERS`: paint_tiles·fill_region·build_wall·place_door·place_window·build_roof·
lay_path·place_props·arrange_rows·paint_road·stamp_structure·build_house·stamp_forest_recipe·stamp_tile_recipe,
`src/editor/tools/tilesetReferenceTools.ts:24`)는 그 타일셋에 참고문서가 있으면 **전부 읽기 전에는 거부**된다.
참고문서가 **없으면 게이트가 아예 걸리지 않는다**(`src/ai/tilesetReferenceEvidence.ts:74` `if (!groups.length) continue;`).
즉 참고문서 없는 타일셋에서 조수는 아무 제약 없이 번호를 칠한다. 게이트는 「전달」만 확인하고 이해·품질은 보장하지 않는다.

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
- 한 칸 세 겹 이상(바닥+그림자+소품)은 지금 두 레이어뿐이라 합성 칸이 따로 필요하다
  (`tileStackAt` 는 비활성 — `src/project/mapOverlayTiles.ts`).

## 알려진 함정

- **16px 표가 48px 업로드를 건드린다.** `ensureTilesetHarnesses` → `applyCustomChipsetMinimalHarness`
  (`src/project/tilesetHarness/combinedTown.ts:55`, `:63`)가 합본 마을이 아닌 모든 타일셋(번들 성·LPC 가구만 예외)에
  RM2k3 투명 칩 번호표 `isTransparentChipsetTile` 로 `priority="upper"` 를 강제한다. 다른 규격의 업로드에선 엉뚱한 칸이 상위로 간다.
- **참고문서가 없으면 시스템 프롬프트의 「참고문서 읽어라」가 빈 목록만 돌려준다** — 조수는 그대로 번호를 칠한다.
- **`show_tiles` 그림은 조수가 못 본다.** 조수에게 칸 모양을 보여 주려면 참고문서 그림으로 넣는다.
- **`generate_map` 은 프로필 없는 타일셋에서 실패**하고, 문법 프로필은 RM2k 로 조용히 떨어진다.
- 새 칠하기 도구를 추가하면 `TILESET_REFERENCE_TILE_CHOOSERS` 목록에도 넣어야 게이트가 걸린다.

## 강제 장치 (이 문서를 안 읽어도 걸리는 것)

위키는 LLM 이 반드시 읽는다는 보장이 없다. 그래서 핵심 두 가지는 테스트가 막는다 — `test/tilesetTeachingGuards.test.ts`:

- **칠하기 도구가 게이트 밖에 있으면 실패.** `mapId` 와 칸 선택 인자(tile·tiles·tileId(s)·material(s)·recipeId·presetId·paletteRole·template)를
  함께 받는 쓰기 도구는 `TILESET_REFERENCE_TILE_CHOOSERS` 에 있거나, 코드가 칸을 고르는 도구 목록 `CODE_PICKS_TILES`
  (지금 author_village·place_concept·place_storage_chest)에 있어야 한다. 게이트 목록의 이름 오타·삭제도 잡는다.
- **새 번들 타일셋에 참고문서가 없으면 실패.** 2026-09-24 기준 참고문서 없는 번들 16개는 `BUNDLED_WITHOUT_REFERENCES` 에
  적어 두었고, 이 목록은 **줄어들기만** 한다(참고문서가 생기면 목록에서 빼라고 실패한다).

그리고 Claude Code 가 `AGENTS.md` 를 자동으로 읽도록 저장소 루트 `CLAUDE.md` 가 한 줄짜리 가져오기(골뱅이 + AGENTS.md)로 불러온다
(Claude Code 는 `CLAUDE.md` 만 자동 로드한다. Codex 는 `AGENTS.md` 를 직접 읽는다).
`tilesetReferenceTools.ts` 머리 주석도 이 문서를 가리킨다.
