# 이벤트 명령 편집: 더블클릭 → 이미지 리치 모달 (설계 스펙)

날짜: 2026-07-06 · 작성: Claude(Opus) · 자문: codex(gpt-5.5) + agy(gemini) 합의 종합

## 목표
"실행 내용"(이벤트 명령 리스트)에서 명령 행을 **더블클릭**하면 지금처럼 인라인 아코디언(collapse)
이 펼쳐지는 게 아니라 **모달 편집 다이얼로그**가 뜬다. 모달은 **최대한 이미지 리치**하게:
좌측 폼 + 우측 RM2003 스킨 프리뷰 패널(종류별 시각화, 신규 커스텀 렌더러 4종 포함).

## 아키텍처 (3자 합의)
- 진입점 통일: 더블클릭/Enter/우클릭"편집" → `openEventCommandEditDialog({ initial: cmd, lockKind: true, onApply: e => actions.replaceCommand(path, e) })`.
- staged **딥클론**(`structuredClone`) 편집 → **확인(OK)에서만** `replaceCommand`. 취소/ESC/백드롭은 원본 불변 → undo 1스텝.
- **명령 종류 select 잠금(lockKind):** 기존 명령 편집 시 kind `<select>`를 숨김/비활성. 안 그러면 fork/choices/shop → 다른 kind 변경 시 `then/else/options[].branch/cancelBranch/transactionBranch` 유실. (신규 추가 다이얼로그는 kind 변경 유지.)
- **인라인 편집기 제거:** `.cmd-inline-editor` DOM/`toggleInlineEditor`/`.editing` 경로 제거. 컨텍스트 메뉴·키보드 편집도 모달로.

## 모달 골격
- 2열 그리드: 좌 `renderCommandBody`(기존 폼 재사용), 우 `.event-command-preview-panel`(RM2003 창 스킨 `applySystemGraphic`). `max-height:85vh`+내부 스크롤. 좁은 화면(예: `<720px`)이면 1열, 프리뷰가 폼 아래로.
- 프리뷰는 폼 로직 복제 금지: 입력이 staged command를 갱신할 때마다 **staged command를 다시 받아** `renderCommandPreview(staged)` 재렌더. 렌더러 없으면 요약 카드(명령 아이콘+summary) 폴백.
- 헤더: 명령 아이콘 + 명령명 + 현재 summary.

## 프리뷰 디스패처
`src/editor/panels/eventEditor/commandPreview.ts` (신규):
```
export function renderCommandPreview(cmd: Command, ctx: PreviewContext): HTMLElement
```
- kind별 렌더러 매핑. 모두 **missing-resource 폴백**(throw 금지, 기존 프리뷰 패턴처럼 "미리보기 없음" 카드).
- async(미니맵)는 **버전 가드**로 stale draw 방지.

### Core 재사용 (기존 컴포넌트)
| kind | 프리뷰 | 재사용 |
|---|---|---|
| text | 메시지창 목업(스킨+본문 줄바꿈+화자) | applySystemGraphic |
| changeFace | 70px 얼굴 크롭 + 좌/우 배치 | renderFacesetPreview |
| displayTextSettings | 위치/투명 반영 메시지창 목업 | applySystemGraphic |
| transfer(장소이동) | 목적지 미니맵+마커 | drawTransferMapPreview |
| changeItem/shop | 아이템 아이콘 그리드+가격 | renderSummaryIcon/resolveAssetResourceUrl |
| changeParty/battleProcessing | 배우 얼굴 / 적 아이콘 | resolveAssetResourceUrl |
| changeGold/switch/var/flag/timer/label/loop/terminal | 상태변화 뱃지·스트립·결과화면 목업 | (경량) |

### 신규 커스텀 렌더러 4종 (Core+헤비)
1. **moveEvent** `previewMoveRoute.ts`: 대상 스프라이트(renderEventGraphicIcon; @player=주인공 아이콘) + 이동명령 "테이프"(↑↑→↓ 방향칩) + repeat/wait/skip 뱃지. 궤적선(격자 위 경로) SVG.
2. **fork** `previewForkFlow.ts`: 조건 요약 뱃지 + then/else 분기 흐름도 카드(명령 수, else 유무). SVG/CSS 커넥터.
3. **showPicture** `previewPicture.ts`: 320×240 화면 목업 위에 그림 썸네일을 좌표/확대율/투명도로 배치 + 그림번호.
4. **audio** `previewAudio.ts`: BGM/SE 칩 + 볼륨/템포 막대 + 파형 장식(**자동재생 금지** — 시각 요약만).

## 가드 / 회귀 방지
- 버튼(↑↓x)·드래그 핸들 더블클릭이 모달을 열지 않게 `event.target.closest("button,.cmd-drag-handle")` 차단. 단일클릭 선택·우클릭 메뉴·드래그 유지.
- 중첩 모달 ESC: 최상위 하나만 닫힘(transfer 피커 등 열려도 부모 모달 유지). `openEventSubdialog` keydown이 topmost만 반응하도록.
- 닫힐 때 편집한 행(`.cmd-head[data-cmd-path]`)으로 포커스 복귀, detached면 skip.
- OK 직전 `commitPendingControls`로 blur 안 된 입력 반영(기존 로직 유지).

## 파일 변경
- 수정: `commandList.ts`(dblclick/Enter 재배선, 인라인 제거), `commandListContextMenu.ts`(toggleInlineEditor→openEditModal), `commandEditDialog.ts`(2열+preview+lockKind), `commandBody.ts`(lockKind시 kind select 숨김), `types.ts`(lockKind/PreviewContext), 스타일(`event-editor.modern.css` 인라인 제거+preview 패널).
- 신규: `commandPreview.ts`(디스패처), `previewMoveRoute.ts`, `previewForkFlow.ts`, `previewPicture.ts`, `previewAudio.ts`.
- 테스트: preview 디스패처/lockKind/분기 보존 vitest. 인라인 `.editing`을 쓰던 e2e 스펙을 모달 기준으로 갱신.

## 검증 게이트
- `tsc --noEmit` 0, vitest 통과.
- Playwright 증거: (1) 행 더블클릭→모달, `.cmd-inline-editor`/collapse 없음. (2) OK만 반영·취소/ESC 원복. (3) fork 조건 수정 후 분기 보존. (4) transfer 미니맵·changeFace 얼굴·text 메시지창 프리뷰 렌더. (5) 버튼 더블클릭이 모달 안 엶. (6) 중첩 ESC 최상위만. (7) 4종 커스텀 렌더러 각각 렌더.
