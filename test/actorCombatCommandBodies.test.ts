import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import {
  enterHeroNameBody,
  promoteActorBody,
  recoverAllBody,
} from "@/editor/panels/eventEditor/commandBodyDatabase";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function ctx(replaceCommand = vi.fn()): CommandEditContext {
  return {
    path: [0],
    actions: {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand,
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
    },
  };
}

function m2(commandId: string, fields: Record<string, string | number> = {}): Extract<Command, { kind: "m2Command" }> {
  return { kind: "m2Command", commandId, fields };
}

describe("actor combat command modern bodies", () => {
  let restoreDom: (() => void) | undefined;
  let actorId = "";
  let stateId = "";
  let classId = "";

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    actorId = project.database.actors[0]?.id ?? "";
    stateId = project.database.states[0]?.id ?? "";
    classId = project.database.classes[0]?.id ?? "";
    if (!actorId) throw new Error("missing actor");
    store.replace(project);
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("modernizes change state with chips and party target", () => {
    if (!stateId) return;
    const replaceCommand = vi.fn();
    const body = renderWithFakeDom(() =>
      renderM2CommandBody(
        ctx(replaceCommand),
        m2("m2-019-change-state", { target: "party", operation: "add", value: stateId })
      )!
    );
    expect(findByTestId(body, "change-state-command-body")).not.toBeNull();
    expect(findByTestId(body, "change-state-intent")).not.toBeNull();
    expect(findByTestId(body, "change-state-grid")).not.toBeNull();
    (findByTestId(body, `change-state-chip-${stateId}`) as FakeElement | null)?.dispatchEvent(new Event("click"));
    const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "m2Command" }>;
    expect(next.fields.value).toBe(stateId);
  });

  it("modernizes damage processing presets", () => {
    const replaceCommand = vi.fn();
    const body = renderWithFakeDom(() =>
      renderM2CommandBody(ctx(replaceCommand), m2("m2-021-damage-processing", { target: actorId, operation: "add", value: 1 }))!
    );
    expect(findByTestId(body, "damage-processing-command-body")).not.toBeNull();
    (findByTestId(body, "damage-processing-preset-heal-20") as FakeElement | null)?.dispatchEvent(new Event("click"));
    const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "m2Command" }>;
    expect(next.fields.operation).toBe("remove");
    expect(next.fields.value).toBe(20);
  });

  it("modernizes actor name and nickname forms", () => {
    for (const [id, testid] of [
      ["m2-022-change-actor-name", "change-actor-name"],
      ["m2-023-change-actor-nickname", "change-actor-nickname"],
    ] as const) {
      const body = renderWithFakeDom(() => renderM2CommandBody(ctx(), m2(id, { target: actorId, value: "" }))!);
      expect(findByTestId(body, `${testid}-command-body`)).not.toBeNull();
      expect(findByTestId(body, `${testid}-intent`)).not.toBeNull();
      expect(findByTestId(body, `${testid}-value-input`)).not.toBeNull();
    }
  });

  it("modernizes actor graphic/faceset/class forms", () => {
    expect(
      findByTestId(
        renderWithFakeDom(() => renderM2CommandBody(ctx(), m2("m2-024-change-actor-graphic", { target: actorId, value: "" }))!),
        "change-actor-graphic-command-body"
      )
    ).not.toBeNull();
    expect(
      findByTestId(
        renderWithFakeDom(() => renderM2CommandBody(ctx(), m2("m2-025-change-actor-faceset", { target: actorId, value: "" }))!),
        "change-actor-faceset-command-body"
      )
    ).not.toBeNull();
    const replaceCommand = vi.fn();
    const classBody = renderWithFakeDom(() =>
      renderM2CommandBody(ctx(replaceCommand), m2("m2-091-change-actor-class", { target: actorId, value: classId }))!
    );
    expect(findByTestId(classBody, "change-actor-class-command-body")).not.toBeNull();
    if (classId) {
      (findByTestId(classBody, `change-actor-class-chip-${classId}`) as FakeElement | null)?.dispatchEvent(new Event("click"));
      const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "m2Command" }>;
      expect(next.fields.value).toBe(classId);
    }
  });

  it("modernizes recover all / enter hero name / promote", () => {
    const recover = renderWithFakeDom(() => recoverAllBody(ctx(), { kind: "recoverAll", actorId: "" }));
    expect(findByTestId(recover, "recover-all-command-body")).not.toBeNull();
    expect(findByTestId(recover, "recover-all-intent")).not.toBeNull();
    expect(findByTestId(recover, "recover-all-actor-select")).not.toBeNull();

    const name = renderWithFakeDom(() =>
      enterHeroNameBody(ctx(), { kind: "enterHeroName", actorId, maxLength: 6, showInitialName: true })
    );
    expect(findByTestId(name, "enter-hero-name-command-body")).not.toBeNull();
    expect(findByTestId(name, "enter-hero-name-actor-select")?.value).toBe(actorId);

    const promote = renderWithFakeDom(() =>
      promoteActorBody(ctx(), { kind: "promoteActor", actorId, toClassId: classId, successBranch: [], failureBranch: [] })
    );
    expect(findByTestId(promote, "promote-actor-command-body")).not.toBeNull();
    expect(findByTestId(promote, "promote-actor-select")?.value).toBe(actorId);
  });
});
