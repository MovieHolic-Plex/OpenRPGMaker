# AI 조수(`/pi` · 채팅 · 영역 작업) 실패 모드 — 실측 보고

조사일 2026-09-14. 읽기 전용 조사. 자료 출처는 Supabase `rpg_zzu.ai_activity_logs` /
`rpg_zzu.ai_conversations` 실데이터 + 이 저장소 코드/이력.
작업 트리 `/home/main/paseo-workspace/worktrees/3lblgwmp/terrific-walrus`,
HEAD `27c3c5828` (2026-09-14 19:47 +0900, 브랜치 `pr815-merge`, `origin/main` `878d7308c` 를 포함하고 3커밋 앞섬).
"main 에 고쳐졌는가" 판정은 전부 `git merge-base --is-ancestor <sha> origin/main` 으로 확인했다.

---

## 1. 데이터 커버리지 (실제로 가져온 것)

| 항목 | 실측값 |
|---|---|
| `ai_activity_logs` 테이블 총 행수 (조회 시점) | **43,426** (`Content-Range: 0-0/43426`) |
| 실제로 내려받은 행 | 43,430 (페이지 44회) → **43,429 고유 `log_id`** (페이지 경계 중복 1건 제거) |
| 시간 창 (`created_at`) | **2026-08-24T06:01:06.430169+00:00 .. 2026-09-14T10:50:12.499420+00:00** (약 20.2일) |
| 채널 분포 | `other` 18,302 · `chat` 14,886 · `region` 8,179 · `pi` 1,032 · `ui` 1,030 |
| `diagnostics.severity` 분포 | `ok` 31,090 · **`error` 11,795 (27.2%)** · `warning` 77 · 값없음 467 |
| 등장 `project_id` 수 (활동 로그) | **60** |
| `ai_conversations` 총 행수 / 내려받은 메타 | **11,880 / 11,880**, 창 2026-08-24T06:01:39Z .. 2026-09-14T09:03:09Z, 프로젝트 34개 |
| `ai_conversations` 중 하네스 2개 프로젝트가 아닌 것 | **53건** — 이 53건의 `entries_json` 전량을 받아 `kind:"user"` 항목 **214개** 확인 |

### 1.1 프로젝트 편중 — 이 표가 보고서의 전제다

| project_id | 활동 로그 행수 | 성격 |
|---|---|---|
| `rpg-zzu-house-template-gallery` | 36,145 | **`.env.local` 의 `VITE_SUPABASE_PROJECT_ID` 값**. 모든 워크트리·모든 자동 테스트가 이 id 로 원격 기록한다 |
| `rpg-zzu-dungeon-example` | 5,961 | 하네스 픽스처 프로젝트 |
| 나머지 `oprn-*` / `rpg-zzu-*` **58개** | **합계 1,320** | 사람이 편집기에서 만든 실제 프로젝트 |

즉 **전체 행의 96.96% 가 이 저장소 자신의 테스트/하네스가 찍은 것**이다. 확증:
`stoppedReason=ownership-lost` 1,374행의 `instruction` 상위값은 `늦게 도착한 턴` 207건 ·
`여기 물 채워줘` 142건 · `마을 만들어줘` 31건 · `칠해줘` 12건 · `테스트` 4건이고,
`늦게 도착한 턴` 은 `test/aiActivityLogIndex.test.ts:199` 의 리터럴이며
`여기 물 채워줘` 는 `test/aiSelectionChipScope.quarantine.test.ts` 의 리터럴이다. 이 행들은 `model` 이 `null` 이다.
원인은 `src/ai/activityLog.ts:489-515` — `recordAiActivity` 는 실행 환경을 가리지 않고
Supabase 설정만 있으면 원격에 쓴다(테스트 가드 없음).

### 1.2 사용자가 실제로 문장을 친 턴만 골라낸 분모

`payload_json->index->userTexts` 가 비어 있지 않은 행 = 사람이(또는 하네스가) 지시문을 보낸 턴.

| 모집단 | 턴 수 | `severity=error` | 실패율 |
|---|---|---|---|
| 전체(하네스 포함) 사용자 입력 턴 | 3,523 | 2,444 | **69.4%** |
| └ 채널별 | `chat` 1,419 / `pi` 918 / `region` 1,186 | 1,295 / 705 / 444 | 91.3% / 76.8% / 37.4% |
| **하네스 2개 프로젝트를 제외한 실제 프로젝트의 사용자 입력 턴** | **166** | **114** | **68.7%** |
| 하네스 제외 전체 행 | 1,320 | 191 | 14.5% |

### 1.3 접근하지 못한 것 / 데이터의 구멍 (덮지 않고 적는다)

1. **2026-08-24 이전 기록은 존재하지 않는다.** `ai_activity_logs` 와 `ai_conversations` 의
   가장 오래된 `created_at` 이 둘 다 2026-08-24 이고, 같은 DB 의 `ai_analysis_runs` 는
   2026-07-14 까지 있다. `scripts/prune-ai-logs.mjs` (기본 `--days 30`, 헤더 주석: "5일에 12,735행 페이스")
   가 지운 결과로 보인다. **따라서 이 보고서의 모든 빈도는 20일 창의 값이고, 그 이전 추세는 말할 수 없다.**
2. `npm run db:verify-ai` 는 **실행 불가**다. 출력:
   `Supabase schema check failed: Unregistered migrations: 20260830000000_ai_activity_payload_index.sql, 20260907000000_spatial_authoring_cas.sql`
   — 이 헬퍼는 게이트로 쓸 수 없다(그 자체가 별도 결함).
3. 브라우저 IndexedDB 폴백(`oprn-ai-records`)과 디스크 미러(`output/ai-activity/`)는 **비어 있다**
   (`output/` 아래에 `evidence/` 만 있음). 이 워크트리에서 dev 서버를 띄운 적이 없으므로 당연하고,
   이 조사는 서버를 띄우지 않는 제약이었다. 따라서 **로컬 전용으로만 남은 실패는 못 봤다**.
4. 실패한 턴의 `payload_json` 전문(툴 인자 원본)은 43k행 전체에 대해서는 받지 않았다 —
   `diagnostics` / `result` / `index` / `model` 만 골라 받았다(용량). 개별 검증이 필요한 행은 `log_id` 로 다시 받으면 된다.
