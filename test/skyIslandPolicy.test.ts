// sky_island 조수 연결(skyIslandPolicy) + 순수 구성기(skyIslandComposer) — 이 파일은 작성 시 실행하지 않았다(not run).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  SKY_ISLAND_CONCEPT_HINT, SKY_ISLAND_TILESET_ID, describesSkyIsland, formatSkyIslandNote, hasSkyIslandTileset, namesSkyIslandTileset,
  skyIslandPromptLines, skyIslandStyleFor, skyIslandTargetFor,
} from "@/ai/skyIslandPolicy";
import { BUILDABLE_CONCEPT_TILESETS } from "@/concepts/format";
import { SKY_MIN_SIZE, composeSkyIsland, skyPaletteFromTileset, type SkyComposeStyle } from "@/project/skyIslandComposer";
import data from "@/assets/skyIslandTileset.json";
import references from "@/assets/skyIslandReferences.json";
import { declaredIntent } from "./intentFixture";

const START = "map_blank_start";
const create = declaredIntent({ mode: "create", space: "outdoor" });

describe("낱말", () => {
  it.each(["하늘섬 마을 만들어줘", "구름 위 신전", "비공정 부두", "떠 있는 섬", "공중 정원", "floating island village", "airship dock"])("%s", (text) => {
    expect(describesSkyIsland(text)).toBe(true);
  });
  it.each(["먹구름 날씨 효과", "숲속 마을 만들어줘", "구름다리", "비구름이 끼는 날씨", "항구 도시"])("%s 는 아니다", (text) => {
    expect(describesSkyIsland(text)).toBe(false);
  });
  it("칩셋 이름", () => {
    expect(namesSkyIslandTileset("sky_island 로 맵")).toBe(true);
    expect(namesSkyIslandTileset("하늘섬 칩셋")).toBe(true);
    expect(namesSkyIslandTileset("하늘섬 마을")).toBe(false);
  });
});

describe("구성 종류", () => {
  it.each([
    ["하늘섬 마을 만들어줘", "village"], ["구름 위 신전", "shrine"], ["비공정 부두", "dock"], ["섬 네 개를 다리로 이어줘", "archipelago"],
    ["비공정 선실 만들어줘", "room-cabin"], ["천문대 내부", "room-observatory"], ["하늘섬 신전 실내", "room-shrine"], ["오두막 방 만들어줘", "room-cottage"],
  ] as const)("%s → %s", (text, style) => {
    expect(skyIslandStyleFor(text, false)).toBe(style);
  });
});

describe("skyIslandTargetFor — 칩셋이 프로젝트에 있을 때만", () => {
  it("새 프로젝트는 번들 칩셋을 갖고 태어난다", () => {
    expect(hasSkyIslandTileset(createBlankProject())).toBe(true);
  });
  it("칩셋이 없으면 null", () => {
    const blank = createBlankProject();
    delete (blank.tilesets as Record<string, unknown>)[SKY_ISLAND_TILESET_ID];
    expect(skyIslandTargetFor(blank, create, "하늘섬 마을 만들어줘", START, false)).toBeNull();
    expect(skyIslandPromptLines(blank, [START])).toEqual([]);
  });
  it("생성 요청은 새 맵 + 문장의 구성 종류", () => {
    const project = createBlankProject();
    expect(skyIslandTargetFor(project, create, "하늘섬 마을 만들어줘", START, false)).toEqual({ style: "village" });
    expect(skyIslandTargetFor(project, create, "구름 위 신전", START, false)).toEqual({ style: "shrine" });
    expect(skyIslandTargetFor(project, create, "비공정 부두", START, false)).toEqual({ style: "dock" });
    expect(skyIslandTargetFor(project, create, "숲속 마을 만들어줘", START, false)).toBeNull();
    expect(skyIslandTargetFor(project, declaredIntent({ mode: "question", space: "outdoor" }), "하늘섬이 뭐야", START, false)).toBeNull();
  });
  it("노트는 도구 이름과 style 을 싣는다", () => {
    const note = formatSkyIslandNote({ style: "dock" }, null);
    expect(note).toContain("compose_sky_island_map");
    expect(note).toContain('style "dock"');
    expect(note).toContain("ask_tileset_change");
  });
  it("컨셉 카드 무대 낱말 → sky_island, 지을 수 있는 타일셋", () => {
    expect(SKY_ISLAND_CONCEPT_HINT["하늘섬·비공정"]).toBe(SKY_ISLAND_TILESET_ID);
    expect(BUILDABLE_CONCEPT_TILESETS).toContain(SKY_ISLAND_TILESET_ID);
  });
});

describe("구성기 — 씨앗·크기를 바꿔도 시작 칸에서 모든 목표에 닿는다", () => {
  const pal = skyPaletteFromTileset(data as never);
  const styles = Object.keys(SKY_MIN_SIZE) as SkyComposeStyle[];
  it.each(styles)("%s", (style) => {
    const min = SKY_MIN_SIZE[style];
    for (const seed of [1, 2, 3, 7, 11]) {
      for (const grow of [0, 4]) {
        const r = composeSkyIsland({ width: min.w + grow, height: min.h + grow, style, seed }, pal);
        expect(r.lower.length).toBe((min.w + grow) * (min.h + grow));
        expect(r.notes.filter((n) => n.includes("닿지 않는 목표"))).toEqual([]);
        if (!style.startsWith("room-")) expect(r.buildings.length).toBeGreaterThan(0);
        else expect(r.exits.length).toBe(1);
      }
    }
  });
  it("너무 작은 맵은 거절한다(맵을 바꾸지 않게 던진다)", () => {
    expect(() => composeSkyIsland({ width: 20, height: 12, style: "village", seed: 1 }, pal)).toThrow();
  });
});

describe("참고문서 — 번들 소유 si- · 그림은 경로만", () => {
  it("용도 둘, 모든 id 가 si-, 그림 바이트 없음", () => {
    const cats = references as { id: string; documents: { id: string }[]; images: { id: string; dataUrl: string }[] }[];
    expect(cats.map((c) => c.id)).toEqual(["si-outdoor", "si-interior"]);
    for (const c of cats) {
      for (const d of c.documents) expect(d.id.startsWith("si-")).toBe(true);
      for (const i of c.images) { expect(i.id.startsWith("si-")).toBe(true); expect(i.dataUrl.startsWith("/assets/sky-island-references/")).toBe(true); }
    }
  });
  it("새 프로젝트의 sky_island 정의가 참고문서를 들고 태어난다", () => {
    const def = createBlankProject().tilesets[SKY_ISLAND_TILESET_ID]!;
    expect((def.referenceDocuments ?? []).map((c) => c.id)).toEqual(["si-outdoor", "si-interior"]);
  });
});
