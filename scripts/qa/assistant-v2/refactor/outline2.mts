// 함수 본문의 문장 개요. usage: bun outline2.mts <repo> <file> <functionName> [minLines]
import { readFileSync } from "node:fs";
import { join } from "node:path";
const [repo, file, fn, min = "1"] = process.argv.slice(2) as [string, string, string, string?];
const ts = (await import(join(repo, "node_modules/typescript5/lib/typescript.js"))).default as typeof import("typescript");
const text = readFileSync(join(repo, file), "utf8");
const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const line = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
const f = sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === fn) as import("typescript").FunctionDeclaration;
for (const st of f.body!.statements) {
  const a = line(st.getStart()), b = line(st.end);
  let name = ts.SyntaxKind[st.kind];
  if (ts.isVariableStatement(st)) name = `const ${st.declarationList.declarations.map((d) => d.name.getText().slice(0, 40)).join(",")}`;
  else if (ts.isFunctionDeclaration(st)) name = `function ${st.name?.text}`;
  else if (ts.isExpressionStatement(st)) name = `expr ${st.expression.getText().slice(0, 60).replace(/\s+/g, " ")}`;
  else if (ts.isReturnStatement(st)) name = `return ${st.expression?.getText().slice(0, 60).replace(/\s+/g, " ")}`;
  else if (ts.isIfStatement(st)) name = `if ${st.expression.getText().slice(0, 60)}`;
  if (b - a + 1 >= Number(min)) console.log(`${String(a).padStart(5)}-${String(b).padEnd(5)} ${String(b - a + 1).padStart(4)}  ${name}`);
  // 배열 리터럴이면 원소(도구 정의)도 찍는다
  const arr = ts.isVariableStatement(st) ? st.declarationList.declarations[0]?.initializer : ts.isReturnStatement(st) ? st.expression : undefined;
  if (arr && ts.isArrayLiteralExpression(arr)) for (const el of arr.elements) {
    const nameProp = ts.isObjectLiteralExpression(el) ? el.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === "name") : undefined;
    console.log(`        ${String(line(el.getStart())).padStart(5)}-${String(line(el.end)).padEnd(5)} ${String(line(el.end) - line(el.getStart()) + 1).padStart(4)}    · ${nameProp ? (nameProp as import("typescript").PropertyAssignment).initializer.getText() : el.getText().slice(0, 50).replace(/\s+/g, " ")}`);
  }
}
