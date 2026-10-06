# 슈퍼하네싱 (super-harness) — 기물·파생·공간

사람이 큐만 보고, 에이전트가 「조수가 모르는 낱말」을 스스로 찾아 개념 카드로 만들어 공용 번들에 굽는 지휘자 하네스.
화면: **http://mdc-server:18315/** (systemd --user `super-harness.service`, 코드 `src/harnesses/super-harness/`).

기물·파생도 같은 서비스에서 제공한다. 실행 입구는 `unified.py run`, 공간 단독 뷰는 `/spaces`.
운영·모듈 분리·후보 경로·기존 세션 유지·복구는 [통합 문서](super-harness-integration.md)를 따른다.

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
- 실제 기획 모델 작성/적대적 검수의 두 건 표본은 아래 실행 기록을 참조한다. 화면 확인용 예시는 운영 기획으로 등록하지 않는다.

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

### 기획 두 건 실운영 표본 (2026-10-04)

전체 큐를 멈춘 채 지하감옥·지하주차장만 기획→독립 A/B 검수까지 실행했다.
둘 다 1차 기획 관문을 통과해 survey 대기에서 정지했다. 감옥은 감방 3개와 간수실·보급실,
주차장은 12면과 입출차 경사로·차량/보행 동선을 계획했다. 재료 준비·맵 제작 완료를 의미하지 않는다.
실행 중 기획자가 자체 하위 검수자를 호출하는 중복을 관측해, 기획자는 파일 작성 후 종료하고
별도 A/B 호출은 하네스만 하도록 기획/검수 지시문을 명확히 했다.
근거: `verify-shots/super-harness-planning-gate/pilot/`의 도면 Markdown·판정 해시·운영 화면.

### 큰 공간의 세부 도면·기획 이미지

cellScale>1 또는 한 변>60인 전체 도면은 1타일 축척의 `details` 두 구역 이상이 필요하다.
각 상세도의 origin은 전체 지도 타일 좌표이며 직사각형 범위는 겹치지 않는다. parentZones로 전체 구역을 빠짐없이 연결한다.
ports는 side/offset/width/kind/level/connectsTo를 갖는다. 양쪽 포트의 실제 좌표·방향·폭·높이·용도가 맞아야 하며,
모든 상세 구역을 이은 그래프가 연결되어야 한다. 외부 출입구는 전체 도면의 E/X에만 연결한다.
기획 검수 A/B는 각 details의 6항목과 전체 connections를 따로 승인한다. 기획 파일 전체의 해시에 판정이 묶인다.
`planning_details.py`는 도면을 색상 구역 PNG로도 렌더링한다. 이는 **기획도**이며 칩을 써서 만든 맵 그림/칩 검수 근거가 아니다.
개념 화면 상단에 현재 기획 해시와 일치하는 전체/세부 이미지만 표시한다. 실제 칩 후보는 별도의 칩 제작 결과에 표시한다.


### 실제 후보 표시와 참고자료 연결

갤러리는 제작 전 단계에서 현재 해시의 기획도, 후보가 있으면 칩 후보를 보여 주고 종류 배지를 붙인다.
재료가 준비되지 않아 blocked가 된 경우에도 이전 예제 맵을 완성 그림처럼 내보내지 않는다.
상세 화면은 칩 후보를 기획 문서보다 먼저 보여 준다. 후보 PNG의 경로/해시를 확인하며, 상세 화면의
새로고침은 입력 중인 교정 지시를 유지한다. 전체 큐를 멈추고 특정 개념만 실행할 때 상태의 '멈춤'은 새 작업 투입 중지를 뜻한다.

칩 작업에 `concepts/<id>/reference-source.json`을 제공할 수 있다. 여기에는 정본 project id/폴더/읽은 revision을
기록한 provenance 파일과 `export-tileset-references.mjs`로 추출한 INDEX.json 디렉터리 경로를 넣는다.
작업자는 해당 용도 MD와 실제 이미지를 읽는다. 참고자료 출처 프로젝트는 읽기 전용이며 후보의 설치 대상과 같다는 뜻은 아니다.
정본 SQLite의 tileset이 `$blob`이면 `tileset_blobs`를 읽어 펼치고, `referenceDocumentsOwner=bundle`이면
실제 호스트 판본의 소유 번들 문서를 `referenceOwnership.ts`와 같은 계약으로 복원한 뒤 추출한다.
이 표지를 '참고자료 없음'으로 오판하지 않는다. 자료를 임의로 생성하거나 정본 DB에 다시 쓰지 않는다.

### 그림 실행은 감독이 직접 한다

중첩 Codex 실행은 설정 폴더 쓰기 오류, 중첩 Claude 실행은 네트워크 EPERM으로 후보 0장이 된 실측이 있다.
`art` 준비 작업자는 시드·격리 판을 만들고 art-result.json에 execution 요청을 반환한다.
`art-native`는 감독 프로세스에서 interior-props pool 또는 modern-chipset _run을 실행한다. 임의 명령/외부 경로는 받지 않는다.
종료 후 별도 결과 수집 작업자가 실제 PNG·검사 JSON을 art-result.json에 기록한다.
하위 작업의 종료를 관리하며, art와 art-native를 합쳐 동시 칩 제작 개념 상한을 적용한다.
조선/jp-city의 직접 실행 어댑터는 아직 없으므로 준비 단계에서 명시적으로 막힌다.

사용자가 특정 개념의 모델 변경을 승인하면 settings.art_model_overrides에 개념 id별
`{backend, model, effort}`를 기록한다. 감독이 이 설정만 실행 요청에 넣으며, 준비 작업자의 modelOverride는 무시한다.
2026-10-04 주차장 파일럿은 Sonnet 공급자의 4계정 한도 소진으로 사용자가 Codex(gpt-6.1-sol medium) 전환을 승인했다.
이 변경은 해당 개념에만 적용하며 현대 하네스의 기본 Sonnet 설정을 바꾸지 않는다.
준비 프롬프트에도 이 승인값을 전달한다. 준비 코드가 기본 Sonnet만 허용하여 감독의 승인된 Codex 실행을
거부하지 않도록 한다. 실행 요청의 모델 값은 계속 감독의 저장된 설정만 사용한다.

### 칩 선택 화면과 조립 예시 (2026-10-04)

`art-review` 상세는 이제 긴 문서 대신 **예시 → 후보 비교 → 선택**을 먼저 보여 준다.
갤러리의 `내 선택 필요`와 `작업 대기`를 분리하며, 전체 자동 실행 멈춤은 별도로 표시한다.
검수 통과는 추천/자동 선택이 아니다. 첫 화면에서 합격 후보를 미리 보여 주더라도 선택 수는 0이다.

- 주차장: 13품목 세트 A~E를 같은 작은 배치에서 비교한다. 문·차단기 열림/닫힘 전환과 원본 시트 확대가 있다.
- 감옥: 계단, 철문 상태 쌍, 나무문 상태 쌍의 세 그룹을 고른다. 문은 같은 글자의 열림·닫힘을 함께 선택한다.
- `art_preview.py`는 실제 후보 PNG의 조각만 조립한다. 주차장은 부품 contract 좌표, 감옥 문은 해당 판의 `ctx-cand.png`, 계단은 기존 하네스 방 맥락에 현재 후보를 같은 배율로 놓는다.
  새 픽셀 저작/게임맵 저장은 하지 않는다. 이 예시는 화풍·크기 비교용이며 통행·높이·문 상태 연결의 승인 근거가 아니다.
- `art_choices.py`는 실제 receipt와 현재 이미지 해시를 확인해 `concepts/<id>/art-choices.json`을 만든다.
  현재 어댑터는 두 파일럿의 modern parking-kit receipt와 interior-props runs/candidateImages receipt다.
  미지원 receipt는 선택 예시 준비 필요로 보이며, 존재하지 않는 선택 기능/예시를 꾸며 내지 않는다.
  `on_art`가 수집 종료 후 준비하며 기존 판은 `python3 src/harnesses/super-harness/art_choices.py <concept>`로 준비한다.
- 선택 정본: `sh.sqlite.art_selections`의 `(concept, group_id)`. 후보 id, 후보·예시·검수·art-result fingerprint, 원본 refs snapshot, 선택 시각을 저장한다.
  `GET /api/art-choices?id=…`, `POST /api/action`의 `choose-art`/`clear-art`.
  원본/검수/예시/수집 결과가 바뀌면 선택이 낡았다고 표시한다. 불합격·해시 변경·선택 단계 아님은 서버도 거부한다.
- 선택/변경/취소는 즉시 저장하고 재로드한다. **선택은 공용 설치가 아니다.** 모두 선택하면 `선택 완료 · 공용 등록 필요`로 표시하며 실제 등록·조립 연결은 후속 작업이다.
  큐 pause, 재료 승인, 맵 제작 관문을 자동으로 풀지 않는다. 등록 작업자는 이 선택 snapshot의 현재 해시를 다시 확인해야 한다.
- 긴 기획/주문서/검수 기록 및 교정·폐기는 접힌 영역으로 남긴다. 선택 저장 실패는 같은 화면에 보이고 다시 시도할 수 있다.

화면 근거: `verify-shots/super-harness-chip-choice/`. 운영 선택은 0건을 유지한 채 별도 SQLite 사본에서
선택→재로드→취소→재로드, 낡은 요청·불합격 후보 거부, 열림/닫힘 전환을 확인했다. 데스크톱/390px 화면의 오류·가로 넘침은 없었다.

### 주차장 조립 검수 반려와 선택 관문 (2026-10-04)

사용자가 실제 조립 예시를 보고 품질을 반려했다. D의 부품 13종 PASS에도 예시의 출입 경사로는
외벽에 막혀 있고, 방화문은 벽과 분리됐으며, 차단기는 차로 경계에 없었다. 자동차를 함께 놓지 않아
주차면 축척과 바퀴 멈춤턱 방향을 검증하지 않았다. **부품 그림 검수만으로 사람 선택 단계의 품질을 보장하지 않는다.**

- parking-kit 선택 그룹은 `requiresContextReview=true`다. `art-context-review.json`의
  `groups.<groupId>.<candidateId>`에 후보 fingerprint, verdict, reasons, checks를 저장한다.
- PASS에는 identity/scale/attachments/circulation/style 각각 PASS와 관찰 근거가 필요하다.
  후보 fingerprint는 원본·예시·부품 검수·수집 결과를 포함한다. 판정까지 선택 fingerprint에 묶어
  저장하므로 판정이 바뀌면 과거 선택도 다시 확인한다. 기존 부품 verdict는 수정하지 않는다.
