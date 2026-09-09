import ts from "typescript";
import path from "node:path";
const files = ["src/project/spatialOccupancy.ts", "src/project/spatialPlacementTransactions.ts", "src/project/spatialPlacementRestore.ts", "src/player/farming.ts", "test/lifePlacementSafety.test.ts"];
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram([...parsed.fileNames, ...files.map(file => path.resolve(file))], parsed.options);
const results = files.map(file => {
  const source = program.getSourceFile(path.resolve(file));
  if (!source) throw new Error(`Missing source ${file}`);
  const diagnostics = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
  return { file, diagnostics: diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")) };
});
console.log(JSON.stringify(results, null, 2));
process.exitCode = results.some(result => result.diagnostics.length) ? 1 : 0;