5. `anon` 키로만 접근했다. RLS/권한상 보이지 않는 행이 있다면 이 보고서는 그것을 세지 못한다
   (다만 `Prefer: count=exact` 총계와 내려받은 행수가 일치하므로, 이 테이블 안에서는 누락이 없다).

---

## 2. 실패 모드 랭킹

두 가지 랭킹을 따로 낸다. **섞으면 틀린 결론이 나온다** — 1절에서 보였듯 원본 표의 97% 가 하네스이기 때문이다.

### 2.A 실제 사용자 프로젝트에서 (58개 `oprn-*` 프로젝트, 에러 행 191건이 분모)

분류는 아래 정규식으로 했다(4절 E5 에 스크립트 전문).

| 순위 | 실패 모드 | 에러 행 | 사용자 입력 턴 중 | 처음 .. 마지막 |
|---|---|---|---|---|
| 1 | **F2 밑그림(BuildSpec) 게이트가 모델이 고른 툴을 차단/거부** | **100 (52.4%)** | 65 / 114 | 2026-08-26 .. 2026-09-11 |
| 2 | **F1 툴 인자 스키마 거부** | **70 (36.6%)** | 48 | 2026-08-27 .. 2026-09-11 |
| 3 | **F4 WorkPlan 완료 회계 불일치** | **61 (31.9%)** | 33 | 2026-08-24 .. 2026-09-11 |
| 4 | **F3 타일 어휘 조회 실패** | **43 (22.5%)** | 29 | 2026-08-28 .. 2026-09-11 |
| 5 | **F6 인수/독립검수 게이트가 올바른 결과를 거부** | **17 (8.9%)** | 17 | 2026-09-06 .. 2026-09-14 |
| 6 | **F5 전송·공급자 인증 실패** | **13 (6.8%)** | 12 | 2026-08-27 .. 2026-09-08 |
| – | 미분류 | 40 | 19 | — |

(한 턴이 여러 모드를 동시에 내므로 합은 191을 넘는다.)

### 2.B 원본 표 전체에서 (하네스 포함, 에러 행 11,795건이 분모)

| 순위 | 실패 모드 | 에러 행 | 실제 프로젝트 몫 |
|---|---|---|---|
| 1 | F8 사유 없는 턴 실패 (`턴 실패: unknown|final|timeout`) | 3,554 | 14 |
| 2 | F5 전송·공급자 인증 | 1,473 | 13 |
| 3 | F7 턴 소유권 상실(orphan 기록) | 1,374 | **0** |
| 4 | F2 밑그림 게이트 | 152 | 100 |
| 5 | F6 인수/독립검수 | 127 | 17 |
| 6 | F1 툴 인자 스키마 | 96 | 70 |
| 7 | F4 WorkPlan 완료 회계 | 85 | 61 |
| 8 | F3 타일 어휘 | 51 | 43 |
| – | 미분류(런타임 QA·부팅 진단 등) | 5,105 | 40 |

---

### F2 — 밑그림(BuildSpec) 게이트가 모델이 방금 고른 툴을 차단한다 · **살아 있음**

**축어 오류 문자열 1 (게이트 차단):**

```
place_battle_blocker: 스펙 게이트: 'place_battle_blocker' 차단 — 이 맵의 밑그림(스펙)이 없습니다 — 조회 선행 조건 미충족: get_database_records(collection:"troops", ids:["troop_dungeon_scouts"]); find_events(mapId:"map_dungeon_stone"). 조회를 성공시키고 반환된 값으로 다시 호출하세요. 프로젝트는 변경하지 않았습니다.
```

```
author_village: 스펙 게이트: 'author_village' 차단 — 이 맵의 밑그림(스펙)이 없습니다 — 공간 빌드는 set_build_spec으로 밑그림을 제출해 검증을 통과한 뒤에만 실행됩니다. 체크리스트: 대상 맵, 에셋별 영역(x,y,w,h)·종류·스타일, 통로 너비(pathWidth), 밀도(density), 배치 스타일(layoutStyle). 현재 컨텍스트 선택 영역이 있으면 암묵적 명세로 인정됩니다. 없으면 필요한 영역을 직접 산정해 set_build_spec으로 제출하세요.
```

**축어 오류 문자열 2 (그래서 낸 밑그림이 다시 거부됨):**

```
set_build_spec: 밑그림 검증 실패(1회) — 에셋 'base_grass'와 'village_houses'가 교차합니다: (2,1) 16×6. / 새 에셋 간 교차를 고치세요: 실제 도로는 kind:"road"로 명시하면 road-road 교차가 허용됩니다. 같은 층 terrain-road는 buildOrder에 두 kind를 모두 넣고 terrain을 먼저 두어야 합니다. …
```

```
set_build_spec: 밑그림 검증 실패(3회) — 계획 폐기
```

**빈도(하네스 제외):** `스펙 게이트: … 차단` **74행**, `밑그림 검증 실패(` **69행**, 합쳐 턴 단위 **100행**.
전체 표 기준으로는 각각 84 / 106.

**빈도를 낸 질의** (E5 스크립트, `nonHarness` 집합에 대해):
`/스펙 게이트: .+ 차단/` 및 `/밑그림 검증 실패\(/` 를 `payload_json->diagnostics->messages` 에 매칭.

**구체 사례 (log_id · UTC · project):**
- `34e37b52-8ff2-46bf-a4ab-eda2c3e54844` · 2026-09-10T15:19:00 · `oprn-e2569570eb` · chat
- `f8074aea-1fe1-4bd8-a22c-31def95cc291` · 2026-09-08T18:47:59 · `oprn-71a4111047` · chat
- `68904bd1-7957-4fb2-8b92-cdacfce5e710` · 2026-09-11T08:32:20 · `oprn-9a3cb395fa` · chat (밑그림 검증 실패)
- `ecbfd184-a096-4288-8c03-1d2124c0a8e3` · 2026-09-08T10:57:57 · `oprn-e98456e1d8` · chat

