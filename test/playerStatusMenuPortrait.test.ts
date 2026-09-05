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

function renderPartyFaceStyle(faceResourceId: string): string {
  const project = createBlankProject();
  const session = startSession(project);
  const hero = project.database.actors.find((actor) => actor.id === session.partyActorIds[0])!;
  hero.faceResourceId = faceResourceId;
  const menu = renderWithFakeDom(() =>
    renderPlayerStatusMenu({ project, session, slots: [], selectedCommand: "party-menu", actions: noopActions }),
  );
  return findByTestId(menu, "status-menu-face-0")?.getAttribute("style") ?? "";
}

describe("player status menu party portrait", () => {
  it("carries the authored per-face resource id into the party row and keeps no cell index", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const hero = project.database.actors.find((actor) => actor.id === session.partyActorIds[0])!;
    hero.faceResourceId = "easyrpg-faceset-actor1-02";
    const snapshot = createPlayerStatusMenuSnapshot(project, session);
    expect(snapshot.partyRows[0]?.faceResourceId).toBe("easyrpg-faceset-actor1-02");
    expect(snapshot.partyRows[0]).not.toHaveProperty("faceIndex");
  });

  it("paints the whole face file into the 22px party box", () => {
    const restoreDom = installFakeDom();
    try {
      const style = renderPartyFaceStyle("easyrpg-faceset-actor1-02");
      expect(style).toContain('background-image:url("/assets/easyrpg/faceset/Actor1/02.png")');
      // 낱장 얼굴 파일 한 장을 상자 크기에 맞춘다 — 시트 열/행 오프셋은 없다.
      expect(style).toContain("background-size:22px 22px");
      expect(style).toContain("width:22px");
      expect(style).toContain("height:22px");
      expect(style).not.toContain("background-position");
      expect(style).not.toContain("--crop-");
    } finally {
      restoreDom();
    }
  });

  it("switches file, not crop offsets, when another face is authored", () => {
    const restoreDom = installFakeDom();
    try {
      const style = renderPartyFaceStyle("easyrpg-faceset-people1-05");
      expect(style).toContain('background-image:url("/assets/easyrpg/faceset/People1/05.png")');
      expect(style).not.toContain("--crop-");
    } finally {
      restoreDom();
    }
  });

  it("keeps the name-initial placeholder when the face resource does not resolve", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const hero = project.database.actors.find((actor) => actor.id === session.partyActorIds[0])!;
      hero.faceResourceId = "missing-face-resource";
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({ project, session, slots: [], selectedCommand: "party-menu", actions: noopActions }),
      );
      const face = findByTestId(menu, "status-menu-face-0");
      expect(face?.className).toContain("missing");
      expect(face?.textContent).toBe(hero.name.trim().slice(0, 1));
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
        renderPlayerStatusMenu({ project, session, slots: [], selectedCommand: "party-menu", actions: noopActions }),
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
