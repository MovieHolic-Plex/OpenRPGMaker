// 던전 종류의 「문법 정보」 — 칩셋을 모르는 쪽(2026-10-15 beodeul/profiles.ts 에서 분리).
// 종류 이름·낱말·배치 문법·방 종류·액체·방 구성 계획기. 어느 칩셋이 이 종류를 그릴 수 있는지(키트 매핑)는 어댑터가 따로 가진다.
import { rng } from "./grid";
import type { DungeonGrammar, DungeonRoomInput, DungeonRoomKind, DungeonType } from "./types";

export interface GrammarInfo {
  readonly id: DungeonType;
  readonly label: string;
  /** 사용자 말 → 종류(intentDeclaration·tool 설명이 쓴다). */
  readonly words: readonly string[];
  readonly grammar: DungeonGrammar;
  readonly roomKinds: readonly DungeonRoomKind[];
  /** void = 허공(마계 떠 있는 땅 사이 낭떠러지) — 물·용암처럼 막힌 칸이고 다리로만 건넌다. */
  readonly liquid?: "water" | "lava" | "void";
  /** 벽 모양: ceiling = 지하(천장 오토타일 + 벽 앞면 세 줄) · canopy = 야외(벽 칸을 수관 숲으로 덮는다, 앞면 줄 없음). 기본 ceiling. */
  readonly walls?: "ceiling" | "canopy";
  readonly blurb: string;
}

