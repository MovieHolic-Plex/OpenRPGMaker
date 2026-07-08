// editor/tools/houseKitTools.ts
// 하네싱 집 키트를 에이전트 채팅에 노출하는 AI 툴.
// 타일 선택은 전부 결정론 스크립트(houseKit)가 하고, LLM은 평면(날개 사각형)·키트만 설계한다.
// 정본 명세: docs/knowledge/images/2026-07-08-house-harness-design.png

import { HOUSE_KITS, stampFootprintHouseKit, type FootprintWing, type HouseKitId, type HouseKitWindowsOption } from "@/editor/houseKit";
import { createHouseDoorEvent, createHouseInteriorMap } from "@/editor/houseInteriors";
import { appendToTree } from "@/editor/mapTreeActions";
import { isPassable, tilePassability } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent, MapId, MapTreeNode, Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const DOOR_TOP_TILE = 116;
const DOOR_BOTTOM_TILE = 146;

const EXAMPLE = {
  mapId: "map_1",
  kitId: "blue-stone",
  wings: [
    { x: 4, y: 3, w: 12, h: 7 },
    { x: 11, y: 3, w: 5, h: 11 },
  ],
};

export const HOUSE_KIT_TOOLS: readonly ToolDefinition[] = [
  {
    name: "build_house_kit",
    description:
      "하네싱 집 키트로 집을 짓는다(권장 정공법). 건물 = 날개 사각형(wings)들의 합집합 — " +
      "직사각·ㄱ/ㄴ/ㄷ/ㅁ/O자 등 임의 평면 가능. 벽 3행(상·중·하 나인슬라이스)과 지붕 3단, " +
      "상위 레이어 마감(대각/용마루/트림)은 스크립트가 자동으로 정확히 깐다 — 타일 ID를 직접 고르지 말 것. " +
      "키트: blue-stone(파랑 지붕+석벽) | bright-plaster(밝은 오렌지 지붕+흰 회벽). " +
      "이 두 키트에 없는 재질(통나무·초가 등)을 요청받으면 지어내지 말고 '아직 학습되지 않은 재질'이라고 답할 것. " +
      "제약: 날개 폭 ≥3, 각 열 구간 높이 ≥5(벽3+지붕2). 문은 남쪽 외벽 중앙에 자동 배치된다. " +
      "창문은 기본 활성으로 각 벽 중단 행에 1칸 인셋 후 spacing+1 간격으로 상위 레이어에 배치하며 문 열±1은 비운다.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string", description: "대상 맵 id" },
        kitId: { type: "string", enum: Object.keys(HOUSE_KITS), description: "재질 키트" },
        wings: {
          type: "array",
          description: "건물 질량을 이루는 날개 사각형 목록(타일 좌표, 벽+지붕 포함 전체 외곽)",
          items: {
            type: "object",
            properties: {
              x: { type: "integer" },
              y: { type: "integer" },
              w: { type: "integer", description: "폭(≥3)" },
              h: { type: "integer", description: "높이(≥5 권장 — 벽3+지붕2)" },
            },
            required: ["x", "y", "w", "h"],
          },
        },
        door: { type: "boolean", description: "남쪽 외벽 중앙에 문 자동 배치(기본 true)" },
        doorEvent: { type: "boolean", description: "Object1 문 이벤트와 열림 모션 생성(기본 true, interior:false면 비활성)" },
        interior: { type: "boolean", description: "집 내부 맵 자동 생성(기본 true). false면 내부/문 이벤트 없이 외장만 만든다." },
        ownerName: { type: "string", description: "내부 맵 이름에 쓸 집주인 이름(기본: 대상 맵 이름)" },
        windows: {
          type: ["boolean", "object"],
          description: "창문 자동 배치(기본 true). false면 끄고, {spacing}이면 창문 사이 벽 칸 수를 지정(기본 2)",
          properties: { spacing: { type: "integer", description: "창문 사이 벽 칸 수(기본 2)" } },
        },
      },
      required: ["mapId", "kitId", "wings"],
    },
    invalidArgsExample: EXAMPLE,
    run(draft: Project, args: Record<string, unknown>): ToolExecResult {
      const mapId = args.mapId as string;
      const map = draft.maps[mapId];
      if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "missing-map", mapId });
      const kitId = args.kitId as HouseKitId;
      if (!HOUSE_KITS[kitId]) {
        throw new ToolError(
          `알 수 없는 키트: ${String(args.kitId)} — 사용 가능: ${Object.keys(HOUSE_KITS).join(", ")}`,
          { code: "unknown-kit", mapId }
        );
      }
      const wings = coerceWings(args.wings);
      const windows = coerceWindows(args.windows);
      const result = stampFootprintHouseKit(map, { kitId, wings, windows });
      if (!result.ok) throw new ToolError(result.reason ?? "집 시공 실패", { code: "house-kit-failed", mapId });
      const warnings: string[] = [];
      let doorNote = "문 없음";
      let interiorData: {
        interiorMapId: MapId;
        doorEventId: string;
        exitEventId: string;
      } | null = null;
      if (args.door !== false && result.doorAt) {
        const { x, y } = result.doorAt;
        map.lowerTiles[(y - 1) * map.width + x] = DOOR_TOP_TILE;
        map.lowerTiles[y * map.width + x] = DOOR_BOTTOM_TILE;
        const clearanceWarning = ensureDoorFrontPassable(draft, map, { x, y });
        if (clearanceWarning) warnings.push(clearanceWarning);
        doorNote = `문 (${x},${y})`;
        if (args.interior !== false && args.doorEvent !== false) {
          const base = `${map.id}_${kitId}_${x}_${y}`;
          const interiorMapId = uniqueProjectId(draft, "map_house_interior", base);
          const doorEventId = uniqueProjectId(draft, "ev_house_door", base);
          const exitEventId = uniqueProjectId(draft, "ev_house_exit", base);
          const ownerName = typeof args.ownerName === "string" && args.ownerName.trim().length > 0
            ? args.ownerName.trim()
            : map.name;
          const interior = createHouseInteriorMap({
            id: interiorMapId,
            name: `${ownerName}의 집 내부`,
            returnMapId: map.id,
            returnX: x,
            returnY: y + 1,
            exitEventId,
            seed: seedFromString(base),
          });
          draft.maps[interiorMapId] = interior.map;
          appendTreeChildOnce(draft.mapTree, interiorMapId, map.id);
          upsertEvent(map.events, createHouseDoorEvent({
            eventId: doorEventId,
            x,
            y,
            interiorMapId,
            kitId,
            name: `${ownerName}의 집 문`,
          }));
          interiorData = { interiorMapId, doorEventId, exitEventId };
          doorNote = `${doorNote}, 내부 ${interiorMapId}`;
        }
      }
      const kit = HOUSE_KITS[kitId];
      const windowNote = windows === false ? "창문 없음" : "창문 자동";
      return {
        summary: `${map.name}에 '${kit.name}' 집 시공 — 날개 ${wings.length}개, ${doorNote}, ${windowNote}. 하네싱 규칙 적용 완료.`,
        ...(warnings.length > 0 ? { warnings } : {}),
        data: { doorAt: result.doorAt ?? null, kitId, wings, ...(interiorData ?? {}) },
      };
    },
  },
];

