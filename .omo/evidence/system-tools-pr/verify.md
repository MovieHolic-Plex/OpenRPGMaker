# verify — 피커 IA · 미리보기 · 재작성 e2e 독립 재검증

Plan: `.omo/plans/event-editor-system-tools-adversarial-review.md`
워크트리: `C:\Users\USER\Downloads\rpg-zzu-system-tools-ia` · 브랜치 `agent/system-tools-ia`
개발 서버: 127.0.0.1:9849 (기존 `npm run dev:worktree` 프로세스 재사용, PID 55880 LISTENING)
검증 시각: 2026-08-26 23:03–23:16 (로컬)

상류 주장은 전부 거짓으로 가정하고 아래 명령을 직접 실행했다. 종료 코드는 실측값이다.

## 결론

**PASS** — 지정 테스트 3종 + e2e 3파일 모두 종료 코드 0, `page4.json` 잔류 그룹 전부 빈 배열,
`loadStoryboardMode()` 기본값 `storyboard` 유지. 폐기 계약(2열 그리드 / 1400×860 / exact `조건` /
기본 visible 빈 줄 / 탭4 24버튼 고정) 재도입 단언 0건.

**단, 배포 차단 결함 1건**: 그린을 만드는 제품 코드가 **커밋되지 않았다**(아래 3-B). 브랜치 tip
`8802bd12` 만으로는 `test/m2PickerPage4.test.ts` 가 레드다.

## 1. 단위 테스트

```
cd C:/Users/USER/Downloads/rpg-zzu-system-tools-ia
node scripts/run-vitest.mjs run test/m2PickerPage4.test.ts test/commandEditModalPreview.test.ts test/commandPresentation.test.ts --configLoader bundle
```

종료 코드 **0** — 3 files / **40 tests passed** (m2PickerPage4 11, commandPresentation 5,
commandEditModalPreview 24). 2회 실행 모두 동일(23:03, 23:12). 전체 로그: `verify-unit.txt`.
**PASS**

## 2. e2e (Playwright)

```
set DEV_SERVER_PORT=9849&& npx playwright test test/e2e/oprn-event-command-picker.spec.ts test/e2e/oprn-modern-event-commands.spec.ts test/e2e/event-command-ui-preview.spec.ts --workers=1
```

종료 코드 **0** — **9 passed** (2.8m). 독립 2회 실행 모두 9/9(23:04, 23:12) → 타이밍 요행 아님.
전체 로그: `verify-e2e.txt`. **PASS**

| 스펙 | 테스트 |
|---|---|
| `event-command-ui-preview.spec.ts` | 2 (얼굴 크롭 요약, 대표 명령 요약/폼) |
| `oprn-event-command-picker.spec.ts` | 5 (스토리보드 CTA 저작, quick-next/toolbar-add, 탭4 IA, 런타임 소유자·검색 삽입, 목록 뷰 컨텍스트 메뉴) |
| `oprn-modern-event-commands.spec.ts` | 2 (모던 명령 탭 배치, 카메라 제어 폼) |

### 2-A. 서버가 워크트리 코드를 서빙했는지 (재사용 서버 위장 방지)

```
curl -s http://127.0.0.1:9849/src/project/eventCommands/m2PickerLayout.ts
```

http 200 / 22,793 bytes. 응답 본문에 미커밋 변경만 가진 심볼이 존재:
`Unclassified event command picker page` 1건, `isBattleOnlyRow`, `BATTLE_ONLY`, `Toggle Fullscreen Mode`.
즉 9849 는 이 워크트리(재분류 적용 트리)를 서빙했다. 포트 9999 는 응답 없음(000) — 건드리지 않았다.
`playwright.config.ts` 의 `reuseExistingServer: true` 덕분에 `npm run dev`(9999) 는 기동되지 않았다.

## 3. git 상태

```
git -C C:/Users/USER/Downloads/rpg-zzu-system-tools-ia log --oneline -12   # exit 0
git -C C:/Users/USER/Downloads/rpg-zzu-system-tools-ia status -sb          # exit 0
```

원문: `verify-git.txt`.

```
8802bd12 test(editor): enter the command picker from the storyboard CTA
38a277ff test(editor): pin picker page 4 to system and tools only
7f3ed4ac snapshot: agent worktree base for system-tools-ia
...
## agent/system-tools-ia
 M src/editor/eventCommands/commandPresentation.ts
 M src/editor/panels/eventEditor/commandPicker.ts
 M src/project/eventCommands/m2PickerLayout.ts
 M test/m2EventCommandCatalog.test.ts
```

### 3-B. 결함 — 구현이 커밋되지 않아 브랜치 tip 은 레드 (배포 차단)

커밋된 것은 **테스트뿐**이고(`38a277ff`, `8802bd12`), 그 테스트를 통과시키는 제품 변경 4파일은
워킹트리에만 있다. HEAD 트리에는 테스트가 부르는 API 자체가 없다:

```
git show HEAD:src/editor/panels/eventEditor/commandPicker.ts | grep -c eventCommandPickerTabEntries   # 0
```

