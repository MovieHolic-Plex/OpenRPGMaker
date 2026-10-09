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

describe("actor vital and faceset command previews", () => {
  it("changeActorHp renders an HP gauge stage", () => {
    const restore = installFakeDom();
    try {
      const project = createBlankProject();
      store.replace(project);
      const actorId = project.session.partyActorIds[0] ?? project.database.actors[0]?.id ?? "";
      const preview = renderCommandPreview({
        kind: "changeActorHp",
        actorId,
        op: "-=",
        amount: 10,
      }) as unknown as HTMLElement;
      expect(findByTestId(preview as unknown as FakeElement, "ecp-hp-gauge-stage")).toBeTruthy();
      expect(findByTestId(preview as unknown as FakeElement, "ecp-gauge-hp")).toBeTruthy();
      expect(preview.textContent).toContain("HP");
    } finally {
      restore();
    }
  });

  it("recoverAll is registered as a visual preview handler with gauges", () => {
    const restore = installFakeDom();
    try {
      store.replace(createBlankProject());
      const preview = renderCommandPreview({ kind: "recoverAll" }) as unknown as HTMLElement;
      expect(findByTestId(preview as unknown as FakeElement, "ecp-recover-all-stage")).toBeTruthy();
      expect(findByTestId(preview as unknown as FakeElement, "ecp-gauge-hp")).toBeTruthy();
      expect(preview.textContent).toContain("회복");
    } finally {
      restore();
    }
  });

  it("m2 change-actor-faceset preview renders a faceset crop", () => {
    const restore = installFakeDom();
    try {
      const project = createBlankProject();
      store.replace(project);
      const actor = project.database.actors[0];
      const preview = renderCommandPreview({
        kind: "m2Command",
        commandId: "m2-025-change-actor-faceset",
        fields: { target: actor?.id ?? "", value: actor?.faceResourceId ?? "" },
      }) as unknown as HTMLElement;
      const crop =
        findByTestId(preview as unknown as FakeElement, "event-command-face-crop-shell")
        ?? findByTestId(preview as unknown as FakeElement, "event-command-face-preview")
        ?? findByTestId(preview as unknown as FakeElement, "ecp-faceset-change-stage");
      expect(crop).toBeTruthy();
      expect(findByTestId(preview as unknown as FakeElement, "ecp-runtime-effect")).toBeFalsy();
    } finally {
      restore();
    }
  });
});
