// build_castle — 성채 모듈(지붕면/성벽/원형타워) 결정론 시공.
// 금본: map_castle_keep + openwiki/castle-map.md

import { evaluateCastle, stampCastle, type Rect } from "@/editor/castleKit";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
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
      "성채 맵을 정본 문법으로 시공한다(권장 정공법, 2026-07-18 정본). " +
      "커튼월 = 통행 데크(19/49/109) + 정면 2층(51/81, 타일 21 미사용) · 원형 타워는 벽선 매립(캡 24|25↑·창 교대·베이스 54|55↑, 밑 타일 보존) · " +
      "남문 = 포석 회랑 + 대계단 111|112*|113 전 층 관통 · 배너 179+209 페어. " +
      "타일 ID를 직접 고르지 말 것. mapId 없으면 새 맵 생성. bounds로 기존 맵 일부에 시공 가능. " +
      "마당은 잔디 통행 유지. 최소 영역 28×24, 기본 48×40. 평가에 정본 문법 린트 포함.",
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
        wallHeight: { type: "integer", description: "성벽 정면 높이(51×(n-1)+81, 기본 2 = 정본 2층, 2~4)" },
        gateWidth: { type: "integer", description: "남문 대계단 폭(기본 8 = 정본 실측, 4~10)" },
        roundTower: { type: "boolean", description: "성문 협곽 매립 타워(기본 true)" },
        roundTowerHeight: { type: "integer", description: "(deprecated) 정본 타워 스택은 8행 고정 — 값 무시" },
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
      if (args.roundTowerHeight !== undefined) {
        warnings.push("roundTowerHeight는 deprecated — 정본 타워 스택은 8행 고정이라 무시합니다.");
      }
      const stamp = stampCastle(map, {
        area,
        wallHeight: args.wallHeight === undefined ? undefined : integerArg(args, "wallHeight", 2, 2, 4),
        gateWidth: args.gateWidth === undefined ? undefined : integerArg(args, "gateWidth", 8, 4, 10),
        roundTower: args.roundTower !== false,
      });
      if (!stamp.ok) throw new ToolError(stamp.reason, { code: "castle-stamp-failed", mapId });

      // 품질 게이트: 순수 성 구조(문 개방·마당 도달성·시공량)를 평가. 모래길/NPC 전에 검사한다
      // (모래길은 잔디를 덮지만 통행 가능, NPC는 이벤트라 타일 무관).
      const evaluation = evaluateCastle(map, stamp);
      if (!evaluation.ok) warnings.push(...evaluation.issues.map((issue) => `평가: ${issue}`));

      // 대계단 남단 아래 잔디 접근로에만 모래길 — 계단·회랑(정본 문법)은 덮지 않는다.
      const stairBottomY = stamp.gate.y + stamp.faceH;
      if (pathEnabled) {
        try {
          const pathX = stamp.gate.x + Math.floor(stamp.gate.w / 2);
          const pathEndY = Math.min(map.height - 2, area.y + area.h - 2);
          if (pathEndY > stairBottomY + 1) {
            paintRoadTool.run(draft, {
              mapId,
              style: "sand",
              naturalness: 0.12,
              seed,
              points: [
                { x: pathX, y: pathEndY },
                { x: pathX, y: stairBottomY + 1 },
              ],
            });
          }
        } catch (err) {
          warnings.push(`모래 접근로 실패: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (npcsEnabled) {
        try {
          placeNpcTool.run(draft, {
            mapId,
            x: stamp.gate.x + Math.floor(stamp.gate.w / 2),
            y: Math.min(map.height - 2, stairBottomY + 2),
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
          `남문 x=${stamp.gate.x} w=${stamp.gate.w} · ${towerNote} · 평가 ${evaluation.score}` +
          (warnings.length ? ` · 경고 ${warnings.length}` : ""),
        data: {
          mapId,
          outer: stamp.outer,
          courtyard: stamp.courtyard,
          keep: stamp.keep,
          gate: stamp.gate,
          roundTowerAt: stamp.roundTowerAt,
          stats: stamp.stats,
          evaluation,
          warnings,
        },
        warnings: warnings.length ? warnings : undefined,
      };
    },
  },
];

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
