# 플레이 도구 — LLM 에이전트가 출하 플레이어로 게임을 직접 플레이하고 버그를 재현한다

이 폴더는 **출하 플레이어**(`player.html` + `exportProjectStoreShim`)만 쓴다. 편집기 셸은 절대 태우지 않는다 —
편집기 play 모드는 `@/project/store` 를 쓰므로 출하물 검증이 아니다(`AGENTS.md` 「편집기 QA 와 런타임 QA 는
다른 도구를 쓴다」). 세션은 `scripts/lib/runtimeQaRun.mjs` 의 **같은 op 실행기**를 그대로 재사용한다 —
도구마다 실행기를 복제하면 재현과 회귀 시나리오가 서로 다른 동작을 검증하게 된다.

```
qp.mjs ──serve──> vite(player-qa) + Chromium + player.html   ← 오래 살아 있는 세션
  │  짧은 명령(HTTP)                                        → DIR/actions.jsonl (재생 가능한 로그)
  └─ repro.mjs  : 로그의 한 토막을 새 브라우저에서 다시 재생 → REPRODUCED / NOT_REPRODUCED
       └─ to-scenario.mjs : 같은 op·기대를 scripts/qa/runtime/<id>.scenario.mjs 로 (회귀 테스트)
build-games.mjs : games.json → project.json + 부팅 스모크(타이틀→새 게임→필드) + playable 판정
```

## 1. 카탈로그와 준비

```bash
node scripts/qa/play/build-games.mjs --out tmp/qp/games          # 15게임 materialize + 부팅 스모크
node scripts/qa/play/build-games.mjs --out tmp/qp/games --only saesol-red,first-love
node scripts/qa/play/build-games.mjs --out tmp/qp/games --no-smoke   # 생성만
node scripts/qa/play/build-games.mjs --out tmp/qp/games --no-update-catalog  # games.json 을 안 고친다
```

스모크를 돌린 게임의 `playable`·`reason` 은 **`games.json` 에 다시 쓰인다** — 다음 에이전트가 빌드 없이도
어떤 게임이 필드에 도달하는지 안다. 확인하지 않은 게임은 건드리지 않는다.

산출물: `<out>/<id>/project.json` · `title.png` · `field.png` · `state.json` · `<out>/SUMMARY.md` · `<out>/catalog.json`.
`SUMMARY.md` 를 먼저 읽어라 — 어떤 게임이 필드에 도달하는지, 못 하면 왜인지가 한 표에 있다.
게임 목록의 정본은 `games.json` 이다(`kind`: `fixture` 커밋된 project.json[.gz] · `generator`
`generate-project.mts` · `manual` 정본 저장소 필요). `query` 가 있는 게임(플래그십 데모)은 **제품의 데모 분기**
(`player.html?demo=first-love`)로 띄운다 — 체크포인트 세트와 같은 길이고, 80MB 급 JSON 을 브라우저로 옮기지 않는다.
나머지는 오프닝을 끈 사본을 `boot-project.json` 으로 써서 **파일 경로**로 넘긴다(`route.fulfill({ path })`).

## 2. 세션 (qp)

```bash
# 0) 상자 하나에 세션을 여러 개 띄울 때: player-QA 서버를 **하나만** 띄우고 세션들이 붙는다.
#    세션마다 vite dev 서버를 띄우면 같은 node_modules/.vite 캐시를 서로 덮어쓴다(AGENTS.md 실측).
node scripts/qa/play/player-server.mjs --port 43100     # ready http://127.0.0.1:43100

# 1) 세션을 띄운다 — 이 명령이 살아 있는 동안이 곧 플레이 세션이다(백그라운드로 띄워라).
node scripts/qa/play/qp.mjs serve --game saesol-red --out tmp/qp/saesol-red
node scripts/qa/play/qp.mjs serve --game saesol-red --player-url http://127.0.0.1:43100 --out tmp/qp/s1
node scripts/qa/play/qp.mjs serve --game fallen-star  --player-url http://127.0.0.1:43100 --out tmp/qp/s2
#    --player-url URL   이미 떠 있는 player-QA 서버를 같이 쓴다(세션 수만큼 vite 를 띄우지 않는다)
#    --games-dir DIR    build-games 를 다른 자리에 돌렸을 때 그 산출물에서 <DIR>/<id>/project.json 을 찾는다
#    --viewport 1024x768 (기본) · --seed 1 · --headed (눈으로 보기) · --keep-opening (오프닝 유지)
#    --game 은 게임 id 이거나 project.json 경로다. --port 는 자기 player 서버를 띄울 때만 쓴다.
```

