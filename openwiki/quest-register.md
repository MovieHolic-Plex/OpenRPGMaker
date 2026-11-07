# 퀘스트 등록 — 이벤트로만 지은 부탁을 project.quests 로 (2026-11-07)

플레이어 퀘스트 로그(`src/player/questLog.ts`)는 `project.quests` 만 읽는다. 저장된 게임 17개 중 퀘스트를 등록한
게임은 Fallen Star(chrono-bell, 7개) 하나였다. 나머지는 부탁·심부름 흐름을 이벤트(스위치·변수·아이템)로만 지어서
로그가 비었다. 문제는 로그가 아니라 **저자가 어느 이벤트가 퀘스트인지 선언하지 않는 것**이다.

## 무엇이 있나

| 누가 | 무엇 | 어디 |
|---|---|---|
| 조수·코딩 에이전트(선언) | 게임 짓기 규칙 「3b. Register request arcs as quests」 | `src/ai/agentRules.ts` `REGISTER_QUESTS_RULE` → `npm run agent-rules:skill` |
| 조수(도구) | `find_quest_candidates`(읽기) · `register_quest_candidate`(쓰기) | `src/editor/tools/questTools.ts` |
| 편집기 사용자(제안) | 자료집 → 개요 「퀘스트 제안」 — 후보마다 「퀘스트로 등록」 한 번 | `src/editor/panels/databaseOverviewQuestSuggestions.ts` |
| 검사기(경고) | `qa:game check` 의 `quest-unregistered` **경고**(막힘 아님) | `src/qa/gameCheck/index.ts` |
| 탐지기(순수) | `findQuestCandidates` / `pendingQuestCandidates` / `registerQuestCandidate` | `src/project/quest/questCandidates.ts` |

조수의 완료 가드(`adventureCompletionProblems`)에는 넣지 않았다 — 그 목록은 막는 목록이고, 탐지기 정밀도가 100% 가 아니다.
코딩 에이전트(Terra 루프)가 실제로 돌리는 검사는 `~/claude-viz/save-check/check.py`(저장소 밖)다. 그쪽은 이 저장소의
`qa:game check` 경고와 같은 함수를 부르는 별도 항목으로 다룬다(아래 「다루지 않는 것」).

## 탐지 규칙

세 조각이 다 있어야 후보다. 게임별 상수는 없다.

1. **부탁** — 그림이 보이는 이벤트의 **조사(action) 페이지**에서, 문장 **끝**이 부탁 어미(「…줘」「…줄래」「…받아 오겠니」「부탁해」 등)인 대사.
   쪽지·표지판·투명 이벤트·자동 실행 장면의 「…해 줘」는 부탁자가 아니다. 문장 가운데 「부탁할 사람이」는 부탁이 아니다.
2. **수행** — 다른 이벤트가 진행 값을 쓴다: `setSwitch true`, `setVariable +=`(`= n` 은 이야기 단계 기계라 세지 않는다), `changeItem +=`.
3. **보고** — 조사 페이지가 그 값을 페이지 조건이나 `fork` 로 읽고 반응한다. 그리고 **「아직」 쪽이 있어야 한다**(앞 페이지가 조건 없이 먼저 답하거나, `fork` 에 else·형제 분기가 있다).
   부탁 이벤트가 보고 자리이거나, 부탁 대사가 보고·수행 이벤트의 이름을 부를 때만 셋을 묶는다.
   한 부탁자·한 보고 자리는 후보 하나만 낸다.

신뢰도는 신호 합이다(부탁자=보고자, 보상·엔딩·합류, 다른 맵, 수행 2곳 이상, 그림). 제안 기준 `QUEST_CANDIDATE_MIN_CONFIDENCE = 0.6`.
등록은 `QuestGraphDef`(노드마다 `completesWhen` = 이벤트가 이미 쓰는 스위치/변수)로 한다. 이벤트는 바꾸지 않는다.
아이템으로만 끝나는 흐름은 그래프 조건으로 못 옮겨 `registrable:false` 다(화면 버튼 비활성).

## 측정 (2026-11-07)

정답표는 탐지기 코드를 쓰기 **전에** 사람이 이벤트를 읽고 정했다 — Terra 13개·시타마치는 직접, emerald·first-love·chrono-bell 은
탐지기를 모르는 별도 판정자. 정답표: `test/fixtures/quest-candidates/labels/*.json`, 분할: `split.json`.
조정은 조정 절반(8개)에서만 했고, 탐지기를 고정한 뒤 보고 절반(9개)을 한 번 쟀다.

```
bun scripts/content/measure-quest-candidates.mts <games root> --split tune|report|all [--json out.json]
# <games root>/<game>/project.json  (save-check 로더 출력)
```

| 묶음 | 게임 | 맞힘 | 오탐 | 놓침 | 정밀도 | 재현율 |
|---|---|---|---|---|---|---|
| 조정 | 8 | 6 | 2 | 1 | 75.0% | 85.7% |
| 보고(고정 후 1회) | 9 | 7 | 1 | 9 | 87.5% | 43.8% |
| 전체 | 17 | 13 | 3 | 10 | 81.3% | 56.5% |

- 놓친 10개 중 9개가 chrono-bell 이다. 그 게임의 퀘스트는 게시판·공용 이벤트·여러 맵 이름 호출로 이어져 이 규칙(부탁 어미 + 이름 호출)이 못 잇는다.
- 오탐 3개: 시타마치 지호 「시식해 줘.」(호감 장면), emerald 라이벌 「첫 동료부터 받아 와!」(안내), first-love 오 팀장 「…가져와요.」(이야기 단계). 자세한 표는 `~/claude-viz/quest-register.html`.
- Terra 13개: 퀘스트로 판정한 9개 중 8개를 찾았고 오탐 0. 놓친 하나(별빛 장치)는 보고가 장치 자리에서 끝나 부탁자로 돌아오지 않는다.

테스트(`test/questCandidates.test.ts`)는 저장된 게임 14개의 축소본(`projects/`)으로 게임별 맞힘·오탐 목록, 한 번 등록 후 로그가 차는 것,
`qa:game` 경고가 퀘스트 0개+후보일 때만 경고(막힘 아님)인 것을 잡는다. 큰 참고 게임 셋은 크기 때문에 측정 스크립트로만 잰다.

## 다루지 않는 것

- 저장소 밖 `~/claude-viz/save-check/check.py` 에는 항목을 넣지 않았다 — 그 검사기는 고정본(`checker-pinned`)으로 루프가 돈다.
- 등록한 초안의 단계 문구는 「<맵>의 <이벤트> — 해결한다」 꼴이다. 다듬기는 `define_quest` 로 같은 id 를 다시 쓴다.
- 탐지기는 공용 이벤트(commonEvents) 안의 대사·쓰기를 보지 않는다.
