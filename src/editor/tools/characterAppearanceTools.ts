import type { CharacterAppearanceRecord, Project } from "@/project/types";
import { imageGenerationHandoffRefusedError } from "@/editor/imageGenerationNotice";
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
  name: "generate_character_appearance",
  description: "캐릭터 외형의 비어 있는 얼굴 또는 상반신 칸을 그려 바로 채운다(사용자 그림 계정, 이미 채운 칸은 바꾸지 않는다). 그 외형을 쓰는 이벤트의 대사 얼굴도 외형으로 돌린다. 짝 얼굴이 그 인물(이름·역할·생김새)과 맞지 않을 때 쓴다. 걷기 캐릭터칩은 generate_walk_chip. 생성기가 없는 실행 경로에서는 하드 오류로 끝난다.",
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
    throw imageGenerationHandoffRefusedError("generate_character_appearance",
      `외형 ${record.id} 의 ${slot} 칸은 지금 환경에서 그릴 수 없습니다. 대신 upsert_resource 로 그림을 등록하거나, 사용자에게 그림 생성을 요청하세요.`);
  },
}];
