# DB 편집기 치명 UX 3건 수정 계획 (압축 실행)

> **For agentic workers:** 배치 실행용 압축 계획 — 태스크별 커밋, TDD.

**Goal:** 적대적 UX 검증에서 확인된 데이터베이스 편집기 치명 3건(C1 버리기 후 undo 부활, C2 저장 모델 겉속 불일치, C3 무확인 삭제)을 수정한다.

**Architecture:** C1은 mapEditHistory에 깊이 조회/절단 API를 추가해 dirty 세션 discard가 편집 중 쌓인 스냅샷을 되감게 한다. C2는 자동 저장이 사실이므로 UI를 정직하게 재편(중복 취소 버튼 제거, 문구를 자동 저장 현실로, dirty 프롬프트를 "열 때 상태로 되돌리기" 의미로). C3는 삭제 버튼을 2단계 확인(같은 버튼 재클릭)으로 바꾸고 성공 시 undo 안내 토스트를 띄운다.

## Global Constraints
- 브랜치: `fix/db-critical-ux` (main a9c06c6에서 분기). 커밋 메시지 한국어 + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- vitest는 `--configLoader runner` 필수. `test/aiLlmClient.test.ts` 실패는 환경 요인.
- `window.confirm` 금지(코드베이스 미사용 관례) — 2단계 버튼 방식.
- DOM 테스트는 기존 database 테스트 파일들의 관례(test/fakeDom.ts 등)를 따른다.

---

### Task A (C1): discard가 undo 히스토리를 되감는다

**Files:** Modify `src/editor/mapEditHistory.ts`, `src/editor/panels/databaseModalDirtySession.ts`; Test `test/databaseModalDirtySession.test.ts`.

1. `mapEditHistory.ts`에 추가:
```ts
/** 현재 undo 스택 깊이 — 세션 시작 시점 기록용(databaseModalDirtySession). */
export function getMapEditHistoryDepth(): number {
  return undoStack.length;
}

/**
 * undo 스택을 depth 개로 절단하고 redo 스택을 비운다. 모달류 편집 세션의
 * discard(열 때 상태로 복원)가 세션 중 쌓인 스냅샷을 폐기해, 폐기한 변경이
 * 이후 Ctrl+Z로 되살아나는 것을 막는다. MAX_HISTORY shift로 기준 깊이가
 * 이미 밀려났으면 현재 길이 이하로만 절단한다(과잉 보존은 허용, 과잉 삭제 금지).
 */
export function truncateMapEditHistoryToDepth(depth: number): void {
  const target = Math.max(0, Math.min(depth, undoStack.length));
  if (undoStack.length > target) undoStack.length = target;
  redoStack = [];
  topSignature = historyTopSignature();
  lastCoalesceKey = null;
  emitHistoryChange();
}
```
(내부 심볼명 `undoStack`/`redoStack`/`topSignature`/`lastCoalesceKey`/`historyTopSignature`/`emitHistoryChange`는 파일 실제 이름 기준 — 다르면 실제 이름 사용.)

2. `databaseModalDirtySession.ts`: 세션 생성 시 `const historyDepthAtOpen = getMapEditHistoryDepth();` 기록, `discard()`에서 `store.replace(...)` 후 `truncateMapEditHistoryToDepth(historyDepthAtOpen);` 호출. markClean은 손대지 않는다(저장 유지 시 히스토리는 정당).

3. 테스트(`test/databaseModalDirtySession.test.ts`에 추가) — 시나리오: 세션 열기 → `updateDatabaseRecord`로 필드 2회 편집(스냅샷 쌓임) → `discard()` → (a) 프로젝트가 열 때 상태 (b) `getMapEditHistoryState().canUndo`가 세션 이전과 동일(세션 중 스냅샷 소멸) (c) undo 실행해도 폐기한 편집이 부활하지 않음. 기존 테스트 파일의 스토어/히스토리 리셋 관례(beforeEach의 resetMapEditHistory 등)를 따른다.

커밋: `fix(db): 버리기 시 undo 히스토리 되감기 — 폐기 변경의 Ctrl+Z 부활 차단`

---

### Task B (C2): 저장 모델 UI 정직화

**Files:** Modify `src/editor/panels/databaseModal.ts`, `src/editor/panels/databaseWorkbench.ts`; Test 신규 `test/databaseModalFooter.test.ts`(또는 기존 database 모달 테스트 파일 관례).

