/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import type { Command, Condition } from "@/project/types";
import { roundtripCommands, runCommandContract } from "../commandContracts/harness";
import {
  change, choicesFixture, forkFixture, inputFixture, loopFixture,
  node, pick, seedProject, seedRecords, variableCondition,
  type Timer,
} from "./U02.fixture";

// Real mounted bodies with clone-on-write hosts; same-kind edits remain mounted.
function mountStaged<T extends Command>(initial: T) {
  let current: Command = structuredClone(initial);
  const replace = vi.fn((_path: readonly number[], next: Command) => { current = structuredClone(next); });
  const context: CommandEditContext = {
    path: [], lockKind: true, getCurrentCommand: () => current,
    actions: {
      addCommand: vi.fn(), insertCommand: vi.fn(), replaceCommand: replace,
      deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn(),
    },
  };
  const body = renderCommandBody(context, initial);
  document.body.append(body);
  return { body, context, replace, current: () => current as T };
}

function openCommand<T extends Command>(initial: T) {
  const apply = vi.fn<(command: Command) => void>();
  openEventCommandEditDialog({ initial, onApply: apply });
  const body = node(document, "event-command-edit-dialog");
  return {
    body, apply,
    confirm: () => node(body, "event-command-edit-ok").click(),
    cancel: () => node(body, "event-command-edit-cancel").click(),
    saved: (): T => {
      const command = apply.mock.calls.at(-1)?.[0];
      if (!command) throw new Error("Confirm did not apply a command");
      return command as T;
    },
  };
}

beforeEach(() => { seedProject(); });
afterEach(() => {
  // Close real dialogs through their own disposal path, including custom selects.
  for (const cancel of [...document.querySelectorAll<HTMLElement>('[data-testid="app-modal-cancel"]')].reverse()) cancel.click();
  for (const ok of [...document.querySelectorAll<HTMLElement>('[data-testid="app-modal-confirm"]')].reverse()) ok.click();
  for (const cancel of [...document.querySelectorAll<HTMLElement>('[data-testid="event-command-edit-cancel"]')].reverse()) cancel.click();
  document.body.replaceChildren();
  resetModalStackForTest();
});

