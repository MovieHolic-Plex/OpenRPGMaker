# MZ 4층 — 에디터 AI 조수가 4층 타일을 잘 까는 계획 (PR ④ 앞당김)

> 설계: `docs/superpowers/specs/2026-09-24-mz-four-layer-design.md` §7(조수 도구). PR ① #1447 로 데이터·그리기는 끝났다.
> 사용자 요구(2026-09-25): 「AI 조수가 타일을 잘 깔게. 문서화를 빡세게. 테스트까지 해 보고 시각화.」

## 목표

Rasak Fantasy(MZ 48px) 연구 프로젝트에서 헤드리스 조수(`bun scripts/pi-agent.mts`, gemini-3.7-flash)에게
한 줄 요청(늪지·일본 정원·동굴)을 주면, 1~4층과 그림자를 제자리에 써서 제작자 프리뷰에 가까운 맵을 만든다.
기준선(2026-09-25 r0): 조수는 번호를 맹목으로 칠했고(3200·0·4000·7000…) 지도 그림을 못 봤으며 게이트는 통과했다.

## 확인된 원인 (조사 결과)

1. 조수가 보는 지도: 브라우저 `show_map_region` 은 `src/ai/toolImageRenderer.ts` 자체 루프(1·3층만), 헤드리스 러너는
   `renderToolImage` 가 없어 `show_map_region` 이 실패, qa-game 렌더러(`scripts/qa-game/render.mts`)는 **업로드 타일셋 그림을 못 찾는다**
   (`tilesetBaseImageUrl(tileset)` 이 프로젝트 자산을 안 본다 → 엉뚱한 기본 칩셋으로 그림).
2. 쓰기 도구는 전부 `lowerTiles`/`upperTiles` 만 쓴다. 2·4층·그림자를 쓰는 도구가 없다. 지우기·뒤집기·복사도 2·4층을 모른다.
3. 오토타일(`autotileEngine.ts`)은 `lowerTiles` 만 다시 모양 잡는다 → 2층 풀 장식(MZ A2)을 칠할 수 없다.
4. 고스트(`mapDelta.ts`, `agentGhostPreview.ts`)·변경 집계(`changeset.ts`)·시각 검토 트리거(`mapVisualEvidence.ts`)가 1·3층만 본다.
5. Rasak 타일셋 지식: tileMeta 라벨이 `A2 kind 8 shape 0` 같은 기술 이름뿐, 참고문서 0, 묶음·오토타일 그룹 0.
6. `paint_tiles` 는 호출당 번호 하나. 여러 칸 물체(나무 2×3)를 찍으려면 호출이 여러 번 필요하다.

## 결정 (controller ruling)

- 층 인자는 **문자열 enum**: `"lower"|"upper"|"1"|"2"|"3"|"4"` (Gemini 함수 선언은 문자열 enum 만 안정적). `lower`=1, `upper`=3 별칭.
  `'auto'` 는 이 PR 에 넣지 않는다(PR ③). 기본값은 지금과 같다.
- 1층을 칠하면 그 칸의 2층을 지운다(설계 기본값). `mapHelpers.setLower` 는 이미 3층을 지우므로 2·4층·그림자도 함께 지운다(옛 맵은 no-op).
- 새 도구 두 개: `stamp_layer_block`(한 번에 여러 층 배열 찍기), `paint_shadow`(그림자 조각). 둘 다 참고문서 게이트 목록에 넣는다.
- Rasak 그림은 저장소에 넣지 않는다. 이름·번호·규칙(텍스트)은 `tiledata/rasak-fantasy/` 에 커밋 가능(Rasak Modern 선례).
  참고문서의 그림은 스크립트가 사용자 로컬 굽기 결과에서 만들어 로컬 프로젝트에만 넣는다.
- 사용자가 이번에 테스트를 시켰다 → 바뀐 파일의 **집중 vitest 는 실행한다**(systemd-run MemoryMax 로 감싸기). 전체 gates 는 감독자 몫.

## 작업

### Task 1 — 조수가 네 층을 본다 (코드)
- `scripts/qa-game/render.mts`: 업로드 타일셋 그림을 프로젝트 자산에서 찾는다(`project.assets` 의 `dataUrl`, 또는 `ref` → `<projectDir>/assets/<sha>.<ext>` 는 JSON 에선 없으므로 dataUrl 우선). 애니 스트립은 첫 프레임.
- `scripts/pi-agent.mts`: `renderToolImage` 로 `renderToolRegionPngBase64` 를 넘긴다(`scripts/qa-game/gen.mts` 선례).
- `src/ai/toolImageRenderer.ts` `tileGridPayload`/`renderTileGridPayload`: payload 의 2층·4층·그림자를 받아 1 → 2 → 그림자 → 이벤트 → 3 → 4 로 그린다
  (2·4층 원시 칩, 그림자는 `drawShadowQuarters` 와 같은 반투명 검정 사분면).
