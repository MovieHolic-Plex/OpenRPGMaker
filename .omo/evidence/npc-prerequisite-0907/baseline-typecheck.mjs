import ts from "typescript";
import { execFileSync } from "node:child_process";
import path from "node:path";

// Read-only compiler-host overlay of exact-base source. No second checkout, copies,
// dependency install, source reset or edits in another agent's worktree.
const root = process.cwd();
const base = "954e02ee7d371cb5c91bf52b6d7023336db0f962";
const git = args => execFileSync("git", args, { encoding: "utf8" }).trim();
const changed = git(["diff", "--name-only", "--diff-filter=M", base, "--", "src", "test"]).split("\n").filter(file => file.endsWith(".ts"));
const newFiles = new Set([
  ...git(["diff", "--name-only", "--diff-filter=A", base, "--", "src", "test"]).split("\n"),
  ...git(["ls-files", "--others", "--exclude-standard", "src", "test"]).split("\n"),
]);
const overrides = new Map(changed.map(file => [path.join(root, file), execFileSync("git", ["show", `${base}:${file}`], { encoding: "utf8" })]));
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
parsed.options.noEmit = true;
const host = ts.createCompilerHost(parsed.options);
const readFile = host.readFile;
host.readFile = file => overrides.get(path.resolve(file)) ?? readFile(file);
const program = ts.createProgram(parsed.fileNames.filter(file => !newFiles.has(path.relative(root, file))), parsed.options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
for (const diagnostic of diagnostics) {
  const location = diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start) : undefined;
  const prefix = diagnostic.file && location ? `${path.relative(root, diagnostic.file.fileName)}(${location.line + 1},${location.character + 1}): ` : "";
  console.log(`${prefix}error TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`);
}
process.exitCode = diagnostics.length ? 2 : 0;
