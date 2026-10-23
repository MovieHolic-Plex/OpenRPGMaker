// 조수 v2 «게임 요소» — 퀘스트·아이템·상점·전투·파티·스위치처럼 맵이 아닌 요청.
//
// 왜(2026-10-23 게임 요소 비교 40): v2 동사(make_place·add_people·add_event·add_scene)는 장소·사람·연출만 다뤄서
// 「심부름 퀘스트」「새 무기를 상점에서」「보스 전투 뒤 감사」를 옮길 길이 없었다. 이 층은 이미 검증된 v1 결정론 도구를
// 그대로 내놓는다(스키마·검증·저장 계약이 v1 과 같다). 요청에 게임 낱말이 있을 때만 싣는다 — 맵 요청의 첫 턴을 무겁게 하지 않는다.
import { createPiToolset, type PiToolShape } from "@/ai/piAgent/toolAdapter";
import { getTool } from "@/editor/tools/toolRegistry";
import type { PiAssistantV2Env } from "./env";

export const GAME_WORDS = /퀘스트|의뢰|심부름|부탁|아이템|회복약|포션|무기|갑옷|방패|장비|장신구|상점|가게|팔게|팔기|열쇠|잠긴|보물|상자|제작|만들어 주는|주인공|이름|직업|레벨|능력치|체력|동료|파티|합류|떠나|스킬|기술|전투|싸우|보스|적\b|몬스터|무리|선택지|호감|기억|스위치|변수|횟수|레버|여관|묵으|저장|회복|치료|신부|골드|돈|엔딩|게임|일지|제한 시간|타이머|quest|item|shop|weapon|armor|battle|enemy|party|skill|inn|save|gold/iu;

/** v1 도구 중 게임 요소에 쓰는 것(읽기 먼저). 레지스트리에 없는 이름은 빠진다. */
export const V2_GAME_TOOLS: readonly string[] = [
  "get_database_records", "find_events", "get_event", "get_story_state", "find_switch_usage",
  "create_quest", "create_quest_flags",
  "upsert_item", "upsert_equipment", "set_shop_stock", "set_sell_prices", "place_chest", "upsert_craft_recipe",
  "upsert_actor", "upsert_class", "upsert_skill", "set_party", "add_companion",
  "upsert_enemy", "upsert_troop", "upsert_troop_battle_page", "set_encounter_table",
  "find_empty_ground", "place_npc", "upsert_event", "upsert_common_event", "set_npc_schedule", "place_savepoint", "set_start_position",
];

export const GAME_CARD = `[게임 요소 — 퀘스트·아이템·상점·전투·파티·스위치] 이 요청에는 v1 게임 도구를 그대로 쓴다(장소·연출은 위 동사).
- 순서: 1) 읽기 — get_database_records(있는 아이템·적·배우), find_events(이 맵의 NPC·이벤트 id) → 2) 데이터 — upsert_item/upsert_equipment/upsert_skill/upsert_enemy/upsert_troop/upsert_actor/upsert_class → 3) 붙이기 — place_npc/upsert_event(페이지·조건·명령), set_shop_stock, place_chest, set_encounter_table, create_quest → 4) get_event 로 다시 읽어 조건·명령이 맞는지 확인.
- 새 NPC 는 add_people 로 자리 낱말을 줘서 세운 뒤, 돌려받은 이벤트 id 에 upsert_event 로 페이지·조건·명령을 단다. 좌표가 꼭 필요하면(상자·레버) find_empty_ground 로 빈 칸을 받아 쓴다 — 지어내지 않는다.
- 이미 있는 NPC(촌장 등)를 고칠 때는 새로 세우지 말고 그 이벤트 id 로 upsert_event 한다. 기존 대사는 요청이 바꾸라 하지 않으면 남긴다.
- 상태가 바뀌는 대화(의뢰→진행→완료, 선택 기억)는 페이지마다 조건(스위치·변수·셀프 스위치)을 다르게 둔다. 보상·아이템 증감·골드·파티 변경은 명령으로 넣는다.
- 요청에 숫자(회복량·공격력·가격)가 있으면 그 값을 그대로 쓴다. 아이템에 효과 기술(skillId)을 따로 이으면 그 기술의 위력도 같은 값·분산 0 으로 맞춘다(어긋나면 실제 회복량이 요청과 달라진다).
- 한 번만 일어나야 하는 것(보상·상자·합류)은 셀프 스위치나 스위치로 다시 안 일어나게 막는다.
- 도구가 거절하면 이유를 읽고 고쳐 다시 부른다. 할 수 없는 것은 보고에 적는다.`;

export function wantsGameTools(task: string): boolean {
  return GAME_WORDS.test(task);
}

/** 게임 도구 묶음 — 실행 기록은 v1 경로와 같은 onCall(env.record)로 남는다. */
export function createGameTools(env: PiAssistantV2Env): PiToolShape[] {
  const names = V2_GAME_TOOLS.filter((name) => getTool(name));
  return createPiToolset(env.ctx, { toolNames: names, onCall: env.record });
}
