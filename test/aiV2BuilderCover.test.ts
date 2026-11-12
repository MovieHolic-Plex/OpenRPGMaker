// 풀 칩셋 마을 뒤의 실내 · 비평가가 본 그림 — 2026-11-12 map-vqa 깔기 24요청을 실제 입력창으로 다시 돌린 판(Terra high)에서 본 것:
//  - village-chief-house: «촌장 집»이 해적 군도 오두막으로 서긴 했지만 마을과 이어지지 않았고(결과 글은 «create_transfer_pair 로 이어라» — 그 요청의 도구 목록에 없던 동사),
//    모델이 그 방에 걸어 둔 칸 배치·자기 검토·방 그래프 항목은 아무도 할 수 없어 할 일 여덟이 막힘으로 끝났다. edit_place 거절 한 번이 다른 항목 다섯의 막힘을 되돌렸다.
//  - village: 비평가가 «우물이 안 보인다» 고 한 뒤 모델이 우물을 stamp_object 로 놓았는데, 끝맺음 관문은 짓기 때의 비평을 다시 읽어 같은 항목을 두 번 더 열었다.
//  - 미완료 18요청 중 11요청: 관문 항목이 «고치는 도구(set_field_hud)가 이 실행의 도구 목록에 없다» 로 막혔다 — 그 요청의 묶음에 없을 뿐 조수 v2 에는 있는 도구다.
//  - weapon-shop: 자기 검토 두 바퀴가 고치기 상한 3을 먹어, 비평 항목이 한 번 고친 뒤 «상한»으로 막혔다(도구는 «남은 바퀴 9» 라고 했다).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { withTodoLoop } from "@/ai/v2/loop/todoTools";
import { callInText } from "@/ai/v2/loop/nextCall";
import { V2Session, repairCapOf, V2_MAX_REPAIR_ROUNDS } from "@/ai/v2/turn/session";
import { relookChangedPlaces } from "@/ai/v2/turn/relook";
import { v2GateProblems } from "@/ai/v2/judge/finishGate";
import { runTodoCheck } from "@/ai/v2/judge/todoChecks";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { syncGateItems } from "@/ai/v2/judge/gates";
import { turnLateTools } from "@/ai/v2/turn/lateTools";
import { createV2Turn } from "@/ai/v2/turn/turn";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import { todoReport } from "@/ai/v2/judge/finalReport";
import type { PlaceSpec } from "@/ai/v2/shared/types";

const SLOW = 120_000;

/** 맵 타일이 바뀌면 글자가 바뀌는 가짜 1배 그림(PNG 머리 24바이트 + 맵 지문). */
function fakePicture(map: { width: number; height: number; lowerTiles?: unknown; upperTiles?: unknown; events?: unknown }): string {
  const head = Buffer.alloc(24);
  head.writeUInt32BE(map.width * 16, 16); head.writeUInt32BE(map.height * 16, 20);
  let h = 0;
  for (const ch of JSON.stringify([map.lowerTiles, map.upperTiles, map.events])) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `data:image/png;base64,${head.toString("base64")}${Buffer.from(String(h)).toString("base64")}`;
}

function turn(task: string, critic: (calls: number) => unknown = () => ({ imagesSeen: 1, score: 7, majors: [] }), projectKey?: string) {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  let criticCalls = 0;
  const env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project, ...(projectKey ? { projectKey } : {}) } as never, emit: () => {}, record: () => {}, checkpoint: async () => {},
    sideChat: async () => JSON.stringify(critic(++criticCalls)),
    render: async (mapId: string) => fakePicture(ctx.project.maps[mapId]!),
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
  return { ctx, env, session, call, criticCalls: () => criticCalls };
}

const goes = (project: ToolContext["project"], from: string, to: string) => JSON.stringify(project.maps[from]?.events ?? []).includes(`"mapId":"${to}"`);

