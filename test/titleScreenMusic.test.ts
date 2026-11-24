import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { bgmTrackUrl } from "@/assets/bgmCdn";
import { findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { STARTER_TITLE_BGM_ID, STARTER_TITLE_SE_IDS } from "@/assets/bgmStarterTracks";
import { findSeRuntimePath } from "@/assets/seCatalogRuntime";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { defaultSystem, defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { createBlankProject } from "@/project/defaults";

describe("titleScreen.musicResourceId", () => {
  it("preserves musicResourceId through system normalize", () => {
    const system = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        musicResourceId: "easyrpg-music-field-1",
      },
    });
    expect(system.titleScreen?.musicResourceId).toBe("easyrpg-music-field-1");
  });

  it("allows missing/empty musicResourceId (silent title)", () => {
    const without = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
      },
    });
    expect(without.titleScreen?.musicResourceId).toBeUndefined();

    const empty = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        musicResourceId: "",
      },
    });
    expect(empty.titleScreen?.musicResourceId).toBeUndefined();
  });

  // 계약 변경(2026-11-24, 오너 결정): 예전에는 «타이틀 무음» 이 새 프로젝트의 의도된 기본이었다.
  // 그러나 새 프로젝트를 타이틀부터 실행하면 아무 소리도 안 나서 «기본 BGM 이 안 틀어진다» 로 보고됐다.
  // 그래서 **새 프로젝트만** 타이틀 BGM 과 커서/결정/취소 SE 를 앱에 설치된 파일로 채운다.
  // 옛 프로젝트(저장된 값, 저작자가 일부러 비운 칸)는 그대로 둬야 하므로 normalize 기준인
  // defaultTitleScreenSettings() 는 계속 비어 있다 — 아래 두 번째·세 번째 케이스가 그 경계다.
  it("fills a new project's title BGM and cursor/confirm/cancel SE with installed files", () => {
    const title = createBlankProject().system.titleScreen;
    expect(title?.musicResourceId).toBe(STARTER_TITLE_BGM_ID);
    expect(title?.sounds).toEqual({
      cursorSeResourceId: STARTER_TITLE_SE_IDS.cursor,
      confirmSeResourceId: STARTER_TITLE_SE_IDS.confirm,
      cancelSeResourceId: STARTER_TITLE_SE_IDS.cancel,
    });
    // 그 id 들이 public/ 에 실제 파일로 있다(CDN·네트워크 없이 데스크톱·웹 모두 재생).
    const bgm = findBgmRuntimeEntry(STARTER_TITLE_BGM_ID);
    expect(bgm, "타이틀 곡이 카탈로그에 없다").toBeDefined();
    const bgmPath = decodeURIComponent(bgmTrackUrl(bgm!.fileName, {})!.replace(/^\//, ""));
    expect(existsSync(resolve("public", bgmPath)), `${bgmPath} 없음`).toBe(true);
    for (const id of Object.values(STARTER_TITLE_SE_IDS)) {
      const path = findSeRuntimePath(id);
      expect(path, `${id} 가 SE 카탈로그에 없다`).toBeDefined();
      expect(existsSync(resolve("public", path!)), `${path} 없음`).toBe(true);
    }
  });

  it("keeps the legacy/normalize baseline silent so saved projects are not changed", () => {
    expect(defaultTitleScreenSettings().musicResourceId).toBeUndefined();
    expect(defaultTitleScreenSettings().sounds).toBeUndefined();
    expect(defaultSystem().titleScreen?.musicResourceId).toBeUndefined();
    expect(defaultSystem().titleScreen?.sounds).toBeUndefined();
  });

  it("does not refill a new project's cleared title BGM/SE on normalize", () => {
    const authored = createBlankProject().system;
    const { musicResourceId: _music, sounds: _sounds, ...rest } = authored.titleScreen!;
    const cleared = normalizeSystemRecords({ ...authored, titleScreen: rest });
    expect(cleared.titleScreen?.musicResourceId).toBeUndefined();
    expect(cleared.titleScreen?.sounds).toBeUndefined();
  });
});
