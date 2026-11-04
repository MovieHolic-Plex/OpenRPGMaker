import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { OPENING_PICTURE_WALKERS_CODE, openingPictureWalkers } from "@/project/openingAuthoringReview";
import { projectLint } from "@/project/lint/projectLint";
import { openingStageEventId, openingStageFlag } from "@/project/openingStage";
import { runTool } from "@/editor/tools";
import type { AnimaticLayer } from "@/project/openingAnimatic";
import type { Project } from "@/project/types";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { activeRuntimeEvents } from "@/player/playSceneMapRuntime";

const walker = (moving: boolean): AnimaticLayer => ({
  id: "w1", kind: "image", role: "actor", resourceId: "oprn-charset-modern1", x: 10, y: 100, width: 24, height: 32,
  sheet: { frameWidth: 24, frameHeight: 32, columns: 12, count: 96, fps: 0 }, walk: { stride: 8, frames: [1, 2, 1, 0] },
  keys: { x: [{ atMs: 0, value: 10 }, { atMs: 3000, value: moving ? 200 : 10 }] },
} as AnimaticLayer);

function withAnimatic(layer: AnimaticLayer): Project {
  const project = createBlankProject();
  project.system.opening = { enabled: true, skippable: true, scenes: [{ id: "shot1", kind: "animatic", narration: "", durationMs: 3000, composition: { width: 480, height: 270, layers: [layer] } }] };
  return project;
}

describe("opening-picture-walkers lint", () => {
  it("flags a charset walker moved across the shot as a picture layer", () => {
    const project = withAnimatic(walker(true));
    expect(openingPictureWalkers(project)).toEqual([{ sceneId: "shot1", layerIds: ["w1"] }]);
    expect(projectLint(project).some((issue) => issue.code === OPENING_PICTURE_WALKERS_CODE)).toBe(true);
  });

  it("does not flag a standing charset or a non-sheet picture slide (bust close-up)", () => {
    expect(openingPictureWalkers(withAnimatic(walker(false)))).toEqual([]);
    const bust = { id: "bust", kind: "image", role: "actor", resourceId: "bust", x: 0, y: 0, width: 200, height: 200, keys: { x: [{ atMs: 0, value: -60 }, { atMs: 500, value: 20 }] } } as AnimaticLayer;
    expect(openingPictureWalkers(withAnimatic(bust))).toEqual([]);
  });
});

describe("author_opening_stage", () => {
  it("sets system.opening.stage and compiles a skippable autorun that clears the stage flag before moving to the start", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const ctx = { project };
    const result = runTool(ctx, "author_opening_stage", { mapId, x: 2, y: 2, beats: [{ kind: "wait", ms: 300 }] });
    expect(result.ok).toBe(true);
    const next = ctx.project;
    expect(next.system.opening?.stage).toEqual({ mapId, x: 2, y: 2, eventId: "ev_opening_stage" });
    const page = next.maps[mapId]!.events.find((event) => event.id === "ev_opening_stage")!.pages![0]!;
    expect(page.trigger).toEqual({ kind: "auto" });
    const kinds = page.commands.map((command) => command.kind);
    const clear = kinds.indexOf("setFlag"), transfer = kinds.lastIndexOf("transfer"), landing = page.commands.findIndex((command) => command.kind === "label");
    expect(landing).toBeGreaterThan(-1);
    expect(clear).toBeGreaterThan(landing);
    expect(transfer).toBeGreaterThan(clear);
    expect(page.commands[clear]).toEqual({ kind: "setFlag", flag: openingStageFlag(mapId, "ev_opening_stage"), value: false });
    // 건너뛰기 착지 뒤에 주인공 모습을 되돌린다(숨긴 채 본편이 시작되지 않게).
    const resets = page.commands.flatMap((command, index) => command.kind === "m2Command" && (command as { fields?: Record<string, unknown> }).fields?.reset ? [index] : []);
    expect(resets).toEqual([clear + 1]);
    expect(transfer).toBe(clear + 2);
  });

  it("editing the picture scenes afterwards keeps the stage (edit_opening rebuilds the sequence)", () => {
    const project = createBlankProject();
    const ctx = { project };
    const mapId = project.startMapId;
    expect(runTool(ctx, "author_opening_stage", { mapId, x: 2, y: 2, beats: [{ kind: "wait", ms: 300 }] }).ok).toBe(true);
    const first = ctx.project.system.opening!.scenes[0];
    if (first) expect(runTool(ctx, "edit_opening", { op: "remove", sceneId: first.id }).ok).toBe(true);
    expect(runTool(ctx, "edit_opening", { op: "append", scene: { kind: "text", narration: "제1장", durationMs: 3000 } }).ok).toBe(true);
    expect(ctx.project.system.opening?.stage).toEqual({ mapId, x: 2, y: 2, eventId: "ev_opening_stage" });
  });

  it("stage flag names the running stage event for that map only", () => {
    const flags = { [openingStageFlag("m1", "ev_a")]: true, [openingStageFlag("m2", "ev_b")]: false };
    expect(openingStageEventId(flags, "m1")).toBe("ev_a");
    expect(openingStageEventId(flags, "m2")).toBeUndefined();
  });
});

describe("opening stage runtime gate", () => {
  function stageWorld(stageSelfSwitchOn: boolean) {
    const project = createBlankProject();
    const ctx = { project };
    const mapId = project.startMapId;
    expect(runTool(ctx, "author_opening_stage", { mapId, x: 2, y: 2, beats: [{ kind: "wait", ms: 300 }] }).ok).toBe(true);
    const map = ctx.project.maps[mapId]!;
    map.events.push({ id: "story_intro", x: 1, y: 1, pages: [{ id: "intro", trigger: { kind: "auto" }, conditions: [], graphic: { transparent: true }, commands: [] }] } as never);
    map.events.push({ id: "fountain", x: 3, y: 3, pages: [{ id: "loop", trigger: { kind: "parallel" }, conditions: [], graphic: { transparent: true }, commands: [] }] } as never);
    store.replace(ctx.project);
    const live = store.getCurrent(), liveMap = live.maps[mapId]!;
    const session = startSession(live);
    session.flags[openingStageFlag(mapId, "ev_opening_stage")] = true;
    if (stageSelfSwitchOn) session.selfSwitches = { ...session.selfSwitches, ev_opening_stage: { A: true } };
    const scene = { map: liveMap, session, eventPositions: initialRuntimeEventPositions(liveMap.events), getMapId: () => mapId, running: false };
    return { scene, session, mapId };
  }
  const ids = (views: { event: { id: string } }[]) => views.map((view) => view.event.id);

  it("while the stage cutscene is live only it auto-runs, and parallel events on that map wait", () => {
    const { scene } = stageWorld(false);
    expect(ids(activeRuntimeEvents(scene as never, "auto"))).toEqual(["ev_opening_stage"]);
    expect(ids(activeRuntimeEvents(scene as never, "parallel"))).toEqual([]);
  });

  it("a stale flag (stage page already off, e.g. a save taken mid-stage) is dropped instead of freezing the map", () => {
    const { scene, session, mapId } = stageWorld(true);
    expect(ids(activeRuntimeEvents(scene as never, "auto"))).toEqual(["story_intro"]);
    expect(session.flags[openingStageFlag(mapId, "ev_opening_stage")]).toBeUndefined();
    expect(ids(activeRuntimeEvents(scene as never, "parallel"))).toEqual(["fountain"]);
  });
});
