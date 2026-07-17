// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { newCommand } from "@/editor/eventCommandFactory";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { COMMAND_KIND_OPTIONS, commandKindLabel } from "@/editor/panels/eventEditor/options";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import {
  COMMAND_GUARANTEES,
  commandGuaranteeIssues,
} from "@/project/commandGuaranteeRegistry";
import { deserialize, serialize } from "@/project/io";
import { validateCommands } from "@/project/io/commandReferenceValidation";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { store } from "@/project/store";
import type { GameEvent } from "@/project/types";
import { dialogueControlCases } from "./eventCommandAuthoring/mutationDialogueControl";
import { mapTimeCases } from "./eventCommandAuthoring/mutationMapTime";
import { sceneSystemCases } from "./eventCommandAuthoring/mutationSceneSystem";
import { stateActorCases } from "./eventCommandAuthoring/mutationStateActor";
import { requireTestElement } from "./eventCommandAuthoring/mutationTypes";
import {
  AUTHORING_EVENT_ID,
  buildHydratedAuthoringCommands,
  buildReferenceContext,
  commandByKind,
  createAuthoringReferenceFixture,
} from "./eventCommandAuthoring/referenceFixture";
import { actualSurfacesFor, stableFullRouteIssues } from "./eventCommandAuthoring/surfaceMatrix";

const MUTATION_FIXTURE = createAuthoringReferenceFixture();
const AUTHORING_CASES = [
  ...dialogueControlCases(MUTATION_FIXTURE),
  ...mapTimeCases(MUTATION_FIXTURE),
  ...stateActorCases(MUTATION_FIXTURE),
  ...sceneSystemCases(MUTATION_FIXTURE),
];