- 파일 없음/현재 후보 불일치/미통과면 선택 불가. 화면에는 **후보 수정 필요**, 현재 고를 수 없다는
  안내와 수정 사유를 보여 준다. 자동 실행 중단 상태와 별개다.
- 이번 반려는 실제 공통 배치의 결함을 확인한 감독 진단이다. 후속 PASS는 수정한 조립 예시를 보고
  독립 검수해야 한다. 칩 자체를 다시 그리지 않고 선언만 바꿔 해제하지 않는다.
- 다음 제작 명세: 운영 concept의 `parking-repair-brief.json`. 후보 1세트, 수정 최대 1회,
  실제 공용 승용차 1대·주차면 2개·차로·낮은 멈춤턱·바닥/북벽/모서리부터 만든다.
  자동차 원본 크기·해시를 고정하고 차로/주차면의 여유와 방향을 실제 장면으로 본다.
  경사로·차단기·방화문·덕트와 전체 13품목/5후보 확장은 이 표본 승인 뒤로 미룬다.
  명세만 준비했으며 새 그림 작업은 시작하지 않았다. 전체 pause는 유지한다.

### 칩 검수 피드백 → 자동 재생성 루프 (2026-10-04)

앞 절의 '반려 후 명세만 준비'에서 실행 연결까지 확장했다. 칩 수집 후에는 아래처럼 진행한다.

```
art 준비 → art-native 제작/부품 검수 → 결과 수집·예시 생성
  → art-context-review 독립 조립 검수
      PASS → art-review (사람 선택)
      FAIL → art-feedback.json → art queued (수정 지시로 재생성) → 같은 조립 검수
      자동 수정 상한 소진 → blocked (사람 확인)
```

- `art_feedback.py`가 실패 대상·문제·변경 방법·유지할 요소·그림/검수 해시를 묶는다.
  부품 검수의 fix도 전달하며 asset/assembly/spec를 구분한다. 통과한 그룹은 preserveGroups로 보존한다.
  실패 당시 PNG/검수 파일을 `art-feedback-history/<manifest hash>/evidence/`에 해시 확인된 사본으로 보존한다.
  새로운 예시도 generation별 경로를 사용해 이전 실패 이미지를 덮지 않는다.
- DB `art_revision`은 자동 수정 차수, `art_review_attempt`는 같은 조립 검수의 실행 오류 재시도다.
  기본 `max_art_revisions=2`, 개념별 brief의 더 낮은 maxRevisions가 우선한다. 이번 주차장은 1회다.
  동일 manifest의 실패는 한 번만 소비한다. 같은 실패 후보를 그대로 재생성 결과로 돌려주면 막는다.
- 제작 준비 prompt에 전체 피드백과 상한을 주입한다. execution.feedbackSha256가 현재 파일과 같아야 실행한다.
  감독이 repairLimits를 덮어 넣는다. modern 판의 후보 수, interior 풀의 품목당 queued 수를 확인하고
  native 내부 재시도는 1회 실행으로 제한한다. 원래 A~E 풀/3회 반복을 그대로 실행하지 못한다.
- 조립 검수자는 제작과 별도 Codex 작업이다. 다섯 축의 관찰, 모든 예시 이미지 해시, 후보/manifest 해시,
  실패마다 대상·문제·변경·보존 지시를 요구한다. 해시가 바뀌거나 판정/관찰이 빠지면 결과를 수용하지 않는다.
  검수 실행/형식 오류는 그림을 다시 그리지 않고 검수만 최대 2회 시도한다.
- 수집 어댑터/참고자료/실행 준비 자체가 미지원인 경우는 기술적 막힘으로 남긴다. 품질 실패의 자동 수정과 구분한다.
- 작은 주차장 표본 receipt는 contextImages(실제 조립 PNG), contextSources(기준 자동차 원본)를 제공한다.
  이렇게 하면 작은 표본을 기존 13품목용 조립 예시에 억지로 넣지 않는다.
- 전체 pause는 이 루프보다 우선한다. 실패 결과를 받아 수정 대기에 넣을 수는 있지만 새 작업은 시작하지 않는다.
  화면은 **피드백 반영 재생성 N차 대기 · 전체 멈춤**을 표시하며 사람 선택을 요구하지 않는다.

실제 주차장의 반려 기록/구체 수정 지시를 수정 1/1 대기로 연결했다. 모델은 재실행하지 않았다.
별도 SQLite·파일 사본에서 실패→수정대기, 중복 소비 방지, 상한→blocked, PASS→사람선택의 상태 전이를 확인했다.
PASS 분기는 컨트롤러 확인용 합성 fixture이며 실제 그림의 합격 근거가 아니다. 원본 그림/운영 선택은 변경하지 않았다.
근거: `verify-shots/super-harness-feedback-loop/`. 신규 모델을 사용한 전체 재생성의 품질·완주 여부는 아직 확인 전이다.

### 표본 도면과 공간 전체의 품질 관문 v2

실측: 주차장 표본 내부의 약45%에 용도가 없었으나 계약의 치수 준수만으로 비례 PASS가 났다.
이제 `art 준비 → art-layout-review → art-native → 수집 → art-context-review` 순서다.
- 준비자는 execution.layout에 실제 픽셀 크기와 일치하는 ASCII, 모든 칸의 용도, 비례/여백/정체성 근거,
  시드(native SQLite는 DB/WAL)·치수·주문서·queued 판·실행 코드/프롬프트의 해시를 제공한다. 기존 전체 기획의 승인은 재사용하지 않는다.
- 독립 도면 검수는 proportions/spaceUse/circulation/identity/composition을 본다. 명세 자체를 반려할 수 있다.
  FAIL은 그림을 시작하지 않고 명세 준비로 돌아간다. 같은 art_revision에서 3회 반려 시 중단한다.
  실행 직전에 승인 fingerprint와 파일 해시를 다시 확인한다. 수집 때도 native 실행 경로와 도면 승인을 확인하고,
  실행 중 진행되는 후보 state/DB를 제외한 주문서·코드·참조 해시를 다시 확인한다. 파일이 바뀌면 승인이 무효다.
  검증된 현재 도면 판정은 `VEH_LAYOUT_APPROVAL`로 modern-chipset 작업자 프롬프트에 전달한다.
  준비 시점의 pending 표기는 수정하지 않는다. 그림 작업자가 오래된 준비 표기 때문에 현재 PASS를
  놓치지 않게 하는 전달 경로이며, 실제 그림의 native/context 검수를 대신하지 않는다.
  사용자가 특정 개념의 선택을 명시적으로 위임한 경우에만, 개념 폴더의
  `supervisor-authorization.json`에 scope와 autonomousCandidateApproval을 기록하고
  `art_choices.choose(..., delegated=True)`를 호출할 수 있다. 현재 해시·native/context PASS
  조건은 동일하며 선택 행에 위임 원문과 해시를 보존한다. 일반 화면 요청은 사람 선택으로 유지한다.
- 최종 조립 검수는 기존5축에 spaceUse/composition/specification을 더한8축이다. 부품 FAIL에도 수행하여
  작은 부품 하나에 가려진 큰 공간 문제를 다음 수정에 함께 전달한다. native/context 수정 지시를 합친다.
- gateVersion=2와8축 근거가 없으면 기존 PASS로 선택을 해제할 수 없다. 낮은 밀도에 임의 공통 수치 상한을
  강요하지 않으며 필요한 차로/여백을 독립 검수한다. 이름만 여유 공간으로 붙인 낭비는 반려한다.
- 도면 반려 후 준비는 `art-layout-repair.md`로 해당 명세만 교정한다. 이미 고정된 전체 참고 자료를 매번 다시
  조사하는 비용을 줄이고, 새 queued 판과 변경된 명세 해시를 다시 독립 검수한다.
- 운영 근거 `verify-shots/super-harness-layout-gates/`: 기존 그림은 새 기준에서 style/spaceUse/composition/specification
  FAIL, 첫 축소 도면은 중복 여백으로 spaceUse FAIL. 도면 반려 시 native 작업이 시작되지 않은 것을 확인했다.
- 사용자가 게이트 수정 후 재제작을 요청하여 주차장의 누적 그림 수정 상한을2로 올렸다. 320×256 실패 표본을
  재검수한 뒤, 256×208 도면은 spaceUse FAIL로 그림 실행 전에 차단되었다. 수정한 240×192 도면은5축 PASS 후
  native 제작에 진입했다. 이는 완성 그림의 합격을 뜻하지 않으며 최종8축 이미지 검수와 사람 선택은 별도다.

### 반복 실패 재설계·시점 표본·전후 비교 v3 (2026-10-04)

사용자 승인으로 자동 수정의 기본값과 운영 주차장 상한은 **누적 5회**다. 기존 2회는 초기화하지 않는다.
`max_art_revisions` 설정과 개념 brief의 `maxRevisions` 중 작은 값이 적용된다. 기본값 변경은 기존 저장값을
덮지 않으므로 운영 설정도 별도로 갱신한다. 상한을 높인 뒤 `queue_repair`는 limit-reached 상태의 같은
실패를 한 번만 재개할 수 있다. 이미 queued인 같은 실패를 다시 소비하지 않는다.

- `art_repair.py`: 연속 세대에서 같은 검수 축이 실패하면 spec으로 되돌린다. 같은 축이라는 것은 같은 물리적
  결함의 증명이 아니라 명세 재검토가 필요하다는 보수적인 신호다. native/context의 keep 지시도 재검토 대상이다.
- 도면 v3에는 phase(calibration/scene), repairPlan(route/changes/supersededConstraints), camera가 필요하다.
  camera는 실제 기준 PNG 해시, 바닥 투영/높이/광원, 물체별 footprint/topFace/verticalFace/contact/occlusion을 담는다.
  alpha bbox 높이를 바닥 폭으로 대체하지 않는다. 도면 6축·최종 9축에 projection을 독립 추가했다.
- 반복 style/projection 실패 또는 명시한 requireCalibration은 최대 4종의 작은 시점 표본부터 만든다.
  주차장에서는 기준차+낮은 멈춤턱+벽 모서리다. 기존 5×26 턱 상자/방향은 고정 제약에서 해제한다.
  native 제작과 독립 검수까지 통과한 표본을 해시로 보존하고 같은 시점으로 공간을 다시 조립한다.
  표본은 선택 불가다. 재조립도 누적 수정 한도 안에서 실행하며 상한에 닿으면 표본 승인만 보존하고 중단한다.
- 최종 검수는 archivedEvidence의 실제 이전 그림도 열고 모든 실패 항목을 comparisons로 대조한다.
  resolved/unresolved/invalid-prior-claim과 전후 좌표·근거가 필요하다. unresolved가 있으면 PASS를 거부한다.
  calibration만 공간 범위 밖 문제를 deferred로 남길 수 있고 projection/style/scale은 보류하지 않는다.
  보류한 결함은 다음 재조립에도 유지하며 scene에는 deferred를 허용하지 않는다.
