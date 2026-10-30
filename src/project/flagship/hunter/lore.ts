/**
 * 「사냥꾼 계약」 이야기 탭(세계 개요·설정집·인물). 사실은 빌더의 대사와 데이터, 설계 문서에서 왔다.
 * 오스벤·리스크의 진실과 결말은 ai-hidden 으로 둔다.
 */
import type { Project } from "@/project/types";
import { loreExec, writeCodex, type CodexEntry, type CodexRelation, type LoreExec } from "../loreKit";

const CANON_BODY = [
  "세계",
  "서쪽 변경. 늪과 항구와 무너진 산성 사이를 사냥꾼들이 계약서 한 장씩 들고 다닌다. 길드는 이름 있는 계약만 받는다. 도르반은 길드에서 쫓겨나 이름 없는 계약을 받는다. 삯은 은화로 받고, 머리를 가져와야 나머지를 받는다.",
  "물에 빠져 죽은 것은 셋째 날 밤에 올라온다. 사람들은 그것을 익사귀라 부른다. 불에 약하고 은을 싫어한다. 쇠는 가죽에서 미끄러진다.",
  "장소",
  "갈대늪은 늪 위 수상 마을이다. 두 해째 굶는다. 버들항은 성벽 두른 항구 도시로, 하수도에서 사람이 사라진다. 회색봉은 산 위의 무너진 성채 마을이다. 옛 성주의 망령이 성 아래를 지킨다.",
  "사람들",
  "도르반은 마흔 줄의 떠돌이 사냥꾼이다. 도제 리스크가 석 달 전 회색봉 계약을 혼자 받아 나가 돌아오지 않았다. 리스크가 남긴 계약서 사본 세 장이 갈대늪·버들항·회색봉을 가리킨다. 셋째 장 의뢰인의 이름은 지워져 있다.",
  "톤",
  "짧은 평서문. 감정은 행동으로만 보인다. 누구나 무언가를 숨기거나 값을 깎는다. 선한 쪽이 따로 없다. 폭력과 죽음은 담담하게, 결과만 적는다.",
].join("\n\n");