현실: 모든 편집은 `store.update`→자동 저장. "적용"=`store.flush()` 즉시 저장. 닫기/취소/x가 전부 동일 동작(requestClose)이었다.

1. `databaseWorkbench.ts` `databaseFooterStatusText()`:
```ts
export function databaseFooterStatusText(): string {
  return "변경은 즉시 반영되고 자동 저장됩니다. 실수는 Ctrl+Z, 또는 닫을 때 '열 때 상태로 되돌리기'를 선택하세요.";
}
```
("OK" 언급 제거 — 존재하지 않는 버튼 안내였음.)

2. `databaseModal.ts`:
- **취소 버튼 제거**(닫기와 동일 동작이던 중복). `bindCancelButton` 호출부도 제거(컨트롤러의 Escape/backdrop 경로는 유지).
- "적용" 라벨 → **"지금 저장"** (동작 동일: saveAndMarkClean). testid는 유지(테스트 호환).
- dirty 프롬프트 문구 교체 — `renderDirtyPrompt`:
  - strong: "이 세션에서 바뀐 내용이 있습니다. 어떻게 할까요?" (기존 "저장하지 않은 DB 변경이 있습니다."는 자동 저장 현실과 모순)
  - 버튼: "저장하고 닫기"(기존 Save 동작) / **"열 때 상태로 되돌리고 닫기"**(기존 Discard 동작) / "계속 편집". testid 3종 유지.
  - `closeAttemptMessage`의 "닫기 전에 저장하거나…" 계열 문구도 새 의미("되돌리기는 이 모달을 연 시점의 DB 상태로 복구합니다")로 정리.
- footer의 도움말 버튼은 이번 스코프 밖(변경 금지).

3. 테스트: 모달 열기(fakeDom) → (a) 푸터에 "자동 저장" 문구 존재, "OK" 문구 부재 (b) 푸터 버튼이 닫기/지금 저장/도움말 3개(취소 부재) (c) dirty 상태에서 닫기 시도 → 프롬프트에 "열 때 상태로 되돌리고 닫기" 버튼 존재. 기존 databaseModal 관련 테스트가 "취소" 버튼이나 옛 문구를 단언하면 새 계약으로 갱신.

커밋: `fix(db): 저장 모델 UI 정직화 — 자동 저장 명시·중복 취소 제거·되돌리기 의미 명확화`

---

### Task C (C3): 삭제 2단계 확인 + undo 안내

**Files:** Modify `src/editor/panels/databaseRecordViews.ts`(삭제 버튼 핸들러); Test 기존 database 레코드 테스트 파일 관례에 추가.

1. 삭제 버튼을 2단계 상태 머신으로: 첫 클릭 → 버튼 텍스트 "정말 삭제?"·class에 `confirming` 추가, 3초(또는 blur/다른 조작) 내 재클릭 → 실제 삭제. 3초 경과 시 원상 복구. `window.setTimeout` 사용, 레코드 목록 rerender 시 상태 초기화되는 것은 허용(자연 리셋).
```ts
// 삭제는 즉시 실행하지 않는다 — 같은 버튼을 3초 안에 한 번 더 눌러 확정(2단계 확인).
let deleteArmedUntil = 0;
// click 핸들러 내부:
const now = Date.now();
if (now > deleteArmedUntil) {
  deleteArmedUntil = now + 3000;
  button.textContent = "정말 삭제?";
  button.classList.add("confirming");
  window.setTimeout(() => {
    if (Date.now() >= deleteArmedUntil) { button.textContent = "삭제"; button.classList.remove("confirming"); }
  }, 3100);
  return;
}
```
(실제 코드 구조는 파일의 el() 빌더 관례에 맞춰 조정 — 의미 유지.)
2. 삭제 성공 시: `toast("삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.", "ok")` (실패 토스트는 기존 유지).
3. 테스트: (a) 1클릭으로는 레코드가 삭제되지 않고 버튼이 "정말 삭제?"로 변함 (b) 2클릭으로 삭제됨 (c) 참조 가드 실패 경로는 기존 동작 유지.

커밋: `fix(db): 삭제 2단계 확인 + Ctrl+Z 안내 토스트 — 원클릭 소실 차단`

---

### 마무리 검증
- 만진 테스트 파일 전체 + `npx tsc --noEmit -p tsconfig.app.json`.
- 전체 스위트 1회 실행해 실패 목록이 main 기준과 동일한지(신규 실패 0) 확인 — base 워크트리 대조까지는 불요(변경 표면이 좁음), 실패 목록 diff로 충분.
