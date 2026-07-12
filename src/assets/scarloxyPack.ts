// Scarloxy MPWSP01 "Monster Taming Game Essentials" 팩 리소스 등록.
//
// 원본: https://scarloxy.itch.io/mpwsp01 (CC-BY 4.0, 상업 사용 가능·출처 표기 필수)
// 변환: scripts/import-scarloxy-pack.py 가 vendor/scarloxy-mpwsp01/ 원본을
//   RM2K3 규격(칩셋 480x256/16px, 캐릭셋 288x256/24x32)으로 재배치해
//   public/assets/scarloxy/ 에 출력하고, 블록 배치를 scarloxyPackManifest.json 에 기록한다.
// 출처 표기: public/assets/ATTRIBUTION.md 참조.

import type { EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";
import manifestInput from "./scarloxyPackManifest.json" with { type: "json" };

type ScarloxyPackedBlock = {
  readonly name: string;
  readonly col: number;
  readonly row: number;
  readonly w: number;
  readonly h: number;
  readonly kind: "terrain" | "water" | "tree" | "rock" | "deco" | "structure" | "overhead" | "indoor";
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

const ASSET_DIR = "assets/scarloxy";

// bundled.ts 의 BundledImageAsset 과 구조 동일(순환 import 방지를 위해 구조 타이핑).
type ScarloxyBundledAsset = { readonly textureKey: string; readonly path: string; readonly name: string };

export const SCARLOXY_CHIPSET_ASSETS = [
  { textureKey: "tex_scarloxy_chipset_grassland", path: `${ASSET_DIR}/scarloxy-chipset-grassland.png`, name: "Scarloxy 초원 마을 ChipSet" },
  { textureKey: "tex_scarloxy_chipset_wilds", path: `${ASSET_DIR}/scarloxy-chipset-wilds.png`, name: "Scarloxy 사막/설원 ChipSet" },
  { textureKey: "tex_scarloxy_chipset_indoor", path: `${ASSET_DIR}/scarloxy-chipset-indoor.png`, name: "Scarloxy 실내 ChipSet" },
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
  draem: { name: "Draem", tags: ["몬스터", "풀", "유령", "꿈"] },
  finiette: { name: "Finiette", tags: ["몬스터", "물", "물고기", "우아함"] },
  finsta: { name: "Finsta", tags: ["몬스터", "물", "물고기", "작음"] },
  friolera: { name: "Friolera", tags: ["몬스터", "물", "얼음", "유령"] },
  gulfin: { name: "Gulfin", tags: ["몬스터", "물", "상어", "지느러미"] },
  ivieron: { name: "Ivieron", tags: ["몬스터", "풀", "덩굴", "새"] },
  jacana: { name: "Jacana", tags: ["몬스터", "물", "물새", "새"] },
  larvea: { name: "Larvea", tags: ["몬스터", "풀", "애벌레", "벌레"] },
  pluma: { name: "Pluma", tags: ["몬스터", "풀", "새", "깃털"] },
  plumette: { name: "Plumette", tags: ["몬스터", "풀", "새", "병아리"] },
  pouch: { name: "Pouch", tags: ["몬스터", "물", "펠리컨", "주머니"] },
  sparchu: { name: "Sparchu", tags: ["몬스터", "불", "불씨", "아기"] },
};

export const SCARLOXY_MONSTER_ASSETS: readonly ScarloxyResourceAsset[] = SCARLOXY_PACK_MANIFEST.monsters.map((key) => ({
  id: `scarloxy-monster-${key}`,
  name: `${MONSTER_LABELS[key]?.name ?? key} (Scarloxy)`,
  path: `${ASSET_DIR}/scarloxy-monster-${key}.png`,
  tags: MONSTER_LABELS[key]?.tags ?? ["몬스터"],
}));

export const SCARLOXY_MONSTER_ICON_ASSETS: readonly ScarloxyResourceAsset[] = SCARLOXY_PACK_MANIFEST.monsters.map((key) => ({
  id: `scarloxy-monster-icon-${key}`,
  name: `${MONSTER_LABELS[key]?.name ?? key} 아이콘 (Scarloxy)`,
  path: `${ASSET_DIR}/scarloxy-monster-icon-${key}.png`,
  tags: ["아이콘", ...(MONSTER_LABELS[key]?.tags ?? [])],
}));

const BACKDROP_LABELS: Record<string, { readonly name: string; readonly tags: readonly string[] }> = {
  forest: { name: "숲 전투 배경 (Scarloxy)", tags: ["전투 배경", "숲", "초원", "나무"] },
  ice: { name: "설원 전투 배경 (Scarloxy)", tags: ["전투 배경", "설원", "얼음", "눈"] },
  sand: { name: "사막 전투 배경 (Scarloxy)", tags: ["전투 배경", "사막", "모래"] },
};

export const SCARLOXY_BACKDROP_ASSETS: readonly ScarloxyResourceAsset[] = SCARLOXY_PACK_MANIFEST.backdrops.map((key) => ({
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
// 칩셋 타일 메타데이터 시드 (tilesetHarness/themePacks.ts 가 소비)
// ---------------------------------------------------------------------------

export type ScarloxyChipsetGroupSeed = {
  readonly key: string;
  readonly name: string;
  readonly role: "terrain" | "water" | "building" | "prop";
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

export function scarloxyChipsetGroupSeeds(textureKey: string): readonly ScarloxyChipsetGroupSeed[] {
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
