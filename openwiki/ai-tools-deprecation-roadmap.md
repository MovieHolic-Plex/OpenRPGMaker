# AI 툴 폐기 로드맵 (deprecated tool removal roadmap)

작성: 2026-07-13. 정본 소스: `src/editor/tools/toolRegistry.ts`(tagLegacy), `src/editor/tools/v2/index.ts`.

## 현황 (2026-09-04 갱신)

집 킷 잔재 제거로 `build_house_kit` / `build_house_lots` / `stamp_structure_kit` 는 등록 자체가 제거됐다.
옛 이름 호출은 `unknown-tool` 로 거부된다. 집 외장은 `author_house` 정본만 남는다.

레지스트리에는 deprecated 툴이 두 갈래로 남아 있다. LLM에는 어떤 모드에서도 노출되지 않지만
(`toOpenAiTools`가 무조건 제외), `getTool()` 실행 호환은 유지된다 — 과거 대화 재생·이벤트
인터프리터·저장된 스크립트가 옛 이름을 부를 수 있기 때문이다.

| 갈래 | 목록 위치 | 개수 | 대체 |
|---|---|---|---|
| v1 타일 배치/지식/조회 | `v2/index.ts` `V1_TILE_SUPERSEDED` | 17 | v3 정공법(`fill_region`, `tile_erase`, `place_props`, `author_house`) · `propose_tile_vocabulary` · `tile_query` |
| 구조물 스탬프 시공 | — (등록 제거, 2026-09-04) | 0 | `author_house` / `build_wall` / `fill_region` — 사람 팔레트는 유지 |
| 구 지식 UI 보조 | `toolRegistry.ts` `LEGACY_TILE_KNOWLEDGE_SUPERSEDED` | 5 | `propose_tile_vocabulary` · `tile_query` |
| 구 v2 배치 래퍼 | `v2/index.ts` `REMOVED_V2_PLACE_TOOLS` | 4 | **이미 제거됨** — 이름 매핑만 테스트/문서용으로 잔존 |

## 왜 지금 당장 지우지 않는가

1. **실행 호환**: `runTool` 경로로 옛 이름이 여전히 호출될 수 있다(저장된 감사 로그 재생,
   골든 태스크 `src/evals/goldenTasks.ts`, 과거 대화 이어가기).
2. **정의 재사용**: 일부 deprecated 툴의 `run` 구현을 현행 툴이 내부 호출한다
   (예: 지식 쓰기 계열이 승인 어휘 파이프라인에 부분 위임).

## 제거 단계

### 1단계 — 호출 계측 (즉시 가능)
`runTool`에서 deprecated 툴 실행 시 활동 로그(`src/ai/activityLog.ts`)에
`channel: "other"`, `payload.deprecatedToolCall` 마킹을 남긴다. 2~4주 관측해
실호출 0인 이름을 확정한다.

### 2단계 — 실행 차단 + 안내 오류 (관측 후)
실호출 0으로 확인된 이름부터 `run`을 `ToolError("'{name}'은 '{supersededBy}'로
대체되었습니다")`로 교체한다. 정의 본체(파라미터 스키마·구현)를 삭제해 유지비를 없애되,
이름→대체 매핑은 남겨 오류 메시지가 안내를 계속한다.

### 3단계 — 이름 삭제 (메이저 정리)
프로젝트 파일 포맷 마이그레이션(이벤트 커맨드에 툴 이름이 박제된 경우 치환)과 함께
레지스트리에서 이름 자체를 제거한다. `REMOVED_V2_PLACE_TOOLS`와 같은 "테스트/문서용
매핑"만 남긴다.

## 개별 판단 메모

- `paint_tiles`: **활성 복원 (2026-09-07)** — `fill_region`은 라벨 기반 면 채우기라
  숫자 타일의 rect/line/cells 조작을 대체하지 못한다. 실제 월드맵 계획은 이 도구를 요구했지만
  실행 스키마에서는 숨겨져 설원 시공이 누락됐다. 기존 구현과 보호 게이트를 그대로 노출한다.
  `paintToolExposure`가 계획 요구 스키마와 실제 눈 타일 쓰기를 검증한다.
- `paint_road`: **폐기 아님** — 흙길 오토타일 본선. `V1_TILE_SUPERSEDED`에 넣지 않은
  것이 의도임(주석 참조). NAME_DOMAIN_OVERRIDES로 tile+map 도메인 노출.
- `set_tile_metadata`/`upsert_tile_group` 계열: 어휘 승인 파이프라인이 안정되면 2단계로.
  단, 맵 인터뷰·미분류 분석 스킬의 저장 경로가 내부적으로 이 구현을 쓰는지 먼저 확인할 것.
- `show_tiles`/`show_tile_grid`/`render_group_sample`: `tile_query` 통합 완료 — 1단계
  계측에서 실호출이 없으면 가장 먼저 2단계 후보.
- `create_map` / `generate_map` 의 `border` **파라미터**: 모델 스키마에서 제거(2026-09-11).
  도구 폐기가 아니라 파라미터 비노출이라 `run()` 은 인자를 그대로 받는다(위 1~2단계와 같은 형태).
  근거·실측은 `editor-ai-tools.md` 「맵 생성 테두리 옵션은 모델에게 주지 않는다」. 완전 삭제는
  `borderWalls`/`MapBorder`·`carvePath` 인자·관련 테스트를 지우는 별도 정리이며, 아직 하지 않았다.
- 테스트: `test/tileToolsV2.test.ts`, `test/toolDomainScoping.test.ts`가 deprecated
  마킹·비노출·supersededBy를 회귀 고정한다. 단계 진행 시 이 테스트들의 기대를 함께 갱신.
