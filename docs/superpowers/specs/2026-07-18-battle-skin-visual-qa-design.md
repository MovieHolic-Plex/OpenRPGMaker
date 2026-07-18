# 전투 스킨 + 스크린샷 Visual-QA 워크플로우 — 설계

- 날짜: 2026-07-18
- 브랜치(예정): `feat/battle-skins-visual-qa`
- 상태: 설계 리뷰 대기

## 1. 목표 (사용자 요구사항 매핑)

| # | 요구사항 | 설계에서의 실현 |
|---|---|---|
| 1 | 전투 반복 + 스크린샷 visual QA 워크플로우 | `battle-skins-visual-qa.spec.ts` (스킨×전투비트 스크린샷) + 오케스트레이터 루프 |
| 2 | 더 세련된 전투 | QA 루프가 스킨별 폴리시를 수렴시킴 (가독성·페이스·연출) |
| 3 | 스킨으로 전투 타입 결정 (10종) | `BattleSkin` 레지스트리 + `system.battleUiStyle` 확장 |
| 4 | 적대적 리뷰어 | fable-5-high **adversarial reviewer** 서브에이전트 (스크린샷 비전 채점) |
| 5 | 서브에이전트 fable-5-high 최대 2 | 동시 2개: builder + reviewer. 그 이상 X |
| 6 | 가독성 | 리뷰어가 텍스트·HP·대비 가독성을 명시 채점, 게이트 |
| 7 | 에셋은 Codex CLI 생성/편집 | 배틀러·배경을 Codex CLI로 생성 |
| 8 | 투명색 #00FF00 고정 | 소스 PNG는 #00FF00 크로마키 → 임포트 시 알파 변환 |
| 9 | 에셋 DB에서 확인 | generated-asset manifest/`project.resources` 등록 → Resources 탭 노출 |
| 10 | 전투가 재밌어야 | 리뷰어가 "game-feel/juice" 축 채점, 스킨별 특유 연출·타격감 |

## 2. 현재 상태 (Ground Truth)

- 전투 **로직**은 스킨-무관 (`src/battle/*` → `BattleSnapshot`). 건드리지 않는다.
- 전투 **렌더링**은 DOM 기반 (`src/player/battle*Dom.ts` + `styles/runtime/battle.css`), 현재 RM2K3 룩에 하드코딩.
- **부분 스킨 훅 존재**: `system.battleUiStyle: "classic" | "pokemon"` (`types/database.ts:120`). `battleFieldDom.ts:15`, `battleDom.ts:57`에서 소비. `root.dataset.battleUiStyle`로 노출.
- **스크린샷 QA 확립**: `test/e2e/*` 전반. 전투 부팅 재사용 훅 `seedReferenceBattleProject`/`startReferenceBattle` (`battleReferenceProject.ts`) → `battle-scene`에 `data-battle-phase`/`data-battle-director-step` 노출.
- 리소스 해석기 `resolveAssetResourceUrl` + Resources 탭(`resourceManager.ts`).

## 3. 스킨 로스터 (10종)

| id | 라벨 | 레이아웃 | 핵심 특징 |
|---|---|---|---|
| `pokemon` | 포켓몬 | frontview | 뒤통수 아군 1, 정면 적, HP 박스(이름/레벨/게이지) |
| `rm2003` | RM2003 | sideview | ATB, 파란 창, 아군 우측 열 (현 `classic` 승계) |
| `rm2000` | RM2000 | frontview | 정면뷰 커맨드, 아군 스프라이트 미표시(프론트) |
| `octopath` | 옥토패스 | sideview(hd2d) | 브레이크/부스트 게이지, 심도 배경 |
| `chrono` | 크로노 트리거 | active | 필드 연동 심리스, 액티브 커맨드 링 |
| `bravely` | 브레이블리 | sideview | 회화풍 배경, 얇은 프레임 HUD, BP |
| `dragonquest` | 드퀘 | firstperson | 1인칭, 적 스프라이트 중앙, 커맨드 창 하단 |
| `ff` | FF 정통 | sideview | ATB, 아군 우측 세로열, 창 테두리 |
| `mother` | 마더/언더 | frontview | 사이키델릭 배경 스크롤, 롤링 HP 오도미터 |
| `goldensun` | 골든선 | sideview | 낮은 앵글 3/4 사이드뷰 |

back-compat: 저장된 `"classic"` → `rm2003`, `"pokemon"` → `pokemon`로 매핑.

## 4. 아키텍처

### 4.1 스킨 레지스트리 — `src/battle/skins/`
```
types.ts      : BattleSkin 인터페이스 + BattleSkinId 유니온(10)
registry.ts   : BATTLE_SKINS 프리셋 맵, getBattleSkin(id), listBattleSkinIds(), resolveSkinId(legacy)
```
`BattleSkin` = 순수 데이터 프리셋:
```ts
interface BattleSkin {
  id: BattleSkinId;
  label: string;
  layout: "sideview" | "frontview" | "active" | "firstperson";
  showAllySprites: boolean;      // frontview 일부는 아군 스프라이트 숨김
  hudTemplate: "boxes" | "rows" | "ring" | "minimal"; // HUD 배치 힌트
  transition: string;            // 인트로 연출 클래스 키
  themeVars: Record<string, string>; // --battle-* CSS 변수 오버라이드
  defaultBackdropResourceId?: string;
}
```
렌더러는 스킨 데이터만 읽고 DOM 구조는 공유. 레이아웃·색은 **CSS가 `[data-battle-skin="<id>"]`로 분기**.

