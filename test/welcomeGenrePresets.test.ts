/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import {
  WELCOME_FEATURED_POSTER_CARDS,
  WELCOME_GENRE_CHECKLIST_LINES,
  WELCOME_GENRE_PRESETS,
  WELCOME_HIDDEN_POSTER_CARDS,
  WELCOME_INSPIRATION_MINIS,
  WELCOME_MORE_WORLDS,
  WELCOME_POSTER_CARDS,
  WELCOME_STARTER_TEMPLATES,
  buildWelcomeFreeTextPrompt,
  buildWelcomeGenrePresetPrompt,
  officialGenrePackIdForWelcomePreset,
  welcomeGenrePresetById,
} from "@/editor/welcomeGenrePresets";
import { GENRE_PACK_IDS } from "@/project/genrePackId";

describe("welcomeGenrePresets", () => {
  it("exposes eight genre chips including story-cutscene and action-rpg", () => {
    expect(WELCOME_GENRE_PRESETS).toHaveLength(8);
    expect(welcomeGenrePresetById("monster-collect")?.label).toBe("몬스터 수집");
    expect(WELCOME_GENRE_PRESETS.every((p) => !/포켓몬|디지몬|스타듀/.test(p.label))).toBe(true);
    expect(welcomeGenrePresetById("horror-gallery")?.label).toContain("갤러리");
    expect(welcomeGenrePresetById("school-horror")?.label).toContain("학교");
    expect(welcomeGenrePresetById("story-cutscene")?.label).toContain("회상");
  });

  it("maps UI variants onto the exact persisted packs", () => {
    expect(Object.fromEntries(WELCOME_GENRE_PRESETS.map((preset) => [
      preset.id,
      officialGenrePackIdForWelcomePreset(preset.id),
    ]))).toEqual({
      "action-rpg": "action-rpg",
      "monster-collect": "monster-collect",
      "partner-raise": "monster-collect",
      "farm-life": "farm-life",
      "adventure-jrpg": "adventure-jrpg",
      "story-cutscene": "story-cutscene",
      "horror-gallery": "horror-chase",
      "school-horror": "horror-chase",
    });
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

  it("일반 switch·선택지 컷신·엔딩을 장르 프리셋으로 오인하지 않는다", () => {
    const prompt = buildWelcomeFreeTextPrompt("switch ending_flag와 선택지 컷신으로 진엔딩을 만든다");
    expect(prompt).not.toContain("script_cutscene_preset");
    expect(prompt).not.toContain("make_horror_loop");
    expect(prompt).toContain("switch ending_flag");
  });

  it("builds preset prompts with shared checklist and no-commit guard", () => {
    const preset = welcomeGenrePresetById("farm-life");
    expect(preset).toBeTruthy();
    const prompt = buildWelcomeGenrePresetPrompt(preset!);
    expect(prompt).toContain(preset!.label);
    expect(prompt).toContain("지금 열려 있는 프로젝트에 이어서 작업한다");
    for (const line of WELCOME_GENRE_CHECKLIST_LINES) {
      expect(prompt).toContain(line.slice(0, 12));
    }
  });

  it("builds free-text prompts with user intent", () => {
    const prompt = buildWelcomeFreeTextPrompt("  고양이 카페 RPG  ");
    expect(prompt).toContain("고양이 카페 RPG");
    expect(prompt).toContain("지금 열려 있는 프로젝트에 이어서 작업한다");
  });

  it("exposes smaller secondary inspiration strip entries", () => {
    expect(WELCOME_INSPIRATION_MINIS.length).toBeGreaterThanOrEqual(6);
    expect(WELCOME_INSPIRATION_MINIS[0]?.thumb).toContain("/assets/generated/welcome/mini-");
    expect(WELCOME_INSPIRATION_MINIS.every((m) => m.intent.trim().length > 0)).toBe(true);
  });

  it("renders every preset as a poster and anchors each pack once", () => {
    expect(WELCOME_POSTER_CARDS.map((card) => card.preset.id))
      .toEqual(expect.arrayContaining(WELCOME_GENRE_PRESETS.map((preset) => preset.id)));
    expect(WELCOME_POSTER_CARDS).toHaveLength(WELCOME_GENRE_PRESETS.length);
    expect(WELCOME_FEATURED_POSTER_CARDS.map((card) => card.preset.id)).toEqual([
      "monster-collect",
      "story-cutscene",
      "adventure-jrpg",
    ]);
    expect(WELCOME_HIDDEN_POSTER_CARDS.map((card) => card.preset.id)).toEqual([
      "horror-gallery",
      "school-horror",
      "farm-life",
      "partner-raise",
      "action-rpg",
    ]);

    const anchors = WELCOME_POSTER_CARDS.map((card) => card.packAnchor).filter((packId) => packId !== null);
    expect([...anchors].sort()).toEqual([...GENRE_PACK_IDS].sort());

    expect(WELCOME_FEATURED_POSTER_CARDS[0]).toMatchObject({ title: "몬스터 수집", featured: true });
    expect(WELCOME_HIDDEN_POSTER_CARDS[0]).toMatchObject({
      reference: "이브 같은",
      title: "갤러리 호러",
      featured: false,
    });
    expect(WELCOME_HIDDEN_POSTER_CARDS[1]).toMatchObject({
      reference: "아오오니 같은",
      title: "학교 호러",
      featured: false,
    });
    for (const card of WELCOME_POSTER_CARDS) {
      expect(card.title.trim().length).toBeGreaterThan(0);
      expect(card.title).not.toContain("같은");
    }
  });

  it("second-tier worlds all carry free-text intent and art", () => {
    expect(WELCOME_MORE_WORLDS.length).toBe(WELCOME_INSPIRATION_MINIS.length + WELCOME_STARTER_TEMPLATES.length);
    expect(new Set(WELCOME_MORE_WORLDS.map((world) => world.id)).size).toBe(WELCOME_MORE_WORLDS.length);
    for (const world of WELCOME_MORE_WORLDS) {
      expect(world.intent.trim().length).toBeGreaterThan(0);
      expect(world.thumb).toContain("/assets/generated/welcome/");
    }
  });
});