# 2) 짧은 명령. 세션 디렉터리는 --out · QP_OUT · tmp/qp/last 순으로 찾는다.
node scripts/qa/play/qp.mjs state
node scripts/qa/play/qp.mjs shot title
node scripts/qa/play/qp.mjs key Enter
node scripts/qa/play/qp.mjs waitTestid runtime-state-json present 60000
node scripts/qa/play/qp.mjs move up 2
node scripts/qa/play/qp.mjs move left 1
node scripts/qa/play/qp.mjs face down
node scripts/qa/play/qp.mjs action
node scripts/qa/play/qp.mjs errors
node scripts/qa/play/qp.mjs quit
```

출력은 에이전트가 읽는 압축 텍스트다(JSON 덤프 아님). 실패는 한 줄 사유 + 비영점 종료.

```
$ qp state
screen=field map=map_variety_ridge x=13 y=26 dir=down
gold=500 party=[actor_hero:120/120hp 20/20mp] running=false input=true
switches=45 variables=20 items=2
menus=[]
```

### 명령 전체

| 명령 | 뜻 |
|---|---|
| `serve --game <id\|path> [--port P] [--player-url URL] [--games-dir DIR] [--out DIR] [--viewport WxH] [--seed N] [--headed] [--keep-opening]` | 세션 시작. `DIR/qp.ready`(포트·게임·경로·공유 여부)를 쓰고 `DIR/actions.jsonl` 을 비운 뒤 기록 시작 |
| `key <k>` | 키 한 번(`Enter`, `ArrowUp`, `z`, …) |
| `hold <k> <ms>` | 키를 그 시간만큼 누르고 있다 뗀다. 방향키는 런타임 `hold` op |
| `move <up\|down\|left\|right> [n]` | n 걸음. **타일이 바뀔 때까지** 기다리며 센다(고정 sleep 아님). 막히면 `moved k/n, blocked` |
| `face <dir>` | 그 방향을 보게 한다(이동 없음) |
| `action` | 조사/결정 입력(`__oprnInput.action`) |
| `click <x> <y>` | 캔버스 좌상단 기준 좌표 클릭 |
| `clickTestid <id>` | `[data-testid]` 요소 중심을 실제 포인터로 누른다(가려짐·비활성·0크기면 실패) |
| `wait <ms>` | 시간 대기(증상이 "시간"인 경우에만) |
| `waitText <text> [timeoutMs]` | 화면 글자에 그 문자열이 나올 때까지 |
| `waitTestid <id> [present\|absent\|visible] [timeoutMs]` | testid 상태 대기(`visible` 은 조상 opacity·상자까지) |
| `shot <name>` | `DIR/shots/<name>.png` 저장, 경로 출력 |
| `text` | 플레이어에게 **보이는** 화면 글자(1px 디버그 표식·상태 JSON 제외). 도트 글꼴을 그림으로 읽으면 오독한다(실측: 「숲늑대」→「슬롭대」) |
| `state` | 화면·맵·좌표·방향·파티 HP/MP·골드·대사·열린 메뉴·스위치/변수 개수 |
| `errors` | 마지막 호출 뒤의 콘솔 오류 + 페이지 오류(읽으면 비운다) |
| `teleport <mapId> <x> <y>` | 그 맵·칸으로(같은 맵이면 좌표만, 다른 맵이면 실제 문 경로). 도착까지 기다린다 |
| `seed <n>` | 런타임 RNG 시드 |
| `resize <W> <H>` | 뷰포트 |
| `reset` | 새로고침해 타이틀로(세이브는 유지) |
| `save <slot>` / `load <slot>` | **없다** — 아래 「런타임이 노출하지 않는 것」 |

### actions.jsonl — 세션이 곧 재생 스크립트

한 줄에 op 하나. 관측 전용(`state`·`shot`·`errors`)도 남지만 재생에서는 건너뛴다.

```json
{"t":"2026-10-22T23:24:33.442Z","command":"key","op":{"kind":"key","key":"Enter"},"ok":true,"ms":9}
{"t":"2026-10-22T23:24:36.691Z","command":"move","op":{"kind":"move","dir":"up","steps":2},"ok":true,"ms":340,"note":"moved 2 tile(s)"}
{"t":"2026-10-22T23:24:46.647Z","command":"waitText","op":{"kind":"waitBodyText","text":"할아버지","timeoutMs":6000},"ok":false,"ms":6011,"error":"…"}
```

## 3. 재현 (repro)

```bash
node scripts/qa/play/repro.mjs --game saesol-red \
  --ops tmp/qp/saesol-red/actions.jsonl --lines 3-7 \
  --expect expect.json --out tmp/qp/repro-1
