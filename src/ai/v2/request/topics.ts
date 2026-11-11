// 작은 일의 주제 — 작은 요청(고치기·질문·이어 하기)에 게임 카드의 어느 줄을, 어느 도구를 처음부터 실을지 정하는 낱말.
// 게임 하나를 짓는 요청은 이 표를 쓰지 않는다(카드·도구를 통째로 싣는다). 못 맞춘 주제의 도구도 load_tools·이름 호출로 닿는다.
import { SHAKE_WORDS, FLASH_WORDS, WEATHER_WORDS } from "./asks";
import type { AudioAsk } from "./audio";
import { STATE_WORDS, type CombatAsk } from "./combat";
import { kw, kwEnd } from "./text";
import { ENDING_WORK_WORDS, SCRIPT_TIER, SHOP_WORDS, V2_DRESS_TOOLS, type ToolGroups } from "./toolGroups";

/** 게임 카드 줄의 주제. */
export type GameTopic =
  | "script" | "items" | "equipment" | "affection" | "time" | "rename" | "gates" | "status" | "weather" | "staging" | "examine" | "maps" | "battle" | "boss"
  | "flashback" | "feelings" | "ending" | "snow" | "forest" | "search" | "fieldEnemy" | "replace" | "opening" | "readable" | "vanish" | "patrol" | "door" | "removeMap" | "chest" | "hero" | "scene";

const TOPIC_WORDS: readonly (readonly [GameTopic, RegExp])[] = [
  ["script", SCRIPT_TIER.words],
  ["items", new RegExp(`${SHOP_WORDS.source}|아이템|회복약|포션|회복량|가격`, "iu")],
  ["equipment", new RegExp(String.raw`장비|무기|방어구|갑옷|방패|${kw("검")}|${kw("칼")}|${kw("활")}|공격력|방어력|피해량|데미지|치명타|equipment|weapon|armou?r`, "iu")],
  ["affection", /호감|신뢰|평판|친밀|우호도|affection|trust|reputation/iu],
  ["time", new RegExp(String.raw`${kw("낮")}|${kw("밤")}|아침|저녁|새벽|시간대|타이머|제한\s*시간|초\s*안에|분\s*안에|time of day|timer`, "iu")],
  ["rename", /이름|호칭|rename/iu],
  ["gates", /암호|비밀번호|통행료|자물쇠|열쇠|잠긴|잠겨|문지기|보여\s*주|건네|내밀|password|toll|lock/iu],
  ["status", new RegExp(`${STATE_WORDS.source}|상태|화상|기절|내성|속성`, "iu")],
  ["weather", WEATHER_WORDS],
  ["staging", new RegExp(`${SHAKE_WORDS.source}|${FLASH_WORDS.source}`, "iu")],
  ["examine", /조사|살펴|비석|묘비|이동석|분수|약초|광맥|표지판|팻말|덤불|우물|망원경|examine/iu],
  ["maps", /새\s*맵|입구|출구|들어가면|나가면|이어\s*줘|이어줘|연결|문을|문으로|가게\s*이어|transfer/iu],
  ["flashback", /회상|과거\s*장면|옛날\s*장면|플래시백|flashback/iu],
  ["feelings", /표정|웃으|걱정|화난|놀란|감정|느낌표|따라오|따라와|동료가\s*되|합류/iu],
  ["ending", ENDING_WORK_WORDS],
  ["snow", /설원|눈길|눈보라|눈 덮인|고갯길|서리|얼음 틈|빙판|북방|snow|blizzard|frozen/iu],
  ["forest", new RegExp(String.raw`${kwEnd("숲", "속|길")}|들판|필드|초원|forest|woods?\b|field|meadow`, "iu")],
  ["search", /뒤지|뒤져|뒤질|수납|항아리|서랍|옷장|들키|들켜|몰래|search/iu],
  ["fieldEnemy", /보이는\s*적|돌아다니는\s*(?:적|몬스터)|쫓아\s*오|시야|field enemy/iu],
  ["replace", /전부|모두|일괄|모든|every|all the/iu],
  ["opening", /오프닝|시작할 때|게임 시작|타이틀|제목|영화처럼|opening|title/iu],
  ["readable", /책장|일지|편지|쪽지|읽으면|읽을|journal|letter|book/iu],
  ["vanish", /연기|사라지|vanish/iu],
  ["patrol", /순찰|돌아다|뛰어다|걸어 다|patrol/iu],
  ["door", /문을 열|문 열|성문|창고 문|뒷문|자동문|미닫이|셔터|문 효과|door/iu],
  ["removeMap", /맵[^.!?\n]{0,8}(?:지워|지우|삭제|없애)|안\s*쓰는\s*맵|중복\s*맵|remove.*map/iu],
  // 줍는 물건도 같은 도구(place_chest look:"item")다.
  ["chest", /상자|보물|떨어져 있|떨어뜨|주[워울운]|줍[게는기다]|chest|treasure|pick(?:s|ed)?\s?up|lying on/iu],
  ["hero", /주인공|파티|동료|직업|레벨|능력치|hero|party/iu],
  ["scene", /장면|컷신|컷씬|연출|scene|cutscene/iu],
];

/** 한 요청의 주제 — 이름·대사를 가린 글과 이미 정한 전투 판정을 받는다. */
export function gameTopics(topic: string, combat: CombatAsk): readonly GameTopic[] {
  const hit = new Set<GameTopic>(TOPIC_WORDS.filter(([, words]) => words.test(topic)).map(([key]) => key));
  if (combat.mentioned || combat.encounters || combat.foes) hit.add("battle");
  if (combat.boss) hit.add("boss");
  if (combat.foes) hit.add("fieldEnemy");
  return [...hit];
}

