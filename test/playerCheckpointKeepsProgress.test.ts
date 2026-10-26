import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createInterpreter } from "@/player/interpreter";
import { getSessionCheckpoint, MAP_ENTRY_CHECKPOINT_LABEL, restoreSessionCheckpoint } from "@/player/checkpoints";

describe("map-entry checkpoint retry keeps progress (J58)", () => {
  it("moves back to the entry spot but keeps what was gained after the checkpoint", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const switchId = project.switches[0]!.id;
    const at = { mapId: session.currentMapId, x: session.x, y: session.y };
    createInterpreter([{ kind: "checkpointSave", label: MAP_ENTRY_CHECKPOINT_LABEL }], session, project).start();
    session.switches[switchId] = true;
    createInterpreter([{ kind: "killPlayer", message: "붙잡혔다" }], session, project).start();
    const restored = restoreSessionCheckpoint(project, session)!;
    expect(restored.switches[switchId]).toBe(true);
    expect({ mapId: restored.currentMapId, x: restored.x, y: restored.y }).toEqual(at);
    expect(restored.actorVitals[restored.partyActorIds[0]!]!.hp).toBeGreaterThan(0);
    expect(getSessionCheckpoint(restored)).toBe(getSessionCheckpoint(session));
  });
  it("an unlabeled checkpoint still restores the full snapshot", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const switchId = project.switches[0]!.id;
    createInterpreter([{ kind: "checkpointSave" }], session, project).start();
    session.switches[switchId] = true;
    expect(restoreSessionCheckpoint(project, session)!.switches[switchId]).toBeFalsy();
  });
});
