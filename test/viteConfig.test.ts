import { describe, expect, it } from "vitest";
import viteConfigSource from "../vite.config.ts?raw";
import { resolveConfig } from "vite";

describe("vite dev server config", () => {
  it("binds development to IPv4 interfaces while keeping preview loopback-only and ports strict", async () => {
    const config = await resolveConfig({ configFile: "vite.config.ts", mode: "test" }, "serve");
    expect(config.server.host).toBe("0.0.0.0");
    expect(config.preview.host).toBe("127.0.0.1");
    expect(config.server.strictPort).toBe(true);
    expect(config.preview.strictPort).toBe(true);
  });

  it("ignores generated evidence folders when watching files", () => {
    // Given: evidence and screenshot runs create many locked files on Windows.
    const requiredPatterns = ["**/output/**", "**/tmp/**", "**/test-results/**"];

    // Then: generated artifacts are outside the watched graph.
    for (const pattern of requiredPatterns) expect(viteConfigSource).toContain(pattern);
  });
});
