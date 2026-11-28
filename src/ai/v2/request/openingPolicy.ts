// 오프닝 모델 등급(2단계) + 생성형 이미지 유무 정책 — 조수 v2 프롬프트·도구 노출·검수의 유일 정본.
// 오너 결정(2026-11-26, 2026-11-28 GPT-6.2 Sol 출하 기본 편입):
//   - 고성능(high)은 Sol · Sonnet · Opus · Fable · Astra · Neon · Carbon · Argon 8종으로 한정한다.
//   - 그 이외의 모든 모델은 중간(medium)으로 분류한다.
//   - 생성형 이미지는 필수가 아니라 보너스 업그레이드다: 이미지 제공자가 없어도 엔진 무대(author_opening_stage) +
//     map-view + 번들 파노라마/내장 FX + 타이포/그림책으로 100% 완결하고, 생성 가능할 때만 핵심 CG 1~2장을 선택 추가한다.

export type OpeningModelTier = "high" | "medium";

/** 오프닝 고성능 등급으로 인정하는 8개 모델 계열. */
export const HIGH_OPENING_MODEL_FAMILIES = [
  "sol",
  "sonnet",
  "opus",
  "fable",
  "astra",
  "neon",
  "carbon",
  "argon",
] as const;

const HIGH_MODEL_PATTERN = new RegExp(
  `(?:^|[^a-z])(?:${HIGH_OPENING_MODEL_FAMILIES.join("|")})(?:$|[^a-z])`,
  "iu",
);

/**
 * 모델 ID 로 오프닝 등급을 판별한다.
 * Sonnet · Opus · Fable · Astra · Neon · Carbon · Argon 만 "high", 그 외(빈 값·미상 포함)는 전부 "medium".
 */
export function resolveOpeningModelTier(model?: string | null): OpeningModelTier {
  const normalized = typeof model === "string" ? model.trim() : "";
  if (!normalized) return "medium";
  return HIGH_MODEL_PATTERN.test(normalized) ? "high" : "medium";
}

export interface OpeningAuthoringPolicy {
  readonly tier: OpeningModelTier;
  readonly canGenerateImages: boolean;
  /** 다중 레이어 2D 애니메틱 연출(키프레임·카메라 궤적·빛기둥·파티클·오디오 큐)을 직접 지시할지. */
  readonly allowAnimaticDirecting: boolean;
  /** 생성형 오프닝 CG(generate_art target:"opening")를 선택 업그레이드로 안내할지. */
  readonly allowGeneratedOpeningCg: boolean;
}

export function resolveOpeningPolicy(options?: {
  readonly model?: string | null;
  readonly canGenerateImages?: boolean;
}): OpeningAuthoringPolicy {
  const tier = resolveOpeningModelTier(options?.model);
  const canGenerateImages = options?.canGenerateImages === true;
  return {
    tier,
    canGenerateImages,
    allowAnimaticDirecting: tier === "high",
    allowGeneratedOpeningCg: canGenerateImages,
  };
}

/**
 * 고성능(high) 전용 다중 레이어 애니메틱 연출 도구.
 * 중간(medium) 모델에는 이 도구들을 지시·기본 노출에서 빼서, 엔진 무대(author_opening_stage) · 단순 map-view 컷 ·
 * 확인식 그림책(make_opening_storybook) 같은 고신뢰 경로에 집중하게 한다.
 * (create_opening_animatic_shot · place_opening_background · set_opening_caption 은 map-view 배경에 필요하므로 medium 에도 남긴다.)
 */
export const HIGH_ONLY_OPENING_TOOLS: ReadonlySet<string> = new Set([
  "get_animatic_capabilities",
  "set_opening_pixel_grid",
  "upsert_opening_layer",
  "animate_opening_layer",
  "animate_opening_camera",
  "set_opening_transition",
  "upsert_opening_audio_cue",
  "place_opening_charset_actor",
]);

