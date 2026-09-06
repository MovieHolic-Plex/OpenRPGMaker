import ts from "typescript";
import { resolve } from "node:path";
const cwd = process.cwd();
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, cwd);
const files = ["src/player/runtimeDom.ts", "src/player/playSceneMovement.ts", "src/player/playSceneMapRuntime.ts", "src/player/playSceneTestHooks.ts", "src/testing/sceneTestRunner.ts", "test/lifeQaObservability.test.ts", "test/fixtures/life-full/qaObservability.ts"];
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
  if (process.argv.includes('--references')) {
    for (const [file, needle] of [["src/player/runtimeDom.ts", "interface RuntimeStateSnapshot"], ["src/player/playSceneTestHooks.ts", "readState:"], ["src/player/playSceneMovement.ts", "function handleAction"]]) {
      const path = resolve(file), source = ts.sys.readFile(path), position = source.indexOf(needle) + needle.lastIndexOf(' ') + 1;
      console.log(JSON.stringify({file,needle,references:service.getReferencesAtPosition(path, position)}));
    }
  } else for (const file of files) {
    const path = resolve(file);
    const diagnostics = [...service.getSyntacticDiagnostics(path), ...service.getSemanticDiagnostics(path)];
    console.log(JSON.stringify({ file, diagnostics: diagnostics.map(d => ({ code: d.code, category: ts.DiagnosticCategory[d.category], line: d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : undefined, message: ts.flattenDiagnosticMessageText(d.messageText, "\n") })) }));
    errors += diagnostics.length;
  }
} finally { service.dispose(); }
console.log(JSON.stringify({ files: files.length, diagnostics: errors }));
process.exitCode = errors ? 1 : 0;
