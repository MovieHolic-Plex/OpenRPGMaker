/**
 * 『이세계로 떠난 한국 고딩, 대본을 찢다』 이야기 탭(세계 개요·설정집·인물) 저작.
 *
 * 사실은 전부 빌더(isekaiGodding.ts · isekaiGoddingDb.ts)의 대사와 데이터에서 왔다. 빌더를 가져오지 않고 id 를 문자열로 적었다.
 * 조수 도구(set_world_canon · upsert_world_codex · upsert_character_profile)만 쓰니 몇 번을 불러도 같은 결과다.
 * 마왕의 정체와 결말 갈래는 visibility "ai-hidden" 으로 두어 조수의 새 글이 미리 새지 않게 한다.
 */
import type { Project } from "@/project/types";
import { loreExec, writeCodex, type CodexEntry, type CodexRelation, type LoreExec } from "./loreKit";

const MAP = {
  class: "map_ig_class",
  hall: "map_ig_hall",
  capital: "map_ig_capital",
  guild: "map_ig_guild",
  forest: "map_ig_forest",
  goblin: "map_ig_goblin",
  castle: "map_ig_castle",
  castle2: "map_ig_castle_f2",
} as const;

const CANON_BODY = [
  "세계",
  "아르벤 왕국은 몇 해마다 다른 세계에서 용사를 불러온다. 왕궁에는 용사가 할 일을 장과 절로 적은 300년 된 「용사 대본」이 한 부 있다. 일곱 장이고, 마지막 장은 「용사는 마왕성에 들어간다」 한 줄뿐이다. 앞서 불려 온 여섯 용사는 대본대로 했고 아무도 돌아오지 않았다.",
  "대본에는 기사에게도 보여 주지 않는 7장 부록이 있다. 「용사와 마왕은 함께 쓰러진다.」 마왕이 쓰러지면 마왕의 왕좌가 터지고, 홀로 앞에 선 용사도 함께 끝난다. 왕국은 그 보고서(「용사 낙오」)로 다음 용사 예산을 받는다.",
  "귀환 주문서는 마왕성 꼭대기에 한 장 있다. 첫 줄은 「귀환 1인」이고, 그 밑 작은 글씨는 「단, 미성년 소환자는 보호자 1인 동반 가능」이다.",
  "장소",
  "왕도 아르벤은 광장을 둘러싼 중세풍 도시다. 광장 앞 큰 건물이 모험가 길드 「은빛 술잔」이고, 1층은 선술집이다. 서쪽 큰길 끝이 왕궁, 동쪽 성문 밖이 숲길이다. 숲길 끝에는 사람과 고블린이 반반 사는 반반 마을이 있고, 마을 북쪽 숲 위에 마왕성이 있다.",
  "사람들",
  "고2 강민재는 야간 자율 학습 중에 일곱 번째 용사로 소환됐다. 내일이 모의고사이고 폰 배터리는 3%다. 소리치지 않는다. 무기는 끝까지 읽는 버릇이다 — 대본, 장부, 시험지, 주문서의 작은 글씨.",
  "기사 에델은 이번이 일곱 번째 용사 호위다. 앞의 여섯이 모두 「낙오」로 적힌 것을 안다. 엘프 마법사 피오는 마탑 실기는 늘 만점인데 필기에서 일곱 번 떨어졌다. 문제를 끝까지 안 읽는다. 고블린 족장 꾸르는 30년 동안 반반 마을 길을 닦은 보수 장부를 들고 다닌다.",
  "이야기 흐름",
  "소환의 방에서 시작해 길드 등록, 동쪽 숲의 슬라임, 반반 마을의 장부 맞추기, 마왕성의 성문 시험과 대본 감독관을 지나 꼭대기의 마왕에게 간다.",
  "톤",
  "건조한 코미디다. 판돈은 진짜다(앞 용사 여섯, 주문서 한 장). 인물은 소리가 아니라 구체적인 욕망과 장부로 웃긴다. 화면이 농담에 박수를 치지 않는다.",
].join("\n\n");

