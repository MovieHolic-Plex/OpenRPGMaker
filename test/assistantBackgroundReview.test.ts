// 2026-09-17: "rejects fake approval with ordinary targetChange acceptance and … evidence" 삭제 — 검수 모델의 승인을
// 이미지 증거 부족(map-background-rendering-unavailable)으로 뒤집는 검증이었으나, 결정적 검사(lint error 0)에서
// 이미지 확인은 승인 조건이 아니고 검수 모델도 호출되지 않는다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { requiresVisualReview } from "@/ai/independentReview";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { AssistantImageEvidence } from "@/ai/assistantImageEvidence";
import { createBlankProject } from "@/project/defaults";
import { installFakeDom } from "./fakeDom";

afterEach(() => vi.unstubAllGlobals());

describe("background review evidence", () => {
  it("reports the real tile-only surface as unavailable instead of fabricating background evidence", async () => {
    const restore = installFakeDom();
    try {
      // This surface uses onerror properties; fakeDom's Image only dispatches listeners.
      vi.stubGlobal("Image", class {
        onerror: (() => void) | null = null;
        set src(_value: string) { this.onerror?.(); }
      });
      const project = createBlankProject(), map = project.maps[project.startMapId];
      map.background = { imageId: "missing-resource", scrollX: 4 };
      await expect(renderToolImages(project, "show_map_region", {
        mapId: map.id, x: 0, y: 0, w: 1, h: 1, lower: [[-1]], upper: [[-1]],
      })).rejects.toThrow("map-background-rendering-unavailable");
    } finally { vi.unstubAllGlobals(); restore(); }
  });

  it.each(["image", "scroll", "remove"])("classifies %s background changes as visual and permanently retires old evidence", mutation => {
    const project = createBlankProject(), map = project.maps[project.startMapId];
    map.background = { imageId: "easyrpg-backdrop-dawn1", scrollX: 0 };
    const before = structuredClone(project), evidence = new AssistantImageEvidence();
    const receipt = evidence.capture(project, { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height });
    if (!receipt) throw new Error("Missing receipt");
    evidence.deliver([receipt]);
    if (mutation === "image") map.background.imageId = "easyrpg-backdrop-sky1";
    else if (mutation === "scroll") map.background.scrollX = 4;
    else delete map.background;
    expect(requiresVisualReview(before, project, map.id)).toBe(true);
    expect(evidence.current(project)).toEqual([]);
    expect(evidence.current(before)).toEqual([]);
  });

  it("classifies map tile size and legacy event sprites, but exempts dialogue and metadata edits", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.events.push({ id: "npc", x: 1, y: 1, sprite: { kind: "action" }, commands: [] });
    const beforeProject = structuredClone(project);
    map.name = "Renamed map";
    map.events[0].commands = [{ kind: "text", body: "Changed dialogue" }];
    expect(requiresVisualReview(beforeProject, project, map.id)).toBe(false);
    map.tileSize += 1;
    expect(requiresVisualReview(beforeProject, project, map.id)).toBe(true);
    map.tileSize = beforeProject.maps[map.id].tileSize;
    map.events[0].sprite = { type: "builtin", id: "replacement" };
    expect(requiresVisualReview(beforeProject, project, map.id)).toBe(true);
  });
});
