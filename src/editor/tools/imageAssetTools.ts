import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

export const IMAGE_ASSET_TOOL = "generate_image_asset";
// 몬스터 그림 생성은 2026-10-02 뺐다 — 전투 몬스터는 도트 측면 시트 140종(list_monster_resources)에서 고른다.
export const IMAGE_ASSET_KINDS = ["picture", "title", "backdrop"] as const;
export type ImageAssetKind = (typeof IMAGE_ASSET_KINDS)[number];

const PROMPT_MIN_LENGTH = 4;

const KIND_GUIDANCE: Record<ImageAssetKind, string> = {
  picture: "single 2D JRPG item or prop icon, centered, clean outline, no text, no frame",
  title: "wide 16:9 2D JRPG title-screen background, no text or logo",
  backdrop: "wide 16:9 2D JRPG map or battle background, no characters, no text",
};

export function prepareImageAssetRequest(args: Record<string, unknown>): {
  readonly kind: ImageAssetKind;
  readonly prompt: string;
  readonly name: string;
  readonly tags: string[];
} {
  const kind = IMAGE_ASSET_KINDS.find(entry => entry === args.kind);
  if (!kind) throw new ToolError(`kind는 ${IMAGE_ASSET_KINDS.join("/")} 중 하나여야 합니다.`, { code: "invalid-kind" });
  if (typeof args.prompt !== "string" || args.prompt.trim().length < PROMPT_MIN_LENGTH) {
    throw new ToolError(`prompt는 ${PROMPT_MIN_LENGTH}자 이상의 그림 설명이어야 합니다.`, { code: "invalid-args" });
  }
  if (args.name !== undefined && typeof args.name !== "string") {
    throw new ToolError("name은 문자열이어야 합니다.", { code: "invalid-args" });
  }
  const prompt = args.prompt.trim();
  if (prompt.length > 4000) throw new ToolError("prompt는 4000자 이하여야 합니다.", { code: "invalid-args" });
  const name = (typeof args.name === "string" ? args.name.trim() : "") || `AI ${kind}: ${prompt.slice(0, 24)}`;
  if (name.length > 120) throw new ToolError("name은 120자 이하여야 합니다.", { code: "invalid-args" });
  if (args.tags !== undefined && (!Array.isArray(args.tags) || args.tags.length > 32
    || !args.tags.every(tag => typeof tag === "string" && tag.trim().length > 0 && tag.length <= 64))) {
    throw new ToolError("tags는 태그당 1~64자인 문자열 배열(최대 32개)이어야 합니다.", { code: "invalid-args" });
  }
  const tags = Array.isArray(args.tags) ? [...new Set((args.tags as string[]).map(tag => tag.trim()))] : [];
  return { kind, prompt, name, tags };
}

const IMAGE_ASSET_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "prompt"],
  properties: {
    kind: { type: "string", enum: [...IMAGE_ASSET_KINDS], description: "picture=아이콘/소품, title=타이틀 배경, backdrop=맵·전투 배경. 몬스터 그림은 만들지 않는다 — list_monster_resources 의 도트 몬스터를 쓴다" },
    prompt: { type: "string", minLength: PROMPT_MIN_LENGTH, maxLength: 4000, description: "만들 그림의 구체적인 설명" },
    name: { type: "string", maxLength: 120, description: "리소스 표시 이름(생략 시 자동 생성)" },
    tags: { type: "array", items: { type: "string", minLength: 1, maxLength: 64 }, description: "리소스 검색 태그 1~32개(선택)." },
  },
};

const generateImageAsset: ToolDefinition = {
  name: IMAGE_ASSET_TOOL,
  description:
    "범용 그림 리소스를 이미지 모델로 만든다. kind에 따라 아이템 아이콘(picture), 타이틀(title), 맵·전투 배경(backdrop)을 만들며, "
    + "성공하면 등록한 resourceId를 반환한다. 반환된 id를 upsert_item의 item.iconResourceId, set_title_screen, set_game_over 등에 연결한다. 몬스터 그림은 만들 수 없다 — 전투는 도트 측면이라 list_monster_resources 의 도트 몬스터 140종에서 고른다. "
    + "그림 안에 글자·로고·버튼·워터마크를 넣지 않는다.",
  mode: "read",
  parameters: IMAGE_ASSET_SCHEMA,
  run(_project, args): ToolExecResult {
    const request = prepareImageAssetRequest(args);
    return {
      summary: `${request.kind} 그림 생성 요청을 준비했습니다. 생성에는 편집기가 필요하며 아직 등록되지 않았습니다.`,
      data: { status: "ui-required", ...request },
    };
  },
};

export function imageAssetPrompt(kind: ImageAssetKind, prompt: string): string {
  return [
    `Create exactly one ${KIND_GUIDANCE[kind]} for a 2D top-down JRPG maker.`,
    `Subject brief: ${JSON.stringify(prompt.replace(/\s+/gu, " ").trim())}.`,
    "Use coherent hand-painted 2D game art with restrained detail and clear silhouette. Do not add letters, captions, logos, UI, borders, watermarks, signatures or a sprite sheet.",
    kind === "picture"
      ? "Use a uniform solid white background with no checkerboard, scenery or floor so the asset reads clearly in the game." :
      "Fill the entire canvas and keep important visual detail away from the center where game UI may appear.",
  ].join("\n\n");
}

export const IMAGE_ASSET_TOOLS: readonly ToolDefinition[] = [generateImageAsset];
