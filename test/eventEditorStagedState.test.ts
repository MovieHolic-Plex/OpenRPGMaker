import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { shopBody } from "@/editor/panels/eventEditor/commandBodyCommerce";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { conditionForm } from "@/editor/panels/eventEditor/conditionForm";
import type { CommandEditContext, CommandListActions } from "@/editor/panels/eventEditor/types";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, Condition } from "@/project/types";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

type M2Command = Extract<Command, { kind: "m2Command" }>;

function stagedContext(initial: Command): {
  readonly context: CommandEditContext;
  readonly current: () => Command;
} {
  let staged = structuredClone(initial);
  const actions: CommandListActions = {
    addCommand: vi.fn(),
    insertCommand: vi.fn(),
    replaceCommand: (_path, command) => {
      staged = structuredClone(command);
    },
    deleteCommand: vi.fn(),
    moveCommand: vi.fn(),
    moveCommandTo: vi.fn(),
  };
  return {
    context: { path: [], actions, getCurrentCommand: () => staged },
    current: () => staged,
  };
}

function change(node: FakeElement | null, value: string): void {
  expect(node).not.toBeNull();
  if (!node) return;
  node.value = value;
  node.dispatchEvent(new Event("change"));
}

function pickerSelect(root: FakeElement | null): FakeElement | null {
  return (root?.querySelector("select") as FakeElement | null) ?? null;
}

function execute(command: M2Command) {
  const project = store.getCurrent();
  const session = startSession(project);
  const entry = m2CommandById(command.commandId);
  expect(entry).toBeTruthy();
  if (!entry) return session;
  executeM2RuntimeCommand(session, entry, command, { project });
  return session;
}

