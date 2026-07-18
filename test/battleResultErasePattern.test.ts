import { describe, expect, it } from "vitest";
import { buildFieldBattleMonsterEvent } from "@/project/defaults/complexMonsterAuthoring";
import { evalCondition, startSession } from "@/project/session";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";

function flatten(commands: readonly Command[]): Command[] {
  const out: Command[] = [];
  for (const command of commands) {
    out.push(command);
    if (command.kind === "fork") {
      out.push(...flatten(command.then));
      if (command.else) out.push(...flatten(command.else));
    }
  }
  return out;
}

describe("field monster victory erase pattern", () => {
  it("builds battle then victory-only erase + clear switch", () => {
    const event = buildFieldBattleMonsterEvent({
      id: "monster_test",
      name: "시험체",
      x: 5,
      y: 6,
      troopId: "troop_test_boss",
      intro: "싸운다!",
      victory: "이겼다!",
      spriteId: "tex_easyrpg_charset_monster1",
      characterIndex: 0,
      clearSwitch: "sw_0099",
    });
    const live = event.pages[0]!;
    const flat = flatten(live.commands);
    expect(flat.some((c) => c.kind === "battleProcessing" && c.troopId === "troop_test_boss")).toBe(true);
    expect(
      flat.some(
        (c) =>
          c.kind === "m2Command" &&
          c.commandId === "m2-086-erase-event"
      )
    ).toBe(true);
    expect(flat.some((c) => c.kind === "setSwitch" && c.switchId === "sw_0099" && c.value === true)).toBe(true);

    const victoryFork = live.commands.find((c) => c.kind === "fork");
    expect(victoryFork).toMatchObject({
      kind: "fork",
      condition: { kind: "battleResult", result: "victory" },
    });
  });

  it("battleResult condition evaluates session battle outcome", () => {
    const project = createBlankProject();
    const session = startSession(project);
    expect(evalCondition(session, { kind: "battleResult", result: "victory" })).toBe(false);
    session.battleResult = "victory";
    expect(evalCondition(session, { kind: "battleResult", result: "victory" })).toBe(true);
    expect(evalCondition(session, { kind: "battleResult", result: "escape" })).toBe(false);
  });
});