const ENTRIES: readonly CodexEntry[] = [
  {
    id: "ig_place_hall", type: "place", name: "왕궁 소환의 방",
    summary: "용사를 불러오는 왕궁 한가운데의 긴 홀. 이야기가 시작되는 곳.",
    body: "옥좌 앞 붉은 융단 위에 소환진이 그려진다. 양옆 방은 어전 회의실, 보물고, 무기고, 예배당, 숙소다. 보물고 상자에는 「용사 활동비 장부」가 붙어 있는데 아무도 적지 않았다.",
    tags: ["장소", "왕궁"], refs: [{ kind: "map", id: MAP.hall }, { kind: "event", id: "ev_ig_h_summon" }], source: "map_ig_hall, 소환 장면",
  },
  {
    id: "ig_place_capital", type: "place", name: "왕도 아르벤",
    summary: "광장을 둘러싼 왕국의 수도. 길드와 장터가 있고 동쪽 성문이 숲길로 이어진다.",
    body: "광장 장터에서 불꽃고추를 판다. 상인의 외상 장부에는 저번 용사 이름이 아직 있다. 동쪽 성문은 근위병이 지키고, 길드 등록증이 없으면 성 밖으로 나갈 수 없다.",
    tags: ["장소", "도시"], refs: [{ kind: "map", id: MAP.capital }, { kind: "event", id: "ev_ig_c_guard" }], source: "map_ig_capital",
  },
  {
    id: "ig_place_guild", type: "place", name: "모험가 길드 「은빛 술잔」",
    summary: "왕도 광장 앞의 길드. 1층은 선술집, 안쪽에 주방과 창고가 있다.",
    body: "등록 창구는 늘 몸싸움이었다. 민재가 「접수 한 명에 1분, 싸우면 10분」으로 줄을 세웠고, 세운 사람도 맨 뒤에 섰다. 길드는 용사 한 명 등록할 때마다 왕궁에서 돈을 받는다. 첫 등록 등급은 「견습」.",
    tags: ["장소", "길드"], refs: [{ kind: "map", id: MAP.guild }, { kind: "event", id: "ev_ig_g_scene" }], source: "map_ig_guild, 길드 줄 장면",
  },
  {
    id: "ig_place_forest", type: "place", name: "동쪽 숲길",
    summary: "왕도 동쪽 성문과 반반 마을 사이의 구불구불한 숲길. 슬라임이 나온다.",
    body: "빈터의 이정표에는 「통행세 받음. 도로 보수 30년째」라고 적혀 있다. 저번 용사는 여기까지 왔다.",
    tags: ["장소", "숲"], refs: [{ kind: "map", id: MAP.forest }, { kind: "event", id: "ev_ig_f_slime" }], source: "map_ig_forest",
  },
  {
    id: "ig_place_goblin", type: "place", name: "반반 마을",
    summary: "사람과 고블린이 반반 사는 숲속 마을. 30년 동안 장부로 다퉜다.",
    body: "고블린은 30년 동안 길을 닦았고, 사람들은 그 대신 밭을 내줬다. 두 장부의 합계는 은화 열두 닢 차이였다. 촌장은 사람이고, 고블린 쪽 대표는 족장 꾸르다.",
    tags: ["장소", "마을"], refs: [{ kind: "map", id: MAP.goblin }, { kind: "event", id: "ev_ig_v_goblin" }], source: "map_ig_goblin, 장부 외교 장면",
  },
  {
    id: "ig_place_castle", type: "place", name: "마왕성",
    summary: "반반 마을 북쪽 숲 위의 성. 두 층이고, 꼭대기에 마왕과 귀환 주문서가 있다.",
    body: "1층 통로에서는 해골 시험관이 출입 시험을 내고, 계단 앞은 왕국 대본 감독관이 지킨다. 위층에서는 연필 긁는 소리가 난다. 창고 상자에 2009년 쪽지가 있다.",
    tags: ["장소", "던전"], refs: [{ kind: "map", id: MAP.castle }, { kind: "map", id: MAP.castle2 }], source: "map_ig_castle, map_ig_castle_f2",
  },
  {
    id: "ig_char_minjae", type: "character", name: "강민재",
    summary: "고2. 야자 중에 소환된 일곱 번째 용사. 내일이 모의고사다.",
    body: "폰 배터리는 3%다. 떡볶이를 좋아한다. 소리치지 않는다. 대본도 장부도 시험지도 끝까지 읽고, 작은 글씨에서 길을 찾는다. 길드 등록 직업은 「고등학생」이다.",
    tags: ["인물", "주인공"], refs: [{ kind: "actor", id: "actor_hero" }], source: "소환·길드 장면, 배우 DB",
  },
  {
    id: "ig_char_edel", type: "character", name: "에델",
    summary: "왕국 기사. 이번이 일곱 번째 용사 호위다.",
    body: "앞의 여섯 용사를 모두 모셨고, 여섯 모두 「낙오」로 적힌 보고서를 안다. 7장 부록은 기사에게 보여 주지 않아 몰랐다. 의전비를 자기 지갑에서 낸다.",
    tags: ["인물", "동료"], refs: [{ kind: "actor", id: "actor_ig_edel" }], source: "소환 장면, 감독관 장면",
  },
  {
    id: "ig_char_fio", type: "character", name: "피오",
    summary: "엘프 마법사. 마탑 실기는 만점, 필기는 일곱 번 낙방.",
    body: "문제를 끝까지 안 읽는다. 일곱 번 떨어지면 길드 등록만 되는데, 그날이 민재가 온 날이었다. 용사 파티에 들면 마탑 추천서가 나온다.",
    tags: ["인물", "동료"], refs: [{ kind: "actor", id: "actor_ig_fio" }], source: "길드 장면, 성문 시험",
  },
  {
    id: "ig_char_kkur", type: "character", name: "꾸르",
    summary: "반반 마을 고블린 족장. 30년 치 도로 보수 장부를 쓴다.",
    body: "말이 짧고 계산이 정확하다. 장부에 없는 것은 없는 것이다. 장부를 끝까지 읽는 인간을 처음 보고 따라나선다.",
    tags: ["인물", "동료"], refs: [{ kind: "actor", id: "actor_ig_kkur" }], source: "반반 마을 장면",
  },
  {
    id: "ig_char_king", type: "character", name: "국왕 루드릭",
    summary: "아르벤 왕국의 왕. 용사 대본을 믿는다.",
    body: "마지막 장은 용사가 읽는 것이 아니라고 한다. 「모의고사」를 마물 이름으로 안다.",
    tags: ["인물", "왕국"], refs: [{ kind: "event", id: "ev_ig_h_king" }], source: "소환 장면",
  },
  {
    id: "ig_char_dean", type: "character", name: "대본 감독관",
    summary: "용사가 대본대로 끝나는지 확인하는 왕국 공무원.",
    body: "마왕성 계단 앞을 지킨다. 7장 부록을 알고, 앞 용사들을 「용사 낙오」로 보고했다. 말투가 교무부장 선생님 같다.",
    tags: ["인물", "왕국"], refs: [{ kind: "event", id: "ev_ig_k1_dean" }], source: "마왕성 1층",
  },
  {
    id: "ig_char_maou", type: "character", name: "마왕",
    summary: "마왕성 꼭대기의 마왕. 귀환 주문서를 지킨다.",
    body: "왕국 사람들은 마왕이 왜 주문서를 쓰지 않고 지키기만 하는지 모른다. 회색 교복을 입고 있다.",
    tags: ["인물", "마왕"], refs: [{ kind: "event", id: "ev_ig_k2_maou" }], source: "마왕 장면",
  },
  {
    id: "ig_secret_maou", type: "concept", name: "마왕의 정체",
    summary: "마왕은 2009년 수능 전날 소환된 한국 고3 배재민이다.",
    body: "대본대로 전 마왕을 쓰러뜨렸고, 부록을 읽고 쓰러지지 않았다. 대신 마왕 자리에 앉았다. 돌아가면 수능을 봐야 해서 15년 동안 주문서를 들고만 있었다. 마왕 노릇이 수능보다 쉬웠다고 한다. 1층 창고에 「2009. 11. 11. 수능 D-1. 배고프다」 쪽지가 남아 있다.",
    tags: ["비밀"], visibility: "ai-hidden", source: "마왕 장면, 창고 쪽지",
  },
  {
    id: "ig_item_script", type: "item", name: "용사 대본",
    summary: "용사가 할 일을 장과 절로 적은 왕국의 의전서. 한 부뿐이다.",
    body: "2장 「용사 등록은 줄을 안 선다」, 4장 「용사는 홀로 앞에 선다」, 5장 「용사는 고블린을 벤다」, 7장 「용사는 마왕성에 들어간다」. 7장 부록 「용사와 마왕은 함께 쓰러진다」는 감독관만 안다.",
    tags: ["물건", "왕국"], source: "에델·감독관 대사",
  },
  {
    id: "ig_item_tteok", type: "item", name: "이세계 떡볶이",
    summary: "여관 주인이 불꽃고추로 처음 만든 떡볶이.",
    body: "광장 상인의 불꽃고추를 가져가면 길드 주방에서 만들어 준다. 학교 앞 분식집 맛과 조금 다르지만 그 맛이다.",
    tags: ["물건", "음식"], refs: [{ kind: "item", id: "item_ig_tteokbokki" }, { kind: "item", id: "item_ig_fire_chili" }], source: "여관 주인 부탁",
  },
  {
    id: "ig_term_chaos", type: "concept", name: "대본 이탈",
    summary: "대본을 어긴 선택의 수. 화면에는 안 보인다.",
    body: "대본 찢기, 국고에 손대기, 줄 세우기, 다 같이 싸우기, 청구서를 왕궁으로 돌리기 같은 선택에서 오른다. 7장 부록 결말의 왕국 연대기 한 줄이 이 수로 바뀐다.",
    tags: ["규칙"], source: "var_ig_chaos",
  },
  {
    id: "ig_scene_ledger", type: "event", name: "반반 마을 장부 맞추기",
    summary: "30년 다툰 두 장부를 나란히 펴 보니 은화 열두 닢 차이였다.",
    body: "열두 닢만 정산하거나, 입장료를 받아 반반 나누거나, 청구서를 왕궁으로 돌린다. 말이 안 통하면 꾸르와 몸으로 부딪친다.",
    tags: ["사건"], refs: [{ kind: "event", id: "ev_ig_v_goblin" }], source: "반반 마을 장면",
  },
  {
    id: "ig_end_routes", type: "event", name: "세 갈래 결말",
    summary: "꼭대기에서 고르는 말이 결말을 가른다.",
    body: "「주문서, 끝까지 읽어 봤어요?」면 보호자 동반 조항으로 둘 다 교실로 간다(모의고사 날 아침). 떡볶이를 가져왔다면 마왕이 한 접시를 비우는 동안 둘 다 남는다(주문서는 아직 한 장). 「주문서 내놔요」면 부록대로 왕좌가 터지고 주문서도 탄다(7장 부록).",
    tags: ["결말"], visibility: "ai-hidden", source: "define_ending 셋",
  },
];

