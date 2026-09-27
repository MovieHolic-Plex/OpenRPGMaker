/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadTilesetImage } from "@/editor/mapTileDraw";
import { createMinimap } from "@/player/minimap";
import { createWorldCoastAutotileGroup } from "@/project/defaults/worldCoastMapping";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import type { PlaySession } from "@/project/session";

const current = vi.hoisted(() => ({ project: undefined as Project | undefined }));
vi.mock("@/project/store", () => ({ store: { getCurrent: () => current.project } }));
vi.mock("@/editor/tilesetImage", () => ({
  tilesetImageUrl: (tileset: TilesetDef) => `/test/${tileset.id}.png`,
}));
// 쿼터 합성 판정은 store 없는 chipsetComposition 으로 옮겼다(맵 그리기 코어가 거기서 읽는다).
vi.mock("@/editor/chipsetComposition", () => ({ supportsChipsetQuarterComposition: () => true }));

const sourcePixels = [8, 69, 146, 255, 255, 103, 139, 255, 60, 143, 75, 255];
function context() {
  return {
    drawImage: vi.fn((..._args: unknown[]) => {}), clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(sourcePixels) })),
    putImageData: vi.fn((_pixels: { data: Uint8ClampedArray }, _x: number, _y: number) => {}), imageSmoothingEnabled: true,
  };
}
let contexts: WeakMap<HTMLCanvasElement, ReturnType<typeof context>>;
let imageLoads: number;
let failNextLoad: boolean;
let sequence = 0;

beforeEach(() => {
  contexts = new WeakMap();
  imageLoads = 0;
  failNextLoad = false;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    let result = contexts.get(this);
    if (!result) { result = context(); contexts.set(this, result); }
    return result as unknown as CanvasRenderingContext2D;
  });
  vi.stubGlobal("Image", class {
    constructor() {
      const image = document.createElement("img");
      Object.defineProperties(image, {
        naturalWidth: { value: 3 }, naturalHeight: { value: 1 },
        src: { set: () => {
          imageLoads += 1;
          const fail = failNextLoad;
          failNextLoad = false;
          queueMicrotask(() => image.dispatchEvent(new Event(fail ? "error" : "load")));
        } },
      });
      return image;
    }
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

function tileset(overrides: Partial<TilesetDef> = {}): TilesetDef {
  return {
    id: `canvas-${sequence++}`, name: "World", image: { type: "bundled", id: "tex_easyrpg_chipset_world" },
    tileSize: 16, tilesPerRow: 30, count: 480,
    passability: [], priority: [], autotileGroups: [createWorldCoastAutotileGroup()],
    ...overrides,
  } as TilesetDef;
}
function bakedPixels(image: HTMLCanvasElement): number[] {
  return Array.from(contexts.get(image)!.putImageData.mock.calls[0][0].data);
}

describe("shared canvas tileset textures", () => {
  it("preserves an unknown sheet without an explicit key, including its ocean top-left color", async () => {
    const definition = tileset();
    const image = await loadTilesetImage(definition);
    expect(image).toBeInstanceOf(HTMLImageElement);
    expect(await loadTilesetImage(definition)).toBe(image);
    expect(imageLoads).toBe(1);
  });

  it("keys only the requested color and separates cache entries when that color changes", async () => {
    const definition = tileset({ transparentColor: "#FF678B" });
    const pending = loadTilesetImage(definition);
    expect(loadTilesetImage({ ...definition, transparentColor: " #ff678b " })).toBe(pending);
    // Mutation while loading must not change the first request's transparency contract.
    definition.transparentColor = "#3c8f4b";
    const pink = await pending as HTMLCanvasElement;
    const green = await loadTilesetImage(definition) as HTMLCanvasElement;
    expect(bakedPixels(pink)).toEqual([8, 69, 146, 255, 255, 103, 139, 0, 60, 143, 75, 255]);
    expect(bakedPixels(green)).toEqual([8, 69, 146, 255, 255, 103, 139, 255, 60, 143, 75, 0]);
    expect(imageLoads).toBe(2);
    definition.transparentColor = undefined;
    expect(await loadTilesetImage(definition)).toBeInstanceOf(HTMLImageElement);
    expect(imageLoads).toBe(3);
  });

  it("applies the known interior object key without stripping the grass or ocean colors", async () => {
    const image = await loadTilesetImage(tileset({ image: { type: "bundled", id: "tex_easyrpg_chipset_interior" } })) as HTMLCanvasElement;
    expect(bakedPixels(image)).toEqual([8, 69, 146, 255, 255, 103, 139, 0, 60, 143, 75, 255]);
  });

  it("allows a failed image request to be retried", async () => {
    const definition = tileset();
    failNextLoad = true;
    await expect(loadTilesetImage(definition)).rejects.toThrow("타일셋 이미지를 읽지 못했습니다.");
    expect(await loadTilesetImage(definition)).toBeInstanceOf(HTMLImageElement);
    expect(imageLoads).toBe(2);
  });

  it("renders minimap coast quarters and upper objects using the same processed image", async () => {
    const definition = tileset({ transparentColor: "#ff678b" });
    const map = {
      id: "coast-mini", name: "Coast", width: 3, height: 3, tileSize: 16, tilesetId: definition.id,
      lowerTiles: [120, 120, 120, 120, 240, 120, 120, 120, 120],
      upperTiles: [-1, -1, -1, -1, 322, -1, -1, -1, -1], events: [],
      minimap: { enabled: true, showEvents: false },
    } as GameMap;
    current.project = { tilesets: { [definition.id]: definition } } as Project;
    const host = document.createElement("div");
    document.body.append(host);
    const mini = await createMinimap(host, map, { x: 1, y: 1 } as PlaySession);
    expect(mini).not.toBeNull();
    const image = await loadTilesetImage(definition) as HTMLCanvasElement;
    const drawing = contexts.get(mini!.canvas)!;
    expect(drawing.drawImage).toHaveBeenCalledTimes(34); // Eight water cells × four quarters, plain, upper castle.
    expect(drawing.drawImage).toHaveBeenCalledWith(image, 8, 56, 8, 8, 8, 8, 8, 8); // Island's NW concave shore.
    expect(drawing.drawImage).toHaveBeenLastCalledWith(image, 352, 160, 16, 16, 16, 16, 16, 16);
    expect(bakedPixels(image)[7]).toBe(0);
    expect(mini!.canvas.width).toBe(48);
    expect(mini!.canvas.height).toBe(48);
  });
});
