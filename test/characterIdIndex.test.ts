import { describe, expect, it } from "vitest";
import { characterIdExists, findCharacterIdEntry, listCharacterIdIndex } from "@/project/characterIdIndex";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";

function event(partial: Partial<GameEvent> & Pick<GameEvent, "id">): GameEvent {
  return {
    id: partial.id,
    x: partial.x ?? 1,
    y: partial.y ?? 1,
    trigger: partial.trigger ?? { kind: "action" },
    commands: partial.commands ?? [],
    pages: partial.pages ?? [{ id: "p1", conditions: [], commands: [] }],
    ...partial,
  };
}

function projectWith(
  events: readonly GameEvent[],
  characters?: Project["characters"]
): Project {
  const project = createBlankProject();
  const mapId = project.startMapId;
  project.maps[mapId] = {
    ...project.maps[mapId],
    events: [...events],
  };
  if (characters) project.characters = characters;
  return project;
}

describe("characterIdIndex", () => {
  it("unions project.characters keys and event characterIds", () => {
    const project = projectWith(
      [event({ id: "ev_a", characterId: "char_used" })],
      {
        char_used: { displayName: "Used" },
        char_only_profile: { displayName: "Profile Only" },
      }
    );
    project.maps["map_extra"] = {
      ...project.maps[project.startMapId],
      id: "map_extra",
      name: "Extra",
      events: [event({ id: "ev_b", characterId: "char_orphan" })],
    };

    const index = listCharacterIdIndex(project);
    const byId = Object.fromEntries(index.map((entry) => [entry.characterId, entry]));

    expect(Object.keys(byId).sort()).toEqual(["char_only_profile", "char_orphan", "char_used"]);
    expect(byId.char_used).toMatchObject({
      hasProfile: true,
      usageCount: 1,
      mapCount: 1,
      isOrphan: false,
      isUnusedProfile: false,
    });
    expect(byId.char_only_profile).toMatchObject({
      hasProfile: true,
      usageCount: 0,
      isOrphan: false,
      isUnusedProfile: true,
    });
    expect(byId.char_orphan).toMatchObject({
      hasProfile: false,
      usageCount: 1,
      isOrphan: true,
      isUnusedProfile: false,
    });
    expect(byId.char_used.hosts[0]).toMatchObject({
      mapId: project.startMapId,
      eventId: "ev_a",
    });
  });

  it("ignores blank characterIds and counts multi-map usage", () => {
    const project = projectWith([
      event({ id: "ev_blank", characterId: "   " }),
      event({ id: "ev_one", characterId: "shared" }),
    ]);
    project.maps["map_two"] = {
      ...project.maps[project.startMapId],
      id: "map_two",
      name: "Two",
      events: [event({ id: "ev_two", characterId: " shared " })],
    };

    const entry = findCharacterIdEntry(project, "shared");
    expect(entry?.usageCount).toBe(2);
    expect(entry?.mapCount).toBe(2);
    expect(characterIdExists(project, "shared")).toBe(true);
    expect(characterIdExists(project, "missing")).toBe(false);
    expect(listCharacterIdIndex(project).some((item) => item.characterId === "")).toBe(false);
  });
});
