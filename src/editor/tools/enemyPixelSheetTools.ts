// enemyPixelSheetTools.ts — 에디터 내장 9칸 도트 몬스터 생성·검사·제자리 수정·전용 스킬 배선 5종 도구 모음.
//
// 1. list_monster_pixel_archetypes : 원형(beast·dragon·knight·golem·spirit·slime…), 팔레트, 무기/특징, 칸 크기(48·64·96), 스킬 안무, 프로젝트 저작/번들 시트 목록 조회
// 2. inspect_enemy_pixel_sheet     : 기존 적의 9칸 시트(원형/레시피, 9칸 프레임 치수·경계, 팔레트 색상, minPairDiff 픽셀 차이, 배선된 스킬/행동) 정밀 검사
// 3. author_enemy_pixel_sheet      : 새 3×3 9칸 전투 도트 시트 + 한 칸 초상 생성 + 적 레코드/스킬 안무 원스텝 생성
// 4. edit_enemy_pixel_sheet        : 기존 적의 9칸 도트 시트를 제자리(in-place) 수정 — 팔레트/속성 변경, 크기 승격(64→96 보스), 특징 추가/제거(wings·horns·spikes·halo·aura·shield·weapon), 접근 방식 변경, 칸별 픽셀 패치(cellPatches 로 (0,2) 스킬 칸·attack 칸 직접 커스텀) 후 계약 재검증 및 uploaded 자산 즉시 갱신
// 5. set_enemy_skill_choreography  : 적의 전용 스킬 안무(retro2003 choreography + (0,2) 스킬 포즈 트리거 + HP 임계치 보스 페이즈 행동) 배선·수정
//
// 저장 계약(src/assets/pixelEnemySheets.ts projectPixelEnemySheet):
//   uploaded[resourceId]          kind:"monster" 한 칸 초상(idle_a) + meta.pixelEnemySheet{ sheetResourceId, cell, motion, idleFrameMs, skillCell, skillSlug, recipe }
//   uploaded[resourceId-sheet]    kind:"picture" 3×3 시트 PNG
import {
  bundledPixelEnemySheet,
  PIXEL_ENEMY_FRAME,
  PIXEL_ENEMY_SHEETS,
  projectPixelEnemySheet,
  type PixelEnemyCell,
  type PixelEnemyMotion,
} from "@/assets/pixelEnemySheets";
import { generatedEffectDatabaseAnimationId as anim } from "@/assets/generatedEffectSheets";
import { RETRO_MONSTER_SKILLS, RETRO_MONSTER_SKILLSETS, retroMonsterSkill, type RetroMonsterSkillMotion } from "@/assets/retroMonsterSkills";
import { resolveRetroMonsterChoreography, retroFxSheetMeta } from "@/assets/retroSkillCatalog";
import {
  ARCHETYPE_DEFAULTS,
  generateMonsterPixelSheet,
  MONSTER_ARCHETYPE_ALIASES,
  MONSTER_ARCHETYPE_LABELS,
  MONSTER_ARCHETYPES,
  MONSTER_CELL_PATCH_PRESETS,
  MONSTER_MOTIONS,
  MONSTER_PALETTE_PRESETS,
  MONSTER_PIXEL_CHARS,
  MONSTER_SHEET_CELLS,
  MONSTER_SHEET_ORDER,
  MONSTER_TRAITS,
  MONSTER_WEAPON_LABELS,
  MONSTER_WEAPONS,
  MonsterPixelRecipeError,
  normalizeMonsterArchetype,
  resolveMonsterPalettePreset,
  type MonsterArchetype,
  type MonsterCellPatchInput,
  type MonsterPixelRecipe,
  type MonsterPixelSheet,
  type MonsterSheetCell,
  type MonsterWeapon,
} from "@/editor/monsterPixelStudio";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { normalizeEnemyRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { retroMonsterActions, retroMonsterSkillRecords } from "@/project/defaults/retroMonsterSkillRecords";
import { normalizeSkillChoreographyRecord } from "@/project/skillChoreographyRecords";
import type { EnemyActionCondition, EnemyActionPattern, EnemyRecord, Project, SkillRecord } from "@/project/types";
import type { SkillChoreographyLayer } from "@/project/types/database";
import { DB_TOOLS } from "./dbTools";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

/** 원형마다 미리보기·전투 스킬로 쓰는 번들 몬스터 스킬 묶음(RETRO_MONSTER_SKILLSETS 키). */
export const ARCHETYPE_SKILL_SLUGS: Readonly<Record<MonsterArchetype, string>> = {
  beast: "wolf-grey",
  "humanoid-knight": "skeleton-knight",
  "winged-fiend": "harpy-cliff",
  "slime-ooze": "slime-red",
  "golem-construct": "golem",
  "plant-hydra": "plant-carnivore",
  "dragon-boss": "dragon",
  "caster-wraith": "lich-frost",
};

const CELL_ROLE_LABELS: Readonly<Record<PixelEnemyCell, string>> = {
  idle_a: "(0,0) 대기 a · 기본 초상",
  idle_b: "(1,0) 대기 b · 숨쉬기 중간",
  idle_c: "(2,0) 대기 c · 숨쉬기 끝",
  windup: "(0,1) 준비 · 공격/시전 예비 동작",
  move: "(1,1) 이동 · 돌진/도약 접근",
  attack: "(2,1) 공격 · 타격 순간",
  recover: "(0,2) 스킬 방출 포즈 (skillCell)",
  hit: "(1,2) 피격 · 경직",
  dead: "(2,2) 쓰러짐 · 전투 불능",
};

interface SignatureChoreographyPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly motion: RetroMonsterSkillMotion;
  readonly element: "fire" | "ice" | "thunder" | "water" | "earth" | "wind" | "holy" | "dark";
  readonly power: number;
  readonly mp: number;
  readonly scope: SkillRecord["scope"];
  readonly animation: string;
  readonly tint: string;
  readonly flash: string;
  readonly layers: readonly SkillChoreographyLayer[];
}

export const MONSTER_SIGNATURE_CHOREOGRAPHY_PRESETS: Readonly<Record<string, SignatureChoreographyPreset>> = {
  holy_ray: {
    id: "chor_mon_holy_ray",
    name: "성스러운 광선",
    description: "황금 성광 후광을 두르고 (0,2) 포즈에서 심판의 성스러운 광선을 쏘아 아군을 관통한다.",
    motion: "shoot",
    element: "holy",
    power: 145,
    mp: 4,
    scope: "allEnemies",
    animation: anim("holy-beam"),
    tint: "gold",
    flash: "#fff2a6",
    layers: [
      { sheet: "cleric_halo", anchor: "screen" },
      { sheet: "mon_eye_ray", anchor: "projectile", tint: "gold", scale: 1.25 },
      { sheet: "cleric_judgment_hit", anchor: "allTargets", tint: "gold" },
    ],
  },
  holy_judgment: {
    id: "chor_mon_holy_judgment",
    name: "성광 천벌",
    description: "하늘에서 거대한 황금 성십자와 빛기둥을 내려 적 전체를 심판한다.",
    motion: "finisher",
    element: "holy",
    power: 185,
    mp: 6,
    scope: "allEnemies",
    animation: anim("holy-beam"),
    tint: "gold",
    flash: "#fff6bd",
    layers: [
      { sheet: "cleric_judgment_cross", anchor: "screen", tint: "gold" },
      { sheet: "cleric_judgment_hit", anchor: "allTargets", tint: "gold" },
    ],
  },
  void_meteor: {
    id: "chor_mon_void_meteor",
    name: "심연 운석 낙하",
    description: "공허의 기운을 모아 검은 운석과 암흑 화염으로 아군 전체를 뒤덮는다.",
    motion: "cast",
    element: "dark",
    power: 165,
    mp: 6,
    scope: "allEnemies",
    animation: anim("meteor-fall"),
    tint: "void",
    flash: "#b14eff",
    layers: [
      { sheet: "mon_demon_aura", anchor: "user" },
      { sheet: "mon_dark_meteor", anchor: "projectile" },
      { sheet: "mon_dark_crater", anchor: "allTargets" },
    ],
  },
  frost_cataclysm: {
    id: "chor_mon_frost_cataclysm",
    name: "절대영도 눈보라",
    description: "무대 전체에 빙결 폭풍을 불러일으켜 아군 전원을 얼려버린다.",
    motion: "cast",
    element: "ice",
    power: 150,
    mp: 5,
    scope: "allEnemies",
    animation: anim("ice-shatter"),
    tint: "ice",
    flash: "#8be8ff",
    layers: [
      { sheet: "mon_blizzard_sky", anchor: "screen" },
      { sheet: "mon_frost_burst", anchor: "allTargets" },
    ],
  },
  hellfire_breath: {
    id: "chor_mon_hellfire_breath",
    name: "홍련 업화 브레스",
    description: "입에서 전장을 태우는 붉은 업화 숨결을 길게 뿜어낸다.",
    motion: "breath",
    element: "fire",
    power: 160,
    mp: 5,
    scope: "allEnemies",
    animation: anim("fire-burst"),
    tint: "fire",
    flash: "#ff7b29",
    layers: [
      { sheet: "mon_fire_breath", anchor: "screen" },
      { sheet: "mon_burn", anchor: "allTargets" },
    ],
  },
};