**코드 경로:**
- 차단: `src/ai/assistantSession.ts:1653` — `specGateResult(\`스펙 게이트: '${name}' 차단 — 이 맵의 밑그림(스펙)이 없습니다\`, …)`
- 거부·폐기: `src/ai/assistantSession.ts:1570-1600` (메시지 조립), 요약은 `src/ai/assistantSession.ts:1598`
- 게이트가 요구하는 검증기: `src/ai/buildSpec.ts` 계열 (교차 판정), 청사진 영역 추출 `src/editor/agentBlueprintRegions.ts:4`
- 이 게이트가 존재하는 이유는 코드에 적혀 있다: `src/ai/workPlan.ts:237` — "빈 맵에서 `fill_region` 이 스펙 게이트에 막히자 Ralph 가 **173/256** 까지 같은 항목을 재주입했다."

**main 에 고쳐졌나:** **아니다. 살아 있다.** 게이트 코드는 현재 `origin/main` 에 그대로 있고,
가장 최근 발생이 2026-09-11(창의 끝에서 3일 전)이다. 고쳐진 것은 "무한 재주입"뿐이고, 차단 자체는 설계다.

---

### F1 — 툴 인자 스키마 거부 (모델이 만든 인자가 검증기를 통과하지 못함) · **부분적으로 고쳐짐**

**축어 오류 문자열:**

```
place_npc: 'place_npc' 실행 실패: SimplePage 인자 오류: 필드: pages[0].commands[0].kind; 기대 타입: string; 실제 타입: undefined; 최소 예시: {"pages":[{"lines":["안녕하세요"],"conditions":[],"commands":[{"kind":"text","body":"안녕하세요"}]}]}
repair: {"path":"pa… — 필수 인자 누락: pages — 대화 NPC는 pages:[{lines:[원래 대사]}]가 필수입니다. dialogue.text는 pages의 lines로 옮기세요.
```

```
make_villager: 'make_villager' 인자 검증 실패 — 필수 인자 누락: mapId — 다시 보낼 형식 예시: {"mapId":"map_town","name":"농부", …}
```

```
upsert_event: 'upsert_event' 실행 실패: 커맨드 형식 오류: command ev_cathedral_prop_dummy.pages[0].commands[0]: …
```

```
set_scene_mood: 'set_scene_mood' 실행 실패: sources[0].at는 'player', {x,y}, {eventId} 중 하나여야 합니다.
```

**빈도(하네스 제외):** 정규식 `/인자 검증 실패|인자 오류|형식 오류|기대 타입|기대 형식|가 배열이 아닙니다|가 필요합니다/` → **70행**.
그중 `SimplePage 인자 오류` 만 **43행**(전체 표 66행). 실패 툴 상위(하네스 제외 `diagnostics.failedTools` 집계):
`set_build_spec` 71 · `place_npc` 66 · `complete_work_item` 61 · `fill_region` 42 · `author_village` 30 ·
`author_house` 26 · `upsert_event` 23 · `place_props` 20 · `make_villager` 18.

**구체 사례:**
- `f5d0ecd3-cdea-41cd-922f-6ff3ff289deb` · 2026-09-06T14:29:53 · `oprn-fee2e1d872`
- `a6cecc3f-8dd1-4f20-ad45-0c9e75cd25c0` · 2026-09-06T13:33:57 · `oprn-40cb300633`
- `ba46e063-4cfc-4158-baf8-74c52a94b929` · 2026-09-06T11:40:15 · `oprn-6bde56b135`

**코드 경로:** `src/editor/tools/eventCompile.ts:233` (`simplePageFieldError`) · `:240` (`simplePageShapeError`);
스키마 계약 주석은 `src/editor/tools/schemaShapes.ts:5`.

**main 에 고쳐졌나:** **부분적으로.** `SimplePage 인자 오류` 의 마지막 발생은
**2026-09-06T14:29:53** 이고, 그 직후 들어간 수정이 `origin/main` 에 있다:
- `ac6a4dd31` (2026-09-05) `fix(ai): normalize NPC text aliases before command validation` — IN origin/main
- `986db8d94` (2026-09-06) `fix(ai): align NPC command schemas and preserve reward repairs` — IN origin/main
- `6ed186d48` (2026-09-06) `fix(ai): return safe corrections for malformed NPC arguments` — IN origin/main
`place_npc` 계열은 2026-09-06 이후 이 창에서 **0건**이다. 그러나 F1 전체(다른 툴들)는
`68904bd1` 2026-09-11 까지 계속 나오므로 **툴 단위로는 고쳐졌고 계열 전체로는 살아 있다**.

---

### F4 — WorkPlan 완료 회계 불일치 (일은 했는데 항목을 닫을 수 없다) · **살아 있음**

**축어 오류 문자열:**

```
complete_work_item: 항목 '모험가 길드 안내원 및 던전 경고 이벤트 배치' 완료 조건 미충족: 필수 successTools 중 place_npc 성공 기록이 없습니다. 누락된 툴을 성공시키거나, 항목 전제가 틀렸다면(예: 사용자가 기존 맵 수정을 요청했는데 항목이 신축을 요구) set_work_plan으로 계획을 고치거나 skip_work_item으로 건너뛰세요.
```

```
complete_work_item: 완료할 항목 id가 없습니다.
```

```
WorkPlan 자동 완료 차단: 플레이어 시작 위치 설정 — 완성도 경고 1건 — ⚠ 미이행: 실제 변경이 없습니다(체인지셋 0건).
```

**빈도(하네스 제외):** `/완료 조건 미충족|완료할 항목 id가 없습니다/` → **58행**;
F4 정규식 전체(`complete_work_item:` 포함) → **61행**. 전체 표 85행.

**구체 사례:**
- `68904bd1-7957-4fb2-8b92-cdacfce5e710` · 2026-09-11T08:32:20 · `oprn-9a3cb395fa`
- `34e37b52-8ff2-46bf-a4ab-eda2c3e54844` · 2026-09-10T15:19:00 · `oprn-e2569570eb`
- `276d4abe-dd94-402c-8b70-3da04d240ddd` · 2026-09-08T10:58:08 · `oprn-71a4111047`
- `507267a8-3f3f-49b5-85ed-882f56de4b74` · 2026-08-30T05:02:11 · `oprn-71c180d4da` (`완료할 항목 id가 없습니다.`)

**코드 경로:** `src/ai/workPlan.ts:964` · `src/ai/workPlan.ts:976` (`필수 successTools 중 … 성공 기록이 없습니다`),
`src/ai/assistantSession.ts:2896` (`완료할 항목 id가 없습니다.`).
이 실패는 **F1·F2 의 2차 피해**다 — 앞의 툴이 스키마/게이트로 막히면 `successTools` 기록이 안 남고,
그러면 항목을 닫을 수 없어 같은 항목을 다시 시도한다(`src/ai/workPlan.ts:1008` 주석이 바로 이 루프를 기술한다).

