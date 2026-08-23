import { TILE_FRAME_COUNT } from "@/assets/bundled";
import { CHIPSET_SLICING } from "@/assets/easyrpgRtp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderTilesetProperties } from "@/editor/panels/tilesetSettingsProperties";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function firstTilesetId(): string {
  const id = Object.keys(store.getCurrent().tilesets)[0];
  if (!id) throw new Error("blank project needs a tileset");
  return id;
}

function renderProps(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const tileset = store.getCurrent().tilesets[firstTilesetId()];
  if (!tileset) throw new Error("missing tileset");
  const rerender = (): void => {
    host.replaceChildren();
    host.append(renderTilesetProperties(store.getCurrent().tilesets[tileset.id] ?? tileset, rerender));
  };
  rerender();
  return host;
}

describe("tileset graphic picker", () => {
  it("enables browse and writes a bundled chipset id from the picker", () => {
    const host = renderProps();
    const browse = findByTestId(host, "tileset-oprn-graphic-browse");
    if (!browse) throw new Error("missing browse");
    expect(browse.disabled).toBe(false);
    expect(browse.textContent).toBe("설정...");

    browse.dispatchEvent(new Event("click"));
    const option = document.body.querySelector("[data-testid='tileset-graphic-option-tex_easyrpg_chipset_dungeon']");
    if (!option) throw new Error("missing dungeon chipset option");
    option.dispatchEvent(new Event("click"));

    const tileset = store.getCurrent().tilesets[firstTilesetId()];
    expect(tileset?.image).toEqual({
      type: "bundled",
      id: "tex_easyrpg_chipset_dungeon",
    });
    expect(tileset?.count).toBe(TILE_FRAME_COUNT);
    expect(tileset?.tilesPerRow).toBe(CHIPSET_SLICING.columns);
    expect(tileset?.passability).toHaveLength(TILE_FRAME_COUNT);
  });

  it("ignores a same-id pick without snapshotting", () => {
    const id = firstTilesetId();
    store.update((project) => {
      const tileset = project.tilesets[id];
      if (tileset) tileset.image = { type: "bundled", id: "tex_easyrpg_chipset_dungeon" };
    });
    const before = structuredClone(store.getCurrent().tilesets[id]);
    const host = renderProps();
    findByTestId(host, "tileset-oprn-graphic-browse")?.dispatchEvent(new Event("click"));
    document.body
      .querySelector("[data-testid='tileset-graphic-option-tex_easyrpg_chipset_dungeon']")
      ?.dispatchEvent(new Event("click"));
    expect(store.getCurrent().tilesets[id]).toEqual(before);
  });

  it("lists uploaded tileset/chipset, skips picture, and remaps uploaded geometry", () => {
    const id = firstTilesetId();
    store.update((project) => {
      project.assets.uploaded = {
        ...(project.assets.uploaded ?? {}),
        up_tileset: { id: "up_tileset", name: "올린 타일셋", kind: "tileset", dataUrl: "data:image/png;base64,AA==", meta: {} },
        up_picture: { id: "up_picture", name: "사진", kind: "picture", dataUrl: "data:image/png;base64,AA==", meta: {} },
      };
      const tileset = project.tilesets[id];
      if (tileset) {
        tileset.count = 12;
        tileset.passability.length = 12;
      }
    });
    const host = renderProps();
    findByTestId(host, "tileset-oprn-graphic-browse")?.dispatchEvent(new Event("click"));
    expect(document.body.querySelector("[data-testid='tileset-graphic-option-up_picture']")).toBeNull();
    const option = document.body.querySelector("[data-testid='tileset-graphic-option-up_tileset']");
    if (!option) throw new Error("missing uploaded tileset option");
    option.dispatchEvent(new Event("click"));
    const tileset = store.getCurrent().tilesets[id];
    expect(tileset?.image).toEqual({ type: "uploaded", id: "up_tileset" });
    expect(tileset?.count).toBe(TILE_FRAME_COUNT);
    expect(tileset?.passability).toHaveLength(TILE_FRAME_COUNT);
  });

  it("repairs stale geometry on a same-id bundled pick", () => {
    const id = firstTilesetId();
    store.update((project) => {
      const tileset = project.tilesets[id];
      if (!tileset) return;
      tileset.image = { type: "bundled", id: "tex_easyrpg_chipset_dungeon" };
      tileset.count = 8;
      tileset.passability.length = 8;
    });
    const host = renderProps();
    findByTestId(host, "tileset-oprn-graphic-browse")?.dispatchEvent(new Event("click"));
    document.body
      .querySelector("[data-testid='tileset-graphic-option-tex_easyrpg_chipset_dungeon']")
      ?.dispatchEvent(new Event("click"));
    expect(store.getCurrent().tilesets[id]?.count).toBe(TILE_FRAME_COUNT);
    expect(store.getCurrent().tilesets[id]?.passability).toHaveLength(TILE_FRAME_COUNT);
  });
});
