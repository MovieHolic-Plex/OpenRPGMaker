import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { restoreEnergy, spendEnergy } from "@/project/energy";
import { startSession } from "@/project/session";

describe("P0 energy rules", () => {
  it("spends and restores against the authored maximum", () => {
    // Break caught: a successful action reports success without changing the session pool.
    const project = createBlankProject();
    project.system.energy = { max: 100, initial: 50 };
    const session = startSession(project, 1);

    expect(spendEnergy(project, session, 15)).toEqual({ ok: true, before: 50, after: 35, spent: 15 });
    expect(restoreEnergy(project, session, 80)).toEqual({ ok: true, before: 35, after: 100, restored: 65 });
    expect(session.energy).toBe(100);
  });

  it("accepts an authored zero daily restore as a successful no-op", () => {
    // Break caught: restorePerDay=0 aborts the entire transactional day transition.
    const project = createBlankProject();
    project.system.energy = { max: 100, initial: 35, restorePerDay: 0 };
    const session = startSession(project, 11);

    expect(restoreEnergy(project, session, 0)).toEqual({
      ok: true,
      before: 35,
      after: 35,
      restored: 0,
    });
    expect(session.energy).toBe(35);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    "rejects invalid spend %s without mutation",
    (amount) => {
      // Break caught: malformed amounts mint energy or partially debit the pool.
      const project = createBlankProject();
      project.system.energy = { max: 80, initial: 40 };
      const session = startSession(project, 2);
      expect(spendEnergy(project, session, amount)).toMatchObject({ ok: false, reason: "invalid-amount" });
      expect(session.energy).toBe(40);
    },
  );

  it("rejects insufficient energy and disabled projects atomically", () => {
    // Break caught: failed actions leave the pool at zero or invent a pool for legacy projects.
    const enabled = createBlankProject();
    enabled.system.energy = { max: 30, initial: 10 };
    const enabledSession = startSession(enabled, 3);
    expect(spendEnergy(enabled, enabledSession, 11)).toMatchObject({ ok: false, reason: "insufficient-energy" });
    expect(enabledSession.energy).toBe(10);

    const legacy = createBlankProject();
    const legacySession = startSession(legacy, 4);
    expect(restoreEnergy(legacy, legacySession)).toMatchObject({ ok: false, reason: "disabled" });
    expect(legacySession.energy).toBeUndefined();
  });
});
