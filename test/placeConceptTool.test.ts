import { describe, expect, it } from "vitest";
import { capabilityEscalatedToolNames } from "@/ai/capabilityEscalation";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { OUTSIDE_VOID_TILE } from "@/editor/interiorConceptCompose";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { interiorObjectById } from "@/editor/interiorObjectCatalog";
import { CHEST_OPEN_SE, LOOT_GOLD_SE } from "@/editor/lootFeedback";
import { getTool } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { cloneConceptBundle, SCRATCH_INN_BUNDLE } from "@/project/defaults/scratchInnBundle";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent, GameMap } from "@/project/types";

function ctx(): ToolContext {
  return { project: createBlankProject() };
}

function mapHasObject(map: GameMap, objectId: string): boolean {
  const object = interiorObjectById(objectId);
  if (!object) return false;
  const tiles = new Set(object.cells.map((cell) => cell.tile));
  return map.upperTiles.some((tile) => tiles.has(tile)) || map.lowerTiles.some((tile) => tiles.has(tile));
}

describe("place_concept", () => {
  it("툴이 등록되어 있다", () => {
    expect(getTool("place_concept")?.name).toBe("place_concept");
  });

  it("여관 지어줘 요청에 승격된다", () => {
    expect(capabilityEscalatedToolNames("여관 지어줘", new Set())).toContain("place_concept");
    expect(capabilityEscalatedToolNames("여관 하나 지어줘", new Set())).toContain("place_concept");
    expect(capabilityEscalatedToolNames("주막 만들어줘", new Set())).toContain("place_concept");
  });

  it("툴 설명이 시설 요청의 경로(야외 집 금지·새 mapId·create_map 만 하고 멈추지 말 것)를 스스로 말한다", () => {
    const description = getTool("place_concept")?.description ?? "";
    expect(description).toContain("author_house");
    expect(description).toContain("create_map");
    expect(description).toContain("기존 실내 맵을 고치는 요청에는 쓰지 마라");
  });

  it("여관 초안으로 침실·복도·식당을 짓고 침대를 놓는다", () => {
    const context = ctx();
    const result = runTool(context, "place_concept", {
      query: "여관",
      mapId: "map_inn_live",
      seed: 7,
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps.map_inn_live;
    expect(map).toBeDefined();
    expect(mapHasObject(map!, "bed_h") || mapHasObject(map!, "bed_v")).toBe(true);
    expect(mapHasObject(map!, "table_long")).toBe(true);
    expect(mapHasObject(map!, "piano")).toBe(true);
    const data = result.data as { facilityLabel?: string; used?: { placeId: string }[] };
    expect(data.facilityLabel).toBe("여관");
    expect(data.used?.map((entry) => entry.placeId).sort()).toEqual(["bedroom", "corridor", "dining"]);
  });

  it("사용자가 피아노를 빼고 책장을 넣으면 시공이 그 나무를 따른다", () => {
    const context = ctx();
    const edited = cloneConceptBundle(SCRATCH_INN_BUNDLE);
    edited.label = "주막";
    edited.facilities[0] = { ...edited.facilities[0]!, label: "주막" };
    edited.things = edited.things.filter((thing) => thing.objectId !== "piano");
    edited.things.push({
      id: "bookshelf",
      label: "책장",
      objectId: "bookshelf",
      placeIds: ["bedroom"],
      chips: ["block"],
    });
    const tileset = context.project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
    tileset.scratchConceptBundles = [edited];

    const result = runTool(context, "place_concept", {
      query: "주막",
      mapId: "map_inn_edited",
      seed: 7,
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps.map_inn_edited!;
    expect(mapHasObject(map, "piano")).toBe(false);
    expect(mapHasObject(map, "bookshelf")).toBe(true);
    expect(mapHasObject(map, "bed_h") || mapHasObject(map, "bed_v")).toBe(true);
  });

  it("장소를 지우면 그 방과 물건을 시공하지 않는다", () => {
    const context = ctx();
    const edited = cloneConceptBundle(SCRATCH_INN_BUNDLE);
    edited.places = edited.places.filter((place) => place.id !== "dining");
    edited.facilities[0] = {
      ...edited.facilities[0]!,
      placeIds: edited.facilities[0]!.placeIds.filter((id) => id !== "dining"),
    };
    edited.things = edited.things.map((thing) => ({
      ...thing,
      placeIds: thing.placeIds.filter((id) => id !== "dining"),
    }));
    context.project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = [edited];

    const result = runTool(context, "place_concept", {
      query: "여관",
      mapId: "map_inn_no_dining",
      seed: 7,
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps.map_inn_no_dining!;
    expect(mapHasObject(map, "table_long")).toBe(false);
    const data = result.data as { used?: { placeId: string }[] };
    expect(data.used?.map((entry) => entry.placeId).sort()).toEqual(["bedroom", "corridor"]);
  });

  it("빈 배열은 다시 채우지 않고 거절한다", () => {
    const context = ctx();
    context.project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = [];
    const result = runTool(context, "place_concept", {
      query: "여관",
      mapId: "map_inn_empty",
    }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/비어|찾지/);
  });
});

describe("개념 꾸러미 프롬프트", () => {
  it("사용자가 고친 시설명이 시스템 프롬프트에 실린다", () => {
    const project = createBlankProject();
    const edited = cloneConceptBundle(SCRATCH_INN_BUNDLE);
    edited.facilities[0] = { ...edited.facilities[0]!, label: "주막" };
    edited.label = "주막";
    project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = [edited];
    const prompt = buildSystemPrompt(project, { currentMapId: project.startMapId, budgetChars: 50_000 });
    expect(prompt).toContain("개념 꾸러미");
    expect(prompt).toContain("place_concept");
    expect(prompt).toContain("주막");
  });
});

describe("개념 꾸러미 장소 스키마 (role · size · count)", () => {
  it("역할·크기·개수를 받아들이고 모르는 값은 거절한다", async () => {
    const { validateTileset } = await import("@/project/io/shapeResourceFields");
    const project = createBlankProject();
    const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const bundle = cloneConceptBundle(SCRATCH_INN_BUNDLE);
    bundle.places = [
      { id: "hall", label: "홀", role: "entrance", size: "l" },
      { id: "corridor", label: "복도", role: "walkway" },
      { id: "bedroom", label: "객실", role: "room", size: "s", count: 2 },
    ];
    expect(() => validateTileset(tileset.id, { ...tileset, scratchConceptBundles: [bundle] })).not.toThrow();
    const badRole = cloneConceptBundle(bundle);
    (badRole.places[0] as { role: string }).role = "hallway";
    expect(() => validateTileset(tileset.id, { ...tileset, scratchConceptBundles: [badRole] })).toThrow(/role/);
    const badCount = cloneConceptBundle(bundle);
    (badCount.places[2] as { count: number }).count = 0;
    expect(() => validateTileset(tileset.id, { ...tileset, scratchConceptBundles: [badCount] })).toThrow(/count/);
  });

  it("복제는 역할·크기·개수를 보존한다", () => {
    const copy = cloneConceptBundle(SCRATCH_INN_BUNDLE);
    const bedroom = copy.places.find((place) => place.id === "bedroom");
    expect(bedroom?.role).toBe("room");
    expect(bedroom?.count).toBe(2);
    expect(copy.places.find((place) => place.id === "dining")?.role).toBe("entrance");
    expect(copy.places.find((place) => place.id === "corridor")?.role).toBe("walkway");
  });
});

describe("place_concept 도면", () => {
  function innLayout() {
    return layoutConceptFacility(SCRATCH_INN_BUNDLE, SCRATCH_INN_BUNDLE.facilities[0]!);
  }

  it("여관 초안은 객실 2개 → 복도 → 홀 순으로 서고 정문은 홀 남쪽 벽에 난다", () => {
    const layout = innLayout();
    const bedrooms = layout.rooms.filter((room) => room.placeId === "bedroom").sort((a, b) => a.x - b.x);
    const corridor = layout.rooms.find((room) => room.placeId === "corridor")!;
    const hall = layout.rooms.find((room) => room.placeId === "dining")!;
    expect(bedrooms).toHaveLength(2);
    expect(corridor).toBeDefined();
    expect(hall).toBeDefined();
    // 세로 인접은 3행 파티션(트림 + 벽면 2행), 가로 인접은 1열 파티션 — 파이프라인 벽 문법.
    for (const bedroom of bedrooms) expect(corridor.y).toBe(bedroom.y + bedroom.h + 3);
    expect(hall.y).toBe(corridor.y + corridor.h + 3);
    expect(bedrooms[1]!.x).toBe(bedrooms[0]!.x + bedrooms[0]!.w + 1);
    // 복도와 홀은 객실 줄 전폭을 잇는다.
    expect(corridor.x).toBe(bedrooms[0]!.x);
    expect(corridor.x + corridor.w).toBe(bedrooms[1]!.x + bedrooms[1]!.w);
    expect(hall.w).toBe(corridor.w);
    // 정문은 홀 남쪽 행 안.
    expect(layout.door.y).toBe(hall.y + hall.h - 1);
    expect(layout.door.x).toBeGreaterThanOrEqual(hall.x);
    expect(layout.door.x).toBeLessThan(hall.x + hall.w);
    // 내부 문: 객실마다 복도로 하나, 복도→홀 하나.
    expect(layout.innerDoors).toHaveLength(3);
    for (const bedroom of bedrooms) {
      expect(layout.innerDoors.some((door) => door.y === bedroom.y + bedroom.h && door.x >= bedroom.x && door.x < bedroom.x + bedroom.w)).toBe(true);
    }
    expect(layout.innerDoors.some((door) => door.y === corridor.y + corridor.h)).toBe(true);
    // 맵은 정문 아래 출구 계단과 천장 여백을 남긴다(도면 여백 2행: door.y+3 == height).
    expect(layout.height).toBeGreaterThanOrEqual(layout.door.y + 3);
    expect(layout.rooms.every((room) => room.x >= 2 && room.x + room.w <= layout.width - 1)).toBe(true);
  });

  it("역할이 없는 옛 나무는 복도 라벨로 복도를 알아보고 복도가 정문을 품는다", () => {
    const legacy = cloneConceptBundle(SCRATCH_INN_BUNDLE);
    legacy.places = legacy.places.map(({ id, label }) => ({ id, label }));
    const layout = layoutConceptFacility(legacy, legacy.facilities[0]!);
    const corridor = layout.rooms.find((room) => room.placeId === "corridor")!;
    expect(layout.door.y).toBe(corridor.y + corridor.h - 1);
    expect(layout.rooms.filter((room) => room.placeId === "bedroom")).toHaveLength(1);
    expect(layout.rooms.filter((room) => room.placeId === "dining")).toHaveLength(1);
  });

  it("식당(홀)을 지우면 복도가 정문을 품고 객실은 그대로 복도 위에 선다", () => {
    const edited = cloneConceptBundle(SCRATCH_INN_BUNDLE);
    edited.places = edited.places.filter((place) => place.id !== "dining");
    edited.facilities[0] = { ...edited.facilities[0]!, placeIds: ["bedroom", "corridor"] };
    const layout = layoutConceptFacility(edited, edited.facilities[0]!);
    const corridor = layout.rooms.find((room) => room.placeId === "corridor")!;
    expect(layout.rooms.find((room) => room.placeId === "dining")).toBeUndefined();
    expect(layout.door.y).toBe(corridor.y + corridor.h - 1);
    expect(layout.innerDoors).toHaveLength(2);
  });

  it("시공된 여관은 문에서 모든 방에 닿고 plan 경고가 없다", () => {
    const context = ctx();
    const result = runTool(context, "place_concept", { query: "여관", mapId: "map_inn_plan", seed: 7 }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    // 쓰기 툴의 실행 경고는 diff.warnings 에 실린다(toolRunner).
    const warnings = [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])];
    expect(warnings.filter((line) => line.startsWith("plan:")), warnings.join("\n")).toEqual([]);
    expect(warnings.filter((line) => line.startsWith("walkability:")), warnings.join("\n")).toEqual([]);
    const data = result.data as { plan?: { rooms?: { id: string }[] } };
    expect(data.plan?.rooms?.length).toBe(4);
  });
});


describe("place_concept 구성과 칩 집행", () => {
  type Built = { map: GameMap; rooms: { roomId: string; placeId: string; role: string; x: number; y: number; w: number; h: number }[]; door: { x: number; y: number }; warnings: string[]; connections: { x: number; y: number; target: { mapId: string; x: number; y: number } | null }[] };
  function build(edit?: (bundle: ReturnType<typeof cloneConceptBundle>) => void, query = "여관"): Built {
    const context = ctx();
    if (edit) {
      const bundle = cloneConceptBundle(SCRATCH_INN_BUNDLE);
      edit(bundle);
      context.project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = [bundle];
    }
    const result = runTool(context, "place_concept", { query, mapId: "map_inn_chips", seed: 7 }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as Pick<Built, "rooms" | "door" | "connections">;
    return {
      map: context.project.maps.map_inn_chips!,
      rooms: data.rooms,
      door: data.door,
      connections: data.connections,
      warnings: [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])],
    };
  }
  function commandsOf(event: GameEvent): Command[] {
    return [...event.commands, ...(event.pages ?? []).flatMap((page) => page.commands)];
  }
  function inBox(x: number, y: number, box: { x: number; y: number; w: number; h: number }): boolean {
    return x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
  }

  it("초안 여관은 물건을 전부 앉히고(자리 없음 경고 0) 계단 미연결만 알린다", () => {
    const built = build();
    const unplaced = built.warnings.filter((line) => line.includes("자리 없음"));
    expect(unplaced, unplaced.join("\n")).toEqual([]);
    expect(built.warnings.some((line) => line.includes("맵 연결 대상이 없다"))).toBe(true);
  });

  it("상위 레이어 가구는 자기 방 바닥 안에만 찍힌다(벽·천장 침범 없음)", () => {
    const built = build();
    const { map } = built;
    const tiles = new Set(
      ["bed_h", "bed_v", "counter", "piano", "clock", "armor", "display", "table_long", "table_chairs", "plant"]
        .flatMap((id) => interiorObjectById(id)?.cells.filter((cell) => cell.layer === "upper").map((cell) => cell.tile) ?? []),
    );
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const upper = map.upperTiles[y * map.width + x]!;
        if (!tiles.has(upper)) continue;
        // 키 큰 가구 상단은 벽면 아랫줄(방 위 1행)까지 허용된다.
        const owner = built.rooms.find((room) => inBox(x, y, room) || (y === room.y - 1 && x >= room.x && x < room.x + room.w));
        expect(owner, `upper ${upper} at (${x},${y}) 이 어느 방에도 속하지 않음`).toBeDefined();
      }
    }
  });

  it("창문·그림은 바닥이 아니라 벽면 행에 걸린다", () => {
    const { map, rooms } = build();
    const window = interiorObjectById("window")!.cells[0]!.tile;
    const picture = interiorObjectById("picture")!.cells.map((cell) => cell.tile);
    let mounts = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const upper = map.upperTiles[y * map.width + x]!;
        const lower = map.lowerTiles[y * map.width + x]!;
        if (upper !== window && !picture.includes(upper)) continue;
        mounts += 1;
        const room = rooms.find((entry) => x >= entry.x && x < entry.x + entry.w && y === entry.y - 2);
        expect(room, `벽걸이 ${upper} at (${x},${y}) 가 벽면 윗줄이 아님`).toBeDefined();
        expect([74, 75, 76, 77]).toContain(lower);
      }
    }
    expect(mounts).toBeGreaterThanOrEqual(4);
  });

  it("문 앞 통로에는 가구가 없다", () => {
    const { map, rooms, door } = build();
    const blocked = (x: number, y: number): boolean => map.upperTiles[y * map.width + x]! >= 0
      || ![12, 13, 42, 43, 72, 73, 102, 103, 139, 279, 280, 281, 309, 310, 311, 339, 340, 341].includes(map.lowerTiles[y * map.width + x]!);
    const hall = rooms.find((room) => room.role === "entrance")!;
    for (let y = hall.y; y <= door.y; y += 1) expect(blocked(door.x, y), `정문 통로 (${door.x},${y}) 막힘`).toBe(false);
    for (const room of rooms.filter((entry) => entry.role === "room")) {
      const cx = room.x + Math.floor(room.w / 2);
      for (let y = room.y; y < room.y + room.h; y += 1) expect(blocked(cx, y), `${room.roomId} 문 통로 (${cx},${y}) 막힘`).toBe(false);
    }
  });

  it("sleep 칩 침대에는 여관(inn) 이벤트가 붙고 요금이 있다", () => {
    const { map, rooms } = build();
    const inns = map.events.filter((event) => commandsOf(event).some((command) => command.kind === "inn"));
    expect(inns.length).toBeGreaterThanOrEqual(2);
    for (const inn of inns) {
      const room = rooms.find((entry) => inBox(inn.x, inn.y, entry));
      expect(room?.placeId).toBe("bedroom");
      const command = commandsOf(inn).find((entry) => entry.kind === "inn");
      expect(command && command.kind === "inn" ? command.price : 0).toBe(20);
    }
  });

  it("transfer 칩 계단은 이동 이벤트가 되고 미연결 지점으로 보고된다", () => {
    const { map, rooms, door, connections } = build();
    const corridor = rooms.find((room) => room.role === "walkway")!;
    const transfers = map.events.filter((event) => event.id.startsWith("ev_concept_") && commandsOf(event).some((command) => command.kind === "transfer"));
    expect(transfers).toHaveLength(1);
    expect(inBox(transfers[0]!.x, transfers[0]!.y, corridor)).toBe(true);
    expect(connections).toHaveLength(1);
    expect(connections[0]!.target).toEqual({ mapId: map.id, x: door.x, y: door.y });
  });

  it("loot 칩 진열대는 한 번만 금화를 주는 두 페이지 이벤트가 된다", () => {
    const { map } = build();
    const loot = map.events.find((event) => event.id.includes("_display_"));
    expect(loot).toBeDefined();
    expect(loot!.pages).toHaveLength(2);
    expect(loot!.pages![0]!.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: false }]);
    expect(loot!.pages![0]!.commands.some((command) => command.kind === "changeGold")).toBe(true);
    expect(loot!.pages![1]!.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
  });

  it("loot 칩은 뒤지는 소리 →사이 → 동전 소리 → 금화 → 문장 순으로 소리가 보상에 앞서다", () => {
    const { map } = build();
    const loot = map.events.find((event) => event.id.includes("_display_"))!;
    const commands = loot.pages![0]!.commands;
    expect(commands.map((command) => command.kind)).toEqual([
      "playAudio",
      "wait",
      "playAudio",
      "changeGold",
      "text",
      "setSelfSwitch",
    ]);
    const audio = commands.filter((command) => command.kind === "playAudio") as { resourceId: string; loop: boolean }[];
    expect(audio.map((command) => command.resourceId)).toEqual([CHEST_OPEN_SE, LOOT_GOLD_SE]);
    expect(audio.every((command) => command.loop === false)).toBe(true);
    const gold = commands.find((command) => command.kind === "changeGold") as { amount: number };
    const text = commands.find((command) => command.kind === "text") as { body: string };
    expect(text.body).toContain(`${gold.amount}G`);
    expect(loot.pages![1]!.commands.map((command) => command.kind)).toEqual(["text"]);
  });

  it("event 칩 카운터는 조사 문장을 가진다", () => {
    const { map } = build();
    const counter = map.events.find((event) => event.id.includes("_counter_"));
    expect(counter).toBeDefined();
    expect(counter!.pages![0]!.commands[0]).toMatchObject({ kind: "text" });
  });

  it("건물 밖은 공허 타일이고 천장은 한 겹만 남는다", () => {
    const { map } = build();
    expect(map.lowerTiles[0]).toBe(OUTSIDE_VOID_TILE);
    expect(map.lowerTiles.filter((tile) => tile === OUTSIDE_VOID_TILE).length).toBeGreaterThan(map.width * 2);
  });

  it("객실 2개 모두에 책장을 넣으면 두 방에 다 보이고 피아노는 사라진다", () => {
    const built = build((bundle) => {
      bundle.things = bundle.things.filter((thing) => thing.objectId !== "piano");
      bundle.things.push({ id: "bookshelf", label: "책장", objectId: "bookshelf", placeIds: ["bedroom"], chips: ["block"] });
    });
    const shelf = interiorObjectById("bookshelf")!.cells.map((cell) => cell.tile);
    for (const room of built.rooms.filter((entry) => entry.placeId === "bedroom")) {
      let hits = 0;
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (let x = room.x; x < room.x + room.w; x += 1) if (shelf.includes(built.map.lowerTiles[y * built.map.width + x]!)) hits += 1;
      }
      expect(hits, `${room.roomId} 에 책장 없음`).toBe(9);
    }
    expect(mapHasObject(built.map, "piano")).toBe(false);
  });
});

