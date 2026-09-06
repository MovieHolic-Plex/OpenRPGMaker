import { describe, it, expect } from "vitest";
import ts from "typescript";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";

export function runtimeGraph(entry: string): string[] {
  const seen = new Set<string>();
  function visit(file: string) {
    if (seen.has(file)) return;
    seen.add(file);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    function follow(spec: string) {
      const base = spec.startsWith("@/") ? resolve("src", spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(file), spec) : null;
      if (!base) return;
      const target = [base, `${base}.ts`, `${base}/index.ts`].find(p => existsSync(p) && /\.[cm]?[jt]s$/.test(p));
      if (target) visit(target);
    }
    function walk(node: ts.Node) {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause;
        const bindings = clause?.namedBindings;
        if (!clause?.isTypeOnly && (!bindings || !ts.isNamedImports(bindings) || bindings.elements.some(e => !e.isTypeOnly) || clause.name)) follow(node.moduleSpecifier.text);
      } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        if (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some(e => !e.isTypeOnly)) follow(node.moduleSpecifier.text);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) follow(node.arguments[0].text);
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  visit(resolve(entry));
  return [...seen].map(p => relative(process.cwd(), p));
}

describe("isolated real session import graph", () => {
  it("has no runtime editor/store/persistence boot edges", () => {
    const entry = "src/ai/jobs/workerEntry.ts";
    const graph = runtimeGraph(entry);
    expect(graph.some(p => /assistantSession(?:Core)?\.ts$/.test(p))).toBe(true);
    expect(graph.filter(p => /src\/main\.ts$|project\/store\.ts$|editor\/panels\/|editorState\.ts$|mapEditHistory\.ts$|applyChangesetToStore\.ts$|pwa/i.test(p))).toEqual([]);
  });
});
