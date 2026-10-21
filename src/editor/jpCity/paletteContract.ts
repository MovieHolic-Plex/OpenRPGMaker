// 일본 로케일 마스터 팔레트 계약(jp_city) — 2026-10-18 사용자 「팔레트 색에 대한 정의가 덜 이루어진거같음」.
// 재료 램프 6계열 × 계열마다 재료 3~4개 × 핵심 5단(0 깊은 그늘 · 1 그늘 · 2 기본 · 3 빛 · 4 하이라이트). 빛은 왼쪽 위, 그늘은 남보라 쪽, 빛은 살구 쪽으로 기운다.
// 2026-10-20 사용자 결정 「5단 제한을 푼다」: 재료는 핵심 5단 위에 버들항식 확장 램프(`ramp`, 6~10단, 핵심 5단을 순서대로 품는다)와
// 하위 램프(`subRamps`, 3~10단 — 햇빛 잎·대 줄기·나무껍질처럼 같은 재료 안의 다른 결)를 가질 수 있다. 핵심 5단(`steps`)의 뜻은 그대로다
// (시간대 단 이동·퇴출 램프 짝·jp_regions_pack 의 단 번호). 새 색은 이 두 자리로만 더하고 검사는 validateJpPaletteContract().
// 채도(chroma = max(R,G,B) - min(R,G,B), 0~1)는 재료마다 상한이 있고 어떤 색도 0.50 을 넘지 않는다(네온 금지).
// 굽기(scripts/content/jp-city/bake_jp.py)는 이 계약을 tiledata/jp-city/palette-contract.json 으로 읽어 바깥(실외) 칸의 퇴출 색을 계약 색으로 바꾼다.
// JSON 은 scripts/content/jp-city/export_palette_contract.mts 가 이 파일에서 만든다 - 손으로 고치지 않는다.

export type JpPaletteFamilyId = "ground_stone" | "timber_traditional" | "roof_modern" | "vegetation_season" | "water_onsen_coast" | "accent_signage";

/** 5단 램프: [0 깊은 그늘, 1 그늘, 2 기본, 3 빛, 4 하이라이트]. */
export type JpRamp5 = readonly [string, string, string, string, string];

/** 확장·하위 램프 단 수 한도(2026-10-20 「버들항식 6~10단」). */
export const JP_RAMP_MIN_EXTENDED = 6;
export const JP_RAMP_MAX_STEPS = 10;
export const JP_SUBRAMP_MIN_STEPS = 3;

/** 재료 안의 하위 램프 — 같은 재료의 다른 결(햇빛 받은 잎·대 줄기·나무껍질). 어두운 → 밝은, 3~10단. */
export interface JpSubRamp {
  readonly id: string;
  readonly ko: string;
  readonly steps: readonly string[];
  /** 0~1, JP_PALETTE_HARD_CHROMA_CAP 이하. 없으면 재료 chromaCap. */
  readonly chromaCap?: number;
  readonly use: string;
}

export interface JpMaterialRamp {
  readonly id: string;
  readonly ko: string;
  readonly en: string;
  readonly steps: JpRamp5;
  /** 버들항식 확장 램프(6~10단, 어두운 → 밝은). 핵심 5단을 순서대로 품는다. 없으면 핵심 5단만. */
  readonly ramp?: readonly string[];
  /** 하위 램프(3~10단). id 는 재료 안에서 고유. 색 이름은 `<재료>/<하위>`. */
  readonly subRamps?: readonly JpSubRamp[];
  /** 이 재료가 허용하는 최대 채도(0~1). */
  readonly chromaCap: number;
  /** 어디에 쓰는가 - 칠하는 사람과 조수가 읽는다. */
  readonly use: string;
}

export interface JpPaletteFamily {
  readonly id: JpPaletteFamilyId;
  readonly index: 1 | 2 | 3 | 4 | 5 | 6;
  readonly ko: string;
  readonly en: string;
  readonly materials: readonly JpMaterialRamp[];
}

export const JP_PALETTE_STEP_ROLES = ["깊은 그늘(접지·처마 밑)", "그늘(남·동쪽 면)", "기본(재료 고유색)", "빛(왼쪽 위 면)", "하이라이트(모서리·젖은 반짝임)"] as const;

/** 어떤 계약 색도 넘지 않는 채도 상한. 0.5 를 넘는 색은 네온으로 본다. */
export const JP_PALETTE_HARD_CHROMA_CAP = 0.5;

