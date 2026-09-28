// Scarloxy MPWSP01 "Monster Taming Game Essentials" 팩 리소스 등록.
//
// 원본: https://scarloxy.itch.io/mpwsp01 (CC-BY 4.0, 상업 사용 가능·출처 표기 필수)
// 변환: scripts/import-scarloxy-pack.py 가 vendor/scarloxy-mpwsp01/ 원본을
//   RM2K3 규격(타일 그림판 480x256/16px, 캐릭셋 288x256/24x32)으로 재배치해
//   public/assets/scarloxy/ 에 출력하고, 블록 배치를 scarloxyPackManifest.json 에 기록한다.
// 출처 표기: public/assets/ATTRIBUTION.md 참조.

import type { EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";
import manifestInput from "./scarloxyPackManifest.json" with { type: "json" };
import monsterTownKitInput from "./monsterTownKitManifest.json" with { type: "json" };
import monsterInteriorInput from "./monsterInteriorManifest.json" with { type: "json" };
import monsterGymCoastInput from "./monsterGymCoastManifest.json" with { type: "json" };
import monsterCaveInput from "./monsterCaveManifest.json" with { type: "json" };

type ScarloxyPackedBlock = {
  readonly name: string;
  readonly col: number;
  readonly row: number;
  readonly w: number;
  readonly h: number;
  readonly kind:
    | "terrain" | "water" | "tree" | "rock" | "deco" | "structure" | "overhead" | "indoor" | "furniture"
    // 몬스터 마을 부품(생성 자산, scripts/content/build-monster-town-kit.py)만 쓰는 종류.
    | "sign" | "shrub" | "lamp" | "tall-grass" | "fence" | "ledge" | "bridge"
    // 몬스터 실내(scripts/content/build-monster-interior.py)만 쓰는 종류.
    | "floor" | "rug" | "frame" | "wall" | "mat" | "stairs" | "wall-decor";
};

type ScarloxyPackManifest = {
  readonly backdrops: readonly string[];
  readonly monsters: readonly string[];
  readonly battleAnimations: readonly string[];
  readonly uiIcons: readonly string[];
  readonly chipsets: readonly { readonly file: string; readonly blocks: readonly ScarloxyPackedBlock[] }[];
  readonly charsets: readonly { readonly file: string; readonly characters: readonly string[] }[];
};

export const SCARLOXY_PACK_MANIFEST = manifestInput as ScarloxyPackManifest;

/**
 * 몬스터 마을 부품 — Scarloxy 화풍에 맞춰 이미지 생성 모델로 그린 **생성 자산**(팩 원본 아님).
 * 상점·연구소·동굴 입구·조우 풀숲·울타리·턱·다리·표지판 등. 같은 16px 규격이라 Scarloxy
 * 시트와 함께 배치된다. 출처 표기는 public/assets/ATTRIBUTION.md 「Generated monster town kit」.
 */
export const MONSTER_TOWN_KIT_MANIFEST = monsterTownKitInput as { readonly file: string; readonly baseRows: number; readonly blocks: readonly ScarloxyPackedBlock[] };
export const MONSTER_TOWN_KIT_TEXTURE_KEY = "tex_scarloxy_chipset_monster_town_kit";
/** 위 반쪽 = 초원 마을 시트 그대로(0~479), 아래 반쪽 = 새 부품(480~959). */
export const MONSTER_TOWN_KIT_FRAME_COUNT = 960;

/**
 * 몬스터 실내 — 회복 센터·도구 상점·주인공 집·연구소 한 장(480칸). 바닥·벽·틀은 Scarloxy 실내 원본에서
 * 뜬 색·무늬, 가구·벽 장식·계단은 Scarloxy 화풍으로 그린 **생성 자산**(팩 원본 아님).
 * 출처 표기는 public/assets/ATTRIBUTION.md 「Generated monster interior」.
 */
export const MONSTER_INTERIOR_MANIFEST = monsterInteriorInput as {
  readonly file: string;
  readonly tiles: Readonly<Record<string, number>>;
  readonly blocks: readonly ScarloxyPackedBlock[];
};
export const MONSTER_INTERIOR_TEXTURE_KEY = "tex_scarloxy_chipset_monster_interior";

/** 체육관 내부 + 해변·항구 블록. 층·통행을 블록이 직접 들고 있다(빌드 스크립트가 정본). */
export type MonsterGymCoastBlock = {
  readonly name: string;
  readonly col: number;
  readonly row: number;
  readonly w: number;
  readonly h: number;
  readonly kind: string;
  readonly layer: "lower" | "upper";
  readonly passage: "passable" | "solid";
  /** 위에서부터 이 줄 수만큼은 통행 가능(캐릭터 머리 위로 그려지는 조각상 머리·파라솔 천). */
  readonly overRows?: number;
  /** 막힘 블록 안에서 통행 가능한 칸 [dx, dy](단상 계단·해안 가운데). */
  readonly openCells?: readonly (readonly number[])[];
  readonly openPart?: "stairs" | "center";
};

/**
 * 체육관 내부 + 해변·항구 — Scarloxy 화풍에 맞춰 이미지 생성 모델로 그린 **생성 자산**(팩 원본 아님).
 * 위 480칸은 Scarloxy 사막/설원 시트 그대로(모래·바다·해안·야자·아레나 외관), 아래 480칸이 새 부품이다.
 * 빌드: scripts/content/build-monster-gym-coast.py. 출처 표기: public/assets/ATTRIBUTION.md 「Generated monster gym & coast kit」.
 */
export const MONSTER_GYM_COAST_MANIFEST = monsterGymCoastInput as { readonly file: string; readonly baseRows: number; readonly baseSheet: string; readonly blocks: readonly MonsterGymCoastBlock[] };
export const MONSTER_GYM_COAST_TEXTURE_KEY = "tex_scarloxy_chipset_monster_gym_coast";
/** 위 반쪽 = 사막/설원 시트 그대로(0~479), 아래 반쪽 = 새 부품(480~959). */
export const MONSTER_GYM_COAST_FRAME_COUNT = 960;

/** 동굴 칩셋 블록. passable: "all" | "none" | 통행 가능한 칸의 [dx, dy] 목록(나머지 막힘). */
export type MonsterCaveBlock = {
  readonly name: string;
  readonly col: number;
  readonly row: number;
  readonly w: number;
  readonly h: number;
  readonly kind: string;
  readonly layer: "lower" | "upper";
  readonly passable: "all" | "none" | readonly (readonly [number, number])[];
};

/**
 * 몬스터 동굴 — Scarloxy 화풍에 맞춰 이미지 생성 모델로 그린 **생성 자산**(팩 원본 아님).
 * 480칸 한 장: 바위 벽·고지대·물·자갈 47칸 블롭 네 세트, 절벽 앞면, 사다리·계단·굴, 석순·바위 소품.
 * 원본 scripts/content/build-monster-cave.py. 출처 표기는 public/assets/ATTRIBUTION.md 「Generated monster cave」.
 */
export const MONSTER_CAVE_MANIFEST = monsterCaveInput as unknown as {
  readonly file: string;
  readonly blobMaskBits: Readonly<Record<"N" | "E" | "S" | "W" | "NE" | "SE" | "SW" | "NW", number>>;
  /** 47 블롭 세트: 대표 마스크(10진 문자열) → 칸 번호. */
  readonly blobs: Readonly<Record<"wall" | "high" | "water" | "gravel", { readonly col: number; readonly row: number; readonly masks: Readonly<Record<string, number>> }>>;
  readonly blocks: readonly MonsterCaveBlock[];
};
export const MONSTER_CAVE_TEXTURE_KEY = "tex_scarloxy_chipset_monster_cave";
export const MONSTER_CAVE_FRAME_COUNT = 480;

const ASSET_DIR = "assets/scarloxy";

// bundled.ts 의 BundledImageAsset 과 구조 동일(순환 import 방지를 위해 구조 타이핑).
type ScarloxyBundledAsset = { readonly textureKey: string; readonly path: string; readonly name: string };

export const SCARLOXY_CHIPSET_ASSETS = [
  { textureKey: "tex_scarloxy_chipset_grassland", path: `${ASSET_DIR}/scarloxy-chipset-grassland.png`, name: "Scarloxy 초원 마을 ChipSet" },
  { textureKey: "tex_scarloxy_chipset_wilds", path: `${ASSET_DIR}/scarloxy-chipset-wilds.png`, name: "Scarloxy 사막/설원 ChipSet" },
  { textureKey: "tex_scarloxy_chipset_indoor", path: `${ASSET_DIR}/scarloxy-chipset-indoor.png`, name: "Scarloxy 실내 ChipSet" },
  // 텍스처 키 접두어를 tex_scarloxy_chipset_ 로 맞춰 화풍 분류·테마 팩·생성 프로필을 그대로 탄다.
  { textureKey: MONSTER_TOWN_KIT_TEXTURE_KEY, path: "assets/monster-town-kit/monster-town-kit.png", name: "Scarloxy 초원 마을 + 몬스터 마을 부품 (480~ 생성 자산)" },
  { textureKey: MONSTER_INTERIOR_TEXTURE_KEY, path: "assets/monster-interior/monster-interior.png", name: "Scarloxy 몬스터 실내 · 회복 센터·상점·집·연구소 (가구는 생성 자산)" },
  { textureKey: MONSTER_GYM_COAST_TEXTURE_KEY, path: "assets/monster-gym-coast/monster-gym-coast.png", name: "Scarloxy 사막/해안 + 체육관·항구 부품 (480~ 생성 자산)" },
  { textureKey: MONSTER_CAVE_TEXTURE_KEY, path: "assets/monster-cave/monster-cave.png", name: "Scarloxy 몬스터 동굴 (생성 자산)" },
] as const satisfies readonly ScarloxyBundledAsset[];

export const SCARLOXY_CHARSET_ASSETS = [
  {
    category: "charset",
    id: "scarloxy-charset-people1",
    name: "Scarloxy People1 CharSet",
    sourcePath: "MPWSP01/characters",
    path: `${ASSET_DIR}/scarloxy-charset-people1.png`,
    fileName: "scarloxy-charset-people1.png",
    textureKey: "tex_scarloxy_charset_people1",
    group: "Scarloxy",
  },
  {
    category: "charset",
    id: "scarloxy-charset-people2",
    name: "Scarloxy People2 CharSet",
    sourcePath: "MPWSP01/characters",
    path: `${ASSET_DIR}/scarloxy-charset-people2.png`,
    fileName: "scarloxy-charset-people2.png",
    textureKey: "tex_scarloxy_charset_people2",
    group: "Scarloxy",
  },
] as const satisfies readonly EasyRpgCharsetAsset[];

export type ScarloxyResourceAsset = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly tags: readonly string[];
};

