// editor/tools/terrainTemplateTools.ts
// 지형 템플릿(타일셋의 구조물 지식뱅크) 소비 툴 4종.
// - list_terrain_templates: 어떤 구조물 지식이 있는지 훑기.
// - get_terrain_template: rows/grammar/rules 전체 + 타일 라벨 조인(단어장↔교과서 2계층 연결).
// - stamp_terrain_template: buildPlan이 있는 템플릿을 결정적으로 실행.
// - validate_structure: grammar의 mustTouch(위쪽 인접 역할)·overlay 제약을 기계 검증 —
//   LLM이 grammar 조립으로 지은 구조물의 자가 검사 루프를 만든다.

import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { stampTerrainTemplateHouse, terrainTemplateDoorBottomOffset } from "@/project/defaults/terrainTemplateHouseStamp";
import type { SmallHouseMaterial } from "@/project/defaults/dbExtractedHouseTemplate";
import type {
  GameMap,
  Project,
  TerrainTemplateBuildPlan,
  TerrainTemplateGrammarRule,
  TerrainTemplateMetadata,
  TilesetDef,
} from "@/project/types";
import { requireMap } from "./mapHelpers";
import { extractTerrainTemplateDraft } from "./terrainTemplateExtract";
import { knownTileLabel } from "./tileMetadataTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const HOUSE_MATERIALS: readonly SmallHouseMaterial[] = ["plaster", "wood", "stone"];

function templatesOf(tileset: TilesetDef): readonly TerrainTemplateMetadata[] {
  return tileset.terrainTemplates ?? [];
}

