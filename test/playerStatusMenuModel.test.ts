import { describe, expect, it, vi } from "vitest";
import { createBlankProject, DEFAULT_EQUIPMENT_ID } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createLifeLedgerDetail } from "@/player/lifeLedger";
import { listStatusMenuCommandIds, createPlayerStatusMenuSnapshot, listStatusMenuGroupCommandIds, listStatusMenuRailIds, statusMenuCommandSummary, statusMenuRailIdForCommand } from "@/player/playerStatusMenuModel";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import { normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { useItemFromMenu, type MenuItemUseResult } from "@/player/playerItemUse";
import { createSaveSnapshot, type SaveSlotReadResult } from "@/player/saveSlots";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("p2SpatialRuntimeUi", () => {
  isolateTimers();
  describe("P2 spatial runtime status surface", () => {
    it("shows placed general structures and decorations in an independent spaces ledger tab", () => {
      // Break caught: authored placements persist but are completely invisible to the player at runtime.
      const project = createBlankProject();
      const itemId = project.database.items[0]!.id;
      project.database.farmBuildingTypes = [{
        id: "shed", name: "작업 창고",
        levels: [{ level: 1, name: "기본", footprint: { width: 2, height: 2 }, capacity: 8, graphicResourceId: "easyrpg-picture-cloud" }],
      }];
      project.database.homeDecorationTypes = [{
        id: "table", name: "나무 탁자", placementItemId: itemId,
        footprint: { width: 2, height: 1 }, blocksMovement: true,
        allowedOrientations: ["down", "left"], graphicResourceId: "easyrpg-picture-cloud",
      }];
      project.session.farmBuildingPlacements = [{
        instanceId: "shed_1", typeId: "shed", level: 1,
        mapId: project.startMapId, x: 2, y: 2, orientation: "down",
      }];
      project.session.homeDecorationPlacements = [{
        instanceId: "table_1", typeId: "table",
        mapId: project.startMapId, x: 6, y: 2, orientation: "left",
      }];
      const session = startSession(project, 901);

      expect(listStatusMenuCommandIds(project, session)).toContain("life-ledger");
      const mutations: boolean[] = [];
      const detail = createLifeLedgerDetail({
        project,
        session,
        tab: "spaces",
        onMutation: (ok) => mutations.push(ok),
        readLive: () => ({
          player: { mapId: session.currentMapId, x: session.x, y: session.y, footprint: { width: 1, height: 1 }, passRows: 1 },
          npcs: [],
        }),
        placementDirection: "down",
      });
      expect(detail.tabs?.at(-1)).toMatchObject({ id: "spaces", testId: "life-ledger-tab-spaces", selected: true });
      expect(detail.artwork?.src).toBe("/assets/farming/life-ui/decorating-card.png");
      expect(detail.entries).toEqual(expect.arrayContaining([
        expect.objectContaining({ label: "작업 창고", testId: "life-ledger-space-building-shed_1", value: "Lv.1 · 수용량 8" }),
        expect.objectContaining({ label: "나무 탁자", testId: "life-ledger-space-decoration-table_1", value: "왼쪽 · 1×2" }),
      ]));
      const rotate = detail.entries.find((entry) => entry.testId === "life-ledger-space-decoration-rotate-table_1");
      expect(rotate?.disabled).toBe(false);
      rotate?.onActivate?.();
      expect(session.homeDecorationPlacements?.table_1?.orientation).toBe("down");
      expect(mutations).toEqual([true]);
    });
  });
});

describe("playerStatusMenu", () => {
  isolateTimers();
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

    it("renders the session play time in the header clock", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.menuUiStyle = "workbench";
        const session = startSession(project);
        // 세이브에서 되살아난 값(예: fallen-star 6:31) — 시계는 이 값을 읽어야 한다.
        session.playTimeSeconds = 391;
        const menu = renderWithFakeDom(() =>
          renderPlayerStatusMenu({ project, session, slots: [], actions: noopActions }),
        );

        // 시계는 저장 칸과 같은 꼴(한 시간 안은 m:ss) — 391초는 6분 31초.
        expect(findByTestId(menu, "status-menu-time")?.textContent).toBe("6:31");
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

    it("counts next-level EXP from the current level floor when stored EXP is still 0", () => {
      // fs2 I02: Lv14 체크포인트(누적 EXP 0)가 「다음 7306」을 보이다 첫 승리 뒤 725 로 떨어졌다.
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      const actor = normalizeActorRecord(project.database.actors.find((entry) => entry.id === actorId)!);
      session.actorLevels[actorId] = 14;
      session.actorExperience[actorId] = 0;
      const base = totalExpForLevel(actor.expCurve, 14);
      const next = totalExpForLevel(actor.expCurve, 15);
      const row = createPlayerStatusMenuSnapshot(project, session).partyRows[0]!;
      expect(row.nextLevel).toEqual({ remaining: next - base, ratio: 0 });
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

    it("shows place, play time and level on every filled slot, and the save date once for the selected one", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        const session = startSession(project);
        const older = {
          ...createSaveSnapshot(project, session),
          savedAt: new Date(2026, 7, 14, 5, 5).toISOString(),
          mapName: "폐등대 창고",
          partyLevel: 12,
          playTimeSeconds: 18_000,
        };
        const newer = {
          ...createSaveSnapshot(project, session),
          savedAt: new Date(2026, 9, 27, 5, 40).toISOString(),
          mapName: "안개 항구 마을",
          partyLevel: 4,
          playTimeSeconds: 900,
        };
        const slots: SaveSlotReadResult[] = [
          { kind: "present", slot: 1, snapshot: newer },
          { kind: "present", slot: 2, snapshot: older },
          { kind: "empty", slot: 3 },
        ];
        const menu = renderWithFakeDom(() =>
          renderPlayerStatusMenu({
            project,
            session,
            slots,
            selectedCommand: "save",
            mode: "function",
            selectedDetailActionIndex: 0,
            actions: noopActions,
          }),
        );

        const first = findByTestId(menu, "save-slot-1");
        const second = findByTestId(menu, "save-slot-2");
        expect(first?.querySelector(".status-menu-detail-value")?.textContent).toBe("안개 항구 마을 · 15:00 · L4");
        expect(second?.querySelector(".status-menu-detail-value")?.textContent).toBe("폐등대 창고 · 5:00:00 · L12");
        // 같은 저장 정보를 목록 아래 요약으로 다시 그리지 않는다(2026-11-14 QA minor 9: 행 · 요약 · 안내 줄 세 번).
        expect(findByTestId(menu, "status-menu-detail-showcase")).toBeNull();
        const footer = findByTestId(menu, "status-menu-message")?.textContent ?? "";
        expect(footer).toContain("2026.10.27 05:40");
        expect(footer).not.toContain("안개 항구 마을");
        expect(footer).not.toContain("15:00");
        const shown = menu.textContent ?? "";
        expect(shown.split("안개 항구 마을").length - 1).toBe(1);
        expect(shown.split("2026.10.27 05:40").length - 1).toBe(1);
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

    it("lists a loadable autosave above the manual slots and keeps it off the save screen", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.menuUiStyle = "workbench";
        const session = startSession(project);
        const snapshot = {
          ...createSaveSnapshot(project, session),
          savedBy: "auto" as const,
          autosaveTrigger: "transfer" as const,
        };
        const slots: SaveSlotReadResult[] = [
          { kind: "empty", slot: 1 },
          { kind: "empty", slot: 2 },
          { kind: "empty", slot: 3 },
        ];
        const onLoadAutosave = vi.fn();
        const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
          project,
          session,
          slots,
          autosave: { kind: "present", snapshot },
          selectedCommand: "load",
          mode: "function",
          actions: { ...noopActions, onLoadAutosave },
        }));
        const auto = findByTestId(menu, "load-slot-auto");
        expect(auto?.textContent).toContain("자동 저장");
        expect(auto?.getAttribute("aria-label")).toContain("맵 이동");
        auto?.click();
        expect(onLoadAutosave).toHaveBeenCalledOnce();
        expect(findByTestId(menu, "load-slot-1")).not.toBeNull();

        const saveMenu = renderWithFakeDom(() => renderPlayerStatusMenu({
          project,
          session,
          slots,
          autosave: { kind: "present", snapshot },
          selectedCommand: "save",
          mode: "function",
          actions: { ...noopActions, onLoadAutosave },
        }));
        expect(findByTestId(saveMenu, "load-slot-auto")).toBeNull();

        const corrupt = renderWithFakeDom(() => renderPlayerStatusMenu({
          project,
          session,
          slots,
          autosave: { kind: "corrupt", message: "Invalid switches" },
          selectedCommand: "load",
          mode: "function",
          actions: { ...noopActions, onLoadAutosave },
        }));
        const corruptRow = findByTestId(corrupt, "load-slot-auto");
        expect(corruptRow?.textContent).toContain("손상됨");
        expect(corruptRow?.textContent).toContain("Invalid switches");
        corruptRow?.click();
        expect(onLoadAutosave).toHaveBeenCalledOnce();

        const blocked = renderWithFakeDom(() => renderPlayerStatusMenu({
          project,
          session,
          slots,
          autosave: {
            kind: "present",
            snapshot: {
              ...snapshot,
              autosaveTrigger: "battleVictory",
              session: { ...snapshot.session, currentMapId: "missing-map" },
            },
          },
          selectedCommand: "load",
          mode: "function",
          actions: { ...noopActions, onLoadAutosave },
        }));
        const blockedRow = findByTestId(blocked, "load-slot-auto");
        expect(blockedRow?.textContent).toContain("이어서 할 수 없음");
        expect(blockedRow?.textContent).toContain("저장 당시의 맵이 이 프로젝트에 없습니다");
        blockedRow?.click();
        expect(onLoadAutosave).toHaveBeenCalledOnce();

        const empty = renderWithFakeDom(() => renderPlayerStatusMenu({
          project,
          session,
          slots,
          autosave: { kind: "empty" },
          selectedCommand: "load",
          mode: "function",
          actions: noopActions,
        }));
        expect(findByTestId(empty, "load-slot-auto")).toBeNull();
      } finally {
        restoreDom();
      }
    });
  });
});

