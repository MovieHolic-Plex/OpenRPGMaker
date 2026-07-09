import { prepareWebExport } from "@/project/webExport";
import type { ToolDefinition, ToolExecResult } from "./types";

const exportGame: ToolDefinition = {
  name: "export_game",
  description:
    "현재 프로젝트를 웹 플레이어 번들로 내보낼 때의 직렬화/에셋 수집 결과를 검증하고 요약한다. 브라우저 UI에서는 같은 경로가 ZIP 다운로드를 트리거한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {},
  },
  run(project): ToolExecResult {
    const prepared = prepareWebExport(project);
    return {
      summary:
        `웹 내보내기 준비 완료 — 맵 ${prepared.summary.mapCount}개, ` +
        `에셋 ${prepared.summary.assetCount}개, 추정 ${formatBytes(prepared.summary.estimatedSizeBytes)}`,
      data: {
        ...prepared.summary,
        projectTitle: prepared.project.meta.title,
        shapeRoundTrip: true,
      },
    };
  },
};

export const EXPORT_TOOLS: readonly ToolDefinition[] = [exportGame];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
