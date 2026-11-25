import { describe, expect, it } from "vitest";
import { DEFAULT_MENU_SKIN_ID, MENU_SKINS, listMenuSkinIds, menuSkinFor, resolveMenuSkinId } from "@/player/menuSkins/registry";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";

describe("menu skin registry", () => {
  it("레지스트리 순서로 등록하고 id·라벨·설명이 채워져 있다", () => {
    expect(listMenuSkinIds()).toEqual(["pixel", "field-list", "workbench", "party-first", "party-first-warm", "hub", "sheet", "classic", "journal", "ribbon", "retro-2000", "retro-2003", "classic-xp", "classic-vx"]);
    for (const id of listMenuSkinIds()) {
      const skin = MENU_SKINS[id];
      expect(skin.id).toBe(id);
      expect(skin.label.length).toBeGreaterThan(0);
      expect(skin.description.length).toBeGreaterThan(0);
    }
  });

  it("기본은 pixel(상점 기본 프리셋과 같은 도트 창)이고 미설정·미지값이 그리로 풀린다", () => {
    expect(DEFAULT_MENU_SKIN_ID).toBe("pixel");
    expect(resolveMenuSkinId(undefined)).toBe("pixel");
    expect(resolveMenuSkinId("no-such-skin")).toBe("pixel");
    expect(resolveMenuSkinId("hub")).toBe("hub");
    expect(resolveMenuSkinId("workbench")).toBe("workbench");
    expect(menuSkinFor(createBlankProject())).toMatchObject({ id: "pixel", landing: "party", partyArt: "character", partyStats: true });
  });

  it("각 스킨의 플래그 — workbench 는 지금 화면 그대로", () => {
    expect(MENU_SKINS.workbench).toMatchObject({
      landing: "work", railIcons: "glyph", railStyle: "collapsed", railColumns: 1, sideParty: false, tone: "glass",
    });
    expect(MENU_SKINS["party-first"]).toMatchObject({ landing: "party", railIcons: "painted", railStyle: "flat", railColumns: 1, sideParty: true, tone: "glass" });
    expect(MENU_SKINS["party-first-warm"]).toMatchObject({ landing: "party", railStyle: "flat", tone: "warm" });
    expect(MENU_SKINS.hub).toMatchObject({ landing: "hub", railStyle: "collapsed", railColumns: 3, sideParty: true });
    expect(MENU_SKINS.sheet).toMatchObject({ landing: "sheet", railStyle: "flat", railColumns: 2, sideParty: true });
  });

  it("저장 정규화는 기본·미등록을 버리고 명시 선택만 남긴다", () => {
    const base = createBlankProject().system;
    expect(normalizeSystemRecords({ ...base, menuUiStyle: "pixel" }).menuUiStyle).toBeUndefined();
    // 옛 기본 workbench 를 명시로 고른 프로젝트는 그대로 workbench 로 남는다.
    expect(normalizeSystemRecords({ ...base, menuUiStyle: "workbench" }).menuUiStyle).toBe("workbench");
    for (const menuUiStyle of listMenuSkinIds().filter(id => id !== "pixel")) {
      expect(normalizeSystemRecords({ ...base, menuUiStyle }).menuUiStyle).toBe(menuUiStyle);
    }
    expect(normalizeSystemRecords({ ...base, menuUiStyle: "bogus" as never }).menuUiStyle).toBeUndefined();
    expect(normalizeSystemRecords(base).menuUiStyle).toBeUndefined();
  });
});
