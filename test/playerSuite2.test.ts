import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createProjectPackage, projectPackageFileName } from "@/project/package";
import { isOprnGameFile, OPRN_GAME_FILE_ACCEPT, pickOprnGameFile, readOprnGameFile } from "@/player/oprnGameFile";
import { exportedProjectId } from "@/player/exportProjectStoreShim";
import { resolveCommunitySaveScope, resolveExportSaveNamespace } from "@/player/exportSaveNamespace";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { startSession } from "@/project/session";
import { appendBattleReport, BATTLE_REPORT_LIMIT, BATTLE_REPORT_LINE_LIMIT, normalizeBattleReports } from "@/project/battleReports";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey } from "@/player/saveSlots";
import { battleReportDetail } from "@/player/playerBattleReportDetail";
import fixture from "./fixtures/projects/battle-v3.json";
import { actorBattlers, battlerSnapshot, refreshActorBattlerDerivedStats } from "@/battle/battleBattlers";
import { formationDamage } from "@/battle/battleFormation";
import { applySkillLike } from "@/battle/battleDamage";
import { predictSkillDamage } from "@/battle/battlePredict";
import { formationDetail } from "@/player/playerFormationDetail";
import { useItemFromMenu } from "@/player/playerItemUse";
import { isolateTimers } from "./mergedTeardown";

describe("oprnGameFile", () => {
  isolateTimers();
  function fileStub(name: string, type = ""): Pick<File, "name" | "type"> {
    return { name, type };
  }
  describe("oprn game file", () => {
    it("derives publication isolation from listing paths, independently of legacy host/file namespaces", () => {
      expect(resolveCommunitySaveScope("/play/listing-a/releases/" + "a".repeat(64) + "/player.html")).toBe("listing-a");
      expect(resolveCommunitySaveScope("/play/listing-b/releases/" + "a".repeat(64) + "/player.html")).toBe("listing-b");
      expect(resolveCommunitySaveScope("/play/encoded%20listing/player.html")).toBe("encoded listing");
      expect(resolveCommunitySaveScope("/renamed-standalone.html")).toBeUndefined();
      expect(resolveCommunitySaveScope("/other/renamed-standalone.html")).toBeUndefined();
    });
    it("accepts the .oprn extension and the package mime types", () => {
      expect(isOprnGameFile(fileStub("my-game.oprn"))).toBe(true);
      expect(isOprnGameFile(fileStub("MY-GAME.OPRN"))).toBe(true);
      expect(isOprnGameFile(fileStub("legacy.rpgzzu"))).toBe(true);
      expect(isOprnGameFile(fileStub("game", "application/vnd.openrpg.project+zip"))).toBe(true);
      expect(isOprnGameFile(fileStub("notes.txt"))).toBe(false);
      expect(isOprnGameFile(fileStub("project.json", "application/json"))).toBe(false);
      expect(OPRN_GAME_FILE_ACCEPT).toContain(".oprn");
    });

    it("picks the first game file out of a mixed drop", () => {
      const dropped = [
        { name: "readme.txt", type: "text/plain" },
        { name: "hero.oprn", type: "" },
        { name: "spare.oprn", type: "" },
      ] as unknown as File[];

      expect(pickOprnGameFile(dropped)?.name).toBe("hero.oprn");
      expect(pickOprnGameFile([{ name: "readme.txt", type: "text/plain" }] as unknown as File[])).toBeNull();
    });

    it("reads a project back out of a single exported .oprn file", async () => {
      // Given
      const project = createBlankProject();
      project.meta.title = "단일 파일 게임";
      const blob = createProjectPackage(project);

      // When
      const read = await readOprnGameFile(blob);

      // Then
      expect(projectPackageFileName(project)).toBe("단일-파일-게임.oprn");
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.project.meta.title).toBe("단일 파일 게임");
      expect(Object.keys(read.project.maps)).toEqual(Object.keys(project.maps));
      expect(read.project.startMapId).toBe(project.startMapId);
    });

    it("reports a readable reason instead of throwing when the file is not a package", async () => {
      // Given
      const notAPackage = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);

      // When
      const read = await readOprnGameFile(notAPackage);

      // Then
      expect(read.ok).toBe(false);
      if (read.ok) return;
      expect(read.message.length).toBeGreaterThan(0);
    });

    it("namespaces an opened file by its own identity instead of the host identity", () => {
      const project = createBlankProject();
      project.meta.title = "가져온 게임";
      project.meta.author = "파일 저자";

      expect(resolveExportSaveNamespace(project, {
        source: "opened-file",
        hostSaveNamespace: "host-injected-save-slots",
        pathname: "/play/host-community-game",
      })).toBe(`oprn-export:${exportedProjectId(project)}`);
    });

    it("preserves the bundled player's host, community, then project namespace precedence", () => {
      const project = createBlankProject();
      project.meta.title = "번들 게임";

      expect(resolveExportSaveNamespace(project, {
        source: "bundled",
        hostSaveNamespace: "host-injected-save-slots",
        pathname: "/play/community-game",
      })).toBe("host-injected-save-slots");
      expect(resolveExportSaveNamespace(project, {
        source: "bundled",
        pathname: "/play/community%20game",
      })).toBe("oprn-export:community game");
      expect(resolveExportSaveNamespace(project, {
        source: "bundled",
        pathname: "/player.html",
      })).toBe(`oprn-export:${exportedProjectId(project)}`);
    });
  });
});

