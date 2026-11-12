// SF 정거장 세계의 실내 종류 — 2026-11-12: 그 세계 표에는 실내 종류가 0이라 «촌장 집» 같은 실내 요청이 «실내 종류 없음» 으로 거절됐다.
// 전국·에도와 달리 선언만으로는 안 됐다: 구성기의 station·lab 은 그 자체가 밀폐된 갑판 한 장(로비+복도+선실…)이라 집 문에 달 방이 아니다.
// 한 칸짜리 방 셋(quarters · canteen · clinic)을 구성기에 더하고(가구 한 벌은 갑판의 같은 방 것 — 새 그림 없음), 갑판의 승강기·에어록을 문으로 돌려준다.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다). 같은 값의 실측은 PR 본문.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { SF_DEFAULT_SIZE, SF_MAP_KINDS, SF_ROOM_KINDS } from "@/project/sfStationComposer";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { withTodoLoop } from "@/ai/v2/loop/todoTools";
import { V2Session } from "@/ai/v2/turn/session";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { builderFor } from "@/ai/v2/place/builders";
import { worldById, worldKind, worldPlaceSpec } from "@/ai/v2/place/world";
import { walkGame } from "@/ai/v2/story/makeGame";
import { transfersOut } from "@/ai/v2/judge/todoCheckFacts";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import type { GameMap, Project } from "@/project/types";

const SLOW = 120_000;

function compose(kind: string, seed: number, size = SF_DEFAULT_SIZE[kind as keyof typeof SF_DEFAULT_SIZE]) {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: false };
  const made = runTool(ctx, "create_map", { name: kind, width: size.w, height: size.h, tilesetId: "sf_station" });
  const mapId = (made.data as { mapId: string }).mapId;
  const res = runTool(ctx, "compose_sf_station_map", { mapId, kind, seed });
  return { res, project: ctx.project, map: ctx.project.maps[mapId]!, areas: ((res.data ?? {}) as { areas?: { tag: string; x: number; y: number; w: number; h: number; door?: { x: number; y: number } }[] }).areas ?? [] };
}

/** from 에서 걸어 닿지 않는 걷는 칸 수. */
function stranded(project: Project, map: GameMap, from: { x: number; y: number }): number {
  const W = map.width, H = map.height;
  const seen = new Uint8Array(W * H);
  const queue = [from.y * W + from.x];
  seen[queue[0]!] = 1;
  while (queue.length) {
    const i = queue.pop()!, x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H || seen[Y * W + X] || !isPassable(project, map, X, Y)) continue;
      seen[Y * W + X] = 1; queue.push(Y * W + X);
    }
  }
  let n = 0;
  for (let i = 0; i < W * H; i++) if (!seen[i] && isPassable(project, map, i % W, Math.floor(i / W))) n++;
  return n;
}