- 도색선은 장애물이 아니며, 통행 판단에는 실제 바닥/장애물 범위를 사용한다. 단색 비율만 낮추려 노이즈를 추가하지 않는다.
- 형식·해시 검사는 모델의 시각 판단이 정확하다는 보증이 아니다. 기준 시점·실패 전후 이미지 비교와 사람 선택은 별도다.
- 전역 paused=1을 유지하고 주차장 하나만 감독 실행한다. 모델은 기존 사용자 승인 Codex gpt-6.1-sol medium이다.

재제작 준비 중에는 기존 후보 manifest의 이미지·receipt 해시를 재확인하여 이전 그림을 비교용으로 계속 표시한다.
여러 차례 도면 교정으로 준비 결과가 교체되어도 마지막 실제 후보 결과는 보존한다. 표본/공간 단계는 후보 fingerprint에도 묶는다.
현재 결과가 아니므로 ready/eligible/selected는 false다. 전체 pause와 단일 개념의 지정 실행 상태를 별도로 안내하고,
주문서 준비를 실제 그림 제작 중이라고 표시하지 않는다. 이전 비교 PNG도 검수 결과 수용 시 해시를 다시 확인한다.

운영 v3 첫 시점 도면(112×80)은 원본 앞바퀴 허브 약(82,59) 대비 명세(86,59)의 오차와 서벽 높이 투영으로
projection/composition FAIL을 받았다. native 실행 전에 같은 그림 3/5차의 명세 교정으로 복귀한 실제 기록이다.
완성 그림의 품질 합격 근거는 아니다. 준비자에게 감독의 art_layout.py 절대 경로를 제공하여 다른 체크아웃 검색을 줄인다.

### 시점 표본 합격 후 저장 오류 복구 (2026-10-04)

실제 3/5차 시점 표본은 native와 감독 9축 검수를 모두 통과했다. 그러나 합격 보존 함수가 Path를 넘기고
공통 write_json이 문자열 덧셈을 사용하여 PosixPath + str TypeError로 다음 공간 재조립 전에 막혔다.
write_json에서 os.fspath로 경로를 정규화한다. 결과 처리 예외의 reasons도 현재 오류로 교체하여 과거
native 실행 실패가 원인처럼 남지 않게 한다. 기존 이미지/검수는 보존하고 합격 보존·전이만 재실행한다.
또한 이전 receipt 생성 실패의 원인인 registration-source.json을 주차장 제작 전 필수 해시에 포함한다.
누락은 그림 제작 전에 드러나며, 등록 메타데이터 존재가 공용 설치 승인을 뜻하지 않는다.

### 고정 합격 기준·권고 분리·판정 충돌 재검수 (2026-10-05)

사용자가 주차장에 누적 10회와 감독의 후보 선택을 위임한 뒤, 동일 도면이 실행 코드 해시 변경만으로
6축 PASS에서 비례/공간 사용/구성 FAIL로 뒤집혔다. 횟수 확대만으로 해결되지 않아 합격 계약을 추가했다.

- 개념의 `art-acceptance.json`을 감독이 `art-output/acceptance-contract.json`에 복사하고 실행 요청에
  경로/해시를 넣는다. 준비·도면·최종 검수가 같은 계약을 읽는다. 주차장 표본 원본은
  `harness-data/super-harness/acceptance/parking-small-v1.json`이다. 계약 없는 개념은 기존 경로를 따른다.
- `art_acceptance.py`는 모든 필수 조건별 `criterionResults`와 연결된 축의 PASS/FAIL 일치를 검증한다.
  `acceptanceSha256`이 현재 계약과 다르면 승인하지 않는다. `warnings`는 수정 필수 목록과 분리한다.
  이전 지적도 계약상 권고이면 전후 근거를 남겨 `advisory`로 분류한다. 시점/동선/접합 결함을 권고로
  숨길 수 없도록 해당 필수 조건 판정은 별도로 모두 요구한다.
- 도면 내용의 `semanticFingerprint`를 실행 출처 해시와 별도로 보존한다. 같은 계약/도면의 PASS를
  FAIL로 뒤집으면 이전 PASS와 새 FAIL을 보존하고 독립 재판정 1회를 거친다. 최종 그림 FAIL도
  독립 재판정 1회 후에만 수정 회차를 소비한다. 재판정은 현재 파일/이미지 해시와 계약을 다시 검사하며
  `adjudication.decision/evidence`를 남긴다. 단순히 기존 PASS를 재사용하거나 FAIL을 자동 승격하지 않는다.
- 주차면 길이·피치·화면 크기의 허용 범위는 게임 표본의 명시적 설계 조건이다. 실세계 법규나 사진에서
  실측한 값으로 주장하지 않는다. 후보 완료와 공용 등록/정본 저장 완료는 따로 보고한다.

### 선택 구역의 설치 완료 근거

`art-installation.json`은 현재 선택 fingerprint 전체와 정본 project id/SHA,
공용 등록·SQLite 재로드·실제 런타임 확인 결과를 묶는다. 선택이 바뀌면 설치 표시를 숨긴다.
화면은 이 근거가 있을 때 ‘선택 구역 완성 · 공용 등록·맵 저장 완료’로 표시한다.
이 표시는 원래의 더 큰 기획·재료 조사·개념 카드 전체를 done으로 우회시키지 않는다.
주차장 첫 구역은 두 면이고, 원래 12면 시설 계획은 별도 범위로 남는다.

### 확장판 미완성 → 실제 수정 큐 (2026-10-05)

확장판은 별도 검수 파일에 assembly PASS/facility INCOMPLETE를 남겼지만 art 큐에 들어가지 않아
수정이 실행되지 않았다. `scene_followup.py`가 현재 이미지·기획 해시, 모든 지적별 수정 주문,
새 범위의 합격 계약을 확인하고 기존 art 파이프라인으로 연결한다. 도입 표본은 modern-chipset의
`parking-followup` 단계다. 기존 선택/설치/계약은 해시별 history에 보존한다.

- SQLite scene_followups가 동일 요청의 중복 소비를 막는다. 기존 누적 art_revision과 상한을 유지한다.
- `completionRepairs`는 다음 세대의 반려에도 남는다. 대상 그룹 교체로 비교를 생략할 수 없다.
- required 비교 항목은 advisory/deferred로 낮출 수 없다. unresolved가 있으면 PASS 불가다.
- `requiresFacilityVerdict` 계약의 최종 조립 판정은 facilityVerdict와 필수 조건 판정이 일치해야 한다.
  도면의 기하학적 가능성이나 보행 PASS는 시설 시각 완료를 대신하지 않는다.
- 그림 저작은 기존 전용 워크트리/native 하네스만 쓴다. 전역 pause를 풀어 다른 개념을 실행하지 않는다.

확장판 첫 native 그림 이후 검수자가 `verdict.json`을 쓰지 않은 원인은 준비 작업자의 금지 문장이
미래 reviewTemplate에도 들어간 역할 혼선이었다. 준비 프롬프트에 현재 역할과 미래 검수 출력을
분리하도록 명시한다. 누락된 판정은 품질 FAIL로 취급하거나 그림 회차를 소비하지 않고, 원본 그림과
승인 입력 해시를 보존한 채 실제 검수만 재실행한다. 독립 검수 결과를 합성하여 빈칸을 채우지 않는다.
시설 receipt는 contractPath의 requiredReviewItems를 사용한다. 옛 components 13품목만 요구하면
7개 시설 조건을 쓰는 새 판 수집이 실패한다. 필수 목록이 비었으면 거부하고 시설 native PASS에도
facilityVerdict=PASS 및 현재 assemblySha256을 요구한다. 최종 감독 검수의 COMPLETE 판정은 별도다.

### 그림 중심의 Allow / Deny (2026-10-05)

`/spaces`의 기본 상호작용은 `예시 → Allow / Deny → 결과 → 수정 / Allow / Deny`다.
`web/art-choice.js`는 검수를 통과한 배치 예시를 나란히 보여주고, 열림/닫힘은 함께 표시한다.
품목 탭, 평가 등급/태그/필수 의견, 재료 재확인·폐기 버튼을 기본 공간 화면에서 제거했다.
주문서·마크다운·실행/검수 기록은 접힌 상세에 보존한다. 새 제작 단계는 15초 갱신으로 열린 화면에도 반영한다.

- `space_decisions.decide_example`: 후보 fingerprint와 화면의 모든 이미지 해시에 묶인 SQLite
  `feedback.kind=example-decision`을 저장한다. 복수 Allow를 허용하며 첫 Allow를 기존
  `art_selections`에 연결한다. 선택한 예시를 Deny하면 다른 Allow로 교체한다.
- Deny는 예시 거절이며 개념 폐기가 아니다. 필수 사유가 없다. 해당 묶음의 모든 사용 가능 예시를
  Deny하면 실제 그림을 보존하고 `art-feedback.json`과 기존 native art 큐로 돌려보낸다.
  누적 수정 상한을 유지하며 한도 소진은 blocked다. 다른 Allow 묶음은 보존 요청에 포함한다.
- 기존 전체 pause를 클릭으로 풀지 않는다. paused 상태에서 큐 등록과 실제 실행을 구분해서 안내한다.
  전용 실행기는 기존의 개념 범위/작업 슬롯 정책을 따른다.
- 공용 설치 자동 연결이 없는 art-review는 Allow 완료 후에도 공용 등록·조립 연결에서 멈춰 있다고
  명시한다. 추가 사용자 버튼을 요구하지 않으며, 후보 승인만으로 제작 중/정본 완료를 주장하지 않는다.
- 조수 시험 통과 뒤 `result-review`에서 멈춘다. `result-review.json`은 현재 예제 PNG, 카드,
  예제 JSON, 검수와 조수 시험 파일에 묶인다. Allow는 bake 큐로, Deny/수정은 피드백을 포함한
  build 큐로 전이한다. 수정에만 한 줄 의견이 필요하다. 이미 게시된 결과의 Deny/수정도
  재제작 요청이며 기존 게시물을 즉시 제거하지 않는다.
- `start_bake`도 현재 결과와 사용자 Allow가 일치하는지 재확인한다. 과거 bake 큐 항목도
  확인 없이 게시하지 않으며, 기존 재료/시각 관문을 우회하지 않는다.
- 운영 DB의 기존 선택은 유지했다. 변경 검증은 SQLite 사본과 실제 브라우저로 수행했다.
  `verify-shots/simple-space-decisions/`의 결과 확인 화면은 이전 감옥 렌더를 이용한 사본의
  UI 증거이며, 현재 감옥이 기술 검수나 정본 저장을 마쳤다는 증거가 아니다.