const CHOREOGRAPHY_PRESET_ALIASES: Readonly<Record<string, string>> = {
  holy_ray: "holy_ray",
  "holy-ray": "holy_ray",
  holy_beam: "holy_ray",
  "holy-beam": "holy_ray",
  sacred_ray: "holy_ray",
  light_ray: "holy_ray",
  holy: "holy_ray",
  holy_judgment: "holy_judgment",
  divine_judgment: "holy_judgment",
  void_meteor: "void_meteor",
  dark_meteor: "void_meteor",
  void: "void_meteor",
  frost_cataclysm: "frost_cataclysm",
  frost_nova: "frost_cataclysm",
  frost: "frost_cataclysm",
  hellfire_breath: "hellfire_breath",
  fire_breath: "hellfire_breath",
  fire: "hellfire_breath",
};

const RESOURCE_PREFIX = "authored-monster-";

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (const ch of text) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function slugPart(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/** 적 id(있으면)·이름으로 정하는 저작 몬스터 리소스 id. 같은 적을 다시 그리면 같은 id 를 덮어쓴다. */
export function authoredMonsterResourceId(enemyId: string | undefined, name: string): string {
  const fromId = enemyId ? slugPart(enemyId) : "";
  if (fromId) return RESOURCE_PREFIX + fromId;
  const fromName = slugPart(name);
  return RESOURCE_PREFIX + (fromName.length >= 3 ? fromName + "-" : "") + fnv1a(name);
}

/** 이 uploaded 자산이 공방이 만든 9칸 시트 초상인가. */
export function isAuthoredMonsterAsset(project: Pick<Project, "assets">, resourceId: string): boolean {
  return Object.hasOwn(project.assets.uploaded, resourceId) && project.assets.uploaded[resourceId]!.meta.pixelEnemySheet !== undefined;
}

/**
 * 시트·초상 자산을 draft 에 쓴다(있던 저작 자산은 덮어쓴다). 같은 id 의 다른 업로드(사람이 올린 그림)는 지키고 ToolError.
 * 돌려주는 값은 시트 자산 id.
 */
export function writeAuthoredMonsterAssets(
  draft: Project,
  resourceId: string,
  sheet: MonsterPixelSheet,
  options: { readonly recipe: MonsterPixelRecipe; readonly skillSlug?: string; readonly generatedBy: string },
): string {
  const sheetResourceId = `${resourceId}-sheet`;
  for (const id of [resourceId, sheetResourceId]) {
    if (!Object.hasOwn(draft.assets.uploaded, id)) continue;
    const existing = draft.assets.uploaded[id]!;
    const ours = id === resourceId ? existing.meta.pixelEnemySheet !== undefined : existing.generatedBy?.startsWith("monster-pixel-studio") === true;
    if (!ours) throw new ToolError(`uploaded 자산 '${id}' 가 이미 있고 도트 몬스터 공방이 만든 것이 아니다 — 다른 resourceId 를 주라.`, { code: "resource-id-taken" });
  }
  const { cells: _cells, ...recipeWithoutCells } = options.recipe;
  const canonicalArchetype = normalizeMonsterArchetype(options.recipe.archetype) ?? (sheet.archetype === "custom" ? undefined : sheet.archetype);
  draft.assets.uploaded[sheetResourceId] = {
    id: sheetResourceId,
    name: `${sheet.name} 전투 도트 시트`,
    kind: "picture",
    dataUrl: sheet.sheetDataUrl,
    meta: { width: sheet.cell * 3, height: sheet.cell * 3, frameWidth: sheet.cell, frameHeight: sheet.cell, frames: 9 },
    generatedBy: options.generatedBy,
  };
  draft.assets.uploaded[resourceId] = {
    id: resourceId,
    name: sheet.name,
    kind: "monster",
    dataUrl: sheet.portraitDataUrl,
    meta: {
      width: sheet.cell,
      height: sheet.cell,
      pixelEnemySheet: {
        sheetResourceId,
        cell: sheet.cell,
        motion: sheet.motion,
        idleFrameMs: sheet.idleFrameMs,
        skillCell: true,
        ...(options.skillSlug ? { skillSlug: options.skillSlug } : {}),
        // 모드 B 격자는 시트 그림 자체가 정본이라 다시 싣지 않는다(프로젝트 JSON 이 붓는다).
        recipe: {
          ...recipeWithoutCells,
          ...(canonicalArchetype ? { archetype: canonicalArchetype } : {}),
          cell: sheet.cell,
          weapon: sheet.weapon,
          motion: sheet.motion,
          ...(options.recipe.cells ? { customCells: Object.keys(options.recipe.cells) } : {}),
        },
      },
    },
    generatedBy: options.generatedBy,
  };
  return sheetResourceId;
}

/** 공방 레시피의 스킬 묶음(원형 기본값). 알 수 없는 키는 ToolError. */
export function resolveSkillSlug(archetype: MonsterArchetype | string | undefined, requested: unknown): string | undefined {
  if (requested !== undefined) {
    if (typeof requested !== "string" || !Object.hasOwn(RETRO_MONSTER_SKILLSETS, requested)) {
      throw new ToolError(`skillSlug 는 번들 몬스터 스킬 묶음 키다(예: ${Object.keys(RETRO_MONSTER_SKILLSETS).slice(0, 8).join(", ")} …): ${JSON.stringify(requested)}`, { code: "invalid-args" });
    }
    return requested;
  }
  const canonical = normalizeMonsterArchetype(archetype);
  return canonical ? ARCHETYPE_SKILL_SLUGS[canonical] : undefined;
}

/** 스킬 묶음의 몬스터 스킬 레코드가 DB 에 없으면 번들 정의로 채우고 행동 표를 돌려준다. */
export function ensureSlugSkills(draft: Project, slug: string | undefined): EnemyActionPattern[] | undefined {
  const actions = retroMonsterActions(slug);
  if (!actions) return undefined;
  const have = new Set(draft.database.skills.map((skill) => skill.id));
  const needed = new Set(actions.map((action) => action.skillId));
  for (const record of retroMonsterSkillRecords()) {
    if (needed.has(record.id) && !have.has(record.id)) draft.database.skills.push(record);
  }
  const known = new Set(draft.database.skills.map((skill) => skill.id));
  return actions.filter((action) => known.has(action.skillId));
}

function parseCellPatches(raw: unknown): MonsterPixelRecipe["cellPatches"] | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ToolError("cellPatches 는 { \"(0,2)\": [\"..9w9..\"] } 또는 { skill: { preset: \"holy_ray\", rows: [...] } } 객체다.", { code: "invalid-args" });
  }
  const out: Record<string, MonsterCellPatchInput> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (val === undefined || val === null) continue;
    if (typeof val === "string") {
      if (!(MONSTER_CELL_PATCH_PRESETS as readonly string[]).includes(val)) {
        throw new ToolError(`cellPatches.${key} 프리셋은 ${MONSTER_CELL_PATCH_PRESETS.join(" | ")} 중 하나다: ${val}`, { code: "invalid-args" });
      }
      out[key] = val as MonsterCellPatchInput;
      continue;
    }
    if (Array.isArray(val)) {
      if (val.some((row) => typeof row !== "string")) {
        throw new ToolError(`cellPatches.${key} 배열은 문자열 줄 배열이어야 한다.`, { code: "invalid-args" });
      }
      out[key] = val as readonly string[];
      continue;
    }
    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      if (obj.rows !== undefined && (!Array.isArray(obj.rows) || obj.rows.some((r) => typeof r !== "string"))) {
        throw new ToolError(`cellPatches.${key}.rows 는 문자열 줄 배열이어야 한다.`, { code: "invalid-args" });
      }
      if (obj.preset !== undefined && (typeof obj.preset !== "string" || !(MONSTER_CELL_PATCH_PRESETS as readonly string[]).includes(obj.preset))) {
        throw new ToolError(`cellPatches.${key}.preset 은 ${MONSTER_CELL_PATCH_PRESETS.join(" | ")} 중 하나다.`, { code: "invalid-args" });
      }
      out[key] = obj as unknown as MonsterCellPatchInput;
      continue;
    }
    throw new ToolError(`cellPatches.${key} 형식이 올바르지 않다.`, { code: "invalid-args" });
  }
  return out;
}