const MONSTER_LABELS: Record<string, { readonly name: string; readonly tags: readonly string[] }> = {
  atrox: { name: "Atrox", tags: ["몬스터", "불", "화염", "도마뱀"] },
  charmadillo: { name: "Charmadillo", tags: ["몬스터", "불", "아르마딜로", "갑옷"] },
  cindrill: { name: "Cindrill", tags: ["몬스터", "불", "두더지", "드릴"] },
  cleaf: { name: "Cleaf", tags: ["몬스터", "풀", "잎", "사마귀"] },
  // 팩 원본이 아닌 생성 자산(2026-08-30, grok 이미지 생성 → 96px 변환). 출처 표기 대상이 다르다.
  emberkit: { name: "Emberkit", tags: ["몬스터", "불", "여우", "생성 자산"] },
  draem: { name: "Draem", tags: ["몬스터", "풀", "유령", "꿈"] },
  finiette: { name: "Finiette", tags: ["몬스터", "물", "물고기", "우아함"] },
  finsta: { name: "Finsta", tags: ["몬스터", "물", "물고기", "작음"] },
  friolera: { name: "Friolera", tags: ["몬스터", "물", "얼음", "유령"] },
  gulfin: { name: "Gulfin", tags: ["몬스터", "물", "상어", "지느러미"] },
  ivieron: { name: "Ivieron", tags: ["몬스터", "풀", "덩굴", "새"] },
  jacana: { name: "Jacana", tags: ["몬스터", "물", "물새", "새"] },
  larvea: { name: "Larvea", tags: ["몬스터", "풀", "애벌레", "벌레"] },
  mossling: { name: "Mossling", tags: ["몬스터", "풀", "고슴도치", "이끼", "생성 자산"] },
  pluma: { name: "Pluma", tags: ["몬스터", "풀", "새", "깃털"] },
  plumette: { name: "Plumette", tags: ["몬스터", "풀", "새", "병아리"] },
  pouch: { name: "Pouch", tags: ["몬스터", "물", "펠리컨", "주머니"] },
  puddlup: { name: "Puddlup", tags: ["몬스터", "물", "올챙이", "물방울", "생성 자산"] },
  sparchu: { name: "Sparchu", tags: ["몬스터", "불", "불씨", "아기"] },
  // 도감 확장 11종(2026-09-28, 생성 자산). 종 데이터: src/project/defaults/scarloxyExtraSpecies.ts.
  pebblit: { name: "자갈콩", tags: ["몬스터", "바위", "땅", "돌", "생성 자산"] },
  bouldurr: { name: "바위곰", tags: ["몬스터", "바위", "땅", "곰", "생성 자산"] },
  zaplet: { name: "찌릿냥", tags: ["몬스터", "전기", "살쾡이", "아기", "생성 자산"] },
  voltail: { name: "번개꼬리", tags: ["몬스터", "전기", "살쾡이", "생성 자산"] },
  wispin: { name: "안개령", tags: ["몬스터", "고스트", "혼불", "생성 자산"] },
  lanterghast: { name: "등롱귀", tags: ["몬스터", "고스트", "불", "등롱", "생성 자산"] },
  hornbeet: { name: "뿔장수", tags: ["몬스터", "벌레", "격투", "풍뎅이", "생성 자산"] },
  toxtoad: { name: "독두꺼", tags: ["몬스터", "독", "두꺼비", "생성 자산"] },
  brawlape: { name: "주먹숭이", tags: ["몬스터", "격투", "원숭이", "생성 자산"] },
  frostpip: { name: "서리펭", tags: ["몬스터", "얼음", "펭귄", "생성 자산"] },
  sandscorp: { name: "모래전갈", tags: ["몬스터", "땅", "독", "전갈", "생성 자산"] },
};

/**
 * 도감 확장 — 팩 매니페스트(import-scarloxy-pack.py 가 만든다) 밖에서 더한 몬스터 11종.
 * 그림은 scripts/content/build-scarloxy-monster-roster.py 가 tiledata/pkmn-monsters/raw 에서 만든다.
 */
export const SCARLOXY_EXTRA_MONSTER_KEYS = [
  "pebblit", "bouldurr", "zaplet", "voltail", "wispin", "lanterghast",
  "hornbeet", "toxtoad", "brawlape", "frostpip", "sandscorp",
] as const;

/** 정면·뒷모습·아이콘·울음이 모두 있는 몬스터 키 30개(팩 19 + 확장 11). */
export const SCARLOXY_ALL_MONSTER_KEYS: readonly string[] = [...SCARLOXY_PACK_MANIFEST.monsters, ...SCARLOXY_EXTRA_MONSTER_KEYS];

export const SCARLOXY_MONSTER_ASSETS: readonly ScarloxyResourceAsset[] = [
  ...SCARLOXY_ALL_MONSTER_KEYS.map((key) => ({
    id: `scarloxy-monster-${key}`,
    name: `${MONSTER_LABELS[key]?.name ?? key} (Scarloxy)`,
    path: `${ASSET_DIR}/scarloxy-monster-${key}.png`,
    tags: MONSTER_LABELS[key]?.tags ?? ["몬스터"],
  })),
  // 뒷모습(후면 전투용). MonsterSpeciesGraphic.backResourceId 로 지정한다. 포켓몬 스킨은 저작된
  // 뒷모습을 반전하지 않으므로(20-pokemon-skin.css authored-back) 그림 자체가 우상단 적을 본다.
  // 전부 생성 자산이다 — 팩 원본에는 뒷모습이 없다(ATTRIBUTION.md 「Generated monster roster expansion」).
  ...SCARLOXY_ALL_MONSTER_KEYS.map((key) => ({
    id: `scarloxy-monster-${key}-back`,
    name: `${MONSTER_LABELS[key]?.name ?? key} 뒷모습 (Scarloxy)`,
    path: `${ASSET_DIR}/scarloxy-monster-${key}-back.png`,
    tags: ["뒷모습", "후면", "내 편", "생성 자산", ...(MONSTER_LABELS[key]?.tags ?? ["몬스터"])],
  })),
];

export const SCARLOXY_MONSTER_ICON_ASSETS: readonly ScarloxyResourceAsset[] = SCARLOXY_ALL_MONSTER_KEYS.map((key) => ({
  id: `scarloxy-monster-icon-${key}`,
  name: `${MONSTER_LABELS[key]?.name ?? key} 아이콘 (Scarloxy)`,
  path: `${ASSET_DIR}/scarloxy-monster-icon-${key}.png`,
  tags: ["아이콘", ...(MONSTER_LABELS[key]?.tags ?? [])],
}));

/**
 * 몬스터 울음소리 30개 — scripts/content/synth-scarloxy-cries.py 가 코드로 합성한 짧은 WAV(샘플 없음).
 * 리소스 해석기(resolveScarloxyAssetUrl)와 참조 검증(SCARLOXY_RESOURCE_IDS)에 실려 playSoundEffect 로 재생된다.
 */
export const SCARLOXY_CRY_ASSETS: readonly ScarloxyResourceAsset[] = SCARLOXY_ALL_MONSTER_KEYS.map((key) => ({
  id: `scarloxy-cry-${key}`,
  name: `${MONSTER_LABELS[key]?.name ?? key} 울음소리`,
  path: `${ASSET_DIR}/cries/scarloxy-cry-${key}.wav`,
  tags: ["효과음", "울음소리", "몬스터 · 음성", ...(MONSTER_LABELS[key]?.tags ?? [])],
}));

