// 장르 변주 데크 — «회상 형 게임 만들어 줘» 가 열쇠와 상관없이 늘 마을 + 길이 되지 않게, 첫 게임 지시문에 씨앗으로 뽑아 넣는 재료.
// 순수 데이터다(실행·프로젝트를 모른다). 뽑기는 pick.ts, 지시문 글은 card.ts.
//
// 왜(2026-11-24 qa1124-ai-gen 항목 2): 같은 장르 요청이 게임마다 같은 글을 받았고(씨앗으로 바뀌는 지시문 줄 0), 모델은 가장 싼 «마을 + 숲길 + 집 안» 으로 갔다.
// 규칙: 데크 한 장의 장소 후보는 전부 «짓는 길»(build)이 있다 — 세계 종류·실내 방 낱말·던전 테마·현대 거리·마을 테마. 짓는 길이 없는 후보는 넣지 않는다
// (test/variationDecks.test.ts 가 낱말마다 실제 코드의 표에 있는지 확인한다).

/** 장소를 짓는 길 — v2 make_place 의 type·theme·style, 또는 이 게임의 세계(place/world.ts WORLDS)의 장소 종류. */
export type Build =
  /** 이 게임의 세계 하나의 종류(그 세계의 칩셋·구성기). v2 는 build_places 가 짓는다. */
  | { readonly via: "world"; readonly world: string; readonly kind: string }
  /** make_place type:"interior" — 방 낱말(INTERIOR_CARD 의 zone kind: tavern·kitchen·study·living·cellar·chapel …). */
  | { readonly via: "interior"; readonly room: string }
  /** make_place type:"house" style kr-modern — 현대 한국 실내(카드의 낱말 또는 시설 표의 이름). */
  | { readonly via: "house"; readonly word: string }
  /** make_place type:"street" — style kr-modern 이면 hint 는 지구 종류 id, jp-modern 이면 JP 카드의 한 지구 낱말. */
  | { readonly via: "street"; readonly style: "kr-modern" | "jp-modern"; readonly hint: string }
  /** make_place type:"village" theme — river·coast·desert·snow·swamp. */
  | { readonly via: "village"; readonly theme: string }
  /** make_place type:"dungeon" theme — DUNGEON_TYPES 의 하나. */
  | { readonly via: "dungeon"; readonly theme: string };

export interface PlaceCandidate {
  /** 데크 안에서 하나뿐인 이름. */
  readonly id: string;
  /** 장소 종류(마을·포구·부엌…) — 한 판의 세 장소는 종류가 겹치지 않는다. 측정은 이 종류로 센다. */
  readonly kind: string;
  /** 지시문에 싣는 한국어 이름. */
  readonly ko: string;
  readonly build: Build;
  /** 사용자 글이 이 장소를 말하는 낱말 — 맞으면 이 장소를 첫 장소로 고정한다(사용자 말이 이긴다). */
  readonly words?: RegExp;
  /** 뽑힐 몫(기본 2 — 세계에 묶인 후보는 1). */
  readonly w?: number;
  /** 세계 후보가 그 세계의 실내 종류다 — 실내는 바깥 건물의 문에 달리므로 첫 장소가 될 수 없다(place/world.ts). */
  readonly indoor?: true;
}

export interface AxisOption {
  readonly ko: string;
  /** 사용자 글이 이미 이 축을 말하는 낱말 — 맞으면 그 축은 뽑지 않는다. */
  readonly words?: RegExp;
}

export type DeckId = "recall" | "mystery" | "warm" | "horror" | "romance" | "adventure";

export interface Deck {
  readonly id: DeckId;
  readonly ko: string;
  /** 사용자 글이 이 장르인가. adventure 는 낱말이 아니라 «아무 장르도 안 말한 모험·RPG 요청»(pick.ts adventureOk). */
  readonly match: RegExp;
  readonly places: readonly PlaceCandidate[];
  readonly events: readonly AxisOption[];
  readonly moods: readonly AxisOption[];
  readonly structures: readonly AxisOption[];
}

