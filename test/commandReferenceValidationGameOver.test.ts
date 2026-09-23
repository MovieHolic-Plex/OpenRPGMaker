import { describe, expect, it } from "vitest";
import { validateCommands, type ReferenceContext } from "@/project/io/commandReferenceValidation";

const EMPTY = new Set<string>();
const base: ReferenceContext = {
  actorIds: EMPTY, classIds: EMPTY, enemyIds: EMPTY, itemIds: EMPTY, equipmentIds: EMPTY, skillIds: EMPTY,
  animationIds: EMPTY, switchIds: EMPTY, variableIds: EMPTY, commonEventIds: EMPTY, endingIds: EMPTY,
  mapIds: EMPTY, troopIds: EMPTY, speciesIds: EMPTY, resourceIds: EMPTY,
};

describe("gameOver / killPlayer reference validation", () => {
  it("rejects an unknown game-over id when the caller supplies the definitions", () => {
    const context = { ...base, gameOverIds: new Set(["caught"]) };
    expect(() => validateCommands([{ kind: "gameOver", gameOverId: "caught" }], context)).not.toThrow();
    expect(() => validateCommands([{ kind: "killPlayer", gameOverId: "missing" }], context)).toThrow(/missing definition missing/);
  });

  it("skips the check when the caller omits gameOverIds instead of rejecting every id", () => {
    expect(() => validateCommands([{ kind: "gameOver", gameOverId: "caught" }], base)).not.toThrow();
    expect(() => validateCommands([{ kind: "killPlayer", gameOverId: "caught", message: "x" }], base)).not.toThrow();
  });
});
