import { describe, expect, it } from "vitest";
import { HOUSE_DOOR_CHARSET_TEXTURE } from "@/editor/houseInteriors";
import { INTERIOR_HOUSE_TILESET_ID } from "@/editor/interiorStructureStamp";
import { TOOL_CATEGORIES } from "@/editor/panels/toolBrowserModal";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { allTools } from "@/editor/tools/toolRegistry";
import type { ToolContext } from "@/editor/tools/types";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { findCharsetSemantic } from "@/assets/charsetSemantics";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { MapTreeNode } from "@/project/types";

interface VillageHouseData {
  readonly index: number;
  readonly kitId: string;
  readonly doorAt: { readonly x: number; readonly y: number };
  readonly front: { readonly x: number; readonly y: number };
  readonly ownerName: string;
  readonly interiorMapId?: string;
  readonly doorEventId?: string;
  readonly exitEventId?: string;
  readonly entry?: { readonly x: number; readonly y: number };
  readonly exit?: { readonly x: number; readonly y: number };
  readonly returnTo?: { readonly x: number; readonly y: number };
}

interface VillageData {
  readonly mapId: string;
  readonly housesBuilt: number;
  readonly doorsConnected: number;
  readonly roadComponents: number;
  readonly npcCount: number;
  readonly interiorCount: number;
  readonly doorEventCount: number;
  readonly houses: readonly VillageHouseData[];
}

interface VillageSnapshot {
  readonly lowerTiles: readonly number[];
  readonly upperTiles: readonly number[];
  readonly events: readonly { readonly id: string; readonly x: number; readonly y: number; readonly commandKinds: readonly string[] }[];
  readonly mapIds: readonly string[];
  readonly mapTree: string;
}

function villageData(value: unknown): VillageData {
  if (!isVillageData(value)) throw new Error(`build_village data shape mismatch: ${JSON.stringify(value)}`);
  return value;
}

function isVillageData(value: unknown): value is VillageData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return typeof Reflect.get(value, "mapId") === "string"
    && typeof Reflect.get(value, "housesBuilt") === "number"
    && typeof Reflect.get(value, "doorsConnected") === "number"
    && typeof Reflect.get(value, "roadComponents") === "number"
    && typeof Reflect.get(value, "npcCount") === "number"
    && typeof Reflect.get(value, "interiorCount") === "number"
    && typeof Reflect.get(value, "doorEventCount") === "number"
    && Array.isArray(Reflect.get(value, "houses"));
}

function buildVillage(seed: number): { readonly context: ToolContext; readonly data: VillageData; readonly snapshot: VillageSnapshot } {
  const context: ToolContext = { project: createEmptyToolProject("마을 테스트") };
  const result = runTool(context, "build_village", { seed });
  expect(result.ok, result.summary).toBe(true);
  const data = villageData(result.data);
  const map = context.project.maps[data.mapId];
  expect(map, data.mapId).toBeTruthy();
  return {
    context,
    data,
    snapshot: {
      lowerTiles: [...map.lowerTiles],
      upperTiles: [...map.upperTiles],
      events: map.events.map((event) => ({
        id: event.id,
        x: event.x,
        y: event.y,
        commandKinds: event.pages?.[0]?.commands.map((command) => command.kind) ?? event.commands.map((command) => command.kind),
      })),
      mapIds: Object.keys(context.project.maps).sort(),
      mapTree: JSON.stringify(context.project.mapTree),
    },
  };
}

