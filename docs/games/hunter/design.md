# 「사냥꾼 계약」 설계 문서 (v1, 2026-10-30)

> 다음 데모 게임의 설계 정본이다. 이 문서는 무엇을 지을지만 정한다. 아직 짓지 않았다(맵·이벤트·굽기 없음).
> 근거는 이 문서를 쓴 브랜치 `agent/game-hunter`(origin/main `1a93552f80` 기준) 소스 실측이다. 파일·도구 이름은 그 커밋에서 확인했다.
> 후보 장소 그림은 `scripts/content/hunter-candidates.mts`(실제 도구로 후보 맵을 짓고 PNG 로 렌더, 저장·굽기 없음)로 뽑았다.
> 사람이 읽을 요약 페이지: http://mdc-server:18301/game-hunter-design.html

목차
1. 컨셉 한 쪽과 문체 지침
2. 세계와 장소 (맵마다 쓸 기존 칩셋·키트·도구)
3. 비트 목록 (본편 줄기 + 계약 9개)
4. 시스템: 기존 엔진 기능 대응과 엔진 공백
5. 제작 계획 (작업자 둘, 이정표, QA)
6. 위험과 먼저 자를 것
부록 A. 플래그·변수 이름표 · 부록 B. 등장인물 칩·흉상 · 부록 C. 적 목록

---

## 1. 컨셉

### 1.1 한 쪽 요약

- **장르:** 탑뷰 16px 도트 RPG. 측면 전투, 혼자 다니는 괴물 사냥꾼. 위쳐 1·2 의 계약 고리를 작게 줄였다.
- **분량:** 60~90분. 엔딩 셋(본편 선택 둘 × 누적 평판 하나로 결말 문단이 갈린다).
- **주인공:** 도르반. 마흔 줄의 떠돌이 사냥꾼. 길드에서 쫓겨나 이름 없는 계약만 받는다. 칩 Actor2#4 「갈색 머리 중년 전사」.
- **줄기(본편):** 도제 **리스크**가 석 달 전 「회색봉」 폐성 쪽 계약을 혼자 받아 나가 돌아오지 않았다. 도르반은 리스크가 남긴 계약서 사본 세 장을 따라간다. 세 장은 세 지역의 주 계약이다. 셋을 다 풀면 리스크가 왜 사라졌는지, 누가 그 계약을 낸 사람인지가 드러난다.
- **세 지역(처음부터 다 열림):**
  1. **갈대늪** — 늪 위 수상 마을. 물에 빠진 시체가 올라온다(익사귀). 마을은 굶고 있고, 늪의 무엇과 거래를 해 왔다.
  2. **버들항** — 성벽 두른 항구 도시. 하수도에서 사람이 사라진다. 경비대·상인 조합·밀수꾼이 서로를 탓한다.
  3. **회색봉** — 산 위의 무너진 성채 마을. 옛 성주의 망령과 납골당. 리스크가 마지막으로 간 곳.
- **고리(계약 하나):** 게시판에서 계약을 뗀다 → 의뢰인에게 조건을 듣는다 → 현장에서 흔적을 따라가고 증인을 캔다 → 괴물 도감 항목이 열린다(약점) → 칼 기름·물약·시간대를 준비한다 → 싸운다 → 끝에 **도덕 선택**이 있다 → 그 선택이 **다른 지역**에서 돌아온다.
- **분량 배분:** 주 계약 3(각 12~16분) + 곁 계약 6(각 4~7분) + 줄기 장면(도입·사이·결말 10~14분).
- **차별점:** OPRN 데모 중 처음으로 「조사 → 준비 → 전투 → 선택 → 후과」 고리를 엔진 기능으로 만든다. 이 고리에 필요한 엔진 기능(흔적 감각·괴물 도감·게시판·칼 기름·후과 결말)은 데모 땜질이 아니라 main PR 로 짓는다. 다음 게임들이 그대로 쓰게 하는 것이 목적이다(메모리 「데모 목표 = 엔진 개선」).

### 1.2 문체 지침

**한다**
- 짧은 평서문. 사람이 하는 일과 값(삯·은화·날수·시체 수)을 말한다. 감정은 행동으로만 보인다.
- 반말과 하오체가 섞인 거친 말씨. 귀족·관리는 일부러 딱딱하게. 사투리는 늪 마을 사람 한두 명만.
- 누구나 무언가를 숨기거나 값을 깎는다. 선한 쪽이 따로 없다. 괴물에게도 이유가 있고, 사람에게도 이유가 있다.
- 폭력과 죽음은 담담하게. 자세한 묘사 대신 결과만(「다리가 하나 없었다」).
- 선택지 문구는 행동으로 쓴다(「삯을 받고 넘긴다」「놓아준다」「베어 버린다」). 도덕 점수를 보여 주지 않는다.
- 후과는 몇 분 뒤 다른 지역에서, 대개 낯선 사람 입으로 돌아온다. 「당신의 선택이…」 같은 안내문은 없다.

**절대 안 한다**
- 개그·말장난·과장된 표정 아이콘(땀방울·하트·음표)·귀여운 동물 동료·「~냥」 말투. 사용자가 다른 데모를 「너무 유치함」으로 반려했다.
- 착한 쪽 나쁜 쪽을 알려 주는 해설, 업적 팝업, 「정의롭게 행동했다!」 류 보상 문구.
- 영웅 서사(「선택받은 자」「세계를 구할」). 도르반은 돈과 도제를 찾는 사람이다.
- 모델 티: 「~라는 점」「결국 중요한 건」「~가 아니라 ~다」 재정의, 장면 끝 한 줄 교훈. 쓴 뒤 `lint_dialogue` / `node scripts/content/lint-game-text.mts` 로 검사한다(dialogue-polish 스킬).
- 원작 고유명사(위쳐·게롤트·노비그라드·은 검 이름 등). 길드·기름·괴물 이름은 이 세계 낱말로 짓는다.

**목표 말씨 다섯 줄** (lint-game-text fiction 프로필 적중 0, 2026-10-30)

```
의뢰인(늪 촌장):  삯은 머리를 가져오면 준다. 반은 지금. 나머지는 냄새가 빠지고 나서.
늙은 뱃사공:      물에 빠진 놈들은 셋째 날 밤에 올라온다. 그 전에 오면 헛걸음이고, 그 뒤에 오면 장례가 늘지.
증인(어부의 아내): 그 애가 먼저 문을 열었어요. 나는 닫으라고 했어요. 그 뒤로는 못 봤어요.
도르반(혼잣말):    은을 바르고 들어가. 쇠는 그놈 가죽에서 미끄러진다.
항구 경비병:       네가 살려 준 그 여자 말이야. 지난달에 항구에서 애 둘을 물에 밀어 넣었다더라.
```

---

## 2. 세계와 장소

### 2.1 제약 (AGENTS.md 와 실측)

- **EasyRPG 계열 칩셋은 새 맵에 못 쓴다**(`src/project/retiredEasyRpgTilesets.ts`). 야외는 `beodeul_city`(oprn-atlas), 실내는 `atlas_biome_interior`(손 도트 v5, 예외 허용)만 쓴다.
  `gothic_manor` 는 묘지·지하실 그림이 있지만 계열이 달라(oprn-gothic) 칩셋 계열 규칙상 섞으면 사용자 승인이 필요하다. 이 데모는 쓰지 않는다.
- **생성 인물 금지:** 사람은 EasyRPG RTP 걷기 칩(Actor1~4·People1~5, 원본 유지 자산)과 공용 흉상만 쓴다.
- **등록 장소 없음:** `PLACE_REFERENCES` 67곳은 전부 조선·jp_city·현대·마법 학교다. `REGION_REFERENCES` 는 비었다(2026-10-07 저작권 정리). 그래서 이 데모의 맵은 **전부 조수 도구로 짓는다**: `author_beodeul_town`, `author_dungeon`, `build_hand_interior_room`, `derive_map_variant`, `edit_world_terrain`. 폴른 스타 2막·isekai-godding 과 같은 방식이다.
- **새 그림은 object-gate 를 통과해야 한다.** 현재 관문은 미보정이고 영수증이 0장이다. 그러니 새 그림이 필요한 계획은 곧 일정 위험이다. 이 설계는 새 그림을 최소화한다(2.6).

