/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createBattleEventRuntime } from "@/battle/battleEvents";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import * as runtimeSupport from "@/project/eventCommands/runtimeSupport";
import { deserialize } from "@/project/io";
import { battleEventDirectorState, battleMessageWindow } from "@/player/battleDirectorDom";
import { renderDatabaseCommandListEditor } from "@/editor/panels/databaseCommandListAdapter";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { newCommand, newM2Command } from "@/editor/eventActions";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import {
  eventCommandPickerSearchEntries,
  openEventCommandPicker,
} from "@/editor/panels/eventEditor/commandPicker";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { createBlankProject } from "@/project/defaults";
import {
  commandRuntimeSupport,
  m2CommandRuntimeSupport,
  type M2RuntimeContext,
} from "@/project/eventCommands/runtimeSupport";
import { store } from "@/project/store";
import type { Command, M2CommandFields } from "@/project/types";

// Evidence: docs/reviews/2026-09-06-event-command-reaudit.md in the audit tree;
// repairs tree: output/evidence/event-command-repairs/{map,audio}/green/.
// Reporting contracts do not replace those runtime/media tests. Every declared
// catalog field is represented below; unrelated IDs remain conservative.
const provenMapCommon = [
  ["m2-022-change-actor-name", { target: "actor_hero", value: "SUPPORT HERO" }],
  ["m2-040-set-event-location", { target: "event_a", mapId: "map_blank_start", x: 8, y: 7 }],
  ["m2-041-swap-event-location", { eventA: "event_a", eventB: "event_b" }],
  ["m2-042-get-terrain-id", { variableId: "var_0001", x: 8, y: 7 }],
  ["m2-043-get-event-id", { variableId: "var_0001", x: 8, y: 7 }],
  ["m2-044-hide-screen", {}],
  ["m2-045-show-screen", {}],
  ["m2-078-open-menu-screen", {}],
  ["m2-093-open-load-menu", {}],
  ["m2-205-pathfind-move", { target: "this-event", x: 8, y: 7, speed: 4, wait: true }],
  ["m2-206-wait-until", { condition: "switchOn", target: "sw_0001", value: "", timeoutMs: 1000 }],
  ["m2-210-sound-layer", { channel: "ambient", resourceId: "qa_ambient", volume: 63, fadeMs: 400 }],
] as const satisfies readonly (readonly [string, M2CommandFields])[];

const narrowerTroop = [
  ["text", "battle-message-only"],
  ["changeFace", "battle-presentation-metadata-only"],
  ["displayTextSettings", "battle-presentation-metadata-only"],
  ["inputWait", "input-not-awaited"],
  ["wait", "non-sequential-battle-wait"],
] as const;

const actions: CommandListActions = {
  addCommand: () => undefined,
  deleteCommand: () => undefined,
  insertCommand: () => undefined,
  moveCommand: () => undefined,
  moveCommandTo: () => undefined,
  replaceCommand: () => undefined,
};

function m2(commandId: string, fields: M2CommandFields = {}): Command {
  return { kind: "m2Command", commandId, fields };
}