// ── 짓는 길 줄임 ──
const iv = (room: string): Build => ({ via: "interior", room });
const hk = (word: string): Build => ({ via: "house", word });
const sk = (hint: string): Build => ({ via: "street", style: "kr-modern", hint });
const sj = (hint: string): Build => ({ via: "street", style: "jp-modern", hint });
const vl = (theme: string): Build => ({ via: "village", theme });
const dg = (theme: string): Build => ({ via: "dungeon", theme });
const wd = (world: string, kind: string): Build => ({ via: "world", world, kind });
const P = (id: string, kind: string, ko: string, build: Build, words?: RegExp, w?: number): PlaceCandidate => ({ id, kind, ko, build, ...(words ? { words } : {}), ...(w ? { w } : {}) });
/** 세계에 묶인 후보(몫 1). 같은 세계의 후보끼리만 한 판에 선다(한 게임 = 한 세계, world.ts). */
const W = (id: string, kind: string, ko: string, world: string, worldKind: string, words?: RegExp): PlaceCandidate => ({
  ...P(id, kind, ko, wd(world, worldKind), words, 1), ...(INDOOR_WORLD_KINDS.has(`${world}/${worldKind}`) ? { indoor: true as const } : {}),
});
/** 데크가 쓰는 세계 종류 중 실내인 것(test/variationDecks.test.ts 가 WORLDS 의 indoor 와 같은지 본다). */
const INDOOR_WORLD_KINDS: ReadonlySet<string> = new Set([
  "sky_island/observatory", "sky_island/cottage", "sengoku_edo/farmhouse", "sengoku_edo/inn", "sengoku_edo/samurai-house",
  "snow_north/cabin", "snow_north/tavern", "snow_north/longhall", "snow_north/ice-cave", "pirate_isles/hut", "pirate_isles/tavern",
  "steampunk_city/inn", "steampunk_city/workshop", "steampunk_city/lab", "steampunk_city/boiler-room", "steampunk_city/engine-room",
]);
const O = (ko: string, words?: RegExp): AxisOption => ({ ko, ...(words ? { words } : {}) });

/** 계절·시간·날씨 분위기 — 장르마다 이 위에 몇 줄을 더한다. */
const MOOD_COMMON: readonly AxisOption[] = [
  O("늦여름 한낮, 매미 소리와 흰 햇빛", /여름|한낮|매미/u),
  O("비 오는 저녁, 젖은 길과 노란 불빛", /비\s*오|빗소리|장마/u),
  O("눈 내리는 새벽의 고요", /눈\s*내|첫눈|함박눈/u),
  O("노을이 길게 드리운 오후", /노을|해\s*질/u),
  O("안개 낀 이른 아침", /안개/u),
  O("가을바람과 낙엽이 쌓인 길", /가을|낙엽/u),
  O("달빛이 밝은 한밤", /달빛|보름달|한밤/u),
  O("봄비가 그친 뒤의 맑은 공기", /봄비|봄날|벚꽃/u),
];

