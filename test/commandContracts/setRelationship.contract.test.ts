import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { CONTRACT_EVENT_ID, roundtripCommands, runCommandContract } from "./harness";

describe("setRelationship interpreter contract", () => {
  it("writes an explicit relationship immediately, without an owner handoff", () => {
    const command: Command = { kind: "setRelationship", npcKey: "npc_contract", state: "dating" };
    for (const commands of [[command], roundtripCommands([command])]) {
      const result = runCommandContract(commands);
      expect(result.session.relationships).toEqual({ npc_contract: "dating" });
      expect(result.pauses).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    }
  });

  it("single clears an existing relationship instead of persisting a redundant state", () => {
    const result = runCommandContract([
      { kind: "setRelationship", npcKey: "npc_contract", state: "dating" },
      { kind: "setRelationship", npcKey: "npc_contract", state: "single" },
    ]);
    expect(result.session.relationships?.npc_contract).toBeUndefined();
    expect(result.finished).toBe(true);
  });

  it("uses owner character identity, and does not invent one when the owner is absent", () => {
    const command: Command = { kind: "setRelationship", state: "dating" };
    const owned = runCommandContract([command], { mutateProject: (project) => {
      const event = project.maps[project.startMapId].events.find((entry) => entry.id === CONTRACT_EVENT_ID);
      if (!event) throw new Error("Missing contract event");
      event.characterId = "character_contract";
    } });
    expect(owned.session.relationships).toEqual({ character_contract: "dating" });
    const unowned = runCommandContract([command], { currentEventId: null });
    expect(unowned.session.relationships).toBeUndefined();
    expect(unowned.finished).toBe(true);
  });
});
