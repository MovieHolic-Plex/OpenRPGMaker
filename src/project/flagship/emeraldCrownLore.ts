/**
 * 아스트라 호라이즌: 다우닝 시티와 여명의 날개(emerald-crown 데모)의 「이야기」 탭.
 *
 * 사실은 전부 emeraldCrown.ts · emeraldCrownCast.ts · beats.ts 와 구운 프로젝트의 대사·이벤트에서 왔다.
 * 조수 도구(set_world_canon · upsert_world_codex · upsert_character_profile)만 쓰므로 몇 번을 불러도 같은 결과가 나온다.
 * 신전의 별무늬(챔피언이 된 뒤에 열리는 희귀 몬스터)는 visibility "ai-hidden" 으로 두어 조수의 새 글이 미리 새지 않게 한다.
 */
import type { Project } from "@/project/types";
import { loreExec, writeCodex, type CodexEntry, type CodexRelation, type LoreExec } from "./loreKit";

const MAP = {
  home: "mx_map_home",
  homeHouse: "mx_map_home_house",
  homeCenter: "mx_map_home_center",
  school: "mx_map_school",
  lab: "mx_map_lab",
  meadow: "mx_map_meadow",
  grove: "mx_map_grove",
  groveGym: "mx_map_grove_gym",
  garden: "mx_map_garden",
  temple: "mx_map_observatory",
  hall: "mx_map_league_0",
} as const;

const CANON_BODY = [
  "아스트라 군도는 바다 위에 흩어진 섬들이다. 섬마다 마을이 있고, 사람은 몬스터와 함께 산다. 몬스터는 길가 풀숲에도, 바위 틈에도, 물가에도 산다. 사람은 구슬로 몬스터를 만나 동료로 삼고, 기록은 별빛 도감에 남긴다. 다친 몬스터는 마을마다 있는 회복 센터에서 고친다.",
  "군도의 길잡이는 등대의 불빛이다. 봄가을마다 새떼 여명의 날개가 바다를 건너오는데, 새들은 이 불빛을 보고 길을 찾는다. 그 등대가 요즘 새벽마다 깜빡인다. 새들은 다우닝 시티 광장 위를 맴돌고, 바다 위에서 길을 잃는 새도 생겼다. 주인공은 이 등대를 다시 밝히려고 길을 떠난다.",
  "이야기는 다우닝 시티에서 시작한다. 주인공은 첫 동료를 받는 날 아침에 엄마의 목소리로 눈을 뜬다. 오르비스 천문 연구소에서 천문박사가 토리프, 숯꼬미, 아가핀 중 한 마리를 고르게 한다. 같은 마을의 라이벌 나루는 연구소에서 지내던 볼트온을 데리고 첫 대결을 건다. 박사는 별빛 도감과 시험용 구슬을 주고, 등대를 살리려면 먼 길을 함께 걸을 동료가 필요하다고 말한다.",
  "1번 도로 새싹 들길을 따라가면 실바나 마을이 나온다. 실바나는 해마다 몬스터와 나무를 함께 심는 마을이고, 체육관의 덩굴도 그렇게 자랐다. 관장 유림은 풀 타입을 쓰는 사람이다. 체육관 안에서는 새싹 돌 받침에 해가 움직이는 차례대로 물을 주어야 덩굴 문이 열린다. 유림에게 이기면 새잎 배지와 부활의 깃털을 받는다. 배지가 없으면 별모래 신전으로 가는 다리를 건너지 못한다.",
  "별모래 신전에는 밤막회사의 대표 무영이 있다. 그는 별빛을 한곳에 모아 두면 누구도 길을 잃지 않는다고 믿고, 등대의 빛까지 가두려 했다. 주인공이 무영을 이기자 배지의 빛과 몬스터들의 울음이 하나로 모여 등대가 군도 위로 다시 밝아진다. 새떼가 날아오르고, 실바나 북쪽 끝의 챔피언 전당 문이 열린다. 무영은 이 군도를 처음부터 다시 걸어 보겠다고 말한다.",
  "마지막은 챔피언 전당이다. 같은 마을에서 출발한 나루가 챔피언으로 기다리고, 주인공이 이기면 아스트라 군도의 새 챔피언이 된다. 그래도 모험은 끝나지 않는다. 신전의 별무늬는 챔피언이 된 뒤에 다시 가야 풀리고, 희귀 몬스터와 도감 채우기가 그때부터 남는다.",
  "몬스터와 사람은 서로 기대는 사이다. 트레이너가 몬스터를 이끌고, 몬스터가 트레이너를 믿고 움직인다. 유림이 시험하는 것도 그 믿음이다. 다른 사람의 몬스터는 잡을 수 없다. 야생 몬스터는 힘을 뺀 뒤 구슬을 던져서 잡는다.",
  "톤은 밝고 느긋하다. 악당도 끝에는 길을 다시 걷겠다고 말한다. 대사는 짧고 다정하며, 위기는 등대가 깜빡이는 정도로만 다가온다.",
].join("\n\n");

