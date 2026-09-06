import ts from "typescript";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const changed = ["src/project/lifeStateReconciliation.ts", "src/project/itemTransitions.ts", "src/project/session.ts", "test/lifeRecoveryRecordKeys.test.ts"];
const configPath = resolve("tsconfig.app.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram([...new Set([...parsed.fileNames, ...changed.map((file) => resolve(file))])], parsed.options);
let failed = false;
for (const path of changed) {
  const source = program.getSourceFile(resolve(path));
  if (!source) throw new Error(`Missing source: ${path}`);
  const diagnostics = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
  console.log(JSON.stringify({ path, diagnostics: diagnostics.map((entry) => ({ code: entry.code, category: entry.category, start: entry.start, message: ts.flattenDiagnosticMessageText(entry.messageText, "\n") })) }));
  failed ||= diagnostics.length > 0;
}
for (const name of ["diagnostics.mjs", "run.mjs", "reserved-key-probe.mjs", "public-roundtrip.mjs", "public-roundtrip.initial.mjs"]) {
  const path = `.omo/evidence/life-full-20260906/30/${name}`;
  const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
  console.log(JSON.stringify({ command: [process.execPath, "--check", path], exit: result.status, stdout: result.stdout, stderr: result.stderr }));
  failed ||= result.status !== 0;
}
process.exitCode = failed ? 1 : 0;