const RELATIONS: readonly CodexRelation[] = [
  { a: "ig_char_edel", b: "ig_char_minjae", kind: "allyOf", note: "의전 담당 호위" },
  { a: "ig_char_fio", b: "ig_char_minjae", kind: "allyOf", note: "끝까지 읽기 연습" },
  { a: "ig_char_kkur", b: "ig_char_minjae", kind: "allyOf", note: "장부를 맞춘 사이" },
  { a: "ig_char_king", b: "ig_place_hall", kind: "locatedIn" },
  { a: "ig_char_edel", b: "ig_item_script", kind: "custom", note: "일곱 번째로 읽어 준다" },
  { a: "ig_char_fio", b: "ig_place_guild", kind: "locatedIn", note: "처음 만난 곳" },
  { a: "ig_char_kkur", b: "ig_place_goblin", kind: "locatedIn" },
  { a: "ig_char_maou", b: "ig_place_castle", kind: "locatedIn", note: "꼭대기" },
  { a: "ig_secret_maou", b: "ig_char_maou", kind: "custom", note: "정체" },
  { a: "ig_char_maou", b: "ig_char_minjae", kind: "custom", note: "같은 학교 선배" },
  { a: "ig_scene_ledger", b: "ig_place_goblin", kind: "locatedIn" },
  { a: "ig_char_dean", b: "ig_place_castle", kind: "locatedIn", note: "계단 앞" },
  { a: "ig_item_tteok", b: "ig_place_guild", kind: "causedBy", note: "길드 주방에서 만든다" },
  { a: "ig_end_routes", b: "ig_char_maou", kind: "causedBy" },
  { a: "ig_place_forest", b: "ig_place_capital", kind: "custom", note: "동쪽 성문 밖" },
  { a: "ig_place_goblin", b: "ig_place_forest", kind: "custom", note: "숲길 끝" },
  { a: "ig_place_castle", b: "ig_place_goblin", kind: "custom", note: "마을 북쪽" },
];

