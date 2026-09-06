import ts from "typescript";
import { resolve } from "node:path";
const cwd = process.cwd();
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, cwd);
const files = ["src/project/session.ts", "src/project/makers.ts", "src/project/lifeRecovery.ts", "src/player/saveSlotValidation.ts", "test/lifeRecovery.test.ts"];
const service = ts.createLanguageService({
  getScriptFileNames: () => parsed.fileNames,
  getScriptVersion: () => "0",
  getScriptSnapshot: path => { const text = ts.sys.readFile(path); return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text); },
  getCurrentDirectory: () => cwd,
  getCompilationSettings: () => parsed.options,
  getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
  fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists, getDirectories: ts.sys.getDirectories,
  useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
});
let errors = 0;
try {
  for (const file of files) {
    const path = resolve(file);
    const diagnostics = [...service.getSyntacticDiagnostics(path), ...service.getSemanticDiagnostics(path)];
    console.log(JSON.stringify({ file, diagnostics: diagnostics.map(d => ({ code: d.code, category: ts.DiagnosticCategory[d.category], line: d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : undefined, message: ts.flattenDiagnosticMessageText(d.messageText, "\n") })) }));
    errors += diagnostics.length;
  }
} finally { service.dispose(); }
console.log(JSON.stringify({ files: files.length, diagnostics: errors }));
process.exitCode = errors ? 1 : 0;