function recipeFromArgs(args: Record<string, unknown>): MonsterPixelRecipe {
  const cells = args.cells;
  if (cells !== undefined && (typeof cells !== "object" || cells === null || Array.isArray(cells))) {
    throw new ToolError("cells 는 { idle_a: [\"..oo..\", ...], ... } 객체다.", { code: "invalid-args" });
  }
  if (cells) {
    for (const [key, rows] of Object.entries(cells)) {
      if (!MONSTER_SHEET_ORDER.includes(key as PixelEnemyCell)) throw new ToolError(`cells 의 칸 이름은 ${MONSTER_SHEET_ORDER.join(", ")} 이다: ${key}`, { code: "invalid-args" });
      if (!Array.isArray(rows) || rows.some((row) => typeof row !== "string")) throw new ToolError(`cells.${key} 는 문자열 줄 배열이다.`, { code: "invalid-args" });
    }
  }
  const cellPatches = parseCellPatches(args.cellPatches);
  const pick = <T>(key: string): T | undefined => (args[key] === undefined ? undefined : (args[key] as T));
  const rawPalette = pick<string>("palette") ?? pick<string>("element");
  const preset = resolveMonsterPalettePreset(rawPalette);
  if (rawPalette !== undefined && !preset) {
    throw new ToolError(`palette/element 는 ${Object.keys(MONSTER_PALETTE_PRESETS).join(" | ")} 중 하나다: ${rawPalette}`, { code: "invalid-args" });
  }
  const rawTraits = Array.isArray(args.traits) ? args.traits.filter((t): t is string => typeof t === "string") : undefined;
  const rawMotion = pick<PixelEnemyMotion | "cast">("motion") ?? pick<PixelEnemyMotion | "cast">("approach");
  return {
    name: pick<string>("name"),
    archetype: pick<string>("archetype"),
    ...(preset ? { palette: preset.id } : {}),
    primaryColor: pick<string>("primaryColor") ?? preset?.primaryColor,
    secondaryColor: pick<string>("secondaryColor") ?? preset?.secondaryColor,
    accentColor: pick<string>("accentColor") ?? preset?.accentColor,
    weapon: pick<MonsterWeapon>("weapon"),
    cell: pick<MonsterSheetCell>("cell"),
    motion: rawMotion,
    spikes: pick<boolean>("spikes"),
    horns: pick<boolean>("horns"),
    wings: pick<boolean>("wings"),
    halo: pick<boolean>("halo"),
    aura: pick<boolean>("aura"),
    shield: pick<boolean>("shield"),
    tailClub: pick<boolean>("tailClub") ?? pick<boolean>("tail_club"),
    ...(rawTraits ? { traits: rawTraits } : {}),
    ...(cells ? { cells: cells as MonsterPixelRecipe["cells"] } : {}),
    ...(cellPatches ? { cellPatches } : {}),
  };
}

function findTargetEnemyAndResource(
  draft: Project,
  args: Record<string, unknown>,
): { enemy: EnemyRecord | undefined; resourceId: string | undefined } {
  const enemyId = typeof args.enemyId === "string" && args.enemyId.trim() ? args.enemyId.trim() : undefined;
  const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : undefined;
  const resourceIdArg = typeof args.resourceId === "string" && args.resourceId.trim() ? args.resourceId.trim() : undefined;
  let enemy: EnemyRecord | undefined;
  if (enemyId) {
    enemy = draft.database.enemies.find((e) => e.id === enemyId);
  }
  if (!enemy && resourceIdArg) {
    enemy = draft.database.enemies.find((e) => e.monsterResourceId === resourceIdArg);
  }
  if (!enemy && name) {
    enemy = draft.database.enemies.find((e) => e.name === name);
  }
  const resourceId = resourceIdArg ?? enemy?.monsterResourceId;
  return { enemy, resourceId };
}

function inferArchetypeFromBundled(resourceId: string | undefined, motion: PixelEnemyMotion | undefined): MonsterArchetype {
  const id = (resourceId ?? "").toLowerCase();
  if (id.includes("dragon") || id.includes("wyvern") || id.includes("hydra")) return "dragon-boss";
  if (id.includes("golem") || id.includes("troll") || id.includes("minotaur") || id.includes("ogre")) return "golem-construct";
  if (id.includes("slime") || id.includes("ooze")) return "slime-ooze";
  if (id.includes("knight") || id.includes("skeleton") || id.includes("orc") || id.includes("goblin") || id.includes("armor")) return "humanoid-knight";
  if (id.includes("wisp") || id.includes("spirit") || id.includes("ghost") || id.includes("lich") || id.includes("wraith") || id.includes("mage")) return "caster-wraith";
  if (id.includes("plant")) return "plant-hydra";
  if (id.includes("bat") || id.includes("harpy") || id.includes("bird") || id.includes("gargoyle") || id.includes("angel") || motion === "swoop") return "winged-fiend";
  return "beast";
}

function describeWiredSkills(draft: Project, enemy: EnemyRecord | undefined) {
  if (!enemy) return [];
  return (enemy.actions ?? []).map((action) => {
    const skill = draft.database.skills.find((s) => s.id === action.skillId);
    const resolved = resolveRetroMonsterChoreography(skill ?? { id: action.skillId }, draft.database.skillChoreographies);
    return {
      skillId: action.skillId,
      name: skill?.name ?? resolved?.name ?? action.skillId,
      priority: action.priority,
      condition: action.condition,
      retroChoreographyId: skill?.retroChoreographyId ?? (resolved ? resolved.id : undefined),
      motion: resolved?.motion,
      element: skill?.elementId ?? resolved?.element,
      layers: resolved?.layers.map((l) => ({ key: l.key, anchor: l.anchor, frame: l.frame, frames: l.frames })) ?? [],
      triggersSkillCell02: action.skillId !== "skill_attack" && Boolean(resolved),
    };
  });
}

const colorSchema = (what: string): JsonSchema => ({ type: "string", pattern: "^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$", description: `#rrggbb — ${what}` });

const ARCHETYPE_ENUM = [...new Set([...MONSTER_ARCHETYPES, ...Object.keys(MONSTER_ARCHETYPE_ALIASES)])];
const PALETTE_ENUM = Object.keys(MONSTER_PALETTE_PRESETS);
const MOTION_ENUM = [...MONSTER_MOTIONS, "cast"];

// ---------------------------------------------------------------- ① list_monster_pixel_archetypes

const listMonsterPixelArchetypes: ToolDefinition = {
  name: "list_monster_pixel_archetypes",
  description:
    "도트 몬스터 공방에서 쓸 수 있는 모든 원형(beast·dragon·knight·golem·spirit·slime·winged-fiend·plant-hydra), " +
    "원소 팔레트 프리셋(fire·frost·void·holy·gold·poison·amethyst·abyss·earth), 무기·특징(horns·wings·spikes·halo·shield·staff·twin_blades·tail_club·aura), " +
    "칸 크기(48·64·96px), 공격 접근 방식, 칸별 픽셀 패치(cellPatches) 프리셋, 전용 스킬 안무(choreography), 프로젝트 내 저작/번들 몬스터 시트 목록을 조회한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      archetype: { type: "string", description: "특정 원형만 자세히 볼 때(예: beast, dragon, knight, golem, spirit, slime)." },
      includeBundled: { type: "boolean", description: "true 면 번들 도트 몬스터 시트 목록도 함께 돌려준다." },
    },
  },
  run(draft, args): ToolExecResult {
    const filterArch = typeof args.archetype === "string" ? normalizeMonsterArchetype(args.archetype) : undefined;
    const archetypes = MONSTER_ARCHETYPES
      .filter((id) => !filterArch || id === filterArch)
      .map((id) => {
        const defaults = ARCHETYPE_DEFAULTS[id];
        const aliases = Object.entries(MONSTER_ARCHETYPE_ALIASES)
          .filter(([alias, target]) => target === id && alias !== id)
          .map(([alias]) => alias);
        return {
          id,
          aliases,
          label: MONSTER_ARCHETYPE_LABELS[id],
          defaultWeapon: defaults.weapon,
          defaultCell: defaults.cell,
          defaultMotion: defaults.motion,
          defaultSkillSlug: ARCHETYPE_SKILL_SLUGS[id],
          flying: defaults.flying,
        };
      });

    const palettes = Object.values(MONSTER_PALETTE_PRESETS);
    const weapons = MONSTER_WEAPONS.map((id) => ({ id, label: MONSTER_WEAPON_LABELS[id] }));
    const traits = [
      { id: "horns", label: "머리 뿔 (horns)" },
      { id: "wings", label: "등 날개 (wings)" },
      { id: "spikes", label: "등·어깨 수정 가시 (spikes)" },
      { id: "halo", label: "머리 위 성광 후광 (halo)" },
      { id: "shield", label: "문장 방패 (shield)" },
      { id: "staff", label: "마법 지팡이·보주 (staff)" },
      { id: "twin_blades", label: "쌍검 무장 (twin_blades)" },
      { id: "tail_club", label: "철퇴·곤봉 꼬리 (tail_club)" },
      { id: "aura", label: "몸 둘레 기운 입자 (aura)" },
    ];
    const authoredSheets = Object.values(draft.assets.uploaded)
      .filter((asset) => asset.meta?.pixelEnemySheet !== undefined)
      .map((asset) => {
        const meta = asset.meta.pixelEnemySheet!;
        const linkedEnemies = draft.database.enemies.filter((e) => e.monsterResourceId === asset.id).map((e) => ({ id: e.id, name: e.name }));
        return {
          resourceId: asset.id,
          sheetResourceId: meta.sheetResourceId,
          name: asset.name,
          cell: meta.cell,
          motion: meta.motion,
          skillSlug: meta.skillSlug,
          recipe: meta.recipe,
          linkedEnemies,
        };
      });
    const signaturePresets = Object.entries(MONSTER_SIGNATURE_CHOREOGRAPHY_PRESETS).map(([presetKey, p]) => ({
      preset: presetKey,
      choreographyId: p.id,
      name: p.name,
      motion: p.motion,
      element: p.element,
      layers: p.layers.map((l) => `${l.sheet}@${l.anchor}`),
      description: p.description,
    }));

    return {
      summary: `도트 몬스터 원형 ${archetypes.length}종 · 팔레트 ${palettes.length}종 · 특징 ${traits.length}종 · 프로젝트 저작 시트 ${authoredSheets.length}개 · 번들 시트 ${PIXEL_ENEMY_SHEETS.length}개`,
      data: {
        archetypes,
        palettes,
        weapons,
        traits,
        cellSizes: [
          { cell: 48, sheetSize: "144x144", role: "소형 잡몹" },
          { cell: 64, sheetSize: "192x192", role: "표준 몬스터" },
          { cell: 96, sheetSize: "288x288", role: "보스·거신 몬스터" },
        ],
        motions: MONSTER_MOTIONS,
        cellOrder: MONSTER_SHEET_ORDER.map((cell) => ({ cell, frame: PIXEL_ENEMY_FRAME[cell], role: CELL_ROLE_LABELS[cell] })),
        cellPatchPresets: MONSTER_CELL_PATCH_PRESETS,
        pixelChars: MONSTER_PIXEL_CHARS,
        skillSetSlugs: Object.keys(RETRO_MONSTER_SKILLSETS),
        signatureChoreographyPresets: signaturePresets,
        monsterSkillContracts: RETRO_MONSTER_SKILLS.map((s) => ({ id: s.id, name: s.name, motion: s.motion, element: s.element, effect: s.effect })),
        projectAuthoredSheets: authoredSheets,
        bundledSheetCount: PIXEL_ENEMY_SHEETS.length,
        ...(args.includeBundled === true
          ? { bundledSheets: PIXEL_ENEMY_SHEETS.map((s) => ({ resourceId: s.resourceId, cell: s.cell ?? 64, motion: s.motion, skillCell: Boolean(s.skillCell) })) }
          : {}),
      },
    };
  },
};