const ENTRIES: readonly CodexEntry[] = [
  // 장소
  {
    id: "ec_place_archipelago", type: "place", name: "아스트라 군도",
    summary: "여러 섬에 마을이 흩어진 바다 위의 군도. 등대의 불빛이 길을 잡아 주고, 철새 여명의 날개가 건너온다.",
    body: "사람과 몬스터가 함께 산다. 다우닝 시티, 실바나 마을, 별모래 신전, 챔피언 전당이 모험의 길목이다. 등대가 꺼지면 새와 배가 길을 잃는다.",
    tags: ["장소", "세계"], source: "엔딩 크레딧과 마을 대사",
  },
  {
    id: "ec_place_dawning_city", type: "place", name: "다우닝 시티",
    summary: "주인공의 고향 마을. 집, 연구소, 트레이너 학교, 회복 센터, 도구점이 광장을 둘러싼다.",
    body: "광장 위에는 새떼가 맴돈다. 전망 카페 바리스타는 등대가 흐려서 새들이 헤맨다고 말한다. 마을 사람들은 등대가 새벽마다 깜빡인다고 수군댄다. 북쪽 문으로 1번 도로 새싹 들길에 닿는다.",
    tags: ["장소", "시작 마을"], refs: [{ kind: "map", id: MAP.home }], source: "다우닝 시티 맵과 주민 대사",
  },
  {
    id: "ec_place_lab", type: "place", name: "오르비스 천문 연구소",
    summary: "다우닝 광장의 초록 지붕 큰 건물. 천문박사가 첫 동료를 나눠 주고 별빛 도감을 건넨다.",
    body: "볼트온처럼 연구소에서 자란 몬스터도 있다. 박사는 여기서 실바나 체육관이 다음 목표라고 알려 주고, 배지는 메뉴의 배지 칸에서 확인하라고 일러 준다.",
    tags: ["장소", "첫 동료"], refs: [{ kind: "map", id: MAP.lab }, { kind: "event", id: "mx_map_lab_professor" }], source: "연구소 대사",
  },
  {
    id: "ec_place_school", type: "place", name: "다우닝 트레이너 학교",
    summary: "전투와 포획의 기본을 가르치는 학교. 선생님이 순서를 차근차근 알려 준다.",
    body: "전투는 싸운다, 기술을 고른다, 상대를 고른다 순서로 흐른다. 몬스터가 쓰러지면 교체한다. 잡으려면 먼저 체력을 깎는다. 박스 정리와 기술 다시 익히기는 메뉴의 몬스터 화면에서 한다.",
    tags: ["장소", "튜토리얼"], refs: [{ kind: "map", id: MAP.school }], source: "학교 선생님 대사",
  },
  {
    id: "ec_place_center", type: "place", name: "회복 센터",
    summary: "마을마다 있는 몬스터 치료소. 센터 직원이 파티를 모두 고쳐 준다.",
    body: "다우닝과 실바나에 있고, 2층 휴게실 손님들이 상성 요령을 흘려 준다. 불은 풀에 강하고, 물은 불에 강하고, 풀은 물에 강하다. 체력 표시가 노랗게 줄었을 때 구슬이 더 잘 듣는다는 말도 여기서 듣는다.",
    tags: ["장소", "회복"], refs: [{ kind: "map", id: MAP.homeCenter }, { kind: "map", id: "mx_map_grove_center" }], source: "센터 직원과 라운지 손님 대사",
  },
  {
    id: "ec_place_route1", type: "place", name: "1번 도로 새싹 들길",
    summary: "다우닝에서 실바나로 가는 첫 길. 풀숲에 야생 몬스터가 살고 길목마다 트레이너가 선다.",
    body: "산책하는 소년, 연구원, 길을 걷는 조련사가 막아서고, 시간이 지나면 다시 겨루게 된다. 약초 아주머니는 지나가는 사람에게 약초차를 내어 준다. 시험용 구슬은 이 길에서 쓰라고 받은 구슬이다.",
    tags: ["장소", "도로"], refs: [{ kind: "map", id: MAP.meadow }], source: "1번 도로 대사",
  },
  {
    id: "ec_place_grove", type: "place", name: "실바나 마을",
    summary: "해마다 몬스터와 나무를 함께 심는 숲 마을. 체육관과 회복 센터, 도구점이 있다.",
    body: "체육관의 덩굴도 마을 사람들이 심은 나무에서 자랐다. 마을 북쪽에서 챔피언 전당의 문이 보이지만 신전 일이 끝나기 전에는 닫혀 있다. 라이벌 나루가 여기서 다시 나타나 배지를 받았는지 묻는다.",
    tags: ["장소", "두 번째 마을"], refs: [{ kind: "map", id: MAP.grove }], source: "실바나 주민 대사",
  },
  {
    id: "ec_place_gym", type: "place", name: "실바나 체육관",
    summary: "유리 지붕 아래 덩굴이 자란 풀 타입 체육관. 새싹 돌 받침 퍼즐과 수련생 셋을 지나야 관장 유림이 나온다.",
    body: "입구에서 체육관 안내원이 규칙을 알려 준다. 가시 덤불은 정원 가위로 치우고, 새싹 돌 받침에는 해가 도는 차례대로 물을 준다. 동쪽 받침이 먼저다. 맞게 주면 덩굴 문이 열린다.",
    tags: ["장소", "체육관"], refs: [{ kind: "map", id: MAP.groveGym }, { kind: "event", id: "mx_map_grove_gym_leader" }], source: "체육관 퍼즐과 대사",
  },
  {
    id: "ec_place_route2", type: "place", name: "2번 도로 솔방울 언덕",
    summary: "실바나 동쪽의 언덕길. 1번 도로에는 없던 드문 몬스터가 산다.",
    body: "서식지 연구원이 길을 지킨다. 보물 상자에는 포획 구슬 세 개와 상급 회복약, 성장 사탕이 들어 있다.",
    tags: ["장소", "도로"], refs: [{ kind: "map", id: MAP.garden }], source: "2번 도로 맵과 대사",
  },
  {
    id: "ec_place_temple", type: "place", name: "별모래 신전",
    summary: "실바나에서 다리로 닿는 신전. 밤막회사 대표 무영이 별빛을 모으던 곳이다.",
    body: "새잎 배지가 없는 사람은 다리 앞에서 수련생에게 돌려보내진다. 신전 안쪽 벽에는 빛을 잃은 별무늬가 새겨져 있다.",
    tags: ["장소", "최종 무대"], refs: [{ kind: "map", id: MAP.temple }, { kind: "event", id: "mx_map_observatory_boss" }], source: "신전 대사",
  },
  {
    id: "ec_place_hall", type: "place", name: "챔피언 전당",
    summary: "실바나 북쪽 끝의 리그 전당. 신전의 일이 끝나야 문이 열리고, 챔피언 나루가 기다린다.",
    body: "리그 안내원은 챔피언이 되어도 모험은 계속된다고 말한다. 고향에 돌아가 희귀 몬스터와 도감을 찾아보라고도 한다.",
    tags: ["장소", "리그"], refs: [{ kind: "map", id: MAP.hall }, { kind: "event", id: "mx_map_league_0_league_challenge" }], source: "전당 대사",
  },

  // 세력
  {
    id: "ec_faction_league", type: "faction", name: "아스트라 리그",
    summary: "군도의 트레이너 협회. 체육관의 배지를 모은 사람이 챔피언 전당에서 챔피언과 겨룬다.",
    body: "관장과 챔피언이 리그의 얼굴이다. 이긴 트레이너에게는 군도의 챔피언이라는 이름이 붙는다.",
    tags: ["세력"], refs: [{ kind: "map", id: MAP.hall }], source: "전당 대사",
  },
  {
    id: "ec_faction_nightcurtain", type: "faction", name: "밤막회사",
    summary: "별빛을 한곳에 모아 두려는 회사. 대표 무영이 별모래 신전에서 등대의 빛을 막고 있었다.",
    body: "회사는 별빛을 한곳에 모으면 누구도 길을 잃지 않는 질서가 생긴다고 주장한다. 주인공에게 패한 뒤 대표는 빛을 가둘 수 없다고 인정한다.",
    tags: ["세력", "악역"], refs: [{ kind: "event", id: "mx_map_observatory_boss" }], source: "무영 대사",
  },

  // 인물
  {
    id: "ec_char_hero", type: "character", name: "주인공",
    summary: "다우닝 시티에 사는 젊은 트레이너. 첫 동료를 받은 날 등대를 되살리는 길을 떠난다.",
    body: "이름은 플레이어가 정한다. 엄마가 깨워 주는 아침에 이야기가 시작되고, 챔피언 전당에서 나루를 이기며 끝난다.",
    tags: ["인물", "주인공"], refs: [{ kind: "actor", id: "actor_hero" }], source: "오프닝",
  },
  {
    id: "ec_char_mom", type: "character", name: "엄마",
    summary: "주인공의 어머니. 박사가 기다린다며 아침에 깨워 주고, 구슬이 떨어지면 세 개를 챙겨 준다.",
    tags: ["인물", "가족"], refs: [{ kind: "event", id: "mx_map_home_house_resident" }], source: "우리 집 대사",
  },
  {
    id: "ec_char_professor", type: "character", name: "천문박사",
    summary: "오르비스 천문 연구소의 박사. 세 마리 중 첫 동료를 고르게 하고 별빛 도감을 준다.",
    body: "등대를 살리려면 먼 길을 함께 걸을 동료가 필요하다고 말한다. 다음 목표로 실바나 체육관 관장 유림을 가리킨다.",
    tags: ["인물", "안내자"], refs: [{ kind: "event", id: "mx_map_lab_professor" }], source: "연구소 대사",
  },
  {
    id: "ec_char_naru", type: "character", name: "나루",
    summary: "같은 마을 출신 라이벌이자 마지막 상대. 도감은 자기가 먼저 채운다고 큰소리친다.",
    body: "연구소에서 자란 볼트온을 파트너로 삼았다. 첫 대결에서 주인공에게 포획 구슬 세 개를 나눠 주고, 실바나에서 다시 만나 배지를 받았는지 묻는다. 끝에는 챔피언으로 전당에서 기다린다.",
    tags: ["인물", "라이벌", "챔피언"],
    refs: [{ kind: "event", id: "mx_map_lab_rival" }, { kind: "event", id: "mx_map_grove_rival" }], source: "라이벌과 챔피언 대사",
  },
  {
    id: "ec_char_yurim", type: "character", name: "유림",
    summary: "실바나 체육관의 관장. 풀 타입 트레이너로, 동료와 서로의 그늘이 되어 주는 강함을 본다.",
    body: "이긴 주인공에게 동료가 믿고 움직이는 걸 봤다며 새잎의 약속을 맡긴다. 새잎 배지와 부활의 깃털을 건넨다.",
    tags: ["인물", "관장"], refs: [{ kind: "event", id: "mx_map_grove_gym_leader" }], source: "체육관 대사",
  },
  {
    id: "ec_char_muyeong", type: "character", name: "무영",
    summary: "밤막회사 대표. 별빛을 한곳에 모아 군도를 한 질서로 묶으려 했고, 신전에서 주인공에게 막힌다.",
    body: "배지 없이 온 사람에게는 돌아가라고 한다. 패한 뒤에는 이 군도를 처음부터 다시 걸어 보겠다고 말한다.",
    tags: ["인물", "악역"], refs: [{ kind: "event", id: "mx_map_observatory_boss" }], source: "신전 대사",
  },
  {
    id: "ec_char_center_staff", type: "character", name: "센터 직원",
    summary: "마을 회복 센터의 직원. 말을 걸면 파티의 몬스터를 모두 고쳐 준다.",
    tags: ["인물", "회복"], refs: [{ kind: "event", id: "mx_map_home_center_nurse" }], source: "회복 센터 대사",
  },
  {
    id: "ec_char_gym_trainees", type: "character", name: "덩굴지기 하람, 정원사 소이, 수련생 도윤",
    summary: "실바나 체육관에서 관장 앞을 막는 세 트레이너.",
    body: "체육관 퍼즐 구간마다 한 명씩 선다. 도윤 같은 수련생은 배지가 없는 사람이 신전 다리를 건너지 못하게 막기도 한다.",
    tags: ["인물", "체육관"],
    refs: [{ kind: "event", id: "mx_map_grove_gym_grunt_0" }, { kind: "event", id: "mx_map_grove_gym_grunt_1" }, { kind: "event", id: "mx_map_grove_gym_grunt_2" }],
    source: "체육관 대사",
  },

  // 몬스터
  {
    id: "ec_mon_toriph", type: "concept", name: "토리프 계통(풀)",
    summary: "첫 동료 후보. 귀 끝의 새싹으로 바람을 읽는다. 토리프, 실바리온, 벨데로드로 진화한다.",
    body: "씨앗을 묻은 장소를 잊지 않는다. 16레벨에 실바리온, 34레벨에 벨데로드(풀과 에스퍼)가 된다.",
    tags: ["몬스터", "첫 동료"], source: "연구소 대사와 종 데이터",
  },
  {
    id: "ec_mon_coalbit", type: "concept", name: "숯꼬미 계통(불)",
    summary: "첫 동료 후보. 바위 틈의 잔열을 먹고, 졸리면 비늘에서 작은 불꽃이 샌다. 숯꼬미, 불박치, 마그렉스로 진화한다.",
    body: "16레벨에 불박치, 34레벨에 마그렉스(불과 격투)가 된다.",
    tags: ["몬스터", "첫 동료"], source: "연구소 대사와 종 데이터",
  },
  {
    id: "ec_mon_rivulet", type: "concept", name: "아가핀 계통(물)",
    summary: "첫 동료 후보. 조약돌을 배 위에 올리고 물에 뜨며 맑은 물소리를 좋아한다. 아가핀, 마린웨이, 네레이드로 진화한다.",
    body: "16레벨에 마린웨이, 34레벨에 네레이드(물과 얼음)가 된다.",
    tags: ["몬스터", "첫 동료"], source: "연구소 대사와 종 데이터",
  },
  {
    id: "ec_mon_zaptoe", type: "concept", name: "볼트온 계통(전기)",
    summary: "라이벌 나루의 파트너. 연구소에서 자란 전기 몬스터로 볼트온, 코일라군, 라이곤으로 진화한다.",
    body: "18레벨 또는 번개의 돌로 코일라군이 되고, 36레벨에 라이곤(전기와 드래곤)이 된다.",
    tags: ["몬스터", "라이벌"], source: "종 데이터와 라이벌 대결",
  },

  // 물건과 용어
  {
    id: "ec_item_dex", type: "item", name: "별빛 도감",
    summary: "박사가 주는 도감. 만난 몬스터가 저절로 기록된다.",
    body: "나루는 도감을 자기가 먼저 채우겠다고 말한다. 신전에서 희귀 몬스터를 만나면 도감에 별빛의 만남으로 적힌다.",
    tags: ["물건", "도감"], source: "연구소 대사",
  },
  {
    id: "ec_item_badge", type: "item", name: "새잎 배지",
    summary: "실바나 체육관의 배지. 메뉴의 배지 칸 맨 앞에 들어가고, 신전 다리를 건너는 통행증이 된다.",
    tags: ["물건", "배지"], refs: [{ kind: "event", id: "mx_map_grove_gym_leader" }], source: "유림 대사",
  },
  {
    id: "ec_item_orb", type: "item", name: "포획 구슬",
    summary: "야생 몬스터를 동료로 삼는 구슬. 힘을 뺀 뒤 가방에서 던진다.",
    body: "체력이 노랗게 줄었을 때 더 잘 듣는다. 도구점에서 팔고, 떨어지면 엄마가 세 개를 준다. 다른 사람의 몬스터에는 쓸 수 없다.",
    tags: ["물건", "포획"], refs: [{ kind: "item", id: "item_capture_orb" }], source: "학교와 도구점 대사",
  },
  {
    id: "ec_item_trial_orb", type: "item", name: "시험용 구슬",
    summary: "박사가 처음에 주는 구슬. 처음 한 번은 꼭 잡힌다.",
    body: "1번 도로에서 써 보라고 받는다.",
    tags: ["물건", "포획"], refs: [{ kind: "item", id: "mx_item_trial_orb" }], source: "연구소 대사",
  },
  {
    id: "ec_item_feather", type: "item", name: "부활의 깃털",
    summary: "유림이 새잎 배지와 함께 주는 깃털. 쓰러진 몬스터를 되살린다.",
    tags: ["물건", "회복"], refs: [{ kind: "item", id: "mx_revive" }], source: "체육관 보상",
  },

  // 사건
  {
    id: "ec_event_lighthouse", type: "event", name: "깜빡이는 등대와 여명의 날개",
    summary: "등대의 불빛이 흐려져 철새가 길을 잃는다. 이야기 전체의 문제이자 마지막에 해결되는 일.",
    body: "마을 사람들은 등대가 새벽마다 깜빡인다고 말한다. 새들은 광장 위를 맴돈다. 무영을 이기자 배지의 빛과 몬스터들의 울음이 한데 모여 등대가 다시 밝아지고, 새떼가 군도를 건넌다.",
    tags: ["사건", "핵심"], source: "마을 대사와 엔딩",
  },
  {
    id: "ec_event_gym_puzzle", type: "event", name: "새싹 돌 받침 퍼즐",
    summary: "해가 도는 차례로 물을 주면 체육관의 덩굴 문이 열린다.",
    body: "동쪽부터 차례로 물을 준다. 가시 덤불은 정원 가위로 치운다. 푸는 동안 수련생 세 명과 만난다.",
    tags: ["사건", "체육관"], refs: [{ kind: "map", id: MAP.groveGym }], source: "체육관 맵과 이벤트",
  },
  {
    id: "ec_event_temple_battle", type: "event", name: "별모래 신전의 결전",
    summary: "주인공이 무영을 이겨 등대의 불을 되살린 순간. 챔피언 전당의 문이 열린다.",
    body: "무영은 배지 하나로 자신을 막을 수 있겠느냐고 외친다. 진 뒤에는 빛을 가둬 둘 수 없다는 것을 알게 된다.",
    tags: ["사건", "결전"], refs: [{ kind: "event", id: "mx_map_observatory_boss" }], source: "신전 대사",
  },
  {
    id: "ec_event_champion", type: "event", name: "챔피언 나루와의 마지막 대결",
    summary: "전당에서 나루와 겨룬다. 이기면 아스트라 군도의 챔피언이 된다.",
    body: "나루는 같은 마을에서 출발한 둘이 여기서 다시 만났다며 온 마음으로 싸우자고 한다. 지고 나서는 챔피언은 너라고 말한다.",
    tags: ["사건", "결말"], refs: [{ kind: "event", id: "mx_map_league_0_league_challenge" }], source: "챔피언 대사",
  },
  {
    id: "ec_secret_starlight", type: "event", name: "신전의 별무늬와 별빛의 만남",
    summary: "챔피언이 되기 전에는 빛을 잃은 별무늬만 보인다. 챔피언이 된 뒤 신전에 가면 희귀 몬스터 여섯 마리가 별빛을 따라 나타난다.",
    body: "챔피언이 되기 전에는 신전의 벽에서 빛을 잃은 별무늬가 보이고, 챔피언이 된 뒤에 다시 와 보자는 말만 나온다. 챔피언이 된 뒤에는 뇌제라칸, 빙화세라, 솔라레온, 루나만타, 스카라킹, 아스트록이 별빛을 따라 나타난다. 도감에는 별빛의 만남으로 기록된다. 놓쳐도 언젠가 다시 나타난다.",
    tags: ["비밀", "희귀 몬스터"], visibility: "ai-hidden", refs: [{ kind: "map", id: MAP.temple }], source: "신전 별무늬 이벤트",
  },
];

