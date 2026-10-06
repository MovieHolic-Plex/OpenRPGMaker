/** Authored region: eight circuits, with optional habitats and a return journey. */
export const EXPEDITION_TOWNS = [
  { key: "home", name: "별싹 마을", template: "overworld/map", x: 1, y: 6, flavor: "새벽이면 언덕의 등대와 몬스터들이 함께 눈을 뜬다.", music: "town" },
  { key: "grove", name: "새순 마을", template: "overworld/map", x: 2, y: 5, flavor: "숲을 돌보는 사람과 몬스터가 매년 새 나무를 심는다.", music: "forest" },
  { key: "harbor", name: "물결 항구", template: "coast/port", x: 4, y: 6, flavor: "파도를 읽는 선원들이 별빛섬의 소식을 옮긴다.", music: "coast" },
  { key: "ember", name: "잿빛 온천", template: "climate/ash_town", x: 6, y: 5, flavor: "땅속의 열을 빌리되 산의 잠을 깨우지는 않는다.", music: "town" },
  { key: "prism", name: "프리즘 시티", template: "coast/city", x: 7, y: 3, flavor: "아홉 색 창문 아래에서 서로 다른 생각들이 만난다.", music: "town" },
  { key: "dune", name: "모래종 마을", template: "overworld/map", x: 5, y: 2, flavor: "모래바람이 불면 오래된 종이 여행자의 길을 알려 준다.", music: "route" },
  { key: "frost", name: "서리꽃 마을", template: "climate/snow_town", x: 3, y: 1, flavor: "춥고 긴 밤에도 창가의 불빛은 이웃을 기다린다.", music: "snow" },
  { key: "moon", name: "달그림자 마을", template: "overworld/map", x: 1, y: 2, flavor: "돌아오지 않는 이를 기억하며 등불을 물가에 띄운다.", music: "cave" },
  { key: "summit", name: "용마루 시티", template: "coast/city", x: 4, y: 3, flavor: "여덟 빛의 약속을 모은 여행자가 마지막 산길에 오른다.", music: "league" },
] as const;

export const EXPEDITION_GYMS = [
  { town: "grove", key: "grass", name: "새순 체육관", leader: "유림", badge: "새잎 배지", type: "grass", level: 9,
    before: "강함은 혼자 자라는 게 아니야. 서로의 그늘이 되어 줄 수 있니?", after: "네 동료가 너를 믿고 움직이는 걸 봤어. 새잎의 약속을 맡길게." },
  { town: "harbor", key: "water", name: "물결 체육관", leader: "해온", badge: "밀물 배지", type: "water", level: 14,
    before: "물길도 마음도 한쪽으로만 흐르진 않지. 흐름을 읽어 봐!", after: "밀물과 썰물처럼 승패도 돌아오는 법. 다시 만나면 더 멀리 가 있겠지." },
  { town: "ember", key: "fire", name: "화로 체육관", leader: "단비", badge: "불씨 배지", type: "fire", level: 19,
    before: "작은 불씨를 지키는 일이 가장 어려워. 준비한 만큼 뜨겁게 싸우자!", after: "불은 빼앗을 힘이 아니라 나눌 온기야. 네 모험에도 온기가 남길." },
  { town: "prism", key: "psychic", name: "프리즘 체육관", leader: "예린", badge: "거울 배지", type: "psychic", level: 24,
    before: "문이 많을수록 자기 선택을 믿어야 해. 네 생각을 보여 줘.", after: "보이지 않는 길도 네가 걸으면 길이 되는구나. 별빛 연구소에 꼭 가 봐." },
  { town: "dune", key: "dojo", name: "모래종 도장", leader: "태오", badge: "기백 배지", type: "fighting", level: 30,
    before: "부수는 힘보다 지키는 힘이 오래 남는다. 네 기백은 어떤 것이지?", after: "힘에 이유가 있는 여행자구나. 이제 북쪽 고개의 문이 열릴 거야." },
  { town: "frost", key: "ice", name: "서리꽃 체육관", leader: "설아", badge: "눈결정 배지", type: "ice", level: 36,
    before: "멈추는 곳을 알고 나아가는 용기. 얼음길도 전투도 같아.", after: "서두르지 않는 발걸음이 가장 멀리 가지. 달그림자 마을이 너를 기다린대." },
  { town: "moon", key: "ghost", name: "달등 체육관", leader: "은하", badge: "등불 배지", type: "ghost", level: 42,
    before: "어둠 속에도 누군가 남긴 등불이 있어. 네 동료와 함께 찾아봐.", after: "두려움도 추억도 함께 안고 걸을 수 있구나. 마지막 빛까지 이어 줘." },
  { town: "summit", key: "dragon", name: "용마루 체육관", leader: "도윤", badge: "별마루 배지", type: "dragon", level: 48,
    before: "여덟 지역의 길을 모두 걸었구나. 지금까지의 약속을 이곳에서 증명해!", after: "여덟 빛이 모였어. 옛 관측탑을 되찾으면 리그의 문을 열 수 있어." },
] as const;

