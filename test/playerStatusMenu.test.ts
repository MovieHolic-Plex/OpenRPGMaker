import { describe, expect, it, vi } from "vitest";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import { createBlankProject, DEFAULT_EQUIPMENT_ID } from "@/project/defaults";
import { startSession } from "@/project/session";
import { useItemFromMenu, type MenuItemUseResult } from "@/player/playerItemUse";
import type { SaveSlotReadResult } from "@/player/saveSlots";
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

describe("player status menu", () => {
  it("keeps function mode in the unified Korean menu", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
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
      // 임무는 "기록 ▸" 그룹으로 접혔다 — 레일에 직접 버튼은 없다.
      expect(findByTestId(menu, "status-menu-command-quests")).toBeNull();
      expect(findByTestId(menu, "status-menu-command-record-menu")?.textContent).toBe("기록 ▸");
      expect(findByTestId(menu, "status-menu-detail-title")?.textContent).toBe("스킬");
    } finally {
      restoreDom();
    }
  });

  it("renders the folded rail and full party vitals", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session: startSession(project),
          slots: [],
          selectedCommand: "party-menu",
          actions: noopActions,
        }),
      );

      // 좌측 사이드바 가용 높이(약 175px)에 명령 12개 + 파티 4명이 안 들어가 뒤쪽 두 그룹을 접었다.
      for (const railId of ["items", "skills", "equipment", "party-menu", "record-menu", "system-menu"]) {
        expect(findByTestId(menu, `status-menu-command-${railId}`)).not.toBeNull();
      }
      for (const foldedId of ["status", "row", "formation", "monsters", "quests", "save", "load", "wait", "to-title"]) {
        expect(findByTestId(menu, `status-menu-command-${foldedId}`)).toBeNull();
      }
      expect(findByTestId(menu, "status-menu-party-row-0")?.getAttribute("aria-label"))
        .toMatch(/HP \d+\/\d+ MP \d+\/\d+/);
      expect(findByTestId(menu, "status-menu-hp-gauge-0")).not.toBeNull();
    } finally {
      restoreDom();
    }
  });

  it("shows empty save slots as empty and keeps the selected cursor", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
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
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      const vitals = session.actorVitals[actorId]!;
      // 25% 이하 → crit. 게이지 색만이 아니라 모델의 임계 판정을 함께 굳힌다.
      session.actorVitals[actorId] = { ...vitals, hp: Math.floor(vitals.maxHp * 0.1) };
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({ project, session, slots: [], selectedCommand: "party-menu", actions: noopActions }),
      );

      const hpGauge = findByTestId(menu, "status-menu-hp-gauge-0");
      expect(hpGauge?.className).toContain("crit");
      expect(hpGauge?.getAttribute("aria-valuenow")).toBe("10");
      // 2×2 격자로 바꿔 HP/MP 게이지와 수치를 모두 되살렸다. 셀 폭(52px)에 `HP 514/514` 는
      // 안 들어가서 화면에는 접두사 없는 수치만 두고, 전체 문자열은 aria-label 이 담는다.
      expect(findByTestId(menu, "status-menu-mp-gauge-0")?.getAttribute("aria-valuenow")).toBe("100");
      expect(findByTestId(menu, "status-menu-party-row-0")?.textContent).toContain("/");
      expect(findByTestId(menu, "status-menu-party-row-0")?.getAttribute("aria-label"))
        .toMatch(/HP \d+\/\d+ MP \d+\/\d+/);
    } finally {
      restoreDom();
    }
  });

  it("keeps a zero-max vitals actor from producing a broken gauge width", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      session.actorVitals[actorId] = { hp: 0, maxHp: 0, mp: 0, maxMp: 0 };
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({ project, session, slots: [], selectedCommand: "party-menu", actions: noopActions }),
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
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session: startSession(project),
          slots: [],
          actions: noopActions,
        }),
      );

      expect(findByTestId(menu, "status-menu-command-group-action")?.textContent).toBe("행동");
      // 접힌 그룹은 자기 자신이 그룹을 대표하므로 앞에 별도 라벨을 두지 않는다.
      expect(findByTestId(menu, "status-menu-command-group-party")).toBeNull();
      expect(findByTestId(menu, "status-menu-command-group-system")).toBeNull();
      expect(findByTestId(menu, "status-menu-command-party-menu")?.textContent).toBe("파티 ▸");
      expect(findByTestId(menu, "status-menu-command-items")?.className).not.toContain("destructive");
      // 그룹 라벨은 menuitem 이 아니어야 한다 — 커서가 라벨에서 멈추면 이동이 한 칸씩 어긋난다.
      expect(findByTestId(menu, "status-menu-command-group-action")?.getAttribute("role")).toBeNull();
    } finally {
      restoreDom();
    }
  });

  it("lists the folded system commands in the work area", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session: startSession(project),
          slots: [],
          selectedCommand: "system-menu",
          mode: "function",
          actions: noopActions,
        }),
      );

      expect(findByTestId(menu, "status-menu-detail-title")?.textContent).toBe("시스템");
      for (const commandId of ["save", "load", "wait", "to-title"]) {
        expect(findByTestId(menu, `status-menu-group-command-${commandId}`)).not.toBeNull();
      }
      // 레일에서는 접힌 그룹 항목이 강조된다.
      expect(findByTestId(menu, "status-menu-command-system-menu")?.className).toContain("selected");
    } finally {
      restoreDom();
    }
  });

  it("moves the selected item description into the footer so list rows stay one line", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
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
        // 설명 노드를 남긴 다음 CSS 로 둘째 줄로 내려버린 전력이 있다 — 행 높이가 두 배가 되어
        // 81px 목록에 아이템 7개 중 2개만 보이고 셋째 행은 문장 중간에서 잘렸다. 아예 만들지 않는다.
        expect(row.querySelector(".status-menu-detail-description")).toBeNull();
      }
    } finally {
      restoreDom();
    }
  });

  it("lists worn and packed equipment in the item bag", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
      const session = startSession(project);
      const sword = project.database.equipment.find((record) => record.id === DEFAULT_EQUIPMENT_ID);
      if (!sword) throw new Error("missing default sword");
      const extra = project.database.equipment.find((record) => record.id !== DEFAULT_EQUIPMENT_ID);
      if (!extra) throw new Error("missing extra equipment fixture");
      session.inventory[extra.id] = 2;

      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session,
          slots: [],
          selectedCommand: "items",
          mode: "function",
          actions: noopActions,
        }),
      );

      const worn = findByTestId(menu, "status-menu-owned-equipment-worn");
      expect(worn?.textContent).toContain("장착 중");
      expect(worn?.textContent).toContain(sword.name);

      const packed = findByTestId(menu, `status-menu-owned-equipment-${extra.id}`);
      expect(packed?.textContent).toContain(extra.name);
      expect(packed?.textContent).toContain("2개");
    } finally {
      restoreDom();
    }
  });

  it("routes an interactive list hint to the footer so the list keeps that row", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
      const session = startSession(project);
      const actor = session.partyActorIds[0];
      if (!actor) throw new Error("missing party member fixture");
      // 장비 슬롯 화면은 행별 설명이 없어서 힌트가 유일한 안내문이다.
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session,
          slots: [],
          selectedCommand: "equipment",
          mode: "function",
          selectedDetailActionIndex: 0,
          equipmentActorId: actor,
          actions: noopActions,
        }),
      );

      expect(findByTestId(menu, "status-menu-equipment-slot-weapon")).not.toBeNull();
      // 힌트 줄이 패널에 남으면 행 하나 몫을 가져가 슬롯 5개 중 넷째가 가로로 잘렸다.
      expect(menu.querySelector(".status-menu-detail-hint")).toBeNull();
      expect(findByTestId(menu, "status-menu-message")?.textContent).toBe("바꿀 부위를 선택하세요.");
    } finally {
      restoreDom();
    }
  });

  it("leaves the footer blank on the rail so hidden panel descriptions do not leak", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
      const session = startSession(project);
      // 시스템 그룹의 첫 항목(저장) 설명이 레일 단계에서 푸터로 새던 결함.
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({
          project,
          session,
          slots: [],
          selectedCommand: "system-menu",
          mode: "main",
          selectedDetailActionIndex: 0,
          actions: noopActions,
        }),
      );

      expect(findByTestId(menu, "status-menu-message")?.textContent).toBe("");
    } finally {
      restoreDom();
    }
  });

  it("keeps status detail HP and MP numbers visible in text", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
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
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
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
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
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
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
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

      expect(findByTestId(menu, "status-menu-detail-title")?.textContent).toBe("테스트 회복약 · 0개");
      const target = findByTestId(menu, `status-menu-item-target-${session.partyActorIds[0]}`);
      expect(target?.textContent).toMatch(/HP \d+\/\d+.*MP \d+\/\d+/);
      expect(target?.textContent).not.toContain("사용할 대상을 선택하세요");
    } finally {
      restoreDom();
    }
  });

  it("uses a care item on the party monster selected from the item menu", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
      const session = startSession(project);
      const item = project.database.items.find((record) => record.id === "item_gen2_monster_kibble");
      const species = project.database.monsterSpecies?.[0];
      if (!item || !species) throw new Error("missing care fixtures");
      const instanceId = "monster_care_target";
      session.inventory[item.id] = 1;
      session.monsterInstances[instanceId] = {
        instanceId,
        speciesId: species.id,
        level: 3,
        exp: 0,
        friendship: 70,
        caughtAt: { mapId: session.currentMapId, x: session.x, y: session.y },
      };
      session.monsterParty = [instanceId];
      let selectedItemId: string | undefined;
      let result: MenuItemUseResult | undefined;
      const actions: PlayerStatusMenuActions = {
        ...noopActions,
        onSelectItemTarget: (itemId) => { selectedItemId = itemId; },
        onUseItem: (itemId, actorId, monsterInstanceId) => {
          result = useItemFromMenu(project, session, itemId, actorId, monsterInstanceId);
        },
      };
      const list = renderWithFakeDom(() => renderPlayerStatusMenu({
        project,
        session,
        slots: [],
        selectedCommand: "items",
        mode: "function",
        actions,
      }));

      findByTestId(list, `status-menu-item-${item.id}`)?.click();
      if (selectedItemId) {
        const targets = renderWithFakeDom(() => renderPlayerStatusMenu({
          project,
          session,
          slots: [],
          selectedCommand: "items",
          mode: "function",
          targetItemId: selectedItemId,
          actions,
        }));
        findByTestId(targets, `status-menu-monster-${instanceId}`)?.click();
      }

      expect(session.monsterInstances[instanceId]?.friendship).toBe(78);
      expect(result?.kind).toBe("used");
    } finally {
      restoreDom();
    }
  });

  it("surfaces pending monster moves with explicit replace and reject actions", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
      const session = startSession(project);
      const species = project.database.monsterSpecies?.[0];
      const [oldSkill, pendingSkill] = project.database.skills;
      if (!species || !oldSkill || !pendingSkill) throw new Error("missing monster move fixtures");
      session.monsterInstances.monster_pending = {
        instanceId: "monster_pending",
        speciesId: species.id,
        level: 5,
        exp: 0,
        skillIds: [oldSkill.id],
        pendingSkillIds: [pendingSkill.id],
        friendship: 70,
        caughtAt: { mapId: session.currentMapId, x: session.x, y: session.y },
      };
      session.monsterParty = ["monster_pending"];
      const replace = vi.fn();
      const reject = vi.fn();
      const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
        project,
        session,
        slots: [],
        selectedCommand: "monsters",
        mode: "function",
        actions: {
          ...noopActions,
          onReplacePendingMonsterSkill: replace,
          onRejectPendingMonsterSkill: reject,
        },
      }));

      findByTestId(menu, `status-menu-monster-skill-replace-monster_pending-${pendingSkill.id}-${oldSkill.id}`)?.click();
      findByTestId(menu, `status-menu-monster-skill-reject-monster_pending-${pendingSkill.id}`)?.click();

      expect(replace).toHaveBeenCalledWith("monster_pending", pendingSkill.id, oldSkill.id);
      expect(reject).toHaveBeenCalledWith("monster_pending", pendingSkill.id);
    } finally {
      restoreDom();
    }
  });
});
