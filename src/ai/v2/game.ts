// 조수 v2 «게임 요소» — 퀘스트·아이템·상점·전투·파티·스위치처럼 맵이 아닌 요청.
//
// 왜(2026-10-23 게임 요소 비교 40): v2 동사(make_place·add_people·add_event·add_scene)는 장소·사람·연출만 다뤄서
// 「심부름 퀘스트」「새 무기를 상점에서」「보스 전투 뒤 감사」를 옮길 길이 없었다. 이 층은 이미 검증된 v1 결정론 도구를
// 그대로 내놓는다(스키마·검증·저장 계약이 v1 과 같다). 요청에 게임 낱말이 있을 때만 싣는다 — 맵 요청의 첫 턴을 무겁게 하지 않는다.
import { createPiToolset, type PiToolShape } from "@/ai/piAgent/toolAdapter";
import { getTool } from "@/editor/tools/toolRegistry";
import type { PiAssistantV2Env } from "./env";

export const GAME_WORDS = /퀘스트|의뢰|심부름|부탁|아이템|회복약|포션|무기|갑옷|방패|장비|장신구|상점|가게|팔게|팔기|열쇠|잠긴|보물|상자|제작|만들어 주는|주인공|이름|직업|레벨|능력치|체력|동료|파티|합류|떠나|스킬|기술|전투|싸우|보스|적\b|몬스터|무리|선택지|호감|기억|스위치|변수|횟수|레버|여관|묵으|저장|회복|치료|신부|골드|돈|엔딩|게임|일지|제한 시간|타이머|낮에|밤에|시간대|아침|저녁|팻말|표지판|우물|동전|quest|item|shop|weapon|armor|battle|enemy|party|skill|inn|save|gold/iu;

/** v1 도구 중 게임 요소에 쓰는 것(읽기 먼저). 레지스트리에 없는 이름은 빠진다. */
export const V2_GAME_TOOLS: readonly string[] = [
  "get_database_records", "find_events", "get_event", "get_story_state", "find_switch_usage",
  "create_quest", "create_quest_flags",
  "upsert_item", "upsert_equipment", "set_shop_stock", "set_sell_prices", "place_chest", "upsert_craft_recipe",
  "upsert_actor", "upsert_class", "upsert_skill", "set_party", "add_companion",
  "upsert_enemy", "upsert_troop", "upsert_troop_battle_page", "set_encounter_table",
  "find_empty_ground", "place_npc", "upsert_event", "patch_event_page", "run_scene_test", "upsert_common_event", "set_npc_schedule", "configure_time_system", "place_savepoint", "set_start_position",
];

export const GAME_CARD = `[게임 요소 — 퀘스트·아이템·상점·전투·파티·스위치] 이 요청에는 v1 게임 도구를 그대로 쓴다(장소·연출은 위 동사).
- 순서: 1) 읽기 — get_database_records(있는 아이템·적·배우), find_events(이 맵의 NPC·이벤트 id) → 2) 데이터 — upsert_item/upsert_equipment/upsert_skill/upsert_enemy/upsert_troop/upsert_actor/upsert_class → 3) 붙이기 — place_npc/upsert_event(페이지·조건·명령), set_shop_stock, place_chest, set_encounter_table, create_quest → 4) get_event 로 다시 읽어 조건·명령이 맞는지 확인.
- 새 NPC 는 add_people 로 자리 낱말을 줘서 세운 뒤, 돌려받은 이벤트 id 에 upsert_event 로 페이지·조건·명령을 단다. 좌표가 꼭 필요하면(상자·레버) find_empty_ground 로 빈 칸을 받아 쓴다 — 지어내지 않는다.
- 이미 있는 NPC(촌장 등)를 고칠 때는 새로 세우지 말고 그 이벤트 id 로 upsert_event 한다. 기존 대사는 요청이 바꾸라 하지 않으면 남긴다.
- 상태가 바뀌는 대화(의뢰→진행→완료, 선택 기억)는 페이지마다 조건(스위치·변수·셀프 스위치)을 다르게 둔다. 보상·아이템 증감·골드·파티 변경은 명령으로 넣는다.
- 요청에 숫자(회복량·공격력·가격)가 있으면 그 값을 그대로 쓴다. 아이템에 효과 기술(skillId)을 따로 이으면 그 기술의 위력도 같은 값·분산 0 으로 맞춘다(어긋나면 실제 회복량이 요청과 달라진다).
- 호감·신뢰·평판처럼 «쌓이는» 값은 변수로 두고 대화·선물마다 증감 명령을 넣고, 바뀌는 대사 페이지는 그 변수 조건(≥ 문턱)으로 고른다 — 대화 횟수 셀프 스위치로 대신하면 호감이 장식이 된다.
- 한 번만 일어나야 하는 것(보상·상자·합류)은 셀프 스위치나 스위치로 다시 안 일어나게 막는다.
- 시간대(낮·밤)에 따라 NPC 자리·대사가 바뀌면 configure_time_system(시간 켜기) → set_npc_schedule(시간표)·페이지 조건을 쓴다(집 안이 없으면 make_place 로 실내를 짓고 문을 잇는다). 할 수 없으면 묻기 전에 가장 가까운 동작 판을 먼저 만들고 보고에 적는다.
- 이름 바꾸기: upsert_actor 에는 id·name 만 보낸다(능력치는 그대로 남는다). 요청이 «대사에서도 부르게» 같으면 find_events 로 그 인물을 부르는 NPC 를 찾아 patch_event_page 로 그 줄만 고친다 — 다른 대사는 남긴다. 지목한 대사에 이름이 아직 없으면 그 인물이 새 이름으로 주인공을 부르게 그 줄에 넣는다(「어서 오게, 아린. …」) — 요청의 뜻은 대사에서 새 이름이 들리는 것이다.
- 시작 장비를 바꾸면 그 장비가 주인공 직업의 장비 허용(class equipmentPermissions)에 들었는지 확인하고 없으면 upsert_class 로 넣는다. 기존보다 약한 장비로 바꾸지 말 것(요청이 없으면).
- 상점은 set_shop_stock 으로 단다(되팔기가 켜진다). upsert_event 로 shop 명령을 직접 쓰면 allowSell:true 를 꼭 넣는다(빠지면 팔기 메뉴가 없다). 되팔기 비율(예: 70%)은 set_sell_prices 가 품목별 표라서, 그 상점 물건만이 아니라 플레이어가 흔히 가진 소모품·장비까지 넓게 채운다.
- 대사는 그 인물의 입말로 쓴다 — 퀘스트 요약문(「~를 찾아 소식을 전해 주자」)을 NPC 대사로 쓰지 않는다. 주인공 독백·내레이션은 말하는 사람 이름 없이.
- 타이머·시간 제한: 페이지 조건 timer 는 {timerId:"timer1"|"timer2", seconds} 로 «남은 시간 ≤ 초» 하나만 뜻한다(op 필드는 없다 — 써도 무시되어 ≤ 로 평가된다, 다른 timerId 도 안 된다). 그래서 「도는 중」은 timer 조건 말고 시작 스위치로 나눈다. 시작 = timer set(초)+start(timer1)+시작 스위치, 성공 = 물건·스위치 조건 페이지에서 timer stop, 실패 = 남은 시간 ≤0 페이지(가장 높은 번호).
- 다 만든 뒤 run_scene_test 로 핵심 경로를 한 번 돌려 본다(말 걸기 interact·choose → expect switchOn/inventoryCount/goldDelta 등). 실패하면 patch_event_page 로 고치고 다시. 통과한 것만 「됐다」고 보고한다.
- 도구가 거절하면 이유를 읽고 고쳐 다시 부른다. 할 수 없는 것은 보고에 적는다.`;