function requireTilesetForTemplates(project: Project, tilesetId: unknown): TilesetDef {
  const id = (tilesetId as string | undefined) ?? DEFAULT_TILESET_ID;
  const tileset = project.tilesets[id];
  if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${id}`, { code: "tileset-not-found" });
  return tileset;
}

function requireTemplate(tileset: TilesetDef, templateId: unknown): TerrainTemplateMetadata {
  const id = String(templateId ?? "");
  const template = templatesOf(tileset).find((entry) => entry.id === id);
  if (!template) {
    const known = templatesOf(tileset).map((entry) => entry.id).join(", ") || "(없음)";
    throw new ToolError(`지형 템플릿을 찾을 수 없습니다: ${id} (보유: ${known})`, { code: "template-not-found" });
  }
  return template;
}

// 템플릿이 참조하는 모든 타일 번호 → 알려진 라벨 사전(단어장 조인).
function templateTileLabels(tileset: TilesetDef, template: TerrainTemplateMetadata): Record<number, string> {
  const tiles = new Set<number>();
  for (const row of template.rows) {
    for (const tile of [...row.lower, ...row.upper, ...row.stack]) tiles.add(tile);
  }
  for (const rule of template.grammar ?? []) {
    for (const tile of grammarRuleTiles(rule)) tiles.add(tile);
  }
  const labels: Record<number, string> = {};
  for (const tile of tiles) {
    const label = knownTileLabel(tileset, tile);
    if (label) labels[tile] = label;
  }
  return labels;
}

function grammarRuleTiles(rule: TerrainTemplateGrammarRule): number[] {
  const tiles = [...(rule.tiles ?? [])];
  for (const tile of [rule.left, rule.middle, rule.right]) {
    if (typeof tile === "number") tiles.push(tile);
  }
  return [...new Set(tiles)];
}

// ── list_terrain_templates ───────────────────────────────────────
const listTerrainTemplates: ToolDefinition = {
  name: "list_terrain_templates",
  description:
    "타일셋의 지형 템플릿(구조물 지식뱅크) 목록을 반환한다. hasBuildPlan=true면 stamp_terrain_template로 바로 찍을 수 있고, 아니면 get_terrain_template의 grammar대로 조립한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: { tilesetId: { type: "string", description: "생략 시 기본 타일셋" } },
  },
  run(project, args): ToolExecResult {
    const tileset = requireTilesetForTemplates(project, args.tilesetId);
    const templates = templatesOf(tileset).map((template) => ({
      id: template.id,
      name: template.name,
      tags: template.tags ?? [],
      source: template.source ?? "bundled-default",
      hasBuildPlan: Boolean(template.buildPlan),
      ruleCount: template.rules.length,
    }));
    return {
      summary: `지형 템플릿 ${templates.length}개(${tileset.id})`,
      data: { tilesetId: tileset.id, templates },
    };
  },
};

// ── get_terrain_template ─────────────────────────────────────────
const getTerrainTemplate: ToolDefinition = {
  name: "get_terrain_template",
  description:
    "지형 템플릿의 전체 지식(rows 사례/grammar 문법/rules 금기/buildPlan)을 타일 라벨 사전과 함께 반환한다. 구조물을 짓기 전에 반드시 읽어라.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      templateId: { type: "string" },
      tilesetId: { type: "string", description: "생략 시 기본 타일셋" },
    },
    required: ["templateId"],
  },
  run(project, args): ToolExecResult {
    const tileset = requireTilesetForTemplates(project, args.tilesetId);
    const template = requireTemplate(tileset, args.templateId);
    return {
      summary: `템플릿 '${template.name}' — 행 ${template.rows.length}, 문법 ${template.grammar?.length ?? 0}, 규칙 ${template.rules.length}${template.buildPlan ? ", 스탬프 가능" : ""}`,
      data: {
        tilesetId: tileset.id,
        template,
        tileLabels: templateTileLabels(tileset, template),
      },
    };
  },
};

// ── stamp_terrain_template ───────────────────────────────────────
function buildPlanFootprint(buildPlan: TerrainTemplateBuildPlan): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  const extend = (x: number, y: number): void => {
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  extend(buildPlan.fence.x + buildPlan.fence.width, buildPlan.fence.y + buildPlan.fence.height);
  extend(buildPlan.house.roof.origin.x + buildPlan.house.roof.width, buildPlan.house.roof.origin.y + 4);
  extend(buildPlan.house.wall.origin.x + buildPlan.house.wall.width, buildPlan.house.wall.origin.y + buildPlan.house.wall.rows);
  extend(buildPlan.house.door.x + 1, buildPlan.house.door.bottomY + 1);
  for (const road of buildPlan.roads) extend(road.x + road.width, road.y + road.height);
  return { width: maxX, height: maxY };
}

const stampTerrainTemplate: ToolDefinition = {
  name: "stamp_terrain_template",
  description:
    "buildPlan이 있는 지형 템플릿을 맵에 결정적으로 찍는다(울타리+집+창문+문, paintRoads=true면 진입로까지). buildPlan이 없는 템플릿은 get_terrain_template의 grammar대로 paint_tiles로 조립하라.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      templateId: { type: "string" },
      origin: { type: "object", description: "{x,y} 좌상단" },
      material: { type: "string", enum: HOUSE_MATERIALS as unknown as string[], description: "벽 재질(기본 plaster)" },
      includeFence: { type: "boolean", description: "울타리 포함(기본 true)" },
      paintRoads: { type: "boolean", description: "템플릿의 진입로 rect까지 깔기(기본 false)" },
    },
    required: ["mapId", "templateId", "origin"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const tileset = requireTilesetForTemplates(draft, map.tilesetId);
    const template = requireTemplate(tileset, args.templateId);
    if (!template.buildPlan) {
      throw new ToolError(
        `템플릿 '${template.id}'에는 buildPlan이 없습니다 — get_terrain_template의 grammar/rows대로 paint_tiles로 조립하고 validate_structure로 검사하세요.`,
        { code: "no-build-plan" }
      );
    }
    const material = (args.material as SmallHouseMaterial | undefined) ?? "plaster";
    if (!HOUSE_MATERIALS.includes(material)) {
      throw new ToolError(`알 수 없는 재질: ${String(args.material)} (${HOUSE_MATERIALS.join("/")})`, { code: "invalid-args" });
    }
    const origin = args.origin as { x: number; y: number };
    const footprint = buildPlanFootprint(template.buildPlan);
    if (origin.x < 0 || origin.y < 0 || origin.x + footprint.width > map.width || origin.y + footprint.height > map.height) {
      throw new ToolError(
        `템플릿 발자국(${footprint.width}×${footprint.height})이 맵을 벗어납니다 — origin (${origin.x},${origin.y}), 맵 ${map.width}×${map.height}`,
        { code: "out-of-bounds", mapId: map.id, x: origin.x, y: origin.y }
      );
    }
    stampTerrainTemplateHouse(map, {
      buildPlan: template.buildPlan,
      material,
      origin,
      includeFence: args.includeFence === undefined ? true : args.includeFence === true,
      paintRoads: args.paintRoads === true,
    });
    const doorOffset = terrainTemplateDoorBottomOffset(template.buildPlan);
    const door = { x: origin.x + doorOffset.x, y: origin.y + doorOffset.y };
    return {
      summary: `${map.name}에 템플릿 '${template.name}'(${material}) 스탬프(${origin.x},${origin.y}) — 문 (${door.x},${door.y})`,
      data: { door, templateId: template.id, material },
    };
  },
};

// ── validate_structure ───────────────────────────────────────────
interface StructureViolation {
  x: number;
  y: number;
  role: string;
  message: string;
}

function tileAt(map: GameMap, layer: "lower" | "upper", x: number, y: number): number | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  const index = y * map.width + x;
  return layer === "lower" ? map.lowerTiles[index] : map.upperTiles[index];
}

// grammar 역할별 타일 집합.
function roleTileSets(template: TerrainTemplateMetadata): Map<string, { layer: "lower" | "upper"; tiles: Set<number> }> {
  const roles = new Map<string, { layer: "lower" | "upper"; tiles: Set<number> }>();
  for (const rule of template.grammar ?? []) {
    const layer = rule.layer === "upper" ? "upper" : "lower";
    const entry = roles.get(rule.role) ?? { layer, tiles: new Set<number>() };
    for (const tile of grammarRuleTiles(rule)) entry.tiles.add(tile);
    roles.set(rule.role, entry);
  }
  return roles;
}

// "opening" 섹션(문 등) 타일 — 벽 행 검사에서 대체 허용.
function openingTiles(template: TerrainTemplateMetadata): Set<number> {
  const tiles = new Set<number>();
  for (const row of template.rows) {
    if (row.section !== "opening") continue;
    for (const tile of [...row.lower, ...row.upper]) tiles.add(tile);
  }
  return tiles;
}

const validateStructure: ToolDefinition = {
  name: "validate_structure",
  description:
    "맵 영역의 구조물이 지형 템플릿 grammar를 지키는지 기계 검증한다(mustTouch 인접 제약·overlay 레이어·지붕 아래 벽). 조립으로 구조물을 지은 뒤 반드시 호출해 위반을 고쳐라.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      templateId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      w: { type: "integer" },
      h: { type: "integer" },
    },
    required: ["mapId", "templateId", "x", "y", "w", "h"],
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, args.mapId as string);
    const tileset = requireTilesetForTemplates(project, map.tilesetId);
    const template = requireTemplate(tileset, args.templateId);
    const grammar = template.grammar ?? [];
    if (grammar.length === 0) {
      return { summary: `템플릿 '${template.id}'에 grammar가 없어 검사할 규칙이 없습니다.`, data: { ok: true, violations: [] } };
    }
    const roles = roleTileSets(template);
    const opening = openingTiles(template);
    const x0 = Math.max(0, args.x as number);
    const y0 = Math.max(0, args.y as number);
    const x1 = Math.min(map.width, x0 + (args.w as number));
    const y1 = Math.min(map.height, y0 + (args.h as number));
    const violations: StructureViolation[] = [];
    let checkedCells = 0;

    for (const rule of grammar) {
      const layer = rule.layer === "upper" ? "upper" : "lower";
      const ruleTiles = new Set(grammarRuleTiles(rule));
      // mustTouch: 이 역할의 칸 바로 위에는 지정 역할(들)의 타일이 있어야 한다.
      const touchRoles = rule.mustTouch ? rule.mustTouch.split("-or-") : [];
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const tile = tileAt(map, layer, x, y);
          if (tile === undefined || !ruleTiles.has(tile)) continue;
          checkedCells += 1;
          if (touchRoles.length > 0) {
            const satisfied = touchRoles.some((roleName) => {
              const target = roles.get(roleName);
              if (!target) return false;
              const above = tileAt(map, target.layer, x, y - 1);
              return above !== undefined && target.tiles.has(above);
            });
            // 문 등 opening 타일이 위 칸을 대체하는 경우는 허용.
            const aboveLower = tileAt(map, "lower", x, y - 1);
            const openingOk = aboveLower !== undefined && opening.has(aboveLower);
            if (!satisfied && !openingOk) {
              violations.push({
                x, y, role: rule.role,
                message: `(${x},${y}) ${rule.role} 위 칸이 ${rule.mustTouch}가 아닙니다 — ${rule.meaning.slice(0, 60)}`,
              });
            }
          }
        }
      }
      // overlay 규칙: 해당 타일이 반대 레이어에 깔려 있으면 위반.
      if (rule.kind === "overlay" && layer === "upper") {
        for (let y = y0; y < y1; y += 1) {
          for (let x = x0; x < x1; x += 1) {
            const lower = tileAt(map, "lower", x, y);
            if (lower !== undefined && ruleTiles.has(lower)) {
              violations.push({ x, y, role: rule.role, message: `(${x},${y}) ${rule.role} 타일 ${lower}은 상위 레이어 전용인데 하위에 깔렸습니다.` });
            }
          }
        }
      }
    }

    // 역방향: 다른 역할이 mustTouch로 기대는 대상(예: roof-lower-slope) 아래에는
    // 그 역할(예: wall-top) 또는 opening 타일이 반드시 와야 한다 — "지붕 아래 벽 없음"을 잡는다.
    const targetedBy = new Map<string, string[]>();
    for (const rule of grammar) {
      if (!rule.mustTouch) continue;
      for (const roleName of rule.mustTouch.split("-or-")) {
        targetedBy.set(roleName, [...(targetedBy.get(roleName) ?? []), rule.role]);
      }
    }
    for (const [targetRole, dependentRoles] of targetedBy) {
      const target = roles.get(targetRole);
      if (!target) continue;
      const allowedBelow = new Set<number>(opening);
      for (const dependent of dependentRoles) {
        for (const tile of roles.get(dependent)?.tiles ?? []) allowedBelow.add(tile);
      }
      // 같은 역할 반복(다층 지붕 등)도 허용.
      for (const tile of target.tiles) allowedBelow.add(tile);
      const dependentLayers = new Set(dependentRoles.map((role) => roles.get(role)?.layer ?? "lower"));
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const tile = tileAt(map, target.layer, x, y);
          if (tile === undefined || !target.tiles.has(tile)) continue;
          const belowMatches = [...dependentLayers, "lower" as const].some((layer) => {
            const below = tileAt(map, layer, x, y + 1);
            return below !== undefined && allowedBelow.has(below);
          });
          if (!belowMatches) {
            violations.push({
              x, y, role: targetRole,
              message: `(${x},${y}) ${targetRole} 아래 칸에 ${dependentRoles.join("/")}가 없습니다 — 지붕/벽 행 순서를 확인하세요.`,
            });
          }
        }
      }
    }

    const capped = violations.slice(0, 30);
    return {
      summary: violations.length === 0
        ? `구조 검증 통과 — '${template.id}' 규칙 위반 없음(검사 ${checkedCells}칸)`
        : `구조 위반 ${violations.length}건 — 첫 위반: ${capped[0].message}`,
      data: { ok: violations.length === 0, violations: capped, truncated: violations.length > capped.length, checkedCells },
    };
  },
};

// ── extract_terrain_template ─────────────────────────────────────
const extractTerrainTemplate: ToolDefinition = {
  name: "extract_terrain_template",
  description:
    "사람이 깐 맵 영역에서 지형 템플릿 초안(rows/grammar/mustTouch 추측 + guessSummary)을 추출한다. guessSummary를 사용자에게 먼저 보여주고 확인받은 뒤 upsert_terrain_template로 저장하라.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      w: { type: "integer" },
      h: { type: "integer" },
      name: { type: "string", description: "템플릿 이름 초안" },
    },
    required: ["mapId", "x", "y", "w", "h"],
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, args.mapId as string);
    const tileset = requireTilesetForTemplates(project, map.tilesetId);
    const x = Math.max(0, args.x as number);
    const y = Math.max(0, args.y as number);
    const w = Math.min(30, Math.max(1, Math.min(map.width - x, args.w as number)));
    const h = Math.min(30, Math.max(1, Math.min(map.height - y, args.h as number)));
    const draft = extractTerrainTemplateDraft(tileset, map, { x, y, w, h }, (args.name as string | undefined) ?? "새 구조물 템플릿");
    return {
      summary: `구조물 초안 추출 — 행 패턴 ${draft.grammar.length}개, 영역 (${x},${y}) ${w}×${h}`,
      data: { draft },
    };
  },
};

// ── upsert_terrain_template ──────────────────────────────────────
function templateSlug(name: string, existing: readonly TerrainTemplateMetadata[]): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "") || "template";
  let slug = base;
  let counter = 2;
  while (existing.some((template) => template.id === slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  return slug;
}

function sanitizeTiles(tileset: TilesetDef, value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((tile) => Number(tile))
    .filter((tile) => Number.isInteger(tile) && tile >= 0 && tile < tileset.count);
}

const upsertTerrainTemplate: ToolDefinition = {
  name: "upsert_terrain_template",
  description:
    "지형 템플릿(구조물 지식)을 저장한다. 사용자가 인터뷰로 확정한 내용이면 confirmedByUser=true. 기존 템플릿 갱신은 confirmedByUser=true일 때만 허용된다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "생략 시 기본 타일셋" },
      id: { type: "string", description: "기존 템플릿 갱신 시 지정. 생략하면 이름에서 생성" },
      name: { type: "string" },
      sourceMapName: { type: "string" },
      rows: { type: "array", description: "TerrainTemplateRow[] — extract 초안을 다듬어 전달", items: { type: "object", additionalProperties: true } },
      grammar: { type: "array", description: "TerrainTemplateGrammarRule[]", items: { type: "object", additionalProperties: true } },
      rules: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      sourceRegion: { type: "object", description: "{mapId,x,y,w,h} 추출 원본 영역", additionalProperties: true },
      confirmedByUser: { type: "boolean" },
    },
    required: ["name"],
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTilesetForTemplates(draft, args.tilesetId);
    const name = (args.name as string).trim();
    if (!name) throw new ToolError("템플릿 이름이 비어 있습니다.", { code: "invalid-args" });
    const confirmed = args.confirmedByUser === true;
    tileset.terrainTemplates ??= [];
    const requestedId = (args.id as string | undefined)?.trim();
    const existing = requestedId ? tileset.terrainTemplates.find((template) => template.id === requestedId) : undefined;
    if (requestedId && !existing) {
      throw new ToolError(`템플릿을 찾을 수 없습니다: ${requestedId} (새 템플릿이면 id를 생략하세요)`, { code: "template-not-found" });
    }
    if (existing && !confirmed) {
      // 기존 지식(번들/사용자 확정)을 AI 추측이 조용히 덮지 못하게 한다.
      throw new ToolError(`기존 템플릿 '${requestedId}' 갱신은 confirmedByUser=true(사용자 확인)일 때만 가능합니다.`, { code: "template-locked" });
    }

    const rawRows = Array.isArray(args.rows) ? (args.rows as Record<string, unknown>[]) : [];
    const rows = rawRows.map((row) => ({
      section: typeof row.section === "string" ? row.section : "row",
      coord: typeof row.coord === "string" ? row.coord : "",
      lower: sanitizeTiles(tileset, row.lower),
      upper: sanitizeTiles(tileset, row.upper),
      stack: sanitizeTiles(tileset, row.stack),
      meaning: typeof row.meaning === "string" ? row.meaning : "",
    }));
    const rawGrammar = Array.isArray(args.grammar) ? (args.grammar as Record<string, unknown>[]) : [];
    const grammar = rawGrammar.map((rule) => ({
      kind: (rule.kind === "roof-row" || rule.kind === "overlay" ? rule.kind : "wall-row") as "overlay" | "roof-row" | "wall-row",
      role: typeof rule.role === "string" ? rule.role : "row",
      layer: (rule.layer === "upper" ? "upper" : "lower") as "lower" | "upper",
      ...(typeof rule.left === "number" ? { left: rule.left } : {}),
      ...(typeof rule.middle === "number" ? { middle: rule.middle } : {}),
      ...(typeof rule.right === "number" ? { right: rule.right } : {}),
      ...(Array.isArray(rule.tiles) ? { tiles: sanitizeTiles(tileset, rule.tiles) } : {}),
      meaning: typeof rule.meaning === "string" ? rule.meaning : "",
      ...(typeof rule.mustTouch === "string" ? { mustTouch: rule.mustTouch } : {}),
    }));

    const target: TerrainTemplateMetadata = existing ?? {
      id: templateSlug(name, tileset.terrainTemplates),
      name,
      sourceMapName: "",
      rows: [],
      rules: [],
    };
    target.name = name;
    if (typeof args.sourceMapName === "string") target.sourceMapName = args.sourceMapName;
    if (rows.length > 0) target.rows = rows;
    if (grammar.length > 0) target.grammar = grammar;
    if (Array.isArray(args.rules)) target.rules = (args.rules as unknown[]).filter((rule): rule is string => typeof rule === "string");
    if (Array.isArray(args.tags)) target.tags = (args.tags as unknown[]).filter((tag): tag is string => typeof tag === "string");
    const region = args.sourceRegion as { mapId?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown } | undefined;
    if (region && typeof region.mapId === "string") {
      target.sourceRegion = {
        mapId: region.mapId,
        x: Number(region.x) || 0,
        y: Number(region.y) || 0,
        w: Number(region.w) || 1,
        h: Number(region.h) || 1,
      };
    }
    target.source = confirmed ? "user" : "ai";
    if (!existing) tileset.terrainTemplates.push(target);
    return {
      summary: `지형 템플릿 '${name}' ${existing ? "갱신" : "저장"}${confirmed ? "(사용자 확정)" : "(AI 초안)"} — 행 ${target.rows.length}, 문법 ${target.grammar?.length ?? 0}`,
      data: { templateId: target.id, created: !existing },
    };
  },
};

export const TERRAIN_TEMPLATE_TOOLS: readonly ToolDefinition[] = [
  listTerrainTemplates,
  getTerrainTemplate,
  stampTerrainTemplate,
  validateStructure,
  extractTerrainTemplate,
  upsertTerrainTemplate,
];