const BACKDROP_LABELS: Record<string, { readonly name: string; readonly tags: readonly string[] }> = {
  forest: { name: "숲 전투 배경 (Scarloxy)", tags: ["전투 배경", "숲", "초원", "나무"] },
  ice: { name: "설원 전투 배경 (Scarloxy)", tags: ["전투 배경", "설원", "얼음", "눈"] },
  sand: { name: "사막 전투 배경 (Scarloxy)", tags: ["전투 배경", "사막", "모래"] },
  // 생성 자산 4장(2026-09-28). 팩 원본이 아니다.
  cave: { name: "동굴 전투 배경 (생성)", tags: ["전투 배경", "동굴", "바위", "생성 자산"] },
  gym: { name: "체육관 전투 배경 (생성)", tags: ["전투 배경", "체육관", "실내", "생성 자산"] },
  beach: { name: "해변 전투 배경 (생성)", tags: ["전투 배경", "해변", "바다", "모래", "생성 자산"] },
  route: { name: "풀밭 길 전투 배경 (생성)", tags: ["전투 배경", "초원", "풀숲", "길", "생성 자산"] },
};

/** 팩 밖에서 더한 전투 배경(640x360). scripts/content/build-scarloxy-monster-roster.py 가 만든다. */
export const SCARLOXY_EXTRA_BACKDROP_KEYS = ["cave", "gym", "beach", "route"] as const;

export const SCARLOXY_BACKDROP_ASSETS: readonly ScarloxyResourceAsset[] = [...SCARLOXY_PACK_MANIFEST.backdrops, ...SCARLOXY_EXTRA_BACKDROP_KEYS].map((key) => ({
  id: `scarloxy-backdrop-${key}`,
  name: BACKDROP_LABELS[key]?.name ?? `Scarloxy ${key} 배경`,
  path: `${ASSET_DIR}/scarloxy-backdrop-${key}.png`,
  tags: BACKDROP_LABELS[key]?.tags ?? ["전투 배경"],
}));

const BATTLE_ANIMATION_LABELS: Record<string, string> = {
  explosion: "폭발",
  fire: "화염",
  green: "풀잎",
  ice: "얼음",
  scratch: "할퀴기",
  splash: "물보라",
};

export const SCARLOXY_BATTLE_ANIMATION_ASSETS: readonly ScarloxyResourceAsset[] = SCARLOXY_PACK_MANIFEST.battleAnimations.map((key) => ({
  id: `scarloxy-battle-anim-${key}`,
  name: `${BATTLE_ANIMATION_LABELS[key] ?? key} 이펙트 (Scarloxy)`,
  path: `${ASSET_DIR}/scarloxy-battle-anim-${key}.png`,
  tags: ["전투 이펙트", BATTLE_ANIMATION_LABELS[key] ?? key],
}));

// Scarloxy 전투 이펙트 시트 규격: 96x96 프레임 4장 가로 스트립(384x96).
export const SCARLOXY_BATTLE_ANIMATION_SHEET = { frameWidth: 96, frameHeight: 96, columns: 4 } as const;

const UI_ICON_LABELS: Record<string, string> = {
  attack: "공격",
  defense: "방어",
  energy: "기력",
  health: "체력",
  recovery: "회복",
  speed: "속도",
  star: "별",
};

export const SCARLOXY_UI_ICON_ASSETS: readonly ScarloxyResourceAsset[] = SCARLOXY_PACK_MANIFEST.uiIcons.map((key) => ({
  id: `scarloxy-ui-${key}`,
  name: `${UI_ICON_LABELS[key] ?? key} 아이콘 (Scarloxy)`,
  path: `${ASSET_DIR}/scarloxy-ui-${key}.png`,
  tags: ["아이콘", "스탯", UI_ICON_LABELS[key] ?? key],
}));

const ALL_RESOLVABLE_ASSETS: readonly ScarloxyResourceAsset[] = [
  ...SCARLOXY_MONSTER_ASSETS,
  ...SCARLOXY_MONSTER_ICON_ASSETS,
  ...SCARLOXY_CRY_ASSETS,
  ...SCARLOXY_BACKDROP_ASSETS,
  ...SCARLOXY_BATTLE_ANIMATION_ASSETS,
  ...SCARLOXY_UI_ICON_ASSETS,
];

// 프로젝트 직렬화 참조 검증(collectResourceIds)에 등록할 전체 리소스 ID 목록.
export const SCARLOXY_RESOURCE_IDS: readonly string[] = [
  ...ALL_RESOLVABLE_ASSETS.map((asset) => asset.id),
  ...SCARLOXY_CHARSET_ASSETS.flatMap((asset) => [asset.id, asset.textureKey]),
  ...SCARLOXY_CHIPSET_ASSETS.map((asset) => asset.textureKey),
];

export function resolveScarloxyAssetUrl(resourceId: string): string | null {
  const direct = ALL_RESOLVABLE_ASSETS.find((asset) => asset.id === resourceId);
  if (direct) return `/${direct.path}`;
  const charset = SCARLOXY_CHARSET_ASSETS.find((asset) => asset.id === resourceId || asset.textureKey === resourceId);
  if (charset) return `/${charset.path}`;
  const chipset = SCARLOXY_CHIPSET_ASSETS.find((asset) => asset.textureKey === resourceId);
  if (chipset) return `/${chipset.path}`;
  return null;
}

// ---------------------------------------------------------------------------
// 타일 그림판 타일 메타데이터 시드 (tilesetHarness/themePacks.ts 가 소비)
// ---------------------------------------------------------------------------

export type ScarloxyChipsetGroupSeed = {
  readonly key: string;
  readonly name: string;
  // wall = 몬스터 실내의 벽·틀(TileGroupRole 부분집합, themePacks.packGroup 이 그대로 받는다).
  readonly role: "terrain" | "water" | "building" | "prop" | "wall";
  readonly defaultLayer: "lower" | "upper";
  readonly passage: "passable" | "solid";
  readonly repeatability: "repeat" | "fixed";
  readonly tileIds: readonly number[];
  readonly description: string;
};

const SHEET_COLUMNS = 30;

const TERRAIN_BLOCK_LABELS: Record<string, { readonly name: string; readonly description: string }> = {
  "grass-terrain": { name: "초원 지형", description: "잔디밭·모래 패치·절벽 링이 포함된 초원 지형입니다. 절벽 타일은 타일 메타데이터 도구로 통행 불가로 조정하세요." },
  "sand-terrain": { name: "사막 지형", description: "사막 모래밭·풀 패치·절벽 링 지형입니다. 절벽 타일은 통행 설정을 조정하세요." },
  "ice-terrain": { name: "설원 지형", description: "설원 눈밭·풀 패치·절벽 링 지형입니다. 절벽 타일은 통행 설정을 조정하세요." },
  "indoor-all": { name: "실내 타일", description: "실내 벽 프레임·바닥·창문·계단 단상 타일입니다. 벽 타일은 통행 불가로 조정해 사용하세요." },
};

/**
 * 실내 가구 블록 라벨. `furniture` 는 **블록 이름별로 그룹이 갈린다** — structure/rock 처럼 한
 * 그룹으로 뭉치면 AI 배치 툴이 "침대"와 "소파"를 구분해 집을 수 없다.
 *
 * 실측 근거(2026-08-30): 실내 치프셋은 블록이 `indoor-all` 하나뿐이어서 침대·소파·모니터·창문이
 * 전부 "실내 타일" 한 그룹, role=terrain, 통행 가능으로 노출됐다. 의미 단위가 없으니 실내 저작
 * 요청이 들어와도 모델이 집을 어휘가 없었다.
 */
const FURNITURE_BLOCK_LABELS: Record<string, { readonly name: string; readonly description: string }> = {
  "bed-mint": { name: "민트 침대", description: "민트 이불 1인용 침대입니다. 상층에 블록 단위로 놓고 통행을 막습니다." },
  "bed-lavender": { name: "라벤더 침대", description: "라벤더 이불 1인용 침대입니다. 상층에 블록 단위로 놓고 통행을 막습니다." },
  "sofa-yellow": { name: "노란 소파", description: "3인용 노란 소파입니다. 거실·로비 좌석으로 씁니다. 통행 불가." },
  "sofa-mint": { name: "민트 소파", description: "3인용 민트 소파입니다. 거실·로비 좌석으로 씁니다. 통행 불가." },
  "counter-wood": { name: "나무 카운터", description: "나무 상판 카운터/작업대입니다. 접수대·주방대로 씁니다. 통행 불가." },
  "wall-window": { name: "창문 벽", description: "창문이 달린 실내 벽면입니다. 벽 라인에 붙여 씁니다. 통행 불가." },
  "cabinet-white": { name: "흰 수납장", description: "문이 두 짝인 흰 수납장입니다. 벽에 붙여 씁니다. 통행 불가." },
  "wall-screen": { name: "모니터 벽", description: "모니터가 걸린 실내 벽면입니다. 진료실·연구소 벽에 씁니다. 통행 불가." },
};