### 운영 오류의 책임과 지정 공간 실행기 (2026-10-05)

사용자의 할 일은 실제 예시/결과 결정이다. `/api/list.needsUser`는 현재 선택 가능한 예시가 남았거나
결과 확인 단계일 때만 true다. 선택을 마친 등록 대기·품질 수정·시스템 오류는 사용자 할 일이 아니다.
`owner`는 user/harness/operator를 구분한다. 화면의 기본 목록은 「내가 볼 그림」이며, 빈 목록은
「지금 하실 일은 없습니다」라고 안내한다. 전체 목록·운영 점검·폐기 기록·전체 큐 제어는 접힌
운영 화면에 남긴다. 실제 실행/대기와 원인 기록은 계속 조회되며 오류를 합격/완성으로 바꾸지 않는다.

실제 중단 원인은 공동묘지·교실에 주차장 전용 repair 프롬프트를 보낸 것과, 도면 FAIL 뒤 필수
art-feedback.json을 만들지 않은 것이었다. `art_feedback.ensure_layout_feedback`이 원본 FAIL의
수정 지시와 입력을 보존하고 실제 harness에 맞는 policy/phase를 만든 뒤 준비 작업자를 실행한다.
그림 회차는 소비하지 않는다. `art-layout-repair.md`는 주차장 전용 필수 입력/modern 강제를 제거하고
현재 art-execution의 하네스를 유지한다. 선택 계약은 파일이 있을 때만 적용한다.
도면 준비 수정은 기존 maxRevisions(운영값 10) 내에서 제한하며 도면 기록이나 그림 회차를 초기화하지 않는다.

하수도의 읽기 전용 SQLite 접속이 만든 0바이트 WAL은 트랜잭션이 없는데도 필수 입력에 추가되어
검수가 멈췄다. `art_layout.build_input`은 빈 WAL만 제외한다. 내용 있는 WAL은 계속 필수이고,
기존 해시 검사·실행 전 승인·native 후 수집 검사를 유지한다. 누락 경로도 오류에 함께 표시한다.

`space_supervisor.py <공간 id…>`는 명시된 공간만 기존 sh 단계 함수로 진행하는 운영 실행기다.
- 전체 pause를 유지하고 알려진 오류를 공간당 최대 2회 복구한다. 작업 id/원인/기록을
  operator-recovery.json에 보존한다. 같은 실패 작업을 중복 소비하거나 횟수를 초기화하지 않는다.
- 준비 결과 누락은 원본 도면 FAIL과 실제 필수 피드백을 확인한 경우만 복구한다. 도면 입력 오류는
  정확히 같은 입력이면 원래 판정을 다시 처리하고, 달라졌으면 준비·독립 검수부터 진행한다.
- 명시되지 않은 공간, 사용자 선택/결과 대기, 폐기, 수정 상한 소진은 강제로 진행하지 않는다.
- 전용 flock, DB 실행 기록 확인 후 공간별 슬롯으로 진행한다(아래 병렬 운영 절). 전체 큐가 재개되면
  새 작업을 중복 배정하지 않고 기존 자식 결과만 수거한다. heartbeat는 monitoring/requested-spaces/latest.json.
- 정상적인 Allow/Deny 대기에서도 실행기를 유지하므로 다음 Deny가 큐에 넣은 재제작이 소비된다.
  등록 연결이 없는 art-review는 자동 완성 처리하지 않는다.

운영: `super-harness-requested-spaces.service`가 공동묘지·하수도·교실 및 이미 요청된 감옥·주차장만
감시한다. 기존 일회성 배치는 종료 상태를 확인한 뒤 대체했다. 복구 당시 막힘 3건을 원래 준비 큐로
돌렸고 공동묘지 작업 id 695의 실제 프로세스를 확인했다. 사용자의 기존 3/3 감옥 선택은 유지했다.

### open 공간도 면적 축소를 검토한다 (2026-10-05)

12석 교실의 기획은 21×21, 실내19×19로 동쪽3칸·전면3칸·뒤쪽 횡단/게시판의 여백을 중복 확보했다.
도면 검수는 이를 이미 FAIL 처리했지만, 기획 정책의 「맵이 넓으면 줄인다」가 compact 절에만 있어
open으로 분류된 교실의 최초 기획을 제대로 제약하지 못했다.

모든 spaceProfile에서 먼저 기물/활동 점유와 필요한 동선을 배치하고 외곽을 정한다.
기획 scaleReason에는 가로 축소안·세로 축소안의 크기/면적, 바꾼 행·열, 동작별 좌표 근거를 남긴다.
기획 검수 scale과 제작 전 도면 검수 spaceUse에서 같은 기능을 유지하는 더 작은 안이 있으면 FAIL이다.
공통 빈칸 비율/직사각형 수치 게이트를 open에 무조건 적용하지 않으며 주차 회전이나 통행을 없애지 않는다.
소품으로 바닥 채우기, 가구/인물 축소, 필수 좌석 삭제, 활동 이름으로 중복 여백을 정당화하는 것은 금지다.
특정 면적/축소율은 보편 합격 기준이 아니다. 교실의18×18은 비교할 시작안이며 완료/승인 치수가 아니다.

사용자 교정은 기존 `/api/action fix`로 교실 기획부터 재검수하도록 저장한다. 계획/카드를 손으로 고치지 않는다.
기존 하네스의 다음 기획 실행은 이전 planning과 A/B 판정을 history에 보존하고 새 해시로 다시 검수한다.
수정 프롬프트는 실행 시 파일을 읽으므로 다른 공간의 진행 작업을 중단하거나 전체 큐를 재개할 필요가 없다.

### 대기 원인과 실제 그림 실행 구분 (2026-10-05)

`activity.snapshot`은 각 공간의 waitKind와 waitingFor(현재 선행 실행의 작업 id/공간/단계)를 제공한다.
전용 실행기의 직렬 처리 대기(pipeline-order), 다음 배정(scheduling), 전체 큐 pause로 미배정(global-pause),
선택 완료 뒤 등록 연결 부재(integration-missing), 사용자 결정(user-decision), 운영 확인을 구분한다.
등록 연결 부재는 워커 슬롯 대기나 자동 등록 예약이 아니다. 감옥/주차장 선택 완료는 이 분류다.

workers는 실제 살아 있는 sh 작업의 active/nativeDrawing/preparing/reviewing 수다.
art 준비자를 실제 칩 드로잉으로 세지 않고 art-native만 nativeDrawing에 포함한다. 이는 native 실행
작업 수이며, 그 내부 하위 모델 개수의 실측값을 뜻하지 않는다. 모델/출력 경과 시간은 기존 작업별 표시에 남는다.
갤러리의 art 대기도 실제 다음 단계인 주문서/준비 또는 반려 도면 수정으로 표시한다.
전체 paused 때문에 지정 작업까지 멈춘 것으로 표시하거나, 도면 수정 대기를 부족 칩 제작 대기로 표시하지 않는다.
공용 등록 연결이 없는 공간은 단계 배정 대기 목록에서 운영 점검으로 옮긴다.

UI 헤더는 실행 워커와 실제 칩 제작 수를 별도로 표시한다. 운영 현황에는 각 대기 공간의 다음 단계와
현재 앞에서 실행되는 공간/단계를 표시하고, 등록 미연결에는 실행 예약이 없다고 명시한다.
이 변경은 관측/표시 변경이다. 전용 실행기의 직렬 정책이나 모델/그림 실행 한도를 바꾸지 않는다.


### 요청 공간 병렬 운영과 축소 검수 보정 (2026-10-05)

기존 전용 실행기는 `not sh.PROCS`와 전체 그림 작업 조회로 모든 공간을 직렬화했다.
`space_supervisor.admission`은 기본 6개 공간의 기획·A/B 기획 검수·재료 조사/검수·그림 준비·
도면 검수·native 저작·조립 그림 검수를 병렬로 허용한다. 같은 공간의 단계는 동시에 시작하지 않는다.
A/B 두 작업은 한 공간 슬롯과 두 작업 슬롯을 사용한다. DB running 기록은 종료 수거 전까지 슬롯을 차지한다.
공용 코드/프로젝트를 쓰는 build/review/probe/bake는 다른 작업이 모두 끝난 뒤 실행하고,
대기 중인 공용 단계가 있으면 새 병렬 작업 배정을 멈춰 계속 밀리지 않게 한다.

- `SUPER_HARNESS_SPACE_PARALLEL` 기본 6; `max_codex`는 작업 배정 상한이다.
- 하위 interior-props 풀도 `SUPER_HARNESS_SPACE_PROP_PAR` 기본 2로 제한한다.
  native 작업 수는 내부 모델 수가 아니다. 다른 기물 서비스의 32명 설정을 바꾸지 않는다.
- Codex scratch cwd는 work/<concept>/<kind-tag>, 쓰기 허용은 자기 개념 폴더와 명시된 저작
  워크트리다. 기획/조사/검수에 공용 소스 쓰기 권한을 주지 않는다. build/review/judge/discover는
  기존 소스 권한을 유지하며 전용 실행기에서는 독점 단계다.
- heartbeat에 parallelSpaces/waits/draining을 기록한다. 화면은 공간 슬롯/작업자 슬롯/공용 단계
  대기를 구분한다. SIGUSR1은 새 배정을 멈추고 기존 단계와 그 후속 콜백을 수거한 뒤 종료한다.
- 운영 서비스는 `super-harness-parallel-spaces.service`, 동일한 5개 요청 공간만 담당한다.
  이전 requested-spaces 서비스의 진행 작업 709 결과 수거를 확인한 뒤 종료했다.
  이전 도면·그림 회차·사람의 결정·전체 pause를 보존했다.

축소 관문에서 «더 작은 배치가 가능하면 무조건 FAIL»은 수학적인 최소 면적 찾기로 이어졌다.
하수도 17×17→16×16, 공동묘지 17×15→16×14, 교실 13×13→12×13 추가 요구가 실제 기록에 남았다.
이제 불필요한 패딩·중복 활동 띠·기물 대비 지배적인 빈 바닥을 실제 좌표로 특정할 때 반려한다.
가로/세로 비교와 가구 크기·필수 기능 보존은 유지하지만 단순히 더 조밀한 재배치가 가능하다는
이유만으로 FAIL하지 않는다. 시점·벽/문 접합·통행·정체성 결함은 계속 필수 수정이다.
수정자는 직전 fixes와 파일/좌표/수정 전후를 항목별로 대조하고, 남은 오래된 좌표와 방향별
벽 마스크를 확인한다. 검수 기준 변경은 기존 판정을 PASS로 바꾸지 않으며 다음 독립 검수에 적용한다.


