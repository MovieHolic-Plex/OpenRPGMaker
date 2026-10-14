// sengoku_edo 조수 연결(sengokuEdoPolicy) + 구성기 + 번들 배선 — 이 파일은 작성 시 실행하지 않았다(not run; 워크트리 에이전트는 vitest 금지).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  SENGOKU_CONCEPT_HINT, SENGOKU_EXPOSED_TOOLS, SENGOKU_TILESET_ID, describesSengoku, formatSengokuNote, hasSengokuTileset, namesSengokuTileset,
  sengokuPromptLines, sengokuStyleFor, sengokuTargetFor,
} from "@/ai/sengokuEdoPolicy";
import { BUILDABLE_CONCEPT_TILESETS } from "@/concepts/format";
import { composeSengokuEdo, sengokuPaletteFromTileset, SENGOKU_DEFAULT_SIZE, SENGOKU_STYLES } from "@/project/sengokuEdoComposer";
import { createSengokuEdoTileset } from "@/project/defaults/sengokuEdo";
import { TOOL_REGISTRY } from "@/editor/tools/toolRegistry";
import { declaredIntent } from "./intentFixture";

const create = declaredIntent({ mode: "create", space: "outdoor" });

describe("낱말", () => {
  it.each(["전국시대 성하마을 만들어줘", "에도 시대 여관 거리", "사무라이 저택과 다실", "일본 전통 마을", "일본 신사 경내", "다이묘의 성", "feudal japan castle town"])("%s", (text) => {
    expect(describesSengoku(text)).toBe(true);
  });
  it.each(["여기에도 마을 만들어줘", "무사히 도착한 마을", "신사 숙녀 여러분", "일본 도시 번화가 거리", "조선 시대 한옥 마을", "편의점 있는 일본 주택가", "도쿄 지하철역", "무림 객잔"])("%s 는 아니다", (text) => {
    expect(describesSengoku(text)).toBe(false);
  });
  it("칩셋 이름", () => {
    expect(namesSengokuTileset("sengoku_edo 로 맵 만들어줘")).toBe(true);
    expect(namesSengokuTileset("성하마을 만들어줘")).toBe(false);
  });
  it("용도 고르기", () => {
    expect(sengokuStyleFor("전국시대 성하마을")).toBe("castle_town");
    expect(sengokuStyleFor("에도 시대 여관 거리")).toBe("inn_street");
    expect(sengokuStyleFor("사무라이 저택과 다실")).toBe("samurai");
    expect(sengokuStyleFor("일본 신사와 절")).toBe("temple");
    expect(sengokuStyleFor("에도 시대 농촌 논")).toBe("village");
    expect(sengokuStyleFor("천수각이 있는 성")).toBe("castle");
  });
});

describe("대상", () => {
  it("새 프로젝트는 칩셋을 가진다", () => {
    expect(hasSengokuTileset(createBlankProject())).toBe(true);
  });
  it("시대 낱말 + 생성 → 야외 대상(용도 포함)", () => {
    const p = createBlankProject();
    const t = sengokuTargetFor(p, create, "에도 시대 여관 거리", p.startMapId, false);
    expect(t?.style).toBe("inn_street");
    expect(formatSengokuNote(t!, null)).toContain("compose_sengoku_edo_map");
  });
  it("현대 일본 거리는 잡지 않는다", () => {
    const p = createBlankProject();
    expect(sengokuTargetFor(p, create, "일본 도시 번화가 거리 만들어 줘", p.startMapId, false)).toBeNull();
  });
  it("프롬프트 줄·노출 도구", () => {
    const p = createBlankProject();
    expect(sengokuPromptLines(p, [p.startMapId]).join("\n")).toContain("sengoku_edo");
    const names = new Set(TOOL_REGISTRY.map((t) => t.name));
    for (const n of SENGOKU_EXPOSED_TOOLS) expect(names.has(n), n).toBe(true);
    expect(Object.values(SENGOKU_CONCEPT_HINT)).toContain(SENGOKU_TILESET_ID);
    expect(BUILDABLE_CONCEPT_TILESETS).toContain(SENGOKU_TILESET_ID);
  });
});

describe("구성기", () => {
  const pal = sengokuPaletteFromTileset(createSengokuEdoTileset());
  it.each(SENGOKU_STYLES)("%s 기본 크기에서 건물·시작 칸을 낸다", (style) => {
    const { w, h } = SENGOKU_DEFAULT_SIZE[style];
    for (const seed of [0, 1, 2]) {
      const r = composeSengokuEdo({ width: w, height: h, style, seed }, pal);
      expect(r.buildings.length).toBeGreaterThan(0);
      expect(r.lower.length).toBe(w * h);
      expect(r.start.x).toBeGreaterThanOrEqual(0);
    }
  });
});