// ---------------------------------------------------------------- ② inspect_enemy_pixel_sheet

const inspectEnemyPixelSheet: ToolDefinition = {
  name: "inspect_enemy_pixel_sheet",
  description:
    "기존 적(enemyId·name) 또는 도트 시트 자산(resourceId)의 3×3 9칸 전투 시트를 정밀 검사한다. " +
    "원형·팔레트·무기·특징 레시피 메타데이터, 9칸 각각의 프레임 좌표와 픽셀 경계(bounds), 사용된 팔레트 색상 수와 #rrggbb 표, " +
    "9칸 사이의 최소 픽셀 차이(minPairDiff) 및 계약 통과 여부, 그리고 적에게 배선된 전용 스킬/행동(actions)을 돌려준다. " +
    "edit_enemy_pixel_sheet 나 set_enemy_skill_choreography 로 몬스터를 수정하기 전에 먼저 호출한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      enemyId: { type: "string", description: "검사할 적 레코드 id (예: enemy_amethyst_wolf)." },
      resourceId: { type: "string", description: "검사할 몬스터 도트 시트 resourceId (생략 시 enemyId 의 monsterResourceId)." },
      name: { type: "string", description: "적 이름으로 찾을 때." },
      includeGridRows: { type: "boolean", description: "true 면 9칸 각각의 문자 격자(rows)도 함께 돌려준다." },
    },
  },
  run(draft, args): ToolExecResult {
    const { enemy, resourceId } = findTargetEnemyAndResource(draft, args);
    if (!enemy && !resourceId) {
      throw new ToolError("검사할 적(enemyId 또는 name)이나 도트 시트(resourceId)를 찾을 수 없다.", { code: "not-found" });
    }
    const authored = resourceId ? projectPixelEnemySheet(resourceId, draft) : undefined;
    const bundled = !authored && resourceId ? bundledPixelEnemySheet(resourceId) : undefined;
    if (!authored && !bundled) {
      throw new ToolError(`리소스 '${resourceId ?? "(없음)"}' 에 연결된 9칸 도트 시트가 없다.`, { code: "sheet-not-found" });
    }

    const wiredSkills = describeWiredSkills(draft, enemy);
    if (authored && resourceId) {
      const uploadedAsset = draft.assets.uploaded[resourceId]!;
      const meta = uploadedAsset.meta.pixelEnemySheet!;
      const savedRecipe = (meta.recipe ?? {}) as MonsterPixelRecipe;
      const reconstructed = generateMonsterPixelSheet({
        ...savedRecipe,
        name: enemy?.name ?? uploadedAsset.name,
        archetype: normalizeMonsterArchetype(savedRecipe.archetype) ?? "beast",
        cell: meta.cell,
        motion: meta.motion,
      });
      const cells = Object.fromEntries(
        MONSTER_SHEET_ORDER.map((cellName) => [
          cellName,
          {
            ...PIXEL_ENEMY_FRAME[cellName],
            role: CELL_ROLE_LABELS[cellName],
            bounds: reconstructed.bounds[cellName],
          },
        ]),
      );
      return {
        summary: `적 '${enemy?.name ?? uploadedAsset.name}'(${enemy?.id ?? resourceId}) 9칸 저작 시트 검사 — ${reconstructed.cell}px (${reconstructed.cell * 3}×${reconstructed.cell * 3}), 원형 ${reconstructed.archetype}, ${reconstructed.colors}색, minPairDiff ${reconstructed.minPairDiff.pixels}px, 스킬 ${wiredSkills.length}개`,
        data: {
          origin: "authored",
          enemyId: enemy?.id,
          enemyName: enemy?.name ?? uploadedAsset.name,
          enemyStats: enemy?.stats,
          resourceId,
          sheetResourceId: meta.sheetResourceId,
          recipe: savedRecipe,
          dimensions: {
            cell: reconstructed.cell,
            sheetWidth: reconstructed.cell * 3,
            sheetHeight: reconstructed.cell * 3,
            frames: 9,
            grid: "3x3",
            baselineY: reconstructed.cell - 4,
          },
          motion: reconstructed.motion,
          idleFrameMs: reconstructed.idleFrameMs,
          skillCell: true,
          skillSlug: meta.skillSlug,
          colors: reconstructed.colors,
          palette: reconstructed.palette,
          minPairDiff: reconstructed.minPairDiff,
          contractValid: reconstructed.errors.length === 0,
          contractErrors: reconstructed.errors,
          cells,
          wiredSkills,
          ...(args.includeGridRows === true ? { rows: reconstructed.rows } : {}),
        },
      };
    }

    const sheet = bundled!;
    const cell = (sheet.cell ?? 64) as MonsterSheetCell;
    const inferredArchetype = inferArchetypeFromBundled(sheet.resourceId, sheet.motion);
    return {
      summary: `적 '${enemy?.name ?? sheet.resourceId}'(${enemy?.id ?? sheet.resourceId}) 번들 9칸 시트 검사 — ${cell}px (${cell * 3}×${cell * 3}), 추정 원형 ${inferredArchetype}, motion ${sheet.motion}, 스킬 ${wiredSkills.length}개`,
      data: {
        origin: "bundled",
        enemyId: enemy?.id,
        enemyName: enemy?.name,
        enemyStats: enemy?.stats,
        resourceId: sheet.resourceId,
        path: sheet.path,
        inferredArchetype,
        dimensions: {
          cell,
          sheetWidth: cell * 3,
          sheetHeight: cell * 3,
          frames: 9,
          grid: "3x3",
          baselineY: cell - 4,
        },
        motion: sheet.motion,
        idleFrameMs: sheet.idleFrameMs,
        skillCell: Boolean(sheet.skillCell),
        skillSlug: sheet.skillSlug ?? sheet.path.replace(/^.*\//, "").replace(/\.png$/, ""),
        wiredSkills,
      },
    };
  },
};

// ---------------------------------------------------------------- ③ author_enemy_pixel_sheet