function blockTileIds(block: ScarloxyPackedBlock, rowOffset = 0, rowCount?: number): number[] {
  const ids: number[] = [];
  const startRow = block.row + rowOffset;
  const endRow = rowCount === undefined ? block.row + block.h : Math.min(startRow + rowCount, block.row + block.h);
  for (let row = startRow; row < endRow; row += 1) {
    for (let col = block.col; col < block.col + block.w; col += 1) {
      ids.push(row * SHEET_COLUMNS + col);
    }
  }
  return ids;
}

/**
 * 몬스터 마을 부품 블록 라벨. 블록마다 그룹 하나 — 「상점만 놓아라」「풀숲을 깔아라」를
 * 도구 수준에서 이름으로 집을 수 있게 한다. 조우는 타일이 아니라 사냥터/조우표로 배선한다.
 * 한 방향 턱(뛰어내리기)은 통행 가능으로 두고, 그 칸에 밟으면 아래로 점프시키는 playerTouch
 * 이벤트를 얹는다(선례: 포켓몬풍 데모 「초원 1번 길」 ledgeEvent). 막힘으로 두면 이벤트를 밟을 수 없다.
 * 모든 조각은 가장자리가 투명하다(풀숲도 칸의 약 88%만 칠해져 있다). 하위에 깔면 투명 픽셀
 * 아래가 검게 보이므로 전부 상위(3층)에 두어 아래 잔디를 보존한다 — openwiki/tile-layer-policy.md.
 */
const MONSTER_TOWN_KIT_LABELS: Record<string, { readonly name: string; readonly role: ScarloxyChipsetGroupSeed["role"]; readonly passage: ScarloxyChipsetGroupSeed["passage"]; readonly repeat?: boolean; readonly description: string }> = {
  "item-shop": { name: "도구 상점", role: "building", passage: "solid", description: "파란 지붕 도구 상점(6×6)입니다. 가운데 유리문 칸 아래에 입구 이벤트를 둡니다. 통행 불가." },
  "research-lab": { name: "연구소", role: "building", passage: "solid", description: "위성 안테나가 달린 흰 연구소(8×6)입니다. 박사 스타터 이벤트용. 가운데 유리문 아래가 입구입니다. 통행 불가." },
  "cave-entrance": { name: "동굴 입구", role: "building", passage: "solid", description: "갈색 바위 더미 동굴 입구(5×4)입니다. 맨 아래 가운데 검은 구멍 칸에 장소 이동 이벤트를 둡니다." },
  signpost: { name: "나무 표지판", role: "prop", passage: "solid", description: "빈 나무 표지판(1×1)입니다. 조사 이벤트로 글을 붙입니다. 통행 불가." },
  mailbox: { name: "빨간 우체통", role: "prop", passage: "solid", description: "집 앞 우체통(1×1)입니다. 통행 불가." },
  "cuttable-shrub": { name: "베는 나무", role: "prop", passage: "solid", description: "길을 막는 작은 둥근 나무(1×1)입니다. 기술로 베어 없애는 장애물 이벤트 그래픽으로 씁니다." },
  boulder: { name: "밀 수 있는 바위", role: "prop", passage: "solid", description: "회색 큰 바위(1×1)입니다. 힘 기술로 미는 퍼즐 이벤트 그래픽으로 씁니다. 통행 불가." },
  crate: { name: "나무 상자", role: "prop", passage: "solid", description: "나무 상자(1×1)입니다. 통행 불가." },
  "flower-planter": { name: "꽃 화단", role: "prop", passage: "solid", description: "빨강·노랑 꽃 나무 화단(2×1)입니다. 통행 불가." },
  bench: { name: "흰 벤치", role: "prop", passage: "solid", description: "흰 공원 벤치(2×1)입니다. 광장·센터 앞에 둡니다. 통행 불가." },
  "street-lamp": { name: "가로등", role: "prop", passage: "solid", description: "가로등(1×2)입니다. 위 칸은 캐릭터 머리 위로 그려집니다. 통행 불가." },
  "tall-grass-a": { name: "조우 풀숲", role: "prop", passage: "passable", repeat: true, description: "야생 몬스터가 나오는 키 큰 풀숲(1×1)입니다. 잔디 위 상위 레이어에 이어 깔고, 두 변형을 섞어 반복을 숨깁니다. 조우는 사냥터/조우표로 배선합니다." },
  "tall-grass-b": { name: "조우 풀숲", role: "prop", passage: "passable", repeat: true, description: "조우 풀숲 두 번째 변형입니다." },
  "picket-fence": { name: "흰 울타리", role: "prop", passage: "solid", repeat: true, description: "흰 나무 울타리(2×1)입니다. 가로로 이어 붙여 길 가장자리를 막습니다. 통행 불가." },
  "fence-post": { name: "울타리 기둥", role: "prop", passage: "solid", description: "울타리 끝 기둥(1×1)입니다. 통행 불가." },
  "grass-ledge": { name: "풀밭 턱", role: "prop", passage: "passable", repeat: true, description: "아래쪽이 흙 절벽으로 끝나는 풀밭 턱(3×1)입니다. 길 사이 단차에 가로로 잇습니다. 각 칸에 밟으면 아래로 두 칸 점프하는 playerTouch 이벤트를 얹어 한 방향 뛰어내리기를 만듭니다." },
  "plank-bridge": { name: "나무 다리", role: "prop", passage: "passable", repeat: true, description: "위에서 본 나무 판자 다리(2×1)입니다. 물 위 상위 레이어에 가로로 이어 깝니다." },
};

function monsterTownKitGroupSeeds(): readonly ScarloxyChipsetGroupSeed[] {
  const byKey = new Map<string, ScarloxyChipsetGroupSeed>();
  for (const block of MONSTER_TOWN_KIT_MANIFEST.blocks) {
    const label = MONSTER_TOWN_KIT_LABELS[block.name];
    if (!label) continue;
    // 두 풀숲 변형은 한 그룹으로 묶는다(배치 도구가 두 칸을 섞어 쓴다).
    const key = block.kind === "tall-grass" ? "tall-grass" : block.name;
    const tileIds = blockTileIds(block);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, { ...existing, tileIds: [...existing.tileIds, ...tileIds] });
      continue;
    }
    byKey.set(key, {
      key,
      name: label.name,
      role: label.role,
      defaultLayer: "upper",
      passage: label.passage,
      repeatability: label.repeat ? "repeat" : "fixed",
      tileIds,
      description: label.description,
    });
  }
  return [...byKey.values()];
}


/**
 * 몬스터 실내 블록 라벨. 블록마다 그룹 하나(벽 틀·안쪽 모서리는 한 그룹, 문 매트는 바닥별 한 그룹).
 * 층 규칙(openwiki/tile-layer-policy.md):
 * - 바닥·깔개·문 매트·계단·벽·틀은 칸을 꽉 채운 불투명 칸 → 1층(lower).
 * - 문 매트·계단은 밟는 칸이다. 3층 통행 가능(★) 칸은 캐릭터 위에 그려지므로(player/characterDepth.ts)
 *   반드시 1층에 두고, 그래서 빌드 스크립트가 바닥을 미리 합성해 둔다.
 * - 가구·벽 장식은 가장자리가 투명 → 3층(upper), 통행 불가. 1층에 두면 투명 픽셀 아래가 검게 보인다.
 */
