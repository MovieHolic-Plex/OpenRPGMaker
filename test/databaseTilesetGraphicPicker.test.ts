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

// 표준 480칸(30열 16px) 시트 위에서 그림 바꾸기를 본다. 예전 첫 타일셋(합본 마을)과 고를 대상(EasyRPG 던전)은
// 2026-10-07 저작권 정리로 빠졌고 첫 타일셋이 된 버들항은 36,352칸이다 — 같은 규격의 Scarloxy 시트 둘로 바꾼다.
const TARGET_TILESET_ID = "scarloxy_chipset_grassland";
const PICK_TEXTURE_KEY = "tex_scarloxy_chipset_wilds";

function firstTilesetId(): string {
  if (!store.getCurrent().tilesets[TARGET_TILESET_ID]) throw new Error(`blank project needs ${TARGET_TILESET_ID}`);
  return TARGET_TILESET_ID;
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
    const option = document.body.querySelector(`[data-testid='tileset-graphic-option-${PICK_TEXTURE_KEY}']`);
    if (!option) throw new Error("missing wilds chipset option");
    option.dispatchEvent(new Event("click"));

    const tileset = store.getCurrent().tilesets[firstTilesetId()];
    expect(tileset?.image).toEqual({
      type: "bundled",
      id: PICK_TEXTURE_KEY,
    });
    expect(tileset?.count).toBe(TILE_FRAME_COUNT);
    expect(tileset?.tilesPerRow).toBe(CHIPSET_SLICING.columns);
    expect(tileset?.passability).toHaveLength(TILE_FRAME_COUNT);
  });

  it("ignores a same-id pick without snapshotting", () => {
    const id = firstTilesetId();
    store.update((project) => {
      const tileset = project.tilesets[id];
      if (tileset) tileset.image = { type: "bundled", id: PICK_TEXTURE_KEY };
    });
    const before = structuredClone(store.getCurrent().tilesets[id]);
    const host = renderProps();
    findByTestId(host, "tileset-oprn-graphic-browse")?.dispatchEvent(new Event("click"));
    document.body
      .querySelector(`[data-testid='tileset-graphic-option-${PICK_TEXTURE_KEY}']`)
      ?.dispatchEvent(new Event("click"));
    expect(store.getCurrent().tilesets[id]).toEqual(before);
  });

  it("lists uploaded tileset/chipset, skips picture, and remaps uploaded geometry", () => {
    const id = firstTilesetId();
    store.update((project) => {
      project.assets.uploaded = {
        ...(project.assets.uploaded ?? {}),
        // 올린 그림의 칸 규격은 meta(가로·세로·칸 크기)에서 읽는다 — 480×256 / 16px = 30열 × 16줄 = 480칸.
        up_tileset: { id: "up_tileset", name: "올린 타일셋", kind: "tileset", dataUrl: "data:image/png;base64,AA==", meta: { width: 480, height: 256, tileSize: 16 } },
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
      tileset.image = { type: "bundled", id: PICK_TEXTURE_KEY };
      tileset.count = 8;
      tileset.passability.length = 8;
    });
    const host = renderProps();
    findByTestId(host, "tileset-oprn-graphic-browse")?.dispatchEvent(new Event("click"));
    document.body
      .querySelector(`[data-testid='tileset-graphic-option-${PICK_TEXTURE_KEY}']`)
      ?.dispatchEvent(new Event("click"));
    expect(store.getCurrent().tilesets[id]?.count).toBe(TILE_FRAME_COUNT);
    expect(store.getCurrent().tilesets[id]?.passability).toHaveLength(TILE_FRAME_COUNT);
  });
});