describe("U02 G1-F4 latest loop children and loop-owned breaks", () => {
  it("G1-F4 preserves text metadata through body edit, Confirm, parser and interpreter", () => {
    const source = loopFixture();
    const original = structuredClone(source);
    const dialog = openCommand(source);
    change(dialog.body, "event-loop-body-text-0", "Edited");
    dialog.confirm();
    const saved = dialog.saved();
    expect.soft(saved.body[0]).toEqual({ ...original.body[0], body: "Edited" });
    expect.soft(saved.body[1]).toEqual(original.body[1]);
    expect.soft(source).toEqual(original);
    const restored = roundtripCommands([saved]);
    expect.soft(restored).toEqual([saved]);
    // Execute just the edited text: the authored outer loop intentionally has no exit.
    const result = runCommandContract([saved.body[0]!]);
    expect(result.pauses[0]).toMatchObject({
      kind: "text", body: "Edited", speaker: "NPC", emotion: "happy", autoAdvance: true,
    });
  });

  it("G1-F4 nested-loop break does not hide the outer loop's warning", () => {
    const staged = mountStaged(loopFixture());
    expect(node(staged.body, "event-loop-no-break-warning").hidden).toBe(false);
  });

  it("G1-F4 counts a fork-owned break but not a nested loop-owned break", () => {
    const source = loopFixture();
    source.body.push({ kind: "fork", condition: { kind: "gold", op: ">=", amount: 0 }, then: [{ kind: "breakLoop" }] });
    const staged = mountStaged(source);
    expect(node(staged.body, "event-loop-no-break-warning").hidden).toBe(true);
  });

  it("G1-F4 patches the latest child and keeps an independently updated sibling", () => {
    const source = loopFixture();
    const staged = mountStaged(source);
    const latest = structuredClone(staged.current());
    const text = latest.body[0];
    if (text?.kind !== "text") throw new Error("Expected fixture text child");
    latest.body[0] = { ...text, speaker: "Updated NPC" };
    latest.body[1] = { kind: "loop", body: [{ kind: "text", body: "INDEPENDENT_CHILD_EDIT" }, { kind: "breakLoop" }] };
    staged.context.actions.replaceCommand([], latest);
    change(staged.body, "event-loop-body-text-0", "Edited");
    expect(staged.current().body).toEqual([{ ...latest.body[0], body: "Edited" }, latest.body[1]]);
  });

  it("G1-F4 exposes a full nested text editor, not only a lossy textarea", () => {
    const dialog = openCommand(loopFixture());
    const row = node(dialog.body, "event-loop-body-item-0");
    // No new selector contract: require either the existing full editor or an edit action.
    const fullEditor = row.querySelector('[data-testid="event-command-text-speaker"]');
    const editAction = row.querySelector<HTMLButtonElement>('button:not([data-testid="event-loop-body-delete-0"])');
    expect(Boolean(fullEditor || editAction)).toBe(true);
    if (fullEditor) {
      change(row, "event-command-text-speaker", "Edited NPC");
    } else {
      editAction!.click();
      const dialogs = document.querySelectorAll<HTMLElement>('[data-testid="event-command-edit-dialog"]');
      expect(dialogs).toHaveLength(2);
      const child = dialogs[1]!;
      change(child, "event-command-text-speaker", "Edited NPC");
      node(child, "event-command-edit-ok").click();
    }
    dialog.confirm();
    expect(dialog.saved().body[0]).toEqual({ ...loopFixture().body[0], speaker: "Edited NPC" });
  });

  it("G1-F4 parent Cancel never mutates the source nested commands", () => {
    const source = loopFixture();
    const original = structuredClone(source);
    const dialog = openCommand(source);
    change(dialog.body, "event-loop-body-text-0", "Discard me");
    dialog.cancel();
    expect(dialog.apply).not.toHaveBeenCalled();
    expect(source).toEqual(original);
    const reopened = openCommand(source);
    expect(node<HTMLTextAreaElement>(reopened.body, "event-loop-body-text-0").value).toBe("Original");
  });
});