### 2.2 세계 지도

- 도구: `edit_world_terrain({newMapId:"hc_world", theme:"fantasy", base:"shared-v9", ops:[…]})` → `stamp_worldmap_icon` → `author_dungeon({entrance:{fromMapId:"hc_world", place}})`/`link_world_entrance`.
  `base:"generate"` 는 다섯 막 31곳 여정을 자동으로 맞추므로 지역 셋인 이 게임에는 무겁다. 기존 손 대륙(shared-v9) 한 귀퉁이를 잘라 쓰는 쪽이 싸다. 첫 빌드는 2분 남짓 걸리고 `npm run worldmap-kit:sync` 가 먼저 필요하다.
- 크기: 48×36 안쪽. 남서쪽 늪(바닥 재료 「늪」「고사목 숲」「독수」), 동쪽 바닷가 항구, 북쪽 산줄기 위 폐성. 세 지역 사이 길 두 갈래와 다리 하나.
- 아이콘(사람이 고른 `worldmap-selected` 시트, 모두 있음):

| 장소 | 아이콘 id | 크기 |
|---|---|---|
| 갈대늪 | `fantasy/stilt_village` | 2×2 |
| 버들항 | `fantasy/city_harbor` | 5×4 |
| 회색봉 폐성 | `fantasy/castle_dark` (또는 `ruined_city` 4×3) | 3×3 |
| 성 아래 납골당 | `fantasy/crypt` | 2×2 |
| 늑대 굴 | `fantasy/cave_rock` | 2×2 |
| 산길 초소 | `fantasy/pass_fortress` | 3×3 |
| 늪 마녀의 탑(곁 계약) | `fantasy/witch_tower` | 1×2 |
| 선돌(곁 계약) | `fantasy/stone_circle` | 2×2 |

- 빠른 이동: 쓰지 않는다. 지역 사이 이동은 세계 지도를 걷는다(조수·시간이 흐르는 것이 고리의 일부). 세계 지도 위 무작위 조우도 끈다(`set_encounter_table` off). 세계 지도에는 낮밤 색만 입힌다.

### 2.3 맵 목록

맵 id 접두사는 `hc_`. 「도구」 열은 그 맵을 짓는 조수 도구와 주요 인자다. 「확인」 열의 ✓ 는 2026-10-30 `hunter-candidates.mts` 로 실제 지어 렌더해 본 것이다.

| # | 맵 | 칩셋 | 도구·인자 | 크기 | 확인 |
|---|---|---|---|---|---|
| W | 세계 지도 | worldmap-kit fantasy | `edit_world_terrain` + 아이콘 8 | 48×36 | 도구만 확인 |
| 1 | 갈대늪 마을 | beodeul_city | `author_beodeul_town{theme:"swamp", seed:7}` — 늪 물·널판 길·수상 가옥 `bd-pick-swamp-stilt-*` | 56×44 | ✓ |
| 2 | 늪 깊은 곳(익사귀 둥지) | beodeul_city | `author_dungeon{type:"swamp", size:"medium"}` — 늪물 사이 둔덕·널판 길 | 35×55 | ✓ |
| 3 | 마녀의 탑 1층(곁) | atlas_biome_interior | `build_hand_interior_room{program:"tower"}` | ~20×16 | 미확인 |
| 4 | 늪 여관 겸 촌장 집 | atlas_biome_interior | `build_hand_interior_room{program:"tavern"}` | ~24×16 | 미확인 |
| 5 | 버들항 도심 | beodeul_city | `author_beodeul_town{theme:"city", seed:11}` — 성벽·블록·성당 | 62×49 | ✓ |
| 6 | 버들항 부두 | beodeul_city | `author_beodeul_town{theme:"coast", walls:true}` 또는 5번 맵 남쪽 확장 + 키트 `bd-harbour`·`bd-pick-fishing-port-*` | 64×48 | ✓(coast 시안은 농어촌에 가까움, 2.4) |
| 7 | 버들항 하수도 | beodeul_city | `author_dungeon{type:"sewer"}` | 52×52 | ✓ |
| 8 | 젖은 닻 여관 | atlas_biome_interior | `build_hand_interior_room{program:"inn"}` | 30×24 | ✓ |
| 9 | 연금술사 가게 | atlas_biome_interior | `build_hand_interior_room{program:"pharmacy"}` | ~16×12 | 미확인 |
| 10 | 대장간 | atlas_biome_interior | `build_hand_interior_room{program:"smithy"}` | 26×11 | ✓ |
| 11 | 경비대 초소·감방 | atlas_biome_interior | `build_hand_interior_room{program:"dungeon"}`(감방) | ~22×11 | 미확인 |
| 12 | 상인 조합 저택 | atlas_biome_interior | `build_hand_interior_room{program:"manor"}` | ~25×20 | 미확인 |
| 13 | 산길(늪↔폐성, 항↔폐성) | beodeul_city | `author_forest_route{side, moods}` ×2 + `bd-pick-mountain-pass-*` | 각 ~40×30 | 미확인(isekai 가 같은 도구 사용) |
| 14 | 회색봉 성채 마을(무너진) | beodeul_city | `author_beodeul_town{theme:"river", terrain:"terraces", roofs:"slate", walls:true, water:"none"}` → `derive_map_variant{look:"ruin"}` | 56×53 | ✓ |
| 15 | 폐성 대전 | atlas_biome_interior | `build_hand_interior_room{program:"throne"}` | 47×36 | ✓ |
| 16 | 폐성 하층 | beodeul_city | `author_dungeon{type:"castle", size:"medium"}` | 40×27 | ✓ |
| 17 | 성 아래 납골당 | beodeul_city | `author_dungeon{type:"catacomb", size:"medium", gimmick:lever}` | 38×28 | ✓ |
| 18 | 늑대 굴(곁) | beodeul_city | `author_dungeon{type:"cave", lair:true, size:"small"}` | 32×37 | ✓ |
| 19 | 회색봉 예배당 지하(결말) | atlas_biome_interior | `build_hand_interior_room{program:"chapel"}` | ~20×16 | 미확인 |

합계 20맵(세계 지도 포함). 폴른 스타 1막 41맵의 절반이다.

### 2.4 렌더해 보고 안 것

- **늪 마을**(`theme:"swamp"`)은 그대로 쓸 만하다. 수상 가옥·널판 길·고목이 다 있다. 마른 둔덕 북쪽이 비어 보이므로 게시판·장례 마당·통발 소품을 그 자리에 놓는다(빈 바닥은 메우지 말고 줄인다, 메모리 「맵은 목적으로 깐다」).
- **늪 던전**(`type:"swamp"`) 수관은 숲 것을 빌렸다(늪 수관은 검수 반려로 보류, `profiles.ts:168`). 늪답게 보이는 것은 물과 둔덕뿐이다. 첫 판은 이대로 가고, 안개(`setWeather fog`)와 어두운 색조로 숲 수관을 덜 보이게 한다.
- **버들항**: `theme:"coast"` 는 밭이 있는 포구 마을이 나와 「항구 도시」로 읽히지 않는다. `theme:"city"` 가 성벽 두른 블록 도시라 도심으로 쓴다. 부두는 도심 남쪽 가장자리에 `bd-harbour`(63×38) 키트를 직접 찍어 붙이는 쪽을 시험한다(작업자 W 의 첫 시험 항목).
- **무너진 성채 마을**: 성채 마을을 짓고 `look:"ruin"` 을 입히면 지붕 무너짐·잔해·풀이 깔린다. 폐성 「외관」 키트가 따로 없다는 공백을 이걸로 메운다. 성 본채는 마을 북쪽 높은 단의 `bd-castle`(33×33, 멀쩡함)에 ruin 변형을 같이 입힌다.
- **실내**(여관·대장간·대전)는 손 도트 v5 그대로 쓸 만하다. 다만 밝고 아늑하다. 회색봉 대전은 `setLighting`·어두운 색조·`removeEvents` 로 가구를 덜어 「버려진 곳」으로 만든다.