type MonsterInteriorLabel = {
  readonly name: string;
  readonly role: ScarloxyChipsetGroupSeed["role"];
  readonly layer: ScarloxyChipsetGroupSeed["defaultLayer"];
  readonly passage: ScarloxyChipsetGroupSeed["passage"];
  readonly repeat?: boolean;
  readonly group?: string;
  readonly description: string;
};
const MONSTER_INTERIOR_LABELS: Record<string, MonsterInteriorLabel> = {
  "floor-wood": { name: "나무 마루", role: "terrain", layer: "lower", passage: "passable", repeat: true, description: "Scarloxy 원본의 나무 마루(1칸 반복)입니다. 주인공 집 바닥." },
  "floor-tile": { name: "흰 타일", role: "terrain", layer: "lower", passage: "passable", repeat: true, description: "Scarloxy 원본의 흰 타일(1칸 반복)입니다. 회복 센터·상점·연구소 바닥." },
  "floor-carpet-red": { name: "빨간 카펫", role: "terrain", layer: "lower", passage: "passable", repeat: true, description: "무늬 없는 빨간 카펫(1칸 반복)입니다. 방 전체 바닥으로 깝니다." },
  "floor-carpet-teal": { name: "청록 카펫", role: "terrain", layer: "lower", passage: "passable", repeat: true, description: "무늬 없는 청록 카펫(1칸 반복)입니다." },
  "rug-red": { name: "빨간 깔개", role: "terrain", layer: "lower", passage: "passable", description: "테두리 있는 빨간 깔개 3×3입니다. 바닥 위를 1층으로 덮어씁니다. 가운데 칸을 반복하면 더 커집니다." },
  "rug-teal": { name: "청록 깔개", role: "terrain", layer: "lower", passage: "passable", description: "테두리 있는 청록 깔개 3×3입니다. 회복 센터 로비에 씁니다." },
  "wall-frame": { name: "실내 벽 틀", role: "wall", layer: "lower", passage: "solid", repeat: true, group: "wall-frame", description: "방을 두르는 검은 틀(흰 띠 3px)입니다. 3×3: 바깥 모서리 네 칸, 변 네 칸(띠가 방 쪽), 가운데 천장. 통행 불가." },
  "wall-frame-inner": { name: "실내 벽 틀", role: "wall", layer: "lower", passage: "solid", group: "wall-frame", description: "안쪽 모서리 2×2(ㄱ자 방·칸막이 끝)입니다." },
  "wall-mint": { name: "민트 벽", role: "wall", layer: "lower", passage: "solid", repeat: true, description: "Scarloxy 민트 벽 앞면 2줄(윗줄·걸레받이 줄)입니다. 북쪽 틀 바로 아래 두 줄에 가로로 반복합니다. 통행 불가." },
  "wall-lavender": { name: "라벤더 벽", role: "wall", layer: "lower", passage: "solid", repeat: true, description: "Scarloxy 라벤더 벽 앞면 2줄입니다. 통행 불가." },
  "wall-cream": { name: "크림 벽", role: "wall", layer: "lower", passage: "solid", repeat: true, description: "크림 벽 앞면 2줄입니다. 집·상점용. 통행 불가." },
  "door-mat-wood": { name: "문 매트(마루)", role: "terrain", layer: "lower", passage: "passable", group: "door-mat-wood", description: "마루 위 초록 문 매트(1칸)입니다. 출입구 칸의 1층에 두고 밟기 장소 이동 이벤트를 얹습니다." },
  "door-mat-wide-wood": { name: "문 매트(마루)", role: "terrain", layer: "lower", passage: "passable", group: "door-mat-wood", description: "마루 위 두 칸 문 매트(왼·오)입니다." },
  "door-mat-tile": { name: "문 매트(타일)", role: "terrain", layer: "lower", passage: "passable", group: "door-mat-tile", description: "흰 타일 위 초록 문 매트(1칸)입니다. 출입구 칸의 1층에 두고 밟기 장소 이동 이벤트를 얹습니다." },
  "door-mat-wide-tile": { name: "문 매트(타일)", role: "terrain", layer: "lower", passage: "passable", group: "door-mat-tile", description: "흰 타일 위 두 칸 문 매트(왼·오)입니다." },
  "stairs-up": { name: "올라가는 계단", role: "terrain", layer: "lower", passage: "passable", description: "나무 계단 2×2(위로)입니다. 1층에 두고 윗줄 칸에 밟기 장소 이동 이벤트를 둡니다." },
  "stairs-down": { name: "내려가는 계단", role: "terrain", layer: "lower", passage: "passable", description: "바닥 구멍 계단 2×2(아래로)입니다. 1층에 두고 칸에 밟기 장소 이동 이벤트를 둡니다." },
  "wall-window": { name: "커튼 창문", role: "prop", layer: "upper", passage: "solid", description: "커튼 달린 창문 2×2입니다. 벽 두 줄(y=1~2) 위 3층에 겁니다." },
  "wall-clock": { name: "벽시계", role: "prop", layer: "upper", passage: "solid", description: "둥근 벽시계 1×1입니다. 벽 윗줄 위 3층." },
  "wall-poster": { name: "몬스터 포스터", role: "prop", layer: "upper", passage: "solid", description: "몬스터 그림 액자 1×1입니다. 벽 윗줄 위 3층." },
  whiteboard: { name: "화이트보드", role: "prop", layer: "upper", passage: "solid", description: "연구소 화이트보드 2×2입니다. 벽 두 줄 위 3층." },
  "reception-counter": { name: "접수 카운터", role: "prop", layer: "upper", passage: "solid", description: "회복 센터 접수 카운터 5×2(빨간 십자)입니다. 뒤에 접수원, 아랫줄 가운데 칸에 회복 조사 이벤트. 통행 불가." },
  "healing-machine": { name: "회복 기계", role: "prop", layer: "upper", passage: "solid", description: "볼 여섯 개를 올리는 회복 기계 2×2입니다. 카운터 뒤 벽에 붙입니다. 통행 불가." },
  "pc-terminal": { name: "PC 단말", role: "prop", layer: "upper", passage: "solid", description: "몬스터 보관함 PC 1×2입니다. 아랫칸 앞에서 조사 이벤트. 통행 불가." },
  "lobby-bench": { name: "로비 의자", role: "prop", layer: "upper", passage: "solid", description: "3인 로비 의자 3×2입니다. 통행 불가." },
  "potted-plant": { name: "화분", role: "prop", layer: "upper", passage: "solid", description: "큰 화분 1×2입니다. 모서리 장식. 통행 불가." },
  "shelf-wall": { name: "벽 진열대", role: "prop", layer: "upper", passage: "solid", description: "상점 벽 진열대 3×2입니다. 벽에 붙입니다(Y=3). 통행 불가." },
  "shelf-island": { name: "가운데 진열대", role: "prop", layer: "upper", passage: "solid", description: "통로 사이 낮은 진열대 2×2입니다. 통행 불가." },
  "shop-counter": { name: "계산대", role: "prop", layer: "upper", passage: "solid", description: "상점 계산대 3×2(금전등록기)입니다. 뒤에 점원, 아랫줄 가운데 칸에 상점 이벤트. 통행 불가." },
  "drink-cooler": { name: "음료 냉장고", role: "prop", layer: "upper", passage: "solid", description: "유리문 냉장고 2×2입니다. 벽에 붙입니다. 통행 불가." },
  bed: { name: "침대", role: "prop", layer: "upper", passage: "solid", description: "1인용 민트 침대 2×3입니다. 조사 = 잠자기 회복. 통행 불가." },
  "tv-set": { name: "TV", role: "prop", layer: "upper", passage: "solid", description: "TV와 게임기 2×2입니다. 통행 불가." },
  "dining-table": { name: "식탁", role: "prop", layer: "upper", passage: "solid", description: "식탁 3×2입니다. 위·아래에 의자. 통행 불가." },
  "chair-down": { name: "의자(아래 보기)", role: "prop", layer: "upper", passage: "solid", description: "식탁 윗줄 바로 위에 놓는 의자 1×1입니다. 통행 불가." },
  "chair-up": { name: "의자(위 보기)", role: "prop", layer: "upper", passage: "solid", description: "식탁 아랫줄 바로 아래에 놓는 의자 1×1입니다. 통행 불가." },
  "kitchen-counter": { name: "부엌 조리대", role: "prop", layer: "upper", passage: "solid", description: "개수대·가스레인지 조리대 3×2입니다. 벽에 붙입니다. 통행 불가." },
  bookshelf: { name: "책장", role: "prop", layer: "upper", passage: "solid", description: "연구소 책장 2×2입니다. 벽에 붙입니다. 통행 불가." },
  "lab-bench": { name: "실험대", role: "prop", layer: "upper", passage: "solid", description: "현미경·시험관 실험대 3×2입니다. 통행 불가." },
  "starter-stand": { name: "스타터 볼 받침대", role: "prop", layer: "upper", passage: "solid", description: "스타터 볼 셋(왼쪽부터 풀·불·물) 받침대 3×2입니다. 아랫줄 칸마다 스타터 선택 조사 이벤트. 통행 불가." },
  "lab-computer": { name: "연구 컴퓨터", role: "prop", layer: "upper", passage: "solid", description: "모니터 달린 서버 2×2입니다. 통행 불가." },
};

function monsterInteriorGroupSeeds(): readonly ScarloxyChipsetGroupSeed[] {
  const byKey = new Map<string, ScarloxyChipsetGroupSeed>();
  for (const block of MONSTER_INTERIOR_MANIFEST.blocks) {
    const label = MONSTER_INTERIOR_LABELS[block.name];
    if (!label) continue;
    const key = label.group ?? block.name;
    const tileIds = blockTileIds(block);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, { ...existing, tileIds: [...existing.tileIds, ...tileIds] });
      continue;
    }
    byKey.set(key, {
      key,
      name: label.name,
      role: label.role,
      defaultLayer: label.layer,
      passage: label.passage,
      repeatability: label.repeat ? "repeat" : "fixed",
      tileIds,
      description: label.description,
    });
  }
  return [...byKey.values()];
}

/**
 * 체육관·해변 블록 라벨. 블록 하나가 그룹 하나다(바닥 A·B 변형은 한 그룹 안에 둘 다 든다).
 * 조각상·파라솔처럼 위 줄이 머리 위로 그려지는 블록은 「… 머리」 통행 가능 그룹을 따로 만든다 —
 * 그룹 하나는 통행값 하나라서, 한 그룹에 섞으면 머리 칸이 벽이 된다(나무 수관·밑동과 같은 이유).
 * 단상 계단 칸도 같은 이유로 「… 계단」 그룹이 따로 있다.
 */
