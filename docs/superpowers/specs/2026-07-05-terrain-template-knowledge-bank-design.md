# 지형 템플릿 = 타일셋 구조물 지식뱅크 — 설계

2026-07-05 · 브레인스토밍 확정본 (사용자 결정 3 + 추가 요구 1)

## 결정 사항

1. **2계층 지식**: 타일 단위 지식(tileMeta/tileGroups)은 "단어장", 지형 템플릿(terrainTemplates)은 "교과서(구조물 문법)". 템플릿의 타일 번호는 조회 시 단어장 라벨과 조인해 표시한다. 스키마는 기존 유지 + `source`/`tags`/`sourceRegion`만 추가.
2. **축적 경로 = 맵에서 추출 + 인터뷰**: 사람이 지은 구조물 영역 → 추출기가 rows/grammar 초안 자동 생성 → 소크라테스식 확인 → 저장.
3. **실행 = 하이브리드**: buildPlan 있으면 스탬프(결정적), 없으면 LLM이 grammar/rows로 조립하되 `validate_structure`가 mustTouch/행 순서를 기계 검증.
4. **(추가 요구) 인터뷰는 이미지 리치 + 추측 선제시**: 질문 전에 반드시 영역 하이라이트 + 타일 그리드 이미지(`show_tile_grid`)를 채팅에 띄우고, AI가 추측한 구성(행별 지붕/벽/문/창 해석)을 요약 카드로 **먼저** 보여준 뒤 확인만 받는다. 사용자는 원탭 칩으로 답한다.

## 컴포넌트

### 데이터 (src/project/types/base.ts)
- `TerrainTemplateMetadata`에 `source?: TileMetadataSource`, `tags?: string[]`, `sourceRegion?: { mapId, x, y, w, h }` 추가. 기존 rows/grammar/rules/buildPlan 그대로.

### 슬라이스 1 — 소비 배선 (기존 1개 템플릿 즉시 활용)
- `terrainTemplateTools.ts` 신규 툴:
  - `list_terrain_templates` (read): id/name/tags/source/hasBuildPlan.
  - `get_terrain_template` (read): rows/grammar/rules/buildPlan 전체 + 타일 라벨 조인.
  - `stamp_terrain_template` (write): templateId + origin + material — buildPlan을 `stampTerrainTemplateHouse`로 실행. buildPlan 없으면 "grammar 조립 경로 사용" 오류 안내.
  - `validate_structure` (read): mapId + region + templateId — grammar의 mustTouch(위쪽 인접 역할)와 overlay 제약을 셀 단위 검사, 위반 좌표+메시지 반환.
- 프롬프트: 시스템 프롬프트에 템플릿 한 줄 목록, INTRO 수칙에 "구조물은 템플릿 확인 → 스탬프 or 조립+검증".

### 슬라이스 2 — 성장 루프 (지식이 쌓임)
- 추출기(순수) `terrainTemplateExtract.ts`: `extractTerrainTemplateDraft(tileset, map, rect)` →
  행 시그니처 클러스터링(레이어별), left/middle/right 패턴 감지, 위쪽 인접 역할로 mustTouch 초안,
  tileMeta 라벨로 meaning 초안. buildPlan 추측은 보류(조립 경로로 실행).
- 툴: `extract_terrain_template` (read, 초안 반환), `upsert_terrain_template` (write, 즉시 저장 규칙 포함).
- `show_tile_grid` (read) + 챗 패널 렌더: 맵 영역(≤20×20)을 하위+상위 합성 타일 그리드로 채팅에 표시 — 이미지 리치 요구의 핵심.
- 인터뷰 프로토콜 확장: 구조물 발견 → highlight + show_tile_grid + 추출 초안의 "구성 추측 요약"(행별 해석)을 먼저 제시 → 행 단위 확인 칩 → 확정 시 upsert(confirmedByUser).
- 챗 패널 버튼 "📐 선택 영역 학습": editorState.selection 영역을 구조물 학습 킥오프로 전송.
- `METADATA_ONLY_TOOLS`에 upsert_terrain_template 추가(제안 카드 없이 즉시 저장, Ctrl+Z 복구).

## 검증
- 유닛: 툴 계약(목록/조회 라벨 조인/스탬프/검증기 위반 검출), 추출기(패턴·mustTouch 초안), 프롬프트 회귀.
- 라이브 스모크: "small_house_01 템플릿으로 집 지어줘" → list/get/stamp 경로 확인.
- 게이트: tsc 0 에러 + 전체 테스트 + 빌드 배포 + 브라우저 확인.
