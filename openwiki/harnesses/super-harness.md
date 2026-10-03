# 슈퍼하네스 (super-harness) — 개념 카드 자동 공급

사람이 큐만 보고, 에이전트가 「조수가 모르는 낱말」을 스스로 찾아 개념 카드로 만들어 공용 번들에 굽는 지휘자 하네스.
화면: **http://mdc-server:18315/** (systemd --user `super-harness.service`, 코드 `src/harnesses/super-harness/`).

## 왜 (2026-10-03 실측)

「미궁을 만들어줘」를 조수에게 3판 시켰다(`qa:game gen --text`).
- 세 판 모두 배치 품질 검사(빈 바닥 ≤30%·좌우 대칭 ≤2.2)에 걸렸다. 쓸데없는 기물은 대부분 그 수리 턴에서 들어왔다(신전 건물·나무·고문대·용암 화로…).
- 손 도트 v5 실내 시공기로 지은 판은 보물상자·세이브 수정·함정·압력판을 **바닥 그림으로만** 칠해 이벤트가 0개였다.
- 「미궁」을 받아 줄 재료·구조·금지 목록이 어디에도 없었다. 공용 「심층 미궁」은 폐기한 던전 칩셋이라 가져오기가 거부됐다.

## 조수 쪽 연결 (제품 코드)

- `src/ai/conceptCards.ts` + 번들 `src/assets/conceptCards.json`(`{version, cards: ConceptCard[]}`).
- 요청 문장에 카드 별칭이 있으면(제외 구절이 없으면) 의도 노트 **맨 앞**에 카드가 붙는다 — `executionRoute.buildPiIntentNote`.
- 카드 `skipLayoutQuality: true` 면 배치 품질 수리 턴을 건너뛴다 — `scripts/lib/piAgentRuntime.ts`(브라우저 워커도 같은 함수).
- 재료는 `as: "tile" | "event"` 로 나뉜다. 동작하는 것(상자·함정·세이브·스위치·문)은 이벤트 도구로.
- 시험용: `qa:game gen --text "<한 줄>" --concept-card <card.json>` 이 굽기 전 카드를 그 실행에만 얹는다(`overrideConceptCards`).

## 한 바퀴

`discovered → build → review → probe → bake → done` (반려되면 이유를 들고 build, 3번 넘으면 blocked)

| 단계 | 누가 | 무엇 |
|---|---|---|
| 발견 | codex | `scan_failures`(qa-runs·시험 폴더의 검색 0건 낱말·빈칸 수리 요청) + 낱말 은행(`harness-data/super-harness/seed.json`) |
| 만들기 | codex | `card.json`·`gaps.json`. `node/example.mts` 가 새 프로젝트에서 예제 호출을 돌려 통과해야 끝 |
| 검수 | codex ×2 | A 개념·구조, B 동작·재료·화풍(`prompts/review-*.md`). 둘 다 PASS |
| 조수 시험 | gen ×4 + codex | 카드 없이 2판(개념당 한 번) vs 붙여서 2판 → `node/probe-score.mts` 숫자 + 판정자 그림 비교. 결정적 관문: 노트가 붙었나·이벤트 없는 장치가 늘었나·맵을 만들었나 |
| 굽기 | 데몬 | `../rpg-zzu-super-bake` 워크트리에서 origin/main 위 브랜치 → 번들·예제 그림(`public/assets/concept-cards/<id>/`) → push → PR → 머지 |

사람: 화면에서 **교정 지시**(다음 만들기의 최우선 지시가 됨) · **폐기**(구운 것이면 빼는 PR) · 우선 ↑ · 전체 멈춤.

## 운영

- 기본 에이전트: Codex CLI `gpt-6.1-sol`, reasoning `medium` (`SUPER_HARNESS_MODEL`·`SUPER_HARNESS_EFFORT`).
- 데이터: `~/.local/share/oprn/super-harness/`(`sh.sqlite`, `concepts/<id>/` 카드·예제 그림·검수·시험 폴더·로그).
- 상한(화면 위 막대, `settings` 표): 동시 개념 3 · codex 6 · 조수 시험 2 · 하루 codex 120 · 하루 시험 24.
- 상태 `python3 src/harnesses/super-harness/sh.py status`, 멈춤 `… pause`, 다시 `… resume`.
- 부족분(`gaps` 표)은 아직 다른 하네스로 자동 전달하지 않는다 — 화면에 쌓인다.
