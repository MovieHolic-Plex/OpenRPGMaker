import { describe, expect, it } from "vitest";
import {
  SYSTEM2_REGIONS,
  SYSTEM2_SHEET_HEIGHT,
  SYSTEM2_SHEET_WIDTH,
  system2GaugeCssVars,
  system2SpriteCss,
} from "@/assets/system2Sheet";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_BATTLE_FIELD_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import { store } from "@/project/store";
import { applyBattleSystemGraphic } from "@/player/systemGraphics";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

describe("System2 sheet layout", () => {
  it("exposes 80×96 RM2k3 System2 dimensions and fill regions inside the sheet", () => {
    expect(SYSTEM2_SHEET_WIDTH).toBe(80);
    expect(SYSTEM2_SHEET_HEIGHT).toBe(96);
    for (const region of Object.values(SYSTEM2_REGIONS)) {
      expect(region.x + region.w).toBeLessThanOrEqual(SYSTEM2_SHEET_WIDTH);
      expect(region.y + region.h).toBeLessThanOrEqual(SYSTEM2_SHEET_HEIGHT);
    }
    expect(SYSTEM2_REGIONS.hpFill).toEqual({ x: 48, y: 44, w: 32, h: 2 });
    expect(SYSTEM2_REGIONS.spFill).toEqual({ x: 48, y: 60, w: 32, h: 2 });
    expect(SYSTEM2_REGIONS.atFill).toEqual({ x: 48, y: 76, w: 32, h: 2 });
  });

  it("builds percentage CSS sprite coords for gauge fill strips", () => {
    const hp = system2SpriteCss(SYSTEM2_REGIONS.hpFill);
    // size = sheet/region * 100 → 80/32*100 = 250, 96/2*100 = 4800
    expect(hp.backgroundSize).toBe("250% 4800%");
    // posX = 48/(80-32)*100 = 100, posY = 44/(96-2)*100 ≈ 46.81
    expect(hp.backgroundPosition).toBe("100% 46.808510638297875%");

    const vars = system2GaugeCssVars();
    expect(vars["--system2-hp-fill-size"]).toBe(hp.backgroundSize);
    expect(vars["--system2-at-fill-size"]).toContain("%");
  });
});

describe("System2 is not a battle backdrop", () => {
  it("battle command preview falls back to the forest field, never System2", () => {
    const restore = installFakeDom();
    try {
      const project = createBlankProject();
      const troop = project.database.troops[0]!;
      // Force missing troop backdrop so preview uses the global fallback path.
      troop.previewBackgroundResourceId = undefined;
      project.system.battleSystemResourceId = "easyrpg-system2-system2-c";
      store.replace(project);

      const preview = renderCommandPreview({
        kind: "battleProcessing",
        troopId: troop.id,
        canEscape: true,
        canLose: false,
      }) as unknown as HTMLElement;

      const field = findByTestId(preview as unknown as FakeElement, "ecp-battle-field") as FakeElement | null;
      expect(field).toBeTruthy();
      const bg = String(field?.style.backgroundImage ?? "");
      expect(bg).not.toContain("System2");
      expect(bg).not.toContain("system2");
      // Resolved URL should reference the default battle field art.
      expect(bg.length).toBeGreaterThan(0);
      // Resource id path is embedded in the generated URL for packaged assets.
      const forestUrlHint = DEFAULT_BATTLE_FIELD_BACKGROUND_ID.replace(/generated-/, "");
      expect(bg.includes("forest") || bg.includes(DEFAULT_BATTLE_FIELD_BACKGROUND_ID) || bg.includes(forestUrlHint)).toBe(
        true
      );
    } finally {
      restore();
    }
  });
});

describe("applyBattleSystemGraphic System2 wiring", () => {
  it("sets System2 CSS var and gauge slice vars without painting System2 as windowskin", () => {
    const restore = installFakeDom();
    try {
      store.replace(createBlankProject());
      store.update((draft) => {
        draft.system.systemResourceId = "windowskin-rm2003";
        draft.system.battleSystemResourceId = "easyrpg-system2-system2-c";
      });
      const node = document.createElement("div") as unknown as FakeElement;
      applyBattleSystemGraphic(node as unknown as HTMLElement);

      expect(node.style["--runtime-battle-system2"]).toContain("System2C.png");
      expect(node.style["--system2-hp-fill-size"]).toBe("250% 4800%");
      expect(node.style["--system2-sp-fill-size"]).toBe("250% 4800%");
      expect(node.style["--system2-at-fill-size"]).toBe("250% 4800%");
      expect(node.style["--system2-hp-fill-hi"]).toBe("#e7874e");
      expect(node.style["--system2-at-fill-lo"]).toBe("#60bcee");
      // Window skin stays real CSS skin, not System2.
      expect(node.style["--runtime-window-skin"]).toContain("windowskin-rm2003");
      expect(node.dataset.battleSystemResource).toBe("easyrpg-system2-system2-c");
    } finally {
      restore();
    }
  });
});