### 첫 화면의 실제 진행·산출물 카드 (2026-10-05)

`web/gallery.html`의 상단 live-board는 진행/대기/막힘 상태의 요청 공간을 접지 않고 표시한다.
현재 작업 설명, 모델/시작 후 경과/최근 출력, 산출물·검수 확인률, 기획도/칩/조립 이미지 수,
실제 그림 확대, 후보 큐 상태, 부족한 재료, 최근 반려 근거, 최근 이벤트, 다음 산출물을 제공한다.
상세 창에서도 concept-progress를 문서 details 밖에 두어 진행 상황을 숨기지 않는다.
예시/결과 선택 UI는 기존 Allow/Deny/수정 동작을 그대로 사용한다.

관측은 `space_progress.py`의 읽기 전용 observer가 담당한다. 운영 서비스는
`super-harness-space-progress.service`이며 실행기는 unified 체크아웃의 이 파일을 실행한다.
`monitoring/space-progress/latest.json`을 10초 간격으로 원자적으로 교체하고 기존 `/data/` 경로로
제공한다. 단일 flock으로 중복 observer를 막는다. 독립 서비스라 그림 제작/공용 게시 작업을
재시작하지 않고 UI를 배포할 수 있다. 현재 실행 상태는 기존 activity API로 5초마다 갱신한다.

- %는 시간 추정이 아니라 8개 산출물/관문의 현재 확인 비율이다. 기획 작성/승인과 재료 준비는
  기존 gate의 읽기 전용 report, 칩 확보는 해시 검증한 후보 또는 승인 재료, 공간 조립은 현재
  단계의 예제 PNG, 시각 검수는 현재 review report, 시험은 시각 검수 후 result-review/bake/done,
  등록은 done 기록으로 확인한다. 자동 수정 시 내려갈 수 있으며 예상 남은 시간은 표시하지 않는다.
- 기획도는 planning-visual fingerprint와 그림 hash가 현재 기획에 맞을 때만 노출한다.
  기획도를 실제 칩·공간 이미지 수에 더하지 않는다. 생성 그림이 없으면 아직 확인되지 않았다고 표시한다.
- native 후보 큐는 현재 art-execution의 worktree 내부 DB/round state만 읽는다. 내부 후보의
  처리 완료와 품질 PASS를 구분한다. interior-props의 제작 중 PNG는 현재 run이 실제 시작한 뒤
  나온 파일 또는 해당 run의 검사 결과가 있는 파일만 노출하고 검수 전으로 표시한다.
  제작 중 파일은 어떤 승인 milestone도 만족시키지 않는다. 이전 요청의 동명 h1-A 파일을 세지 않는다.
- 하위 제작 로그의 내용은 읽지 않고 수정 시각만 읽어 native 관리 프로세스가 조용한 동안에도
  실제 하위 출력 시각을 보여준다. 모델 사고 과정/명령/프롬프트를 제품 화면에 싣지 않는다.
- 35초 이상 오래된 snapshot과 fetch 실패는 마지막 확인 자료임을 표시한다. 실패를 이미지 0개나
  새로운 진행률로 바꾸지 않는다. 오류가 난 공간만 오류 표시하며 나머지 카드는 계속 관측한다.

브라우저 근거: `verify-shots/space-live-progress/`의 desktop/detail/mobile PNG.
실제 서비스에서 기획도 확대, 접히지 않은 상세 진행, 모바일 가로 넘침 없음, JS 오류 없음 확인.


### 완성 그림 뒤의 기술 실패와 복구 (2026-10-05)

실측: 하수도 native job 719는 PNG 5개를 만들고 기계 검사를 통과했지만,
구조 예시 renderer가 `wetstone.first`를 읽어 5개 모두 `phase=review / failed`였다.
실제 바닥 스펙은 `tiles` 배열이다. 감독은 pool의 exit 0만 보고 수집을 시작했고,
수집 뒤에는 감옥 전용 고정 경로/판 번호가 하수도에도 적용되어 다시 막혔다.

- `art_execution.native_errors`는 종료 후 실제 SQLite/state의 후보 상태와 검수 ERROR를
  확인한다. 기술 실패·미완료는 nonzero와 nativeErrors로 상위 UI까지 전달한다.
  품질 FAIL/HARD는 정상적인 검수 결과이므로 기존 피드백·수정 경로를 유지한다.
- `interior-props retry-review-errors <rounds> --queue-only`는 failed 검수만 받는다.
  기존 그림을 기계 검사하고 전후 SHA256이 같을 때만 검수 큐로 복구하며,
  원인과 해시를 history에 남긴다. 그림 시도 수·품질 판정·수정 상한은 초기화하지 않는다.
- 구조 renderer는 실제 `wetstone.tiles`로 바닥을 합성한다. 하수도 운영 복구 시
  기존 5개 그림 보존과 review pack 생성을 확인했다. 변경된 코드/DB의 도면 해시는
  다시 묶고 독립 도면 검수를 재요청했다. 이전 PASS를 복사하지 않는다.
- 일반 interior-props 선택 예시는 receipt의 품목/판/후보/실제 이미지 경로를 따른다.
  감옥의 계단·문 열림/닫힘 묶음은 기존 계약을 유지한다. 일반 공간은 부품 PASS 뒤에도
  조립 공간 검수를 요구하며 불합격 수정 지시를 피드백에 전달한다.
- 교실 job 720의 수정안은 상세 `repairPlan.fixes`가 있었지만 `changes` 키만 검사해
  준비 오류가 났다. changes 요약 또는 target/before/after/modifiedFiles/verificationResult를
  모두 갖춘 상세 수정안을 받는다. route·폐기 제약·독립 검수는 그대로 요구한다.
  준비 프롬프트에도 같은 계약과 require_preparation 호출을 명시한다.
- 진행 관찰기는 seed.contentRoot의 격리 그림 폴더를 따라간다. 루트 폴더만 찾아
  생성된 PNG 5개를 0개로 표시하던 문제를 수정했다.

공동묘지 job 722는 실제 도면 FAIL이다. 면적을 줄인 뒤 관리열 x13에 맞게 부품 지시서의
옛 x14를 동기화하지 않은 결함이며 원본 판정으로 수정 큐에 넣었다.
웹소켓 426 로그는 성공한 작업에도 있어 그것만으로 중단 원인을 단정하지 않는다.


### 사용자에게는 실제 타일 공간 데모를 제공한다 (2026-10-05)

`art → native → collect → art-demo → art-context-review → art-review`가 필수다.
`art-demo`는 부품 시트/한 부품을 붙인 기준 방 대신 모든 현재 품목으로 공간 전체를 조립한다.
부품 FAIL도 현재 데모를 만들고 실제 상태를 보여 준 뒤 기존 피드백/누적 수정 한도로 고친다.
시점 calibration은 기존 표본 교정 후 scene으로 돌아온 다음 데모를 만든다.

- `art_demo.py`가 현재 receipt/원본 그림/기존 선택을 고정한 입력을 작성한다. 작업자는 배치표 JSON만
  제출한다. 감독은 해시를 재확인하고 원본 PNG의 사각형 crop을 원배율로 alpha composite한다.
  새 화소·도형 생성·크기 변경 API가 없고, 캔버스 밖 배치/빠진 품목/바뀐 원본은 거절한다.
  보충 타일은 승인 도면의 소스 또는 변경 없는 git assets/public/assets 아틀라스다.
- 후보 묶음 정본은 art-demo-history/<generation>/components.json에 보존하고,
  전체 공간 예시를 단일 space-demo 그룹으로 만든다. components가 원래 품목/후보를 역참조한다.
  과거 선택 DB는 보존한다. 데모 조합은 임시 배치이며 사용자 선택/공용 설치가 아니다.
- 모든 전체 데모는 조립 독립 검수 대상이다. `art_choices.view.eligible`은 demoVersion=1과 기존
  native/조립 PASS를 모두 요구한다. 부품별 Allow를 먼저 요구하지 않는다.
- 검수 중인 데모도 화면 상단과 상세에 노출한다. Allow/Deny/수정은 현재 해시의 검수를 통과한
  데모에 적용한다. 수정 의견은 Deny와 함께 기록되어 원래 재제작 경로로 전달된다.
- 기술적인 데모 배치표 오류는 원본/오류를 보존하여 같은 타일에서 최대 3회 보완한다.
  품질 수정 한도를 초기화하거나 합격으로 바꾸지 않는다.
- 기존 idle art-review/art-context-review도 지정 공간 실행기가 데모 단계로 이동시킨다.
  운영 배포는 실행 중 native 작업을 drain한 후 새 감독으로 넘기며 전체 자동 큐는 재개하지 않는다.

여기서 데모는 실제 타일을 조립한 시각 결과다. playable/정본 프로젝트 설치·저장·재로드·공용 등록은
별도 완료 근거가 필요하며 데모 PNG로 대체하지 않는다. 기존 주차장의 12면/6대 native 공간 그림은
원본 그대로 데모에 연결하고 새 그룹의 독립 검수를 요청했다.


### Native 작업 문맥 격리 (2026-10-05)

교실 작업 739는 Autocompact thrashing으로 PNG 없이 종료했고, 공동묘지 작업 729의 일부는
429로 종료했다. 준비된 data 경로가 art-worktree 안에 있어 기존 WORK도 저장소 아래였고,
modern 작업자는 ROOT에서 직접 시작했다. 감독 art_execution은 DATA/work/native/<공간-입력해시>를
PROP_HARNESS_WORK/VEH_HARNESS_WORK로 전달한다. 두 native 실행기는 그 경로에서 모델 세션을 열고,
상대 콘텐츠 경로는 명시된 ROOT에서 해석한다. 실제 제작 계약/그림/독립 검수는 바꾸지 않는다.
운영 복구는 성공/품질 FAIL을 보존하고 기술 실패 작업만 재큐잉했으며, 변경 코드·큐 해시로
새 도면 검수를 요청했다. 429 자체를 해결했다고 주장하지 않으며 원본 로그/실패 이력은 보존한다.

## 키워드에서 계속 만드는 공간 흐름 (2026-10-05)

`/spaces` 상단에 키워드를 입력하고 **이 키워드로 계속 만들기**를 누른다.
`keyword_seeds.py`는 같은 `sh.sqlite`의 `keyword_seeds` / `keyword_spaces`에
입력, 활성 상태, 제안 회차, 공간 소속을 저장한다. NFKC·공백·대소문자 정규화 후
같은 키워드 재제출은 기존 흐름을 반환하며, 중지한 흐름을 몰래 재개하지 않는다.
다시 시작은 **계속 추가하기**로 한다. 공간 이름의 동일 정규화 중복은 DB에서 막고,
의미상 중복은 기존 제목을 제안 모델에 전달하여 피하도록 지시한다.

