// 큰 함수의 지역 문장들을 다른 파일의 공장 함수로 뗀다 — 문장 글은 그대로 옮기고, 밖에서 받아야 하는 지역 이름은 문맥 객체에서 푼다.
//
// usage: bun extractlocals.mts <repo> <file> <fn> <toFile> <factory> --names a,b,c [--stmt "<문장 첫머리>"]… [옵션]
//   --names a,b          옮길 지역 선언 이름(그 선언문 통째)
//   --stmt "session.x ="  이름 없는 문장(대입 등) — 첫머리 글로 고른다. 여러 번 쓸 수 있다
//   --ctx c:<file>:<Type> 공장이 문맥 객체 하나를 받는다(c: Type, Type 은 <file> 에서 type 임포트). 없으면 원래 함수의 인자를 그대로 받는다
//   --dep name=<file>:<factory>  문맥에 없는, 다른 공장이 돌려주는 이름 — 인자 형에 Pick<ReturnType<typeof factory>, "name"> 을 더한다
//   --also env,session   돌려줄 이름에 더한다(원래 함수의 인자를 문맥에 싣을 때)
//   --bind c             원래 자리에서 «const c = factory(…); const { … } = c;» 로 받는다(문맥을 만들 때)
//   --type VerbContext   새 파일에 «export type VerbContext = ReturnType<typeof factory>» 를 더한다
//   --header "// …"       새 파일 머리 주석
// 남는 군더더기(안 쓰는 임포트)는 tsloop.py --fix 가 걷는다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, normalize } from "node:path";

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => { const at = argv.indexOf(`--${name}`); return at >= 0 ? argv.splice(at, 2)[1] : undefined; };
const opts = (name: string): string[] => { const out: string[] = []; for (let v = opt(name); v !== undefined; v = opt(name)) out.push(v); return out; };
const names = new Set((opt("names") ?? "").split(",").filter(Boolean));
const stmtHeads = opts("stmt"), ctxOpt = opt("ctx"), deps = opts("dep"), also = (opt("also") ?? "").split(",").filter(Boolean), bind = opt("bind"), typeName = opt("type"), header = opt("header") ?? "";
const [repo, file, fnName, toFile, factory] = argv as string[];
const ts = (await import(join(repo!, "node_modules/typescript5/lib/typescript.js"))).default as typeof import("typescript");
type Node = import("typescript").Node;
const strip = (p: string) => p.replace(/\.(ts|tsx|mts|js|mjs)$/u, "");
const text = readFileSync(join(repo!, file!), "utf8");
const sf = ts.createSourceFile(file!, text, ts.ScriptTarget.Latest, true);
const fn = sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === fnName) as import("typescript").FunctionDeclaration;
if (!fn?.body) { console.error(`함수 못 찾음: ${fnName}`); process.exit(1); }

const bindNames = (n: import("typescript").BindingName): string[] => ts.isIdentifier(n) ? [n.text] : n.elements.flatMap((e) => (ts.isOmittedExpression(e) ? [] : bindNames(e.name)));
const declared = (st: import("typescript").Statement): string[] => ts.isVariableStatement(st) ? st.declarationList.declarations.flatMap((d) => bindNames(d.name)) : ts.isFunctionDeclaration(st) && st.name ? [st.name.text] : [];
/** 값·형으로 쓰인 이름(속성 이름·객체 열쇠는 뺀다). 짧은 속성({ a })은 값이다. */
const used = (nodes: readonly Node[]): Set<string> => {
  const out = new Set<string>();
  const walk = (n: Node) => {
    if (ts.isIdentifier(n)) { const p = n.parent; if (!(ts.isPropertyAccessExpression(p) && p.name === n) && !(ts.isPropertyAssignment(p) && p.name === n) && !(ts.isPropertySignature(p) && p.name === n) && !(ts.isMethodDeclaration(p) && p.name === n) && !(ts.isBindingElement(p) && p.propertyName === n)) out.add(n.text); }
    n.forEachChild(walk);
  };
  nodes.forEach(walk);
  return out;
};
const startOf = (node: Node) => { let start = node.getFullStart(); const nl = text.indexOf("\n", start); if (nl >= 0 && nl < node.getStart() && text.slice(start, nl).trim()) start = nl; return start; };