const MONSTER_GYM_COAST_LABELS: Record<string, { readonly name: string; readonly role: ScarloxyChipsetGroupSeed["role"]; readonly repeat?: boolean; readonly description: string }> = {
  "gym-floor-neutral": { name: "체육관 바닥 · 중립", role: "terrain", repeat: true, description: "밝은 회색 광택 타일 바닥(A·B 2칸)입니다. 로비·통로에 1층으로 깔고 A·B 를 체크무늬로 섞습니다." },
  "gym-floor-grass": { name: "체육관 바닥 · 풀", role: "terrain", repeat: true, description: "초록 잔디무늬 타일 바닥(A 무늬 · B 잎 문양)입니다. 풀 속성 체육관 1층." },
  "gym-floor-fire": { name: "체육관 바닥 · 불", role: "terrain", repeat: true, description: "주황·빨강 돌 타일 바닥(A 무늬 · B 불꽃 문양)입니다. 불 속성 체육관 1층." },
  "gym-floor-water": { name: "체육관 바닥 · 물", role: "terrain", repeat: true, description: "파란 유리 타일 바닥(A 무늬 · B 물방울 문양)입니다. 물 속성 체육관 1층." },
  "pier-deck-h": { name: "부두 판자 · 가로", role: "terrain", repeat: true, description: "가로 판자 부두 바닥(1×1)입니다. 바다 위로 뻗은 부두를 1층에 채웁니다. 통행 가능." },
  "pier-deck-v": { name: "부두 판자 · 세로", role: "terrain", repeat: true, description: "세로 판자 부두 바닥(1×1)입니다. 세로로 뻗은 잔교에 씁니다. 통행 가능." },
  "pier-front": { name: "부두 앞면(말뚝)", role: "water", repeat: true, description: "부두 끝 판자 모서리와 바닷속 말뚝(1×1)입니다. 부두 바로 아래 바다 줄에 가로로 반복합니다. 통행 불가." },
  "wet-sand": { name: "젖은 모래", role: "terrain", repeat: true, description: "물가 젖은 모래(1×1)입니다. 사막 모래 34 와 무늬가 같아 그대로 이어집니다. 통행 가능." },
  "gym-wall-grass": { name: "체육관 벽 · 풀", role: "building", repeat: true, description: "초록 벽 기둥(1×2)입니다. 방 윗벽 두 줄에 가로로 반복합니다. 통행 불가." },
  "gym-wall-grass-emblem": { name: "체육관 벽 · 풀 문장", role: "building", description: "잎 문장판이 달린 초록 벽(2×2)입니다. 윗벽 가운데에 한 번 둡니다." },
  "gym-wall-fire": { name: "체육관 벽 · 불", role: "building", repeat: true, description: "주황 벽 기둥(1×2)입니다. 방 윗벽 두 줄에 가로로 반복합니다. 통행 불가." },
  "gym-wall-fire-emblem": { name: "체육관 벽 · 불 문장", role: "building", description: "불꽃 문장판이 달린 주황 벽(2×2)입니다." },
  "gym-wall-water": { name: "체육관 벽 · 물", role: "building", repeat: true, description: "파란 벽 기둥(1×2)입니다. 방 윗벽 두 줄에 가로로 반복합니다. 통행 불가." },
  "gym-wall-water-emblem": { name: "체육관 벽 · 물 문장", role: "building", description: "물방울 문장판이 달린 파란 벽(2×2)입니다." },
  "gym-ceiling": { name: "체육관 천장 테두리", role: "building", description: "방 바깥을 두르는 남색 천장(8칸: 평면·왼·오·아래 테·두 안모서리·입구 두 끝)입니다. 1층, 통행 불가." },
  "leader-podium-grass": { name: "관장 단상 · 풀", role: "building", description: "초록 관장 단상(3×2)입니다. 관장은 윗줄 가운데 칸에 섭니다. 아래 가운데 계단 칸만 통행 가능." },
  "leader-podium-fire": { name: "관장 단상 · 불", role: "building", description: "주황 관장 단상(3×2)입니다. 아래 가운데 계단 칸만 통행 가능." },
  "leader-podium-water": { name: "관장 단상 · 물", role: "building", description: "파란 관장 단상(3×2)입니다. 아래 가운데 계단 칸만 통행 가능." },
  "badge-statue-grass": { name: "배지 조각상 · 풀", role: "prop", description: "금빛 잎 배지를 얹은 돌 받침(1×2)입니다. 입구 양옆에 둡니다. 아래 칸 통행 불가." },
  "badge-statue-fire": { name: "배지 조각상 · 불", role: "prop", description: "금빛 불꽃 배지 조각상(1×2)입니다." },
  "badge-statue-water": { name: "배지 조각상 · 물", role: "prop", description: "금빛 물방울 배지 조각상(1×2)입니다." },
  "gym-fern-pot": { name: "고사리 화분", role: "prop", description: "흰 화분 고사리(1×2)입니다. 풀 체육관 장식." },
  "gym-brazier": { name: "화로", role: "prop", description: "불타는 쇠 화로(1×2)입니다. 불 체육관 장식." },
  "gym-fountain": { name: "분수대", role: "prop", description: "둥근 물 분수대(2×2)입니다. 물 체육관 장식. 통행 불가." },
  "trainer-marker": { name: "트레이너 위치 표시", role: "prop", description: "바닥에 칠한 빨강·흰 원(1×1)입니다. 트레이너 이벤트가 서는 칸 표시. 통행 가능." },
  "floor-switch-off": { name: "바닥 스위치 · 꺼짐", role: "prop", description: "빨간 버튼 바닥 스위치(1×1)입니다. 밟으면 켜짐 칸으로 바꾸는 퍼즐 이벤트의 그림. 통행 가능." },
  "floor-switch-on": { name: "바닥 스위치 · 켜짐", role: "prop", description: "눌려 초록으로 빛나는 스위치(1×1)입니다. 통행 가능." },
  "barrier-closed": { name: "차단기 · 닫힘", role: "prop", description: "노랑·검정 줄무늬 금속 차단기(1×1)입니다. 스위치로 열리는 문. 통행 불가." },
  "barrier-open": { name: "차단기 · 열림", role: "prop", description: "바닥에 들어간 차단기 홈(1×1)입니다. 통행 가능." },
  "gym-doormat": { name: "입구 매트", role: "prop", description: "빨간 입구 매트(2×1)입니다. 출구 칸 위에 깝니다. 통행 가능." },
  "shore-sea": { name: "바다 해안(파도)", role: "water", description: "젖은 모래 섬을 바다가 둘러싼 3×3 테두리입니다. 가운데 칸은 젖은 모래, 둘레 8칸은 거품 파도, 바깥은 바다 204 로 이어집니다. 통행 불가." },
  "shore-sea-inner": { name: "바다 해안 안모서리", role: "water", description: "해안선이 안쪽으로 꺾일 때 쓰는 2×2(왼위·오른위 / 왼아래·오른아래)입니다. 통행 불가." },
  "sand-wet-edge": { name: "마른·젖은 모래 경계", role: "terrain", description: "마른 모래 34 를 젖은 모래가 둘러싼 3×3 테두리입니다. 통행 가능." },
  "sand-wet-edge-inner": { name: "모래 경계 안모서리", role: "terrain", description: "모래 경계가 안쪽으로 꺾일 때 쓰는 2×2 입니다. 통행 가능." },
  lighthouse: { name: "등대", role: "building", description: "빨강·흰 줄무늬 등대(3×6)입니다. 맨 아래 가운데가 나무 문입니다. 통행 불가." },
  rowboat: { name: "나룻배", role: "prop", description: "오른쪽을 향한 나무 나룻배(3×2)입니다. 바다 위 3층. 통행 불가." },
  "mooring-bollard": { name: "계류 기둥", role: "prop", description: "부두 가장자리 쇠 계류 기둥(1×1)입니다. 통행 불가." },
  buoy: { name: "부표", role: "prop", description: "빨강·흰 부표(1×1)입니다. 바다 위 3층. 통행 불가." },
  "rope-coil": { name: "밧줄 더미", role: "prop", description: "부두 위 감긴 밧줄(1×1)입니다. 통행 가능." },
  "palm-shrub": { name: "야자 덤불", role: "prop", description: "줄기 없는 낮은 야자 덤불(1×1)입니다. 통행 불가. 큰 야자는 위 반쪽 palm 블록을 씁니다." },
  "coconut-pile": { name: "야자열매 더미", role: "prop", description: "야자열매 세 개(1×1)입니다. 통행 불가." },
  "beach-umbrella": { name: "비치 파라솔", role: "prop", description: "빨강·흰 파라솔(2×2)입니다. 위 줄은 머리 위, 아래 줄 기둥 칸만 막힙니다." },
  "spiral-shell": { name: "소라껍데기", role: "prop", description: "작은 소라껍데기(1×1)입니다. 모래 위 장식. 통행 가능." },
  "scallop-shell": { name: "가리비껍데기", role: "prop", description: "분홍 가리비(1×1)입니다. 통행 가능." },
  starfish: { name: "불가사리", role: "prop", description: "주황 불가사리(1×1)입니다. 통행 가능." },
  "sea-rock": { name: "바다 바위", role: "prop", description: "물결 고리가 있는 바다 바위(1×1)입니다. 바다 위 3층. 통행 불가." },
  driftwood: { name: "유목", role: "prop", description: "모래 위 흰 유목 통나무(2×1)입니다. 통행 불가." },
};