- `seed-discover`는 기존 Codex 설정으로 최대 6개 장소를 제안한다. 새로운 공간은
  `plan`부터 기존 기획·적대 검수·재료 확인·native 제작·전체 데모·시각 검수를 모두 거친다.
  시드 키워드와 시대/문화 요구는 각 공간의 `why/source`에 남아 다음 단계로 전달된다.
- 미완성/미결정 공간이 12개 쌓이면 **새 제안만** 기다린다. 하루 상한은 없다.
  완료하거나 폐기하여 자리가 생기면 계속 보충한다. blocked도 미완성 수에 포함한다.
- **새 공간 추가 중지**는 새 제안 발주를 멈춘다. 이미 발주된 제안과 공간 제작,
  사용자 Allow/Deny, 저장한 이미지·선택은 보존된다.
- 제안 오류는 90초 간격으로 재시도하고 연속 3회 실패하면 해당 흐름 추가만 멈춘다.
  서버 API는 실제 오류와 실행기 heartbeat를 보여준다. 합격이나 선택을 대행하지 않는다.
- `/api/seeds`는 읽기, `/api/action`의 `start-seed`/`pause-seed`/`resume-seed`가 쓰기다.
  키워드를 주지 않은 상태에서는 비용이 드는 제안 작업을 실행하지 않는다.

전체 자동 탐색을 멈춘 상태에서도 명시적으로 입력한 키워드는 전용 실행기가 처리한다.
배포 시 `SUPER_HARNESS_KEYWORDS=1 SUPER_HARNESS_RUNNER_ID=keyword-spaces`로
`python3 src/harnesses/super-harness/space_supervisor.py`를 띄운다(기존 id 인자 없이 가능).
현재 서비스는 `super-harness-keyword-spaces.service`; 입력과 중지는 서버 재시작 후에도 남는다.
명시 id 실행기와 같은 DB의 실행 작업 수를 보며 3공간·native 내부 4워커 제한을 공유한다.
선행/파생 공간도 해당 범위에 넣고, 무관한 전체 발견 큐를 재개하지 않는다.
전체 실행을 켜면 기본 `sh.tick`가 맡고 전용 실행기는 기존 작업 회수만 계속한다.

화면 근거: `verify-shots/keyword-seeds-desktop.png`, `verify-shots/keyword-seeds-mobile.png`.
Python/JS 문법 확인과 실제 브라우저 로딩(390px에서 가로 넘침 없음)을 확인했다.
사용자의 실제 키워드는 아직 없으므로 유료 모델의 새 시드 생성 완료를 주장하지 않는다.
기존 공간의 조립 데모는 시각 미리보기이며 게임 정본 설치/플레이 가능 증거와 구별한다.

## 공급자 오류 자동 복구 (2026-10-05)

`provider_retry.py`는 실제 CLI 오류 줄의 429/502/503/504를 품질 반려와 분리한다.
`sh.sqlite.provider_retries`에 단계·현재 수정 입력·호출 명세·시각을 저장하고
2분 → 5분 → 15분 → 30분 간격으로 재시도한다. 이후에도 30분 간격을 유지하며
`Retry-After` 초가 더 길면 그 시간을 지킨다. 품질 수정 10회와 사용자 결정은 소모/초기화하지 않는다.
문맥 thrashing은 자료를 절 단위로 읽도록 지시하여 기술 재시도 최대 2회만 한다.
그 이상과 알려지지 않은 오류는 원본 근거를 보존하고 운영 확인 대상으로 남긴다.

- `job-invocations/<job>.json`: 실제 명령·프롬프트 경로·콜백 입력을 보존한다. UI에 노출하지 않는다.
- 예약은 SQLite와 실행 잠금으로 중복 시작을 막는다. 대기는 모델 슬롯을 차지하지 않는다.
  기존 A/B 검수는 대기 중인 형제 검수도 미완료로 계산하여 조기에 FAIL 처리하지 않는다.
- 프로세스 손실은 저장한 예약에서 재개한다. 단계/피드백/수정 회차가 바뀌면 오래된 예약을 취소한다.
  키워드 추가를 중지한 경우 새 제안 재시도도 취소하고 이미 만든 공간은 유지한다.
- `native_retry.py`는 실제 실패 후보 로그를 확인한다. 정상 PASS/품질 FAIL/HARD 후보는 보존하고,
  검수의 공급자 오류는 기존 PNG에서 해당 검수만 재개한다. 오류 로그/후보 상태를 먼저 보관한다.
  native 실행은 승인한 원본 입력 사본과 실행 대상이 그대로인지 다시 확인한다.
- `activity.py`는 원인·예약 시각·횟수 및 슬롯을 기다리는 상태를 보여준다. 일부 검수만 대기하는 경우도 표시한다.

생성 과정에서 바뀌는 조립 예시를 입력 해시에 포함하여 공동묘지 수집이 실패한 원인은
`layout.sources[].role="generated-preview"`로 분리한다. `art-output` 내부 PNG/JSON에만 허용하며,
독립 검수 전에 불변 사본으로 동결한다. 시드/코드/기준 아틀라스는 원본 해시를 계속 대조한다.
현재 출력 그림은 기존 수집 및 독립 시각 검수의 대상이며 자동 PASS로 처리하지 않는다.
기존 공동묘지는 변경 이력 보관 후 새 도면 검수에 제출하고, 합격하면 이미 만든 그림을 수집한다.

`reference_source.py`는 운영자가 등록한 `DATA/reference-catalog.json`의 정본 스냅샷 SHA와
projectId 및 추출 문서를 확인하여 새 공간의 `reference-source.json`에 연결한다.
공용 참고자료 출처는 새 공간의 설치 대상이 아니다. 없는 기능 어댑터나 실제 누락 자료를
있다고 간주하지 않는다. 설치/저장 완료는 여전히 별도 정본 재로드 근거가 필요하다.

운영 적용: 기존 그림/선택과 전체 paused 상태 보존. 실행 중 워커를 drain하고 새 감독으로 넘긴다.
이번 변경에서는 Python/JS 문법과 실제 429 예약→재실행, 브라우저 상태를 확인한다.
AGENTS 규칙에 따라 gates/vitest/전체 typecheck는 실행하지 않는다.

레거시 후보에 이전 실행/도면 JSON이 없더라도 완료 영수증·후보·승인 기획이 있으면
수정 명세를 새로 준비할 수 있다. `resumeMode=collect-existing`은 native 검사 완료를
확인하고 새 도면의 독립 검수를 통과한 경우에만 수집→데모→시각 검수로 이어진다.
그림 결함을 자동 PASS하거나 완료 후보를 다시 queued로 바꾸는 우회가 아니다.

수집기는 native 가구 `ctx-cand.png`와 장면 어댑터 `ground-context-x1.png`를 모두 지원한다.
후보 검수 팩 내부의 실제 파일만 해시로 묶으며, 전체 공간 데모와 시각 검수 의무는 유지한다.

### 마무리 우선 배정·실제 저장 상태 (2026-10-05)

`settings.completion_priority`에 지정한 공간 중 실행 가능한 후반 단계(데모·검수·등록)를
`finish_priority.py`로 먼저 배정한다. `space_supervisor.py`는 다음 빈 공간 슬롯을 이 순서로
배정하고, `keyword_seeds.py`는 해당 대기열이 있을 때 새 키워드 제안을 보류한다.
이미 실행 중인 작업은 끊지 않는다. 반려·사용자 판단 대기·429 대기는 영구 독점하지 않는다.
현재 기존 5개 운영은 `super-harness-spaces.service`이고 이전 requested/completion 서비스는 drain 후 종료한다.

`art_choices.installationProgress`는 현재 선택 해시와 공용 등록·정본 저장·재로드 증거가
맞을 때만 노출한다. 플레이 확인이 남았으면 **맵 저장 완료 · 플레이 확인 남음**으로 표시하고
기존 `installation`의 `runtimePassed` 완료 조건은 유지한다. 저장했다고 게임 검수 PASS를 만들지 않는다.

하수도에서 숫자 팔레트 RLE `2:3`을 해석하지 못해 PNG가 없던 문제를 수정했다.
`interior-props recheck-format-errors <round> --queue-only`는 기존 pxg 해시와 실패 기록을
보존해 기계 검사를 다시 실행한다. 통과한 그림만 독립 검수에 올리고 그림 회차는 늘리지 않는다.
`art_execution.py --resume-review`는 승인 명세가 그대로이고 미완료 행이 전부 검수 대기일 때만
재개한다. 격리 콘텐츠 루트는 승인된 `tiledata/hand-interior/new/items.json`에서 찾는다.
공간 슬롯 확인과 실행 예약은 공통 `space-admission.lock`으로 직렬화한다.
여러 supervisor가 동시에 마지막 슬롯을 보고 작업을 중복 입장시키지 않도록 한다.

교실 `scope:classroom`은 `classroom_choices.py`가 전용 영수증을 읽는다. `contractSha256`이 있다는
이유만으로 주차장 `candidate/machine/independent` 구조로 읽지 않는다. native 실행 직후
`art_receipts.py`가 원래 교실 어댑터의 receipt 함수를 호출하여 현재 state/check/verdict와 문 상태
그림을 묶는다. 오래된 실패 영수증 때문에 PNG 생성 이후에도 멈추던 현상을 방지한다.
실제 품목/assembly FAIL은 유지하며 전체 데모 → 독립 검수 → 피드백 수정으로 보낸다.


### 동시 공간 6개와 원본 이미지 확대 보기 (2026-10-05)

사용자 요청에 따라 공간 슬롯을 3→6, 공간별 interior-props 동시 제작은 4→2로 바꿨다.
단계 작업 `max_codex=16`과 하위 native 후보 작업 수는 별도다. 화면은 **동시 공간/한도**,
**단계 작업**, **칩 제작 묶음**을 구분하여 묶음 하나를 모델 한 명처럼 표시하지 않는다.
활성 heartbeat를 drain 중인 옛 실행기보다 먼저 사용한다. 기존 작업은 종료까지 수거한다.
운영 정본 서비스는 `super-harness-production-spaces.service`이며 기존 5개 공간과 사용자 키워드를
하나의 scoped supervisor에서 맡는다. 이전 spaces/keyword-spaces 서비스는 disable+drain한다.
공용 조립/저장 단계의 독점, 마무리 우선순위, 429 예약 재시도는 유지한다.

