import { existsSync } from "node:fs";
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
  { label: "queue-runtime", pattern: /(?:\/api\/ai-jobs|ai-job-worker|__aiJobReady|__executeAiJob|__renderAiJobReport|AI_JOBS_DIRECTORY)/u },
] as const;

// Existing defaults-barrel transforms, not a claim that every src/editor module is
// excluded. Pin the observed inventory: any additional editor edge still fails.
const EXISTING_EDITOR_TRANSFORMS = [
  "conceptBundleResolve.ts", "conceptLayoutDoubleRow.ts",
  "content/dbExtractedHouseTemplate.ts", "content/skyStairGame.ts", "content/skyStairMaps.ts",
  "content/townShowcaseMaps.ts", "cutscene/index.ts",
  "harnessSuggestion/patternDetect.ts", "harnessSuggestion/structureKitModel.ts",
  "harnessSuggestion/structureKitRasterModel.ts", "houseInteriors.ts", "houseKit.ts",
  "interiorConceptCompose.ts", "interiorConceptEvents.ts", "interiorConceptPlan.ts",
  "interiorHouseWallGrammar.ts", "interiorObjectCatalog.ts", "interiorRoomPipeline.ts",
  "interiorRoomVocab.ts", "lootFeedback.ts", "mapTileDraw.ts", "mapTileDrawCore.ts",
  "runtimeTileMetadata.ts", "tileLayerClassification.ts", "tilesetImage.ts",
  "tools/types.ts", "tools/v3/rmTypeExpander.ts", "tools/v3/terrainPolish.ts",
].sort();

function assertEditorTransformInventory(ids: readonly string[]): void {
  const prefix = resolve("src/editor").replaceAll("\\", "/") + "/";
  expect(ids.filter((id) => id.startsWith(prefix)).map((id) => id.slice(prefix.length)).sort())
    .toEqual(EXISTING_EDITOR_TRANSFORMS);
}

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

  it.each(["player", "standalone"] as const)("builds a clean %s into an OS-portable disposable directory", async (target) => {
    // Given
    const temporary = await mkdtemp(join(tmpdir(), `rpgzzu-${target}-build-`));
    const outputDir = join(temporary, "dist");
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
        configFile: resolve(`vite.${target}.config.ts`),
        configLoader: "runner",
        envDir: false,
        cacheDir: join(temporary, "cache"),
        logLevel: "silent",
        plugins: [importGraphProbe],
        build: {
          outDir: outputDir,
          emptyOutDir: true,
        },
      });
      const files = await collectFiles(outputDir);
      const report = await scanPlayerArtifacts(outputDir);

      // Then: retain the original shipped player assertions as well as standalone closure.
      if (target === "player") {
        const html = await readFile(join(outputDir, "player.html"), "utf8");
        expect(files.some((file) => file.endsWith("player.js"))).toBe(true);
        expect(files.some((file) => file.endsWith("player-manifest.json"))).toBe(true);
        expect(html).toContain('<div id="app"></div>');
        expect(html).toContain("player.js");
      } else {
        expect(files.filter((file) => file.endsWith(".js"))).toEqual([join(outputDir, "standalone.js")]);
        expect(files).toContain(join(outputDir, "standalone.css"));
      }
      expect(transformedModuleIds.some((id) => id.endsWith("/src/player/exportEntry.ts"))).toBe(true);
      assertEditorTransformInventory(transformedModuleIds);
      expect(forbiddenPlayerModules(transformedModuleIds)).toEqual([]);
      expect(report.findings).toEqual([]);
      expect(report.scannedFileCount).toBeGreaterThan(0);
      console.info(JSON.stringify({ target, transformedModules: transformedModuleIds.length,
        scannedArtifacts: report.scannedFileCount, forbiddenModules: 0, forbiddenArtifacts: 0 }));
    } finally {
      await rm(temporary, { recursive: true, force: true });
      expect(existsSync(temporary)).toBe(false);
      console.info(JSON.stringify({ target, temporaryRemoved: true }));
    }
  }, 120_000);

  it("detects a test-only virtual queue import in the actual standalone module and artifact closure", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "rpgzzu-standalone-adversarial-"));
    const outputDir = join(temporary, "dist");
    const virtualImport = "virtual:task9-queue";
    const virtualId = "\0/src/ai/jobs/task9-test-only.ts";
    const transformedModuleIds: string[] = [];
    const queueImportControl = {
      name: "test-only-standalone-queue-import",
      enforce: "pre",
      resolveId(id) { return id === virtualImport ? virtualId : null; },
      load(id) {
        // A retained side effect, not a real queue/provider module or production source edit.
        return id === virtualId ? 'globalThis.__task9QueueCanary = "/api/ai-jobs";' : null;
      },
      transform(code, id) {
        transformedModuleIds.push(id.replaceAll("\\", "/"));
        return id.replaceAll("\\", "/").endsWith("/src/player/exportEntry.ts")
          ? `import ${JSON.stringify(virtualImport)};\n${code}` : null;
      },
    } satisfies Plugin;
    try {
      await build({
        configFile: resolve("vite.standalone.config.ts"),
        configLoader: "runner",
        envDir: false,
        cacheDir: join(temporary, "cache"),
        logLevel: "silent",
        plugins: [queueImportControl],
        build: { outDir: outputDir, emptyOutDir: true },
      });
      assertEditorTransformInventory(transformedModuleIds);
      expect(forbiddenPlayerModules(transformedModuleIds)).toEqual([virtualId]);
      await expect(scanPlayerArtifacts(outputDir)).rejects.toMatchObject({
        name: "PlayerArtifactScanError",
        findings: [{ label: "queue-runtime", fileCount: 1 }],
      });
      console.info(JSON.stringify({ target: "standalone-negative-control", queueModuleDetected: true,
        queueArtifactDetected: true }));
    } finally {
      await rm(temporary, { recursive: true, force: true });
      expect(existsSync(temporary)).toBe(false);
      console.info(JSON.stringify({ target: "standalone-negative-control", temporaryRemoved: true }));
    }
  }, 120_000);

  it("rejects a disposable forbidden import and fake secret without echoing matched values", async () => {
    // Given
    const outputDir = await mkdtemp(join(tmpdir(), "rpgzzu-player-adversarial-"));
    const fakeSecret = "FAKE_PLAYER_SECRET_TEST_ONLY_DO_NOT_ECHO";
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

function forbiddenPlayerModules(ids: readonly string[]): string[] {
  return ids.filter((id) =>
    /(?:\/src\/ai\/|\/scripts\/lib\/aiJobs\/|\/src\/(?:project\/store|app\/mode)\.ts(?:\?|$)|supabaseProject(?:Config|Sync)|tileMetadataDb)/iu.test(id),
  );
}

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