describe("풀 칩셋 마을 뒤의 실내는 make_place 가 집 문에 잇고, 그 방의 방 검사는 빌더가 덮는다", () => {
  it("해적 군도 마을 뒤의 «촌장 집»: 양쪽으로 이어지고 칸 배치·자기 검토·방 그래프 항목이 닫힌다", async () => {
    const t = turn("작은 마을이랑 촌장 집 안을 만들어 줘.");
    const room = (kind: string) => ({ kind, map: "촌장 집", fresh: true });
    await t.call("todo", { op: "init", list: [{ phase: "장소", items: [
      { content: "마을 만들기", id: "v", check: { kind: "place", name: "새벽 마을", placeKind: "village", fresh: true } },
      { content: "촌장 집 만들기", id: "house", check: { kind: "place", name: "촌장 집", placeKind: "interior", fresh: true } },
      { content: "촌장 집 배치", id: "layout", check: room("layout_built") }, { content: "촌장 집 검토", id: "review", check: room("layout_review") }, { content: "촌장 집 방 구조", id: "graph", check: room("room_graph") },
      { content: "마을에서 집으로", id: "in", check: { kind: "link", from: "새벽 마을", to: "촌장 집" } }, { content: "집에서 마을로", id: "out", check: { kind: "link", from: "촌장 집", to: "새벽 마을" } },
      { content: "광장 꾸미기", id: "deco" }] }] });
    const made = await t.call("make_place", { type: "village", name: "새벽 마을", style: "pool:pirate_isles", size: "small" });
    expect(made.ok, made.body.slice(0, 600)).toBe(true);
    const village = Object.values(t.ctx.project.maps).find((m) => m.name === "새벽 마을")!;
    const home = await t.call("make_place", { type: "interior", name: "촌장 집", mapId: "" });
    expect(home.ok, home.body.slice(0, 600)).toBe(true);
    const house = Object.values(t.ctx.project.maps).find((m) => m.name === "촌장 집")!;
    // 이어짐: 두 맵의 이동 이벤트가 서로를 가리키고, 결과 글은 두 문의 칸을 말한다 — 잇는 동사 이름은 없다.
    expect(goes(t.ctx.project, village.id, house.id)).toBe(true);
    expect(goes(t.ctx.project, house.id, village.id)).toBe(true);
    expect(home.body).toMatch(/linked both ways with «새벽 마을»/u);
    expect(home.body).not.toContain("create_transfer_pair");
    // 빌더가 덮은 항목은 모델의 done 없이 닫힌다.
    expect(home.body).toContain("[Covered by the builder ✓]");
    for (const id of ["layout", "review", "graph"]) expect(t.session.todo.get(id)?.status, id).toBe("completed");
    for (const id of ["in", "out"]) expect((await t.call("todo", { op: "done", task: id })).ok, id).toBe(true);
    // 구성기 방에 온 칸 배치: 다음 호출은 실제 값이 찬 호출 하나(뼈대 place_object({"mapId":…}) 가 아니다).
    const refused = await t.call("edit_place", { patch: { mapId: house.id, addAnchors: [{ what: "촌장의 책상", near: { x: 4, y: 5 } }] }, todoId: "house" });
    expect(refused.ok).toBe(false);
    expect(refused.body).toContain(`draw_object({"object":{"what":"촌장의 책상","mapId":"${house.id}","at":{"x":4,"y":5}}})`);
    expect(refused.body).not.toContain("[Next call]");
    // 그 거절은 house 항목의 것이다 — 다른 항목(deco)의 막힘을 되돌리지 않는다.
    const blocked = await t.call("todo", { op: "block", task: "deco", reason: "광장에 놓을 그림이 없다" });
    expect(blocked.ok, blocked.body.slice(0, 300)).toBe(true);
  }, SLOW);

  it("이어지지 않은 구성기 방은 덮였다고 하지 않는다 — 걸린 사실을 적는다", async () => {
    const t = turn("작은 마을이랑 촌장 집 안을 만들어 줘.");
    await t.call("todo", { op: "init", list: [{ phase: "장소", items: [{ content: "마을 만들기", id: "v", check: { kind: "place", name: "새벽 마을", placeKind: "village", fresh: true } }] }] });
    await t.call("make_place", { type: "village", name: "새벽 마을", style: "pool:pirate_isles", size: "small" });
    await t.call("make_place", { type: "interior", name: "촌장 집", mapId: "" });
    const house = Object.values(t.ctx.project.maps).find((m) => m.name === "촌장 집")!;
    const linked = runTodoCheck(t.ctx.project, { kind: "layout_built", map: "촌장 집" });
    expect(linked.pass, linked.detail).toBe(true);
    expect(linked.covered).toBe(true);
    // 두 맵의 이동 이벤트를 걷어 내면 ✗ — 들어오는 이동이 없다고 적는다.
    const maps = Object.fromEntries(Object.entries(t.ctx.project.maps).map(([id, m]) => [id, { ...m, events: (m.events ?? []).filter((e) => !JSON.stringify(e).includes('"kind":"transfer"')) }]));
    const cut = runTodoCheck({ ...t.ctx.project, maps } as typeof t.ctx.project, { kind: "layout_built", map: "촌장 집" });
    expect(cut.pass).toBe(false);
    expect(cut.covered).toBeUndefined();
    expect(cut.detail).toMatch(/들어오는 이동이 어느 맵에도 없다|들어오는 칸·시작점이 없어/u);
    expect(cut.evidence?.mapId).toBe(house.id);
  }, SLOW);
});