`web/art-choice.js`의 `createImageViewer`는 진행 이미지·문서 그림·Allow/Deny 예시가 함께 쓴다.
`gallery.html`의 native `<dialog>`가 상세창 위 최상단에 열리고 `/data/`의 원본을 로드한다.
화면 맞춤, 100%, 5~1600% 배율, 휠 줌, 포인터 드래그, 키보드 +/−/0·Esc,
원본 새 창, 명시적인 닫기를 지원한다. Esc는 확대창만 닫아 뒤의 상세창을 유지한다.
관찰 근거: `verify-shots/harness-image-viewer/`의 주차장 desktop/mobile 그림. 390px 화면에서
대화상자 너비366px, 드래그 후 스크롤 x+150/y+100, 브라우저 pageerror 0을 확인했다.


## 고유 테마 전용 세트 관문 (2026-10-05)

`theme_production.configure(seed_id, reason)`는 **기존 키워드**를 전용 팩 제작 정책으로 전환한다.
해리포터처럼 전체 시각 언어가 중요한 명시 요청에 사용한다. 모든 키워드를 임의로 같은 정책으로
분류하지 않는다. 정책/기획/검수는 `DATA/keyword-seeds/<id>/theme/`에 저장한다.

- 공간별 작업 전에 `theme-plan` → 별도 `theme-review` 모델 작업으로 공통 팔레트, 시점,
  사람 대비 크기, 재질/건축 문법과 8개 재료군(건축·표면·가구·식생·인물·생물·탈것·효과)을 정한다.
  각 공간의 `identityAssets`와 실제 제작 경로를 빠짐없이 적는다. 기획 합격은 그림 합격이 아니다.
- 모든 공간은 `theme-wait`에서 공통 검수를 기다린 뒤 새 기획으로 이동한다. 기존 그림·선택·수정
  횟수는 보존한다. 과거 정책의 작업 결과/예약을 현재 테마의 승인으로 채택하지 않는다.
- `planning.json.theme`는 현재 정책/기획 해시에 묶는다. 각 변형의 `themeIdentityAssets`는 공통
  정체성 품목 전체를 실제 requirements ID로 연결한다. 재료 조사의 목적 tilesetId는 정책 packId다.
- 후보 수집의 `art-result.json.themeCoverage`는 모든 요구 재료를 receipt의 native 후보 PNG
  경로/해시에 연결한다. 데모 입력과 제출 시 모두 확인한다. 전용 테마에서는 git에 추적된 기존
  PNG라는 이유만으로 stock 바닥·숲·Actor1을 끼워 넣던 fallback을 허용하지 않는다.
  운영자가 정책 reuseExceptions에 기록한 개별 경로/해시만 예외다. 장면 미리보기는 원본 칩이 아니다.
- 미제작 재료는 원인을 기록하여 art로 복귀하고 기존 자동 수정 한도를 소모한다. 한도를 지워서
  무한 재생성하지 않는다. 공통 기획도 max_art_revisions 한도 내에서 반려 피드백을 반영한다.
- 키워드 UI는 전용 세트 모드와 공통 기획/독립 검수/제작 단계 및 오류를 표시한다. theme 작업도
  기존 슬롯, 공급자 재시도, job-invocations 기록을 사용한다. 공통 기획 확장은 승인 미술 기준을 유지한다.

이 계약 자체가 새 타일 팩이나 생물 제작 어댑터를 제공하지는 않는다. 해당 제작 경로는 실제
native 하네스의 지원·확장과 그림 검수를 거쳐야 한다. 전용 팩의 번들 배포와 정본 저장/재로드는
기존 완료 조건을 그대로 적용한다. 정책 전환을 그림 완성/사용자 Allow로 표시하지 않는다.

운영 적용: 해리포터 시드 `3e7ac64c5cf1d943e08a`의 12공간에 전용 정책을 저장했고
공통 theme-plan 작업을 시작했다. 현재 범위 실행기는 `super-harness-theme-spaces.service`이며
이전 production-spaces는 새 입장을 중지하고 실행 중 결과를 보존하며 drain한다.
전체 paused=1은 유지한다. `/api/seeds`의 실제 정책 상태와 데스크톱/390px 모바일 화면을
확인했다(`verify-shots/dedicated-theme/`). Python/JS 문법 확인만 수행했고 gates/vitest는 실행하지 않았다.
아직 새 전용 그림·데모의 완성이나 검수 PASS를 뜻하지 않는다.


## 제작 범위 분기·우선 세계관·컨셉아트 (2026-10-05)

- 키워드 발견 모델은 공간 제안 전에 `production`을 함께 결정한다. `production_strategy.py`가
  `dedicated`/`extend-kit`, 근거, 등록된 native 키트 후보, 재사용/추가 제작 조사 목록을 검증한다.
  기존 키트 후보는 사용 승인이 아니다. 실제 참고문서/그림과 재료 검수는 계속 필요하다.
  고유 세계관은 전체 세트를 계획하고, 일반 중세 공동묘지 같은 장소는 기존 키트에 부족한 재료만
  보충한다. 문자열 목록으로 고유명사를 분류하지 않는다. 이후 공간 제안은 확정 전략을 유지한다.
- `production_priority_seed` 설정은 해당 키워드의 실행 가능한 작업을 먼저 입장시킨다.
  이미 실행 중인 다른 작업은 종료시키지 않는다. 우선 테마가 그림/사용자 판단을 기다릴 때는
  다른 작업이 빈 슬롯을 사용할 수 있다. 기존 completion_priority는 그 다음 순서다.
- `theme_concepts.py`는 실제 컨셉 그림의 등록 → 별도 모델 시각 검수 → 사용자 Allow/Deny를
  제공한다. 현재 기획 SHA와 실제 PNG SHA를 확인하고 두 근거에 사용자 결정을 묶는다.
  컨셉아트 승인 전에는 공간별 전용 칩 제작으로 넘어가지 않는다. 컨셉 PNG를 게임 타일로 자르지 않는다.
- 생성 접점: built-in image_gen으로 만든 실제 PNG와 최종 프롬프트를
  `theme_concepts.submit(seed, image_path, prompt)`에 전달한다. `concept-request.json`은 미생성/
  반려 시 생성 요청을 보존한다. **현재 데몬에는 built-in image_gen 호출 권한이 없으므로 생성·재생성
  요청은 이미지 도구를 가진 운영 에이전트가 처리한다.** 자동 완료를 주장하지 않고 UI에도 요청 대기로 표시한다.
  검수는 데몬이 `theme-concept-review` 작업으로 실행하며 429는 기존 예약 재시도를 쓴다.
- `/spaces`의 키워드 카드에 전략/우선순위/실제 컨셉 그림/확대/Allow/Deny를 표시한다.
  독립 검수 불합격은 사용자 Allow로 우회하지 않는다. 판정은 원본 PNG와 기획이 바뀌면 만료한다.
- 해리포터 v2 컨셉 원본과 생성 프롬프트는 `docs/art-direction/harry-potter/`에 보존한다.
  이는 새 타일 팩·공용 등록·프로젝트 정본 저장 완료가 아니다.


운영 근거: 해리포터를 production_priority_seed로 저장했다. v2 실제 컨셉 시안은 독립 검수에서
정체성/재질 PASS, 시점/상대 크기 FAIL을 받아 승인하지 않았다. 지적을 전달한 v3 편집 시안을
새 해시로 등록하고 다시 검수한다. v2의 PNG/판정은 기록으로 보존한다. 현재 실행기는
`super-harness-priority-spaces.service`이며 이전 실행기는 drain한다. 전체 paused=1 유지.
브라우저에서 실제 그림과 원본 확대 다이얼로그를 확인했고 390px 가로 넘침 및 pageerror는 0이었다.
근거: `verify-shots/theme-concepts/`. Python/JS 문법 확인만 수행했으며 gates/vitest는 실행하지 않았다.


## 승인 대기와 초안 제작 분리 (2026-10-06)

컨셉 Allow 미입력을 12개 공간 전체 정지로 연결하여 실제 실행 작업이 0개가 된 문제를 수정했다.
`theme_concepts.authorize_draft(seed, reason)`는 독립 시각 검수 PASS인 현재 PNG/기획 SHA에만
운영자의 초안 제작 권한을 기록한다. 사용자 Allow 기록을 만들지 않으며 Deny는 초안 권한보다 우선한다.
현재 이미지/기획이 바뀌면 권한도 만료한다. UI는 선택 없이도 초안을 제작한다는 사실을 표시한다.
대기 이유는 매번 현재 상태로 갱신한다. 재개 시 기존 기획이 실제 승인 관문을 통과했다면 survey부터
이어가고 그렇지 않으면 plan으로 돌아간다. 그림/기획 수정 횟수를 초기화하지 않는다.
전용 테마의 기획 수정도 사용자 지정 max_art_revisions 한도를 따르며, 최종 결과/타일 선택과
공용 설치·정본 저장·재로드 조건은 그대로 유지한다.

운영 확인: 해리포터 현재 시안에 초안 권한을 적용한 뒤 실행 작업 0개에서 공간 6개가 병렬 진행으로
돌아왔다. 마법약 교실은 새 기획 A/B 모두 PASS 후 survey가 실제 실행됐다. 사용자 컨셉 decision
파일은 생성하지 않았다. 실제 /spaces에서 초안 자동 진행 문구와 pageerror 0을 확인했다
(`verify-shots/theme-draft/desktop.png`). Python/JS 문법 확인만 수행했으며 gates/vitest는 실행하지 않았다.


## 전용 세트의 독립 재료 묶음 실행 (2026-10-06)

부분 준비 `preparedExecution`도 일반 execution의 도면/실행 관문을 거쳐 먼저 제작한다.
미구현 품목과 이유는 `art-pending-materials.json`에 보존하고, 전체 themeCoverage 없이
데모/완료로 넘어가지 않는다. 준비된 가구가 인물/효과 어댑터 미지원 때문에 그려지지도 않는
전체 정지를 제거한다. `art_execution.prepare`는 감독이 선택한 실제 Codex의 디렉터리를
자식 PATH에도 넣어 환경 override를 읽지 않는 오래된 격리 하네스에서도 같은 CLI를 실행한다.

기술 오류로 중단된 기존 픽셀을 재검사한 뒤에는 `execution.resumeMode: review`로
독립 검수만 재개할 수 있다. 미완료 native 행 모두가 `queued` / `review` 또는 `review2`이고
기계 검사 `ok`여야 하며, 변경된 검사 코드와 도면 입력은 새 배치 검수를 거친다.
승인 후 `--resume-review`가 같은 큐를 다시 확인한다. 그리기 횟수와 품질 판정은 초기화하지 않는다.

### 전용 세트의 여러 제작 묶음 누적 (2026-10-06)

