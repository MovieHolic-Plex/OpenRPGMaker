// 장면 다듬기 경고(scene-*) — 세 데모(「첫사랑」·Fallen Star·Astra Horizon)를 사람이 손으로 고친 결함을 조수가 바로 듣게 한다.
// 규칙: src/project/lint/scenePolishLint.ts · 스킬: assistant-skills/game-scene-polish/SKILL.md
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { lintScenePolish, newScenePolishIssues } from "@/project/lint/scenePolishLint";
import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";

function page(commands: Command[], extra: Partial<EventPage> = {}): EventPage {
  return {
    id: `p${Math.random().toString(36).slice(2, 7)}`, name: "", conditions: [], graphic: { transparent: true },
    trigger: { kind: "playerTouch" }, priority: "below", movement: { type: "fixed", speed: 3, frequency: 3 }, commands, ...extra,
  } as unknown as EventPage;
}

function ev(id: string, x: number, y: number, pages: EventPage[], name = id): GameEvent {
  return { id, name, x, y, pages } as unknown as GameEvent;
}

const npcPage = (commands: Command[] = []): EventPage =>
  page(commands, { graphic: { sprite: { type: "bundled", id: "Actor1" } } as EventPage["graphic"], trigger: { kind: "action" } as EventPage["trigger"], priority: "same" });

/** 두 맵(밖·안) + 버들항 「문」 타일 하나. 밖 문 칸 (5,5), 안 출구 (5,10). */
function fixture(): { project: Project; out: GameMap; inn: GameMap; door: number } {
  const project = createBlankProject();
  const out = Object.values(project.maps)[0]!;
  const tileset = project.tilesets[out.tilesetId] as unknown as { tileMeta: Array<{ label?: string } | undefined> };
  const door = tileset.tileMeta.findIndex((meta) => /집 문/u.test(meta?.label ?? ""));
  expect(door).toBeGreaterThan(0);
  const inn = { ...structuredClone(out), id: "map_inn", name: "여관", events: [] } as GameMap;
  project.maps[inn.id] = inn;
  out.events = [];
  project.startMapId = out.id;
  for (const map of [out, inn]) map.bgm = { mode: "custom", resourceId: "bgm" };
  return { project, out, inn, door };
}

function setTile(map: GameMap, x: number, y: number, tile: number): void {
  const upper = (map as unknown as { upperTiles: number[] }).upperTiles;
  upper[y * map.width + x] = tile;
}

const codes = (project: Project): string[] => lintScenePolish(project).map((issue) => issue.code).sort();
const transfer = (mapId: string, x: number, y: number, direction?: "up" | "down"): Command =>
  ({ kind: "transfer", mapId, x, y, ...(direction ? { direction } : {}) }) as Command;

describe("scene-transfer-*", () => {
  it("문 칸 위의 왕복 문, 착지가 돌아오는 문 앞, 문을 등지면 조용하다", () => {
    const { project, out, inn, door } = fixture();
    setTile(out, 5, 5, door);
    setTile(inn, 5, 10, door);
    out.events.push(ev("door_out", 5, 5, [page([transfer(inn.id, 5, 9, "up")])]));
    inn.events.push(ev("door_in", 5, 10, [page([transfer(out.id, 5, 6, "down")])]));
    expect(codes(project)).toEqual([]);
  });

  it("문 그림 옆 보도 칸에서 발동하면 문 칸으로 옮기라고 한다", () => {
    const { project, out, inn, door } = fixture();
    setTile(out, 5, 5, door);
    out.events.push(ev("door_out", 5, 6, [page([transfer(inn.id, 5, 9, "up")])]));
    const issue = lintScenePolish(project).find((i) => i.code === "scene-transfer-off-door");
    expect(issue?.message).toContain("문 칸 (5,5)");
  });

  it("맨바닥 출구·방향 없는 이동·문에서 먼 착지·문을 보는 착지를 잡는다", () => {
    const { project, out, inn } = fixture();
    out.events.push(ev("door_out", 8, 7, [page([transfer(inn.id, 5, 7)])]));
    inn.events.push(ev("door_in", 5, 10, [page([transfer(out.id, 8, 6, "up")])]));
    const found = codes(project);
    expect(found).toContain("scene-transfer-off-door");
    expect(found).toContain("scene-transfer-facing");
    expect(lintScenePolish(project).filter((i) => i.code === "scene-transfer-pair").map((i) => i.message).join("\n"))
      .toMatch(/3칸 떨어져|문을 등지지 않는다/u);
  });

  it("맵 가장자리 출구와 대사가 있는 장면 전환은 문 검사에서 뺀다", () => {
    const { project, out, inn } = fixture();
    out.events.push(ev("edge", 0, 7, [page([transfer(inn.id, 5, 9, "up")])]));
    out.events.push(ev("cut", 9, 9, [page([{ kind: "text", body: "다음 날" } as Command, transfer(inn.id, 4, 4, "down")], { trigger: { kind: "auto" } as EventPage["trigger"] })]));
    expect(codes(project).filter((c) => c === "scene-transfer-off-door")).toEqual([]);
  });
});

