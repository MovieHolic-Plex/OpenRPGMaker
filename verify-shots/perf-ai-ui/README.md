# AI 조수 UI 성능 개선 — 2026-09-28

기준선은 `f9bbb5067`, 작업 브랜치는 `codex/perf-ai-ui`다. 삭제된 이전 워크트리의 수정 전 실측을 사용자 승인에 따라 재사용했고,
수정 후는 `/home/main/z-project/rpg-zzu-e03b-perf-ai-ui`에서 다시 측정했다. 각 구현 단위는 즉시 커밋했다.
`assistantSession.ts`와 `aiChatPanel.ts`의 store.subscribe/refreshAcceptance는 변경하지 않았다.

## 실측

시간은 호출당 ms, DOM은 `document.createElement` 호출 수다. Happy DOM에서 실제 렌더 함수를 호출했다.
1회 예열 후 보드/transcript/sidebar/studio는 30회, 활동 보기는 100회, 이름 검색은 2,000회, 복원은 3회 평균이다.
시간은 두 측정 시점의 공유 머신 부하 차이가 있으므로 DOM·조회·높이 읽기 횟수를 함께 본다.

| 경로·입력 | 수정 전 | 수정 후 |
|---|---:|---:|
| 비활성 스튜디오, 팀원 6명·기록 2,000건 | 14.2922ms / DOM 365 | 0.0008ms / DOM 0 |
| 숨긴 보드 목록, 팀원 6명 | 2.0443ms / DOM 48 | 0.0774ms / DOM 0 |
| 활동 2,000건, 동일 입력 | 1.1143ms | 0.0154ms |
| 활동 2,000건, 마지막 기록 교체 | 1.0379ms | 1.0054ms |
| 200행 transcript 앞 1행 제거·뒤 1행 추가 | 6.2521ms / DOM 200 | 0.3159ms / DOM 1 |
| trace가 보이는 작업 페인, 팀원 6명·옛 로그 200행 | 10.9874ms / DOM 249 | 0.1955ms / DOM 1 |
| sidebar 팀원 6명 중 1명 글자 갱신·기록 2,000건 | 2.4873ms / DOM 36 | 0.2983ms / DOM 0 |
| 대화 200건 복원 | 34.1508ms / 높이 읽기 200 | 31.0228ms / 높이 읽기 1 |
| 이름 2,000개, 반복 문장 검색 | 0.1262ms | 0.0003ms |
| 이름 2,000개, 서로 다른 문장 검색 | 0.1343ms | 0.0082ms |
| 저장된 run 20개, 현 run 갱신 | getAll 1 / get 0 / put 1 | getAll 0 / get 1 / put 1 |
| 이미지 200개, 무관한 텍스트 노드 변경 | 0.0201ms / 연결 확인 200 | 0.0025ms / 연결 확인 0 |

아카이브는 원본도 변경된 run만 put했다. 개선 대상은 매 flush의 전체 getAll과 용량 정리다.
수정 후 IndexedDB 호출 수는 fake-indexeddb로 실제 트랜잭션을 실행해 측정했다. 아카이브 시간은 서로 다른 모의 저장소 간 비교를 피하여 제외했다.
원시 수치는 `measurements.json`, 브라우저 결과는 `browser.json`에 있다. 임시 벤치·원본 비교 모듈은 커밋하지 않고 제거했다.

## 검증

직접 관련 13파일만 실행했다. **116개 중 110 통과, 기준선과 같은 실패 6개, 기존 미처리 예외 4개**다.
신규 성능 회귀 테스트 9개와 아카이브 테스트 3개는 모두 통과했다.
새 렌더 테스트의 Window는 실제 Happy DOM 객체라 `addEventListener`와 `removeEventListener`가 모두 있다.

```bash
node scripts/run-vitest.mjs test/aiUiPerformance.test.ts test/activityTraceArchive.test.ts test/aiActivityView.test.ts test/aiActivityBriefClutter.test.ts test/aiActivityTrace.test.ts test/aiTeamWorkPane.test.ts test/piAgentTeamBoardRender.test.ts test/piAgentTeamBoardLog.test.ts test/aiConversationLog.test.ts test/aiConversationReplay.test.ts test/aiAnswerLinks.test.ts test/aiAnswerLinkRender.test.ts test/aiStudioShell.test.ts --maxWorkers=2
```