export const GRAMMAR: Record<DungeonType, GrammarInfo> = {
  catacomb: {
    id: "catacomb", label: "지하묘지·지하 감옥", words: ["지하묘지", "카타콤", "묘지", "납골", "지하 감옥", "감옥", "던전", "지하", "미궁 아닌"],
    grammar: "rooms", roomKinds: ["entrance", "hall", "crypt", "cell", "shrine", "boss", "storage", "vault"],
    blurb: "이끼 낀 회색 석벽 지하 묘지. 방+통로 나무 모양(큰 홀·묘실·감방·제단·창고·보물 방·보스방).",
  },
  castle: {
    id: "castle", label: "성·요새", words: ["성채", "성 지하", "성 지하실", "지하 성", "마왕성", "요새", "왕성", "성벽", "옥좌", "왕좌", "castle", "fortress", "keep", "성"],
    grammar: "rooms", roomKinds: ["entrance", "hall", "crypt", "cell", "shrine", "boss", "storage", "vault"],
    blurb: "다듬은 석벽의 성·요새(성문 홀 → 열주 대전·병영·무기고·감옥 → 옥좌의 방 + 보물고). 방+통로 문법, 밝은 판석 바닥, 옥좌·붉은 카펫·깃발·갑옷.",
  },
  labyrinth: {
    id: "labyrinth", label: "미궁(미로)", words: ["미궁", "미로", "labyrinth", "maze"],
    grammar: "maze", roomKinds: ["entrance", "boss", "vault", "junction", "storage", "shrine"],
    blurb: "굽이치는 갈림길 통로 미로(막다른 길 보물·한가운데 보스). 격자 간격으로 통로 폭 3칸 고정.",
  },
  sewer: {
    id: "sewer", label: "하수도·수로", words: ["하수도", "수로", "수도교", "배수", "지하 수로", "waterworks", "sewer"],
    grammar: "rooms", roomKinds: ["entrance", "channel", "cistern", "pump", "hall", "storage", "boss", "vault", "crypt"],
    liquid: "water",
    blurb: "수로가 가로지르는 지하 하수도(수로 방은 양옆 보행로 + 다리, 저수조 섬, 펌프실). 물은 막힘 — 다리·보행로로만 건넌다.",
  },
  cave: {
    id: "cave", label: "자연 동굴", words: ["동굴", "굴", "cave", "cavern", "지하 호수", "종유"],
    grammar: "blob", roomKinds: ["entrance", "cavern", "lake", "grotto", "boss", "vault"],
    liquid: "water",
    blurb: "불규칙한 동굴 방(둥글게 번진 방 + 굽은 넓은 통로), 지하 호수, 석순·버섯·이끼 빛. 지름길 고리 하나.",
  },
  temple: {
    id: "temple", label: "폐허 신전", words: ["고대 유적", "신전", "사원", "유적", "폐허", "temple", "ruin", "성소"],
    grammar: "rooms", roomKinds: ["entrance", "nave", "shrine", "crypt", "boss", "vault", "storage", "hall"],
    blurb: "좌우 대칭 신전(현관 → 열주 늘어선 신랑 → 제단 안쪽 성소, 곁방), 군데군데 무너진 구역·덩굴·이끼.",
  },
  mine: {
    id: "mine", label: "광산 갱도", words: ["광산", "갱도", "갱", "탄광", "채굴", "mine", "mining"],
    grammar: "rooms", roomKinds: ["entrance", "junction", "stope", "depot", "boss", "vault", "storage"],
    blurb: "수평 주 갱도(한 줄 대로) + 갈래 갱 + 채굴장(광석 덩이·광차·램프). 입구는 갱구.",
  },
  volcano: {
    id: "volcano", label: "화산 동굴", words: ["화산", "용암", "화염", "불의 동굴", "volcano", "lava", "magma"],
    grammar: "blob", roomKinds: ["entrance", "cavern", "lake", "forge", "grotto", "boss", "vault"],
    liquid: "lava",
    blurb: "용암 못·용암 강이 있는 화산 동굴(재 바닥, 흑요석 뾰족돌, 열 구멍, 옛 대장간 방). 용암은 막힘 — 안전한 길·다리가 보장된다.",
  },
  ice: {
    id: "ice", label: "설산·얼음 동굴", words: ["얼음 동굴", "빙굴", "빙하 동굴", "얼음굴", "얼음", "빙하", "설산", "눈 덮인 산", "만년설", "설원 동굴", "ice cave", "frozen", "glacier"],
    grammar: "blob", roomKinds: ["entrance", "cavern", "lake", "grotto", "boss", "vault"],
    blurb: "눈 덮인 바닥과 얼어붙은 호수(걸을 수 있는 빙판 — 미끄럼 장치), 얼음 바위·고드름·얼음에 갇힌 전사. 버들항·몬스터 키트 모두.",
  },
  forest: {
    id: "forest", label: "숲 던전(깊은 숲 미로)", words: ["숲", "삼림", "밀림", "정글", "수해", "고목", "세계수", "거목", "요정의 숲", "길 잃는 숲", "forest", "woods", "jungle"],
    grammar: "blob", roomKinds: ["entrance", "cavern", "lake", "grotto", "boss", "vault"], liquid: "water", walls: "canopy",
    blurb: "빽빽한 나무 벽 사이로 굽은 숲길이 이어지는 야외 던전 — 빈터(방)·숲속 연못·버섯 고리·쓰러진 통나무, 가장 깊은 곳에 거대한 고목(보스 자리).",
  },
  swamp: {
    id: "swamp", label: "늪지대", words: ["늪", "습지", "소택", "수렁", "맹그로브", "독늪", "swamp", "bog", "marsh", "mire"],
    grammar: "blob", roomKinds: ["entrance", "cavern", "lake", "grotto", "boss", "vault"], liquid: "water", walls: "canopy",
    blurb: "검은 늪물 사이 진흙 둔덕과 널판 길(다리)로 이어지는 야외 던전 — 맹그로브 뿌리·죽은 나무·갈대·도깨비불, 가라앉은 우상.",
  },
  pyramid: {
    id: "pyramid", label: "사막 피라미드·왕묘", words: ["피라미드", "왕묘", "파라오", "스핑크스", "사막 유적", "사막 신전", "사막 무덤", "모래 무덤", "사막 던전", "사막", "pyramid", "pharaoh", "tomb of the king"],
    grammar: "rooms", roomKinds: ["entrance", "hall", "crypt", "shrine", "boss", "vault", "storage"],
    blurb: "사암 벽·상형문자 벽의 왕묘(입구 회랑 → 열주 홀 → 석관 묘실·제물 방 → 파라오 묘실 + 보물 방), 모래 함정.",
  },
  tower: {
    id: "tower", label: "마법탑", words: ["마법탑", "마탑", "마법사의 탑", "마도사의 탑", "현자의 탑", "탑", "서고", "wizard tower", "mage tower", "tower"],
    grammar: "rooms", roomKinds: ["entrance", "hall", "library", "shrine", "boss", "vault", "storage"],
    blurb: "계단을 중심으로 층이 쌓인 둥근 탑(층마다 서고·연구실·마법진), 마법진 순간이동, 꼭대기 층에 탑의 주인.",
  },
  otherworld: {
    id: "otherworld", label: "마계·이세계", words: ["마계", "이세계", "이계", "지옥", "심연", "공허", "마왕의 영역", "abyss", "hell", "demon realm", "otherworld", "void"],
    grammar: "blob", roomKinds: ["entrance", "cavern", "lake", "grotto", "boss", "vault"], liquid: "void",
    blurb: "허공에 떠 있는 땅 조각들이 다리로 이어진 이세계(낭떠러지 가장자리·타락한 수정·보랏빛 불꽃), 끝에 마왕의 옥좌.",
  },
};

