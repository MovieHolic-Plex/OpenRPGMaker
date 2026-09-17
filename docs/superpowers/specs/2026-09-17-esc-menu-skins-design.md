# ESC 메뉴 스킨 — 자료집 시스템 탭에서 고르는 게임 메뉴 디자인

- 날짜: 2026-09-17 · 브랜치: `fierce-moose`
- 배경 문서: `docs/2026-09-17-esc-menu-uiux-proposal.html`(현재 화면 결함 6건 + 목업 A/B/C)
- 사용자 결정(2026-09-17): "메뉴 창 디자인을 에디터 '시스템'에서 사용자가 선택할 수 있게 하고, 다양하게 등록한다."

## 1. 목표

전투 화면의 `system.battleUiStyle` 처럼, ESC(X) 로 여는 게임 메뉴에도 **스킨 레지스트리**를 둔다.
자료집 → 시스템 → 화면 절에서 스킨을 고르면 다음 테스트 플레이부터 그 디자인으로 메뉴가 뜬다.
첫 등록 5종:

| id | 라벨(자료집에 보임) | 첫 화면 | 레일 | 커서 격자 | 톤 |
|---|---|---|---|---|---|
| `workbench` (기본) | 작업대 · 아이템 첫 화면 | 아이템 작업 패널 | 접힌 6항목 · 글리프 아이콘 | 1열 | 유리 |
| `party-first` | 파티 퍼스트 · 유리 | 파티 4명 HP·MP | 평탄 · 컬러 아이콘 | 1열 | 유리 |
| `party-first-warm` | 파티 퍼스트 · 남색과 금 | 파티 4명 HP·MP | 평탄 · 컬러 아이콘 | 1열 | 남색·금 |
| `hub` | 허브 타일 · 요약 6칸 | 명령 타일 6개 + 파티 스트립 | 접힌 6항목 · 컬러 아이콘 | 3열 | 유리 |
| `sheet` | 사이드 시트 · 지도 노출 | 오른쪽 시트: 파티 + 명령 격자 | 평탄 · 컬러 아이콘 | 2열 | 유리 |

`workbench` 는 지금 화면 그대로다 — 기존 프로젝트·e2e 계약이 하나도 바뀌지 않는다.

## 2. 비목표

- 상태이상 칩(「독」 등): 세션에 필드 상태이상 데이터가 없다. 「위험」(HP ≤ 25%) 만 표시한다.
- EXP 게이지: 액터 레벨 곡선 헬퍼가 없어 이번 범위 밖.
- 사용자 정의 CSS 스킨(전투의 `battleCommandCss` 같은 것): 다음 단계.
- 하위 화면(아이템·스킬·장비·상태 …)의 기능 변화 없음. 스킨은 배치·색·아이콘·첫 화면·오른쪽 열만 바꾼다.

## 3. 데이터

- `SystemRecords.menuUiStyle?: MenuUiStyle` — `"workbench" | "party-first" | "party-first-warm" | "hub" | "sheet"`.
- 저장 정규화(`normalizeSystemRecords`): 기본(`workbench`)과 미등록 값은 저장하지 않는다. 명시 선택만 보존한다(`battleUiStyle` 과 같은 계약).
- 렌더 시점 `resolveMenuSkinId(value)` 가 미설정·미지값을 `workbench` 로 푼다.

## 4. 레지스트리 (`src/player/menuSkins/`)

```ts
type MenuSkin = {
  id: MenuSkinId; label: string; description: string;
  landing: "work" | "party" | "hub" | "sheet";   // main 모드 첫 화면
  tone: "glass" | "warm";                          // 색 토큰 묶음
  railIcons: "glyph" | "painted";                  // 유니코드 글리프 / 컬러 PNG
  railStyle: "collapsed" | "flat";                 // 접힌 6항목 / 평탄 10항목
  railColumns: 1 | 2 | 3;                          // main 모드 커서 격자
  sideParty: boolean;                              // 작업 패널 오른쪽 열에 파티 미니
};
```

라벨은 자료집 드롭다운에 그대로 보이므로 타사 프랜차이즈 이름을 쓰지 않는다(`test/detsukuruBrandStrings.test.ts` 규약).

## 5. 런타임

