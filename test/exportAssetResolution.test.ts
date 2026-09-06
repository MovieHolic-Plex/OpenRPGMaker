// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";

const { rendered } = vi.hoisted(() => ({ rendered: vi.fn() }));
vi.mock("@/player/player", () => ({ renderPlayer: rendered }));
vi.mock("@/player/audio", () => ({ stopAllAudio: vi.fn() }));
vi.mock("@/project/store", () => import("@/player/exportProjectStoreShim"));

beforeEach(() => {
  vi.resetModules();
  rendered.mockReset();
  document.body.innerHTML = '<div id="app"></div>';
  window.history.replaceState(null, "", "/games/harbor/player.html?version=1");
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

async function bootExport(): Promise<void> {
  const ready = new Promise<void>((resolve) => rendered.mockImplementation(() => resolve()));
  await import("@/player/exportEntry");
  await ready;
}

describe("exported player asset resolution", () => {
  it("keeps editor resource paths unchanged without export boot", async () => {
    // Given
    const { resolveAssetResourceUrl } = await import("@/assets/generatedAssetResourceResolver");
    const { normalizeWarmUrl } = await import("@/assets/imageWarmQueue");

    // When
    const resolved = resolveAssetResourceUrl("easyrpg-title-title1");

    // Then
    expect(resolved).toBe("/assets/easyrpg/title/Title1.png");
    expect(normalizeWarmUrl("assets/dialogue-frame.png")).toBe("/assets/dialogue-frame.png");
  });

  it("uses the exported game directory for title, audio, generated sprites and warmup", async () => {
    // Given
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(serialize(createBlankProject()))));

    // When
    await bootExport();
    const { resolveAssetResourceUrl } = await import("@/assets/generatedAssetResourceResolver");
    const { normalizeWarmUrl } = await import("@/assets/imageWarmQueue");
    const base = `${window.location.origin}/games/harbor/`;

    // Then
    expect(resolveAssetResourceUrl("easyrpg-title-title1")).toBe(`${base}assets/easyrpg/title/Title1.png`);
    expect(resolveAssetResourceUrl("easyrpg-sound-decision1")).toBe(`${base}assets/easyrpg/sound/Decision1.wav`);
    expect(resolveAssetResourceUrl("generated-enemy-slime-01")).toBe(`${base}assets/generated/starter/monster-slime-01.png`);
    expect(normalizeWarmUrl("assets/dialogue-frame.png")).toBe(`${base}assets/dialogue-frame.png`);
  });

  it("resolves minimap tilesets and movie fallbacks through the game directory", async () => {
    // Given
    const project = createBlankProject();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(serialize(project))));

    // When
    await bootExport();
    const { tilesetImageUrl } = await import("@/editor/tilesetImage");
    const { resolveMovieResourceUrl } = await import("@/player/playSceneMovies");
    const tileset = Object.values(project.tilesets)[0];
    if (!tileset) throw new Error("blank project requires a tileset");

    // Then
    expect(tilesetImageUrl(tileset)).toMatch(new RegExp(`^${window.location.origin}/games/harbor/assets/`));
    expect(resolveMovieResourceUrl("intro.webm", project)).toBe(`${window.location.origin}/games/harbor/assets/movies/intro.webm`);
  });

  it("prefers embedded assets and leaves external URLs and fragments alone", async () => {
    // Given
    const project = createBlankProject();
    for (const [id, value] of [
      ["oprn-standalone-project", serialize(project)],
      ["oprn-standalone-assets", JSON.stringify({ "assets/easyrpg/title/Title1.png": "data:image/png;base64,AA==" })],
    ] as const) {
      const node = document.createElement("script");
      node.type = "application/json";
      node.id = id;
      node.textContent = value;
      document.body.append(node);
    }
    const fetchBytes = vi.fn();
    vi.stubGlobal("fetch", fetchBytes);

    // When
    await bootExport();
    const { withInlineAsset } = await import("@/assets/inlineAssetStore");
    const { resolveAssetResourceUrl } = await import("@/assets/generatedAssetResourceResolver");

    // Then
    expect(resolveAssetResourceUrl("easyrpg-title-title1")).toBe("data:image/png;base64,AA==");
    expect(withInlineAsset("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
    expect(withInlineAsset("//cdn.example.com/a.png")).toBe("//cdn.example.com/a.png");
    expect(withInlineAsset("#battle-flash-tint")).toBe("#battle-flash-tint");
    expect(fetchBytes).not.toHaveBeenCalled();
  });
});
