import type { CommandKind } from "@/project/commandKindRegistry";
import type { Command } from "@/project/types";

export type AuthoringMutationCase = {
  readonly mode: "mutation";
  readonly kind: CommandKind;
  readonly expected: Command;
  readonly apply: (body: HTMLElement) => void;
  readonly clearAfterRender?: boolean;
};

export type AuthoringBoundaryCase = {
  readonly mode: "boundary";
  readonly kind: CommandKind;
  readonly testId: string;
  readonly tagName: string;
};

export type AuthoringCase = AuthoringMutationCase | AuthoringBoundaryCase;

export function setControlValue(
  root: HTMLElement,
  testId: string,
  value: string,
  eventType: "change" | "input" = "change"
): void {
  const control = requireTestElement(root, testId);
  if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
    throw new Error(`${testId} is not a value control`);
  }
  control.value = value;
  control.dispatchEvent(new Event(eventType, { bubbles: true }));
}

export function setNestedSelectValue(
  root: HTMLElement,
  testId: string,
  value: string
): void {
  const select = requireTestElement(root, testId).querySelector("select");
  if (!(select instanceof HTMLSelectElement)) throw new Error(`${testId} has no select`);
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export function setControlChecked(root: HTMLElement, testId: string, checked: boolean): void {
  const control = requireTestElement(root, testId);
  if (!(control instanceof HTMLInputElement)) throw new Error(`${testId} is not an input`);
  control.checked = checked;
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

export function clickControl(root: HTMLElement, testId: string): void {
  const control = requireTestElement(root, testId);
  if (!(control instanceof HTMLButtonElement)) throw new Error(`${testId} is not a button`);
  control.click();
}

export function requireTestElement(root: HTMLElement, testId: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(`[data-testid='${testId}']`);
  if (element) return element;
  throw new Error(`missing authoring control: ${testId}`);
}
