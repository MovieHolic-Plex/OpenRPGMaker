# 폴른 스타 제2막 — 인계 (2026-10-25 밤)

기획 정본: `docs/fallen-star/act2-plan.md`. 제1막·1.22 는 운영 스토어에 게시됨(fallen-star 1.22, PR #3509).

## 0. 지금 진행 중 (2026-10-26)

- 열린 도구 PR 셋(#3546 일지·#3548 시간 탈출·#3557 전투 손님)과 인계 문서 #3561 은 **모두 머지됨**.
- 비트 작업 브랜치: **`agent/fs2-beats`** (워크트리 `/home/main/z-project/rpg-zzu-fs2-beats`). WIP 를 자주 푸시한다 — 이어받으면 이 브랜치에서 시작.
- 진행 기록은 이 절 아래 「진행 로그」에 덧붙인다.

### 진행 로그
- 기준 굽기 `/tmp/fs2/base`(origin/main ed114f5cf0). 탐침은 `/tmp/fs2/probe.mts`(굽기 JSON 에 도구를 순서대로 부른다).

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