### 4.2 타입 확장 — `src/project/types/database.ts`
- `BattleUiStyle` → `BattleSkinId` (10 리터럴 유니온). 기존 필드명 `battleUiStyle` 유지(마이그레이션 비용 0).
- 저장/복원 시 legacy 값 매핑은 `resolveSkinId`에서.

### 4.3 렌더러 배선 (최소 침습)
- `battleDom.ts`: `root.dataset.battleSkin = resolveSkinId(system.battleUiStyle)` 추가(기존 `battleUiStyle` dataset도 back-compat 유지).
- `battleFieldDom.ts`: `pokemonUiActive()` 확장 → `activeSkin()` 헬퍼. `layout`에 따라 배틀러 그룹 배치(front/side/firstperson) 선택. 구조 최소 변경, 배치는 CSS 우선.
- **신규 CSS**: `src/styles/runtime/battle-skins/` — 스킨별 파티셜 10개(`_pokemon.css` …). 각 파일은 `.battle-scene[data-battle-skin="X"] { … }` 스코프. `styles/index.css`에 등록.

### 4.4 에디터 노출 — `databaseSystemView.ts`
- `BATTLE_UI_STYLE_OPTIONS`를 10개로 확장(라벨 한글). 선택 시 `draft.system.battleUiStyle = id`.

### 4.5 에셋 파이프라인 (요구사항 7·8·9)
- Codex CLI로 스킨별 배틀러/배경 PNG 생성. **소스 규약: 배경 투명 영역 = `#00FF00`**.
- 임포트 유틸 `chromaKeyToAlpha(png, "#00FF00")` → 알파 PNG. (신규 `scripts/assets/chromaKey.mjs` + 런타임 무관, 빌드/임포트 단계)
- 결과물을 generated-asset manifest에 등록 → `resolveAssetResourceUrl` 해석 → **Resources 탭에서 확인 가능**(요구사항 9).
- 규약 문서: `docs/assets/battle-skin-assets.md` (#00FF00 고정 명시).

### 4.6 Visual-QA 워크플로우
**(a) 스크린샷 스펙** `test/e2e/battle-skins-visual-qa.spec.ts`
- 10개 스킨 루프. 각 스킨: `seedReferenceBattleProject` → `system.battleUiStyle=<skin>` 주입 → `startReferenceBattle`.
- 고정 전투 비트마다 스크린샷 → `output/evidence/battle-skins/<skin>/<beat>.png`:
  `01-intro`, `02-command`, `03-target`, `04-attack-impact`, `05-skill`, `06-result`.
- 각 비트에서 DOM 진단(대비·오버플로우·클리핑) JSON 동시 저장.

**(b) 오케스트레이터 루프** (Claude가 Agent 툴로 구동, 동시 ≤2 fable-5-high)
```
for round in 1..N:
  run spec → screenshots + diag json
  [adversarial-reviewer | fable-5-high]  스크린샷 비전 채점:
     축 = 가독성 / 스킨 충실도 / 재미(game-feel) / 클리핑·오버플로우.
     각 스킨 pass|fail + 구체적 결함 목록(JSON) 반환. 기본 태도=결함 적극 지적.
  통과하면 종료.
  [builder | fable-5-high]  결함 목록을 CSS/DOM 패치로 반영.
```
- 서브에이전트 정확히 2역할(reviewer/builder), 동시 2개 상한 준수(요구사항 5).
- 리뷰어는 "적대적"(요구사항 4): 기본값 fail 편향, 통과엔 근거 요구.

## 5. 파일 변경 요약

신규:
- `src/battle/skins/types.ts`, `registry.ts`
- `src/styles/runtime/battle-skins/_<skin>.css` ×10 + `index.css` 등록
- `test/e2e/battle-skins-visual-qa.spec.ts`
- `scripts/assets/chromaKey.mjs`
- `docs/assets/battle-skin-assets.md`
- `test/battleSkinRegistry.test.ts` (레지스트리·legacy 매핑 유닛)

수정:
- `src/project/types/database.ts` (BattleSkinId)
- `src/player/battleDom.ts`, `src/player/battleFieldDom.ts` (skin dataset·배치)
- `src/editor/panels/databaseSystemView.ts` (10 옵션)
- `src/project/databaseRecordModel.ts` (직렬화 매핑)

## 6. 테스트 / 검증
- 유닛: `battleSkinRegistry.test.ts` — 10 id 존재, legacy 매핑, themeVars 완전성.
- E2E: 스펙이 10 스킨 모두 `battle-scene` 렌더 + 오버플로우 0 + 대비 임계 통과.
- 적대 리뷰 라운드 로그를 `output/evidence/battle-skins/review-round-*.json`로 보존.
- 회귀: 기존 `qa-battle`·`battle-browser-repro` 스펙 그대로 통과(구조 최소 변경).

## 7. 리스크 / 완화
- **DOM 구조 변경 최소화**: 레이아웃은 CSS 우선. 구조 변경이 필요한 스킨(firstperson=아군 스프라이트 숨김)만 조건 분기.
- **10 스킨 폴리시 심도=중간**: 1차 폴리시 목표. 심화는 후속 PR.
- **Codex 에셋 지연**: 에셋 미완이어도 CSS 도형/그라디언트 플레이스홀더로 QA 진행, 막판 교체 가능.
- **토큰**: 서브에이전트 2개 상한 + 라운드 수 제한(N=3 기본).

## 8. 범위 밖 (YAGNI)
- 전투 로직/밸런스 변경 없음.
- 스킨별 신규 커맨드 시스템(브레이크/BP 등)의 *로직*은 이번 범위 밖 — HUD 표기(시각)만.
- 사용자 커스텀 스킨 에디터 UI 없음(프리셋 10개 고정).