describe("SF 구성기 — 한 칸짜리 방 종류", () => {
  it("종류 순서: 옛 넷 뒤에 방 셋이 붙는다(옛 종류의 씨앗 덧셈은 그대로)", () => {
    expect([...SF_MAP_KINDS]).toEqual(["station", "lab", "street", "moonbase", "quarters", "canteen", "clinic"]);
    expect([...SF_ROOM_KINDS]).toEqual(["quarters", "canteen", "clinic"]);
  });

  it("방마다: 맨 아래 벽의 두 칸만 가장자리의 걷는 칸이고, 그 문에서 모든 바닥에 닿는다", () => {
    for (const kind of SF_ROOM_KINDS) for (const seed of [1, 2, 3]) {
      const { res, project, map, areas } = compose(kind, seed);
      expect(res.ok, `${kind} ${seed}: ${res.summary}`).toBe(true);
      const exit = areas.find((a) => a.tag === "exit")!;
      expect(exit?.door, `${kind} ${seed}`).toBeTruthy();
      expect(exit.door!.y).toBe(map.height - 1);
      const edge: string[] = [];
      for (let x = 0; x < map.width; x++) for (const y of [0, map.height - 1]) if (isPassable(project, map, x, y)) edge.push(`${x},${y}`);
      for (let y = 1; y < map.height - 1; y++) for (const x of [0, map.width - 1]) if (isPassable(project, map, x, y)) edge.push(`${x},${y}`);
      expect(edge, `${kind} ${seed}`).toEqual([`${exit.door!.x},${map.height - 1}`, `${exit.door!.x + 1},${map.height - 1}`]);
      expect(stranded(project, map, exit.door!), `${kind} ${seed}`).toBe(0);
      // 방 구역은 갑판의 같은 방 꼬리표다(가구 한 벌이 같다).
      expect(areas.some((a) => a.tag === { quarters: "cabin", canteen: "mess", clinic: "medbay" }[kind])).toBe(true);
    }
  }, SLOW);

  it("갑판(station · lab)은 승강기·에어록을 문으로 돌려준다 — 막힌 문 칸과 그 앞 걷는 칸", () => {
    for (const kind of ["station", "lab"] as const) for (const seed of [1, 2, 3]) {
      const { res, project, map, areas } = compose(kind, seed);
      expect(res.ok).toBe(true);
      const lifts = areas.filter((a) => a.tag === "elevator" || a.tag === "airlock");
      expect(lifts.length, `${kind} ${seed}`).toBeGreaterThanOrEqual(1);
      for (const lift of lifts) {
        expect(isPassable(project, map, lift.door!.x, lift.door!.y), `${kind} ${seed} door`).toBe(false);
        expect(isPassable(project, map, lift.door!.x, lift.door!.y + 1), `${kind} ${seed} front`).toBe(true);
      }
    }
  }, SLOW);
});

describe("SF 건물 키트의 입구 선언", () => {
  it("짝수 폭 건물은 문 그림이 걸친 가운데 두 칸이 입구다(홀수 폭은 가운데 한 칸)", () => {
    const kits = (createBlankProject().tilesets.sf_station as { structureKits?: { id: string; width: number; height: number; parts?: { kind?: string; dx?: number; dy?: number; w?: number }[] }[] }).structureKits ?? [];
    const withDoor = kits.filter((k) => (k.parts ?? []).some((p) => p.kind === "entrance"));
    expect(withDoor.length).toBe(28);
    for (const k of withDoor) {
      const p = k.parts!.find((part) => part.kind === "entrance")!;
      expect([p.dx, p.w ?? 1], k.id).toEqual(k.width % 2 === 0 ? [k.width / 2 - 1, 2] : [(k.width - 1) / 2, 1]);
      expect(p.dy, k.id).toBe(k.height - 1);
    }
    expect(withDoor.filter((k) => k.width % 2 === 0).map((k) => k.id)).toEqual(expect.arrayContaining(["sf-hab-module-3", "sf-street-data-center", "sf-hab-dome-l", "sf-elevator-door", "sf-airlock-inner"]));
  });
});

describe("SF 정거장 세계 표의 실내 종류", () => {
  const world = worldById("sf_station")!;

  it("방 셋이 실내 종류다 — 살림집은 거주실", () => {
    const indoor = world.kinds.filter((k) => k.indoor);
    expect(indoor.map((k) => k.id)).toEqual(["quarters", "canteen", "clinic"]);
    expect(indoor.filter((k) => k.home).map((k) => k.id)).toEqual(["quarters"]);
    for (const k of indoor) expect(k.compose!.size[0] * k.compose!.size[1]).toBeGreaterThanOrEqual(100);
  });

  it("갑판의 집 문은 승강기·에어록뿐이다 — 방 사이 통로(걸어 지나는 문 칸)에는 방을 달지 않는다", () => {
    for (const id of ["station", "lab"]) {
      const kind = worldKind(world, id)!;
      const blank = createBlankProject();
      const ctx: ToolContext = { project: blank, currentMapId: blank.startMapId, assistantRun: true };
      const run = createBuildRun(ctx);
      const spec = { ...worldPlaceSpec(world, kind, kind.ko), salt: 1 };
      const built = builderFor(spec)!.build(run, spec);
      expect(built.ok, built.summary).toBe(true);
      const doors = ((built.state ?? {}) as { doors?: { x: number; y: number; kit?: string }[] }).doors ?? [];
      expect(doors.length, id).toBeGreaterThanOrEqual(1);
      for (const d of doors) expect(d.kit ?? "", id).toMatch(/elevator|airlock/u);
      const map = run.ctx.project.maps[built.mapIds[0]!]!;
      for (const d of doors) expect(isPassable(run.ctx.project, map, d.x, d.y - 1), id).toBe(false);
    }
  }, SLOW);
});

