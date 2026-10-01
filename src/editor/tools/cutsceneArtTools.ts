// 컷신 그림 생성 — 「그림을 그린 다음 그 그림을 움직이게 한다」의 첫 절반.
//   generate_cutscene_art role:"sprite"   투명 배경 소품·인물(트럭, 주인공…) — 컷신 picture beat 로 움직인다
//   generate_cutscene_art role:"backdrop" 뷰포트 비율 전체화면 배경(거리, 방…)
// 생성(수십 초)은 prepare 에서 하고, run 은 그 결과를 같은 동기 draft 경계 안에서 리소스로 등록한다.
// prepare 의 실패는 삼켜지므로(asyncToolRunner.prepareTool) 실패 사유를 보관했다가 run 이 ToolError 로 낸다.
import type { GenerateAiImageRequest, GeneratedImageAsset } from "@/ai/imageGenerationClient";
import { processBackdropArt, processIllustrationBackdrop, processIllustrationSprite, processSpriteArt, type ProcessedArt } from "@/editor/cutsceneArt/imageProcess";
import { DEFAULT_PLAY_RESOLUTION } from "@/project/playResolution";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const CUTSCENE_ART_TOOL = "generate_cutscene_art";
export const CUTSCENE_ART_ROLES = ["sprite", "backdrop"] as const;
export const CUTSCENE_ART_STYLES = ["game", "illustration"] as const;
export type CutsceneArtStyle = (typeof CUTSCENE_ART_STYLES)[number];
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

/**
 * 게임의 화면 계약 — 모든 컷신 그림이 같은 눈으로 그려져야 맵·캐릭터셋과 이질감이 없다.
 * 16×16 타일, 320×240 화면, FF6·크로노 트리거 같은 SNES 16비트 JRPG 의 «3/4 탑뷰»(약 45° 내려다봄, 소실점 없는 평행 투영).
 */
export const GAME_VIEW_CONTRACT = [
  "Art direction: SNES-era 16-bit JRPG field graphics (Final Fantasy VI / Chrono Trigger overworld-and-town style), true pixel art with crisp hard-edged pixels, limited palette, no anti-aliasing, no gradients, no blur, no painterly or photographic rendering.",
  "Camera: classic 3/4 top-down JRPG view — the camera looks down from high above at roughly 45-60 degrees with ORTHOGRAPHIC (parallel) projection and NO perspective vanishing point. Ground is a flat plane seen from above; roofs and top surfaces are visible; walls show only their front (south) faces; things further north are higher on screen but NOT smaller.",
].join(" ");

/** illustration: 맵·캐릭터와 한 화면에 나오지 않는 그림(회상·환영·꿈·편지) — 게임 시점·해상도 계약을 걸지 않는다. */
function illustrationPrompt(role: CutsceneArtRole, brief: string): string {
  if (role === "sprite") {
    return [
      `Create exactly one illustration cutout: ${JSON.stringify(brief)}.`,
      "Hand-painted 2D game illustration, clear silhouette, fully visible and not cropped, centered with generous margin.",
      `Background: one perfectly uniform flat ${SPRITE_KEY_COLOR} fill — no ground, shadow, gradient or second object. Never use magenta, pink or purple in the subject. No light beams, glow, motion lines, text, logos, UI or borders.`,
    ].join("\n\n");
  }
  return [
    `Create exactly one full-screen 4:3 landscape 2D game illustration background: ${JSON.stringify(brief)}.`,
    "Hand-painted look with restrained detail. No characters or vehicles unless the brief asks for them, no text, letters, logos, UI or borders. Fill the whole canvas.",
  ].join("\n\n");
}

