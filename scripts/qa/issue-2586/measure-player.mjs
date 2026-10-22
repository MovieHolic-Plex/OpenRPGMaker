// Usage: node measure-player.mjs <repoRoot> <strip|nostrip> <outDir>
import { build, loadConfigFromFile } from "vite";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import path from "node:path";
const [repo, mode, outDir] = process.argv.slice(2);
process.chdir(repo);
const loaded = await loadConfigFromFile({ command: "build", mode: "production" }, path.join(repo, "vite.player.config.ts"), repo, "silent", undefined, "runner");
const cfg = loaded.config;
let plugins = cfg.plugins.flat();
if (mode === "nostrip") plugins = plugins.filter((p) => p?.name !== "oprn-player-editor-only-assets");
const report = { mode, chunks: [] };
plugins.push({
  name: "measure",
  generateBundle(_o, bundle) {
    for (const [file, chunk] of Object.entries(bundle)) {
      if (chunk.type !== "chunk") continue;
      const refs = Object.entries(chunk.modules).filter(([id, m]) => /References\.json/.test(id) && m.renderedLength > 4);
      report.chunks.push({ file, bytes: Buffer.byteLength(chunk.code), gzip: gzipSync(chunk.code).length,
        refModules: refs.length, refBytes: refs.reduce((s, [, m]) => s + m.renderedLength, 0),
        refs: refs.map(([id, m]) => [path.basename(id.split("?")[0]), m.renderedLength]) });
    }
  },
});
await build({ ...cfg, configFile: false, root: repo, logLevel: "warn", plugins, build: { ...cfg.build, outDir, emptyOutDir: true } });
report.chunks.sort((a, b) => b.bytes - a.bytes);
const total = report.chunks.reduce((s, c) => s + c.bytes, 0);
const big = report.chunks[0];
console.log(JSON.stringify({ mode, totalJsBytes: total, chunkCount: report.chunks.length,
  largest: { file: big.file, bytes: big.bytes, gzip: big.gzip },
  refModules: report.chunks.reduce((s, c) => s + c.refModules, 0),
  refBytes: report.chunks.reduce((s, c) => s + c.refBytes, 0),
  refs: report.chunks.flatMap((c) => c.refs) }, null, 1));
