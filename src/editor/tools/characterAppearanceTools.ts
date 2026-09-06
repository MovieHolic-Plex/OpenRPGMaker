import type { CharacterAppearanceRecord, Project } from "@/project/types";
import { ToolError, type ToolDefinition } from "./types";

export const APPEARANCE_GENERATION_TOOL = "generate_character_appearance";

export function prepareAppearanceGeneration(project: Project, args: Record<string, unknown>): {
  readonly record: CharacterAppearanceRecord;
  readonly slot: "face" | "bust";
} {
  const slot = args.slot ?? "face";
  if (slot !== "face" && slot !== "bust") throw new ToolError("얼굴 또는 상반신만 생성할 수 있습니다.", { code: "invalid-args" });
  const record = project.database.characterAppearances?.find((entry) => entry.id === args.appearanceId);
  if (!record) throw new ToolError("외형을 찾을 수 없습니다. 캐릭터 외형 DB에서 먼저 외형을 만드세요.", { code: "not-found" });
  if (record[slot]) throw new ToolError("이미 그림이 있는 칸은 조수가 교체할 수 없습니다.", { code: "appearance-slot-occupied" });
  return { record, slot };
}

export const CHARACTER_APPEARANCE_TOOLS: readonly ToolDefinition[] = [{
  name: APPEARANCE_GENERATION_TOOL,
  description: "캐릭터 외형의 비어 있는 얼굴 또는 상반신 그림 후보를 만든다. 편집기에서는 캐릭터 외형 DB를 열고 생성을 시작한다. 후보는 사용자가 DB에서 적용해야 저장된다. 걷기 캐릭터칩은 생성·변경하지 않는다. 헤드리스에서는 UI 필요 상태만 반환한다.",
  // Pure synchronous preparation in generic runners. The session treats this as
  // a write capability and invokes the specific editor handoff only outside Ask.
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      appearanceId: { type: "string", minLength: 1, description: "캐릭터 외형 DB 레코드 ID" },
      slot: { type: "string", enum: ["face", "bust"], description: "생성할 빈 칸. 기본 face" },
    },
    required: ["appearanceId"],
    additionalProperties: false,
  },
  run(project, args) {
    const { record, slot } = prepareAppearanceGeneration(project, args);
    return {
      summary: "외형 그림 요청을 준비했습니다. 생성에는 편집기 UI가 필요하며 아직 생성·적용되지 않았습니다.",
      data: { status: "ui-required", appearanceId: record.id, slot },
    };
  },
}];
