/** @vitest-environment happy-dom */
import "./happyDomCanvas";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyCinematicCombo, resetMapMood } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { classifyMinimapEvent, mountFloatingMinimapHud } from "@/editor/panels/floatingMinimapHud";
import { createBlankProject } from "@/project/defaults";
import { COMBO_FLASHLIGHT_SOURCE_ID } from "@/project/postFx";
import { store } from "@/project/store";
import type { Command, GameEvent, LightingState, MapId } from "@/project/types";

function seed(): MapId {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId]!;
  map.width = 20;
  map.height = 15;
  map.lowerTiles = new Array(20 * 15).fill(0);
  map.upperTiles = new Array(20 * 15).fill(-1);
  map.events = [];
  store.replace(project);
  editorState.set({ currentMapId: mapId, tool: "paint", layer: "lower" });
  return mapId;
}

function event(name: string, commands: unknown[], pages?: { commands: unknown[] }[]): GameEvent {
  return { id: `ev-${name}`, name, x: 1, y: 1, commands: commands as Command[], ...(pages ? { pages } : {}) } as unknown as GameEvent;
}

const TRANSFER = { kind: "transfer", mapId: "elsewhere", x: 0, y: 0 };

describe("floating minimap event markers", () => {
  it("finds a transfer nested in a shop branch or battle outcome (same walk as the map link graph)", () => {
    expect(classifyMinimapEvent(event("상인", [{ kind: "shop", goods: [], transactionBranch: [TRANSFER] }]))).toBe("portal");
    expect(classifyMinimapEvent(event("문지기", [{ kind: "battleProcessing", victoryBranch: [TRANSFER] }]))).toBe("portal");
  });

  it("reads the outer command list even when the event has pages", () => {
    expect(classifyMinimapEvent(event("문", [TRANSFER], [{ commands: [] }]))).toBe("portal");
  });

  it("does not paint words that merely contain 적 as enemies", () => {
    for (const name of ["목적지 안내판", "흔적", "기적의 샘", "적힌 쪽지"]) {
      expect(classifyMinimapEvent(event(name, [])), name).toBe("npc");
    }
    for (const name of ["적 병사", "적_1", "슬라임", "산적 두목", "Boss"]) {
      expect(classifyMinimapEvent(event(name, [])), name).toBe("enemy");
    }
  });
});

describe("floating minimap thumbnail", () => {
  let dispose: (() => void) | null = null;
  let host: HTMLElement;

  beforeEach(() => {
    localStorage.removeItem("oprn:floating-minimap-collapsed");
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    dispose?.();
    dispose = null;
    host.remove();
  });

  const thumb = (): HTMLCanvasElement | null => host.querySelector<HTMLCanvasElement>("[data-testid='floating-minimap-thumb']");
  const collapse = (): void => host.querySelector<HTMLButtonElement>("[data-testid='floating-minimap-collapse']")!.click();

  it("redraws after tiles were edited while collapsed, even when the edit misses the first and middle cell", () => {
    const mapId = seed();
    dispose = mountFloatingMinimapHud(host);
    const before = thumb()!.dataset.thumbKey;
    expect(before).toBeTruthy();

    collapse();
    store.update((p) => { p.maps[mapId]!.lowerTiles[5] = 7; }, { scope: "map", mapId });
    collapse();

    expect(thumb()!.dataset.thumbKey).not.toBe(before);
  });

  it("keeps the same thumbnail canvas when a non-tile change (event added) leaves the picture unchanged", () => {
    const mapId = seed();
    dispose = mountFloatingMinimapHud(host);
    const before = thumb();
    store.update((p) => { p.maps[mapId]!.events.push(event("주민", []) as never); }, { scope: "map", mapId });
    expect(thumb()).toBe(before);
  });
});

describe("cinematic combos keep authored lighting and climate", () => {
  const TORCH = { id: "torch-1", at: { x: 3, y: 4 }, radius: 3, intensity: 1 } as unknown as LightingState["sources"][number];

  it("a combo without lighting leaves an authored night lighting with its torches alone", () => {
    const mapId = seed();
    store.update((p) => { p.maps[mapId]!.defaultLighting = { ambient: 0.55, color: "#101830", sources: [TORCH] }; }, { scope: "map", mapId });
    applyCinematicCombo(mapId, "octopath-dusk");
    expect(store.getCurrent().maps[mapId]!.defaultLighting).toEqual({ ambient: 0.55, color: "#101830", sources: [TORCH] });
  });

  it("turning a lighting combo off removes only its darkness and flashlight, never authored torches", () => {
    const mapId = seed();
    store.update((p) => { p.maps[mapId]!.defaultLighting = { ambient: 0, sources: [TORCH] }; }, { scope: "map", mapId });
    applyCinematicCombo(mapId, "flashlight-horror");
    const on = store.getCurrent().maps[mapId]!.defaultLighting!;
    expect(on.sources.map((s) => s.id)).toEqual(["torch-1", COMBO_FLASHLIGHT_SOURCE_ID]);

    applyCinematicCombo(mapId, "classic-clean");
    const off = store.getCurrent().maps[mapId]!.defaultLighting!;
    expect(off.ambient).toBe(0);
    expect(off.sources.map((s) => s.id)).toEqual(["torch-1"]);
  });

  it("reset keeps an indoor climate and is a single store update", () => {
    const mapId = seed();
    store.update((p) => {
      const map = p.maps[mapId]!;
      map.climate = { mode: "indoor" };
      map.postFx = { preset: "hd2d-warm" } as never;
      map.terrainDesign = { gameplay: { visionBlocking: true } } as never;
    }, { scope: "map", mapId });
    let updates = 0;
    const unsub = store.subscribe(() => { updates += 1; });
    resetMapMood(mapId);
    unsub();
    const map = store.getCurrent().maps[mapId]!;
    expect(updates).toBe(1);
    expect(map.climate).toEqual({ mode: "indoor" });
    expect(map.postFx).toBeUndefined();
    expect(map.terrainDesign?.gameplay?.visionBlocking ?? false).toBe(false);
  });
});
