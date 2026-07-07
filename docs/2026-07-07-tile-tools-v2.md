# 2026-07-07 타일 툴 v2 전면 재구축 — 상세 명세

- 작성: Claude Fable 5 (감독자 직접 구현, 사용자 지시)
- 커밋: 7734d88 (feat/phase-6a)
- 코드: `src/editor/tools/v2/` (tilePlaceV2.ts / tileKnowledgeV2.ts / tileToolsV2Support.ts / index.ts)
- 테스트: `test/tileToolsV2.test.ts` (계약 테스트 19)

## 1. 왜 다시 만들었나 — 실측된 고장

T2 도그푸딩(에이전트 마을 생성 실측)에서 v1 툴 계약의 구조적 결함이 확인됐다:

| 결함 | 실례 | 결과 |
|---|---|---|
| 중첩 스키마 미명세 | `upsert_palette_preset`의 preset이 `{type:"object"}` 한 줄 | 모델이 slots/role 형식을 추측 → 검증 거부 → 재시도 폭주 (도구 77회, 240초 턴 미완) |
| required-properties 불일치 | `scatter_object`는 required에 `area`가 있는데 properties에 area 정의가 없음. `set_tile_metadata`도 required `entries`가 스키마에 없음 | 모델이 필수 인자의 형태 자체를 모름 |
| 실제 한계값 비공개 | 집 재질(plaster/wood/stone), 크기(5~30×6~24)가 스키마에 없음 | 호출 후에야 거부 → 왕복 낭비 |
| 오류 메시지가 사람 대상 | "그룹을 찾을 수 없습니다: broadleaf_tree" | 모델이 무엇을 어떻게 다시 보내야 하는지 모름 |

결론: 페인팅/산포 엔진은 건재하고, **툴 계약 계층(스키마·인자 해석·오류)**이 병인이다.

## 2. 아키텍처 — 버전 계층

- `ToolDefinition`에 `version(1|2)` / `deprecated` / `supersededBy` 신설.
- **v1 타일 툴 25종 전부 deprecated**: `toOpenAiTools()`가 필터링해 **모델에게 보이지 않는다**.
  `getTool()` 실행 호환은 유지 — 구 세션·기존 테스트·내부 호출은 그대로 동작.
- 비타일 v1 툴(맵 생성/이벤트/DB/세계관 등)은 대체물이 없으므로 version 1 태그만 달고 노출 유지.
- v2는 **엔진을 재작성하지 않는다**: 검증·정규화를 마친 뒤 내부적으로 v1 `run()`을 호출한다.
  (클러스터 hard 규칙 동반 배치, 자연산포, 오토타일 셰이핑, 보호셀 회피 등 검증된 동작 전부 보존)

## 3. v2 계약 3원칙

1. **완전한 스키마**: 모든 중첩 구조·enum·실제 한계값을 JSON Schema에 명시. 모델이 추측할 것이 없다.
2. **별칭·강제 변환 수용**: `tile`/`tileId`/`index` 동의어, 숫자 문자열 좌표("3"→3) 허용 — 사소한 형식 차이로 왕복을 낭비하지 않는다.
3. **자가수정용 오류**: 모든 인자 거부에 `— 다시 보낼 형식 예시: {유효 JSON}` 동봉. 모델이 한 번에 고친다.

## 4. 도구 9종 상세

### 배치 계열 (tilePlaceV2.ts)

**tile_paint** — 칠하기/지우기 통합. (v1 대체: paint_tiles, clear_region)
- `action`: paint(기본)/erase. erase+rect는 상위 레이어 정리까지 하는 clear_region 경로로 자동 라우팅.
- `mode`: rect/line/fill/cells — 모드별 필수 좌표(from/to/cells)를 사전 검증.
- 상위 전용 칩 자동 레이어 라우팅, 클러스터 hard 동반 배치, 통행성 경고는 엔진에서 자동.

**tile_road** — 길 깔기. (v1 대체: paint_road)
- `points` 폴리라인(2개 이상, 사전 검증) + `style`(dirt|sand enum) 또는 `presetId+paletteRole`(프리셋의 path role 타일 사용).
- `naturalness` 0~1 (0=직선, 0.8+=구불구불 — 자연산포 wobblePath), `seed` 결정론.
- presetId/paletteRole 짝 누락을 예시와 함께 거부.