export function cutsceneArtPrompt(role: CutsceneArtRole, prompt: string, style: CutsceneArtStyle = "game"): string {
  const brief = prompt.replace(/\s+/gu, " ").trim();
  if (style === "illustration") return illustrationPrompt(role, brief);
  if (role === "sprite") {
    return [
      `Create exactly one game cutscene sprite: ${JSON.stringify(brief)}.`,
      GAME_VIEW_CONTRACT,
      "The object is drawn in the same 3/4 top-down view as the game map: we see its top surface (roof/hood) AND its side or front face. Side-on movement objects (vehicles) are shown side-on with their roof visible from above. Chunky readable shapes, dark outline, 3-4 tone shading per material with light from the upper left.",
      "The whole subject must be fully visible and not cropped, centered, with generous empty margin around it. Plain unmarked surfaces: NO lettering, NO logos, NO numbers, NO signs, NO decals on the subject.",
      `Background: one perfectly uniform flat ${SPRITE_KEY_COLOR} fill covering everything that is not the subject — no ground, no floor line, no cast shadow, no gradient, no texture, no second object.`,
      "Never use magenta, pink or purple anywhere in the subject. Draw NO light beams, headlight cones, glow, lens flare, reflections, motion/speed lines, smoke, dust or sparks — only the solid object itself. No text, letters, logos, UI, borders, watermark, or sprite sheet.",
    ].join("\n\n");
  }
  return [
    `Create exactly one full-screen game cutscene background (4:3 landscape): ${JSON.stringify(brief)}.`,
    GAME_VIEW_CONTRACT,
    "Build the scene like a tile-based RPG map made of 16x16 pixel tiles: flat ground tiles (road, sidewalk, grass), building roofs and front walls, props. NOT a street receding to a vanishing point; NOT a street-level photo-like view.",
    "Compose it as an empty stage: NO characters, NO vehicles, NO animals and no text — the game animates those on top. Layout: a wide straight horizontal road band running left to right across the middle of the frame (about 40% to 75% of the image height), sidewalks above and below it, buildings along the top edge, and any crosswalk drawn as flat stripes on the road in the center. Keep the road band free of poles, signs and obstacles.",
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
  return JSON.stringify([args.role, args.style ?? "game", typeof args.prompt === "string" ? args.prompt.trim() : "", typeof args.name === "string" ? args.name.trim() : ""]);
}

function parseArgs(args: Record<string, unknown>): { role: CutsceneArtRole; style: CutsceneArtStyle; prompt: string; name: string; tiles: number } {
  const role = CUTSCENE_ART_ROLES.find((entry) => entry === args.role);
  if (!role) throw new ToolError(`role은 ${CUTSCENE_ART_ROLES.join("/")} 중 하나여야 합니다.`, { code: "invalid-kind" });
  if (typeof args.prompt !== "string" || args.prompt.trim().length < 4) {
    throw new ToolError("prompt는 4자 이상의 그림 설명이어야 합니다(예: 'side view of a white box delivery truck facing left').", { code: "invalid-args" });
  }
  const prompt = args.prompt.trim();
  if (prompt.length > 1500) throw new ToolError("prompt는 1500자 이하여야 합니다.", { code: "invalid-args" });
  const name = (typeof args.name === "string" ? args.name.trim() : "") || `컷신 ${role === "sprite" ? "소품" : "배경"}: ${prompt.slice(0, 24)}`;
  const tiles = typeof args.tiles === "number" && Number.isFinite(args.tiles) ? Math.max(1, Math.min(14, Math.round(args.tiles))) : 4;
  const style = CUTSCENE_ART_STYLES.find((entry) => entry === args.style) ?? "game";
  return { role, style, prompt, name, tiles };
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
    "컷신 연출용 그림 생성: 컷신에서 움직일 그림(멧돼지·몬스터·동물·트럭·환영·배경)을 이미지 모델로 만들어 picture 리소스로 등록하고 resourceId·크기를 돌려준다. style:game(기본)은 게임 화면 해상도(320×240, 16px 타일)의 16비트 도트로 바꾼다. "
    + "그림은 항상 게임과 같은 눈으로 그려진다 — SNES FF6풍 도트, 소실점 없는 3/4 탑뷰. 프롬프트에 «side view»·«perspective»·«photo»·«painting» 같은 다른 시점·화풍을 쓰지 않는다. "
    + "role=sprite: 투명 배경으로 오려 낸 소품(트럭, 자동차, 상자…). 한 장에 한 대상, 전신이 보이게 설명한다. tiles 로 현실 비례 크기를 정한다. 사람·주인공은 이 도구로 만들지 말고 script_cutscene_staged 의 character 배우(게임 캐릭터셋; 충돌만이면 script_cutscene_impact 의 victimCharacter)를 쓴다. "
    + "role=backdrop: 인물·탈것이 없는 전체화면 빈 무대 배경(거리, 방…). 가로 도로 띠가 화면 가운데(약 40~75% 높이)를 지나게 만든다. 생성에 1분 안팎이 걸리고 호출마다 한 장만 만든다. 결과 그림이 이미지로 함께 전달되니 도로 띠의 위치를 눈으로 읽어 script_cutscene_impact 의 roadTop·roadBottom 에 넣는다. "
    + "반환된 resourceId 는 script_cutscene_staged 의 배우(resourceId)로 넣는다(충돌 전용은 script_cutscene_impact, 그 밖의 특수한 경우만 script_cutscene 의 picture beat). 생성 그림 안에 글자·로고는 넣지 않는다. "
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
      style: { type: "string", enum: [...CUTSCENE_ART_STYLES], description: "game(기본)=맵·캐릭터와 한 화면에 나오는 그림 — 16비트 도트·3/4 탑뷰·게임 해상도로 맞춘다. illustration=회상·환영·꿈·편지처럼 따로 뜨는 그림 — 시점·해상도 계약 없이 일러스트로 둔다. 판단 기준: 이 그림 옆에 맵 타일이나 캐릭터셋 인물이 같이 보이는가." },
      tiles: { type: "integer", minimum: 1, maximum: 14, description: "sprite 긴 변이 16px 타일 몇 칸인지(기본 4). 사람 키가 2칸이므로 트럭 길이 6, 승용차 4, 큰 몬스터 4처럼 현실 비례로 정한다." },
    },
  },
  invalidArgsExample: { role: "sprite", prompt: "white box delivery truck, side view facing left, whole truck visible", name: "택배 트럭" },
  async prepare(args): Promise<void> {
    const parsed = parseArgs(args);
    const key = cutsceneArtKey(args);
    if (prepared.get(key)?.art) return;
    try {
      const viewport = DEFAULT_PLAY_RESOLUTION;
      const image = await generate({ prompt: cutsceneArtPrompt(parsed.role, parsed.prompt, parsed.style) });
      const art = parsed.style === "illustration"
        ? (parsed.role === "sprite" ? await processIllustrationSprite(image.dataUrl) : await processIllustrationBackdrop(image.dataUrl, viewport))
        : (parsed.role === "sprite"
          ? await processSpriteArt(image.dataUrl, { longSidePx: parsed.tiles * 16 })
          : await processBackdropArt(image.dataUrl, viewport));
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

/** 조수가 방금 만든 그림을 눈으로 보게 한다(배경의 도로 띠 위치를 읽어야 한다). */
export function cutsceneArtImages(project: import("@/project/types").Project, data: unknown): { dataUrl: string; label: string }[] {
  const id = (data as { resourceId?: unknown } | undefined)?.resourceId;
  const asset = typeof id === "string" ? project.assets.uploaded[id] : undefined;
  return asset?.dataUrl ? [{ dataUrl: asset.dataUrl, label: asset.name }] : [];
}
