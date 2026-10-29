/**
 * 『이세계로 떠난 한국 고딩, 깽판치다』 이야기 탭(세계 개요·설정집·인물) 저작.
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
  "아르벤 왕국은 마왕이 나타날 때마다 다른 세계에서 용사를 불러온다. 왕궁에는 용사가 할 일을 장과 절로 적은 「용사 대본」이 있다. 1장 1절은 「용사는 왕께 무릎을 꿇는다」, 7장 3절은 「용사는 마왕을 벤다」다. 마왕성 장은 비어 있다. 앞서 불려 온 용사들이 모두 마왕성에서 끝났기 때문이다.",
  "귀환 주문서는 마왕성 꼭대기에 있고, 마왕이 지킨다. 그것 말고는 용사를 돌려보낼 방법이 없다.",
  "장소",
  "왕도 아르벤은 광장을 둘러싼 중세풍 도시다. 광장 앞 큰 건물이 모험가 길드 「은빛 술잔」이고, 1층은 선술집이다. 서쪽 큰길 끝이 왕궁, 동쪽 성문 밖이 숲길이다. 숲길 끝에는 사람과 고블린이 반반 사는 반반 마을이 있고, 마을 북쪽 숲 위에 마왕성이 있다.",
  "사람들",
  "고2 강민재는 야간 자율 학습 중에 소환됐다. 내일이 모의고사이고 폰 배터리는 3%다. 왕국은 그가 대본대로 움직이길 바라지만, 민재는 PC방 점사 오더와 급식 줄 세우기, 학원식 요점 정리와 단톡방으로 문제를 푼다.",
  "의전 기사 에델은 대본을 외워 다닌다. 엘프 마법사 피오는 마탑 승급 시험에 일곱 번 떨어졌다. 반반 마을의 고블린 족장 꾸르는 말이 서툴고 성미가 급하다.",
  "이야기 흐름",
  "소환의 방에서 시작해 길드 등록, 동쪽 숲의 슬라임, 반반 마을의 단톡방 외교, 마왕성의 기출 함정과 교무부장을 지나 꼭대기의 마왕에게 간다. 대본을 어길 때마다 깽판 지수가 오른다.",
  "톤",
  "코미디다. 이세계의 엄숙한 의례 앞에서 한국 고등학생의 생활 감각이 늘 이긴다. 웃음은 민재가 판타지 문제를 학교 문제로 바꿔 푸는 데서 나온다. 악역도 결국 사연 있는 사람이다.",
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
    body: "광장 장터에서 불꽃고추를 판다. 동쪽 성문은 근위병이 지키고, 길드 등록증이 없으면 성 밖으로 나갈 수 없다. 남쪽으로 강이 흐른다.",
    tags: ["장소", "도시"], refs: [{ kind: "map", id: MAP.capital }, { kind: "event", id: "ev_ig_c_guard" }], source: "map_ig_capital",
  },
  {
    id: "ig_place_guild", type: "place", name: "모험가 길드 「은빛 술잔」",
    summary: "왕도 광장 앞의 길드. 1층은 선술집, 안쪽에 주방과 창고가 있다.",
    body: "등록 창구는 늘 몸싸움이었는데, 민재가 줄을 세운 뒤로 「민재 규칙」이 길드 공식 규칙이 됐다. 첫 등록 등급은 「돌멩이」다. 주방의 여관 주인은 처음 듣는 요리도 만들어 본다.",
    tags: ["장소", "길드"], refs: [{ kind: "map", id: MAP.guild }, { kind: "event", id: "ev_ig_g_scene" }], source: "map_ig_guild, 길드 줄 장면",
  },
  {
    id: "ig_place_forest", type: "place", name: "동쪽 숲길",
    summary: "왕도 동쪽 성문과 반반 마을 사이의 구불구불한 숲길. 슬라임이 나온다.",
    body: "빈터의 이정표에는 「통행세 받음. 고블린 일동」이라고 적혀 있다.",
    tags: ["장소", "숲"], refs: [{ kind: "map", id: MAP.forest }, { kind: "event", id: "ev_ig_f_slime" }], source: "map_ig_forest",
  },
  {
    id: "ig_place_goblin", type: "place", name: "반반 마을",
    summary: "사람과 고블린이 반반 사는 숲속 마을. 요즘 서로 말이 안 통해 다툰다.",
    body: "고블린은 길을 닦았다며 통행세를 받고, 사람들은 밭에 울타리를 쳤다. 촌장은 사람이고, 고블린 쪽 대표는 족장 꾸르다. 피오의 통신 수정구로 「반반 마을 공지방」이 생긴 뒤로 알림이 그치지 않는다.",
    tags: ["장소", "마을"], refs: [{ kind: "map", id: MAP.goblin }, { kind: "event", id: "ev_ig_v_goblin" }], source: "map_ig_goblin, 단톡방 외교 장면",
  },
  {
    id: "ig_place_castle", type: "place", name: "마왕성",
    summary: "반반 마을 북쪽 숲 위의 성. 두 층이고, 꼭대기에 마왕과 귀환 주문서가 있다.",
    body: "1층 통로에서는 해골 출제 위원이 출입 시험을 내고, 계단 앞은 교무부장이 지킨다. 위층에서는 연필 긁는 소리가 난다.",
    tags: ["장소", "던전"], refs: [{ kind: "map", id: MAP.castle }, { kind: "map", id: MAP.castle2 }], source: "map_ig_castle, map_ig_castle_f2",
  },
  {
    id: "ig_char_minjae", type: "character", name: "강민재",
    summary: "고2. 야자 중에 소환된 자칭 임시 용사. 내일이 모의고사다.",
    body: "폰 배터리는 3%다. 떡볶이를 좋아한다. 대본을 따르지 않고, PC방에서 배운 점사 오더와 급식 줄 세우기와 단톡방으로 문제를 푼다. 길드 등록 직업은 「고등학생」이다.",
    tags: ["인물", "주인공"], refs: [{ kind: "actor", id: "actor_hero" }], source: "소환·길드 장면, 배우 DB",
  },
  {
    id: "ig_char_edel", type: "character", name: "에델",
    summary: "왕국 기사. 의전 담당이라 용사 대본을 통째로 외운다.",
    body: "말끝마다 대본의 장과 절을 읊는다. 민재가 대본을 어길 때마다 운다. 결국 대본 마지막 장은 자기가 쓰겠다고 한다.",
    tags: ["인물", "동료"], refs: [{ kind: "actor", id: "actor_ig_edel" }], source: "소환 장면, 결말",
  },
  {
    id: "ig_char_fio", type: "character", name: "피오",
    summary: "엘프 마법사. 마탑 승급 시험에 일곱 번 떨어졌다.",
    body: "파이어볼 주문은 다 외웠지만 기출을 풀어 본 적이 없었다. 민재에게 요점 정리를 배운 뒤 「기출 변형 파이어볼」을 쓴다. 통신 수정구를 빌려준 사람이다.",
    tags: ["인물", "동료"], refs: [{ kind: "actor", id: "actor_ig_fio" }, { kind: "item", id: "item_ig_crystal" }], source: "길드 장면",
  },
  {
    id: "ig_char_kkur", type: "character", name: "꾸르",
    summary: "반반 마을 고블린 족장. 단톡방의 부방장.",
    body: "말이 짧고 「꾸르르」로 감정을 낸다. 사람들이 밭을 밟는다며 화가 나 있었다. 말이 통하자 닭을 돌려주기로 하고 민재를 따라나선다.",
    tags: ["인물", "동료"], refs: [{ kind: "actor", id: "actor_ig_kkur" }], source: "반반 마을 장면",
  },
  {
    id: "ig_char_king", type: "character", name: "국왕 루드릭",
    summary: "아르벤 왕국의 왕. 용사 대본을 믿는다.",
    body: "용사를 불러 놓고 보수 칸은 비워 두었다. 「모의고사」를 마물 이름으로 안다.",
    tags: ["인물", "왕국"], refs: [{ kind: "event", id: "ev_ig_h_king" }], source: "소환 장면",
  },
  {
    id: "ig_char_maou", type: "character", name: "마왕 벨제",
    summary: "마왕성 꼭대기의 마왕. 귀환 주문서를 지킨다.",
    body: "왕국 사람들은 마왕이 왜 주문서를 쓰지 않고 지키기만 하는지 모른다.",
    tags: ["인물", "마왕"], refs: [{ kind: "event", id: "ev_ig_k2_maou" }], source: "마왕 장면",
  },
  {
    id: "ig_secret_maou", type: "concept", name: "마왕의 정체",
    summary: "마왕 벨제는 2009년 수능 전날 소환된 한국 고3 배재민이다.",
    body: "돌아가면 수능을 봐야 해서 돌아가지 않았다. 마왕 노릇이 수능보다 쉬웠다고 한다. 마왕성 1층 창고에 「2009. 11. 11. 수능 D-1. 배고프다」라는 쪽지가 남아 있다. 15년째 마왕성에서 혼자 공부한다.",
    tags: ["비밀"], visibility: "ai-hidden", source: "마왕 장면, 창고 쪽지",
  },
  {
    id: "ig_item_script", type: "item", name: "용사 대본",
    summary: "용사가 할 일을 장과 절로 적은 왕국의 의전서.",
    body: "1장 1절 「용사는 왕께 무릎을 꿇는다」, 4장 「용사는 홀로 앞에 선다」, 5장 「용사는 고블린을 벤다」, 7장 3절 「용사는 마왕을 벤다」. 마왕성 장은 비어 있다.",
    tags: ["물건", "왕국"], source: "에델 대사",
  },
  {
    id: "ig_item_tteok", type: "item", name: "이세계 떡볶이",
    summary: "여관 주인이 불꽃고추로 처음 만든 떡볶이. 「용사 정식」으로 메뉴판에 올랐다.",
    body: "광장 상인의 불꽃고추를 가져가면 길드 주방에서 만들어 준다. 학교 앞 분식집 맛과 조금 다르지만 그 맛이다.",
    tags: ["물건", "음식"], refs: [{ kind: "item", id: "item_ig_tteokbokki" }, { kind: "item", id: "item_ig_fire_chili" }], source: "여관 주인 부탁",
  },
  {
    id: "ig_term_chaos", type: "concept", name: "깽판 지수",
    summary: "대본을 어긴 선택마다 오르는 수치. 화면 왼쪽 위에 보인다.",
    body: "국고에 손대기, 무직으로 등록하기, 출제 의도부터 묻기 같은 선택에서 오른다. 높으면 왕국 연대기가 민재를 「깽판왕」으로 적는다.",
    tags: ["규칙"], source: "var_ig_chaos",
  },
  {
    id: "ig_scene_chat", type: "event", name: "반반 마을 공지방",
    summary: "통신 수정구로 연 단톡방. 사람과 고블린이 처음으로 같은 방에서 말했다.",
    body: "밭은 울타리 안, 닭은 해 지기 전에 반납하기로 했다. 통행세는 반반 나누는 마을 입장료로 바뀔 수 있다. 말이 안 통하면 꾸르와 몸으로 부딪친다.",
    tags: ["사건"], refs: [{ kind: "event", id: "ev_ig_v_goblin" }], source: "반반 마을 장면",
  },
  {
    id: "ig_end_routes", type: "event", name: "세 갈래 결말",
    summary: "꼭대기에서 고르는 말이 결말을 가른다.",
    body: "「같이 수능 보러 가요」면 둘 다 교실로 돌아간다(모의고사 날 아침). 떡볶이를 가져왔다면 「떡볶이 먹을래요?」로 마왕이 분식집을 연다(이세계 분식 1호점). 「한 판 붙자」면 마왕성 꼭대기가 날아간다(깽판왕).",
    tags: ["결말"], visibility: "ai-hidden", source: "define_ending 셋",
  },
];

const RELATIONS: readonly CodexRelation[] = [
  { a: "ig_char_edel", b: "ig_char_minjae", kind: "allyOf", note: "의전 담당 호위" },
  { a: "ig_char_fio", b: "ig_char_minjae", kind: "allyOf", note: "과외 학생" },
  { a: "ig_char_kkur", b: "ig_char_minjae", kind: "allyOf", note: "공지방 부방장" },
  { a: "ig_char_king", b: "ig_place_hall", kind: "locatedIn" },
  { a: "ig_char_edel", b: "ig_item_script", kind: "custom", note: "통째로 외운다" },
  { a: "ig_char_fio", b: "ig_place_guild", kind: "locatedIn", note: "처음 만난 곳" },
  { a: "ig_char_kkur", b: "ig_place_goblin", kind: "locatedIn" },
  { a: "ig_char_maou", b: "ig_place_castle", kind: "locatedIn", note: "꼭대기" },
  { a: "ig_secret_maou", b: "ig_char_maou", kind: "custom", note: "정체" },
  { a: "ig_char_maou", b: "ig_char_minjae", kind: "custom", note: "같은 학교 선배" },
  { a: "ig_scene_chat", b: "ig_place_goblin", kind: "locatedIn" },
  { a: "ig_item_tteok", b: "ig_place_guild", kind: "causedBy", note: "길드 주방에서 만든다" },
  { a: "ig_end_routes", b: "ig_char_maou", kind: "causedBy" },
  { a: "ig_place_forest", b: "ig_place_capital", kind: "custom", note: "동쪽 성문 밖" },
  { a: "ig_place_goblin", b: "ig_place_forest", kind: "custom", note: "숲길 끝" },
  { a: "ig_place_castle", b: "ig_place_goblin", kind: "custom", note: "마을 북쪽" },
];

interface ProfileSeed { readonly characterId: string; readonly displayName: string; readonly note: string; readonly nameColor: string }
/** displayName 은 대사 화자 이름과 같아야 이름 색이 붙는다(키트 CAST 의 이름). */
const PROFILES: readonly ProfileSeed[] = [
  { characterId: "minjae", displayName: "민재", note: "고2 강민재. 야자 중에 소환된 자칭 임시 용사. 내일이 모의고사다.", nameColor: "#4a8fe0" },
  { characterId: "edel", displayName: "에델", note: "왕국 기사. 용사 대본을 통째로 외운 의전 담당.", nameColor: "#d9a63a" },
  { characterId: "fio", displayName: "피오", note: "엘프 마법사. 마탑 승급 시험 7수생.", nameColor: "#5bb86a" },
  { characterId: "kkur", displayName: "꾸르", note: "반반 마을 고블린 족장. 공지방 부방장.", nameColor: "#8a9a3a" },
  { characterId: "maou", displayName: "마왕 벨제", note: "마왕성 꼭대기의 마왕. 귀환 주문서를 지킨다.", nameColor: "#a85adb" },
  { characterId: "king", displayName: "국왕 루드릭", note: "아르벤 왕국의 왕. 용사 대본을 믿는다.", nameColor: "#c9483a" },
];

export function applyIsekaiGoddingLore(project: Project, exec: LoreExec = loreExec): void {
  exec(project, "set_world_canon", {
    canon: {
      name: "아르벤 왕국 (깽판 고딩)",
      premise: "고2 강민재가 야자 중에 이세계 아르벤 왕국에 용사로 소환된다. 내일은 모의고사다. 왕국은 용사 대본대로 움직이길 바라지만, 민재는 PC방과 급식실과 학원에서 배운 방식으로 문제를 풀어 간다.",
      tones: ["comic", "hopeful", "fairytale"],
      era: "중세풍 판타지 왕국 (주인공은 현대 한국 고등학생)",
      techCeiling: "중세. 마법 수정구가 단톡방처럼 쓰인다",
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
