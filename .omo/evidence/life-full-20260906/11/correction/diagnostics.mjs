import ts from "typescript";
import { writeFileSync } from "node:fs";
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram(parsed.fileNames, parsed.options);
const files = ["src/project/spatialPlacementTransactions.ts", "test/linkedAnimalHousing.test.ts"];
const diagnostics = files.flatMap(file => {
  const source = program.getSourceFile(file);
  if (!source) throw new Error(`Missing source ${file}`);
  return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
});
const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: name => name, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n",
});
writeFileSync(new URL("./diagnostic-results.json", import.meta.url), JSON.stringify({ files, count: diagnostics.length, diagnostics: formatted }, null, 2) + "\n", { flag: "wx" });
console.log(formatted || "No syntactic or semantic diagnostics on changed product/test files.");
process.exit(diagnostics.length ? 1 : 0);