function monsterGymCoastGroupSeeds(): readonly ScarloxyChipsetGroupSeed[] {
  const seeds: ScarloxyChipsetGroupSeed[] = [];
  for (const block of MONSTER_GYM_COAST_MANIFEST.blocks) {
    const label = MONSTER_GYM_COAST_LABELS[block.name];
    if (!label) continue;
    const cell = (dx: number, dy: number) => (block.row + dy) * SHEET_COLUMNS + block.col + dx;
    const open = new Set((block.openCells ?? []).map(([dx, dy]) => cell(dx!, dy!)));
    const over = block.overRows ?? 0;
    const body: number[] = [];
    const head: number[] = [];
    for (let dy = 0; dy < block.h; dy += 1) {
      for (let dx = 0; dx < block.w; dx += 1) {
        const id = cell(dx, dy);
        if (dy < over || open.has(id)) head.push(id);
        else body.push(id);
      }
    }
    const base = { role: label.role, defaultLayer: block.layer, repeatability: label.repeat ? "repeat" : "fixed" } as const;
    seeds.push({ key: block.name, name: label.name, ...base, passage: block.passage, tileIds: body, description: label.description });
    if (head.length === 0) continue;
    const part = block.openPart === "stairs" ? { key: "-stairs", name: " 계단", description: label.name + "의 계단 칸입니다. 통행 가능 — 도전자가 이 칸에 서서 관장에게 말을 겁니다." }
      : block.openPart === "center" ? { key: "-center", name: " 가운데", description: label.name + "의 가운데 칸(젖은 모래)입니다. 통행 가능 — 섬·곶의 몸통을 채웁니다." }
      : { key: "-top", name: " 머리", description: label.name + "의 윗부분입니다. 3층 통행 가능 칸이라 캐릭터가 뒤로 지나갈 때 머리 위로 그려집니다." };
    seeds.push({ key: block.name + part.key, name: label.name + part.name, ...base, passage: "passable", tileIds: head, description: part.description });
  }
  return seeds;
}


/**
 * 몬스터 동굴 블록 라벨. 블록 하나가 층·통행이 섞인 칸을 가지면(고지대 테두리, 사다리·굴 윗칸,
 * 큰 석순 끝) 그 블록을 통행 값별 그룹 두 개로 가른다 — 그룹 계약이 칸마다 통행을 적는 유일한 경로다.
 * 바닥 장식(물웅덩이·반짝이·균열)은 흙 위에 구워 넣은 불투명 1층 칸이다. 투명한 채 3층 ○ 로 두면 ★ 이 되어
 * 캐릭터 발을 덮는다(openwiki/tile-layer-policy.md).
 */
const MONSTER_CAVE_LABELS: Record<string, { readonly name: string; readonly role: ScarloxyChipsetGroupSeed["role"]; readonly repeat?: boolean; readonly description: string; readonly solidName?: string; readonly solidDescription?: string }> = {
  "wall-blob": { name: "동굴 바위 벽", role: "terrain", repeat: true, description: "위에서 본 바위 덩어리(벽 윗면) 47칸 블롭입니다. 1층, 통행 불가. 바위 벽 몸통을 칠하면 8방 이웃으로 가장자리 모양을 고릅니다. 남쪽 가장자리 아래 두 줄에는 절벽 앞면을 깝니다." },
  "high-blob": { name: "고지대 바닥", role: "terrain", repeat: true, description: "한 단 높은 흙바닥 47칸 블롭 중 걸을 수 있는 몸통·오목 모서리 칸입니다. 1층. 남쪽 가장자리 아래 두 줄에 절벽 앞면, 오르내림은 오르는 돌계단으로 잇습니다.", solidName: "고지대 테두리", solidDescription: "고지대 47칸 블롭의 바깥 테두리(네 직교 중 하나라도 끊긴 칸)입니다. 1층, 통행 불가 — 가장자리에서 떨어지지 않게 막습니다." },
  "water-blob": { name: "동굴 물", role: "water", repeat: true, description: "어두운 동굴 물웅덩이 47칸 블롭입니다. 1층, 통행 불가(파도타기·다리 이벤트로 건넙니다)." },
  "gravel-blob": { name: "자갈 바닥", role: "terrain", repeat: true, description: "흙바닥 위 자갈 무더기 47칸 블롭입니다. 1층, 통행 가능. 조우 구역(conditions.region)으로 쓰기 좋습니다." },
  "floor-dirt": { name: "동굴 흙바닥", role: "terrain", repeat: true, description: "동굴 기본 바닥(1칸, 이음매 없이 반복)입니다. 1층, 통행 가능. 모든 블롭 세트의 바깥 바탕이 이 흙입니다." },
  "floor-pebbles": { name: "잔돌 흙바닥", role: "terrain", repeat: true, description: "잔돌이 박힌 흙바닥 변형입니다. 흙바닥 사이에 드문드문 섞어 반복을 숨깁니다. 1층, 통행 가능." },
  "floor-scatter": { name: "자갈 조각", role: "terrain", description: "흙바닥 위 작은 자갈 무더기(흙에 구운 1칸)입니다. 1층, 통행 가능." },
  puddle: { name: "작은 물웅덩이", role: "terrain", description: "밟을 수 있는 얕은 물웅덩이(흙에 구운 1칸)입니다. 1층, 통행 가능. 큰 물은 동굴 물 블롭을 씁니다." },
  "floor-crack": { name: "바닥 균열", role: "terrain", description: "흙바닥의 가는 균열(1칸)입니다. 1층, 통행 가능. 무너지는 바닥 연출 이벤트의 그림으로도 씁니다." },
  "glow-moss": { name: "빛 이끼", role: "terrain", description: "청록빛 이끼(흙에 구운 1칸)입니다. 1층, 통행 가능." },
  "sparkle-a": { name: "숨은 도구 반짝이", role: "terrain", description: "숨은 도구 반짝이 두 프레임(흙에 구운 1칸씩)입니다. 1층, 통행 가능. 같은 칸에 조사 이벤트(도구 획득)를 두고, 반짝임은 changeTile 로 두 프레임을 번갈아 바꿉니다." },
  "sparkle-b": { name: "숨은 도구 반짝이", role: "terrain", description: "숨은 도구 반짝이 두 번째 프레임입니다." },
  "ladder-hole": { name: "사다리 구멍(내려가기)", role: "terrain", description: "사다리가 꽂힌 바닥 구멍(1칸)입니다. 1층, 통행 가능. 이 칸에 playerTouch 장소 이동 이벤트를 두어 아래층으로 보냅니다." },
  void: { name: "어둠", role: "terrain", description: "빛이 닿지 않는 검은 칸입니다. 맵 바깥 여백·깊은 구덩이에 씁니다. 1층, 통행 불가." },
  "stairs-down": { name: "내려가는 계단", role: "terrain", description: "바닥으로 파인 내려가는 돌계단(2×1)입니다. 1층, 통행 가능. 두 칸에 playerTouch 장소 이동 이벤트를 둡니다." },
  "cliff-face": { name: "절벽 앞면", role: "wall", repeat: true, description: "바위 벽·고지대 남쪽 가장자리 아래 두 줄에 까는 절벽 앞면(왼 끝·반복 A·반복 B·오른 끝 × 윗줄·아랫줄)입니다. 1층, 통행 불가." },
  "ladder-up": { name: "사다리(올라가기)", role: "terrain", description: "절벽 앞면에 붙은 사다리(1×2)의 아랫칸입니다. 1층, 통행 가능 — 여기에 playerTouch 장소 이동 이벤트를 둡니다.", solidName: "사다리 윗칸", solidDescription: "절벽 앞면 사다리(1×2)의 윗칸입니다. 1층, 통행 불가." },
  "tunnel-dark": { name: "어두운 굴 입구", role: "terrain", description: "절벽 앞면에 뚫린 어두운 굴(2×2)의 아랫줄입니다. 1층, 통행 가능 — 두 칸에 장소 이동 이벤트를 둡니다.", solidName: "어두운 굴 윗줄", solidDescription: "어두운 굴(2×2) 윗줄 아치입니다. 1층, 통행 불가." },
  "exit-bright": { name: "밝은 동굴 출구", role: "terrain", description: "바깥 빛이 비치는 출구(2×2)의 아랫줄입니다. 1층, 통행 가능 — 두 칸에 바깥 맵으로 가는 장소 이동 이벤트를 둡니다.", solidName: "밝은 출구 윗줄", solidDescription: "밝은 출구(2×2) 윗줄 아치입니다. 1층, 통행 불가." },
  "stairs-up": { name: "오르는 돌계단", role: "terrain", description: "절벽 앞면을 깎은 오르는 돌계단(2×2)입니다. 1층, 네 칸 모두 통행 가능. 절벽 앞면 두 줄 자리에 끼워 아래 바닥과 위 고지대를 잇습니다." },
  "stalagmite-small": { name: "작은 석순", role: "prop", description: "뾰족한 작은 석순(1×1)입니다. 3층, 통행 불가." },
  "stalagmite-tall": { name: "큰 석순 끝", role: "prop", description: "큰 석순(1×2)의 윗칸입니다. 3층 ★ — 캐릭터가 뒤로 지나갑니다.", solidName: "큰 석순 밑동", solidDescription: "큰 석순(1×2)의 아랫칸입니다. 3층, 통행 불가. 두 칸을 함께 놓습니다." },
  "push-boulder": { name: "밀 수 있는 바위", role: "prop", description: "둥근 회색 바위(1×1)입니다. 3층, 통행 불가. 힘 퍼즐은 이 그림을 이벤트로 옮기는 대신 changeTile 로 칸을 옮겨 그립니다." },
  "cracked-rock": { name: "깨는 바위", role: "prop", description: "금 간 바위(1×1)입니다. 3층, 통행 불가. 바위깨기 이벤트가 changeTile 로 3층을 비워(-1) 길을 엽니다." },
  "ore-rock": { name: "광석 바위", role: "prop", description: "금·청 광석이 박힌 바위(1×1)입니다. 3층, 통행 불가. 조사 이벤트로 광석을 줍니다." },
  crystal: { name: "수정 무더기", role: "prop", description: "청록 수정 무더기(1×1)입니다. 3층, 통행 불가." },
  rubble: { name: "돌무더기", role: "prop", description: "길을 막는 돌무더기(2×1)입니다. 3층, 통행 불가." },
};