export function wantsGameTools(task: string): boolean {
  return GAME_WORDS.test(task);
}

/** 이미 있는 맵에 물길·다리·작은 물건을 덧그리는 요청(맵을 새로 짓지 않는다) — v1 결정론 덧그리기 도구 셋. */
export const TERRAIN_WORDS = /다리를|다리가|다리 위|다리에|돌다리|강을|강이|강물|강 상류|강 하류|개울|냇물|시냇|연못을|물길|폭포|레버|팻말|표지판|간판|bridge|lever|signpost/iu;
export const V2_TERRAIN_TOOLS: readonly string[] = ["list_spatial_designs", "stamp_object", "fill_region"];
export const TERRAIN_CARD = `[이미 있는 맵에 덧그리기 — 물길·다리·작은 물건] 맵을 새로 짓지 않고 고칠 때(이미 지은 마을에 강·다리·레버·팻말).
- 물: fill_region{mapId, material, rect:{x,y,w,h}, shape?:'ellipse', referencePurpose} — 버들항 칩셋(beodeul_city)은 material:'버들항 물'(그냥 '물'은 물 준 밭흙이 된다)·referencePurpose:'beodeul-city-water'. 굽은 강은 rect 여러 개. 집·완성 구역은 피하고, 길이 물을 건너는 자리를 남겨 다리를 놓는다.
- 물건: list_spatial_designs{kind:'object', query} 로 id 를 찾아 stamp_object{mapId, objectId:'kit:…', x, y}. 버들항에서 자주 쓰는 것: 다리 'kit:beodeul_city/bd-bridge-arch', 표지판 'kit:beodeul_city/bd-out-signpost',
  바닥에 세우는 레버 'kit:shared_hand_interior_harness/shared_hand-interior:floor lever'(벽 레버 'wall lever'·던전 레버는 벽 앞면에만 걸린다). 찾아도 없을 때만 draw_object. 묻기 전에 먼저 놓아 본다.
- 이벤트(조사·밟기)는 그 물건 칸에 둔다(좌표는 방금 놓은 x,y). 다 놓은 뒤 inspect 로 1배 그림을 본다.`;
export function wantsTerrainTools(task: string): boolean {
  return TERRAIN_WORDS.test(task);
}

/** 게임 도구 묶음 — 실행 기록은 v1 경로와 같은 onCall(env.record)로 남는다. */
export function createGameTools(env: PiAssistantV2Env, task = ""): PiToolShape[] {
  const want = [...(wantsGameTools(task) ? V2_GAME_TOOLS : []), ...(wantsTerrainTools(task) ? V2_TERRAIN_TOOLS : [])];
  const names = [...new Set(want)].filter((name) => getTool(name));
  return createPiToolset(env.ctx, { ...(env.toolsetOptions ?? {}), toolNames: names, onCall: env.record });
}
