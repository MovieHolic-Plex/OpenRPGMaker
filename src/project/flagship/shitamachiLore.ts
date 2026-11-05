/**
 * 「시타마치의 네 번째 계절」 이야기 탭(세계 개요·설정집·인물) 저작.
 *
 * 사실은 전부 shitamachiFourthSeason.ts 의 대사와 코드에서 왔다. 조수 도구(set_world_canon ·
 * upsert_world_codex · upsert_character_profile)만 쓰므로 몇 번을 불러도 같은 결과가 나온다.
 * 결말 갈래와 비밀은 visibility "ai-hidden" 으로 두어 조수의 새 글이 미리 새지 않게 한다.
 */
import { loreExec, writeCodex, type CodexEntry, type CodexRelation, type LoreExec } from "./loreKit";
import type { Project } from "@/project/types";

const MAP = {
  hub: "map_shitamachi_arcade",
  train: "map_venue_train",
  house: "map_venue_house",
  bakery: "map_venue_bakery",
  sento: "map_venue_sento",
  office: "map_venue_council",
  rooftop: "map_venue_rooftop",
} as const;

const CANON_BODY = [
  "# 동네",
  "시타마치는 도쿄의 오래된 상점가 동네다. 큰길 위로 아케이드 지붕이 덮여 있고, 축제 날에는 마흔 곳에 등롱이 걸린다. 큰길 서쪽 끝은 역 방면이고 동쪽 끝에 진흥회 사무소가 있다. 북쪽 뒷길로 들어서면 집들과 센토가 나온다. 늦가을 저녁이면 장을 보는 아주머니, 퇴근길 회사원, 하굣길 학생이 같은 지붕 밑을 지난다.",
  "# 장소들",
  "코하루 베이커리는 큰길의 빵집이고, 센토 마츠노유는 북쪽 뒷길에 있다. 하진의 집도 같은 뒷길에 있다. 통학 전철은 저녁마다 아케이드 앞 역으로 사람을 내려 준다. 히카리 맨션 옥상에서는 아케이드 등롱이 한눈에 보인다. 정문 옆에는 해마다 소원으로 불을 켜 온 큰 등롱이 걸려 있다.",
  "# 사람들",
  "하진은 여덟 살에 이 동네를 떠났다가 십 년 만인 올봄에 돌아왔다. 서연은 세이화 학원 학생회장이고 진흥회 일손이 모자라 축제를 떠맡았다. 지호는 코하루 베이커리의 딸이고 하진의 소꿉친구다. 유나는 센토 마츠노유의 손녀이며 하진과 같은 전철로 통학한다. 정문 곁에는 진흥회의 등롱지기 아저씨가 서 있다.",
  "# 축제",
  "시타마치 등롱 축제는 하루 뒤에 열린다. 정문 큰 등롱에 소원 등롱 세 개가 들어가야 불이 붙는다. 세 개는 코하루 베이커리, 센토 마츠노유, 진흥회 사무소에서 받는다. 셋이 모이면 등롱지기 아저씨에게 가져가고, 아케이드의 등롱이 하나씩 켜진다. 그 뒤 하진은 누구와 등롱 길을 걸을지 고른다.",
  "# 이야기 흐름",
  "저녁 전철에서 유나와 마주치고, 상점가에서 서연에게 부탁을 받는다. 집, 빵집, 센토, 사무소는 어떤 순서로 돌아도 된다. 집에서는 엄마의 쪽지와 십 년 전 사진을 본다. 소원 등롱 셋을 모아 점등식을 치르면 하루가 저문다. 마지막 선택은 세 사람 중 한 명과 옥상으로 가거나 다 같이 간다.",
  "# 결말 갈래",
  "결말은 넷이다. 서연, 지호, 유나 중 한 명과 이어지는 결말이 셋이고, 넷이 함께 남는 청춘 결말이 하나다. 그 사람과의 호감이 쌓였을 때만 받아들여진다. 모자라면 상대가 정중히 거절하고 청춘 결말로 흘러간다.",
  "# 톤",
  "큰 사건은 없다. 등롱 하나, 빵 하나, 필름 한 컷 같은 작은 물건이 마음을 옮긴다. 말투는 가볍고 따뜻하며, 서툰 사람들이 한 걸음씩 다가간다.",
].join("\n\n");