export const JP_PALETTE_FAMILIES: readonly JpPaletteFamily[] = [
  {
    id: "ground_stone", index: 1, ko: "기단·도로·석재", en: "Ground · Road · Stone",
    materials: [
      { id: "asphalt", ko: "아스팔트", en: "Asphalt", steps: ["#2b2a33", "#393742", "#464452", "#5b5463", "#6f6675"], chromaCap: 0.08, use: "차도·골목 포장. 흰·노란 노면 표시는 accent 의 vending_cool_white·lantern_amber 단을 쓴다." },
      { id: "paving_stone", ko: "콘크리트 판석", en: "Paving Stone", steps: ["#6e6a66", "#8a8580", "#a7a19a", "#c2bcb3", "#dad5cc"], chromaCap: 0.08, use: "보도·상점가 판석·광장. 줄눈은 0단, 판 면은 2~3단." },
      { id: "gravel", ko: "자갈", en: "Gravel", steps: ["#575666", "#69687a", "#7b7b8f", "#948fa3", "#aba4b8"], chromaCap: 0.1, use: "참배길 자갈·선로 도상·주차장 쇄석." },
      { id: "shrine_flagstone", ko: "신사 디딤돌", en: "Shrine Flagstone", steps: ["#4b4943", "#64625a", "#7f7c71", "#9b978a", "#b8b3a3"], chromaCap: 0.1, use: "참배길 판석·석등·석축·지장 석불·고대 석조 유적. 이끼는 vegetation 의 moss 를 덧칠한다." },
    ],
  },
  {
    id: "timber_traditional", index: 2, ko: "목재·전통 가옥", en: "Timber · Traditional House",
    materials: [
      {
        id: "aged_cedar", ko: "삭은 삼나무", en: "Aged Cedar", steps: ["#452b2d", "#593e39", "#705c4a", "#87735e", "#a18d76"],
        subRamps: [
          { id: "bark", ko: "나무껍질", steps: ["#1c1214", "#2a1b1c", "#3b2622", "#503529", "#684834", "#825f45", "#9c785a"], chromaCap: 0.26, use: "숲 줄기·고목 껍질. 숲 그늘 속 줄기는 0~2단, 빛 받는 왼쪽 결만 4~6단." },
          { id: "bark2", ko: "느티 줄기", steps: ["#241810", "#342416", "#483620", "#604826", "#7c5c30", "#94703a", "#a8844c"], chromaCap: 0.37, use: "느티·벚·단풍 줄기·뿌리. 왼쪽 빛." },
          { id: "bark_g", ko: "느티 줄기(잔디 맞춤)", steps: ["#241a13", "#34261b", "#483926", "#604c2f", "#7c613b", "#947547", "#a8895a"], chromaCap: 0.37, use: "jp 숲 r5 활엽 줄기·뿌리." },
          { id: "sugibark", ko: "삼나무 줄기", steps: ["#28120e", "#3e1c14", "#582a1c", "#723a26", "#8a4e34", "#a06446"], chromaCap: 0.36, use: "삼나무 적갈색 곧은 줄기." },
          { id: "sakurabark", ko: "벚 줄기", steps: ["#221a1e", "#32262a", "#443436", "#584646", "#6e5c5a", "#84726c"], chromaCap: 0.1, use: "벚나무 짙은 회갈 줄기·가로 껍질 띠." },
        ],
        chromaCap: 0.2, use: "판자벽·울타리·다리 난간·산장·나무 데크.",
      },
      { id: "machiya_timber", ko: "짙은 마치야 목재", en: "Dark Machiya Timber", steps: ["#1f1416", "#2e1d1c", "#3f2a24", "#54392e", "#6b4c3c"], chromaCap: 0.2, use: "마치야 격자(格子)·기둥·처마도리·폐선 침목." },
      { id: "torii_vermilion", ko: "도리이 주홍", en: "Torii Vermilion", steps: ["#5a1d1a", "#862c22", "#a9432f", "#bf6446", "#de8264"], chromaCap: 0.5, use: "도리이·신사 난간·불탑 기둥·다리 난간 장식. 성역·랜드마크 전용(거리 간판에 쓰지 않는다)." },
      { id: "tatami_straw", ko: "다다미 짚", en: "Tatami Straw", steps: ["#5f5a38", "#7f784b", "#a09862", "#bfb77f", "#dad3a2"], chromaCap: 0.26, use: "다다미·초가 지붕·볏짚·마른 논두렁·하사 볏단." },
    ],
  },
  {
    id: "roof_modern", index: 3, ko: "현대 건축·지붕", en: "Modern Building · Roof",
    materials: [
      { id: "kawara_dark_tile", ko: "이부시 기와", en: "Kawara Dark Tile", steps: ["#28272e", "#3a3942", "#4e4d59", "#646473", "#817c8c"], chromaCap: 0.08, use: "검은 기와·성곽 지붕·사찰 지붕·철 난간." },
      { id: "cream_stucco", ko: "크림 회벽", en: "Cream Stucco", steps: ["#8c8371", "#aaa18b", "#c6bea6", "#ddd6bf", "#eeeadb"], chromaCap: 0.14, use: "회벽(漆喰)·천수각 흰 벽·료칸 외벽·창고(蔵)." },
      { id: "concrete_grey", ko: "콘크리트 회색", en: "Concrete Grey", steps: ["#504f5c", "#666775", "#7f8191", "#999dad", "#b4b2c7"], chromaCap: 0.1, use: "단치·학교·역·방파제·옹벽." },
      { id: "arcade_skylight_slate", ko: "아케이드 채광 슬레이트", en: "Arcade Skylight Slate", steps: ["#293952", "#39536b", "#4a7387", "#627ca3", "#7d8ebf"], chromaCap: 0.28, use: "아케이드 채광창·유리·양철 지붕(퇴출된 sora 파랑 대신)." },
    ],
  },
  {
    id: "vegetation_season", index: 4, ko: "식생·계절 자연", en: "Vegetation · Seasons",
    materials: [
      {
        id: "pine_bamboo", ko: "소나무·대나무 짙은 녹", en: "Pine & Bamboo Deep Green", steps: ["#183327", "#254a32", "#34633c", "#49804c", "#689e63"],
        ramp: ["#0e221b", "#183327", "#1d3f2d", "#254a32", "#2d5737", "#34633c", "#49804c", "#5a9156", "#689e63"],
        subRamps: [
          { id: "sunleaf", ko: "햇빛 잎(버들항 숲 결)", steps: ["#0c2219", "#143526", "#1d462d", "#2a5a2f", "#3d6b2e", "#4b8232", "#5b9437", "#73b83e", "#8bc84c"], chromaCap: 0.49, use: "빽빽한 숲 수관·활엽 잎 덩이. 그늘은 청록, 빛은 연두로 색상이 돈다(버들항 숲 실측). 맨 위 두 단은 덩이 윗면 한두 점." },
          { id: "culm", ko: "대 줄기", steps: ["#1f3a2a", "#2e5236", "#3f6b3f", "#56874a", "#72a159", "#93b86e", "#b7cf8c"], chromaCap: 0.3, use: "대나무 줄기·마디. 마디 띠는 한 단 밝게, 줄기 그늘 면은 0~1단." },
          // 2026-10-20 숲 r3: 버들항 숲 결(거의 같은 초록 수백 색)을 20단 잔 램프로 — 짝·홀 단 두 하위 램프로 나눈다(scripts/content/jp-city/forest/forest_r3_palette.py).
          { id: "keyaki_a1", ko: "느티 잎(청록 계열) 짝단", steps: ["#0a1e1c", "#0e2e21", "#133e26", "#174d2a", "#1c5b2d", "#226830", "#297533", "#358137", "#438d3a", "#54983e"], chromaCap: 0.37, use: "느티나무·잡목 수관(짙은 청록 그루). 잎 덩이마다 왼쪽 위 밝게, 이웃 단은 1~2단 차로 결을 낸다." },
          { id: "keyaki_a2", ko: "느티 잎(청록 계열) 홀단", steps: ["#0c261f", "#113724", "#154628", "#1a542c", "#1f622e", "#266e31", "#2e7b35", "#3c8738", "#4c933c", "#5c9e40"], chromaCap: 0.37, use: "느티나무·잡목 수관(짙은 청록 그루). 잎 덩이마다 왼쪽 위 밝게, 이웃 단은 1~2단 차로 결을 낸다." },
          { id: "keyaki_b1", ko: "느티 잎(황록 계열) 짝단", steps: ["#122818", "#1d3d1b", "#2a521d", "#386520", "#467623", "#548627", "#63952c", "#72a334", "#81b13d", "#8fbb48"], chromaCap: 0.46, use: "느티나무·잡목 수관(황록 그루). 청록 그루와 번갈아 세워 겹친 수관을 가른다." },
          { id: "keyaki_b2", ko: "느티 잎(황록 계열) 홀단", steps: ["#183319", "#23481c", "#315b1e", "#3f6d21", "#4d7e25", "#5b8d2a", "#6b9c2f", "#7aaa38", "#88b643", "#96c04e"], chromaCap: 0.46, use: "느티나무·잡목 수관(황록 그루). 청록 그루와 번갈아 세워 겹친 수관을 가른다." },
          { id: "sugi1", ko: "삼나무 잎 짝단", steps: ["#081818", "#0b221e", "#0f2c24", "#12372a", "#174230", "#1d4d35", "#24583a", "#2d643f", "#376f45", "#457a4c"], chromaCap: 0.22, use: "삼나무 원뿔 수관. 층마다 아래 그늘, 왼쪽 빛." },
          { id: "sugi2", ko: "삼나무 잎 홀단", steps: ["#0a1d1b", "#0d2721", "#103227", "#153d2d", "#1a4733", "#205338", "#285e3d", "#326942", "#3e7548", "#4c8050"], chromaCap: 0.22, use: "삼나무 원뿔 수관. 층마다 아래 그늘, 왼쪽 빛." },
          { id: "pine1", ko: "소나무 잎 짝단", steps: ["#0c1c16", "#11261b", "#173020", "#1d3a25", "#24452a", "#2d512f", "#375c34", "#426839", "#4f733f", "#5d7e46"], chromaCap: 0.23, use: "소나무 구름 잎판. 잎판 윗면만 밝다." },
          { id: "pine2", ko: "소나무 잎 홀단", steps: ["#0f2119", "#142b1e", "#1a3523", "#214028", "#284b2d", "#325732", "#3c6237", "#496d3c", "#567942", "#64844a"], chromaCap: 0.23, use: "소나무 구름 잎판. 잎판 윗면만 밝다." },
          { id: "bamboo_leaf1", ko: "대 잎 짝단", steps: ["#162e1a", "#203d1e", "#2b4d22", "#365d27", "#436e2c", "#507e32", "#5f8d38", "#6f9b40", "#7fa949", "#8eb456"], chromaCap: 0.38, use: "대나무 깃털 잎. 잎은 2~4px 비스듬한 획." },
          { id: "bamboo_leaf2", ko: "대 잎 홀단", steps: ["#1b361c", "#254520", "#305525", "#3c652a", "#49762f", "#578535", "#67943b", "#77a244", "#87af4f", "#96ba5c"], chromaCap: 0.38, use: "대나무 깃털 잎. 잎은 2~4px 비스듬한 획." },
          // 2026-10-20 숲 r5: jp_city 잔디(3281)에 맞춘 느티 잎 — 버들항 나무/잔디 관계를 옮겼다(scripts/content/jp-city/forest/forest_r4.py HARMONY).
          { id: "keyaki_g1", ko: "느티 잎(잔디 맞춤 청록) 짝단", steps: ["#0e1c15", "#152b1c", "#1c3a24", "#22482a", "#295531", "#316137", "#396d3e", "#447846", "#4b834a", "#558d4f"], chromaCap: 0.37, use: "jp 숲 r5 활엽 수관(청록 그루). jp_city 잔디 위에 놓이는 숲은 keyaki_a 대신 이것." },
          { id: "keyaki_g2", ko: "느티 잎(잔디 맞춤 청록) 홀단", steps: ["#112319", "#193320", "#1f4127", "#264e2e", "#2d5b34", "#35663a", "#3d7242", "#477e48", "#50894d", "#5a9352"], chromaCap: 0.37, use: "jp 숲 r5 활엽 수관(청록 그루)." },
          { id: "keyaki_h1", ko: "느티 잎(잔디 맞춤 황록) 짝단", steps: ["#162519", "#213921", "#2b4c28", "#355e2e", "#3f6e35", "#497d3b", "#538b42", "#5e984b", "#6aa555", "#75ae5f"], chromaCap: 0.37, use: "jp 숲 r5 활엽 수관(빛 받는 잎 덩이)." },
          { id: "keyaki_h2", ko: "느티 잎(잔디 맞춤 황록) 홀단", steps: ["#1d2f1e", "#264325", "#30552b", "#3a6531", "#447538", "#4e833f", "#589146", "#649e50", "#6fa95a", "#7ab364"], chromaCap: 0.37, use: "jp 숲 r5 활엽 수관(빛 받는 잎 덩이)." },
          { id: "leafhi_g", ko: "잎 반짝임(잔디 맞춤)", steps: ["#82b671", "#94c383", "#a9d098"], chromaCap: 0.4, use: "jp 숲 r5 잎 덩이 윗면 한두 점." },
          // 2026-10-20 숲 r6 접지: jp 잔디(3281의 세 색) × 0.83(그늘 가)·0.70(그늘 속)·0.55(밑동 닿는 곳) — 버들항 숲 그림자 실측 비율.
          { id: "lawn_shade", ko: "잔디 그늘(숲 접지)", steps: ["#1d3621", "#24452a", "#28462a", "#2b5232", "#395736", "#335a35", "#3d6a3f", "#496f45", "#568352"], chromaCap: 0.3, use: "숲 바닥·숲 둘레 그늘(1·2층)과 나무 밑동 닿는 그늘. 잔디 무늬를 그대로 어둡게 한다." },
          // 2026-10-21 숲 접지(이끼 바닥 bm): 지역 팩 숲 바닥(이끼·낙엽, 칸 16109)의 색 × 0.83·0.70 — lawn_shade 와 같은 비율.
          { id: "moss_shade", ko: "이끼 바닥 그늘(숲 접지)", steps: ["#202716", "#262e1b", "#313a1f", "#3a4525", "#4e4034", "#424c29", "#5d4c3d", "#5e5042", "#4f5a31", "#705f4e"], chromaCap: 0.3, use: "이끼·낙엽 바닥 위 숲(jp-forest4-bm)의 숲 바닥·둘레 그늘. 바닥 무늬를 그대로 어둡게 한다." },
          { id: "leafhi", ko: "잎 반짝임", steps: ["#96c460", "#acd274", "#c4e08e"], chromaCap: 0.4, use: "활엽 잎 덩이 윗면 한두 점." },
          { id: "shade", ko: "숲 그늘 점", steps: ["#101e16", "#182a1c", "#223822"], chromaCap: 0.09, use: "줄기 밑·수관 그늘 점(체커 두 단)." },
          { id: "floor", ko: "숲 바닥", steps: ["#0c1612", "#121e16", "#18261a", "#20301e", "#2a3a22", "#364628"], chromaCap: 0.12, use: "수관 밑 숲 바닥(2층). 낙엽 점은 줄기색 1~2단." },
          { id: "culm2", ko: "대 줄기 잔 결", steps: ["#224028", "#345832", "#4a703c", "#648848", "#82a05c", "#a4ba76", "#c4d296"], chromaCap: 0.27, use: "대나무 줄기. 마디는 한 단 밝게, 그늘 면 0~1단." },
        ],
        chromaCap: 0.26, use: "소나무·삼나무·대숲·생울타리·잔디(민트 midori 대신). 숲 수관은 하위 램프 sunleaf, 대 줄기는 culm.",
      },
      {
        id: "moss", ko: "이끼", en: "Moss", steps: ["#2e3820", "#46532d", "#5f6d3b", "#7a874e", "#98a466"],
        ramp: ["#222b18", "#2e3820", "#3a4527", "#46532d", "#5f6d3b", "#7a874e", "#98a466"],
        chromaCap: 0.26, use: "이끼 낀 돌·습원 풀·논 모·산길 풀섶.",
      },
      { id: "sakura_petal", ko: "벚꽃잎", en: "Sakura Petal Pink", steps: ["#6b4350", "#956373", "#bf8c99", "#ddb2b8", "#f2d6d6"], chromaCap: 0.22, use: "벚꽃·봄 꽃잎·료칸 장식(형광 분홍 pinku 대신).",
        // 2026-10-20 숲 팩: 벚나무 숲(꽃 핀 수관 덩이)을 버들항식 9단으로 칠한다 — 핵심 5단을 순서대로 품는다.
        ramp: ["#3c2830", "#523540", "#6b4350", "#80535f", "#956373", "#aa7784", "#bf8c99", "#ddb2b8", "#f2d6d6"],
        subRamps: [
          { id: "fine1", ko: "벚꽃 잔 결 짝단", steps: ["#341e28", "#482b36", "#5d3845", "#744755", "#8c5a68", "#a46e7b", "#bc8491", "#d09ca6", "#e1b4bc", "#eeccd0"], chromaCap: 0.22, use: "벚나무 꽃 수관. 그늘은 자줏빛, 빛은 흰빛 분홍." },
          { id: "fine2", ko: "벚꽃 잔 결 홀단", steps: ["#3e242f", "#52313d", "#69404d", "#80505e", "#986371", "#b07986", "#c7909c", "#d9a8b1", "#e7c0c6", "#f4d8da"], chromaCap: 0.22, use: "벚나무 꽃 수관. 그늘은 자줏빛, 빛은 흰빛 분홍." },
        ] },
      { id: "autumn_maple", ko: "가을 단풍", en: "Autumn Maple Crimson", steps: ["#4a1a1e", "#722428", "#9a352f", "#b8553c", "#d07e58"], chromaCap: 0.5, use: "단풍·가을 계곡. 봄·여름 장면에는 쓰지 않는다.",
        // 2026-10-20 숲 팩: 단풍 숲(가을 활엽 수관)을 버들항식 9단으로 — 핵심 5단을 순서대로 품는다.
        ramp: ["#2c1214", "#3b161a", "#4a1a1e", "#5e1f23", "#722428", "#86302c", "#9a352f", "#b8553c", "#d07e58"],
        subRamps: [
          { id: "fine1", ko: "단풍 잔 결 짝단", steps: ["#280e10", "#3b1315", "#4f191a", "#641f1d", "#7a2822", "#8e3428", "#a0452f", "#b05739", "#bf6a43", "#cd7f55"], chromaCap: 0.49, use: "단풍 수관. 그늘은 검붉게, 빛은 주황으로." },
          { id: "fine2", ko: "단풍 잔 결 홀단", steps: ["#311113", "#441618", "#5a1c1b", "#6f2320", "#852d25", "#973c2c", "#a94d34", "#b8603e", "#c6754c", "#d48a5e"], chromaCap: 0.49, use: "단풍 수관. 그늘은 검붉게, 빛은 주황으로." },
        ] },
    ],
  },
  {
    id: "water_onsen_coast", index: 5, ko: "수변·온천·해안", en: "Water · Onsen · Coast",
    materials: [
      { id: "canal_indigo", ko: "운하 쪽빛", en: "Canal Indigo", steps: ["#18223a", "#233352", "#31486b", "#456184", "#627e9c"], chromaCap: 0.28, use: "운하·강·바다·연못. 반짝임은 vending_cool_white 4단 한 점." },
      { id: "onsen_mineral_teal", ko: "온천 광물 청록", en: "Onsen Mineral Teal", steps: ["#1d3c40", "#2a5657", "#3c726f", "#5a918b", "#86b4aa"], chromaCap: 0.24, use: "노천탕 물·계곡 소(沼)·습원 물." },
      { id: "wet_cobble", ko: "젖은 자갈돌", en: "Wet Cobble", steps: ["#262833", "#353946", "#474d5b", "#5f6674", "#7d8592"], chromaCap: 0.1, use: "온천가 이시다타미·항구 부두·방파제 젖은 면." },
    ],
  },
  {
    id: "accent_signage", index: 6, ko: "점경·간판 포인트", en: "Accent · Signage",
    materials: [
      { id: "lantern_amber", ko: "등롱 호박색", en: "Warm Lantern Amber", steps: ["#52351e", "#856437", "#b89d53", "#e0c57a", "#fae29f"], chromaCap: 0.42, use: "초롱·불 켜진 창·노란 점자블록·축제 등. 밤에도 밝기를 유지하는 발광 재료." },
      { id: "noren_indigo", ko: "노렌 쪽빛", en: "Noren Indigo", steps: ["#12173d", "#1f295c", "#2f3f78", "#4a5c94", "#7282b0"], chromaCap: 0.3, use: "노렌·작업복·쪽빛 간판·감색 차양." },
      { id: "noren_rust", ko: "노렌 녹슨 주황", en: "Noren Rust", steps: ["#4a2418", "#6e3420", "#93492c", "#b06640", "#c88a62"], chromaCap: 0.45, use: "주황 노렌·녹슨 함석·폐선 레일 녹·가게 차양(daidai 주황 대신)." },
      { id: "vending_cool_white", ko: "자판기 찬 흰색", en: "Vending Cool White", steps: ["#8e95a3", "#a9b0bc", "#c3c9d3", "#dce1e8", "#eff2f6"], chromaCap: 0.08, use: "자판기 빛·노면 흰 선·눈·물 반짝임. 밤에도 밝기를 유지하는 발광 재료." },
    ],
  },
];

