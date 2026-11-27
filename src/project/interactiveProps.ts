// 시대별 상호작용 오브젝트 멀티프레임 PNG 스트립 카탈로그 — 데이터·조회 순수 모듈.
//
// 정본 JSON(src/assets/interactivePropsCatalog.json)은 `npm run harness -- interactive-props build` 가
// harness-data/interactive-props/seed.json + 승인된 picked/*.png 로부터 생성한다.
// 런타임(playSceneFieldFx.ts)은 이 카탈로그의 가로 PNG 스트립을 프레임 단위로 잘라
// oneshot / toggle / break / loopAfterOpen 4가지 모드로 재생한다.
import rawCatalog from "@/assets/interactivePropsCatalog.json";
import type { ContainerStyle } from "@/project/containerFx";
import { extractCustomInteractivePropsFromUploaded } from "@/project/interactivePropAuthoring";
import type { Project } from "@/project/types";

export type InteractivePropEra =
  | "fantasy"
  | "dungeon"
  | "modern"
  | "joseon"
  | "murim"
  | "scifi"
  | "steampunk";

export const INTERACTIVE_PROP_ERAS: readonly InteractivePropEra[] = [
  "fantasy",
  "dungeon",
  "modern",
  "joseon",
  "murim",
  "scifi",
  "steampunk",
];

export const INTERACTIVE_PROP_ERA_LABELS: Readonly<Record<InteractivePropEra, string>> = {
  fantasy: "판타지",
  dungeon: "던전",
  modern: "현대",
  joseon: "조선",
  murim: "무림",
  scifi: "SF",
  steampunk: "스팀펑크",
};

export type InteractivePropWorld =
  | InteractivePropEra
  | "desert"
  | "snow"
  | "pirate"
  | "wasteland";

export type InteractivePropGenre =
  | "horror"
  | "puzzle-escape"
  | "adventure"
  | "romance-daily"
  | "monster-collect"
  | "life-survival"
  | "eastern"
  | "cyber-scifi";

export const INTERACTIVE_PROP_GENRES: readonly InteractivePropGenre[] = [
  "horror",
  "puzzle-escape",
  "adventure",
  "romance-daily",
  "monster-collect",
  "life-survival",
  "eastern",
  "cyber-scifi",
];

export const INTERACTIVE_PROP_GENRE_LABELS: Readonly<Record<InteractivePropGenre, string>> = {
  horror: "공포·미스터리",
  "puzzle-escape": "퍼즐·탈출",
  adventure: "JRPG·모험",
  "romance-daily": "일상·학원·연애",
  "monster-collect": "몬스터 수집",
  "life-survival": "농장·생존",
  eastern: "동양·민속",
  "cyber-scifi": "사이버·SF",
};

export type InteractivePropCategory =
  | "door-pass"
  | "container"
  | "breakable"
  | "machine"
  | "light-fire"
  | "water-env"
  | "gimmick"
  | "outdoor-ride";

export const INTERACTIVE_PROP_CATEGORIES: readonly InteractivePropCategory[] = [
  "door-pass",
  "container",
  "breakable",
  "machine",
  "light-fire",
  "water-env",
  "gimmick",
  "outdoor-ride",
];

export const INTERACTIVE_PROP_CATEGORY_LABELS: Readonly<Record<InteractivePropCategory, string>> = {
  "door-pass": "출입문·밀기문·커튼",
  container: "수납·가구·상자",
  breakable: "파괴·채집",
  machine: "기계·가전·키오스크",
  "light-fire": "불·조명·요리",
  "water-env": "물·바람·환경",
  gimmick: "기믹·함정·제단",
  "outdoor-ride": "탈것·야외시설",
};

export type InteractivePropZone = "indoor" | "outdoor" | "both";
export type InteractivePropMount = "floor" | "wall" | "doorway" | "counter";

export type InteractivePropRole =
  | "loot"
  | "passage"
  | "hide"
  | "puzzle-clue"
  | "ambient-light"
  | "hazard-trap";

export const INTERACTIVE_PROP_ROLES: readonly InteractivePropRole[] = [
  "loot",
  "passage",
  "hide",
  "puzzle-clue",
  "ambient-light",
  "hazard-trap",
];

