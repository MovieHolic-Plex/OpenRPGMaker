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
- 한 번만 일어나야 하는 것(보상·상자·합류)은 셀프 스위치나 스위치로 다시 안 일어나게 막는다.
- 시간대(낮·밤)에 따라 NPC 자리·대사가 바뀌면 configure_time_system(시간 켜기) → set_npc_schedule(시간표)·페이지 조건을 쓴다(집 안이 없으면 make_place 로 실내를 짓고 문을 잇는다). 할 수 없으면 묻기 전에 가장 가까운 동작 판을 먼저 만들고 보고에 적는다.
- 시작 장비를 바꾸면 그 장비가 주인공 직업의 장비 허용(class equipmentPermissions)에 들었는지 확인하고 없으면 upsert_class 로 넣는다. 기존보다 약한 장비로 바꾸지 말 것(요청이 없으면).
- 되팔기 비율(예: 70%)은 set_sell_prices 가 품목별 표라서, 그 상점 물건만이 아니라 플레이어가 흔히 가진 소모품·장비까지 넓게 채운다.
- 대사는 그 인물의 입말로 쓴다 — 퀘스트 요약문(「~를 찾아 소식을 전해 주자」)을 NPC 대사로 쓰지 않는다. 주인공 독백·내레이션은 말하는 사람 이름 없이.
- 타이머·시간 제한: 페이지 조건 timer 는 {timerId:"timer1"|"timer2", seconds} 로 «남은 시간 ≤ 초» 하나만 뜻한다(op 필드는 없다 — 써도 무시되어 ≤ 로 평가된다, 다른 timerId 도 안 된다). 그래서 「도는 중」은 timer 조건 말고 시작 스위치로 나눈다. 시작 = timer set(초)+start(timer1)+시작 스위치, 성공 = 물건·스위치 조건 페이지에서 timer stop, 실패 = 남은 시간 ≤0 페이지(가장 높은 번호).
- 다 만든 뒤 run_scene_test 로 핵심 경로를 한 번 돌려 본다(말 걸기 interact·choose → expect switchOn/inventoryCount/goldDelta 등). 실패하면 patch_event_page 로 고치고 다시. 통과한 것만 「됐다」고 보고한다.
- 도구가 거절하면 이유를 읽고 고쳐 다시 부른다. 할 수 없는 것은 보고에 적는다.`;

export function wantsGameTools(task: string): boolean {
  return GAME_WORDS.test(task);
}

/** 게임 도구 묶음 — 실행 기록은 v1 경로와 같은 onCall(env.record)로 남는다. */
export function createGameTools(env: PiAssistantV2Env): PiToolShape[] {
  const names = V2_GAME_TOOLS.filter((name) => getTool(name));
  return createPiToolset(env.ctx, { toolNames: names, onCall: env.record });
}
