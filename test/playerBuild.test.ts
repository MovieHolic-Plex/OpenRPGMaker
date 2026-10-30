import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { build, type Plugin } from "vite";
import { describe, expect, it } from "vitest";

const PLAYER_ENV_PREFIX = "OPENRPG_PLAYER_";
const TEXT_ARTIFACT_PATTERN = /\.(?:css|html|js|map)$/u;
const FORBIDDEN_ARTIFACT_MARKERS = [
  {
    label: "remote-database-client",
    pattern: /(?:legacyDbProject(?:Config|Sync)|recordLegacyDb|loadProjectFromLegacyDb|saveProjectToLegacyDb)/iu,
  },
  { label: "remote-activity-table", pattern: /ai_(?:activity_logs|analysis_runs)/iu },
  { label: "editor-ai-module", pattern: /(?:@\/|src\/)ai\/activityLog/iu },
  { label: "editor-module-path", pattern: /src\/editor\//iu },
  { label: "remote-provider", pattern: /(?:openrouter|llm-provider)/iu },
  { label: "remote-activity-endpoint", pattern: /__oprn\/ai-activity/iu },
  { label: "editor-public-env", pattern: /VITE_(?:LLM|LEGACY_DB|YUNWU)/u },
  { label: "remote-api-endpoint", pattern: /api\.(?:anthropic|openai)\.com/iu },
] as const;
/**
 * 번들 타일셋 정의 JSON(src/assets/*Tileset.json, 지연 17종)에만 있는 글자. 플레이어 첫 로드(player.js 와 그 정적 import 청크)에
 * 이게 보이면 정의가 다시 진입 청크로 들어온 것이다 — 2026-10-30 전에는 52MB 청크가 첫 프레임을 막았다.
 */
const TILESET_DEFINITION_MARKERS = [
  /libraryEnd/u,
  /버들항 v6 언덕\(저택·성당\) 성벽/u,
  /조선 지형 동굴 천장\(벽 윗면\)/u,
] as const;
/** bundledJsonSources.lazy.ts 의 지연 키 수 — 각각 assets/<key>-<hash>.json 으로 따로 실린다. */
const LAZY_TILESET_DEFINITION_COUNT = 17;

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
      const firstLoad = await staticEntryChunks(outputDir, html);
      const firstLoadWithDefinitions = (await Promise.all(firstLoad.map(async (file) => {
        const content = await readFile(file, "utf8");
        return TILESET_DEFINITION_MARKERS.some((marker) => marker.test(content)) ? [relative(outputDir, file)] : [];
      }))).flat();
      const definitionAssets = files.filter((file) => /[\\/]assets[\\/][A-Za-z]+Tileset-[A-Za-z0-9_-]+\.json$/u.test(file));
      const forbiddenModules = transformedModuleIds.filter((id) =>
        /(?:\/src\/ai\/|legacyDbProject(?:Config|Sync)|tileMetadataDb)/iu.test(id),
      );

      // Then
      expect(files.some((file) => file.endsWith("player.js"))).toBe(true);
      expect(files.some((file) => file.endsWith("player-manifest.json"))).toBe(true);
      expect(html).toContain('<div id="app"></div>');
      expect(html).toContain("player.js");
      expect(forbiddenModules).toEqual([]);
      expect(report.findings).toEqual([]);
      expect(report.scannedFileCount).toBeGreaterThan(0);
      expect(firstLoad.some((file) => file.endsWith("player.js"))).toBe(true);
      expect(firstLoadWithDefinitions).toEqual([]);
      expect(definitionAssets).toHaveLength(LAZY_TILESET_DEFINITION_COUNT);
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

/** player.html 이 싣는 스크립트·modulepreload 와, 거기서 정적 import(`from"…js"`·`import"…js"`)로 닿는 청크 전부. 동적 import 는 뺀다. */
async function staticEntryChunks(root: string, html: string): Promise<readonly string[]> {
  const seen = new Set<string>();
  const queue = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+\.js)"/gu)].map((match) => resolve(root, match[1]!.replace(/^\//u, "")));
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const code = await readFile(file, "utf8");
    for (const match of code.matchAll(/(?:\bfrom|\bimport)\s*["']([^"']+\.js)["']/gu)) {
      queue.push(resolve(dirname(file), match[1]!));
    }
  }
  return [...seen].sort();
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