**tile_scatter** — 자연 산포. (v1 대체: scatter_object)
- `area{x,y,w,h}` **스키마에 완전 명세**(v1의 구멍), `count`, `groupId` 또는 `presetId+paletteRole` 중 하나 필수(사전 검증).
- naturalness에 따라 uniform/poisson/cluster 자동, 풋프린트 원자 배치·보호셀 회피.

**tile_structure** — 구조물 통합. (v1 대체: build_house, stamp_template_house, stamp_structure, stamp_terrain_template, preview_house)
- `kind` enum 4종: house(width 5~30/height 6~24/material plaster|wood|stone — **실한계를 스키마에 명시**), template_house(variant/material), structure(template 이름), terrain_template(templateId).
- kind별 필수 인자를 사전 검증하고 부족하면 kind에 맞는 완성 예시를 동봉해 거부.

### 지식 계열 (tileKnowledgeV2.ts)

**tile_metadata** — 타일 의미+규칙 통합. (v1 대체: set_tile_metadata, set_tile_rules, set_tile_passability)
- entries 항목에 의미 필드(label/description/role/tags)와 규칙 필드(layer/passable/terrainTag)를 섞어 넣으면 **자동 분배**해 두 v1 엔진을 각각 호출.
- `confirmedByUser=true`면 잠금(locked) 마킹 — AI 재감사가 덮어쓰지 못함(T1b 교정 규약과 연동).

**tile_group** — 타일 그룹 관리. (v1 대체: upsert_tile_group, delete_tile_group, set_group_junction, set_group_overlay)
- `action` enum: upsert(group 객체 — role은 8종 enum 명시)/delete/set_junction/set_overlay.
- 신규 그룹은 id 생략 규약(자동 발급)을 스키마에 명시 — v1의 "그룹을 찾을 수 없습니다" 오호출 차단.

**tile_cluster_rule** — 클러스터 규칙. (v1 대체: set_cluster_rule)
- rule{id, kind: adjacency|spacing|count, strength: hard|medium|soft, params} 전체 구조 명세.

**tile_palette_preset** — 팔레트 프리셋. (v1 대체: upsert_palette_preset)
- 핫픽스로 보강한 완전 스키마(slots/role enum/tileIds) 승계. locked 프리셋 upsert 거부.

**tile_query** — 조회 통합 (read). (v1 대체: get_tile_info, list_unclassified_tiles, query_tiles, analyze_map_tile_usage, find_similar_tiles, list_terrain_templates, get_terrain_template)
- `ask` enum 7종: tile_info/unclassified/palette/usage/similar/terrain_templates/terrain_template.
- 툴 설명에 "칠할 타일을 모를 때 여기부터"를 명시 — 배치 툴 오류 예시들도 tile_query를 가리킨다.

## 5. 주변 배선 (v2 이름 병행 인식)

- `src/ai/buildSpec.ts`: 공간 스펙 게이트 툴 세트에 v2 4종 추가.
- `src/ai/proposalCompleteness.ts`: 영역 계산(tile_road→경로, tile_structure→kind별 풋프린트)·배치 수 계산에 v2 매핑.
- `src/editor/panels/aiChatPanel.ts`: 프로포절 카드 사람 언어 요약("집 N채·길 N칸·나무 N그루") 집계가 v2 이름 인식.
- `src/ai/skills.ts` 스킬 프롬프트, `src/ai/contextBuilder.ts` 프리셋 지침: v2 이름으로 교체.
- 툴 브라우저 '타일 v2' 카테고리, `docs/tool-catalog.md` 재생성.

## 6. 검증

- 계약 테스트 19종: 레지스트리 노출 규약(v2 노출/v1 비노출/비타일 유지), 모든 오류 경로의 "다시 보낼 형식 예시" 동봉, 정상 경로의 엔진 동일 효과, 별칭·강제 변환. 전체 스위트 2187 passed / 1 skipped.
- **라이브 실측(진행 중)**: v1에서 240초 미완이던 마을 생성 T1 턴이 v2에서 58~138초에 완료·적용. 프리셋 생성 1회 성공, tile_road가 프리셋 path role로 도로 46~50칸, 재시도 폭주 소멸(내부 재시도 ≤1회).

## 7. 남긴 것

- v1-활성 유지(대체물 없음): extract/upsert/validate_terrain_template(저작 도구), render_group_sample, suggest_group_from_range, show_* 비전 조회 계열.
- 후속 후보: 모델이 한 응답에 여러 tool_calls를 반환할 때 배치 실행(왕복 수 절감 — 순서 의존성 검증 필요).
