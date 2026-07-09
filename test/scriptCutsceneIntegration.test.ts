import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { characterSpriteX, characterSpriteY } from "@/player/characterDepth";
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
});
