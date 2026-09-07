import ts from "typescript";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

// File-scoped compiler diagnostics, with the base test overlaid in memory only.
const base = "6f203da81c6d9d956a0e4b8d23c3f9f0a2b23c19";
const relative = "test/assistantVerificationEvidence.test.ts";
const file = resolve(relative);
const mode = process.argv[2];
if (mode !== "base" && mode !== "candidate") throw new Error("Expected base or candidate");
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
if (parsed.errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
  getCanonicalFileName: (name) => name,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => "\n",
}));
const host = ts.createCompilerHost(parsed.options);
if (mode === "base") {
  const source = execFileSync("git", ["show", `${base}:${relative}`], { encoding: "utf8" });
  const readFile = host.readFile.bind(host);
  host.readFile = (name) => resolve(name) === file ? source : readFile(name);
}
const program = ts.createProgram([file], { ...parsed.options, noEmit: true }, host);
const source = program.getSourceFile(file);
if (!source) throw new Error("Test source missing from program");
const diagnostics = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
console.log(JSON.stringify({ mode, base, typescript: ts.version, file: relative, diagnostics: diagnostics.map((d) => {
  const position = source.getLineAndCharacterOfPosition(d.start ?? 0);
  return {
    code: d.code, category: ts.DiagnosticCategory[d.category],
    line: position.line + 1, column: position.character + 1,
    sourceLine: source.text.split("\n")[position.line],
    message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
  };
}) }, null, 2));
process.exitCode = diagnostics.some((d) => d.category === ts.DiagnosticCategory.Error) ? 2 : 0;
