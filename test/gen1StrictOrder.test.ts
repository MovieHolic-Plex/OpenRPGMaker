import { describe, expect, it, vi } from "vitest";
import { orderGen1TurnActions, type Gen1TurnOrderEntry } from "@/battle/battleStrictOrder";

function entry(
  id: string,
  commandClass: Gen1TurnOrderEntry["commandClass"],
  speed: number,
  priority = 0
): Gen1TurnOrderEntry & { readonly id: string } {
  return { id, commandClass, speed, priority };
}

describe("Gen1 strict command ordering", () => {
  it("orders switch, field command, then combat commands", () => {
    const rng = vi.fn(() => 0.5);
    const ordered = orderGen1TurnActions([
      entry("fast-attack", "combat", 100),
      entry("run", "field", 1),
      entry("switch", "switch", 1),
    ], rng);

    expect(ordered.map((action) => action.id)).toEqual(["switch", "run", "fast-attack"]);
    expect(rng).not.toHaveBeenCalled();
  });

  it("uses move priority before speed inside the combat band", () => {
    const rng = vi.fn(() => 0.5);
    const ordered = orderGen1TurnActions([
      entry("fast", "combat", 100, 0),
      entry("quick", "combat", 1, 1),
    ], rng);

    expect(ordered.map((action) => action.id)).toEqual(["quick", "fast"]);
    expect(rng).not.toHaveBeenCalled();
  });

  it("does not consume RNG unless command class, priority, and speed all tie", () => {
    const unequalRng = vi.fn(() => 0.9);
    orderGen1TurnActions([
      entry("slow", "combat", 9),
      entry("fast", "combat", 10),
    ], unequalRng);
    expect(unequalRng).not.toHaveBeenCalled();

    const tieRng = vi.fn(() => 0.9);
    const tied = orderGen1TurnActions([
      entry("actor", "combat", 10),
      entry("enemy", "combat", 10),
    ], tieRng);
    expect(tieRng).toHaveBeenCalledTimes(1);
    expect(tied.map((action) => action.id)).toEqual(["actor", "enemy"]);
  });
});
