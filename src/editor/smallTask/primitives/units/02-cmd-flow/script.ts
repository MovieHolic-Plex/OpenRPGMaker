import ts from "typescript5";
import { analyzeScript, knownScriptIds } from "@/editor/script/analyze";
import { scriptCommandFields } from "@/editor/script/compile";
import { SCRIPT_API_VERSION, SCRIPT_COMPILED_LIMIT, scriptSourceHash } from "@/project/script/types";
import type { Command, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";

type ScriptCommand = Extract<Command, { kind: "script" }>;

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

  const known = knownScriptIds(project, mapId);
  const { reads, writes, calls } = analysis.effects;
  for (const { kind, id } of [...reads, ...writes, ...calls]) {
    if (known[kind] && !known[kind].includes(id)) {
      throw new PrimitiveError("스크립트에 연결할 대상이 없습니다.");
    }
  }
  return scriptCommandFields(source, {
    ok: true,
    compiled: result.outputText,
    diagnostics: analysis.diagnostics,
    effects: analysis.effects,
    summary: analysis.summary,
    sourceHash: scriptSourceHash(source),
    apiVersion: SCRIPT_API_VERSION,
  }, name);
}
