# Pi 에이전트 경로 (실험)

기존 브라우저 세션 루프(`src/ai/assistantSession.ts`)와 **나란히** 놓인 두 번째 실행 경로다.
루프는 Bun 쪽 `@oh-my-pi/pi-agent-core` 가 돌리고, 툴·커밋 게이트·적용 함수는 기존 것을 그대로 쓴다.

```
브라우저  /pi <지시>  ──POST /v1/agent/run──▶  vite 동반 미들웨어(Node)
                                                 │ resolveRequestApiKey(provider)
                                                 ▼
                                          Bun 워커 /agent/run  ──▶ runPiAgent()
                                                 │   oh-my-pi Agent + 레지스트리 툴 206개
                                                 │   프로젝트 사본 위에서 끝까지 실행
                                                 ▼
                     NDJSON 진행 이벤트 … 마지막 `done` 에 결과 프로젝트
브라우저  mergeMapBundles() → applyProposedProject()  (커밋 게이트·undo·저장 동일)
```

## 쓰는 법

- 채팅 패널: `/pi 집 한 채와 길` — 현재 맵 범위. `/pi map_a,map_b 집 한 채` — 맵마다 에이전트 하나씩 병렬.
- 헤드리스: `bun scripts/pi-agent.mts --project game.json --task "..." --maps map_a,map_b --out out.json --report report.json`
  (`--blank map_a:24x18,map_b:24x18` 로 빈 프로젝트에서 시작할 수도 있다. 게이트 실패는 종료 코드 2.)

## 파일

| 위치 | 역할 | 런타임 |
| --- | --- | --- |
| `src/ai/piAgent/protocol.ts` | 요청·이벤트 규약, NDJSON 디코더, 변경 키 계산 | 어디서나 |
| `src/ai/piAgent/toolAdapter.ts` | 레지스트리 툴 → Pi 툴 모양. `ok:false` 를 예외로 옮김 | 어디서나 |
| `src/ai/piAgent/mapBundle.ts` | 맵 묶음(맵 + mapTree 부분 트리) 분할·병합·spill 감사 | 어디서나 |
| `src/ai/piAgent/systemPrompt.ts` | 범위·절차만 담은 기본 시스템 프롬프트 | 어디서나 |
| `src/ai/piAgent/client.ts` | 브라우저 → 동반 서비스 스트림 클라이언트 | 브라우저 |
| `src/editor/panels/aiPiAgentCommand.ts` | `/pi` 파서와 실행·적용 | 브라우저 |
| `scripts/lib/piAgentRuntime.ts` | **oh-my-pi 코어를 아는 유일한 파일.** 코어를 바꾸려면 여기만 | Bun |
| `scripts/oh-my-pi-worker.ts` `/agent/run` | 워커 스트리밍 경로 | Bun |
| `scripts/lib/ohMyPiHttp.mjs` `/v1/agent/run` | 동반 라우터, `writeCompanionResult` 의 NDJSON 통과 | Node |
| `scripts/pi-agent.mts` | 헤드리스 CLI | Bun |

## 왜 맵 묶음인가

집 시공이 `linked-interior` 를 고르면 실내 맵을 새로 만들고 부모 맵의 mapTree 자식으로 단다.
`maps.<id>` 한 키만 옮기면 실내 맵과 트리 항목이 떨어진다(2026-09-09 실측). 그래서 묶음은
mapTree 부분 트리로 정의하고, 묶음 밖 변경은 버린 뒤 `spills` 로 보고한다. 최종 무결성은
`commitChangeset` 게이트가 판정한다.

## 아직 없는 것

- 세션 전용 하네스 도구(수용 장부, `verify_npc_reward`, 외형 생성 핸드오프, 원문 컨텍스트, `show_map_region` 이미지 렌더)와
  작업 계획·의도 선언·독립 리뷰·체크포인트. 전부 `assistantSession.ts` 안에 있다.
- 병렬 에이전트가 같은 맵을 바꿨을 때의 병합 전략. 지금은 뒤의 결과가 이기고 `conflicts` 로 알린다(파서는 중복 id 를 접는다).

## 중단

패널의 기존 중단 버튼(`ai-abort`)이 `/pi` 실행에도 붙는다. 브라우저 fetch 취소 → vite 미들웨어가 `res.close` 로
신호를 만들어 어댑터 fetch 취소 → Bun 워커 `request.signal` → `agent.abort()`. 워커 stderr 에
`[pi-agent] aborted by client after N turns / M tool calls` 가 남는다. 중단 시 아무것도 적용하지 않는다.

## 실측 (2026-09-09, Antigravity gemini-3.7-flash, 도구 206개)

| 경로 | 결과 |
| --- | --- |
| CLI, 빈 24×18 맵 2장 병렬 | 19초, 툴콜 5+4, 실패 0. 실내 맵 2개·mapTree 보존, 게이트 통과(경고만) |
| 브라우저 `/pi`, 100×100 마을 맵 | 18.5초, 툴콜 4, 집+길 시공 후 store 에 적용 |
| 브라우저 `/pi` 중 중단 버튼 | 첫 툴 결과 뒤 클릭 → 두 안내 말풍선이 18ms 간격으로 붙고 적용 없음. 워커도 2턴/1툴콜에서 멈춤 |