describe("U02 G1-F5 latest condition callbacks", () => {
  it("G1-F5 retains <=50 when selecting another variable and preserves both branches", () => {
    const source = forkFixture();
    const original = structuredClone(source);
    const dialog = openCommand(source);
    const valueNode = node(dialog.body, "event-condition-variable-value");
    change(dialog.body, "event-condition-variable-op", "<=");
    change(dialog.body, "event-condition-variable-value", "50");
    expect(node(dialog.body, "event-condition-variable-value")).toBe(valueNode);
    pick(dialog.body, "event-condition-variable-target", "other");
    dialog.confirm();
    const saved = dialog.saved();
    expect.soft(saved.condition).toEqual({ kind: "variable", variableId: "other", op: "<=", value: 50 });
    expect.soft(saved.then).toEqual(original.then);
    expect.soft(saved.else).toEqual(original.else);
    expect.soft(source).toEqual(original);
    const restored = roundtripCommands([saved], seedRecords);
    const result = runCommandContract(restored, {
      mutateSession: session => { session.variables.reward = 25; session.variables.other = 40; },
    });
    expect(result.pauses[0]).toMatchObject({ kind: "text", body: "THEN" });
    // Both audited predicates happen to be true at 40. A second independent input
    // distinguishes the stale >=10 predicate from the intended <=50 predicate.
    const counterexample = runCommandContract(restored, { mutateSession: session => { session.variables.other = 5; } });
    expect(counterexample.pauses[0]).toMatchObject({ kind: "text", body: "THEN" });
  });

  it("G1-F5 updates the evaluation data when a same-kind edit flips the verdict", () => {
    // Preview uses startSession (variables default to zero), not runtime test state.
    const dialog = openCommand(forkFixture());
    expect(node(dialog.body, "event-condition-eval").dataset.evalOk).toBe("false");
    change(dialog.body, "event-condition-variable-op", "<=");
    change(dialog.body, "event-condition-variable-value", "50");
    expect(node(dialog.body, "event-condition-eval").dataset.evalOk).toBe("true");
  });

  it("G1-F5 switch target changes retain the latest false value", () => {
    const dialog = openCommand(forkFixture({ kind: "switch", switchId: "switch-a", value: true }));
    change(dialog.body, "event-condition-switch-value", "false");
    pick(dialog.body, "event-condition-switch-target", "switch-b");
    dialog.confirm();
    expect(dialog.saved().condition).toEqual({ kind: "switch", switchId: "switch-b", value: false });
  });

  it("G1-F5 actor target changes retain the latest absent state", () => {
    const dialog = openCommand(forkFixture({ kind: "actor", actorId: "actor-a", present: true }));
    change(dialog.body, "event-condition-actor-present", "false");
    pick(dialog.body, "event-condition-actor", "actor-b");
    dialog.confirm();
    expect(dialog.saved().condition).toEqual({ kind: "actor", actorId: "actor-b", present: false });
  });

  it.each(["all", "any", "not"] as const)("G1-F5 preserves latest nested variable edits inside %s", kind => {
    const child = variableCondition();
    const sibling: Condition = { kind: "switch", switchId: "switch-a", value: false };
    const condition: Condition = kind === "not" ? { kind, condition: child } : { kind, conditions: [child, sibling] };
    const dialog = openCommand(forkFixture(condition));
    change(dialog.body, "event-condition-variable-op", "<=");
    change(dialog.body, "event-condition-variable-value", "50");
    pick(dialog.body, "event-condition-variable-target", "other");
    dialog.confirm();
    const expected: Condition = { kind: "variable", variableId: "other", op: "<=", value: 50 };
    expect(dialog.saved().condition).toEqual(kind === "not" ? { kind, condition: expected } : { kind, conditions: [expected, sibling] });
  });

  it("G1-F5 does not import another dialog's inactive condition draft", () => {
    const first = openCommand(forkFixture({ kind: "variable", variableId: "reward", op: "!=", value: 917 }));
    change(first.body, "event-condition-mode", "gold");
    first.cancel();
    const second = openCommand(forkFixture({ kind: "gold", op: ">=", amount: 2 }));
    change(second.body, "event-condition-mode", "variable");
    // Inspect staged controls, not Confirm: a genuinely new variable condition is incomplete.
    expect(node<HTMLInputElement>(second.body, "event-condition-variable-value").value).toBe("0");
    const picker = node(second.body, "event-condition-variable-target").querySelector("select")!;
    expect(picker.value).toBe("");
  });
});

describe("U02 G1-F13 timer resume authoring", () => {
  it("G1-F13 changing timer identity preserves omitted seconds and resumes remaining 17", () => {
    const source: Timer = { kind: "timer", action: "start", timerId: "timer1" };
    const dialog = openCommand(source);
    change(dialog.body, "event-command-timer-id", "timer2");
    dialog.confirm();
    const saved = dialog.saved();
    expect.soft(saved).toEqual({ kind: "timer", action: "start", timerId: "timer2" });
    const restored = roundtripCommands([saved]);
    const result = runCommandContract(restored, { mutateSession: session => { session.timers.timer2 = 17; } });
    expect(result.session.timers.timer2).toBe(17);
    expect(source).not.toHaveProperty("seconds");
  });

  it.each([0, 60])("G1-F13 explicit start seconds %i stays an explicit restart", seconds => {
    const dialog = openCommand<Timer>({ kind: "timer", action: "start", timerId: "timer1", seconds });
    change(dialog.body, "event-command-timer-id", "timer2");
    dialog.confirm();
    expect(dialog.saved()).toEqual({ kind: "timer", action: "start", timerId: "timer2", seconds });
    const result = runCommandContract([dialog.saved()], { mutateSession: session => { session.timers.timer2 = 17; } });
    expect(result.session.timers.timer2).toBe(seconds);
  });

  it("G1-F13 stop does not expose an active seconds editor", () => {
    const staged = mountStaged<Timer>({ kind: "timer", action: "stop", timerId: "timer2" });
    const seconds = staged.body.querySelector<HTMLInputElement>('[data-testid="event-command-timer-seconds"]');
    expect(seconds === null || seconds.disabled || seconds.hidden || Boolean(seconds.closest("[hidden]"))).toBe(true);
  });

  it("G1-F13 set and stop retain their interpreter semantics", () => {
    const result = runCommandContract([
      { kind: "timer", action: "set", timerId: "timer2", seconds: 17 },
      { kind: "timer", action: "stop", timerId: "timer2" },
    ]);
    expect(result.session.timers.timer2).toBe(17);
    expect(result.pauses).toMatchObject([{ action: "set", seconds: 17 }, { action: "stop", seconds: undefined }]);
  });
});

