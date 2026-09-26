// editor/tools/titleImproveTools.ts
// improve_title_screen — 「타이틀을 N단계로 개선해줘」를 결정적 단계로 푼다(2026-09-26).
// 단계는 누적이다: 3단계 = 1+2+3. 저작자가 이미 정한 값은 덮지 않고 비어 있는 칸만 채운다.

import { STARTER_TITLE_BGM_ID } from "@/assets/bgmStarterTracks";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { findTitleOpeningPreset, TITLE_OPENING_PRESETS, titleOpeningPresetEffects } from "@/project/titleEffects";
import type { TitleParticlePreset, TitleScreenSettings } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const PARTICLE_PRESETS: readonly TitleParticlePreset[] = ["snow", "rain", "fireflies"];

export const TITLE_IMPROVE_STAGES = [
  { stage: 1, label: "등장 연출", fields: ["intro", "logoStyle", "backgroundFit"] },
  { stage: 2, label: "분위기", fields: ["particles", "musicResourceId"] },
  { stage: 3, label: "영역 효과", fields: ["effects", "menuStyle"] },
] as const;

type Applied = { readonly stage: number; readonly field: string; readonly value: unknown };

function fillStage1(current: TitleScreenSettings, applied: Applied[]): void {
  if (!current.intro) {
    current.intro = { logo: "riseIn", menu: "slideUp", delayMs: 300, staggerMs: 120 };
    applied.push({ stage: 1, field: "intro", value: current.intro });
  }
  if (!current.logoStyle) {
    current.logoStyle = "metal";
    applied.push({ stage: 1, field: "logoStyle", value: current.logoStyle });
  }
  if (!current.backgroundFit) {
    current.backgroundFit = "cover";
    applied.push({ stage: 1, field: "backgroundFit", value: current.backgroundFit });
  }
}

function fillStage2(current: TitleScreenSettings, particles: TitleParticlePreset, musicAvailable: boolean, applied: Applied[]): void {
  if (!current.particles) {
    current.particles = { preset: particles, density: 40 };
    applied.push({ stage: 2, field: "particles", value: current.particles });
  }
  if (!current.musicResourceId && musicAvailable) {
    current.musicResourceId = STARTER_TITLE_BGM_ID;
    applied.push({ stage: 2, field: "musicResourceId", value: current.musicResourceId });
  }
}

function fillStage3(current: TitleScreenSettings, presetId: string, applied: Applied[]): void {
  const preset = findTitleOpeningPreset(presetId)!;
  if (!current.effects || current.effects.length === 0) {
    current.effects = titleOpeningPresetEffects(preset);
    applied.push({ stage: 3, field: "effects", value: `${preset.id} ${current.effects.length}개` });
  }
  if (!current.menuStyle) {
    current.menuStyle = preset.menuStyle;
    applied.push({ stage: 3, field: "menuStyle", value: current.menuStyle });
  }
}

const improveTitleScreen: ToolDefinition = {
  name: "improve_title_screen",
  description:
    "「타이틀을 N단계로 개선해줘」의 정본. stage 까지 누적 적용한다 — 1=등장 연출(로고 떠오름·메뉴 밀려 올라옴, 로고 질감, 배경 맞춤), "
    + "2=분위기(파티클·타이틀 BGM), 3=영역 효과(빛내림·먼지·안개 등 오프닝 프리셋, 글자 메뉴). "
    + "저작자가 이미 정한 값은 덮지 않고 빈 칸만 채운다. 개별 값을 바꾸려면 set_title_screen, 새 키아트는 generate_title_art.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      stage: { type: "integer", minimum: 1, maximum: 3, description: "적용할 마지막 단계(1~3). 앞 단계도 함께 적용된다" },
      openingPreset: {
        type: "string",
        enum: TITLE_OPENING_PRESETS.map((preset) => preset.id),
        description: "3단계 영역 효과 프리셋. 기본 forestMorning",
      },
      particles: { type: "string", enum: PARTICLE_PRESETS, description: "2단계 파티클. 기본 fireflies" },
    },
    required: ["stage"],
    additionalProperties: false,
  },
  invalidArgsExample: { stage: 3 },
  run(draft, args): ToolExecResult {
    const stage = args.stage;
    if (typeof stage !== "number" || !Number.isInteger(stage) || stage < 1 || stage > 3) {
      throw new ToolError("stage 는 1~3 정수여야 합니다.", { code: "invalid-args" });
    }
    const presetId = typeof args.openingPreset === "string" ? args.openingPreset : "forestMorning";
    if (!findTitleOpeningPreset(presetId)) {
      throw new ToolError(`openingPreset '${presetId}' 는 없습니다. 가능: ${TITLE_OPENING_PRESETS.map((item) => item.id).join(", ")}`, { code: "invalid-args" });
    }
    const particles = (typeof args.particles === "string" ? args.particles : "fireflies") as TitleParticlePreset;

    draft.system.titleScreen ??= defaultTitleScreenSettings();
    const current = draft.system.titleScreen;
    const applied: Applied[] = [];
    fillStage1(current, applied);
    if (stage >= 2) fillStage2(current, particles, collectResourceIds(draft).has(STARTER_TITLE_BGM_ID), applied);
    if (stage >= 3) fillStage3(current, presetId, applied);

    const stageLabels = TITLE_IMPROVE_STAGES.filter((entry) => entry.stage <= stage).map((entry) => `${entry.stage}.${entry.label}`);
    const kept = TITLE_IMPROVE_STAGES.filter((entry) => entry.stage <= stage)
      .flatMap((entry) => entry.fields)
      .filter((field) => !applied.some((item) => item.field === field));
    return {
      summary:
        `타이틀 ${stage}단계 개선(${stageLabels.join(" → ")}) — 새로 채운 항목 ${applied.length}개`
        + `${kept.length ? `, 이미 정해져 있어 유지한 항목: ${kept.join(", ")}` : ""}.`,
      data: { stage, applied, kept },
    };
  },
};

export const TITLE_IMPROVE_TOOLS: readonly ToolDefinition[] = [improveTitleScreen];
