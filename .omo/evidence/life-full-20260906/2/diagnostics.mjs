import ts from "typescript";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const cwd = process.cwd();
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, cwd);
const changed = [...new Set([
  ...execFileSync("git", ["diff", "87de73785d1c309bbbe975636414f70bbc73a4b9", "--name-only"], { encoding: "utf8" }).trim().split("\n"),
  ...execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" }).trim().split("\n"),
])].filter(path => path.endsWith(".ts"));
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
for (const path of changed) {
  const absolute = resolve(path);
  const diagnostics = [...service.getSyntacticDiagnostics(absolute), ...service.getSemanticDiagnostics(absolute)];
  console.log(JSON.stringify({ file: path, diagnostics: diagnostics.map(d => ({ code: d.code, category: ts.DiagnosticCategory[d.category], line: d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : undefined, message: ts.flattenDiagnosticMessageText(d.messageText, "\n") })) }));
  errors += diagnostics.length;
}
const savePath = resolve("src/player/saveSlots.ts");
const source = ts.sys.readFile(savePath);
for (const symbol of ["createSaveSnapshot", "saveSlotKey", "autosaveKey"]) {
  const offset = source.indexOf(`export function ${symbol}`) + "export function ".length;
  const references = service.getReferencesAtPosition(savePath, offset) ?? [];
  console.log(JSON.stringify({ symbol, references: references.filter(r => r.fileName.includes("/src/")).map(r => ({ file: r.fileName.replace(`${cwd}/`, ""), span: r.textSpan })) }));
}
service.dispose();
console.log(JSON.stringify({ changedFiles: changed.length, diagnostics: errors }));
process.exitCode = errors ? 1 : 0;
