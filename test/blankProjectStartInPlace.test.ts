// 시작 화면 「빈 프로젝트」 인계는 편집기 로드가 이미 지은 빈 시작 프로젝트 위에 제목·시작 설정만 얹는다(startScreenHandoff).
// 그 결과가 예전 길(씨앗을 새로 지어 통째로 갈아 끼우기)과 같은 문서인지 본다 — 타일셋 몸통을 뺀 문서 전체와 타일셋 목록.
import { describe, expect, it } from "vitest";
import { applyBlankProjectStart, createProjectStartSeed } from "@/editor/projectStartSeed";
import { createStarterBlankProject } from "@/project/defaults";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const withoutTilesetBodies = (project: unknown): string =>
  JSON.stringify(project, (key, value: unknown) => (key === "tilesets" && value && typeof value === "object" ? Object.keys(value) : value)).replace(UUID, "<uuid>");

describe("빈 프로젝트 시작 인계를 제자리로 얹기", () => {
  for (const size of ["wide", "classic"] as const) {
    it(`씨앗을 새로 지은 것과 같은 문서다 (${size})`, async () => {
      const seed = await createProjectStartSeed(null, "별빛 마을", "blank", size);
      const inPlace = createStarterBlankProject();
      applyBlankProjectStart(inPlace, "별빛 마을", size);
      expect(withoutTilesetBodies(inPlace)).toBe(withoutTilesetBodies(seed));
      expect(JSON.stringify(inPlace.tilesets)).toBe(JSON.stringify(seed.tilesets));
      expect(inPlace.meta.title).toBe("별빛 마을");
      expect(inPlace.flags.firstRunGuide).toBe(true);
    });
  }
});