const RELATIONS: readonly CodexRelation[] = [
  { a: "ec_place_dawning_city", b: "ec_place_archipelago", kind: "locatedIn" },
  { a: "ec_place_grove", b: "ec_place_archipelago", kind: "locatedIn" },
  { a: "ec_place_temple", b: "ec_place_archipelago", kind: "locatedIn" },
  { a: "ec_place_hall", b: "ec_place_archipelago", kind: "locatedIn" },
  { a: "ec_place_lab", b: "ec_place_dawning_city", kind: "locatedIn" },
  { a: "ec_place_school", b: "ec_place_dawning_city", kind: "locatedIn" },
  { a: "ec_place_center", b: "ec_place_dawning_city", kind: "locatedIn", note: "실바나에도 같은 센터가 있다" },
  { a: "ec_place_route1", b: "ec_place_dawning_city", kind: "custom", note: "다우닝에서 실바나로 이어지는 길" },
  { a: "ec_place_gym", b: "ec_place_grove", kind: "locatedIn" },
  { a: "ec_place_route2", b: "ec_place_grove", kind: "custom", note: "실바나에서 이어지는 언덕길" },
  { a: "ec_place_temple", b: "ec_place_grove", kind: "custom", note: "다리로 닿는다. 새잎 배지가 있어야 건넌다" },
  { a: "ec_place_hall", b: "ec_place_grove", kind: "custom", note: "마을 북쪽 끝. 신전 일이 끝나야 문이 열린다" },
  { a: "ec_char_hero", b: "ec_place_dawning_city", kind: "locatedIn" },
  { a: "ec_char_mom", b: "ec_place_dawning_city", kind: "locatedIn" },
  { a: "ec_char_professor", b: "ec_place_lab", kind: "locatedIn" },
  { a: "ec_char_center_staff", b: "ec_place_center", kind: "locatedIn" },
  { a: "ec_char_yurim", b: "ec_place_gym", kind: "locatedIn" },
  { a: "ec_char_gym_trainees", b: "ec_place_gym", kind: "locatedIn" },
  { a: "ec_char_muyeong", b: "ec_place_temple", kind: "locatedIn" },
  { a: "ec_char_naru", b: "ec_place_hall", kind: "locatedIn", note: "챔피언으로 기다린다" },
  { a: "ec_char_naru", b: "ec_faction_league", kind: "memberOf", note: "챔피언" },
  { a: "ec_char_yurim", b: "ec_faction_league", kind: "memberOf", note: "실바나 체육관 관장" },
  { a: "ec_char_muyeong", b: "ec_faction_nightcurtain", kind: "memberOf", note: "대표" },
  { a: "ec_faction_nightcurtain", b: "ec_char_hero", kind: "enemyOf" },
  { a: "ec_char_muyeong", b: "ec_char_hero", kind: "enemyOf" },
  { a: "ec_char_muyeong", b: "ec_event_lighthouse", kind: "causedBy", note: "별빛을 모아 등대의 빛을 막았다" },
  { a: "ec_char_hero", b: "ec_char_professor", kind: "knows" },
  { a: "ec_char_hero", b: "ec_char_mom", kind: "knows" },
  { a: "ec_char_hero", b: "ec_char_naru", kind: "custom", note: "같은 마을의 라이벌" },
  { a: "ec_char_hero", b: "ec_char_yurim", kind: "custom", note: "배지를 받는 스승 같은 상대" },
  { a: "ec_char_professor", b: "ec_char_hero", kind: "allyOf" },
  { a: "ec_char_naru", b: "ec_mon_zaptoe", kind: "owns" },
  { a: "ec_char_hero", b: "ec_item_dex", kind: "owns" },
  { a: "ec_char_hero", b: "ec_item_badge", kind: "owns" },
  { a: "ec_item_badge", b: "ec_char_yurim", kind: "causedBy" },
  { a: "ec_item_feather", b: "ec_char_yurim", kind: "causedBy" },
  { a: "ec_event_gym_puzzle", b: "ec_place_gym", kind: "locatedIn" },
  { a: "ec_event_temple_battle", b: "ec_place_temple", kind: "locatedIn" },
  { a: "ec_event_champion", b: "ec_place_hall", kind: "locatedIn" },
  { a: "ec_event_champion", b: "ec_event_temple_battle", kind: "causedBy", note: "신전의 일이 끝나야 전당 문이 열린다" },
  { a: "ec_secret_starlight", b: "ec_place_temple", kind: "locatedIn" },
  { a: "ec_secret_starlight", b: "ec_event_champion", kind: "causedBy", note: "챔피언이 된 뒤에 열린다" },
];

