// 조수 v2 깎아지른 지형 갈래(place/builders/sheerTerrain.ts): 바깥 장소 명세의 hints.kind 가 깎아지른 지형 종류면 마을 빌더 앞에서 이 빌더가 받는다.
// 모르는 kind 는 마을 종류와 같은 잣대로 깎아지른 지형 종류에 더 가까울 때 가장 가까운 종류로 짓고 알린다. 맵 배경은 견본이고, 그림 생성 도구는 v2 경로에 없다고 한 줄로 알린다.
// 종류(id 와 hint)는 모델이 바깥 장소를 고르는 마을 카드 · 땅 그림 답과 숲길 줄에 실린다 — 표(json)에서 만들고, 게임 지시문 상한은 그 카드의 말을 줄여 지킨다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { builderFor } from "@/ai/v2/place/builders";
import { mapBackgroundGenerationReachable, sheerBackdropLine, sheerKindFor, sheerKindsNearestFirst } from "@/ai/v2/place/builders/sheerTerrain";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import { V2_CARDS } from "@/ai/v2/prompt/placeSpecs";
import { gameCard } from "@/ai/v2/prompt/gameCard";
import { VILLAGE_CARD, villageKindsLine } from "@/ai/v2/place/builders/village";
import { SHEER_KINDS_CARD_LINE } from "@/ai/v2/place/sheerKindLines";
import { PLACE_SPEC_SCHEMA } from "@/ai/v2/tools/placeSchema";
import { SHEER_KINDS } from "@/editor/tools/sheerTerrainPlan";
import { createBlankProject } from "@/project/defaults";
import { placeholderSheerArt, setSheerArt } from "@/project/relief/sheerArt";
import type { Project } from "@/project/types";

beforeAll(() => setSheerArt(placeholderSheerArt()));
afterAll(() => setSheerArt(null));

const spec = (kind: string, extra: Partial<PlaceSpec> = {}): PlaceSpec => ({ type: "village", name: `절벽 ${kind}`, hints: { kind }, salt: 11, ...extra } as PlaceSpec);

