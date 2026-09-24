import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { evalCondition } from "@/project/session";
import { resolveEventPage } from "@/project/io/pageResolution";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import type { Condition, EventPage, GameEvent } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

const owns: Condition = { kind: "monsterSpecies", speciesId: "merin", present: true };
const page = (id: string, conditions: Condition[]): EventPage => ({
  id, name: id, conditions, graphic: {}, trigger: { kind: "action" },
  priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
});

describe("monster species event conditions", () => {
  it("selects the reward page for a boxed capture and returns to the request after release", () => {
    const session = {
      ...createBlankProject().session,
      monsterInstances: { captured: { speciesId: "merin" } },
      monsterParty: [], monsterBox: ["captured"],
    } as unknown as PlaySessionLike;
    const event: GameEvent = { id: "collector", x: 1, y: 1, trigger: { kind: "action" }, commands: [],
      pages: [page("request", []), page("reward", [owns])] };
    expect(evalCondition(session, owns)).toBe(true);
    expect(resolveEventPage(event, session)?.id).toBe("reward");
    session.monsterBox = [];
    expect(evalCondition(session, owns)).toBe(false);
    expect(resolveEventPage(event, session)?.id).toBe("request");
    expect(evalCondition(session, { ...owns, present: false })).toBe(true);
  });

  it("requires both the capture and a quest flag inside a nested condition", () => {
    const session = { ...createBlankProject().session, monsterInstances: {}, monsterParty: [], monsterBox: [],
      switches: { accepted: true } } as unknown as PlaySessionLike;
    const ready: Condition = { kind: "all", conditions: [owns, { kind: "switch", switchId: "accepted", value: true }] };
    expect(evalCondition(session, ready)).toBe(false);
    expect(evalCondition(session, { kind: "not", condition: ready })).toBe(true);
  });

  it("rejects incomplete or mistyped authoring input rather than silently dropping it", () => {
    expect(() => validateConditionShape("condition", owns)).not.toThrow();
    expect(() => validateConditionShape("condition", { ...owns, speciesId: " " })).toThrow();
    expect(() => validateConditionShape("condition", { ...owns, present: "true" })).toThrow();
    expect(() => validateConditionShape("condition", { kind: "monsterSpecies", present: true })).toThrow();
  });
});
