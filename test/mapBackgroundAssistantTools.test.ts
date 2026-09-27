// 조수가 맵 배경(파노라마)과 회상 흐름 연출을 한 번에 쓸 수 있는가 — 2026-09-27.
//
// 이전에는 도구 칸이 있어도 조수가 제대로 쓸 수 없었다: fit 칸이 스키마에 없어 1920×1080 세트가 구석만
// 확대됐고, 세트를 층별로 손으로 조립해야 했고, 창 타일 규칙을 몰라 배경이 검게 가려진 채 「성공」 했고,
// 컷신에는 배경 비트가 없어 날것의 명령 id(m2-069)를 알아야 했다.
import { describe, expect, it } from "vitest";
import { compileCutscene } from "@/editor/cutscene";
import { runTool, type ToolContext } from "@/editor/tools";
import { craftpixDefaultLayers } from "@/assets/ogaCraftpixBackgrounds";
import { createBlankProject } from "@/project/defaults";
import { mapBackgroundFromLayerSet } from "@/project/mapBackground";
import type { Command } from "@/project/types";
import { parseTintColor } from "@/player/screen/tintModel";

function context(): { ctx: ToolContext; mapId: string } {
  const ctx: ToolContext = { project: createBlankProject() };
  return { ctx, mapId: ctx.project.startMapId };
}

describe("set_map_properties.background — 조수용 배경", () => {
  it("layerSet 한 칸이 층 순서·cover·층별 깊이·구름 흐름을 채운다", () => {
    const { ctx, mapId } = context();
    const result = runTool(ctx, "set_map_properties", {
      mapId,
      background: { layerSet: "oga-craftpix-hills", cloudDrift: 0.5, showInEmptyCells: true },
      clearForBackground: { x: 0, y: 0, width: 5, height: 3 },
    });
    expect(result.ok, result.summary).toBe(true);
    const background = ctx.project.maps[mapId]!.background!;
    const ids = craftpixDefaultLayers("oga-craftpix-hills").map((layer) => layer.id);
    expect([background.imageId, ...(background.layers ?? []).map((layer) => layer.imageId)]).toEqual(ids);
    expect(background.fit).toBe("cover");
    expect(background.layers?.every((layer) => layer.fit === "cover")).toBe(true);
    expect(background.cameraFollow).toBeUndefined();
    const follows = (background.layers ?? []).map((layer) => layer.cameraFollow ?? 0);
    expect(follows.at(-1)).toBe(0.7);
    expect([...follows].sort((a, b) => a - b)).toEqual(follows);
    // 구름 층만 흐른다.
    for (const layer of background.layers ?? []) {
      expect(layer.scrollX === 0.5).toBe(/clouds/.test(layer.imageId));
    }
    expect(background.showInEmptyCells).toBe(true);
    expect(result.summary).toContain("하늘 자리 15칸 비움");
    expect(result.summary).toContain("층별 깊이 0/10/25/35/45/60/70%");
    expect((result.diff?.warnings ?? []).join(" ")).not.toContain("0칸");
  });

  it("배경이 보일 칸이 없으면 성공 대신 경고로 알려 준다", () => {
    const { ctx, mapId } = context();
    const map = ctx.project.maps[mapId]!;
    map.lowerTiles.fill(240);
    const result = runTool(ctx, "set_map_properties", { mapId, background: { layerSet: "oga-craftpix-ridge" } });
    expect(result.ok, result.summary).toBe(true);
    expect((result.diff?.warnings ?? []).join(" ")).toContain("showInEmptyCells");
  });

  it("fit 을 받는다 — 예전 스키마는 additionalProperties:false 로 거절했다", () => {
    const { ctx, mapId } = context();
    const result = runTool(ctx, "set_map_properties", {
      mapId,
      background: { imageId: "oga-craftpix-pines-layer-sky", fit: "cover" },
    });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps[mapId]!.background?.fit).toBe("cover");
  });

  it("없는 세트는 id 목록과 함께 거절한다", () => {
    const { ctx, mapId } = context();
    const result = runTool(ctx, "set_map_properties", { mapId, background: { layerSet: "no-such-set" } });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("oga-craftpix-hills");
  });

  it("세트 펴기 규칙은 편집기와 도구가 같은 함수를 쓴다", () => {
    const expanded = mapBackgroundFromLayerSet(["a-sky", "a-clouds", "a-rocks"], { cloudDrift: 0.4 });
    expect(expanded).toEqual({
      imageId: "a-sky",
      fit: "cover",
      layers: [
        { imageId: "a-clouds", fit: "cover", cameraFollow: 0.35, scrollX: 0.4 },
        { imageId: "a-rocks", fit: "cover", cameraFollow: 0.7 },
      ],
    });
    expect(mapBackgroundFromLayerSet([])).toBeUndefined();
  });
});

describe("script_cutscene background 비트", () => {
  const parallax = (commands: readonly Command[]) =>
    commands.filter((command): command is Extract<Command, { kind: "m2Command" }> =>
      command.kind === "m2Command" && command.commandId === "m2-069-change-parallax-back");

  it("흐름 배율 명령으로 컴파일되고, 끝(건너뛰기 착지 뒤)에서 같은 상태를 즉시 다시 건다", () => {
    const commands = compileCutscene([
      { kind: "tint", value: "160,120,70,0.28", durationMs: 1000 },
      { kind: "background", flowPercent: 0, durationMs: 2500, wait: true },
      { kind: "say", speaker: "나", text: "그날도 구름이 멈춰 있었다." },
    ]);
    const [transition, settle] = parallax(commands);
    expect(transition?.fields).toEqual({ resourceId: "", flowPercent: 0, flowDurationMs: 2500 });
    expect(settle?.fields).toEqual({ resourceId: "", flowPercent: 0, flowDurationMs: 0 });
    // wait:true 는 전환이 끝날 때까지 기다린다.
    const index = commands.indexOf(transition!);
    expect(commands[index + 1]).toEqual({ kind: "wait", ms: 2500 });
  });

  it("범위 밖 흐름 배율은 컴파일 전에 거절한다", () => {
    expect(() => compileCutscene([{ kind: "background", flowPercent: 900 }])).toThrow(/flowPercent/);
  });

  it("script_cutscene 도구로 이벤트에 들어간다", () => {
    const { ctx, mapId } = context();
    const result = runTool(ctx, "script_cutscene", {
      mapId,
      eventId: "ev_flashback",
      x: 1,
      y: 1,
      trigger: "auto",
      once: true,
      beats: [
        { kind: "background", flowPercent: 0, durationMs: 2000 },
        { kind: "say", speaker: "나", text: "기억이 흐려진다." },
      ],
    });
    expect(result.ok, result.summary).toBe(true);
    const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_flashback")!;
    const commands = event.pages?.flatMap((page) => page.commands) ?? [];
    expect(parallax(commands).length).toBeGreaterThanOrEqual(1);
  });
});

describe("회상 색조 이름", () => {
  it("sepia 는 흰색으로 떨어지지 않는다 — 조수 시험에서 value:\"sepia\" 가 화면을 하얗게 바랬다", () => {
    const tint = parseTintColor("sepia");
    expect([tint.r, tint.g, tint.b]).toEqual([160, 115, 60]);
  });
});
