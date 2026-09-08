import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
const root = process.cwd(), ref = process.argv[2];
const changed = execFileSync('git', ['diff', '--name-only', '--', 'src', 'test'], { encoding: 'utf8' }).trim().split('\n');
const added = ['test/historyRecoveryAdmission.test.ts', 'test/nonHistoryIntegrationSeams.test.ts'];
const files = [...new Set([...changed, ...added])].filter(file => file.endsWith('.ts'));
const cache = new Map();
const tracked = ref ? new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', ref], { encoding: 'utf8' }).trim().split('\n')) : null;
const read = file => {
  const name = relative(root, resolve(file));
  if (!ref || (!/^(src|test)\//.test(name) && !name.startsWith('tsconfig'))) return ts.sys.readFile(file);
  if (!tracked.has(name)) return undefined;
  if (!cache.has(name)) cache.set(name, execFileSync('git', ['show', `${ref}:${name}`], { encoding: 'utf8', maxBuffer: 20000000 }));
  return cache.get(name);
};
const config = ts.readConfigFile('tsconfig.json', read);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, { noEmit: true });
const host = ts.createCompilerHost(parsed.options);
host.readFile = read;
const exists = host.fileExists.bind(host);
host.fileExists = file => {
  const name = relative(root, resolve(file));
  return ref && /^(src|test)\//.test(name) ? tracked.has(name) : exists(file);
};
const selected = files.filter(file => !ref || tracked.has(file));
const ambient = parsed.fileNames.filter(file => file.endsWith('.d.ts') && (!ref || tracked.has(relative(root, file))));
const program = ts.createProgram([...selected.map(file => resolve(file)), ...ambient], parsed.options, host);
const diagnostics = selected.flatMap(file => {
  const source = program.getSourceFile(resolve(file));
  if (!source) throw new Error(`Missing diagnostic file ${file}`);
  return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)].map(d => ({
    file, code: d.code, line: d.start === undefined ? null : ts.getLineAndCharacterOfPosition(source, d.start).line + 1,
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
  }));
});
const report = { ref: ref ?? 'working-merge', files: selected, ambient, diagnostics };
writeFileSync(`.omo/evidence/integration-st01a08238/types-${ref?.slice(0,7) ?? 'current'}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = diagnostics.length ? 1 : 0;