/**
 * 게임 이름 → 던전 종류·배치·장치(2026-10-23 dungeon-themes). 사용자는 「엘든링 같은 지하묘지」「크로노트리거 같은 마계 성」처럼 말한다.
 * 종류 낱말(지하묘지·마계…)이 함께 오면 그 낱말이 먼저고, 게임 이름은 그 게임의 대표 던전과 배치 습관(고리 지름길·층 쌓기)을 정한다.
 */
export interface DungeonReference { readonly re: RegExp; readonly label: string; readonly type: DungeonType; readonly layout?: "linear" | "hub" | "loop" | "vertical"; readonly gimmick?: string; readonly note: string }
export const DUNGEON_REFERENCES: readonly DungeonReference[] = [
  { re: /엘든\s*링|elden\s*ring|다크\s*소울|dark\s*souls|블러드\s*본|bloodborne/i, label: "엘든링·다크소울", type: "catacomb", layout: "loop", gimmick: "lever", note: "레거시 던전·카타콤 — 고리로 돌아오는 지름길, 레버 문, 함정·석관, 묘지기 보스" },
  { re: /ff\s*6|ff\s*vi|파판\s*6|파이널\s*판타지\s*(6|vi)|final\s*fantasy\s*(6|vi)/i, label: "FF6", type: "mine", layout: "linear", gimmick: "minecart", note: "나르쉐 광산·마도 공장 — 선로와 광차, 갱목 갱도, 마도 아머 보스" },
  { re: /크로노\s*트리거|chrono\s*trigger/i, label: "크로노 트리거", type: "tower", layout: "vertical", gimmick: "teleporter", note: "마법 왕국 질의 탑·바다 궁전 — 층을 쌓은 마법탑, 마법진 순간이동" },
  { re: /젤다|zelda/i, label: "젤다", type: "temple", layout: "hub", gimmick: "lever", note: "가운데 홀에서 갈래로 퍼지는 신전, 장치를 풀어 문을 연다" },
  { re: /툼\s*레이더|tomb\s*raider|인디아나|indiana|미이라|미라|mummy/i, label: "툼레이더·미이라", type: "pyramid", layout: "linear", gimmick: "sandpit", note: "피라미드 왕묘 — 모래 함정, 석관, 파라오" },
  { re: /디아블로|diablo/i, label: "디아블로", type: "catacomb", layout: "hub", note: "어두운 지하묘지·지옥" },
  { re: /스카이림|skyrim/i, label: "스카이림", type: "catacomb", layout: "linear", gimmick: "lever", note: "노르드 고분 — 레버·발판 함정, 드라우그" },
  { re: /마인\s*크래프트|minecraft/i, label: "마인크래프트", type: "mine", layout: "loop", gimmick: "minecart", note: "버려진 갱도와 광차 선로" },
  { re: /포켓몬|pokemon|pokémon/i, label: "포켓몬", type: "cave", layout: "linear", note: "짧은 동굴(야생 조우)" },
  { re: /드래곤\s*퀘스트|드퀘|dragon\s*quest/i, label: "드래곤 퀘스트", type: "cave", layout: "linear", note: "전통적인 동굴·탑" },
  { re: /메이플|maple/i, label: "메이플스토리", type: "forest", layout: "linear", note: "엘리니아 숲" },
];

