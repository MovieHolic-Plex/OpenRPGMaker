import { describe, expect, it } from "vitest";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { defaultSystem, defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { createBlankProject } from "@/project/defaults";
import { STARTER_TITLE_BGM_ID } from "@/assets/bgmStarterTracks";

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

  it("빈 문자열은 무음 타이틀로 보존된다", () => {
    // 무음을 고를 수 있어야 한다. 기본곡이 생긴 뒤로 이 탈출구는 빈 문자열 하나뿐이다 —
    // 정규화가 ""를 기본곡으로 덮으면 무음 타이틀을 만들 방법이 아예 없어진다.
    const empty = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        musicResourceId: "",
      },
    });
    expect(empty.titleScreen?.musicResourceId).toBeUndefined();
  });

  it("키가 없으면 기본 곡을 채운다(구 JSON 이 무음으로 남지 않게)", () => {
    // 동결된 구 프로젝트 JSON 에는 이 키가 아예 없다. 생략을 무음으로 읽으면 그 게임들의
    // 타이틀은 영원히 조용하다 — 그래서 생략은 "신경 쓰지 않음" 으로 보고 기본곡을 채운다.
    const { musicResourceId: _absent, ...titleWithoutMusic } = defaultTitleScreenSettings();
    const without = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: titleWithoutMusic,
    });
    expect(without.titleScreen?.musicResourceId).toBe(STARTER_TITLE_BGM_ID);
  });

  it("기본 타이틀 화면은 CC0 카탈로그 스타터 곡으로 소리가 난다", () => {
    // 2026-08-21 계약 변경: 281곡 CC0 카탈로그를 에디터 기본 BGM 세트로 들이면서 타이틀에도
    // 기본 곡을 넣었다(이전 계약은 "기본값 무음"). 곡 파일은 레포에 함께 커밋된 스타터라
    // VITE_BGM_CDN_BASE 없이도 들린다 — 그래서 기본값으로 둘 수 있다.
    const project = createBlankProject();
    expect(project.system.titleScreen?.musicResourceId).toBe(STARTER_TITLE_BGM_ID);
    expect(defaultTitleScreenSettings().musicResourceId).toBe(STARTER_TITLE_BGM_ID);
  });
});
