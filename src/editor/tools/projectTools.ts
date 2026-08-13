import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset, type GenrePresetId } from "@/project/genrePresets";
import { replaceProjectContents } from "./historyTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const MAX_PROMPT_LENGTH = 2000;
const MAX_TITLE_LENGTH = 120;
const GENRE_PRESETS: readonly GenrePresetId[] = ["monster-collect", "horror-chase", "farm-life"];

function boundedText(args: Record<string, unknown>, key: "prompt" | "title", maxLength: number): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolError(`${key}는 비어 있지 않은 문자열이어야 합니다.`, { code: "invalid-args" });
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ToolError(`${key}는 ${maxLength}자 이하여야 합니다.`, { code: "invalid-args" });
  }
  return trimmed;
}

const resetProject: ToolDefinition = {
  name: "reset_project",
  description: "현재 프로젝트 전체를 버리고 유효한 빈 프로젝트에서 다시 시작한다. 사용자가 새 프로젝트/처음부터/초기화/reset/start project를 명시할 때만 호출한다. 원시 Project JSON은 받지 않는다.",
  mode: "write",
  domains: ["system", "map"],
  parameters: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "새 프로젝트의 추상적 방향(최대 2000자). 원시 Project JSON 금지" },
      title: { type: "string", description: "프로젝트/타이틀 화면 제목(최대 120자)" },
      genrePreset: { type: "string", enum: GENRE_PRESETS, description: "선택 장르 프리셋" },
    },
    required: ["prompt", "title"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const prompt = boundedText(args, "prompt", MAX_PROMPT_LENGTH);
    const title = boundedText(args, "title", MAX_TITLE_LENGTH);
    if (Object.keys(args).some((key) => !["prompt", "title", "genrePreset"].includes(key))) {
      throw new ToolError("reset_project는 prompt, title, genrePreset만 받습니다. 원시 Project payload는 허용하지 않습니다.", { code: "invalid-args" });
    }
    const genrePreset = args.genrePreset as GenrePresetId | undefined;
    const seed = createBlankProject();
    seed.meta = { ...seed.meta, title };
    if (seed.system.titleScreen) seed.system.titleScreen.title = title;
    if (genrePreset) applyGenrePreset(seed, genrePreset);
    replaceProjectContents(draft, seed);
    return {
      summary: `현재 프로젝트를 '${title}' 빈 프로젝트로 교체합니다${genrePreset ? ` · 장르 ${genrePreset}` : ""}`,
      data: { title, ...(genrePreset ? { genrePreset } : {}) },
      warnings: [`현재 프로젝트의 모든 맵·이벤트·DB 내용을 교체합니다. 요청 방향: ${prompt.slice(0, 120)}`],
    };
  },
};

export const PROJECT_TOOLS: readonly ToolDefinition[] = [resetProject];