export interface DungeonRequest { readonly type: DungeonType | null; readonly iceRequested: boolean; readonly reference?: DungeonReference; readonly layout?: "linear" | "hub" | "loop" | "vertical"; readonly gimmick?: string }

/**
 * 요청 문장 → 종류 + 게임 참고. 종류 낱말이 있으면 그 종류(「크로노트리거 같은 마계 성」 → otherworld), 없으면 게임의 대표 던전.
 * 「마계 성」처럼 성 낱말이 같이 오면 종류는 마계(그림·적은 마계), 성다움은 장식이 맡는다.
 */
export function inferDungeonRequest(text: string): DungeonRequest {
  const t = text.toLowerCase();
  const reference = DUNGEON_REFERENCES.find((r) => r.re.test(text));
  const base = inferDungeonType(text);
  // 엘든링 「성·레거시 던전」은 성(castle), 크로노 트리거 「마왕성」은 마계
  let type = base.type;
  if (!type && reference) {
    if (reference.label === "엘든링·다크소울" && /성|요새|legacy|castle/.test(t)) type = "castle";
    else if (reference.label === "크로노 트리거" && /마왕|magus|black omen|흑의 꿈/.test(t)) type = "otherworld";
    else type = reference.type;
  }
  return { type, iceRequested: base.iceRequested, ...(reference ? { reference } : {}), ...(reference?.layout ? { layout: reference.layout } : {}), ...(reference?.gimmick ? { gimmick: reference.gimmick } : {}) };
}

/** 사용자 말에서 던전 종류 추정(첫 번째로 맞는 낱말, 더 구체적인 종류가 앞). */
export function inferDungeonType(text: string): { type: DungeonType | null; iceRequested: boolean } {
  const t = text.toLowerCase();
  const iceRequested = /얼음|빙하|빙굴|설원 동굴|설산|ice|frozen|glacier/.test(t);
  // 「숲속 동굴」「늪 동굴」은 동굴이다(숲·늪은 동굴의 자리일 뿐).
  if (/동굴|굴|cave/.test(t) && /숲|늪|정글|forest|swamp/.test(t) && !/숲 던전|늪 던전/.test(t)) return { type: iceRequested ? "ice" : "cave", iceRequested };
  const order: DungeonType[] = ["otherworld", "pyramid", "ice", "swamp", "labyrinth", "sewer", "mine", "volcano", "tower", "temple", "forest", "castle", "catacomb", "cave"];
  for (const id of order) {
    if (GRAMMAR[id].words.some((w) => w && t.includes(w.toLowerCase()))) {
      // 「하수도 미로」처럼 둘이 같이 나오면 하수도(미로 문법 선택은 layout 인자)
      if (id === "labyrinth" && /하수도|수로|sewer/.test(t)) return { type: "sewer", iceRequested };
      return { type: id, iceRequested };
    }
  }
  return { type: null, iceRequested };
}

// ---------- 방 구성(rooms 를 주지 않았을 때) ----------

const sized = (spec: { size?: "small" | "medium" | "large"; width?: number; height?: number }): number => {
  const bySize = { small: 4, medium: 6, large: 9 } as const;
  const area = spec.width && spec.height ? spec.width * spec.height : 0;
  return area ? Math.max(3, Math.min(11, Math.round(area / 260))) : bySize[spec.size ?? "medium"];
};

