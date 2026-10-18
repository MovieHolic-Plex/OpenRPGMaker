// author_enemy_pixel_sheet — 에디터 안에서 새 몬스터의 retro2003 9칸 전투 도트 시트(3×3)와 한 칸 초상을 만들어
// project.assets.uploaded 에 넣고, 원하면 같은 호출에서 적 레코드(upsert_enemy 와 같은 검증)까지 이어 붙인다.
//
// 저장 계약(src/assets/pixelEnemySheets.ts projectPixelEnemySheet):
//   uploaded[resourceId]          kind:"monster" 한 칸 초상(idle_a) + meta.pixelEnemySheet{ sheetResourceId, cell, motion, idleFrameMs, skillCell, skillSlug, recipe }
//   uploaded[resourceId-sheet]    kind:"picture" 3×3 시트 PNG
// 적 레코드의 monsterResourceId = resourceId 이면 DB 미리보기·실제 전투가 번들 시트와 똑같이 9칸을 돌린다.
// 편집기 「도트 몬스터 공방」 대화상자도 writeAuthoredMonsterAssets 로 같은 자산을 쓴다.
import type { PixelEnemyCell, PixelEnemyMotion } from "@/assets/pixelEnemySheets";
import { RETRO_MONSTER_SKILLSETS } from "@/assets/retroMonsterSkills";
import {
  generateMonsterPixelSheet,
  MONSTER_ARCHETYPES,
  MONSTER_MOTIONS,
  MONSTER_PIXEL_CHARS,
  MONSTER_SHEET_CELLS,
  MONSTER_SHEET_ORDER,
  MONSTER_WEAPONS,
  MonsterPixelRecipeError,
  type MonsterArchetype,
  type MonsterPixelRecipe,
  type MonsterPixelSheet,
} from "@/editor/monsterPixelStudio";
import { retroMonsterActions, retroMonsterSkillRecords } from "@/project/defaults/retroMonsterSkillRecords";
import type { EnemyActionPattern, Project } from "@/project/types";
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
        recipe: { ...recipeWithoutCells, ...(options.recipe.cells ? { customCells: Object.keys(options.recipe.cells) } : {}) },
      },
    },
    generatedBy: options.generatedBy,
  };
  return sheetResourceId;
}

/** 공방 레시피의 스킬 묶음(원형 기본값). 알 수 없는 키는 ToolError. */
export function resolveSkillSlug(archetype: MonsterArchetype | undefined, requested: unknown): string | undefined {
  if (requested !== undefined) {
    if (typeof requested !== "string" || !Object.hasOwn(RETRO_MONSTER_SKILLSETS, requested)) {
      throw new ToolError(`skillSlug 는 번들 몬스터 스킬 묶음 키다(예: ${Object.keys(RETRO_MONSTER_SKILLSETS).slice(0, 8).join(", ")} …): ${JSON.stringify(requested)}`, { code: "invalid-args" });
    }
    return requested;
  }
  return archetype ? ARCHETYPE_SKILL_SLUGS[archetype] : undefined;
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
  const pick = <T>(key: string): T | undefined => (args[key] === undefined ? undefined : (args[key] as T));
  return {
    name: pick<string>("name"),
    archetype: pick<MonsterArchetype>("archetype"),
    primaryColor: pick<string>("primaryColor"),
    secondaryColor: pick<string>("secondaryColor"),
    accentColor: pick<string>("accentColor"),
    weapon: pick("weapon"),
    cell: pick("cell"),
    motion: pick<PixelEnemyMotion>("motion"),
    spikes: pick<boolean>("spikes"),
    horns: pick<boolean>("horns"),
    ...(cells ? { cells: cells as MonsterPixelRecipe["cells"] } : {}),
  };
}

const colorSchema = (what: string): JsonSchema => ({ type: "string", pattern: "^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$", description: `#rrggbb — ${what}` });