const ENTRIES: readonly CodexEntry[] = [
  // 장소
  {
    id: "sm-place-shitamachi", type: "place", name: "시타마치 상점가",
    summary: "아케이드 지붕이 덮인 도쿄의 오래된 상점가 동네. 축제 날에는 마흔 곳에 등롱이 걸린다.",
    body: "큰길 서쪽 끝은 역 방면이고 동쪽 끝에 진흥회 사무소가 있다. 북쪽 뒷길에는 하진의 집과 센토가 있다. 저녁 장을 보는 사람, 퇴근하는 회사원, 하교하는 학생이 오간다. 역 앞에는 고로케집이 있다.",
    tags: ["장소", "동네"], refs: [{ kind: "map", id: MAP.hub }], source: "시타마치 상점가 맵",
  },
  {
    id: "sm-place-train", type: "place", name: "저녁 통학 전철",
    summary: "하진과 유나가 매일 함께 타는 통학 전철. 가을 저녁 노을빛이 든다.",
    body: "이야기는 여기서 시작한다. 유나는 필름 카메라를 두 손으로 감싸 쥐고 창밖을 본다. 안내 방송이 시타마치 역을 알리면 유나가 먼저 내린다.",
    tags: ["장소", "시작"], refs: [{ kind: "map", id: MAP.train }], source: "저녁 전철 장면",
  },
  {
    id: "sm-place-house", type: "place", name: "하진의 집",
    summary: "아케이드를 지나 북쪽 뒷길에 있는 하진의 집. 식탁에는 엄마의 쪽지가, 책장에는 옛 사진이 있다.",
    body: "엄마의 쪽지에는 진흥회 일을 돕는다니 대견하다는 말, 저녁은 냉장고에 있다는 말, 지호네 빵집에 안부를 전해 달라는 말이 적혀 있다. 하진은 어릴 때 그 빵집에서 살다시피 했다.",
    tags: ["장소", "집"], refs: [{ kind: "map", id: MAP.house }, { kind: "event", id: "ev_sm_house_note" }, { kind: "event", id: "ev_sm_house_photo" }], source: "하진의 집 장면",
  },
  {
    id: "sm-place-koharu", type: "place", name: "코하루 베이커리",
    summary: "지호네 빵집. 내일 팔 등롱빵을 굽고 있다.",
    body: "하진이 이사 가던 날, 등롱을 든 꼬마 지호가 이 가게 앞에서 울었다. 지금은 지호가 할머니의 레시피를 혼자 맞춰 가며 등롱빵을 굽는다. 지붕에는 노란 등롱이 걸린다.",
    tags: ["장소", "가게"], refs: [{ kind: "map", id: MAP.bakery }, { kind: "event", id: "ev_sm_jiho" }], source: "빵집 장면",
  },
  {
    id: "sm-place-matsunoyu", type: "place", name: "센토 마츠노유",
    summary: "유나네 공중목욕탕. 번대 옆 벽에 십 년 전 축제 사진이 걸려 있다.",
    body: "북쪽 뒷길에 있다. 유나가 번대를 본다. 유나의 할머니가 찍은 십 년 전 축제 사진이 걸려 있고, 가게 앞에는 나무 계단이 있다.",
    tags: ["장소", "가게"], refs: [{ kind: "map", id: MAP.sento }, { kind: "event", id: "ev_sm_yuna" }], source: "센토 장면",
  },
  {
    id: "sm-place-council", type: "place", name: "상점가 진흥회 사무소",
    summary: "큰길 동쪽 끝의 진흥회 사무소. 서연이 서류에 묻혀 축제 준비를 한다.",
    body: "서연의 책상에는 가게 마흔 곳의 등롱 위치를 정리한 순서표와 안전 점검표가 쌓여 있다. 진흥회 몫의 소원 등롱도 여기서 나온다.",
    tags: ["장소", "축제"], refs: [{ kind: "map", id: MAP.office }, { kind: "event", id: "ev_sm_seoyeon_office" }], source: "사무소 장면",
  },
  {
    id: "sm-place-rooftop", type: "place", name: "히카리 맨션 옥상",
    summary: "아케이드 등롱이 한눈에 보이는 옥상. 마지막 선택의 무대다.",
    body: "난간 너머로 상점가 지붕이 내려다보이고, 그 틈으로 등롱 불빛이 새어 오른다. 등롱지기 아저씨가 점등식 뒤에 하진에게 올라가 보라고 일러 준다.",
    tags: ["장소", "결말"], refs: [{ kind: "map", id: MAP.rooftop }], source: "옥상 장면",
  },
  {
    id: "sm-place-gate", type: "place", name: "정문 큰 등롱",
    summary: "아케이드 정문 옆의 큰 등롱. 소원 등롱 세 개가 들어가야 불이 붙는다.",
    body: "해마다 동네 아이들의 소원으로 불을 켜 왔다. 등롱지기 아저씨가 그 곁을 지킨다. 점등식 때 세 사람이 정문 곁 보도에 모인다.",
    tags: ["장소", "축제"], refs: [{ kind: "map", id: MAP.hub }], source: "점등식 장면",
  },
  {
    id: "sm-place-stairs", type: "place", name: "마츠노유 앞 나무 계단",
    summary: "센토 앞의 낡은 나무 계단. 넷이 함께 사진을 찍는 자리다.",
    body: "청춘 결말에서 넷이 남은 등롱빵을 나눠 먹고 단체 사진을 찍는다. 그 사진은 번대 옆에 걸린다.",
    tags: ["장소", "결말"], visibility: "ai-hidden", refs: [{ kind: "map", id: MAP.sento }], source: "청춘 결말",
  },
  // 모임
  {
    id: "sm-faction-association", type: "faction", name: "상점가 진흥회",
    summary: "시타마치 상점가를 꾸려 가는 어르신들의 모임. 등롱 축제를 연다.",
    body: "일손이 모자라 올해는 세이화 학원 학생회에 도움을 청했다. 사무소는 큰길 동쪽 끝에 있다. 등롱지기 아저씨도 진흥회 사람이다.",
    tags: ["모임", "축제"], source: "상점가 진흥회 사무소 맵과 서연의 대사",
  },
  {
    id: "sm-faction-council", type: "faction", name: "세이화 학원 학생회",
    summary: "서연이 이끄는 학생회. 올해 등롱 축제의 일손을 맡았다.",
    body: "하굣길 학생들은 회장님이 등롱을 모으러 다닌다고 말한다. 진흥회 어르신들 대신 학생회가 축제 일손을 맡았다.",
    tags: ["모임", "학교"], source: "서연의 대사",
  },
  // 인물
  {
    id: "sm-char-hajin", type: "character", name: "하진",
    summary: "여덟 살에 떠났다가 십 년 만에 시타마치로 돌아온 주인공.",
    body: "올봄에 돌아와 봄, 여름, 가을을 지냈다. 같은 전철 칸의 유나가 마음에 걸린다.",
    tags: ["인물", "주인공"], refs: [{ kind: "event", id: "ev_shitamachi_seoyeon" }], source: "저녁 전철 장면",
  },
  {
    id: "sm-char-seoyeon", type: "character", name: "서연",
    summary: "세이화 학원 학생회장. 진흥회 일손이 모자라 등롱 축제를 떠맡았다.",
    body: "부탁을 잘 못 한다. 가게 마흔 곳의 등롱 위치와 안전 점검표를 혼자 정리한다. 진흥회 몫의 소원 등롱 안에 자기 소원을 넣었고, 읽지 말라고 당부한다. 학생회장 자리를 벗어나 있어도 되는 곳을 찾고 있다.",
    tags: ["인물", "히로인"], refs: [{ kind: "event", id: "ev_sm_seoyeon_office" }, { kind: "event", id: "ev_sm_gather_seoyeon" }], source: "상점가와 사무소 장면",
  },
  {
    id: "sm-char-jiho", type: "character", name: "지호",
    summary: "코하루 베이커리의 딸이자 하진의 소꿉친구. 십 년 전 약속을 기억한다.",
    body: "어릴 적 하진이 반죽을 훔쳐 먹었을 때 대신 할머니께 혼났다. 지금은 할머니의 레시피를 혼자 맞춰 등롱빵을 굽는다. 이사 가던 날 울던 아이가 십 년을 기다렸다.",
    tags: ["인물", "히로인"], refs: [{ kind: "event", id: "ev_sm_jiho" }, { kind: "event", id: "ev_sm_gather_jiho" }], source: "빵집 장면",
  },
  {
    id: "sm-char-yuna", type: "character", name: "유나",
    summary: "센토 마츠노유의 손녀. 하진과 같은 전철로 통학한다.",
    body: "할머니의 필름 카메라를 들고 다닌다. 등롱에 불이 켜지는 순간을 찍고 싶어 한다. 필름은 한 컷이 남았고, 정문 앞에서 쓸 생각이다.",
    tags: ["인물", "히로인"], refs: [{ kind: "event", id: "ev_sm_yuna" }, { kind: "event", id: "ev_sm_gather_yuna" }], source: "전철과 센토 장면",
  },
  {
    id: "sm-char-keeper", type: "character", name: "등롱지기 아저씨",
    summary: "정문 큰 등롱을 지키는 진흥회 사람.",
    body: "소원 등롱 세 개를 받아 정문 등롱에 불을 붙인다. 점등식 뒤에 하진에게 누구와 등롱 길을 걸을지 묻고, 히카리 맨션 옥상에 올라가 보라고 권한다.",
    tags: ["인물", "진흥회"], refs: [{ kind: "event", id: "ev_sm_keeper" }], source: "점등식 장면",
  },
  {
    id: "sm-char-jiho-grandma", type: "character", name: "지호의 할머니",
    summary: "코하루 베이커리의 어른. 등롱빵 레시피의 원래 주인이다.",
    body: "지호가 맞춰 가는 등롱빵 레시피는 이 할머니가 남긴 것이다. 어린 하진이 반죽을 훔쳤을 때 지호를 혼냈다.",
    tags: ["인물", "과거"], source: "지호의 대사",
  },
  {
    id: "sm-char-yuna-grandma", type: "character", name: "유나의 할머니",
    summary: "마츠노유의 어른. 필름 카메라의 원래 주인이다.",
    body: "십 년 전 등롱 축제를 찍은 사진이 센토에 걸려 있다. 유나는 그 카메라로 올해 축제를 찍으려 한다.",
    tags: ["인물", "과거"], source: "유나의 대사",
  },
  // 개념과 물건
  {
    id: "sm-event-festival", type: "event", name: "시타마치 등롱 축제",
    summary: "해마다 늦가을에 아케이드 전체에 등롱을 켜는 동네 축제.",
    body: "정문 큰 등롱에 소원 등롱 세 개가 들어가야 불이 붙는다. 불은 아케이드 지붕 아래 등롱으로 하나씩 번져 간다. 이야기는 축제 하루 전 저녁에 벌어진다.",
    tags: ["축제", "행사"], refs: [{ kind: "map", id: MAP.hub }], source: "상점가와 점등식 장면",
  },
  {
    id: "sm-concept-wish-lantern", type: "concept", name: "소원 등롱",
    summary: "정문 큰 등롱에 넣는 작은 등롱. 쓴 사람의 소원이 안에 들어 있다.",
    body: "코하루 베이커리, 센토 마츠노유, 진흥회 사무소가 하나씩 낸다. 지호는 안에 뭘 적었는지 보지 말라 하고, 서연도 읽지 말라 한다. 유나는 조심히 들고 가라고 건넨다.",
    tags: ["축제", "물건"], refs: [{ kind: "event", id: "ev_sm_gather_seoyeon" }, { kind: "event", id: "ev_sm_gather_jiho" }, { kind: "event", id: "ev_sm_gather_yuna" }], source: "빵집, 센토, 사무소 장면",
  },
  {
    id: "sm-item-lantern-bread", type: "item", name: "등롱빵",
    summary: "주황빛 등롱 모양의 빵. 겉은 바삭하고 속에는 커스터드가 들었다.",
    body: "지호가 할머니의 레시피를 혼자 맞춰 완성했고 내일부터 판다. 하진이 시식을 해 준다.",
    tags: ["물건", "음식"], refs: [{ kind: "event", id: "ev_sm_jiho" }], source: "지호의 대사",
  },
  {
    id: "sm-item-camera", type: "item", name: "유나의 필름 카메라",
    summary: "유나의 할머니가 쓰던 낡은 필름 카메라.",
    body: "필름이 한 컷 남았다. 유나는 그 한 컷을 정문 앞에서 쓰려 한다. 어느 결말이냐에 따라 마지막 한 장의 피사체가 달라진다.",
    tags: ["물건"], refs: [{ kind: "event", id: "ev_sm_yuna" }], source: "전철과 센토 장면",
  },
  {
    id: "sm-concept-promise", type: "concept", name: "십 년 전의 약속",
    summary: "이사 가던 날 하진이 지호에게 한 약속. 내년엔 같이 등롱을 보자.",
    body: "책장 위 사진에는 코하루 베이커리 앞에서 등롱을 든 채 우는 꼬마 지호가 찍혀 있다. 사진을 찍은 날이 하진이 이사 가던 날이다. 약속은 십 년이 지나 다시 돌아온다.",
    tags: ["과거", "약속"], refs: [{ kind: "event", id: "ev_sm_house_photo" }], source: "집의 사진 장면",
  },
  {
    id: "sm-event-lighting", type: "event", name: "점등식",
    summary: "소원 등롱 셋을 정문 큰 등롱에 넣고 아케이드에 불을 켜는 장면.",
    body: "서연, 지호, 유나가 정문 곁에 모이고 등롱지기 아저씨가 등롱을 받는다. 아저씨는 해마다 동네 아이들의 소원으로 불을 켜 왔다고 말한다. 불이 켜진 뒤 하진에게 누구와 걸을지 묻는다.",
    tags: ["장면", "축제"], refs: [{ kind: "event", id: "ev_sm_keeper" }], source: "점등식 장면",
  },
  // 비밀과 결말
  {
    id: "sm-secret-schedule", type: "concept", name: "서연의 진행표",
    summary: "옥상에서 발견되는 진행표. 담당란에 서연의 이름만 적혀 있고 옆이 비어 있다.",
    body: "서연이 혼자 짊어진 일의 상징이다. 서연의 결말에서는 그 빈칸에 하진의 이름이 함께 들어간다.",
    tags: ["비밀", "서연"], visibility: "ai-hidden", refs: [{ kind: "event", id: "ev_sm_roof_scene" }], source: "옥상 장면",
  },
  {
    id: "sm-event-rooftop", type: "event", name: "옥상의 고백",
    summary: "마지막 선택 뒤 히카리 맨션 옥상에서 벌어지는 고백 장면.",
    body: "하진이 고른 사람이 난간 곁에 선다. 호감이 쌓였으면 마음을 전했을 때 받아들여지고, 모자라면 상대가 정중히 거절한다. 거절당하면 넷이 함께 남는 청춘 결말이 된다.",
    tags: ["장면", "비밀"], visibility: "ai-hidden", refs: [{ kind: "event", id: "ev_sm_roof_scene" }, { kind: "map", id: MAP.rooftop }], source: "옥상 장면",
  },
  {
    id: "sm-end-seoyeon", type: "event", name: "결말 서연: 학생회장이 아닌 날",
    summary: "하진과 서연이 이어지는 결말.",
    body: "진행표 담당란을 하진과 나눠 쓴다. 지호는 등롱빵 삼백 개를 팔았고, 유나의 마지막 한 컷에는 진행표를 들고 웃는 서연이 담긴다.",
    tags: ["결말"], visibility: "ai-hidden", source: "엔딩 end_shitamachi_seoyeon",
  },
  {
    id: "sm-end-jiho", type: "event", name: "결말 지호: 십 년 늦은 약속",
    summary: "하진과 지호가 이어지는 결말.",
    body: "약속빵을 둘이 나눈다. 서연은 보고서를 진흥회 어르신들과 나눠 끝냈고, 유나는 첫 전철에서 등롱을 찍었다.",
    tags: ["결말"], visibility: "ai-hidden", source: "엔딩 end_shitamachi_jiho",
  },
  {
    id: "sm-end-yuna", type: "event", name: "결말 유나: 마지막 한 장",
    summary: "하진과 유나가 이어지는 결말.",
    body: "현상한 사진이 번대 옆에 걸린다. 서연은 다음 축제의 사진사로 유나를 적고, 지호는 등롱빵이 제일 잘 나왔다고 우긴다.",
    tags: ["결말"], visibility: "ai-hidden", source: "엔딩 end_shitamachi_yuna",
  },
  {
    id: "sm-end-friends", type: "event", name: "결말 청춘: 넷이서 본 등롱",
    summary: "누구와도 이어지지 않고 넷이 함께 남는 결말. 다 같이를 고르거나 마음이 거절될 때 닿는다.",
    body: "마츠노유 앞 나무 계단에서 남은 등롱빵 여섯 개를 넷이 나눠 먹는다. 단체 사진은 번대 옆에 걸린다.",
    tags: ["결말"], visibility: "ai-hidden", refs: [{ kind: "map", id: MAP.sento }], source: "엔딩 end_shitamachi_friends",
  },
];

