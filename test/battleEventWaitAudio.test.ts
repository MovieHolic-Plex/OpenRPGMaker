// 배틀 이벤트 wait/playAudio/stopAudio 명령과 pendingWaitMs 일시정지를 검증한다.
import { describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import type { Command, Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleProject(): Project {
  return deserialize(JSON.stringify(battleFixture));
}

function pageWith(commands: readonly Command[]) {
  return {
    id: "page_event_flow",
    name: "이벤트 흐름",
    conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" } as const],
    span: "battle" as const,
    commands: [...commands],
  };
}

function installPage(project: Project, commands: readonly Command[]): void {
  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  if (!troop) throw new Error("missing troop_slime");
  troop.battleEventPages.splice(0, troop.battleEventPages.length, pageWith(commands));
}

describe("battle event wait/playAudio/stopAudio wiring", () => {
  it("preserves an explicit audio channel and options through the battle runtime", () => {
    const project = battleProject();
    const command: Command = { kind: "playAudio", resourceId: "bgm_boss", loop: true, channel: "bgs", volume: 0.25, fadeInMs: 0 };
    installPage(project, [command, { kind: "stopAudio", channel: "bgm" }]);
    const playAudio = vi.fn();
    const stopAudio = vi.fn();
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, playAudio, stopAudio });
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "defend" });
    expect(playAudio).toHaveBeenCalledWith("bgm_boss", true, command);
    expect(stopAudio).toHaveBeenCalledWith("bgm");
  });

  it("invokes playAudio/stopAudio callbacks from battle event commands", () => {
    const project = battleProject();
    installPage(project, [
      { kind: "playAudio", resourceId: "bgm_boss", loop: true },
      { kind: "wait", ms: 500 },
      { kind: "stopAudio" },
    ]);
    const played: Array<{ resourceId: string; loop: boolean }> = [];
    let stopCalls = 0;
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      playAudio: (resourceId, loop) => {
        played.push({ resourceId, loop });
      },
      stopAudio: () => {
        stopCalls += 1;
      },
    });
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "defend" });

    expect(played).toEqual([{ resourceId: "bgm_boss", loop: true }]);
    expect(stopCalls).toBe(1);
    const snapshot = runtime.snapshot();
    expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "playAudio bgm_boss")).toBe(true);
    expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "wait 500ms")).toBe(true);
    expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "stopAudio")).toBe(true);
  });

  it("visual wait no longer blocks ATB: gauge keeps charging through wait", () => {
    const project = battleProject();
    installPage(project, [{ kind: "wait", ms: 1_000 }]);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });
    runtime.tick(1_000);
    expect(runtime.snapshot().phase).toBe("actorCommand");
    runtime.performActorCommand({ kind: "defend" });
    const gaugeAfterDefend = runtime.snapshot().enemies[0]?.gauge ?? 0;
    runtime.tick(500);
    expect(runtime.snapshot().enemies[0]?.gauge ?? 0).toBeGreaterThan(gaugeAfterDefend);
    runtime.tick(600);
    expect(runtime.snapshot().enemies[0]?.gauge ?? 0).toBeGreaterThan(gaugeAfterDefend);
  });

  it("leaves playAudio/stopAudio as no-op callbacks when host does not supply them", () => {
    const project = battleProject();
    installPage(project, [
      { kind: "playAudio", resourceId: "bgm_boss", loop: false },
      { kind: "stopAudio" },
    ]);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });
    runtime.tick(1_000);
    expect(() => runtime.performActorCommand({ kind: "defend" })).not.toThrow();
    const snapshot = runtime.snapshot();
    expect(snapshot.eventLogs.some((log) => log.detail === "playAudio bgm_boss")).toBe(true);
    expect(snapshot.eventLogs.some((log) => log.detail === "stopAudio")).toBe(true);
  });
});
