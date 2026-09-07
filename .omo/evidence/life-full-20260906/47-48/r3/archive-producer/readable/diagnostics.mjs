// NEW r3 configured diagnostics.
import ts from "/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3/node_modules/typescript/lib/typescript.js";
import path from "node:path";
const files = ["src/project/lifeRecovery.ts", "src/project/lifeStateReconciliation.ts", "src/project/spatialPlacementTransactions.ts", "src/player/saveSlotSpatialValidation.ts", "test/spatialRecoveryRights.test.ts", "test/spatialPaymentReceipts.test.ts", "test/linkedAnimalHousing.test.ts", "test/lifePlacementSafety.test.ts", "/home/main/z-project/rpg-zzu-life-full-p4/.omo/evidence/life-full-20260906/47-48/r3/producer/public-rights.mts"];
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
