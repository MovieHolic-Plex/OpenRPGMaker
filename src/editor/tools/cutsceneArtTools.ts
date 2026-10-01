// 컷신 그림 생성 — 「그림을 그린 다음 그 그림을 움직이게 한다」의 첫 절반.
//   generate_cutscene_art role:"sprite"   투명 배경 소품·인물(트럭, 주인공…) — 컷신 picture beat 로 움직인다
//   generate_cutscene_art role:"backdrop" 뷰포트 비율 전체화면 배경(거리, 방…)
// 생성(수십 초)은 prepare 에서 하고, run 은 그 결과를 같은 동기 draft 경계 안에서 리소스로 등록한다.
// prepare 의 실패는 삼켜지므로(asyncToolRunner.prepareTool) 실패 사유를 보관했다가 run 이 ToolError 로 낸다.
import type { GenerateAiImageRequest, GeneratedImageAsset } from "@/ai/imageGenerationClient";
import { processBackdropArt, processSpriteArt, type ProcessedArt } from "@/editor/cutsceneArt/imageProcess";
import { DEFAULT_PLAY_RESOLUTION } from "@/project/playResolution";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const CUTSCENE_ART_TOOL = "generate_cutscene_art";
export const CUTSCENE_ART_ROLES = ["sprite", "backdrop"] as const;
export type CutsceneArtRole = (typeof CUTSCENE_ART_ROLES)[number];

type ImageGenerator = (request: GenerateAiImageRequest) => Promise<GeneratedImageAsset>;

let generatorOverride: ImageGenerator | undefined;
/** 헤드리스 하네스(qa-game)·테스트가 동반 앱 HTTP 대신 쓸 생성기를 꽂는다. */
export function setCutsceneArtGenerator(generator: ImageGenerator | undefined): void {
  generatorOverride = generator;
}

async function generate(request: GenerateAiImageRequest): Promise<GeneratedImageAsset> {
  if (generatorOverride) return generatorOverride(request);
  const { generateAiImage } = await import("@/ai/imageGenerationClient");
  return generateAiImage(request);
}

const SPRITE_KEY_COLOR = "pure magenta (#FF00FF)";

export function cutsceneArtPrompt(role: CutsceneArtRole, prompt: string): string {
  const brief = prompt.replace(/\s+/gu, " ").trim();
  if (role === "sprite") {
    return [
      `Create exactly one 2D game cutscene sprite: ${JSON.stringify(brief)}.`,
      "Style: pixel-art JRPG sprite look, hard dark outline, flat cel shading, chunky readable shapes, limited palette.",
      "The whole subject must be fully visible and not cropped, drawn in a single consistent view, centered, with generous empty margin around it.",
      `Background: one perfectly uniform flat ${SPRITE_KEY_COLOR} fill covering everything that is not the subject — no ground, no floor line, no cast shadow, no gradient, no texture, no second object.`,
      "Never use magenta, pink or purple anywhere in the subject. Draw NO light beams, headlight cones, glow, lens flare, reflections, motion/speed lines, smoke, dust or sparks — only the solid object itself. No text, letters, logos, UI, borders, watermark, or sprite sheet.",
    ].join("\n\n");
  }
  return [
    `Create exactly one wide full-screen 2D game cutscene background: ${JSON.stringify(brief)}.`,
    "Style: pixel-art JRPG scenery look, clean shapes, restrained detail, coherent lighting.",
    "Compose it as an empty stage: NO characters, NO vehicles, NO animals and no text — the game will animate those on top. Keep the main walkable/road band across the lower-middle of the frame so objects can cross it, and keep the horizontal center free of tall obstacles.",
    "Fill the entire canvas edge to edge. No letters, logos, UI, borders, or watermark.",
  ].join("\n\n");
}

interface PreparedArt {
  readonly art?: ProcessedArt;
  readonly error?: string;
  readonly role: CutsceneArtRole;
  readonly name: string;
}

const prepared = new Map<string, PreparedArt>();

export function cutsceneArtKey(args: Record<string, unknown>): string {
  return JSON.stringify([args.role, typeof args.prompt === "string" ? args.prompt.trim() : "", typeof args.name === "string" ? args.name.trim() : ""]);
}

function parseArgs(args: Record<string, unknown>): { role: CutsceneArtRole; prompt: string; name: string; maxSide: number } {
  const role = CUTSCENE_ART_ROLES.find((entry) => entry === args.role);
  if (!role) throw new ToolError(`role은 ${CUTSCENE_ART_ROLES.join("/")} 중 하나여야 합니다.`, { code: "invalid-kind" });
  if (typeof args.prompt !== "string" || args.prompt.trim().length < 4) {
    throw new ToolError("prompt는 4자 이상의 그림 설명이어야 합니다(예: 'side view of a white box delivery truck facing left').", { code: "invalid-args" });
  }
  const prompt = args.prompt.trim();
  if (prompt.length > 1500) throw new ToolError("prompt는 1500자 이하여야 합니다.", { code: "invalid-args" });
  const name = (typeof args.name === "string" ? args.name.trim() : "") || `컷신 ${role === "sprite" ? "소품" : "배경"}: ${prompt.slice(0, 24)}`;
  const maxSide = typeof args.maxSide === "number" && Number.isFinite(args.maxSide) ? Math.max(64, Math.min(768, Math.trunc(args.maxSide))) : 384;
  return { role, prompt, name, maxSide };
}