export const DECKS: readonly Deck[] = [
  {
    id: "recall", ko: "회상", match: /회상|추억|기억|과거|옛날|옛\s*기억|그때|돌아가신|추모|유품|회고|flashback|memor/iu,
    places: [
      P("home-village", "village", "고향 마을", vl("river"), /마을|고향|동네/u),
      P("fishing-port", "port", "포구 마을", vl("coast"), /포구|항구|어촌|바닷가/u),
      P("grandma-kitchen", "kitchen", "할머니 집 부엌", iv("kitchen"), /부엌|주방|(?:할머니|외할머니|할아버지)\s*(?:집|댁)/u),
      P("attic", "attic", "먼지 쌓인 다락방", iv("storeroom"), /다락/u),
      P("childhood-room", "bedroom", "어릴 적 내 방", iv("bedroom"), /침실|아이\s*방|내\s*방/u),
      P("old-library", "library", "오래된 도서관", hk("도서관"), /도서관|서재/u),
      P("hospital-room", "hospital", "병실", hk("병원"), /병원|병실|요양/u),
      P("train-station", "station", "간이 기차역", sk("station-front"), /기차|역전|철도|정거장|지하철/u),
      P("old-school", "school", "옛 학교 교실", hk("초등학교"), /학교|교실|초등|교정/u),
      P("shrine-yard", "shrine", "신사 마당", sj("shrine"), /신사|사찰/u),
      P("festival-street", "festival", "축제가 끝난 거리", sj("festival"), /축제|마츠리|불꽃놀이/u),
      P("riverside-walk", "riverside", "천변 산책로", sk("riverside"), /천변|강변|강가|산책로/u),
      P("old-market", "market", "재래시장", sk("market"), /시장|장터/u),
      P("bakery", "bakery", "골목 빵집", hk("빵집"), /빵집|제과/u),
      P("cafe", "cafe", "단골 카페", hk("카페"), /카페|찻집/u),
      P("chapel", "chapel", "작은 예배당", iv("chapel"), /성당|예배당|교회/u),
      P("lighthouse", "lighthouse", "등대 안(올라가는 계단)", iv("study"), /등대/u),
      P("hot-spring", "onsen", "온천 마을 목욕탕", sj("onsen"), /온천|목욕탕|센토/u),
      W("sky-village", "village", "하늘 마을", "sky_island", "village"),
      W("sky-dock", "dock", "비공정 부두", "sky_island", "dock"),
      W("sky-observatory", "observatory", "천문대", "sky_island", "observatory", /천문대/u),
      W("sky-cottage", "cottage", "구름 위 오두막", "sky_island", "cottage"),
      W("edo-village", "village", "농촌 마을", "sengoku_edo", "village"),
      W("edo-inn-street", "inn-street", "여관 거리", "sengoku_edo", "inn-street"),
      W("edo-temple", "temple", "절 경내", "sengoku_edo", "temple"),
      W("edo-farmhouse", "farmhouse", "농가 안(화로 방)", "sengoku_edo", "farmhouse"),
      W("edo-inn", "inn", "여관 안", "sengoku_edo", "inn"),
      W("snow-village", "village", "눈 덮인 마을", "snow_north", "village"),
      W("snow-lake", "lake", "얼어붙은 호수", "snow_north", "lake"),
      W("snow-cabin", "cabin", "통나무 오두막", "snow_north", "cabin"),
      W("snow-tavern", "tavern", "선술집", "snow_north", "tavern"),
      W("isle-beach", "beach", "야자 해변", "pirate_isles", "beach"),
      W("isle-harbor", "harbor", "작은 항구", "pirate_isles", "harbor"),
      W("isle-hut", "hut", "해변 오두막", "pirate_isles", "hut"),
      W("isle-tavern", "tavern", "항구 술집", "pirate_isles", "tavern"),
      W("steam-street", "street", "벽돌 거리", "steampunk_city", "street"),
      W("steam-dock", "dock", "운하 부두", "steampunk_city", "dock"),
      W("steam-workshop", "workshop", "태엽 공방", "steampunk_city", "workshop"),
      W("steam-inn", "inn", "여관 방", "steampunk_city", "inn"),
    ],
    events: [
      O("유품 상자에서 나온 낡은 편지 한 통", /유품|편지/u),
      O("끝내 전하지 못한 말을 전하러 가는 길", /전하지\s*못한/u),
      O("오래전에 한 약속을 지키러 돌아온 날", /약속/u),
      O("낡은 사진 속 낯선 얼굴의 정체를 좇는 일", /사진/u),
      O("문 닫기 직전 가게의 마지막 하루", /폐업|마지막\s*하루/u),
      O("오랜 친구와 다시 만나는 재회", /재회|친구/u),
      O("잃어버린 물건이 기억을 불러내는 순간", /잃어버린/u),
      O("이사 가기 전날 밤의 짐 정리", /이사/u),
      O("고장 난 오르골을 고쳐 소리를 되찾기", /오르골|시계/u),
      O("장례 뒤 남겨진 집을 비우는 사흘", /장례|유산|집\s*정리/u),
      O("어릴 때 묻어 둔 타임캡슐을 파내는 날", /타임캡슐/u),
      O("끝을 모르는 옛 노래의 가사를 이어 가기", /노래|가사/u),
      O("첫눈이 오면 열리는 가게 문", /첫눈/u),
    ],
    moods: [...MOOD_COMMON, O("먼지 낀 햇살이 비스듬히 드는 오후", /먼지/u), O("겨울 저녁 난로 불빛과 김 서린 창", /난로/u)],
    structures: [
      O("한 장소를 현재와 과거 두 시대로 겹쳐 보여 준다", /두\s*시대|겹쳐/u),
      O("기억 조각마다 다른 장소를 찾아가 모으는 수집형", /조각/u),
      O("갈림길 회상 — 선택에 따라 기억의 결말이 달라진다", /갈림길|선택/u),
      O("한 집 안의 여러 방을 한 방씩 열어 가는 구조", /방을\s*열/u),
      O("현재에서 과거로 거꾸로 거슬러 오르는 구조", /거꾸로|거슬러/u),
      O("한 사람이 아닌 세 사람의 기억을 이어 붙이는 구조", /세\s*사람|여러\s*사람/u),
      O("낮의 현재와 밤의 꿈속 기억을 오가는 이중 구조", /꿈속|이중/u),
    ],
  },
  {
    id: "mystery", ko: "추리", match: /추리|탐정|미스터리|범인|살인|단서|수사|사건\s*해결|mystery|detective/iu,
    places: [
      P("mansion-study", "study", "저택 서재", iv("study"), /서재/u),
      P("parlor", "parlor", "응접실", iv("living"), /응접실|거실/u),
      P("dining-hall", "dining", "만찬이 차려진 식당", iv("dining"), /식당|만찬/u),
      P("wine-cellar", "cellar", "지하 저장고", iv("cellar"), /저장고|지하실/u),
      P("old-library", "library", "문 닫은 도서관", hk("도서관"), /도서관/u),
      P("clinic", "hospital", "한밤의 병원", hk("병원"), /병원/u),
      P("hotel-lobby", "lobby", "호텔 로비", hk("빌딩 로비"), /호텔|로비/u),
      P("museum", "gallery", "미술관 전시실", hk("미술관"), /미술관|전시/u),
      P("night-station", "station", "막차 끊긴 기차역", sk("station-front"), /기차|역전|철도|지하철/u),
      P("shop-alley", "alley", "상가 골목", sk("sangga-alley"), /골목|상가/u),
      P("villa-town", "villa", "빌라촌", sk("villa-town"), /빌라/u),
      P("apartments", "apartment", "아파트 단지", sk("apt-complex"), /아파트/u),
      P("campus", "campus", "대학가", sk("campus-town"), /대학|캠퍼스/u),
      P("fog-port", "port", "안개 낀 포구 마을", vl("coast"), /포구|항구|어촌/u),
      P("hill-village", "village", "산골 마을", vl("river"), /마을|동네/u),
      P("shrine", "shrine", "한적한 신사", sj("shrine"), /신사/u),
      P("catacomb", "catacomb", "지하 묘지", dg("catacomb"), /묘지|납골/u),
      P("sewer", "sewer", "하수도", dg("sewer"), /하수도/u),
      W("steam-street", "street", "증기 도시 거리", "steampunk_city", "street"),
      W("steam-workshop", "workshop", "발명가의 공방", "steampunk_city", "workshop"),
      W("steam-lab", "lab", "연구실", "steampunk_city", "lab"),
      W("steam-inn", "inn", "여관 방", "steampunk_city", "inn"),
      W("steam-dock", "dock", "운하 부두", "steampunk_city", "dock"),
      W("edo-town", "town", "성하 마을", "sengoku_edo", "castle-town"),
      W("edo-inn-street", "inn-street", "여관 거리", "sengoku_edo", "inn-street"),
      W("edo-estate", "estate", "무가 저택", "sengoku_edo", "samurai"),
      W("edo-samurai-room", "samurai-room", "저택 안 다실", "sengoku_edo", "samurai-house"),
      W("edo-inn", "inn", "여관 안", "sengoku_edo", "inn"),
      W("station-deck", "station", "정거장 로비", "sf_station", "station"),
      W("station-street", "street", "네온 거리", "sf_station", "street"),
      W("station-lab", "lab", "연구 기지", "sf_station", "lab"),
      W("snow-village", "village", "눈 덮인 마을", "snow_north", "village"),
      W("snow-longhall", "longhall", "회관", "snow_north", "longhall"),
      W("snow-cabin", "cabin", "통나무 오두막", "snow_north", "cabin"),
      W("snow-tavern", "tavern", "선술집", "snow_north", "tavern"),
    ],
    events: [
      O("안에서 잠긴 방에서 발견된 변사체", /밀실|잠긴/u),
      O("사라진 유언장을 둘러싼 소동", /유언/u),
      O("같은 시각 모두에게 알리바이가 있다", /알리바이/u),
      O("편지로 날아든 범행 예고", /예고|편지/u),
      O("진짜 보석과 가짜 보석이 바뀐 밤", /보석/u),
      O("오래전 사건의 진범이 다시 나타난다", /진범/u),
      O("딱 한 사람만 거짓을 말하는 증언", /거짓|증언/u),
      O("폭풍우로 고립된 곳에서 이어지는 사건", /폭풍|고립/u),
      O("실종자의 마지막 행적을 되짚는 사흘", /실종/u),
      O("의뢰인이 사실은 범인의 가족이었다", /의뢰인/u),
      O("사진 속 시계가 가리키는 시각의 모순", /시계|사진/u),
      O("도난당한 것이 아무 가치 없는 물건", /도난/u),
      O("연극 도중에 일어난 사고", /연극|무대/u),
    ],
    moods: [...MOOD_COMMON, O("정전된 밤, 손전등과 촛불", /정전|촛불/u), O("폭우가 창을 두드리는 밤", /폭우/u), O("흐린 오후의 눅눅한 공기", /흐린/u)],
    structures: [
      O("장소마다 한 명씩 심문해 모순을 모은다", /심문/u),
      O("한 현장을 시간 순으로 세 번 다시 본다", /다시\s*본/u),
      O("용의자별 챕터를 돌고 마지막에 지목한다", /챕터|지목/u),
      O("현장은 한 건물, 단서는 방마다 흩어져 있다", /한\s*건물/u),
      O("결말부터 보여 주고 과정을 재구성한다", /재구성/u),
      O("두 사건이 하나의 진상으로 이어진다", /두\s*사건/u),
    ],
  },
  {
    id: "warm", ko: "감동·일상", match: /감동|힐링|일상|따뜻|가족|눈물|휴먼|우정|성장|잔잔|heartwarming|slice\s*of\s*life/iu,
    places: [
      P("bakery", "bakery", "새벽 빵집", hk("빵집"), /빵집|제과/u),
      P("cafe", "cafe", "골목 카페", hk("카페"), /카페|찻집/u),
      P("flower-shop", "florist", "꽃집", hk("꽃집"), /꽃집/u),
      P("clinic", "clinic", "동네 의원", hk("의원"), /의원|병원/u),
      P("kindergarten", "kindergarten", "유치원", hk("유치원"), /유치원/u),
      P("school", "school", "초등학교", hk("초등학교"), /학교/u),
      P("riverside", "riverside", "천변 산책로", sk("riverside"), /천변|강변|강가|산책로/u),
      P("market", "market", "재래시장", sk("market"), /시장|장터/u),
      P("alley", "alley", "상가 골목", sk("sangga-alley"), /골목|상가/u),
      P("station", "station", "작은 기차역", sk("station-front"), /기차|역전|철도/u),
      P("town", "village", "정든 마을", vl("river"), /마을|동네|고향/u),
      P("port", "port", "포구 마을", vl("coast"), /포구|항구|어촌|바닷가/u),
      P("shrine", "shrine", "신사 마당", sj("shrine"), /신사/u),
      P("festival", "festival", "마을 축제 거리", sj("festival"), /축제|마츠리/u),
      P("hot-spring", "onsen", "온천 마을", sj("onsen"), /온천|목욕탕/u),
      P("home-kitchen", "kitchen", "식구들의 부엌", iv("kitchen"), /부엌|주방/u),
      P("living-room", "living", "온 가족 거실", iv("living"), /거실/u),
      P("chapel", "chapel", "작은 예배당", iv("chapel"), /성당|예배당|교회/u),
      W("sky-village", "village", "하늘 마을", "sky_island", "village"),
      W("sky-cottage", "cottage", "오두막", "sky_island", "cottage"),
      W("sky-dock", "dock", "비공정 부두", "sky_island", "dock"),
      W("sky-observatory", "observatory", "천문대", "sky_island", "observatory"),
      W("snow-village", "village", "눈 덮인 마을", "snow_north", "village"),
      W("snow-lake", "lake", "얼어붙은 호수", "snow_north", "lake"),
      W("snow-cabin", "cabin", "통나무 오두막", "snow_north", "cabin"),
      W("snow-tavern", "tavern", "선술집", "snow_north", "tavern"),
      W("edo-village", "village", "농촌 마을", "sengoku_edo", "village"),
      W("edo-inn-street", "inn-street", "여관 거리", "sengoku_edo", "inn-street"),
      W("edo-farmhouse", "farmhouse", "농가 안", "sengoku_edo", "farmhouse"),
      W("edo-inn", "inn", "여관 안", "sengoku_edo", "inn"),
      W("isle-beach", "beach", "야자 해변", "pirate_isles", "beach"),
      W("isle-harbor", "harbor", "작은 항구", "pirate_isles", "harbor"),
      W("isle-hut", "hut", "해변 오두막", "pirate_isles", "hut"),
      W("isle-tavern", "tavern", "항구 술집", "pirate_isles", "tavern"),
    ],
    events: [
      O("처음으로 혼자 맡은 하루짜리 가게 보기", /가게/u),
      O("이웃 노인에게 전해 줄 물건을 들고 마을을 도는 하루", /이웃|배달/u),
      O("사라진 반려동물을 온 동네가 함께 찾는 날", /반려|고양이|강아지/u),
      O("떠나는 친구에게 깜짝 송별회를 준비하는 사흘", /송별|이별/u),
      O("오래 닫혀 있던 가게를 다시 여는 아침", /다시\s*여는|재개업/u),
      O("가족 모두가 모이는 마지막 명절", /명절|가족/u),
      O("서툰 요리로 아픈 사람을 챙기는 하루", /요리|아픈/u),
      O("편지 한 통이 이어 주는 두 사람", /편지/u),
      O("마을 행사의 준비를 나눠 맡는 이웃들", /행사|축제/u),
      O("졸업을 앞둔 마지막 방과 후", /졸업/u),
      O("처음 만난 아이의 길 잃은 하루를 돕기", /길\s*잃/u),
      O("오랜 라이벌과 같은 편이 되는 하루", /라이벌/u),
    ],
    moods: [...MOOD_COMMON, O("따뜻한 난로와 김이 오르는 찻잔", /난로|찻잔/u), O("해가 막 뜬 이른 아침의 상쾌함", /이른\s*아침|새벽/u)],
    structures: [
      O("하루를 아침·낮·밤 세 장면으로 나누는 구조", /하루/u),
      O("이웃 집을 한 집씩 돌며 사연을 모으는 구조", /이웃/u),
      O("계절이 한 장소를 네 번 다르게 바꾼다", /계절/u),
      O("한 사람의 부탁이 다음 사람의 부탁으로 이어지는 릴레이", /릴레이|부탁/u),
      O("마지막 장면에서 처음 장면이 다른 뜻으로 돌아온다", /마지막\s*장면/u),
      O("선택이 아니라 순서가 이야기를 바꾸는 구조", /순서/u),
    ],
  },
  {
    id: "horror", ko: "공포", match: /공포|호러|무서|귀신|괴담|오싹|유령|좀비|horror|scary|ghost/iu,
    places: [
      P("haunted-school", "school", "폐교 교실", hk("초등학교"), /학교|교실/u),
      P("abandoned-hospital", "hospital", "폐병원 병동", hk("병원"), /병원|병동/u),
      P("manor-parlor", "parlor", "저택 응접실", iv("living"), /저택|응접실|별장/u),
      P("basement", "cellar", "지하실", iv("cellar"), /지하실/u),
      P("prison", "cell", "감옥", iv("cell"), /감옥|독방/u),
      P("old-chapel", "chapel", "버려진 예배당", iv("chapel"), /성당|예배당|교회/u),
      P("villa-night", "villa", "불 꺼진 빌라촌", sk("villa-town"), /빌라/u),
      P("apartment-night", "apartment", "한밤의 아파트 단지", sk("apt-complex"), /아파트/u),
      P("subway", "subway", "막차 지하철역", hk("지하철역"), /지하철/u),
      // «밤의 미술관에 갇힌 아이» 가 카드 장소에 없어 사용자 말과 어긋난 장소 셋을 받았다(2026-11-26 variant-remeasure, 장소 0/3).
      P("night-museum", "gallery", "미술관", hk("미술관"), /미술관|박물관|전시실/u),
      P("alley-night", "alley", "비 오는 상가 골목", sk("sangga-alley"), /골목/u),
      P("swamp-village", "swamp-village", "늪 위의 마을", vl("swamp"), /늪/u),
      P("hill-village", "village", "인적 끊긴 마을", vl("river"), /마을/u),
      P("catacomb", "catacomb", "지하 묘지", dg("catacomb"), /묘지|납골/u),
      P("sewer", "sewer", "하수도", dg("sewer"), /하수도/u),
      P("mine", "mine", "폐광", dg("mine"), /폐광|광산/u),
      P("dead-forest", "forest", "안개 낀 숲", dg("forest"), /숲/u),
      P("labyrinth", "labyrinth", "끝없는 복도", dg("labyrinth"), /미로|복도/u),
      P("lost-temple", "temple", "버려진 신전", dg("temple"), /신전/u),
      W("snow-village", "village", "눈 덮인 마을", "snow_north", "village"),
      W("snow-cabin", "cabin", "외딴 통나무 오두막", "snow_north", "cabin"),
      W("snow-longhall", "longhall", "텅 빈 회관", "snow_north", "longhall"),
      W("snow-ice-cave", "ice-cave", "얼음 동굴", "snow_north", "ice-cave"),
      W("edo-castle", "castle", "인기척 없는 성", "sengoku_edo", "castle"),
      W("edo-temple", "temple", "비 내리는 절", "sengoku_edo", "temple"),
      W("edo-estate", "estate", "무가 저택", "sengoku_edo", "samurai"),
      W("edo-farmhouse", "farmhouse", "폐가 농가", "sengoku_edo", "farmhouse"),
      W("steam-industrial", "factory", "버려진 공장 지대", "steampunk_city", "industrial"),
      W("steam-boiler", "boiler", "보일러실", "steampunk_city", "boiler-room"),
      W("steam-engine", "engine", "기관실", "steampunk_city", "engine-room"),
      W("steam-street", "street", "안개 낀 벽돌 거리", "steampunk_city", "street"),
    ],
    events: [
      O("밤마다 같은 시각에 울리는 방송", /방송/u),
      O("거울 속에서 한 박자 늦게 움직이는 내 모습", /거울/u),
      O("지워도 다시 나타나는 낙서", /낙서/u),
      O("아무도 없는 층에서 들리는 발소리", /발소리/u),
      O("숨바꼭질이 끝나지 않는 밤", /숨바꼭질/u),
      O("실종자가 남긴 녹음테이프", /녹음|테이프/u),
      O("한 번 들어가면 문이 사라지는 방", /문이\s*사라/u),
      O("오래된 괴담이 하나씩 현실이 되는 사흘", /괴담/u),
      O("전화기 너머에서 부르는 이미 죽은 사람", /전화/u),
      O("사진을 찍을 때마다 한 사람씩 늘어나는 얼굴", /사진/u),
      O("봉인이 풀린 물건과 그 주인", /봉인/u),
      O("같은 하루가 반복되며 조금씩 어긋나는 밤", /반복/u),
    ],
    moods: [...MOOD_COMMON.slice(1), O("정전된 밤, 손전등 하나의 빛", /정전|손전등/u), O("폭우와 천둥이 이어지는 밤", /폭우|천둥/u), O("달이 없는 칠흑 같은 밤", /칠흑/u), O("싸늘한 새벽 안개", /새벽/u)],
    structures: [
      O("한 건물 안에서 열쇠를 모아 층을 내려간다", /열쇠/u),
      O("숨고 도망치며 추적자를 피하는 추격 구조", /추격|도망/u),
      O("괴담 하나마다 한 장소를 해결하는 옴니버스", /옴니버스/u),
      O("같은 장소를 낮과 밤 두 번 다르게 겪는다", /낮과\s*밤/u),
      O("정체를 알아 갈수록 장소의 뜻이 바뀐다", /정체/u),
      O("한 사람이 아니라 둘이 번갈아 조작하는 구조", /번갈아/u),
    ],
  },
  {
    id: "romance", ko: "연애", match: /연애|로맨스|썸|고백|데이트|미연시|romance|dating/iu,
    places: [
      P("cafe", "cafe", "단골 카페", hk("카페"), /카페|찻집/u),
      P("library", "library", "도서관 서가", hk("도서관"), /도서관/u),
      P("cinema", "cinema", "영화관", hk("영화관"), /영화관|극장/u),
      P("gallery", "gallery", "미술관", hk("미술관"), /미술관|전시/u),
      P("bakery", "bakery", "빵집", hk("빵집"), /빵집/u),
      P("florist", "florist", "꽃집", hk("꽃집"), /꽃집/u),
      P("high-school", "school", "고등학교 교실", hk("고등학교"), /학교|교실/u),
      P("campus", "campus", "대학가", sk("campus-town"), /대학|캠퍼스/u),
      P("riverside", "riverside", "천변 산책로", sk("riverside"), /천변|강변|산책로/u),
      P("station", "station", "기차역 앞", sk("station-front"), /기차|역전|지하철/u),
      P("market", "market", "재래시장", sk("market"), /시장/u),
      P("shrine", "shrine", "신사 계단", sj("shrine"), /신사/u),
      P("festival", "festival", "여름 축제 거리", sj("festival"), /축제|마츠리|불꽃놀이/u),
      P("hot-spring", "onsen", "온천 마을", sj("onsen"), /온천/u),
      P("port", "port", "포구 마을", vl("coast"), /포구|항구|바닷가/u),
      P("town", "village", "작은 마을", vl("river"), /마을|동네/u),
      W("sky-village", "village", "하늘 마을", "sky_island", "village"),
      W("sky-dock", "dock", "비공정 부두", "sky_island", "dock"),
      W("sky-observatory", "observatory", "천문대", "sky_island", "observatory"),
      W("sky-cottage", "cottage", "오두막", "sky_island", "cottage"),
      W("isle-beach", "beach", "야자 해변", "pirate_isles", "beach"),
      W("isle-harbor", "harbor", "작은 항구", "pirate_isles", "harbor"),
      W("isle-hut", "hut", "해변 오두막", "pirate_isles", "hut"),
      W("isle-tavern", "tavern", "항구 술집", "pirate_isles", "tavern"),
      W("edo-inn-street", "inn-street", "여관 거리", "sengoku_edo", "inn-street"),
      W("edo-temple", "temple", "절 경내", "sengoku_edo", "temple"),
      W("edo-village", "village", "농촌 마을", "sengoku_edo", "village"),
      W("edo-inn", "inn", "여관 안", "sengoku_edo", "inn"),
      W("snow-village", "village", "눈 덮인 마을", "snow_north", "village"),
      W("snow-lake", "lake", "얼어붙은 호수", "snow_north", "lake"),
      W("snow-cabin", "cabin", "통나무 오두막", "snow_north", "cabin"),
      W("snow-tavern", "tavern", "선술집", "snow_north", "tavern"),
    ],
    events: [
      O("우산 하나를 같이 쓰게 된 비 오는 날", /우산/u),
      O("대본 없이 맡게 된 축제 짝 역할", /축제/u),
      O("잘못 배달된 편지가 이어 준 두 사람", /편지/u),
      O("라이벌인 줄 알았던 상대와 같은 팀이 된다", /라이벌/u),
      O("고백을 앞두고 하루 종일 어긋나는 타이밍", /고백/u),
      O("오랜 소꿉친구의 갑작스러운 전학 소식", /소꿉|전학/u),
      O("한 사람에게만 말 못 한 비밀 하나", /비밀/u),
      O("약속 장소에 나타나지 않은 상대를 찾는 밤", /약속/u),
      O("친구의 사랑을 돕다 내 마음을 알게 된다", /친구/u),
      O("같은 책을 동시에 집어 든 서가 앞", /책/u),
      O("막차를 놓쳐 같이 걷게 된 길", /막차/u),
      O("서로의 가짜 연인 행세를 하게 된 일주일", /가짜|연인/u),
    ],
    moods: [...MOOD_COMMON, O("벚꽃이 흩날리는 하굣길", /벚꽃/u), O("불꽃놀이가 터지는 여름밤", /불꽃/u)],
    structures: [
      O("만날 사람을 고르는 갈래 — 장소마다 다른 사람", /갈래|공략/u),
      O("한 사람과의 일주일을 하루씩 풀어 간다", /일주일/u),
      O("대화 선택으로 호감도가 쌓이고 마지막에 고백한다", /호감도/u),
      O("오해가 생겼다 풀리는 3막 구조", /오해/u),
      O("계절이 바뀔 때마다 관계가 한 단계 변한다", /계절/u),
      O("같은 하루를 두 사람의 시점으로 번갈아 본다", /시점/u),
    ],
  },
  {
    id: "adventure", ko: "모험", match: /모험|어드벤처|rpg|알피지|롤플레잉|판타지|용사|퀘스트|던전|여정|원정|탐험|보물|adventure|fantasy|quest/iu,
    places: [
      P("home-village", "village", "출발 마을", vl("river"), /마을/u),
      P("fishing-port", "port", "포구 마을", vl("coast"), /포구|항구/u),
      P("swamp-village", "swamp-village", "늪 위의 마을", vl("swamp"), /늪\s*마을/u),
      P("abandoned-mine", "mine", "폐광", dg("mine"), /폐광|광산/u),
      P("catacomb", "catacomb", "지하 묘지", dg("catacomb"), /묘지/u),
      P("ruined-temple", "temple", "옛 신전", dg("temple"), /신전/u),
      P("deep-forest", "forest", "깊은 숲", dg("forest"), /숲/u),
      P("wizard-tower", "tower", "마법사의 탑", dg("tower"), /탑/u),
      P("cave", "cave", "동굴", dg("cave"), /동굴/u),
      P("swamp", "swamp", "독 늪", dg("swamp"), /늪/u),
      P("castle", "castle", "무너진 성", dg("castle"), /성\b/u),
      P("volcano", "volcano", "화산 기슭", dg("volcano"), /화산/u),
      P("ice-cave", "ice", "얼음 동굴", dg("ice"), /얼음/u),
      P("sewer", "sewer", "하수도", dg("sewer"), /하수도/u),
      P("labyrinth", "labyrinth", "미로", dg("labyrinth"), /미로/u),
      P("inn", "tavern", "길목 여관", iv("tavern"), /여관|선술집/u),
      P("old-chapel", "chapel", "성당", iv("chapel"), /성당|예배당/u),
    ],
    events: [
      O("마을의 우물이 갑자기 마르기 시작한다", /우물/u),
      O("떠돌이 상인이 지도 한 장을 맡기고 사라진다", /지도/u),
      O("봉인된 문이 한 조각씩 열리는 계절", /봉인/u),
      O("옛 영웅의 유물을 노리는 두 세력", /유물/u),
      O("사라진 대상을 쫓는 호위 임무", /호위/u),
      O("마을 아이가 숲에서 가져온 이상한 알", /알/u),
      O("스승이 남긴 수수께끼 같은 마지막 의뢰", /스승|의뢰/u),
      O("강 하류에서 떠내려온 낯선 깃발", /깃발/u),
      O("적이었던 이가 길동무가 되어 달라고 한다", /길동무/u),
      O("달이 사흘 연속 붉게 뜨는 밤", /붉은\s*달|붉게/u),
    ],
    moods: [...MOOD_COMMON.slice(0, 6), O("먼 산 위로 구름이 갈라지는 아침", /구름/u), O("폭풍 직전의 어둑한 하늘", /폭풍/u)],
    structures: [
      O("거점 하나에서 방사형으로 지역을 돌고 돌아온다", /거점/u),
      O("세 지역에서 조각 셋을 모아 마지막 문을 연다", /조각|세\s*지역/u),
      O("앞 장소에서 얻은 것이 뒤 장소의 길을 연다", /열쇠|길을\s*연다/u),
      O("두 세력 사이에서 편을 고르면 길이 갈린다", /세력|편을/u),
      O("마지막에 처음 마을로 돌아와 달라진 점을 본다", /돌아와/u),
    ],
  },
];