describe("event command staged-state regressions", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => restoreDom?.());

  it("keeps consecutive shop settings instead of restoring the render-time command", () => {
    const initial = {
      kind: "shop",
      itemIds: [],
      allowSell: true,
      quantityMode: "single",
      shopType: "normal",
      messageType: "welcome",
      merchantGold: 100,
      branchOnTransaction: false,
      transactionBranch: [],
    } satisfies Command;
    const staged = stagedContext(initial);
    const body = renderWithFakeDom(() => shopBody(staged.context, initial));

    findByTestId(body, "shop-tab-rules")!.click();
    change(findByTestId(body, "shop-quantity-mode"), "select");
    change(findByTestId(body, "shop-merchant-gold"), "777");
    change(findByTestId(body, "shop-type-select"), "buyOnly");
    findByTestId(body, "shop-tab-messages")!.click();
    change(findByTestId(body, "shop-message-type"), "direct");

    expect(staged.current()).toMatchObject({
      kind: "shop",
      quantityMode: "select",
      shopType: "buyOnly",
      messageType: "direct",
      merchantGold: 777,
    });
  });

  it("keeps prompt, option text, and cancel behavior across consecutive choice edits", () => {
    const initial = {
      kind: "choices",
      options: [
        { text: "A", branch: [] },
        { text: "B", branch: [] },
      ],
      cancelBehavior: "choice2",
    } satisfies Command;
    const staged = stagedContext(initial);
    const body = renderWithFakeDom(() => renderCommandBody(staged.context, initial));

    change(findByTestId(body, "event-choice-prompt"), "Question");
    const option = findByTestId(body, "event-choice-option-1");
    expect(option).not.toBeNull();
    if (option) {
      option.value = "A2";
      option.dispatchEvent(new Event("input"));
    }
    const cancel = findByTestId(body, "event-choice-cancel-disallow");
    expect(cancel).not.toBeNull();
    if (cancel) {
      cancel.checked = true;
      cancel.dispatchEvent(new Event("change"));
    }

    expect(staged.current()).toMatchObject({
      kind: "choices",
      prompt: "Question",
      options: [{ text: "A2" }, { text: "B" }],
      cancelBehavior: "disallow",
    });
  });

  it("keeps a changed fork condition when enabling else", () => {
    const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
    const initial = {
      kind: "fork",
      condition: { kind: "switch", switchId, value: true },
      then: [{ kind: "text", body: "then" }],
    } satisfies Command;
    const staged = stagedContext(initial);
    const body = renderWithFakeDom(() => renderCommandBody(staged.context, initial));

    change(findByTestId(body, "event-condition-switch-value"), "false");
    const elseToggle = findByTestId(body, "event-fork-else-enabled");
    expect(elseToggle).not.toBeNull();
    if (elseToggle) {
      elseToggle.checked = true;
      elseToggle.dispatchEvent(new Event("change"));
    }

    expect(staged.current()).toMatchObject({
      kind: "fork",
      condition: { kind: "switch", switchId, value: false },
      then: [{ kind: "text", body: "then" }],
      else: [],
    });
  });

  it("keeps consecutive child edits in all/any condition groups", () => {
    const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
    let current: Condition = {
      kind: "all",
      conditions: [
        { kind: "switch", switchId, value: true },
        { kind: "switch", switchId, value: true },
      ],
    };
    const body = renderWithFakeDom(() => conditionForm(current, (next) => { current = next; }));
    const selects = body.querySelectorAll('[data-testid="event-condition-switch-value"]') as unknown as FakeElement[];
    expect(selects).toHaveLength(2);
    change(selects[0] ?? null, "false");
    change(selects[1] ?? null, "false");
    expect(current).toMatchObject({
      kind: "all",
      conditions: [{ value: false }, { value: false }],
    });
  });

  it("renders an added group child and keeps consecutive sibling edits", () => {
    const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
    let current: Condition = {
      kind: "all",
      conditions: [
        { kind: "switch", switchId, value: true },
        { kind: "switch", switchId, value: true },
      ],
    };
    const body = renderWithFakeDom(() => conditionForm(current, (next) => { current = next; }));
    const add = findByTestId(body, "event-condition-group-add");
    expect(add).not.toBeNull();
    add?.dispatchEvent(new Event("click"));

    const selects = body.querySelectorAll('[data-testid="event-condition-switch-value"]') as unknown as FakeElement[];
    expect(selects).toHaveLength(3);
    change(selects[2] ?? null, "false");
    change(selects[0] ?? null, "false");
    expect(current).toMatchObject({
      kind: "all",
      conditions: [{ value: false }, { value: true }, { value: false }],
    });
  });

  it("rerenders a group child after changing its condition kind", () => {
    const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
    let current: Condition = {
      kind: "all",
      conditions: [{ kind: "switch", switchId, value: true }],
    };
    const body = renderWithFakeDom(() => conditionForm(current, (next) => { current = next; }));

    const modes = body.querySelectorAll('[data-testid="event-condition-mode"]') as unknown as FakeElement[];
    expect(modes).toHaveLength(2);
    change(modes[1] ?? null, "gold");
    expect(findByTestId(body, "event-condition-gold-amount")).not.toBeNull();
    change(findByTestId(body, "event-condition-gold-amount"), "250");
    change(findByTestId(body, "event-condition-gold-op"), ">=");

    expect(current).toMatchObject({
      kind: "all",
      conditions: [{ kind: "gold", amount: 250, op: ">=" }],
    });
  });

  it("accumulates consecutive generic M2 field changes", () => {
    const initial: M2Command = {
      kind: "m2Command",
      commandId: "m2-201-camera-control",
      fields: { mode: "pan", x: 10, y: 12 },
    };
    const staged = stagedContext(initial);
    const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
    change(findByTestId(body, "m2-command-x-input"), "99");
    change(findByTestId(body, "m2-command-y-input"), "88");
    expect(staged.current()).toMatchObject({ fields: { x: 99, y: 88 } });
  });

  it("keeps consecutive Change Parameters edits on the latest staged command", () => {
    const initial: M2Command = {
      kind: "m2Command",
      commandId: "m2-014-change-parameters",
      fields: { target: "party", parameter: "maxHp", operation: "add", value: 1 },
    };
    const staged = stagedContext(initial);
    const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);

    change(findByTestId(body, "change-parameters-operation"), "remove");
    const afterOperation = staged.current() as M2Command;
    staged.context.actions.replaceCommand([], {
      ...afterOperation,
      fields: { ...afterOperation.fields, stagedBetweenEdits: "keep" },
    });
    change(findByTestId(body, "change-parameters-value-input"), "7");

    expect(staged.current()).toMatchObject({
      fields: { operation: "remove", value: 7, stagedBetweenEdits: "keep" },
    });
  });

  it("keeps consecutive Weighted Branch edits on the latest staged command", () => {
    const resultVariableId = store.getCurrent().variables[0]?.id ?? "var_result";
    const initial: M2Command = {
      kind: "m2Command",
      commandId: "m2-211-weighted-branch",
      fields: { table: "성공=1\n실패=1", resultVariableId: "" },
    };
    const staged = stagedContext(initial);
    const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);

    const label = findByTestId(body, "weighted-branch-label-0");
    expect(label).not.toBeNull();
    if (label) {
      label.value = "대성공";
      label.dispatchEvent(new Event("input"));
    }
    const afterLabel = staged.current() as M2Command;
    staged.context.actions.replaceCommand([], {
      ...afterLabel,
      fields: { ...afterLabel.fields, stagedBetweenEdits: "keep" },
    });
    change(findByTestId(body, "weighted-branch-chance-0"), "75");

    expect(staged.current()).toMatchObject({
      fields: {
        table: "대성공=75\n실패=25",
        stagedBetweenEdits: "keep",
      },
    });
  });
});

