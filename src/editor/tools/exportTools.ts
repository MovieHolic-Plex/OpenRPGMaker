import { deserialize, serializeForComparison } from "@/project/io";
import { prepareWebExport } from "@/project/webExport";
import type { ToolDefinition, ToolExecResult } from "./types";

// 왜 이름에서 동사를 뺐나(2026-09-17 실측): 「웹으로 내보낼 파일까지 만들어줘」에 대해 모델이
// 「배포 번들(export_game) 생성을 완료했습니다」라고 답했다. 파일은 하나도 생기지 않았다.
// 이 툴은 아무것도 쓰지 않는 점검 툴이고, ZIP 을 만드는 경로는 사람이 누르는 메뉴(panels/menu.ts)뿐이다.
// 설명문은 이름을 못 이긴다 — `export_` 라는 이름을 매 턴 보는 모델은 그것부터 믿는다.
const checkExportReadiness: ToolDefinition = {
  name: "check_export_readiness",
  description:
    "내보내기 전 점검 전용(읽기). 프로젝트를 웹 플레이어 번들로 직렬화했을 때의 맵/에셋 수와 추정 용량을 계산하고, "
    + "직렬화 왕복이 값을 보존하는지 확인한다. 파일을 만들지 않는다 — ZIP 은 사람이 편집기 메뉴에서 내려받는다. "
    + "이 툴의 결과를 '내보내기 완료'나 '번들 생성'으로 옮겨 적지 말 것.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {},
  },
  run(project): ToolExecResult {
    const prepared = prepareWebExport(project);
    // 하드코딩된 `true` 였다 — 이름이 검증을 약속하는 유일한 필드가 정작 아무것도 보지 않았다.
    // 판정 기준은 저장소 비교와 같다(기본값 정규화·키 순서 무시).
    const shapeRoundTrip =
      serializeForComparison(deserialize(prepared.projectJson))
      === serializeForComparison(prepared.project);
    return {
      summary:
        `내보내기 점검 완료(파일 생성 없음) — 맵 ${prepared.summary.mapCount}개, `
        + `에셋 ${prepared.summary.assetCount}개, 추정 ${formatBytes(prepared.summary.estimatedSizeBytes)}`
        + `, 직렬화 왕복 ${shapeRoundTrip ? "일치" : "불일치"}`,
      ...(shapeRoundTrip
        ? {}
        : { warnings: ["직렬화 왕복이 값을 보존하지 못했습니다 — 내보낸 project.json 을 다시 열면 일부 값이 달라집니다."] }),
      data: {
        ...prepared.summary,
        projectTitle: prepared.project.meta.title,
        shapeRoundTrip,
        producedFile: false,
      },
    };
  },
};

// 옛 이름 호환(지난 대화 기록 재생용). deprecated 라 모델 카탈로그에는 노출되지 않는다.
const exportGame: ToolDefinition = {
  ...checkExportReadiness,
  name: "export_game",
  deprecated: true,
  supersededBy: "check_export_readiness",
};

export const EXPORT_TOOLS: readonly ToolDefinition[] = [checkExportReadiness, exportGame];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
