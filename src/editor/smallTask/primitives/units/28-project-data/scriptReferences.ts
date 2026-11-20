import ts from "typescript5";
import type { ScriptEffectSource } from "@/project/script/effects";

function stringValue(node: ts.Expression | undefined): string | undefined {
  while (node && ts.isParenthesizedExpression(node)) node = node.expression;
  if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) return node.text;
  return undefined;
}

function propertyAccess(node: ts.Node | undefined, receiver: ts.Node): boolean {
  return !!node && (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && node.expression === receiver;
}

function propertyName(node: ts.Node | undefined): string | undefined {
  if (node && ts.isPropertyAccessExpression(node)) return node.name.text;
  if (node && ts.isElementAccessExpression(node)) return stringValue(node.argumentExpression);
  return undefined;
}

function withParentheses(node: ts.Node): ts.Node {
  while (node.parent && ts.isParenthesizedExpression(node.parent)) node = node.parent;
  return node;
}

/** Prove a simple local data read without assuming that arbitrary receivers are local. */
function localGameDataReads(file: ts.SourceFile): ReadonlySet<string> {
  const declarations = new Map<string, ts.Identifier>();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)) continue;
    for (const { name, initializer } of statement.declarationList.declarations) {
      if (!ts.isIdentifier(name) || !initializer || !ts.isObjectLiteralExpression(initializer)) continue;
      if (initializer.properties.length !== 1) continue;
      const [property] = initializer.properties;
      if (property && ts.isPropertyAssignment(property)
        && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === "game"
        && stringValue(property.initializer) !== undefined) declarations.set(name.text, name);
    }
  }
  if (!declarations.size) return new Set();
  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node) && declarations.has(node.text) && declarations.get(node.text) !== node) {
      const receiver = withParentheses(node);
      const member = receiver.parent;
      const read = withParentheses(member);
      const usage = read.parent;
      if (!propertyAccess(member, receiver) || propertyName(member) !== "game"
        || !(ts.isCallExpression(usage) && usage.arguments.some(argument => argument === read)
          || ts.isVariableDeclaration(usage) && usage.initializer === read)) declarations.delete(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return new Set(declarations.keys());
}

/** Inspect the code the player executes. Passing the game object or using a computed API may hide a reference. */
export function scriptMayUseGameApi(
  script: ScriptEffectSource,
  matches: (api: string, call: ts.CallExpression | undefined) => boolean,
): boolean {
  if (typeof script.compiled !== "string" || !script.compiled.trim()) return false;
  const file = ts.createSourceFile("script.js", script.compiled, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const localReads = localGameDataReads(file);
  function visit(node: ts.Node): true | undefined {
    if (ts.isIdentifier(node)) {
      const receiver = withParentheses(node);
      const member = receiver.parent;
      if (node.text === "globalThis" && !(ts.isPropertyAccessExpression(member) && member.name === node)) {
        if (!propertyAccess(member, receiver) || propertyName(member) === undefined) return true;
      }
      if (node.text === "eval" || node.text === "Function") return true;
      if (node.text === "game" && !((ts.isPropertyAccessExpression(member) || ts.isPropertyAssignment(member)) && member.name === node)) {
        if (gameObjectMayMatch(receiver)) return true;
      }
    }
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && propertyName(node) === "game") {
      let receiver: ts.Expression = node.expression;
      while (ts.isParenthesizedExpression(receiver)) receiver = receiver.expression;
      if (!(ts.isIdentifier(receiver) && localReads.has(receiver.text)) && gameObjectMayMatch(withParentheses(node))) return true;
    }
    return ts.forEachChild(node, visit);
  }

  function gameObjectMayMatch(receiver: ts.Node): boolean {
    const member = receiver.parent;
    const api = propertyAccess(member, receiver) ? propertyName(member) : undefined;
    if (api === undefined) return true;
    const callee = withParentheses(member);
    const call = callee.parent;
    return matches(api, ts.isCallExpression(call) && call.expression === callee ? call : undefined);
  }

  return visit(file) === true;
}

/** Resolve a literal API argument only when its position is known even in the presence of spreads. */
export function scriptStringArg(call: ts.CallExpression | undefined, index: number): string | undefined {
  if (!call || call.arguments.slice(0, index + 1).some(ts.isSpreadElement)) return undefined;
  return stringValue(call.arguments[index]);
}

// Do not evaluate authored code. Only inspect inline JSON-like command payloads, including their branches.
function commandLiteral(node: ts.Expression | undefined, depth = 0): unknown {
  if (!node || depth > 64) return undefined;
  if (ts.isParenthesizedExpression(node)) return commandLiteral(node.expression, depth + 1);
  const str = stringValue(node);
  if (str !== undefined) return str;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  if (ts.isArrayLiteralExpression(node)) {
    const values = node.elements.map(element => commandLiteral(element, depth + 1));
    return values.includes(undefined) ? undefined : values;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const record: Record<string, unknown> = Object.create(null);
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name)) return undefined;
      const name = property.name.text;
      const value = commandLiteral(property.initializer, depth + 1);
      if (name === "__proto__" || value === undefined) return undefined;
      record[name] = value;
    }
    return record;
  }
  return undefined;
}

export function scriptCmdMayMatch(call: ts.CallExpression | undefined, matches: (command: unknown) => boolean): boolean {
  const command = commandLiteral(call?.arguments[0]);
  return command === undefined || matches(command);
}
