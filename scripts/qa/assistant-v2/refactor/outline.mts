// 파일의 최상위 선언 개요(이름·종류·줄 범위·export 여부). usage: bun outline.mts <repo> <file> [minLines]
import { readFileSync } from "node:fs";
import { join } from "node:path";
const [repo, file, min = "1"] = process.argv.slice(2) as [string, string, string?];
const ts = (await import(join(repo, "node_modules/typescript5/lib/typescript.js"))).default as typeof import("typescript");
const text = readFileSync(join(repo, file), "utf8");
const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const line = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
let imports = 0;
for (const st of sf.statements) {
  if (ts.isImportDeclaration(st)) { imports += 1; continue; }
  const a = line(st.getStart()), b = line(st.end);
  if (b - a + 1 < Number(min)) continue;
  const exported = (ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  let name = "";
  if (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) name = `${ts.SyntaxKind[st.kind].replace("Declaration", "")} ${st.name?.text}`;
  else if (ts.isVariableStatement(st)) name = `const ${st.declarationList.declarations.map((d) => d.name.getText()).join(",")}`;
  else name = ts.SyntaxKind[st.kind];
  console.log(`${String(a).padStart(5)}-${String(b).padEnd(5)} ${String(b - a + 1).padStart(4)}  ${exported ? "export " : ""}${name}`);
}
console.log(`imports ${imports}`);