export const INTERACTIVE_PROP_ROLE_LABELS: Readonly<Record<InteractivePropRole, string>> = {
  loot: "탐색·획득",
  passage: "통로·개방",
  hide: "숨기(공포)",
  "puzzle-clue": "단서·잠금",
  "ambient-light": "광원·환경",
  "hazard-trap": "함정·위험",
};

export type InteractivePropMotion =
  | "hinge-lid"
  | "drop-flap"
  | "swing-double"
  | "swing-single"
  | "slide-drawer"
  | "slide-door"
  | "roll-shutter"
  | "lid-aside"
  | "untie-open"
  | "smash-break"
  | "toggle-switch"
  | "activate-loop";

export type InteractivePropPlayback = "oneshot" | "toggle" | "break" | "loopAfterOpen";

export interface InteractivePropEntry {
  readonly id: string;
  readonly name: string;
  readonly wave: string;
  readonly era: InteractivePropEra;
  readonly world?: InteractivePropWorld;
  readonly genres?: readonly InteractivePropGenre[];
  readonly category?: InteractivePropCategory;
  readonly zone?: InteractivePropZone;
  readonly mount?: InteractivePropMount;
  readonly roles?: readonly InteractivePropRole[];
  readonly motion: InteractivePropMotion;
  readonly playback: InteractivePropPlayback;
  readonly containerStyle?: ContainerStyle;
  readonly loopFromFrame?: number;
  readonly stripPath: string;
  /** 프로젝트 내장 커스텀 프롭일 때 `project.assets.uploaded[resourceId]` 의 키. */
  readonly resourceId?: string;
  readonly sourcePng?: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
  readonly frameMs: number;
  readonly footprint: readonly [number, number];
  readonly anchorX: number;
  readonly anchorY: number;
  readonly se: string;
  readonly tags: readonly string[];
  readonly sha256: string;
}

export interface InteractivePropsCatalog {
  readonly version: number;
  readonly targetCount: number;
  readonly builtCount: number;
  readonly props: readonly InteractivePropEntry[];
}

export const INTERACTIVE_PROPS_CATALOG = rawCatalog as unknown as InteractivePropsCatalog;
export const INTERACTIVE_PROPS: readonly InteractivePropEntry[] = INTERACTIVE_PROPS_CATALOG.props;

const BY_ID = new Map<string, InteractivePropEntry>(INTERACTIVE_PROPS.map((prop) => [prop.id, prop]));

/**
 * 카탈로그의 의미 기반 효과음 키(ceramic_break, chest_open 등)를
 * PLAYER_RUNTIME_AUDIO_RESOURCE_IDS 에 이미 등록된 실제 번들 오디오 리소스 id 로 매핑한다.
 */
const PROP_SE_TO_RESOURCE_ID: Readonly<Record<string, string>> = {
  ceramic_break: "cc0-se-osx-dishes-02",
  glass_break: "cc0-se-osx-dishes-02",
  wood_break: "cc0-se-ors-wood-03",
  crystal_shatter: "easyrpg-sound-ice1",
  bone_rattle: "cc0-se-ors-item-stone-02",
  chest_open: "cc0-se-osx-wooded-box-open",
  door_wood: "cc0-se-osx-door-open",
  door_glass: "cc0-se-osx-door-open",
  wood_creak: "cc0-se-osx-door-open",
  drawer_slide: "cc0-se-osx-wooden-01",
  stone_scrape: "cc0-se-ors-item-stone-02",
  metal_latch: "cc0-se-osx-tools-01",
  metal_locker: "cc0-se-osx-tools-01",
  metal_grate: "cc0-se-osx-tools-01",
  metal_heavy: "cc0-se-osx-slam-01",
  valve_turn: "cc0-se-osx-tools-01",
  fire_ignite: "easyrpg-sound-fire1",
  pot_boil: "easyrpg-sound-fire1",
  water_splash: "cc0-se-ors-creature-slime-03",
  cloth_rustle: "cc0-se-orp-inventory-cloth",
  cardboard_open: "cc0-se-orp-inventory-cloth",
  plastic_lid: "cc0-se-osx-wooden-02",
  coin_clink: "cc0-se-orp-inventory-coin",
  vending_drop: "cc0-se-osx-machine-02",
  sci_door: "cc0-se-osx-machine-02",
  sci_latch: "cc0-se-osx-machine-03",
  sci_hiss: "cc0-se-osx-machine-02",
  steam_hiss: "cc0-se-osx-machine-02",
  steam_click: "cc0-se-osx-machine-03",
  sci_beep: "easyrpg-sound-decision2",
  arcade_blip: "easyrpg-sound-decision2",
  sci_hum: "easyrpg-sound-magic2",
  bell_gong: "easyrpg-sound-chime1",
  bell_alarm: "easyrpg-sound-chime1",
  incense_chime: "easyrpg-sound-chime1",
  magic_chime: "easyrpg-sound-chime1",
  drum_boom: "cc0-se-osx-slam-01",
};