export const EXPEDITION_ROUTES = [
  { key: "meadow", name: "1번길 · 별싹 들판", template: "overworld/route", from: "home", to: "grove", habitat: "grass", level: 4, required: "mx_starter", music: "route" },
  { key: "forest", name: "2번길 · 나뭇잎 숲", template: "wild/forest_maze", from: "grove", to: "harbor", habitat: "forest", level: 10, required: "mx_badge_1", music: "forest" },
  { key: "river", name: "3번길 · 물소리 계곡", template: "wild/river", from: "harbor", to: "ember", habitat: "coast", level: 15, required: "mx_badge_2", music: "coast" },
  { key: "mountain", name: "4번길 · 구름 고개", template: "wild/mountain", from: "ember", to: "prism", habitat: "mountain", level: 20, required: "mx_badge_3", music: "route" },
  { key: "desert", name: "5번길 · 유리모래 사막", template: "climate/desert", from: "prism", to: "dune", habitat: "desert", level: 26, required: "mx_story_rescue", music: "route" },
  { key: "snow", name: "6번길 · 눈꽃 고개", template: "climate/ice_route", from: "dune", to: "frost", habitat: "snow", level: 32, required: "mx_badge_5", music: "snow" },
  { key: "marsh", name: "7번길 · 등불 습지", template: "wild/swamp", from: "frost", to: "moon", habitat: "swamp", level: 38, required: "mx_badge_6", music: "cave" },
  { key: "ruins", name: "8번길 · 옛 별자리길", template: "dungeon/ruins", from: "moon", to: "summit", habitat: "ruins", level: 44, required: "mx_badge_7", music: "cave" },
] as const;

export const EXPEDITION_SIDE_AREAS = [
  { key: "garden", name: "도감 정원", template: "wild/garden", town: "grove", habitat: "grass", level: 8, music: "forest" },
  { key: "beach", name: "산호 해변", template: "coast/beach", town: "harbor", habitat: "coast", level: 13, music: "coast" },
  { key: "sea_cave", name: "조수 동굴", template: "dungeon/sea_cave", town: "harbor", habitat: "coast", level: 18, music: "cave" },
  { key: "lava_cave", name: "잠든 화산", template: "dungeon/lava_cave", town: "ember", habitat: "volcano", level: 23, music: "cave" },
  { key: "cave", name: "메아리 동굴", template: "overworld/cave", town: "prism", habitat: "cave", level: 24, music: "cave" },
  { key: "ice_cave", name: "서리종 동굴", template: "dungeon/ice_cave", town: "frost", habitat: "snow", level: 39, music: "snow" },
  { key: "ghost_tower", name: "추억의 탑", template: "dungeon/ghost_tower", town: "moon", habitat: "ruins", level: 44, music: "cave" },
] as const;
