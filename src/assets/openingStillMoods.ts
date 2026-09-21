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

export function findOpeningStillMood(id: string): OpeningStillMood | undefined {
  return OPENING_STILL_MOODS.find((entry) => entry.id === id);
}
