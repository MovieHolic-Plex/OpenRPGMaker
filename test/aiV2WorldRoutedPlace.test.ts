// 칩셋 풀 마을 뒤의 둘째 장소 — 2026-11-11 map-vqa 깔기 24판: 낱말 없는 «마을» 이 풀 칩셋(해적 군도·사막)으로 깔린 뒤
// «촌장 집» 실내(손 도트 v5)와 «동쪽 들판»(버들항 숲길)은 다른 칩셋 계열이라 도구 실행기가 거절했고, 다음 호출 줄은 빈 맵(create_map)을 일렀다 —
// 촌장 집은 끝내 서지 못했고 들판은 48×36 빈 맵의 왼쪽 위 26×20 에만 소품 12무더기가 놓였다.
// make_place 는 그 프로젝트가 쓰는 세계의 종류로 짓고, 빈 땅 채우기는 터 넓이만큼 구획을 쓴다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { withTodoLoop } from "@/ai/v2/loop/todoTools";
import { V2Session } from "@/ai/v2/turn/session";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { edgeRoadMouths } from "@/ai/v2/place/roadMouths";

const SLOW = 120_000;

function turn(task: string) {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ score: 7, majors: [] }), checkpoint: async () => {},
    preferToolNextTurn: () => {}, clearToolPreference: () => {} } as unknown as PiAssistantV2Env;
  const session = new V2Session();
  const tools = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
  const call = async (name: string, args: unknown): Promise<{ ok: boolean; body: string }> => {
    const body = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args)
      .then((r) => (r.content as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"), (e: Error) => JSON.stringify({ ok: false, summary: e.message }));
    let ok = !/^Rejected:/u.test(body);
    try { const j = JSON.parse(body.split("\n")[0]!) as { ok?: boolean; notFailure?: boolean }; ok = j.ok !== false || j.notFailure === true; } catch { /* 거절 글은 JSON 이 아니다 */ }
    return { ok, body };
  };
  return { ctx, call };
}

