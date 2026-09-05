// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { numberField, selectField, sliderStepperField, textField } from "@/editor/panels/databaseControls";

afterEach(() => {
  document.body.replaceChildren();
});

function inputIn(field: HTMLElement, type = "number"): HTMLInputElement {
  const input = field.querySelector(`input[type="${type}"]`);
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing ${type} input`);
  return input;
}

function visibleCaption(field: HTMLElement): HTMLElement {
  const caption = field.firstElementChild;
  if (!(caption instanceof HTMLElement)) throw new Error("Missing field caption");
  return caption.querySelector("label") ?? caption;
}

function nativeLabel(input: HTMLInputElement | HTMLSelectElement): HTMLLabelElement {
  const label = input.labels?.item(0);
  if (!label) throw new Error("Missing native input label");
  return label;
}

describe("database numeric label trust", () => {
  it("forwards maximum HP caption activation to the input without committing a decrement", () => {
    const commit = vi.fn();
    const field = numberField("Maximum HP", "db-field-enemy-max-hp", 18, commit, { min: 1, max: 99999 });
    document.body.append(field);
    const input = inputIn(field);
    const activate = vi.fn();
    input.addEventListener("click", activate);

    visibleCaption(field).click();

    expect(input.value).toBe("18");
    expect(commit).not.toHaveBeenCalled();
    expect(activate).toHaveBeenCalledTimes(1);
    // happy-dom forwards label clicks but does not implement their native focus default.
    // The native control association is the browser focus contract; browser QA owns activeElement.
    expect(nativeLabel(input).control).toBe(input);
  });

  it("names the numeric input from its visible label without labelling or nesting the buttons", () => {
    const name = "Maximum HP";
    const field = numberField(name, "hp", 18, vi.fn());
    document.body.append(field);
    const input = inputIn(field);
    const label = nativeLabel(input);

    expect(input.labels).toHaveLength(1);
    expect(label.control).toBe(input);
    expect(label.textContent).toBe(name);
    expect(visibleCaption(field).textContent).toBe(name);
    expect(field.querySelector("label button")).toBeNull();
    expect(field.matches(".db-field")).toBe(true);
    expect(field.children).toHaveLength(2);
    expect(field.children.item(1)?.matches(".db-number-stepper")).toBe(true);
    expect(input.parentElement?.children.item(1)).toBe(input);
    expect(input.dataset.testid).toBe("hp");
    for (const button of field.querySelectorAll("button")) {
      expect(button.labels).toHaveLength(0);
      expect(button.getAttribute("aria-label")).toContain(name);
    }
  });

  it.each([
    { suffix: "dec", next: 17 },
    { suffix: "inc", next: 19 },
  ])("commits one intentional $suffix click through the existing input event path", ({ suffix, next }) => {
    const commit = vi.fn();
    const field = numberField("Maximum HP", "hp", 18, commit, { min: 1, max: 99 });
    document.body.append(field);
    const input = inputIn(field);
    const inputEvent = vi.fn();
    input.addEventListener("input", inputEvent);
    const button = field.querySelector(`[data-testid="hp-${suffix}"]`);
    if (!(button instanceof HTMLButtonElement)) throw new Error("Missing stepper button");

    button.click();

    expect(input.value).toBe(String(next));
    expect(commit.mock.calls).toEqual([[next]]);
    expect(inputEvent).toHaveBeenCalledTimes(1);
  });

  it("keeps disabled numeric fields named and inert for caption and button clicks", () => {
    const name = "Maximum HP";
    const reason = "Inherited value";
    const commit = vi.fn();
    const field = numberField(name, "hp", 18, commit, undefined, { disabled: true, disabledReason: reason });
    document.body.append(field);
    const input = inputIn(field);

    visibleCaption(field).click();
    for (const button of field.querySelectorAll("button")) {
      expect(button.disabled).toBe(true);
      button.click();
    }

    expect(input.disabled).toBe(true);
    expect(input.title).toBe(reason);
    expect(input.value).toBe("18");
    expect(commit).not.toHaveBeenCalled();
    expect(nativeLabel(input).control).toBe(input);
    expect(nativeLabel(input).textContent).toBe(name);
  });

  it("names both slider inputs from the caption and activates only the numeric input", () => {
    const name = "Knockback resistance";
    const commit = vi.fn();
    const field = sliderStepperField(name, "resist", 25, commit, { min: 0, max: 100, step: 5, unit: "%" });
    document.body.append(field);
    const input = inputIn(field);
    const range = inputIn(field, "range");
    const activate = vi.fn();
    input.addEventListener("click", activate);

    visibleCaption(field).click();

    const label = nativeLabel(input);
    expect(label.control).toBe(input);
    expect(label.textContent).toBe(name);
    expect(label.contains(range)).toBe(false);
    expect(range.getAttribute("aria-labelledby")).toBe(label.id);
    expect(document.getElementById(label.id)).toBe(label);
    expect(label.id).not.toBe("");
    expect(input.value).toBe("25");
    expect(range.value).toBe("25");
    expect(commit).not.toHaveBeenCalled();
    expect(activate).toHaveBeenCalledTimes(1);
    expect(input.dataset.testid).toBe("resist-stepper");
    expect(range.dataset.testid).toBe("resist-slider");
    expect(field.children.item(1)?.matches(".db-slider-stepper")).toBe(true);
  });

  it.each(["number", "slider"])("keeps two detached %s instances independently labelled despite identical testids", (kind) => {
    const commits = [vi.fn(), vi.fn()];
    const fields = commits.map((commit) => kind === "number"
      ? numberField("Maximum HP", "same-id", 18, commit)
      : sliderStepperField("Maximum HP", "same-id", 18, commit, { min: 0, max: 100, step: 1 }));
    document.body.append(...fields);
    const inputs = fields.map((field) => inputIn(field));
    const activations = inputs.map((input) => {
      const activate = vi.fn();
      input.addEventListener("click", activate);
      return activate;
    });

    for (const [index, field] of fields.entries()) {
      visibleCaption(field).click();
      expect(activations[index]).toHaveBeenCalledTimes(1);
      const input = inputIn(field);
      expect(nativeLabel(input).control).toBe(input);
      expect(field.contains(nativeLabel(input))).toBe(true);
      expect(input.value).toBe("18");
      expect(commits[index]).not.toHaveBeenCalled();
      if (kind === "slider") {
        expect(inputIn(field, "range").getAttribute("aria-labelledby")).toBe(nativeLabel(input).id);
      }
    }
    for (const activate of activations) expect(activate).toHaveBeenCalledTimes(1);
    const ids = Array.from(document.querySelectorAll("[id]"), (node) => node.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("preserves native implicit labels and callbacks for simple text and select fields", () => {
    const name = "Record name";
    const textCommit = vi.fn();
    const selectCommit = vi.fn();
    const text = textField(name, "name", "Slime", textCommit);
    const select = selectField(name, "kind", "a", [{ id: "a", name: "A" }, { id: "b", name: "B" }], selectCommit);
    document.body.append(text, select);
    const input = inputIn(text, "text");
    const picker = select.querySelector("select");
    if (!picker) throw new Error("Missing select");

    for (const [field, control] of [[text, input], [select, picker]] as const) {
      visibleCaption(field).click();
      expect(nativeLabel(control)).toBe(field);
      expect(nativeLabel(control).control).toBe(control);
      expect(visibleCaption(field).textContent).toBe(name);
    }
    expect(textCommit).not.toHaveBeenCalled();
    expect(selectCommit).not.toHaveBeenCalled();
    input.value = "Bat";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    picker.value = "b";
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    expect(textCommit.mock.calls).toEqual([["Bat"]]);
    expect(selectCommit.mock.calls).toEqual([["b"]]);
  });
});
