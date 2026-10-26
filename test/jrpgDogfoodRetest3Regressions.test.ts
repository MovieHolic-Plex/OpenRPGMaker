// 2026-09-24 「등대지기의 겨울」 3차 재시험(origin/main 86b9a12d5)에서 남은 결함의 회귀.
// 동료 합류 선택지 분기의 changeParty 가 speciesId/level 로 저장돼 파티에 null → 보스전 「Missing actor」,
// 눈보라 항구 브리프인데 마을은 여름 강마을·보스 배경은 여름 숲.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { createBlankProject } from "@/project/defaults";
import { actorBattlers } from "@/battle/battleBattlers";
import { changeParty } from "@/project/session";
import { canonicalizeCommandFieldAliases } from "@/project/eventCommands/commandFieldAliases";
import type { Command, GameEvent, Project } from "@/project/types";

function blank(): { ctx: { project: Project }; mapId: string } {
  const project = createBlankProject();
  return { ctx: { project }, mapId: project.startMapId };
}

function eventOf(project: Project, mapId: string, id: string): GameEvent {
  const event = project.maps[mapId]!.events.find(entry => entry.id === id);
  if (!event) throw new Error(`missing event ${id}`);
  return event;
}

function warningsOf(result: unknown): string {
  return ((result as { diff?: { warnings?: string[] } }).diff?.warnings ?? []).join("\n");
}

/** 도그푸딩 저장본 그대로의 동료 이벤트(place_npc SimplePage, 선택지 branch 안에 speciesId). */
function companionArgs(mapId: string, speciesId: string): Record<string, unknown> {
  return {
    mapId, x: 3, y: 3, id: "ev_companion_kai", name: "카이",
    pages: [
      {
        name: "카이 · 영입 전",
        lines: ["나도 같이 갈게!"],
        choices: [
          { text: "함께 가자!", branch: [
            { kind: "text", speaker: "카이", body: "좋아!" },
            { kind: "changeParty", speciesId, level: 1, action: "add" },
            { kind: "setSelfSwitch", key: "A", value: true },
          ] },
          { text: "혼자서도 괜찮아", branch: [{ kind: "text", speaker: "카이", body: "마음이 바뀌면 말해줘!" }] },
        ],
      },
      { name: "카이 · 동행 중", conditions: [{ kind: "selfSwitch", key: "A", value: true }], lines: ["조심해서 가자, 린!"] },
    ],
  };
}

function partyCommands(event: GameEvent): Command[] {
  const found: Command[] = [];
  const visit = (commands: readonly Command[]) => {
    for (const command of commands) {
      if (command.kind === "changeParty") found.push(command);
      if (command.kind === "choices") for (const option of command.options) visit(option.branch);
    }
  };
  for (const page of event.pages ?? []) visit(page.commands);
  return found;
}

describe("defect 1 — companion changeParty written with speciesId", () => {
  it("place_npc moves a speciesId that names an actor onto actorId, drops level, and says so", () => {
    const { ctx, mapId } = blank();
    const actorId = ctx.project.database.actors[1]!.id;
    const result = runTool(ctx, "place_npc", companionArgs(mapId, actorId));
    expect(result.ok, result.summary).toBe(true);
    expect(partyCommands(eventOf(ctx.project, mapId, "ev_companion_kai"))).toEqual([{ kind: "changeParty", actorId, action: "add" }]);
    expect(warningsOf(result)).toContain("actorId");
  });

  it("place_npc rejects a party change that names no actor, inside a choice branch, with the actor list", () => {
    const { ctx, mapId } = blank();
    const result = runTool(ctx, "place_npc", companionArgs(mapId, "actor_ghost"));
    expect(result.ok).toBe(false);
    const message = JSON.stringify(result.issues);
    expect(message).toContain("actor_ghost");
    expect(message).toContain("branch0");
    expect(message).toContain(ctx.project.database.actors[0]!.id);
    expect(message).not.toContain("pages:[{lines");
    expect(ctx.project.maps[mapId]!.events.some(event => event.id === "ev_companion_kai")).toBe(false);
  });

  it("the Pi tool path (createPiToolset → place_npc) rejects it too", async () => {
    const { ctx, mapId } = blank();
    const [tool] = createPiToolset(ctx, { toolNames: ["place_npc"] });
    await expect(tool!.execute("call_1", companionArgs(mapId, "actor_ghost"), undefined as never)).rejects.toThrow(/actor_ghost/);
    expect(ctx.project.maps[mapId]!.events.some(event => event.id === "ev_companion_kai")).toBe(false);
  });

  it("upsert_event checks native choice branches and battle branches", () => {
    const { ctx, mapId } = blank();
    const inChoice = runTool(ctx, "upsert_event", {
      mapId,
      event: { id: "ev_join", x: 4, y: 4, trigger: { kind: "action" }, commands: [], pages: [{
        id: "p0", name: "p0", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "choices", options: [
          { text: "예", branch: [{ kind: "changeParty", speciesId: "actor_ghost", level: 1, action: "add" }] },
          { text: "아니", branch: [] },
        ] }],
      }] },
    });
    expect(inChoice.ok).toBe(false);
    expect(JSON.stringify(inChoice.issues)).toContain("actor_ghost");
  });

  it("the runtime never pushes a non-actor into the party", () => {
    const project = createBlankProject();
    const session = { partyActorIds: [project.database.actors[0]!.id], actorVitals: {} } as unknown as Parameters<typeof changeParty>[0];
    changeParty(session, undefined as unknown as string, "add", project);
    changeParty(session, "actor_ghost", "add", project);
    expect(session.partyActorIds).toEqual([project.database.actors[0]!.id]);
  });

  it("battle setup skips a null party slot instead of dead-ending with 「Missing actor」", () => {
    const project = createBlankProject();
    const hero = project.database.actors[0]!.id;
    const battlers = actorBattlers(project, { partyActorIds: [hero, null as unknown as string] });
    expect(battlers.map(battler => battler.recordId)).toEqual([hero]);
  });

  it("an already-saved speciesId is moved onto actorId on load (canonicalizer recurses into branches)", () => {
    const commands = [{ kind: "choices", options: [{ text: "예", branch: [{ kind: "changeParty", speciesId: "actor_2", level: 1, action: "add" }] }] }];
    canonicalizeCommandFieldAliases(commands);
    expect(commands[0]!.options[0]!.branch[0]).toEqual({ kind: "changeParty", actorId: "actor_2", action: "add" });
  });
});

// Removed describe "defect 2 — snowy harbor brief": author_village was removed from the tool registry on purpose.