`art_batches.collect`는 현재 실행의 승인 입력과 native 영수증을 검증한 뒤
`concepts/<id>/art-batches/`에 실행·도면·검수·수집 결과를 보존한다.
같은 테마 해시의 이전 영수증/PNG 중 현재 해시가 맞는 것만 합친다.
같은 품목을 다시 만든 경우 최신 영수증의 후보 묶음을 사용하고, 다른 품목은 보존한다.
수집자는 현재 실행의 결과만 반환한다. 이전 그림을 이번 실행의 납품으로 위장하지 않는다.

`theme_production.coverage_status`가 모든 기획 재료를 현재 native 후보에 대조한다.
아직 만들지 않은 품목은 조립을 시작하기 전에 `art`로 돌려 추가 제작하며 품질 수정 횟수를
소비하지 않는다. 실제 covered ID 집합이 늘지 않는 후속 묶음은 반복 실행을 중단하고
구체 누락 ID를 남긴다. `theme-material-progress.json`은 이 진행 근거를 보존한다.
전체 coverage와 이후 실제 공간의 시각 검수는 계속 필수이며, 부분 제작은 완성 상태가 아니다.
마지막 누락 재료가 들어오면 progress의 missing도 빈 배열로 갱신하고 feedback을
production-collected로 바꾼다. 이전의 누락 품목 추가 제작 지시가 품질 수정 단계까지 남아
이미 제작된 효과를 다시 주문하지 않는다. 전체 수집은 여전히 품질 합격이나 공간 완료가 아니다.

전용 인물은 `art-actors.json`의 걷기 주문과 `art-actor-actions.json`의 행동 주문을 따로 보존한다.
`theme_actors.collect`가 새 native 프로세스로 걷기/행동 납품을 확인하여 기존 제작 묶음에 합친다.
걷기만 있거나 행동이 미완료/변경되었으면 `art-actors-status.json`에 미완료 사유를 남기고 인물 coverage는 비워 둔다.
`art_choices`는 두 원본 시트와 근거를 묶고 공간 검수가 필요하다고 표시한다.
`theme_production`은 이 전용 어댑터가 확인한 nativeSheets만 조립 허용 원본으로 센다.

### 제작 전 바닥 종류 검사 (2026-10-06)

`art_layout.require_ground_kind`는 현재 seed.orders에 포함된 production 묶음 중
모든 칸이 명시적으로 layer=0/topMin=0인 경우 kind=flat을 요구한다.
소품 하네스의 floor는 입체 가구이므로 불투명한 지형 타일까지 투명 배경 검사로 반려하는
준비 오류를 제작 전에 차단한다. 기존 공용 품목과 다른 레이어의 가구에는 적용하지 않는다.
원본 PNG나 검수 결과를 수정하지 않고 새 준비 입력의 종류/해시를 고친 뒤 독립 검수를 받는다.

수집 `themeCoverage`는 native DB 행의 현재 후보 PNG만 참조한다. 과거 시도 `.aN.png`,
확대본, context는 비교 근거로 보존하지만 현재 원본 coverage에 섞지 않는다.
review/collect-existing 재개는 현재 DB 검사·독립 검수 해시에 묶인 원본의 재검수 납품이다.
다시 그리지 않았다는 이유로 결과를 버리지 않으며, 제작과 재검수 이력을 구분하여 보존한다.

전용 인물 수집은 걷기72×128, 행동 가로 시트의 크기와 프레임 수를 확인하고
각 행동 rect/접지 anchor를 전달한다. `art_demo`는 인물마다 걷기와 행동의 전체 프레임이
recipes에 실제 배치되었는지 확인한다. 서로 다른 상태에서 각각 보여 주며 발 기준점으로 정렬한다.
행동 원본을 목록에만 넣거나 한 픽셀만 배치하면 충족되지 않는다. 접촉/가림과 실제 플레이는 별도 검수다.

인물 여러 명이 하나의 기획 재료인 경우(약실의 potions-actors) 봉인된 걷기 manifest의
productionContract.requirementActors에 `{요구사항ID:[인물ID,...]}`를 둔다. 인물 목록과
정확히 연결되어야 하며 교사·학생·보조자의 걷기와 모든 주문 행동이 완료되기 전에는
해당 재료의 coverage가 채워지지 않는다. 필드 생략 시 기존 인물ID별 요구사항 계약을 유지한다.

production 독립 검수의 슬롯별 측정은 `slotResults` 안에 둔다. 계단의 top_bands를
최상위에만 적으면 실제 관찰이 PASS여도 native 슬롯 검사에서 탈락한다. 현재 공통 review.md는
stepped 계단·시점·윗면 측정의 슬롯별 위치를 명시한다. 기존 실행 중 입력/판정은 바꾸지 않고,
현재 프로토콜을 새 준비 입력에 묶어 독립 검수한다. 형식 오류를 그림 결함으로 간주해 재저작하지 않는다.

production의 topMin>0 슬롯은 깊이1칸이라도 side_elevation을 실제 그림에 근거한
boolean으로 기록한다. 일반 단일 기물의 null 예외와 섞지 않는다. 지팡이 가게 문 4슬롯이
독립 PASS인데 null로 기록되어 native 검사에서 일괄 반려되던 형식 충돌을 방지한다.

진행 화면의 native PNG는 `art_execution.prop_content_root`로 실행기와 동일한
승인 layout.sources의 items.json 콘텐츠 경로를 읽는다. seed.contentRoot가 없는
새 격리 묶음을 워크트리 루트로 잘못 돌려 옛 hN-A.png를 보여주지 않는다.
legacy layout 없는 관찰만 이전 seed 경로를 사용하며 시각 미리보기로 게이트를 대체하지 않는다.
후속 묶음이 이전 items.json을 조립 참고로 함께 보존한 경우, 승인 sources에 해시로 묶인
현재 data/seed.json의 contentRoot를 사용한다. 선택한 루트의 items.json도 승인 sources에
있어야 한다. 결합된 seed가 없고 후보 루트가 여러 개이면 임의로 고르지 않고 중단한다.

추가 제작 중에도 `space_progress.collected`가 마지막 수집 원본을 계속 보여준다.
`art-choices.artResultSha256`과 현재/previous 결과 파일, 현재 테마 바인딩 및 각 원본·receipt
해시를 확인한다. 준비 단계가 결과 파일을 previous로 옮겼다는 이유로 확보한 칩이 0개로
사라지지 않는다. 재료 수는 같은 묶음의 coverage를 다시 계산하고, 추가 제작을 검수 반려로
잘못 설명하지 않는다. 보존한 칩은 품질 합격/공간 완료가 아니며 선택·승인 상태는 바꾸지 않는다.

### 전체 데모 수정 중 재료 진행 표시 (2026-10-06)

전체 공간 데모가 후보 화면을 대체해도 observer는 해당 generation의 `art-demo-history/*/components.json`을
통해 원본 확보량을 계산한다. `art-result.previous.json`의 해시·현재 테마·원본 영수증/PNG를 다시 확인한다.
이미 확보된 전용 재료를 이전 survey의 부족 목록으로 되돌려 표시하지 않는다. 확보량은 품질 PASS를 뜻하지 않는다.

작업의 `done`/종료 시각은 모델 프로세스 종료 직후가 아니라 결과 처리 handler가 끝난 뒤 기록한다.
수집 handler가 승인 입력을 확인하기 전에 다른 감독이 native 코드를 교체하는 경합을 방지한다.
새 실행기는 `running` 예약이 사라지고 해당 handler가 정한 stage를 확인한 뒤 이어받는다.

재검수 준비가 기존 data를 복사하면 `data/logs/*`와 `data/rounds/h*/review/*`는 실행 중 다시 쓰이는 파일이다.
이전 검수 자료로 sources에 남길 때는 감독이 제작 승인 전에 해시별 고정 사본으로 옮겨 참조한다.
실행 후 승인 해시 검사를 약화하지 않는다. native 코드·원본 PNG·시드·brief는 여전히 승인한 원래 입력에 묶인다.

인물 행동은 부품 큐와 별도 native 프로세스로 실행되므로 `actor_progress`가 승인 layout.sources의
다음 행동 주문과 현재 활성 주문의 차이를 관찰한다. 시도·프로세스·최근 로그 시각·현재 격자 해시와
일치하는 출력 프레임 수를 `/spaces`에 표시한다. 로그 본문은 읽거나 노출하지 않으며 출력/납품을
공간 검수 합격으로 표시하지 않는다. 실행기는 격리 공간에 charset-actor 코드가 있다고 가정하지 않고
실제 native 진입 파일을 써야 하며, 승인 준비에 보존한 native-actions.py와 바이트를 대조한다.

`native_collection.collect_existing`은 새로 승인된 collect-existing 실행의 완료 DB와 도면에
해시가 결합된 현재 PNG만 결정적으로 수집한다. 모델 수집자가 이전 완료 행을 반복 누락했을 때
원본을 다시 그리지 않고 회복한다. 같은 품목/후보의 최신 행을 사용하고, 이전 행은 이력으로 남긴다.
기존 coverage 참조도 실제 해시를 확인하여 같은 픽셀의 현재 경로에만 연결한다. 도면에 없는 PNG,
미완료 native 행, 다른 실행 모드는 이 경로로 새 합격을 얻을 수 없다.

옛 부품 보존을 실제 배치 의무로 혼동하지 않는다. 승인 도면의 `componentReplacements`는
`from/to/requirement/reason`으로 같은 기획 재료의 교체를 명시한다. 새 coverage와 이전 납품의
원본 해시로 양쪽 재료를 확인하고, 순환 교체나 인물 생략을 허용하지 않는다.
`art_demo`는 원본/영수증은 이력에 보존하면서 `requiredGroups`에 해당하는 현재 부품만 배치하도록
요구한다. 전용 E/W 문을 새로 만든 뒤 옛 정면 문까지 북벽에 억지로 추가하던 문제를 방지한다.
서로 다른 역할을 맡는 기존 후드와 새 배관 지지대는 교체가 아니므로 둘 다 필요하다.

### 실제 조립 장면을 첫 화면에 표시 (2026-10-06)

`/spaces`는 실행 중 공간의 실제 장면을 키워드 입력·컨셉아트보다 먼저 보여준다.
공간 카드 안에서도 이미지가 공정 체크리스트·모델 실행 기록보다 먼저 나온다.
조립 이미지는 최신 **초안**으로 표시하며 합격·완성 여부는 기존 관문을 그대로 따른다.
헤더의 「새 키워드·세계관 기획」 링크로 입력란과 컨셉 선택에 바로 이동한다.
변경 전 실제 브라우저에서 공간 카드 시작점이 y=1309px로 첫 화면 밖에 있었으며,
제작 중 이미지가 없는 것처럼 보이는 문제를 바로잡았다.
