# 폴른 스타 제2막 — 인계 (2026-10-25 밤)

기획 정본: `docs/fallen-star/act2-plan.md`. 제1막·1.22 는 운영 스토어에 게시됨(fallen-star 1.22, PR #3509).

## ★ 재개 지점 (2026-10-27 밤 — 1.24 에서 멈춤)

감독 지시로 **1.24 게시 뒤 멈췄다. B10~B13 은 0줄.** 이어받는 사람은 여기서 시작한다.

- **판본 끝 마개:** `act2Opening.ts` 의 `FS2_RELEASE_STOP = "B9"` → `towerReleaseStop(project)`(하늘탑 1층 자동 이벤트 `ev_fs2_tower_stop`: 막 카드·회복·저장, 위층 계단 문구를 「다음 업데이트」로 덮어씀).
  **B10 을 열 때 `null` 로 바꾼다.** 그러면 카드·계단 덮어쓰기가 함께 빠진다. 체크포인트 `act2-b9-stop` 은 그때 지우거나 B13 끝 막 카드로 옮긴다.
- **하늘탑 맵:** `author_dungeon type:"tower" adapter:"beodeul" floors:4` 가 이미 지었다. 맵은 `fs2_sky_tower`(1층), `fs2_sky_tower_f2`, `fs2_sky_tower_f3`, `fs2_sky_tower_f4`. 입구는 서리나루 밤 맵(`fs2_frostford_night`)의 탑 문이다.
- **B10~B13 에 쓸 도구**(계획 `act2-plan.md` 7절, 모두 main 에 있음):
  - B10 2층 분리 진행: `author_party_split`. 렌즈·빛 퍼즐: `author_map_puzzle` 의 `mirror_beam_refraction`.
  - B11 이리스 재회: `configure_story_journal`, 일지 한 줄 m2 명령, `place_field_obstacle kind:"dark"`(손끝 빛).
  - B13 보스: `upsert_skill chargeBreak`, `add_battle_guest`, `upsert_combo_tech` 4인(「네 번째 대답」).
  - 적 그림 후보(공용 140종 도트 — 새 캐릭터 그림 금지): golem-iron, moth-dust, spider-cave 또는 golem-crystal, snake-01, bat-cave.
- **비트마다 할 일:** 굽기 → 정본 저장·재로드 → 체크포인트 녹화 → `~/claude-viz/fs-act2-1.html` 맨 위에 1배 영상 → PR → `node scripts/merge-pr.mjs`.
  판본을 낼 때는 **독립 플레이 판정을 한 번** 돌린다(아래).

### 독립 플레이 판정 (1.24 에서 처음 씀)

Claude·Sonnet 이 아닌 판정자(omp + DeepSeek)가 출하 플레이어를 사람처럼 한 걸음씩 플레이한다. 순간이동·스위치 조작은 없다.

```bash
# 1) 대화형 세션 — 체크포인트 act2-play(감방에서 막 시작)에서 멈춰 /tmp/fs2/judge/play 의 cmd-<n>.json 을 기다린다(부팅 6~9분)
QA_INTERACTIVE_DIR=/tmp/fs2/judge/play QA_INTERACTIVE_IDLE_MS=2400000 QA_RECORD_VIDEO=/tmp/fs2/qaplay/vid timeout 40000 unshare -rn bash -c "ip link set lo up; npm run -s qa:runtime -- --scenario checkpoints --checkpoint-set fallen-star --checkpoint act2-play --project <굽기>/demos/chrono-bell.project.json --out /tmp/fs2/qaplay --parallel 1"
# 2) res-0.json 이 생기면 판정자
omp -p --model cb/deepseek-v4.1-flash --thinking high --mode json --max-time 6h --cwd <체크아웃> "$(cat docs/fallen-star/act2-judge-prompt.md)" > /tmp/fs2/judge/omp-raw.jsonl
```
- 조작 도구: `node scripts/qa/play-step.mjs <dir> '<ops json>'`. 상태 JSON 과 화면 PNG 를 돌려준다(`scripts/lib/runtimeQaInteractive.mjs`).
- **증거는 omp 원본 출력(jsonl)과 판정자가 쓴 report.md 뿐이다.** 감독이 대신 요약하지 않는다.
- 판정이 찾아 고친 것(1.24, PR #3864):
  1. 순찰에게 지면 HP 0 파티로 계속 걸었다 → `make_chase_scene caughtPenalty` 가 전투 뒤 회복.
  2. 감방 문 앞에서 180걸음 맴돎 → 빵을 들고 문을 조사하면 엘레나가 침대에서 쪼개 보자고 짚는다.
  3. 감방으로 끌려간 뒤 막사 입구에서 즉시 재포획(여섯 번) → 추격자가 주인공을 다른 맵으로 끌고 가면 제자리로 돌아간다(`sendPursuerHome`, 엔진 공통).
  4. 붙잡힐 때마다 쉬운 전투 → 금화 696G → 막사 벌칙 전투를 빼고 지하로 끌려가기만. 막사에 들어서면 엘레나가 근무표·등불·「깃발 밑 종 줄」을 짚는다.
  5. 순찰·필드 적에게 지면 타이틀 → 「새 게임」(1막부터) → `place_field_enemy checkpointOnEntry`(맵 입구 체크포인트), 게임 오버 메뉴 Esc 가 「체크포인트에서 다시」.
  6. 재의 들판 북쪽 길(두 칸)에 출구 이벤트가 한 칸(옆 칸)뿐 → `widenEdgeGates`: 가장자리 한 칸 출구를 길 폭 전체로 복제.
  7. 「기록 → 임무」에 1막 완료만 있고 할 일이 없음 → `define_quest fs2_main 「빌린 불」`(줄기 스위치 14단계), 임무 목록은 진행 중 → 미시작 → 완료 순(엔진).
  8. 광장 도착 골목이 캄캄하고 출구 틈이 한 칸 → 틈에 등잔 불빛, 도착 때 엘레나가 「왼쪽 위 불빛 틈 → 광장 서쪽 미레」.
  9. 2막 내내 회복약 0 → 막사 사다리에서 되찾은 짐에서 회복약 5·마력약 2·만병통치약 1(한 번). 밤 병사 경험 24→80, 재의 들판 적 90→170(골렘 420·공격 165→140).
  10. 오프닝 컷신 Esc Esc 건너뛰기가 빵·스위치를 건너뛰고 화면을 검게 남김(700걸음 고착) → 엔진 `jumpToLabel` 이 건너뛴 상태 명령(스위치·변수·아이템·금화·파티…)을 적용, 카메라 복원이 검은 페이드를 지운다.
  11. 새벽샘 별빛 결정을 옆 칸에서 눌러도 저장 안 열림 → `place_savepoint objectFootprint` 가 그림 칸마다 쌍둥이 이벤트.
  12. 2막 내내 쓰러진 동료를 못 일으킴 → 짐에 피닉스 깃털 2. 미레 부엌이 회복(첫 대화·반복). 토비·미레가 길을 짚는다. 새벽샘 컷 끝에 북쪽 길 대사, 설원 도착 때 새라가 연못 길.
  13. 우물 밑 승강 발판이 멈춰 있을 땐 그림이 없어 막다른 방으로 읽힘(judge9 고착) → `place_lift` 멈춘 탑승 칸에 푸른 glow·반짝임(엔진 도구 공통), 우물 내려갈 때 엘레나가 「빛나는 발판에 올라서 조사」.
  14. 꺼진 등 걸 문을 못 찾음 → 걸 수 있는 문 이벤트에 등불 glow.
  15. 밤 광장 순찰 셋(740HP)이 Lv8 파티에 벽 → 순찰은 병사+창병 둘(`troop_fs2_curfew_pair`). 보상 문구 「과(와)」 → `josa`.
  16. (judge10, 광장부터 다시) 막사 사다리에서 Z 를 몰라 450걸음 → 사다리 발치를 밟으면 오른다(지하 계단과 같은 규칙), 발치 불빛.
  17. 하넬 뒤 대장간을 못 찾아 500걸음, 세 번째 전멸 → 하넬·임무 문구에 「광장 남쪽 끝」, 열린 뒷문에 불빛.
  18. 우물 지붕 칸 옆에서 눌러 무반응 → 우물 2×2 네 칸 모두 같은 이벤트.
  19. 임무 상세 창 첫 화면에 끝낸 1번 단계만 보여 「1막 할 일이 남았다」로 읽힘 → 진행 중 임무는 상태 밑에 「지금 할 일」(첫 미완료 단계) 한 줄(엔진).
  judge10 은 퀘스트 5/14(하넬)까지 갔다. 9전 6승 3패 — 순찰 둘 조정 뒤 이길 수 있는 싸움이 됐다. 세 번째 전멸 뒤 「체크포인트에서 다시」에서 렌더러 `Target crashed`(같은 단추는 앞의 두 번 정상 — 그 순간 호스트 가용 메모리 6~8GB, 다른 세션 굽기 7GB. 재현 안 된 의심 항목으로 남김).
  judge10 이 짚었지만 판정과 화면이 다른 것: 「밤 광장이 너무 어둡다」(같은 판 shot-1490 은 읽힌다), 「도주가 아무 말 없다」(실패 문구 「그러나 도망칠 수 없었다!」는 있다 — 상태 사이 프레임을 놓쳤다).
  20. (judge11·12, 하넬 뒤부터) 브람(39,16)·개구멍 앞(38,16)이 울타리 친 화단 주머니라 **걸어서 닿을 수 없었다**(통행 BFS) → 성벽 밑 이어진 줄 서쪽 끝 브람(42,16)·개구멍(43,15). 로한·임무 문구에 「북문 서쪽, 성벽 밑 나무 그늘 — 등을 든 브람」, 브람 불빛. 다른 2막 맵의 대사·조사 이벤트는 모두 입구에서 닿는다(`/tmp/fs2/reach.mts` 로 확인).
  21. 동료가 쓰러진 턴에 커서가 지난 턴의 「연계」(이번엔 회색) 위에서 시작해 확인키가 먹지 않아 「전투가 멈췄다」 → 새 명령 패널은 비활성이 된 기억 자리를 버리고 첫 쓸 수 있는 행에 선다(엔진 `battleDom.markMenuCursor`).
  22. 밤 순찰 공격 92/98→84/88, 회복약 떨굼 15→30%(밤엔 약을 살 곳이 없다).
  23. 판정 중 렌더러 `Target crashed`(judge8·10·11) — 같은 조작을 체크포인트로 재현하면 통과. QA 는 dev 서버+swiftshader 라 렌더러가 3~5GB. `QA_RENDERER_HEAP_MB=8192`(옵트인, `scripts/runtime-qa.mjs`)로 돌린 judge12 는 4시간 내내 렌더러 2.8~3.0GB 로 죽지 않았다. 출하 번들 경로의 누수 여부는 미확인.
- **판정 실행법(조각별, 1.24 에서 씀):** `QA_RENDERER_HEAP_MB=8192 /tmp/fs2/seg.sh <판정폴더> <체크포인트> <QA출력> [최대시간]` (env `WT` 체크아웃, `PROJ` 굽기 JSON). 구간 체크포인트: `act2-play`(감방) · `act2-play-hub`(막사 사다리) · `act2-play-b4`(하넬 뒤 우물 앞) · `act2-play-b5`(재의 들판) · `act2-play-b7`(설원). 프롬프트는 `<판정폴더>/prompt.md`. **판정은 한 번에 하나만** — 두 개를 겹치면 호스트 메모리 압박으로 렌더러가 `Target crashed`.
  원본 출력 보관: `~/fs2-vqa/judge/`(judge8·judge9·judgeS2b~S4c). judge9(전체 판)는 퀘스트 4/14(미레)까지 갔고 우물 발판에서 막혔다 → 13~15 로 고쳤다.
- **판정이 짚었지만 1.24 에 안 고친 것(다음 판본 후보):**
  - 재의 들판(`map_field_north_2`)이 초록 풀밭이다 — 「불탄 들판」 그림이 아니다(칩셋·맵 재칠 필요).
  - 필드 적·순찰 추격 160ms 가 걷기와 같아 사실상 못 피한다(감독 요청 값 — 되돌리지 말고 보고만).
  - 광장 소품(가판·화분·벤치)이 걷는 줄에 박혀 한 칸 주머니가 많다. 막힌 걸음에 소리·흔들림 피드백이 없다(엔진 공통 후보).
  - 전투 적 이름표·HP 숫자가 셋일 때 겹치고 화면 밖으로 잘린다. 「통금 순찰 창병」이 「검격」을 쓴다(1막 병사 기술 복사).
  - 요새 2층 위 홀(설원 길에서 들어오는 쪽)에서 쇠창살 레버가 반대편 — 정상 진행에선 이미 당겨져 있다. 체크포인트 `act2-play-b7` 에 레버 스위치를 넣었다.
  - 밤 전투 배경이 낮 들판이다(전투 배경에 밤 도시 종류가 없다 — 평원·숲·동굴·설원·사막뿐).
  - 도주 실패율 체감 약 50%, 도주에 단축키 없음. 쓰러진 동료가 필드에서 사라진다(표시 없음).
  - 막사 종 줄 두 개가 같은 그림(빨강·파랑 구분 불가). 감방 침대·문은 정확한 칸·방향에서만 반응.
  - 판정자가 임무 단계 밑 작은 「완료」를 「원료」로, 「문틈의」를 「문득의」로 읽었다 — 작은 글씨 가독성 후보(문구 자체는 맞다).
  - 체크포인트 재시작이 쓴 소모품을 되돌린다(판정 지적 — 의도 여부 미정).
- 함정: QA 플레이어는 HMR·watch 가 꺼져 있지만, 아직 안 불린 모듈은 요청할 때 현재 소스로 변환된다. 판정 도중 `src/player` 를 고치지 말 것.

## 0. 지금 진행 중 (2026-10-26)

- 열린 도구 PR 셋(#3546 일지·#3548 시간 탈출·#3557 전투 손님)과 인계 문서 #3561 은 **모두 머지됨**.
- 비트 작업 브랜치: **`agent/fs2-beats`** (워크트리 `/home/main/z-project/rpg-zzu-fs2-beats`). WIP 를 자주 푸시한다 — 이어받으면 이 브랜치에서 시작.
- 진행 기록은 이 절 아래 「진행 로그」에 덧붙인다.

### 진행 로그
- 기준 굽기 `/tmp/fs2/base`(origin/main ed114f5cf0). 탐침은 `/tmp/fs2/probe.mts`(굽기 JSON 에 도구를 순서대로 부른다).
- 2026-10-26 오후 (Claude 이어받음): origin/main 위로 rebase. B1~B3 를 `act2Opening.ts` 에 지음.
  - B1 다리(엔딩 continueTo「제2막으로」)·감방·빵 속 열쇠·막사 잠입·사다리 — 출하 플레이어 체크포인트 `act2-bridge`·`act2-b1-cell`·`act2-b1-key`·`act2-b1-ladder` 통과·녹화.
  - B2 통금의 밤 광장: `duplicate_map events:"doors" lockedDoorText`(새 일반 기능 — 사람·연출 비우고 문만 잠가 남김, 과제 `fs2-night-variant`), 순찰 기사 넷(`set_map_properties mapRole field` 뒤 `place_field_enemy` cone), 미레(우물 길)·토비(은수저)·마르타(쇠 마차).
  - B3 우물 → `fs2_well_shaft` → `place_lift` 로 `fs2_obs_night` 서고, 하넬(세린·인장 fork). `place_lift` 가 toMap 도착 스위치를 만들지 않아 참조 검증에서 거부되던 버그 수정(과제 `fs2-well-lift`).
  - 함정: 도구를 부르면 맵 객체가 새로 바뀐다 — 쥐고 있던 `map` 에 이벤트를 붙이면 조용히 사라진다. `addEv(project, mapId, …)` 로 그때그때 다시 찾는다.
  - 함정: `place_npc` 는 막힌 칸이면 옆 칸으로 옮긴다 — 체크포인트 좌표는 굽기 결과에서 읽는다.
  - B4 대장간 뒷문(하넬 뒤에만 열림)·로한의 창(`upsert_equipment`+`changeEquipment`)·브람 개구멍 → `author_forest_route` 북쪽 2장(`linkFrom:false` — 새 일반 기능, 출발 맵 가장자리 대신 개구멍 이벤트로 잇는다). 체크포인트 `act2-b4-rohan`·`act2-b4-hole` 통과.
  - B5 재의 들판 적 다섯(1막 늑대 레코드를 복사해 그림만 기존 몬스터로; `upsert_enemy` 는 `graphicHue` 를 안 받는다), 새벽샘 `author_beodeul_town` → `derive_map_variant burned keepIntact north`, 잠긴 집 문은 `data.doors`(문 앞 칸)에서 읽는다. 주먹 자국 셋 → 문이 열리면 정착 확인서(`item_fs2_serin_form`). 들판2 북쪽 ↔ 마을 남쪽 `create_transfer_pair`.
  - 함정: `author_forest_route` 를 끝 맵 가장자리에서 이을 때 덧층(lower/upperOverlay)이 남아 「unreachable」 — 파낸 칸의 덧층도 비우게 고침. `originEdge(…, walkFrom)` 은 걸어 들어올 칸에서 BFS 한다.
  - 함정: 승강 장치 도착 칸이 발판 위라 `trigger:"touch"` 면 걸어 나가다 도로 탄다 → `place_lift trigger:"action"`(새 인자).
  - 함정: 하넬 체크포인트 — 발판에서 오른쪽 3칸이 가끔 2칸만 간다(따라오는 동료와 엉킴). 넉넉히 5칸 걷게 하면 하넬에 막혀 멈춘다.
  - B1~B5 는 PR #3643 으로 머지됨(2026-10-26 저녁).
  - B6 북방 관문 요새: `author_dungeon castle rooms`(성문 홀·안뜰·감방·무기고·계단 홀·rampart 보스방) + `entrance{fromMapId 새벽샘, x:24,y:0}` + 새벽샘 북쪽 `paint_road`. 경비견은 populate, 순찰 기사는 칩을 줘 따로. 새라: `upsert_actor`(용기사, Actor1 #3)·`upsert_enemy`(charset-battler-actor1-3)·`upsert_troop` + `upsert_troop_battle_page` 둘. 새라 이벤트 `battleProcessing canLose branchOnResult` — 지면 요새 감방에서 깸, 이기면 선택 1(창 돌려줌 → 유대 +1 / 맡아 둠 → 별쇠 조각)·합류·설원 길로 이동.
  - 일반 기능: 문으로 들어가는 던전 1층(entryStair door)과 야외 잇기가 transfer-retrigger 로 늘 실패하던 버그(`dungeonLinkTools` 가 문 칸을 doorAt 으로) · `upsert_enemy` 가 걷기 칩 전투 시트(charset-battler-*)를 사람 적 그림으로 받음 · `author_snow_route paintGaps`(얼음 구멍으로 틈을 실제로 막음, 잇기 뒤에 칠함)·`linkFrom:false`.
  - B7 서리 가도: 설원 길 두 장(눈→눈보라), 얼음 틈 둘 = `place_field_obstacle gap requiresActorId 새라`, 고개 모닥불 `configure_party_bonds`(엘레나·새라, 새라 유대 2 → 창 휘두르기).
  - 함정: `author_dungeon` populate 의 보이는 적·보스는 몬스터 그림 무리만 놓는다(사람 칩 무리는 조용히 건너뜀 — runTool 결과에 경고가 안 실린다). 함정: 도구 안에서도 잇기 뒤엔 맵 객체가 바뀐다(설원 틈 칠하기 버그였다).
  - B8 서리나루: `author_beodeul_town theme snow seed 81`(못·얼음낚시터·얼음 구멍이 마을 문법에 있다). 고개 끝 출구 ↔ 마을 남쪽 `create_transfer_pair`. 하르마(세린 이야기, Q5 얼음 구멍 → 은빛 송어 → 「하르마의 은빛 노」 얼음 저항 장신구), 징발대 병사(Q6 새라 한마디 → 여관 공짜·새라 유대 +1), 여관(`build_hand_interior_room program inn` + doorAt 문), 못가 등불 셋.
  - 일반 기능: 출입구 도달 검사(`walkableFromAnchors`·`largestWalkGroup`)가 주인공을 뛰어넘기게 하는 이벤트(moveEvent @player jump — 틈 도약)를 길로 친다. 전에는 틈 너머 출구가 「걸어 닿지 않는다」로 거절됐다.
  - B9 얼음 위의 등: `duplicate_map events:"doors"` 밤 판, 여관 주인 「밤을 기다림」 페이지로 넘어간다. 발렌(1막 칩) 선택 2(칼/등, 확인서가 있으면 세린 이름), 흔들림·섬광, `make_timed_escape`(얼음 칸만 남쪽부터 20초, 검은 물 23152) → 북쪽 하늘탑(`author_dungeon tower floors 4 teleporter`, 이번엔 문만) 문은 발렌 뒤에만.
  - 일반 기능: `make_timed_escape startCellsSwitchId` — 재시도 시작 칸이 컷신 전에는 안 켜지게. `groundSupport` 가 보이지 않는 자동·병렬 이벤트(맵 분위기 날씨)는 받침을 따지지 않는다(던전 맵 (0,0) 허공에서 set_scene_mood 가 거절됐다).
  - 함정: 날씨는 맵을 넘어 남는다 — 새벽샘 안개가 요새 안에, 서리나루 눈발이 여관 안에 따라 들어왔다. 실내·다음 맵에 `set_scene_mood weather none` 을 준다.
  - 함정: fadeOut 뒤 transfer 하면 화면이 검은 채로 다음 맵 도착 대사가 돈다 — 도착 자동 이벤트 첫 줄에 fadeIn.
  - 함정: 선택지 앞 대사가 여섯 줄이면 Enter 10번으로 모자라다(글자 흘림 1번 + 넘김 1번) — repeatUntil maxRounds 넉넉히.
  - 정본 revision 4(굽기 bake6, 맵 31) → revision 5(bake7, 맵 33) 저장·재로드 OK.
  - B9 수정: 발렌을 탈출 이벤트보다 먼저 세운다 — `make_timed_escape` 가 다른 이벤트가 선 칸은 무너뜨리지 않는다(전에는 무너짐 이벤트가 발렌 칸을 덮어 말을 안 받았다). 무너짐은 칸마다가 아니라 줄마다 이어진 얼음 덩이 하나씩(steps = 줄별 연속 구간).
  - **1.23 판본 끝 = B8 서리나루 여관**(`FS2_RELEASE_STOP = "B8"`). 하르마 뒤 여관 주인 오사 「판본 끝」 페이지: 회복·「제2막 「빌린 불」 — 여기까지」 막 카드·저장 메뉴. 밤 판(`fs2_frostford_night`)으로 가는 이동이 아예 없다(굽기 JSON 에서 바깥 맵이 밤 판·하늘탑을 가리키는 곳 0 확인). 다음 판본에서 B9 를 열려면 `FS2_RELEASE_STOP = null` — 그러면 같은 페이지 자리에 밤으로 넘어가는 페이지가 들어간다. 체크포인트 `act2-b8-stop`.
  - 정본 revision 6(bake8) → bake9 저장.
  - **1.23 운영 게시 (2026-10-27)**: PR #3674 머지 → bake10 → build:player → `store:publish-game --target production`(contentHash d58631f1…, `STORE_PUBLISH_PRODUCTION_URL=https://store.openrpgmaker.com` 도 env 로 줘야 한다). 소식 글 #2(그림 3장, news-shots). 게시 전 출하 플레이어 체크포인트 24개(ending→act2-bridge→B1~B8→act2-b8-stop) 통과. act2-b9-valen 은 탈출 끝 하늘탑 도착(waitForMap)에서 실패 — 다음 판본 전에 고칠 것.
  - **1.24 작업 (2026-10-27, 브랜치 agent/fs2-b9)** — 적대적 VQA(`~/fs2-vqa/vqa-raw.md`, 계획 대 빌드) 격차를 큰 것부터 고침:
    - 새라 키트(창기사 클래스·스킬 5·연계기 5)·유대 해금, 새라=로한의 딸 대사, 창 돌려주기 선택은 실제 장비 교환.
    - B6 요새 2층(`author_dungeon floorRooms` — 층마다 방 목록, 새 인자)·레버 쇠창살·쇠뇌병 보초, 새라는 2층 성벽 위.
    - B7 엘레나 불씨 녹이기(`place_field_obstacle tileAbove`, 얼음 수정 1×2), B2 Q4 「꺼진 등」(미레 → 잠긴 집 셋 문고리 → 별빛빵 ×2), 빵 둘.
    - B4 브람 고백을 숲 가장자리로: 개구멍에서 들킴 → `place_field_enemy appearSwitchId/vanishSwitchId`(새 인자, 경보형 추격) 기사 둘 → 입구에서 13줄 북쪽 가로 한 줄 전체가 숲 그늘(밟으면 기사 물러남·고백). 숲 어귀 밤 조명.
    - B1 막사 순찰 기사(`make_chase_scene caughtPenalty` — 새 인자, 붙잡히면 전투 → 감방), B5 `derive_map_variant scorch:"whole"`(마을 전체 그을림) + 원본 맵 `remove_map`.
    - B8 해 질 녘 「대답의 등」(조명 덮개+등불 광원, 첫 등에서 한 줄 띄우기 선택), 얼음낚시 노인, 집 셋 실내(등 만드는 집 tailor·어부 fish·하르마 narshe — 손 도트 실내 v5, 사람 칩은 1막 광장 칩).
    - 난이도·알아채기: 필드 몬스터 160ms/칸·시야 8·부채꼴 110°, 밤 순찰 시야 8·140°·수색 7초(`set_field_detection`).
  - 「실내 17곳 옛 Tibo 번호」 경고는 **오탐**: 정의는 v5 인데 `stamp_tileset_object` 이식(tileGrafts)으로 칸 수가 시트보다 커져 `isHandInteriorV5Definition` 이 옛 정의로 오판, 통째 갈아 끼우며 경고했다. 출하 플레이어 방 전수(fallen-rooms 17곳) 모두 정상. 판정에서 이식 칸을 빼고, 같은 시트 새로 고침에서 이식 꼬리를 보존하도록 고침(`atlasBiomeInterior.ts`).
  - **1.24 판본 끝 = 하늘탑 1층**(`FS2_RELEASE_STOP = "B9"`): 여관 주인이 밤 판으로 보내고(B9 얼음 위의 등·발렌·제한 시간 탈출), 탑 1층에 들어서면 막 카드·회복·저장(`towerReleaseStop`), 위층 계단은 「다음 업데이트」. 체크포인트 `act2-b9-stop`(옛 `act2-b8-stop` 대체). B10 을 열 때 null.
  - 함정: `set_scene_mood` 에 lighting 을 주면 그 맵에 들어설 때 분위기 이벤트가 조명을 덮어쓴다 — `set_lighting_volume` 으로 따로 정한 맵(서리나루 해 질 녘)은 weather 만 준다.
  - 함정: 체크포인트 부팅이 부하에서 400~570초 — 부팅 한도를 600초로(`QA_CHECKPOINT_BOOT_MS`).
  - 함정: checkpoints 시나리오는 부팅 때 **현재 소스로** 폴른 프로젝트를 다시 짓는다 — QA 도는 중에 소스를 고치면 그 판이 섞인다.
  - 탐침: `/tmp/fs2/act2probe.mts` 는 vite-node 로 돈다: `OPRN_ASSUME_ALL_BGM_INSTALLED=1 node --max-old-space-size=12000 node_modules/vite-node/dist/cli.mjs --script /tmp/fs2/act2probe.mts`(tsx 는 .css import 로 죽는다). 타입 검사는 `/tmp/fs2/tsconfig.json`(만진 파일 + src/vite-env.d.ts).

## 1. 머지됨 (main)

| PR | 도구 | 한 줄 |
|---|---|---|
| #3545 | `scripts/content/save-fallen-star.mjs` | 구운 프로젝트를 정본 SQLite 에 저장 → 다시 열어 비교 |
| #3554 | `author_snow_route` | 눈길 맵 1~3장(눈 침엽 벽·빙판·눈더미), `data.maps[].gaps[]` 에 틈 자리(from/to/seals) |
| #3552 | `derive_map_variant look:"burned"` + `keepIntact` | 지은 마을을 불탄 모습으로, 집 하나는 멀쩡하게 |
| #3543 | `place_field_obstacle kind:"gap"` | 1~2칸 틈 양쪽 조사 이벤트, 배우/기술 있으면 점프로 건넘. 몬스터 장르 밖에서도 gap 만 허용 |
| #3553 | `author_party_split` | 파티 두 묶음·전환·짝 레버/문·합류 칸·풀림 검사 |
| #3542 | `upsert_combo_tech` 4인 | 2~4명, 4흉상 컷인 「쿼드 테크」, 동료 3명 자리 |
| #3547 | `configure_party_bonds` | 유대 0~max, 모닥불 대화 선택, 문턱 해금(연계기·스위치), 「관계」 메뉴 |
| #3544 | `upsert_skill chargeBreak` | 모으는 중 N 피해·속성·상태로 끊김, 「끊김!」, simulate_battle 보고 |

각 도구마다 `harness-data/space-craft/seed.json` 에 `fs2-*` 조수 과제 1건씩 있다. 도구들은 **실제 플레이로 본 적 없다**(타입 검사·ci-fast·탐침만).

## 2. 아직 열려 있던 것 (이 문서를 쓸 때)

| PR | 브랜치 | 도구 |
|---|---|---|
| #3546 | agent/fs2-journal | `configure_story_journal` + 「일지에 한 줄 쓰기」 m2 명령 + ESC 「일지」 |
| #3548 | agent/fs2-escape | `make_timed_escape` |
| #3557 | agent/fs2-guest | `add_battle_guest` + 과제 11(보이는 적 진영 싸움) 확인 |

작업자가 `node scripts/merge-pr.mjs <PR>` 로 머지 중이었다. `gh pr view <PR>` 로 상태를 보고, 안 머지됐으면 rebase(seed.json 은 cases 를 id 로 합친다) → merge-pr.mjs.
남은 워크트리: `/home/main/z-project/rpg-zzu-fs2-actA`(브랜치 agent/fs2-actA, 코드 0줄 — 지워도 된다). 작업자 탐침 기록은 `/tmp/fs2A`(probe2.mts·rpm.py, /tmp 라 사라질 수 있음).

## 3. 다음 순서

1. 위 열린 PR 3개 머지 확인.
2. **비트 B1~B6 (마일스톤 A)** — 아직 코드 0줄. 새 파일 `src/project/flagship/fallen/act2Opening.ts` 의 `applyFallenAct2Opening(project, exec, ids)` 를 `chronoBell.ts` 의 `applyFallenAct1Finale(...)` 바로 뒤에서 부른다. 조수 도구(`execTool`)로 짓는다.
   - 다리: `act1Finale.ts` 의 `ev_fs_siege_director_run` 끝 `triggerEnding end_fs_act1` 을 막 카드(「제1막 끝」→「제2막 — 빌린 불」, 1막 에필로그 두 줄)+B1 감방 이동으로 바꾼다. 엔딩 기록은 남겨 둔다(현재 1막 끝은 타이틀로 돌아간다).
   - B1: `create_map` + `author_map_puzzle stealth_guard_patrol`(20×15 초소 지하, 탐침 성공). 감방 문 열기는 1막 `openGate` 방식(타일 6421/6422).
   - B2: `duplicate_map fs_hub → fs2_hub_night` + `set_map_properties mapRole field`(보이는 적 순찰 기사용), `set_scene_mood` 밤, 토비·마르타 대사.
   - B3: `place_lift` toMapId 로 우물 → 천문대(1막 승강 장치 재사용), 하넬 장면.
   - B4: 대장간 로한(창 `upsert_equipment`), 개구멍 ≈ 허브 북벽 (38,15), 추격 기사, 브람 남음.
   - B5: `author_forest_route` 북쪽(terrain field) + `author_beodeul_town theme river` → `derive_map_variant look:"burned" keepIntact`. 잿불 도깨비(float)·숯 골렘(lumber), 주먹 자국 셋·정착 확인서, 별빛 결정 저장.
   - B6: `author_dungeon` castle 은 `adapter:"beodeul"` 를 줘야 한다(없으면 거절). 성벽 위 새라+경비견 둘, 지면 요새 감방(게임 오버 아님), 선택 1, 새라 합류(걷기 칩 Actor1 #3, 흉상은 공용 흉상 — 새 캐릭터 그림 금지).
3. **B7~B13 (마일스톤 B·C)** — 계획 7절 표대로. 쓸 새 도구: B7 `author_snow_route`+`place_field_obstacle gap`+`configure_party_bonds`, B9 `make_timed_escape`, B10 `author_party_split`, B11 `configure_story_journal`, B13 `chargeBreak`+`add_battle_guest`+4인 연계기 「네 번째 대답」.
4. 마일스톤마다: 굽기 → 정본 저장·재로드 → 체크포인트 녹화 → `~/claude-viz/fs-act2-1.html` 맨 위에 1배 영상 → PR → `node scripts/merge-pr.mjs <PR>`. Sonnet 검수는 마일스톤당 최대 1회.

## 4. 정본 저장·재로드

`폴른 스타` 는 코드로 짓는다(`flagship/chronoBell.ts`, 저장본 없음) — 굽기 결과를 정본 SQLite 로 남긴다.

```bash
NODE_OPTIONS=--max-old-space-size=12000 node scripts/content/bake-flagship-demos.mjs --out /tmp/fs2/bake --only chrono-bell   # ~6분
node scripts/content/save-fallen-star.mjs /tmp/fs2/bake/demos/chrono-bell.project.json      # 기본 --dir .oprn-projects/fallen-star
```
정본: `<체크아웃>/.oprn-projects/fallen-star`(git 무시). 마지막 기록(1.22 굽기): projectId `2f6aeacb-8fd1-46f9-a8e7-613d353ba78a`, revision 4 — rpg-zzu-dialogue-manager 체크아웃 안. 재로드는 맵·DB·타일셋이 같아야 통과하고, 저장소가 옛 오프닝 장면 모양(image→animatic)을 고쳐 읽는 것만 허용한다.

## 5. 체크포인트 QA (출하 플레이어 경로)

```bash
QA_RECORD_VIDEO=/tmp/fs2/qa/vid timeout 2400 unshare -rn bash -c 'ip link set lo up; npm run -s qa:runtime -- --scenario checkpoints --checkpoint-set fallen-star --checkpoint <id,id> --project /tmp/fs2/bake/demos/chrono-bell.project.json --out /tmp/fs2/qa --parallel 1'
```
- 체크포인트 정의: `scripts/qa/runtime/checkpoints/fallen-star.json`(indent=1 로 다시 쓸 것 — indent=2 면 거대한 diff). 새 비트는 `act2-b1-cell` … `act2-b6-join` 처럼.
- 부팅이 부하에서 300~380초, 체크포인트 부팅 한도는 360초 — 「Target crashed」「QA scene did not become ready」는 부하 탓, 한 번 재시도. `--parallel 1` 만.
- 게임 장면은 webm 마지막 몇십 초. `ffmpeg -sseof -N -t T -vf "fps=2,scale=320:-1,tile=6x4"` 로 훑고, 1배 클립은 `scale=960:-2:flags=neighbor -c:v libx264 -pix_fmt yuv420p -an`.
- 주인공이 덤불(키큰 풀) 칸에 서면 적이 못 본다 — 접근 시연 체크포인트는 트인 칸에 세운다. 도깨비불은 시야 cone+lineOfSight 라 나무 뒤면 안 온다.

## 6. 함정

- **디스크가 거의 꽉 찼다**(2026-10-25 밤 2~11GB). `npm run wt create` 가 체크아웃 도중 실패한다 — 작업자들은 sparse 워크트리(src·openwiki·harness-data/space-craft·scripts)+node_modules 심링크로 버텼다. 굽기 결과 `dist/`(1.4GB)·`/tmp` 영상은 끝나면 지운다.
- `npm run wt remove` 는 낡은 로컬 main 과 비교해 거부한다 → `--keep-branch` 로 지우고 브랜치는 손으로.
- 병렬 PR 이 `harness-data/space-craft/seed.json` 에서 늘 부딪힌다 — cases 를 id 로 합치는 파이썬 한 줄, 나머지 키는 upstream.
- `pgrep -f`/`pkill -f` 로 자기 셸을 죽인 사례 둘 — PID 로만 죽인다.
- 머지는 `node scripts/merge-pr.mjs <PR>` 만(ci-fast 초록 확인 후 머지).
- vitest·gates·테스트 금지(사용자 지시). 확인은 대상 파일 타입 검사 + 실제 플레이 녹화.
- 사람 그림은 새로 만들지 않는다(RTP 칩·공용 흉상). 새 도트는 3/4 관문(`npm run harness -- object-gate review`).
- `upsert_*` 로 만든 새 칩셋·맵 그림은 버들항 계열만(EasyRPG 계열 새 맵은 조수 경로에서 차단).