describe("Page 3 rich form canonical runtime fields", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => restoreDom?.());

  it("moves to variable location with canonical variable field ids", () => {
    const variables = store.getCurrent().variables;
    const mapVar = variables[0]?.id ?? "var_map";
    const xVar = variables[1]?.id ?? "var_x";
    const yVar = variables[2]?.id ?? "var_y";
    const initial: M2Command = { kind: "m2Command", commandId: "m2-037-move-to-variable-location", fields: {} };
    const staged = stagedContext(initial);
    const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
    change(pickerSelect(findByTestId(body, "move-to-variable-location-map-variable")), mapVar);
    change(pickerSelect(findByTestId(body, "move-to-variable-location-x-variable")), xVar);
    change(pickerSelect(findByTestId(body, "move-to-variable-location-y-variable")), yVar);

    const command = staged.current() as M2Command;
    expect(command.fields).toMatchObject({ mapVariableId: mapVar, xVariableId: xVar, yVariableId: yVar });
    expect(command.fields).not.toHaveProperty("mapId");
    const session = startSession(store.getCurrent());
    session.variables[mapVar] = 7;
    session.variables[xVar] = 4;
    session.variables[yVar] = 5;
    const entry = m2CommandById(command.commandId)!;
    executeM2RuntimeCommand(session, entry, command, { project: store.getCurrent() });
    expect(session.m2Runtime?.map.move_to_variable_location).toMatchObject({ mapId: "7", x: 4, y: 5 });
  });

  it("stores boarded and executes vehicle off", () => {
    const initial: M2Command = { kind: "m2Command", commandId: "m2-038-get-on-off-vehicle", fields: { enabled: "true" } };
    const staged = stagedContext(initial);
    const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
    change(findByTestId(body, "get-on-off-vehicle-enabled"), "false");
    const command = staged.current() as M2Command;
    expect(command.fields).toMatchObject({ boarded: "false" });
    expect(command.fields).not.toHaveProperty("enabled");
    const session = execute(command);
    expect(session.m2Runtime?.system.vehicle_boarded).toBe(false);
  });

  it("stores vehicle and updates the selected vehicle location", () => {
    const mapId = store.getCurrent().startMapId;
    const initial: M2Command = {
      kind: "m2Command",
      commandId: "m2-039-set-vehicle-location",
      fields: { target: "boat", mapId, x: 3, y: 4 },
    };
    const staged = stagedContext(initial);
    const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
    change(findByTestId(body, "set-vehicle-location-vehicle"), "ship");
    const command = staged.current() as M2Command;
    expect(command.fields).toMatchObject({ vehicle: "ship", mapId, x: 3, y: 4 });
    expect(command.fields).not.toHaveProperty("target");
    const session = execute(command);
    expect(session.m2Runtime?.map.vehicle_ship).toMatchObject({ mapId, x: 3, y: 4 });
  });

  it("stores eventA/eventB and executes the selected swap", () => {
    const initial: M2Command = {
      kind: "m2Command",
      commandId: "m2-041-swap-event-location",
      fields: { target: "old-a", value: "old-b" },
    };
    const staged = stagedContext(initial);
    const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
    change(findByTestId(body, "swap-event-location-event-a"), "event-a");
    change(findByTestId(body, "swap-event-location-event-b"), "event-b");
    const command = staged.current() as M2Command;
    expect(command.fields).toMatchObject({ eventA: "event-a", eventB: "event-b" });
    expect(command.fields).not.toHaveProperty("target");
    const session = execute(command);
    expect(session.m2Runtime?.events._swap.value).toBe("event-a<->event-b");
  });

  it("keeps runtime compatibility with legacy rich-form aliases", () => {
    const project = store.getCurrent();
    const session = startSession(project);
    session.variables["7"] = 9;
    session.variables["4"] = 6;
    session.variables["5"] = 8;
    const command: M2Command = {
      kind: "m2Command",
      commandId: "m2-037-move-to-variable-location",
      fields: { mapId: "7", x: 4, y: 5 },
    };
    executeM2RuntimeCommand(session, m2CommandById(command.commandId)!, command, { project });
    expect(session.m2Runtime?.map.move_to_variable_location).toMatchObject({ mapId: "9", x: 6, y: 8 });
  });
});
