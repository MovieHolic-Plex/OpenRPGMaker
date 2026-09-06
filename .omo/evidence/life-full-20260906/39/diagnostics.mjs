import ts from 'typescript';
import { resolve } from 'node:path';
const changed = ['src/player/player.ts', 'src/player/playerStatusMenuController.ts', 'test/lifePlayerSaveFailures.test.ts'];
const config = ts.readConfigFile(resolve('tsconfig.app.json'), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram([...new Set([...parsed.fileNames, ...changed.map(file => resolve(file))])], parsed.options);
let failed = false;
for (const path of changed) {
  const source = program.getSourceFile(resolve(path));
  if (!source) throw new Error(`Missing source: ${path}`);
  const diagnostics = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
  console.log(JSON.stringify({path, diagnostics: diagnostics.map(entry => ({code: entry.code, category: entry.category, start: entry.start, message: ts.flattenDiagnosticMessageText(entry.messageText, '\n')}))}));
  failed ||= diagnostics.length > 0;
}
process.exitCode = failed ? 1 : 0;
