/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDatabaseResourcePickerDialog, resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { playAudioBodyForTest } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { renderMapProps } from "@/editor/panels/mapProps";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { audioCommandContext } from "./support/audioSearchFixture";

const MIDI = "easyrpg-music-battle-1";
const WAV = "cc0-music-field-loop";
function node<T extends HTMLElement>(id: string): T {
  const result = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!result) throw new Error(`Missing ${id}`);
  return result;
}
function choose(id: string, value: string): void {
  const select = node<HTMLSelectElement>(id);
  select.value = value;
  select.dispatchEvent(new Event("change"));
}
beforeEach(() => {
  store.replace(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId });
});
afterEach(() => {
  // Close through the real dialog lifecycle to dispose modal/store subscriptions.
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-testid$="-cancel"]')) button.click();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("unsupported MIDI authoring", () => {
  it("disables MIDI candidates in the shared picker but assigns supported audio", () => {
    const confirm = vi.fn();
    openDatabaseResourcePickerDialog({ kind: "music", title: "BGM", onConfirm: confirm });
    expect(node<HTMLButtonElement>(`db-resource-picker-option-${MIDI}`).disabled).toBe(true);
    node<HTMLButtonElement>(`db-resource-picker-option-${WAV}`).click();
    expect(node<HTMLButtonElement>("db-resource-picker-ok").disabled).toBe(false);
    node<HTMLButtonElement>("db-resource-picker-ok").click();
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ resourceId: WAV }));
  });

  it("keeps a legacy selection inspectable without confirming or rewriting it", () => {
    const confirm = vi.fn();
    openDatabaseResourcePickerDialog({ kind: "music", title: "BGM", currentId: MIDI, onConfirm: confirm });
    expect(node("db-resource-picker-preview").textContent).toContain(MIDI);
    expect(node("db-resource-picker-preview").querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
    expect(node<HTMLButtonElement>("db-resource-picker-ok").disabled).toBe(true);
    node<HTMLButtonElement>("db-resource-picker-ok").click();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("guards the confirmation callback even for a synthetic activation", () => {
    const confirm = vi.fn();
    openDatabaseResourcePickerDialog({ kind: "music", title: "BGM", currentId: MIDI, onConfirm: confirm });
    node("db-resource-picker-ok").dispatchEvent(new Event("click"));
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each(["music", "sound"] as const)("blocks the shared %s text-input application path", kind => {
    const change = vi.fn();
    document.body.append(resourcePickerControl({ label: "Audio", resourceId: WAV, kind, testid: "audio-field", onChange: change, rerender: () => {} }));
    const input = node<HTMLInputElement>("audio-field");
    input.value = MIDI;
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new Event("change"));
    expect(change).not.toHaveBeenCalled();
    expect(input.value).toBe(WAV);
    input.value = "cc0-sound-ui-confirm";
    input.dispatchEvent(new Event("change"));
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ resourceId: "cc0-sound-ui-confirm" }));
  });

  for (const currentId of ["", MIDI]) {
    it.each(["native", "m2"] as const)(`blocks new MIDI in %s dropdowns while preserving current ${currentId || "empty"}`, surface => {
      const replace = vi.fn();
      const body = surface === "native"
        ? playAudioBodyForTest(audioCommandContext(replace), { kind: "playAudio", resourceId: currentId, loop: true })
        : renderM2CommandBody(audioCommandContext(replace), { kind: "m2Command", commandId: "m2-027-change-system-bgm", fields: { resourceId: currentId, volume: 100 } });
      if (!body) throw new Error("Missing command body");
      document.body.append(body);
      const id = surface === "native" ? "play-audio-resource-select" : "m2-command-resourceId-picker";
      const select = node<HTMLSelectElement>(id);
      expect(select.value).toBe(currentId);
      expect(replace).not.toHaveBeenCalled();
      expect([...select.options].find(option => option.value === MIDI)?.disabled).toBe(true);
      choose(id, MIDI);
      expect(replace).not.toHaveBeenCalled();
      expect(select.value).toBe(currentId);
      if (surface === "native") {
        const search = node<HTMLInputElement>("play-audio-search");
        search.value = "no-match-probe";
        search.dispatchEvent(new Event("input"));
        if (currentId) expect(select.selectedOptions[0]?.disabled).toBe(true);
        search.value = "";
        search.dispatchEvent(new Event("input"));
      }
      choose(id, WAV);
      expect(replace).toHaveBeenLastCalledWith([0], expect.objectContaining(surface === "native"
        ? { resourceId: WAV } : { fields: expect.objectContaining({ resourceId: WAV }) }));
      choose(id, MIDI);
      expect(select.value).toBe(WAV);
      expect(replace).toHaveBeenCalledTimes(1);
    });
  }

  it("preserves legacy map BGM during inspection and assigns supported BGM through its picker", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId]!;
    map.bgm = { mode: "custom", resourceId: MIDI, fadeInMs: 700 };
    const host = document.createElement("div");
    document.body.append(host);
    renderMapProps(host);
    node<HTMLButtonElement>("map-bgm-resource-set").click();
    expect(node("map-bgm-resource-dialog-preview").textContent).toContain(MIDI);
    expect(node<HTMLButtonElement>("map-bgm-resource-dialog-ok").disabled).toBe(true);
    node<HTMLButtonElement>("map-bgm-resource-dialog-cancel").click();
    expect(store.getCurrent().maps[map.id]?.bgm).toEqual({ mode: "custom", resourceId: MIDI, fadeInMs: 700 });
    node<HTMLButtonElement>("map-bgm-resource-set").click();
    node<HTMLButtonElement>(`map-bgm-resource-dialog-option-${WAV}`).click();
    node<HTMLButtonElement>("map-bgm-resource-dialog-ok").click();
    expect(store.getCurrent().maps[map.id]?.bgm).toEqual({ mode: "custom", resourceId: WAV, fadeInMs: 700 });
  });
});
