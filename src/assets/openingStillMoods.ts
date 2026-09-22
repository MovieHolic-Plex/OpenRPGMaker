// assets/openingStillMoods.ts
// 오프닝 무드 슬라이드 카탈로그 — 시네마틱 스틸 전용 검색어 표.
//
// 왜 이 파일이 필요한가: still 피커와 list_opening_media 는 id·이름으로만 찾는데,
// "slide-01" 같은 파일명은 장면의 내용(누가 어디서 무엇을 하는지)을 알려 주지 못한다.
// AI 가 오프닝을 저작할 때는 "밤 항구" "설원" "폐허" 같은 무드어로 검색하므로,
// 그 검색이 여기 tags 에서 맞아떨어져야 결과가 나온다.
//
// 파일 정본: BUILTIN_GENERATED_RESOURCE_URLS(같은 파일을 웰컴 포스터와 공유한다).
// 여기는 검색어·표시 이름만 담는다 — 경로는 resolver 쪽이 유일 정본이다.

export type OpeningStillMood = {
  readonly id: string;
  readonly name: string;
  readonly tags: readonly string[];
};

export const OPENING_STILL_MOODS: readonly OpeningStillMood[] = [
  {
    id: "oprn-still-hero-dawn",
    name: "새벽 언덕 위 주인공",
    tags: ["새벽", "언덕", "주인공", "여정", "서막", "모험 시작", "결의"],
  },
  {
    id: "oprn-still-rally",
    name: "불씨 앞 모임",
    tags: ["모임", "파티", "불씨", "밤", "결의", "동료", "출발"],
  },
  {
    id: "oprn-still-corridor",
    name: "긴 회랑",
    tags: ["회랑", "복도", "탐사", "미지", "유적", "긴장", "던전"],
  },
  {
    id: "oprn-still-harbor",
    name: "노을 항구",
    tags: ["항구", "바다", "노을", "배", "출항", "무역", "낭만"],
  },
  {
    id: "oprn-still-forest-path",
    name: "숲속 오솔길",
    tags: ["숲", "오솔길", "자연", "여행", "산책", "초록", "평화"],
  },
  {
    id: "oprn-still-festival",
    name: "마을 축제",
    tags: ["축제", "마을", "등불", "잔치", "사람들", "화려함", "일상"],
  },
  {
    id: "oprn-still-ride",
    name: "달리는 이동수단",
    tags: ["이동", "추격", "질주", "바람", "여행", "모험", "속도"],
  },
  {
    id: "oprn-still-moon-meadow",
    name: "달빛 초원",
    tags: ["달", "밤", "초원", "고요", "몽환", "별", "이세계"],
  },
  {
    id: "oprn-still-manor-night",
    name: "밤의 저택",
    tags: ["저택", "밤", "미스터리", "호러", "초대장", "공포", "안개"],
  },
  {
    id: "oprn-still-dream",
    name: "꿈의 세계",
    tags: ["꿈", "몽환", "이세계", "기억", "비현실", "초현실", "서랍"],
  },
  {
    id: "oprn-still-metropolis",
    name: "네온 대도시",
    tags: ["도시", "네온", "밤", "현대", "메타", "거리", "불면"],
  },
  {
    id: "oprn-still-lullaby",
    name: "자장가가 흐르는 방",
    tags: ["자장가", "아이", "방", "따뜻함", "회상", "가족", "잠"],
  },
  {
    id: "oprn-still-quiet-room",
    name: "조용한 방",
    tags: ["조용함", "외로움", "방", "우울", "고요", "혼자", "무거움"],
  },
  {
    id: "oprn-still-farm-golden",
    name: "황금빛 농가",
    tags: ["농장", "밭", "온실", "따뜻함", "일상", "귀촉", "노을", "굴뚝"],
  },
  {
    id: "oprn-still-snow-village",
    name: "설원의 마을",
    tags: ["설원", "눈", "겨울", "마을", "등불", "블루아워", "고요", "따뜻함"],
  },
  {
    id: "oprn-still-desert-ruin",
    name: "사막 유적",
    tags: ["사막", "유적", "탐사", "모래", "피라미드", "고대", "미지", "모험"],
  },
  {
    id: "oprn-still-kingdom-day",
    name: "대낮의 성왕국",
    tags: ["성", "왕국", "낮", "기사", "흰 성벽", "깃발", "희망", "영웅"],
  },
  {
    id: "oprn-still-dark-citadel",
    name: "마왕의 검성",
    tags: ["마왕성", "번개", "폭풍", "암흑", "보스", "최종결전", "위협", "적군"],
  },
];

