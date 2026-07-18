import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { installFakeDom, findByTestId, type FakeElement } from "./fakeDom";

describe("battleProcessing command preview", () => {
  it("shows battle field with troop enemies instead of sword-only badge", () => {
    const restore = installFakeDom();
    try {
      const project = createBlankProject();
      // ensure troop has members + backdrop
      const troop = project.database.troops.find((t) => t.id === "troop_slime_pair") ?? project.database.troops[0]!;
      troop.previewBackgroundResourceId = "easyrpg-backdrop-sunset1";
      store.replace(project);

      const preview = renderCommandPreview({
        kind: "battleProcessing",
        troopId: troop.id,
        canEscape: true,
        canLose: false,
      }) as unknown as HTMLElement;

      const body = findByTestId(preview as unknown as FakeElement, "event-command-preview-body");
      expect(body).toBeTruthy();
      const field = findByTestId(preview as unknown as FakeElement, "ecp-battle-field");
      expect(field).toBeTruthy();
      // should list enemy names somewhere
      expect(preview.textContent).toContain(troop.name);
      // sword-only stage alone is insufficient — field host exists
      expect(findByTestId(preview as unknown as FakeElement, "ecp-battle-stage")).toBeTruthy();
    } finally {
      restore();
    }
  });
});
