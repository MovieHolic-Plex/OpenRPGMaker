// build_castle — 성채 모듈(지붕면/성벽/원형타워) 결정론 시공.
// 금본: map_castle_keep + openwiki/castle-map.md

import { stampCastle, type Rect } from "@/editor/castleKit";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";
import { EVENT_TOOLS } from "./eventTools";
import { MAP_TOOLS } from "./mapTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const DEFAULT_W = 48;
const DEFAULT_H = 40;
const MIN_W = 28;
const MIN_H = 24;
const MAX_SIZE = 256;

const createMapTool = requireTool(MAP_TOOLS, "create_map");
const paintRoadTool = requireTool(MAP_TOOLS, "paint_road");
const placeNpcTool = requireTool(EVENT_TOOLS, "place_npc");

export const CASTLE_TOOLS: readonly ToolDefinition[] = [
  {
    name: "build_castle",
    description:
      "성채 맵을 모듈 문법으로 시공한다(권장 정공법). " +
      "지붕/여장 면(18–110) + 성벽 정면(21/51*/81) + 원형 타워(24|25↑·138–143·54|55↑) + 남문 모래 접근로. " +
      "타일 ID를 직접 고르지 말 것. mapId 없으면 새 맵 생성. bounds로 기존 맵 일부에 시공 가능. " +
      "마당은 잔디 통행 유지(지붕 타일 금지). 최소 영역 28×24, 기본 48×40.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string", description: "기존 맵 id. 생략 시 새 맵 생성." },
        name: { type: "string", description: "새 맵 이름(기본: 성채)" },
        id: { type: "string", description: "새 맵 id(생략 시 자동)" },
        width: { type: "integer", description: "새 맵 가로(기본 48, 28~256)" },
        height: { type: "integer", description: "새 맵 세로(기본 40, 24~256)" },
        bounds: {
          type: "object",
          description: "기존/새 맵 안 시공 사각형. 생략 시 맵 전체(가장자리 여유 포함).",
          properties: {
            x: { type: "integer" },
            y: { type: "integer" },
            w: { type: "integer" },
            h: { type: "integer" },
          },
          required: ["x", "y", "w", "h"],
        },
        wallHeight: { type: "integer", description: "성벽 정면 높이(기본 3, 2~6)" },
        gateWidth: { type: "integer", description: "남문 폭(기본 4, 2~8)" },
        roundTower: { type: "boolean", description: "마당 원형 타워(기본 true)" },
        roundTowerHeight: { type: "integer", description: "원형 타워 높이(기본 7, 5~12)" },
        path: { type: "boolean", description: "남문 모래 접근로(기본 true)" },
        npcs: { type: "boolean", description: "문지기·성주 NPC(기본 true)" },
        seed: { type: "integer", description: "경로 자연도 시드(기본 4201)" },
      },
    },
    invalidArgsExample: { name: "성채2", width: 48, height: 40, seed: 7 },
    run(draft, args): ToolExecResult {
      const seed = integerArg(args, "seed", 4201);
      const pathEnabled = args.path !== false;
      const npcsEnabled = args.npcs !== false;
      const warnings: string[] = [];

      const mapId =
        typeof args.mapId === "string" && args.mapId.trim().length > 0
          ? args.mapId.trim()
          : createCastleMap(draft, args, seed);
      const map = requireMap(draft, mapId);
      ensureCombinedTown(draft, map, warnings);

      const area = resolveArea(map, args.bounds);
      const stamp = stampCastle(map, {
        area,
        wallHeight: args.wallHeight === undefined ? undefined : integerArg(args, "wallHeight", 3, 2, 6),
        gateWidth: args.gateWidth === undefined ? undefined : integerArg(args, "gateWidth", 4, 2, 8),
        roundTower: args.roundTower !== false,
        roundTowerHeight:
          args.roundTowerHeight === undefined ? undefined : integerArg(args, "roundTowerHeight", 7, 5, 12),
      });
      if (!stamp.ok) throw new ToolError(stamp.reason, { code: "castle-stamp-failed", mapId });

      if (pathEnabled) {
        try {
          const pathX = stamp.gate.x + Math.floor(stamp.gate.w / 2);
          const outerBottom = stamp.outer.y + stamp.outer.h;
          const pathEndY = Math.min(map.height - 2, area.y + area.h - 2);
          const yardY = Math.min(
            stamp.courtyard.y + Math.floor(stamp.courtyard.h / 2),
            stamp.gate.y - 1,
          );
          paintRoadTool.run(draft, {
            mapId,
            style: "sand",
            naturalness: 0.12,
            seed,
            points: [
              { x: pathX, y: pathEndY },
              { x: pathX, y: outerBottom },
              { x: pathX, y: stamp.gate.y },
              { x: pathX, y: Math.max(stamp.courtyard.y + 1, yardY) },
            ],
          });
        } catch (err) {
          warnings.push(`모래 접근로 실패: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // 문 통로가 길로 덮여도 통과 가능 유지 — 모래는 passable
      // 성문 바로 위 잔디 한 줄 정리
      for (let x = stamp.gate.x; x < stamp.gate.x + stamp.gate.w; x += 1) {
        const y = stamp.gate.y;
        const t = map.lowerTiles[y * map.width + x]!;
        if (t === CASTLE_WALL_BOT || t === CASTLE_WALL_MID || t === CASTLE_WALL_TOP) {
          map.lowerTiles[y * map.width + x] = TILE.GRASS;
        }
      }

      if (npcsEnabled) {
        try {
          placeNpcTool.run(draft, {
            mapId,
            x: stamp.gate.x + Math.floor(stamp.gate.w / 2),
            y: Math.min(map.height - 2, stamp.outer.y + stamp.outer.h + 1),
            name: "문지기",
            graphic: { query: "warrior" },
            movement: "fixed",
            pages: [{ lines: ["성채에 오신 것을 환영하오. 무기는 문 앞에 두고 들어가시오."] }],
          });
        } catch (err) {
          warnings.push(`문지기 배치 실패: ${err instanceof Error ? err.message : String(err)}`);
        }
        try {
          const cx = stamp.courtyard.x + Math.floor(stamp.courtyard.w / 2);
          const cy = stamp.courtyard.y + Math.floor(stamp.courtyard.h / 2);
          placeNpcTool.run(draft, {
            mapId,
            x: cx,
            y: cy,
            name: "성주",
            graphic: { query: "old man" },
            movement: "fixed",
            pages: [{ lines: ["이 성은 옛 왕조의 보루였소. 여장 위 바람을 느껴 보시오."] }],
          });
        } catch (err) {
          warnings.push(`성주 배치 실패: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const towerNote = stamp.roundTowerAt
        ? `원형타워 (${stamp.roundTowerAt.x},${stamp.roundTowerAt.y}) h=${stamp.roundTowerAt.h}`
        : "원형타워 없음";

      return {
        summary:
          `${map.name} 성채 시공 — 지붕 ${stamp.stats.roofCells} / 성벽 ${stamp.stats.wallCells} / 타워 ${stamp.stats.towerCells} · ` +
          `남문 x=${stamp.gate.x} w=${stamp.gate.w} · ${towerNote}` +
          (warnings.length ? ` · 경고 ${warnings.length}` : ""),
        data: {
          mapId,
          outer: stamp.outer,
          courtyard: stamp.courtyard,
          keep: stamp.keep,
          gate: stamp.gate,
          roundTowerAt: stamp.roundTowerAt,
          stats: stamp.stats,
          warnings,
        },
        warnings: warnings.length ? warnings : undefined,
      };
    },
  },
];

// re-export tile constants used for gate cleanup without importing full kit cycle
const CASTLE_WALL_TOP = 21;
const CASTLE_WALL_MID = 51;
const CASTLE_WALL_BOT = 81;

function requireTool(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`필수 툴을 찾을 수 없습니다: ${name}`);
  return tool;
}