interface Profile {
  readonly characterId: string;
  readonly displayName: string;
  readonly note: string;
  readonly nameColor: string;
}

/** displayName 은 게임 대사의 화자 이름과 글자까지 같아야 이름 색이 붙는다. */
const PROFILES: readonly Profile[] = [
  { characterId: "ec_professor", displayName: "천문박사", note: "오르비스 천문 연구소의 박사. 첫 동료와 별빛 도감을 건넨다.", nameColor: "#3f7c85" },
  { characterId: "ec_naru_rival", displayName: "라이벌 나루", note: "같은 마을 출신 라이벌. 볼트온과 함께 도감을 먼저 채우겠다고 한다.", nameColor: "#d9a432" },
  { characterId: "ec_naru_champion", displayName: "챔피언 · 나루", note: "챔피언 전당에서 기다리는 아스트라 군도의 챔피언.", nameColor: "#c97a2c" },
  { characterId: "ec_yurim", displayName: "유림", note: "실바나 체육관의 관장. 풀 타입을 쓴다.", nameColor: "#4f9a56" },
  { characterId: "ec_muyeong", displayName: "밤막회사 대표 · 무영", note: "별빛을 한곳에 모으려 한 밤막회사의 대표.", nameColor: "#6b5a9e" },
  { characterId: "ec_mom", displayName: "엄마", note: "주인공의 어머니. 구슬이 떨어지면 세 개를 챙겨 준다.", nameColor: "#c8667f" },
  { characterId: "ec_center_staff", displayName: "센터 직원", note: "회복 센터에서 파티의 몬스터를 고쳐 준다.", nameColor: "#4a9bb5" },
];

