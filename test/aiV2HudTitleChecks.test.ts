import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { hudIsStoryTemplate, hudTitleChoiceProblems } from "@/ai/v2/judge/hudTitleChecks";
import { STORY_SETUP_HUD, applyStorySetupDefaults } from "@/ai/v2/genreDefaults";
import { gameContentProblems } from "@/ai/v2/judge/gameChecks";
import type { Project } from "@/project/types";
import { findingLine } from "@/ai/v2/judge/finding";

// 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
const hudTitleLines = (...args: Parameters<typeof hudTitleChoiceProblems>): string[] => hudTitleChoiceProblems(...args).map(findingLine);
const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);

const WHOLE = "용사가 마왕을 잡으러 가는 짧은 RPG 만들어줘";
const hud = (p: Project) => hudTitleLines(p).filter((m) => m.startsWith("[게임 검사 HUD 선택]"));
const title = (p: Project) => hudTitleLines(p).filter((m) => m.startsWith("[게임 검사 타이틀 모양]"));

describe("v2 HUD / title choice check (fs-use-tools HUD)", () => {
  it("flags the HUD the story-setup template lays down, and clears when the assistant picks another", () => {
    const p = createBlankProject() as Project;
    p.system.fieldHud = { ...STORY_SETUP_HUD } as never;
    expect(hudIsStoryTemplate(p)).toBe(true);
    expect(hud(p)).toHaveLength(1);
    // objective 는 다른 도구가 켜므로 지문에서 빠진다.
    p.system.fieldHud = { ...STORY_SETUP_HUD, objective: false } as never;
    expect(hud(p)).toHaveLength(1);
    p.system.fieldHud = { ...STORY_SETUP_HUD, theme: "horror" } as never;
    expect(hud(p)).toEqual([]);
    p.system.fieldHud = { ...STORY_SETUP_HUD, clock: false } as never;
    expect(hud(p)).toEqual([]);
    p.system.fieldHud = { ...STORY_SETUP_HUD, vitals: true } as never;
    expect(hud(p)).toEqual([]);
  });

  it("matches what applyStorySetupDefaults really writes (the constant is the fingerprint)", () => {
    const p = createBlankProject() as Project;
    p.system.fieldHud = undefined as never;
    applyStorySetupDefaults(p, "이야기 게임 만들어줘", true);
    expect(p.system.fieldHud).toBeDefined();
    expect(hudIsStoryTemplate(p)).toBe(true);
  });

  it("is silent when the HUD is unset (the editor-default check owns that case)", () => {
    const p = createBlankProject() as Project;
    p.system.fieldHud = undefined as never;
    expect(hud(p)).toEqual([]);
  });

  it("flags a title screen with neither lettering style nor menu style, clears once either is chosen", () => {
    const p = createBlankProject() as Project;
    p.system.titleScreen = { ...(p.system.titleScreen as object), logoStyle: undefined, menuStyle: undefined } as never;
    expect(title(p)).toHaveLength(1);
    p.system.titleScreen = { ...(p.system.titleScreen as object), logoStyle: "stone" } as never;
    expect(title(p)).toEqual([]);
    p.system.titleScreen = { ...(p.system.titleScreen as object), logoStyle: undefined, menuStyle: "plain" } as never;
    expect(title(p)).toEqual([]);
  });

  it("reaches the finish gate for a whole-game request, not for a small edit", () => {
    const after = createBlankProject() as Project;
    after.system.fieldHud = { ...STORY_SETUP_HUD } as never;
    const before = createBlankProject() as Project;
    const hit = (task: string) => gameLines(before, after, task).some((m) => m.startsWith("[게임 검사 HUD 선택]"));
    expect(hit(WHOLE)).toBe(true);
    expect(hit("주인공 이름을 바꿔줘")).toBe(false);
  });
});
