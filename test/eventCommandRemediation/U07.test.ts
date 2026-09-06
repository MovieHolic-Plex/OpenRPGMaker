/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { asset, buildFixture, CALLBACK_CASES, command, MAP_A, MAP_B, PNG, registerAsset, SWITCH, VARIABLE, type M2 } from "./U07.fixture";

function control<T extends HTMLElement = HTMLElement>(id: string, host: ParentNode = document): T {
  const node = host.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing U07 control: ${id}`);
  return node;
}
function change(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
function open(initial: M2) {
  let saved = structuredClone(initial);
  const apply = vi.fn((next: Command) => {
    if (next.kind !== "m2Command") throw new Error("Expected staged M2 command");
    saved = next;
  });
  openEventCommandEditDialog({ initial, onApply: apply });
  return { apply, saved: () => saved };
}

// Real form, with the dialog's staging boundary observed rather than mocked.
function mount(initial: M2) {
  let staged = structuredClone(initial);
  const listeners = new Set<(next: M2) => void>();
  const unexpected = () => { throw new Error("Unexpected list action in U07"); };
  const context: CommandEditContext = {
    path: [], getCurrentCommand: () => staged,
    actions: {
      addCommand: unexpected, insertCommand: unexpected, deleteCommand: unexpected,
      moveCommand: unexpected, moveCommandTo: unexpected,
      replaceCommand: (_path, next) => {
        if (next.kind !== "m2Command") throw new Error("Expected staged M2 command");
        staged = structuredClone(next);
        for (const listener of listeners) listener(staged);
      },
    },
  };
  const root = renderM2CommandBody(context, staged);
  if (!root) throw new Error("Missing M2 form");
  document.body.append(root);
  return {
    root, staged: () => staged,
    // Subscribe BEFORE generation; timeout bounds the exact event, never polls.
    nextStage: () => new Promise<M2>((resolve, reject) => {
      const done = (next: M2) => { clearTimeout(timeout); listeners.delete(done); resolve(next); };
      const timeout = setTimeout(() => { listeners.delete(done); reject(new Error("No staged callback after AI insertion")); }, 3000);
      listeners.add(done);
    }),
  };
}
function expectResource(host: ParentNode, selectId: string, previewId: string, expectedId: string): void {
  const select = control<HTMLSelectElement>(selectId, host);
  expect.soft(select.value, "native selection").toBe(expectedId);
  // Read live option.selected: happy-dom caches selectedOptions across value assignments.
  expect.soft(Array.from(select.options).filter(option => option.selected).map(option => option.value), "explicit selected option").toEqual([expectedId]);
  const url = resolveAssetResourceUrl(expectedId, { project: store.getCurrent() });
  expect(url, "registered asset resolves before preview assertion").not.toBeNull();
  const preview = control(previewId, host);
  if (previewId === "change-actor-faceset-face-preview") {
    // Bust faces use a CSS background with role=img, not an HTML img.
    expect.soft(preview.querySelector<HTMLElement>('[role="img"]')?.style.backgroundImage).toBe(`url("${url}")`);
    expect.soft(preview.querySelector<HTMLElement>('[data-testid="event-command-face-crop-shell"]')?.dataset.resourceId).toBe(expectedId);
  } else {
    expect.soft(preview.querySelector("img")?.getAttribute("src"), "preview image follows selected asset").toBe(url);
  }
}

beforeEach(() => {
  document.body.replaceChildren();
  resetModalStackForTest();
  store.replace(buildFixture(), { preserveEventDrafts: false });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request in U07"); }));
});
afterEach(() => {
  document.body.replaceChildren();
  resetModalStackForTest();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("U07 existing form callback selection", () => {
  it.each(CALLBACK_CASES)("$finding $kind late-registered picker result survives Confirm and reopen", entry => {
    const old = asset(entry.kind, "old");
    const added = asset(entry.kind, "new");
    const dialog = open(command(entry.index, { target: store.getCurrent().database.actors[0]!.id, value: old.id }));
    const select = control<HTMLSelectElement>(`${entry.prefix}-resource-select`);
    expectResource(document, `${entry.prefix}-resource-select`, entry.preview, old.id);
    expect(Array.from(select.options, option => option.value)).not.toContain(added.id);
    registerAsset(added); // After form construction, before opening the real picker.
    expect(resolveAssetResourceUrl(added.id, { project: store.getCurrent() })).toBe(added.dataUrl);
    control(`${entry.prefix}-resource-picker`).click();
    control(`db-resource-picker-option-${added.id}`).click();
    control("db-resource-picker-ok").click();
    expectResource(document, `${entry.prefix}-resource-select`, entry.preview, added.id);
    expect(control(`${entry.prefix}-resource-select`)).toBe(select);
    expect(dialog.apply).not.toHaveBeenCalled();
    control("event-command-edit-ok").click();
    expect(dialog.apply).toHaveBeenCalledTimes(1);
    expect.soft(dialog.saved().fields.value, "confirmed callback ID").toBe(added.id);
    if (entry.index === 69) expect.soft(dialog.saved().fields.resourceId).toBe(added.id);
    open(dialog.saved());
    expectResource(document, `${entry.prefix}-resource-select`, entry.preview, added.id);
    control("event-command-edit-cancel").click();
  });
  it.each(CALLBACK_CASES)("$finding $kind missing resource remains explicit and Cancel discards selection", entry => {
    const missing = `u07-missing-${entry.kind}`;
    const initial = command(entry.index, { target: store.getCurrent().database.actors[0]!.id, value: missing });
    const dialog = open(initial);
    const select = control<HTMLSelectElement>(`${entry.prefix}-resource-select`);
    expect(resolveAssetResourceUrl(missing, { project: store.getCurrent() })).toBeNull();
    expect(select.value).toBe(missing);
    expect(Array.from(select.options).filter(option => option.selected).map(option => option.value)).toEqual([missing]);
    change(select, asset(entry.kind, "old").id);
    control("event-command-edit-cancel").click();
    expect(dialog.apply).not.toHaveBeenCalled();
    expect(dialog.saved()).toEqual(initial);
  });
  it.each(CALLBACK_CASES.filter(entry => entry.kind !== "charset"))("$finding $kind AI result uses real queue, insertion, store and staged callback", async entry => {
    const form = mount(command(entry.index, { target: store.getCurrent().database.actors[0]!.id, value: asset(entry.kind, "old").id }));
    const before = new Set(Object.keys(store.getCurrent().assets.uploaded));
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url).endsWith("/images/generations")).toBe(true);
      expect(init?.method).toBe("POST");
      return new Response(JSON.stringify({ image: { dataUrl: PNG, mimeType: "image/png" } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(form.root.isConnected).toBe(true);
    const signal = form.nextStage();
    control<HTMLInputElement>(`${entry.prefix}-ai-prompt`, form.root).value = `U07 ${entry.kind} generated image`;
    control(`${entry.prefix}-ai-generate`, form.root).click();
    const staged = await signal;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const added = Object.values(store.getCurrent().assets.uploaded).filter(resource => !before.has(resource.id));
    expect(added).toHaveLength(1);
    const resource = added[0]!;
    expect(resource.kind).toBe(entry.kind);
    expect(resource.dataUrl).toBe(PNG);
    expect(store.getCurrent().resourceProfiles.some(profile => profile.assetId === resource.id)).toBe(true);
    expect.soft(staged.fields.value, "real onInserted stages registered ID").toBe(resource.id);
    if (entry.index === 69) expect.soft(staged.fields.resourceId).toBe(resource.id);
    expectResource(form.root, `${entry.prefix}-resource-select`, entry.preview, resource.id);
    form.root.remove();
    const dialog = open(staged);
    control("event-command-edit-ok").click();
    expect.soft(dialog.saved().fields.value).toBe(resource.id);
  });
});

describe("U07 generic selection identity", () => {
  it("G2-F15/G3-F24/G4-F11 resource A->B->A->B updates name and image without remount", () => {
    const a = asset("backdrop", "old");
    const b = asset("backdrop", "new");
    registerAsset(b);
    const dialog = open(command(102, { resourceId: a.id }));
    const select = control<HTMLSelectElement>("m2-command-resourceId-picker");
    const trigger = select.parentElement!.querySelector<HTMLButtonElement>(".event-custom-select-trigger")!;
    expect(trigger).not.toBeNull();
    for (const resource of [b, a, b]) {
      trigger.focus();
      change(select, resource.id);
      expect(control("m2-command-resourceId-picker")).toBe(select);
      expect(document.activeElement).toBe(trigger);
      expect(select.parentElement!.querySelector(".event-custom-select-trigger")).toBe(trigger);
      expectResource(document, "m2-command-resourceId-picker", "m2-command-resourceId-preview", resource.id);
      expect.soft(control("m2-command-resourceId-selected-name").textContent).toBe(resource.name);
      expect.soft(control("m2-command-resourceId-preview").dataset.resourceId).toBe(resource.id);
    }
    control("event-command-edit-ok").click();
    expect(dialog.saved().fields.resourceId).toBe(b.id);
    const reopened = open(dialog.saved());
    expectResource(document, "m2-command-resourceId-picker", "m2-command-resourceId-preview", b.id);
    control("event-command-edit-cancel").click();
    expect(reopened.apply).not.toHaveBeenCalled();
  });
  it.each([203, 74])("G3-F24/G4-F11 command %s map card follows record and survives unrelated zero edit", index => {
    const dialog = open(command(index, { mapId: MAP_A, x: 7, y: 9 }));
    const select = control<HTMLSelectElement>("m2-command-mapId-record-select");
    const trigger = select.parentElement!.querySelector<HTMLButtonElement>(".event-custom-select-trigger")!;
    expect(trigger).not.toBeNull();
    for (const id of [MAP_B, MAP_A, MAP_B]) {
      trigger.focus();
      change(select, id);
      expect(control("m2-command-mapId-record-select")).toBe(select);
      expect(document.activeElement).toBe(trigger);
      expect(select.parentElement!.querySelector(".event-custom-select-trigger")).toBe(trigger);
      expect(select.options[select.selectedIndex]?.value).toBe(id);
      expect.soft(control("m2-command-mapId-record-selected-name").textContent).toBe(store.getCurrent().maps[id]!.name);
    }
    change(control<HTMLInputElement>("m2-command-x-input"), "0");
    control("event-command-edit-ok").click();
    expect(dialog.saved().fields).toMatchObject({ mapId: MAP_B, x: 0, y: 9 });
  });
  it.each([
    { index: 217, key: "variableId", record: VARIABLE },
    { index: 207, key: "switchId", record: SWITCH },
  ])("G4-F11 valid $key resolves authored record on first render", ({ index, key, record }) => {
    const form = mount(command(index, { [key]: record.id }));
    expect(control<HTMLSelectElement>(`m2-command-${key}-record-select`, form.root).value).toBe(record.id);
    expect.soft(control(`m2-command-${key}-record-selected-name`, form.root).textContent).toBe(record.name);
  });
  it("G3-F24 recordPickerWithPreview retains missing actor through unrelated resource change", () => {
    const missing = "u07-missing-actor-91";
    const form = mount(command(24, { target: missing, value: asset("charset", "old").id }));
    const select = control<HTMLSelectElement>("change-actor-graphic-actor-select", form.root);
    expect.soft(select.value).toBe(missing);
    expect.soft(Array.from(select.options).filter(option => option.selected).map(option => option.value)).toEqual([missing]);
    change(control<HTMLSelectElement>("change-actor-graphic-resource-select", form.root), asset("charset", "old").id);
    expect.soft(form.staged().fields.target).toBe(missing);
  });
  it.each(["", "u07-missing-resource-88"])("G2-F15/G3-F24 generic resource preserves explicit empty/missing '%s'", id => {
    const dialog = open(command(102, { resourceId: id }));
    const select = control<HTMLSelectElement>("m2-command-resourceId-picker");
    expect(select.value).toBe(id);
    expect(Array.from(select.options).filter(option => option.selected).map(option => option.value)).toEqual([id]);
    expect(control("m2-command-resourceId-preview").dataset.empty).toBe("true");
    expect(control("m2-command-resourceId-preview").dataset.resourceId).toBe(id);
    expect(control("m2-command-resourceId-preview").querySelector("img")).toBeNull();
    control("event-command-edit-ok").click();
    expect(dialog.saved().fields.resourceId).toBe(id);
  });
});

describe("U07 G4-F13 accessible field association", () => {
  it.each([
    { index: 213, key: "slotId", testid: "m2-command-slotId-input", value: "manual-7" },
    { index: 214, key: "message", testid: "m2-command-message-textarea", value: "Authored message 29" },
    { index: 214, key: "durationMs", testid: "m2-command-durationMs-input", value: "0" },
    { index: 213, key: "restoreOnGameOver", testid: "m2-command-restoreOnGameOver-checkbox", value: "false" },
    { index: 217, key: "variableId", testid: "m2-command-variableId-record-open", value: VARIABLE.id },
    { index: 203, key: "mapId", testid: "m2-command-mapId-record-select", value: MAP_B },
  ])("$testid labels target unique mounted controls in simultaneous forms", ({ index, key, testid, value }) => {
    const first = mount(command(index, { variableId: VARIABLE.id, mapId: MAP_A }));
    const second = mount(command(index, { variableId: VARIABLE.id, mapId: MAP_A }));
    const inputs = [first, second].map(form => control<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>(testid, form.root));
    for (const input of inputs) {
      const label = input.closest(".field")?.querySelector("label");
      expect(label, "authored field has a visible label").not.toBeNull();
      expect.soft(label?.control === input, "label.control is actual input/trigger, not wrapper").toBe(true);
      expect.soft(input.id.length, "nonempty association ID").toBeGreaterThan(0);
      if (input.id) expect.soft(document.querySelectorAll(`[id="${input.id}"]`).length).toBe(1);
    }
    expect.soft(inputs[0]!.id === inputs[1]!.id, "repeated fields need distinct IDs").toBe(false);
    const input = inputs[0]!;
    const untouched = structuredClone(second.staged());
    if (input instanceof HTMLButtonElement) return; // Association above targets actual modal trigger.
    if (input instanceof HTMLInputElement && input.type === "checkbox") {
      input.closest(".field")!.querySelector("label")!.click();
      expect.soft(input.checked, "label activation toggles only its checkbox").toBe(false);
      expect.soft(first.staged().fields[key]).toBe(false);
    } else {
      change(input, value);
      expect(first.staged().fields[key]).toBe(input instanceof HTMLInputElement && input.type === "number" ? Number(value) : value);
    }
    expect(second.staged()).toEqual(untouched);
  });
});
