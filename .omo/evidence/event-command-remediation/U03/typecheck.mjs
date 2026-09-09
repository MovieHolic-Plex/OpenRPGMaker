import ts from "typescript";
import { resolve } from "node:path";
const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const files = [
  "src/editor/panels/eventEditor/transferPlayerDialog.ts",
  "test/eventCommandRemediation/U03.test.ts",
  "test/eventCommandRemediation/U03.fixture.ts",
  "test/e2e/event-command-remediation-U03.spec.ts",
  ".omo/evidence/event-command-remediation/U03/playwright.config.mts",
].map(file => resolve(file));
const program = ts.createProgram([...new Set([...parsed.fileNames, ...files])], { ...parsed.options, noEmit: true });
let failed = false;
for (const path of files) {
  const file = program.getSourceFile(path);
  if (!file) throw new Error(`Missing diagnostic source ${path}`);
  const diagnostics = [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)];
  console.log(path, `${diagnostics.length} diagnostics`);
  for (const diagnostic of diagnostics) console.log(ts.formatDiagnosticsWithColorAndContext([diagnostic], {
    getCurrentDirectory: () => process.cwd(), getCanonicalFileName: file => file, getNewLine: () => "\n",
  }));
  failed ||= diagnostics.length > 0;
}
process.exitCode = failed ? 1 : 0;