const RELATIONS: readonly CodexRelation[] = [
  { a: "sm-place-koharu", b: "sm-place-shitamachi", kind: "locatedIn" },
  { a: "sm-place-matsunoyu", b: "sm-place-shitamachi", kind: "locatedIn", note: "북쪽 뒷길" },
  { a: "sm-place-house", b: "sm-place-shitamachi", kind: "locatedIn", note: "북쪽 뒷길" },
  { a: "sm-place-council", b: "sm-place-shitamachi", kind: "locatedIn", note: "큰길 동쪽 끝" },
  { a: "sm-place-gate", b: "sm-place-shitamachi", kind: "locatedIn" },
  { a: "sm-place-rooftop", b: "sm-place-shitamachi", kind: "locatedIn", note: "아케이드가 내려다보임" },
  { a: "sm-place-stairs", b: "sm-place-matsunoyu", kind: "locatedIn" },
  { a: "sm-place-council", b: "sm-faction-association", kind: "custom", note: "진흥회의 사무소" },
  { a: "sm-char-keeper", b: "sm-faction-association", kind: "memberOf" },
  { a: "sm-char-seoyeon", b: "sm-faction-council", kind: "memberOf", note: "학생회장" },
  { a: "sm-faction-council", b: "sm-faction-association", kind: "allyOf", note: "일손이 모자란 진흥회를 돕는다" },
  { a: "sm-char-jiho", b: "sm-place-koharu", kind: "custom", note: "가게의 딸" },
  { a: "sm-char-yuna", b: "sm-place-matsunoyu", kind: "custom", note: "가게의 손녀" },
  { a: "sm-char-hajin", b: "sm-char-jiho", kind: "knows", note: "소꿉친구, 십 년 전 이사 가던 날 약속" },
  { a: "sm-char-hajin", b: "sm-char-yuna", kind: "knows", note: "같은 전철로 통학" },
  { a: "sm-char-hajin", b: "sm-char-seoyeon", kind: "knows", note: "축제 일을 함께 한다" },
  { a: "sm-char-jiho", b: "sm-char-jiho-grandma", kind: "custom", note: "레시피를 이어받는다" },
  { a: "sm-char-yuna", b: "sm-char-yuna-grandma", kind: "custom", note: "필름 카메라를 물려받았다" },
  { a: "sm-char-yuna-grandma", b: "sm-item-camera", kind: "owns", note: "원래 주인" },
  { a: "sm-char-yuna", b: "sm-item-camera", kind: "owns" },
  { a: "sm-char-jiho", b: "sm-item-lantern-bread", kind: "custom", note: "만든 사람" },
  { a: "sm-char-seoyeon", b: "sm-secret-schedule", kind: "owns" },
  { a: "sm-char-hajin", b: "sm-concept-promise", kind: "custom", note: "약속을 한 쪽" },
  { a: "sm-char-jiho", b: "sm-concept-promise", kind: "custom", note: "약속을 받은 쪽" },
  { a: "sm-concept-promise", b: "sm-place-house", kind: "custom", note: "사진이 책장 위에 있다" },
  { a: "sm-concept-wish-lantern", b: "sm-event-festival", kind: "custom", note: "세 개가 정문 등롱을 밝힌다" },
  { a: "sm-event-lighting", b: "sm-event-festival", kind: "causedBy", note: "소원 등롱 셋이 모여야 열린다" },
  { a: "sm-event-lighting", b: "sm-place-gate", kind: "locatedIn" },
  { a: "sm-event-rooftop", b: "sm-place-rooftop", kind: "locatedIn" },
  { a: "sm-event-rooftop", b: "sm-event-lighting", kind: "causedBy", note: "점등식 뒤에 옥상을 권한다" },
  { a: "sm-end-seoyeon", b: "sm-event-rooftop", kind: "causedBy" },
  { a: "sm-end-jiho", b: "sm-event-rooftop", kind: "causedBy" },
  { a: "sm-end-yuna", b: "sm-event-rooftop", kind: "causedBy" },
  { a: "sm-end-friends", b: "sm-event-rooftop", kind: "causedBy", note: "마음이 거절되거나 다 같이를 고를 때" },
  { a: "sm-end-friends", b: "sm-place-stairs", kind: "locatedIn" },
];