describe("U02 G1-F14 choice branch identity and deletion safety", () => {
  it("G1-F14 asks before deleting a nonempty branch and preserves the draft pending consent", () => {
    const source = choicesFixture();
    const staged = mountStaged(source);
    node(staged.body, "event-choice-remove-1").click();
    expect.soft(staged.current()).toEqual(source);
    expect(document.querySelector('[data-testid="app-confirm-modal"]')).not.toBeNull();
  });

  it("G1-F14 deleting an empty predecessor keeps cancel destination B and branch bytes", () => {
    const source = choicesFixture();
    // Isolate identity from the separate nonempty-branch confirmation regression.
    source.options[0]!.branch = [];
    const original = structuredClone(source);
    const dialog = openCommand(source);
    node(dialog.body, "event-choice-remove-1").click();
    dialog.confirm();
    const saved = dialog.saved();
    expect.soft(saved.options).toEqual(original.options.slice(1));
    expect.soft(saved.cancelBranch).toEqual(original.cancelBranch);
    expect.soft(saved.cancelBehavior).toBe("choice1");
    expect.soft(source).toEqual(original);
    expect(roundtripCommands([saved])).toEqual([saved]);
    // Interpreter consumes the index already resolved by dialogue, not raw Escape.
    const index = Number(saved.cancelBehavior?.replace("choice", "")) - 1;
    const result = runCommandContract([saved], { answers: [index] });
    expect(result.pauses[1]).toMatchObject({ kind: "text", body: "MARKER_B" });
  });

  it("G1-F14 removing an empty row restores focus to the adjacent surviving text input", () => {
    const source = choicesFixture();
    source.options[0]!.branch = [];
    const dialog = openCommand(source);
    const remove = node(dialog.body, "event-choice-remove-1");
    remove.focus();
    remove.click();
    expect(document.activeElement === node(dialog.body, "event-choice-option-1")).toBe(true);
  });

  it("G1-F14 deleting the cancel destination does not silently retarget another branch", () => {
    const staged = mountStaged(choicesFixture());
    node(staged.body, "event-choice-remove-2").click();
    // Author must be able to cancel deletion / explicitly choose a replacement policy.
    expect(staged.current().options.map(option => option.text)).toEqual(["A", "B", "C"]);
  });

  it("G1-F14 keeps inactive cancel-branch bytes and enforces five options", () => {
    const source = choicesFixture();
    const dialog = openCommand(source);
    const disallow = node<HTMLInputElement>(dialog.body, "event-choice-cancel-disallow");
    disallow.checked = true;
    disallow.dispatchEvent(new Event("change", { bubbles: true }));
    node(dialog.body, "event-choice-add").click();
    node(dialog.body, "event-choice-add").click();
    expect(node<HTMLButtonElement>(dialog.body, "event-choice-add").disabled).toBe(true);
    dialog.confirm();
    expect(dialog.saved().options).toHaveLength(5);
    expect(dialog.saved().cancelBranch).toEqual(source.cancelBranch);
  });
});