같은 사실이 이 폴더의 기존 레드 로그(`picker-ia-red.txt`)와 일치한다:
`eventCommandPickerTabEntries is not a function` + `expected 4 to be 1` 계열 10 failed.
즉 위 1·2번 그린은 **더티 트리에서 측정한 값**이다. 형제 태스크가
`commandPresentation.ts` / `commandPicker.ts` / `m2PickerLayout.ts` / `test/m2EventCommandCatalog.test.ts`
를 커밋하지 않으면 PR 은 레드로 올라간다. (이 태스크의 쓰기 범위는 `.omo/evidence/system-tools-pr/`
뿐이므로 제품 파일을 대신 커밋하지 않았다.)

## 4. 탭 4 IA 실측 — `page4.json`

```
npx vite-node .omo/evidence/system-tools-pr/dump-page4.mts   # exit 0
```

- `tab4Grid.count` = **26**, 그룹 = `["모던 명령","시스템/고급"]`
  → 렌더 헤딩 매핑(`commandCategoryIcons.ts`: 시스템/고급→`시스템`, 모던 명령→`도구`)이
  e2e 의 `toHaveText(["시스템","도구"])` 와 일치.
- `tab4Grid.nonSystemToolGroups` = `[]`, `tab4Grid.informationalRows` = `[]` (선택 불가 정보 행 0).
- `leftoverGroupsOnPage4` — 전부 빈 배열: 대화/입력, 조건/흐름, **전투 전용**, 화면/연출, 맵/이동,
  소리, 배우/전투, 보상/상점. **PASS (이진 기준 충족)**
- 이동 실측: Label/Loop/Control Timer/End Event Processing/Name Input Processing/Advanced Dialogue → **1**,
  Camera Control/Screen Effect/Cutscene Control/Play Movie → **3**.
- 카탈로그 기준 page 4 = 23행, 그리드 26개(= 카탈로그 23 + 네이티브 `ending`/`openSaveMenu`/`runControl`).
- 선택 불가 행 31건은 검색에만 남고 전부 `alternateRoute` 보유(예: `checkpointSave` → `빠른 저작`).

### 4-A. 잔존 결함(선행 결함, 이번 변경과 무관)

탭 4 그리드에 라벨이 원시 kind 인 항목이 있다: `openSaveMenu | openSaveMenu`.
`commandKindLabel()` 이 `COMMAND_KIND_OPTIONS` 에 없는 kind 를 그대로 반환하기 때문
(`options.ts:105-107`). 게다가 `m2-076-open-save-menu`("저장 메뉴 열기")와 의미가 겹쳐
탭 4에 저장 메뉴가 사실상 2개다. 두 항목 모두 변경 전에도 family `system` → page 4 였으므로
(`git show HEAD:...commandPresentation.ts` 의 기본값 4 경로) 이번 재분류가 만든 회귀가 아니다.
별도 수정 대상으로 남긴다.

## 5. 폐기 계약(north star) 감사 — `verify-northstar.txt`

세 스펙 + 헬퍼(`eventStoryboardPicker.ts`) 대상 grep:

| 항목 | 결과 |
|---|---|
| `gridTemplateColumns` / `1400` / `860` / `toHaveLength(24)` / `toHaveCount(24)` | 히트 1건, **주석**(“폐기된 …는 여기서 단언하지 않는다”)뿐 |
| exact `조건` / `그래픽` / `실행 내용` 라벨 단언 | grep exit 1 = **0건** |
| `event-command-empty-line` | 3곳 모두 `toBeHidden()` 단언 + 주석 2건. 더블클릭 진입 경로 없음 |
| `loadStoryboardMode()` 기본값 | `storyboardView.ts:32` → `return "storyboard"` (list 아님) |

## 6. 범위 밖 부수 검증 (내가 추가로 돌린 것)

| 명령 | 종료 코드 | 판정 |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | PASS |
| `run-vitest run test/m2EventCommandCatalog.test.ts` | 0 | PASS (12 tests) |
| `run-vitest run test/developmentOntology.test.ts test/eventCommandPickerAudio.test.ts test/eventEditorCommandLabels.test.ts test/eventEditorModal.test.ts test/eventEditorTrustLoop.test.ts test/m2EventCommandCatalog.test.ts` | 1 | 6 files / 103 tests **passed**, `eventEditorTrustLoop.test.ts` 의 **선행** unhandled rejection 4건으로 exit 1 |

선행 결함 확인: `test/eventEditorTrustLoop.test.ts` 단독 실행도 exit 1(45 passed + 4 errors,
`clearCommandInspector` → `host.ownerDocument` undefined, `commandInspector.ts:48`).
`commandInspector.ts` / `modal.ts` 는 이 브랜치가 건드리지 않은 파일이다(`git diff --name-only`,
`git diff --name-only 7f3ed4ac..HEAD` 모두 미포함). 이번 변경이 만든 실패가 아니다.
단위 스위트 전체(910 파일)는 시간 예산상 돌리지 않았다 — 변경 모듈을 참조하는 테스트 파일만
`rg -l` 로 뽑아 전수 실행했다.

## 파일

- `verify-unit.txt` — 1번 전체 로그(+`EXIT=0`)
- `verify-e2e.txt` — 2번 전체 로그(+`EXIT=0`)
- `verify-git.txt` — 3번 원문
- `verify-northstar.txt` — 5번 grep 원문
- `page4.json` — 탭 4 라벨/그룹 덤프 (`dump-page4.mts` 로 재생성 가능)
- `dump-page4.mts` — 덤프 스크립트(증거 폴더 전용, 제품 코드 아님)
