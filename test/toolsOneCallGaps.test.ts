import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { freshSession, interact } from "@/harnesses/assistant-capability/node/smallJobs/checkSupport";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import type { Command, GameEvent, Project } from "@/project/types";

// 한 호출로 끝나야 할 작은 일들 (2026-11-11 작은 일 둘째 묶음에서 본 빈틈): 그림 없는 전투 블로커 · 맨 위에 준 맵 깃발 · 상자 수량 ·
// 회복만 하는 자리 · 조건 페이지 NPC 의 움직임 · 빈 칸 채움에 지워지지 않는 시작 상태.

const VILLAGE = "map_ember_village";
const FIELD = "map_blank_start";
const MARKET = "map_5eec6ba0-1ac1-48ab-9d7f-db5032670b4c";
const CLIFF = "map_638339b3-341f-4d31-93bd-ccc90a33304a";

function start(fixture: "starter" | "built"): { project: Project } {
  return { project: buildFixture(fixture) };
}
function call(ctx: { project: Project }, tool: string, args: Record<string, unknown>) {
  const result = runTool(ctx, tool, args);
  expect(result.ok, result.summary).toBe(true);
  return result;
}
function eventOf(project: Project, id: string): GameEvent {
  const event = Object.values(project.maps).flatMap((map) => map.events).find((entry) => entry.id === id);
  if (!event) throw new Error(`missing event ${id}`);
  return event;
}
const made = (result: { data?: unknown }): string => (result.data as { eventId: string }).eventId;
const examine = (project: Project, id: string): Command[] => interact(eventOf(project, id) as never, freshSession(), project as never).ran;

