import { expect, it } from "vitest";
import { indexProject } from "@/ai/v2/loop/refs";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import { loadPlaces, savePlaces } from "@/ai/v2/tools/placeMemory";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { createBlankProject } from "@/project/defaults/blankProject";
import { deserialize, serialize } from "@/project/io/serialize";

function turn(project = createBlankProject(), session = new V2Session()) {
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true };
  const env = {
    ctx, request: { project, task: "서울에 시설 실내를 지어 줘.", projectKey: "modern-facility", provider: "local-cli:claude", mapIds: [] },
    emit: () => {}, record: () => {}, sideChat: async () => "{}", checkpoint: async () => {},
  } as PiAssistantV2Env;
  const tools = createV2Tools(env, session);
  async function call(name: string, args: unknown) {
    const response = await tools.find((tool) => tool.name === name)!.execute(name, args);
    const result = JSON.parse(response.content.find((entry) => entry.type === "text")!.text) as { ok: boolean; summary: string; mapIds: string[] };
    expect(result.ok, result.summary).toBe(true);
    return result.mapIds[0]!;
  }
  return {
    ctx, session, call, tools,
    make: (spec: Omit<PlaceSpec, "type" | "style">) => call("make_place", { type: "house", style: "kr-modern", ...spec }),
    program: (mapId: string) => (session.placeOf(mapId)?.result.state as { program?: string } | undefined)?.program,
  };
}

it.each([
  [{ name: "오래된 아파트", hints: { program: "" } }, "mc_old_apartment", "oa-corridor"],
  [{ name: "Riverside Old Apartment" }, "mc_old_apartment", "oa-room-a"],
  [{ name: "은하 아파트", theme: "낡은 아파트" }, "mc_old_apartment", "oa-stair"],
  [{ name: "서울 만화 카페" }, "mc_manga_cafe", "mg-booths"],
  [{ name: "별빛 치과" }, "mc_dental", "dn-xray"],
  [{ name: "서울 버스 터미널" }, "mc_bus_terminal", "bs-hall"],
  [{ name: "서울 아파트" }, "apartment", "living"],
  [{ name: "온기 카페", theme: "오래된 아파트 근처" }, "cafe", "cafe"],
  [{ name: "동네 편의점" }, "neighborhood-konbini", "konbini-stock"],
  [{ name: "오래된 아파트", hints: { program: "apartment" } }, "apartment", "living"],
] satisfies [Omit<PlaceSpec, "type" | "style">, string, string][])(
  "builds %o with its selected %s interior",
  async (spec, expectedProgram, room) => {
    const host = turn();
    const mapId = await host.make(spec);
    expect(host.program(mapId)).toBe(expectedProgram);
    const map = host.ctx.project.maps[mapId]!;
    expect(map.tilesetId).toBe("modern_city");
    expect(map.locations?.some((location) => location.name === room && location.tags?.includes("hand-layout-room"))).toBe(true);
  },
);

it("exposes the program hint and accepts an empty selection on the Japanese house path", async () => {
  const host = turn();
  const make = host.tools.find((tool) => tool.name === "make_place")!;
  const edit = host.tools.find((tool) => tool.name === "edit_place")!;
  const hints = { properties: { program: { type: "string" } } };
  expect(make.parameters).toMatchObject({ properties: { hints } });
  expect(edit.parameters).toMatchObject({ properties: { patch: { properties: { set: { properties: { hints } } } } } });
  const mapId = await host.call("make_place", { type: "house", style: "jp-modern", name: "일본 원룸", hints: { program: "" } });
  expect(host.ctx.project.maps[mapId]!.tilesetId).toBe("jp_city");
  expect(host.session.placeOf(mapId)?.result.state).toMatchObject({ args: { layout: { program: "apartment-1k" } } });
});

it("keeps the actual program of a pre-change saved place on an unrelated edit", async () => {
  const source = turn();
  const mapId = await source.make({ name: "오래된 아파트", hints: { program: "apartment" } });
  const old = source.session.placeOf(mapId)!;
  // Before catalog selection, the same name produced this generic apartment without a hint.
  source.session.places.set(mapId, { ...old, spec: { ...old.spec, hints: undefined } });
  const saved = savePlaces(source.session, source.ctx.project, indexProject(source.ctx.project));
  const project = deserialize(serialize(source.ctx.project));
  const session = new V2Session();
  expect(loadPlaces(saved, session, project, indexProject(project)).restored).toBe(1);
  const current = turn(project, session);
  const before = project.maps[mapId]!;
  const editedId = await current.call("edit_place", { patch: { mapId, set: { name: "별빛 오래된 아파트" } } });
  expect(editedId).toBe(mapId);
  expect(current.program(mapId)).toBe("apartment");
  expect(current.ctx.project.maps[mapId]!.lowerTiles).toEqual(before.lowerTiles);
  expect(current.ctx.project.maps[mapId]!.upperTiles).toEqual(before.upperTiles);
});