const body = fn.body.statements;
const moving = body.filter((st) => declared(st).some((n) => names.has(n)) || stmtHeads.some((h) => st.getText().startsWith(h)));
const movedNames = new Set(moving.flatMap(declared));
for (const n of names) if (!movedNames.has(n)) { console.error(`지역 선언 못 찾음: ${n}`); process.exit(1); }
for (const h of stmtHeads) if (!moving.some((st) => st.getText().startsWith(h))) { console.error(`문장 못 찾음: ${h}`); process.exit(1); }
const staying = body.filter((st) => !moving.includes(st));
const localNames = new Set(body.flatMap(declared));
const params = fn.parameters.map((p) => ({ name: p.name.getText(), text: p.getText() }));
const usedByMoved = used(moving), usedByStaying = used(staying);

// 밖에서 받아야 하는 이름: 함수 인자 + 안 옮기는 지역 이름
const outer = [...params.map((p) => p.name), ...[...localNames].filter((n) => !movedNames.has(n))].filter((n) => usedByMoved.has(n));
const depMap = new Map(deps.map((d) => { const [name, rest] = d.split("="); const [f, fac] = rest!.split(":"); return [name!, { file: f!, factory: fac! }] as const; }));
const returned = [...new Set([...also, ...[...movedNames].filter((n) => usedByStaying.has(n))])];

const relFrom = (fromFile: string, target: string) => { let rel = relative(dirname(fromFile), strip(target)).replace(/\\/gu, "/"); if (!rel.startsWith(".")) rel = `./${rel}`; return rel; };
const respec = (spec: string): string => {
  if (!spec.startsWith(".")) return spec;
  const ext = /\.(ts|mts|js|mjs)$/u.exec(spec)?.[0] ?? "";
  return `${relFrom(toFile!, normalize(join(dirname(file!), spec)))}${ext}`;
};

// 새 파일의 임포트: 원래 파일의 임포트 가운데 옮긴 글이 쓰는 것 + 원래 파일의 최상위 선언(있으면 원래 파일에서)
const importLines: string[] = [];
for (const st of sf.statements) {
  if (!ts.isImportDeclaration(st) || !st.importClause) continue;
  const clause = st.importClause, parts: string[] = [];
  if (clause.name && usedByMoved.has(clause.name.text)) parts.push(clause.name.text);
  const nb = clause.namedBindings;
  if (nb && ts.isNamespaceImport(nb) && usedByMoved.has(nb.name.text)) parts.push(`* as ${nb.name.text}`);
  if (nb && ts.isNamedImports(nb)) { const els = nb.elements.filter((e) => usedByMoved.has(e.name.text)); if (els.length) parts.push(`{ ${els.map((e) => e.getText()).join(", ")} }`); }
  if (parts.length) importLines.push(`import${clause.isTypeOnly ? " type" : ""} ${parts.join(", ")} from "${respec((st.moduleSpecifier as import("typescript").StringLiteral).text)}";`);
}
const srcEdits: { start: number; end: number; put: string }[] = [];
const fromSource: string[] = [];
for (const st of sf.statements) {
  if (ts.isImportDeclaration(st) || st === fn) continue;
  const top = ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st) ? (st.name ? [st.name.text] : []) : ts.isVariableStatement(st) ? st.declarationList.declarations.flatMap((d) => bindNames(d.name)) : [];
  const need = top.filter((n) => usedByMoved.has(n) && !localNames.has(n) && !params.some((p) => p.name === n));
  if (!need.length) continue;
  fromSource.push(...need);
  if (!(ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) srcEdits.push({ start: st.getStart(), end: st.getStart(), put: "export " });
}
if (fromSource.length) importLines.push(`import { ${fromSource.join(", ")} } from "${relFrom(toFile!, file!)}";`);

