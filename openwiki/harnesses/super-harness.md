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
