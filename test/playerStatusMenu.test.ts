import { describe, expect, it } from "vitest";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("player status menu", () => {
  it("keeps the command rail visible while a command detail is active", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session: startSession(project),
          slots: [],
          selectedCommand: "skills",
          mode: "function",
          actions: {
            onCommand: () => undefined,
            onSaveSlot: () => undefined,
            onLoadSlot: () => undefined,
            onSelectItemTarget: () => undefined,
            onUseItem: () => undefined,
            onSelectEquipmentActor: () => undefined,
            onSelectEquipmentSlot: () => undefined,
            onEquipItem: () => undefined,
            onToggleRow: () => undefined,
            onSelectFormationActor: () => undefined,
            onMoveFormationActor: () => undefined,
            onToggleWait: () => undefined,
            onToTitle: () => undefined,
          },
        }),
      );

      const commandRail = findByTestId(menu, "status-menu-command-rail");
      const skillsCommand = findByTestId(menu, "status-menu-command-skills");
      const detail = findByTestId(menu, "status-menu-detail");

      expect(commandRail).not.toBeNull();
      expect(skillsCommand?.classList.contains("selected")).toBe(true);
      expect(detail?.textContent).toContain("스킬");
    } finally {
      restoreDom();
    }
  });
});
