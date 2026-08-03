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
  onUnequipItem: () => undefined,
  onToggleRow: () => undefined,
  onSelectFormationActor: () => undefined,
  onMoveFormationActor: () => undefined,
  onToggleMonsterView: () => undefined,
  onMoveMonster: () => undefined,
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

  it("renders all 12 commands and full party vitals", () => {
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

      for (const commandId of ["items", "skills", "equipment", "monsters", "save", "load", "status", "row", "formation", "quests", "wait", "to-title"]) {
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

  it("draws HP and MP gauges beside the numeric vitals and flags the danger threshold", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      const vitals = session.actorVitals[actorId]!;
      // 25% 이하 → crit. 게이지 색만이 아니라 모델의 임계 판정을 함께 굳힌다.
      session.actorVitals[actorId] = { ...vitals, hp: Math.floor(vitals.maxHp * 0.1) };
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({ project, session, slots: [], actions: noopActions }),
      );

      const hpGauge = findByTestId(menu, "status-menu-hp-gauge-0");
      expect(hpGauge?.className).toContain("crit");
      expect(hpGauge?.getAttribute("aria-valuenow")).toBe("10");
      expect(findByTestId(menu, "status-menu-mp-gauge-0")?.getAttribute("aria-valuenow")).toBe("100");
      // 숫자 라벨은 사라지지 않는다 — 정확한 값은 여전히 숫자가 담당한다.
      expect(findByTestId(menu, "status-menu-party-row-0")?.textContent).toMatch(/HP \d+\/\d+/);
    } finally {
      restoreDom();
    }
  });

  it("keeps a zero-max vitals actor from producing a broken gauge width", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      session.actorVitals[actorId] = { hp: 0, maxHp: 0, mp: 0, maxMp: 0 };
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({ project, session, slots: [], actions: noopActions }),
      );

      expect(findByTestId(menu, "status-menu-hp-gauge-0")?.getAttribute("aria-valuenow")).toBe("0");
    } finally {
      restoreDom();
    }
  });

  it("groups the command rail and marks returning to title as destructive", () => {
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

      expect(findByTestId(menu, "status-menu-command-group-action")?.textContent).toBe("행동");
      expect(findByTestId(menu, "status-menu-command-group-system")?.textContent).toBe("시스템");
      expect(findByTestId(menu, "status-menu-command-to-title")?.className).toContain("destructive");
      expect(findByTestId(menu, "status-menu-command-items")?.className).not.toContain("destructive");
      // 그룹 라벨은 menuitem 이 아니어야 한다 — 커서가 라벨에서 멈추면 이동이 한 칸씩 어긋난다.
      expect(findByTestId(menu, "status-menu-command-group-action")?.getAttribute("role")).toBeNull();
    } finally {
      restoreDom();
    }
  });

  it("moves the selected item description into the footer so list rows stay one line", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      // blank 프로젝트는 인벤토리가 비어 있어 상세 목록 자체가 안 생긴다.
      const item = project.database.items.find((record) => record.description.trim().length > 0);
      if (!item) throw new Error("missing item fixture with a description");
      session.inventory[item.id] = 2;
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session,
          slots: [],
          selectedCommand: "items",
          mode: "function",
          selectedDetailActionIndex: 0,
          actions: noopActions,
        }),
      );

      expect(findByTestId(menu, "status-menu-message")?.textContent).toBe(item.description);
      // 같은 설명이 행 안에서 다시 펼쳐지면(has-description) 3줄 클램프로 잘린다.
      const rows = Array.from(menu.querySelectorAll(".status-menu-detail-action"));
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.className).toContain("status-menu-detail-row-compact");
        expect(row.className).not.toContain("has-description");
      }
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

  it("shows the unequip candidate when an equipped slot is opened", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      const weapon = project.database.equipment.find((record) => record.slot === "weapon");
      if (!weapon) throw new Error("missing weapon fixture");
      session.actorEquipment[actorId] = { weapon: weapon.id };
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session,
          slots: [],
          selectedCommand: "equipment",
          mode: "function",
          equipmentActorId: actorId,
          equipmentSlotId: "weapon",
          actions: noopActions,
        }),
      );

      expect(findByTestId(menu, "status-menu-equipment-item-none")?.textContent).toContain("해제");
    } finally {
      restoreDom();
    }
  });

  it("keeps item target rows to name, HP, and MP without repeated guidance", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const item = project.database.items.find((record) => record.id === "item_potion") ?? project.database.items[0]!;
      item.name = "테스트 회복약";
      session.actorVitals[session.partyActorIds[0]!]!.hp = 10;
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session,
          slots: [],
          selectedCommand: "items",
          mode: "function",
          targetItemId: item.id,
          actions: noopActions,
        }),
      );

      expect(findByTestId(menu, "status-menu-detail-title")?.textContent).toBe("대상 선택: 테스트 회복약");
      const target = findByTestId(menu, `status-menu-item-target-${session.partyActorIds[0]}`);
      expect(target?.textContent).toMatch(/HP \d+\/\d+.*MP \d+\/\d+/);
      expect(target?.textContent).not.toContain("사용할 대상을 선택하세요");
    } finally {
      restoreDom();
    }
  });
});