### 2.5 사람·괴물·소리

- **주인공·조연 칩**(EasyRPG RTP, 공용 흉상 대응 있음 — `src/assets/sharedCharacterGraphics.json`):
  - 도르반: Actor2#4 「갈색 머리 중년 전사」.
  - 리스크(도제, 회상·결말에만): Actor2#2 「녹색 망토 레인저」.
  - 그 밖 의뢰인·증인: People1~5 의 어른 칩(아이 칩은 쓰지 않는다), 경비병은 `helmet-guard` 흉상이 있는 칩.
  - 흉상: 공용 76세트 중 어른·노인·경비·수녀·학자. 흉상이 없는 칩은 얼굴 없이 이름만 띄운다.
- **괴물**(140종 측면 전투 도트 `public/assets/generated/pixel-enemies/`, 기본 DB 적 레코드 있음): 부록 C. 필드 심볼은 `place_field_enemy` 가 전투 도트에서 걷기 칩을 런타임에 뽑는다(`src/player/fieldFoeSprite.ts`, 2026-10-24). 늑대·거미도 이제 필드에 선다(옛 거절 문구는 전투 그림 자체가 없을 때만 남았다).
- **전투 배경**: 지금 있는 것은 평원·숲·동굴·설원·사막 다섯 가지뿐이다. 늪·성·도시가 없다. 전투 배경은 생성형 허용 하네스(`battle-backdrop`, 메모리 「전투 배경 생성형 허용」)로 늪·하수도·폐성·납골당 넷을 만든다(2.6).
- **음악**(CC0 카탈로그, mp3, 존재 확인):
  - 늪 `cc0-bgm-rtp-swm-001` 「반딧불 습지」.
  - 항구 `cc0-bgm-rtp-hbr-001` 「등불 항구의 물결」(밤 `cc0-bgm-rtp-ftw-012`).
  - 폐성 `cc0-bgm-rtp-rui-001` 「가라앉은 천문대」.
  - 던전 `cc0-bgm-rtp-dng-001`.
  - 성벽 `cc0-bgm-rtp-wch-001`.
  - 산길 야영 `cc0-bgm-rtp-nfs-001`.
  - 일반 전투 `cc0-bgm-rtp-btl-001`, 보스 `cc0-bgm-rtp-btl-002` 「재의 왕관」.
  - 회상·결말 `cc0-bgm-rtp-emo-001`.
  - EasyRPG `.mid` 는 브라우저에서 무음이라 쓰지 않는다.

### 2.6 새로 그려야 하는 것

| 그림 | 왜 필요한가 | 경로 | 없을 때 대안 |
|---|---|---|---|
| 전투 배경 넷(늪·하수도·폐성 대전·납골당) | 지금 배경 다섯 가지에 없다. 하수도·납골당은 동굴 배경으로 자동 대체되고, 늪은 숲으로 간다 | `battle-backdrop` 하네스(생성+도트화, 사람/감독 선택). object-gate 대상 아님 | 동굴·숲 배경 + `backdropLayers` 안개 |
| 늪 노파(곁 계약 「물의 할미」 보스) 전투 도트 | 140종에 마녀·할미가 없다 | 몬스터 도트는 생성→격자 도트화 v10 예외 경로. 사람 선택 | `banshee-wail`(울부짖는 여인)을 이름만 바꿔 쓴다 ← **기본안** |
| 늑대인간 | 140종에 없다 | 같음 | 곁 계약을 「늙은 늑대 무리」로 바꾸고 `wolf-dire` 를 쓴다 ← **기본안** |
| 게시판 그림(야외) | 실내 v5 에는 `quest board`·`notice board`·`wanted poster` 가 있으나 버들항 야외 키트에는 게시판이 없다 | 손 도트 + object-gate | 게시판을 여관·초소 **실내 벽**에 둔다 ← **기본안**(새 그림 0) |

결론: **기본안대로면 새 타일·기물 그림은 0장**이다. 새로 만드는 것은 하네스로 받는 전투 배경 넷뿐이다. object-gate 를 거쳐야 하는 그림이 없어 일정에서 가장 큰 미지수가 빠진다.

---

## 3. 비트 목록

표기:
- 시간은 처음 하는 사람이 대사를 읽는 속도 기준이다.
- 「플래그」는 부록 A 의 접두 `hc_` 를 뺀 이름이다.
- 「후과」는 그 선택이 어디서 돌아오는지를 적는다.

### 3.0 줄기 — 「도제의 계약서」 (도입 4분 · 사이 3×2분 · 결말 6분)

| 비트 | 계기 | 장소 | 내용 | 선택 | 플래그 |
|---|---|---|---|---|---|
| P0 오프닝 | 새 게임 | 세계 지도 위 글 3컷 + 산길 야영 | 비 오는 산길. 도르반이 리스크의 빈 침낭과 계약서 사본 세 장을 본다. 「셋째 장 의뢰인 이름은 지워져 있었다.」 | 없음 | `stage=1`, `contract_copies=3` |
| P1 첫 걸음 | 오프닝 끝 | 세계 지도 갈림길 | 세 지역 아이콘이 다 보인다. 어디로 가도 된다. 일지에 사본 세 장이 적힌다(일지 「계약」 쪽) | 없음 | 일지 3줄 |
| P2 사이 장면 ① | 주 계약 첫 번째 완료 | 그 지역 여관 | 리스크가 그 지역에 남긴 흔적(외상 장부·맡긴 칼·편지 반쪽) | 리스크의 빚을 갚는다/모른 척한다 | `risk_debt_paid` |
| P3 사이 장면 ② | 주 계약 두 번째 완료 | 그 지역 | 세 계약의 공통 의뢰인이 **버들항 상인 조합의 오스벤**임이 드러난다(계약서 봉랍 대조) | 없음 | `knows_osben` |
| P4 결말 진입 | 주 계약 셋 완료 | 회색봉 예배당 지하 | 리스크는 살아 있다. 망령 성주와 계약해 납골당을 지키고 있다. 오스벤이 계약을 낸 이유는 성 지하 은광맥이다. 세 괴물은 사람을 쫓아내려고 일부러 풀어 둔 것이다 | ① 리스크를 데려간다(성주와 싸움) ② 리스크를 남겨 두고 오스벤을 고발한다 ③ 오스벤에게 광맥 지도를 판다 | `end_choice` 1·2·3 |
| P5 결말 | 선택 직후 | 각 지역 | 선택 + 누적 후과로 결말 문단이 갈린다(3.4) | | `ending` |

### 3.1 주 계약 A — 「셋째 날 밤에 오는 것」 (갈대늪, 14분)

- **게시판:** 늪 여관 벽. 「익사자 처리. 머리 하나에 은화 30.」 의뢰인은 촌장 마르타(People 노년 여성).
- **조사**
  1. 늙은 뱃사공에게서 셋째 날 밤 규칙을 듣는다(시간대 단서).
  2. 장례 마당에서 시체를 살핀다. 물린 자국이 사람 이빨이다.
  3. 흔적 감각(4.2 공백 A)으로 마당에서 늪 깊은 곳까지 질질 끈 자국을 따라간다.
  4. 어부의 아내를 캔다. 딸이 밤마다 물가에 음식을 놓는다.
- **도감:** 「익사귀」(전투 도트 `ghoul-grave`). 약점은 불·은, 밤에만 물에서 나온다. 단서 셋 중 둘을 찾으면 항목이 열린다.
- **준비:** 연금술사에게 「불씨 기름」을 사거나 만든다. 밤까지 기다린다(4.2 공백 E 명상).
- **전투:** 늪 깊은 곳에서 밤에만 필드 적 익사귀 셋이 나온다(시간 조건). 보스는 「물에 잠긴 어미」(`ghoul-grave` 큰 판, 다른 이름).
- **진실:** 어미는 마르타가 굶주린 해에 물에 버린 아이들의 어미다. 익사귀는 그 아이들이다. 마을은 해마다 「제물」로 떠돌이를 늪에 보내 왔다.
- **선택**
  - ① 어미를 베고 삯을 받는다.
  - ② 어미를 놓아주고 촌장의 비밀을 마을에 알린다.
  - ③ 삯을 두 배로 받고 입을 다문다.