describe("풀 칩셋 마을 뒤의 장소는 그 세계의 종류로 선다", () => {
  it("해적 군도 마을 뒤의 «촌장 집» 실내와 «동쪽 들판» 이 같은 칩셋으로 지어진다", async () => {
    const t = turn("마을과 촌장 집, 그 동쪽 들판을 만들어 줘.");
    await t.call("todo", { op: "init", list: [{ phase: "p", items: [
      { content: "마을 만들기", id: "v", check: { kind: "place", name: "새벽 마을", placeKind: "village", fresh: true } },
      { content: "촌장 집 만들기", id: "h", check: { kind: "place", name: "촌장 집", placeKind: "interior", fresh: true } },
      { content: "들판 만들기", id: "f", check: { kind: "place", name: "동쪽 들판", placeKind: "field", fresh: true } }] }] });
    const made = await t.call("make_place", { type: "village", name: "새벽 마을", style: "pool:pirate_isles", size: "small" });
    expect(made.ok, made.body.slice(0, 600)).toBe(true);
    const village = Object.values(t.ctx.project.maps).find((m) => m.name === "새벽 마을")!;
    expect(village.tilesetId).toBe("pirate_isles");
    const home = await t.call("make_place", { type: "interior", name: "촌장 집", mapId: "" });
    expect(home.ok, home.body.slice(0, 600)).toBe(true);
    expect(home.body).toContain("world:pirate_isles:");
    const house = Object.values(t.ctx.project.maps).find((m) => m.name === "촌장 집")!;
    expect(house.tilesetId).toBe("pirate_isles");
    expect(house.width * house.height).toBeLessThan(village.width * village.height / 4);
    const field = await t.call("make_place", { type: "village", name: "동쪽 들판" });
    expect(field.ok, field.body.slice(0, 600)).toBe(true);
    expect(Object.values(t.ctx.project.maps).find((m) => m.name === "동쪽 들판")!.tilesetId).toBe("pirate_isles");
    // 들판은 그 세계의 들판 종류로 선다(전에는 종류가 없어 항구 마을이 됐다).
    expect(field.body).toContain("«field» kind");
  }, SLOW);

  // 2026-11-11 map-vqa 깔기 village-to-field: 모델이 마을에 exits:["east"], 들판에 exits:["west"] 를 적었는데 둘 다 버려졌다 —
  // 마을은 섬(가장자리에 땅이 없다)으로, 들판은 항구로 지어져 «마을 동쪽 길로 나가면 들판» 이 설 자리가 없었다.
  it("나가는 변을 적은 풀 마을은 가장자리에 길이 닿는 마을로 서고, 들판도 맞닿는 변에 길 입구가 있다", async () => {
    const t = turn("마을 맵이랑 그 동쪽에 붙은 들판 맵을 만들어 줘. 마을 동쪽 길로 나가면 들판으로 이어지게 해 줘.");
    await t.call("todo", { op: "init", list: [{ phase: "p", items: [
      { content: "마을 만들기", id: "v", check: { kind: "place", name: "마을", placeKind: "village", fresh: true } },
      { content: "들판 만들기", id: "f", check: { kind: "place", name: "들판", placeKind: "field", fresh: true } }] }] });
    const made = await t.call("make_place", { spec: { type: "village", name: "마을", style: "pool:pirate_isles", size: "medium", exits: ["east"] } });
    expect(made.ok, made.body.slice(0, 600)).toBe(true);
    expect(made.body).toContain("road leaves the map at east");
    const field = await t.call("make_place", { spec: { type: "village", name: "들판", style: "field", theme: "field", exits: ["west"] } });
    expect(field.ok, field.body.slice(0, 600)).toBe(true);
    expect(field.body).toContain("road leaves the map at west");
    const project = t.ctx.project;
    const village = Object.values(project.maps).find((m) => m.name === "마을")!, meadow = Object.values(project.maps).find((m) => m.name === "들판")!;
    expect([village.tilesetId, meadow.tilesetId]).toEqual(["pirate_isles", "pirate_isles"]);
    expect(edgeRoadMouths(project, village).map((m) => m.side)).toContain("east");
    expect(edgeRoadMouths(project, meadow).map((m) => m.side)).toContain("west");
  }, SLOW);

  it("나가는 변을 적지 않은 풀 마을은 예전처럼 섬 마을이다", async () => {
    const t = turn("마을 하나 만들어 줘.");
    await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "마을 만들기", id: "v", check: { kind: "place", name: "새벽 마을", placeKind: "village", fresh: true } }] }] });
    const made = await t.call("make_place", { spec: { type: "village", name: "새벽 마을", style: "pool:pirate_isles", size: "small" } });
    expect(made.ok, made.body.slice(0, 600)).toBe(true);
    const village = Object.values(t.ctx.project.maps).find((m) => m.name === "새벽 마을")!;
    expect([village.width, village.height]).toEqual([48, 36]);
    expect(edgeRoadMouths(t.ctx.project, village)).toEqual([]);
  }, SLOW);
});

describe("빈 땅 채우기는 터 넓이만큼 구획을 쓴다", () => {
  it("48×36 빈 들판을 채우면 오른쪽·아래쪽 절반에도 무더기가 놓인다(전에는 왼쪽 위 12구획에서 멈췄다)", () => {
    const ctx = { project: createBlankProject() };
    const made = runTool(ctx, "create_map", { name: "동쪽 들판", width: 48, height: 36, tilesetId: "desert_east" });
    const mapId = (made.data as { mapId: string }).mapId;
    const filled = runTool(ctx, "furnish_outdoor_area", { mapId, region: "all", style: "auto", seed: 4, props: ["마른 풀 포기", "사막 덤불", "작은 바위", "우산 아카시아"], amount: "fill" });
    expect(filled.ok, filled.summary).toBe(true);
    const lots = (filled.data as { lots: { x: number; y: number }[] }).lots;
    expect(lots.length).toBeGreaterThan(12);
    expect(lots.filter((l) => l.x >= 24).length).toBeGreaterThan(4);
    expect(lots.filter((l) => l.y >= 18).length).toBeGreaterThan(4);
    // «조금만» 은 그대로 세 무더기다.
    const few = runTool(ctx, "furnish_outdoor_area", { mapId, region: "all", seed: 9, props: ["작은 바위"], amount: "few" });
    expect((few.data as { lots: unknown[] }).lots.length).toBeLessThanOrEqual(3);
  }, SLOW);
});
