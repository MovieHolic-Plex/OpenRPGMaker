/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { M2_COMMAND_CATALOG, createDefaultM2Fields } from "@/project/eventCommands/m2Catalog";
import { newCommand } from "@/editor/eventActions";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, GameEvent } from "@/project/types";

beforeEach(() => {
  document.body.replaceChildren();
  const project = createBlankProject();
  project.switches = []; project.variables = [];
  project.database.actors = []; project.database.items = []; project.database.skills = [];
  project.database.troops = []; project.database.equipment = []; project.database.classes = [];
  store.replaceProject(project);
});

describe("native validation repair anchors", () => {
  const kinds: readonly Command["kind"][] = ["setSwitch", "setVariable", "inputNumber", "callCommonEvent", "callMapEvent",
    "battleProcessing", "learnSkill", "changeLevel", "changeActorHp", "changeActorMp", "changeParty", "craftRecipe",
    "applyItemUpgrade", "changeLifeSkillExp", "getFriendship", "giveMonster", "showAnimation", "showPicture", "playAudio", "playMovie", "shop"];
  it.each(kinds)("locates the real form's repair field for %s", kind => {
    // Given: the shipped command default against empty reference tables.
    const project = store.getCurrent();
    const command = newCommand(kind);
    if ("resourceId" in command) command.resourceId = "missing-resource";
    if ("skillId" in command) command.skillId = "missing-skill";
    if ("actorId" in command) command.actorId = "missing-actor";
    if ("animationId" in command) command.animationId = "missing-animation";
    if ("speciesId" in command) command.speciesId = "missing-species";
    const event: GameEvent = { id: "anchor", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [{
      id: "page", name: "page", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [command],
    }] };
    const body = renderCommandBody({ path: [0], lockKind: true, actions: {
      addCommand: vi.fn(), insertCommand: vi.fn(), replaceCommand: vi.fn(), deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn(),
    } }, command);
    document.body.append(body);
    // When: the real validator diagnoses the command.
    const errors = validateEventDraftBody(project, project.startMapId, event).issues.filter(issue => issue.severity === "error");
    // Then: no fabricated fallback location stands in for an editable field.
    expect(errors.length).toBeGreaterThan(0);
    for (const issue of errors) {
      expect(issue.field?.testId, issue.code).not.toBe("event-inspector-body");
      expect(body.querySelector(`[data-testid="${issue.field?.testId}"]`), `${kind}: ${issue.code}: ${issue.field?.testId}`).not.toBeNull();
    }
  });
});

const references = new Set(["actorId", "animationId", "eventA", "eventB", "eventId", "itemId", "mapId", "mapVariableId", "prefabId",
  "resourceId", "skillId", "switchId", "troopId", "variableId", "xVariableId", "yVariableId"]);
it.each(M2_COMMAND_CATALOG.filter(entry => entry.fields.some(field => references.has(field.key))))(
  "locates existing M2 reference controls for $title", entry => {
    const project = store.getCurrent();
    const fields = createDefaultM2Fields(entry);
    for (const key of Object.keys(fields)) if (references.has(key)) fields[key] = "missing-reference";
    const command: Command = { kind: "m2Command", commandId: entry.id, fields };
    const event: GameEvent = { id: "anchor", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [{
      id: "page", name: "page", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [command],
    }] };
    const body = renderCommandBody({ path: [0], lockKind: true, actions: {
      addCommand: vi.fn(), insertCommand: vi.fn(), replaceCommand: vi.fn(), deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn(),
    } }, command);
    document.body.append(body);
    const errors = validateEventDraftBody(project, project.startMapId, event).issues.filter(issue => issue.severity === "error");
    for (const issue of errors) {
      const available = Array.from(body.querySelectorAll("[data-testid]")).map(node => node.getAttribute("data-testid"));
      expect(body.querySelector(`[data-testid="${issue.field?.testId}"]`), `${entry.title}: ${issue.field?.testId}; ${available.join(", ")}`).not.toBeNull();
    }
  });
