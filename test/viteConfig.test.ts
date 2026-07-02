import { describe, expect, it } from "vitest";
import viteConfigSource from "../vite.config.ts?raw";

describe("vite dev server config", () => {
  it("binds the dev server to IPv6 localhost as well as IPv4", () => {
    expect(viteConfigSource).toContain('host: "::"');
  });

  it("ignores generated evidence folders when watching files", () => {
    // Given: evidence and screenshot runs create many locked files on Windows.
    const requiredPatterns = ["**/output/**", "**/tmp/**", "**/test-results/**"];

    // Then: generated artifacts are outside the watched graph.
    for (const pattern of requiredPatterns) expect(viteConfigSource).toContain(pattern);
  });
});