function integerArg(args: Record<string, unknown>, key: string, fallback: number, min?: number, max?: number): number {
  const value = args[key];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value)) {
    throw new ToolError(`${key}는 정수여야 합니다.`, { code: "invalid-args" });
  }
  if (min !== undefined && value < min) throw new ToolError(`${key}는 ${min} 이상이어야 합니다.`, { code: "invalid-args" });
  if (max !== undefined && value > max) throw new ToolError(`${key}는 ${max} 이하여야 합니다.`, { code: "invalid-args" });
  return value;
}

function createCastleMap(draft: Project, args: Record<string, unknown>, seed: number): string {
  const width = integerArg(args, "width", DEFAULT_W, MIN_W, MAX_SIZE);
  const height = integerArg(args, "height", DEFAULT_H, MIN_H, MAX_SIZE);
  const name = typeof args.name === "string" && args.name.trim().length > 0 ? args.name.trim() : "성채";
  const id =
    typeof args.id === "string" && args.id.trim().length > 0
      ? args.id.trim()
      : uniqueId(draft, "map_castle", `${name}_${seed >>> 0}_${width}x${height}`);
  if (draft.maps[id]) throw new ToolError(`이미 존재하는 맵 id입니다: ${id}`, { code: "map-exists", mapId: id });
  createMapTool.run(draft, { id, name, width, height, border: "none" });
  return id;
}