**main 에 고쳐졌나:** **살아 있다.** 마지막 발생 2026-09-11T08:32:20.

---

### F3 — 타일 어휘 조회 실패 (모델이 부른 이름의 타일이 없다) · **살아 있음**

**축어 오류 문자열:**

```
author_house: 'author_house' 실행 실패: 라벨/설명이 "꽃" 인 타일을 찾지 못했습니다. tile_query ask:"labels" 로 후보를 확인하세요.
```

```
fill_region: 'fill_region' 실행 실패: 라벨/설명이 "어두운 돌바닥" 인 타일을 찾지 못했습니다. tile_query ask:"labels" 로 후보를 확인하세요.
```

관측된 실패 낱말: `꽃` · `나무 바닥 데크` · `어두운 돌바닥` · `붉은 카펫` · `돌 제단` · `석조 기둥`.

**빈도(하네스 제외):** `/인 타일을 찾지 못했습니다/` → **28행**(F3 정규식 전체 43행). 전체 표 32행.

**구체 사례:**
- `e29b741c-d9ee-46f1-8e9e-6594227b4ca7` · 2026-09-06T21:03:35 · `oprn-b949153d49`
- `05ef7649-7d19-44fc-a858-9cc3a406ee7a` · 2026-09-06T17:14:43 · `oprn-e98456e1d8`
- `85218cb9-79a2-466e-ae32-7731b2eb5355` · 2026-08-28T17:02:34 · `rpg-zzu-black-bell` (한 턴에 5개 낱말 동시 실패)

**코드 경로:** `src/project/tileVocabulary.ts:377`.

**main 에 고쳐졌나:** **살아 있다.** 하네스 제외 마지막 2026-09-06, 전체 마지막 2026-09-10T07:17:56.

---

### F6 — 인수/독립 검수 게이트가 **맞게 한 작업을 거부한다** · **살아 있음 (가장 최근까지)**

**축어 오류 문자열 1:**

```
독립 검수 미승인: independent-review-malformed-json
```

**축어 오류 문자열 2 — 검수문이 "요청대로 정확히 반영되었다" 고 말하면서 미승인이다:**

```
독립 검수 미승인: 적 '녹슨 해골 병사(enemy_ai_1)'의 최대 HP(140), 공격력(25), 방어력(21) 수정 및 '성수 한 병(item_ai_1)'의 가격(30G 유지) 및 HP 회복량(30) 변경이 요청 사항대로 정확히 반영되었으며, 그 외 데이터 보존 및 린트 검증이 확인되었습니다. (동일 실패 반복)
```

**축어 오류 문자열 3:**

```
완료 검증이 아직 미완성입니다.
- Request coverage unverified: Acceptance incomplete; execution stopped
  {"kind":"functionalUnresolved","reason":"JSON 객체가 없다"} → JSON 객체가 없다
```

```
repair_acceptance: Acceptance unchanged: repair only missing criteria; review requires delivered current evidence
```

**빈도:** `독립 검수 미승인` 전체 **64행**(2026-09-08T10:57:57 .. 2026-09-14T09:03:52),
`완료 검증이 아직 미완성입니다` **47행**(전부 하네스, region 채널).
하네스 제외 F6 전체 **17행**.

**구체 사례:**
- `c599dfbb-2f66-4009-bf8c-3e92d163153a` · 2026-09-14T09:03:52 · `oprn-3b093b62c0` ← 위 축어 문자열 2의 출처. **창 안에서 가장 마지막 실사용자 실패다.**
- `ecbfd184-a096-4288-8c03-1d2124c0a8e3` · 2026-09-08T10:57:57 · `oprn-e98456e1d8`
- `0a29510a-7402-4836-96a0-a61b7b5957bd` · 2026-09-14T00:41:50 · `rpg-zzu-house-template-gallery`
- `8caa1874-aa6c-489a-b54a-1f2edeb53e27` · 2026-09-14T00:03:16 (`완료 검증이 아직 미완성`)

**코드 경로:** `src/ai/independentReview.ts:376-385` — `parseIndependentReview` 가
검수 모델의 **응답 전문을 `JSON.parse`** 한다. 마크다운 펜스 하나만 벗기고, 그 외 산문이 섞이면
`catch { throw new Error("independent-review-malformed-json"); }` (`:385`).
즉 **검수 모델이 한국어로 "맞다" 고 써 버리면 올바른 편집이 통째로 거부된다.**

**main 에 고쳐졌나:** **살아 있다.** 도입 커밋 `5cab5e2c1` (2026-09-07,
`feat(ai): independently review and repair drafts before applying`, IN origin/main),
완화 시도 `f05b4a92d` (2026-09-09, `fix(review): spend every cheap rung before refusing to review a draft`, IN origin/main).
그럼에도 마지막 발생이 **2026-09-14T09:03:52** 로, 데이터 창의 끝이다.

---

### F5 — 전송·공급자 인증 실패 · **실사용자 영향은 작다 / 하네스에서는 지배적**

**축어 오류 문자열 (실사용자 프로젝트에서 관측):**

```
Google Gemini 로그인이 필요합니다(401). AI 설정에서 Google 계정으로 로그인하세요. — {"error":"Encountered invalidated oauth token for user, failing request"}
```

```
서버 오류(500): 공급자 측 문제입니다. 잠시 후 재시도하세요. — {"error":"Generation failed with finish reason: MALFORMED_FUNCTION_CALL"}
일시적 네트워크 문제로 보이면 재시도를 눌러 주세요.
```

```
서버 오류(500): 공급자 측 문제입니다. 잠시 후 재시도하세요. — {"error":"openai-codex: token refres…
```

**축어 오류 문자열 (하네스에서만 관측 — 아래 "주의" 참조):**

```
네트워크 오류: LLM 엔드포인트에 연결할 수 없습니다(/v1). npm run ai:oauth로 로컬 동반 서비스를 실행하세요. Failed to parse URL from /v1/chat/completions
일시적 네트워크 문제로 보이면 재시도를 눌러 주세요.
```

```
Failed to parse URL from /v1/agent/run?provider=google-antigravity
```

