// 최상위 선언을 다른 파일로 옮긴다: 글을 잘라 새 파일에 붙이고, 새 파일이 쓸 임포트를 원래 파일의 임포트·남은 선언에서 만들고,
// 원래 파일이 옮긴 것을 아직 쓰면 새 파일에서 끌어오게 한다. 다른 파일들의 임포트는 reimport.mts 로 고친다(이 도구가 끝에 부른다).
// 남는 군더더기(안 쓰는 임포트)는 tsloop.py --fix 가 걷는다.
// usage: bun movedecls.mts <repo> <fromFile> <toFile> <name> [name…]     toFile 이 있으면 뒤에 붙인다. --header "<주석 줄>" 로 새 파일 머리 주석.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, normalize } from "node:path";

const argv = process.argv.slice(2);
const headerAt = argv.indexOf("--header");
const header = headerAt >= 0 ? argv.splice(headerAt, 2)[1]! : "";
const [repo, fromFile, toFile, ...names] = argv as string[];
const ts = (await import(join(repo!, "node_modules/typescript5/lib/typescript.js"))).default as typeof import("typescript");
type Node = import("typescript").Node;
const want = new Set(names);
const strip = (p: string) => p.replace(/\.(ts|tsx|mts|js|mjs)$/u, "");
const text = readFileSync(join(repo!, fromFile!), "utf8");
const sf = ts.createSourceFile(fromFile!, text, ts.ScriptTarget.Latest, true);

