// project/genreLock.ts
// 장르 잠금(2026-10-15) — 프로젝트 단위로 「이 게임은 이 장르의 칩셋 계열만 새로 쓴다」를 강제한다.
// 옵트인이다: `system.genreLock` 이 없으면 아무 동작도 바뀌지 않고 저장 바이트도 그대로다.
// 판정 함수는 여기 하나(`genreLockMapViolation` / `genreLockAllowsTileset`)이고, 실행기(toolRunner)·도구 노출·검사 도구·DB 화면이 같은 것을 쓴다.
// 강제 대상은 조수·도구 경로(ToolContext.assistantRun)뿐이다 — 사용자가 편집기에서 손으로 칠하는 것은 막지 않고 경고만 한다.
// 장르별 허용 계열은 아래 표(데이터)에 둔다. 이번 구현은 monster-collect 만 켠다(다른 장르는 표에 넣지 않는다).

import { tilesetFamily, tilesetFamilyLabel } from "./tilesetFamily";
import type { GameMap, Project } from "./types";

export type GenreLockPresetId = "monster-collect";
export type GenreLockMode = "enforce" | "warn";

/** `system.genreLock` — 저장 형태. */
export interface GenreLock {
  readonly preset: GenreLockPresetId;
  /** enforce = 조수·도구가 허용 밖 칩셋으로 맵을 만들거나 바꾸면 거부. warn = 막지 않고 경고만. */
  readonly mode: GenreLockMode;
  /** 켤 때 표에서 복사한 허용 계열. 이 목록이 정본이다(표가 나중에 바뀌어도 이미 켠 프로젝트는 그대로). */
  readonly allowedFamilies: readonly string[];
  /** 켤 때 이미 허용 밖 칩셋이던 맵 id — 「잠금 이전부터 있던」 맵으로 따로 보고한다(막지 않는다). */
  readonly grandfatheredMapIds?: readonly string[];
}

interface Alternative {
  /** 시도한 칩셋 id·이름·도구 이름·맵 이름을 이어 붙인 글에 맞춰 본다. */
  readonly pattern: RegExp;
  readonly tilesetId: string;
  readonly use: string;
}

interface GenreLockPresetDef {
  readonly label: string;
  readonly families: readonly string[];
  /** tilesetId 를 생략한 맵 생성 도구에 넣는 기본 칩셋. */
  readonly defaultTilesetId: string;
  /** 허용 밖 칩셋을 시도했을 때 가장 가까운 허용 칩셋(앞에서부터 처음 맞는 것). 마지막은 defaultTilesetId 로 물러난다. */
  readonly alternatives: readonly Alternative[];
  /** 조수에게 숨기는 비허용 계열 전용 파이프라인 도구 이름. */
  readonly hiddenToolPatterns: readonly RegExp[];
}

// 계열 id 는 monsterKit.ts(MONSTER_KIT_FAMILY)·emeraldMonsterKit.ts 와 같아야 한다 — 이 파일은 시트 데이터를 끌어오지 않으려고 문자열로 둔다.
export const GENRE_LOCK_PRESETS: Readonly<Record<GenreLockPresetId, GenreLockPresetDef>> = {
  "monster-collect": {
    label: "포켓몬 라이크(몬스터 수집)",
    families: ["oprn-monster", "oprn-monster-emerald"],
    defaultTilesetId: "monster_overworld",
    alternatives: [
      { pattern: /gym|league|체육관|리그/iu, tilesetId: "monster_gyms", use: "체육관·리그 홀" },
      { pattern: /dungeon|cave|catacomb|temple|labyrinth|sewer|mine|ice|던전|동굴|미궁|지하|감옥|묘지|하수|광산|신전|유적|얼음/iu, tilesetId: "monster_dungeon", use: "던전·동굴·유적·얼음 동굴" },
      { pattern: /interior|room|house|inn|shop|school|campus|실내|집|방|상점|여관|민가|학교|캠퍼스|저택/iu, tilesetId: "monster_rooms", use: "실내(집·상점·센터·교실)" },
      { pattern: /coast|harbou?r|port|sea|beach|pirate|isle|항구|해안|바다|섬|해적|포구/iu, tilesetId: "monster_coast", use: "항구·해안 마을" },
      { pattern: /desert|snow|volcan|autumn|climate|oasis|사막|설원|눈|화산|가을|기후|오아시스|벚꽃|봄/iu, tilesetId: "monster_climate", use: "사막·설원·화산·가을 같은 기후 지역" },
      { pattern: /field|forest|grass|wild|route|meadow|들|숲|풀|도로|야생|길/iu, tilesetId: "monster_wild", use: "야생 풀밭·숲·도로" },
    ],
    hiddenToolPatterns: [
      /^(author|dress|harmonize|naturalize|refine|compose)_beodeul_/u,
      /^(compose|link|build|list)_(campus|desert_east|jp_city|modern_city|pirate_isles|prehistoric|sengoku_edo|sf_station|sky_island|snow_north|steampunk|gothic|wizarding)/u,
      /^apply_beodeul_/u,
    ],
  },
};

