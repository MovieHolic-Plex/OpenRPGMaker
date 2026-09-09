import ts from "typescript";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const changed = execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" }).trim().split("\n").filter(p => p.endsWith(".ts"));
changed.push("test/lifeAuthoringBounds.test.ts");
const config = ts.readConfigFile(resolve("tsconfig.app.json"), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram([...new Set([...parsed.fileNames, ...changed.map(p => resolve(p))])], parsed.options);
let count = parsed.errors.length;
for (const path of changed) {
  const source = program.getSourceFile(resolve(path));
  if (!source) throw new Error(`Missing ${path}`);
  const diagnostics = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
  count += diagnostics.length;
  console.log(JSON.stringify({ path, diagnostics: diagnostics.map(d => ({ code: d.code, start: d.start, message: ts.flattenDiagnosticMessageText(d.messageText, "\n") })) }));
}
process.exitCode = count ? 1 : 0;
