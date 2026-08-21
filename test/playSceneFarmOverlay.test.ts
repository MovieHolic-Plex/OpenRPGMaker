/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from "vitest";
import { renderFarmOverlays } from "@/player/playSceneFarming";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { store } from "@/project/store";

type Call = { readonly kind: "image" | "rectangle" | "sprite" | "text"; readonly args: readonly unknown[] };
type StubObject = { setOrigin(): void; setDepth(): void; setAlpha(): void };

type StubScene = {
  readonly calls: Call[];
  readonly added: unknown[];
  readonly map: { readonly id: string; readonly tilesetId?: string; readonly width?: number; readonly height?: number };
  readonly session: { readonly farmPlots: Record<string, Record<string, PlotState>> };
  readonly tileLayer: { add(object: unknown): unknown };
  readonly resolveTilesetTexture: () => string;
  readonly add: Record<"image" | "rectangle" | "sprite" | "text", (...args: unknown[]) => StubObject>;
};

type PlotState = { tilled: boolean; watered: boolean; cropId?: string; stage?: number; dead?: boolean };

const FARM_MAP_ID = "map_farming_demo";

function createStubScene(
  plots: Record<string, PlotState>,
  options: { readonly bounds?: { readonly width: number; readonly height: number }; readonly otherMapPlots?: Record<string, PlotState> } = {}
): StubScene {
  const calls: Call[] = [];
  const added: unknown[] = [];
  const object = () => ({ setOrigin() {}, setDepth() {}, setAlpha() {} });
  const project = store.getCurrent();
  return {
    calls,
    added,
    map: { id: FARM_MAP_ID, tilesetId: project.maps[FARM_MAP_ID]?.tilesetId, ...options.bounds },
    session: {
      farmPlots: {
        [FARM_MAP_ID]: plots,
        ...(options.otherMapPlots ? { map_other: options.otherMapPlots } : {}),
      },
    },
    tileLayer: { add: (o: unknown) => added.push(o) },
    resolveTilesetTexture: () => "tex_test_chipset",
    add: {
      image: (...args: unknown[]) => (calls.push({ kind: "image", args }), object()),
      rectangle: (...args: unknown[]) => (calls.push({ kind: "rectangle", args }), object()),
      sprite: (...args: unknown[]) => (calls.push({ kind: "sprite", args }), object()),
      text: (...args: unknown[]) => (calls.push({ kind: "text", args }), object()),
    },
  };
}

const render = (scene: StubScene): void => {
  renderFarmOverlays(scene as unknown as Parameters<typeof renderFarmOverlays>[0], store.getCurrent().database.crops ?? []);
};

const soilFrames = (scene: StubScene): string[] =>
  scene.calls.filter((call) => call.kind === "image").map((call) => String(call.args[3]));

describe("renderFarmOverlays", () => {
  beforeEach(() => {
    store.replaceProject(createFarmingDemoProject());
  });

  it("draws tilled soil as a tile image from the tile_<id> frame family, never as a rectangle", () => {
    const scene = createStubScene({ "3,4": { tilled: true, watered: false } });
    render(scene);

    const frames = soilFrames(scene);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatch(/^tile_\d+$/);
    expect(scene.calls.filter((call) => call.kind === "rectangle")).toHaveLength(0);
    expect(scene.added).toHaveLength(1);
  });

  it("shapes an isolated plot differently from a 2x2 block (autotile shaping runs)", () => {
    const single = createStubScene({ "3,4": { tilled: true, watered: false } });
    render(single);
    const block = createStubScene({
      "3,4": { tilled: true, watered: false },
      "4,4": { tilled: true, watered: false },
      "3,5": { tilled: true, watered: false },
      "4,5": { tilled: true, watered: false },
    });
    render(block);

    const isolated = soilFrames(single)[0];
    const blockFrames = soilFrames(block);
    expect(blockFrames).toHaveLength(4);
    expect(blockFrames.every((frame) => frame !== isolated)).toBe(true);
    // 2x2 는 네 칸이 서로 다른 모서리 타일로 나뉜다.
    expect(new Set(blockFrames).size).toBe(4);
  });

  it("adds exactly one translucent tint on top of watered soil", () => {
    const scene = createStubScene({ "3,4": { tilled: true, watered: true } });
    render(scene);

    expect(soilFrames(scene)).toHaveLength(1);
    const tints = scene.calls.filter((call) => call.kind === "rectangle");
    expect(tints).toHaveLength(1);
    expect(Number(tints[0]?.args[5])).toBeLessThan(0.25);
  });

  it("skips plots left outside the map after it shrank", () => {
    const scene = createStubScene(
      { "3,4": { tilled: true, watered: false }, "20,3": { tilled: true, watered: false }, "3,40": { tilled: true, watered: false } },
      { bounds: { width: 10, height: 10 } }
    );
    const reference = createStubScene({ "3,4": { tilled: true, watered: false } });
    render(scene);
    render(reference);

    // 맵 밖 칸은 그려서도 안 되고, 남은 칸의 오토타일 이웃 판정을 오염시켜도 안 된다.
    expect(scene.added).toHaveLength(1);
    expect(soilFrames(scene)).toEqual(soilFrames(reference));
  });

  it("draws only the current map's plots", () => {
    const scene = createStubScene(
      { "3,4": { tilled: true, watered: false } },
      { otherMapPlots: { "5,5": { tilled: true, watered: false }, "6,5": { tilled: true, watered: false } } }
    );
    render(scene);

    expect(scene.added).toHaveLength(1);
  });

  it("never creates a text object, even for a crop without a resolvable sprite", () => {
    const scene = createStubScene({
      "3,4": { tilled: true, watered: false, cropId: "crop_potato", stage: 1 },
      "5,4": { tilled: true, watered: false, cropId: "crop_unknown", stage: 0 },
      "6,4": { tilled: true, watered: false, cropId: "crop_potato", stage: 0, dead: true },
    });
    render(scene);

    expect(scene.calls.filter((call) => call.kind === "text")).toHaveLength(0);
    expect(scene.calls.filter((call) => call.kind === "sprite")).toHaveLength(2);
  });
});