function monsterCaveCellIds(block: MonsterCaveBlock, want: "passable" | "solid"): number[] {
  const ids: number[] = [];
  const cells = block.kind === "blob" ? 47 : block.w * block.h;
  for (let i = 0; i < cells; i += 1) {
    const dx = i % block.w;
    const dy = Math.floor(i / block.w);
    const passable = block.passable === "all" || (Array.isArray(block.passable) && block.passable.some(([x, y]) => x === dx && y === dy));
    if ((want === "passable") === passable) ids.push((block.row + dy) * SHEET_COLUMNS + block.col + dx);
  }
  return ids;
}

function monsterCaveGroupSeeds(): readonly ScarloxyChipsetGroupSeed[] {
  const byKey = new Map<string, ScarloxyChipsetGroupSeed>();
  const add = (key: string, seed: Omit<ScarloxyChipsetGroupSeed, "key">): void => {
    const existing = byKey.get(key);
    if (existing) byKey.set(key, { ...existing, tileIds: [...existing.tileIds, ...seed.tileIds] });
    else byKey.set(key, { key, ...seed });
  };
  for (const block of MONSTER_CAVE_MANIFEST.blocks) {
    const label = MONSTER_CAVE_LABELS[block.name];
    if (!label) continue;
    // 반짝이 두 프레임은 한 그룹(한 줄 반짝임 애니메이션의 두 칸).
    const key = block.name.startsWith("sparkle-") ? "sparkle" : block.name;
    const base = { role: label.role, defaultLayer: block.layer, repeatability: label.repeat ? "repeat" : "fixed" } as const;
    const open = monsterCaveCellIds(block, "passable");
    const shut = monsterCaveCellIds(block, "solid");
    if (open.length > 0) add(key, { ...base, name: label.name, passage: "passable", tileIds: open, description: label.description });
    if (shut.length > 0) {
      const mixed = open.length > 0;
      add(mixed ? `${key}-solid` : key, {
        ...base,
        name: mixed ? (label.solidName ?? `${label.name} 막힘`) : label.name,
        passage: "solid",
        tileIds: shut,
        description: mixed ? (label.solidDescription ?? label.description) : label.description,
      });
    }
  }
  return [...byKey.values()];
}

export function scarloxyChipsetGroupSeeds(textureKey: string): readonly ScarloxyChipsetGroupSeed[] {
  // 위 반쪽은 초원 마을 시트와 칸 번호가 같으므로 그 그룹을 그대로 쓰고, 부품 그룹을 덧붙인다.
  if (textureKey === MONSTER_TOWN_KIT_TEXTURE_KEY) {
    return [...scarloxyChipsetGroupSeeds("tex_scarloxy_chipset_grassland"), ...monsterTownKitGroupSeeds()];
  }
  if (textureKey === MONSTER_INTERIOR_TEXTURE_KEY) return monsterInteriorGroupSeeds();
  // 위 반쪽은 사막/설원 시트와 칸 번호가 같다(모래·해안·야자·아레나 그룹을 그대로 쓴다).
  if (textureKey === MONSTER_GYM_COAST_TEXTURE_KEY) {
    return [...scarloxyChipsetGroupSeeds("tex_scarloxy_chipset_wilds"), ...monsterGymCoastGroupSeeds()];
  }
  if (textureKey === MONSTER_CAVE_TEXTURE_KEY) return monsterCaveGroupSeeds();
  const asset = SCARLOXY_CHIPSET_ASSETS.find((entry) => entry.textureKey === textureKey);
  if (!asset) return [];
  const fileName = asset.path.slice(asset.path.lastIndexOf("/") + 1);
  const chipset = SCARLOXY_PACK_MANIFEST.chipsets.find((entry) => entry.file === fileName);
  if (!chipset) return [];

  const seeds: ScarloxyChipsetGroupSeed[] = [];
  const aggregate = new Map<string, { seed: Omit<ScarloxyChipsetGroupSeed, "tileIds">; tileIds: number[] }>();
  const push = (key: string, seed: Omit<ScarloxyChipsetGroupSeed, "tileIds" | "key">, tileIds: readonly number[]): void => {
    const existing = aggregate.get(key);
    if (existing) {
      existing.tileIds.push(...tileIds);
      return;
    }
    aggregate.set(key, { seed: { key, ...seed }, tileIds: [...tileIds] });
  };

  for (const block of chipset.blocks) {
    switch (block.kind) {
      case "terrain":
      case "indoor": {
        const label = TERRAIN_BLOCK_LABELS[block.name] ?? { name: block.name, description: "통행 가능한 지형 타일입니다." };
        push(block.name, { name: label.name, role: "terrain", defaultLayer: "lower", passage: "passable", repeatability: "repeat", description: label.description }, blockTileIds(block));
        break;
      }
      case "water":
        push("water", { name: "물/해안", role: "water", defaultLayer: "lower", passage: "solid", repeatability: "repeat", description: "물·해안 전환 타일입니다. 통행 불가(정적 프레임)." }, blockTileIds(block));
        break;
      case "tree":
        // 수관(윗부분)은 상층에 그려 캐릭터가 뒤로 지나가고, 밑동(마지막 행)은 통행을 막는다.
        push("tree-canopy", { name: "나무 수관", role: "prop", defaultLayer: "upper", passage: "passable", repeatability: "fixed", description: "나무 윗부분입니다. 상층 레이어에 배치해 캐릭터가 뒤로 지나갑니다." }, blockTileIds(block, 0, block.h - 1));
        push("tree-trunk", { name: "나무 밑동", role: "prop", defaultLayer: "upper", passage: "solid", repeatability: "fixed", description: "나무 밑동입니다. 지면 위 상층에 배치하며 통행을 막습니다." }, blockTileIds(block, block.h - 1));
        break;
      case "rock":
        push("rock", { name: "바위", role: "prop", defaultLayer: "upper", passage: "solid", repeatability: "fixed", description: "지면 위에 놓는 바위입니다. 통행 불가." }, blockTileIds(block));
        break;
      case "deco":
        push("deco", { name: "풀숲 장식", role: "prop", defaultLayer: "upper", passage: "passable", repeatability: "fixed", description: "지면 위 풀숲 장식입니다. 통행 가능." }, blockTileIds(block));
        break;
      case "structure":
        push("structure", { name: "건물/구조물", role: "building", defaultLayer: "upper", passage: "solid", repeatability: "fixed", description: "집·병원·유적·아레나 등 구조물입니다. 지면 위 상층에 블록 단위로 배치하며 통행 불가." }, blockTileIds(block));
        break;
      case "furniture": {
        // 가구는 블록 이름별로 그룹을 만든다(terrain 과 같은 키 전략) — 한 그룹으로 뭉치면
        // "침대만 놓아라" 같은 요청을 도구 수준에서 표현할 수 없다.
        const label = FURNITURE_BLOCK_LABELS[block.name]
          ?? { name: block.name, description: "실내 가구입니다. 상층에 블록 단위로 놓고 통행을 막습니다." };
        push(block.name, { name: label.name, role: "prop", defaultLayer: "upper", passage: "solid", repeatability: "fixed", description: label.description }, blockTileIds(block));
        break;
      }
      case "overhead":
        push("overhead", { name: "오버헤드 구조물", role: "prop", defaultLayer: "upper", passage: "passable", repeatability: "fixed", description: "대문 상단 등 캐릭터 머리 위로 그려지는 구조물입니다. 통행 가능." }, blockTileIds(block));
        break;
    }
  }

  for (const { seed, tileIds } of aggregate.values()) {
    seeds.push({ ...seed, tileIds });
  }
  return seeds;
}