// 공장 함수
let signature: string, unpack = "";
if (ctxOpt) {
  const [ctxVar, ctxFile, ctxType] = ctxOpt.split(":") as [string, string, string];
  if (strip(ctxFile) !== strip(toFile!)) importLines.push(`import type { ${ctxType} } from "${relFrom(toFile!, ctxFile)}";`);
  const depTypes = [...depMap].filter(([n]) => outer.includes(n));
  const byFactory = new Map<string, string[]>();
  for (const [n, d] of depTypes) byFactory.set(`${d.file}:${d.factory}`, [...(byFactory.get(`${d.file}:${d.factory}`) ?? []), n]);
  for (const key of byFactory.keys()) { const [f, fac] = key.split(":") as [string, string]; if (strip(f) !== strip(toFile!)) importLines.push(`import type { ${fac} } from "${relFrom(toFile!, f)}";`); }
  const extra = [...byFactory].map(([key, ns]) => ` & Pick<ReturnType<typeof ${key.split(":")[1]}>, ${ns.map((n) => `"${n}"`).join(" | ")}>`).join("");
  signature = `${ctxVar}: ${ctxType}${extra}`;
  if (outer.length) unpack = `  const { ${outer.join(", ")} } = ${ctxVar};\n`;
} else {
  const bad = outer.filter((n) => !params.some((p) => p.name === n));
  if (bad.length) { console.error(`문맥 없이 뗄 수 없다 — 지역 이름을 쓴다: ${bad.join(", ")}`); process.exit(1); }
  signature = params.filter((p) => usedByMoved.has(p.name) || also.includes(p.name)).map((p) => p.text).join(", ");
}
const movedText = moving.map((st) => text.slice(startOf(st), st.end).replace(/^\n+/u, "")).join("\n");
const docOf = (factoryName: string) => `/** ${fnName} 에서 뗀 것 — ${[...movedNames].slice(0, 8).join(" · ")}${movedNames.size > 8 ? " …" : ""}${stmtHeads.length ? ` · ${stmtHeads.join(" · ")}` : ""}. (${factoryName}) */`;
const factoryText = `${docOf(factory!)}\nexport function ${factory}(${signature}) {\n${unpack}${movedText}\n${returned.length ? `  return { ${returned.join(", ")} };\n` : ""}}\n${typeName ? `\nexport type ${typeName} = ReturnType<typeof ${factory}>;\n` : ""}`;

// 원래 함수: 첫 옮긴 문장 자리에 호출을 넣고 나머지를 지운다
const callArgs = ctxOpt ? (() => { const ctxVar = ctxOpt.split(":")[0]!; const extra = outer.filter((n) => depMap.has(n)); return extra.length ? `{ ...${ctxVar}, ${extra.join(", ")} }` : ctxVar; })() : params.filter((p) => usedByMoved.has(p.name) || also.includes(p.name)).map((p) => p.name).join(", ");
const wanted = returned.filter((n) => usedByStaying.has(n));
const call = bind ? `const ${bind} = ${factory}(${callArgs});${wanted.length ? `\n  const { ${wanted.join(", ")} } = ${bind};` : ""}` : wanted.length ? `const { ${wanted.join(", ")} } = ${factory}(${callArgs});` : `${factory}(${callArgs});`;
moving.forEach((st, i) => srcEdits.push({ start: startOf(st), end: st.end, put: i === 0 ? `\n  ${call}` : "" }));
const lastImport = [...sf.statements].filter(ts.isImportDeclaration).pop();
srcEdits.push({ start: lastImport ? lastImport.end : 0, end: lastImport ? lastImport.end : 0, put: `\nimport { ${factory} } from "${relFrom(file!, toFile!)}";` });
srcEdits.sort((a, b) => b.start - a.start || b.end - a.end);
let out = text;
for (const e of srcEdits) out = out.slice(0, e.start) + e.put + out.slice(e.end);
writeFileSync(join(repo!, file!), out);

mkdirSync(dirname(join(repo!, toFile!)), { recursive: true });
const target = join(repo!, toFile!);
if (existsSync(target)) {
  const existing = readFileSync(target, "utf8");
  const esf = ts.createSourceFile(toFile!, existing, ts.ScriptTarget.Latest, true);
  const last = [...esf.statements].filter(ts.isImportDeclaration).pop();
  const at = last ? last.end : 0;
  writeFileSync(target, `${existing.slice(0, at)}\n${importLines.join("\n")}${existing.slice(at).replace(/\s*$/u, "")}\n\n${factoryText}`);
} else writeFileSync(target, `${header ? `${header}\n` : ""}${importLines.join("\n")}\n\n${factoryText}`);
console.log(`${factory}: 옮김 ${[...movedNames].join(", ") || "-"}${stmtHeads.length ? ` + 문장 ${stmtHeads.length}` : ""} · 받는 것 ${outer.join(", ") || "-"} · 돌려주는 것 ${returned.join(", ") || "-"} · 원래 파일에서 끌어옴 ${fromSource.join(", ") || "-"}`);
