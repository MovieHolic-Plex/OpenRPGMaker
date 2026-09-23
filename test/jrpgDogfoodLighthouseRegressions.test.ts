// 2026-09-23 도그푸딩 「등대지기의 겨울」(모험 JRPG, Pi 조수)에서 나온 생성·저작 도구 결함 회귀.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { loadHeadlessProject } from "@/headless";
import { changeParty } from "@/project/session";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { TilesetReferenceEvidence } from "@/ai/tilesetReferenceEvidence";
import { compileCutscene } from "@/editor/cutscene";
import { resolveBattleBackdrop } from "@/battle/battleBackdrop";
import { briefOpeningSequence, defaultOpeningSequence, isUntouchedDefaultOpening } from "@/project/defaults/defaultOpeningSequence";
import type { Command, GameEvent, Project } from "@/project/types";

/** runTool 은 성공하면 ctx.project 를 새 초안으로 갈아 끼운다 — 결과는 항상 ctx.project 에서 읽는다. */
function blank(): { ctx: { project: Project }; mapId: string } {
  const project = createBlankProject();
  return { ctx: { project }, mapId: project.startMapId };
}

function talkEvent(id: string, x: number, y: number, commands: unknown[]): Record<string, unknown> {
  return {
    id, x, y, trigger: { kind: "action" }, commands: [],
    pages: [{
      id: `${id}_p0`, name: id, conditions: [], trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, pattern: 0 },
      commands,
    }],
  };
}

function eventOf(project: Project, mapId: string, id: string): GameEvent {
  const event = project.maps[mapId]!.events.find(entry => entry.id === id);
  if (!event) throw new Error(`missing event ${id}`);
  return event;
}

