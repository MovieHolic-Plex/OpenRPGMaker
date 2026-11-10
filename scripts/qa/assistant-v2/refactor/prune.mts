// 최상위 선언 지우기 · export 떼기 · 안 쓰는 import 지우기 코드모드(TS AST 로 위치를 찾고 글을 잘라 낸다).
// usage: bun prune.mts <repo> <ops.json>     ops = { remove:[{file,name}], unexport:[{file,name}], unimport:[{file,name}] }
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [repo, opsPath] = process.argv.slice(2) as [string, string];
const ts = (await import(join(repo, "node_modules/typescript5/lib/typescript.js"))).default as typeof import("typescript");
type Op = { file: string; name: string };
const ops = JSON.parse(readFileSync(opsPath, "utf8")) as { remove?: Op[]; unexport?: Op[]; unimport?: Op[] };
const byFile = new Map<string, { remove: Set<string>; unexport: Set<string>; unimport: Set<string> }>();
const slot = (file: string) => byFile.get(file) ?? byFile.set(file, { remove: new Set(), unexport: new Set(), unimport: new Set() }).get(file)!;
for (const o of ops.remove ?? []) slot(o.file).remove.add(o.name);
for (const o of ops.unexport ?? []) slot(o.file).unexport.add(o.name);
for (const o of ops.unimport ?? []) slot(o.file).unimport.add(o.name);

const report: string[] = [];
for (const [file, want] of byFile) {
  const path = join(repo, file);
  const text = readFileSync(path, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const edits: { start: number; end: number; put: string }[] = [];
  const done = { remove: new Set<string>(), unexport: new Set<string>(), unimport: new Set<string>() };
  /** 선언문 통째(앞 주석 포함). 앞 문장과 같은 줄에 붙은 꼬리 주석은 남긴다. */
  const cut = (node: import("typescript").Node) => {
    let start = node.getFullStart();
    const nl = text.indexOf("\n", start);
    if (nl >= 0 && nl < node.getStart() && text.slice(start, nl).trim()) start = nl;
    edits.push({ start, end: node.end, put: "" });
  };
  const namesOf = (st: import("typescript").Statement): string[] => {
    if (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) return st.name ? [st.name.text] : [];
    if (ts.isVariableStatement(st)) return st.declarationList.declarations.map((d) => (ts.isIdentifier(d.name) ? d.name.text : ""));
    return [];
  };
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) {
      const clause = st.importClause;
      if (!clause) continue;
      const named = clause.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : undefined;
      const dropDefault = !!clause.name && want.unimport.has(clause.name.text);
      const drop = (named ?? []).filter((e) => want.unimport.has(e.name.text));
      const star = clause.namedBindings && ts.isNamespaceImport(clause.namedBindings) && want.unimport.has(clause.namedBindings.name.text);
      if (!dropDefault && !drop.length && !star) continue;
      for (const e of drop) done.unimport.add(e.name.text);
      if (dropDefault) done.unimport.add(clause.name!.text);
      if (star) done.unimport.add((clause.namedBindings as import("typescript").NamespaceImport).name.text);
      const keepNamed = (named ?? []).filter((e) => !drop.includes(e));
      const keepDefault = clause.name && !dropDefault;
      if (!keepNamed.length && !keepDefault && (star || !clause.namedBindings || named)) { cut(st); continue; }
      if (drop.length && named) {
        // 남는 것만으로 { … } 를 다시 쓴다(원래 한 줄/여러 줄 모양은 유지하지 않는다 — 한 줄로).
        const bindings = clause.namedBindings!;
        if (keepNamed.length) edits.push({ start: bindings.getStart(), end: bindings.end, put: `{ ${keepNamed.map((e) => e.getText()).join(", ")} }` });
        else if (keepDefault) edits.push({ start: clause.name!.end, end: bindings.end, put: "" });
      }
      if (dropDefault && keepNamed.length) edits.push({ start: clause.name!.getStart(), end: clause.namedBindings!.getStart(), put: "" });
      continue;
    }
    const names = namesOf(st);
    if (!names.length) continue;
    if (names.some((n) => want.remove.has(n))) {
      if (names.length === 1) { cut(st); done.remove.add(names[0]!); }
      else if (ts.isVariableStatement(st) && names.every((n) => want.remove.has(n))) { cut(st); names.forEach((n) => done.remove.add(n)); }
      else report.push(`${file}: 한 문장에 선언이 여럿이라 손으로 — ${names.join(", ")}`);
      continue;
    }
    if (names.some((n) => want.unexport.has(n))) {
      const mod = (ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined)?.find((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (mod) { let end = mod.end; while (text[end] === " ") end += 1; edits.push({ start: mod.getStart(), end, put: "" }); }
      names.forEach((n) => done.unexport.add(n));
    }
  }
  for (const kind of ["remove", "unexport", "unimport"] as const) for (const n of want[kind]) if (!done[kind].has(n)) report.push(`${file}: ${kind} ${n} — 최상위에서 못 찾음`);
  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.put + out.slice(e.end);
  writeFileSync(path, out);
}
console.log(`files ${byFile.size}${report.length ? `\n${report.join("\n")}` : ""}`);