const KNOWN_PRESETS = Object.keys(GENRE_LOCK_PRESETS) as GenreLockPresetId[];

export function isGenreLockPresetId(value: unknown): value is GenreLockPresetId {
  return typeof value === "string" && (KNOWN_PRESETS as string[]).includes(value);
}

export interface ActiveGenreLock {
  readonly lock: GenreLock;
  readonly def: GenreLockPresetDef;
  readonly allowed: ReadonlySet<string>;
}

/** 켜져 있는 잠금(모르는 preset 이면 없는 것으로 본다). */
export function activeGenreLock(project: Pick<Project, "system">): ActiveGenreLock | undefined {
  const lock = project.system?.genreLock;
  if (!lock || !isGenreLockPresetId(lock.preset)) return undefined;
  return { lock, def: GENRE_LOCK_PRESETS[lock.preset], allowed: new Set(lock.allowedFamilies) };
}

/** 조수·도구 경로에서 거부해야 하는 잠금인가. */
export function enforcingGenreLock(project: Pick<Project, "system">): ActiveGenreLock | undefined {
  const active = activeGenreLock(project);
  return active && active.lock.mode === "enforce" ? active : undefined;
}

function isWorldmapKitMap(map: GameMap): boolean {
  return Boolean(map.worldmapSource) && map.tilesetId === `worldmap_${map.id}`;
}

/** 이 칩셋 계열이 잠금 허용인가. approved = 사용자가 카드로 승인한 계열(그 계열 한정 허용). */
export function genreLockAllowsTileset(project: Project, tilesetId: string, approved: readonly string[] = []): boolean {
  const active = activeGenreLock(project);
  if (!active) return true;
  const family = tilesetFamily(project, tilesetId);
  return active.allowed.has(family) || approved.includes(family);
}

/** 맵 하나가 허용 밖인가. 세계 지도 전용 칩셋·지도 그림 시트는 장르와 무관한 도구라 통과한다. */
export function genreLockMapViolation(project: Project, map: GameMap, approved: readonly string[] = []): boolean {
  if (!activeGenreLock(project)) return false;
  if (isWorldmapKitMap(map) || map.tilesetId === "atlas_cartography") return false;
  return !genreLockAllowsTileset(project, map.tilesetId, approved);
}

/** 프로젝트에 실제로 있는 허용 칩셋(번들 순서). */
export function genreLockAllowedTilesets(project: Project): { id: string; name: string }[] {
  const active = activeGenreLock(project);
  if (!active) return [];
  return Object.values(project.tilesets).filter((tileset) => active.allowed.has(tilesetFamily(project, tileset.id))).map((tileset) => ({ id: tileset.id, name: tileset.name }));
}

/** 시도한 칩셋·도구·맵 이름으로 가장 가까운 허용 칩셋. 프로젝트에 없는 칩셋 id 는 고르지 않는다. */
export function genreLockAlternative(project: Project, hint: string): { tilesetId: string; use: string } | undefined {
  const active = activeGenreLock(project);
  if (!active) return undefined;
  const has = (id: string) => project.tilesets[id] !== undefined && active.allowed.has(tilesetFamily(project, id));
  for (const alt of active.def.alternatives) if (alt.pattern.test(hint) && has(alt.tilesetId)) return { tilesetId: alt.tilesetId, use: alt.use };
  if (has(active.def.defaultTilesetId)) return { tilesetId: active.def.defaultTilesetId, use: "야외 마을·길(기본)" };
  const first = genreLockAllowedTilesets(project)[0];
  return first ? { tilesetId: first.id, use: first.name } : undefined;
}