- **플래그:** `a_done`, `a_choice`(1~3).
- **후과**
  - ②를 고르면 버들항 부두에 늪에서 도망 온 피난민 가족이 생긴다. 곁 계약 S4 의 증인이 된다.
  - ③을 고르면 회색봉 결말에서 마르타가 보낸 「제물」 떠돌이가 성 아래서 시체로 발견된다.
  - ①이면 늪 마을 사람들이 도르반을 반긴다(상점 값 -10%).

### 3.2 주 계약 B — 「하수도의 세 번째 입」 (버들항, 16분)

- **게시판:** 경비대 초소. 「하수도 실종 사건. 원인 제거. 은화 50. 경비대장 브란.」
- **조사**
  1. 실종자 명단을 본다. 전부 밀수꾼이다.
  2. 상인 조합 서기와 경비대장의 말이 어긋난다. 탐문 단서 둘을 맞대야 다음 증인이 열린다.
  3. 하수도 입구 진흙에 세 갈래 발자국이 있다(흔적 감각).
  4. 감방에 갇힌 밀수꾼 소녀를 만난다. 거대 쥐 말고 무언가가 「말을 했다」고 한다.
- **도감:** 「하수구 여왕」. 거대 쥐 무리(`rat-giant`)의 우두머리로 사람 말을 흉내 낸다. 보스 도트는 `ooze-black` 또는 `slime-king` 큰 판, 다른 이름. 약점은 불, 독에 강하다.
- **준비:** 해독 물약. 대장장이에게 칼을 갈면 공격이 오른다.
- **전투:** 하수도 3방. 쥐 필드 적, 레버 관문(`author_dungeon` gimmick), 여왕 보스.
- **진실:** 경비대장 브란이 밀수꾼을 하수도로 몰아넣어 여왕에게 먹였다. 여왕이 있는 한 밀수 길이 막히기 때문이다. 상인 조합의 오스벤이 그 일에 돈을 댔다.
- **선택**
  - ① 브란을 고발한다. 감방 소녀가 증인이 된다.
  - ② 브란에게서 입막음 값을 받는다.
  - ③ 소녀를 몰래 풀어 준다(삯을 잃는다).
- **플래그:** `b_done`, `b_choice`.
- **후과**
  - ②를 고르면 회색봉 산길 초소에서 브란의 부하들이 도르반을 막는다. 전투가 하나 더 붙고, 피할 수 있다.
  - ③을 고르면 소녀가 회색봉 결말에 나타나 납골당 레버 위치를 알려 준다. 퍼즐을 건너뛸 수 있다.
  - ①이면 버들항 경비대가 바뀌어 곁 계약 S5 가 열린다.

### 3.3 주 계약 C — 「회색봉의 주인」 (회색봉, 15분)

- **게시판:** 성채 마을 무너진 교회 문짝. 「성주의 망령. 퇴치 시 은화 80. 재건 위원회.」 위원회는 오스벤이 낸 것이다.
- **조사**
  1. 마을에 남은 사람은 셋뿐이다(늙은 하인, 순례자, 도둑). 각자 성주에 대한 말이 다르다.
  2. 대전에서 성주의 일기를 읽는다(편지 보기, `place_examine_hotspots{readable}`).
  3. 하인 이야기를 듣고 밤 시간에 대전에서 망령의 흔적을 본다(흔적 감각은 밤에만 보이는 흔적).
- **도감:** 「성주의 망령」(`revenant-vengeful`). 약점은 성수(빛), 쇠는 반감. 잡몹으로 `skeleton-knight`, `wraith-dark`.
- **준비:** 회색봉 순례자에게서 성수를 산다. 은 칼은 폐성 하층 상자에 있다.
- **전투:** 폐성 하층 → 납골당(레버) → 성주 보스.
- **진실:** 성주는 광맥을 오스벤에게 넘기기를 거부하다 죽었다. 망령은 성 아래를 지킨다. 리스크도 같은 이유로 성주 편에 섰다(→ P4).
- **선택**
  - ① 성주를 쓰러뜨린다.
  - ② 성주와 계약한다. 리스크가 하던 일을 넘겨받으면 결말 선택지 ②가 강해진다.
- **플래그:** `c_done`, `c_choice`.
- **후과:** P4 대사가 갈린다. 성주를 쓰러뜨렸으면 리스크가 도르반을 적으로 본다.

### 3.4 결말 갈래

| 결말 | 조건 | 내용 |
|---|---|---|
| 「셋째 장의 이름」 | `end_choice=2` 이고 후과 점수 2 이상(A②·B①·B③·리스크 빚 갚음 중 둘 이상) | 오스벤 고발이 받아들여진다. 리스크는 회색봉에 남는다. 도르반은 다음 계약을 찾아 떠난다 |
| 「도제」 | `end_choice=1` | 성주와 싸워 리스크를 데려간다. 광맥은 오스벤 손에 들어간다. 산길에서 리스크가 도르반을 떠난다 |
| 「은값」 | `end_choice=3`, 또는 2 인데 후과 점수 1 이하 | 지도를 팔거나 고발이 묻힌다. 도르반은 은화를 셈한다. 마지막 줄은 지난 계약의 후과(늪·항구) 한 줄씩 |

결말 문단 안에서 A·B·C 선택마다 한 줄씩 늪·항구·회색봉 소식이 붙는다. 이것이 「선택 요약」 엔진 공백 G 의 쓰임새다.

### 3.5 곁 계약 6개

| # | 이름 | 지역 | 계기 | 조사·준비 | 적 | 선택과 후과 | 시간 |
|---|---|---|---|---|---|---|---|
| S1 | 도깨비불 | 갈대늪 | 늪 여관 게시판 | 밤에만 보이는 불빛을 셋 쫓는다 | `wisp-blue` ×3 | 마지막 불은 길 잃은 아이를 늪 깊은 곳으로 데려가려던 것이다. 아이를 데려다준다/불을 끈다. 데려다주면 S2 의뢰인이 그 아이의 아버지가 된다 | 4분 |
| S2 | 물의 할미 | 갈대늪 → 마녀의 탑 | 촌장 집 뒤 소문 | 탑 1층 단서 둘 | `banshee-wail`(「물의 할미」) | 할미는 마을에 약초를 대 주던 사람이다. 베면 연금술사 물약 값이 오르고, 흥정하면 「늪 해독제」 제법을 얻는다 | 7분 |
| S3 | 늙은 늑대들 | 산길(늪↔회색봉) → 늑대 굴 | 산길 표지판 | 발자국 감각, 낮이 유리 | `wolf-dire` ×2, `wolf-grey` | 굴 안에 사냥꾼의 덫이 가득하다. 늑대가 아니라 덫 놓은 밀렵꾼이 진짜 문제다. 밀렵꾼을 내쫓으면 B 의 경비대장이 이 밀렵꾼과 연결돼 있다는 대사가 붙는다 | 6분 |
| S4 | 부두의 유령 아이 | 버들항 부두 | 젖은 닻 여관 게시판 | 피난민 증인(A② 때만) 또는 부두 일꾼 | `ghost-pale` | 아이는 A 의 늪에서 흘러온 익사자다. A②면 이름을 알아 영을 보낸다(보상 도감 항목). 모르면 베어야 한다 | 5분 |
| S5 | 성당 지붕의 그리핀 | 버들항 도심 | B① 뒤 새 경비대가 게시 | 성당 종지기 증언, 낮에만 나온다 | `griffin-sky`(96px) | 그리핀은 둥지를 지키는 중이다. 알을 팔면 은화 60, 둥지를 옮기면 그리핀이 회색봉 산길에서 한 번 도와준다(결말 전투 첫 턴 공격) | 6분 |
| S6 | 순례자의 길잡이 | 회색봉 | 순례자 NPC | 납골당 가장자리 묘실 하나 | `zombie-rot`, `skeleton-bone` | 순례자가 찾는 무덤의 주인은 성주에게 죽은 반역자다. 유골을 넘기면 순례자가 성수를 공짜로 준다. 숨기면 C 의 하인 대사가 바뀐다 | 5분 |