/** 하수도: 입구 → 수로 방 → (저수조·펌프실 곁방) → … → 보스(둥지) → 보물. */
export function planSewer(spec: { size?: "small" | "medium" | "large"; width?: number; height?: number; seed?: number }): DungeonRoomInput[] {
  const n = sized(spec), random = rng((spec.seed ?? 7) * 7907 + 3);
  const rooms: DungeonRoomInput[] = [{ id: "entrance", kind: "entrance" }, { id: "channel1", kind: "channel", w: 26 + Math.floor(random() * 6), h: 11, from: "entrance", dir: "N" }];
  if (n >= 4) rooms.push({ id: "cistern", kind: "cistern", from: "channel1", dir: random() < 0.5 ? "W" : "E" });
  if (n >= 5) rooms.push({ id: "pump", kind: "pump", from: "channel1", dir: "N" });
  if (n >= 7) rooms.push({ id: "channel2", kind: "channel", w: 22 + Math.floor(random() * 6), h: 11, from: "pump", dir: random() < 0.5 ? "W" : "E" });
  if (n >= 8) rooms.push({ id: "storage", kind: "storage", from: "cistern" });
  rooms.push({ id: "boss", kind: "boss", from: rooms.some((r) => r.id === "channel2") ? "channel2" : rooms.some((r) => r.id === "pump") ? "pump" : "channel1", dir: "N" });
  if (n >= 6) rooms.push({ id: "vault", kind: "vault", from: "boss" });
  return rooms;
}

/**
 * 신전: 현관 → 신랑 → 성소(축 위 한 줄) + 신랑 좌우 곁방(대칭) + 성소 좌우 보물 방·납골실. 모든 곁방은 shift 0 으로 대칭.
 * 2026-10-23(assistant-dungeons-2): 통로를 위아래 4·옆 2칸으로 줄이고 보물 방을 성소 뒤가 아니라 옆에 붙였다 — 세로로 길게 늘어선
 * 십자형이라 맵의 57%가 검은 허공이었다. 신랑도 17×19 → 15×13(맨바닥이 넓었다).
 */
