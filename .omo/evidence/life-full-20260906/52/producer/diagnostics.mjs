import ts from 'typescript';
import path from 'node:path';
const files = ['src/project/databaseRecordModel.ts', 'test/playerBodyProjectPersistence.test.ts', '.omo/evidence/life-full-20260906/52/producer/public-probe.ts'];
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
if (parsed.errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, { getCurrentDirectory: ts.sys.getCurrentDirectory, getCanonicalFileName: f => f, getNewLine: () => '\n' }));
const program = ts.createProgram([...new Set([...parsed.fileNames, ...files.map(f => path.resolve(f))])], parsed.options);
const results = files.map(file => {
  const source = program.getSourceFile(path.resolve(file));
  if (!source) throw new Error(`Missing source: ${file}`);
  return { file, diagnostics: [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)].map(d => ({ code: d.code, category: d.category, line: d.start === undefined ? undefined : source.getLineAndCharacterOfPosition(d.start).line + 1, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') })) };
});
console.log(JSON.stringify({ config: 'tsconfig.json', additionalRoot: files[2], results }, null, 2));
process.exitCode = results.some(r => r.diagnostics.length) ? 1 : 0;
