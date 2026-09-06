import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { prepareWebExport } from "@/project/webExport";
import { exactWebExportEntries } from "@/project/webExportZip";
import { createStandaloneHtmlExport } from "@/project/standaloneExport";

const sourceUrl = "https://music.example.test/rpg-zzu/bgm/v1/rtp-fld-001-meadow-guild-square_f5d3e29d.mp3";
const zipPath = "assets/cc0/audio/catalog/rtp-fld-001-meadow-guild-square_f5d3e29d.mp3";

afterEach(() => vi.unstubAllEnvs());

function catalogProject() {
  const project = createBlankProject();
  project.system.defaultBgmResourceId = "cc0-bgm-rtp-fld-001";
  return project;
}

describe("catalog audio export", () => {
  it.each([
    ["empty", new Uint8Array()],
    ["HTML fallback", new TextEncoder().encode("<!doctype html><html>Not an asset</html>")],
  ] as const)("rejects %s asset bytes instead of writing a broken ZIP", async (_label, bytes) => {
    // Given
    const prepared = prepareWebExport(catalogProject());

    // When
    const attempt = exactWebExportEntries(prepared, { bundleFiles: [], runtimeAssets: [] }, async () => bytes);

    // Then
    await expect(attempt).rejects.toMatchObject({ code: "runtime-asset-unavailable" });
  });

  it("packages the played CDN track at the player's local fallback path", () => {
    // Given
    vi.stubEnv("VITE_BGM_CDN_BASE", "https://music.example.test");

    // When
    const prepared = prepareWebExport(catalogProject());

    // Then
    expect(prepared.assets).toContainEqual({
      kind: "public",
      sourcePath: sourceUrl,
      zipPath,
      resourceId: "cc0-bgm-rtp-fld-001",
    });
  });

  it("fetches the exact CDN URL and stores the returned bytes in the ZIP entries", async () => {
    // Given
    vi.stubEnv("VITE_BGM_CDN_BASE", "https://music.example.test");
    const music = new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0]);
    const requested: string[] = [];
    const prepared = prepareWebExport(catalogProject());

    // When
    const entries = await exactWebExportEntries(prepared, { bundleFiles: [], runtimeAssets: [] }, async (url) => {
      requested.push(url);
      return url === sourceUrl ? music : new Uint8Array([1]);
    });

    // Then
    expect(requested).toContain(sourceUrl);
    expect(entries.find((entry) => entry.name === zipPath)?.bytes).toEqual(music);
  });

  it("embeds CDN music bytes under the offline player's canonical asset key", async () => {
    // Given
    vi.stubEnv("VITE_BGM_CDN_BASE", "https://music.example.test");
    const music = new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0]);

    // When
    const result = await createStandaloneHtmlExport(catalogProject(), {
      fetchBytes: async (url) => url === sourceUrl ? music : new Uint8Array([1]),
    });
    const html = await result.blob.text();
    const payload = html.match(/id="oprn-standalone-assets">([^<]*)<\/script>/)?.[1];
    if (!payload) throw new Error("Standalone asset payload missing");

    // Then
    expect(JSON.parse(payload)).toMatchObject({ [zipPath]: "data:audio/mpeg;base64,SUQzBAAAAAAAAA==" });
  });
});
