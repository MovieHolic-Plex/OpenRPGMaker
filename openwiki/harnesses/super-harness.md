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
- 예제는 조수 노트에 호출을 싣지 않는다. 조수는 `build_concept_example({card, variant, example, newMapId?, name?})`
  (`src/editor/tools/conceptExampleTool.ts`) 한 번으로 검수된 예제를 통째로 짓는다 — 예제의 맵 id 가 겹치면 `_2`… 로 바꾼다.
  구운 카드의 호출은 `src/assets/conceptCardExamples/<카드 id>.json`(`"변형/예제": calls`)에 따로 두고 도구 `prepare` 가 지연 로드한다
  (80×80 미궁 평면만 6.7천 자 — 첫 번들·노트에 실을 수 없다). 카드가 붙은 턴에만 `plainTurn` 이 이 도구를 도구 목록에 더한다.
- 예제는 자기 맵만 만든다(`map_blank_start` 등 기존 맵을 가리키면 `node/example.mts` 가 떨어뜨린다).
- 시험용: `qa:game gen --text "<한 줄>" --concept-card <card.json>` 이 굽기 전 카드를 그 실행에만 얹는다(`overrideConceptCards`).

## 제작 전 공간 기획·텍스트 도면 관문 (2026-10-04)

`plan → plan-review(A/B) → survey` 순서다. 제작자가 기획과 시공을 한 번에 수행하던 경로를 분리했다.
모델은 현재 운영 설정 그대로 Codex `gpt-6.1-sol medium`; 기획자 1세션과 독립 검수자 2세션을 사용한다.
다른 모델로 교차 검수하는 구성은 아니다. 검수자들은 서로의 결과를 보지 않도록 지시받는다.

- `planning.json` v1: 변형별 purpose/experience, 세계관/layout/spaceProfile, 필수 재료, 구역 범례,
  사용 동선, cellScale(도면 한 칸의 실제 타일 축척), scaleReason, ASCII diagram.
- 도면은 같은 폭의 3~80칸 행. `#` 벽/범위 밖, `.` 통로, `+` 문, `E` 진입 1개, `X` 추가 출구,
  그 외 대문자는 한국어 범례를 갖는 구역이다. 야외 `#`은 실제 성벽을 시공하라는 뜻이 아니다.
- 기계 확인은 범례 일치·축척·필수 필드·바깥 경계·입구에서 모든 걷는 칸까지의 BFS 연결을 검사한다.
  잠긴 문은 열린 상태로 연결 검사하며 잠금 순서/옆길 우회/활동의 타당성은 검수자의 몫이다.
- `planning-reviews/A.json`, `B.json`: 각 변형 identity/use/routes/boundaries/scale/requirements 6항목의
  PASS와 도면 좌표/구역 근거가 모두 있어야 한다. PASS 한 단어, 누락, 이전 기획 해시 판정은 승인으로 인정하지 않는다.
  A는 공간 정체성·활동, B는 동선·경계·축척을 집중 검토하되 양쪽 모두 6항목을 확인한다.
- 반려는 이유를 들고 기획 수정으로 돌아간다. 별도 plan_attempt로 최대 3차까지 진행하며 계속 실패하면 blocked.
  사용자 교정/다시 시작은 기획부터 새로 검수한다. 과거 기획·판정은 history에 보존한다.
- `planning.md`는 같은 JSON에서 자동 작성한다. 개념 상세 Markdown에 도면·범례·동선·재료·A/B 근거가 표시된다.
- materials.json의 planningFingerprint가 현재 승인 기획과 같아야 하고 기획의 변형·시대·공간 종류·필수 재료를 삭제/변경할 수 없다.
  card.json에도 같은 planningFingerprint를 요구한다. 최종 시각 검수의 planning 항목에서 도면과 실제 맵의 구역·동선을 대조한다.
- 기획 v1 최초 적용은 미배포 개념을 plan으로 옮기고 paused=1을 유지한다. 완료된 카드는 소급 삭제하지 않는다.
- 실제 기획 모델 작성/적대적 검수는 운영 재개 후 실행한다. 중지 중 화면 예시는 운영 기획으로 등록하지 않는다.