export function planTemple(spec: { size?: "small" | "medium" | "large"; width?: number; height?: number; seed?: number; flooded?: boolean; layout?: "linear" | "hub" | "loop" | "vertical" }): DungeonRoomInput[] {
  const n = sized(spec);
  // 잠긴 신전은 본당·예배실을 한 단 크게 — 물이 차지하는 방이라 맨바닥이 남지 않고, 작은 방 안쪽(회랑 2칸 안)은 둥근 못을 담기에 좁아 네모 수조로 읽혔다(2026-10-23 dg2-r4 VQA).
  const f = spec.flooded === true;
  // 2026-10-23 dungeon-themes: 「고대 유적」「덩굴 덮인 신전」 두 요청이 칸 하나 다르지 않은 같은 신전이었다 — 배치 가족과 시드로 뼈대·크기를 가른다.
  //   hub = 십자(본당 양옆 예배실) · linear = 긴 참배 축(전실 → 본당 → 지성소, 곁방은 한쪽씩 엇갈려) · loop = 무너진 회랑(지성소가 축에서 비켜나고 한쪽 날개가 묘실).
  const random = rng((spec.seed ?? 7) * 7349 + 11);
  const fam = spec.layout && spec.layout !== "vertical" ? spec.layout : (["linear", "hub", "loop"] as const)[Math.abs(((spec.seed ?? 7) * 2654435761) >>> 7) % 3]!;
  const j = (b: number) => b + 2 * Math.floor(random() * 3) - 2;
  const side = random() < 0.5 ? "W" : "E", other = side === "W" ? "E" : "W";
  const naveW = f ? 19 : j(15), naveH = f ? 16 : j(13), sanW = f ? 17 : j(15), sanH = f ? 12 : j(9);
  const cw = f ? 12 : j(9), ch = f ? 12 : j(9);
  if (fam === "linear") {
    const rooms: DungeonRoomInput[] = [
      { id: "porch", kind: "entrance", w: j(11), h: 6 },
      { id: "antechamber", kind: "hall", w: j(11), h: j(7), from: "porch", dir: "N", shift: 0, len: 4 },
      { id: "nave", kind: "nave", w: naveW, h: naveH, from: "antechamber", dir: "N", shift: 0, len: 4 },
      { id: "sanctum", kind: "boss", w: sanW, h: sanH, from: "nave", dir: "N", shift: 0, len: 4 },
    ];
    if (n >= 4) rooms.push({ id: "chapel", kind: "shrine", w: cw, h: ch, from: "nave", dir: side, shift: 0, len: 2 });
    if (n >= 6) rooms.push({ id: "vault", kind: "vault", w: 9, h: 7, from: "antechamber", dir: other, shift: 0, len: 2 });
    if (n >= 6) rooms.push({ id: "ossuary", kind: "crypt", w: f ? 12 : j(9), h: f ? 11 : 7, from: "sanctum", dir: other, shift: 0, len: 2 });
    return rooms;
  }
  if (fam === "loop") {
    const off = (random() < 0.5 ? -1 : 1) * (3 + Math.floor(random() * 2));
    const rooms: DungeonRoomInput[] = [
      { id: "porch", kind: "entrance", w: 13, h: 6 },
      { id: "nave", kind: "nave", w: naveW, h: naveH, from: "porch", dir: "N", shift: 0, len: 4 },
      { id: "sanctum", kind: "boss", w: sanW, h: sanH, from: "nave", dir: "N", shift: off, len: 4 },
    ];
    if (n >= 4) rooms.push({ id: "chapel", kind: "shrine", w: cw, h: ch, from: "nave", dir: side, shift: 0, len: 2 }, { id: "ossuary", kind: "crypt", w: f ? 12 : j(10), h: f ? 12 : j(8), from: "nave", dir: other, shift: 2, len: 2 });
    if (n >= 6) rooms.push({ id: "vault", kind: "vault", w: 9, h: 7, from: "chapel", dir: "N", shift: 0, len: 4 });
    if (n >= 9) rooms.push({ id: "cloister", kind: "hall", w: j(11), h: 7, from: "porch", dir: other, shift: 0, len: 2 });
    return rooms;
  }
  const rooms: DungeonRoomInput[] = [
    { id: "porch", kind: "entrance", w: 13, h: 6 },
    { id: "nave", kind: "nave", w: naveW, h: naveH, from: "porch", dir: "N", shift: 0, len: 4 },
    { id: "sanctum", kind: "boss", w: sanW, h: sanH, from: "nave", dir: "N", shift: 0, len: 4 },
  ];
  if (n >= 4) rooms.push({ id: "chapelW", kind: "shrine", w: cw, h: ch, from: "nave", dir: "W", shift: 0, len: 2 }, { id: "chapelE", kind: "shrine", w: cw, h: ch, from: "nave", dir: "E", shift: 0, len: 2 });
  if (n >= 6) rooms.push({ id: "vault", kind: "vault", w: 9, h: 7, from: "sanctum", dir: "W", shift: 0, len: 2 });
  if (n >= 6) rooms.push({ id: "ossuaryE", kind: "crypt", w: f ? 12 : 9, h: f ? 11 : 7, from: "sanctum", dir: "E", shift: 0, len: 2 });
  if (n >= 9) rooms.push({ id: "cloisterW", kind: "hall", w: j(11), h: 7, from: "porch", dir: "W", shift: 0, len: 2 }, { id: "cloisterE", kind: "storage", w: 9, h: 7, from: "porch", dir: "E", shift: 0, len: 2 });
  return rooms;
}