const authorEnemyPixelSheet: ToolDefinition = {
  name: "author_enemy_pixel_sheet",
  description:
    "새 몬스터의 retro2003 전투 도트를 직접 그린다: 3×3 9칸 시트(idle_a·idle_b·idle_c 대기 루프, windup·move·attack 공격, (0,2) 스킬 방출, hit, dead) + 한 칸 초상을 " +
    "project.assets.uploaded 에 넣는다. 오른쪽(아군 쪽)을 보고 발은 y=cell-4 에 선다. 번들 몬스터 그림에 맞는 것이 없거나 사용자가 새 몬스터를 「만들어/도트 찍어」 달라고 하면 이 도구를 쓴다. " +
    "모드 A: archetype(몸 원형) + palette(또는 세 색) + weapon + 특징(spikes·horns·wings·halo·aura·shield·tailClub)으로 관절 리그가 9자세를 합성한다. " +
    "모드 B: cells 에 칸별 문자 격자를 주거나 cellPatches 에 특정 칸((0,2) 스킬 칸 등) 오버레이 패치를 준다. " +
    "enemy 를 주면 같은 호출에서 upsert_enemy 와 같은 검증으로 적 레코드를 만들거나 고치고 monsterResourceId 를 이 시트로 잇는다. " +
    "Draws a brand-new 9-pose pixel battle sheet for a monster; never reuse an unrelated bundled monster when the user asks for a new one.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, description: "몬스터 이름(시트·적 이름 기본값)." },
      archetype: { type: "string", enum: ARCHETYPE_ENUM, description: "몸 원형(beast, dragon/dragon-boss, knight/humanoid-knight, golem/golem-construct, spirit/caster-wraith, slime/slime-ooze, winged-fiend, plant-hydra)." },
      palette: { type: "string", enum: PALETTE_ENUM, description: "원소 팔레트 프리셋(fire, frost, void, holy, gold, poison, amethyst, abyss, earth)." },
      primaryColor: colorSchema("몸통 색"),
      secondaryColor: colorSchema("갑옷·배·잎 같은 둘째 재질"),
      accentColor: colorSchema("가시·수정·눈빛·스킬 빛"),
      weapon: { type: "string", enum: MONSTER_WEAPONS, description: "무기/공격 부위(sword, axe, spear, claw, staff, fang, breath, twin_blades, tail_club)." },
      cell: { type: "integer", enum: MONSTER_SHEET_CELLS, description: "칸 크기 px. 48 잡몹 · 64 기본 · 96 보스/거신." },
      motion: { type: "string", enum: MOTION_ENUM, description: "전투 접근 방식: hop·swoop·stomp·dash·float·shoot·breath (또는 cast)." },
      spikes: { type: "boolean", description: "등·어깨 수정 가시." },
      horns: { type: "boolean", description: "머리 뿔." },
      wings: { type: "boolean", description: "등 날개." },
      halo: { type: "boolean", description: "머리 위 성광 후광." },
      aura: { type: "boolean", description: "몸 둘레 기운 오라." },
      shield: { type: "boolean", description: "문장 방패." },
      tailClub: { type: "boolean", description: "곤봉 꼬리." },
      traits: { type: "array", items: { type: "string", enum: MONSTER_TRAITS }, description: "특징 배열(horns, wings, spikes, halo, shield, staff, twin_blades, tail_club, aura)." },
      cells: {
        type: "object",
        additionalProperties: true,
        description: `모드 B 칸별 문자 격자 { idle_a: ["....oo....", ...], attack: [...] }. 문자: ${Object.entries(MONSTER_PIXEL_CHARS).map(([ch, label]) => `${ch}=${label}`).join(" ")}.`,
      },
      cellPatches: {
        type: "object",
        additionalProperties: true,
        description: "특정 칸((0,2) 스킬 칸 \"skill\"/\"recover\" 등)에 픽셀 행 배열이나 프리셋(\"holy_ray\"·\"dark_flame\"·\"frost_shard\"·\"lightning_arc\"·\"rune_halo\")을 덧그린다.",
      },
      skillSlug: { type: "string", description: "미리보기·전투 스킬로 쓸 번들 몬스터 스킬 묶음(예: wolf-grey, skeleton-knight, dragon, lich-frost). 생략 시 원형 기본값." },
      resourceId: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{2,63}$", description: "uploaded 자산 id(영소문자·숫자·-). 생략 시 enemy.id 나 이름으로 정한다." },
      enemy: {
        type: "object",
        additionalProperties: true,
        description: "적 레코드 패치(upsert_enemy 의 enemy 와 같다: id·name·stats·rewards·actions·elementRates…). 주면 monsterResourceId 를 이 시트로 잇는다.",
      },
      role: { type: "string", enum: ["boss", "normal"], description: "enemy 와 함께: boss 면 enemy.stats 에 주지 않은 능력치에 시작 파티 기준 위협 하한(기본값)을 채운다." },
    },
  },
  invalidArgsExample: {
    name: "자수정 송곳니 늑대",
    archetype: "beast",
    primaryColor: "#5b3f8f",
    secondaryColor: "#d9c6f2",
    accentColor: "#c77dff",
    weapon: "fang",
    cell: 64,
    motion: "dash",
    spikes: true,
    enemy: { id: "enemy_amethyst_wolf", name: "자수정 송곳니 늑대", stats: { maxHp: 120, attack: 22, defense: 12 }, rewards: { exp: 30, gold: 18 } },
  },
  run(draft, args): ToolExecResult {
    const recipe = recipeFromArgs(args);
    const enemyPatch = args.enemy === undefined ? undefined : (args.enemy as Record<string, unknown>);
    if (enemyPatch !== undefined && (typeof enemyPatch !== "object" || enemyPatch === null || Array.isArray(enemyPatch))) {
      throw new ToolError("enemy 는 적 레코드 패치 객체다.", { code: "invalid-args" });
    }
    const name = (typeof recipe.name === "string" && recipe.name.trim()) || (typeof enemyPatch?.name === "string" ? enemyPatch.name : "");
    let sheet: MonsterPixelSheet;
    try {
      sheet = generateMonsterPixelSheet({ ...recipe, ...(name ? { name } : {}) });
    } catch (error) {
      if (error instanceof MonsterPixelRecipeError) throw new ToolError(error.message, { code: "invalid-args" });
      throw error;
    }
    const skillSlug = resolveSkillSlug(recipe.archetype, args.skillSlug);
    const existingEnemy = typeof enemyPatch?.id === "string" ? draft.database.enemies.find((enemy) => enemy.id === enemyPatch.id) : undefined;
    const enemyId = enemyPatch
      ? (typeof enemyPatch.id === "string" && enemyPatch.id) || `enemy_${slugPart(sheet.name).replace(/-/g, "_") || "authored"}_${fnv1a(sheet.name)}`
      : undefined;
    const resourceId = typeof args.resourceId === "string"
      ? args.resourceId
      : existingEnemy?.monsterResourceId && isAuthoredMonsterAsset(draft, existingEnemy.monsterResourceId)
        ? existingEnemy.monsterResourceId
        : authoredMonsterResourceId(enemyId, sheet.name);
    const sheetResourceId = writeAuthoredMonsterAssets(draft, resourceId, sheet, { recipe: { ...recipe, name: sheet.name }, skillSlug, generatedBy: "monster-pixel-studio:ai" });

    const warnings = sheet.errors.map((error) => `시트 계약 경고: ${error}`);
    let enemySummary = "";
    let enemyData: unknown;
    if (enemyPatch && enemyId) {
      const upsert = DB_TOOLS.find((tool) => tool.name === "upsert_enemy");
      if (!upsert) throw new Error("upsert_enemy 도구가 없다");
      const patch: Record<string, unknown> = { ...enemyPatch, id: enemyId, monsterResourceId: resourceId };
      if (patch.name === undefined && !existingEnemy) patch.name = sheet.name;
      if (patch.actions === undefined && !(existingEnemy?.actions?.length)) {
        const actions = ensureSlugSkills(draft, skillSlug);
        if (actions?.length) patch.actions = actions;
      }
      const result = upsert.run(draft, { enemy: patch, ...(args.role !== undefined ? { role: args.role } : {}) });
      warnings.push(...(result.warnings ?? []));
      enemySummary = ` · ${result.summary}`;
      enemyData = result.data;
      setSelectedRecordId("enemies", enemyId, { reveal: true });
    }
    return {
      summary: `도트 몬스터 '${sheet.name}' 9칸 시트(${sheet.cell}px, ${sheet.motion}) 를 ${resourceId} 로 저장${enemySummary}`,
      data: {
        resourceId,
        sheetResourceId,
        enemyId,
        name: sheet.name,
        archetype: sheet.archetype,
        weapon: sheet.weapon,
        cell: sheet.cell,
        motion: sheet.motion,
        skillSlug,
        colors: sheet.colors,
        bounds: sheet.bounds,
        minPairDiff: sheet.minPairDiff,
        palette: sheet.palette,
        ...(enemyData ? { enemy: enemyData } : {}),
        next: enemyId
          ? `upsert_troop({troop:{name,enemyIds:["${enemyId}"]}}) 로 무리를 만들고 맵 조우(set_encounter_table)나 필드 적(place_field_enemy)으로 배치하라.`
          : `upsert_enemy 의 enemy.monsterResourceId 에 "${resourceId}" 를 넣어 적에 잇는다.`,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

// ---------------------------------------------------------------- ④ edit_enemy_pixel_sheet

const editEnemyPixelSheet: ToolDefinition = {
  name: "edit_enemy_pixel_sheet",
  description:
    "기존 적(enemyId·name) 또는 도트 시트(resourceId)의 3×3 9칸 전투 시트를 제자리(in-place)에서 수정한다. " +
    "팔레트/속성 변경(fire·frost·void·holy·gold·poison·amethyst·abyss·earth 또는 #rrggbb), 크기 승격(64px → 96px 보스), " +
    "특징 추가/제거(wings·horns·spikes·halo·aura·shield·tail_club·weapon), 접근 방식 변경(dash·cast·swoop·stomp·hop·float·shoot·breath), " +
    "그리고 특정 칸 픽셀 직접 패치(cellPatches — 예: (0,2) 스킬 포즈 칸이나 attack 칸에 커스텀 픽셀 행 배열이나 \"holy_ray\" 광선 오버레이를 덧그리기)를 지원한다. " +
    "수정 후 9칸 계약을 다시 검증하고 project.assets.uploaded 를 즉시 갱신해 열린 에디터 미리보기와 전투 화면에 반영한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      enemyId: { type: "string", description: "수정할 적 레코드 id (예: enemy_amethyst_wolf)." },
      resourceId: { type: "string", description: "수정할 도트 시트 resourceId (생략 시 enemyId 의 monsterResourceId)." },
      name: { type: "string", description: "몬스터의 새 이름(생략 시 기존 이름 유지)." },
      archetype: { type: "string", enum: ARCHETYPE_ENUM, description: "몸 원형 변경 시 지정(생략 시 기존 원형 유지)." },
      palette: { type: "string", enum: PALETTE_ENUM, description: "바꿀 원소 팔레트 프리셋(fire, frost, void, holy, gold, poison, amethyst, abyss, earth)." },
      element: { type: "string", enum: PALETTE_ENUM, description: "palette 와 같은 원소 프리셋 별칭." },
      primaryColor: colorSchema("몸통 색 (#rrggbb)"),
      secondaryColor: colorSchema("둘째 재질 색 (#rrggbb)"),
      accentColor: colorSchema("강조·스킬 빛 색 (#rrggbb)"),
      cell: { type: "integer", enum: MONSTER_SHEET_CELLS, description: "변경할 칸 크기 px (예: 64 → 96 보스 크기 승격)." },
      weapon: { type: "string", enum: MONSTER_WEAPONS, description: "변경할 무기/공격 부위." },
      motion: { type: "string", enum: MOTION_ENUM, description: "변경할 전투 접근 방식(dash, cast, swoop, stomp, hop, float, shoot, breath)." },
      approach: { type: "string", enum: MOTION_ENUM, description: "motion 과 같은 접근 방식 별칭." },
      spikes: { type: "boolean", description: "등·어깨 가시 켜기/끄기." },
      horns: { type: "boolean", description: "머리 뿔 켜기/끄기." },
      wings: { type: "boolean", description: "등 날개 켜기/끄기." },
      halo: { type: "boolean", description: "머리 위 성광 후광 켜기/끄기." },
      aura: { type: "boolean", description: "몸 둘레 기운 오라 켜기/끄기." },
      shield: { type: "boolean", description: "방패 켜기/끄기." },
      tailClub: { type: "boolean", description: "곤봉 꼬리 켜기/끄기." },
      traits: { type: "array", items: { type: "string", enum: MONSTER_TRAITS }, description: "켜 둘 특징 목록." },
      addTraits: { type: "array", items: { type: "string", enum: MONSTER_TRAITS }, description: "기존 시트에 추가할 특징(예: [\"wings\", \"halo\", \"aura\"])." },
      removeTraits: { type: "array", items: { type: "string", enum: MONSTER_TRAITS }, description: "기존 시트에서 제거할 특징(예: [\"spikes\"])." },
      cellPatches: {
        type: "object",
        additionalProperties: true,
        description:
          "특정 칸에 커스텀 픽셀 격자나 프리셋을 덧그린다. 키는 idle_a, idle_b, idle_c, windup, move, attack, recover(또는 skill / \"(0,2)\"), hit, dead. " +
          "값은 문자열 줄 배열([\"..9w9..\", ...]), 프리셋 문자열(\"holy_ray\"·\"dark_flame\"·\"frost_shard\"·\"lightning_arc\"·\"rune_halo\"), 또는 { rows, preset, mode: \"overlay\"|\"replace\", anchor: \"front\"|\"top\"|\"center\"|\"ground\", offsetX, offsetY }.",
      },
      clearCellPatches: { type: "boolean", description: "true 면 이전 cellPatches 를 지우고 새로 적용한다." },
      skillSlug: { type: "string", description: "변경할 몬스터 스킬 묶음 slug." },
      upgradeToBoss: { type: "boolean", description: "true 면 적 능력치도 보스 체급으로 함께 끌어올린다." },
      enemy: {
        type: "object",
        additionalProperties: true,
        description: "함께 적용할 적 레코드 패치(stats, rewards 등).",
      },
    },
  },
  invalidArgsExample: {
    enemyId: "enemy_amethyst_wolf",
    cell: 96,
    palette: "holy",
    wings: true,
    halo: true,
    cellPatches: { "(0,2)": { preset: "holy_ray", rows: ["..99w99..", ".9wwwww9.", "..99w99.."] } },
  },
  run(draft, args): ToolExecResult {
    const { enemy, resourceId: foundResourceId } = findTargetEnemyAndResource(draft, args);
    if (!enemy && !foundResourceId) {
      throw new ToolError("수정할 적(enemyId·name) 또는 도트 시트(resourceId)를 찾을 수 없다.", { code: "not-found" });
    }
    const existingAuthored = foundResourceId && isAuthoredMonsterAsset(draft, foundResourceId)
      ? draft.assets.uploaded[foundResourceId]!.meta.pixelEnemySheet
      : undefined;
    const bundled = !existingAuthored && foundResourceId ? bundledPixelEnemySheet(foundResourceId) : undefined;
    const priorRecipe: MonsterPixelRecipe = existingAuthored?.recipe
      ? (existingAuthored.recipe as MonsterPixelRecipe)
      : {
          name: enemy?.name ?? "도트 몬스터",
          archetype: inferArchetypeFromBundled(foundResourceId, bundled?.motion),
          cell: (bundled?.cell ?? 64) as MonsterSheetCell,
          motion: bundled?.motion ?? "dash",
        };

    const incoming = recipeFromArgs(args);
    const removeSet = new Set(
      (Array.isArray(args.removeTraits) ? args.removeTraits : [])
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase()),
    );
    const addSet = new Set(
      [
        ...(Array.isArray(priorRecipe.traits) ? priorRecipe.traits : []),
        ...(Array.isArray(args.traits) ? args.traits : []),
        ...(Array.isArray(args.addTraits) ? args.addTraits : []),
      ]
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => !removeSet.has(t)),
    );

    const resolveFlag = (key: "spikes" | "horns" | "wings" | "halo" | "aura" | "shield" | "tailClub", traitName: string): boolean | undefined => {
      if (incoming[key] !== undefined) return incoming[key];
      if (removeSet.has(traitName)) return false;
      if (addSet.has(traitName)) return true;
      return priorRecipe[key];
    };

    const mergedPatches: MonsterPixelRecipe["cellPatches"] = {
      ...(args.clearCellPatches === true ? {} : priorRecipe.cellPatches),
      ...(incoming.cellPatches ?? {}),
    };

    const rawPalette = (typeof args.palette === "string" ? args.palette : undefined) ?? (typeof args.element === "string" ? args.element : undefined);
    const palettePreset = resolveMonsterPalettePreset(rawPalette);
    const mergedRecipe: MonsterPixelRecipe = {
      ...priorRecipe,
      name: incoming.name ?? priorRecipe.name ?? enemy?.name ?? "도트 몬스터",
      archetype: incoming.archetype ?? priorRecipe.archetype ?? "beast",
      palette: palettePreset?.id ?? priorRecipe.palette,
      primaryColor: (typeof args.primaryColor === "string" ? args.primaryColor : undefined) ?? palettePreset?.primaryColor ?? priorRecipe.primaryColor,
      secondaryColor: (typeof args.secondaryColor === "string" ? args.secondaryColor : undefined) ?? palettePreset?.secondaryColor ?? priorRecipe.secondaryColor,
      accentColor: (typeof args.accentColor === "string" ? args.accentColor : undefined) ?? palettePreset?.accentColor ?? priorRecipe.accentColor,
      weapon: incoming.weapon ?? priorRecipe.weapon,
      cell: incoming.cell ?? priorRecipe.cell ?? existingAuthored?.cell ?? 64,
      motion: incoming.motion ?? priorRecipe.motion ?? existingAuthored?.motion ?? "dash",
      spikes: resolveFlag("spikes", "spikes"),
      horns: resolveFlag("horns", "horns"),
      wings: resolveFlag("wings", "wings"),
      halo: resolveFlag("halo", "halo"),
      aura: resolveFlag("aura", "aura"),
      shield: resolveFlag("shield", "shield"),
      tailClub: resolveFlag("tailClub", "tail_club"),
      ...(addSet.size > 0 ? { traits: [...addSet] } : {}),
      ...(Object.keys(mergedPatches).length > 0 ? { cellPatches: mergedPatches } : {}),
    };

    let sheet: MonsterPixelSheet;
    try {
      sheet = generateMonsterPixelSheet(mergedRecipe);
    } catch (error) {
      if (error instanceof MonsterPixelRecipeError) throw new ToolError(error.message, { code: "invalid-args" });
      throw error;
    }

    const targetResourceId = existingAuthored && foundResourceId
      ? foundResourceId
      : authoredMonsterResourceId(enemy?.id, sheet.name);
    const skillSlug = args.skillSlug !== undefined
      ? resolveSkillSlug(mergedRecipe.archetype, args.skillSlug)
      : existingAuthored?.skillSlug ?? resolveSkillSlug(mergedRecipe.archetype, undefined);

    const before = {
      resourceId: foundResourceId,
      cell: existingAuthored?.cell ?? bundled?.cell ?? 64,
      archetype: priorRecipe.archetype ?? inferArchetypeFromBundled(foundResourceId, bundled?.motion),
      palette: priorRecipe.palette ?? "custom",
      primaryColor: priorRecipe.primaryColor,
      motion: existingAuthored?.motion ?? bundled?.motion ?? "dash",
    };

    const sheetResourceId = writeAuthoredMonsterAssets(draft, targetResourceId, sheet, {
      recipe: { ...mergedRecipe, name: sheet.name },
      skillSlug,
      generatedBy: "monster-pixel-studio:ai-edit",
    });

    const warnings = sheet.errors.map((error) => `시트 계약 경고: ${error}`);
    if (enemy) {
      enemy.monsterResourceId = targetResourceId;
      setSelectedRecordId("enemies", enemy.id, { reveal: true });
      if (typeof args.name === "string" && args.name.trim()) {
        enemy.name = args.name.trim();
      }
      const upgradeBoss = args.upgradeToBoss === true || (sheet.cell === 96 && before.cell < 96);
      const enemyPatch = args.enemy && typeof args.enemy === "object" && !Array.isArray(args.enemy)
        ? (args.enemy as Record<string, unknown>)
        : undefined;
      if (enemyPatch || upgradeBoss) {
        const upsert = DB_TOOLS.find((tool) => tool.name === "upsert_enemy");
        if (upsert) {
          const patch: Record<string, unknown> = {
            ...(enemyPatch ?? {}),
            id: enemy.id,
            name: enemy.name,
            monsterResourceId: targetResourceId,
          };
          if (upgradeBoss && !patch.stats) {
            // 거신 칸으로 키운 보스의 바닥값. 저자가 준 값이 아니므로 patch.stats 로 넘기지 않는다 —
            // upsert_enemy 는 호출에 실린 stats 를 「저자 명시값」으로 보고 보스 하한을 걸지 않는다.
            enemy.stats = {
              ...enemy.stats,
              maxHp: Math.max(enemy.stats.maxHp, 1200),
              maxMp: Math.max(enemy.stats.maxMp, 100),
              attack: Math.max(enemy.stats.attack, 28),
              defense: Math.max(enemy.stats.defense, 32),
              mind: Math.max(enemy.stats.mind, 28),
              agility: Math.max(enemy.stats.agility, 22),
            };
          }
          const res = upsert.run(draft, { enemy: patch, ...(upgradeBoss ? { role: "boss" } : {}) });
          warnings.push(...(res.warnings ?? []));
        }
      }
    }

    const activeTraits = (["spikes", "horns", "wings", "halo", "aura", "shield", "tailClub"] as const).filter((k) => mergedRecipe[k] === true);
    const patchedCells = Object.keys(mergedPatches);
    return {
      summary: `도트 몬스터 '${sheet.name}' 시트 제자리 수정 완료 (${before.cell}px → ${sheet.cell}px, 팔레트 ${mergedRecipe.palette ?? "custom"}, 특징 [${activeTraits.join(", ") || "기본"}]${patchedCells.length ? `, 셀 패치 [${patchedCells.join(", ")}]` : ""})`,
      data: {
        enemyId: enemy?.id,
        resourceId: targetResourceId,
        sheetResourceId,
        name: sheet.name,
        before,
        after: {
          cell: sheet.cell,
          sheetSize: `${sheet.cell * 3}x${sheet.cell * 3}`,
          archetype: sheet.archetype,
          weapon: sheet.weapon,
          motion: sheet.motion,
          palettePreset: mergedRecipe.palette,
          palette: sheet.palette,
          colors: sheet.colors,
          minPairDiff: sheet.minPairDiff,
          activeTraits,
          patchedCells,
        },
        bounds: sheet.bounds,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

// ---------------------------------------------------------------- ⑤ set_enemy_skill_choreography

const setEnemySkillChoreography: ToolDefinition = {
  name: "set_enemy_skill_choreography",
  description:
    "적(enemyId·name)의 전용 스킬 안무(retro2003 skill choreography)를 배선하거나 수정한다. " +
    "(0,2) 스킬 방출 포즈(skillCell) 트리거를 활성화하고, 성스러운 광선(holy_ray)·성광 천벌(holy_judgment)·심연 운석(void_meteor)·절대영도(frost_cataclysm)·홍련 브레스(hellfire_breath) 프리셋이나 " +
    "번들 몬스터 스킬(skill_mon_*) 또는 커스텀 레이어 안무(chor_*)를 적의 스킬 레코드와 행동 표(actions, HP 임계치 보스 페이즈 조건 포함)에 연결한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      enemyId: { type: "string", description: "대상 적 레코드 id (예: enemy_amethyst_wolf)." },
      name: { type: "string", description: "적 이름으로 찾을 때." },
      resourceId: { type: "string", description: "도트 시트 resourceId 로 찾을 때." },
      preset: {
        type: "string",
        enum: Object.keys(CHOREOGRAPHY_PRESET_ALIASES),
        description: "전용 스킬 연출 프리셋(holy_ray 성스러운 광선, holy_judgment 성광 천벌, void_meteor 심연 운석, frost_cataclysm 절대영도, hellfire_breath 홍련 브레스).",
      },
      choreographyId: {
        type: "string",
        description: "연결할 연출 id (프리셋 키, skill_mon_* 계약 id, 또는 chor_* 프로젝트 안무 id).",
      },
      skillId: { type: "string", description: "생성·수정할 전용 스킬 레코드 id (생략 시 자동 생성)." },
      skillName: { type: "string", description: "전용 스킬 이름 (예: '성스러운 광선', '성광 심판 광선')." },
      description: { type: "string", description: "전용 스킬 설명." },
      motion: { type: "string", enum: ["lunge", "shoot", "cast", "breath", "stomp", "buff", "finisher"], description: "몬스터 스킬 시전 모션." },
      element: { type: "string", enum: ["fire", "ice", "thunder", "water", "earth", "wind", "holy", "dark"], description: "속성 id." },
      power: { type: "integer", description: "스킬 위력 (기본 145)." },
      mpCost: { type: "integer", description: "MP 소모량 (기본 4)." },
      scope: { type: "string", enum: ["enemy", "allEnemies", "self", "allAllies"], description: "대상 범위." },
      tint: { type: "string", description: "이펙트 색조 (gold, fire, ice, void 또는 #rrggbb)." },
      layers: {
        type: "array",
        items: { type: "object", additionalProperties: true },
        description: "커스텀 이펙트 레이어 배열 [{ sheet: \"mon_eye_ray\", anchor: \"projectile\", tint: \"gold\" }, ...].",
      },
      hpThresholdPercent: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        description: "보스 페이즈 발동 HP 상한 퍼센트(예: 70 이면 HP 0~70% 구간에서 최우선 발동 + 평시 시그니처 행동 함께 배선).",
      },
      patchSkillCell02: {
        type: "boolean",
        description: "true(기본값)면 연결된 저작 도트 시트의 (0,2) 스킬 칸에도 해당 속성 광선/오라 패치를 함께 입힌다.",
      },
      skillSlug: { type: "string", description: "도트 시트에 함께 기록할 번들 몬스터 스킬 묶음 slug." },
    },
  },
  invalidArgsExample: {
    enemyId: "enemy_amethyst_wolf",
    preset: "holy_ray",
    skillName: "성스러운 광선",
    hpThresholdPercent: 70,
  },
  run(draft, args): ToolExecResult {
    const { enemy, resourceId } = findTargetEnemyAndResource(draft, args);
    if (!enemy) {
      throw new ToolError("전용 스킬 연출을 배선할 적(enemyId·name)을 찾을 수 없다.", { code: "enemy-not-found" });
    }

    // 기본 몬스터 스킬 42개 보장
    const existingSkills = new Set(draft.database.skills.map((s) => s.id));
    for (const record of retroMonsterSkillRecords()) {
      if (!existingSkills.has(record.id)) {
        draft.database.skills.push(record);
        existingSkills.add(record.id);
      }
    }

    const rawPresetKey = (typeof args.preset === "string" ? args.preset : undefined)
      ?? (typeof args.choreographyId === "string" ? args.choreographyId : undefined)
      ?? (typeof args.element === "string" ? args.element : undefined)
      ?? "holy_ray";
    const normalizedPresetKey = CHOREOGRAPHY_PRESET_ALIASES[rawPresetKey.trim().toLowerCase()];
    const preset = normalizedPresetKey ? MONSTER_SIGNATURE_CHOREOGRAPHY_PRESETS[normalizedPresetKey] : undefined;
    const bundledMonsterSkill = !preset && typeof args.choreographyId === "string" ? retroMonsterSkill(args.choreographyId) : undefined;

    const motion = (typeof args.motion === "string" ? (args.motion as RetroMonsterSkillMotion) : undefined)
      ?? preset?.motion
      ?? bundledMonsterSkill?.motion
      ?? "shoot";
    const element = (typeof args.element === "string" ? args.element : undefined)
      ?? preset?.element
      ?? bundledMonsterSkill?.element
      ?? "holy";
    const skillName = (typeof args.skillName === "string" && args.skillName.trim() ? args.skillName.trim() : undefined)
      ?? preset?.name
      ?? bundledMonsterSkill?.name
      ?? "성스러운 광선";
    const description = (typeof args.description === "string" && args.description.trim() ? args.description.trim() : undefined)
      ?? preset?.description
      ?? bundledMonsterSkill?.description
      ?? `${enemy.name}의 (0,2) 스킬 포즈에서 방출되는 전용 필살 연출.`;

    // 커스텀 레이어 또는 프리셋 안무 레코드(chor_*) 등록
    const customLayersRaw = Array.isArray(args.layers) ? args.layers : undefined;
    const customLayers: SkillChoreographyLayer[] | undefined = customLayersRaw
      ? customLayersRaw
          .map((item) => {
            if (typeof item !== "object" || item === null) return undefined;
            const obj = item as Record<string, unknown>;
            const sheetKey = typeof obj.sheet === "string" ? obj.sheet : typeof obj.key === "string" ? obj.key : undefined;
            const anchor = typeof obj.anchor === "string" ? (obj.anchor as SkillChoreographyLayer["anchor"]) : "target";
            if (!sheetKey || !retroFxSheetMeta(sheetKey)) return undefined;
            return {
              sheet: sheetKey,
              anchor,
              ...(typeof obj.tint === "string" ? { tint: obj.tint } : {}),
              ...(typeof obj.scale === "number" ? { scale: obj.scale } : {}),
            };
          })
          .filter((l): l is SkillChoreographyLayer => l !== undefined)
      : undefined;

    draft.database.skillChoreographies ??= [];
    let choreographyId: string;
    let resolvedLayersSummary: string[] = [];

    if (customLayers?.length || preset) {
      const basePreset = preset ?? MONSTER_SIGNATURE_CHOREOGRAPHY_PRESETS.holy_ray!;
      const chorId = typeof args.choreographyId === "string" && args.choreographyId.startsWith("chor_")
        ? args.choreographyId
        : `chor_mon_${slugPart(enemy.id)}_${slugPart(normalizedPresetKey ?? "sig")}`.slice(0, 60);
      const chorRecord = normalizeSkillChoreographyRecord({
        id: chorId,
        name: `${enemy.name} · ${skillName}`,
        description,
        motion,
        layers: customLayers?.length ? customLayers : basePreset.layers,
        tint: typeof args.tint === "string" ? args.tint : basePreset.tint,
        screen: { flash: basePreset.flash, shake: 5, dim: true },
        tags: { family: "monster", element },
      });
      if (!chorRecord) {
        throw new ToolError("전용 스킬 안무 레코드(chor_*) 생성에 실패했다 — 유효한 FX 시트 레이어를 확인하라.", { code: "invalid-choreography" });
      }
      const existingChorIdx = draft.database.skillChoreographies.findIndex((c) => c.id === chorRecord.id);
      if (existingChorIdx >= 0) draft.database.skillChoreographies[existingChorIdx] = chorRecord;
      else draft.database.skillChoreographies.push(chorRecord);
      choreographyId = chorRecord.id;
      resolvedLayersSummary = chorRecord.layers.map((l) => `${l.sheet}@${l.anchor}`);
    } else if (bundledMonsterSkill) {
      choreographyId = bundledMonsterSkill.id;
      resolvedLayersSummary = bundledMonsterSkill.layers.map((l) => `${l.key}@${l.anchor}`);
    } else if (typeof args.choreographyId === "string" && draft.database.skillChoreographies.some((c) => c.id === args.choreographyId)) {
      const found = draft.database.skillChoreographies.find((c) => c.id === args.choreographyId)!;
      choreographyId = found.id;
      resolvedLayersSummary = found.layers.map((l) => `${l.sheet}@${l.anchor}`);
    } else {
      const fallback = MONSTER_SIGNATURE_CHOREOGRAPHY_PRESETS.holy_ray!;
      const chorId = `chor_mon_${slugPart(enemy.id)}_holy_ray`.slice(0, 60);
      const chorRecord = normalizeSkillChoreographyRecord({
        id: chorId,
        name: `${enemy.name} · ${skillName}`,
        description,
        motion,
        layers: fallback.layers,
        tint: fallback.tint,
        screen: { flash: fallback.flash, shake: 5, dim: true },
        tags: { family: "monster", element },
      })!;
      const existingChorIdx = draft.database.skillChoreographies.findIndex((c) => c.id === chorRecord.id);
      if (existingChorIdx >= 0) draft.database.skillChoreographies[existingChorIdx] = chorRecord;
      else draft.database.skillChoreographies.push(chorRecord);
      choreographyId = chorRecord.id;
      resolvedLayersSummary = chorRecord.layers.map((l) => `${l.sheet}@${l.anchor}`);
    }

    // 전용 스킬 레코드 등록/갱신
    const skillId = (typeof args.skillId === "string" && args.skillId.trim() ? args.skillId.trim() : undefined)
      ?? `skill_mon_sig_${slugPart(enemy.id).replace(/-/g, "_")}`;
    const power = typeof args.power === "number" && Number.isFinite(args.power) ? Math.max(1, Math.round(args.power)) : (preset?.power ?? 145);
    const mp = typeof args.mpCost === "number" && Number.isFinite(args.mpCost) ? Math.max(0, Math.round(args.mpCost)) : (preset?.mp ?? 4);
    const scope = (typeof args.scope === "string" ? (args.scope as SkillRecord["scope"]) : undefined) ?? preset?.scope ?? "allEnemies";
    const skillRecord = normalizeSkillRecord({
      id: skillId,
      name: skillName,
      description,
      scope,
      power,
      mpCost: { flat: mp, percentMax: 0 },
      successRate: 100,
      hitRate: 100,
      variance: 15,
      effect: motion === "buff" ? { kind: "support" } : { kind: "damage", statistic: "mind", affects: "hp" },
      elementId: element,
      animationId: preset?.animation ?? anim("holy-beam"),
      retroChoreographyId: choreographyId,
    });
    const existingSkillIdx = draft.database.skills.findIndex((s) => s.id === skillRecord.id);
    if (existingSkillIdx >= 0) draft.database.skills[existingSkillIdx] = skillRecord;
    else draft.database.skills.push(skillRecord);

    // 적 행동(actions) 배선:
    // 1) HP 임계치 보스 페이즈 조건(주어졌을 때 priority 9)
    // 2) 평시 시그니처 발동(priority 8, always) — 첫 턴부터 (0,2) 스킬 포즈와 광선 연출이 바로 발동되도록 보장
    // 3) 통상 공격 앵커(skill_attack, priority 7) 보존
    const hpThreshold = typeof args.hpThresholdPercent === "number" && Number.isFinite(args.hpThresholdPercent)
      ? Math.max(1, Math.min(100, Math.round(args.hpThresholdPercent)))
      : 70;
    const makePattern = (sId: string, priority: number, condition: EnemyActionCondition): EnemyActionPattern => ({
      skillId: sId,
      priority,
      condition,
      switchOnAfterAction: { enabled: false },
      switchOffAfterAction: { enabled: false },
    });

    const otherActions = (enemy.actions ?? []).filter((a) => a.skillId !== skillRecord.id && a.skillId !== "skill_attack");
    const nextActions: EnemyActionPattern[] = [
      makePattern(skillRecord.id, 9, { kind: "hp", minPercent: 0, maxPercent: hpThreshold }),
      makePattern(skillRecord.id, 8, { kind: "always" }),
      ...otherActions,
      makePattern("skill_attack", 7, { kind: "always" }),
    ];
    const normalizedEnemy = normalizeEnemyRecord({
      ...enemy,
      stats: {
        ...enemy.stats,
        maxMp: Math.max(enemy.stats.maxMp, mp * 12),
      },
      actions: nextActions,
      skillIds: [...new Set(nextActions.map((a) => a.skillId))],
    });
    enemy.stats = normalizedEnemy.stats;
    enemy.actions = normalizedEnemy.actions;
    enemy.skillIds = normalizedEnemy.skillIds;
    setSelectedRecordId("enemies", enemy.id, { reveal: true });

    // 연결된 저작 도트 시트의 skillCell:(0,2) 포즈 패치 및 메타 갱신
    let sheetPatched = false;
    const targetResId = resourceId ?? enemy.monsterResourceId;
    if (targetResId && isAuthoredMonsterAsset(draft, targetResId)) {
      const uploadedAsset = draft.assets.uploaded[targetResId]!;
      const meta = uploadedAsset.meta.pixelEnemySheet!;
      const savedRecipe = (meta.recipe ?? {}) as MonsterPixelRecipe;
      const nextSlug = args.skillSlug !== undefined
        ? resolveSkillSlug(savedRecipe.archetype, args.skillSlug)
        : meta.skillSlug;
      const shouldPatchCell02 = args.patchSkillCell02 !== false;
      const patchPreset = element === "holy"
        ? "holy_ray"
        : element === "dark"
          ? "dark_flame"
          : element === "ice"
            ? "frost_shard"
            : element === "thunder"
              ? "lightning_arc"
              : "rune_halo";
      const existingPatches = savedRecipe.cellPatches ?? {};
      const has02Patch = Boolean(existingPatches.recover || existingPatches.skill || existingPatches["(0,2)"]);
      const updatedRecipe: MonsterPixelRecipe = shouldPatchCell02 && !has02Patch
        ? {
            ...savedRecipe,
            cellPatches: {
              ...existingPatches,
              "(0,2)": { preset: patchPreset },
            },
          }
        : savedRecipe;
      const regenerated = generateMonsterPixelSheet({
        ...updatedRecipe,
        name: enemy.name,
        cell: meta.cell,
        motion: meta.motion,
      });
      writeAuthoredMonsterAssets(draft, targetResId, regenerated, {
        recipe: updatedRecipe,
        skillSlug: nextSlug,
        generatedBy: "monster-pixel-studio:ai-choreo",
      });
      sheetPatched = shouldPatchCell02 && !has02Patch;
    }

    return {
      summary: `적 '${enemy.name}'(${enemy.id}) 전용 스킬 '${skillRecord.name}'(${skillRecord.id}) 안무(${choreographyId}) 배선 완료 — (0,2) 스킬 포즈 트리거 활성 · 보스 페이즈(HP ≤ ${hpThreshold}%) + 시그니처 행동 등록`,
      data: {
        enemyId: enemy.id,
        enemyName: enemy.name,
        resourceId: targetResId,
        skill: {
          id: skillRecord.id,
          name: skillRecord.name,
          description: skillRecord.description,
          motion,
          element,
          power: skillRecord.power,
          mpCost: mp,
          scope: skillRecord.scope,
          retroChoreographyId: choreographyId,
          layers: resolvedLayersSummary,
        },
        triggerSkillCell02: true,
        sheetPatched02: sheetPatched,
        hpThresholdPercent: hpThreshold,
        actions: enemy.actions,
      },
    };
  },
};

export const ENEMY_PIXEL_SHEET_TOOLS: readonly ToolDefinition[] = [
  listMonsterPixelArchetypes,
  inspectEnemyPixelSheet,
  authorEnemyPixelSheet,
  editEnemyPixelSheet,
  setEnemySkillChoreography,
];
