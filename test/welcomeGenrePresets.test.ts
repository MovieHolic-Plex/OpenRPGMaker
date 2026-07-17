/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import {
  WELCOME_GENRE_CHECKLIST_LINES,
  WELCOME_GENRE_PRESETS,
  WELCOME_INSPIRATION_MINIS,
  buildWelcomeFreeTextPrompt,
  buildWelcomeGenrePresetPrompt,
  welcomeGenrePresetById,
} from "@/editor/welcomeGenrePresets";

describe("welcomeGenrePresets", () => {
  it("exposes seven genre chips including story-cutscene", () => {
    expect(WELCOME_GENRE_PRESETS).toHaveLength(7);
    expect(welcomeGenrePresetById("monster-collect")?.label).toBe("몬스터 수집");
    expect(WELCOME_GENRE_PRESETS.every((p) => !/포켓몬|디지몬|스타듀/.test(p.label))).toBe(true);
    expect(welcomeGenrePresetById("horror-gallery")?.label).toContain("갤러리");
    expect(welcomeGenrePresetById("school-horror")?.label).toContain("학교");
    expect(welcomeGenrePresetById("story-cutscene")?.label).toContain("회상");
  });

  it("horror and story chips force template tools in prompts", () => {
    const gallery = buildWelcomeGenrePresetPrompt(welcomeGenrePresetById("horror-gallery")!);
    expect(gallery).toContain("make_gallery_room");
    expect(gallery).toContain("필수 템플릿 툴");
    const school = buildWelcomeGenrePresetPrompt(welcomeGenrePresetById("school-horror")!);
    expect(school).toContain("make_horror_loop");
    const story = buildWelcomeGenrePresetPrompt(welcomeGenrePresetById("story-cutscene")!);
    expect(story).toContain("script_cutscene_preset");
  });

  it("free-text gallery intent injects make_gallery_room", () => {
    const prompt = buildWelcomeFreeTextPrompt("이브 갤러리 조사 호러 맵");
    expect(prompt).toContain("make_gallery_room");
  });

  it("builds preset prompts with shared checklist and no-commit guard", () => {
    const preset = welcomeGenrePresetById("farm-life");
    expect(preset).toBeTruthy();
    const prompt = buildWelcomeGenrePresetPrompt(preset!);
    expect(prompt).toContain(preset!.label);
    expect(prompt).toContain("승인 전 커밋 금지");
    for (const line of WELCOME_GENRE_CHECKLIST_LINES) {
      expect(prompt).toContain(line.slice(0, 12));
    }
  });

  it("builds free-text prompts with user intent", () => {
    const prompt = buildWelcomeFreeTextPrompt("  고양이 카페 RPG  ");
    expect(prompt).toContain("고양이 카페 RPG");
    expect(prompt).toContain("승인 전 커밋 금지");
  });

  it("exposes smaller secondary inspiration strip entries", () => {
    expect(WELCOME_INSPIRATION_MINIS.length).toBeGreaterThanOrEqual(6);
    expect(WELCOME_INSPIRATION_MINIS[0]?.thumb).toContain("/assets/generated/welcome/mini-");
    expect(WELCOME_INSPIRATION_MINIS.every((m) => m.intent.trim().length > 0)).toBe(true);
  });
});