곁 계약 합계 33분. 주 계약 45분과 줄기 14분을 더하면 92분이다. 다 하면 90분 안팎이고, 곁 계약을 건너뛰면 60분이다.

### 3.6 「시간대·준비」가 실제로 갈리는 곳

| 계약 | 시간대 | 준비 안 하면 |
|---|---|---|
| A | 밤에만 둥지에 적이 나온다. 낮에는 흔적만 | 불씨 기름 없이 싸우면 어미가 매 턴 회복한다(재생 상태, 불로만 끊긴다) |
| B | 상관없음 | 해독 물약 없이 들어가면 독이 쌓인다. 보스전이 매우 길어진다 |
| C | 밤에만 대전에 망령의 흔적이 보인다. 결말 전투는 아무 때나 | 성수·은 없이 싸우면 쇠 공격은 반감(물리 저항 50%) |
| S1 | 밤에만 | |
| S5 | 낮에만 | |

---

## 4. 시스템

### 4.1 이미 있는 것 (그대로 쓴다)

| 기능 | 엔진 쪽 | 쓰는 도구·명령 |
|---|---|---|
| 계약 일지 | `project.quests`, ESC 「임무」(`src/player/questLog.ts`) | `define_quest`(단계: talk·inspect·kill·reach·choice, `timePhase`), 프리셋 `investigate`·`witness_chain`·`moral_choice`, `lint_quest`·`verify_quest` |
| 단서 조사·읽을거리 | 조사 표식 ▼(`src/player/examineTargets.ts`) | `place_examine_hotspots{lines,itemId,setSwitch,once,readable}` |
| 증인 탐문·증거 대면 | `fork` 조건(switch·variable·item·all/any/not), `presentItem` | `author_mystery_case`/`check_mystery_case`(B 의 서기·경비대장 대질에 그대로) |
| 시간대 | `system.timeSystem`(`src/project/gameTime.ts`), 시간대별 화면 색(`playSceneTime.ts`), 이벤트 페이지 조건 `timePhase`·`hourRange` | `configure_time_system`, `set_npc_schedule`, 명령 `advanceTime`·`setTime`·`sleepUntilMorning`, 여관 `inn.advanceToMorning` |
| 날씨·안개 | `setWeather`(rain·storm·fog) | `set_scene_mood`, `set_lighting_volume` |
| 보이는 필드 적 | 순찰·시선·추격, 전투 도트에서 걷기 칩 파생 | `place_field_enemy`, `tune_field_enemies`, `set_field_detection`, `set_encounter_table` off |
| 약점·저항 | 적 `elementRates`·`damageTypeRates`, 상태 `runtimeEffects`, 약점 발견 기억 `session.knownWeaknesses`(`src/battle/weaknessDiscovery.ts`) | `upsert_enemy`, `upsert_state`, `upsert_skill{elementId}`, `simulate_battle` |
| 측면 전투 1인 | `battleMethodOf` = side | `set_party`, `upsert_actor`, `upsert_class` |
| 보스·연출 | `battleProcessing{canLose, victoryBranch}`, `collapseEffect:"bossSink"` | `author_boss_phases`, `place_battle_blocker`, `script_cutscene` |
| 상점·제작 | `shop{shopType, haggle}`, `craftRecipe`, `applyItemUpgrade` | `set_shop_stock`, `upsert_craft_recipe`, `upsert_item_upgrade` |
| 대화·흉상 | `text{speaker, bustSide}`, 대화 기록 | `set_dialogue_system`, `lint_dialogue`, `set_speaker_voice` |
| 일지 줄 | ESC 「일지」, «Journal Line» | `configure_story_journal` |
| 저장·게임오버·엔딩 | 3칸 저장, `gameOver`, `EndingDef` | `place_savepoint`, `define_ending` |
| 던전 | 버들항 어댑터 14종 | `author_dungeon` |

### 4.2 엔진 공백

크기는 S(반나절~1일), M(2~3일), L(4~6일)로 적는다. 런타임 + 편집기 + 조수 도구 + 문서(`openwiki`)까지 한 PR 기준이다. 모두 **일반 기능**으로 짓는다(이 데모 전용 코드 금지). 순서는 5절.

#### 공백 A. 흔적 감각 (사냥꾼 감각 모드) — M

- **지금:** 단서는 ▼ 표식으로 보이거나, 아예 안 보인다. 「감각을 켜면 흔적이 드러나는」 상태가 없다. 발자국 그림 키트도 없다.
- **최소 설계**
  - 데이터: 이벤트 페이지에 `senseOnly?: true` 하나를 둔다. 그 페이지는 감각 모드일 때만 그려지고 조사된다. 맵 속성 `sense?: { tint, radius }`.
  - 런타임: 필드 단축키(예: Q, 패드 Y) 하나가 `session.senseActive` 를 토글한다.
    - 켜면 화면이 탈색되고 반경 밖이 어두워진다(기존 `setLighting` 경로 재사용).
    - `senseOnly` 이벤트에 맥박치는 외곽선을 그리고 ▼ 표식을 켠다. `syncExamineMarkers` 를 확장한다.
    - 켜 둔 동안 걸음이 느려진다(주인공 이동 속도 한 단계 내림). 소리 층 하나.
  - 흔적 그림:
    - 새 타일 대신 기존 소품을 쓴다. 진흙 `bd-pick-swamp-stilt-ground-mud`, 피 `gm-ov-blood` 는 계열이 달라 안 쓴다.
    - 그래서 **발자국은 파티클 `dust` + 「Sprite Look」 색조 이벤트**로 나타낸다.
    - 끌린 자국은 연속 이벤트 5~8개의 사슬로 놓는다. 하나를 조사하면 다음이 켜지는 체인이다.
  - 편집기: 이벤트 페이지 속성 「감각으로만 보임」 체크 하나.
  - 조수 도구: `place_track_trail({mapId, from, to, steps, revealSwitch, lines, onReach})`. 걸어 닿는 칸 경로로 흔적 사슬을 깔고, 끝에서 스위치를 켠다. 경로는 `walkableFromAnchors` 재사용.
- **QA:** 감각 끈 화면/켠 화면 쌍 스크린샷, 사슬 끝까지 따라가는 1배 영상.

#### 공백 B. 괴물 도감 (일반 RPG 용) — M

- **지금:** 몬스터 도감은 몬스터 수집 프로젝트에만 있다. `upsert_world_codex` 는 편집기 설정집이라 플레이어가 못 본다.
- **최소 설계**
  - 데이터: `system.bestiary = { enabled, title, entries: [{ id, enemyIds[], name, picture?(전투 도트 기본), sections: [{ id, title, text, unlockWhen: Condition }] }] }`. 항목 하나에 칸 여러 개(외형·습성·약점·처치 기록)를 두고, 칸마다 조건으로 열린다.
  - 런타임
    - ESC 메뉴 「도감」 쪽.
    - 목록 → 상세(전투 도트 크게 + 열린 칸 글, 잠긴 칸은 「???」). 약점 칸은 `session.knownWeaknesses` 와 합쳐 보인다(전투에서 알아낸 약점도 자동으로 채워진다).
    - 새 칸이 열리면 화면 구석에 짧은 알림 한 줄. 업적 투가 아니라 「도감에 적었다」 정도.
    - `playerMonsterDexDetail.ts` 의 상세 틀을 빌린다.
  - 명령: m2 «Bestiary Unlock»(entryId, sectionId). 조건 대신 명령으로 열고 싶을 때 쓴다.
  - 편집기: 자료집 → 이야기 아래 「도감」 탭. 항목 목록과 칸 편집.
  - 조수 도구: `define_bestiary_entry({id, enemyIds, name, sections})`, `list_bestiary`.
- **QA:** 칸 잠김/열림 스크린샷, 전투에서 약점을 맞힌 뒤 도감에 자동으로 뜨는지 확인하는 체크포인트.

#### 공백 C. 게시판 (계약 고르기 화면) — S~M

