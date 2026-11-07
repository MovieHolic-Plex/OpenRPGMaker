// 2026-11-07 물건 2(Object2) 원본 화소 재대조의 회귀 못 — 「ai 조수가 자꾸 이거 왜 보석이라 판단하는거임?」.
// 6번은 회색 바위다. 수정·보석은 칩 시트에 없으므로 번들 수정 그림(cc0-jetrel-crystal)으로 선다.
import { describe, expect, it } from "vitest";
import { charsetGraphicKey, queryNpcGraphics, resolveNpcGraphic } from "@/assets/charsetQuery";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { CHARSET_SEMANTICS } from "@/assets/charsetSemantics";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { getTool } from "@/editor/tools";
import { CRYSTAL_ICON_ID, resolveGraphic } from "@/editor/tools/eventCompile";
import { createBlankProject } from "@/project/defaults";
import { resolvePlaceableOverlayGraphic } from "@/player/placeableOverlayGraphics";

const OBJECT2 = "tex_easyrpg_charset_object2";
const keys = (query: string) => queryNpcGraphics(query, 100).map((match) => charsetGraphicKey(match.entry));

describe("물건 2 칸 의미는 그려진 그림과 같다", () => {
  it("보석·크리스탈·수정·보물 질의는 바위 칸을 고르지 않는다", () => {
    for (const query of ["보석", "크리스탈", "수정", "보물", "gem", "crystal"]) {
      expect(keys(query), query).not.toContain(`${OBJECT2}#6`);
      expect(keys(query), query).not.toContain(`${OBJECT2}#5`);
    }
    for (const query of ["보석", "크리스탈"]) {
      expect(resolveNpcGraphic(query)?.textureKey, query).not.toBe(OBJECT2);
    }
  });

  it("바위·돌·광산 수레·레버는 맞는 물건 2 칸을 고른다", () => {
    expect(keys("바위")).toEqual(expect.arrayContaining([`${OBJECT2}#5`, `${OBJECT2}#6`]));
    expect(keys("돌")).toEqual(expect.arrayContaining([`${OBJECT2}#5`, `${OBJECT2}#6`]));
    expect(charsetGraphicKey(resolveNpcGraphic("회색 바위")!)).toBe(`${OBJECT2}#6`);
    expect(charsetGraphicKey(resolveNpcGraphic("광산 수레")!)).toBe(`${OBJECT2}#7`);
    expect(keys("레버").slice(0, 2).sort()).toEqual([`${OBJECT2}#0`, `${OBJECT2}#1`]);
    expect(keys("서랍장")).not.toContain(`${OBJECT2}#7`);
  });

  it("place_savepoint 기본 그림은 바위가 아니라 수정 그림이다", () => {
    const project = createBlankProject();
    const result = getTool("place_savepoint")!.run(project, { mapId: project.startMapId, x: 2, y: 2 });
    const event = project.maps[project.startMapId]!.events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
    expect(event.pages![0]!.graphic.sprite).toEqual({ type: "bundled", id: CRYSTAL_ICON_ID });
  });

  it("수정 아이콘 id 를 graphic 으로 주면 칩 시트로 바꾸지 않는다", () => {
    expect(resolveGraphic({ textureKey: CRYSTAL_ICON_ID })).toEqual({ sprite: { type: "bundled", id: CRYSTAL_ICON_ID } });
  });

  it("보관 상자는 광산 수레로 서지 않는다", () => {
    const project = createBlankProject();
    const result = getTool("place_storage_chest")!.run(project, { mapId: project.startMapId, x: 4, y: 4, name: "창고" });
    const event = project.maps[project.startMapId]!.events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
    const graphic = event.pages![0]!.graphic;
    expect(`${graphic.sprite?.id}#${decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex}`).not.toBe(`${OBJECT2}#7`);
  });

  it("채집 표식(gem)은 바위 칩이 아니라 수정 그림이다", () => {
    expect(resolvePlaceableOverlayGraphic("gem")?.texture).toBe(CRYSTAL_ICON_ID);
  });

  it("모든 의미 행은 실제 번들 시트의 0~7 칸을 가리킨다", () => {
    const sheets = new Set(CHARSET_ASSETS.map((asset) => asset.textureKey));
    for (const entry of CHARSET_SEMANTICS) {
      expect(sheets.has(entry.textureKey), entry.textureKey).toBe(true);
      expect(entry.characterIndex).toBeGreaterThanOrEqual(0);
      expect(entry.characterIndex).toBeLessThanOrEqual(7);
    }
  });
});
