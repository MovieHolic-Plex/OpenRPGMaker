import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveConfig } from "vite";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Vite production preview proxy", () => {
  it("routes CPEN through the same server-side proxy when the key is configured", async () => {
    // Given: a production preview with a server-only CPEN credential.
    vi.stubEnv("CPENROUTER_API_KEY", "preview-test-key");

    // When: Vite resolves the preview configuration used by npm start.
    const config = await resolveConfig({ configFile: "vite.config.ts", mode: "test" }, "serve");

    // Then: the browser-facing relative CPEN path is an actual proxy, not the SPA fallback.
    expect(Object.keys(config.preview.proxy ?? {})).toContain("/api/cpen");
  });
});
