// ai/toolCapabilityIndex.ts
// 시스템 프롬프트에 붙는 "툴 능력 색인" 조립기. 순수 함수(브라우저 접근 금지, 프로젝트 불필요).
// Native tool definitions carry complete descriptions and schemas from the first request.
// This index is navigation only, never a substitute for those definitions.

import { activeTools } from "@/editor/tools";
import type { ToolDefinition, ToolDomain } from "@/editor/tools";

export const TOOL_CAPABILITY_INDEX_HEADING = "## 툴 능력 색인";
const RULE_HEADING = "### 색인 사용 규칙(반드시 준수)";

// 에디터 작업 영역 순서(사람이 읽는 순서 = 안정 정렬 키). 도메인이 없거나 미지의 값이면 CATCH_ALL.
const AREA_ORDER: readonly { readonly domain: ToolDomain; readonly label: string }[] = [
  { domain: "core", label: "핵심" },
  { domain: "map", label: "맵" },
  { domain: "tile", label: "타일·배치" },
  { domain: "event", label: "이벤트" },
  { domain: "database", label: "데이터베이스" },
  { domain: "quest", label: "퀘스트" },
  { domain: "world", label: "월드 그래프" },
  { domain: "battle", label: "전투" },
  { domain: "system", label: "시스템" },
];

const CATCH_ALL_LABEL = "기타";

/** 여러 도메인을 가진 툴은 첫 도메인에만 실린다(중복 금지, 전수 1회 노출 보장). */
function areaLabelOf(tool: ToolDefinition): string {
  const first = tool.domains?.[0];
  const area = AREA_ORDER.find((entry) => entry.domain === first);
  return area?.label ?? CATCH_ALL_LABEL;
}

/**
 * 활성(비 deprecated) 툴 이름만 영역별로 묶은 색인 텍스트.
 * 기본 입력은 activeTools() 이며, 호출자가 목록을 넘겨도 deprecated 는 다시 걸러낸다.
 */
export function buildToolCapabilityIndex(tools: readonly ToolDefinition[] = activeTools()): string {
  const live = tools.filter((tool) => tool.deprecated !== true && tool.supersededBy === undefined);
  const byLabel = new Map<string, string[]>();
  for (const tool of live) {
    const label = areaLabelOf(tool);
    const bucket = byLabel.get(label) ?? [];
    bucket.push(tool.name);
    byLabel.set(label, bucket);
  }

  const lines: string[] = [
    `${TOOL_CAPABILITY_INDEX_HEADING}(활성 ${live.length}개 · 전체 스키마는 tools 참조)`,
    "활성 도구의 전체 설명과 입력 스키마는 처음부터 tools에 제공된다. 질문 모드에서는 조회 도구만 호출할 수 있다.",
  ];
  for (const { label } of AREA_ORDER) {
    const names = byLabel.get(label);
    if (!names || names.length === 0) continue;
    lines.push(`- ${label}: ${names.join(", ")}`);
  }
  const rest = byLabel.get(CATCH_ALL_LABEL);
  if (rest && rest.length > 0) lines.push(`- ${CATCH_ALL_LABEL}: ${rest.join(", ")}`);

  lines.push(
    "",
    RULE_HEADING,
    "1. 목록에 있는 이름은 전부 호출 가능한 실제 기능이다.",
    "2. find_tools(query)는 필요한 도구를 찾는 검색 보조이며, 스키마를 열기 위한 필수 단계가 아니다.",
    "3. 목록에 있는 기능을 \"그 기능이 없습니다\"·\"지원하지 않습니다\"라고 보고하거나 work item 을 skip 하는 것은 결함이다 — 실제 도구 정의와 실행 결과를 확인한다.",
    "4. 단, UX 정책의 진짜 엔진 한계(3D, 실시간 액션 전투, 외부 API/플러그인, 실제 배포 미지원)는 그대로다.",
  );
  return lines.join("\n");
}
