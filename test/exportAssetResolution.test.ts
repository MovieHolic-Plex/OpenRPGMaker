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

/**
 * The exported player now shows a 「시작하기」 button after preloading and waits for it unless the boot is QA-instrumented
 * or a desktop shell (exportEntry.prepareFirstScreen → bootLoader.waitForStart, #3318). Press it like a player would.
 */
async function pressStartUntil(ready: Promise<void>): Promise<void> {
  let done = false;
  void ready.then(() => { done = true; }, () => { done = true; });
  while (!done) {
    const start = document.querySelector<HTMLButtonElement>('[data-testid="boot-loader-start"]');
    if (start && start.style.display === "inline-block") { start.click(); break; }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await ready;
}

/**
 * Serves project.json and 404s everything else. The web boot also fetches loading.json and preload-files.json; one shared
 * Response for every call let loading.json consume the body, so the project fetch failed and the player never rendered.
 */
function serveProject(raw: string) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    return new URL(url, "http://localhost").pathname.endsWith("/project.json") ? new Response(raw) : new Response("", { status: 404 });
  });
}

async function bootExport(): Promise<void> {
  const ready = new Promise<void>((resolve) => rendered.mockImplementation(() => resolve()));
  await import("@/player/exportEntry");
  await pressStartUntil(ready);
}

// Heavy under CI load (15s default is too tight): boots the exported player over a blank project in happy-dom.
describe("exported player asset resolution", { timeout: 120_000 }, () => {
  it("keeps editor resource paths unchanged without export boot", async () => {
    // Given
    const { resolveAssetResourceUrl } = await import("@/assets/generatedAssetResourceResolver");
    const { normalizeWarmUrl } = await import("@/assets/imageWarmQueue");

    // When
    const resolved = resolveAssetResourceUrl("oprn-title-field");

    // Then
    expect(resolved).toBe("/assets/generated/title/oprn-title-field.png");
    expect(normalizeWarmUrl("assets/dialogue-frame.png")).toBe("/assets/dialogue-frame.png");
  });

  it("uses the exported game directory for title, audio, generated sprites and warmup", async () => {
    // Given
    vi.stubGlobal("fetch", serveProject(serialize(createBlankProject())));

    // When
    await bootExport();
    const { resolveAssetResourceUrl } = await import("@/assets/generatedAssetResourceResolver");
    const { normalizeWarmUrl } = await import("@/assets/imageWarmQueue");
    const base = `${window.location.origin}/games/harbor/`;

    // Then
    expect(resolveAssetResourceUrl("oprn-title-field")).toBe(`${base}assets/generated/title/oprn-title-field.png`);
    expect(resolveAssetResourceUrl("easyrpg-sound-decision1")).toBe(`${base}assets/easyrpg/sound/Decision1.wav`);
    expect(resolveAssetResourceUrl("generated-enemy-slime-01")).toBe(`${base}assets/generated/pixel-enemy-portraits/slime.png`);
    expect(normalizeWarmUrl("assets/dialogue-frame.png")).toBe(`${base}assets/dialogue-frame.png`);
  });

  it("resolves minimap tilesets and movie fallbacks through the game directory", async () => {
    // Given
    const project = createBlankProject();
    vi.stubGlobal("fetch", serveProject(serialize(project)));

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
      ["oprn-standalone-assets", JSON.stringify({ "assets/generated/title/oprn-title-field.png": "data:image/png;base64,AA==" })],
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
    expect(resolveAssetResourceUrl("oprn-title-field")).toBe("data:image/png;base64,AA==");
    expect(withInlineAsset("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
    expect(withInlineAsset("//cdn.example.com/a.png")).toBe("//cdn.example.com/a.png");
    expect(withInlineAsset("#battle-flash-tint")).toBe("#battle-flash-tint");
    expect(fetchBytes).not.toHaveBeenCalled();
  });
});
