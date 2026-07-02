import { describe, expect, it } from "vitest";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("player status menu", () => {
  it("opens command functions as full-screen scenes", () => {
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
            onSelectSkillActor: () => undefined,
            onSelectSkill: () => undefined,
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
      const scene = findByTestId(menu, "status-menu-fullscreen-skills");

      expect(commandRail).toBeNull();
      expect(skillsCommand).toBeNull();
      expect(scene?.textContent).toContain("스킬");
    } finally {
      restoreDom();
    }
  });
});