/** 계약 밖이어도 그대로 두는 modern3 보조 램프(윤곽·철·유리·벽재). 채도가 JP_SUPPORT_CHROMA_CAP 을 넘는 단은 계약 색으로 바꾼다. */
export const JP_SUPPORT_RAMPS: readonly string[] = ["sumi", "yoru", "hodo", "conc", "tairu", "ita", "garasu", "kawara", "renga", "tekko", "ki", "mado", "kinari", "shiro", "soil", "yuka", "kokuban", "lino", "kon"];
export const JP_SUPPORT_CHROMA_CAP = 0.34;
/** 일본 거리에서 퇴출한 modern3 램프(형광 노랑·주황·빨강·민트·하늘·분홍·네온) - 바깥 칸에 남은 색은 JP_RETIRED_RAMP_TARGETS 의 짝 재료로 옮긴다. */
export const JP_RETIRED_RAMPS: readonly string[] = ["aka", "daidai", "kii", "midori", "sora", "pinku", "shiba", "murasaki", "neonP", "neonC"];

export type JpTimeOfDay = "dawn" | "day" | "dusk" | "night";
export interface JpTimeOfDayRule {
  readonly id: JpTimeOfDay;
  readonly ko: string;
  /** 비발광 재료의 단 이동(음수 = 어둡게). */
  readonly stepShift: number;
  /** 화면 전체 색조(곱하기 합성 대상) - 계약 색. */
  readonly tint: string;
  readonly tintStrength: number;
  /** 단 이동 없이 밝기를 유지하는 재료. */
  readonly emissive: readonly string[];
  readonly rule: string;
}

