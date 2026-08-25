import { describe, expect, it } from "vitest";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import { createPlayerStatusMenuSnapshot } from "@/player/playerStatusMenuModel";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
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

describe("player status menu party portrait", () => {
  it("carries the authored actor faceIndex into the party row", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const hero = project.database.actors.find((actor) => actor.id === session.partyActorIds[0])!;
    hero.faceIndex = 2;
    const snapshot = createPlayerStatusMenuSnapshot(project, session);
    expect(snapshot.partyRows[0]?.faceIndex).toBe(2);
  });

  it("crops a 16px face box to the faceset column/row for faceIndex 2", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const hero = project.database.actors.find((actor) => actor.id === session.partyActorIds[0])!;
      hero.faceIndex = 2;
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({ project, session, slots: [], actions: noopActions }),
      );
      const face = findByTestId(menu, "status-menu-face-0");
      const style = face?.getAttribute("style") ?? "";
      // faceIndex 2 → column 2, row 0.
      expect(style).toContain("--crop-x:-44px");
      expect(style).toMatch(/--crop-y:-0px|--crop-y:0px/);
      // 22px box on a 4×4 faceset sheet → 88px sheet crop window.
      expect(style).toContain("--crop-sheet-width:88px");
      expect(style).toContain("--crop-sheet-height:88px");
      expect(style).toContain("--crop-width:22px");
      expect(style).toContain("--crop-height:22px");
    } finally {
      restoreDom();
    }
  });

  it("maps faceIndex 5 to column 1 row 1", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const hero = project.database.actors.find((actor) => actor.id === session.partyActorIds[0])!;
      hero.faceIndex = 5;
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({ project, session, slots: [], actions: noopActions }),
      );
      const face = findByTestId(menu, "status-menu-face-0");
      const style = face?.getAttribute("style") ?? "";
      expect(style).toContain("--crop-x:-22px");
      expect(style).toContain("--crop-y:-22px");
    } finally {
      restoreDom();
    }
  });

  it("keeps the authored windowskin reachable as a variable while suppressing the fill", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({ project, session, slots: [], actions: noopActions }),
      );
      const panel = findByTestId(menu, "main-menu")!;
      // The authored resource metadata survives...
      expect(panel.getAttribute("data-system-resource")).toBeTruthy();
      // ...the skin stays reachable by inner panels as a CSS variable...
      expect(panel.style["--runtime-window-skin"]).toMatch(/^url\("/);
      // ...but the full-stage border-image fill stays suppressed.
      expect(panel.style["border-image-source"]).toBeUndefined();
    } finally {
      restoreDom();
    }
  });
});