기존 실패: `aiStudioShell.test.ts` 5건은 Fake DOM의 상태 글자가 undefined여서 `statusToneOf().trim()`에서 실패한다.
그 초기화 실패 뒤 suggestion 타이머가 남아 document 부재 예외 4건도 난다.
`piAgentTeamBoardRender.test.ts` 1건은 실제 종류 문구 `만들기`를 옛 단언 `시공`과 비교한다.
같은 기준선의 앞선 직접 실행에서는 이 6건과 별도로 Fake DOM nextSibling/insertBefore 실패 1건이 더 있었다.
이번 변경은 그 실패를 제거했다. 수정 전의 테스트가 숨긴 transcript를 조회하던 부분은 trace 없는 fallback fixture로 명시했고,
영구히 숨긴 보드 행 단언은 현재 보이는 활동 기록의 담당자·검수 지적·배정 payload 보존 단언으로 옮겼다.

추가로 원본 렌더러와 직접 대조한 임시 테스트 2개가 통과했다.
첫 테스트는 brief/detail/trace × live/history × 전체/actor × 8종, 총 96개의 2,000건 혼합 입력에서 표시 행·순서·안내 글자를 비교했다.
둘째는 440문장에서 긴 이름의 전역 우선순위, 교차 겹침, 한국어 조사 경계를 비교했다.
임시 계측 1개와 아카이브 테스트 3개를 함께 실행한 별도 실행도 4/4 통과했다.

```bash
node scripts/run-vitest.mjs test/aiUiEquivalenceTemporary.test.ts --maxWorkers=1
node scripts/run-vitest.mjs test/aiUiPerfTemporary.test.ts test/activityTraceArchive.test.ts --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.app.json
```

앱 타입 검사는 exit 0, 오류 0개로 완료했다. `git diff --check f9bbb5067..HEAD`도 통과했다.

Chromium은 실제 컴포넌트와 편집기 CSS를 임시 fixture에서 열었다. 팀원 선택·포커스 유지·검색·50행 창·숨긴 transcript 0행을 확인했고 페이지 오류는 0개다.
`ai-panels.png`는 그 화면이다. 전체 게임 저작이나 라이브 LLM 호출을 검증한 증거는 아니다.

## 변경 파일

- `src/ai/activityTraceArchive.ts`
- `src/editor/aiAnswerLinks.ts`
- `src/editor/panels/aiActivityIndex.ts`
- `src/editor/panels/aiActivityMedia.ts`
- `src/editor/panels/aiActivityView.ts`
- `src/editor/panels/aiChatPanel.ts` — 복원 호출 세 곳만
- `src/editor/panels/aiConversationLog.ts`
- `src/editor/panels/aiKeyedRows.ts`
- `src/editor/panels/aiStudioShell.ts`
- `src/editor/panels/aiTeamBoard.ts`
- `src/editor/panels/aiTeamSidebar.ts`
- `src/editor/panels/aiTeamTranscript.ts`
- `src/editor/panels/aiTeamWorkPane.ts`
- `test/activityTraceArchive.test.ts`
- `test/aiStudioShell.test.ts`
- `test/aiTeamWorkPane.test.ts`
- `test/aiUiPerformance.test.ts`
- `test/piAgentTeamBoardRender.test.ts`
- `openwiki/editor-ai-panel.md`
- `verify-shots/perf-ai-ui/{README.md,measurements.json,browser.json,ai-panels.png}`

## 남은 한계

- 캐시는 기존 불변 entries/색인 계약에 의존한다. 원소를 제자리 변경하는 생산자를 추가하면 무효화도 함께 수정해야 한다.
- 진행 중인 run의 용량 증가는 다음 저빈도 정리까지 일시적으로 저장 상한을 넘을 수 있다. 새 run과 종료 전환은 즉시 정리한다.
- 새 활동 입력은 공유 색인 생성에 O(N) 순회가 남고, 활동 기록·말풍선 자체의 렌더는 필요한 만큼 수행한다.
- 전체 gates/전체 스위트는 요청 범위 밖이라 실행하지 않았다. 위 6건의 기존 실패도 이 작업에서 고치지 않았다.