export function resolveInteractivePropSe(prop: InteractivePropEntry): string {
  return PROP_SE_TO_RESOURCE_ID[prop.se] ?? "cc0-se-osx-wooded-box-open";
}

/** `loopAfterOpen` 계열(화로·벽난로·등롱·원자로·제단 등)에 붙일 주변 광원 색(hex int). 없으면 null. */
export function interactivePropGlowColor(prop: InteractivePropEntry): number | null {
  if (prop.playback !== "loopAfterOpen") return null;
  if (prop.era === "scifi" || prop.id.includes("sky-seal") || prop.id.includes("magic-pedestal") || prop.id.includes("arcade") || prop.id.includes("kiosk")) {
    return 0x66e6ff;
  }
  if (prop.id.includes("desert-seal") || prop.id.includes("terminal") || prop.id.includes("lamp")) {
    return 0xffdc78;
  }
  if (prop.id.includes("fireplace") || prop.id.includes("brazier") || prop.id.includes("torch") || prop.id.includes("oven") || prop.id.includes("hwadeok") || prop.id.includes("hwaro") || prop.id.includes("lantern")) {
    return 0xffa64d;
  }
  return null;
}

/** 맵 칩셋 id/이름에서 시대 힌트를 추론한다. */
export function inferInteractivePropEra(tilesetId?: string, tilesetName?: string): InteractivePropEra | undefined {
  const hay = `${tilesetId ?? ""} ${tilesetName ?? ""}`.toLowerCase();
  if (!hay.trim()) return undefined;
  if (/joseon|조선|한옥|궁궐/.test(hay)) return "joseon";
  if (/murim|wuxia|무림|무협|객잔/.test(hay)) return "murim";
  if (/sf|scifi|sci-fi|station|cyber|우주|기지/.test(hay)) return "scifi";
  if (/steampunk|스팀/.test(hay)) return "steampunk";
  if (/modern|city|campus|school|jp_city|현대|도시|학교/.test(hay)) return "modern";
  if (/dungeon|cave|crypt|sewer|ruin|던전|동굴|지하/.test(hay)) return "dungeon";
  return "fantasy";
}

export function projectCustomInteractiveProps(project?: Project): readonly InteractivePropEntry[] {
  if (!project?.assets?.uploaded) return [];
  return extractCustomInteractivePropsFromUploaded(
    project.assets.uploaded as Readonly<Record<string, { readonly id: string; readonly dataUrl?: string; readonly meta?: Record<string, unknown> }>>,
  );
}

/** 번들 156종 + 현재 프로젝트에 AI 조수가 직접 저작한 커스텀 프롭을 함께 반환한다. */
export function allInteractiveProps(project?: Project): readonly InteractivePropEntry[] {
  const custom = projectCustomInteractiveProps(project);
  return custom.length > 0 ? [...INTERACTIVE_PROPS, ...custom] : INTERACTIVE_PROPS;
}

export function interactivePropById(id: string | undefined, project?: Project): InteractivePropEntry | undefined {
  if (!id) return undefined;
  const builtin = BY_ID.get(id);
  if (builtin) return builtin;
  if (!project) return undefined;
  return projectCustomInteractiveProps(project).find((p) => p.id === id);
}

export function interactivePropsByEra(era: InteractivePropEra, project?: Project): readonly InteractivePropEntry[] {
  return allInteractiveProps(project).filter((prop) => prop.era === era);
}

