// Run from the worktree root; pass an existing official bun-types/index.d.ts.
// No dependency installation, ambient stubs, or diagnostic filtering.
import ts from "typescript";
import { writeFileSync } from "node:fs";
if (!process.argv[2]) throw new Error("Pass the installed/cached official bun-types/index.d.ts path");
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const roots = [
  "scripts/lib/ohMyPiToolEnums.ts", "scripts/lib/ohMyPiPiAiRuntime.ts",
  "test/ohMyPiNumericEnum.bun.test.ts", "test/ohMyPiToolEnums.bun.test.ts",
  "test/ohMyPiNumericEnumLocal.test.ts", "test/helpers/offlineFetch.ts",
  ...parsed.fileNames.filter(path => path.endsWith(".d.ts")), process.argv[2],
];
const program = ts.createProgram(roots, { ...parsed.options, noEmit: true, types: ["node"] });
const diagnostics = ts.getPreEmitDiagnostics(program);
const text = ts.formatDiagnostics(diagnostics, {
  getCanonicalFileName: path => path, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n",
});
const output = `Focused tsc, all transitive diagnostics included; Bun types: ${process.argv[2]}\n${text}\nDIAGNOSTICS=${diagnostics.length}\n`;
writeFileSync("evidence/ai-provider-enum-0907/focused-typecheck-output.txt", output);
console.log(output);
process.exitCode = diagnostics.length ? 1 : 0;
