import ts from "typescript5";

/** Inspect compiled scripts without running them. The saved effects omit nested game.cmd commands. */
export function scriptCommonEventCalls(compiled: string): { ids: Set<string>; opaque: boolean } {
  const ids = new Set<string>();
  let opaque = false;
  const file = ts.createSourceFile("event.js", compiled, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const literal = (node: ts.Node | undefined) => node && ts.isStringLiteralLike(node) ? node.text : undefined;
  const addId = (node: ts.Node | undefined) => {
    const id = literal(node);
    if (id === undefined) opaque = true;
    else ids.add(id);
  };
  const inspectLiteral = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const fields = new Map<string, ts.Expression>();
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
          opaque = true;
          continue;
        }
        fields.set(property.name.text, property.initializer);
      }
      const kind = fields.get("kind");
      if (kind && literal(kind) === undefined) opaque = true;
      if (literal(kind) === "callCommonEvent") addId(fields.get("commonEventId"));
      // M2 commands, scripts and schedules can dispatch calls indirectly.
      const commandKind = literal(kind);
      if (commandKind === "m2Command" || commandKind === "script" || commandKind === "runSchedule") opaque = true;
      for (const value of fields.values()) inspectLiteral(value);
    } else if (ts.isArrayLiteralExpression(node)) {
      for (const child of node.elements) inspectLiteral(child);
    } else if (ts.isPrefixUnaryExpression(node) && (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken)) {
      inspectLiteral(node.operand);
    } else if (!ts.isStringLiteralLike(node) && !ts.isNumericLiteral(node) &&
      node.kind !== ts.SyntaxKind.TrueKeyword && node.kind !== ts.SyntaxKind.FalseKeyword && node.kind !== ts.SyntaxKind.NullKeyword) {
      // A computed value, spread or shorthand can hide a command or its operand.
      opaque = true;
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === "game") {
      const access = node.parent;
      if ((ts.isPropertyAssignment(access) || ts.isPropertyAccessExpression(access) || ts.isBindingElement(access)) &&
        (ts.isBindingElement(access) ? access.propertyName : access.name) === node) return;
      if (!ts.isPropertyAccessExpression(access) || access.expression !== node) opaque = true;
      else if (access.name.text === "cmd" || access.name.text === "callCommonEvent") {
        const call = access.parent;
        if (!ts.isCallExpression(call) || call.expression !== access) opaque = true;
        else if (access.name.text === "callCommonEvent") addId(call.arguments[0]);
        else {
          const arg = call.arguments[0];
          if (arg && ts.isObjectLiteralExpression(arg)) inspectLiteral(arg);
          else opaque = true;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { ids, opaque };
}