describe("build_village", () => {
  it("빈 프로젝트에서 seed만으로 50x50 마을을 완성한다", () => {
    const { context, data } = buildVillage(7);
    const map = context.project.maps[data.mapId];
    expect(map.width).toBe(50);
    expect(map.height).toBe(50);
    expect(data.housesBuilt).toBe(8);
    expect(data.doorsConnected).toBe(8);
    expect(data.roadComponents).toBe(1);
    expect(data.npcCount).toBe(10);
    expect(data.interiorCount).toBe(8);
    expect(data.doorEventCount).toBe(8);
    // 문 타일 무결성: 진입로가 집을 관통해 문을 덮으면 146 개수가 줄어든다 (회귀 방지).
    expect(map.lowerTiles.filter((tile) => tile === 146)).toHaveLength(8);
    expect(map.lowerTiles.filter((tile) => tile === 116)).toHaveLength(8);
  });

  it("기본 시드에서도 문 8개가 전부 온전하다 (진입로 관통 회귀)", () => {
    const { context, data } = buildVillage(1);
    const map = context.project.maps[data.mapId];
    expect(map.lowerTiles.filter((tile) => tile === 146)).toHaveLength(8);
    expect(data.doorsConnected).toBe(8);
    expect(data.roadComponents).toBe(1);
  });

  it("같은 seed는 타일과 이벤트 좌표가 같고 다른 seed는 하위 타일이 달라진다", () => {
    const first = buildVillage(7).snapshot;
    const second = buildVillage(7).snapshot;
    const different = buildVillage(8).snapshot;

    expect(second.lowerTiles).toEqual(first.lowerTiles);
    expect(second.upperTiles).toEqual(first.upperTiles);
    expect(second.events).toEqual(first.events);
    expect(second.mapIds).toEqual(first.mapIds);
    expect(second.mapTree).toEqual(first.mapTree);
    expect(different.lowerTiles).not.toEqual(first.lowerTiles);
  });

  it("NPC 그래픽을 주민형 후보에서 다양하게 순환 배정하고 같은 seed에서 고정한다", () => {
    const first = buildVillage(7);
    const second = buildVillage(7);
    const firstKeys = villageNpcGraphicKeys(first.context, first.data.mapId);
    const secondKeys = villageNpcGraphicKeys(second.context, second.data.mapId);
    expect(secondKeys).toEqual(firstKeys);
    expect(new Set(firstKeys).size).toBeGreaterThan(4);
    expect(new Set(firstKeys.map((key) => key.split(":")[0])).size).toBeGreaterThanOrEqual(4);
    expect(firstKeys.every((key) => /^tex_easyrpg_charset_people[1-5]:/.test(key))).toBe(true);

    const entries = firstKeys.map((key) => {
      const [textureKey, indexText] = key.split(":");
      return findCharsetSemantic(textureKey ?? "", Number(indexText));
    });
    expect(new Set(entries.map((entry) => entry?.gender).filter(Boolean))).toEqual(new Set(["male", "female"]));
    expect(new Set(entries.map((entry) => entry?.age).filter(Boolean)).size).toBeGreaterThanOrEqual(3);
  });

  it("집 8채에 Object1 문 이벤트와 자식 내부 맵을 생성한다", () => {
    const { context, data } = buildVillage(7);
    const map = context.project.maps[data.mapId];
    const childIds = treeChildIds(context.project.mapTree, data.mapId);
    expect(data.houses).toHaveLength(8);
    for (const house of data.houses) {
      expect(house.interiorMapId).toBeTruthy();
      expect(house.doorEventId).toBeTruthy();
      expect(house.exitEventId).toBeTruthy();
      expect(childIds).toContain(house.interiorMapId);
      const door = map.events.find((event) => event.id === house.doorEventId);
      expect(door?.x).toBe(house.doorAt.x);
      expect(door?.y).toBe(house.doorAt.y);
      expect(door?.pages?.[0]?.trigger.kind).toBe("action");
      expect(door?.pages?.[0]?.priority).toBe("same");
      expect(door?.pages?.[0]?.graphic.sprite?.id).toBe(HOUSE_DOOR_CHARSET_TEXTURE);
      expect(door?.pages?.[0]?.commands.map((command) => command.kind)).toEqual([
        "setEventGraphicPattern",
        "wait",
        "setEventGraphicPattern",
        "wait",
        "setEventGraphicPattern",
        "wait",
        "transfer",
      ]);
      expect(door?.pages?.[0]?.commands.at(-1)).toMatchObject({ kind: "transfer", mapId: house.interiorMapId, x: 6, y: 6 });

      const interior = context.project.maps[house.interiorMapId as string];
      expect(interior.name).toBe(`${house.ownerName}의 집 내부`);
      expect(interior.tilesetId).toBe(INTERIOR_HOUSE_TILESET_ID);
      expect(interior.width).toBe(13);
      expect(interior.height).toBe(10);
      const exit = interior.events.find((event) => event.id === house.exitEventId);
      expect(exit?.x).toBe(6);
      expect(exit?.y).toBe(7);
      expect(exit?.pages?.[0]?.trigger.kind).toBe("playerTouch");
      expect(exit?.pages?.[0]?.commands).toEqual([{ kind: "transfer", mapId: data.mapId, x: house.front.x, y: house.front.y, fade: "black" }]);
      expect(map.events.some((event) => event.x === house.front.x && event.y === house.front.y)).toBe(false);
    }
  });

  it("interior:false면 내부 맵과 문 이벤트를 만들지 않는다", () => {
    const context: ToolContext = { project: createEmptyToolProject("외장만 마을") };
    const result = runTool(context, "build_village", { seed: 7, interior: false });
    expect(result.ok, result.summary).toBe(true);
    const data = villageData(result.data);
    const map = context.project.maps[data.mapId];
    expect(data.housesBuilt).toBe(8);
    expect(data.interiorCount).toBe(0);
    expect(data.doorEventCount).toBe(0);
    expect(Object.values(context.project.maps).filter((candidate) => candidate.tilesetId === INTERIOR_HOUSE_TILESET_ID)).toHaveLength(0);
    expect(map.events.some((event) => event.id.startsWith("ev_house_door_"))).toBe(false);
    expect(map.lowerTiles.filter((tile) => tile === 146)).toHaveLength(8);
  });

  it("내부 맵 삭제 시 외부 문 transfer dangling 참조가 정리된다", () => {
    const { context, data } = buildVillage(7);
    const firstHouse = data.houses[0];
    expect(firstHouse?.interiorMapId).toBeTruthy();
    if (!firstHouse?.interiorMapId) throw new Error("first house interior missing");
    const removedMapId = firstHouse.interiorMapId as string;
    const result = runTool(context, "remove_map", { mapId: removedMapId });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.maps[removedMapId]).toBeUndefined();
    const map = context.project.maps[data.mapId];
    const door = map.events.find((event) => event.id === firstHouse.doorEventId);
    expect(door?.pages?.[0]?.commands.some((command) => command.kind === "transfer" && command.mapId === removedMapId)).toBe(false);
    expect(() => deserialize(serialize(context.project))).not.toThrow();
  });

  it("하네싱 창문을 상위 레이어에 배치한다", () => {
    const { context, data } = buildVillage(7);
    const map = context.project.maps[data.mapId];
    expect(map.upperTiles.some((tile) => tile === 85 || tile === 87)).toBe(true);
  });

  it("기존 40x40 맵에는 시공하고 30x30 맵은 거부한다", () => {
    const context: ToolContext = { project: createBlankProject() };
    expect(runTool(context, "create_map", { id: "map_40", name: "기존 40", width: 40, height: 40 }).ok).toBe(true);
    const built = runTool(context, "build_village", { mapId: "map_40", seed: 7 });
    expect(built.ok, built.summary).toBe(true);
    expect(villageData(built.data).housesBuilt).toBe(8);

    expect(runTool(context, "create_map", { id: "map_30", name: "기존 30", width: 30, height: 30 }).ok).toBe(true);
    const rejected = runTool(context, "build_village", { mapId: "map_30", seed: 7 });
    expect(rejected.ok).toBe(false);
    expect(rejected.issues?.[0]?.code).toBe("map-too-small");
  });

  it("레지스트리와 툴 브라우저에 등록되고 runTool 경로로 실행된다", () => {
    expect(allTools().map((tool) => tool.name)).toContain("build_village");
    expect(TOOL_CATEGORIES.flatMap((category) => category.tools.map((tool) => tool.name))).toContain("build_village");

    const context: ToolContext = { project: createEmptyToolProject("레지스트리 테스트") };
    const result = runTool(context, "build_village", { seed: 13 });
    expect(result.ok, result.summary).toBe(true);
    expect(villageData(result.data).roadComponents).toBe(1);
  });
});

function treeChildIds(root: MapTreeNode, parentId: string): string[] {
  const node = findTreeNode(root, parentId);
  return node?.children.map((child) => child.mapId) ?? [];
}

function villageNpcGraphicKeys(context: ToolContext, mapId: string): string[] {
  const map = context.project.maps[mapId];
  return map.events
    .filter((event) => event.id.startsWith("ev_village_"))
    .map((event) => {
      const graphic = event.pages?.[0]?.graphic;
      const textureKey = graphic?.sprite?.id ?? "";
      const characterIndex = decodeCharsetFrameIndex(graphic?.pattern ?? 0).characterIndex;
      return `${textureKey}:${characterIndex}`;
    });
}

function findTreeNode(node: MapTreeNode, mapId: string): MapTreeNode | null {
  if (node.mapId === mapId) return node;
  for (const child of node.children) {
    const found = findTreeNode(child, mapId);
    if (found) return found;
  }
  return null;
}