const namesOf = (st: import("typescript").Statement): string[] => {
  if (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) return st.name ? [st.name.text] : [];
  if (ts.isVariableStatement(st)) return st.declarationList.declarations.map((d) => (ts.isIdentifier(d.name) ? d.name.text : ""));
  return [];
};
const isExported = (st: import("typescript").Statement) => !!(ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
const startOf = (node: Node) => { let start = node.getFullStart(); const nl = text.indexOf("\n", start); if (nl >= 0 && nl < node.getStart() && text.slice(start, nl).trim()) start = nl; return start; };
const idents = (nodes: readonly Node[]): Set<string> => { const out = new Set<string>(); const walk = (n: Node) => { if (ts.isIdentifier(n)) out.add(n.text); n.forEachChild(walk); }; nodes.forEach(walk); return out; };

const moving = sf.statements.filter((st) => !ts.isImportDeclaration(st) && namesOf(st).some((n) => want.has(n)));
const movedNames = new Set(moving.flatMap(namesOf));
for (const n of want) if (!movedNames.has(n)) { console.error(`못 찾음: ${n}`); process.exit(1); }
const staying = sf.statements.filter((st) => !ts.isImportDeclaration(st) && !moving.includes(st));
const usedByMoved = idents(moving), usedByStaying = idents(staying);

/** 새 파일에서 본 경로 글 — 별칭(@/)은 그대로, 상대 경로는 새 파일 기준으로 다시. */
const respec = (spec: string): string => {
  if (!spec.startsWith(".")) return spec;
  const ext = /\.(ts|mts|js|mjs)$/u.exec(spec)?.[0] ?? "";
  let rel = relative(dirname(toFile!), strip(normalize(join(dirname(fromFile!), spec)))).replace(/\\/gu, "/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return `${rel}${ext}`;
};
const relTo = (fromDirFile: string, target: string) => { let rel = relative(dirname(fromDirFile), strip(target)).replace(/\\/gu, "/"); if (!rel.startsWith(".")) rel = `./${rel}`; return rel; };

// 1) 새 파일이 쓸 임포트: 원래 파일의 임포트 가운데 옮긴 글이 쓰는 이름
const existing = existsSync(join(repo!, toFile!)) ? readFileSync(join(repo!, toFile!), "utf8") : "";
const already = new Set<string>();
if (existing) for (const st of ts.createSourceFile(toFile!, existing, ts.ScriptTarget.Latest, true).statements) {
  if (!ts.isImportDeclaration(st) || !st.importClause) continue;
  if (st.importClause.name) already.add(st.importClause.name.text);
  const nb = st.importClause.namedBindings;
  if (nb && ts.isNamedImports(nb)) nb.elements.forEach((e) => already.add(e.name.text));
  if (nb && ts.isNamespaceImport(nb)) already.add(nb.name.text);
}
const importLines: string[] = [];
for (const st of sf.statements) {
  if (!ts.isImportDeclaration(st) || !st.importClause) continue;
  const spec = respec((st.moduleSpecifier as import("typescript").StringLiteral).text);
  if (strip(normalize(join(dirname(toFile!), spec))) === strip(toFile!) && spec.startsWith(".")) continue; // 새 파일 자신
  const clause = st.importClause, typeOnly = clause.isTypeOnly ? " type" : "";
  const parts: string[] = [];
  if (clause.name && usedByMoved.has(clause.name.text) && !already.has(clause.name.text)) parts.push(clause.name.text);
  const nb = clause.namedBindings;
  if (nb && ts.isNamespaceImport(nb) && usedByMoved.has(nb.name.text) && !already.has(nb.name.text)) parts.push(`* as ${nb.name.text}`);
  if (nb && ts.isNamedImports(nb)) {
    const els = nb.elements.filter((e) => usedByMoved.has(e.name.text) && !already.has(e.name.text));
    if (els.length) parts.push(`{ ${els.map((e) => e.getText()).join(", ")} }`);
  }
  if (parts.length) importLines.push(`import${typeOnly} ${parts.join(", ")} from "${spec}";`);
}
// 2) 원래 파일에 남는 선언을 옮긴 글이 쓰면 원래 파일에서 끌어온다(export 가 없으면 붙인다)
const fromEdits: { start: number; end: number; put: string }[] = [];
const backNames: string[] = [];
for (const st of staying) {
  const used = namesOf(st).filter((n) => n && usedByMoved.has(n) && !movedNames.has(n));
  if (!used.length) continue;
  backNames.push(...used);
  if (!isExported(st)) fromEdits.push({ start: st.getStart(), end: st.getStart(), put: "export " });
}
if (backNames.length) importLines.push(`import { ${backNames.join(", ")} } from "${relTo(toFile!, fromFile!)}";`);

// 3) 옮긴 글 — 원래 파일이나 다른 파일이 쓰면 export 를 붙인다
const stillUsedInFrom = [...movedNames].filter((n) => usedByStaying.has(n));
const blocks = moving.map((st) => {
  let body = text.slice(startOf(st), st.end).replace(/^\n+/u, "");
  if (!isExported(st) && namesOf(st).some((n) => stillUsedInFrom.includes(n))) {
    const at = st.getStart() - startOf(st) - (text.slice(startOf(st), st.end).length - body.length);
    body = `${body.slice(0, at)}export ${body.slice(at)}`;
  }
  return body;
});
for (const st of moving) fromEdits.push({ start: startOf(st), end: st.end, put: "" });
// 원래 파일: 옮긴 것을 아직 쓰면 새 파일에서 끌어온다(마지막 임포트 뒤에)
if (stillUsedInFrom.length) {
  const lastImport = [...sf.statements].filter(ts.isImportDeclaration).pop();
  const at = lastImport ? lastImport.end : 0;
  fromEdits.push({ start: at, end: at, put: `\nimport { ${stillUsedInFrom.join(", ")} } from "${relTo(fromFile!, toFile!)}";` });
}
fromEdits.sort((a, b) => b.start - a.start || b.end - a.end);
let out = text;
for (const e of fromEdits) out = out.slice(0, e.start) + e.put + out.slice(e.end);
writeFileSync(join(repo!, fromFile!), out);

mkdirSync(dirname(join(repo!, toFile!)), { recursive: true });
if (existing) {
  // 있는 파일: 임포트는 마지막 임포트 뒤에, 선언은 끝에
  const esf = ts.createSourceFile(toFile!, existing, ts.ScriptTarget.Latest, true);
  const lastImport = [...esf.statements].filter(ts.isImportDeclaration).pop();
  const at = lastImport ? lastImport.end : 0;
  writeFileSync(join(repo!, toFile!), `${existing.slice(0, at)}${importLines.length ? `\n${importLines.join("\n")}` : ""}${existing.slice(at).replace(/\s*$/u, "")}\n\n${blocks.join("\n\n")}\n`);
} else writeFileSync(join(repo!, toFile!), `${header ? `${header}\n` : ""}${importLines.join("\n")}\n\n${blocks.join("\n\n")}\n`);

// 4) 다른 파일들의 임포트
const exportedMoved = moving.filter(isExported).flatMap(namesOf);
if (exportedMoved.length) console.log(execFileSync("bun", [join(import.meta.dir, "reimport.mts"), repo!, fromFile!, toFile!, ...exportedMoved], { encoding: "utf8" }).trim());
console.log(`moved ${[...movedNames].join(", ")} → ${toFile} · 원래 파일이 아직 쓰는 것 ${stillUsedInFrom.join(", ") || "-"} · 새 파일이 원래 파일에서 끌어오는 것 ${backNames.join(", ") || "-"}`);