export function genreLockHidesTool(project: Pick<Project, "system">, toolName: string): boolean {
  const active = enforcingGenreLock(project);
  return !!active && active.def.hiddenToolPatterns.some((pattern) => pattern.test(toolName));
}

export function genreLockHiddenToolMessage(project: Project, toolName: string): string {
  const active = activeGenreLock(project)!;
  const alts = active.def.alternatives.map((alt) => `${alt.use}→${alt.tilesetId}`).join(" · ");
  return `장르 잠금(${active.def.label}): ${toolName} 은 ${allowedLabels(project, active)} 밖 칩셋 계열의 전용 시공 도구라 이 프로젝트에서는 쓰지 않는다. `
    + `create_map(tilesetId=허용 칩셋)으로 빈 맵을 만들어 칠하기 도구로 깔거나, 몬스터 칩셋 판(${alts})을 골라라. 사용자가 그 계열을 정말 원할 때만 ask_tileset_change 로 묻고 턴을 끝내라.`;
}

function allowedLabels(project: Project, active: ActiveGenreLock): string {
  return [...active.allowed].map((family) => tilesetFamilyLabel(project, family)).join("·");
}

/** 거부 메시지 — 허용 칩셋 목록, 이름으로 고른 가장 가까운 대안, 승인 경로를 모두 싣는다. 무음 대체는 하지 않는다. */
export function genreLockRejection(project: Project, args: { toolName: string; map: GameMap; hint?: string }): string {
  const active = activeGenreLock(project)!;
  const toTileset = project.tilesets[args.map.tilesetId];
  const toFamily = tilesetFamily(project, args.map.tilesetId);
  const alt = genreLockAlternative(project, `${args.map.tilesetId} ${toTileset?.name ?? ""} ${args.map.name} ${args.toolName} ${args.hint ?? ""}`);
  const allowed = genreLockAllowedTilesets(project).slice(0, 12).map((t) => `${t.id}(${t.name})`).join(", ");
  return `장르 잠금(${active.def.label}): 이 프로젝트는 ${allowedLabels(project, active)} 칩셋 계열만 새 맵·칩셋에 쓴다. `
    + `${args.toolName} 이 맵 ${args.map.id}「${args.map.name}」에 「${toTileset?.name ?? args.map.tilesetId}」(${args.map.tilesetId}, ${tilesetFamilyLabel(project, toFamily)} 계열)을 쓰려 해 거부했다 — 다른 칩셋으로 바꿔 넣지 않았다. `
    + `허용 칩셋: ${allowed || "없음"}. `
    + (alt ? `가장 가까운 대안: ${alt.tilesetId}(${alt.use}) — tilesetId 를 그것으로 지정해 다시 부르거나 create_map(tilesetId=${alt.tilesetId}) 로 빈 맵을 만든 뒤 칠하기 도구로 직접 깔아라. ` : "")
    + `사용자가 이 계열을 정말 원한다고 말했을 때만 ask_tileset_change(toTilesetId="${args.map.tilesetId}") 로 견본을 보여 묻고 턴을 끝내라 — 승인은 그 계열 한정 허용이지 잠금 해제가 아니다.`;
}

/**
 * 잠금을 켠다(이미 같은 preset·모드면 아무것도 안 한다). 바뀌었으면 true.
 * 프로젝트에 허용 계열 칩셋이 하나도 없으면 켜지 않는다 — 켜면 조수가 아무 맵도 만들 수 없다(칩셋이 없는 최소 fixture·옛 프로젝트 보호).
 * 켜는 시점에 이미 허용 밖 칩셋이던 맵은 grandfatheredMapIds 로 기록한다(막지 않고 따로 보고).
 */