# → REPRODUCED / NOT_REPRODUCED, run-1/evidence.png, run-1/state.json, REPRO.json
# 공유 서버를 쓰려면 --player-url http://127.0.0.1:43100, 산출물 위치를 바꿨으면 --games-dir DIR
```

- `--ops` 는 **JSON 배열 · `{ops:[…]}` · actions.jsonl** 셋 다 받는다. `--lines 3-7` 로 로그 토막을 그대로 재생한다.
- **세이브 앵커.** `qp` 는 `state`·`shot` 마다 그 순간의 세이브(`captureSave`)를 `<세션>/saves/NNNN.json` 에 남기고 로그 줄에 `save` 로 적는다.
  `--lines A-B` 를 주면 repro 는 A 앞의 마지막 세이브로 **바로 부팅**(`__OPENRPG_BOOT__.qaCheckpoint`, 체크포인트 세트와 같은 길)한 뒤 A..B 만 재생한다.
  긴 자유 플레이 로그를 처음부터 다시 돌리면 돌아다니는 NPC·실시간 연출 때문에 위치가 어긋난다(실측: 폴른 스타 68줄 재생이 오프닝 대사·막힌 이동으로 갈라짐).
  순간이동만으로는 스토리 스위치가 비어 오프닝 이벤트가 다시 돈다 — 그래서 세이브다. `--no-anchor` 로 처음부터 재생.
- **기록된 간격대로 재생한다.** 로그의 시각 차이(최대 10초)를 입력 사이에 둔다(대사 글자 출력·전환 연출이 실시간으로 진행되므로). `--no-pace` 로 끈다.
- `--session <세션 폴더>` 는 그 세션의 뷰포트·시드(`qp.ready`)로 재생한다. 창 크기가 다르면 배치가, 시드가 다르면 조우가 달라진다.
- `--repeat 2`(기본) — **두 번 다 재현돼야** REPRODUCED. 한 번만 나오는 것은 flaky 이고 버그 확정이 아니다.
- 새 브라우저·새 페이지·새 서버에서 돈다. 오프닝은 기본으로 끈다(`--keep-opening` 으로 유지).
- 종료 코드: 0 = REPRODUCED, 1 = NOT_REPRODUCED, 2 = 사용 오류.

### expect 어휘 (증상 서술)

| 키 | 뜻 |
|---|---|
| `consoleErrorMatches` | 콘솔/페이지 오류 중 하나가 맞아야 한다. `"/TypeError.*null/"` 정규식 또는 부분 문자열. 배열 가능 |
| `textPresent` / `textAbsent` | 화면 글자(innerText)에 있어야 / 없어야 한다. 배열 가능 |
| `stateEquals` | `{mapId, x, y, gold, dir, screen, dialog, menus, switches, variables}` 중 하나가 그 값 |
| `testidPresent` / `testidAbsent` | `[data-testid]` 존재 |
| `stuck` | `{noProgressMs: N}` — N ms 동안 (맵·좌표·화면·대사) 서명이 한 번도 안 바뀌면 재현. **repro 전용** |
| `note` | 사람이 읽는 증상 한 줄(판정에 영향 없음) |

예(`expect.json`):

```json
{ "stateEquals": { "mapId": "map_variety_ridge", "x": 12, "y": 24 },
  "textPresent": "새솔",
  "note": "Enter 후 위로 두 칸, 왼쪽 한 칸이면 (12,24)" }