export function applyEmeraldCrownLore(project: Project, exec: LoreExec = loreExec): void {
  exec(project, "set_world_canon", {
    canon: {
      name: "아스트라 호라이즌: 다우닝 시티와 여명의 날개",
      premise: "등대의 불빛이 흐려져 철새 여명의 날개가 바다 위에서 길을 잃는다. 다우닝 시티의 젊은 트레이너가 첫 동료와 함께 실바나, 별모래 신전, 챔피언 전당을 지나 등대를 되살린다.",
      tones: ["hopeful", "slice", "fairytale"],
      era: "현대에 가까운 섬나라, 별빛이 길을 밝히는 시대",
      techCeiling: "구슬과 도감, 회복 센터 같은 몬스터 포획과 치료 기술",
      absences: ["전쟁", "사람을 해치는 폭력"],
      laws: {
        power: { present: true, note: "몬스터가 기술을 쓰고, 별빛이 길과 몬스터를 부른다." },
        gods: { present: false, note: "신앙은 별모래 신전과 별빛의 전설로만 남아 있다." },
        death: { present: false, note: "쓰러진 몬스터는 센터에서 고친다. 죽음은 다루지 않는다." },
        money: { present: true, note: "도구점이 구슬과 회복약을 판다." },
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
        displayName: existing?.displayName ? existing.displayName : profile.displayName,
        ...(note ? { note } : {}),
        ...(existing?.birthday ? { birthday: existing.birthday } : {}),
        ...(existing?.giftPrefs ? { giftPrefs: existing.giftPrefs } : {}),
        ...(existing?.giftResponses ? { giftResponses: existing.giftResponses } : {}),
        dialogue: { ...(existing?.dialogue ?? {}), nameColor: profile.nameColor },
      },
    });
  }
}
