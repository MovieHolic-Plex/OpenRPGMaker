// 실사용 감사 로그(2026-07-04) 회귀: place_npc가 graphic.query="people1"로 실패했고
// 실패 요약에 원인이 없어 추적이 어려웠다. 시트명 질의 해석 + 실패 요약 원인 포함을 고정한다.
import { describe, expect, it } from "vitest";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { findCharsetSemantic } from "@/assets/charsetSemantics";
import { resolveGraphicQuery } from "@/editor/tools/eventCompile";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { createBlankProject } from "@/project/defaults";

describe("place_npc graphic.query", () => {
  it("resolveGraphicQuery('people1')가 people1 시트 그래픽을 만든다", () => {
    const graphic = resolveGraphicQuery("people1");
    expect(graphic.sprite).toEqual({ type: "bundled", id: "tex_easyrpg_charset_people1" });
  });

  it("감사 로그의 place_npc 호출이 이제 성공한다", () => {
    const project = createBlankProject();
    const ctx: ToolContext = { project };
    const result = runTool(ctx, "place_npc", {
      mapId: project.startMapId,
      x: 2,
      y: 2,
      id: "npc_garden_1",
      name: "정원사 로빈",
      graphic: { query: "people1" },
      movement: "random",
      pages: [{ text: "아름다운 정원이군요." }],
    });
    expect(result.ok, result.summary).toBe(true);
  });

  it("자유 질의 old woman으로 노년 여성 그래픽을 배치한다", () => {
    const project = createBlankProject();
    const ctx: ToolContext = { project };
    const result = runTool(ctx, "place_npc", {
      mapId: project.startMapId,
      x: 2,
      y: 2,
      id: "npc_old_woman",
      name: "노년 여성",
      graphic: { query: "old woman" },
      pages: [{ text: "어서 오렴." }],
    });
    expect(result.ok, result.summary).toBe(true);
    const event = ctx.project.maps[project.startMapId].events.find((candidate) => candidate.id === "npc_old_woman");
    const graphic = event?.pages?.[0]?.graphic;
    const textureKey = graphic?.sprite?.id;
    const characterIndex = decodeCharsetFrameIndex(graphic?.pattern ?? 0).characterIndex;
    expect(findCharsetSemantic(textureKey ?? "", characterIndex)).toMatchObject({ gender: "female", age: "elder" });
  });

  it("그래픽 해석 실패는 주민 그림으로 대체하지 않고 graphic-not-found 로 거절한다", () => {
    // 2026-09-27: 대체+경고를 되돌렸다 — 조수가 경고를 읽지 않아 「가시덫」「제단」이 마을 사람으로 저장됐다.
    const project = createBlankProject();
    const ctx: ToolContext = { project };
    const result = runTool(ctx, "place_npc", {
      mapId: project.startMapId,
      x: 2,
      y: 2,
      id: "npc_fail",
      name: "실패 NPC",
      graphic: { query: "존재하지않는그래픽xyz" },
      pages: [{ text: "..." }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("graphic-not-found");
    expect(result.issues?.[0]?.message).toContain("존재하지않는그래픽xyz");
    expect(ctx.project.maps[project.startMapId]?.events.find((event) => event.id === "npc_fail")).toBeUndefined();
  });

  it("default villager graphics diversify across sequential placements", () => {
    const project = createBlankProject();
    const ctx: ToolContext = { project };
    const keys = new Set<string>();
    for (let i = 0; i < 6; i += 1) {
      const result = runTool(ctx, "place_npc", {
        mapId: project.startMapId,
        x: 1 + (i % 3),
        y: 1 + Math.floor(i / 3),
        id: `npc_div_${i}`,
        name: `주민 ${i}`,
        pages: [{ text: "안녕." }],
      });
      expect(result.ok, result.summary).toBe(true);
      const event = ctx.project.maps[project.startMapId].events.find((e) => e.id === `npc_div_${i}`);
      const g = event?.pages?.[0]?.graphic;
      const textureKey = g?.sprite?.id ?? "";
      const characterIndex = decodeCharsetFrameIndex(g?.pattern ?? 0).characterIndex;
      keys.add(`${textureKey}#${characterIndex}`);
    }
    // 6명 전부 같은 people1#0이면 실패 — 최소 2종 이상
    expect(keys.size).toBeGreaterThanOrEqual(2);
  });

  it("places matching changeFace for diversified charset slots", () => {
    const project = createBlankProject();
    const ctx: ToolContext = { project };
    const faces = new Set<string>();
    for (let i = 0; i < 4; i += 1) {
      const id = `npc_face_${i}`;
      const result = runTool(ctx, "place_npc", {
        mapId: project.startMapId,
        x: 1 + i,
        y: 2,
        id,
        name: `주민F${i}`,
        pages: [{ text: "안녕." }],
      });
      expect(result.ok, result.summary).toBe(true);
      const event = ctx.project.maps[project.startMapId].events.find((e) => e.id === id);
      const cmds = event?.pages?.[0]?.commands ?? [];
      const face = cmds.find((c) => c.kind === "changeFace");
      const g = event?.pages?.[0]?.graphic;
      const characterIndex = decodeCharsetFrameIndex(g?.pattern ?? 0).characterIndex;
      // 정답지는 공용 대응표다. 짝이 없는 그림은 얼굴이 없어야 한다.
      const paired = reviewedFaceIdForCharset(g?.sprite?.id ?? "", characterIndex);
      if (!paired) { expect(face, `${id} 에 짝 없는 얼굴이 붙었다`).toBeUndefined(); continue; }
      expect(face, `missing changeFace for ${id}`).toBeTruthy();
      if (face && face.kind === "changeFace") {
        faces.add(face.resourceId);
        expect(face.resourceId).toBe(paired);
      }
    }
    expect(faces.size).toBeGreaterThanOrEqual(1);
  });
});