function requireMap(draft: Project, mapId: string): GameMap {
  const map = draft.maps[mapId];
  if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found", mapId });
  return map;
}

function ensureCombinedTown(draft: Project, map: GameMap, warnings: string[]): void {
  if (map.tilesetId !== DEFAULT_TILESET_ID) {
    if (draft.tilesets[DEFAULT_TILESET_ID]) {
      map.tilesetId = DEFAULT_TILESET_ID;
      warnings.push(`타일셋을 ${DEFAULT_TILESET_ID}로 맞췄습니다 (성채 모듈 전용).`);
    } else {
      warnings.push(`Combined Town 타일셋이 없습니다 — 현재 tilesetId=${map.tilesetId}`);
    }
  }
}

function resolveArea(map: GameMap, value: unknown): Rect {
  if (value === undefined) {
    return { x: 0, y: 0, w: map.width, h: map.height };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError("bounds는 {x,y,w,h} 객체여야 합니다.", { code: "invalid-args", mapId: map.id });
  }
  const bounds = value as Record<string, unknown>;
  for (const field of ["x", "y", "w", "h"] as const) {
    if (typeof bounds[field] !== "number" || !Number.isInteger(bounds[field]) || !Number.isFinite(bounds[field])) {
      throw new ToolError(`bounds.${field}는 정수여야 합니다.`, { code: "invalid-args", mapId: map.id });
    }
  }
  const area = { x: bounds.x as number, y: bounds.y as number, w: bounds.w as number, h: bounds.h as number };
  if (area.x < 0 || area.y < 0 || area.x + area.w > map.width || area.y + area.h > map.height) {
    throw new ToolError(`build_castle bounds가 맵 밖입니다: ${area.x},${area.y} ${area.w}x${area.h}`, {
      code: "bounds-out-of-map",
      mapId: map.id,
    });
  }
  if (area.w < MIN_W || area.h < MIN_H) {
    throw new ToolError(`build_castle은 최소 ${MIN_W}x${MIN_H} 영역이 필요합니다.`, {
      code: "bounds-too-small",
      mapId: map.id,
    });
  }
  return area;
}

function uniqueId(draft: Project, prefix: string, body: string): string {
  const cleanBody = body.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "1";
  let id = `${prefix}_${cleanBody}`;
  let suffix = 2;
  const eventIds = new Set(Object.values(draft.maps).flatMap((m) => m.events.map((e) => e.id)));
  while (draft.maps[id] || eventIds.has(id)) {
    id = `${prefix}_${cleanBody}_${suffix}`;
    suffix += 1;
  }
  return id;
}