/** 광산: 갱구(입구) → 동쪽으로 주 갱도(갈림 방 junction 줄) → 위·아래 채굴장(stope) → 끝 심부(보스) + 보물. */
export function planMine(spec: { size?: "small" | "medium" | "large"; width?: number; height?: number; seed?: number; layout?: "linear" | "hub" | "loop" | "vertical" }): DungeonRoomInput[] {
  const n = sized(spec), random = rng((spec.seed ?? 7) * 6151 + 5);
  // 2026-10-23 dungeon-themes: 두 광산 요청이 같은 동쪽 한 줄 갱도였다 — 배치 가족으로 뼈대를 가른다.
  //   linear = 동쪽 주 갱도 + 위아래 채굴장 · hub = 큰 갈림 방에서 사방 갱도(심부는 북쪽 끝) · loop = 위·아래 두 갱도가 동쪽 끝에서 만나는 고리(심부는 남쪽).
  const fam = spec.layout && spec.layout !== "vertical" ? spec.layout : (["linear", "hub", "loop"] as const)[Math.abs(((spec.seed ?? 7) * 2654435761) >>> 7) % 3]!;
  const L = () => 5 + Math.floor(random() * 3);
  if (fam === "hub") {
    const rooms: DungeonRoomInput[] = [
      { id: "adit", kind: "entrance", w: 11, h: 7 },
      { id: "hub", kind: "junction", w: 13, h: 9, from: "adit", dir: "E", shift: 0, len: L() },
      { id: "stopeS", kind: "stope", from: "hub", dir: "S", len: 4 },
      { id: "shaft", kind: "junction", w: 9, h: 7, from: "hub", dir: "N", shift: 0, len: 4 },
      { id: "deep", kind: "boss", w: 15, h: 10, from: "shaft", dir: "N", shift: 0, len: 4 },
    ];
    if (n >= 4) rooms.push({ id: "stopeE", kind: "stope", from: "hub", dir: "E", len: L() });
    if (n >= 6) rooms.push({ id: "vault", kind: "vault", from: "deep", dir: random() < 0.5 ? "W" : "E", len: 3 });
    if (n >= 7) rooms.push({ id: "depot", kind: "depot", from: "shaft", dir: random() < 0.5 ? "W" : "E", len: 3 });
    return rooms;
  }
  if (fam === "loop") {
    const rooms: DungeonRoomInput[] = [
      { id: "adit", kind: "entrance", w: 11, h: 7 },
      { id: "j1", kind: "junction", w: 9, h: 7, from: "adit", dir: "E", shift: 0, len: L() },
      { id: "upper", kind: "stope", from: "j1", dir: "N", len: 4 },
      { id: "j2", kind: "junction", w: 9, h: 7, from: "upper", dir: "E", shift: 0, len: L() },
      { id: "j3", kind: "junction", w: 9, h: 7, from: "j1", dir: "E", shift: 0, len: L() + 4 },
      { id: "deep", kind: "boss", w: 15, h: 10, from: "j3", dir: "S", shift: 0, len: 4 },
    ];
    if (n >= 6) rooms.push({ id: "vault", kind: "vault", from: "j2", dir: "N", len: 4 });
    if (n >= 7) rooms.push({ id: "depot", kind: "depot", from: "j3", dir: "E", len: 3 });
    return rooms;
  }
  const rooms: DungeonRoomInput[] = [
    { id: "adit", kind: "entrance", w: 11, h: 7 },
    { id: "j1", kind: "junction", w: 9, h: 7, from: "adit", dir: "E", shift: 0, len: L() },
  ];
  const spine = n >= 8 ? 3 : n >= 5 ? 2 : 1;
  for (let i = 2; i <= spine; i += 1) rooms.push({ id: `j${i}`, kind: "junction", w: 9, h: 7, from: `j${i - 1}`, dir: "E", shift: 0, len: L() });
  rooms.push({ id: "stopeN", kind: "stope", from: "j1", dir: "N", len: 4 });
  if (n >= 4) rooms.push({ id: "stopeS", kind: "stope", from: spine >= 2 ? "j2" : "j1", dir: "S", len: 4 });
  if (n >= 7) rooms.push({ id: "depot", kind: "depot", from: `j${spine}`, dir: "N", len: 4 });
  rooms.push({ id: "deep", kind: "boss", w: 15, h: 10, from: `j${spine}`, dir: "E", shift: 0, len: 5 });
  if (n >= 6) rooms.push({ id: "vault", kind: "vault", from: "deep", dir: "N", len: 4 });
  return rooms;
}