function requiredElement<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing rendered element: ${selector}`);
  return element;
}

function listBadge(command: Command, context?: M2RuntimeContext): HTMLElement | null {
  const host = document.createElement("div");
  document.body.append(host);
  // Same explicit context supplied by map/common/troop production list callers.
  renderCommandList(host, [command], [], actions, {
    pickerContext: context,
  });
  requiredElement(host, `[data-testid="event-command-${command.kind}"]`);
  expect(host.querySelector(".cmd-item.is-broken")).toBeNull();
  return host.querySelector('[data-testid="command-runtime-badge-list-0"]');
}

function pickerButton(commandId: string, context?: M2RuntimeContext): HTMLButtonElement {
  const entry = eventCommandPickerSearchEntries().find((candidate) => candidate.commandId === commandId);
  if (!entry) throw new Error(`Missing existing picker entry: ${commandId}`);
  openEventCommandPicker({ title: "Support contract", context, onSelect: () => undefined });
  // Search includes existing informational rows without changing eligibility.
  const search = requiredElement<HTMLInputElement>(document, '[data-testid="event-command-picker-search"]');
  search.value = entry.label;
  search.dispatchEvent(new Event("input", { bubbles: true }));
  return requiredElement<HTMLButtonElement>(document, `[data-testid="${entry.testId}"]`);
}

function pickerBadge(commandId: string, context?: M2RuntimeContext): HTMLElement {
  return requiredElement(pickerButton(commandId, context), `[data-testid="command-runtime-badge-picker-${commandId}"]`);
}

function assertReason(badge: HTMLElement | null, reasonCode: string): asserts badge is HTMLElement {
  expect(badge).not.toBeNull();
  expect(badge?.dataset.runtimeReason).toBe(reasonCode);
}

beforeEach(() => {
  localStorage.clear();
  store.replace(createBlankProject());
});

afterEach(() => {
  // Close through the real modal lifecycle, not just DOM removal.
  document.querySelector<HTMLButtonElement>('[data-testid="event-command-picker-cancel"]')?.click();
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe.each(["map", "common"] as const)("evidence-bounded support in %s", (context) => {
  it.each(provenMapCommon)("classifies repaired/proven %s as full", (commandId, fields) => {
    expect(m2CommandRuntimeSupport(commandId, context)).toBe("runtime-full");
    expect(commandRuntimeSupport(m2(commandId, fields), context)).toBe("runtime-full");
  });

  it.each(provenMapCommon)("removes the obsolete warning from real picker and list for %s", (commandId, fields) => {
    const button = pickerButton(commandId, context);
    expect(button.dataset.runtimeSupport).toBe("runtime-full");
    expect(button.querySelector(".command-runtime-badge")).toBeNull();
    expect(listBadge(m2(commandId, fields), context)).toBeNull();
  });

  it.each([
    ["m2-027-change-system-bgm", "true"],
    ["m2-028-change-system-se", "false"],
  ] as const)("keeps %s metadata-only and identifies an audible alternative", (commandId, loop) => {
    const command = m2(commandId, { resourceId: "qa_audio", volume: 63 });
    expect(commandRuntimeSupport(command, context)).toBe("runtime-partial");
    const picker = pickerBadge(commandId, context);
    const list = listBadge(command, context);
    for (const badge of [picker, list]) {
      assertReason(badge, "system-audio-metadata-only");
      expect(badge.dataset.runtimeAlternative).toBe("playAudio");
      expect(badge.dataset.runtimeAlternativeLoop).toBe(loop);
    }
    // Shipped-copy equality, not prose pinning.
    expect(list?.title).toBe(picker.title);
    expect(list?.getAttribute("aria-label")).toBe(picker.getAttribute("aria-label"));
  });

  it.each(["m2-023-change-actor-nickname", "m2-202-screen-effect", "m2-207-region-trigger"])(
    "does not invent missing effects or promote unverified %s", (commandId) => {
      expect(m2CommandRuntimeSupport(commandId, context)).toBe("runtime-partial");
      assertReason(listBadge(newM2Command(commandId), context), "coverage-unverified");
    },
  );
});

describe("context-aware renderer explanation wiring", () => {
  it.each(provenMapCommon)("says %s is not executed in troop, not a partial map effect", (commandId, fields) => {
    const picker = pickerBadge(commandId, "troop");
    const list = listBadge(m2(commandId, fields), "troop");
    assertReason(picker, "not-executed-in-context");
    assertReason(list, "not-executed-in-context");
    expect(list.title).toBe(picker.title);
    expect(list.getAttribute("aria-label")).toBe(picker.getAttribute("aria-label"));
  });

  it.each(narrowerTroop)("does not claim native %s has map-equivalent troop semantics", (kind) => {
    const command = newCommand(kind);
    expect(commandRuntimeSupport(command, "troop")).toBe("runtime-partial");
    expect(commandRuntimeSupport(command, "map")).toBe("runtime-full");
    expect(commandRuntimeSupport(command, "common")).toBe("runtime-full");
  });

  it.each(narrowerTroop)("reports the actual troop limitation for native %s", (kind, reason) => {
    assertReason(listBadge(newCommand(kind), "troop"), reason);
  });

  it.each([
    ["m2-001-show-text", "text", "battle-message-only"],
    ["m2-003-change-faceset", "changeFace", "battle-presentation-metadata-only"],
    ["m2-002-display-text-settings", "displayTextSettings", "battle-presentation-metadata-only"],
    ["m2-060-wait", "wait", "non-sequential-battle-wait"],
  ] as const)("describes inserted native semantics rather than persisted alias semantics for %s", (commandId, kind, reason) => {
    const picker = pickerBadge(commandId, "troop");
    const list = listBadge(newCommand(kind), "troop");
    assertReason(picker, reason);
    assertReason(list, reason);
    expect(picker.dataset.runtimeSupport).toBe("runtime-partial");
    expect(list.title).toBe(picker.title);
  });

  it("distinguishes a skipped native map command from a narrower battle message", () => {
    assertReason(listBadge({ kind: "playMovie", resourceId: "qa_movie", wait: true, skippable: true }, "troop"), "not-executed-in-context");
    assertReason(listBadge({ kind: "text", body: "battle message" }, "troop"), "battle-message-only");
  });

  it("does not describe system audio metadata as executed in troop", () => {
    assertReason(listBadge(newM2Command("m2-027-change-system-bgm"), "troop"), "not-executed-in-context");
  });

  it("makes absent context explicit instead of claiming a proven map effect is incomplete", () => {
    const commandId = "m2-205-pathfind-move";
    expect(m2CommandRuntimeSupport(commandId)).toBe("runtime-partial");
    assertReason(pickerBadge(commandId), "context-unspecified");
    assertReason(listBadge(newM2Command(commandId)), "context-unspecified");
  });

  it("keeps persisted aliases distinct from native commands created by the picker", () => {
    expect(commandRuntimeSupport(newCommand("text"), "map")).toBe("runtime-full");
    assertReason(listBadge(newM2Command("m2-001-show-text"), "map"), "legacy-alias-not-equivalent");
  });

  it("identifies battle-only effects in a map without claiming the host UI is broken", () => {
    assertReason(listBadge(newM2Command("m2-098-change-enemy-hp"), "map"), "battle-context-required");
  });

  it("retains intentional editor-only commands without presenting them as unverified", () => {
    const badge = listBadge(newM2Command("m2-088-comment"), "map");
    expect(badge?.dataset.runtimeSupport).toBe("editor-only");
    assertReason(badge, "editor-only");
  });
});

describe("support repair boundaries", () => {
  it("preserves already-full weather and native movie support in map/common", () => {
    for (const context of ["map", "common"] as const) {
      expect(m2CommandRuntimeSupport("m2-050-set-weather-effects", context)).toBe("runtime-full");
      expect(commandRuntimeSupport(newCommand("playMovie"), context)).toBe("runtime-full");
    }
  });

  it("does not demote battle contracts being repaired in parallel", () => {
    for (const kind of ["choices", "gameOver", "killPlayer", "changeFriendship", "changeLevel"] as const) {
      expect(commandRuntimeSupport(newCommand(kind), "troop")).toBe("runtime-full");
    }
    for (const commandId of ["m2-105-abort-battle", "m2-107-force-escape"]) {
      expect(m2CommandRuntimeSupport(commandId, "troop")).toBe("runtime-full");
    }
  });
});

describe("descriptor ownership and context propagation", () => {
  it.each(["map", "common", "troop"] as const)("both renderers call the same descriptor with %s", (context) => {
    const spy = vi.spyOn(runtimeSupport, "commandRuntimeSupportDescriptor");
    const command = newM2Command("m2-027-change-system-bgm");
    const picker = pickerBadge(command.commandId, context);
    const list = listBadge(command, context);
    expect(spy).toHaveBeenCalledWith({ kind: "m2Command", commandId: command.commandId }, context);
    expect(spy).toHaveBeenCalledWith(command, context);
    const descriptor = runtimeSupport.commandRuntimeSupportDescriptor(command, context);
    expect(descriptor.support).toBe("runtime-partial");
    if (descriptor.support === "runtime-full") throw new Error("Expected a limited descriptor");
    for (const badge of [picker, list]) {
      assertReason(badge, descriptor.reasonCode);
      expect(badge.title).toBe(descriptor.tooltip);
      expect(badge.getAttribute("aria-label")).toBe(descriptor.label);
    }
  });

  it.each(["common", "troop"] as const)("database %s context reaches nested rows and the append picker", (context) => {
    const host = document.createElement("div");
    document.body.append(host);
    const commandId = "m2-210-sound-layer";
    renderDatabaseCommandListEditor(host, {
      commands: [{ kind: "fork", condition: { kind: "switch", switchId: "sw_0001", value: true }, then: [newM2Command(commandId)], else: [] }],
      pickerContext: context,
      replaceCommands: () => undefined,
    });
    const badge = host.querySelector<HTMLElement>(`[data-testid="command-runtime-badge-list-0-${FORK_THEN_BRANCH_INDEX}-0"]`);
    if (context === "common") expect(badge).toBeNull();
    else assertReason(badge, "not-executed-in-context");
    requiredElement(host, '[data-testid="event-command-empty-line"]').dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const button = requiredElement(document, `[data-command-entry="${commandId}"]`);
    expect(button.dataset.runtimeSupport).toBe(context === "common" ? "runtime-full" : "runtime-partial");
    if (context === "troop") assertReason(button.querySelector(".command-runtime-badge"), "not-executed-in-context");
  });
});

describe("runtime evidence for narrower troop descriptions", () => {
  function runBattle(commands: Command[], battleFlow: "gauge" | "strict") {
    const project = deserialize(JSON.stringify(battleFixture));
    const troop = project.database.troops.find((entry) => entry.id === "troop_slime");
    if (!troop) throw new Error("Missing battle fixture troop");
    troop.battleEventPages = [{
      id: "support_runtime", name: "Support runtime", span: "battle",
      conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
      commands: [...commands, { kind: "setVariable", variableId: "after_command", op: "=", value: 1 }],
    }];
    const runtime = createBattleRuntime({ project, troopId: troop.id, canEscape: true, canLose: true, battleFlow, rng: () => 0.99 });
    runtime.tick(1000);
    runtime.performActorCommand({ kind: "defend" });
    const snapshot = runtime.snapshot();
    expect(snapshot.eventLogs.some((log) => log.pageId === "support_runtime" && log.kind === "fired")).toBe(true);
    expect(snapshot.eventState.variables.after_command).toBe(1);
    return snapshot;
  }

  it.each(["gauge", "strict"] as const)("text actually renders a battle message, without sequential input in %s", (flow) => {
    const command = { kind: "text", speaker: "SUPPORT_SPEAKER", body: "SUPPORT_MESSAGE" } as const;
    const snapshot = runBattle([command], flow);
    const director = battleEventDirectorState(snapshot, { step: "command", lines: [] });
    const window = battleMessageWindow(director);
    expect(window.querySelector(".battle-message-line")?.textContent).toBe("SUPPORT_SPEAKER: SUPPORT_MESSAGE");
    expect(runtimeSupport.commandRuntimeSupportDescriptor(command, "troop")).toMatchObject({ support: "runtime-partial", reasonCode: "battle-message-only" });
  });

  it.each(["gauge", "strict"] as const)("face/settings/inputWait are metadata and wait does not suspend following commands in %s", (flow) => {
    for (const [kind, reasonCode] of narrowerTroop.filter(([kind]) => kind !== "text")) {
      const command = kind === "wait" ? { kind, ms: 10000 } as const : newCommand(kind);
      const snapshot = runBattle([command], flow);
      expect(snapshot.eventLogs.some((log) => log.pageId === "support_runtime" && log.kind === "message")).toBe(true);
      const director = battleEventDirectorState(snapshot, { step: "command", lines: [] });
      const window = battleMessageWindow(director);
      expect(window.querySelector("img")).toBeNull();
      expect(runtimeSupport.commandRuntimeSupportDescriptor(command, "troop")).toMatchObject({ support: "runtime-partial", reasonCode });
    }
  });

  it("every not-executed troop description corresponds to an actual unsupported execution", () => {
    const project = createBlankProject();
    const commands = [
      ...COMMAND_KINDS.filter((kind) => kind !== "m2Command").map((kind) => newCommand(kind)),
      ...M2_COMMAND_CATALOG.map((entry) => ({ kind: "m2Command", commandId: entry.id, fields: {} } as const)),
    ];
    const skipped = commands.filter((command) => {
      const descriptor = runtimeSupport.commandRuntimeSupportDescriptor(command, "troop");
      return descriptor.support !== "runtime-full" && descriptor.reasonCode === "not-executed-in-context";
    });
    expect(skipped.length).toBeGreaterThan(100);
    for (const command of skipped) {
      const state = { switches: {}, variables: {}, inventory: {} };
      const troop = project.database.troops[0];
      if (!troop) throw new Error("Missing default troop");
      const runtime = createBattleEventRuntime({
        project, troopRecord: { ...troop, battleEventPages: [{
          id: "support_skipped", name: "Skipped", conditions: [], span: "battle",
          commands: [command, { kind: "setVariable", variableId: "after", op: "=", value: 1 }],
        }] }, actors: [], enemies: [], stateIds: [], state,
      });
      runtime.applyTroopEvents({ turn: 0 });
      expect(runtime.logs().some((log) => log.kind === "unsupported"), JSON.stringify(command)).toBe(true);
      expect(runtime.snapshot().variables).toEqual({ after: 1 });
    }
  });
});