describe("실내 종류가 없는 세계의 실내 요청은 바깥 종류로 짓지 않는다", () => {
  it("황무지 정착지 뒤의 «촌장 집»: 짓지 않고 까닭과 없는 그림 기록을 남긴다(정착지 한 장이 «촌장 집» 으로 서지 않는다)", async () => {
    // 황무지는 실내 그림이 아직 없는 세계다(전국·에도는 2026-11-12 에 방 구성 여섯을 실내 종류로 받았다 — test/aiV2SengokuRooms.test.ts).
    const t = turn("황무지 생존자 정착지랑 촌장 집 안을 만들어 줘.");
    await t.call("todo", { op: "init", list: [{ phase: "장소", items: [
      { content: "정착지 만들기", id: "v", check: { kind: "place", name: "새벽 정착지", placeKind: "village", fresh: true } },
      { content: "촌장 집 만들기", id: "house", check: { kind: "place", name: "촌장 집", placeKind: "interior", fresh: true } }] }] });
    const made = await t.call("make_place", { type: "village", name: "새벽 정착지", style: "world:wasteland:settlement" });
    expect(Object.values(t.ctx.project.maps).find((m) => m.name === "새벽 정착지")?.tilesetId).toBe("wasteland_ruins");
    expect(made.ok, made.body.slice(0, 600)).toBe(true);
    const before = Object.keys(t.ctx.project.maps).length;
    const home = await t.call("make_place", { type: "interior", name: "촌장 집", mapId: "" });
    expect(home.ok).toBe(false);
    expect(home.body).toMatch(/has no indoor place kind/u);
    // 다음 호출은 지금 하던 항목을 막는 호출이다(정착지 항목이 아직 열려 있으면 그 항목 — 황무지 정착지는 «마을» 장소 확인을 아직 못 넘는다).
    expect(home.body).toMatch(/Next call: todo\(\{"op":"block","task":"(v|house)","reason":"Wasteland has no indoor place kind/u);
    expect(Object.keys(t.ctx.project.maps).length).toBe(before);
    expect([...t.session.missingArt].some((line) => line.includes("indoor-kind") && line.includes("wasteland_ruins"))).toBe(true);
    const blocked = await t.call("todo", { op: "block", task: "house", reason: "Wasteland has no indoor place kind" });
    expect(blocked.ok, blocked.body.slice(0, 300)).toBe(true);
  }, SLOW);
});

describe("거절 글이 준 호출을 그대로 꺼낸다", () => {
  it("인자가 다 찬 호출은 그대로, 자리표시가 섞인 호출은 건너뛴다", () => {
    const text = 'Not drawn — this chipset already has an object. Next call: place_object({"mapId":"map_a","objectId":"bd-garden-gate","at":{"x":21,"y":13}}) — it stamps that object.';
    expect(callInText(text, ["place_object"])).toMatchObject({ verb: "place_object", args: { mapId: "map_a", objectId: "bd-garden-gate", at: { x: 21, y: 13 } }, exact: true });
    // JSON 글 속(따옴표가 \" 로 적힌 도구 결과)에서도 읽는다.
    expect(callInText(JSON.stringify({ ok: false, summary: text }), ["place_object"])?.args).toMatchObject({ objectId: "bd-garden-gate" });
    expect(callInText(text, ["make_place"])).toBeUndefined();
    expect(callInText('Next call: place_object({"mapId":"map_a","objectId":<that id>})', ["place_object"])).toBeUndefined();
  });
});

describe("비평가가 본 그림이 낡았으면 다시 본다", () => {
  it("비평 뒤에 맵에 물건을 놓으면 끝맺음 관문 전에 비평가가 지금 그림을 다시 보고, 지적이 사라지면 장소 고치기 항목이 없다", async () => {
    // 첫 비평(짓기 때)은 «우물이 안 보인다», 그 뒤의 비평은 지적 없음.
    const t = turn("작은 시골 마을 맵을 만들어 줘. 우물이 있게 해 줘.", (n) => (n === 1
      ? { imagesSeen: 1, score: 7, majors: [{ axis: 1, x: 0, y: 0, w: 10, h: 10, what: "요청한 우물로 읽히는 시설이 보이지 않는다.", fix: "우물을 놓는다." }] }
      : { imagesSeen: 1, score: 8, majors: [] }));
    await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "마을 만들기", id: "v", check: { kind: "place", name: "새벽 마을", placeKind: "village", fresh: true } }] }] });
    const made = await t.call("make_place", { type: "village", name: "새벽 마을", style: "pool:pirate_isles", size: "small" });
    expect(made.ok, made.body.slice(0, 400)).toBe(true);
    const mapId = t.ctx.project.startMapId;
    expect(t.session.unresolved().map((o) => o.mapId)).toEqual([mapId]);
    // 그림이 그대로면 다시 보지 않는다.
    expect(await relookChangedPlaces(t.env, t.session)).toEqual([]);
    expect(t.criticCalls()).toBe(1);
    // 다시 짓지 않는 도구로 맵을 바꾼다(사람 하나) — 그림이 달라진다.
    const person = await t.call("add_people", { mapId, people: [{ role: "주민", name: "주민", where: "광장", firstTalk: ["안녕하세요."] }] });
    expect(person.ok, person.body.slice(0, 300)).toBe(true);
    const notes = await relookChangedPlaces(t.env, t.session);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/major 1 → 0/u);
    expect(t.criticCalls()).toBe(2);
    expect(t.session.unresolved()).toEqual([]);
    expect(v2GateProblems(t.session, t.env).problems.filter((p) => p.key.startsWith("place:"))).toEqual([]);
  }, SLOW);
});