describe("assistant sheer terrain kind", () => {
  it("a sheer kind id goes to the sheer builder; village kinds and plain villages stay with the village builder", () => {
    for (const k of SHEER_KINDS) expect(builderFor(spec(k.id))?.id, k.id).toBe("sheer-terrain");
    expect(builderFor(spec("fishing-cove"))?.id).toBe("village");
    expect(builderFor({ type: "village", name: "강가 마을" } as PlaceSpec)?.id).toBe("village");
    // a word that matches no kind at all, or a village one better, is the village builder's (it rejects once with the village list)
    expect(builderFor(spec("대장간"))?.id).toBe("village");
    expect(builderFor(spec("zzz"))?.id).toBe("village");
  });

  it("a cliff route reports walkable endpoints on the sides that link its neighbors", () => {
    const p = createBlankProject() as Project;
    const ctx = { project: p, currentMapId: p.startMapId };
    const route = spec("spirit-forest", { type: "route", routeLinks: [
      { side: "west", kind: "village" }, { side: "east", kind: "route" }, { kind: "dungeon" },
    ] });
    const builder = builderFor(route)!;
    expect(builder.id).toBe("route");
    const result = builder.build(createBuildRun(ctx), route);
    expect(result.ok, result.summary).toBe(true);
    expect(result.state).toMatchObject({ sheer: "spirit-forest", routeExits: [
      { side: "west" }, { side: "east" },
    ] });
    expect(result.state).toMatchObject({ dungeonGate: expect.objectContaining({ x: expect.any(Number) }), sideAt: { chest: false } });
    expect(result.summary).toContain("reach ok");
  });

  it("an unknown kind closer to a sheer kind is built as the nearest one and reported (same ranking as village kinds)", () => {
    expect(sheerKindFor(spec("skyplateau"))).toMatchObject({ kind: { id: "sky-plateau" }, asked: "skyplateau" });
    expect(sheerKindFor(spec("waterfall"))).toMatchObject({ kind: { id: "waterfall-terraces" }, asked: "waterfall" });
    expect(sheerKindsNearestFirst("정상")[0]!.id).toBe("summit");
    expect(sheerKindFor(spec("summit"))).toEqual({ kind: expect.objectContaining({ id: "summit" }) });
    const p = createBlankProject() as Project, ctx = { project: p, currentMapId: p.startMapId, lookKey: "sheer-kind" };
    const r = builderFor(spec("skyplateau"))!.build(createBuildRun(ctx), spec("skyplateau"));
    expect(r.ok, r.summary).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/hints\.kind "skyplateau" is not a sheer terrain kind; built as sky-plateau \(nearest\)/u);
    for (const k of SHEER_KINDS) expect(r.warnings.join(" ")).toContain(`${k.id} (`);
  });

  it.each(SHEER_KINDS.map((k) => k.id))("%s: builds a sheer map (3–5 levels; the glade one) on the blank start map, every goal reachable", (kindId) => {
    const kind = SHEER_KINDS.find((k) => k.id === kindId)!;
    const p = createBlankProject() as Project, ctx = { project: p, currentMapId: p.startMapId, lookKey: "sheer-kind" };
    const s = spec(kindId, { salt: 1 });
    const r = builderFor(s)!.build(createBuildRun(ctx), s);
    expect(r.ok, r.summary).toBe(true);
    const map = ctx.project.maps[r.mapIds[0]!]!;
    expect(map.id).toBe(p.startMapId);
    expect([map.width, map.height]).toEqual([...kind.size.medium]);
    expect(map.relief?.style).toBe("sheer");
    const levels = new Set(map.relief!.levels.filter((v) => v > 0)).size;
    // the spirit-forest glade is one level (target scene 4 is flat ground ringed by forest); the cliff kinds are 3–5
    expect(levels).toBeGreaterThanOrEqual(kind.layout === "glade" ? 1 : 3);
    expect(levels).toBeLessThanOrEqual(kind.layout === "glade" ? 1 : 5);
    expect(r.summary).toMatch(/reach ok/u);
    expect(r.entrance).toMatchObject({ mapId: map.id });
    expect(ctx.project.startPos).toMatchObject({ x: r.entrance!.x, y: r.entrance!.y });
    if (kind.void) {
      expect(map.background?.showInEmptyCells).toBe(true);
      expect(r.summary).toContain(`Backdrop: preset ${kind.backdrop!.preset} (generate_map_background unavailable here).`);
    } else {
      expect(map.background).toBeUndefined();
      expect(r.summary).not.toContain("Backdrop");
    }
  });

  it("the backdrop line: a tip with view and prompt where the generator is reachable, the preset otherwise (v2 has no generator)", () => {
    expect(mapBackgroundGenerationReachable()).toBe(false);
    const bg = { preset: "oprn-clouds", view: "surface" as const, prompt: "a sea of soft white clouds" };
    expect(sheerBackdropLine(bg, true)).toBe('Tip: generate_map_background view=surface prompt="a sea of soft white clouds" for a custom backdrop (preset oprn-clouds is set now).');
    expect(sheerBackdropLine(bg, false)).toBe("Backdrop: preset oprn-clouds (generate_map_background unavailable here).");
    expect(sheerBackdropLine(undefined)).toBeUndefined();
  });

  it("the model reads the kinds where it picks an outdoor place: the village card, the land answer and the forest-route line, all made from sheerTerrainKinds.json", () => {
    // 2026-11-17 감독: 실제 조수 네 번(구름 위 고원 · 절벽 숲 · 산 정상 · 정령의 숲 빈터)이 한 번도 깎아지른 지형 종류를 고르지 않았다 —
    // 종류는 make_place 스키마의 hints.kind 설명에만 있었고, 지시문의 마을 카드와 «숲» 이 싣는 숲길 줄에는 없었다.
    const cards = V2_CARDS.join("\n");
    for (const k of SHEER_KINDS) expect(cards).toContain(`${k.id} (${k.hint})`);
    expect(VILLAGE_CARD).toContain(SHEER_KINDS_CARD_LINE);
    for (const theme of ["river", "coast"]) for (const k of SHEER_KINDS) expect(villageKindsLine(theme)!).toContain(`${k.id} (${k.hint})`);
    const forest = gameCard(["forest"]);
    expect(forest).toContain("author_forest_route{");
    expect(forest).toContain("make_place kinds");
    for (const k of SHEER_KINDS) expect(forest).toContain(k.id);
    const kindDesc = (PLACE_SPEC_SCHEMA.properties.hints as { properties: { kind: { description: string } } }).properties.kind.description;
    for (const k of SHEER_KINDS) expect(kindDesc).toContain(k.id);
    // 손으로 쓴 낱말 목록이 아니다: 줄은 표의 id 와 hint 를 그대로 잇는다
    expect(SHEER_KINDS_CARD_LINE).toContain(SHEER_KINDS.map((k) => `${k.id} (${k.hint})`).join(" · "));
  });
});