## 제작 전 재료 관문 (2026-10-04)

`gates.py`와 `node/example.mts`가 맵 도구 실행 전에 막는다. 주문서가 있다는 이유로 임시 구조를 짓는 예외는 없다.

1. **조사** `materials.json` v2: 변형별 시대·공용 칩셋·공간 종류·목적·필수 재료 목록.
   실내는 floor/wall/ceiling 및 공간을 식별하는 prop/terrain이 필요하다. 각 재료는 실제 catalog JSON pointer,
   preview PNG, 해당 용도 references, 도구의 재료 선택 인자(bindings), SHA-256을 갖는다.
2. **독립 승인** `material-review.json`: 조사와 별도 작업자가 모든 재료 그림과 문서를 열고 era/coverage/renderability를 판정한다.
   목록에서 칠판·주차선·수로·조선 소반을 아예 빼먹은 경우도 반려한다. 이름이 있는 것과 공용으로 실제 시공 가능한 것을 구분한다.
   파일이 없거나 해시가 바뀌거나 근거 형식이 잘못됐거나 하나라도 미준비면 제작하지 않는다.
3. **없는 재료** `art` 작업자는 격리 워크트리에서 기존 전용 하네스를 사용해 후보를 만든다.
   `art-result.json`의 실제 그림과 검사 결과 파일 해시를 확인한 뒤 `art-review`에서 사람 선택·공용 등록을 기다린다.
   후보 파일 존재는 설치 승인이 아니다. 공용 등록 후 **재료 다시 확인**을 눌러 조사·독립 승인을 새로 받는다.
   하네스 미지원/도구 미구현/참고문서 미연결은 막힘으로 보고한다. 그림 작업자의 완료 선언만으로 맵 제작으로 넘어가지 않는다.
4. **재료 변경 방지** 예제 도구는 조사서와 변형·시대·칩셋·layout이 일치해야 실행한다.
   손 도트 시공기의 기본값·zone 바닥/벽·기물, stamp_object/objectId, fill_region/material, paint_tiles/tile을 승인 bindings와 대조한다.
   나머지 도구와 이벤트 상태 그림의 실제 조립 가능성은 독립 재료 검수와 시각 검수의 필수 항목이다.

세계관은 `seed.json worldviews[].native`만 허용한다. **중세 바닥·벽·천장을 현대/조선에 빌려 쓰는 규칙을 폐기했다.**
옛 시드의 “조선은 외관뿐”도 사실로 취급하지 않는다. 조선 실내 표본은 존재하며 현재 해시 판정·공용 배포·사용할 도구를 따로 확인한다.
현대 재료가 외관만 지원하면 실내 도구/연결부도 부족분이다.

## 공간과 시각 관문

- 공간 용도를 먼저 승인한다: `compact`는 외딴 바닥 ≤30%(야외35), 빈 정사각형 ≤6(야외8), 단순 직사각형 제한.
  `open`(주차장/교실/광장)·`corridor`(수로/통로)는 위 수치 제한을 적용하지 않는다. 차로와 수로를 벽으로 채워 숫자를 맞추면 시각 검수 반려.
- 손 도트 평면 외곽의 '#' 아닌 칸에는 예제 `openings:[{x,y,reason}]`가 있어야 한다. 무단 벽 누락은 기계 검사에서 반려한다.
  이것은 내부 칸막이/문 옆 틈/실제 렌더의 남벽 가림 검수를 대체하지 않는다.
- `visual-input.json`: 전체 예제 PNG + 네 구역 확대 PNG, 카드·재료·검사 결과 해시.
  독립 검수 A/B 모두 모든 이미지를 확인하고 각 맵의 north/east/south/west/interior-walls/era/materials/scale/access/purpose에 좌표·관찰 근거를 남긴다.
  벽면이 실제 그림에서 사라지면 반려하며 “엔진 관습”으로 면제하지 않는다.