- **지금:** 선택지에 조건이 없다(`events.ts` 의 choices option 에 condition 없음). 그래서 이미 받은 계약을 숨기려면 페이지를 쪼개야 한다. `place_guild_board` 는 3갈래 고정 스탬프다.
- **최소 설계(둘 중 작은 것부터)**
  1. **선택지 조건 (S, 먼저 한다).**
     - 데이터: `choices.options[].showWhen?: Condition`, `enableWhen?: Condition`. 숨김과 흐리게(이유 한 줄) 둘을 둔다.
     - 런타임: `dialogue` 선택지 렌더와 커서 이동에서 거른다. 편집기 선택지 폼에 조건 칸을 단다.
     - 조수: `event_command_assist`·`patch_event_page` 스키마에 필드를 추가한다.
     - 다른 게임에도 바로 쓸모가 크다.
  2. **게시판 화면 (M, 나중).**
     - m2 «Quest Board»(boardId).
     - `project.questBoards = [{ id, title, questKeys[] }]`. 받을 수 있는 퀘스트(`requiresQuestKeys` 충족, 아직 안 받음)를 종이 쪽지 목록으로 보인다.
     - 쪽지를 고르면 「의뢰 내용 → 떼어 간다/둔다」. 떼면 `sw_<key>_started` 가 켜진다.
     - 조수 도구: `place_quest_board({mapId, x, y, boardId, questKeys})`. 그림은 실내 v5 `quest board` 기물을 쓴다.
- 데모는 1번만 있어도 지어진다. 2번은 시간이 남으면 한다.

#### 공백 D. 칼 기름 (몇 번의 전투 동안 특정 계열 피해 증가) — M

- **지금**
  - 상태가 공격 속성을 더하지 못한다(공격 속성은 장비 `attackElementIds` 뿐, `battleBattlers.ts:409`).
  - 「N번의 전투 동안」 셀 수단이 없다. 상태 해제는 턴·걸음 기준이다.
- **최소 설계**
  - 데이터
    - `StateRuntimeEffects.attackElementIds?: string[]`: 그 상태인 동안 평타에 속성을 더한다.
    - `StateRuntimeEffects.damageVsTags?: [{ tag, percent }]`: 적 `tags` 에 맞으면 피해 %를 올린다.
    - `EnemyRecord.tags?: string[]` (예: `"undead"`, `"beast"`, `"spectre"`). 계열 개념이 생긴다.
    - 상태에 `releaseAfterBattles?: number` 를 더한다. `battleEndStates.ts` 에서 전투가 끝날 때마다 줄인다.
  - 런타임: 전투 밖에서도 상태가 유지된다(필드 상태는 이미 있음). 전투 화면 배우 칸에 기름 아이콘과 남은 전투 수.
  - 편집기: 상태 편집 탭에 세 칸.
  - 조수 도구: `upsert_state` 스키마 확장. `upsert_item` 의 사용 효과 「상태 부여」 재사용.
- **데모 쓰임:** 「불씨 기름」(불 속성 + 언데드 +30%, 전투 3회), 「망자 기름」(빛 + 망령 +30%), 「해충 기름」(짐승 +25%).
- 공백 B 와 함께 「약점을 알고 준비하면 전투가 쉬워진다」는 고리를 만든다.

#### 공백 E. 명상 (원하는 시각까지 기다리기) — S

- **지금:** `advanceTime` 명령은 있으나 플레이어가 고르는 화면이 없다. ESC 메뉴 「대기」는 전투 게이지 대기다.
- **최소 설계**
  - ESC 메뉴 「쉬기」 항목을 둔다(`system.timeSystem.restMenu: { enabled, allowOnMaps: "safe"|"all", targets: ["morning","noon","evening","midnight"] }`).
  - 고르면 페이드 → `advanceTime` → 맵 이벤트 페이지 재평가. 적 시선 안이나 추격 중에는 거절한다(`pursuitActive` 조건 재사용).
  - 쉬면 HP 를 조금 회복할지는 설정으로 둔다. 데모는 회복하지 않는다(물약을 쓰게).
  - 편집기: 시스템 → 시간 탭에 체크와 목표 시각.
  - 조수 도구: `configure_time_system` 에 `restMenu` 인자.
- 함께 고칠 것: `FieldSpawnDef` 에 `timePhase` 를 더한다. 밤에만 나오는 무리를 사냥터 스폰으로 정한다. **S**

#### 공백 F. 후과 장부 (어떤 선택을 했는지 기록) — S

- **지금:** 스위치·변수는 전역이라 다른 지역에서 조건으로 읽는 것은 된다. 「무엇을 골랐나」를 사람이 읽을 형태로 모은 곳이 없다. `storyFlags` 는 뜻 사전일 뿐이다.
- **최소 설계**
  - 데이터: `storyFlags` 항목에 `consequence?: { label, choices: { [value]: text } }`.
  - 명령: m2 «Record Choice»(flagId, value). 변수 설정과 같지만 장부에 시각과 장소를 남긴다(`session.choiceLog`).
  - 편집기: 자료집 「이야기 → 플래그」에 「후과 문구」 칸.
  - 조수 도구: `declare_story_flag` 에 consequence 인자. `get_story_state` 가 장부를 보여 준다.
- 공백 G 의 재료다.

#### 공백 G. 조건 붙은 결말 문단 (선택 요약 에필로그) — S

- **지금:** `EndingDef.epilogue` 비트에 조건이 없다. 결말마다 다른 줄을 넣으려면 엔딩을 조합 수만큼 만들거나, `triggerEnding` 앞 컷신 이벤트에서 `fork` 로 대사를 늘어놓아야 한다.
- **최소 설계**
  - 데이터: epilogue 비트에 `when?: Condition` 하나. 조건이 거짓인 비트는 건너뛴다.
  - 엔딩 카드 요약(`endingSummary.ts`)에 공백 F 장부의 문구를 「그 뒤」 쪽으로 붙이는 옵션 `summaryFromChoiceLog: true`.
  - 조수 도구: `define_ending` 비트 스키마에 when.
- 우회가 가능하므로 시간이 모자라면 자른다(6절).

#### 공백 H. 늪·폐성 안개 입자 — 공백 아님

`setWeather fog` 와 `backdropLayers` 로 충분하다. 별도 작업하지 않는다.

#### 크기 합계

| 공백 | 크기 | 데모에 꼭? |
|---|---|---|
| A 흔적 감각 + `place_track_trail` | M | 예(장르의 얼굴) |
| B 괴물 도감 | M | 예 |
| C1 선택지 조건 | S | 예 |
| C2 게시판 화면 | M | 아니오(C1 + 페이지 조건으로 대체 가능) |
| D 칼 기름(상태 공격 속성·계열 태그·전투 수 해제) | M | 예 |
| E 쉬기 메뉴 + 스폰 시간 조건 | S + S | 예 |
| F 후과 장부 | S | 아니오(G 의 재료) |
| G 조건 붙은 결말 비트 | S | 아니오(fork 우회 가능) |

꼭 필요한 것만 S 3개 + M 3개, 대략 9~12 작업일이다. 전부 하면 14~17일.

---

## 5. 제작 계획

### 5.1 작업자 둘

- **W(세계·맵):** 세계 지도, 맵 20개, 연결, 시간대 색·날씨·음악, 필드 적 자리, 전투 배경 하네스. 출력은 `hc_` 맵과 각 맵의 「무대 좌표표」(NPC·게시판·흔적 시작점·보스 자리 칸 목록, `src/project/flagship/hunter/stage.json`).
- **Q(계약·시스템):** 엔진 공백 PR(main), 데이터베이스(배우·직업·기술·아이템·기름·적·그룹·상태·도감), 계약 9개 이벤트, 줄기 장면, 엔딩, 대사 윤문.
- **겹치는 곳은 무대 좌표표 하나다.** W 가 좌표표를 쓰고, Q 는 좌표표만 읽는다.
  - 저작 콘텐츠는 워크트리로 병렬화하지 않는다(AGENTS.md). 그래서 데모 빌더 코드를 파일로 나눈다.
  - W 는 `hunter/maps*.ts`, Q 는 `hunter/contracts*.ts`·`hunter/db.ts`·`hunter/story.ts` 를 맡는다.
  - 굽기와 정본 저장은 감독자 한 명이 직렬로 한다.