```
Unexpected token 'd', "data: {"ch"... is not valid JSON
```

**빈도:** F5 전체 1,473행 / 하네스 제외 **13행**.
세부: `로그인이 필요합니다(401)` 279행(하네스 제외 10) · `서버 오류(500)` 20행(하네스 제외 8) ·
`Failed to parse URL from /v1…` **864행(하네스 제외 0)** · `is not valid JSON` 135행(하네스 제외 0) ·
`Pi 에이전트 실행 실패: 500` 98행(하네스 제외 0) · `Pi 에이전트가 결과를 돌려주지 않았습니다` 82행(하네스 제외 0).

**구체 사례:**
- `15b524a6-2f82-492d-83a5-1c5632a84ffe` · 2026-09-01T05:00:14 · `oprn-d7c9f6ed0e` (401)
- `5144e5b5-a2b8-437a-b2f4-eb8f1a39c033` · 2026-09-07T18:48:15 · `oprn-71a4111047` (500 MALFORMED_FUNCTION_CALL)
- `60095439-cea3-4768-906e-d79a753f5d02` · 2026-09-14T00:41:36 · 하네스 (`/v1/agent/run` 상대 URL)
- `cfc1c670-1814-492e-a0b3-f876676df874` · 2026-09-09T13:44:17 · 하네스 (SSE 를 JSON 으로 파싱)

**코드 경로:**
- 401: `src/ai/llmClient.ts:358`
- 네트워크 오류 문구: `src/ai/llmClient.ts:929`
- **상대 URL 함정:** `src/ai/llmClient.ts:89-91` — `companionCompletionsBaseUrl()` 이 하드코딩 `"/v1"` 을 돌려주고,
  `src/ai/chatgptOAuthClient.ts:10-13` `companionAuthUrl()` 이 그걸 origin 으로 써서 `"/v1/agent/run?provider=…"` 를 만든다.
  브라우저에서는 Vite 프록시로 정상이지만 **Node/undici `fetch` 는 상대 URL 을 파싱하지 못해 즉시 던진다.**
  그래서 이 864건은 전부 비브라우저 하네스 실행이다(실사용자 0건).
- **SSE 를 JSON 으로 파싱:** `src/ai/llmClient.ts:947-951` — SSE 분기 조건이 `stream && …` 이라
  `src/ai/llmClient.ts:891-896` 에서 공급자 능력 때문에 `stream` 이 false 로 내려간 뒤에도 서버가 스트리밍하면
  `await response.json()` 이 `data: {"ch"…` 를 먹고 죽는다. (이 경로가 그 문자열의 유일한 생산지라는 것은
  코드 정황으로 추정했고, 라이브 재현은 하지 않았다 — **미검증**으로 표시한다.)
- Pi: `src/ai/piAgent/client.ts:36` (`Pi 에이전트 실행 실패: ${detail}`) · `:56` (`Pi 에이전트가 결과를 돌려주지 않았습니다`)

**main 에 고쳐졌나:** 상대 URL·SSE 파싱 분기 모두 `origin/main` 에 **현재 형태 그대로 있다**(살아 있음).
`/pi` 자체는 `6885f37f1` (2026-09-09, IN origin/main)에 들어왔고, `pi` 채널 실패는 도입 이틀 뒤부터 관측된다.

---

### F7 — "턴 소유권 상실" 은 **실사용자 실패가 아니다** (분류 정정)

**축어:** `턴 실패: ownership-lost`

**빈도:** 1,374행. **하네스 제외 0행.** 전부 `result.orphaned = true`, `result.error = null`,
`model = null`, 1,177개의 서로 다른 `runId` 에 분산. `instruction` 상위값은 테스트 리터럴(1.1절).

**코드 경로:** `src/editor/panels/aiTurnRunner.ts:538-547` — 소유권이 끊긴 뒤 정착한 턴을
`ok:false, orphaned:true, stoppedReason:"ownership-lost"` 로 남긴다. 주석이 의도를 밝힌다:
"소유권이 끊겼다는 사실 자체가 진단이므로 orphaned 로 표시해 남긴다."
도입 `d3078567f` (2026-08-30, IN origin/main) — 관측 시작일(2026-08-30T11:13:51)과 정확히 일치한다.

**판정:** 버그가 아니라 **의도된 기록**이며, 전량 테스트가 만든 것이다. 그러나 `result.ok=false` 로 들어가므로
"AI 가 자주 실패한다" 는 인상의 **최대 단일 오염원**이다.

---

### F8 — 사유가 기록되지 않은 턴 실패 · **관측 계측의 구멍**

**축어:** `턴 실패: unknown` (전체 2,742 / 하네스 제외 12) · `턴 실패: ownership-lost` (F7) ·
`턴 실패: timeout` (517, 전부 `other` 채널) · `턴 실패: final` (293)

**코드 경로:** `src/ai/activityLog.ts:254` —
`input.result.error ?? \`턴 실패: ${input.result.stoppedReason ?? "unknown"}\`` .
즉 `error` 도 `stoppedReason` 도 없이 `ok:false` 로 닫힌 턴은 **영구히 사유 불명**이다.
2,742건 중 2,614건이 하네스 `chat` 이고 `result:{ok:false,pending:true}` 로 시작만 기록된 뒤 종료 기록이 오지 않은 형태다
(예: `c44cb8dc-a240-47f4-8ad4-b69d8c0ebf3c` · 2026-09-14T10:48:38 · `oprn-3b093b62c0` — 이건 실사용자 턴이다).

**main 에 고쳐졌나:** **살아 있다.** 마지막 발생 2026-09-14T10:50:12 (데이터 창의 끝).

---

## 3. "왜 이렇게 자주 실패하는가" — 데이터가 말하는 답 (한 문단)

