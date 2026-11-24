import { describe, expect, it } from "vitest";
import { renderPlayerStatusMenu, statusMenuZoom, createPlayerStatusMenuSnapshot } from "@/player/playerStatusMenu";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import { createBlankProject } from "@/project/defaults";
import { startSession, clearAudioState, erasePictureState, setAudioState, showPictureState } from "@/project/session";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { applySaveSnapshot, createSaveSnapshot, createSystemShellState, getSaveSlotStatus, listSaveSlots, reduceSystemShell, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import { isolateTimers } from "./mergedTeardown";

describe("playerStatusMenuEdgeDock", () => {
  isolateTimers();
  const noopActions: PlayerStatusMenuActions = {
    // 실제 메뉴 컨트롤러는 늘 이 콜백을 준다(playerStatusMenuController). 없으면 가방 정렬·분류 행이
    // 조작 불가로 그려져 설명을 행 안에 펼친다(#2707 의 가방 보기 행).
    onInventoryViewChange: () => undefined,
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
        project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
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
        project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
        // 파티 명령 넷이 다 쓸 데가 있는 게임(동료 있음 · 몬스터 수집) — 혼자인 게임의 기본 메뉴는 열·진형·몬스터를 싣지 않는다.
        project.system.monsterCollection = true;
        const session = startSession(project);
        session.partyActorIds = ["actor_hero", "actor_mage"];
        const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
          project,
          session,
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
        project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
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
        project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
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
        project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
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
        project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
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
});

// S6 club-festival: 고해상도 프로젝트에서 ESC 메뉴가 320×240 판 그대로 그려져 글자가 눌렸다 — 정수배로 키운다.
describe("statusMenuZoom", () => {
  isolateTimers();
  describe("상태 메뉴 배율", () => {
    it("기본 320×240·480×320 은 그대로", () => {
      expect(statusMenuZoom({ width: 320, height: 240 })).toBe(1);
      expect(statusMenuZoom({ width: 480, height: 320 })).toBe(1);
    });
    it("고해상도는 정수배", () => {
      expect(statusMenuZoom({ width: 640, height: 480 })).toBe(2);
      expect(statusMenuZoom({ width: 1024, height: 768 })).toBe(3);
      expect(statusMenuZoom({ width: 1920, height: 1080 })).toBe(4);
    });
  });
});

describe("systemShell", () => {
  isolateTimers();
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();

    get length(): number {
      return this.values.size;
    }

    clear(): void {
      this.values.clear();
    }

    getItem(key: string): string | null {
      return this.values.get(key) ?? null;
    }

    key(index: number): string | null {
      return Array.from(this.values.keys())[index] ?? null;
    }

    removeItem(key: string): void {
      this.values.delete(key);
    }

    setItem(key: string, value: string): void {
      this.values.set(key, value);
    }
  }
  describe("T12 save slots", () => {
    it("roundtrips runtime location, switches, variables, audio, pictures, and battle result", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const storage = new MemoryStorage();
      session.currentMapId = project.startMapId;
      session.x = 3;
      session.y = 4;
      session.switches.sw_gate = true;
      session.variables.var_score = 17;
      session.battleResult = "victory";
      setAudioState(session, { channel: "bgm", resourceId: "bgm_theme", loop: true });
      showPictureState(session, { pictureId: "pic_1", resourceId: "picture_gate", x: 16, y: 24 });

      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      const loaded = readSaveSlot(storage, 1);
      expect(loaded.kind).toBe("present");
      if (loaded.kind !== "present") throw new Error("expected present save slot");
      const restored = applySaveSnapshot(project, loaded.snapshot);

      expect(restored.currentMapId).toBe(project.startMapId);
      expect(restored.x).toBe(3);
      expect(restored.y).toBe(4);
      expect(restored.switches.sw_gate).toBe(true);
      expect(restored.variables.var_score).toBe(17);
      expect(restored.battleResult).toBe("victory");
      expect(restored.audio.bgm?.resourceId).toBe("bgm_theme");
      expect(restored.pictures.pic_1?.resourceId).toBe("picture_gate");
    });

    it("isolates a corrupt slot while keeping another slot loadable", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const storage = new MemoryStorage();
      storage.setItem("oprn:save-slot:1", "{not-json");
      session.variables.var_score = 2;
      saveToSlot(storage, 2, createSaveSnapshot(project, session));

      const slots = listSaveSlots(storage);

      expect(getSaveSlotStatus(slots, 1).kind).toBe("corrupt");
      expect(getSaveSlotStatus(slots, 2).kind).toBe("present");
    });

    it("treats malformed audio state as a corrupt slot while keeping another slot loadable", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const storage = new MemoryStorage();
      const malformedAudioSlot = {
        schemaVersion: 3,
        projectTitle: "T12 corrupt audio",
        savedAt: "2026-06-19T00:00:00.000Z",
        session: {
          switches: {},
          variables: {},
          timers: {},
          currentMapId: project.startMapId,
          x: 0,
          y: 0,
          mapOverrides: {},
          flags: {},
          audio: { bgm: { resourceId: 42, loop: true } },
          pictures: {},
        },
      };

      storage.setItem(saveSlotKey(1), JSON.stringify(malformedAudioSlot));
      session.variables.var_score = 2;
      saveToSlot(storage, 2, createSaveSnapshot(project, session));

      const slots = listSaveSlots(storage);

      expect(getSaveSlotStatus(slots, 1).kind).toBe("corrupt");
      expect(getSaveSlotStatus(slots, 2).kind).toBe("present");
    });
  });
  describe("T12 shell state", () => {
    it("models title, load, main menu, game over, and return-title transitions", () => {
      let state = createSystemShellState("title");

      state = reduceSystemShell(state, { kind: "open-load" });
      expect(state.screen).toBe("load");

      state = reduceSystemShell(state, { kind: "start-new-game" });
      expect(state.screen).toBe("play");

      state = reduceSystemShell(state, { kind: "open-menu" });
      expect(state.screen).toBe("main-menu");

      state = reduceSystemShell(state, { kind: "game-over" });
      expect(state.screen).toBe("game-over");

      state = reduceSystemShell(state, { kind: "return-title" });
      expect(state.screen).toBe("title");
    });
  });
  describe("T12 RM2K3 player status menu", () => {
    it("keeps the X-key status menu model stable for an empty party", () => {
      const project = createBlankProject();
      const session = startSession(project);
      session.partyActorIds = [];
      session.actorVitals = {};

      const snapshot = createPlayerStatusMenuSnapshot(project, session);

      // 레일 = 펼친 명령(행동 → 파티) + 접힌 그룹 열기 항목(기록/시스템).
      // 그 순서가 곧 화면 순서이자 ↑↓ 이동 순서다.
      expect(snapshot.commandLabels).toEqual([
        "아이템",
        "스킬",
        "장비",
        "파티 ▸",
        "기록 ▸",
        "시스템 ▸",
      ]);
      expect(snapshot.commands.map((command) => command.groupId)).toEqual([
        "action", "action", "action",
        "party", "record", "system",
      ]);
      // 접힌 그룹 항목은 자기 자신이 그룹을 대표하므로 앞에 별도 라벨을 두지 않는다.
      expect(snapshot.commands.filter((command) => command.groupStart).map((command) => command.id))
        .toEqual(["items"]);
      expect(snapshot.commands.filter((command) => command.opensGroup).map((command) => command.id))
        .toEqual(["party-menu", "record-menu", "system-menu"]);
      expect(snapshot.goldLabel).toBe("돈 0G");
      expect(snapshot.partyRows).toEqual([]);
      expect(snapshot.emptyPartyLabel).toBe("파티원이 없습니다");
    });

    it("renders Korean command details and clear footer labels for an empty party", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.menuUiStyle = "workbench"; // workbench 배치 계약(기본 스킨은 pixel)
        const session = startSession(project);
        session.partyActorIds = [];
        session.actorVitals = {};

        const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
          project,
          session,
          slots: [
            { kind: "empty", slot: 1 },
            { kind: "empty", slot: 2 },
            { kind: "empty", slot: 3 },
          ],
          actions: {
            onCommand: () => undefined,
            onOpenGroup: () => undefined,
            onSaveSlot: () => undefined,
            onLoadSlot: () => undefined,
            onSelectItemTarget: () => undefined,
            onToggleWait: () => undefined,
            onToTitle: () => undefined,
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
          },
        }));

        expect(menu.className).toContain("oprn-status-menu");
        expect(findByTestId(menu, "status-menu-command-rail")?.textContent).toContain("아이템");
        // 저장은 "시스템 ▸" 그룹으로 접혔다 — 레일에는 그룹 열기 항목만 남는다.
        expect(findByTestId(menu, "status-menu-command-system-menu")?.textContent).toBe("시스템 ▸");
        // J88(2026-10-26): 전투도 상점도 시작 돈도 없는 게임은 머리줄에 「돈 0G」 를 두지 않는다.
        // 빈 프로젝트가 그 경우다 — 금액 라벨(snapshot.goldLabel)은 그대로 계산되지만 화면에는 안 나간다.
        expect(findByTestId(menu, "status-menu-gold")).toBeNull();
        expect(findByTestId(menu, "status-menu-slots")).toBeNull();
        expect(findByTestId(menu, "status-menu-time")?.textContent).toBe("0:00");
        expect(findByTestId(menu, "status-menu-party")).toBeNull();
        expect(findByTestId(menu, "status-menu-empty")).toBeNull();
        expect(findByTestId(menu, "status-menu-detail-title")?.textContent).toBe("아이템");
        expect(findByTestId(menu, "status-menu-detail")?.textContent).toContain("아이템이 없습니다");
      } finally {
        restoreDom();
      }
    });

    // 짝 검증 — 위 테스트만 있으면 「돈을 영원히 숨김」 도 통과한다. 돈을 쓰는 게임에서는 보여야 한다.
    it("shows the gold label when the game actually uses money", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.menuUiStyle = "workbench";
        const session = startSession(project);
        session.gold = 250;

        const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
          project,
          session,
          slots: [],
          actions: {
            onCommand: () => undefined,
            onOpenGroup: () => undefined,
            onSaveSlot: () => undefined,
            onLoadSlot: () => undefined,
            onSelectItemTarget: () => undefined,
            onToggleWait: () => undefined,
            onToTitle: () => undefined,
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
          },
        }));

        expect(findByTestId(menu, "status-menu-gold")?.textContent).toContain("250");
      } finally {
        restoreDom();
      }
    });
  });
  describe("T12 audio and picture session state", () => {
    it("starts play sessions from legacy actors that do not yet store parameter curves", () => {
      const project = createBlankProject();
      const actor = project.database.actors[0];
      if (!actor) throw new Error("expected default actor");
      const legacyActor: Omit<typeof actor, "parameterCurves"> & {
        parameterCurves?: typeof actor.parameterCurves;
      } = actor;
      delete legacyActor.parameterCurves;

      const session = startSession(project);

      expect(session.actorVitals[actor.id]?.maxHp).toBeGreaterThan(0);
      expect(session.actorVitals[actor.id]?.maxMp).toBeGreaterThan(0);
    });

    it("tracks browser-safe audio command state without requiring playback", () => {
      const session = startSession(createBlankProject());

      setAudioState(session, { channel: "bgm", resourceId: "bgm_theme", loop: true });
      setAudioState(session, { channel: "se", resourceId: "se_cursor", loop: false });
      clearAudioState(session);

      expect(session.audio.bgm).toBeUndefined();
      expect(session.audio.se).toBeUndefined();
    });

    it("persists picture state until an erase command removes that picture id", () => {
      const session = startSession(createBlankProject());

      showPictureState(session, { pictureId: "pic_1", resourceId: "picture_gate", x: 16, y: 24 });
      showPictureState(session, { pictureId: "pic_2", resourceId: "picture_badge", x: 48, y: 64 });
      erasePictureState(session, "pic_1");

      expect(session.pictures.pic_1).toBeUndefined();
      expect(session.pictures.pic_2?.resourceId).toBe("picture_badge");
    });
  });
});