describe("feature16BattleUiReports", () => {
  isolateTimers();
  function completedBattle() {
    const project = deserialize(JSON.stringify(fixture));
    project.database.enemies.forEach(enemy => { enemy.stats.maxHp = 1; enemy.stats.agility = 1; });
    const session = startSession(project, 12);
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: false, canLose: true, rng: () => 0.5 });
    for (let i = 0; i < 300 && !runtime.snapshot().result; i++) {
      runtime.tick(1000);
      const state = runtime.snapshot();
      if (state.phase === "actorCommand") {
        const enemy = state.enemies.find(e => !e.defeated);
        if (enemy) runtime.performActorCommand({ kind: "attack", targetEnemyId: enemy.id });
      }
    }
    const snapshot = runtime.snapshot();
    expect(snapshot.result).toBe("victory");
    expect(snapshot.timeline.some(line => line.kind === "damage")).toBe(true);
    appendBattleReport(session, project, snapshot, snapshot.result!);
    return { project, session, snapshot };
  }
  function slot(payload: unknown) {
    const storage = { getItem: (key: string) => key === saveSlotKey(1) ? JSON.stringify(payload) : null } as Storage;
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") throw new Error("save rejected");
    return read.snapshot;
  }
  describe("feature16 actual battle reports and save compatibility", () => {
    it("retains runtime facts after completion and makes every line keyboard navigable", () => {
      const { project, session, snapshot } = completedBattle();
      const report = session.battleReports![0]!;
      expect(report.lines.map(l => l.sequence)).toEqual(snapshot.timeline.map(l => l.sequence).slice(-BATTLE_REPORT_LINE_LIMIT));
      expect(report.lines.some(l => l.text.includes("피해"))).toBe(true);
      let selected: number | undefined;
      const options = { project, session, selectedCommand: "battle-reports" as const, slots: [], waitModeEnabled: true, onSelectBattleReport: (index: number | undefined) => { selected = index; } };
      battleReportDetail(options).entries[0]!.onActivate!();
      expect(selected).toBe(0);
      const detail = battleReportDetail({ ...options, battleReportIndex: selected });
      expect(detail.entries.filter(e => e.testId?.includes("-line-")).every(e => !!e.onActivate)).toBe(true);
      detail.entries[0]!.onActivate!();
      expect(selected).toBeUndefined();
    });
    it("round-trips rows, party order and reports through serialized slot parsing and restore", () => {
      const { project, session } = completedBattle();
      session.partyActorIds.reverse();
      session.actorRows[session.partyActorIds[0]!] = "back";
      const snapshot = slot(createSaveSnapshot(project, session));
      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.battleReports).toEqual(session.battleReports);
      expect(restored.actorRows).toEqual(session.actorRows);
      expect(restored.partyActorIds).toEqual(session.partyActorIds);
      restored.battleReports![0]!.lines[0]!.text = "changed";
      expect(snapshot.session.battleReports![0]!.lines[0]!.text).not.toBe("changed");
    });
    it("loads older saves with front rows and empty history; discards malformed optional history", () => {
      const { project, session } = completedBattle();
      const old = JSON.parse(JSON.stringify(createSaveSnapshot(project, session)));
      delete old.session.actorRows;
      delete old.session.battleReports;
      const restored = applySaveSnapshot(project, slot(old));
      expect(restored.battleReports).toEqual([]);
      expect(Object.values(restored.actorRows).every(row => row === "front")).toBe(true);
      old.session.battleReports = [{ result: "invented", lines: "bad" }];
      expect(applySaveSnapshot(project, slot(old)).battleReports).toEqual([]);
    });
    it("bounds history and drops animations/unknown payloads rather than copying battle graphs", () => {
      const { project, session, snapshot } = completedBattle();
      for (let i = 0; i < BATTLE_REPORT_LIMIT + 5; i++) appendBattleReport(session, project, snapshot, "victory");
      expect(session.battleReports).toHaveLength(BATTLE_REPORT_LIMIT);
      const raw = { ...session.battleReports![0], lines: Array.from({ length: 200 }, (_, sequence) => ({ sequence, text: "x".repeat(600), animation: { huge: true } })) };
      const bounded = normalizeBattleReports([raw])[0]!;
      expect(bounded.lines).toHaveLength(BATTLE_REPORT_LINE_LIMIT);
      expect(bounded.omittedLines).toBe(80);
      expect(bounded.lines[0]).toEqual({ sequence: 80, text: "x".repeat(500) });
    });
    it.each(["defeat", "escape"] as const)("does not claim victory rewards on %s", result => {
      const { project, session, snapshot } = completedBattle();
      appendBattleReport(session, project, snapshot, result);
      expect(session.battleReports!.at(-1)).toMatchObject({ result, exp: 0, gold: 0, items: [] });
    });
  });
});