먼저 숫자를 바로잡아야 한다: 원본 표의 27.2%(11,795/43,429) 실패율은 **사람의 경험이 아니다** —
행의 96.96% 가 이 저장소 자신의 테스트·하네스가 같은 `VITE_SUPABASE_PROJECT_ID`(`rpg-zzu-house-template-gallery`)로
찍은 것이고(`src/ai/activityLog.ts:489-515` 에 환경 가드가 없다), 최대 단일 실패 서명인
`ownership-lost` 1,374건은 실사용자 프로젝트에서 **0건**이다.
실제 사용자 프로젝트 58개로 좁히면 사람이 문장을 친 턴 166건 중 **114건(68.7%)** 이 오류로 끝나는데,
그 실패의 성격은 "모델이 멍청해서" 도 "네트워크가 끊겨서" 도 아니다 — 전송·인증 실패는 13건(6.8%)뿐이다.
압도적 다수는 **편집기가 스스로 세운 사전 조건 게이트에 모델이 걸려 넘어지는 것**이다:
쓰기 툴을 부르려면 먼저 `set_build_spec` 밑그림이 통과해야 하고(F2, 100건 = 에러의 52.4%),
그 밑그림과 툴 인자는 좁은 스키마를 정확히 맞춰야 하며(F1, 70건),
툴이 막히면 `successTools` 기록이 없어 `complete_work_item` 이 항목을 닫지 못해 같은 항목을 되풀이하고(F4, 61건),
쓰려는 타일 이름이 어휘집에 없으면 또 막히고(F3, 43건),
끝까지 올바르게 해냈어도 독립 검수 모델의 응답이 순수 JSON 이 아니면 결과 전체가 폐기된다(F6, 17건 —
`c599dfbb` 에서는 검수문이 "요청 사항대로 정확히 반영되었으며" 라고 써 놓고 미승인 처리됐다).
요컨대 **실패의 대부분은 조수가 일을 못 한 것이 아니라, 일을 한 뒤(또는 하기 직전) 자체 검증 계층이 거부한 것**이고,
이 계층들이 직렬로 걸려 있어 하나가 막히면 뒤의 회계·완료·검수가 연쇄로 함께 실패한다.

---

## 4. Evidence 부록 — 재현 명령과 원시 출력

모든 명령은 `cd /home/main/paseo-workspace/worktrees/3lblgwmp/terrific-walrus` 에서 실행했고,
자격은 `set -a && . ./.env.local; set +a` 로 셸에 넣었다. **키와 URL 전문은 이 문서에 옮기지 않는다.**

### E1 — 스키마 확인 (첫 시도는 실패했다. 그 실패도 증거다)

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/ai_conversations?select=id,project_id,created_at,entries_json&order=created_at.desc&limit=5" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" -H "Accept-Profile: rpg_zzu"
```
```
{"code":"42703","details":null,"hint":null,"message":"column ai_conversations.id does not exist"}
```
→ 과제문에 적힌 `select=id` 는 이 테이블에 없다. 실제 컬럼(`select=*&limit=1` 로 확인):
```
[ 'conversation_id','project_id','title','model','project_context_key','entries_json','saved_at','created_at' ]
```

### E2 — 총계

```bash
for t in ai_conversations ai_activity_logs ai_analysis_runs; do
  curl -s -I -X GET "$VITE_SUPABASE_URL/rest/v1/$t?select=created_at&limit=1" \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
    -H "Accept-Profile: rpg_zzu" -H "Prefer: count=exact" | grep -i "content-range"; done
```
```
== ai_conversations   Content-Range: 0-0/11880
== ai_activity_logs   Content-Range: 0-0/43425     (몇 분 뒤 43426)
== ai_analysis_runs   Content-Range: 0-0/15370
```

심각도별 총계:
```bash
# payload_json->diagnostics->>severity=eq.error 등으로 Prefer: count=exact
severity=error:   Content-Range: 0-0/11793
severity=warning: Content-Range: 0-0/77
result.ok=false:  Content-Range: 0-0/11445
total:            Content-Range: 0-0/43426
```

### E3 — 슬림 페이징 수집 (보고서의 모든 빈도는 이 파일에서 나왔다)

`/tmp/aiinv/fetch-err.mjs` (임시 파일, 저장소 밖):

```js
import { readFileSync, writeFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("<worktree>/.env.local","utf8").split("\n")
  .filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf("=")), l.slice(l.indexOf("=")+1).trim()]));
const U = env.VITE_SUPABASE_URL.replace(/\/$/,""), K = env.VITE_SUPABASE_ANON_KEY;
const headers = { apikey:K, Authorization:`Bearer ${K}`, "Accept-Profile":"rpg_zzu" };
const sel = "log_id,project_id,channel,created_at,diag:payload_json->diagnostics,"
          + "res:payload_json->result,idx:payload_json->index,model:payload_json->>model";
let all=[], page=1000;
for (let off=0; off<60000; off+=page) {
  const r = await fetch(`${U}/rest/v1/ai_activity_logs?select=${sel}&${process.argv[2]}`
                      + `&order=created_at.desc&limit=${page}&offset=${off}`, { headers });
  if (!r.ok) { console.error("HTTP", r.status, (await r.text()).slice(0,300)); break; }
  const rows = await r.json(); all = all.concat(rows);
  if (rows.length < page) break;
}
writeFileSync(process.argv[3], JSON.stringify(all)); console.log("rows", all.length);
```

```bash
node fetch-err.mjs "log_id=not.is.null" /tmp/aiinv/all_slim.json        # rows 43430
node fetch-err.mjs "payload_json->diagnostics->>severity=eq.error" /tmp/aiinv/errs.json   # rows 11793
```

### E4 — 커버리지 집계 (원시 출력)

```
unique rows 43429   fetched 43430
distinct projects (logs) 60
conv rows 11880   distinct projects (conv) 34
channels { chat: 14886, region: 8179, ui: 1030, pi: 1032, other: 18302 }
non-harness rows 1320   projects 58
non-harness user-typed 166   errors 114
all user-typed 3523   errors 2444
window 2026-08-24T06:01:06.430169+00:00 .. 2026-09-14T10:50:12.49942+00:00
ALL by severity { error: 11795, ok: 31090, warning: 77, none: 467 }
user turns by severity { error: 2444, ok: 1075, warning: 4 }
user turns channel { chat: 1419, pi: 918, region: 1186 }
```

### E5 — 실패 모드 분류 (`/tmp/aiinv/families.mjs`)

```js
const HARNESS = new Set(["rpg-zzu-house-template-gallery","rpg-zzu-dungeon-example"]);
const FAM = [
 ["F1 tool-arg/schema rejection", /인자 검증 실패|인자 오류|형식 오류|기대 타입|기대 형식|가 배열이 아닙니다|가 필요합니다/],
 ["F2 BuildSpec gate block/reject", /스펙 게이트: '.+' 차단|밑그림 검증 실패/],
 ["F3 tile-vocabulary miss", /인 타일을 찾지 못했습니다|리소스를 찾지 못했습니다/],
 ["F4 work-plan completion accounting", /complete_work_item:|완료 조건 미충족|완료할 항목 id가 없습니다/],
 ["F5 transport / provider auth", /네트워크 오류: LLM 엔드포인트|로그인이 필요합니다\(\d+\)|Failed to parse URL from|Pi 에이전트 실행 실패|Pi 에이전트가 결과를 돌려주지 않았습니다|is not valid JSON|요청 시간 초과|The operation was aborted/],
 ["F6 acceptance / independent review", /독립 검수 미승인|완료 검증이 아직 미완성|Acceptance unchanged|Acceptance incomplete/],
 ["F7 turn-runner ownership/orphan", /턴 실패: ownership-lost/],
 ["F8 unattributed turn failure", /^턴 실패: (unknown|final|timeout)$/],
];
// rows = dedup(all_slim.json); errs = rows.filter(r => r.diag?.severity === "error");
// 각 FAM 에 대해 errs.filter(r => r.diag.messages.some(m => re.test(m))).length
```

원시 출력:
```
==================== ALL FETCHED  rows=43429
error rows: 11795 (27.2%)
 3554  F8 unattributed turn failure    first=2026-08-27 last=2026-09-14
 1473  F5 transport / provider auth    first=2026-08-25 last=2026-09-14
 1374  F7 turn-runner ownership/orphan first=2026-08-30 last=2026-09-14
  152  F2 BuildSpec gate block/reject  first=2026-08-26 last=2026-09-11
  127  F6 acceptance / independent review first=2026-09-06 last=2026-09-14
   96  F1 tool-arg/schema rejection    first=2026-08-26 last=2026-09-11
   85  F4 work-plan completion accounting first=2026-08-24 last=2026-09-11
   51  F3 tile-vocabulary miss         first=2026-08-28 last=2026-09-11