describe("place_battle_blocker — graphic 이 없어도 세운다", () => {
  it("이름에 맞는 걷기 칩이 없으면 두건 괴물 칩으로 세우고 어느 칩인지 알린다 — 빈 칸만 채운 graphic 도 안 준 것이다", () => {
    for (const graphic of [undefined, { query: "", textureKey: "", characterIndex: 0, transparent: false }]) {
      const ctx = start("starter");
      const result = call(ctx, "place_battle_blocker", { mapId: FIELD, x: 10, y: 7, troopId: "troop_golem_guard", intro: ["여기는 지나갈 수 없다."], ...(graphic ? { graphic } : {}) });
      const shown = eventOf(ctx.project, made(result)).pages!.find((entry) => entry.graphic.sprite?.id === "tex_easyrpg_charset_monster3");
      expect(shown, "전투 페이지가 두건 괴물 칩으로 보인다").toBeTruthy();
      expect(shown!.graphic.transparent).not.toBe(true);
      expect(JSON.stringify(result)).toContain("generic hooded-monster chip (tex_easyrpg_charset_monster3 #2");
      expect(examine(ctx.project, made(result)).map((command) => command.kind)).toEqual(expect.arrayContaining(["text", "battleProcessing"]));
    }
  });

  it("준 graphic 은 그대로 쓴다", () => {
    const ctx = start("starter");
    const result = call(ctx, "place_battle_blocker", { mapId: FIELD, x: 10, y: 7, troopId: "troop_golem_guard", graphic: { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 4 } });
    expect(eventOf(ctx.project, made(result)).pages!.some((entry) => entry.graphic.sprite?.id === "tex_easyrpg_charset_monster2")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("generic hooded-monster");
  });
});

describe("set_map_properties — 맨 위에 준 제한 깃발", () => {
  it("disableSave:true 를 받고, 그 깃발 하나만 바꾼다", () => {
    const ctx = start("built");
    call(ctx, "set_map_properties", { mapId: CLIFF, disableEscape: true });
    call(ctx, "set_map_properties", { mapId: CLIFF, disableSave: true });
    expect(ctx.project.maps[CLIFF]).toMatchObject({ disableSave: true, disableEscape: true });
    call(ctx, "set_map_properties", { mapId: CLIFF, disableSave: false });
    expect(ctx.project.maps[CLIFF]!.disableSave).toBeUndefined();
    expect(ctx.project.maps[CLIFF]!.disableEscape).toBe(true);
  });

  it("모르는 키만 오면 그 키와 맞는 모양을 알려 준다", () => {
    const refused = runTool(start("built"), "set_map_properties", { mapId: CLIFF, noSave: true });
    expect(refused.ok).toBe(false);
    expect(refused.summary).toContain("noSave");
    expect(refused.summary).toContain("flags:{disableSave:true");
  });
});

describe("place_chest — 수량", () => {
  it("contents.count 만큼 주고, 0·빈 칸은 1개다", () => {
    const ctx = start("starter");
    const three = call(ctx, "place_chest", { mapId: VILLAGE, x: 10, y: 12, contents: { itemId: "item_potion", count: 3 } });
    expect(examine(ctx.project, made(three))).toContainEqual({ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 3 });
    expect(interact(eventOf(ctx.project, made(three)) as never, freshSession(), ctx.project as never).texts.join(" ")).toContain("회복약 3개");
    const one = call(ctx, "place_chest", { mapId: VILLAGE, x: 12, y: 12, contents: { itemId: "item_potion", count: 0, gold: 0 } });
    expect(examine(ctx.project, made(one))).toContainEqual({ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 });
  });
});

describe("place_savepoint — 회복만 하는 자리", () => {
  it("mode:'heal' 은 회복하고 저장·체크포인트는 하지 않는다", () => {
    const ctx = start("built");
    const result = call(ctx, "place_savepoint", { mapId: MARKET, x: 20, y: 23, mode: "heal", name: "회복의 샘" });
    expect(examine(ctx.project, made(result)).map((command) => command.kind)).toEqual(["recoverAll", "text"]);
    expect(eventOf(ctx.project, made(result)).name).toBe("회복의 샘");
    expect(result.summary).toContain("does not save");
  });

  it("기본·heal:true 는 전과 같다", () => {
    const ctx = start("built");
    const plain = call(ctx, "place_savepoint", { mapId: MARKET, x: 20, y: 23 });
    expect(examine(ctx.project, made(plain)).map((command) => command.kind)).toEqual(["checkpointSave", "text", "openSaveMenu"]);
    const healing = call(ctx, "place_savepoint", { mapId: MARKET, x: 24, y: 23, heal: true });
    expect(examine(ctx.project, made(healing)).map((command) => command.kind)).toEqual(["recoverAll", "checkpointSave", "text", "openSaveMenu"]);
  });
});

describe("configure_npc_patrol — 서성이기·제자리는 어느 NPC 에나", () => {
  const types = (project: Project, id: string): string[] => eventOf(project, id).pages!.map((page) => page.movement.type);

  it("조건 페이지가 있는 NPC 도 type 으로 모든 페이지의 움직임만 바꾼다(대사·조건·자리 그대로)", () => {
    const ctx = start("starter");
    const before = structuredClone(eventOf(ctx.project, "ev_ember_guard"));
    call(ctx, "configure_npc_patrol", { mapId: VILLAGE, eventId: "ev_ember_guard", type: "random" });
    const guard = eventOf(ctx.project, "ev_ember_guard");
    expect(types(ctx.project, "ev_ember_guard")).toEqual(["random", "random", "random"]);
    expect(guard.pages!.map((page) => [page.commands, page.conditions])).toEqual(before.pages!.map((page) => [page.commands, page.conditions]));
    expect([guard.x, guard.y]).toEqual([before.x, before.y]);
    call(ctx, "configure_npc_patrol", { mapId: VILLAGE, eventId: "ev_ember_child", type: "fixed", directions: [] });
    expect(types(ctx.project, "ev_ember_child")).toEqual(["fixed", "fixed"]);
  });

  it("순찰 경로는 여전히 조건 페이지 NPC 를 거절하고, 서성이기·제자리로 가는 길을 알려 준다", () => {
    const ctx = start("starter");
    const refused = runTool(ctx, "configure_npc_patrol", { mapId: VILLAGE, eventId: "ev_ember_guard", directions: ["up", "down"] });
    expect(refused.ok).toBe(false);
    expect(refused.issues?.[0]?.code).toBe("protected-npc");
    expect(refused.summary).toContain("type:'random'");
    expect(types(ctx.project, "ev_ember_guard")).toEqual(["fixed", "fixed", "fixed"]);
  });
});

describe("set_session_start — 빈 칸 채움이 시작 상태를 지우지 않는다", () => {
  it("gold:0 · partyActorIds:[] 가 딸려 와도 소지금·파티는 그대로, 가방만 바뀐다", () => {
    const ctx = start("built");
    const result = call(ctx, "set_session_start", { gold: 0, inventory: { item_hi_potion: 3, item_potion: 3 }, partyActorIds: [] });
    expect(ctx.project.session).toMatchObject({ gold: 100, inventory: { item_hi_potion: 3, item_potion: 3 }, partyActorIds: ["actor_hero"] });
    expect(JSON.stringify(result)).toContain("Ignored as unfilled defaults: gold:0, partyActorIds:[]");
  });

  it("빈 값도 그 칸 하나만 보내면 뜻이 있다(소지금 0 · 빈 가방) — 빈 파티는 언제나 무시한다", () => {
    const ctx = start("built");
    call(ctx, "set_session_start", { gold: 0 });
    expect(ctx.project.session.gold).toBe(0);
    call(ctx, "set_session_start", { inventory: {} });
    expect(ctx.project.session.inventory).toEqual({});
    call(ctx, "set_session_start", { partyActorIds: [] });
    expect(ctx.project.session.partyActorIds).toEqual(["actor_hero"]);
  });
});
