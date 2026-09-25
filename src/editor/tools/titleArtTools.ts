// editor/tools/titleArtTools.ts
// 타이틀 키아트 한 번에 만들기: 프리셋(효과 좌표) + 장면 설명 → 그림 생성 → 등록 → set_title_screen.
// 실제 생성은 세션(assistantSession)이 맡는다 — 이 툴은 인자 검사와 ui-required 핸드오프만 한다.
import { findTitleOpeningPreset, TITLE_OPENING_PRESETS, type TitleOpeningPreset } from "@/project/titleEffects";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const TITLE_ART_TOOL = "generate_title_art";

const PROMPT_MIN_LENGTH = 4;
const DEFAULT_PRESET_ID = TITLE_OPENING_PRESETS[0]!.id;

export type TitleArtRequest = {
  readonly preset: TitleOpeningPreset;
  readonly prompt: string;
  readonly name: string;
  readonly title?: string;
  readonly logoSubtitle?: string;
};

function optionalText(args: Record<string, unknown>, key: string, max: number): string | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > max) {
    throw new ToolError(`${key}는 ${max}자 이하의 문자열이어야 합니다.`, { code: "invalid-args" });
  }
  return value.trim() || undefined;
}

/** 툴·편집기 버튼이 같은 검사를 쓰게 하는 순수 준비 함수. */
export function prepareTitleArtRequest(args: Record<string, unknown>): TitleArtRequest {
  const presetId = args.preset === undefined ? DEFAULT_PRESET_ID : args.preset;
  const preset = typeof presetId === "string" ? findTitleOpeningPreset(presetId) : undefined;
  if (!preset) {
    throw new ToolError(`preset은 ${TITLE_OPENING_PRESETS.map(entry => entry.id).join("/")} 중 하나여야 합니다.`, { code: "invalid-args" });
  }
  const rawPrompt = args.prompt === undefined ? "" : args.prompt;
  if (typeof rawPrompt !== "string" || rawPrompt.length > 2000) {
    throw new ToolError("prompt는 2000자 이하의 문자열이어야 합니다.", { code: "invalid-args" });
  }
  const prompt = rawPrompt.trim();
  if (prompt.length > 0 && prompt.length < PROMPT_MIN_LENGTH) {
    throw new ToolError(`prompt는 비우거나 ${PROMPT_MIN_LENGTH}자 이상이어야 합니다.`, { code: "invalid-args" });
  }
  const title = optionalText(args, "title", 60);
  const logoSubtitle = optionalText(args, "logoSubtitle", 60);
  const name = optionalText(args, "name", 120) ?? `타이틀 키아트: ${preset.label}`;
  return { preset, prompt, name, ...(title ? { title } : {}), ...(logoSubtitle ? { logoSubtitle } : {}) };
}

/**
 * 키아트 프롬프트. 효과 좌표(빛 방향·칼날 선·물·안개 띠)는 프리셋에 고정돼 있으므로
 * 그림 구도를 그 좌표에 맞추라고 지시한다. 4:3 무대에 cover 로 깔리므로 중요한 것은 가운데 4:3 안에 둔다.
 */
export function buildTitleArtPrompt(request: Pick<TitleArtRequest, "preset" | "prompt">): string {
  const brief = request.prompt.replace(/\s+/gu, " ").trim();
  return [
    "Create exactly one 16:9 key-art background for the title screen of a 2D fantasy JRPG.",
    `Scene: ${request.preset.scene}.`,
    ...(brief ? [`Author's brief (follow it where it does not contradict the layout): ${JSON.stringify(brief)}.`] : []),
    `Layout (percent of the image, measured from the top-left): ${request.preset.layout}`,
    "The screen is cropped to the central 4:3 area, so keep every important subject away from the outer left and right edges, and let the scenery continue seamlessly to both edges. Keep the left third calmer so a menu stays readable, and keep the top-left quarter free of busy detail for the game logo. Achieve this only with the scene itself (open sky, shadowed foliage, distant haze); never paint a dark box, panel, vignette band or placeholder there.",
    "The layout percentages are composition guidance only: do not draw grid lines, guides, rulers, frames or any overlay on the picture.",
    "Render it as richly painted 2D anime-style game key art: soft atmospheric depth, warm coherent lighting, crisp foreground, hazy distance. Avoid photographic rendering and 3D-rendered surfaces.",
    "Do not add any text, letters, logos, titles, watermarks, signatures, menus, buttons, borders or letterboxing.",
  ].join("\n\n");
}

const generateTitleArt: ToolDefinition = {
  name: TITLE_ART_TOOL,
  description:
    "타이틀 키아트를 이미지 모델로 만들어 배경으로 걸고, 프리셋의 빛내림·빛 알갱이·칼날 반사광·물결·안개와 로고/메뉴 질감을 한 번에 적용한다. "
    + "preset 이 구도(빛 방향·칼 위치)를 정하고, 생성 뒤 비전 모델이 그림을 보고 효과 좌표(해·칼날·강·안개)를 실제 그림에 맞춘다. 효과만 바꿀 때는 set_title_screen.",
  mode: "read",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      preset: { type: "string", enum: TITLE_OPENING_PRESETS.map(entry => entry.id), description: TITLE_OPENING_PRESETS.map(entry => `${entry.id}=${entry.label}`).join(", ") },
      prompt: { type: "string", maxLength: 2000, description: "장면에 더할 설명(선택). 글자는 넣지 않는다." },
      title: { type: "string", maxLength: 60 },
      logoSubtitle: { type: "string", maxLength: 60 },
      name: { type: "string", maxLength: 120 },
    },
  },
  run(_project, args): ToolExecResult {
    const request = prepareTitleArtRequest(args);
    return {
      summary: "타이틀 키아트 생성 요청을 준비했습니다. 생성에는 편집기가 필요하며 아직 만들어지지 않았습니다.",
      data: { status: "ui-required", preset: request.preset.id, prompt: request.prompt, name: request.name },
    };
  },
};

export const TITLE_ART_TOOLS: readonly ToolDefinition[] = [generateTitleArt];