- 이벤트 색 테두리는 위치 표시다. 상태 그림이 실제로 있는지는 재료 이미지로 별도 확인한다.
- PASS라는 단어만으로 진행할 수 없다. 필수 검사·이미지 해시·전체/네 구역 목록이 빠지거나 입력이 바뀌면 반려한다.
  조수 시험 시작과 굽기 직전에도 같은 관문을 확인한다. 같은 시도 번호라도 현재 시각 해시가 다르면 기존 after/판정 파일을 history로 보존하고 다시 시험한다. 시각 판단 자체는 모델 검수이며 자동으로 완벽한 품질을 보장하지는 않는다.

## 한 바퀴

`discovered → plan → plan-review → survey → material-review → build → (waiting) → review → probe → bake → done`

재료가 없으면 `survey → art → art-review → 사람 선택·공용 등록 → survey` (반려되면 이유를 들고 build, 3번 넘으면 blocked)

- **시드**: 카드의 `children`(카타콤 → 카타콤 2층)은 적대 검수를 통과하면 하위 개념으로 큐에 들어간다(`parent` 연결, 개념당 4개까지).
  하위 개념의 작업자는 상위 카드를 먼저 읽고 같은 재료로 잇는다.
- **선행 개념**: 카드의 `requires`(학교 복도 → 학교)가 재고에 없으면 높은 우선으로 새로 넣고, 이 개념은 `waiting` 에서 기다린다.
  선행 개념이 구워지면 「그 카드에 맞춰 다시 맞춰라」를 들고 build 로 돌아간다. 서로를 기다리는 쌍은 만들지 않는다.
- **크기**: 작업 지시(`prompts/build.md`)의 표 — 미궁 80×80, 던전 층 60~100, 큰 건물 50~80, 성도 150×150, 방 20~40. 크기는 용도·축척·동선으로 정하며 표를 맞추려고 빈 방을 늘리지 않는다.
  `build_hand_interior_room` 평면은 벽 아래 두 줄이 벽면이라 가로 통로는 바닥 3줄·벽 2줄(80×80 미로 실측 5초).
- **부족분 주문서**: `gaps.json` 의 그림 항목은 `item`(id·ko·w·h·category·desc) 을 달아 그림 하네스가 그대로 받게 한다.

| 단계 | 누가 | 무엇 |
|---|---|---|
| 발견 | codex | `scan_failures`(qa-runs·시험 폴더의 검색 0건 낱말·빈칸 수리 요청) + 낱말 은행(`harness-data/super-harness/seed.json`) |
| 공간 기획 | codex | 용도·구역·동선·필수 재료·ASCII 평면도, 기계 연결 검사 |
| 기획 적대적 검수 | codex ×2 | 독립 A/B의 6항목 현재 해시 승인. 반려하면 기획 수정 |
| 재료 조사·승인 | codex 각 1 | 실제 재고 근거를 조사한 뒤 독립 승인. 미준비면 맵 제작 금지 |
| 칩 제작 | codex + 전용 하네스 | 격리 워크트리에서 실제 후보·검사 근거 생성 → 사람 선택·공용 등록 대기 |
| 만들기 | codex | `card.json`·`gaps.json`. `node/example.mts` 가 새 프로젝트에서 예제 호출을 돌려 통과해야 끝 |
| 검수 | codex ×2 | A 개념·구조, B 동작·재료·화풍(`prompts/review-*.md`). 둘 다 PASS |
| 조수 시험 | gen ×4 + codex | 카드 없이 2판(개념당 한 번) vs 붙여서 2판 → `node/probe-score.mts` 숫자 + 판정자 그림 비교. 결정적 관문: 노트가 붙었나·이벤트 없는 장치가 늘었나·맵을 만들었나 |
| 굽기 | 데몬 | `../rpg-zzu-super-bake` 워크트리에서 origin/main 위 브랜치 → 번들·예제 그림(`public/assets/concept-cards/<id>/`) → push → PR → 머지 |

사람: 화면에서 **교정 지시**(다음 만들기의 최우선 지시가 됨) · **폐기**(구운 것이면 빼는 PR) · 우선 ↑ · 전체 멈춤.