unclassified error rows: 5105
  (상위: 'Failed to fetch dynamically imported module: http://mdc-server:9888/as' 869,
   'exact count rolled back' 859, 'document is not defined' 843, '첫 부팅 실패' 510,
   '자동 실행 이벤트가 부팅을 잡아먹었습니다' 500, 'WebGL 컨텍스트 생성 실패' 464
   — 전부 하네스의 런타임 QA 진단이지 조수 턴이 아니다)

==================== NON-HARNESS PROJECTS (58 project ids)  rows=1320
error rows: 191 (14.5%)
  100  F2 BuildSpec gate block/reject      first=2026-08-26 last=2026-09-11
   70  F1 tool-arg/schema rejection        first=2026-08-27 last=2026-09-11
   61  F4 work-plan completion accounting  first=2026-08-24 last=2026-09-11
   43  F3 tile-vocabulary miss             first=2026-08-28 last=2026-09-11
   17  F6 acceptance / independent review  first=2026-09-06 last=2026-09-14
   13  F5 transport / provider auth        first=2026-08-27 last=2026-09-08
    0  F7 turn-runner ownership/orphan
unclassified error rows: 40

==================== NON-HARNESS + user typed  rows=166
error rows: 114 (68.7%)
   65  F2 · 48 F1 · 33 F4 · 29 F3 · 17 F6 · 12 F5 · 4 F8 · 0 F7
unclassified error rows: 19
```

### E6 — `ownership-lost` 가 테스트 산출물이라는 증거

```bash
node fetch2.mjs "payload_json->result->>stoppedReason=eq.ownership-lost" /tmp/aiinv/ownership.json   # rows 1374
```
```
rows 1374  window 2026-08-30T11:13:51.088422+00:00 .. 2026-09-14T08:36:18.299441+00:00
distinct runIds 1177        orphaned { true: 1374 }        inner error [ [ 'null', 1374 ] ]
by day 08-30:25 08-31:5 09-01:16 09-02:21 09-03:73 09-04:71 09-05:350 09-06:426
       09-07:138 09-08:102 09-09:34 09-10:18 09-11:23 09-12:23 09-13:40 09-14:9
instruction 상위: '늦게 도착한 턴' 207 · '여기 물 채워줘' 142 · '마을 만들어줘' 31 · '칠해줘' 12 · '테스트' 4
model: null
```
```bash
grep -rn "늦게 도착한 턴" test src scripts
# test/aiActivityLogIndex.test.ts:199:      instruction: "늦게 도착한 턴",
grep -rln "여기 물 채워줘" test src scripts
# test/aiSelectionChipScope.quarantine.test.ts
```

### E7 — 저장소 헬퍼 스크립트

```bash
npm run db:verify-ai
```
```
> node scripts/check-supabase-schema.mjs --verify-ai
Supabase schema check failed: Unregistered migrations: 20260830000000_ai_activity_payload_index.sql, 20260907000000_spatial_authoring_cas.sql
```
→ **실행 불가.** 이 조사의 수치는 이 스크립트를 쓰지 않았다.

```bash
npm run ai:log -- 5 --issues --remote
```
→ 동작한다. 디스크 미러는 비어 있고(`output/ai-activity/` 없음), 원격 폴백(`ai_analysis_runs`)이
2026-08-16 · 2026-08-23 자 지시문을 돌려준다 — 1.3절 (1) 의 prune 구멍을 뒷받침한다. 예:
```
"instruction": "npc 다 지우고 집도 새로 1개 지어줘",  "created_at": "2026-08-16T14:33:04.790157+00:00"
"instruction": "현재 맵의 등장인물과 장소를 활용한 짧은 퀘스트를 만들어줘. 시작 조건과 완료 보상도 포함해줘.",
   "created_at": "2026-08-23T16:56:21.555755+00:00"
