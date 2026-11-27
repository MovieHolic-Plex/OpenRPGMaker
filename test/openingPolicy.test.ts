import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import {
  HIGH_ONLY_OPENING_TOOLS,
  resolveOpeningModelTier,
  resolveOpeningPolicy,
} from "@/ai/v2/request/openingPolicy";
import { buildV2SystemPrompt } from "@/ai/v2/prompt/systemPrompt";
import { exposeV2Tools } from "@/ai/v2/tools/toolExposure";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { OPENING_DIRECTOR_TOOLS } from "@/editor/tools/openingDirectorTools";
import { OPENING_STAGE_TOOLS } from "@/editor/tools/openingStageTools";
import { coerceToolArgs } from "@/ai/piAgent/argCoerce";

describe("openingPolicy", () => {
  it("limits high tier strictly to Sonnet, Opus, Fable, Astra, Neon, Carbon, Argon", () => {
    const highModels = [
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "fable-5-2",
      "gpt-6.2-astra",
      "gemini-4-neon",
      "carbon-1",
      "gemini-4-argon-high",
      "sonnet",
      "OPUS",
    ];
    for (const model of highModels) {
      expect(resolveOpeningModelTier(model)).toBe("high");
    }

    const mediumModels = [
      "gemini-3.8-flash",
      "claude-haiku-5-5",
      "gpt-6.1-terra",
      "gpt-6.2-sol",
      "gpt-6-luna",
      "deepseek-v4.1-flash",
      "gpt-5.4-mini",
      "",
      undefined,
    ];
    for (const model of mediumModels) {
      expect(resolveOpeningModelTier(model)).toBe("medium");
    }
  });

  it("hides high-only animatic tools for medium models and hides generate_art when image generation is unavailable", () => {
    const p = createBlankProject() as Project;
    const runExposure = (model: string, canGenerateImages: boolean) => {
      const env = {
        ctx: { project: p, currentMapId: p.startMapId, assistantRun: true },
        request: { task: "새 게임 오프닝 만들어 줘", provider: "local-cli:claude", model, mapIds: [], project: p, projectKey: "policy-test" },
        canGenerateImages,
        ...(canGenerateImages ? { generateImage: async () => ({ dataUrl: "", mimeType: "image/png", model: "mock", provider: "mock" }) } : {}),
        emit() {},
        record() {},
        sideChat: async () => "{}",
        render: async () => "",
        checkpoint: async () => {},
      } as never;
      return exposeV2Tools(env, createV2Tools(env, new V2Session()));
    };

    const mediumNoImg = runExposure("gemini-3.8-flash", false);
    const mediumVisible = new Set([...mediumNoImg.tools.map((t) => t.name), ...mediumNoImg.offered]);
    for (const tool of HIGH_ONLY_OPENING_TOOLS) expect(mediumVisible.has(tool)).toBe(false);
    expect(mediumVisible.has("generate_art")).toBe(false);
    expect(mediumVisible.has("compose_opening")).toBe(true);
    expect(mediumVisible.has("author_opening_stage")).toBe(true);
    expect(mediumVisible.has("make_opening_storybook")).toBe(true);

    const highWithImg = runExposure("claude-sonnet-5-5", true);
    const highVisible = new Set([...highWithImg.tools.map((t) => t.name), ...highWithImg.offered]);
    expect(highVisible.has("compose_opening")).toBe(true);
    expect(highVisible.has("animate_opening_camera")).toBe(true);
    expect(highVisible.has("upsert_opening_layer")).toBe(true);
    expect(highVisible.has("author_opening_stage")).toBe(true);
    expect(highVisible.has("generate_art")).toBe(true);
  });

  it("compose_opening builds full-bleed 480x270 animatics without pixelGrid and preserves stage", () => {
    const p = createBlankProject() as Project;
    p.system.opening = {
      enabled: true,
      skippable: true,
      scenes: [],
      stage: { mapId: p.startMapId, eventId: "ev_stage" },
    };
    p.assets.uploaded["cg-1"] = {
      id: "cg-1",
      kind: "backdrop",
      name: "cg.png",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      width: 480,
      height: 270,
    };
    const compose = OPENING_DIRECTOR_TOOLS.find((t) => t.name === "compose_opening")!;
    const out = compose.run(p, {
      bpm: 80,
      shots: [
        { template: "night-sky", motion: "tilt-down", fx: ["stars", "meteors"], captions: ["별빛이 항구 위로 내려앉던 밤."], sfx: "bell" },
        { template: "key-cg", resourceId: "cg-1", motion: "zoom-in", fx: ["shaft", "dust"], captions: ["등대 너머 바다로 유성이 떨어졌다."], sfx: "gong" },
        { template: "map-tour", motion: "pan-right", fx: ["night-tint", "sparks"], captions: ["항구 광장의 불빛이 깨어난다."] },
        { template: "title-card", mood: "noir", title: "붉은 안개의 요새", subtitle: "사라진 성주의 밀서", fx: ["rain", "flash-hit"], sfx: "impact" },
      ],
    });
    expect(out.summary).toContain("4샷");
    expect(p.system.opening?.scenes.length).toBe(4);
    expect(p.system.opening?.stage).toEqual({ mapId: p.startMapId, eventId: "ev_stage" });
    const titleLayers = p.system.opening?.scenes[3]?.composition?.layers ?? [];
    expect(titleLayers.some((l) => l.resourceId === "oprn-pano-night")).toBe(false);
    for (const scene of p.system.opening?.scenes ?? []) {
      expect(scene.kind).toBe("animatic");
      expect(scene.composition?.width).toBe(480);
      expect(scene.composition?.height).toBe(270);
      expect(scene.composition?.upscale).toBe("smooth");
      expect(scene.composition?.pixelGrid).toBeUndefined();
    }
  });

  it("argCoerce preserves author_opening_stage beats[].kind = say", () => {
    const stageTool = OPENING_STAGE_TOOLS.find((t) => t.name === "author_opening_stage")!;
    const { args: coerced } = coerceToolArgs(stageTool.parameters, {
      beats: [{ kind: "say", speaker: "어부", text: "방금 등대 쪽 하늘 봤어?" }],
    });
    expect(((coerced as Record<string, unknown>).beats as Array<{ kind: string; text?: string }>)[0]?.kind).toBe("say");
    expect(((coerced as Record<string, unknown>).beats as Array<{ kind: string; text?: string }>)[0]?.text).toBe("방금 등대 쪽 하늘 봤어?");
  });

  it("adapts v2 system prompt guidance by model tier and image generation availability", () => {
    const p = createBlankProject() as Project;
    const highNoImg = buildV2SystemPrompt(p, p.startMapId, "새 게임 오프닝 만들어 줘", undefined, "k", {
      model: "gemini-4-neon",
      canGenerateImages: false,
    }).join("\n");
    expect(highNoImg).toContain("Opening (high tier)");
    expect(highNoImg).toContain("No image generation in this run");

    const mediumWithImg = buildV2SystemPrompt(p, p.startMapId, "새 게임 오프닝 만들어 줘", undefined, "k", {
      model: "claude-haiku-5-5",
      canGenerateImages: true,
    }).join("\n");
    expect(mediumWithImg).toContain("Opening (medium tier");
    expect(mediumWithImg).toContain("generate_art{target:'opening'");
    expect(mediumWithImg).toContain("referenceResourceId");
  });

  it("sets allowAnimaticDirecting and allowGeneratedOpeningCg cleanly", () => {
    expect(resolveOpeningPolicy({ model: "fable-5-2", canGenerateImages: false })).toEqual({
      tier: "high",
      canGenerateImages: false,
      allowAnimaticDirecting: true,
      allowGeneratedOpeningCg: false,
    });
    expect(resolveOpeningPolicy({ model: "gpt-6.1-terra", canGenerateImages: true })).toEqual({
      tier: "medium",
      canGenerateImages: true,
      allowAnimaticDirecting: false,
      allowGeneratedOpeningCg: true,
    });
  });
});