describe("playerStatusMenuPortrait", () => {
  isolateTimers();
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
  /**
   * 파티 행 얼굴(status-menu-face-N)은 작업 패널 스킨의 파티 패널에 있다. 기본 스킨이 2026-09-28 workbench → pixel(파티 걷기 그림 첫 화면)로
   * 바뀌어 기본 프로젝트에서는 그 패널이 그려지지 않는다 — 얼굴 계약은 작업 패널 스킨에서 잰다.
   */
  function partyPanelProject() {
    const project = createBlankProject();
    project.system.menuUiStyle = "workbench";
    return project;
  }
  function renderPartyFaceStyle(faceResourceId: string): string {
    const project = partyPanelProject();
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
        const project = partyPanelProject();
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
});

describe("statusMenuRailFlat", () => {
  isolateTimers();
  function flatProject() {
    const project = createBlankProject();
    project.system.menuUiStyle = "party-first";
    return project;
  }
  describe("flat status menu rail (painted skins)", () => {
    // 기록 묶음에는 「전투 기록」·「임무」 가, 시스템 묶음에는 「설정」 이 기본으로 있다 — 이 파일의 옛 기대값(임무 하나 · 설정 없음)을 지금 동작으로 맞췄다(2026-11-13).
    it("행동·파티를 펼치고 기록은 「기록 ▸」 로, 저장은 꺼내고 시스템은 접는다", () => {
      const project = flatProject();
      // 동료가 있고 몬스터 수집을 하는 게임 — 파티 명령 넷이 다 쓸 데가 있다.
      project.system.monsterCollection = true;
      const session = startSession(project);
      session.partyActorIds = ["actor_hero", "actor_mage", "actor_cleric"];
      expect(listStatusMenuRailIds(project, session)).toEqual([
        "items", "skills", "equipment", "status", "row", "formation", "monsters", "record-menu", "save", "system-menu",
      ]);
    });

    it("기본 메뉴는 쓸 데가 있는 명령만 싣는다 — 혼자면 열·진형이 없고, 몬스터가 없으면 몬스터가 없다", () => {
      const project = flatProject();
      const session = startSession(project);
      expect(session.partyActorIds).toHaveLength(1);
      expect(listStatusMenuRailIds(project, session)).toEqual(["items", "skills", "equipment", "status", "record-menu", "save", "system-menu"]);
      // 동료가 생기면 열·진형이 나타난다.
      session.partyActorIds = ["actor_hero", "actor_mage"];
      expect(listStatusMenuRailIds(project, session)).toEqual(["items", "skills", "equipment", "status", "row", "formation", "record-menu", "save", "system-menu"]);
      // 포획 구슬로 한 마리 잡으면 몬스터가 나타난다.
      session.monsterParty = ["monster_1"];
      expect(listStatusMenuRailIds(project, session)).toContain("monsters");
      // 접힌 레일의 「파티 ▸」 안도 같다.
      const folded = createBlankProject();
      expect(listStatusMenuGroupCommandIds("party-menu", folded, startSession(folded))).toEqual(["status"]);
    });

    it("저작한 메뉴(configure_field_menu)는 작가가 고른 명령 그대로다 — 혼자여도 진형을 뺏지 않는다", () => {
      const project = flatProject();
      project.meta.oprnFieldMenu = { version: 1, entries: [{ command: "items", label: "가방" }, { command: "formation", label: "대열" }, { command: "monsters", label: "동물 친구" }, { command: "save", label: "기록" }] };
      const rail = listStatusMenuRailIds(project, startSession(project));
      expect(rail).toContain("formation");
      expect(rail).toContain("monsters");
    });

    it("시스템 트레이는 저장을 빼고 로드·대기·타이틀만 담는다", () => {
      const project = flatProject();
      expect(listStatusMenuGroupCommandIds("system-menu", project, startSession(project))).toEqual(["load", "wait", "options", "to-title"]);
    });

    it("기록 명령이 둘 이상이면 「기록 ▸」 로 접는다", () => {
      const project = flatProject();
      project.system.giftSystem = true; // 관계 명령 노출
      const session = startSession(project);
      const rail = listStatusMenuRailIds(project, session);
      expect(rail).toContain("record-menu");
      expect(rail).not.toContain("quests");
      expect(listStatusMenuGroupCommandIds("record-menu", project, session)).toEqual(["battle-reports", "quests", "relationships"]);
    });

    it("커서 강조 대상: 펼친 명령은 자신, 접힌 명령은 그룹 항목", () => {
      const project = flatProject();
      const session = startSession(project);
      expect(statusMenuRailIdForCommand("status", project, session)).toBe("status");
      expect(statusMenuRailIdForCommand("save", project, session)).toBe("save");
      expect(statusMenuRailIdForCommand("load", project, session)).toBe("system-menu");
      expect(statusMenuRailIdForCommand("to-title", project, session)).toBe("system-menu");
      expect(statusMenuRailIdForCommand("quests", project, session)).toBe("record-menu");
      expect(statusMenuRailIdForCommand("system-menu", project, session)).toBe("system-menu");
    });

    it("기본 스킨은 접힌 레일 6항목 그대로이고 상태는 파티▸ 로 강조된다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      expect(listStatusMenuRailIds(project, session)).toEqual(["items", "skills", "equipment", "party-menu", "record-menu", "system-menu"]);
      expect(statusMenuRailIdForCommand("status", project, session)).toBe("party-menu");
      expect(statusMenuRailIdForCommand("status")).toBe("party-menu");
      expect(listStatusMenuGroupCommandIds("system-menu", project, session)).toEqual(["save", "load", "wait", "options", "to-title"]);
    });
  });
  describe("hub command summaries", () => {
    it("허브 타일의 한 줄 요약 — 아이템 종수·파티 상태·시스템 하위 명령", () => {
      const project = createBlankProject();
      const session = startSession(project);
      expect(statusMenuCommandSummary("items", project, session, [])).toMatch(/종$/);
      expect(statusMenuCommandSummary("party-menu", project, session, [])).toContain("명");
      expect(statusMenuCommandSummary("system-menu", project, session, [])).toContain("저장");
      expect(statusMenuCommandSummary("save", project, session, [{ kind: "empty", slot: 1 }, { kind: "empty", slot: 2 }, { kind: "empty", slot: 3 }])).toBe("0/3칸");
      expect(statusMenuCommandSummary("to-title", project, session, [])).toBe("");
    });
  });
});
