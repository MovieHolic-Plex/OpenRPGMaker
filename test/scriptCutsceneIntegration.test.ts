import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { characterSpriteX, characterSpriteY } from "@/player/characterDepth";
import { createBlankProject } from "@/project/defaults";
import {
  createMemoryCutsceneProject,
  MEMORY_CUTSCENE_MAP_ID,
  MEMORY_CUTSCENE_PICTURE_ID,
  MEMORY_CUTSCENE_PICTURE_RESOURCE_ID,
} from "./fixtures/memoryCutsceneFixture";

describe("script_cutscene + run_scene_test", () => {
  it("회상 컷신이 카메라 pan, 픽처 표시, 종료 후 입력 잠금 해제를 통과한다", () => {
    const project = createMemoryCutsceneProject();
    const result = runTool(
      { project },
      "run_scene_test",
      {
        mapId: MEMORY_CUTSCENE_MAP_ID,
        start: { x: 2, y: 2 },
        steps: [
          { kind: "interact" },
          {
            kind: "expect",
            cameraAt: { cx: characterSpriteX(4), cy: characterSpriteY(5), tolerance: 0.001 },
            pictureVisible: { id: MEMORY_CUTSCENE_PICTURE_ID, resourceId: MEMORY_CUTSCENE_PICTURE_RESOURCE_ID },
            cutsceneLocked: false,
          },
          { kind: "move", dir: "right" },
          { kind: "expect", playerAt: { x: 3, y: 2 } },
        ],
      }
    );

    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({
      ok: true,
      finalState: {
        mapId: MEMORY_CUTSCENE_MAP_ID,
        x: 3,
        y: 2,
        cutsceneLocked: false,
      },
    });
  });

  it("memory_opening 프리셋은 회상 스틸을 올리고 끝나면 입력을 돌려준다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const placed = runTool(ctx, "script_cutscene_preset", {
      mapId,
      preset: "memory_opening",
      eventId: "ev_recollect",
      x: 2,
      y: 3,
    });
    expect(placed.ok, placed.summary).toBe(true);
    const result = runTool(ctx, "run_scene_test", {
      mapId,
      start: { x: 2, y: 2 },
      steps: [
        { kind: "interact" },
        {
          kind: "expect",
          pictureVisible: { id: "pic_memory", resourceId: "easyrpg-picture-cloud" },
        },
        { kind: "interact" },
        { kind: "interact" },
        { kind: "expect", cutsceneLocked: false },
        { kind: "move", dir: "right" },
        { kind: "expect", playerAt: { x: 3, y: 2 } },
      ],
    });
    expect(result.ok, result.summary).toBe(true);
  });

  it("리소스 라벨 Decision1을 실제 효과음 id로 자동 해석한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "script_cutscene", {
      mapId: ctx.project.startMapId,
      eventId: "ev_decision",
      x: 2,
      y: 2,
      beats: [
        { kind: "music", action: "se", resourceId: "Decision1" },
        { kind: "say", speaker: "수호석", text: "선택하라." },
      ],
    });

    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const event = ctx.project.maps[ctx.project.startMapId]?.events.find((entry) => entry.id === "ev_decision");
    expect(event?.pages?.[0]?.commands).toContainEqual({
      kind: "playAudio",
      resourceId: "easyrpg-sound-decision1",
      loop: false,
    });
    expect(result.diff?.warnings.join("\n") ?? "").toContain("Decision1");
  });
});
