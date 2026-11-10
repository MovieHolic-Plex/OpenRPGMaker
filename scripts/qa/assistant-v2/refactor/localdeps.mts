// 함수 본문 문장들 사이의 의존(어느 지역 이름을 어느 문장이 쓰나). usage: bun localdeps.mts <repo> <file> <functionName>
import { readFileSync } from "node:fs";
import { join } from "node:path";
const [repo, file, fn] = process.argv.slice(2) as [string, string, string];
const ts = (await import(join(repo, "node_modules/typescript5/lib/typescript.js"))).default as typeof import("typescript");
const text = readFileSync(join(repo, file), "utf8");
const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const line = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
const f = sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === fn) as import("typescript").FunctionDeclaration;
const params = f.parameters.map((p) => p.name.getText());
type St = { names: string[]; kind: string; a: number; b: number; uses: Set<string>; label: string };
const sts: St[] = [];
const bindNames = (n: import("typescript").BindingName): string[] => ts.isIdentifier(n) ? [n.text] : n.elements.flatMap((e) => (ts.isOmittedExpression(e) ? [] : bindNames(e.name)));
for (const st of f.body!.statements) {
  const names = ts.isVariableStatement(st) ? st.declarationList.declarations.flatMap((d) => bindNames(d.name)) : ts.isFunctionDeclaration(st) && st.name ? [st.name.text] : [];
  const kind = ts.isVariableStatement(st) ? (st.declarationList.flags & ts.NodeFlags.Let ? "let" : "const") : ts.isFunctionDeclaration(st) ? "function" : ts.SyntaxKind[st.kind];
  const uses = new Set<string>();
  const walk = (n: import("typescript").Node) => { if (ts.isIdentifier(n)) { const p = n.parent; if (!(ts.isPropertyAccessExpression(p) && p.name === n) && !(ts.isPropertyAssignment(p) && p.name === n)) uses.add(n.text); } n.forEachChild(walk); };
  walk(st);
  sts.push({ names, kind, a: line(st.getStart()), b: line(st.end), uses, label: names.join(",") || st.getText().slice(0, 50).replace(/\s+/g, " ") });
}
const all = new Set(sts.flatMap((s) => s.names));
const usedBy = new Map<string, string[]>();
for (const s of sts) for (const u of s.uses) if (all.has(u) && !s.names.includes(u)) usedBy.set(u, [...(usedBy.get(u) ?? []), s.label]);
console.log(`params: ${params.join(", ")}`);
for (const s of sts) {
  const deps = [...s.uses].filter((u) => all.has(u) && !s.names.includes(u));
  const p = params.filter((x) => s.uses.has(x));
  console.log(`${String(s.a).padStart(5)} ${String(s.b - s.a + 1).padStart(4)} ${s.kind.padEnd(8)} ${s.label.slice(0, 44).padEnd(44)} ← ${[...p.map((x) => `(${x})`), ...deps].join(" ")}`);
}
console.log("\n쓰이는 곳이 여럿인 지역 이름:");
for (const [n, by] of [...usedBy].sort((x, y) => y[1].length - x[1].length)) if (by.length >= 2) console.log(`  ${n} ×${by.length}`);
console.log("\nlet:", sts.filter((s) => s.kind === "let").map((s) => s.label).join(", ") || "-");