describe("event command authoring matrix", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("enumerates exactly 70 native kinds with identity-preserving defaults and Korean labels", () => {
    expect(COMMAND_KINDS).toHaveLength(70);
    expect(new Set(COMMAND_KINDS).size).toBe(70);
    expect(new Set(COMMAND_KIND_OPTIONS.map((option) => option.value))).toEqual(new Set(COMMAND_KINDS));

    for (const kind of COMMAND_KINDS) {
      expect(newCommand(kind).kind, `${kind}: factory identity`).toBe(kind);
      expect(commandKindLabel(kind), `${kind}: raw label fallback`).not.toBe(kind);
      expect(commandKindLabel(kind), `${kind}: Korean display label`).toMatch(/[가-힣]/);
    }
  });

  it("keeps declared authoring surfaces exact for every kind and permitted context", () => {
    expect(Object.keys(COMMAND_GUARANTEES)).toEqual([...COMMAND_KINDS]);
    for (const kind of COMMAND_KINDS) {
      const guarantee = COMMAND_GUARANTEES[kind];
      expect(commandGuaranteeIssues(kind, guarantee), `${kind}: guarantee invariants`).toEqual([]);
      expect(new Set(guarantee.authoringSurfaces).size, `${kind}: declared surface duplicates`).toBe(
        guarantee.authoringSurfaces.length
      );
      expect(new Set(actualSurfacesFor(kind)), `${kind}: declared authoring surfaces`).toEqual(
        new Set(guarantee.authoringSurfaces)
      );
      if (guarantee.stability === "deprecated") {
        expect(guarantee.authoringSurfaces, `${kind}: deprecated hidden`).toEqual([]);
        expect(guarantee.replacementKind, `${kind}: deprecated replacement`).toBeTruthy();
      }
    }
  });

  it("provides every stable full-support context with its owning authoring route", () => {
    const issues = COMMAND_KINDS.flatMap((kind) => stableFullRouteIssues(kind, COMMAND_GUARANTEES[kind]));

    expect(issues).toEqual([]);
  });

  it("hydrates every default deterministically before shape and reference validation", () => {
    const fixture = createAuthoringReferenceFixture();
    const commands = buildHydratedAuthoringCommands(fixture);

    expect(commands.map((command) => command.kind)).toEqual(COMMAND_KINDS);
    expect(() => validateCommandArray("authoring matrix", commands)).not.toThrow();
    expect(() => validateCommands(commands, buildReferenceContext(fixture.project))).not.toThrow();
  });

  it("rejects an invalid default reference until the fixture hydrates that kind", () => {
    const fixture = createAuthoringReferenceFixture();
    const invalid = newCommand("changeItem");
    const hydrated = commandByKind(buildHydratedAuthoringCommands(fixture), "changeItem");

    expect(() => validateCommands([invalid], buildReferenceContext(fixture.project))).toThrow(/changeItem/);
    expect(() => validateCommands([hydrated], buildReferenceContext(fixture.project))).not.toThrow();
  });

  it("rejects malformed authoring mutations with the affected kind and field", () => {
    const malformed: unknown = { kind: "craftRecipe", recipeId: 42 };

    expect(() => validateCommandArray("authoring craftRecipe", [malformed])).toThrow(/craftRecipe.*recipeId/);
  });

  it("owns one independent real-body authoring case for every native kind", () => {
    expect(AUTHORING_CASES).toHaveLength(COMMAND_KINDS.length);
    expect(new Set(AUTHORING_CASES.map((entry) => entry.kind))).toEqual(new Set(COMMAND_KINDS));
    expect(AUTHORING_CASES.filter((entry) => entry.mode === "boundary")).toHaveLength(5);
  });

  it.each(COMMAND_KINDS)("applies the %s owning form contract", (kind) => {
    const authoringCase = AUTHORING_CASES.find((entry) => entry.kind === kind);
    if (!authoringCase) throw new Error(`missing authoring case: ${kind}`);
    const initial = commandByKind(buildHydratedAuthoringCommands(MUTATION_FIXTURE), kind);
    const replaceCommand = vi.fn<CommandListActions["replaceCommand"]>();
    const actions = commandListActions(replaceCommand);
    store.replace(MUTATION_FIXTURE.project);
    editorState.set({
      currentMapId: MUTATION_FIXTURE.project.startMapId,
      selectedEventId: AUTHORING_EVENT_ID,
    });
    const body = renderCommandBody({ path: [0], actions, lockKind: true }, initial);
    expect(body.querySelector("[data-testid='event-command-edit-summary']"), `${kind}: summary`).not.toBeNull();

    if (authoringCase.mode === "boundary") {
      const boundary = requireTestElement(body, authoringCase.testId);
      expect(boundary.tagName, `${kind}: boundary tag`).toBe(authoringCase.tagName);
      expect(boundary.textContent?.trim(), `${kind}: boundary text`).toBeTruthy();
      expect(body.querySelectorAll("input,select,button,textarea"), `${kind}: fieldless controls`).toHaveLength(0);
      expect(replaceCommand, `${kind}: fieldless replace`).not.toHaveBeenCalled();
      return;
    }

    if (authoringCase.clearAfterRender) replaceCommand.mockClear();
    expect(authoringCase.expected.kind).toBe(kind);
    expect(authoringCase.expected, `${kind}: meaningful changed command`).not.toEqual(initial);
    authoringCase.apply(body);
    expect(replaceCommand, `${kind}: native field mutation`).toHaveBeenLastCalledWith(
      [0],
      authoringCase.expected
    );
  });

  it("preserves all hydrated commands through canonical project IO and a second idempotent roundtrip", () => {
    const fixture = createAuthoringReferenceFixture();
    const commands = buildHydratedAuthoringCommands(fixture);
    const event: GameEvent = {
      id: AUTHORING_EVENT_ID,
      characterId: "character_authoring_matrix",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [...commands],
    };
    fixture.project.maps[fixture.project.startMapId]?.events.push(event);

    const once = deserialize(serialize(fixture.project));
    const restoredCommands = once.maps[once.startMapId]?.events.find(
      (candidate) => candidate.id === AUTHORING_EVENT_ID
    )?.commands;
    expect(restoredCommands).toEqual(commands);
    const onceWire = serialize(once);
    expect(serialize(deserialize(onceWire))).toBe(onceWire);
  });
});

function commandListActions(
  replaceCommand: CommandListActions["replaceCommand"] = vi.fn()
): CommandListActions {
  return {
    addCommand: vi.fn(),
    insertCommand: vi.fn(),
    replaceCommand,
    deleteCommand: vi.fn(),
    moveCommand: vi.fn(),
    moveCommandTo: vi.fn(),
  };
}
