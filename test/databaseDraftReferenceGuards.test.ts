import { beforeEach, describe, expect, it } from "vitest";
import { addDatabaseRecord, deleteDatabaseRecord } from "@/editor/databaseActions";
import { commandsReferenceLocations, commandsResourceReference, switchVariableReferenceLocations, switchVariableReferencedInProject } from "@/editor/databaseCommandReferences";
import { commonEventReferenceMessage } from "@/editor/databaseReferences";
import { createBlankProject } from "@/project/defaults";
import { beginEventEditDraft, commitEventDraft, discardEventDraft, projectWithoutEventDrafts } from "@/project/eventDrafts";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import type { Command, GameEvent, Project } from "@/project/types";

function editedEvent(project: Project, commands: Command[]): GameEvent {
  const mapId = project.startMapId;
  const event: GameEvent = { id: "draft_reference", name: "초안 원본", x: 0, y: 0, trigger: { kind: "action" }, commands };
  project.maps[mapId]!.events.push(event);
  beginEventEditDraft(project, mapId, event.id);
  event.commands = [];
  return event;
}

describe("database references retained by unapplied event drafts", () => {
  beforeEach(() => store.replaceProject(createBlankProject()));

  it("keeps a referenced skill through canonical save and cancel, then permits deletion after Apply", () => {
    const skillId = addDatabaseRecord("skills");
    const actorId = store.getCurrent().database.actors[0]!.id;
    store.update((project) => editedEvent(project, [{ kind: "learnSkill", actorId, skillId, action: "learn" }]));
    const live = store.getCurrent();
    const mapId = live.startMapId;

    expect(deleteDatabaseRecord("skills", skillId)).toMatchObject({ ok: false });
    expect(deserialize(serialize(projectWithoutEventDrafts(live))).database.skills.some((skill) => skill.id === skillId)).toBe(true);
    const cancelled = structuredClone(live);
    expect(discardEventDraft(cancelled, mapId, "draft_reference")).toBe(true);
    expect(deserialize(serialize(cancelled)).database.skills.some((skill) => skill.id === skillId)).toBe(true);

    store.update((project) => { commitEventDraft(project, mapId, "draft_reference"); });
    expect(deleteDatabaseRecord("skills", skillId)).toEqual({ ok: true });
    expect(deserialize(serialize(projectWithoutEventDrafts(store.getCurrent()))).database.skills.some((skill) => skill.id === skillId)).toBe(false);
  });

  it("protects original page conditions, commands, and graphics across each deletion scanner", () => {
    const project = createBlankProject();
    const event = editedEvent(project, []);
    event.draft!.conflict = { kind: "remote-change", detectedAt: 1 };
    event.draft!.original!.pages = [{
      id: "page", name: "원본 페이지", trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      graphic: { sprite: { type: "uploaded", id: "original-graphic" } },
      conditions: [{ kind: "switch", switchId: "original-switch", value: true },
        { kind: "variable", variableId: "original-variable", op: ">=", value: 1 }],
      commands: [{ kind: "callCommonEvent", commonEventId: "original-common" },
        { kind: "changeItem", itemId: "original-item", op: "+=", amount: 1 },
        { kind: "playAudio", resourceId: "original-audio", loop: false }],
    }];
    store.replace(project);

    expect(commandsReferenceLocations(project, "items", "original-item")).toHaveLength(1);
    expect(commonEventReferenceMessage("original-common")).not.toBeNull();
    for (const kind of ["switch", "variable"] as const) {
      expect(switchVariableReferencedInProject(project, kind, `original-${kind}`)).toBe(true);
      expect(switchVariableReferenceLocations(project, kind, `original-${kind}`)).toHaveLength(1);
    }
    expect(commandsResourceReference(project, "original-graphic")).toBe(true);
    expect(commandsResourceReference(project, "original-audio")).toBe(true);
  });

  it("reports one location when both working body and original refer to the same record", () => {
    const project = createBlankProject();
    const commands: Command[] = [{ kind: "changeItem", itemId: "target", op: "+=", amount: 1 }];
    const event = editedEvent(project, commands);
    event.commands = commands;
    expect(commandsReferenceLocations(project, "items", "target")).toHaveLength(1);
  });

  it.each(["new", "remote-delete"] as const)("ignores the noncanonical %s baseline but still protects working references", (kind) => {
    const project = createBlankProject();
    const event = editedEvent(project, [{ kind: "changeItem", itemId: "baseline-only", op: "+=", amount: 1 }]);
    if (kind === "new") event.draft!.kind = "new";
    else event.draft!.conflict = { kind: "remote-delete", detectedAt: 1 };
    event.commands = [{ kind: "changeItem", itemId: "working-only", op: "+=", amount: 1 }];

    expect(commandsReferenceLocations(project, "items", "baseline-only")).toHaveLength(0);
    expect(commandsReferenceLocations(project, "items", "working-only")).toHaveLength(1);
    expect(projectWithoutEventDrafts(project).maps[project.startMapId]!.events.some((item) => item.id === event.id)).toBe(false);
    expect(discardEventDraft(project, project.startMapId, event.id)).toBe(true);
    expect(project.maps[project.startMapId]!.events.some((item) => item.id === event.id)).toBe(false);
  });
});