interface ProfileSeed { readonly characterId: string; readonly displayName: string; readonly note: string; readonly nameColor: string }
/** displayName 은 대사 화자 이름과 같아야 이름 색이 붙는다(키트 CAST 의 이름). */
const PROFILES: readonly ProfileSeed[] = [
  { characterId: "minjae", displayName: "민재", note: "고2 강민재. 야자 중에 소환된 일곱 번째 용사. 내일이 모의고사다.", nameColor: "#4a8fe0" },
  { characterId: "edel", displayName: "에델", note: "왕국 기사. 일곱 번째 용사 호위.", nameColor: "#d9a63a" },
  { characterId: "fio", displayName: "피오", note: "엘프 마법사. 마탑 필기 일곱 번 낙방.", nameColor: "#5bb86a" },
  { characterId: "kkur", displayName: "꾸르", note: "반반 마을 고블린 족장. 도로 보수 장부 담당.", nameColor: "#8a9a3a" },
  { characterId: "maou", displayName: "마왕", note: "마왕성 꼭대기의 마왕. 귀환 주문서를 지킨다.", nameColor: "#a85adb" },
  { characterId: "jaemin", displayName: "배재민", note: "2009년 수능 전날 소환된 한국 고3. 15년째 마왕.", nameColor: "#a85adb" },
  { characterId: "king", displayName: "국왕 루드릭", note: "아르벤 왕국의 왕. 용사 대본을 믿는다.", nameColor: "#c9483a" },
];

export function applyIsekaiGoddingLore(project: Project, exec: LoreExec = loreExec): void {
  exec(project, "set_world_canon", {
    canon: {
      name: "아르벤 왕국 (용사 대본)",
      premise: "고2 강민재가 야자 중에 이세계 아르벤 왕국에 일곱 번째 용사로 소환된다. 내일은 모의고사다. 앞 용사 여섯은 대본대로 했고 아무도 돌아오지 않았다. 민재는 대본을 끝까지 읽는다.",
      tones: ["comic", "political", "slice"],
      era: "중세풍 판타지 왕국 (주인공은 현대 한국 고등학생)",
      techCeiling: "중세. 마법 수정구로 여럿이 말을 주고받는다",
      absences: ["총기", "피 묘사", "현대 전자기기 충전"],
      laws: {
        power: { present: true, note: "마법은 외워서 쓴다. 마탑 승급 시험이 있다." },
        gods: { present: true, note: "대신관이 용사 소환 의식을 집전한다." },
        death: { present: false, note: "전투에서 진 쪽은 쓰러졌다 일어난다. 아무도 죽지 않는다." },
        money: { present: true, note: "은화. 불꽃고추 한 줌에 다섯 닢, 고블린 통행세는 한 명에 세 닢." },
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