describe("SF 세계에서 make_place 로 지은 방", () => {
  function turn(task: string) {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, checkpoint: async () => {},
      sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }), render: async () => "",
      preferToolNextTurn: () => {}, clearToolPreference: () => {} } as unknown as PiAssistantV2Env;
    const session = new V2Session();
    const tools = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
    const call = async (name: string, args: unknown): Promise<string> => tools.find((t) => t.name === name)!.execute(`c-${name}`, args)
      .then((r) => (r.content as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"), (e: Error) => `THROW ${e.message}`);
    return { ctx, call };
  }
  const todo = (room: string) => ({ op: "init", list: [{ phase: "장소", items: [
    { content: "바깥 만들기", id: "o", check: { kind: "place", name: "바깥", placeKind: "village", fresh: true } },
    { content: "방 만들기", id: "r", check: { kind: "place", name: room, placeKind: "interior", fresh: true } }] }] });

  it("네온 거리 뒤의 «촌장 집»: 거주실로 서고 거리의 건물 문에 양쪽으로 이어진다", async () => {
    const t = turn("네온 거리와 촌장 집 안을 만들어 줘.");
    await t.call("todo", todo("촌장 집"));
    await t.call("make_place", { type: "village", name: "바깥", style: "world:sf_station:street" });
    const home = await t.call("make_place", { type: "interior", name: "촌장 집", mapId: "" });
    const project = t.ctx.project;
    const street = Object.values(project.maps).find((m) => m.name === "바깥")!;
    const room = Object.values(project.maps).find((m) => m.name === "촌장 집");
    expect(room, home.slice(0, 600)).toBeTruthy();
    expect(room!.tilesetId).toBe("sf_station");
    expect([room!.width, room!.height]).toEqual([12, 11]);
    expect(home).toContain("«quarters» kind");
    expect(home).toMatch(/linked both ways with «바깥»/u);
    expect(home).not.toMatch(/has no indoor place kind/u);
    const walk = walkGame(project, [street.id, room!.id]);
    expect(walk.unreached).toEqual([]);
    expect(walk.noWayBack).toEqual([]);
  }, SLOW);

  it("정거장 갑판 뒤의 거주실: 승강기에 달린다 — 선실로 가는 통로의 걸음은 그대로다", async () => {
    const t = turn("우주 정거장과 선장 거주실을 만들어 줘.");
    await t.call("todo", todo("선장 거주실"));
    await t.call("make_place", { type: "village", name: "바깥", style: "world:sf_station:station" });
    const home = await t.call("make_place", { type: "interior", name: "선장 거주실", mapId: "" });
    const project = t.ctx.project;
    const deck = Object.values(project.maps).find((m) => m.name === "바깥")!;
    const room = Object.values(project.maps).find((m) => m.name === "선장 거주실");
    expect(room, home.slice(0, 600)).toBeTruthy();
    expect(home).toMatch(/linked both ways with «바깥»/u);
    const gates = transfersOut(deck).filter((x) => x.to.mapId === room!.id);
    expect(gates.length).toBeGreaterThanOrEqual(1);
    // 문은 막힌 칸(승강기 문 그림)이다 — 걸어 지나는 통로 칸에 선 이동 이벤트가 없다.
    for (const g of gates) expect(isPassable(project, deck, g.ev.x, g.ev.y)).toBe(false);
    const walk = walkGame(project, [deck.id, room!.id]);
    expect(walk.unreached).toEqual([]);
    expect(walk.noWayBack).toEqual([]);
  }, SLOW);
});
