import ts from "typescript5";
import { analyzeScript, knownScriptIds, scriptCallSource, scriptMemberName, scriptStringLiteral, unwrapScriptExpression } from "@/editor/script/analyze";
import { scriptCommandFields } from "@/editor/script/compile";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { SCRIPT_API_BY_NAME } from "@/project/script/apiSpec";
import { libraryIdFromSpecifier } from "@/project/script/library";
import { SCRIPT_API_VERSION, SCRIPT_COMPILED_LIMIT, scriptSourceHash, type ScriptRef } from "@/project/script/types";
import type { Command, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";

type ScriptCommand = Extract<Command, { kind: "script" }>;

function addRef(list: ScriptRef[], ref: ScriptRef): void {
  if (!list.some(entry => entry.kind === ref.kind && entry.id === ref.id)) list.push(ref);
}

type LiteralType = "string" | "number" | "boolean" | "bigint" | "null" | "undefined" | "array" | "object";

function literalType(expression: ts.Expression): LiteralType | undefined {
  const node = unwrapScriptExpression(ts, expression);
  if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) return "string";
  if (ts.isNumericLiteral(node)) return "number";
  if (ts.isBigIntLiteral(node)) return "bigint";
  if (ts.isPrefixUnaryExpression(node)) {
    if (node.operator === ts.SyntaxKind.ExclamationToken) return "boolean";
    if (node.operator === ts.SyntaxKind.PlusToken) return "number";
    if (node.operator === ts.SyntaxKind.MinusToken) {
      return literalType(node.operand) === "bigint" ? "bigint" : ts.isNumericLiteral(node.operand) ? "number" : undefined;
    }
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return "boolean";
  if (node.kind === ts.SyntaxKind.NullKeyword) return "null";
  if (ts.isVoidExpression(node)) return "undefined";
  if (ts.isArrayLiteralExpression(node)) return "array";
  if (ts.isObjectLiteralExpression(node)) return "object";
  return undefined;
}

function validateLiteralArgs(call: ts.CallExpression, params: string): void {
  // Check the outer type of literals here. The command's fields are validated by the runtime.
  const signature = ts.createSourceFile("/game.d.ts", `declare function api(${params}): void;`, ts.ScriptTarget.ES2022);
  const { parameters } = signature.statements[0] as ts.FunctionDeclaration;
  for (const [index, parameter] of parameters.entries()) {
    const declared = parameter.type?.getText(signature) ?? "";
    let expected: string | undefined;
    if (/^(string|number|boolean)$/u.test(declared)) expected = declared;
    if (/^[A-Z]\w*Id$/u.test(declared)) expected = "string";
    if (declared === "EventCommand") expected = "object";
    const argument = call.arguments[index];
    if (argument && ts.isSpreadElement(argument)) break;
    const actual = argument && literalType(argument);
    if (!expected || parameter.dotDotDotToken || (parameter.questionToken && (actual === "null" || actual === "undefined"))) continue;
    if ((!argument && !parameter.questionToken) || (actual !== undefined && actual !== expected)) {
      throw new PrimitiveError(`스크립트에서 게임 기능의 ${index + 1}번째 인자 형식을 확인해 주세요.`);
    }
  }
}

function validateGameCalls(project: Project, source: string, calls: ScriptRef[]): void {
  const { file, isGlobal, isEngineGameObject } = scriptCallSource(ts, source);
  function visit(node: ts.Node): void {
    let specifier: ts.Expression | undefined;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      specifier = node.moduleReference.expression;
    } else if (ts.isCallExpression(node)) {
      const callee = unwrapScriptExpression(ts, node.expression);
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === "require" && isGlobal(callee))) {
        specifier = node.arguments[0];
      }
      if ((ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) && isEngineGameObject(callee.expression)) {
        const name = scriptMemberName(ts, callee, callee.expression);
        if (name !== undefined) {
          const api = SCRIPT_API_BY_NAME.get(name);
          if (!api) throw new PrimitiveError("스크립트에서 사용한 게임 기능을 찾을 수 없습니다. 함수 이름을 확인해 주세요.");
          for (const { arg } of api.refs ?? []) {
            if (node.arguments.slice(0, arg + 1).some(ts.isSpreadElement)) continue;
            const argument = node.arguments[arg];
            if (!argument || unwrapScriptExpression(ts, argument).kind === ts.SyntaxKind.NullKeyword
              || scriptStringLiteral(ts, argument)?.trim() === "") {
              throw new PrimitiveError("스크립트에서 사용할 항목을 지정해 주세요.");
            }
          }
          validateLiteralArgs(node, api.params);
        }
      }
    }
    const moduleName = scriptStringLiteral(ts, specifier);
    if (moduleName !== undefined) {
      const libraryId = libraryIdFromSpecifier(moduleName);
      if (!libraryId || !project.scriptLibrary?.some(module => module.id === libraryId)) {
        throw new PrimitiveError("스크립트에서 가져올 프로젝트 라이브러리를 찾을 수 없습니다.");
      }
      addRef(calls, { kind: "library", id: libraryId });
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}