export const JP_TIME_OF_DAY_RULES: readonly JpTimeOfDayRule[] = [
  { id: "dawn", ko: "새벽", stepShift: -1, tint: "#bf8c99", tintStrength: 0.08, emissive: [], rule: "벚꽃 2단 아주 옅은 분홍 기운. 그늘 단은 그대로 두고 빛 면만 한 단 내린다." },
  { id: "day", ko: "낮", stepShift: 0, tint: "#eff2f6", tintStrength: 0, emissive: [], rule: "계약 색 그대로. 그늘은 오른쪽·아래(빛 왼쪽 위)." },
  { id: "dusk", ko: "해질녘", stepShift: -1, tint: "#e0c57a", tintStrength: 0.14, emissive: ["lantern_amber"], rule: "모든 재료 한 단 어둡게 + 등롱 호박색 14%. 초롱·창만 원래 단 유지." },
  { id: "night", ko: "밤", stepShift: -2, tint: "#233352", tintStrength: 0.3, emissive: ["lantern_amber", "vending_cool_white"], rule: "두 단 어둡게 + 운하 쪽빛 30%. 발광 재료(등롱·자판기)만 원래 단 - 한 장면 발광 칸은 6% 이하." },
];

export type JpSeason = "spring" | "summer" | "autumn" | "winter";
export interface JpSeasonRule { readonly id: JpSeason; readonly ko: string; readonly foliage: string; readonly accent: string; readonly ground: string; readonly rule: string }
export const JP_SEASON_RULES: readonly JpSeasonRule[] = [
  { id: "spring", ko: "봄", foliage: "pine_bamboo", accent: "sakura_petal", ground: "moss", rule: "벚나무 잎 칸을 벚꽃잎 램프로, 바닥 꽃잎은 3~4단 한두 점." },
  { id: "summer", ko: "여름", foliage: "pine_bamboo", accent: "lantern_amber", ground: "moss", rule: "짙은 녹 위주, 축제 초롱은 호박색. 하늘·바다는 운하 쪽빛 3~4단." },
  { id: "autumn", ko: "가을", foliage: "autumn_maple", accent: "tatami_straw", ground: "tatami_straw", rule: "활엽수 잎을 단풍 램프로, 논·풀섶은 다다미 짚으로 마른다. 소나무·삼나무는 그대로 녹." },
  { id: "winter", ko: "겨울", foliage: "pine_bamboo", accent: "vending_cool_white", ground: "vending_cool_white", rule: "눈 = 자판기 찬 흰색 2~4단(순백 금지), 눈 그늘 = 운하 쪽빛 4단." },
];