describe("feature16BattleUiFormation", () => {
  isolateTimers();
  const setup = () => deserialize(JSON.stringify(fixture));
  describe("feature16 physical formation", () => {
    it("reduces outgoing/incoming physical damage with legacy fronts and magic unchanged", () => {
      expect(formationDamage(100, "back", "front", "attack", "damage")).toBe(75);
      expect(formationDamage(100, "front", "back", "attack", "damage")).toBe(75);
      expect(formationDamage(100, "back", "back", "attack", "damage")).toBe(56);
      expect(formationDamage(100, undefined, undefined, "attack", "damage")).toBe(100);
      expect(formationDamage(100, "back", "back", "mind", "damage")).toBe(100);
      expect(formationDamage(100, "back", "back", "attack", "healing")).toBe(100);
      expect(formationDamage(-10, "back", "back", "attack", "damage")).toBe(-10);
      expect(formationDamage(0, "back", "back", "attack", "damage")).toBe(0);
      expect(formationDamage(1, "back", "back", "attack", "damage")).toBe(1);
    });
    it("retains raw stats and row through equipment refresh and snapshot", () => {
      const project = setup();
      const front = actorBattlers(project)[0]!;
      const back = actorBattlers(project, { rows: { [front.recordId]: "back" } })[0]!;
      expect(back.attackPower).toBe(front.attackPower);
      expect(back.defense).toBe(front.defense);
      refreshActorBattlerDerivedStats(project, back, {});
      expect(back.row).toBe("back");
      expect(battlerSnapshot(back).row).toBe("back");
      expect(back.defense).toBe(front.defense);
    });
    // Parent combat integration: runtime forwards party.rows; shared damage and prediction apply formationDamage once.
    it("wires saved rows into runtime, damage and prediction without affecting mind skills", () => {
      const project = setup();
      const session = startSession(project);
      const id = session.partyActorIds[0]!;
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: false, canLose: true,
        party: { levels: session.actorLevels, experience: {}, rows: { [id]: "back" } } });
      expect(runtime.snapshot().actors.find(a => a.recordId === id)?.row).toBe("back");
      const front = actorBattlers(project)[0]!;
      const back = actorBattlers(project, { rows: { [id]: "back" } })[0]!;
      for (const statistic of ["attack", "mind"] as const) {
        const spec = { power: 100, statistic, effect: "damage" as const, hitRate: 100, variance: 0, criticalRate: 0, rng: () => 0.5 };
        const target = structuredClone(front);
        const base = applySkillLike(structuredClone(front), target, spec).amount;
        const actual = applySkillLike(structuredClone(back), structuredClone(front), spec).amount;
        expect(actual).toBe(statistic === "attack" ? Math.max(1, Math.floor(base * 0.75)) : base);
        const incoming = applySkillLike(structuredClone(front), structuredClone(back), spec).amount;
        expect(incoming).toBe(statistic === "attack" ? Math.max(1, Math.floor(base * 0.75)) : base);
        const prediction = predictSkillDamage(project, battlerSnapshot(back), spec, battlerSnapshot(front));
        expect(prediction.amount).toBe(actual);
      }
    });
    it("offers active/reserve ordering and row actions via real detail callbacks", () => {
      const project = setup();
      project.system.activeSlots = 1;
      project.database.actors.push({ ...structuredClone(project.database.actors[0]!), id: "feature16_reserve", name: "대기 동료" });
      const session = startSession(project);
      session.partyActorIds = [session.partyActorIds[0]!, "feature16_reserve"];
      let picked = "";
      let toggled = "";
      let move: unknown;
      const options = { project, session, slots: [], waitModeEnabled: true, selectedCommand: "formation" as const,
        onSelectFormationActor: (id: string) => { picked = id; }, onToggleRow: (id: string) => { toggled = id; },
        onMoveFormationActor: (id: string, index: number) => { move = [id, index]; } };
      const list = formationDetail(options);
      expect(list.entries[0]!.value).toContain("참전");
      list.entries[0]!.onActivate!();
      expect(picked).toBe(session.partyActorIds[0]);
      const selected = formationDetail({ ...options, formationActorId: picked });
      selected.entries.find(e => e.testId === "status-menu-formation-toggle-row")!.onActivate!();
      expect(toggled).toBe(picked);
      expect(selected.entries[1]!.value).toContain("대기");
      selected.entries[1]!.onActivate!();
      expect(move).toEqual([picked, 1]);
    });
  });
});