describe("U02 G1-F15 explicit input-number destination and scoped Confirm validity", () => {
  it("G1-F15 rendering an empty destination never stages the first variable", () => {
    const source = inputFixture();
    const staged = mountStaged(source);
    expect.soft(staged.replace).not.toHaveBeenCalled();
    expect(staged.current().variableId).toBe("");
  });

  it.each(["", "deleted-variable"])("G1-F15 Confirm blocks unresolved destination %j without applying", variableId => {
    const dialog = openCommand(inputFixture(variableId));
    change(dialog.body, "input-number-prompt", "Code");
    dialog.confirm();
    expect.soft(dialog.apply).not.toHaveBeenCalled();
    expect(dialog.body.isConnected).toBe(true);
  });

  it("G1-F15 an empty variable catalog cannot be confirmed", () => {
    const project = seedProject();
    project.variables = [];
    // Store normalization restores definitions referenced by the saved session.
    project.session.variables = {};
    store.replace(project);
    expect(store.getCurrent().variables).toEqual([]);
    const dialog = openCommand(inputFixture());
    dialog.confirm();
    expect(dialog.apply).not.toHaveBeenCalled();
  });

  it("G1-F15 explicit answer survives prompt, digits, keypad, parser and input resume", () => {
    const source = inputFixture();
    const original = structuredClone(source);
    const dialog = openCommand(source);
    change(dialog.body, "input-number-prompt", "Code");
    pick(dialog.body, "input-number-variable", "answer");
    // happy-dom MouseEvent label activation incorrectly also clicks chip 1.
    // Exercise the real chip callback without that emulated default action.
    node(dialog.body, "input-number-digit-chip-3").dispatchEvent(new Event("click", { bubbles: true }));
    expect.soft(node<HTMLInputElement>(dialog.body, "input-number-digits").value, "digit mirror after chip change").toBe("3");
    const pad = node<HTMLInputElement>(dialog.body, "input-number-show-pad");
    pad.checked = false;
    pad.dispatchEvent(new Event("change", { bubbles: true }));
    dialog.confirm();
    const saved = dialog.saved();
    expect.soft(saved).toEqual({ kind: "inputNumber", variableId: "answer", digits: 3, prompt: "Code" });
    const restored = roundtripCommands([saved], seedRecords);
    const result = runCommandContract(restored, {
      answers: [42], mutateSession: session => { session.variables.first = 91; session.variables.answer = 92; },
    });
    expect(result.session.variables).toMatchObject({ first: 91, answer: 42 });
    expect(source).toEqual(original);
  });

  it("G1-F15 Cancel with an unresolved destination never applies a command", () => {
    const source = inputFixture();
    const original = structuredClone(source);
    const dialog = openCommand(source);
    change(dialog.body, "input-number-prompt", "Discard");
    dialog.cancel();
    expect(dialog.apply).not.toHaveBeenCalled();
    expect(source).toEqual(original);
  });

  it("G1-F15 scoped validation must keep the existing weighted-branch guard", () => {
    const dialog = openCommand({ kind: "m2Command", commandId: "m2-211-weighted-branch", fields: { table: "a=1\nb=1", resultVariableId: "answer" } });
    const chance = node<HTMLInputElement>(dialog.body, "weighted-branch-chance-0");
    chance.value = "101";
    chance.dispatchEvent(new Event("input", { bubbles: true }));
    dialog.confirm();
    expect(dialog.apply).not.toHaveBeenCalled();
    expect(dialog.body.isConnected).toBe(true);
    expect(document.activeElement === chance).toBe(true);
  });
});

// Subscribe before consent, then await the exact mounted state transition.
function observeDom(predicate: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!predicate()) return;
      observer.disconnect(); clearTimeout(timeout); resolve();
    });
    const timeout = setTimeout(() => { observer.disconnect(); reject(new Error("Expected form transition did not occur")); }, 2000);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  });
}