const ENTRIES: readonly CodexEntry[] = [
  { id: "hc_char_doran", type: "character", name: "도르반", summary: "마흔 줄의 떠돌이 사냥꾼. 길드에서 쫓겨나 이름 없는 계약만 받는다.",
    body: "칼을 스무 해 갈았다. 말이 짧고 값을 먼저 묻는다. 도제 리스크를 찾아 사본 세 장을 따라간다. 남은 은화는 열한 닢에서 시작한다.", tags: ["인물", "주인공"], refs: [{ kind: "actor", id: "actor_hero" }] },
  { id: "hc_char_risk", type: "character", name: "리스크", summary: "도르반의 도제. 석 달 전 회색봉 계약을 혼자 받아 나갔다.",
    body: "계약서 사본을 세 장 남겼다. 귀퉁이마다 메모를 적는 버릇이 있다(갈대늪 사본에는 「셋째 날」).", tags: ["인물", "도제"] },
  { id: "hc_char_marta", type: "character", name: "하그네", summary: "갈대늪 촌장. 익사자 처리 계약을 냈다.",
    body: "늪 여관에 묵는다. 손가락이 앙상하고 반지 자국만 굵다. 「삯은 머리를 가져오면 준다. 반은 지금. 나머지는 냄새가 빠지고 나서.」", tags: ["인물", "갈대늪"], refs: [{ kind: "map", id: "hc_swamp_inn" }] },
  { id: "hc_char_boatman", type: "character", name: "뱃사공 오그", summary: "갈대늪의 늙은 뱃사공. 셋째 날 밤 규칙을 안다.",
    body: "물이 무거우면 배를 안 띄운다. 떠돌이들을 누가 늪 길로 데려갔는지 묻지 않는다.", tags: ["인물", "갈대늪"], refs: [{ kind: "map", id: "hc_swamp" }] },
  { id: "hc_char_sena", type: "character", name: "어부의 아내 세나", summary: "갈대늪 사람. 딸이 밤마다 물가에 밥을 놓는다.",
    body: "딸은 「동생들」 준다고 한다. 그 애는 동생이 없다.", tags: ["인물", "갈대늪"] },
  { id: "hc_char_veil", type: "character", name: "여관 주인 베일", summary: "갈대늪 여관 주인. 불씨 기름과 약초 물을 판다.",
    body: "방은 은화 다섯, 밥은 없다. 불씨 기름 은화 마흔(마을이 사냥꾼을 반기면 서른).", tags: ["인물", "갈대늪", "상점"] },
  { id: "hc_place_world", type: "place", name: "서쪽 변경", summary: "갈대늪·버들항·회색봉이 있는 땅. 세 곳 사이를 걸어서 다닌다.",
    body: "남서쪽 늪, 동쪽 내해 항구, 북동쪽 산줄기 위 폐성. 빠른 이동은 없다.", tags: ["장소", "세계 지도"], refs: [{ kind: "map", id: "hc_world" }] },
  { id: "hc_place_swamp", type: "place", name: "갈대늪", summary: "늪 위 수상 마을. 두 해째 굶는다.",
    body: "널판 길과 수상 가옥. 광장 서쪽 둔덕이 장례 마당이다. 남쪽 물가 너머가 늪 깊은 곳이다. 낮에는 물이 허리까지 찬다.", tags: ["장소", "마을"], refs: [{ kind: "map", id: "hc_swamp" }] },
  { id: "hc_place_inn", type: "place", name: "갈대늪 여관", summary: "늪 마을의 여관. 벽에 게시판이 있다.",
    body: "게시판에 익사자 처리 계약이 붙어 있다. 촌장 하그네가 창가 탁자에 앉아 있다. 짚 침대에서 밤까지 쉴 수 있다.", tags: ["장소", "실내"], refs: [{ kind: "map", id: "hc_swamp_inn" }] },
  { id: "hc_place_nest", type: "place", name: "늪 깊은 곳", summary: "익사귀 둥지. 밤에만 들어갈 수 있다.",
    body: "둔덕과 웅덩이 사이로 익사귀가 셋 돌아다닌다. 가장 안쪽 웅덩이에 물에 잠긴 어미가 있다.", tags: ["장소", "던전"], refs: [{ kind: "map", id: "hc_nest" }] },
  { id: "hc_place_harbor", type: "place", name: "버들항", summary: "성벽 두른 항구 도시. 하수도에서 사람이 사라진다.",
    body: "경비대·상인 조합·밀수꾼이 서로를 탓한다. 리스크의 둘째 사본이 가리킨다.", tags: ["장소", "도시"] },
  { id: "hc_place_castle", type: "place", name: "회색봉", summary: "산 위의 무너진 성채 마을. 리스크가 마지막으로 간 곳.",
    body: "옛 성주의 망령과 납골당. 마을에 남은 사람은 셋뿐이다.", tags: ["장소", "폐성"] },
  { id: "hc_monster_drowner", type: "concept", name: "익사귀", summary: "물에 빠져 죽은 것. 셋째 날 밤에 올라온다.",
    body: "불에 약하고(두 배) 은을 싫어한다(한 배 반). 물은 듣지 않는다. 쇠 칼은 반만 들어간다. 낮에는 물 밑에 있다.", tags: ["괴물", "도감"] },
  { id: "hc_item_oil", type: "item", name: "불씨 기름", summary: "칼에 바르면 한 번 싸우는 동안 불이 붙는다.",
    body: "늪 기름에 송진과 유황을 섞었다. 물에 잠긴 어미는 기름 없이 베면 상처를 늪물로 메운다.", tags: ["아이템", "준비"], refs: [{ kind: "item", id: "item_hc_ember_oil" }] },
  { id: "hc_item_copies", type: "item", name: "계약서 사본 세 장", summary: "리스크가 남긴 사본. 갈대늪·버들항·회색봉.",
    body: "셋째 장의 의뢰인 이름은 지워져 있다. 세 계약의 봉랍은 같은 도장이다.", tags: ["아이템", "줄기"], refs: [{ kind: "item", id: "item_hc_copy_reed" }] },
  { id: "hc_secret_mother", type: "event", name: "물에 잠긴 어미", summary: "갈대늪 익사귀의 어미.",
    body: "굶은 해에 마을이 아이 셋을 물에 보냈다. 어미가 따라 들어갔다. 익사귀는 그 아이들이다. 그 뒤로 마을은 떠돌이를 물가에 세워 어미를 먹였다. 반지 안쪽에 하그네의 이름이 있다.", tags: ["비밀", "계약 A"], visibility: "ai-hidden" },
  { id: "hc_secret_osben", type: "event", name: "셋째 장의 이름", summary: "세 계약의 공통 의뢰인.",
    body: "버들항 상인 조합의 오스벤. 회색봉 성 아래 은광맥을 노린다. 세 괴물은 사람을 쫓아내려고 일부러 풀어 둔 것이다. 리스크는 망령 성주 편에 섰다.", tags: ["비밀", "결말"], visibility: "ai-hidden" },
];