```

## 4. 회귀 시나리오로 굽기 (to-scenario)

```bash
# 세션 로그 토막 → 시나리오 + 체크포인트 세트(그 순간의 실제 세이브)
node scripts/qa/play/to-scenario.mjs \
  --session ~/salad/play/runs/main1/tasks/saesol-red__battle --lines 488-494 \
  --expect tmp/rt/saesol.expect.json --id rt-saesol-wild-troop-english-name
npm run qa:runtime -- --scenario rt-saesol-wild-troop-english-name \
  --checkpoint-set rt-saesol-wild-troop-english-name --checkpoint all

# 손으로 쓴 op 목록(체크포인트 없이) — 예전 경로
node scripts/qa/play/to-scenario.mjs --ops tmp/qp/saesol-red/actions.jsonl --expect expect.json \
  --game saesol-red --id saesol-enter-field
npm run qa:runtime -- --scenario saesol-enter-field
```

- 결과는 `scripts/qa/runtime/<id>.scenario.mjs` — 비트 하나에 op 목록과 expect 가 들어간다.
  `--session` 이면 **체크포인트 세트 `scripts/qa/runtime/checkpoints/<id>.json` 도 같이** 나온다(체크포인트 하나
  `anchor` = `--lines` 앞의 마지막 세이브 스냅샷). `repro.mjs` 와 **같은 토막 자르기 모듈**
  (`scripts/lib/playOpsLog.mjs`)을 쓰므로 앵커·범위가 두 도구에서 갈라지지 않는다. 토막 앞에 `reset`(reload)
  경계가 있으면 앵커를 만들지 않고 거부한다 — 리로드 뒤의 op 은 타이틀에서 시작한 판을 전제한다.
- **버그가 살아 있는 동안 그 시나리오는 실패한다.** 고친 뒤 통과하면 회귀가 막힌 것이다.
- **기대의 방향이 뒤집힌다.** repro 의 `expect` 는 증상 서술(`textPresent: "야생 chickadee"`)이고,
  시나리오의 `expect` 는 **고쳐진 뒤의 행동**(`textAbsent: "야생 chickadee"`, `textPresent: "치카디"`)이다.
  `--expect` 는 정상 동작을 적는다. 증상 파일을 기계적으로 뒤집으려면 `--symptom-expect`(글자 축만 뒤집는다 —
  좌표 축은 "고쳐진 좌표"를 사람이 정해야 하므로 거부한다). 증상 서술을 그대로 옮기면 버그가 살아 있는 동안
  시나리오가 **통과**해 회귀를 못 막는다.
- **고정 대기는 조건 대기로 바꾼다.** 런타임 게이트는 `wait` op 을 금지한다(`normalizeScenario` 가 던진다).
  로그의 시간 간격은 간격 앞뒤 관측(`at.screen`/`at.mapId`)으로 번역한다 — 화면이 바뀌면 그 화면의 testid 를
  기다리고(`pressUntil` 로 접어 초과 입력 없이), 같은 화면에서 맵만 바뀌면 `waitForMap` 을 기다린다(도착 좌표가
  버그일 수 있으므로 `waitForPosition` 으로 굳히지 않는다). 정하지 못한 간격은 버리고 줄 번호와 함께 stderr 에
  남긴다. 버려진 간격은 이동 op 의 타일 변화 대기와 다음 조건 대기가 흡수한다.
- **체크포인트 모드는 시나리오의 `beats` 를 쓰지 않는다** — 실행기 우선순위가 `checkpointBeats` → 체크포인트
  `beats` → 세트 `defaultBeats` → 기본 「도착 샷」이다. 생성기는 같은 비트를 `checkpointBeats: { anchor: beats }`
  로도 가리킨다. 이게 없으면 기대를 아예 판정하지 않고 통과한다(조용한 거짓 통과, 실측).
- **프로젝트 재료 순서:** `--fixture` → `games.json scenarioFixture`(커밋된 픽스처) → `projectGenerator`
  (`generate-project.mts` 빌더 표에 있을 때, 실행 시점에 제품과 같은 코드 경로로 Node 에서 생성) → 플레이어 데모 분기
  `query: { demo: <id> }`(`src/player/exportEntry.ts`). tmp 산출물은 거부한다 — 커밋된 시나리오가 다른 기계에서
  안 돌기 때문이다. 생성기 게임은 72MB 급이라 픽스처를 커밋하지 않는다.
  **생성기가 데모 분기보다 앞인 이유(실측 2026-10-23):** 같은 빌더를 브라우저에서 돌리는 데모 분기는 빌더가
  브라우저에 없는 것을 만지면 부팅째 죽는다 — `chronoBell.ts` 의 `process.env.MARCH_DEBUG` 로
  `player.html?demo=fallen-star` 가 `process is not defined` 로 실패했고, 그 실패는 버그 판정 실패와 구분되지 않는다.
  그래서 `fallen-star` 의 기존 체크포인트 세트(데모 분기 부팅)도 지금은 돌지 않는다 — 별개 결함이다.
- **판정 축이 부족하면 `expect.pageAssertions` 를 쓴다.** `{ id, fn }` 의 `fn` 은 인자 없는 함수 **소스**이고
  `true` 면 통과, 문자열이면 그 문자열이 실패 사유다. "커서가 정확히 하나", "시계가 세이브 시간을 잇는다" 처럼
  고정 축(존재·글자 포함·스칼라 등식)으로 표현할 수 없는 불변식을 페이지 안에서 직접 잰다. 관측이 없으면
  통과가 아니라 실패다. `testidPresent`·`textPresent` 같은 축으로 **정상 게임도 통과하는** 검사를 적지 마라 —
  그건 회귀를 못 막는다(실측: 「노린다 (← → 대상 변경)」 문구, 「0:0」 부분 문자열은 정상 게임에서도 통과).
- **로그에서 유도할 수 없는 판정 지점은 `--until`/`--wait-visible` 로 조건 고정한다.**
  `--until <key>:<testid>[:<삽입 위치>]` 는 같은 키를 그 testid 가 나타날 때까지만 누른다(`pressUntil`, 초과 입력
  없음). 삽입 위치가 필요하다 — 기록된 세션은 이미 그 창 **안에서** 화살표를 눌렀으므로, 재생에서 화살표를 창이
  열리기 전에 보내면 판정 지점에 도달하지 못하고 증상 없이 통과한다(실측: 전투 대상 선택 창).
  `--wait-visible <testid[,testid…]>` 는 페이드로 들어오는 창(상태 메뉴 180ms)이 실제로 보일 때까지 기다린다.
- `expect.stuck` 은 옮길 수 없다 — 런타임 게이트는 고정 대기를 금지하므로 시간 창 판정은 repro 에만 둔다.
- `--force` 없이는 기존 파일을 덮어쓰지 않는다.

## 5. 런타임이 노출하지 않는 것 (에이전트가 계획에 넣어야 하는 제약)

| 없는 것 | 지금 할 수 있는 것 |
|---|---|
| **저장/불러오기 명령** | 메인 메뉴(ESC) → 저장 칸을 **키 입력 순서**로만 고를 수 있다. 메뉴 행에는 testid 가 없다. 세션 `reset` 은 새로고침이라 localStorage 세이브는 남는다 |
| 세이브 슬롯 직접 쓰기 | `page.evaluate` 로 localStorage 를 만지는 훅은 없다(계측 부팅은 상태 미러만 노출) |
| 맵 목록·이벤트 목록 조회 | `state` 는 현재 맵·좌표·열린 메뉴만 준다. 맵 id 는 프로젝트 JSON(`games.json` 경로)에서 읽어라 |
| 대사 전문 이력 | `state.dialog` 는 **지금 떠 있는** 대사창 글자다. 지나간 대사는 `waitText` 로 잡아 두거나 스크린샷으로 남긴다 |
| 인벤토리 개별 조회 명령 | `state` 가 `inventory` 전체를 준다(도구는 개수만 요약). 재현 판정에는 `stateEquals` 로 특정 키만 비교 |
| 파티 HP/MP 변경 | `state` 로 읽기만 된다. 전투 중 회복은 게임 안 아이템/이벤트로 |
| 오프닝 컷신 건너뛰기 명령 | `serve` 가 기본으로 `system.opening` 을 끈다. 켜려면 `--keep-opening` |
| 다중 탭·동시 세션 | 세션 하나 = 브라우저 하나. 같은 게임에 세션 둘을 띄우면 각자 독립(세이브도 분리: `saveNamespace=qp:<seed>`) |

## 6. 함정 (실측)

- **80MB 급 프로젝트를 `route.fulfill({ body })` 로 넘기면 렌더러가 죽는다**(실측: 첫사랑 82MB →
  `Target page, context or browser has been closed`). 큰 게임은 `query`(데모 분기)나 `route.fulfill({ path })`
  로 띄워라. `bootPlayPage` 가 둘 다 지원한다.
- **`mdc-server` DNS 를 쓰지 마라.** 서버·브라우저 모두 `127.0.0.1` 로만 붙는다. `mdc-server` 로 열면
  vite 모듈 요청이 간헐적으로 죽고 화면이 백지가 된다.
- **Chromium 플래그가 필요하다.** 이 머신의 tailscale·docker 인터페이스가 크로미움에 "네트워크 바뀜"을 계속
  알려 `net::ERR_NETWORK_CHANGED` 로 모듈 그래프가 끊긴다. `playSession.mjs` 의 `PLAY_BROWSER_ARGS`
  (`--no-sandbox --use-gl=swiftshader --disable-gpu --disable-background-networking
  --disable-features=NetworkChangeNotifier`)를 그대로 써라. 빼면 긴 세션에서 백지가 산발한다.
- **세션을 백그라운드로 띄워라.** `serve` 는 살아 있는 동안만 유효하다. 셸이 끝나면 함께 죽으므로
  `setsid nohup … &` 또는 백그라운드 세션으로 띄운다. `qp.ready` 가 없으면 붙을 수 없다.
- **한 상자에 세션을 여러 개 띄울 때는 `player-server.mjs` 하나 + `--player-url`.** 세션마다 vite dev
  서버를 띄우면 10개가 같은 `node_modules/.vite` 캐시를 서로 덮어쓰며 죽는다. 실측: 공유 서버 하나 +
  saesol-red 세션 둘 동시 → 둘 다 필드(`map_variety_ridge` 13,26) 도달, `errors: none`.
  공유 서버를 죽이면 붙어 있던 세션은 다음 명령에서 실패한다 — 먼저 띄우고 마지막에 내려라.
- **타이틀 부팅은 30~60초 걸린다.** 첫 `state` 가 `screen=title` 인 것은 정상이다. 필드 진입은
  `key Enter` → `waitTestid runtime-state-json present 60000` 순서로 확인해라(고정 `wait` 로 넘기지 마라).
- **타이틀 입장 시퀀스가 있는 게임은 Enter 를 두 번 눌러야 한다.** 첫 입력은 메뉴 확정이 아니라 시퀀스
  건너뛰기로 소비된다(실측: 폴른 스타 — `seqState=playing` → `rm-title-seq-skipped` → 그다음 Enter 가
  "새 게임"). 그래서 `build-games` 스모크는 "메뉴가 보이나"를 보고 누른다. 세션에서는
  `state` 로 `screen` 이 `field` 가 될 때까지 `key Enter` 를 반복해라.
- **`repro` 의 부팅 대기**는 `--boot-timeout`(기본 240000ms)이다. 부하가 큰 호스트에서 부팅 실패와
  증상 없음은 다른 결론이므로, 부팅 타임아웃이 나면 먼저 이 값을 늘려라.
- **`.mts` 생성기와 `scripts/` 의 tsconfig.** `scripts/tsconfig.json` 이 루트를 extends 하면서 `paths` 기준이
  `scripts/` 로 풀려 `@/x` → `scripts/src/x` 가 된다. `scripts/qa/play/tsconfig.json` 이 그 기준을 되돌린다.
  이 폴더의 `.mts` 는 반드시 `npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs` 로 돌려라
  (css-stub 없이는 `.css` import 에서 죽는다).
- **`page.evaluate` 안에서는 모듈 스코프 상수를 못 본다.** 브라우저로 넘기는 함수는 쓰는 값을 안에서 다시 정의한다
  (실측: `MENU_PATTERN is not defined`).
- **오프닝은 기본으로 꺼진다.** 세션·재현·스모크 모두 `system.opening = {enabled:false, scenes:[]}` 를 덮는다 —
  오프닝 자체를 검증할 때만 `--keep-opening`/`systemPatch` 로 켠다.
- **같은 맵 안의 `teleport` 는 좌표만 바꾼다**(스프라이트·카메라가 안 따라올 수 있다). 다른 맵으로 갈 때는 실제 문
  경로를 탄다. 이동 검증은 `move`(타일 변화 대기)로 해라.
- **관측 전용 op 은 재생에서 건너뛴다.** `state`·`shot`·`errors` 는 로그에만 남는다. 그래서 로그 토막을 그대로
  재생해도 화면 조작 순서가 달라지지 않는다.

## 7. 파일

| 파일 | 역할 |
|---|---|
| `qp.mjs` | 세션 CLI(serve + 명령 클라이언트) |
| `player-server.mjs` | 여러 세션이 함께 쓰는 player-QA 서버 하나(`ready <url>` 출력 후 유지) |
| `repro.mjs` | op 목록 재생 + 증상 판정 |
| `to-scenario.mjs` | 재현 → `scripts/qa/runtime/<id>.scenario.mjs` (+ 체크포인트 세트) |
| `../../lib/playOpsLog.mjs` | 로그 토막 자르기·세이브 앵커(repro·to-scenario 공용) |
| `../../lib/qaProjectGenerator.mjs` | 생성기 게임의 프로젝트를 실행 시점에 생성(시나리오 `projectGenerator`) |
| `build-games.mjs` | 카탈로그 materialize + 부팅 스모크 |
| `generate-project.mts` | 게임 빌더 실행기(tsx) — 제품과 같은 코드 경로 |
| `games.json` | 게임 카탈로그 |
| `tsconfig.json` | 이 폴더 `.mts` 의 `@/` 별칭 기준 |
| `examples/` | 데모 op/expect 파일(`saesol-enter-field.ops.json` · `saesol-field.expect.json` · `saesol-missing-npc.expect.json`) |
| `../../lib/playSession.mjs` | 브라우저 부팅·상태 읽기·op 실행(공용) |