/** 지역 무리별 주조 계열(화면 넓이 순). 한 장면에서 주조 계열은 셋까지, 포인트(accent_signage)는 6% 이하. */
export const JP_BIOME_HARMONY: Readonly<Record<string, readonly JpPaletteFamilyId[]>> = {
  urban: ["ground_stone", "roof_modern", "accent_signage"],
  residential: ["roof_modern", "ground_stone", "vegetation_season"],
  campus_civic: ["ground_stone", "roof_modern", "vegetation_season"],
  sacred_historic: ["ground_stone", "vegetation_season", "timber_traditional"],
  mountain_nature: ["vegetation_season", "water_onsen_coast", "timber_traditional"],
  onsen_rural_coast: ["water_onsen_coast", "vegetation_season", "timber_traditional"],
};

export const JP_PALETTE_HARMONY_RULES: readonly string[] = [
  "빛은 왼쪽 위 - 왼쪽·윗면은 3단, 오른쪽·아랫면은 1단, 접지·처마 밑은 0단.",
  "한 재료 안에서 이웃 단만 맞닿게 칠한다(0단 옆 4단 금지, 윤곽 sumi 는 예외).",
  "채도 0.50 초과 색 금지(네온 없음). 도리이 주홍·단풍은 랜드마크 전용이며 지도 칸의 4% 이하.",
  "포인트 계열(등롱·노렌·자판기)은 장면의 6% 이하 - 거리 전체가 간판 색으로 덮이지 않는다.",
  "물은 운하 쪽빛 1~2단이 몸통, 둑 그늘 0단, 반짝임은 자판기 찬 흰색 4단 한 점.",
  "식생 녹은 소나무·대나무(짙은 녹)·이끼 둘뿐 - 형광 연두·민트 금지.",
  "주조 계열은 지역 무리(JP_BIOME_HARMONY)를 따르고, 시간대·계절은 단 이동과 재료 교체로만 표현한다.",
  "새 색은 재료의 확장 램프(6~10단, 핵심 5단을 품는다)나 하위 램프(3~10단)로만 더한다 - 램프 밖 낱색 금지. 단은 어두운 → 밝은, 밝기가 줄곧 오른다(2026-10-20).",
];