- `show_map_region`(`src/editor/tools/visionQueryTools.ts`): 맵에 선택 층이 있으면 `layer2`·`layer4`·`shadow` 2D 배열도 돌려준다(없으면 키 없음 — 옛 맵 출력 불변).
- `get_map_region` 기호(`queryTools.ts` `semanticChar`): 4→1 로 맨 위 비지 않은 칸 기준.
- `analyze_map_tile_usage`: 층 1~4 로 센다(옛 lower/upper 이름도 유지).
- `src/ai/mapVisualEvidence.ts` `mapVisualContent`: 선택 층 포함(있을 때만).
- 테스트: toolImageRenderer 층 순서, show_map_region 출력(옛 맵 불변 + 새 층), render.mts 업로드 자산.

### Task 2 — 조수가 네 층을 쓴다 (코드)
- `paint_tiles`·`fill_region`: `layer` enum 에 `"1".."4"` 추가. 2·4층은 `setLayerTileAt`. 홈 레이어 라우팅은 1/3 에만(2·4 는 명시 선택 존중).
  1층 칠하기는 그 칸 2층을 지운다. 오토타일 재성형은 **칠한 층 배열**에서(Task 3 의 엔진 확장 사용). 결과 data 에 `effectiveLayer` 는 `"1".."4"` 로.
- 새 도구 `stamp_layer_block`: `{ mapId, x, y, layers: { "1"?: number[][], "2"?: number[][], "3"?: number[][], "4"?: number[][], shadow?: number[][] }, referencePurpose? }`.
  배열 값 -1 은 「건드리지 않음」, 빈칸으로 만들려면 `-2`(또는 `clear:true` 칸) — 설명에 명시. 범위 밖 번호·맵 밖 칸은 거부(부분 쓰기 없음). 1층 칸은 2층 자동 비움 규칙을 따르되 같은 블록에 2층 값이 있으면 그 값.
  오토타일 그룹 멤버는 찍은 뒤 층별로 재성형. 요약에 층별 칸 수.
- 새 도구 `paint_shadow`: `{ mapId, cells: [{x,y, quarters?: ("tl"|"tr"|"bl"|"br")[], bits?: 0..15}], mode?: "set"|"add"|"clear" }`.
- 지우기·복사: `tile_erase` layer enum 에 `"2"|"4"|"shadow"|"all"`, `both` 는 1·3층 + 2·4층·그림자까지(칸 완전 비움). `clear_region`·`clear_map`·`mirror_region`·`copy_map_region`(all) 이 선택 층을 함께 다룬다. 지운 뒤 `compactMapLayers`.
- `mapHelpers.setLower` 가 2·4층·그림자도 지운다.
- `src/editor/tools/tilesetReferenceTools.ts` `TILESET_REFERENCE_TILE_CHOOSERS` 에 두 새 도구. `test/tilesetTeachingGuards.test.ts` 통과.
- `docs/tool-catalog.md`: 바뀐·새 도구 행만(생성기 드리프트 — 메모리 tool-catalog-regen).
- 테스트: 각 도구 한 개씩 + 옛 맵에서 새 키가 안 생김.

### Task 3 — 오토타일이 칠한 층에서 모양을 잡는다 (코드)
- `autotileEngine.ts` 의 `shapeAutotileGroupAround`·`shadeAutotileInterior` 가 받는 뷰에서 층 배열을 고를 수 있게(예: `AutotileMapView` 에 `tiles` 배열을 넘기는 어댑터 `autotileLayerView(map, layerNo)`). 기본은 지금처럼 lowerTiles.
- 2층 뷰는 없으면 만들지 않는다(그룹 멤버를 2층에 칠할 때만 배열 생성).
- 테스트: 2층에 그룹 멤버를 칠하면 2층 이웃 기준으로 모양이 잡히고 1층은 안 바뀐다.

### Task 4 — 고스트·변경 집계 (코드)
- `src/ai/piAgent/mapDelta.ts`: 층 유니온에 `"layer2"|"layer4"|"shadow"` 추가, diff/apply 가 mapLayers 도우미로.
- `src/editor/agentGhostPreview.ts` `collectTileDiffCells`: 선택 층 변화도 칸으로 잡는다(그리기는 PR ② 에서; 지금은 칸 표시만이라도).
- `src/editor/tools/changeset.ts` `tileBuffersDiffer`·`countTileChanges`: 선택 층 포함.
- 테스트: 델타 왕복, 변경 수.

### Task 5 — 조수에게 층을 가르치는 글 (코드·문서)
- 도구 설명(`paint_tiles`·`fill_region`·`stamp_layer_block`·`paint_shadow`·`tile_erase`·`show_map_region`)에 네 층 뜻을 짧고 같게:
  1층 바닥(물·흙·벽 자동타일), 2층 바닥 장식(1층 위에 겹치는 풀·흙 자동타일 — 캐릭터 아래), 3층 물체(나무·바위·건물 — ★ 은 캐릭터 위), 4층 물체 위 물체(3층과 겹쳐 쌓기), 그림자(벽 아래 사분면).
