import { describe, expect, it } from "vitest";
import { newCommand } from "@/editor/eventCommandFactory";
import { createInterpreter } from "@/player/interpreter";
import type { Command } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

function mkSession(): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorVitals: {},
    currentMapId: "m1",
    x: 0,
    y: 0,
  };
}

describe("Shop Processing command options", () => {
  it("creates a general-store shop with starter stock (not an empty catalog)", () => {
    expect(newCommand("shop")).toMatchObject({
      kind: "shop",
      itemIds: ["item_potion", "item_ether", "item_antidote"],
      shopType: "normal",
      messageType: "welcome",
      branchOnTransaction: false,
      transactionBranch: [],
      quantityMode: "single",
    });
  });

  it("passes RM-style shop options through the interpreter handoff", () => {
    const command: Command = {
      kind: "shop",
      itemIds: ["item_potion"],
      shopType: "sellOnly",
      messageType: "welcome",
      branchOnTransaction: true,
      allowSell: true,
      quantityMode: "select",
    };
    const result = createInterpreter([command], mkSession()).start();

    expect(result).toEqual({
      kind: "shop",
      itemIds: ["item_potion"],
      shopType: "sellOnly",
      messageType: "welcome",
      branchOnTransaction: true,
      allowSell: true,
      quantityMode: "select",
    });
  });

  it("runs the transaction branch only after a buy or sell succeeds", () => {
    const command: Command = {
      kind: "shop",
      itemIds: ["item_potion"],
      branchOnTransaction: true,
      transactionBranch: [{ kind: "text", body: "Thank you." }],
    };
    const interpreter = createInterpreter([command, { kind: "text", body: "After shop." }], mkSession());

    expect(interpreter.start()).toMatchObject({ kind: "shop", branchOnTransaction: true });
    expect(interpreter.resume(true)).toMatchObject({ kind: "text", body: "Thank you." });
    expect(interpreter.resume(undefined)).toMatchObject({ kind: "text", body: "After shop." });
  });

  it("skips the transaction branch when the shop closes without a transaction", () => {
    const command: Command = {
      kind: "shop",
      itemIds: ["item_potion"],
      branchOnTransaction: true,
      transactionBranch: [{ kind: "text", body: "Thank you." }],
    };
    const interpreter = createInterpreter([command, { kind: "text", body: "After shop." }], mkSession());

    expect(interpreter.start()).toMatchObject({ kind: "shop", branchOnTransaction: true });
    expect(interpreter.resume(false)).toMatchObject({ kind: "text", body: "After shop." });
  });
});