- `renderPlayerStatusMenu` 가 `project.system.menuUiStyle` 로 스킨을 정하고 루트에 `data-menu-skin` · `data-menu-skin-tone` · `data-menu-skin-landing` · `data-menu-skin-icons` · `data-menu-skin-rail` 을 쓴다. CSS 는 전부 이 속성으로 스코프한다.
- **평탄 레일**(`railStyle: "flat"`): 행동 3 + 파티 4(상태·열 바꾸기·진형·몬스터) + 기록(임무 하나면 그대로, 둘 이상이면 「기록 ▸」) + 저장 + 「시스템 ▸」(로드·대기·타이틀). 최대 10항목. 접힌 그룹 진입·복귀 규칙은 기존과 같다.
- **첫 화면**
  - `work`: 지금과 같다(선택 명령의 작업 패널, `inert`).
  - `party`·`sheet`: 작업 패널 대신 `status-menu-party-overview`(얼굴 34px · 이름 · 직업 · Lv · HP/MP 게이지+숫자 · 「위험」 칩). function 모드로 들어가면 작업 패널이 그 자리를 차지한다.
  - `hub`: 레일 항목마다 한 줄 요약(`status-menu-command-summary`)을 달고 CSS 가 3열 타일로 배치, 아래 `status-menu-party-strip`(4칸). function 모드는 작업대와 같은 배치.
- **커서 격자**: `reduceStatusMenuKeyboard` 에 `columns` 를 준다. 1열이면 지금처럼 ↑↓ 만 움직이고 → 가 진입. 2열 이상이면 ↑↓←→ 가 격자를 움직이고(토러스 래핑) Enter/Z 만 진입한다.
- **사이드 파티**(`sideParty`): function 모드 작업 패널 오른쪽 열(84px)에 쇼케이스 + `status-menu-side-party`(4행: 얼굴 12px · 이름 · HP 숫자 · HP/MP 트랙).
- **컬러 아이콘**: 기존 `data-icon`(글리프) 옆에 `data-icon-name` 을 두고, painted 스킨의 CSS 가 `::before` 글리프를 비우고 배경 이미지를 깐다. 리소스는 `public/assets/generated/starter/battle-icon-*.png` + `public/assets/cc0/jetrel/icons/{crystal,map,clock}.png`. 내보내기 번들 목록(`src/player/runtimeAssets.json`)에 새 파일 3개를 더한다.
- **톤**: `warm` 은 `--status-edge-*` 변수와 패널 표면만 바꾼다. 색은 전부 rgba(TOKENS.md §4.1).

## 6. 에디터

- 자료집 → 시스템 → 화면 절에 「게임 메뉴 디자인」 fieldset: 드롭다운(`db-field-system-menu-ui-style`) + 설명 문장 + 320×240 미리보기 이미지(`public/assets/ui/menu-skins/<id>.png`, 실제 런타임 캡처).
- 스튜디오 「화면」 카드 상태에 메뉴 스킨 라벨을 덧붙인다.
- 기본값 선택은 프로젝트에서 키를 지운다.

## 7. 테스트

- 레지스트리: id 유일 · 기본 `workbench` · 미지값 해석 · 정규화 왕복.
- 모델: 평탄 레일 항목 순서, 시스템 그룹에서 저장 제외, 기록 접힘 조건, `statusMenuRailIdForCommand` 평탄 규칙.
- 키보드: 3열·2열 격자 이동과 래핑, 1열은 기존과 동일.
- 렌더러(fakeDom): 스킨별 루트 속성, `party` 첫 화면에 overview 있고 detail 없음, function 모드에 side-party, `hub` 에 summary·strip, `workbench` 는 기존 테스트 그대로 통과.
- 에디터(fakeDom): 드롭다운 항목 5개, 선택 → `store` 반영, 기본 선택 → 키 삭제.
- 증거: 런타임 QA 하네스로 스킨별 실화면(첫 화면·아이템·장비) 캡처 → `docs/2026-09-17-esc-menu-uiux-proposal-assets/after-*.png`.

## 8. 제약

- `npm run gates` · `git stash` 금지(사용자 지시). 검증은 `tsc --noEmit` + 관련 vitest 파일 + 실화면 캡처.
- CSS 예산 래칫: 새 hex 리터럴 0, `!important` 0, 미정의 변수 0. 새 클래스는 전부 TS 에서 발행.
- 병합은 gh PR 로만. 이 브랜치에 작업 단위마다 커밋한다.
