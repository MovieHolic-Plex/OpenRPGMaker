// Step 0 회귀 스펙(2026-08-20): 배틀 이벤트 executor 는 Command 전 kind 를 무음 스킵하지 않는다.
// 불변식 — 각 kind 는 (a) troop-full 로 선언된 실제 처리 kind 이거나,
//          (b) 페이지 실행 시 unsupported/message 등 추적 로그를 반드시 남긴다.
// (기존 battleEvents.ts:416 fall-through 는 스위치에 없는 16종을 로그 없이 삼켰다.)
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { newCommand } from "@/editor/eventCommandFactory";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import { battleEventCommandRuntimeSupport } from "@/project/eventCommands/runtimeSupport";
import { deserialize } from "@/project/io";
import type { BattleEventLogSnapshot } from "@/battle/types";
import type { Command } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

const PAGE_ID = "page_exhaustive";

// battleEvents.ts:416 fall-through(return false)로 무음 스킵되던 16종 — Step 0 에서 명시적
// logUnsupported case 로 편입했다. 이 목록은 회귀 방지용 고정 스냅샷이다.
const PREVIOUSLY_SILENT_KINDS = [
  "promoteActor",
  "giveMonster",
  "evolveMonster",
  "openChest",
  "advanceTime",
  "setTime",
  "sleepUntilMorning",
  "craftRecipe",
  "applyItemUpgrade",
  "equipTool",
  "changeLifeSkillExp",
  "moveMonster",
  "openSaveMenu",
  "spawnFieldEnemy",
  "despawnFieldEnemy",
  "advanceCropGrowth",
] as const satisfies readonly Command["kind"][];

function runBattlePageWith(command: Command): readonly BattleEventLogSnapshot[] {
  const project = deserialize(JSON.stringify(battleFixture));
  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  if (!troop) throw new Error("missing troop_slime");
  troop.battleEventPages.splice(0, troop.battleEventPages.length, {
    id: PAGE_ID,
    name: "전수 검증",
    conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
    span: "battle",
    commands: [command],
  });
  const runtime = createBattleRuntime({
    project,
    troopId: "troop_slime",
    canEscape: true,
    canLose: true,
  });
  runtime.tick(1_000);
  runtime.performActorCommand({ kind: "defend" });
  return runtime.snapshot().eventLogs.filter((log) => log.pageId === PAGE_ID);
}

describe("battle event executor exhaustive command coverage", () => {
  it("Command 전 kind 무음 스킵 0건: troop-full 선언이거나 페이지에 추적 로그가 남는다", () => {
    for (const kind of COMMAND_KINDS) {
      const command = newCommand(kind);
      const logs = runBattlePageWith(command);
      expect(logs.some((log) => log.kind === "fired"), `${kind}: 배틀 페이지가 발화하지 않음`).toBe(true);
      const traced = logs.some((log) => log.kind !== "fired");
      const declaredFull = battleEventCommandRuntimeSupport(command) === "runtime-full";
      expect(
        declaredFull || traced,
        `${kind}: 무음 스킵 — troop-full 선언도 아니고 unsupported/message 로그도 없음`
      ).toBe(true);
    }
  });

  it("기존 fall-through 16종은 명시적 unsupported 로그를 남긴다", () => {
    for (const kind of PREVIOUSLY_SILENT_KINDS) {
      const logs = runBattlePageWith(newCommand(kind));
      expect(
        logs.some((log) => log.kind === "unsupported" && log.detail === kind),
        `${kind}: 명시적 unsupported 로그(detail=kind)가 없음`
      ).toBe(true);
    }
  });

  it("fall-through 16종은 troop-full 로 선언되지 않는다 (배지 정직성)", () => {
    for (const kind of PREVIOUSLY_SILENT_KINDS) {
      expect(battleEventCommandRuntimeSupport(newCommand(kind)), kind).not.toBe("runtime-full");
    }
  });
});