describe("scene-npc-vanish", () => {
  const goneSwitchPage = (): EventPage => page([], { conditions: [{ kind: "switch", switchId: "sw_gone", value: true }] as EventPage["conditions"] });

  it("스위치로 «떠남» 페이지가 되면 제자리 사라짐이다", () => {
    const { project, out } = fixture();
    out.events.push(ev("npc", 6, 6, [npcPage([{ kind: "text", body: "잘 가" } as Command, { kind: "setSwitch", switchId: "sw_gone", value: true } as Command]), goneSwitchPage()]));
    expect(codes(project)).toContain("scene-npc-vanish");
  });

  it("출구(가장자리)까지 걸어간 뒤면 조용하다", () => {
    const { project, out } = fixture();
    const walk = { kind: "moveEvent", eventId: "", route: { moves: Array.from({ length: 6 }, () => ({ kind: "move", dir: "left" })), repeat: false, wait: true } } as unknown as Command;
    out.events.push(ev("npc", 6, 6, [npcPage([walk, { kind: "setSwitch", switchId: "sw_gone", value: true } as Command]), goneSwitchPage()]));
    expect(codes(project)).not.toContain("scene-npc-vanish");
  });

  it("전투 직후 대사 없이 사라지는 필드 적과 합류하는 동료는 괜찮다", () => {
    const { project, out } = fixture();
    const battle = { kind: "battleProcessing", troopId: "t", canEscape: false, canLose: false, branchOnResult: true,
      victoryBranch: [{ kind: "setSwitch", switchId: "sw_gone", value: true }] } as unknown as Command;
    out.events.push(ev("foe", 6, 6, [npcPage([battle]), goneSwitchPage()]));
    expect(codes(project)).not.toContain("scene-npc-vanish");
  });

  it("Erase Event 로 방 가운데서 지우면 잡는다", () => {
    const { project, out } = fixture();
    out.events.push(ev("npc", 9, 7, [npcPage([{ kind: "text", body: "그럼 이만" } as Command, { kind: "m2Command", commandId: "m2-086-erase-event", fields: {} } as Command])]));
    expect(codes(project)).toContain("scene-npc-vanish");
  });
});

describe("대화창·음악·탈것·겹침", () => {
  it("대사 위치가 섞이면 한 건, 말풍선도 한 건", () => {
    const { project, out } = fixture();
    out.events.push(ev("talk", 9, 7, [npcPage([
      { kind: "text", body: "a", position: "bottom" } as Command,
      { kind: "text", body: "b", position: "top" } as Command,
      { kind: "text", body: "c", container: "balloon" } as Command,
      { kind: "text", body: "d", context: "sign", position: "top" } as Command,
    ])]));
    const found = codes(project);
    expect(found.filter((c) => c === "scene-dialogue-position-mixed")).toHaveLength(1);
    expect(found).toContain("scene-dialogue-context-mixed");
  });

  it("들르는 맵에 BGM 이 없으면 잡고, 명시 «없음» 은 의도로 둔다", () => {
    const { project, out, inn } = fixture();
    out.events.push(ev("cut", 9, 9, [page([transfer(inn.id, 4, 4, "down")], { trigger: { kind: "auto" } as EventPage["trigger"] })]));
    delete inn.bgm;
    expect(lintScenePolish(project).filter((i) => i.code === "scene-map-no-bgm").map((i) => i.mapId)).toEqual([inn.id]);
    inn.bgm = { mode: "none" };
    expect(codes(project)).not.toContain("scene-map-no-bgm");
  });

  it("움직이는 교통과 같은 칸으로 걷는 두 인물을 잡는다", () => {
    const { project, out } = fixture();
    (out as unknown as { transit: unknown }).transit = { routes: [{ id: "r", kind: "road", path: [{ x: 0, y: 3 }, { x: 19, y: 3 }], vehicles: ["car"] }] };
    const to = (eventId: string, moves: string[]) => ({ kind: "moveEvent", eventId, route: { moves: moves.map((dir) => ({ kind: "move", dir })), repeat: false, wait: true } }) as unknown as Command;
    out.events.push(ev("a", 4, 8, [npcPage()]), ev("b", 6, 8, [npcPage()]));
    out.events.push(ev("scene", 1, 1, [page([to("a", ["right"]), to("b", ["left"])], { trigger: { kind: "auto" } as EventPage["trigger"] })]));
    const found = codes(project);
    expect(found).toContain("scene-moving-vehicle");
    expect(found).toContain("scene-actors-stacked");
  });

  it("같은 출구 칸으로 차례로 떠나면(앞 인물이 먼저 사라지면) 겹침이 아니다", () => {
    const { project, out } = fixture();
    const to = (eventId: string, moves: string[]) => ({ kind: "moveEvent", eventId, route: { moves: moves.map((dir) => ({ kind: "move", dir })), repeat: false, wait: true } }) as unknown as Command;
    const hidden = page([], { conditions: [{ kind: "switch", switchId: "sw_a_left", value: true }] as EventPage["conditions"] });
    out.events.push(ev("a", 4, 8, [npcPage(), hidden]), ev("b", 6, 8, [npcPage()]));
    out.events.push(ev("scene", 1, 1, [page([
      to("a", ["right"]), { kind: "setSwitch", switchId: "sw_a_left", value: true } as Command, to("b", ["left"]),
    ], { trigger: { kind: "auto" } as EventPage["trigger"] })]));
    expect(codes(project)).not.toContain("scene-actors-stacked");
  });
});