function coerceWings(value: unknown): FootprintWing[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ToolError(`wings는 1개 이상의 사각형 배열이어야 합니다 — 예시: ${JSON.stringify(EXAMPLE)}`, { code: "invalid-args" });
  }
  return value.map((entry, index) => {
    const wing = entry as Record<string, unknown>;
    for (const field of ["x", "y", "w", "h"] as const) {
      if (typeof wing[field] !== "number" || !Number.isInteger(wing[field])) {
        throw new ToolError(`wings[${index}].${field}는 정수여야 합니다 — 예시: ${JSON.stringify(EXAMPLE)}`, { code: "invalid-args" });
      }
    }
    return { x: wing.x as number, y: wing.y as number, w: wing.w as number, h: wing.h as number };
  });
}

function coerceWindows(value: unknown): HouseKitWindowsOption | undefined {
  if (value === undefined || value === true) return undefined;
  if (value === false) return false;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError("windows는 boolean 또는 {spacing} 객체여야 합니다.", { code: "invalid-args" });
  }
  const spacing = (value as Record<string, unknown>).spacing;
  if (spacing === undefined) return {};
  if (typeof spacing !== "number" || !Number.isInteger(spacing) || spacing < 0) {
    throw new ToolError("windows.spacing은 0 이상의 정수여야 합니다.", { code: "invalid-args" });
  }
  return { spacing };
}

