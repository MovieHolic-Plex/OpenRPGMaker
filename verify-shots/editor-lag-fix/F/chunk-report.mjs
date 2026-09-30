// 사용법: VITE_CACHE_DIR=<경로> node chunk-report.mjs <outDir> <reportFile>
// 번들 청크별·모듈별 렌더 크기를 JSON 으로 낸다(빌드 자체는 vite.config.ts 그대로).
import { build } from "vite";
import { writeFileSync } from "node:fs";
const [outDir, reportFile] = process.argv.slice(2);
const report = { chunks: [] };
const cwd = process.cwd() + "/";
const reporter = {
  name: "chunk-report",
  generateBundle(_o, bundle) {
    for (const [file, c] of Object.entries(bundle)) {
      if (c.type !== "chunk") continue;
      const mods = Object.entries(c.modules)
        .map(([id, m]) => ({ id: id.replace(cwd, ""), size: m.renderedLength }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 40);
      report.chunks.push({ file, size: c.code.length, isEntry: c.isEntry, imports: c.imports, dynamicImports: c.dynamicImports, top: mods });
    }
  },
};
await build({ configFile: "vite.config.ts", plugins: [reporter], build: { outDir, emptyOutDir: true }, logLevel: "warn" });
report.chunks.sort((a, b) => b.size - a.size);
writeFileSync(reportFile, JSON.stringify(report, null, 1));
console.log("done", report.chunks.length);