/** 같은 입력은 같은 id — 재시도·드라이런이 그림을 여러 장 쌓지 않는다. */
function artResourceId(role: CutsceneArtRole, key: string): string {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619) >>> 0;
  return `cutscene_${role}_${hash.toString(36)}`;
}

const generateCutsceneArt: ToolDefinition = {
  name: CUTSCENE_ART_TOOL,
  description:
    "컷신에서 움직일 그림을 이미지 모델로 만들어 picture 리소스로 등록하고 resourceId·크기를 돌려준다. "
    + "role=sprite: 투명 배경으로 오려 낸 소품·인물(트럭, 주인공, 자동차…). 한 장에 한 대상, 한 시점(예: 'side view facing left'), 전신이 다 보이게 설명한다. "
    + "role=backdrop: 인물·탈것이 없는 전체화면 빈 무대 배경(거리, 방…). 생성에 1분 안팎이 걸리고 호출마다 한 장만 만든다. "
    + "반환된 resourceId 는 script_cutscene 의 picture beat(resourceId)나 script_cutscene_impact 에 넣는다. 생성 그림 안에 글자·로고는 넣지 않는다. "
    + "그림이 맵 타일로 없는 풍경(도로·횡단보도 등)이면 맵을 꾸미는 대신 이 도구로 배경을 만들어 컷신 전용 장면으로 쓴다.",
  mode: "write",
  domains: ["event"],
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["role", "prompt"],
    properties: {
      role: { type: "string", enum: [...CUTSCENE_ART_ROLES], description: "sprite=투명 소품·인물, backdrop=빈 전체화면 배경" },
      prompt: { type: "string", minLength: 4, maxLength: 1500, description: "만들 그림의 구체적 설명(영어 권장). sprite 는 시점·방향을 명시한다." },
      name: { type: "string", maxLength: 120, description: "리소스 표시 이름(생략 시 자동)" },
      maxSide: { type: "integer", minimum: 64, maximum: 768, description: "sprite 긴 변 최대 픽셀(기본 384)" },
    },
  },
  invalidArgsExample: { role: "sprite", prompt: "white box delivery truck, side view facing left, whole truck visible", name: "택배 트럭" },
  async prepare(args): Promise<void> {
    const parsed = parseArgs(args);
    const key = cutsceneArtKey(args);
    if (prepared.get(key)?.art) return;
    try {
      const viewport = DEFAULT_PLAY_RESOLUTION;
      const image = await generate({ prompt: cutsceneArtPrompt(parsed.role, parsed.prompt) });
      const art = parsed.role === "sprite"
        ? await processSpriteArt(image.dataUrl, parsed.maxSide)
        : await processBackdropArt(image.dataUrl, viewport);
      prepared.set(key, { art, role: parsed.role, name: parsed.name });
    } catch (error) {
      prepared.set(key, { error: error instanceof Error ? error.message : String(error), role: parsed.role, name: parsed.name });
    }
  },
  run(draft, args): ToolExecResult {
    const parsed = parseArgs(args);
    const key = cutsceneArtKey(args);
    const entry = prepared.get(key);
    if (!entry) throw new ToolError("그림 생성이 실행되지 않았습니다 — 같은 인자로 다시 호출하세요.", { code: "art-not-prepared" });
    if (!entry.art) throw new ToolError(`그림 생성에 실패했습니다: ${entry.error ?? "알 수 없는 오류"}`, { code: "image-generation-failed" });
    const viewport = draft.system.playResolution ?? DEFAULT_PLAY_RESOLUTION;
    const id = artResourceId(parsed.role, key);
    draft.assets.uploaded[id] = {
      id,
      name: parsed.name,
      kind: "picture",
      dataUrl: entry.art.dataUrl,
      meta: { width: entry.art.width, height: entry.art.height },
    };
    const fitScale = parsed.role === "backdrop" ? Math.round((viewport.width / entry.art.width) * 100) : 100;
    return {
      summary: `${parsed.role === "sprite" ? "소품" : "배경"} 그림 ${id}(${entry.art.width}×${entry.art.height})을 만들어 등록했습니다.`
        + (parsed.role === "backdrop" ? ` 화면에 꽉 채우려면 picture beat 의 scale=${fitScale}, x=0, y=0.` : " script_cutscene picture beat 나 script_cutscene_impact 에 resourceId 로 넣으세요."),
      data: { resourceId: id, role: parsed.role, name: parsed.name, width: entry.art.width, height: entry.art.height, ...(parsed.role === "backdrop" ? { fitScale } : {}) },
    };
  },
};

export const CUTSCENE_ART_TOOLS: readonly ToolDefinition[] = [generateCutsceneArt];
