# AI 조수 UI 성능 개선 — 2026-09-28

**검증 권한 정정:** 사용자의 후속 지시에 따라 정정 이후 Vitest·tsc·gates는 실행하지 않았다.
아래 기존 테스트/타입 검사 결과는 정정 이전 실행 기록이며, 현재의 실행 허가를 뜻하지 않는다.
정정 이후에는 Node+Chromium 실측과 테스트 코드 읽기만 수행했다. 테스트 파일도 이번 후속 작업에서는 변경하지 않았다.

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

## 정정 이전 검증 기록

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


## 정정 이후: 테스트 실행기 없는 브라우저 전후 실측

명령은 워크트리에서 `npm run dev:worktree`, `node test/ai-ui-browser-measure/run.mjs`였다.
임시 스크립트/HTML/원본 모듈 사본은 실측 뒤 제거했으며 커밋하지 않았다.
기준선 `f9bbb5067`의 대상 모듈과 그 대상 간 의존성을 임시 경로로 복원하고, 기준선/현재를 각각 새 Chromium 컨텍스트에서 실행했다.
현재 코드는 `b7073513c`와 동일하다. 스타일 없는 실제 DOM과 실제 IndexedDB를 사용했다.
복원 비용은 실제 scrollHeight 읽기를 계수하면서 브라우저 레이아웃도 수행한다.
표시 코드가 요청한 이미지 observer 콜백은 무관한 텍스트 노드 변경 레코드로 100회 직접 계측했다.
전체 문서 초기화·모듈 로딩 시간은 호출당 시간에 포함하지 않는다. 각 경로의 예열·반복 수는 위 실측 절과 같다.
원시 기록: `browser-measurements.json`. 양쪽 `pageerror`는 0개다.

| 경로 | 수정 전 | 수정 후 |
|---|---:|---:|
| 동일 활동 입력 2,000건 | 0.952ms | 0.001ms |
| 새 활동 입력 2,000건 | 0.936ms | 0.455ms |
| 숨긴 팀 보드 6명 | DOM48 / 0.450ms | DOM0 / 0.020ms |
| transcript 200행 한 행 추가 | DOM200 / 6.417ms | DOM1 / 3.193ms |
| 숨긴 transcript 포함 작업 페인 | DOM249 / 1.923ms | DOM1 / 0.040ms |
| 팀원 6명 중 한 명 갱신 | DOM36 / 0.797ms | DOM0 / 0.030ms |
| 비활성 스튜디오 | DOM365 | DOM0 |
| 대화 200건 복원 | 높이 읽기200 / 51.900ms | 높이 읽기1 / 10.567ms |
| 이름 2,000개, 반복 문장 | 0.1109ms | 0.0002ms |
| 이름 2,000개, 새 문장 | 0.1261ms | 0.0075ms |
| run20개 중 현재 run 저장 | getAll1 / get0 / put1 | getAll0 / get1 / put1 |
| 이미지200개, 무관한 DOM 변경 | 연결 확인200 | 연결 확인0 |

원시 JSON의 일부 0ms는 타이머 분해능 아래였다는 뜻이며, 비용이 물리적으로 0이라는 뜻은 아니다.
특히 transcript는 DOM 생성이 1개여도 보이는 목록의 레이아웃·스크롤 비용이 남는다.

## 정정 이후: 실행 없는 테스트 계약 검토

| 파일 | 코드에서 확인한 계약 |
|---|---|
| `test/aiUiPerformance.test.ts` | 실제 Happy DOM Window의 add/removeEventListener, stable ordinal, 숨김→표시 갱신, 버튼 동일성·포커스 |
| `test/aiActivityView.test.ts` | 네 표시 수준, 실패 회복 표시, 변경 없는 행·펼친 payload 보존 |
| `test/aiActivityBriefClutter.test.ts` | 조회 이미지 제외, 로딩 중 URL 보호, 처음 부착 전 유예 |
| `test/aiTeamWorkPane.test.ts` | trace 없는 fallback에서 이전 transcript 계약, 고정 선택, 검토 동작 유지 |
| `test/aiAnswerLinks.test.ts` | 긴 이름 우선, 겹침 배제, 한국어 조사와 합성어 거부 |
| `test/aiConversationLog.test.ts` | 원래 행·마크다운·작업 sink 계약; 배치 모드는 스크롤만 모음 |
| `test/activityTraceArchive.test.ts` | 같은 트랜잭션의 serial 비교, 정리 시점, 쓰기 실패 및 재시도 표시 |

재실행 없이 남겨 둔 위험:
- `test/aiStudioShell.test.ts`: Fake DOM의 undefined 상태 글자와 초기화 실패 후 타이머 정리는 이전에 실패했고, 관련 생산 코드를 변경하지 않아 같은 실패 가능성이 남는다.
- `test/piAgentTeamBoardRender.test.ts`: 「지금」 팀원 종류를 `시공`으로 기대하는 단언과 실제 `만들기` 문구의 불일치가 남아 있다.
- `test/aiActivityBriefClutter.test.ts`, `test/aiUiPerformance.test.ts`: 이미지 수명·MutationObserver 비동기 계약은 코드로 확인했지만 이번 후속 턴에서 테스트 실행으로 재확인하지 않았다.