- `src/ai/piAgent/systemPrompt.ts`: 대상 맵의 타일셋을 쓰는 맵 중 하나라도 선택 층이 있거나 타일셋 참고문서가 네 층을 선언하면(아래 Task 6 의 `layerModel` 표지 — 참고문서 MD 첫 줄 `layer-model: mz4`) 한 줄: 「이 타일셋은 MZ 네 층 + 그림자: … stamp_layer_block 로 예제 배열을 그대로 찍어라」.
- 위키: `openwiki/teaching-assistant-tilesets.md` 에 「네 층 타일셋 가르치기」 절, `openwiki/tile-layer-policy.md` 에 층 번호·도구 인자 대응.

### Task 6 — Rasak Fantasy 지식 (이름) — 저장소 밖 작업 → 텍스트만 커밋
- 굽기 결과(`~/third-party-assets/rasak/baked/<묶음>/atlas.png`·`manifest.json`)를 보고:
  - A1~A5 자동타일 **종류(kind)** 마다 한글 이름·역할(물/바닥/벽/지붕/바닥장식)·권장 층(1 또는 2).
  - B~E·추가 시트의 **물체**를 알파 연결 성분으로 나눠(여러 칸 물체 = 칸 목록) 한글 이름·크기·권장 층(3/4)·통행을 붙인다. 프리뷰 5장에 쓰인 물체는 전부, 나머지는 시트별 대표.
- 출력: `tiledata/rasak-fantasy/names.json`(묶음별 `{kinds:[{slot,kind,name,role,layer}], objects:[{id,name,sheet,cells:[[tile…]…],layer,passable}]}` — 번호는 굽기 아틀라스 기준, 판본은 bundles.json sha256).
- MZ 자동타일 모양 표: 모양 0~47(바닥)·0~15(벽)·폭포 0~3 → 8이웃 마스크(`AUTOTILE_DIR` 비트, `autotileEngine.ts`) 대응을 `scripts/content/rasak/mz_autotile.py` 의 사분면 표에서 유도해 `tiledata/rasak-fantasy/mz-autotile-masks.json` 으로.

### Task 7 — Rasak 지식 주입 스크립트 (스크립트 커밋, 결과는 로컬 프로젝트)
- `scripts/content/rasak/build-assistant-pack.mts`(또는 py + mts): names.json + 굽기 결과 + 프리뷰 4층 맵 → 로컬 연구 프로젝트(`~/third-party-assets/rasak/study-project-layers`)의 각 타일셋에
  - tileMeta: 라벨·설명·defaultLayer·passage 를 이름표로(기존 통행·우선순위 값은 유지).
  - tileGroups: 재료 단위(「늪 물」「흙 바닥」「풀 장식」…) — 재료 이름 도구가 찾게.
  - autotileGroups: 자동타일 종류마다 8이웃 variantMap(Task 6 표) — `paint_tiles` 로 대충 칠해도 가장자리가 맞게.
  - referenceDocuments: 묶음별 **작업 단위 용도**(늪지 / 일본 정원·성 / 절벽·폭포 숲 / 얼음 동굴 / 용암 동굴). 용도마다 AI-REFERENCE-CONTRACT 8항목:
    ① `layer-model: mz4` 표지 + 네 층 규칙과 이 팩의 층별 실측 분포(프리뷰 통계), ② 번호 사전(자동타일 종류 → 칠할 대표 번호, 물체 → 칸 배열·층),
    ③ 조립 순서(1층 바탕 → 2층 장식 → 3층 물체 → 4층 겹침 → 그림자), ④ **완성 예제**: 프리뷰를 10×8 안팎 창으로 잘라 4층 배열 전체 + 원본 해상도 그림 + 층별 분해 그림,
    ⑤ 물체 도감 그림(번호 겹쳐 쓴 칸 묶음, 읽을 수 있는 해상도), ⑥ 정상/오류 나란한 그림(물체를 1층에 → 바닥 사라짐, 장식을 3층에 → 캐릭터 위, 2층 없이 자동타일 → 가장자리 끊김), ⑦ 자동 검사 범위.
  - 이미지 한 용도 ≤ 8장(게이트가 전부 읽게 하므로 첫 턴 비용), MD 는 페이지(6000자) 수 최소.
- 저장소 API 로 저장 → 다시 열어 확인(AGENTS 정본 저장 규칙). 그림은 저장소에 안 들어간다.
- 같은 스크립트가 pi-agent 용 JSON(`/tmp/mzai/*.json`)도 내보낸다(빈 시험 맵 포함).

### Task 8 — 시험과 시각화
- 요청 3개(늪지·일본 정원·얼음 동굴), 빈 30×20 맵. 전(r0 코드·지식 없음) / 후(코드+지식) 비교. 필요하면 지식 1~2회 보강 후 재시험.
- 지표: 도구 호출·실패, 층별 칸 수·그림자, 번호가 사전에 있는 비율, 통행 도달성, 그림.
- `~/claude-viz/mz-layers-assistant.html`: 전/후 그림, 층별 분해, 지표 표, 조수가 실제 읽은 참고문서 목록.
