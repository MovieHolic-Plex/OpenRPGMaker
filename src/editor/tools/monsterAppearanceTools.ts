import { MONSTER_APPEARANCE_WRITERS } from "@/ai/monsterAppearanceEvidence";
import type { ToolDefinition } from "./types";

/** Tool envelope only: desired visible identity never becomes an enemy/species field. */
export function withMonsterAppearanceEnvelope(tool: ToolDefinition): ToolDefinition {
  if (!MONSTER_APPEARANCE_WRITERS.some(name => name === tool.name)) return tool;
  return {
    ...tool,
    description: `${tool.description} AI가 새 외형을 선택/변경할 때 get_monster_resource로 정확한 소재의 현재 상세를 먼저 읽고, 표시 이름과 독립적인 원하는 시각적 정체성을 루트 appearanceTags에 선언하세요. 태그는 선택 소재의 유효 태그와 일치해야 하며 monster/enemy·색상·크기 같은 공통 분류 외에 구체적 정체성 태그가 최소 하나 필요합니다.`,
    parameters: {
      ...tool.parameters,
      properties: {
        ...tool.parameters.properties,
        appearanceTags: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 64 },
          description: "원하는 외형의 정체성 태그(1~32개). 몬스터 소재의 현재 tags에서 확인. 적 이름이 아니라 의도한 시각적 정체성을 선언하며 저장하지 않습니다.",
        },
      },
    },
  };
}
