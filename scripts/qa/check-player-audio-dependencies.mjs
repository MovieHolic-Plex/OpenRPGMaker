import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { build } from "vite";

const output = process.argv[2];
assert.ok(output, "Pass a dependency-evidence JSON path");
const root = process.cwd();
const normalizeId = (id) => relative(root, id.split("?")[0]).replaceAll("\\", "/");
const forbidden = [
  "src/assets/audioResourceCatalog.ts",
  "src/assets/bgmCatalog.ts",
  "src/assets/seCatalog.ts",
];
const required = [
  "src/assets/bgmCatalogRuntime.ts",
  "src/assets/seCatalogRuntime.ts",
];
let evidence;

await build({
  configFile: resolve(root, "vite.player.config.ts"),
  configLoader: "runner",
  build: { write: false },
  plugins: [{
    name: "qa-player-audio-dependency-evidence",
    apply: "build",
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle)
        .filter((entry) => entry.type === "chunk")
        .map((chunk) => ({
          fileName: chunk.fileName,
          isEntry: chunk.isEntry,
          imports: chunk.imports,
          dynamicImports: chunk.dynamicImports,
          modules: Object.entries(chunk.modules)
            .filter(([, info]) => info.renderedLength > 0)
            .map(([id]) => normalizeId(id))
            .sort(),
        }))
        .sort((left, right) => left.fileName.localeCompare(right.fileName));
      const shipped = new Set(chunks.flatMap((chunk) => chunk.modules));
      evidence = {
        chunks,
        forbiddenPresent: forbidden.filter((id) => shipped.has(id)),
        requiredMissing: required.filter((id) => !shipped.has(id)),
      };
    },
  }],
});

assert.ok(evidence, "Production player build emitted no dependency evidence");
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
assert.ok(evidence.chunks.some((chunk) => chunk.isEntry));
assert.deepEqual(evidence.forbiddenPresent, []);
assert.deepEqual(evidence.requiredMissing, []);
