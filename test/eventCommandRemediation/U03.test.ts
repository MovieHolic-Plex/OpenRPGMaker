import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { editorState } from "@/editor/editorState";
import { replaceEventPageCommandAt } from "@/editor/eventPages";
import * as mapTileDraw from "@/editor/mapTileDraw";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { openTransferPlayerDialog, renderTransferPicker } from "@/editor/panels/eventEditor/transferPlayerDialog";
import * as transferPreview from "@/editor/panels/eventEditor/transferMapPreview";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { flushFakeAnimationFrames, installFakeDom } from "../fakeDom";
import { buildFixture, EVENT_ID, MAP_A, MAP_B, PAGE_ID, storedTransfer, target } from "./U03.fixture";

let restoreDom: () => void;
let fixture: { project: ReturnType<typeof buildFixture>; initial: ReturnType<typeof storedTransfer> };
let draws: MockInstance<typeof transferPreview.drawTransferMapPreview>;

function control<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing U03 control: ${id}`);
  return node;
}

// Await the actual preview render promises, not elapsed time or polling.
async function finishRenders(): Promise<void> {
  flushFakeAnimationFrames();
  await Promise.all(draws.mock.results.map(result => {
    if (result.type === "throw") throw result.value;
    return result.value;
  }));
}

async function open(initial: Command = fixture.initial) {
  const apply = vi.fn((command: Command) => {
    replaceEventPageCommandAt(MAP_A, EVENT_ID, PAGE_ID, [0], command);
  });
  openEventCommandEditDialog({ initial, onApply: apply });
  await finishRenders();
  return apply;
}

function selectRadio(id: string): void {
  const input = control<HTMLInputElement>(id);
  // fakeDom does not implement the native radio-group default action.
  for (const radio of document.querySelectorAll<HTMLInputElement>("input")) {
    if (radio.getAttribute("name") === input.getAttribute("name")) radio.checked = radio === input;
  }
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function clickTile(x: number, y: number): void {
  const canvas = control<HTMLCanvasElement>("transfer-player-map-preview");
  const map = fixture.project.maps[MAP_B]!;
  expect(canvas.width).toBe(map.width * map.tileSize);
  expect(canvas.height).toBe(map.height * map.tileSize);
  // Supply layout only; the real picker owns CSS-to-map coordinate conversion.
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 20, top: 30, x: 20, y: 30, width: canvas.width / 2, height: canvas.height / 2,
    right: 20 + canvas.width / 2, bottom: 30 + canvas.height / 2, toJSON: () => ({}),
  });
  const event = new Event("click", { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: 20 + (x + 0.5) * map.tileSize / 2 },
    clientY: { value: 30 + (y + 0.5) * map.tileSize / 2 },
  });
  canvas.dispatchEvent(event);
}

beforeEach(() => {
  restoreDom = installFakeDom({ animationFrames: "manual" });
  resetModalStackForTest();
  const project = buildFixture();
  fixture = { project, initial: structuredClone(storedTransfer(project)) };
  store.replace(fixture.project, { preserveEventDrafts: false });
  editorState.set({ currentMapId: MAP_A, selectedEventId: EVENT_ID, selectedEventPageId: PAGE_ID });
  // Image decoding is outside this regression. Keep the real preview setup,
  // picker, staged command, Confirm callback, page replacement, and IO intact.
  vi.spyOn(mapTileDraw, "loadTilesetImage").mockImplementation(async () => document.createElement("canvas"));
  draws = vi.spyOn(transferPreview, "drawTransferMapPreview");
});

afterEach(async () => {
  document.querySelector<HTMLElement>('[data-testid="event-command-edit-cancel"]')?.click();
  await finishRenders();
  document.body.replaceChildren();
  resetModalStackForTest();
  vi.restoreAllMocks();
  restoreDom();
});

describe("U03/G1-F20 transfer liveApply regression", () => {
  it("G1-F20 accepts the authored fixture and transition through real serialization", () => {
    expect(storedTransfer(deserialize(serialize(fixture.project)))).toEqual(fixture.initial);
  });

  it("G1-F20 restores A after A->B->A, then Confirm and reload retain A and transition", async () => {
    const apply = await open();
    control(`transfer-player-map-${MAP_B}`).click();
    expect(control(`transfer-player-map-${MAP_B}`).classList.contains("selected")).toBe(true);
    control(`transfer-player-map-${MAP_A}`).click();
    expect(control(`transfer-player-map-${MAP_A}`).classList.contains("selected")).toBe(true);
    expect(storedTransfer(store.getCurrent())).toEqual(fixture.initial);
    expect(apply).not.toHaveBeenCalled();
    control("event-command-edit-ok").click();
    expect(apply).toHaveBeenCalledTimes(1);
    const stored = storedTransfer(store.getCurrent());
    const reloaded = storedTransfer(deserialize(serialize(store.getCurrent())));
    expect.soft(target(stored), "stored target must be A, not stale B").toEqual(target(fixture.initial));
    expect.soft(stored.transition, "stored authored transition").toBe("fade");
    expect.soft(target(reloaded), "reloaded target must be A").toEqual(target(fixture.initial));
    expect.soft(reloaded.transition, "reloaded authored transition").toBe("fade");
  });

  it("G1-F20 patches a direction edit without losing untouched target, fade, or transition", async () => {
    await open();
    selectRadio("transfer-player-direction-up");
    control("event-command-edit-ok").click();
    const stored = storedTransfer(store.getCurrent());
    expect(target(stored)).toEqual({ ...target(fixture.initial), direction: "up" });
    expect.soft(stored.transition, "direction edit retains optional transition").toBe("fade");
    expect.soft(storedTransfer(deserialize(serialize(store.getCurrent()))).transition).toBe("fade");
  });

  it.each(["fade", "mosaic", "blinds"] as const)("G1-F20 standalone Confirm preserves authored %s transition", async (transition) => {
    const apply = vi.fn();
    openTransferPlayerDialog({ command: { ...fixture.initial, transition }, onApply: apply });
    await finishRenders();
    selectRadio("transfer-player-direction-up");
    expect(apply).not.toHaveBeenCalled();
    control("transfer-player-ok").click();
    expect(apply).toHaveBeenCalledExactlyOnceWith({ ...fixture.initial, direction: "up", transition });
  });

  it("G1-F20 commits distinct valid nondefault coordinates, direction, and fade", async () => {
    const apply = await open(target(fixture.initial));
    control(`transfer-player-map-${MAP_B}`).click();
    await finishRenders();
    clickTile(7, 6);
    selectRadio("transfer-player-direction-right");
    selectRadio("transfer-player-fade-white");
    control("event-command-edit-ok").click();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(storedTransfer(deserialize(serialize(store.getCurrent())))).toEqual({
      kind: "transfer", mapId: MAP_B, x: 7, y: 6, direction: "right", fade: "white",
    });
  });

  it("G1-F20 keeps one outer Confirm authority and isolates live edits on Cancel", async () => {
    const apply = await open();
    control(`transfer-player-map-${MAP_B}`).click();
    selectRadio("transfer-player-direction-up");
    selectRadio("transfer-player-fade-none");
    expect(document.querySelectorAll('[data-testid="event-command-edit-ok"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="transfer-player-cancel"]')).toHaveLength(0);
    // Existing inline completion, if retained, must never commit to the page.
    document.querySelector<HTMLElement>('[data-testid="transfer-player-ok"]')?.click();
    expect(apply).not.toHaveBeenCalled();
    expect(storedTransfer(store.getCurrent())).toEqual(fixture.initial);
    control("event-command-edit-cancel").click();
    expect(apply).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="event-command-edit-dialog"]')).toBeNull();
    expect(storedTransfer(deserialize(serialize(store.getCurrent())))).toEqual(fixture.initial);
  });

  it("G1-F20 characterizes no-op initial open and Confirm without changing authored values", async () => {
    const apply = await open();
    expect(apply).not.toHaveBeenCalled();
    expect(storedTransfer(store.getCurrent())).toEqual(fixture.initial);
    control("event-command-edit-ok").click();
    expect(apply).toHaveBeenCalledExactlyOnceWith(fixture.initial);
    expect(storedTransfer(deserialize(serialize(store.getCurrent())))).toEqual(fixture.initial);
  });

  it("G1-F20 seeds an incomplete empty mapId from the editor map before Confirm", async () => {
    await open({ ...fixture.initial, mapId: "" });
    expect(control(`transfer-player-map-${MAP_A}`).classList.contains("selected")).toBe(true);
    control("event-command-edit-ok").click();
    expect(storedTransfer(deserialize(serialize(store.getCurrent())))).toEqual(fixture.initial);
  });

  it("G1-F20 characterizes missing-map fallback to the first available picker map", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const apply = vi.fn();
    renderTransferPicker(host, {
      command: { ...target(fixture.initial), mapId: "missing-map" },
      liveApply: true, hideFooter: true, onApply: apply,
    }, () => undefined);
    await finishRenders();
    expect(control(`transfer-player-map-${MAP_A}`).classList.contains("selected")).toBe(true);
    expect(apply).toHaveBeenLastCalledWith(target(fixture.initial));
  });

  it("G1-F20 characterizes an empty map collection: no rows and inert canvas selection", async () => {
    store.replace({ ...fixture.project, maps: {}, startMapId: "" });
    const host = document.createElement("div");
    document.body.append(host);
    const apply = vi.fn();
    renderTransferPicker(host, {
      command: { kind: "transfer", mapId: "", x: 0, y: 0 },
      liveApply: true, hideFooter: true, onApply: apply,
    }, () => undefined);
    await finishRenders();
    expect(host.querySelectorAll(".transfer-player-map-row")).toHaveLength(0);
    const emissionsOnOpen = apply.mock.calls.length;
    control("transfer-player-map-preview").click();
    expect(apply).toHaveBeenCalledTimes(emissionsOnOpen);
  });
});