interface Profile {
  readonly characterId: string;
  readonly displayName: string;
  readonly note: string;
  readonly nameColor: string;
}

/** 새로 만드는 인물. displayName 은 게임 대사의 화자 이름과 글자까지 같아야 이름 색이 붙는다. */
const PROFILES: readonly Profile[] = [
  { characterId: "hajin", displayName: "하진", note: "십 년 만에 시타마치로 돌아온 주인공. 여덟 살에 떠났고 올봄에 돌아왔다.", nameColor: "#3f7c85" },
  { characterId: "seoyeon", displayName: "서연", note: "", nameColor: "#4a5f9e" },
  { characterId: "jiho", displayName: "지호", note: "", nameColor: "#b8741f" },
  { characterId: "yuna", displayName: "유나", note: "", nameColor: "#b2506f" },
  { characterId: "keeper", displayName: "등롱지기 아저씨", note: "진흥회 사람. 정문 큰 등롱 곁에서 소원 등롱을 받는다.", nameColor: "#7a5a3a" },
];

export function applyShitamachiLore(project: Project, exec: LoreExec = loreExec): void {
  exec(project, "set_world_canon", {
    canon: {
      name: "시타마치의 네 번째 계절",
      premise: "여덟 살에 떠난 하진이 십 년 만에 돌아온 도쿄 시타마치 상점가. 등롱 축제 전날 소원 등롱 셋을 모으며 세 사람과 가까워진다.",
      tones: ["slice", "hopeful", "comic"],
      era: "현대 일본, 늦가을",
      techCeiling: "휴대폰과 필름 카메라가 함께 쓰이는 현대",
      absences: ["마법", "괴물", "초능력", "전쟁", "범죄"],
      laws: {
        power: { present: false, note: "특별한 힘은 없다. 이웃의 부탁과 약속이 이야기를 움직인다." },
        gods: { present: false, note: "신앙은 축제의 등롱으로만 남아 있다." },
        death: { present: false, note: "죽음은 다루지 않는다." },
        money: { present: true, note: "상점가의 가게들이 돈으로 굴러간다. 등롱빵은 내일부터 판다." },
      },
      body: CANON_BODY,
      status: "canon",
    },
  });

  writeCodex(project, exec, ENTRIES, RELATIONS);

  for (const profile of PROFILES) {
    const existing = project.characters?.[profile.characterId];
    const note = existing?.note?.trim() ? existing.note : profile.note;
    exec(project, "upsert_character_profile", {
      characterId: profile.characterId,
      profile: {
        ...(existing?.displayName ? { displayName: existing.displayName } : { displayName: profile.displayName }),
        ...(note ? { note } : {}),
        ...(existing?.birthday ? { birthday: existing.birthday } : {}),
        ...(existing?.giftPrefs ? { giftPrefs: existing.giftPrefs } : {}),
        ...(existing?.giftResponses ? { giftResponses: existing.giftResponses } : {}),
        dialogue: { ...(existing?.dialogue ?? {}), nameColor: profile.nameColor },
      },
    });
  }
}
