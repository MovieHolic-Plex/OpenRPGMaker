// 이름을 다른 파일에서 끌어오게 임포트를 고쳐 쓴다(선언을 옮긴 뒤에 돌린다).
// usage: bun reimport.mts <repo> <fromFile> <toFile> <name> [name…]     (파일은 저장소 기준 경로, 예: src/ai/v2/tools/verbs.ts)
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, normalize } from "node:path";

const [repo, fromFile, toFile, ...names] = process.argv.slice(2) as string[];
const ts = (await import(join(repo!, "node_modules/typescript5/lib/typescript.js"))).default as typeof import("typescript");
const want = new Set(names);
const files = execFileSync("git", ["-C", repo!, "ls-files", "--cached", "--others", "--exclude-standard", "src", "scripts", "test", "electron"], { encoding: "utf8" }).split("\n").filter((f) => /\.(ts|tsx|mts)$/u.test(f));
const strip = (p: string) => p.replace(/\.(ts|tsx|mts|js|mjs)$/u, "");
const resolve = (file: string, spec: string): string | undefined => {
  if (spec.startsWith("@/")) return strip(`src/${spec.slice(2)}`);
  if (spec.startsWith(".")) return strip(normalize(join(dirname(file), spec)));
  return undefined;
};
/** 원래 임포트 글의 모양(별칭·확장자)을 따라 새 경로 글을 만든다. */
const specFor = (file: string, original: string): string => {
  const ext = /\.(ts|mts|js|mjs)$/u.exec(original)?.[0] ?? "";
  if (original.startsWith("@/")) return `@/${strip(toFile!).replace(/^src\//u, "")}${ext}`;
  let rel = relative(dirname(file), strip(toFile!)).replace(/\\/gu, "/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return `${rel}${ext}`;
};
let changed = 0;
for (const file of files) {
  if (file === toFile) continue;
  const path = join(repo!, file);
  const text = readFileSync(path, "utf8");
  if (!names.some((n) => text.includes(n))) continue;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const edits: { start: number; end: number; put: string }[] = [];
  for (const st of sf.statements) {
    const isImport = ts.isImportDeclaration(st), isExport = ts.isExportDeclaration(st) && !!st.moduleSpecifier;
    if (!isImport && !isExport) continue;
    const spec = (st.moduleSpecifier as import("typescript").StringLiteral).text;
    if (resolve(file, spec) !== strip(fromFile!)) continue;
    const bindings = isImport ? (st as import("typescript").ImportDeclaration).importClause?.namedBindings : (st as import("typescript").ExportDeclaration).exportClause;
    if (!bindings || !(ts.isNamedImports(bindings) || ts.isNamedExports(bindings))) continue;
    const elements = [...bindings.elements];
    const moved = elements.filter((e) => want.has((e.propertyName ?? e.name).text));
    if (!moved.length) continue;
    const kept = elements.filter((e) => !moved.includes(e));
    const typeOnly = isImport ? !!(st as import("typescript").ImportDeclaration).importClause?.isTypeOnly : (st as import("typescript").ExportDeclaration).isTypeOnly;
    const head = `${isImport ? "import" : "export"}${typeOnly ? " type" : ""}`;
    const quote = text[st.moduleSpecifier!.getStart()] ?? '"';
    const line = (els: readonly import("typescript").ImportOrExportSpecifier[], to: string) => `${head} { ${els.map((e) => e.getText()).join(", ")} } from ${quote}${to}${quote};`;
    const defaultName = isImport ? (st as import("typescript").ImportDeclaration).importClause?.name?.text : undefined;
    const next = line(moved, specFor(file, spec));
    if (!kept.length && !defaultName) edits.push({ start: st.getStart(), end: st.end, put: next });
    else {
      edits.push({ start: bindings.getStart(), end: bindings.end, put: kept.length ? `{ ${kept.map((e) => e.getText()).join(", ")} }` : "{}" });
      edits.push({ start: st.end, end: st.end, put: `\n${next}` });
    }
  }
  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.put + out.slice(e.end);
  writeFileSync(path, out);
  changed += 1;
}
console.log(`reimport ${names.join(",")}: ${changed} files`);