- **엔진 공백 PR** 은 데모 브랜치가 아니라 origin/main 기준 별도 브랜치에서 짓고 바로 머지한다(메모리 「데모 중 조수 개선은 수시 PR」). 데모는 그 머지를 받아 쓴다.

### 5.2 코드 구조 (기존 데모 방식)

```
src/project/flagship/hunter/
  index.ts        createHunterContractFlagshipDemo(): FlagshipDemoBuildResult
                  createBlankProject → setup → maps → db → contracts → story → endings → lore → serialize/deserialize
  kit.ts          isekaiGoddingKit.ts 를 복사해 시작(say/page/event/choices/ifCond/execTool/mustReach). 주의: 도구 호출 뒤 맵 참조는 늘 다시 꺼낸다
  maps.ts         W — 도구 호출 묶음 + 무대 좌표표 생성
  stage.json      W — 무대 좌표표(구운 결과에서 읽은 실제 칸)
  db.ts           Q — 배우·직업·기술·아이템·기름 상태·적(부록 C)·그룹·도감
  contracts/{a,b,c,s1..s6}.ts   Q — 계약마다 하나
  story.ts        Q — P0~P5
  lore.ts         loreKit.writeCodex 로 설정집 12항목 이상(데모 lore 하한)
```

데모 등록에 손댈 곳(maou-konbini 브랜치 diff 와 같다):
- `src/project/flagship/{types,beats,index}.ts`
- `src/editor/devShowcaseProjects.ts`
- `src/player/exportEntry.ts`
- `src/editor/panels/menu.ts`
- `src/assets/generatedAssetResourceResolver.ts`
- `scripts/lib/runtimeQaDemo.mjs` `DEMO_IDS`(maou 브랜치는 빠뜨렸다)
- `scripts/content/check-demo-lore.mts`
- `scripts/store/publish-game.mts`
- `scripts/qa/runtime/checkpoints/hunter-contract.json`

데모 id: `hunter-contract`. 스타일 잠금(`beats.ts`):
- 타일셋: `beodeul_city`·`atlas_biome_interior`·월드맵 키트.
- 칩 접두: `tex_easyrpg_charset_actor*`·`people*`.
- 해상도: 480×270.

### 5.3 순서와 이정표

| 이정표 | W | Q | 끝 조건 | QA |
|---|---|---|---|---|
| M0 뼈대 (1일) | 세계 지도 + 세 지역 마을 3장 + 연결 | 데모 등록, 빈 빌더, 주인공·시작 | `npm run bake:demos -- --only hunter-contract` 성공, 세계 지도에서 세 마을로 걸어 들어간다 | 체크포인트 `m0-world-*` 3개, 1배 영상(세계 지도 → 마을 진입) |
| M1 엔진 1차 (main PR 3개) | — | C1 선택지 조건, E 쉬기 메뉴 + 스폰 시간 조건, D 칼 기름 | 각 PR 머지, 도구 스키마·위키 갱신 | PR 마다 런타임 QA 시나리오 하나(`qa:runtime --scenario`) + 1배 영상 |
| M2 갈대늪 완결 (계약 A + S1·S2) | 늪 던전, 마녀의 탑, 늪 여관, 늪 전투 배경 | 계약 A·S1·S2, 기름·물약, 도감 없이 임시로 일지 | 늪 지역만으로 25분 놀이가 처음부터 끝까지 된다 | 체크포인트 `a-board`·`a-night-hunt`·`a-boss`·`a-choice-{1,2,3}`·`s1-*`·`s2-*`, 계약 A 처음부터 끝까지 1배 영상 |
| M3 엔진 2차 (main PR 2개) | — | A 흔적 감각 + `place_track_trail`, B 괴물 도감 | 머지, 계약 A 에 감각·도감을 붙여 다시 굽는다 | 감각 켬/끔 쌍, 도감 칸 열림 체크포인트 |
| M4 버들항 완결 (B + S4·S5) | 도심·부두·하수도·실내 5장, 하수도 전투 배경 | 계약 B(대질은 `author_mystery_case`), S4·S5, A 후과(피난민) | 버들항 단독 놀이 + A② 후과가 부두에 보인다 | 체크포인트 `b-*`, `s4-*`(A② 있음/없음 둘), `s5-*`, 계약 B 1배 영상 |
| M5 회색봉 완결 (C + S3·S6 + 결말) | 무너진 마을, 대전, 하층, 납골당, 늑대 굴, 예배당, 폐성·납골당 전투 배경 | 계약 C, S3·S6, P2~P5, 결말 셋, 결말 비트(G 또는 fork 우회) | 처음부터 결말까지 이어진다 | 결말 셋 각각 체크포인트(선택 플래그를 미리 깔고 시작), 결말 1배 영상 셋 |
| M6 다듬기 | 빈 바닥 줄이기, 조명·날씨 맞추기, 맵 빈칸 게이트 | 대사 윤문(lint 적중 0), 밸런스(`simulate_battle`), 설정집 | 독립 판정자 한 번이 통과(폴른 스타 2막 방식, `play-step.mjs`) | 1배 통짜 녹화(구간마다 체크포인트에서 이어 찍기), viz 맨 위에 영상 |

작업일 어림:
- W: M0 1 · M2 2 · M4 3 · M5 3 · M6 2 = 11일.
- Q: M0 0.5 · M1 4 · M2 3 · M3 4 · M4 3 · M5 4 · M6 2 = 20일.
- Q 쪽이 무겁다. M1·M3 엔진 PR 하나를 W 가 맡을 수 있다. 맵 일이 일찍 끝나는 M4 이후 공백 E·G 처럼 작은 것이 맞다.

### 5.4 QA 방식

- 체크포인트 세트: `scripts/qa/runtime/checkpoints/hunter-contract.json`(들여쓰기 1로 쓴다).
  - 각 체크포인트는 `mapId·x·y·switches·variables·party·items·beats` 를 갖는다.
  - 계약마다 「게시판 앞」「조사 중간」「보스 직전」「선택 직전」을 둔다.
  - 후과 확인은 앞 계약 선택 플래그만 깔아 두고 다음 지역에서 바로 시작한다. 매번 타이틀부터 돌지 않는다(메모리 「QA 는 체크포인트에서 바로 시작」).
- 실행(폴른 스타와 같다):
  ```bash
  QA_RECORD_VIDEO=/tmp/hc/vid timeout 2400 unshare -rn bash -c 'ip link set lo up; npm run -s qa:runtime -- --scenario checkpoints --checkpoint-set hunter-contract --checkpoint "a-*" --project <bake>/demos/hunter-contract.project.json --out /tmp/hc/qa --parallel 1'
  ```
  `SUMMARY.md` 를 먼저 읽는다. 움직임(감각·필드 적 추격·컷신)은 정지 그림이 아니라 1배 영상으로 확인한다(`ffmpeg -vf scale=960:-2:flags=neighbor`).
- 영상은 `~/claude-viz/hunter-<이정표>.html` 맨 위에 둔다.
- 정본 저장: 굽기 뒤 SQLite 정본에 저장하고 다시 읽는다. project id·저장 대상·재로드 근거를 보고한다(AGENTS.md hard rule). Fallen 의 `save-fallen-star.mjs` 처럼 `save-hunter-contract.mjs` 를 만든다.
- 문체: 이정표마다 플레이어가 읽는 글 전부를 `lint-game-text.mts` 로 돌린다. 번역투·모델 틱 적중은 0이어야 한다.
- 테스트·게이트는 감독자만 돌린다(AGENTS.md). 작업자는 typecheck:app 까지만 한다.

---

## 6. 위험과 먼저 자를 것

### 6.1 위험 (큰 순서)