function uniqueProjectId(draft: Project, prefix: string, body: string): string {
  const cleanBody = body.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64) || "1";
  let id = `${prefix}_${cleanBody}`;
  let suffix = 2;
  const eventIds = new Set(Object.values(draft.maps).flatMap((map) => map.events.map((event) => event.id)));
  while (draft.maps[id] || eventIds.has(id)) {
    id = `${prefix}_${cleanBody}_${suffix}`;
    suffix += 1;
  }
  return id;
}

function appendTreeChildOnce(root: MapTreeNode, mapId: MapId, parentId: MapId): void {
  if (treeContains(root, mapId)) return;
  appendToTree(root, mapId, parentId);
}

function treeContains(node: MapTreeNode, mapId: MapId): boolean {
  return node.mapId === mapId || node.children.some((child) => treeContains(child, mapId));
}

function upsertEvent(events: GameEvent[], event: GameEvent): void {
  const index = events.findIndex((entry) => entry.id === event.id);
  if (index >= 0) events[index] = event;
  else events.push(event);
}

function ensureDoorFrontPassable(project: Project, map: Project["maps"][string], door: { readonly x: number; readonly y: number }): string | undefined {
  const front = { x: door.x, y: door.y + 1 };
  if (front.x < 0 || front.y < 0 || front.x >= map.width || front.y >= map.height) {
    throw new ToolError("문 앞이 맵 밖입니다 — 남쪽에 여유를 두세요", {
      code: "house-door-front-out-of-bounds",
      mapId: map.id,
      x: front.x,
      y: front.y,
    });
  }
  if (isPassable(project, map, front.x, front.y)) return undefined;
  const index = front.y * map.width + front.x;
  map.lowerTiles[index] = chooseDoorFrontGroundTile(project, map, front.x, front.y);
  map.upperTiles[index] = TILE.EMPTY;
  clearTileStacksAt(map, index);
  return `문 앞 (${front.x},${front.y}) 통행 확보 — 지면으로 정리`;
}

function chooseDoorFrontGroundTile(project: Project, map: Project["maps"][string], centerX: number, centerY: number): number {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return TILE.GRASS;
  const counts = new Map<number, number>();
  for (let y = centerY - 2; y <= centerY + 2; y += 1) {
    for (let x = centerX - 2; x <= centerX + 2; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const tile = map.lowerTiles[y * map.width + x] ?? TILE.EMPTY;
      if (tile === TILE.EMPTY) continue;
      const passability = tilePassability(tileset, tile, TILE.EMPTY);
      if (!passability.up && !passability.down && !passability.left && !passability.right) continue;
      counts.set(tile, (counts.get(tile) ?? 0) + 1);
    }
  }
  let bestTile: number = TILE.GRASS;
  let bestCount = 0;
  for (const [tile, count] of counts) {
    if (count > bestCount) {
      bestTile = tile;
      bestCount = count;
    }
  }
  return bestTile;
}

function clearTileStacksAt(map: Project["maps"][string], index: number): void {
  if (map.lowerTileStacks?.[index]) {
    delete map.lowerTileStacks[index];
    if (Object.keys(map.lowerTileStacks).length === 0) delete map.lowerTileStacks;
  }
  if (map.upperTileStacks?.[index]) {
    delete map.upperTileStacks[index];
    if (Object.keys(map.upperTileStacks).length === 0) delete map.upperTileStacks;
  }
}

function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