describe("고치기 상한은 도구와 끝맺음 관문이 같은 수를 쓴다", () => {
  it("칸 배치 장소는 자기 검토 바퀴가 상한을 먹지 않는다", () => {
    const layout = { regions: [{ id: "hall", x: 1, y: 1, w: 8, h: 8 }], objects: [], entrance: { x: 4, y: 9 } };
    expect(repairCapOf({ type: "interior", name: "가게", layout } as unknown as PlaceSpec)).toBeGreaterThan(V2_MAX_REPAIR_ROUNDS + 2);
    expect(repairCapOf({ type: "village", name: "마을" } as PlaceSpec)).toBe(V2_MAX_REPAIR_ROUNDS);
    // 엄격 스키마가 채운 빈 배치는 칸 배치가 아니다.
    expect(repairCapOf({ type: "village", name: "마을", layout: { regions: [], objects: [], rooms: [] } } as unknown as PlaceSpec)).toBe(V2_MAX_REPAIR_ROUNDS);
  });
});

describe("끝맺음 관문이 고치는 법으로 이른 도구는 고치기 차례에 싣는다", () => {
  const hud = "[게임 검사 HUD] 필드 HUD(minimal)가 체력을 늘 보인다 — set_field_hud{theme:'minimal', vitals:false} 로 끈다.";

  it("이 요청의 묶음에 없는 도구: 싣고 항목은 열린 채로 건넨다(막지 않는다)", () => {
    const store = new TodoStore();
    const available = new Set(["inspect"]);
    const sync = syncGateItems(store, [{ key: "game:HUD", text: hud, source: "gate" }], new Set(), available, (name) => { if (name !== "set_field_hud") return undefined; available.add(name); return "loaded"; });
    expect(sync.loaded).toEqual(["set_field_hud"]);
    expect(sync.unfixable).toEqual([]);
    expect(sync.opened).toHaveLength(1);
    expect(store.items[0]!.status).not.toBe("blocked");
  });

  it("조수 v2 에 없는 도구: 막힘이 아니라 뺀 채 보고한다 — 완료를 막지 않는다", () => {
    const store = new TodoStore();
    const sync = syncGateItems(store, [{ key: "game:x", text: "[게임 검사 x] 무언가 어긋났다 — no_such_tool{fix:true} 로 고친다.", source: "gate" }], new Set(), new Set(["inspect"]), () => undefined);
    expect(sync.opened).toEqual([]);
    expect(sync.unfixable).toHaveLength(1);
    expect(store.items[0]!.status).toBe("dropped");
    expect(store.items[0]!.blockedReason).toContain("조수 v2 에 없다");
    expect(todoReport({ store, draft: "" }).complete).toBe(true);
  });

  it("이미 목록에 있는 도구는 다시 싣지 않고, 묶음에 있지만 아직 안 실은 도구는 올린다", () => {
    const text = "[게임 검사 이동] 새 맵으로 들어가는 문이 없다 — create_transfer_pair{a:{mapId:'m1'}} 로 잇는다.";
    const ready = syncGateItems(new TodoStore(), [{ key: "game:link", text, source: "gate" }], new Set(), new Set(["create_transfer_pair"]), () => "ready");
    expect(ready.loaded).toEqual([]);
    expect(ready.opened).toHaveLength(1);
    const lazy = syncGateItems(new TodoStore(), [{ key: "game:link", text, source: "gate" }], new Set(), new Set(["create_transfer_pair"]), () => "loaded");
    expect(lazy.loaded).toEqual(["create_transfer_pair"]);
    expect(lazy.unfixable).toEqual([]);
  });

  it("호출 모양이 아니라 이름만 이른 도구도 싣는다 — «create_transfer_pair 로 잇는다» (Haiku village-chief-house)", () => {
    const text = "[게임 검사 이동] 새 맵 「촌장 집」(map_chief_house) 로 들어가는 문·이동이 어느 맵에도 없다 — 플레이어가 갈 수 없다. create_transfer_pair 로 문(집 문·마을 가장자리)과 잇는다.";
    const asked: string[] = [];
    const sync = syncGateItems(new TodoStore(), [{ key: "game:link", text, source: "gate" }], new Set(), new Set(["inspect"]), (name) => { asked.push(name); return name === "create_transfer_pair" ? "loaded" : undefined; });
    expect(sync.loaded).toEqual(["create_transfer_pair"]);
    expect(sync.opened).toHaveLength(1);
    // 맵 id(map_…)는 도구 후보가 아니다.
    expect(asked).toEqual(["create_transfer_pair"]);
  });

  it("이름만 나온 낱말이 도구가 아니어도 항목을 빼지 않는다 — 빼는 것은 호출 모양으로 이른 도구가 없을 때뿐", () => {
    const store = new TodoStore();
    const sync = syncGateItems(store, [{ key: "game:x", text: "[게임 검사 x] 칩셋 atlas_biome_interior 의 문 그림이 없다.", source: "gate" }], new Set(), new Set(["inspect"]), () => undefined);
    expect(sync.unfixable).toEqual([]);
    expect(sync.opened).toHaveLength(1);
    expect(store.items[0]!.status).not.toBe("dropped");
  });

  it("실제 턴: 장소만 짓는 요청에서 이름으로 부른 create_transfer_pair 를 그 자리에서 지어 싣는다 — 읽기 요청·없는 이름은 싣지 않는다", () => {
    const t = turn("촌장 집 맵을 만들어 줘.");
    const exposure = { tools: [], lazy: new Map(), offered: [] };
    const toolNames = new Set<string>();
    const { lateTool } = turnLateTools({ session: t.session, state: { exposure }, toolNames, writeRequest: true } as never);
    expect(lateTool("create_transfer_pair")?.name).toBe("create_transfer_pair");
    expect(exposure.lazy.has("create_transfer_pair")).toBe(true);
    expect(toolNames.has("create_transfer_pair")).toBe(true);
    expect(lateTool("create_transfer_pair")).toBe(exposure.lazy.get("create_transfer_pair"));
    expect(lateTool("no_such_tool")).toBeUndefined();
    const readOnly = turnLateTools({ session: t.session, state: { exposure: { tools: [], lazy: new Map(), offered: [] } }, toolNames: new Set(), writeRequest: false } as never);
    expect(readOnly.lateTool("create_transfer_pair")).toBeUndefined();
  }, SLOW);

  it("턴 조립: 장소만 까는 요청의 목록에는 create_transfer_pair·load_tools 가 없고, 이름으로 부르면 실리며, 없는 이름의 거절 글은 load_tools 를 권하지 않는다", () => {
    const project = createBlankProject();
    const request = { task: "촌장 집 맵을 만들어 줘.", provider: "local-cli:claude", mapIds: [], project, currentMapId: project.startMapId } as never;
    const v2 = createV2Turn(request, {}, { captureVqaShots: async () => ({ shots: [], failed: [] }) });
    const env = { ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request, emit: () => {}, record: () => {}, checkpoint: async () => {}, sideChat: async () => "{}",
      preferToolNextTurn: () => {}, clearToolPreference: () => {}, lazyToolsVia: "call_tool" } as unknown as PiAssistantV2Env;
    const listed = v2.hooks.tools(env).map((t) => t.name);
    expect(listed).not.toContain("create_transfer_pair");
    expect(listed).not.toContain("load_tools");
    expect(v2.hooks.lazyTool!("create_transfer_pair")?.name).toBe("create_transfer_pair");
    expect(v2.hooks.lazyTool!("make_place")).toBeUndefined();
    const text = v2.hooks.unknownToolText!("no_such_tool");
    expect(text).toContain("no tool named");
    expect(text).not.toContain("load_tools");
  }, SLOW);

  it("실제 턴: 장소만 짓는 요청의 도구 묶음에 없는 set_field_hud 를 고리로 감싸 만들어 준다", async () => {
    const t = turn("왕궁 맵을 만들어 줘.");
    expect(t.session.repairTool).toBeTypeOf("function");
    const made = t.session.repairTool!("set_field_hud");
    expect(made?.name).toBe("set_field_hud");
    expect(t.session.repairTool!("no_such_tool")).toBeUndefined();
    const wrapped = t.session.loop.wrapLate!(made!);
    await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "HUD 끄기", id: "hud" }] }] });
    const r = await wrapped.execute("c-hud", { off: true });
    const body = (r.content as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
    expect(body).toMatch(/"ok":true/u);
    expect(t.ctx.project.system.fieldHud).toBeDefined();
  }, SLOW);
});
