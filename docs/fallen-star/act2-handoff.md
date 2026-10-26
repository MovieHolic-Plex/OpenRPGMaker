# 폴른 스타 제2막 — 인계 (2026-10-25 밤)

기획 정본: `docs/fallen-star/act2-plan.md`. 제1막·1.22 는 운영 스토어에 게시됨(fallen-star 1.22, PR #3509).

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
  - 정본 revision 4(굽기 bake6, 맵 31) 저장·재로드 OK.
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