function isIdentifierUse(node: ts.Identifier): boolean {
  const { parent } = node;
  if (ts.isShorthandPropertyAssignment(parent)) return true;
  return !("name" in parent && parent.name === node) && !(ts.isBindingElement(parent) && parent.propertyName === node);
}

function outsideParentheses(node: ts.Node): ts.Node {
  while (ts.isParenthesizedExpression(node.parent)) node = node.parent;
  return node;
}

/** A running script can put a command or a called common event on the same interpreter stack. */
export function scriptMayDispatchFlow(
  compiled: string, followsCommonEvent: (id: string) => boolean, unknownFlow = () => true,
  transfers = (_mapId?: string) => false,
): boolean {
  const { file, isGlobal, isEngineGameObject } = scriptCallSource(ts, compiled, "/script.js", ts.ScriptKind.JS);
  function visit(node: ts.Node): boolean {
    if (ts.isIdentifier(node) && node.text === "require" && isIdentifierUse(node) && isGlobal(node) && unknownFlow()) return true;
    if (((ts.isIdentifier(node) && isIdentifierUse(node)) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
      && isEngineGameObject(node, true)) {
      const receiver = outsideParentheses(node);
      const access = receiver.parent;
      const name = scriptMemberName(ts, access, receiver);
      if (name === "callCommonEvent" || name === "transfer") {
        const callee = outsideParentheses(access);
        const call = callee.parent;
        const id = ts.isCallExpression(call) && call.expression === callee ? scriptStringLiteral(ts, call.arguments[0]) : undefined;
        if (name === "transfer" ? transfers(id) : id === undefined ? unknownFlow() : followsCommonEvent(id)) return true;
      } else if ((name === undefined || name === "cmd") && unknownFlow()) {
        // Computed or aliased calls and game.cmd can dispatch commands selected at run time.
        return true;
      }
    }
    return ts.forEachChild(node, visit) === true;
  }
  return visit(file);
}

/** The primitive contract is synchronous, so this path uses the same transpiler and analyzer directly. */
export function compileFlowScript(project: Project, mapId: string, source: string, name?: string): ScriptCommand {
  if (!source.trim()) throw new PrimitiveError("실행할 스크립트 내용을 입력해 주세요.");
  const result = ts.transpileModule(source, {
    fileName: "/script.ts",
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const analysis = analyzeScript(ts, source, { project, mapId });
  const syntaxError = result.diagnostics?.some(entry => entry.category === ts.DiagnosticCategory.Error);
  if (syntaxError || analysis.diagnostics.some(entry => entry.severity === "error")) {
    throw new PrimitiveError("스크립트의 문법이나 가져올 모듈을 확인해 주세요.");
  }
  if (result.outputText.length > SCRIPT_COMPILED_LIMIT) throw new PrimitiveError("스크립트가 너무 깁니다.");
  const effects = { ...analysis.effects, calls: [...analysis.effects.calls] };
  validateGameCalls(project, source, effects.calls);

  const known = knownScriptIds(project, mapId);
  let resources: ReturnType<typeof collectResourceIds> | undefined;
  for (const { kind, id } of [...effects.reads, ...effects.writes, ...effects.calls]) {
    if (kind === "resource" && !(resources ??= collectResourceIds(project)).has(id)) {
      throw new PrimitiveError("스크립트에 지정한 그림이나 소리 자료를 찾을 수 없습니다.");
    }
    if (known[kind] && !known[kind].includes(id)) {
      throw new PrimitiveError("스크립트에 연결할 대상이 없습니다.");
    }
  }
  return scriptCommandFields(source, {
    ok: true,
    compiled: result.outputText,
    diagnostics: analysis.diagnostics,
    effects,
    summary: analysis.summary,
    sourceHash: scriptSourceHash(source),
    apiVersion: SCRIPT_API_VERSION,
  }, name);
}