```

### E8 — `ai_conversations` (사용자 발화 원문)

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/ai_conversations?select=conversation_id,project_id,created_at,entries_json&project_id=not.in.(rpg-zzu-house-template-gallery,rpg-zzu-dungeon-example)&order=created_at.desc&limit=200" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" -H "Accept-Profile: rpg_zzu"
```
```
conversations 53  window 2026-08-24T09:16:00Z .. 2026-09-14T09:03:09Z
entry kinds { user: 214, status: 7096, assistant: 2332, tool: 3357 }
사용자 눈에 보인 상위 실패 문구:
  19  "일시 오류 — 재시도 중(1/3)"        (src/ai/assistantSession.ts:4823)
  18  "일시 오류 — 재시도 중(2/3)"
  16  "일시 오류 — 재시도 중(3/3)"
   3  "턴 중단(error): 서버 오류(500): 공급자 측 문제입니다. … {\"error\":\"openai-codex: token refresh…"
   3  "턴 중단(error): 서버 오류(500): … {\"error\":\"No API key for provider: go…"
   2  "WorkPlan 자동 완료 차단: 플레이어 시작 위치 설정 — 완성도 경고 1건 — ⚠ 미이행: 실제 변경이 없습니다(체인지셋 0건)."
   2  "verification:unmet run_lint — run_lint: lint 오류 4건"
   1  "독립 검수 미승인: 적 '녹슨 해골 병사(enemy_ai_1)'의 … 요청 사항대로 정확히 반영되었으며 …"
   1  "프로젝트 기록 준비 실패: independent-review-stale-baseline: regenerate from the current project befo…"
```
(정확히 53건 — `Prefer: count=exact` 로 확인: `Content-Range: 0-0/53`.)

### E9 — 코드 좌표 (전부 `grep -rn` 으로 확인)

| 서명 | 파일:줄 |
|---|---|
| `턴 실패: ${stoppedReason ?? "unknown"}` | `src/ai/activityLog.ts:254` |
| 환경 구분 없는 원격 기록 | `src/ai/activityLog.ts:489-515` |
| `stoppedReason: … ?? "ownership-lost"` | `src/editor/panels/aiTurnRunner.ts:547` (기록 블록 538-553) |
| `스펙 게이트: '…' 차단` | `src/ai/assistantSession.ts:1653` |
| `밑그림 검증 실패(N회)` | `src/ai/assistantSession.ts:1598` (메시지 조립 1570-1600) |
| `SimplePage 인자 오류` | `src/editor/tools/eventCompile.ts:233`, `:240` |
| `필수 successTools 중 … 성공 기록이 없습니다` | `src/ai/workPlan.ts:964`, `:976` |
| `완료할 항목 id가 없습니다.` | `src/ai/assistantSession.ts:2896` |
| `라벨/설명이 "…" 인 타일을 찾지 못했습니다` | `src/project/tileVocabulary.ts:377` |
| `independent-review-malformed-json` | `src/ai/independentReview.ts:385` (파서 376-389) |
| `Google Gemini 로그인이 필요합니다(401)` | `src/ai/llmClient.ts:358` |
| `네트워크 오류: LLM 엔드포인트에 연결할 수 없습니다` | `src/ai/llmClient.ts:929` |
| 하드코딩 상대 baseUrl `"/v1"` | `src/ai/llmClient.ts:89-91` → `src/ai/chatgptOAuthClient.ts:10-13` |
| SSE 인데 `.json()` 을 부르는 분기 | `src/ai/llmClient.ts:947-951` (스트림 강등 891-896) |
| `Pi 에이전트 실행 실패: N` / `… 결과를 돌려주지 않았습니다` | `src/ai/piAgent/client.ts:36` / `:56` |
| `planner:error …` | `src/ai/assistantSession.ts:2565` |
| `pi:팀장 … N턴/N툴콜` (실패 툴콜로 기록) | `src/ai/piAgent/activityLog.ts:88-101` |
| `일시 오류 — 재시도 중(n/3)` | `src/ai/assistantSession.ts:4823` |

### E10 — 커밋 이력 (`git log -S` + `git merge-base --is-ancestor <sha> origin/main`)

```
21d27af02 2026-07-07 feat(tools): place_npc SimplePage 관용 파싱 + 모델 친화 에러 (C.2-4)      IN origin/main
d3078567f 2026-08-30 feat(ai): 채팅 기록을 빠짐없이 남긴다 — 턴·툴·프론트 액션 전부              IN origin/main
ac6a4dd31 2026-09-05 fix(ai): normalize NPC text aliases before command validation          IN origin/main
986db8d94 2026-09-06 fix(ai): align NPC command schemas and preserve reward repairs         IN origin/main
6ed186d48 2026-09-06 fix(ai): return safe corrections for malformed NPC arguments           IN origin/main
5cab5e2c1 2026-09-07 feat(ai): independently review and repair drafts before applying       IN origin/main
f05b4a92d 2026-09-09 fix(review): spend every cheap rung before refusing to review a draft   IN origin/main
6885f37f1 2026-09-09 feat(ai): add /pi chat command that applies Pi agent results …          IN origin/main
8c86d9714 2026-09-14 fix(pi): 코드가 바뀌면 워커를 갈아 끼우고, 팀 경로 병합을 회귀 테스트로 잡는다   NOT in origin/main
```

### E11 — 저장소 로컬 증거와의 교차 확인

```bash
for s in "ownership-lost" "스펙 게이트" "SimplePage 인자 오류" "independent-review-malformed-json" "Failed to parse URL from /v1"; do
  printf "%-36s " "$s"; grep -rl "$s" .omo/evidence verify-shots 2>/dev/null | wc -l; done
```
```
ownership-lost                       0
스펙 게이트                            29
SimplePage 인자 오류                    3
independent-review-malformed-json     2
Failed to parse URL from /v1          2
```
`.omo/evidence/integration-st01a08238/conflict-tests-initial.log:79` 에 그대로 남아 있다:
```
→ 독립 검수 미승인: independent-review-malformed-json: expected 'error' to be 'final'
```
→ F6 는 **테스트에서도 이미 빨간불로 관측된 적이 있다**. 반대로 `ownership-lost` 는 로컬 증거에 0건이다(F7 판정과 일치).

---

## 5. 미검증으로 남긴 것

- `Unexpected token 'd', "data: {"ch"… is not valid JSON` 의 생산지를 `src/ai/llmClient.ts:947-951` 로
  지목한 것은 **코드 정황 추론**이다. 라이브 재현(서버 기동)은 이 조사의 제약상 하지 않았다.
- 실사용자 프로젝트 58개 중 어느 것이 같은 사람의 것인지, 한 사람이 몇 번 재시도했는지는
  데이터에 사용자 식별자가 없어 말할 수 없다.
- 2026-08-24 이전 구간(1.3절 (1))은 이 보고서의 어떤 수치에도 반영되지 않았다.