// BEGIN generated pack stills — 이 줄과 END 사이는 생성 영역이다.
const PACK_STILL_MOODS: readonly OpeningStillMood[] = [
  {
    id: "oprn-pack-still-desert-01",
    name: "사막 · 시작의 풍경",
    tags: ["사막", "desert", "새벽", "caravan crossing immense dunes at sunrise"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-desert-02",
    name: "사막 · 세계 속으로",
    tags: ["사막", "desert", "탐험", "oasis city with blue tiled domes"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-desert-03",
    name: "사막 · 숨겨진 비밀",
    tags: ["사막", "desert", "미스터리", "half-buried temple interior lit by a shaft of sun"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-desert-04",
    name: "사막 · 새로운 여정",
    tags: ["사막", "desert", "출발", "night market under stars and hanging lanterns"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-modern-01",
    name: "현대 · 시작의 풍경",
    tags: ["현대", "modern", "새벽", "rainy railway platform at twilight"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-modern-02",
    name: "현대 · 세계 속으로",
    tags: ["현대", "modern", "탐험", "empty school music room at golden hour"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-modern-03",
    name: "현대 · 숨겨진 비밀",
    tags: ["현대", "modern", "미스터리", "rooftop overlooking city lights in the night"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-ocean-01",
    name: "해저 · 시작의 풍경",
    tags: ["해저", "ocean", "새벽", "sunlit coast and lighthouse overlooking the ocean"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-ocean-02",
    name: "해저 · 세계 속으로",
    tags: ["해저", "ocean", "탐험", "submerged gateway surrounded by reef fish"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-ocean-03",
    name: "해저 · 숨겨진 비밀",
    tags: ["해저", "ocean", "미스터리", "deep blue palace with a glowing pearl altar"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-ocean-04",
    name: "해저 · 새로운 여정",
    tags: ["해저", "ocean", "출발", "ocean surface at dawn seen from a sailing ship"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-sky-01",
    name: "공중 · 시작의 풍경",
    tags: ["공중", "sky", "새벽", "sunrise harbor on a floating island"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-sky-02",
    name: "공중 · 세계 속으로",
    tags: ["공중", "sky", "탐험", "airship crossing an endless sea of clouds"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-sky-03",
    name: "공중 · 숨겨진 비밀",
    tags: ["공중", "sky", "미스터리", "storm around a ruined floating tower"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-sky-04",
    name: "공중 · 새로운 여정",
    tags: ["공중", "sky", "출발", "golden light across a sky garden"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-winter-01",
    name: "겨울 · 시작의 풍경",
    tags: ["겨울", "winter", "새벽", "mountain pass at blue dawn"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-winter-02",
    name: "겨울 · 세계 속으로",
    tags: ["겨울", "winter", "탐험", "lantern village square at dusk"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-winter-03",
    name: "겨울 · 숨겨진 비밀",
    tags: ["겨울", "winter", "미스터리", "abandoned ice temple under aurora"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-winter-04",
    name: "겨울 · 새로운 여정",
    tags: ["겨울", "winter", "출발", "morning sun over the thawing valley"],
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
];
// END generated pack stills

/** 에디터·AI 검색 대상 전체 — 레포 번들 분 + 릴리스 팩 분. */
const ALL_STILL_MOODS: readonly OpeningStillMood[] = [...OPENING_STILL_MOODS, ...PACK_STILL_MOODS];

export function findOpeningStillMood(id: string): OpeningStillMood | undefined {
  return ALL_STILL_MOODS.find((entry) => entry.id === id);
}

export function listOpeningStillMoods(): readonly OpeningStillMood[] {
  return ALL_STILL_MOODS;
}