/** 에디터·조수 공통 5축 검색: 시대/세계·장르·카테고리·공간·역할·자유 키워드로 필터링한다(프로젝트 커스텀 프롭 포함). */
export function searchInteractiveProps(options: {
  readonly query?: string;
  readonly era?: InteractivePropEra;
  readonly world?: InteractivePropWorld;
  readonly genre?: InteractivePropGenre;
  readonly category?: InteractivePropCategory;
  readonly zone?: InteractivePropZone;
  readonly mount?: InteractivePropMount;
  readonly role?: InteractivePropRole;
  readonly motion?: InteractivePropMotion;
  readonly playback?: InteractivePropPlayback;
} = {}, project?: Project): readonly InteractivePropEntry[] {
  const q = (options.query ?? "").trim().toLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  return allInteractiveProps(project).filter((prop) => {
    if (options.era && prop.era !== options.era) return false;
    if (options.world && (prop.world ?? prop.era) !== options.world) return false;
    if (options.genre && !(prop.genres ?? []).includes(options.genre)) return false;
    if (options.category && prop.category !== options.category) return false;
    if (options.zone && prop.zone && prop.zone !== "both" && prop.zone !== options.zone) return false;
    if (options.mount && prop.mount !== options.mount) return false;
    if (options.role && !(prop.roles ?? []).includes(options.role)) return false;
    if (options.motion && prop.motion !== options.motion) return false;
    if (options.playback && prop.playback !== options.playback) return false;
    if (tokens.length === 0) return true;
    const genreLabels = (prop.genres ?? []).map((g) => `${g} ${INTERACTIVE_PROP_GENRE_LABELS[g]}`).join(" ");
    const catLabel = prop.category ? `${prop.category} ${INTERACTIVE_PROP_CATEGORY_LABELS[prop.category]}` : "";
    const roleLabels = (prop.roles ?? []).map((r) => `${r} ${INTERACTIVE_PROP_ROLE_LABELS[r]}`).join(" ");
    const hay = `${prop.id} ${prop.name} ${prop.era} ${INTERACTIVE_PROP_ERA_LABELS[prop.era]} ${prop.world ?? ""} ${genreLabels} ${catLabel} ${prop.zone ?? ""} ${prop.mount ?? ""} ${roleLabels} ${prop.motion} ${prop.tags.join(" ")}`.toLowerCase();
    return tokens.every((tok) => hay.includes(tok));
  });
}

/** 스트립 PNG 의 브라우저 URL (`public/` 상대 경로 또는 커스텀 uploaded dataUrl). */
export function interactivePropStripUrl(prop: InteractivePropEntry, project?: Project): string {
  if (prop.resourceId && project?.assets?.uploaded) {
    const asset = project.assets.uploaded[prop.resourceId];
    if (asset?.dataUrl) return asset.dataUrl;
  }
  if (prop.stripPath.startsWith("data:")) return prop.stripPath;
  return `/${prop.stripPath.replace(/^\/+/, "")}`;
}

/** 재생 한 회(열기/작동) 총 길이(ms). */
export function interactivePropDurationMs(prop: InteractivePropEntry): number {
  return Math.max(120, prop.frameMs * Math.max(1, prop.frames - 1) + prop.frameMs);
}

/**
 * 수납 종류·이름표·시대 힌트로 가장 잘 맞는 멀티프레임 PNG 프롭을 고른다.
 * 정확히 일치하는 이름표/태그가 있으면 우선하고, 없으면 era + containerStyle 기본값으로 떨어뜨린다.
 */
export function interactivePropForContainer(
  style: ContainerStyle,
  label?: string,
  eraHint?: InteractivePropEra,
): InteractivePropEntry | undefined {
  const text = (label ?? "").toLowerCase();
  // ContainerStyle("drawer" | "straw") -> 카탈로그 태그/스타일 호환 매핑
  const mappedStyle = style === "drawer" ? "dresser" : style === "straw" ? "basket" : style;
  const candidates = INTERACTIVE_PROPS.filter(
    (p) => p.containerStyle === style || (p.containerStyle as string | undefined) === mappedStyle,
  );
  if (candidates.length === 0) return undefined;

  let best: InteractivePropEntry | undefined;
  let bestScore = -1;
  for (const prop of candidates) {
    let score = 0;
    if (eraHint && prop.era === eraHint) score += 20;
    if (text) {
      if (text.includes(prop.id.toLowerCase()) || text.includes(prop.name.toLowerCase())) score += 30;
      for (const tag of prop.tags) {
        if (tag.length >= 2 && text.includes(tag.toLowerCase())) score += 10;
      }
    }
    if (prop.era === "fantasy" && !eraHint) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = prop;
    }
  }
  return best;
}