describe("쓰기 도구용 새 경고만", () => {
  it("이미 있던 경고는 다시 싣지 않고 이번 변경이 만든 것만 돌려준다", () => {
    const { project: before, out } = fixture();
    out.events.push(ev("old", 8, 7, [page([transfer(Object.keys(before.maps)[1]!, 5, 7)])]));
    const after = structuredClone(before);
    expect(newScenePolishIssues(before, after)).toEqual([]);
    delete Object.values(after.maps)[1]!.bgm;
    expect(newScenePolishIssues(before, after).map((i) => i.code)).toEqual(["scene-map-no-bgm"]);
  });
});

describe("scene-hang-on-floor", () => {
  it("손 도트 실내의 벽 걸이(별자리표)가 바닥 칸에 서면 잡고, 벽면에 걸면 조용하다", async () => {
    const { runTool } = await import("@/editor/tools");
    const ctx = { project: createBlankProject() };
    const plan = ["##########", "#........#", "#........#", "#........#", "#........#", "####.#####"];
    const built = runTool(ctx, "build_hand_interior_room", { name: "서재", plan, floor: "boards", wall: "grey" });
    expect(built.ok, built.summary).toBe(true);
    const map = ctx.project.maps[(built.data as { mapId: string }).mapId]!;
    const kits = (ctx.project.tilesets[map.tilesetId] as unknown as { structureKits: Array<{ id: string; rows: Array<{ upperTiles: number[] }> }> }).structureKits;
    const chart = kits.find((k) => k.id === "hand-interior:star chart")!.rows[0]!.upperTiles[0]!;
    const hangCodes = (): string[] => lintScenePolish(ctx.project).filter((i) => i.code === "scene-hang-on-floor").map((i) => i.code);
    expect(hangCodes()).toEqual([]);
    const upper = (map as unknown as { upperTiles: number[] }).upperTiles;
    const floorCell = 4 * map.width + 4;
    upper[floorCell] = chart;
    expect(hangCodes()).toEqual(["scene-hang-on-floor"]);
  });
});

describe("scene-ceiling-tile", () => {
  it("천장 칸에 바닥이 얹히거나 방 밖에 고립 바닥이 깔리면 잡고, 깨끗한 방은 조용하다", async () => {
    const { runTool } = await import("@/editor/tools");
    const ctx = { project: createBlankProject() };
    const plan = ["##########", "#........#", "#........#", "#........#", "#........#", "####.#####"];
    const built = runTool(ctx, "build_hand_interior_room", { name: "서재", plan, floor: "boards", wall: "grey" });
    expect(built.ok, built.summary).toBe(true);
    const map = ctx.project.maps[(built.data as { mapId: string }).mapId]!;
    const grids = map as unknown as { lowerTiles: number[]; upperTiles: number[] };
    const tileset = ctx.project.tilesets[map.tilesetId] as unknown as { tileMeta: Record<number, { tags?: string[] } | undefined> };
    const codes = (): string[] => lintScenePolish(ctx.project).filter((i) => i.code === "scene-ceiling-tile").map((i) => i.code);
    expect(codes()).toEqual([]);
    const isCeil = (t: number): boolean => (tileset.tileMeta[t]?.tags ?? []).includes("천장");
    const ceilCells = grids.lowerTiles.map((t, i) => (isCeil(t) ? i : -1)).filter((i) => i >= 0);
    expect(ceilCells.length).toBeGreaterThan(0);
    const floorTile = grids.lowerTiles[3 * map.width + 4]!;
    // ① 천장 칸 위층에 바닥 조각
    const c = ceilCells[0]!;
    grids.upperTiles[c] = floorTile;
    expect(codes()).toEqual(["scene-ceiling-tile"]);
    grids.upperTiles[c] = -1;
    expect(codes()).toEqual([]);
    // ② 방 밖 천장 띠에 고립된 바닥 값 칸(이벤트 없음)
    const lone = ceilCells.find((i) => {
      const x = i % map.width, y = Math.floor(i / map.width);
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => {
        const nx = x + dx!, ny = y + dy!;
        return nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || isCeil(grids.lowerTiles[ny * map.width + nx]!);
      });
    });
    expect(lone).toBeDefined();
    grids.lowerTiles[lone!] = floorTile;
    expect(codes()).toEqual(["scene-ceiling-tile"]);
  });
});