describe("playerItemUse", () => {
  isolateTimers();
  describe("player menu item use", () => {
    // Break caught: 메뉴 경로가 stateEffects 의 remove 만 읽어서, 상태를 "부여"하는 아이템은
    // 필드에서 항상 "효과가 없습니다" 였다(전투에서만 작동).
    it("applies a guaranteed add-op state effect from the menu and consumes the item", () => {
      const { project, session, itemId, actorId, stateId } = stateInflictFixture(100);

      const result = useItemFromMenu(project, session, itemId, actorId);

      expect(result.kind).toBe("used");
      expect(session.actorStateIds?.[actorId]).toContain(stateId);
      expect(session.inventory[itemId]).toBeUndefined();
    });

    it("refuses an add-op state item when the target already carries the state", () => {
      const { project, session, itemId, actorId, stateId } = stateInflictFixture(100);
      session.actorStateIds = { [actorId]: [stateId] };

      const result = useItemFromMenu(project, session, itemId, actorId);

      expect(result.kind).toBe("unusable");
      expect(session.actorStateIds[actorId]).toEqual([stateId]);
      expect(session.inventory[itemId]).toBe(1);
    });

    // Break caught: 부여 판정을 Math.random 으로 굴리면 같은 시드의 세이브가 다른 결과를 낳는다
    // (저장소 계약: src/player·src/battle 는 세션 시드 스트림만 쓴다).
    it("replays the same partial-chance inflict outcome for the same session seed", () => {
      const outcomeFor = (seed: number): readonly string[] => {
        const { project, session, itemId, actorId } = stateInflictFixture(50, seed);
        const results: string[] = [];
        for (let attempt = 0; attempt < 6; attempt += 1) {
          session.inventory[itemId] = 1;
          session.actorStateIds = { [actorId]: [] };
          results.push(useItemFromMenu(project, session, itemId, actorId).kind);
        }
        return results;
      };

      expect(outcomeFor(20260904)).toEqual(outcomeFor(20260904));
      // 부분 확률이므로 시드가 다르면 시퀀스도 갈라져야 한다(상수 반환 방지).
      expect(outcomeFor(20260904)).not.toEqual(outcomeFor(11111));
    });

    it("keeps a zero-chance add-op state item unused instead of burning a copy", () => {
      const { project, session, itemId, actorId, stateId } = stateInflictFixture(0);

      const result = useItemFromMenu(project, session, itemId, actorId);

      expect(result.kind).toBe("unusable");
      expect(session.actorStateIds?.[actorId] ?? []).not.toContain(stateId);
      expect(session.inventory[itemId]).toBe(1);
    });

    it("does not advance the battle RNG for guaranteed, impossible, existing or missing states", () => {
      for (const condition of ["guaranteed", "impossible", "existing", "missing"] as const) {
        const { project, session, itemId, actorId, stateId } = stateInflictFixture(condition === "impossible" ? 0 : condition === "guaranteed" ? 100 : 50, 42);
        if (condition === "existing") session.actorStateIds = { [actorId]: [stateId] };
        if (condition === "missing") project.database.states = project.database.states.filter((state) => state.id !== stateId);
        const beforeRng = structuredClone(session.rng);

        const result = useItemFromMenu(project, session, itemId, actorId);

        expect(session.rng).toEqual(beforeRng);
        expect(result.kind).toBe(condition === "guaranteed" ? "used" : "unusable");
        if (condition === "missing") expect(session.actorStateIds?.[actorId] ?? []).not.toContain(stateId);
      }
    });

    it("applies a party state item to each eligible actor and spends one charge for the whole use", () => {
      const { project, session, itemId, actorId, stateId } = stateInflictFixture(100);
      const secondActorId = project.database.actors.find((actor) => actor.id !== actorId)!.id;
      session.partyActorIds.push(secondActorId);
      session.actorVitals[secondActorId] = { ...session.actorVitals[actorId]! };
      const item = project.database.items.find((item) => item.id === itemId)!;
      item.scope = "allAllies";
      item.consumptionLimit = 3;

      expect(useItemFromMenu(project, session, itemId).kind).toBe("used");
      expect(session.actorStateIds?.[actorId]).toEqual([stateId]);
      expect(session.actorStateIds?.[secondActorId]).toEqual([stateId]);
      expect(session.inventory[itemId]).toBe(1);
      // FIFO cursor counts successful uses of the current copy, not remaining charges.
      expect(session.itemUseCharges?.[itemId]).toBe(1);
    });

    it("does not consume a recovery item on a full-HP target", () => {
      const { project, session, itemId, actorId } = itemUseFixture();
      const beforeHp = session.actorVitals[actorId]!.hp;

      const result = useItemFromMenu(project, session, itemId, actorId);

      expect(result.kind).toBe("unusable");
      expect(session.actorVitals[actorId]!.hp).toBe(beforeHp);
      expect(session.inventory[itemId]).toBe(1);
    });

    it("does not let a normal recovery item revive a dead actor", () => {
      const { project, session, itemId, actorId } = itemUseFixture();
      session.actorVitals[actorId]!.hp = 0;

      const result = useItemFromMenu(project, session, itemId, actorId);

      expect(result.kind).toBe("unusable");
      expect(session.actorVitals[actorId]!.hp).toBe(0);
      expect(session.inventory[itemId]).toBe(1);
    });

    it("applies all-ally recovery to every eligible actor and consumes once", () => {
      const { project, session, itemId, actorId } = itemUseFixture();
      const secondActorId = project.database.actors[1]!.id;
      session.partyActorIds = [actorId, secondActorId];
      session.actorVitals[actorId]!.hp = 10;
      session.actorVitals[secondActorId] = { hp: 80, mp: 10, maxHp: 80, maxMp: 10 };
      session.actorVitals[secondActorId]!.hp = session.actorVitals[secondActorId]!.maxHp;
      const item = project.database.items.find((record) => record.id === itemId)!;
      item.scope = "allAllies";

      const result = useItemFromMenu(project, session, itemId);

      expect(result.kind).toBe("used");
      expect(session.actorVitals[actorId]!.hp).toBe(40);
      expect(session.actorVitals[secondActorId]!.hp).toBe(session.actorVitals[secondActorId]!.maxHp);
      expect(session.inventory[itemId]).toBeUndefined();
    });

    it("removes cured states from the menu and refuses battle-only items", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      session.actorVitals[actorId] = { hp: 50, mp: 10, maxHp: 100, maxMp: 20 };
      session.actorStateIds = { [actorId]: ["state_poison"] };
      session.inventory = { item_antidote: 1, item_poison_dart: 1 };

      expect(useItemFromMenu(project, session, "item_antidote", actorId).kind).toBe("used");
      expect(session.actorStateIds[actorId]).toEqual([]);
      expect(useItemFromMenu(project, session, "item_poison_dart", actorId).kind).toBe("unusable");
    });
  });
  function stateInflictFixture(chance: number, seed?: number) {
    const project = createBlankProject();
    const session = startSession(project, seed);
    const state = project.database.states[0];
    const item = project.database.items.find((record) => record.id === "item_potion") ?? project.database.items[0];
    if (!state || !item) throw new Error("missing fixture");
    item.name = "테스트 강화제";
    item.scope = "ally";
    item.occasion = "field";
    item.occasionField = true;
    item.consumable = true;
    item.consumptionLimit = "noLimit";
    item.hpRecovery = { percentMax: 0, flat: 0 };
    item.mpRecovery = { percentMax: 0, flat: 0 };
    item.healStateIds = [];
    item.stateEffects = [{ stateId: state.id, chance, operation: "add" }];
    session.inventory = { [item.id]: 1 };
    const actorId = session.partyActorIds[0] ?? project.database.actors[0]?.id;
    if (!actorId) throw new Error("missing actor fixture");
    session.partyActorIds = [actorId];
    session.actorVitals[actorId] = { hp: 40, mp: 10, maxHp: 40, maxMp: 10 };
    return { project, session, itemId: item.id, actorId, stateId: state.id };
  }
  function itemUseFixture() {
    const project = createBlankProject();
    const session = startSession(project);
    const item = project.database.items.find((record) => record.id === "item_potion") ?? project.database.items[0];
    if (!item) throw new Error("missing item fixture");
    item.name = "테스트 회복약";
    item.scope = "ally";
    item.occasion = "field";
    item.consumable = true;
    item.hpRecovery = { percentMax: 0, flat: 30 };
    item.mpRecovery = { percentMax: 0, flat: 0 };
    session.inventory = { [item.id]: 1 };
    const actorId = session.partyActorIds[0] ?? project.database.actors[0]?.id;
    if (!actorId) throw new Error("missing actor fixture");
    session.partyActorIds = [actorId];
    return { project, session, itemId: item.id, actorId };
  }
});
