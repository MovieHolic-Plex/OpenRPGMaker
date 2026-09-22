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
  /** 검수한 실제 그림 설명. 화면에 표시할 내레이션과는 별개다. */
  readonly description: string;
  readonly mood: readonly string[];
  readonly useCases: readonly string[];
  readonly series: string;
  readonly cautions: readonly string[];
  readonly suitableForOpening: boolean;
};

export const OPENING_STILL_MOODS: readonly OpeningStillMood[] = [
  {
    id: "oprn-still-hero-dawn",
    name: "강가 마을과 타일 배치 예시",
    tags: ["강가 마을과 타일 배치 예시", "평화", "마을 스타일 참고"],
    description: "위에서 내려다본 픽셀 마을과 강을 여러 사각 영역으로 나눈 타일 배치 참고 화면.",
    mood: ["평화"],
    useCases: ["마을 스타일 참고"],
    cautions: ["분할 화면·편집 강조 테두리 포함"],
    suitableForOpening: false,
    series: "single-hero-dawn",
  },
  {
    id: "oprn-still-rally",
    name: "풀밭의 작은 모험가",
    tags: ["풀밭의 작은 모험가", "경쾌", "가벼운 모험", "첫 만남"],
    description: "위에서 내려다본 픽셀 풀밭 중앙에 작은 인물과 색깔별 작은 생물이 서 있다.",
    mood: ["경쾌"],
    useCases: ["가벼운 모험", "첫 만남"],
    cautions: ["게임 화면 형태의 픽셀아트; 고정 캐릭터 포함"],
    suitableForOpening: true,
    series: "single-rally",
  },
  {
    id: "oprn-still-corridor",
    name: "전뇌 공간의 소년과 생물",
    tags: ["전뇌 공간의 소년과 생물", "활기", "신비", "디지털 세계 소개", "파트너 만남"],
    description: "전자 회로와 산 실루엣을 배경으로 소년과 초록색 생물이 옆으로 나란히 서 있다.",
    mood: ["활기", "신비"],
    useCases: ["디지털 세계 소개", "파트너 만남"],
    cautions: ["화면 안에 고정 캐릭터 2명 포함"],
    suitableForOpening: true,
    series: "single-corridor",
  },
  {
    id: "oprn-still-harbor",
    name: "노을 지는 픽셀 농장",
    tags: ["노을 지는 픽셀 농장", "따뜻함", "평온", "시골 일상", "귀향"],
    description: "픽셀 농가와 외양간, 밭, 닭들이 낮게 뜬 노을 해 아래 펼쳐진다.",
    mood: ["따뜻함", "평온"],
    useCases: ["시골 일상", "귀향"],
    cautions: ["픽셀아트; 동물 포함"],
    suitableForOpening: true,
    series: "single-harbor",
  },
  {
    id: "oprn-still-forest-path",
    name: "밤의 동굴 야영지",
    tags: ["밤의 동굴 야영지", "결의", "친밀함", "동료 소개", "출발 전야"],
    description: "불빛을 둘러싼 작은 모험가들이 동굴 안에 모여 있고 바깥으로 보랏빛 밤 마을이 내려다보인다.",
    mood: ["결의", "친밀함"],
    useCases: ["동료 소개", "출발 전야"],
    cautions: ["여러 고정 캐릭터 포함"],
    suitableForOpening: true,
    series: "single-forest-path",
  },
  {
    id: "oprn-still-festival",
    name: "기괴한 초상화 복도",
    tags: ["기괴한 초상화 복도", "공포", "불안", "불길한 징조", "저택 탐색"],
    description: "양옆에 기괴한 초상화가 걸린 긴 복도 끝을 향해 작은 인물이 서 있다.",
    mood: ["공포", "불안"],
    useCases: ["불길한 징조", "저택 탐색"],
    cautions: ["고정 인물과 괴이한 얼굴 포함"],
    suitableForOpening: true,
    series: "single-festival",
  },
  {
    id: "oprn-still-ride",
    name: "푸른 불빛의 폐병원",
    tags: ["푸른 불빛의 폐병원", "긴장", "공포", "위협의 등장", "탈출의 시작"],
    description: "어두운 병원 복도에 두 작은 인물이 서 있고 맞은편 어둠 속에 형체 하나가 보인다.",
    mood: ["긴장", "공포"],
    useCases: ["위협의 등장", "탈출의 시작"],
    cautions: ["고정 인물과 괴물 형체 포함"],
    suitableForOpening: true,
    series: "single-ride",
  },
  {
    id: "oprn-still-moon-meadow",
    name: "벽난로 앞 두 사람",
    tags: ["벽난로 앞 두 사람", "온기", "그리움", "가족의 회상", "이야기의 시작"],
    description: "픽셀 목조 거실에서 두 사람이 벽난로를 사이에 두고 안락의자에 앉아 있다.",
    mood: ["온기", "그리움"],
    useCases: ["가족의 회상", "이야기의 시작"],
    cautions: ["고정 인물 2명 포함"],
    suitableForOpening: true,
    series: "single-moon-meadow",
  },
  {
    id: "oprn-still-manor-night",
    name: "촛불 켜진 저택 회랑",
    tags: ["촛불 켜진 저택 회랑", "적막", "미스터리", "저택 소개", "사건 전의 정적"],
    description: "등각 시점의 낡은 저택 회랑에 초상화와 벽 촛대, 샹들리에가 놓여 있다.",
    mood: ["적막", "미스터리"],
    useCases: ["저택 소개", "사건 전의 정적"],
    cautions: ["등각 시점 픽셀아트"],
    suitableForOpening: true,
    series: "single-manor-night",
  },
  {
    id: "oprn-still-dream",
    name: "문들이 열린 회색 꿈의 방",
    tags: ["문들이 열린 회색 꿈의 방", "몽환", "불안", "꿈의 시작", "세계의 분기"],
    description: "회색 방의 작은 인물 앞에 여러 문이 열리고 각 문 너머로 서로 다른 색과 사물들이 보인다.",
    mood: ["몽환", "불안"],
    useCases: ["꿈의 시작", "세계의 분기"],
    cautions: ["고정 인물과 초현실적 사물 포함"],
    suitableForOpening: true,
    series: "single-dream",
  },
  {
    id: "oprn-still-metropolis",
    name: "버섯집과 황금 꽃밭",
    tags: ["버섯집과 황금 꽃밭", "동화적", "기묘함", "이세계 소개", "뜻밖의 만남"],
    description: "동굴 안 버섯집 사이에 황금색 꽃밭이 있고 작고 기묘한 인물들이 주변에 서 있다.",
    mood: ["동화적", "기묘함"],
    useCases: ["이세계 소개", "뜻밖의 만남"],
    cautions: ["픽셀아트; 고정 캐릭터 다수 포함"],
    suitableForOpening: true,
    series: "single-metropolis",
  },
  {
    id: "oprn-still-lullaby",
    name: "주택가 길 위의 아이들",
    tags: ["주택가 길 위의 아이들", "명랑", "향수", "친구 소개", "평범한 일상"],
    description: "밝은 픽셀 주택가 앞 길에서 아이들과 동물들이 마주 서 있다.",
    mood: ["명랑", "향수"],
    useCases: ["친구 소개", "평범한 일상"],
    cautions: ["게임 화면 구도; 고정 캐릭터 다수 포함"],
    suitableForOpening: true,
    series: "single-lullaby",
  },
  {
    id: "oprn-still-quiet-room",
    name: "밝은 방과 흑백 악몽 비교",
    tags: ["밝은 방과 흑백 악몽 비교", "불안", "대조", "명암 대비 스타일 참고"],
    description: "파스텔색 실내와 검은 나무들이 있는 악몽 장면을 좌우로 나눈 비교 이미지.",
    mood: ["불안", "대조"],
    useCases: ["명암 대비 스타일 참고"],
    cautions: ["분할 화면·게임 대화창·영문 텍스트 포함"],
    suitableForOpening: false,
    series: "single-quiet-room",
  },
  {
    id: "oprn-still-farm-golden",
    name: "황금빛 계단식 농장",
    tags: ["황금빛 계단식 농장", "평온", "온기", "세계 소개", "평범한 일상"],
    description: "산골짜기의 계단식 밭과 작은 농가에 따뜻한 석양이 비친다.",
    mood: ["평온", "온기"],
    useCases: ["세계 소개", "평범한 일상"],
    cautions: [],
    suitableForOpening: true,
    series: "single-farm-golden",
  },
  {
    id: "oprn-still-snow-village",
    name: "별빛 설원 마을",
    tags: ["별빛 설원 마을", "고요", "따뜻함", "고향 소개", "겨울의 시작"],
    description: "별이 뜬 밤하늘 아래 눈 덮인 산과 따뜻한 불빛의 마을, 얼어붙은 강이 보인다.",
    mood: ["고요", "따뜻함"],
    useCases: ["고향 소개", "겨울의 시작"],
    cautions: [],
    suitableForOpening: true,
    series: "single-snow-village",
  },
  {
    id: "oprn-still-desert-ruin",
    name: "사막의 부서진 석조 관문",
    tags: ["사막의 부서진 석조 관문", "적막", "신비", "잊힌 역사", "유적 발견"],
    description: "사막 모래 위에 거대한 아치와 무너진 기둥이 서 있고 멀리 피라미드가 보인다.",
    mood: ["적막", "신비"],
    useCases: ["잊힌 역사", "유적 발견"],
    cautions: [],
    suitableForOpening: true,
    series: "single-desert-ruin",
  },
  {
    id: "oprn-still-kingdom-day",
    name: "햇빛 비치는 성왕국",
    tags: ["햇빛 비치는 성왕국", "희망", "장엄", "세계 소개", "왕국 소개"],
    description: "푸른 산과 초원 사이 성벽 도시와 높은 흰 성이 밝은 낮 하늘 아래 펼쳐진다.",
    mood: ["희망", "장엄"],
    useCases: ["세계 소개", "왕국 소개"],
    cautions: [],
    suitableForOpening: true,
    series: "single-kingdom-day",
  },
  {
    id: "oprn-still-dark-citadel",
    name: "번개 속 검은 성채",
    tags: ["번개 속 검은 성채", "위협", "암흑", "적의 거점 소개", "재앙의 징조"],
    description: "폭풍과 보랏빛 번개 아래 검은 성채가 절벽 위로 솟고 창문에서 붉은빛이 새어 나온다.",
    mood: ["위협", "암흑"],
    useCases: ["적의 거점 소개", "재앙의 징조"],
    cautions: [],
    suitableForOpening: true,
    series: "single-dark-citadel",
  },
];

