import { describe, expect, it } from "vitest";

describe("player build output", () => {
  it("player 전용 빌드에는 에디터/AI/Supabase 문자열이 포함되지 않고 HTML 구조가 유지된다", async () => {
    const tmpDir = `/tmp/rpgzzu-player-build-${Date.now()}`;
    const viteModuleName = "vite";
    const { build } = (await import(viteModuleName)) as {
      build(options: Record<string, unknown>): Promise<unknown>;
    };
    await build({
      configFile: "vite.player.config.ts",
      build: {
        outDir: tmpDir,
        emptyOutDir: true,
      },
    });

    const files = await listFiles(tmpDir);
    const html = await readText(`${tmpDir}/player.html`);
    const searchable = (await Promise.all(
      files
        .filter((file) => /\.(html|js|css)$/u.test(file))
        .map((file) => readText(file))
    )).join("\n");

    expect(files.some((file) => file.endsWith("/player.js"))).toBe(true);
    expect(files.some((file) => file.endsWith("/player-manifest.json"))).toBe(true);
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain("player.js");
    expect(searchable.toLowerCase()).not.toContain("supabase");
    expect(searchable.toLowerCase()).not.toContain("openrouter");
    expect(searchable.toLowerCase()).not.toContain("llm-provider");
    expect(searchable).not.toContain("src/editor/");
  }, 30_000);
});

async function listFiles(root: string): Promise<string[]> {
  const fsModuleName = "node:fs/promises";
  const pathModuleName = "node:path";
  const fs = (await import(fsModuleName)) as {
    readdir(path: string, opts: { withFileTypes: true }): Promise<Array<{ name: string; isDirectory(): boolean }>>;
  };
  const path = (await import(pathModuleName)) as {
    join(...parts: string[]): string;
  };
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else out.push(full);
    }
  }
  await walk(root);
  return out;
}

async function readText(path: string): Promise<string> {
  const fsModuleName = "node:fs/promises";
  const fs = (await import(fsModuleName)) as {
    readFile(path: string, encoding: "utf8"): Promise<string>;
  };
  return fs.readFile(path, "utf8");
}
