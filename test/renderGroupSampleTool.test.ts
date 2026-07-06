import { afterEach, describe, expect, it } from "vitest";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { TileGroupMetadata } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";

type RenderGroupSampleData = {
  readonly samples: readonly {
    readonly h: number;
    readonly label: string;
    readonly lower: readonly number[];
    readonly upper: readonly number[];
    readonly w: number;
  }[];
  readonly tilesetId: string;
};

type FakeCanvasContext = {
  fillStyle: string;
  imageSmoothingEnabled: boolean;
  drawImage: () => void;
  fillRect: () => void;
};

let restoreCanvasDom: (() => void) | null = null;

function context(): ToolContext {
  const project = createBlankProject();
  project.tilesets[DEFAULT_TILESET_ID].tileGroups = [wallGroup()];
  return { project };
}

function wallGroup(): TileGroupMetadata {
  return {
    defaultLayer: "lower",
    description: "테스트 벽",
    id: "wall-main",
    name: "담장",
    patternGrammar: {
      axis: "both",
      kind: "nine_slice_expandable",
      minHeight: 3,
      minWidth: 3,
      parts: [
        { role: "topLeft", tileIds: [1] },
        { role: "top", tileIds: [2] },
        { role: "topRight", tileIds: [3] },
        { role: "left", tileIds: [4] },
        { role: "center", tileIds: [5] },
        { role: "right", tileIds: [6] },
        { role: "bottomLeft", tileIds: [7] },
        { role: "bottom", tileIds: [8] },
        { role: "bottomRight", tileIds: [9] },
      ],
      preserveCaps: true,
      repeat: "center",
    },
    placementRules: "3x3 벽",
    role: "wall",
    tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  };
}

function isRenderGroupSampleData(value: unknown): value is RenderGroupSampleData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const tilesetId = Reflect.get(value, "tilesetId");
  const samples = Reflect.get(value, "samples");
  return typeof tilesetId === "string" && Array.isArray(samples)
    && samples.every((sample) => {
      if (typeof sample !== "object" || sample === null || Array.isArray(sample)) return false;
      return typeof Reflect.get(sample, "label") === "string"
        && Number.isInteger(Reflect.get(sample, "w"))
        && Number.isInteger(Reflect.get(sample, "h"))
        && Array.isArray(Reflect.get(sample, "lower"))
        && Array.isArray(Reflect.get(sample, "upper"));
    });
}

describe("render_group_sample", () => {
  afterEach(() => {
    restoreCanvasDom?.();
    restoreCanvasDom = null;
  });

  it("returns one current sample when called with groupId only", () => {
    const ctx = context();
    const result = runTool(ctx, "render_group_sample", { tilesetId: DEFAULT_TILESET_ID, groupId: "wall-main" });

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("샘플 렌더: 담장");
    if (!isRenderGroupSampleData(result.data)) throw new Error("render_group_sample data shape mismatch");
    expect(result.data.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(result.data.samples).toHaveLength(1);
    expect(result.data.samples[0]?.label).toBe("현재");
    expect(result.data.samples[0]?.lower).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("returns before and after samples when proposed data changes the group", () => {
    const ctx = context();
    const result = runTool(ctx, "render_group_sample", {
      tilesetId: DEFAULT_TILESET_ID,
      groupId: "wall-main",
      proposed: { role: "fence", tileIds: [12, 13, 14] },
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("전/후");
    if (!isRenderGroupSampleData(result.data)) throw new Error("render_group_sample data shape mismatch");
    expect(result.data.samples.map((sample) => sample.label)).toEqual(["수정 전", "수정 후"]);
    expect(result.data.samples[0]?.lower).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result.data.samples[1]?.lower).toEqual([12, 13, 14]);
  });

  it("keeps structural rule proposals as before and after changes", () => {
    const ctx = context();
    const result = runTool(ctx, "render_group_sample", {
      groupId: "wall-main",
      proposed: {
        junctions: [{ action: "omit", atRoles: ["bottom"], side: "below", withRole: "wall" }],
        overlays: [{ tileIds: [16], when: "ridge" }],
      },
      tilesetId: DEFAULT_TILESET_ID,
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("전/후");
    if (!isRenderGroupSampleData(result.data)) throw new Error("render_group_sample data shape mismatch");
    expect(result.data.samples.map((sample) => sample.label)).toEqual(["수정 전", "수정 후"]);
  });

  it("returns a single ad-hoc sample when tileIds are provided without a group", () => {
    const ctx = context();
    const result = runTool(ctx, "render_group_sample", { tilesetId: DEFAULT_TILESET_ID, role: "terrain", tileIds: [30, 31] });

    expect(result.ok, result.summary).toBe(true);
    if (!isRenderGroupSampleData(result.data)) throw new Error("render_group_sample data shape mismatch");
    expect(result.data.samples).toHaveLength(1);
    expect(result.data.samples[0]?.label).toBe("샘플");
    expect(result.data.samples[0]?.lower).toEqual([30, 31]);
  });

  it("lets renderToolImages accept render_group_sample data without mutating the project", async () => {
    const ctx = context();
    const before = JSON.stringify(ctx.project);
    const result = runTool(ctx, "render_group_sample", { tilesetId: DEFAULT_TILESET_ID, groupId: "wall-main" });
    if (!isRenderGroupSampleData(result.data)) throw new Error("render_group_sample data shape mismatch");

    const images = await renderToolImages(ctx.project, "render_group_sample", result.data);

    expect(images.length).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(ctx.project)).toBe(before);
  });

  it("renders transparent areas on a neutral checker instead of magenta", async () => {
    const fillStyles: string[] = [];
    restoreCanvasDom = installFakeCanvasDom(fillStyles);
    const ctx = context();

    await renderToolImages(ctx.project, "render_group_sample", {
      samples: [{ h: 1, label: "현재", lower: [-1], upper: [-1], w: 1 }],
      tilesetId: DEFAULT_TILESET_ID,
    });

    expect(fillStyles).toContain("#2a2a2e");
    expect(fillStyles).toContain("#33333a");
    expect(fillStyles).not.toContain("#ff00ff");
  });
});

function installFakeCanvasDom(fillStyles: string[]): () => void {
  const previousDocument = globalThis.document;
  const previousImage = globalThis.Image;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: {
      createElement: (tagName: string) => {
        if (tagName !== "canvas") throw new Error(`unexpected element: ${tagName}`);
        const context: FakeCanvasContext = {
          drawImage: () => undefined,
          fillRect: () => undefined,
          imageSmoothingEnabled: false,
          get fillStyle() {
            return fillStyles.at(-1) ?? "";
          },
          set fillStyle(value: string) {
            fillStyles.push(value);
          },
        };
        return {
          getContext: () => context,
          height: 0,
          toDataURL: () => "data:image/png;base64,neutral-checker",
          width: 0,
        };
      },
    },
  });
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    writable: true,
    value: class FakeImage {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  });
  return () => {
    restoreGlobal("document", previousDocument);
    restoreGlobal("Image", previousImage);
  };
}

function restoreGlobal(key: "document" | "Image", value: unknown): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, key);
    return;
  }
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
}