describe("place_concept plan — 모델이 설계하고 코드가 시공한다 (2026-09-03)", () => {
  type PlanData = { planned: boolean; seed: number; rooms: { placeId: string; role: string }[]; used: { placeId: string; things: { objectId: string }[] }[]; floors: { level: number; mapId: string }[] };
  function template(context: ToolContext, query = "여관") {
    const result = runTool(context, "get_concept_facility", { query }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    return result.data as { facilities: string[]; template: { plan: { wall?: string; places: unknown[]; things: { objectId: string; required?: boolean }[] } } | null; vocabulary: { id: string; label: string; snap: string }[] };
  }

  it("get_concept_facility 는 템플릿을 plan 모양으로, 물건 어휘를 id 목록으로 돌려준다", () => {
    const data = template(ctx());
    expect(data.facilities).toContain("여관");
    expect(data.template?.plan.places.length).toBe(3);
    expect(data.template?.plan.things.map((thing) => thing.objectId)).toContain("bed_h");
    expect(data.vocabulary.map((entry) => entry.id)).toEqual(expect.arrayContaining(["bed_h", "stove", "barrel", "bookshelf"]));
  });

  it("객실 3개·주방을 설계해 넘기면 그 장소·물건대로 짓는다 (템플릿은 객실 2·주방 없음)", () => {
    const context = ctx();
    const result = runTool(context, "place_concept", {
      query: "여관",
      mapId: "map_inn_planned",
      plan: {
        places: [
          { id: "bedroom", label: "객실", role: "room", size: "s", count: 3 },
          { id: "kitchen", label: "주방", role: "room", size: "s", floor: "plank" },
          { id: "corridor", label: "복도", role: "walkway" },
          { id: "hall", label: "홀", role: "entrance", size: "l" },
        ],
        things: [
          { objectId: "bed_h", placeIds: ["bedroom"], chips: ["block", "event", "sleep"], required: true },
          { objectId: "stove", placeIds: ["kitchen"], chips: ["block", "event"], required: true },
          { objectId: "barrel", placeIds: ["kitchen", "hall"], chips: ["block"] },
          { objectId: "table_chairs", placeIds: ["hall"], chips: ["block"] },
          { objectId: "stairs", placeIds: ["corridor"], chips: ["pass", "transfer"] },
        ],
      },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as PlanData;
    expect(data.planned).toBe(true);
    expect(data.rooms.filter((room) => room.placeId === "bedroom")).toHaveLength(3);
    expect(data.rooms.some((room) => room.placeId === "kitchen")).toBe(true);
    const map = context.project.maps.map_inn_planned!;
    expect(mapHasObject(map, "stove")).toBe(true);
    expect(mapHasObject(map, "piano")).toBe(false);
  });

  it("템플릿 필수 물건(피아노·긴 탁자)을 설계에서 빼면 경고를 남기되 시공은 한다", () => {
    const context = ctx();
    const result = runTool(context, "place_concept", {
      query: "여관",
      mapId: "map_inn_no_piano",
      plan: {
        places: [{ id: "hall", role: "entrance", size: "l" }],
        things: [{ objectId: "table_chairs", placeIds: ["hall"], chips: ["block"] }],
      },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const warnings = [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])];
    expect(warnings.some((line) => line.includes("템플릿 필수 물건") && line.includes("piano"))).toBe(true);
    expect(context.project.maps.map_inn_no_piano).toBeDefined();
  });

  it("어휘에 없는 objectId 는 invalid-plan 으로 거절한다", () => {
    const result = runTool(ctx(), "place_concept", {
      query: "여관",
      mapId: "map_inn_bad",
      plan: { places: [{ id: "hall", role: "entrance" }], things: [{ objectId: "hot_tub", placeIds: ["hall"], chips: ["block"] }] },
    }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.some((issue) => issue.code === "invalid-plan")).toBe(true);
  });

  it("자유 칩은 plan 을 통과하고 모르는 장소 참조는 invalid-plan 이다", () => {
    const customChip = runTool(ctx(), "place_concept", {
      query: "여관", mapId: "map_inn_custom_chip",
      plan: { places: [{ id: "hall", role: "entrance" }], things: [{ objectId: "barrel", placeIds: ["hall"], chips: ["guest-only"] }] },
    }, { dryRun: false });
    expect(customChip.ok).toBe(true);
    const badPlace = runTool(ctx(), "place_concept", {
      query: "여관", mapId: "map_inn_bad_place",
      plan: { places: [{ id: "hall", role: "entrance" }], things: [{ objectId: "barrel", placeIds: ["cellar"], chips: ["block"] }] },
    }, { dryRun: false });
    expect(badPlace.issues?.some((issue) => issue.code === "invalid-plan")).toBe(true);
  });

  it("템플릿에 없는 시설도 plan 이 있으면 짓는다", () => {
    const context = ctx();
    const result = runTool(context, "place_concept", {
      query: "목욕탕",
      mapId: "map_bath",
      plan: { places: [{ id: "bath", role: "entrance", size: "l", floor: "stone" }], things: [{ objectId: "bucket", placeIds: ["bath"], chips: ["block"] }] },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect((result.data as { facilityLabel: string }).facilityLabel).toBe("목욕탕");
  });

  it("2층 장소를 설계하면 위층 맵이 서고 계단으로 이어진다", () => {
    const context = ctx();
    const result = runTool(context, "place_concept", {
      query: "여관",
      mapId: "map_inn_2f",
      plan: {
        places: [
          { id: "hall", role: "entrance", size: "l" },
          { id: "corridor", role: "walkway" },
          { id: "bedroom", role: "room", size: "s", count: 2, level: 2 },
          { id: "upper_hall", role: "walkway", level: 2 },
        ],
        things: [
          { objectId: "stairs", placeIds: ["corridor", "upper_hall"], chips: ["pass", "transfer"], required: true },
          { objectId: "bed_h", placeIds: ["bedroom"], chips: ["block", "event", "sleep"], required: true },
        ],
      },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as PlanData;
    expect(data.floors.map((floor) => floor.level)).toEqual([1, 2]);
    expect(context.project.maps.map_inn_2f_2f).toBeDefined();
  });

  it("seed 가 다르면 같은 설계라도 배치가 달라질 수 있고, 같은 mapId 는 seed 없이도 같은 결과다", () => {
    const tiles = (seed: number | undefined, mapId = "map_inn_seed") => {
      const context = ctx();
      const result = runTool(context, "place_concept", { query: "여관", mapId, ...(seed === undefined ? {} : { seed }) }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      const map = context.project.maps[mapId]!;
      return [...map.lowerTiles, ...map.upperTiles].join(",");
    };
    const variants = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => tiles(seed)));
    expect(variants.size).toBeGreaterThan(1);
    expect(tiles(undefined)).toBe(tiles(undefined));
  });

  it("어느 seed 로 지어도 초안 여관의 물건은 전부 자리를 얻는다", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 11, 22, 33]) {
      const result = runTool(ctx(), "place_concept", { query: "여관", mapId: "map_inn_seed_fit", seed }, { dryRun: false });
      expect(result.ok).toBe(true);
      const unplaced = [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])].filter((line) => line.includes("자리 없음"));
      expect(unplaced, `seed ${seed}: ${unplaced.join(" / ")}`).toEqual([]);
    }
  });

  it("get_concept_facility 여관 응답에 variants 가 둘 이상 있고 하나는 double-row 다", () => {
    const full = runTool(ctx(), "get_concept_facility", { query: "여관" }, { dryRun: false }).data as {
      variants?: { id: string; plan: { layout?: string } }[];
      designHint?: { rule: string };
    };
    expect((full.variants ?? []).length).toBeGreaterThanOrEqual(2);
    expect(full.variants?.some((variant) => variant.plan.layout === "double-row")).toBe(true);
    expect(full.designHint?.rule).toMatch(/수식어/);
  });

  it("plan 을 생략하면 designNote 가 템플릿 복사를 알린다", () => {
    const result = runTool(ctx(), "place_concept", { query: "여관", mapId: "map_inn_copy", seed: 7 }, { dryRun: false });
    expect(result.ok).toBe(true);
    expect((result.data as { designNote?: string }).designNote).toMatch(/템플릿/);
  });
});
