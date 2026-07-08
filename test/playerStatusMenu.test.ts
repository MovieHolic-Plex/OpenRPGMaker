import { describe, expect, it } from "vitest";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import type { SaveSlotReadResult } from "@/player/saveSlots";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const noopActions: PlayerStatusMenuActions = {
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
};

describe("player status menu", () => {
  it("keeps function mode in the unified Korean menu", () => {
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
          actions: noopActions,
        }),
      );

      expect(findByTestId(menu, "status-menu-command-rail")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-fullscreen-skills")).toBeNull();
      expect(findByTestId(menu, "status-menu-command-quests")?.textContent).toBe("임무");
      expect(findByTestId(menu, "status-menu-detail-title")?.textContent).toBe("스킬");
    } finally {
      restoreDom();
    }
  });

  it("renders all 11 commands and full party vitals", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session: startSession(project),
          slots: [],
          actions: noopActions,
        }),
      );

      for (const commandId of ["items", "skills", "equipment", "save", "load", "status", "row", "formation", "quests", "wait", "to-title"]) {
        expect(findByTestId(menu, `status-menu-command-${commandId}`)).not.toBeNull();
      }
      expect(findByTestId(menu, "status-menu-party-row-0")?.textContent).toMatch(/HP \d+\/\d+/);
      expect(findByTestId(menu, "status-menu-party-row-0")?.textContent).toMatch(/MP \d+\/\d+/);
    } finally {
      restoreDom();
    }
  });

  it("shows empty save slots as empty and keeps the selected cursor", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const slots: SaveSlotReadResult[] = [{ kind: "empty", slot: 1 }];
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session: startSession(project),
          slots,
          selectedCommand: "save",
          mode: "function",
          selectedDetailActionIndex: 0,
          actions: noopActions,
        }),
      );

      const slot = findByTestId(menu, "save-slot-1");
      expect(slot?.textContent).toContain("비어 있음");
      expect(slot?.className).toContain("selected");
    } finally {
      restoreDom();
    }
  });

  it("keeps status detail HP and MP numbers visible in text", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session: startSession(project),
          slots: [],
          selectedCommand: "status",
          actions: noopActions,
        }),
      );

      const detail = findByTestId(menu, "status-menu-detail");
      expect(detail?.textContent).toMatch(/HP \d+\/\d+/);
      expect(detail?.textContent).toMatch(/MP \d+\/\d+/);
    } finally {
      restoreDom();
    }
  });

  it("keeps legacy row action test ids in the Korean detail panel", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session: startSession(project),
          slots: [],
          selectedCommand: "row",
          mode: "function",
          actions: noopActions,
        }),
      );

      expect(findByTestId(menu, "status-menu-row-actor_hero")).not.toBeNull();
    } finally {
      restoreDom();
    }
  });
});
