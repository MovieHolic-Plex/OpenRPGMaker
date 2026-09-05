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
  it("keeps six routes and a visible preview without duplicating party information", () => {
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

      expect(menu.getAttribute("data-status-menu-layout")).toBe("workbench");
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
      expect(findByTestId(menu, "status-menu-party")).toBeNull();
      expect(findByTestId(menu, "status-menu-detail")?.getAttribute("aria-hidden")).toBeNull();
      expect(findByTestId(menu, "status-menu-detail")?.getAttribute("inert")).toBe("");
      expect(findByTestId(menu, "status-menu-controls")?.textContent).toContain("Esc 게임으로");
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

  it("shows the selected item in a showcase pane beside the list (art + name + description)", () => {
    // Break caught: dropping the showcase makes the item screen text-only again — the selected
    // record's art and full description only lived in a one-line footer message.
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const item = project.database.items.find((record) => record.description.trim().length > 0);
      if (!item) throw new Error("missing item fixture with a description");
      session.inventory[item.id] = 2;
      const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
        project,
        session,
        slots: [],
        selectedCommand: "items",
        mode: "function",
        selectedDetailActionIndex: 0,
        actions: noopActions,
      }));

      const showcase = findByTestId(menu, "status-menu-detail-showcase");
      expect(showcase).not.toBeNull();
      expect(findByTestId(menu, "status-menu-detail")?.className).toContain("has-showcase");
      expect(findByTestId(menu, "status-menu-showcase-name")?.textContent).toBe(item.name);
      expect(findByTestId(menu, "status-menu-showcase-description")?.textContent).toBe(item.description);
      expect(findByTestId(menu, "status-menu-showcase-art")).not.toBeNull();
      // 쇼케이스는 목록 바깥에 있다 — 행 높이를 키우는 설명 노드를 행에 다시 넣지 않는다.
      expect(menu.querySelector(".status-menu-detail-list .status-menu-detail-description")).toBeNull();
    } finally {
      restoreDom();
    }
  });

  it("renders no showcase for a context tray", () => {
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
      expect(findByTestId(menu, "status-menu-detail-showcase")).toBeNull();
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