describe("U02 consent and inactive-draft edge regressions", () => {
  it("G1-F4 child Cancel and parent Cancel preserve independent source bytes", () => {
    const source = loopFixture();
    const snapshot = structuredClone(source);
    const parent = openCommand(source);
    change(parent.body, "event-loop-body-text-0", "Parent draft");
    node(parent.body, "event-loop-body-edit-0").click();
    const child = document.querySelectorAll<HTMLElement>('[data-testid="event-command-edit-dialog"]')[1]!;
    change(child, "event-command-text-speaker", "Discard child");
    node(child, "event-command-edit-cancel").click();
    expect(node<HTMLTextAreaElement>(parent.body, "event-loop-body-text-0").value).toBe("Parent draft");
    parent.cancel();
    expect(source).toEqual(snapshot);
    expect(parent.apply).not.toHaveBeenCalled();
  });

  it.each(["all", "any", "not"] as const)("G1-F5 keeps latest inactive leaf draft through nested %s mode changes", kind => {
    const leaf = variableCondition();
    const condition: Condition = kind === "not" ? { kind, condition: leaf } : { kind, conditions: [leaf] };
    const dialog = openCommand(forkFixture(condition));
    change(dialog.body, "event-condition-variable-value", "731");
    const mode = dialog.body.querySelectorAll<HTMLSelectElement>('[data-testid="event-condition-mode"]')[1]!;
    mode.value = "gold"; mode.dispatchEvent(new Event("change"));
    const nextMode = dialog.body.querySelectorAll<HTMLSelectElement>('[data-testid="event-condition-mode"]')[1]!;
    nextMode.value = "variable"; nextMode.dispatchEvent(new Event("change"));
    expect(node<HTMLInputElement>(dialog.body, "event-condition-variable-value").value).toBe("731");
    dialog.confirm();
    const expected: Condition = { kind: "variable", variableId: "reward", op: ">=", value: 731 };
    expect(dialog.saved().condition).toEqual(kind === "not" ? { kind, condition: expected } : { kind, conditions: [expected] });
  });

  it("G1-F13 resume omits inactive seconds while switching back restores the seconds draft", () => {
    const dialog = openCommand<Timer>({ kind: "timer", timerId: "timer1", action: "start", seconds: 60 });
    change(dialog.body, "event-command-timer-seconds", "23");
    change(dialog.body, "event-command-timer-start-mode", "resume");
    change(dialog.body, "event-command-timer-action", "stop");
    change(dialog.body, "event-command-timer-action", "start");
    expect(node<HTMLInputElement>(dialog.body, "event-command-timer-seconds").disabled).toBe(true);
    change(dialog.body, "event-command-timer-start-mode", "restart");
    expect(node<HTMLInputElement>(dialog.body, "event-command-timer-seconds").value).toBe("23");
    change(dialog.body, "event-command-timer-start-mode", "resume");
    dialog.confirm();
    expect(dialog.saved()).toEqual({ kind: "timer", timerId: "timer1", action: "start" });
  });

  it("G1-F14 cancel consent retains A; accept removes only A and focuses B", async () => {
    const source = choicesFixture();
    const dialog = openCommand(source);
    node(dialog.body, "event-choice-remove-1").click();
    const canceled = observeDom(() => !document.querySelector('[data-testid="app-confirm-modal"]'));
    node(document, "app-modal-cancel").click();
    await canceled;
    expect(node<HTMLInputElement>(dialog.body, "event-choice-option-1").value).toBe("A");
    node(dialog.body, "event-choice-remove-1").click();
    const removed = observeDom(() => node<HTMLInputElement>(dialog.body, "event-choice-option-1").value === "B");
    node(document, "app-modal-confirm").click();
    await removed;
    expect(document.activeElement).toBe(node(dialog.body, "event-choice-option-1"));
    dialog.confirm();
    expect(dialog.saved()).toEqual({ ...source, options: source.options.slice(1), cancelBehavior: "choice1" });
  });
});