## 화면

`/` = 갤러리(`web/gallery.html`): 개념마다 그림 한 장(`/thumb` 가 360px 로 줄여 캐시) + 쉬운 말 상태 한 줄 + 설명 한 줄.
상단 **그림 주문서** → `/orders`: 세계관·개념별 전체 주문을 표로 읽는다. 재료 조사·칩 제작·사람 선택·공용 등록 순서를 표시한다.
기획/기획 검수/재료 조사/승인/칩 제작/선택 대기 단계에서는 옛 예제와 조수 시험 이미지를 숨기고 이전 설계를 초안으로 표시한다.
개념을 누르면 재료 준비 표·칩 후보·예제·조수 시험 그림·고치는 이유·변형별 구조/재료/금지·주문·교정 내역을 Markdown 문서로 읽고 교정/폐기를 실행한다.
두 문서 모두 **읽기 / Markdown 원문 / 원문 열기**를 제공한다. 원문은 `/md/orders.md`, `/md/<개념 id>.md`이며 `/?concept=<id>`로 개념 상세를 바로 연다.
문서는 열 때만 가져오고 주문서는 명시적 새로고침으로 갱신한다. `/markdown.js`는 기존 `src/util/markdown.ts`의 DOM 표시기를 Bun으로 데몬당 한 번 변환해 재사용한다(추가 라이브러리·외부 CDN 없음).
표는 가로로 스크롤하고, 맵 그림은 눌러 확대한다. 불러오기 실패 시 다시 불러오기·닫기를 제공한다.
`/api/list` 는 가볍게(50KB) 15초마다, 탭이 숨으면 안 부른다. 예전 칸반(`/detail`, `/api/state` 3.4MB)은 작업자 디버깅용으로만 남긴다 — 사람 화면에 쓰지 말 것(2026-10-04 「렉이 너무 걸린다」).

## 운영

- 기본 에이전트: Codex CLI `gpt-6.1-sol`, reasoning `medium` (`SUPER_HARNESS_MODEL`·`SUPER_HARNESS_EFFORT`).
- 데이터: `~/.local/share/oprn/super-harness/`(`sh.sqlite`, `concepts/<id>/` 카드·예제 그림·검수·시험 폴더·로그).
- 상한(`settings` 표): 동시 맵 작업 개념 8 · codex 16(칩 제작 작업자 포함) · 조수 시험 4 · 별도 칩 제작 개념 1. 하위 그림 하네스의 병렬도는 각 하네스 설정을 따른다. **하루 상한은 없다**(2026-10-04 사용자 결정 — 동시 실행 수만 지킨다).
- 상태 `python3 src/harnesses/super-harness/sh.py status`, 멈춤 `… pause`, 다시 `… resume`.
- 기존 SQLite `settings`의 하루 상한 키도 초기화 시 제거한다. 오늘 사용량은 통계이며 실행을 막지 않는다.
- 칩 작업자는 `DATA/art-worktrees/<concept>`에 격리 워크트리를 만들고 `npm run wt -- adopt`로 보정한다.
  현대 modern-chipset, 조선 joseon-baram, 일본 jp-city, 중세 interior-props를 사용한다. 하위 풀/선택 데이터도 해당 워크트리 안으로 격리하도록 지시한다.
  후보 선택과 공용 등록은 자동으로 하지 않는다. `art-review`는 사람이 선택한 칩의 등록 후 조사 재실행을 기다리는 상태다.
- 관문 v2 최초 적용은 미배포 개념을 survey로 옮기고 paused=1로 고정한다. 기존 파일·완료된 카드·폐기 내역은 보존한다.
- `pause`는 새 작업 투입을 막는다. 이미 실행 중인 하위 작업의 즉시 종료가 필요하면 서비스의 프로세스 그룹까지 종료해야 한다.
- 2026-10-04 적용 확인은 중지 상태에서 수행한다. 실제 칩 생성·선택·공용 등록 한 바퀴는 별도 실행이 필요하다.
