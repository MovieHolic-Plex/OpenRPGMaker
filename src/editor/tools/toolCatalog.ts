// editor/tools/toolCatalog.ts
// 툴 레지스트리에서 마크다운 카탈로그를 자동 생성한다(openwiki 문서/사용자 가이드용).
// 레지스트리가 단일 진실 소스이므로 문서 드리프트가 없다.

import { TOOL_REGISTRY } from "./toolRegistry";
import type { JsonSchema, ToolDefinition } from "./types";

function paramSummary(schema: JsonSchema): string {
  const required = new Set(schema.required ?? []);
  const props = Object.entries(schema.properties ?? {});
  if (props.length === 0) return "(없음)";
  return props
    .map(([name, prop]) => {
      const mark = required.has(name) ? "" : "?";
      const type = prop.enum ? prop.enum.join("\\|") : prop.type;
      return `\`${name}${mark}: ${type}\``;
    })
    .join(", ");
}

function toolRow(tool: ToolDefinition): string {
  const desc = tool.description.replace(/\|/g, "\\|");
  return `| \`${tool.name}\` | ${paramSummary(tool.parameters)} | ${desc} |`;
}

// 툴 레지스트리 → 마크다운 카탈로그 문자열.
export function generateToolCatalogMarkdown(tools: readonly ToolDefinition[] = TOOL_REGISTRY): string {
  const writeTools = tools.filter((tool) => tool.mode === "write");
  const readTools = tools.filter((tool) => tool.mode === "read");
  const lines: string[] = [];
  lines.push("# 툴 카탈로그 (자동 생성)");
  lines.push("");
  lines.push(`> 이 문서는 \`src/editor/tools/\` 레지스트리에서 자동 파생됩니다. 직접 편집하지 마세요.`);
  lines.push(`> 총 ${tools.length}개 툴 — 쓰기 ${writeTools.length}, 읽기 ${readTools.length}.`);
  lines.push("");
  lines.push("생성: `generateToolCatalogMarkdown()` (editor/tools/toolCatalog.ts). OpenAI function calling 스키마는 `toOpenAiTools()`로 파생됩니다.");
  lines.push("");
  lines.push("## 쓰기 툴 (dry-run + 커밋 게이트)");
  lines.push("");
  lines.push("| 이름 | 파라미터 | 설명 |");
  lines.push("| --- | --- | --- |");
  for (const tool of writeTools) lines.push(toolRow(tool));
  lines.push("");
  lines.push("## 읽기 툴");
  lines.push("");
  lines.push("| 이름 | 파라미터 | 설명 |");
  lines.push("| --- | --- | --- |");
  for (const tool of readTools) lines.push(toolRow(tool));
  lines.push("");
  return lines.join("\n");
}
