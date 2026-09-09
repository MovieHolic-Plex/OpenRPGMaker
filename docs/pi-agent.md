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
- **팀**: `/pi team 마을 셋을 지어라` — 팀장 에이전트가 맵을 나눠 시공·검수 에이전트를 띄운다. `/pi team map_a,map_b …` 는 후보 맵 제한.
- 헤드리스: `bun scripts/pi-agent.mts --project game.json --task "..." --maps map_a,map_b --out out.json --report report.json`
  (`--blank map_a:24x18,map_b:24x18` 로 빈 프로젝트에서 시작할 수도 있다. `--team` 이면 팀 모드. 게이트 실패는 종료 코드 2.)

## 팀 (하네스처럼 역할을 선언한다)

역할은 `src/ai/piAgent/team.ts` 에 선언돼 있다. 역할 = 프롬프트 + 툴 범위 + 턴 상한.

| 역할 | 툴 | 하는 일 |
| --- | --- | --- |
| 팀장 `orchestrator` | 읽기 3종 + `assign_map_agent` · `review_map` · `finish` | 지시를 맵 단위 작업으로 쪼개 **한 턴에 여러 개** 배정(코어가 병렬 실행), 검수 시키고, 지적이 있으면 수정 배정(맵당 최대 2회), 끝나면 보고 |
| 시공 `builder` | 레지스트리 전부 | 팀장이 준 맵 하나에서만 일한다. 결과는 맵 묶음으로 작업 사본에 병합, 범위 밖은 버리고 보고 |
| 검수 `reviewer` | 읽기 툴만 + `report_review` | 구조물·길·겹침·lint 를 확인하고 ok/findings 를 보고 |

런타임은 `scripts/lib/piTeamRuntime.ts`. 하위 에이전트는 `runPiAgent` 를 그대로 재사용하고, 팀장의 커스텀 툴 셋만 이 파일에 있다.

### 팀원은 사용자가 정한다

팀원 명세(`src/ai/piAgent/teamSpec.ts`)는 코딩 하네스의 에이전트 정의처럼 **이름 + 종류(시공/검수) + 소개 + 프롬프트 + 툴 도메인 + 턴 상한 (+ 모델)** 이다.
`localStorage(oprn:pi-team)` 에 저장되고(`teamSpecStore.ts`), `/pi team` 요청에 실려 Bun 워커로 간다. 팀장은 `assign_map_agent(member)` /
`review_map(member)` 로 팀원을 고른다. 툴 인자의 `enum` 이 켜진 팀원 id 로 제한되어 없는 팀원을 부를 수 없다. 기본 팀은 시공·장식(꺼짐)·검수.
헤드리스는 `--team-spec team.json`.

실측(2026-09-09): 사용자가 패널에서 「정원사」를 추가하고 장식을 켠 뒤 `/pi team 집 한 채와 길, 주변을 정원사가 꾸며라` 를 보내자
팀장이 시공 → 정원사 → 검수 순으로 배정했고, 정원사 행에 그 팀원의 보고가 실렸다. 새로 고침 뒤에도 명단이 남는다.

## 팀 패널 (접힌 막대)

데크 레일 바로 아래에 **접힌 막대**로 산다(`src/editor/panels/aiTeamPanel.ts`, 스타일 `21-team-panel.css`). 유휴 상태에서도 보이므로
사용자는 팀이 있고 무엇을 하는지 한 줄로 안다.

| 상태 | 막대 문구 |
| --- | --- |
| 유휴 | `팀  시공 · 검수 · 대기` |
| 실행 중 | `팀 ◌ 팀장 지휘 중 · 시공 1건 완료 · 정원사 1명 작업 중` (스피너, 액센트색) |
| 끝난 뒤 | `… · 대기 · 마지막 작업 적용됨` |

펼치면(패널 폭이 열린 폭으로 넘어간다) 세 구획: **지금**(팀장·팀원별 진행 — 작업 중 인원, 최근 3건의 맵·한 줄), **팀원**(명단 편집: 켜기/끄기,
편집 폼 — 이름·종류·소개·프롬프트·도구 범위 칩·턴 상한·모델, 추가, 삭제, 기본 팀으로), **팀장 지침**(자유 텍스트, 팀장 프롬프트에 붙는다).

![접힌 막대(유휴)](images/pi-team/panel-collapsed-idle.png)
![접힌 막대(실행 중)](images/pi-team/panel-collapsed-running.png)
![펼친 패널(실행 중)](images/pi-team/panel-expanded-running.png)
![팀원 편집 폼](images/pi-team/member-edit-form.png)

## 팀 보드 (UI)

`/pi` 실행은 로그 안에 **팀 보드** 카드로 그려진다(`src/editor/panels/aiTeamBoard.ts`, 상태는 순수 리듀서
`src/ai/piAgent/teamBoardState.ts`). 에이전트마다 행 하나: 역할 배지(팀장·시공·검수), 맵, 상태(대기·실행 중·완료·실패·중단),
턴·툴콜·소요 시간, 마지막 한 줄(툴 결과는 고정폭, 말은 본문체). 검수 행은 통과/지적 목록, 시공 행은 팀장이 쓴 작업 지시(두 줄 접힘,
눌러 펼침)와 범위 밖 변경·충돌 경고. 머리에는 단계 알약과 합계, 발에는 팀장 보고와 적용 결과. 실행 중엔 경과 시간이 1초마다 간다.
단일 `/pi` 도 같은 보드를 쓴다(행 하나). 패널의 중단 버튼이 그대로 붙는다.

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

- 팀 내 **같은 맵의 다른 구역**을 두 시공 에이전트가 맡는 분할(지금은 맵 하나 = 에이전트 하나). 구역 잠금이나 id 네임스페이스가 먼저 필요하다.
- 데이터베이스(NPC·아이템) 작업의 팀 분할. 맵 묶음 병합은 맵만 안다.
- 팀원 명세의 프로젝트 단위 저장·공유(지금은 브라우저 localStorage).
- 팀원이 쓸 수 있는 커스텀 툴(레지스트리 밖) 선언.

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
| CLI `--team`, 빈 맵 2장 | 58초. 팀장이 시공 2개 병렬 → 검수 2개 병렬 → 통과 → finish. 시공 하나가 남의 맵을 건드렸고 병합이 버리고 보고 |
| 브라우저 `/pi team`, 100×100 마을 맵 | 93초, 팀장·시공·검수 3행, 툴콜 36, 적용됨 |
| 브라우저 `/pi team`, 40×40 숲 맵 | 213초, 검수 지적 1건 → 수정 시공(범위 밖 tilesets 변경 버림) → 재검수 통과. 5행, 툴콜 85 |
| 브라우저 팀 패널: 정원사 추가 → 새로 고침 → `/pi team` | 명단 유지. 122초, 팀장이 시공 → 정원사 → 검수 순 배정, 막대가 단계별로 문구를 바꿈, 적용됨 |
