import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEventGraphicPreview } from "@/editor/panels/eventEditor/eventGraphicPreview";
import { editorEventMarkerTexture } from "@/editor/editSceneEventMarkers";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;
beforeEach(() => { restoreDom = installFakeDom(); });
afterEach(() => { restoreDom?.(); });

describe("shared appearance event preview", () => {
  it.each(["easyrpg-charset-actor1", "tex_easyrpg_charset_actor1"])(
    "renders the selected bundled character when referenced by %s",
    (resourceId) => {
      const project = createBlankProject();
      project.database.characterAppearances = [{
        id: "guide", name: "Guide", description: "",
        charset: { resourceId, characterIndex: 5 },
      }];
      store.replace(project);

      const preview = renderEventGraphicPreview({ appearanceId: "guide" });

      expect(preview.dataset.unsupported).toBeUndefined();
      expect(preview.dataset.slot).toBe("5");
      expect(preview.dataset.pattern).toBe("76");
    },
  );

  it("uses the shared charset and cell on the editor map", () => {
    const project = createBlankProject();
    project.database.characterAppearances = [{
      id: "guide", name: "Guide", description: "",
      charset: { resourceId: "easyrpg-charset-actor1", characterIndex: 5 },
    }];

    const marker = editorEventMarkerTexture(project, { appearanceId: "guide" });

    expect(marker).toMatchObject({ texture: "tex_easyrpg_charset_actor1", frame: 76 });
    expect(editorEventMarkerTexture(project, { appearanceId: "guide", transparent: true })).toBeNull();
  });
});