/** gameCard 의 opening 한 줄 — 모델 등급과 이미지 생성 가능 여부에 맞춰 바꾼다. */
export function openingGameCardLine(policy: OpeningAuthoringPolicy): string {
  const cgNote = policy.allowGeneratedOpeningCg
    ? " Image generation IS available: actively generate 2–4 bespoke story CGs matching THIS game's exact genre/setting via generate_art{target:'opening', prompt, style, referenceResourceId} (reuse shot 1's resourceId as referenceResourceId so all shots share one art style), then assemble them as key-cg/title-card shots in compose_opening. Only use nature panoramas if the story actually takes place outdoors/sky/sea."
    : " Image generation is unavailable in this run — do not call generate_art for opening; finish 100% with compose_opening (live map-tour, mood title-card, or fitting landscape parallax) and/or author_opening_stage.";
  if (policy.allowAnimaticDirecting) {
    return `  · Game-start opening (high tier): call compose_opening ONCE for full-bleed 480×270 cinematic shots (key-cg, map-tour, title-card, plus optional landscape parallax), and pair with author_opening_stage when people walk/talk on a real map; only use low-level animatic tools for custom tweaks; title is set_title_screen.${cgNote}`;
  }
  return `  · Game-start opening (medium tier — high-reliability): call compose_opening ONCE for 2–4 clean full-bleed shots (key-cg when image gen is available, map-tour, title-card) and/or author_opening_stage (3–5 beats on the real map), or make_opening_storybook for Enter-paced narration. Do not hand-assemble low-level animatic keyframes; title is set_title_screen.${cgNote}`;
}

/** toolGroups 의 오프닝 전용 카드 — 등급(high/medium) + 이미지 생성 유무에 맞춘 실전 지시문. */
export function openingTierCard(policy: OpeningAuthoringPolicy): string {
  const imageRule = policy.allowGeneratedOpeningCg
    ? "· Bespoke opening CGs (image generation available): generate 2–4 story-specific key CGs with generate_art{target:'opening', prompt, style} matching THIS game's genre (noir/mystery/modern/medieval/eastern/sci-fi/fantasy — NEVER default to generic falling stars or night skies unless asked). Pass the first shot's resourceId as referenceResourceId on subsequent shots so every CG shares one cohesive art style & palette, then wire them into compose_opening's key-cg and title-card shots (full-color, zero 64-color quantization). If generation errors out, fall back smoothly to map-tour + mood title-card + author_opening_stage without stalling."
    : "· No image generation in this run: do NOT call generate_art. Complete the opening 100% with compose_opening (live map-tour, mood title-card, and fitting landscape parallax only when relevant) plus author_opening_stage.";
  if (policy.allowAnimaticDirecting) {
    return [
      "· Opening (high tier — use compose_opening first): build the full-bleed 480×270 cinematic sequence in ONE compose_opening{shots:[…], musicResourceId} call instead of 15 low-level calls. Match THIS game's exact genre using full-color key-cg (Ken Burns zoom/pan), live map-tour, genre-neutral title-card (with resourceId or mood), FX (rain/snow/sparks/dust/petals/shaft/glow/flash-hit/shake/tints — pick only what fits the scene), and bundled sfx (bell/gong/impact/magic/sword/hit).",
      "· Real-map walking/talking scene: pair compose_opening with author_opening_stage{mapId, x, y, beats} (skippable autorun cutscene on the real map with camera pan, NPC walk/talk, weather/particles, no letterbox when there are captions). Only use low-level animatic tools if adding custom tweaks on top of compose_opening.",
      imageRule,
    ].join("\n");
  }
  return [
    "· Opening (medium tier — 1-call director route): use compose_opening{shots:[…], musicResourceId} for 2–4 full-bleed 480×270 shots (key-cg when image gen is available, live map-tour, title-card with captions, FX, SFX), optionally followed by a 3–5 beat author_opening_stage on the real map, OR make_opening_storybook for Enter-paced narration. Do NOT hand-build low-level animatic keyframes.",
    imageRule,
  ].join("\n");
}