1. **엔진 공백이 데모보다 크다.** 꼭 필요한 S3·M3 만 9~12일이다. 데모 콘텐츠를 짓는 동안 main 에 다섯 PR 을 머지해야 하고, 각 PR 은 다른 게임을 깨뜨리지 않아야 한다.
   - 줄이는 법: 공백마다 데이터 필드는 「없으면 지금과 똑같다」로 짓는다.
   - 데모는 공백 없이도 돌아가는 우회부터 짓는다. 감각은 ▼ 표식, 도감은 일지 줄, 기름은 장비 바꿔치기로 우회한다. 공백 PR 이 머지되면 바꿔 끼운다. M2 가 엔진 2차(M3)보다 먼저인 이유다.
2. **「어른스러운 톤」이 글로만 서고 화면은 밝다.** 버들항·실내 v5 는 아늑하고 화사한 그림이다.
   - 줄이는 법: 지역마다 시간대 색과 날씨를 기본으로 깐다(늪 안개, 항구 비, 폐성 밤). 실내 조명을 낮춘다. 폐성은 ruin 변형을 쓴다. 귀여운 칩(아이·동물 동료·과한 표정)은 빼 버린다.
   - 이정표마다 「유치해 보이는가」를 독립 판정자 프롬프트에 넣는다.
3. **도구 결과가 시드마다 흔들려 무대 좌표가 깨진다.** `place_npc` 가 막힌 칸이면 자리를 옮기고, 생성기를 고치면 집 위치가 바뀐다.
   - 줄이는 법: 폴른 스타의 `withFrozenTowns` 처럼 지은 마을을 스냅숏으로 얼린다(`hunter/frozenMaps.json`). 좌표표는 구운 결과에서 읽는다.
4. **조사가 지루하다.** 흔적 사슬과 탐문이 「버튼 누르기 숙제」가 되기 쉽다.
   - 줄이는 법: 계약마다 단서 3~4개를 넘기지 않는다. 셋 중 둘이면 다음으로 넘어간다(전부 모으기 강요 금지). 감각 모드 걸음 감속은 반 단계만 둔다.
5. **늪 던전 그림.** 수관이 숲 것이라 늪다움이 약하다. 안개로 가리되, 판정자가 걸면 늪 둥지를 `type:"cave"` + 물(동굴 호수)로 바꾼다.
6. **굽기 시간과 디스크.** 폴른 스타 굽기는 6분이고 디스크가 거의 찼다. 맵 20장이면 2~3분으로 보지만, 매 이정표 굽기 전에 디스크를 확인한다.

### 6.2 자르는 순서 (시간이 모자라면 위에서부터)

1. 공백 C2 게시판 화면 → C1 선택지 조건 + 페이지 조건으로 게시판을 만든다.
2. 공백 G 조건 붙은 결말 비트, F 후과 장부 → 결말 직전 컷신 이벤트의 `fork` 로 소식 줄을 늘어놓는다.
3. 곁 계약 S6 → S2 → S3 (하나에 5~7분).
4. 결말 하나(「은값」)를 「셋째 장의 이름」의 나쁜 판으로 합친다. 결말이 둘이 된다.
5. 전투 배경 하네스 → 동굴·숲 배경 + `backdropLayers` 안개.
6. 버들항 부두 맵 → 도심 남쪽 가장자리 하나로 합친다.

**자르지 않는 것:**
- 주 계약 셋과 지역 셋. 다른 지역으로 돌아오는 후과가 이 게임의 뼈대다.
- 공백 A(흔적 감각)·B(도감)·D(기름). 조사 → 약점 → 준비 고리가 없으면 그냥 JRPG 다.

---

## 부록 A. 플래그·변수 (접두 `hc_`)

| 이름 | 종류 | 뜻 |
|---|---|---|
| `var_hc_stage` | 변수 | 줄기 진행 0~5 |
| `var_hc_contracts_done` | 변수 | 주 계약 완료 수(P2·P3·P4 계기) |
| `var_hc_a_choice` · `b_choice` · `c_choice` | 변수 | 각 주 계약 선택 1~3 |
| `var_hc_end_choice` | 변수 | 결말 선택 1~3 |
| `var_hc_mercy` | 변수 | 후과 점수(A②·B①·B③·S1 아이·S4 이름·리스크 빚 +1) |
| `sw_hc_<key>_started/_done/_step<i>` | 스위치 | `define_quest` 가 만든다(키: a·b·c·s1~s6) |
| `sw_hc_knows_osben` · `risk_debt_paid` · `refugees_at_dock` · `guard_replaced` · `griffin_ally` · `girl_freed` | 스위치 | 후과 표지 |
| `sw_hc_clue_<계약>_<n>` | 스위치 | 단서. 도감 칸 조건과 다음 증인 페이지 조건 |

## 부록 B. 등장인물

| 인물 | 칩 | 흉상 | 지역 |
|---|---|---|---|
| 도르반(주인공) | Actor2#4 갈색 머리 중년 전사 | actor1 face 대응 | — |
| 리스크(도제) | Actor2#2 녹색 망토 레인저 | 대응 있음 | 회상·회색봉 |
| 마르타(늪 촌장) | People 노년 여성 | 공용 노파 세트 | 늪 |
| 뱃사공 | People 노년 남성 | 공용 노인 | 늪 |
| 브란(경비대장) | helmet-guard 대응 칩 | helmet-guard | 항구 |
| 오스벤(상인 조합) | People 콧수염 남성 | mustache | 항구·결말 |
| 감방 소녀(밀수꾼) | Actor2#5 젊은 여성 도적 | 대응 있음 | 항구 |
| 늙은 하인 | People 대머리 남성 | bald | 회색봉 |
| 순례자 | People 수녀 | nun | 회색봉 |

칩 칸 번호는 W 가 M0 에서 `list_npc_graphics` 로 확정해 좌표표에 적는다. 아이 칩(People1#0·#1)은 쓰지 않는다.

## 부록 C. 적 (기본 DB 레코드 있음, 이름만 바꿔 쓴다)

| 이 게임 이름 | DB id / 도트 | 지역 | 약점·저항(안) |
|---|---|---|---|
| 익사귀 | `enemy_ghoul_grave` | 늪 | 불 ×2, 은(빛) ×1.5, 물 무효 |
| 물에 잠긴 어미(보스) | `enemy_ghoul_grave` 큰 판 | 늪 | 같음 + 재생(불로 끊김) |
| 늪 도마뱀 | `enemy_lizardman_spear` | 늪 길 | 얼음 ×1.5 |
| 도깨비불 | `enemy_wisp_blue` | 늪 S1 | 물 ×2, 물리 반감 |
| 물의 할미 | `enemy_banshee_wail` | 늪 S2 | 빛 ×1.5 |
| 거대 쥐 | `enemy_rat_giant` 계열 | 하수도 | 불 ×1.5 |
| 하수구 여왕(보스) | `enemy_ooze_black` / `slime_king` 큰 판 | 하수도 | 불 ×2, 독 무효 |
| 부두의 아이 | `enemy_ghost_pale` | 부두 S4 | 빛 ×2, 물리 반감 |
| 그리핀 | `enemy_griffin_sky`(96px) | 도심 S5 | 번개 ×1.5 |
| 늙은 늑대 | `enemy_wolf_dire`, `enemy_wolf_grey` | 산길 S3 | 불 ×1.5 |
| 밀렵꾼 | `enemy_bandit_mask` | 늑대 굴 S3 | — |
| 해골 기사 | `enemy_skeleton_knight` | 폐성 | 빛 ×2, 찌르기 반감 |
| 망령 | `enemy_wraith_dark` | 폐성 | 빛 ×2, 물리 반감 |
| 성주의 망령(보스) | `enemy_revenant_vengeful` | 폐성 | 빛 ×2, 물리 반감 |
| 구울·해골 | `enemy_zombie_rot`, `enemy_skeleton_bone` | 납골당 S6 | 불·빛 |
| 브란의 부하 | `enemy_bandit_mask` | 산길 초소(B② 후과) | — |

적 계열 태그(공백 D): `undead`(익사귀·망령·해골·구울), `spectre`(도깨비불·할미·아이·성주), `beast`(쥐·늑대·그리핀·도마뱀), `human`(밀렵꾼·부하).