const authorEnemyPixelSheet: ToolDefinition = {
  name: "author_enemy_pixel_sheet",
  description:
    "새 몬스터의 retro2003 전투 도트를 직접 그린다: 3×3 9칸 시트(idle_a·idle_b·idle_c 대기 루프, windup·move·attack 공격, (0,2) 스킬 방출, hit, dead) + 한 칸 초상을 " +
    "project.assets.uploaded 에 넣는다. 오른쪽(아군 쪽)을 보고 발은 y=cell-4 에 선다. 번들 몬스터 그림에 맞는 것이 없거나 사용자가 새 몬스터를 「만들어/도트 찍어」 달라고 하면 이 도구를 쓴다. " +
    "모드 A: archetype(몸 원형) + 세 색 + weapon 으로 관절 리그가 9자세를 합성한다. 모드 B: cells 에 칸별 문자 격자(위→아래 줄, 문자표는 결과 palette)를 주면 그 칸은 그대로 찍고 빠진 칸은 원형 리그나 대기 a 변형으로 채운다. " +
    "enemy 를 주면 같은 호출에서 upsert_enemy 와 같은 검증으로 적 레코드를 만들거나 고치고 monsterResourceId 를 이 시트로 잇는다(actions 를 비우면 skillSlug 의 몬스터 스킬을 붙여 전투에서 (0,2) 스킬 칸이 쓰인다). " +
    "그다음 upsert_troop 로 무리를 만들고 set_encounter_table·place_field_enemy 등으로 맵에 배치한다. Draws a brand-new 9-pose pixel battle sheet for a monster; never reuse an unrelated bundled monster when the user asks for a new one.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, description: "몬스터 이름(시트·적 이름 기본값)." },
      archetype: { type: "string", enum: MONSTER_ARCHETYPES, description: "몸 원형. beast 네발짐승·humanoid-knight 검사/기사·winged-fiend 날개 악마·slime-ooze 슬라임·golem-construct 골렘·plant-hydra 식물/히드라·dragon-boss 드래곤·caster-wraith 망령 술사. 모드 B(cells.idle_a)만 쓰면 생략 가능." },
      primaryColor: colorSchema("몸통 색"),
      secondaryColor: colorSchema("갑옷·배·잎 같은 둘째 재질"),
      accentColor: colorSchema("가시·수정·눈빛·스킬 빛"),
      weapon: { type: "string", enum: MONSTER_WEAPONS, description: "무기/공격 부위. 생략 시 원형 기본값." },
      cell: { type: "integer", enum: MONSTER_SHEET_CELLS, description: "칸 크기 px. 48 잡몹 · 64 기본 · 96 보스/거신." },
      motion: { type: "string", enum: MONSTER_MOTIONS, description: "전투 접근 방식: hop 박치기·swoop 급강하·stomp 내려찍기·dash 달려들기·float 스르르·shoot 제자리 사격·breath 제자리 숨결." },
      spikes: { type: "boolean", description: "등·어깨 수정 가시." },
      horns: { type: "boolean", description: "머리 뿔." },
      cells: {
        type: "object",
        additionalProperties: true,
        description: `모드 B 칸별 문자 격자 { idle_a: ["....oo....", ...], attack: [...] }. 문자: ${Object.entries(MONSTER_PIXEL_CHARS).map(([ch, label]) => `${ch}=${label}`).join(" ")}. cell×cell 보다 작으면 가로 가운데·아래 기준선에 맞춘다.`,
      },
      skillSlug: { type: "string", description: "미리보기·전투 스킬로 쓸 번들 몬스터 스킬 묶음(예: wolf-grey, skeleton-knight, dragon, lich-frost). 생략 시 원형 기본값." },
      resourceId: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{2,63}$", description: "uploaded 자산 id(영소문자·숫자·-). 생략 시 enemy.id 나 이름으로 정한다. 같은 id 로 다시 부르면 그 몬스터 그림을 고쳐 그린다." },
      enemy: {
        type: "object",
        additionalProperties: true,
        description: "적 레코드 패치(upsert_enemy 의 enemy 와 같다: id·name·stats·rewards·actions·elementRates…). 주면 monsterResourceId 를 이 시트로 잇는다. id 를 생략하면 새 id 를 만든다.",
      },
      role: { type: "string", enum: ["boss", "normal"], description: "enemy 와 함께: boss 면 시작 파티 기준 위협 하한을 맞춘다." },
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

export const ENEMY_PIXEL_SHEET_TOOLS: readonly ToolDefinition[] = [authorEnemyPixelSheet];