export function enableGenreLock(project: Project, preset: GenreLockPresetId, mode: GenreLockMode = "enforce"): boolean {
  const def = GENRE_LOCK_PRESETS[preset];
  const existing = project.system.genreLock;
  if (existing && existing.preset === preset && existing.mode === mode) return false;
  if (!Object.values(project.tilesets).some((tileset) => def.families.includes(tilesetFamily(project, tileset.id)))) return false;
  const keep = existing && existing.preset === preset ? existing.grandfatheredMapIds : undefined;
  project.system.genreLock = { preset, mode, allowedFamilies: [...def.families] };
  const grandfathered = keep ? [...keep] : Object.values(project.maps).filter((map) => genreLockMapViolation(project, map)).map((map) => map.id);
  if (grandfathered.length) project.system.genreLock = { ...project.system.genreLock, grandfatheredMapIds: grandfathered };
  return true;
}

/** 잠금을 끈다. 켜져 있었으면 true. */
export function disableGenreLock(project: Project): boolean {
  if (!project.system.genreLock) return false;
  delete project.system.genreLock;
  return true;
}

export interface GenreLockViolation {
  readonly mapId: string;
  readonly mapName: string;
  readonly tilesetId: string;
  readonly family: string;
  /** true = 잠금을 켤 때 이미 허용 밖이던 맵(옮길지는 사용자가 정한다). false = 잠금 이후에 생긴/바뀐 맵. */
  readonly preexisting: boolean;
}

/** 허용 밖 칩셋을 쓰는 맵 전부. */
export function genreLockViolations(project: Project, approved: readonly string[] = []): GenreLockViolation[] {
  const active = activeGenreLock(project);
  if (!active) return [];
  const before = new Set(active.lock.grandfatheredMapIds ?? []);
  return Object.values(project.maps).filter((map) => genreLockMapViolation(project, map, approved)).map((map) => ({
    mapId: map.id, mapName: map.name, tilesetId: map.tilesetId, family: tilesetFamily(project, map.tilesetId), preexisting: before.has(map.id),
  }));
}

/** 시스템 프롬프트에 붙이는 한 덩어리. 잠금이 없으면 null. */
export function genreLockPromptNote(project: Project): string | null {
  const active = enforcingGenreLock(project);
  if (!active) return null;
  const allowed = genreLockAllowedTilesets(project).map((t) => `${t.id}(${t.name})`).join(", ");
  const alts = active.def.alternatives.map((alt) => `${alt.use}→${alt.tilesetId}`).join(" · ");
  return `[장르 잠금 — ${active.def.label}]
이 프로젝트는 장르 잠금이 켜져 있다. 새 맵·마을·길·던전·실내는 ${allowedLabels(project, active)} 계열 칩셋(${allowed || "프로젝트에 아직 없음"})으로만 만든다. 버들항·숲·사막·jp_city·캠퍼스·조선 등 다른 계열 칩셋과 그 전용 파이프라인(author_beodeul_*, compose_*_map 등)은 보이지 않고 쓰면 거부된다 — 요청이 다른 풍경을 말하면 그 분위기를 몬스터 칩셋 안에서 내거나(${alts}), 정말 필요하면 ask_tileset_change 로 사용자에게 묻는다.`;
}

/** 프로젝트를 통째로 갈아 끼우거나 되돌리는 도구 — 결과가 새 프로젝트/이전 상태라 잠금 판정 대상이 아니다. */
export const GENRE_LOCK_EXEMPT_TOOLS: ReadonlySet<string> = new Set(["reset_project", "revert_last_edit"]);

export class GenreLockError extends Error {
  readonly mapId: string;
  constructor(message: string, mapId: string) {
    super(message);
    this.name = "GenreLockError";
    this.mapId = mapId;
  }
}

/**
 * 도구 실행이 만든 draft 가 잠금을 어기는지 판정하는 유일한 입구(toolRunner 가 부른다).
 * 대상 = 이번에 새로 생긴 맵 + tilesetId 가 바뀐 맵. enforce 면 첫 위반에서 GenreLockError, warn 이면 경고 문장 목록을 돌려준다.
 * 잠금 이전부터 있던 맵을 다른 칩셋으로 옮기지 않는 한 건드리지 않는다. approved = 사용자가 카드로 승인한 계열(그 계열 한정 허용).
 */
