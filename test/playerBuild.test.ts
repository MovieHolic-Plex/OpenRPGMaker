import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build, type Plugin } from "vite";
import { describe, expect, it } from "vitest";

const PLAYER_ENV_PREFIX = "OPENRPG_PLAYER_";
const TEXT_ARTIFACT_PATTERN = /\.(?:css|html|js|map)$/u;
const FORBIDDEN_ARTIFACT_MARKERS = [
  {
    label: "remote-database-client",
    pattern: /(?:supabaseProject(?:Config|Sync)|recordSupabase|loadProjectFromSupabase|saveProjectToSupabase)/iu,
  },
  { label: "remote-activity-table", pattern: /ai_(?:activity_logs|analysis_runs)/iu },
  { label: "editor-ai-module", pattern: /(?:@\/|src\/)ai\/activityLog/iu },
  { label: "editor-module-path", pattern: /src\/editor\//iu },
  { label: "remote-provider", pattern: /(?:openrouter|llm-provider)/iu },
  { label: "remote-activity-endpoint", pattern: /__oprn\/ai-activity/iu },
  { label: "editor-public-env", pattern: /VITE_(?:LLM|SUPABASE|YUNWU)/u },
  { label: "remote-api-endpoint", pattern: /api\.(?:anthropic|openai)\.com/iu },
] as const;

type ScanFinding = {
  readonly label: string;
  readonly fileCount: number;
};

type ScanReport = {
  readonly scannedFileCount: number;
  readonly findings: readonly ScanFinding[];
};

class PlayerArtifactScanError extends Error {
  readonly name = "PlayerArtifactScanError";

  constructor(readonly findings: readonly ScanFinding[]) {
    super(`Player artifact scan failed (${findings.map((finding) => `${finding.label}:${finding.fileCount}`).join(", ")})`);
  }
}

describe("player build output", () => {
  it("keeps diagnostics source independent from editor telemetry and scopes public env exposure", async () => {
    // Given
    const diagnosticsSource = await readFile(resolve("src/player/playBootDiagnostics.ts"), "utf8");
    const viteConfigSource = await readFile(resolve("vite.player.config.ts"), "utf8");
    const modalSource = await readFile(resolve("src/editor/panels/testPlayModal.ts"), "utf8");
    const exportEntrySource = await readFile(resolve("src/player/exportEntry.ts"), "utf8");

    // When
    const forbiddenSourceEdges = ["@/ai/activityLog", "@/project/store"].filter((edge) =>
      diagnosticsSource.includes(edge),
    );

    // Then
    expect(forbiddenSourceEdges).toEqual([]);
    expect(viteConfigSource).toContain(`envPrefix: "${PLAYER_ENV_PREFIX}"`);
    expect(modalSource.match(/diagnosticSink: editorPlayBootDiagnosticSink/gu)).toHaveLength(2);
    expect(exportEntrySource).not.toContain("editorPlayBootDiagnosticSink");
  });

  it("builds a clean player into an OS-portable disposable directory", async () => {
    // Given
    const outputDir = await mkdtemp(join(tmpdir(), "rpgzzu-player-build-"));
    const transformedModuleIds: string[] = [];
    const importGraphProbe = {
      name: "test-player-import-graph",
      transform(_code, id) {
        transformedModuleIds.push(id.replaceAll("\\", "/"));
        return null;
      },
    } satisfies Plugin;

    try {
      // When
      await build({
        configFile: resolve("vite.player.config.ts"),
        logLevel: "silent",
        plugins: [importGraphProbe],
        build: {
          outDir: outputDir,
          emptyOutDir: true,
        },
      });
      const files = await collectFiles(outputDir);
      const html = await readFile(join(outputDir, "player.html"), "utf8");
      const report = await scanPlayerArtifacts(outputDir);
      const forbiddenModules = transformedModuleIds.filter((id) =>
        /(?:\/src\/ai\/|supabaseProject(?:Config|Sync)|tileMetadataDb)/iu.test(id),
      );

      // Then
      expect(files.some((file) => file.endsWith("player.js"))).toBe(true);
      expect(files.some((file) => file.endsWith("player-manifest.json"))).toBe(true);
      expect(html).toContain('<div id="app"></div>');
      expect(html).toContain("player.js");
      expect(forbiddenModules).toEqual([]);
      expect(report.findings).toEqual([]);
      expect(report.scannedFileCount).toBeGreaterThan(0);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  }, 120_000);

  it("rejects a disposable forbidden import and fake secret without echoing matched values", async () => {
    // Given
    const outputDir = await mkdtemp(join(tmpdir(), "rpgzzu-player-adversarial-"));
    const fakeSecret = `FAKE_PLAYER_SECRET_${Date.now()}_DO_NOT_ECHO`;
    const deliberateImport = "@/ai/activityLog";

    try {
      await writeFile(
        join(outputDir, "player.js"),
        `import ${JSON.stringify(deliberateImport)};\nconst canary = ${JSON.stringify(fakeSecret)};\n`,
        "utf8",
      );

      // When
      const scan = scanPlayerArtifacts(outputDir, [fakeSecret]);

      // Then
      await expect(scan).rejects.toBeInstanceOf(PlayerArtifactScanError);
      await expect(scan).rejects.not.toThrow(fakeSecret);
      await expect(scan).rejects.not.toThrow(deliberateImport);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});

async function scanPlayerArtifacts(
  root: string,
  sensitiveValues: readonly string[] = [],
): Promise<ScanReport> {
  const files = (await collectFiles(root)).filter((file) => TEXT_ARTIFACT_PATTERN.test(file));
  const contents = await Promise.all(files.map(async (file) => readFile(file, "utf8")));
  const findings: ScanFinding[] = [];

  for (const marker of FORBIDDEN_ARTIFACT_MARKERS) {
    const fileCount = contents.filter((content) => marker.pattern.test(content)).length;
    if (fileCount > 0) findings.push({ label: marker.label, fileCount });
  }

  const sensitiveFileCount = contents.filter((content) =>
    sensitiveValues.some((value) => value.length > 0 && content.includes(value)),
  ).length;
  if (sensitiveFileCount > 0) {
    findings.push({ label: "sensitive-canary", fileCount: sensitiveFileCount });
  }

  if (findings.length > 0) throw new PlayerArtifactScanError(findings);
  return { scannedFileCount: files.length, findings };
}

async function collectFiles(root: string): Promise<readonly string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(root, entry.name);
      return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
    }),
  );
  return nested.flat().sort((left, right) => left.localeCompare(right));
}
