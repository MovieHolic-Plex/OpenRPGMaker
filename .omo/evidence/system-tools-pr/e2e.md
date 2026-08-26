# e2e — 스토리보드 진입으로 재작성한 명령 피커 스펙 (todo 3)

Plan: `.omo/plans/event-editor-system-tools-adversarial-review.md`
브랜치: `agent/system-tools-ia` · 워크트리: `C:\Users\USER\Downloads\rpg-zzu-system-tools-ia`
개발 서버: `npm run dev:worktree -- --port 9849` (DEV_SERVER_PORT=9849)

## 명령과 결과

```
cd C:/Users/USER/Downloads/rpg-zzu-system-tools-ia
set DEV_SERVER_PORT=9849&& npx playwright test test/e2e/oprn-event-command-picker.spec.ts test/e2e/oprn-modern-event-commands.spec.ts test/e2e/event-command-ui-preview.spec.ts --workers=1
```

9 passed / 0 failed, 종료 코드 0. 전체 로그: `e2e-playwright.txt`.
재작성 전 같은 3개 파일 = 9 failed (스토리보드 기본 표면을 모르는 유산 스펙).

## 무엇을 바꿨나

- 새 헬퍼 `test/e2e/eventStoryboardPicker.ts`
  - `openMapEventEditor` — 이벤트 레이어 + 맵 더블클릭으로 새 이벤트 편집기.
  - `openCommandPicker(page, "storyboard-cta" | "quick-next" | "toolbar-add")` — 피커 진입은 제품 CTA 세 개만.
  - `openSeededEventEditor(page, tile)` — 시드된 기존 이벤트를 맵에서 연다. 하니스용 커서 진단
    (`cursor-position`)으로 타일↔화면 좌표를 실측·보정하므로 매직 픽셀 상수가 없다.
    (`event-list-row-*` 사이드바 패널은 현재 워크스페이스 프리셋에 등록돼 있지 않아 진입 경로로 못 쓴다 —
    `oprn-event-delete-key.spec.ts`도 같은 이유로 이미 실패 중이다. 이 태스크 범위 밖의 선행 결함.)
  - `pickerGrid` — 즐겨찾기/최근 명령 섹션 중복을 피해 본 그리드만 집는다.
  - `showCommandList` — 목록은 보조 뷰. 인라인 편집/우클릭 메뉴를 볼 때만 명시 전환.
- `oprn-event-command-picker.spec.ts` (5 테스트)
  - 스토리보드 CTA → 피커 → 문장 표시 저작 → 카드/헤더 개수 확인. 취소는 피커를 살려 둔다.
  - `event-command-quick-next` / `event-command-toolbar-add` 도 같은 피커를 연다.
  - 탭4 IA: 그룹 헤딩이 `["시스템","도구"]` 뿐, 정보 행 0, disabled 0, 체크포인트 라벨 1개.
    선택 불가 행은 전 탭 검색에서만 `다른 곳: 빠른 저작` 안내와 함께 노출되고 Enter 로도 삽입되지 않는다.
  - 런타임 소유자 배지(interpreter/player/battle), 탭 화살표 키 이동, 검색 → Enter 삽입.
  - 목록 뷰에서 우클릭 메뉴 · 삽입 피커 · 스위치 레코드 피커 · 자동 트리거 안전 경고.
- `oprn-modern-event-commands.spec.ts` (2 테스트)
  - 재분류 후 실제 탭: 카메라 제어 = 탭3(화면 효과), 고급 대화 = 탭1(대화),
    UI 명령·데이터 조회 = 탭4(도구). 각 명령이 **다른 탭에는 없음**까지 확인.
  - 카메라 제어 편집 폼(mode/target/x/y)과 스토리보드 착지.
- `event-command-ui-preview.spec.ts` (2 테스트)
  - 스타터 마을 NPC 하드코딩 제거 → 빈 프로젝트 + 리뷰용 이벤트 시드(13 명령).
  - 얼굴 바꾸기: 4×4 칸 그리드에서 6번 칸 선택 → 미리보기 `data-face-index=5`, `얼굴 6 · 왼쪽`.
  - 12개 대표 명령의 한국어 요약 + 인스펙터 폼(상점 판매 목록 등) + 영문 토큰 누출 0.

## 폐기 확인 (유산 단언 0)

- 2열 그리드(`gridTemplateColumns` length === 2) 단언 없음.
- 모달 ≥1400×860 / 열 y 오차 / 800px 2열 단언 없음 (창 리사이즈·전체화면은
  `event-editor-responsive-mockup`, `event-editor-backdrop-persistence`, `eventEditorModalClose` 가 이미 덮는다).
- exact `조건` / `그래픽` / `실행 내용` 라벨 단언 없음.
- `event-command-empty-line` 은 **hidden 임을** 단언한다(스토리보드 기본값 계약). 더블클릭 진입 경로 없음.
- 탭4 버튼 24개 고정 없음 (개수 하한만).

## 손대지 않은 것

- 피커/미리보기 제품 코드(`commandPicker.ts`, `commandPreview.ts`), `loadStoryboardMode()` 기본값.
- 워크트리에 남아 있는 형제 태스크의 미커밋 제품 변경(`m2PickerLayout.ts`, `commandPresentation.ts`,
  `commandPicker.ts`, `test/m2EventCommandCatalog.test.ts`)은 커밋에 포함하지 않았다.
  탭 번호 단언(카메라 3 / 고급 대화 1 / UI·데이터 4)은 그 재분류가 적용된 트리에서 측정한 값이다.
