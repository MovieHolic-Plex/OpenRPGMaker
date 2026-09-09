import ts from "typescript";
import path from "node:path";

const files = [
  "test/aiBlockedContinue.test.ts",
  "test/aiToolCallSessionProtocol.test.ts",
  "test/assistantSessionIntent.test.ts",
];
const configFile = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
if (config.errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(config.errors, {
  getCanonicalFileName: name => name, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n",
}));
const program = ts.createProgram(config.fileNames, { ...config.options, noEmit: true, incremental: false });
let errors = 0;
for (const file of files) {
  const source = program.getSourceFile(path.resolve(file));
  if (!source) throw new Error(`Missing compiler source: ${file}`);
  const diagnostics = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
  console.log(`${file}: ${diagnostics.length} diagnostics`);
  for (const diagnostic of diagnostics) {
    console.log(ts.formatDiagnostic(diagnostic, {
      getCanonicalFileName: name => name, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n",
    }));
  }
  errors += diagnostics.length;
}
process.exitCode = errors ? 1 : 0;
