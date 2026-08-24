import { describe, expect, it } from "vitest";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const noopActions: PlayerStatusMenuActions = {
  onCommand: () => undefined,
  onOpenGroup: () => undefined,
  onSaveSlot: () => undefined,
  onLoadSlot: () => undefined,
  onSelectItemTarget: () => undefined,
  onUseItem: () => undefined,
  onSelectSkillActor: () => undefined,
  onSelectSkill: () => undefined,
  onSelectEquipmentActor: () => undefined,
  onSelectEquipmentSlot: () => undefined,
  onEquipItem: () => undefined,
  onUnequipItem: () => undefined,
  onToggleRow: () => undefined,
  onSelectFormationActor: () => undefined,
  onMoveFormationActor: () => undefined,
  onToggleMonsterView: () => undefined,
  onMoveMonster: () => undefined,
  onToggleWait: () => undefined,
  onToTitle: () => undefined,
};

describe("player status menu edge dock", () => {
  it("keeps the current six primary routes in a bottom-dock DOM instead of a legacy rail", () => {
    // Break caught: replacing the edge dock with the old left-side command list removes
    // its explicit layout contract, icon affordances, party glance, and progressive detail disclosure.
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
        project,
        session: startSession(project),
        slots: [],
        actions: noopActions,
      }));

      expect(menu.getAttribute("data-status-menu-layout")).toBe("edge-dock");
      expect(findByTestId(menu, "status-menu-command-rail")?.className)
        .toContain("status-menu-primary-dock");
      expect(findByTestId(menu, "status-menu-command-rail")?.getAttribute("tabindex")).toBe("0");
      expect(findByTestId(menu, "status-menu-command-rail")?.getAttribute("aria-activedescendant"))
        .toBe("status-menu-command-items");
      for (const commandId of ["items", "skills", "equipment", "party-menu", "record-menu", "system-menu"]) {
        expect(findByTestId(menu, `status-menu-command-${commandId}`)).not.toBeNull();
        expect(findByTestId(menu, `status-menu-command-icon-${commandId}`)?.getAttribute("aria-hidden"))
          .toBe("true");
      }
      expect(findByTestId(menu, "status-menu-command-party-menu")?.textContent).toContain("파티");
      expect(findByTestId(menu, "status-menu-party")?.className).toContain("status-menu-party-glance");
      expect(findByTestId(menu, "status-menu-face-0")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-detail")?.getAttribute("aria-hidden")).toBe("true");
    } finally {
      restoreDom();
    }
  });

  it("opens folded party commands as a contextual tray without dropping any existing action", () => {
    // Break caught: flattening or renaming the party group loses the current status/row/formation/monster routes.
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
        project,
        session: startSession(project),
        slots: [],
        selectedCommand: "party-menu",
        mode: "function",
        actions: noopActions,
      }));

      const detail = findByTestId(menu, "status-menu-detail");
      expect(detail?.getAttribute("data-status-menu-presentation")).toBe("context-tray");
      expect(detail?.getAttribute("aria-hidden")).toBeNull();
      expect(findByTestId(menu, "status-menu-command-party-menu")?.className).toContain("selected");
      const detailList = detail?.querySelector(".status-menu-detail-list");
      expect(detailList?.getAttribute("tabindex")).toBe("0");
      expect(detailList?.getAttribute("aria-activedescendant")).toBe("status-menu-group-command-status");
      for (const [commandId, label] of [
        ["status", "상태"],
        ["row", "열 바꾸기"],
        ["formation", "진형"],
        ["monsters", "몬스터"],
      ] as const) {
        expect(findByTestId(menu, `status-menu-group-command-${commandId}`)?.textContent).toContain(label);
      }
    } finally {
      restoreDom();
    }
  });

  it("marks the nested title action as destructive and exposes its warning", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
        project,
        session: startSession(project),
        slots: [],
        selectedCommand: "system-menu",
        mode: "function",
        actions: noopActions,
      }));

      const toTitle = findByTestId(menu, "status-menu-group-command-to-title");
      expect(toTitle?.className).toContain("destructive");
      expect(toTitle?.getAttribute("aria-label")).toContain("미저장 진행 삭제");
    } finally {
      restoreDom();
    }
  });

  it("keeps informational detail screens focusable without claiming menu semantics", () => {
    // Break caught: status rows used role=menu despite containing no menuitems, while an
    // empty detail screen left the controller without any focus fallback after rerender.
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
        project,
        session: startSession(project),
        slots: [],
        selectedCommand: "status",
        mode: "function",
        actions: noopActions,
      }));

      const detail = findByTestId(menu, "status-menu-detail");
      expect(detail?.getAttribute("tabindex")).toBe("-1");
      expect(detail?.querySelector(".status-menu-detail-list")?.getAttribute("role")).toBe("list");
      expect(detail?.querySelector(".status-menu-detail-list")?.getAttribute("aria-activedescendant")).toBeNull();
    } finally {
      restoreDom();
    }
  });
});
