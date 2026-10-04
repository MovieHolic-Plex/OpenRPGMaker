/**
 * 도트 측면 전투의 배경 종류 고르기(battleSceneryPicker.ts, 2026-10-02).
 * 측면은 그림 id 를 겹 배경 다섯 종류로 풀어 깐다 — 저장값을 그 눈으로 읽는지, 「배경 변경」이 종류를 넘기는지,
 * 미리보기가 실제 전투와 같은 그림인지를 고정한다.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { battleBackdropPreviewUrl, nextBattleScenery, readBattleScenery } from "@/editor/panels/battleSceneryPicker";
import { applyBattleMethod } from "@/project/battleMethod";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

let project: Project;
beforeEach(() => { project = createBlankProject(); });

describe("readBattleScenery", () => {
  it("비었으면 자동 — 기본 전장(숲 레퍼런스)의 종류", () => {
    expect(readBattleScenery(project, undefined)).toEqual({ kind: "auto", biome: "forest" });
  });

  it("종류 id 는 그대로, 옛 그림은 풀어진 종류로, 업로드 같은 낯선 id 는 그림 그대로", () => {
    expect(readBattleScenery(project, "battle-scenery-snow")).toEqual({ kind: "biome", biome: "snow" });
    expect(readBattleScenery(project, "easyrpg-backdrop-dawn1")).toEqual({ kind: "legacy", biome: "plains", id: "easyrpg-backdrop-dawn1" });
    expect(readBattleScenery(project, "battle-skin-chrono-backdrop")).toEqual({ kind: "legacy", biome: "plains", id: "battle-skin-chrono-backdrop" });
    expect(readBattleScenery(project, "uploaded-my-castle")).toEqual({ kind: "custom", id: "uploaded-my-castle" });
  });
});

describe("nextBattleScenery", () => {
  it("자동·옛 그림 → 풀밭, 그다음 차례로 돌고 사막 뒤엔 풀밭", () => {
    expect(nextBattleScenery(undefined)).toBe("battle-scenery-plains");
    expect(nextBattleScenery("easyrpg-backdrop-dawn1")).toBe("battle-scenery-plains");
    expect(nextBattleScenery("battle-scenery-plains")).toBe("battle-scenery-forest");
    expect(nextBattleScenery("battle-scenery-desert")).toBe("battle-scenery-plains");
  });
});

describe("battleBackdropPreviewUrl", () => {
  it("도트 측면은 종류의 미리보기 그림, 몬스터 대치는 고른 그림", () => {
    expect(battleBackdropPreviewUrl(project, "easyrpg-backdrop-dawn1")).toContain("battle-scenery/plains/preview.png");
    expect(battleBackdropPreviewUrl(project, undefined)).toBeUndefined();
    expect(battleBackdropPreviewUrl(project, undefined, { showAuto: true })).toContain("battle-scenery/forest/preview.png");
    applyBattleMethod(project, "monster");
    expect(battleBackdropPreviewUrl(project, "easyrpg-backdrop-dawn1") ?? "").not.toContain("battle-scenery");
  });
});
