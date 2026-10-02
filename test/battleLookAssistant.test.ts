// 조수가 전투 화면 꾸미기(system.battleLook)를 알고 고르게 하는 지시(2026-10-02).
// 없던 때는 도구 한 줄 설명·첫 제작 지시 어디에도 이 칸이 없어 어떤 게임이든 기본 「도트 창」 그대로였다.
import { describe, expect, it } from "vitest";
import { capabilityEscalatedToolNames } from "@/ai/capabilityEscalation";
import { requestsModernMap } from "@/ai/modernTilesetPolicy";
import { activeTools } from "@/editor/tools";
import {
  buildWelcomeFreeTextPrompt,
  buildWelcomeGenrePresetPrompt,
  welcomeBattleLookLine,
  welcomeGenrePresetById,
} from "@/editor/welcomeGenrePresets";
import { BATTLE_LOOK_PRESET_IDS, BATTLE_LOOK_PRESETS, battleLookMoodGuide } from "@/project/battleLook";
import type { Project } from "@/project/types";
import { interviewBrief } from "./helpers/gameDesignBrief";

describe("전투 화면 꾸미기 — 조수 지시", () => {
  it("set_project_settings 한 줄 설명과 preset 설명이 꾸미기와 분위기 짝을 싣는다", () => {
    const tool = activeTools().find((entry) => entry.name === "set_project_settings")!;
    expect(tool.description).toContain("battle.look");
    const battle = (tool.parameters as { properties: Record<string, { properties: Record<string, { properties: Record<string, { description?: string }> }> }> }).properties.battle!;
    const preset = battle.properties.look!.properties.preset!;
    for (const id of BATTLE_LOOK_PRESET_IDS) expect(preset.description).toContain(`${id}(${BATTLE_LOOK_PRESETS[id].label})=`);
  });

  it("「전투 화면」 요청이면 set_project_settings 가 첫 라운드에 붙는다", () => {
    for (const request of ["전투 화면을 화려하게 꾸며줘", "전투 화면 바꿔줘", "전투창 디자인 바꿔줘"]) {
      expect(capabilityEscalatedToolNames(request, new Set()), request).toContain("set_project_settings");
    }
  });

  it("모험 JRPG 첫 제작 지시(기획 있음·없음)에 프리셋 고르기 줄이 붙고 측면 스킨 id 를 준다", () => {
    const jrpg = welcomeGenrePresetById("adventure-jrpg")!;
    for (const prompt of [buildWelcomeGenrePresetPrompt(jrpg, interviewBrief("adventure-jrpg")), buildWelcomeGenrePresetPrompt(jrpg)]) {
      expect(prompt).toContain("battle.look.preset");
      expect(prompt).toContain(battleLookMoodGuide());
    }
    expect(welcomeBattleLookLine()).toMatch(/battle\.uiStyle: [a-z0-9·]*ff/u);
  });

  it("몬스터 대치(측면 아님) 장르에는 붙이지 않는다", () => {
    const monster = welcomeGenrePresetById("monster-collect")!;
    expect(buildWelcomeGenrePresetPrompt(monster, interviewBrief("monster-collect"))).not.toContain("battle.look");
  });

  it("자유 문장은 턴제 전투를 말할 때만 붙인다", () => {
    expect(buildWelcomeFreeTextPrompt("용사가 마왕을 쓰러뜨리는 짧은 RPG")).toContain("battle.look.preset");
    expect(buildWelcomeFreeTextPrompt("바닷가 마을에서 농사짓고 이웃과 친해지는 생활 게임")).not.toContain("battle.look");
  });

  // 분위기 짝에 「현대」가 들어 있어(veil=현대·SF …) 판타지 JRPG 첫 제작 지시 전체가 PAW 전용 현대 맵 게이트를 켰다 —
  // 고친 뒤 qa:game 24판 중 22판에서 맵 타일 쓰기가 2~7번씩 거절됐다(2026-10-02).
  it("프리셋 고르기 줄이 현대 맵(PAW 전용) 판정을 켜지 않는다", () => {
    const project = { tilesets: {}, maps: {} } as unknown as Project;
    const jrpg = welcomeGenrePresetById("adventure-jrpg")!;
    expect(requestsModernMap(project, `마을 맵을 만들어줘\n${welcomeBattleLookLine()}`, [])).toEqual(false);
    for (const prompt of [
      buildWelcomeGenrePresetPrompt(jrpg, interviewBrief("adventure-jrpg")),
      buildWelcomeGenrePresetPrompt(jrpg),
      buildWelcomeFreeTextPrompt("용사가 마왕을 쓰러뜨리는 짧은 RPG"),
    ]) expect(requestsModernMap(project, prompt, [])).toEqual(false);
  });
});