describe("defect 1 — changeParty op/action drift", () => {
  it("upsert_event canonicalizes {op:'+='} to action:'add' and warns", () => {
    const { ctx, mapId } = blank();
    const result = runTool(ctx, "upsert_event", {
      mapId, event: talkEvent("ev_kyle", 3, 3, [{ kind: "text", body: "같이 가자!" }, { kind: "changeParty", actorId: "actor_guardian", op: "+=" }]),
    });
    expect(result.ok, result.summary).toBe(true);
    const command = eventOf(ctx.project, mapId, "ev_kyle").pages![0]!.commands[1] as Record<string, unknown>;
    expect(command).toEqual({ kind: "changeParty", actorId: "actor_guardian", action: "add" });
    expect((result as { diff?: { warnings?: string[] } }).diff?.warnings?.join(" ")).toContain('action:"add"');
  });

  it("rejects a changeParty whose direction cannot be read, naming the field", () => {
    const { ctx, mapId } = blank();
    const result = runTool(ctx, "upsert_event", {
      mapId, event: talkEvent("ev_kyle", 3, 3, [{ kind: "changeParty", actorId: "actor_guardian" }]),
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("changeParty");
    expect(result.summary).toContain("action");
  });

  it("maps action aliases on amount commands to op instead of blindly filling +=", () => {
    const { ctx, mapId } = blank();
    const itemId = ctx.project.database.items[0]!.id;
    const result = runTool(ctx, "upsert_event", {
      mapId, event: talkEvent("ev_pay", 3, 3, [{ kind: "changeItem", itemId, action: "remove", amount: 1 }]),
    });
    expect(result.ok, result.summary).toBe(true);
    expect(eventOf(ctx.project, mapId, "ev_pay").pages![0]!.commands[0]).toMatchObject({ kind: "changeItem", op: "-=" });
  });

  it("loading a saved project repairs legacy op:'+=' and the runtime never treats unknown actions as remove", () => {
    const { ctx, mapId } = blank();
    ctx.project.maps[mapId]!.events.push(talkEvent("ev_kyle", 3, 3, [{ kind: "changeParty", actorId: "actor_guardian", op: "+=" }]) as unknown as GameEvent);
    const loaded = loadHeadlessProject(JSON.stringify(ctx.project));
    expect(eventOf(loaded, mapId, "ev_kyle").pages![0]!.commands[0]).toEqual({ kind: "changeParty", actorId: "actor_guardian", action: "add" });

    const session = { partyActorIds: ["actor_hero"] } as Parameters<typeof changeParty>[0];
    changeParty(session, "actor_hero", undefined as never);
    expect(session.partyActorIds).toEqual(["actor_hero"]);
  });
});

describe("defect 2 — scene test can see party membership", () => {
  function sceneFor(project: Project, mapId: string, expect: Record<string, unknown>) {
    return runSceneTest(project, {
      mapId, start: { x: 3, y: 4 },
      steps: [{ kind: "face", dir: "up" }, { kind: "interact", eventId: "ev_kyle" }, { kind: "wait", ticks: 30 }, { kind: "expect", ...expect } as never],
    });
  }

  it("addFollower alone does not satisfy partyIncludes; changeParty add does, and finalState reports the party", () => {
    const followerOnly = blank();
    expect(runTool(followerOnly.ctx, "upsert_event", {
      mapId: followerOnly.mapId, event: talkEvent("ev_kyle", 3, 3, [{ kind: "addFollower", actorId: "actor_guardian", name: "카일" }]),
    }).ok).toBe(true);
    const fake = sceneFor(followerOnly.ctx.project, followerOnly.mapId, { partyIncludes: "actor_guardian" });
    expect(fake.ok).toBe(false);
    expect(fake.failureReason).toContain("addFollower");
    expect(fake.finalState.partyActorIds).toEqual(["actor_hero"]);

    const joined = blank();
    expect(runTool(joined.ctx, "upsert_event", {
      mapId: joined.mapId, event: talkEvent("ev_kyle", 3, 3, [{ kind: "changeParty", actorId: "actor_guardian", action: "add" }]),
    }).ok).toBe(true);
    const real = sceneFor(joined.ctx.project, joined.mapId, { partyIncludes: "actor_guardian" });
    expect(real.ok, real.failureReason).toBe(true);
    expect(real.finalState.partyActorIds).toContain("actor_guardian");
  });

  it("add_companion on an existing event warns that a follower is not a party member", () => {
    const { ctx, mapId } = blank();
    runTool(ctx, "upsert_event", { mapId, event: talkEvent("ev_kyle", 3, 3, [{ kind: "text", body: "같이 가자!" }]) });
    const result = runTool(ctx, "add_companion", { who: { actorId: "actor_guardian" }, target: { eventId: "ev_kyle" } });
    expect(result.ok, result.summary).toBe(true);
    expect(JSON.stringify(result)).toContain("partyIncludes");
  });
});

describe("defect 4 — dungeons are not renamed house interiors", () => {
  it("a new-dungeon pipeline asks only for the dungeon chipset references, not every tileset", () => {
    const { ctx } = blank();
    const blocked = new TilesetReferenceEvidence().beforeWrite(ctx.project, "run_dungeon_room_pipeline", { mapId: "map_frozen_cave", theme: "ice" });
    expect(blocked?.ok).toBe(false);
    expect(blocked!.summary).toContain("easyrpg_chipset_dungeon");
    expect(blocked!.summary).not.toContain("forest_harmony");
    expect(blocked!.summary).not.toContain("shared_forest_village_objects");
  });

  it("set_map_properties refuses to give a map the name another map already has", () => {
    const { ctx } = blank();
    expect(runTool(ctx, "create_map", { id: "map_frozen_cave", name: "얼어붙은 해안 동굴", width: 30, height: 20 }).ok).toBe(true);
    expect(runTool(ctx, "create_map", { id: "map_house_9", name: "은선의 집 내부", width: 13, height: 18 }).ok).toBe(true);
    const renamed = runTool(ctx, "set_map_properties", { mapId: "map_house_9", name: "얼어붙은 해안 동굴" });
    expect(renamed.ok).toBe(false);
    expect(renamed.summary).toContain("map_frozen_cave");
    expect(ctx.project.maps.map_house_9!.name).toBe("은선의 집 내부");
    expect(runTool(ctx, "set_map_properties", { mapId: "map_frozen_cave", name: "얼어붙은 해안 동굴" }).ok).toBe(true);
  });
});

describe("defect 5 — ending faces follow the speaker", () => {
  it("resetFace clears the caller's face and a different faceless speaker clears the previous face", () => {
    const commands = compileCutscene([
      { kind: "say", speaker: "루미아", text: "할아버지!" },
      { kind: "say", speaker: "에릭 할아버지", face: { resourceId: "easyrpg-faceset-people1-06" }, text: "오오." },
      { kind: "say", speaker: "에릭 할아버지", text: "잘 했다." },
      { kind: "say", speaker: "내레이션", text: "불이 켜졌다." },
      { kind: "say", speaker: "에릭 할아버지", text: "고맙구나." },
    ], { resetFace: true });
    const faces = commands.flatMap(command => command.kind === "changeFace" ? [command.resourceId] : command.kind === "text" ? [`>${command.speaker}`] : []);
    expect(faces).toEqual([
      "", ">루미아",
      "easyrpg-faceset-people1-06", ">에릭 할아버지", ">에릭 할아버지",
      "", ">내레이션",
      "easyrpg-faceset-people1-06", ">에릭 할아버지",
    ]);
  });

  it("without resetFace an inherited face is left alone (page-appearance NPC cutscenes)", () => {
    const commands: Command[] = compileCutscene([{ kind: "say", speaker: "리나", text: "기억나." }]);
    expect(commands.some(command => command.kind === "changeFace")).toBe(false);
  });
});

describe("defect 6 — interactive events replace auto furniture inspects", () => {
  it("place_chest on an ev_inspect_ tile removes the inspect event", () => {
    const { ctx, mapId } = blank();
    ctx.project.maps[mapId]!.events.push(talkEvent("ev_inspect_map_x_5", 3, 3, [{ kind: "text", body: "술통을 두드려 본다." }]) as unknown as GameEvent);
    const result = runTool(ctx, "place_chest", { mapId, x: 3, y: 3, contents: { gold: 10 } });
    expect(result.ok, result.summary).toBe(true);
    const at = ctx.project.maps[mapId]!.events.filter(event => event.x === 3 && event.y === 3).map(event => event.id);
    expect(at).toEqual([(result.data as { eventId: string }).eventId]);
    expect(JSON.stringify(result)).toContain("ev_inspect_map_x_5");
  });
});

describe("defect 7 — a boss that can never hurt the start party is reported", () => {
  it("upsert_troop warns with party and enemy numbers", () => {
    const { ctx } = blank();
    const enemy = runTool(ctx, "upsert_enemy", { enemy: {
      id: "enemy_blizzard_spirit", name: "눈보라 정령", monsterResourceId: "generated-enemy-sylph-air", stats: { maxHp: 280, maxMp: 50, attack: 22, defense: 12, mind: 12, agility: 8 },
      rewards: { exp: 100, gold: 150 },
    } });
    expect(enemy.ok, enemy.summary).toBe(true);
    const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_blizzard_spirit_boss", name: "눈보라 정령", enemyIds: ["enemy_blizzard_spirit"] } });
    expect(result.ok, result.summary).toBe(true);
    const text = JSON.stringify(result);
    expect(text).toContain("밸런스");
    expect(text).toContain("tune_enemy");
  });
});

describe("defect 8 — backdrop and opening do not contradict the plan", () => {
  it("a battle in an interior under a snowy map uses the snow backdrop", () => {
    const { ctx, mapId } = blank();
    expect(runTool(ctx, "create_map", { id: "map_lighthouse_top", name: "등대 꼭대기", width: 20, height: 16 }).ok).toBe(true);
    const project = ctx.project;
    project.maps[mapId]!.climate = { mode: "fixed", weather: "snow", intensity: 0.8 };
    project.mapTree = { mapId, children: [{ mapId: "map_lighthouse_top", children: [] }] } as Project["mapTree"];
    project.database.troops.push({ id: "troop_boss", name: "보스", enemyIds: [project.database.enemies[0]!.id], battleEventPages: [] } as never);
    expect(resolveBattleBackdrop({ project, troopId: "troop_boss", location: { mapId: "map_lighthouse_top", x: 3, y: 3 } })).toBe("scarloxy-backdrop-ice");
  });

  it("the stock opening is recognised and replaced by the brief's own motive text", () => {
    const stock = defaultOpeningSequence("등대지기의 겨울");
    expect(isUntouchedDefaultOpening(stock, "등대지기의 겨울")).toBe(true);
    const motive = "눈보라가 그치지 않는 항구 마을에서, 등대지기 할아버지가 사라졌다.";
    const opened = briefOpeningSequence(stock, motive, "등대지기의 겨울");
    expect(opened.scenes.map(scene => scene.narration)).toEqual([motive, "— 등대지기의 겨울 —"]);
    expect(opened.scenes.every(scene => scene.kind === "text")).toBe(true);
    expect(isUntouchedDefaultOpening(opened, "등대지기의 겨울")).toBe(false);
  });
});
