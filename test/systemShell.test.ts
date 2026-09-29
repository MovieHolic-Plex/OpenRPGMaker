import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import {
  applySaveSnapshot,
  createSaveSnapshot,
  createSystemShellState,
  getSaveSlotStatus,
  listSaveSlots,
  reduceSystemShell,
  readSaveSlot,
  saveSlotKey,
  saveToSlot,
} from "@/player/saveSlots";
import {
  clearAudioState,
  erasePictureState,
  setAudioState,
  showPictureState,
  startSession,
} from "@/project/session";
import { createPlayerStatusMenuSnapshot, renderPlayerStatusMenu } from "@/player/playerStatusMenu";

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
      expect(findByTestId(menu, "status-menu-gold")?.textContent).toBe("돈 0G");
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
