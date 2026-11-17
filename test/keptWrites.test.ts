import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

// 페이지를 통째로 다시 쓸 때 빠진 상태 쓰기를 지킨다 — 2026-11-16 pf4 명세 은행 r5a-river(한씨 첫 페이지를 다시 쓰자 경로 스위치가 빠져 곁 의뢰가 막혔다).
const page = (commands: unknown[], conditions: unknown[] = []) => ({ id: `p${Math.random().toString(36).slice(2, 7)}`, trigger: { kind: "action" }, priority: "same", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, conditions, commands });

function setup(readSwitch = true): { ctx: ToolContext; mapId: string } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const db = project.database as unknown as { switches?: { id: string; name: string }[] };
  db.switches = [...(db.switches ?? []), { id: "sw_path_taken", name: "길" }, { id: "sw_plain", name: "그냥" }];
  map.events.push({ id: "ev_han", name: "한씨", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "text", body: "부탁하네" }, { kind: "setSwitch", switchId: "sw_path_taken", value: true }, { kind: "setSwitch", switchId: "sw_plain", value: true }])] } as never);
  map.events.push({ id: "ev_fisher", name: "어부", x: 6, y: 6, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "text", body: "안녕" }]), ...(readSwitch ? [page([{ kind: "text", body: "그래 들었네" }], [{ kind: "switch", switchId: "sw_path_taken", value: true }])] : [])] } as never);
  return { ctx: { project }, mapId: map.id };
}
const hanCommands = (ctx: ToolContext, mapId: string) => JSON.stringify(ctx.project.maps[mapId]!.events.find((e) => e.id === "ev_han")!.pages![0]!.commands);

describe("페이지를 다시 쓸 때 다른 이벤트가 기다리는 상태 쓰기를 지킨다", () => {
  it("patch_event_page — 다른 어디서도 켜지 않는데 어부가 기다리는 스위치는 새 페이지 끝에 되붙이고 알린다", () => {
    const { ctx, mapId } = setup();
    const result = runTool(ctx, "patch_event_page", { mapId, eventId: "ev_han", pageIndex: 0, set: { commands: [{ kind: "text", body: "새 대사" }] } });
    expect(result.ok).toBe(true);
    expect(hanCommands(ctx, mapId)).toContain('"switchId":"sw_path_taken"');
    // 아무도 읽지 않는 스위치는 되붙이지 않는다.
    expect(hanCommands(ctx, mapId)).not.toContain('"switchId":"sw_plain"');
    expect(result.summary).toContain("Carried over 1 state write");
    expect(result.summary).toContain("sw_path_taken");
  });

  it("dropWrites:true 면 정말 지우고, 이제 쓰는 곳이 없는 것을 결과에 적는다", () => {
    const { ctx, mapId } = setup();
    const result = runTool(ctx, "patch_event_page", { mapId, eventId: "ev_han", pageIndex: 0, set: { commands: [{ kind: "text", body: "새 대사" }] }, dropWrites: true });
    expect(result.ok).toBe(true);
    expect(hanCommands(ctx, mapId)).not.toContain("sw_path_taken");
    expect(result.summary).toContain("Removed as asked");
    expect(result.summary).toContain("sw_path_taken");
  });

  it("어디서도 읽지 않는 쓰기는 되붙이지 않는다", () => {
    const { ctx, mapId } = setup(false);
    const result = runTool(ctx, "patch_event_page", { mapId, eventId: "ev_han", pageIndex: 0, set: { commands: [{ kind: "text", body: "새 대사" }] } });
    expect(result.ok).toBe(true);
    expect(hanCommands(ctx, mapId)).not.toContain("setSwitch");
    expect(result.summary).not.toContain("Carried over");
  });

  it("upsert_event replacePages 도 같은 길을 쓴다", () => {
    const { ctx, mapId } = setup();
    const result = runTool(ctx, "upsert_event", { mapId, replacePages: true, event: { id: "ev_han", pages: [page([{ kind: "text", body: "갈아엎음" }])] } });
    expect(result.ok).toBe(true);
    expect(hanCommands(ctx, mapId)).toContain('"switchId":"sw_path_taken"');
    expect((result.data as { carriedWrites?: string[] }).carriedWrites).toEqual(["sw:sw_path_taken"]);
  });
});

// 2026-11-16 #4751 실모델 확인 2번: 「열쇠를 주는 대신 옆 상자에서 얻게」 를 주는 사람부터 다시 쓰면 열쇠 주기가 되붙고, 뒤에 놓은 상자와 두 군데서 열쇠가 나왔다.
describe("되붙인 쓰기를 뒤의 호출이 다른 곳에 만들면 되붙인 사본을 걷는다", () => {
  function keySetup(): { ctx: ToolContext; mapId: string } {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    project.database.items.push({ id: "item_gate_key", name: "열쇠", kind: "key" } as never);
    map.events.push({ id: "ev_keeper", name: "문지기", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "text", body: "열쇠 받게" }, { kind: "changeItem", itemId: "item_gate_key", op: "+=", amount: 1 }])] } as never);
    map.events.push({ id: "ev_gate", name: "문", x: 6, y: 6, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "text", body: "잠겼다" }]), page([{ kind: "text", body: "열렸다" }], [{ kind: "item", itemId: "item_gate_key" }])] } as never);
    return { ctx: { project, assistantRun: true }, mapId: map.id };
  }
  const keeper = (ctx: ToolContext, mapId: string) => JSON.stringify(ctx.project.maps[mapId]!.events.find((e) => e.id === "ev_keeper")!.pages![0]!.commands);

  it("주는 사람을 먼저 다시 쓰고 상자를 놓으면 열쇠는 상자 하나에서만 나오고 결과가 알린다", () => {
    const { ctx, mapId } = keySetup();
    const first = runTool(ctx, "patch_event_page", { mapId, eventId: "ev_keeper", pageIndex: 0, set: { commands: [{ kind: "text", body: "옆 상자를 열어 보게" }] } });
    expect(first.summary).toContain("Carried over 1 state write");
    expect(keeper(ctx, mapId)).toContain("item_gate_key");
    const chest = runTool(ctx, "place_chest", { mapId, x: 3, y: 2, contents: { itemId: "item_gate_key" } });
    expect(chest.ok).toBe(true);
    expect(chest.summary).toContain("Withdrew the item item_gate_key write");
    expect(keeper(ctx, mapId)).not.toContain("item_gate_key");
    const givers = ctx.project.maps[mapId]!.events.filter((e) => JSON.stringify(e.pages).includes('"changeItem","itemId":"item_gate_key"') || JSON.stringify(e.pages).includes('"itemId":"item_gate_key","op":"+="'));
    expect(givers.map((e) => e.id).filter((id) => id !== "ev_gate")).toHaveLength(1);
  });

  it("모델이 되붙은 쓰기를 직접 다시 적었으면(받아들임) 걷지 않는다", () => {
    const { ctx, mapId } = keySetup();
    runTool(ctx, "patch_event_page", { mapId, eventId: "ev_keeper", pageIndex: 0, set: { commands: [{ kind: "text", body: "옆 상자" }] } });
    runTool(ctx, "patch_event_page", { mapId, eventId: "ev_keeper", pageIndex: 0, set: { commands: [{ kind: "text", body: "이것도 받게" }, { kind: "changeItem", itemId: "item_gate_key", op: "+=", amount: 1 }] } });
    const chest = runTool(ctx, "place_chest", { mapId, x: 3, y: 2, contents: { itemId: "item_gate_key" } });
    expect(chest.summary).not.toContain("Withdrew");
    expect(keeper(ctx, mapId)).toContain("item_gate_key");
  });
});