export function assertGenreLock(before: Project, draft: Project, args: { toolName: string; approved?: readonly string[] }): string[] {
  const active = activeGenreLock(draft);
  if (!active) return [];
  const warnings: string[] = [];
  for (const [id, next] of Object.entries(draft.maps)) {
    const previous = before.maps[id];
    if (previous && previous.tilesetId === next.tilesetId) continue;
    if (!genreLockMapViolation(draft, next, args.approved ?? [])) continue;
    const message = genreLockRejection(draft, { toolName: args.toolName, map: next });
    if (active.lock.mode === "enforce") throw new GenreLockError(message, id);
    warnings.push(`[경고 모드] ${message}`);
  }
  return warnings;
}

/**
 * tilesetId 를 생략해 도구 기본 칩셋이 들어갈 자리에 잠금 허용 칩셋을 넣는다. 도구 기본값이 이미 허용이면 undefined(그대로 둔다).
 * 조용한 교체가 아니다 — 호출부가 돌려준 note 를 도구 결과 경고로 싣는다.
 */
export function genreLockDefaultTileset(project: Project, defaultTilesetId: string, hint: string): { tilesetId: string; note: string } | undefined {
  const active = enforcingGenreLock(project);
  if (!active || genreLockAllowsTileset(project, defaultTilesetId)) return undefined;
  const alt = genreLockAlternative(project, hint);
  if (!alt) return undefined;
  return {
    tilesetId: alt.tilesetId,
    note: `장르 잠금(${active.def.label}): 기본 칩셋 ${defaultTilesetId} 는 허용 계열이 아니라 ${alt.tilesetId}(${alt.use}) 로 만들었다. 다른 허용 칩셋이 맞으면 tilesetId 를 직접 지정하라.`,
  };
}

/** 잠금을 해제할 때 도구 결과·감사 로그에 싣는 문장. */
export const GENRE_LOCK_RELEASED_MARKER = "장르 잠금 해제됨";

export function genreLockReleasedNotice(project: Project, previous: GenreLock): string {
  const def = GENRE_LOCK_PRESETS[previous.preset];
  const outsiders = Object.values(project.maps).filter((map) => !isWorldmapKitMap(map) && map.tilesetId !== "atlas_cartography" && !previous.allowedFamilies.includes(tilesetFamily(project, map.tilesetId)));
  return `${GENRE_LOCK_RELEASED_MARKER}: ${def.label} 칩셋 잠금(${previous.mode})을 껐다 — 이제 조수가 다른 계열 칩셋으로 맵을 만들 수 있다. 다시 막으려면 configure_monster_system(enabled:true) 또는 자료집 시스템 탭의 「장르 칩셋 잠금」을 켠다.`
    + (outsiders.length ? ` (이미 허용 밖 칩셋인 맵 ${outsiders.length}개: ${outsiders.slice(0, 5).map((map) => map.id).join(", ")}${outsiders.length > 5 ? " …" : ""})` : "");
}

export interface GenreLockReport {
  readonly active: boolean;
  readonly preset?: GenreLockPresetId;
  readonly mode?: GenreLockMode;
  readonly allowedFamilies: readonly string[];
  readonly allowedTilesets: readonly { id: string; name: string }[];
  /** 잠금을 켠 뒤에 생긴/바뀐 허용 밖 맵(조수·도구 경로가 못 막은 것 — 고쳐야 할 대상). */
  readonly violations: readonly GenreLockViolation[];
  /** 잠금을 켜기 전부터 있던 허용 밖 맵(막지 않는다 — 옮길지는 사용자가 정한다). */
  readonly preexisting: readonly GenreLockViolation[];
}

export function genreLockReport(project: Project, approved: readonly string[] = []): GenreLockReport {
  const active = activeGenreLock(project);
  if (!active) return { active: false, allowedFamilies: [], allowedTilesets: [], violations: [], preexisting: [] };
  const all = genreLockViolations(project, approved);
  return {
    active: true, preset: active.lock.preset, mode: active.lock.mode, allowedFamilies: [...active.allowed],
    allowedTilesets: genreLockAllowedTilesets(project),
    violations: all.filter((v) => !v.preexisting), preexisting: all.filter((v) => v.preexisting),
  };
}
