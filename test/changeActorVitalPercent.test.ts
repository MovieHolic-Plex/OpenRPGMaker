import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeActorHpBody } from "@/editor/panels/eventEditor/commandBodyDatabase";
import { commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { changeActorVital } from "@/project/sessionActorCommands";
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

describe("changeActorHp percent mode", () => {
  let restoreDom: (() => void) | undefined;
  let actorId = "";

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    actorId = project.database.actors[0]?.id ?? "";
    if (!actorId) throw new Error("missing actor");
    store.replace(project);
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("exposes flat/% mode and percent presets", () => {
    const body = renderWithFakeDom(() =>
      changeActorHpBody(ctx(), { kind: "changeActorHp", actorId, op: "+=", amount: 10 })
    );
    expect(findByTestId(body, "change-actor-hp-command-body")).not.toBeNull();
    expect(findByTestId(body, "change-actor-hp-amount-mode")).not.toBeNull();
    expect(findByTestId(body, "change-actor-hp-amount-presets")).not.toBeNull();
    expect(findByTestId(body, "change-actor-hp-amount-preset-heal-50")).not.toBeNull();
    expect(body.textContent).toContain("%");
  });

  it("writes amountMode percent through the +50% preset", () => {
    const replaceCommand = vi.fn();
    const body = renderWithFakeDom(() =>
      changeActorHpBody(ctx(replaceCommand), { kind: "changeActorHp", actorId, op: "-=", amount: 10 })
    );
    (findByTestId(body, "change-actor-hp-amount-preset-heal-50") as FakeElement | null)?.dispatchEvent(
      new Event("click")
    );
    expect(replaceCommand).toHaveBeenCalled();
    const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "changeActorHp" }>;
    expect(next.kind).toBe("changeActorHp");
    expect(next.op).toBe("+=");
    expect(next.amount).toBe(50);
    expect(next.amountMode).toBe("percent");
  });

  it("applies percent amount against max vitals at runtime", () => {
    const project = store.getCurrent();
    const session = startSession(project);
    const vitals = session.actorVitals[actorId];
    if (!vitals) throw new Error("missing vitals");
    vitals.hp = 0;
    changeActorVital(session, {
      kind: "changeActorHp",
      actorId,
      op: "+=",
      amount: 50,
      amountMode: "percent",
    });
    expect(session.actorVitals[actorId]?.hp).toBe(Math.trunc(vitals.maxHp * 0.5));
  });

  it("summarizes percent amounts with a % suffix", () => {
    const text = commandSummaryParts({
      kind: "changeActorHp",
      actorId,
      op: "+=",
      amount: 25,
      amountMode: "percent",
    })
      .map((part) => part.text)
      .join("");
    expect(text).toContain("HP 변경");
    expect(text).toContain("25%");
  });
});
