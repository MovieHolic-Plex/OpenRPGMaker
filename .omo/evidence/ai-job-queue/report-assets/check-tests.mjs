import ts from 'typescript';
import { resolve } from 'node:path';
const root = process.cwd();
const configPath = resolve(root, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const files = ['test/aiReportAssetsPayload.test.ts', 'test/aiJobWorkerRouting.test.ts'].map(file => resolve(root, file));
const program = ts.createProgram(files, { ...parsed.options, noEmit: true });
const diagnostics = [...program.getOptionsDiagnostics(), ...files.flatMap(file => {
  const source = program.getSourceFile(file);
  if (!source) throw new Error(`Missing changed test: ${file}`);
  return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
})];
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  process.exitCode = 1;
} else console.log('Changed test syntax/semantic diagnostics: 0 (2 files; app is checked separately with typecheck:app)');