const PERSON = String.raw`npc|주민|주인|상인|점원|경비|병사|촌장|손님|사람|아이|노인|동료|행인|학생|선생|직원|한\s*명|두\s*명|세\s*명|몇\s*명`;
const ADD = String.raw`세워|세우|추가|배치|두어|둬\s*줘|놓아|넣어|만들|등장|서\s*있게`;
const ADD_PERSON = new RegExp(`(?:${PERSON})[^.!?\\n]{0,14}(?:${ADD})`, "iu");
const MOVE_OR_REMOVE = /옮겨|옮기|이동시|치워|지워|지우|삭제|없애|빼\s*줘/u;
/** 조건·대사·사건을 짜 달라는 낱말 — 이벤트 카드와 이벤트 쓰기 도구가 필요하다. */
const LOGIC = /하면|으면|[가-힣]면\s|되게|하게|받게|주게|열리|조건|스위치|변수|퀘스트|의뢰|이벤트|대사|대화|말\s*걸|말을\s*걸|선택지|전투|싸우|잠긴|퍼즐|컷신|장면|회상|엔딩|script|event|dialogue|quest/iu;

export interface JobFacets {
  /** 사람을 새로 세워 달라고 한다(사람 카드가 필요하다). */ readonly people: boolean;
  /** 조건·대사·사건을 짜 달라고 한다(이벤트 카드·이벤트 쓰기 도구가 필요하다). */ readonly logic: boolean;
  /** 있는 것을 옮기거나 지우기만 한다(카드가 필요 없다). */ readonly moveOnly: boolean;
}
export function jobFacets(topic: string): JobFacets {
  const people = ADD_PERSON.test(topic), logic = LOGIC.test(topic);
  return { people, logic, moveOnly: MOVE_OR_REMOVE.test(topic) && !people && !logic && !new RegExp(ADD, "u").test(topic) };
}

/** 작은 일에 늘 처음부터 싣는 도구 — 사람·사건·물건을 놓고, 옮기고, 지우고, 고치고, 본다. */
const SMALL_BASE: readonly string[] = ["add_people", "add_event", "place_object", "move_object", "move_event", "remove_event", "find_events", "get_event", "patch_event_page", "inspect", "restore_event", "ask_user", "read_specs"];
/** 사건을 짜는 일의 도구 — 첫째(upsert_event)는 주제 도구보다 먼저, 나머지는 뒤에 싣는다. */
const SMALL_LOGIC: readonly string[] = ["upsert_event", "add_event_page", "declare_story_flag", "run_scene_test"];
const SMALL_PEOPLE: readonly string[] = ["list_npc_graphics", "read_npc_layout"];
const SMALL_BY_TOPIC: Readonly<Partial<Record<GameTopic, readonly string[]>>> = {
  items: ["set_shop_stock", "get_database_records"],
  chest: ["place_chest"],
  maps: ["create_transfer_pair"],
  battle: ["upsert_troop", "simulate_battle"],
  fieldEnemy: ["place_field_enemy"],
  examine: ["place_examine_hotspots", "list_spatial_designs", "stamp_object"],
  ending: ["list_endings", "define_ending"],
  scene: ["add_scene"],
  hero: ["upsert_actor"],
  rename: ["upsert_actor"],
  opening: ["set_title_screen"],
  equipment: ["get_database_records"],
  status: ["get_database_records"],
  script: ["author_script", "edit_script"],
};
/** 작은 일의 처음 싣는 도구는 이 수를 넘기지 않는다(load_tools 한 자리는 따로). */
const SMALL_MAX = 19;

/**
 * 작은 일에 처음부터 실을 도구 이름(앞이 먼저) — 늘 싣는 것, 사건 쓰기, 주제가 부른 것, 사람 도구, 나머지 사건 도구 순. 넘치면 뒤를 자른다.
 * 여기 없는 도구는 필요할 때 싣는다(load_tools 설명에 이름이 뜨고, 이름으로 부르면 그 자리에서 실린다).
 */
export function smallJobTools(topics: readonly GameTopic[], facets: JobFacets, groups: ToolGroups, audio: AudioAsk, combat: CombatAsk): readonly string[] {
  // 무작위 조우를 말했으면 조우 표가 먼저다(사건 도구에 밀려 잘리지 않게).
  const byTopic = [...(combat.encounters ? ["set_encounter_table"] : []), ...topics.flatMap((key) => SMALL_BY_TOPIC[key] ?? [])];
  const dress = groups.dress ? V2_DRESS_TOOLS : [];
  const terrain = groups.terrain ? ["list_spatial_designs", "stamp_object", "fill_region"] : [];
  const sound = [...(audio.music ? ["recommend_bgm", "store_find_music", "store_install", "set_game_audio"] : []), ...(audio.sound ? ["store_find_sound", "store_install", "set_game_audio"] : [])];
  const store = groups.store ? groups.extra.filter((name) => name.startsWith("store_")) : [];
  // 사건 쓰기(upsert_event) 다음에 요청이 이름 댄 주제의 도구가 온다 — 수·글자 상한에 걸리면 뒤(덜 급한 것)가 필요할 때로 밀린다.
  const logic = facets.logic ? SMALL_LOGIC : [];
  const want = [...SMALL_BASE, ...logic.slice(0, 1), ...byTopic, ...dress, ...terrain, ...(facets.people ? SMALL_PEOPLE : []), ...logic.slice(1), ...sound, ...store];
  return [...new Set(want)].slice(0, SMALL_MAX);
}
