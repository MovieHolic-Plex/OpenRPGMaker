// 파일을 옮긴다: git mv 하고, 그 파일을 끌어오는 모든 임포트와 그 파일 자신의 상대 임포트를 새 자리에 맞춘다.
// usage: bun mvfile.mts <repo> <from> <to> [<from> <to> …]     (저장소 기준 경로. 여러 쌍을 한 번에 주면 서로를 끌어오는 파일도 맞는다)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, normalize } from "node:path";

const [repo, ...pairs] = process.argv.slice(2) as string[];
if (!repo || !pairs.length || pairs.length % 2) { console.error("usage: mvfile.mts <repo> <from> <to> [<from> <to> …]"); process.exit(2); }
const ts = (await import(join(repo, "node_modules/typescript5/lib/typescript.js"))).default as typeof import("typescript");
const strip = (p: string) => p.replace(/\.(ts|tsx|mts|js|mjs)$/u, "");
const moves = new Map<string, string>();
for (let i = 0; i < pairs.length; i += 2) moves.set(strip(pairs[i]!), strip(pairs[i + 1]!));
for (let i = 0; i < pairs.length; i += 2) {
  const from = pairs[i]!, to = pairs[i + 1]!;
  if (!existsSync(join(repo, from))) { console.error(`없음: ${from}`); process.exit(1); }
  if (existsSync(join(repo, to))) { console.error(`이미 있음: ${to}`); process.exit(1); }
  mkdirSync(dirname(join(repo, to)), { recursive: true });
  execFileSync("git", ["-C", repo, "mv", from, to]);
}
const files = execFileSync("git", ["-C", repo, "ls-files", "--cached", "--others", "--exclude-standard", "src", "scripts", "test", "electron"], { encoding: "utf8" }).split("\n").filter((f) => /\.(ts|tsx|mts)$/u.test(f));
/** 옮긴 뒤의 파일 경로 → 옮기기 전 경로(상대 임포트를 풀 때는 옛 자리 기준으로 풀어야 한다). */
const oldOf = new Map([...moves].map(([from, to]) => [to, from] as const));
let changed = 0;
for (const file of files) {
  const path = join(repo, file);
  const text = readFileSync(path, "utf8");
  const here = strip(file), was = oldOf.get(here) ?? here;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const edits: { start: number; end: number; put: string }[] = [];
  const fix = (lit: import("typescript").StringLiteralLike) => {
    const spec = lit.text;
    const isAlias = spec.startsWith("@/"), isRel = spec.startsWith(".");
    if (!isAlias && !isRel) return;
    const ext = /\.(ts|mts|js|mjs)$/u.exec(spec)?.[0] ?? "";
    const target = isAlias ? strip(`src/${spec.slice(2)}`) : strip(normalize(join(dirname(was), spec)));
    const moved = moves.get(target) ?? (moves.has(`${target}/index`) ? moves.get(`${target}/index`)!.replace(/\/index$/u, "") : undefined);
    const dest = moved ?? target;
    if (!moved && was === here) return;           // 대상도 나도 안 옮겼다
    let next: string;
    if (isAlias) next = `@/${dest.replace(/^src\//u, "")}${ext}`;
    else { next = relative(dirname(here), dest).replace(/\\/gu, "/"); if (!next.startsWith(".")) next = `./${next}`; next += ext; }
    if (next !== spec) edits.push({ start: lit.getStart() + 1, end: lit.end - 1, put: next });
  };
  const walk = (n: import("typescript").Node) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteralLike(n.moduleSpecifier)) fix(n.moduleSpecifier);
    else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) fix(n.arguments[0]);
    else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument) && ts.isStringLiteralLike(n.argument.literal)) fix(n.argument.literal);
    else if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && /^(mock|doMock|unmock|importActual|importMock)$/u.test(n.expression.name.text) && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) fix(n.arguments[0]);
    n.forEachChild(walk);
  };
  walk(sf);
  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.put + out.slice(e.end);
  writeFileSync(path, out);
  changed += 1;
}
console.log(`moved ${moves.size} file(s) · 임포트 고친 파일 ${changed}`);