// BEGIN generated pack stills — 이 줄과 END 사이는 생성 영역이다.
const PACK_STILL_MOODS: readonly OpeningStillMood[] = [
  {
    id: "oprn-pack-still-desert-01",
    name: "일출의 사막 대상 행렬",
    tags: ["사막", "desert", "일출의 사막 대상 행렬", "장엄", "고독", "희망", "세계 소개", "여정의 시작"],
    description: "해가 떠오르는 광대한 모래언덕을 낙타 대상 행렬이 가로지르고 멀리 성채가 보인다.",
    mood: ["장엄","고독","희망"],
    useCases: ["세계 소개","여정의 시작"],
    series: "desert",
    cautions: ["낙타와 작은 인물 실루엣 포함"],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-desert-02",
    name: "청록 돔의 오아시스 도시",
    tags: ["사막", "desert", "청록 돔의 오아시스 도시", "활기", "신비", "목적지 소개", "세계 소개"],
    description: "바위 협곡과 모래 절벽 사이로 야자수와 청록색 돔이 있는 오아시스 도시가 펼쳐진다.",
    mood: ["활기","신비"],
    useCases: ["목적지 소개","세계 소개"],
    series: "desert",
    cautions: [],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-desert-03",
    name: "모래에 묻힌 지하 신전",
    tags: ["사막", "desert", "모래에 묻힌 지하 신전", "적막", "미스터리", "비밀의 발견", "잊힌 역사"],
    description: "천장 틈의 햇빛이 무너진 석주와 벽 부조, 모래더미로 가득한 고대 신전 내부를 비춘다.",
    mood: ["적막","미스터리"],
    useCases: ["비밀의 발견","잊힌 역사"],
    series: "desert",
    cautions: [],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-desert-04",
    name: "등불이 켜진 사막 야시장",
    tags: ["사막", "desert", "등불이 켜진 사막 야시장", "따뜻함", "활기", "평온한 일상", "축제 전야"],
    description: "초승달 아래 아치와 돔 건물 사이 시장 골목에 등불이 걸리고 사람들이 모여 있다.",
    mood: ["따뜻함","활기"],
    useCases: ["평온한 일상","축제 전야"],
    series: "desert",
    cautions: ["작은 인물 다수 포함"],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-modern-01",
    name: "비 내린 시골역의 저녁",
    tags: ["현대", "modern", "비 내린 시골역의 저녁", "쓸쓸함", "기다림", "귀향", "만남 전의 정적"],
    description: "젖은 승강장에 열차가 들어오고 산으로 둘러싸인 작은 마을과 푸른 저녁 하늘이 보인다.",
    mood: ["쓸쓸함","기다림"],
    useCases: ["귀향","만남 전의 정적"],
    series: "modern",
    cautions: ["일본어 역명 간판과 작은 인물이 포함됨"],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-modern-02",
    name: "노을빛 빈 음악실",
    tags: ["현대", "modern", "노을빛 빈 음악실", "그리움", "평온", "회상", "사라진 사람의 흔적"],
    description: "석양이 창문을 지나 피아노와 의자, 벽의 액자가 놓인 빈 음악실 안으로 길게 들어온다.",
    mood: ["그리움","평온"],
    useCases: ["회상","사라진 사람의 흔적"],
    series: "modern",
    cautions: [],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-modern-03",
    name: "옥상에서 내려다본 밤의 마을",
    tags: ["현대", "modern", "옥상에서 내려다본 밤의 마을", "외로움", "사색", "주인공의 결심", "밤의 독백"],
    description: "옥상에 앉은 한 인물의 뒷모습 너머로 강을 따라 이어지는 마을 불빛과 초승달이 보인다.",
    mood: ["외로움","사색"],
    useCases: ["주인공의 결심","밤의 독백"],
    series: "modern",
    cautions: ["뒷모습 인물 1명 고정 포함; 주인공 외형과 일치 여부 확인"],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-ocean-01",
    name: "등대 아래 잠긴 왕국",
    tags: ["해저", "ocean", "등대 아래 잠긴 왕국", "경이", "희망", "세계 소개", "전설의 시작"],
    description: "햇빛 비치는 해안 절벽 위 등대와 맑은 바닷속에 잠긴 돔 건물 및 석조 유적이 함께 보인다.",
    mood: ["경이","희망"],
    useCases: ["세계 소개","전설의 시작"],
    series: "ocean",
    cautions: [],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-ocean-02",
    name: "산호 속 해저 관문",
    tags: ["해저", "ocean", "산호 속 해저 관문", "신비", "기대", "경계 통과", "비밀의 발견"],
    description: "햇빛 기둥이 내려오는 바닷속에서 산호와 물고기에 둘러싸인 거대한 석조 아치가 서 있다.",
    mood: ["신비","기대"],
    useCases: ["경계 통과","비밀의 발견"],
    series: "ocean",
    cautions: [],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-ocean-03",
    name: "푸른 심해의 왕좌",
    tags: ["해저", "ocean", "푸른 심해의 왕좌", "엄숙", "미스터리", "잊힌 왕국", "핵심 비밀의 암시"],
    description: "어두운 해저 전당의 아치와 산호 사이에 푸른빛으로 빛나는 왕좌와 원형 장식이 놓여 있다.",
    mood: ["엄숙","미스터리"],
    useCases: ["잊힌 왕국","핵심 비밀의 암시"],
    series: "ocean",
    cautions: [],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-ocean-04",
    name: "수면 아래 빛나는 도시",
    tags: ["해저", "ocean", "수면 아래 빛나는 도시", "웅장", "경이", "여정의 시작", "목적지 소개"],
    description: "노을 진 바다의 배 옆으로 밝게 빛나는 해저 도시와 산호, 높은 첨탑들이 내려다보인다.",
    mood: ["웅장","경이"],
    useCases: ["여정의 시작","목적지 소개"],
    series: "ocean",
    cautions: ["왼쪽 전경에 범선 포함"],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-sky-01",
    name: "노을의 하늘섬 선착장",
    tags: ["공중", "sky", "노을의 하늘섬 선착장", "모험", "설렘", "세계 소개", "출항"],
    description: "공중에 떠 있는 섬과 풍차 너머로 석양이 비치고 전경 선착장에 비행선들이 정박해 있다.",
    mood: ["모험","설렘"],
    useCases: ["세계 소개","출항"],
    series: "sky",
    cautions: [],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-sky-02",
    name: "구름 위 공중 회랑",
    tags: ["공중", "sky", "구름 위 공중 회랑", "자유", "경이", "여행 몽타주", "새 세계 진입"],
    description: "흰 구름 위로 여러 섬과 석조 교량이 이어지고 그 사이를 비행선 한 척이 지나간다.",
    mood: ["자유","경이"],
    useCases: ["여행 몽타주","새 세계 진입"],
    series: "sky",
    cautions: [],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-sky-03",
    name: "폭풍 속 부유하는 탑",
    tags: ["공중", "sky", "폭풍 속 부유하는 탑", "위협", "긴장", "재앙의 징조", "적의 거점 소개"],
    description: "먹구름과 번개 속에 무너진 돌탑이 떠 있고 부서진 다리와 파편이 주위를 에워싼다.",
    mood: ["위협","긴장"],
    useCases: ["재앙의 징조","적의 거점 소개"],
    series: "sky",
    cautions: [],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-sky-04",
    name: "아침빛 하늘 정원",
    tags: ["공중", "sky", "아침빛 하늘 정원", "평화", "희망", "회복", "새로운 시작"],
    description: "구름바다 위 풍차와 계단식 꽃밭, 돌길이 있는 섬에 밝은 아침 햇살이 비친다.",
    mood: ["평화","희망"],
    useCases: ["회복","새로운 시작"],
    series: "sky",
    cautions: [],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-winter-01",
    name: "푸른 새벽의 설원 마을",
    tags: ["겨울", "winter", "푸른 새벽의 설원 마을", "고요", "쓸쓸함", "세계 소개", "고립된 고향"],
    description: "눈 덮인 산맥과 소나무 숲 사이로 얼어붙은 강과 따뜻한 창문 불빛의 목조 마을이 보인다.",
    mood: ["고요","쓸쓸함"],
    useCases: ["세계 소개","고립된 고향"],
    series: "winter",
    cautions: [],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-winter-02",
    name: "등불 켜진 눈 마을 광장",
    tags: ["겨울", "winter", "등불 켜진 눈 마을 광장", "따뜻함", "안도", "평온한 일상", "돌아갈 장소"],
    description: "눈 쌓인 목조 집과 마을 광장에 노란 등불이 켜지고 얼어붙은 강 위 작은 다리가 보인다.",
    mood: ["따뜻함","안도"],
    useCases: ["평온한 일상","돌아갈 장소"],
    series: "winter",
    cautions: ["작은 인물 실루엣 포함"],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-winter-03",
    name: "오로라 아래 얼음 신전",
    tags: ["겨울", "winter", "오로라 아래 얼음 신전", "신비", "경외", "비밀의 암시", "전설의 시작"],
    description: "초록빛 오로라 아래 거대한 푸른 얼음 신전이 마을과 얼어붙은 강 뒤 산자락에 솟아 있다.",
    mood: ["신비","경외"],
    useCases: ["비밀의 암시","전설의 시작"],
    series: "winter",
    cautions: [],
    suitableForOpening: true,
    // prompt: Use case: illustration-story. Asset: full-screen RPG opening cinematic still. Create ONE complete landscape illustration in 16:9, at least 1
  },
  {
    id: "oprn-pack-still-winter-04",
    name: "봄빛 스미는 설원 계곡",
    tags: ["겨울", "winter", "봄빛 스미는 설원 계곡", "희망", "평온", "새로운 시작", "여정의 시작"],
    description: "낮은 아침 해가 눈 덮인 계곡과 목조 마을을 비추고 강 가운데 푸른 물길이 드러난다.",
    mood: ["희망","평온"],
    useCases: ["새로운 시작","여정의 시작"],
    series: "winter",
    cautions: [],
    suitableForOpening: true,
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