// ─────────────────────────── 색 계산 ───────────────────────────
export function hexToRgb(hex: string): readonly [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** max - min (0~1). */
export function chromaOf(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

function lab(hex: string): readonly [number, number, number] {
  const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = hexToRgb(hex).map(lin) as [number, number, number];
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** `ramp` = 그 색이 속한 램프 이름: 재료 id(핵심 5단) · `<재료>+`(확장) · `<재료>/<하위>`(하위). `step` 은 그 램프 안의 단, `length` 는 램프 단 수. */
export interface JpContractColor { readonly hex: string; readonly family: JpPaletteFamilyId; readonly material: string; readonly step: number; readonly ramp: string; readonly length: number }

/** 재료 하나의 이름 붙은 램프 전부(핵심 · 확장 · 하위). */
export function materialRamps(m: JpMaterialRamp): { readonly name: string; readonly steps: readonly string[]; readonly chromaCap: number }[] {
  return [
    { name: m.id, steps: m.steps, chromaCap: m.chromaCap },
    ...(m.ramp ? [{ name: `${m.id}+`, steps: m.ramp, chromaCap: m.chromaCap }] : []),
    ...(m.subRamps ?? []).map((r) => ({ name: `${m.id}/${r.id}`, steps: r.steps, chromaCap: r.chromaCap ?? m.chromaCap })),
  ];
}

/** 모든 계약 색. 같은 색이 여러 램프에 있으면 핵심 → 확장 → 하위 순서의 첫 자리가 대표다. */
export const JP_CONTRACT_COLORS: readonly JpContractColor[] = (() => {
  const seen = new Set<string>();
  const out: JpContractColor[] = [];
  for (const f of JP_PALETTE_FAMILIES) for (const m of f.materials) for (const r of materialRamps(m)) r.steps.forEach((hex, step) => {
    if (seen.has(hex)) return;
    seen.add(hex);
    out.push({ hex, family: f.id, material: m.id, step, ramp: r.name, length: r.steps.length });
  });
  return out;
})();
const CONTRACT_BY_HEX = new Map(JP_CONTRACT_COLORS.map((c) => [c.hex, c]));

/** 계약 자체 검사 - 단 수·핵심 포함·밝기 순서·채도. 빈 배열이면 통과. 내보내기(export_palette_contract.mts)가 부른다. */
export function validateJpPaletteContract(families: readonly JpPaletteFamily[] = JP_PALETTE_FAMILIES): string[] {
  const bad: string[] = [];
  const luma = (hex: string) => { const [r, g, b] = hexToRgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const hexOk = (h: string) => /^#[0-9a-f]{6}$/.test(h);
  for (const f of families) for (const m of f.materials) {
    if (m.steps.length !== 5) bad.push(`${m.id}: 핵심 단은 5개여야 한다(${m.steps.length})`);
    if (m.ramp) {
      if (m.ramp.length < JP_RAMP_MIN_EXTENDED || m.ramp.length > JP_RAMP_MAX_STEPS) bad.push(`${m.id}+: 확장 램프는 ${JP_RAMP_MIN_EXTENDED}~${JP_RAMP_MAX_STEPS}단(${m.ramp.length})`);
      let i = 0;
      for (const h of m.ramp) if (i < 5 && h === m.steps[i]) i++;
      if (i < 5) bad.push(`${m.id}+: 확장 램프가 핵심 5단을 순서대로 품지 않는다`);
    }
    const subIds = new Set<string>();
    for (const r of m.subRamps ?? []) {
      if (subIds.has(r.id)) bad.push(`${m.id}/${r.id}: 하위 램프 id 중복`);
      subIds.add(r.id);
      if (r.steps.length < JP_SUBRAMP_MIN_STEPS || r.steps.length > JP_RAMP_MAX_STEPS) bad.push(`${m.id}/${r.id}: 하위 램프는 ${JP_SUBRAMP_MIN_STEPS}~${JP_RAMP_MAX_STEPS}단(${r.steps.length})`);
      if ((r.chromaCap ?? 0) > JP_PALETTE_HARD_CHROMA_CAP) bad.push(`${m.id}/${r.id}: 채도 상한 ${r.chromaCap} > ${JP_PALETTE_HARD_CHROMA_CAP}`);
    }
    for (const r of materialRamps(m)) {
      r.steps.forEach((h, k) => {
        if (!hexOk(h)) bad.push(`${r.name}[${k}]: 소문자 #rrggbb 가 아니다(${h})`);
        // 핵심 5단은 2026-10-18 판 그대로라 재료 상한을 조금 넘는 단이 있다(vending_cool_white 0 단 0.082) - 핵심은 전체 상한만, 확장·하위는 자기 상한까지 본다.
        else if (chromaOf(h) > (r.name === m.id ? JP_PALETTE_HARD_CHROMA_CAP : Math.min(r.chromaCap, JP_PALETTE_HARD_CHROMA_CAP)) + 1e-9) bad.push(`${r.name}[${k}] ${h}: 채도 ${chromaOf(h).toFixed(3)} > ${r.chromaCap}`);
        if (k > 0 && hexOk(h) && luma(h) <= luma(r.steps[k - 1]!)) bad.push(`${r.name}[${k}] ${h}: 앞 단보다 밝지 않다`);
      });
    }
  }
  return bad;
}

export function contractColor(hex: string): JpContractColor | undefined { return CONTRACT_BY_HEX.get(hex.toLowerCase()); }

export function materialRamp(id: string): JpMaterialRamp | undefined {
  for (const f of JP_PALETTE_FAMILIES) for (const m of f.materials) if (m.id === id) return m;
  return undefined;
}

/** 핵심 5단 색만(정규화 대상). 확장·하위 램프 색은 그린 사람이 고를 때만 쓰고, 다른 색을 끌어당기지 않는다 - 이미 구운 칸의 정규화 결과가 2026-10-20 확장 전과 같다. */
const CORE_CONTRACT_COLORS = JP_CONTRACT_COLORS.filter((c) => c.ramp === c.material);

/** 가장 가까운 핵심 계약 색(CIELAB ΔE76). 같은 거리면 계약 순서가 앞선 색. */
export function nearestContractColor(hex: string): JpContractColor {
  const [l, a, b] = lab(hex);
  let best = CORE_CONTRACT_COLORS[0]!, bestD = Infinity;
  for (const c of CORE_CONTRACT_COLORS) {
    const [l2, a2, b2] = lab(c.hex);
    const d = (l - l2) ** 2 + (a - a2) ** 2 + (b - b2) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/** 퇴출 램프 -> 계약 재료(단 순서를 지켜 옮긴다: 원래 단 i/(n-1) 를 0~4 단에 펴고 shift 만큼 밝힌다). 가장 가까운 색으로만 옮기면 한 램프의 세 단이 한 색으로 뭉개진다(잔디 결이 사라짐). */
export const JP_RETIRED_RAMP_TARGETS: Readonly<Record<string, { readonly material: string; readonly shift: number }>> = {
  aka: { material: "torii_vermilion", shift: 0 },
  daidai: { material: "noren_rust", shift: 0 },
  kii: { material: "lantern_amber", shift: 0 },
  midori: { material: "pine_bamboo", shift: 1 },
  shiba: { material: "moss", shift: 0 },
  sora: { material: "canal_indigo", shift: 1 },
  pinku: { material: "sakura_petal", shift: 0 },
  murasaki: { material: "noren_indigo", shift: 1 },
  neonP: { material: "sakura_petal", shift: 0 },
  neonC: { material: "onsen_mineral_teal", shift: 0 },
};

/** modern3 램프 안의 자리(정규화가 단 순서를 지키는 데 쓴다). */
export interface JpSourceSlot { readonly ramp: string; readonly step: number; readonly length: number }

/** 바깥 칸 색 정규화: 계약 색 · 채도 상한 안의 보조 램프 색은 그대로, 퇴출 램프는 짝 재료의 같은 순서 단, 그 밖의 채도 초과 색은 가장 가까운 계약 색. */
export function normalizeJpColor(hex: string, source?: JpSourceSlot): string {
  const h = hex.toLowerCase();
  if (CONTRACT_BY_HEX.has(h)) return h;
  const target = source ? JP_RETIRED_RAMP_TARGETS[source.ramp] : undefined;
  if (source && target) {
    const step = Math.round((source.step * 4) / Math.max(1, source.length - 1)) + target.shift;
    return materialRamp(target.material)!.steps[Math.max(0, Math.min(4, step))]!;
  }
  if (chromaOf(h) <= JP_SUPPORT_CHROMA_CAP && (!source || JP_SUPPORT_RAMPS.includes(source.ramp))) return h;
  return nearestContractColor(h).hex;
}

/** 시간대 규칙으로 계약 색 한 칸을 옮긴다(같은 램프 안에서 단 이동, 발광 재료는 그대로). 계약 밖 색은 그대로.
 *  확장·하위 램프 색은 핵심 단 한 칸을 그 램프의 (단 수 - 1)/4 칸으로 환산해 옮긴다. */
export function shiftForTimeOfDay(hex: string, tod: JpTimeOfDay): string {
  const c = contractColor(hex);
  const rule = JP_TIME_OF_DAY_RULES.find((r) => r.id === tod)!;
  if (!c || rule.emissive.includes(c.material)) return hex.toLowerCase();
  const m = materialRamp(c.material)!;
  const steps = materialRamps(m).find((r) => r.name === c.ramp)!.steps;
  const move = Math.round((rule.stepShift * (steps.length - 1)) / 4);
  return steps[Math.max(0, Math.min(steps.length - 1, c.step + move))]!;
}

export interface JpPaletteAuditRow { readonly hex: string; readonly pixels: number; readonly chroma: number; readonly status: "contract" | "support" | "normalized"; readonly to: string }

/** 색 사용량(hex → 화소 수)을 계약으로 감사한다. */
export function auditJpPalette(usage: Readonly<Record<string, number>>, slotOf: (hex: string) => JpSourceSlot | undefined = () => undefined): JpPaletteAuditRow[] {
  return Object.entries(usage).map(([hex, pixels]) => {
    const h = hex.toLowerCase();
    const to = normalizeJpColor(h, slotOf(h));
    const status: JpPaletteAuditRow["status"] = CONTRACT_BY_HEX.has(h) ? "contract" : to === h ? "support" : "normalized";
    return { hex: h, pixels, chroma: Math.round(chromaOf(h) * 100) / 100, status, to };
  }).sort((p, q) => q.pixels - p.pixels);
}