const RELATIONS: readonly CodexRelation[] = [
  { a: "hc_char_risk", b: "hc_char_doran", kind: "knows", note: "도제" },
  { a: "hc_char_marta", b: "hc_place_inn", kind: "locatedIn" },
  { a: "hc_char_boatman", b: "hc_place_swamp", kind: "locatedIn" },
  { a: "hc_char_sena", b: "hc_place_swamp", kind: "locatedIn" },
  { a: "hc_char_veil", b: "hc_place_inn", kind: "owns" },
  { a: "hc_place_nest", b: "hc_place_swamp", kind: "custom", note: "남쪽 물가 너머" },
  { a: "hc_monster_drowner", b: "hc_place_nest", kind: "locatedIn" },
  { a: "hc_secret_mother", b: "hc_char_marta", kind: "causedBy" },
  { a: "hc_item_copies", b: "hc_char_risk", kind: "owns" },
  { a: "hc_secret_osben", b: "hc_place_castle", kind: "custom", note: "은광맥" },
];

const PROFILES = [
  { characterId: "doran", displayName: "도르반", note: "떠돌이 사냥꾼. 도제를 찾는다.", nameColor: "#c9a86a" },
  { characterId: "marta", displayName: "하그네", note: "갈대늪 촌장. 의뢰인.", nameColor: "#9a8fb8" },
  { characterId: "boatman", displayName: "뱃사공 오그", note: "갈대늪 뱃사공.", nameColor: "#7fa0a8" },
  { characterId: "sena", displayName: "어부의 아내 세나", note: "갈대늪 사람.", nameColor: "#a8907a" },
  { characterId: "veil", displayName: "여관 주인 베일", note: "갈대늪 여관 주인.", nameColor: "#8a9a6a" },
] as const;

export function applyHunterLore(project: Project, exec: LoreExec = loreExec): void {
  exec(project, "set_world_canon", {
    canon: {
      name: "서쪽 변경 (사냥꾼 계약)",
      premise: "떠돌이 사냥꾼 도르반이 사라진 도제 리스크가 남긴 계약서 사본 세 장을 따라 갈대늪·버들항·회색봉을 간다. 계약마다 조사하고 준비하고 싸우고, 끝에 무엇을 할지 고른다. 그 선택은 다른 곳에서 돌아온다.",
      tones: ["grim", "gothic", "political"],
      era: "중세풍 변경",
      techCeiling: "중세. 불씨 기름과 은박 칼",
      absences: ["영웅 서사", "개그", "귀여운 동물 동료"],
      laws: {
        power: { present: true, note: "마법은 거의 없다. 사냥꾼은 기름·은·불로 싸운다." },
        gods: { present: true, note: "순례자가 성수를 판다. 신이 대답한 적은 없다." },
        death: { present: true, note: "물에 빠져 죽은 것은 셋째 날 밤에 올라온다." },
        money: { present: true, note: "은화. 익사자 머리 하나에 은화 30, 불씨 기름 40, 여관 방 5." },
      },
      body: CANON_BODY,
      status: "canon",
    },
  });
  writeCodex(project, exec, ENTRIES, RELATIONS);
  for (const profile of PROFILES) {
    const existing = project.characters?.[profile.characterId];
    exec(project, "upsert_character_profile", {
      characterId: profile.characterId,
      profile: {
        displayName: existing?.displayName?.trim() ? existing.displayName : profile.displayName,
        note: existing?.note?.trim() ? existing.note : profile.note,
        dialogue: { ...(existing?.dialogue ?? {}), nameColor: existing?.dialogue?.nameColor ?? profile.nameColor },
      },
    });
  }
}
