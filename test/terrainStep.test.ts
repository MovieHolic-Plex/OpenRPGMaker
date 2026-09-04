import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { applyTerrainWalkDamage, scaledEncounterRate } from "@/project/terrainStep";

function sessionWithParty(project: ReturnType<typeof createBlankProject>): PlaySessionLike {
  const actorId = project.database.actors[0]?.id;
  if (!actorId) throw new Error("missing default actor");
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [actorId],
    actorVitals: {},
    currentMapId: project.startMapId,
    x: 0,
    y: 0,
  };
}

describe("scaledEncounterRate", () => {
  it("multiplies map rate by terrain percent", () => {
    expect(scaledEncounterRate(1000, 50)).toBe(500);
    expect(scaledEncounterRate(1000, undefined)).toBe(1000);
    expect(scaledEncounterRate(1000, 0)).toBe(0);
    expect(scaledEncounterRate(0, 100)).toBe(0);
  });
});

describe("applyTerrainWalkDamage", () => {
  it("reduces party hp by terrain damage", () => {
    const project = createBlankProject();
    const session = sessionWithParty(project);
    const result = applyTerrainWalkDamage(project, session, 5);
    expect(result.applied).toBe(5);
    const actorId = session.partyActorIds[0] as string;
    const vitals = session.actorVitals[actorId];
    expect(vitals).toBeDefined();
    expect(vitals?.hp).toBe((vitals?.maxHp ?? 0) - 5);
    expect(result.defeated).toBe(false);
  });

  it("reports defeat when damage wipes the party", () => {
    const project = createBlankProject();
    const session = sessionWithParty(project);
    const result = applyTerrainWalkDamage(project, session, 99999);
    expect(result.defeated).toBe(true);
    const actorId = session.partyActorIds[0] as string;
    expect(session.actorVitals[actorId]?.hp).toBe(0);
  });

  it("ignores zero damage", () => {
    const project = createBlankProject();
    const session = sessionWithParty(project);
    const result = applyTerrainWalkDamage(project, session, 0);
    expect(result.applied).toBe(0);
    expect(result.defeated).toBe(false);
  });
});
