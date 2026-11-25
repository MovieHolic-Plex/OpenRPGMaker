// @vitest-environment happy-dom

import { describe, expect, it, beforeAll, beforeEach, vi, afterEach } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeSystemRecords, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { ENEMY_MOTION_RECORD_IDS, ENEMY_STILL_MOTION_DEFAULT, framedArt, normalizeEnemyStillMotion, resolveEnemyStillMotion, stageOwnsFilters, stillMotionLevel } from "@/project/enemyStillMotion";
import { enemyDeath, enemyHit, enemyIdle } from "@/player/battleEnemyStillMotion";
import { beginExistingEventDraft, discardEventDraft } from "@/editor/eventDraftActions";
import { applyProjectWithHistory, getMapEditHistoryDepth, getMapEditHistoryEntries, getMapEditHistoryMarker, getMapEditHistoryRevision, getMapEditRedoEntries, peekPreviousProject, recordProjectSnapshot, redoMapEdit, redoToHistoryIndex, resetMapEditHistory, revertToHistoryIndex, revertToHistoryMarker, undoMapEdit } from "@/editor/mapEditHistory";
import { commitSmallTask, smallTaskBase } from "@/editor/smallTask/history";
import { mapTarget } from "@/editor/smallTask/target";
import { HISTORY_TOOLS } from "@/editor/tools/historyTools";
import { committedEventView } from "@/project/eventDrafts";
import { store } from "@/project/store";
import { jsonEqual } from "@/util/structuralJson";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene, destroyBattleSceneOnHost } from "@/player/battleDom";
import { BATTLE_INTRO_MS } from "@/player/battleSequencer";
import { sendOutDirectorState } from "@/player/battleDirectorDom";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { type MonsterInstance, startSession } from "@/project/session";
import type { Project, GameMap, TilesetDef } from "@/project/types";
import { battleField } from "@/player/battleFieldDom";
import { giveMonster } from "@/project/monsterCollection";
import { drawMapTileLayers } from "@/editor/mapTileDraw";
import { DEFAULT_TRUNK_BACKING_TILE } from "@/editor/tileLayerPolicy";
import { setTileBackingOverride } from "@/editor/runtimeTileMetadata";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import assert from "node:assert/strict";
import { playBattle } from "@/player/playSceneBattle";
import { createDialogueUI } from "@/player/dialogue";
import { ACTOR, TROOP, battleCase, choice, m2, mark } from "./battleEventRepairFlow.fixture";
import { playOpenChest } from "@/player/playSceneChest";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { deserialize, serialize } from "@/project/io";
import { playInn } from "@/player/playSceneCommerce";
import { updatePlayerPreferences } from "@/player/playerPreferences";
import { DEFAULT_ACTOR_ID, DEFAULT_STATE_ID } from "@/project/defaults/constants";
import { isolateTimers } from "./mergedTeardown";

describe("enemyStillMotion", () => {
  isolateTimers();
  describe("enemyStillMotion", () => {
    isolateTimers();
    function node(markup: string, extra: (element: HTMLElement) => void = () => {}): HTMLElement {
      const host = document.createElement("div");
      host.innerHTML = markup;
      const root = host.firstElementChild as HTMLElement;
      extra(root);
      return root;
    }
    function imageOf(root: HTMLElement): HTMLElement | null {
      return root.querySelector<HTMLElement>(".battle-enemy-image");
    }
    const STILL = `<button class="battle-enemy" data-record-id="enemy_fs_wolf"><img class="battle-enemy-image"></button>`;
    describe("적 그림 움직임 설정", () => {
      it("기본은 all 이고, 바꾸는 프로젝트만 값을 남긴다", () => {
        expect(ENEMY_STILL_MOTION_DEFAULT).toBe("all");
        expect(normalizeEnemyStillMotion("stillOnly")).toBe("stillOnly");
        expect(normalizeEnemyStillMotion("off")).toBe("off");
        expect(normalizeEnemyStillMotion(true)).toBeUndefined();
        const base = { startActorIds: ["actor_hero"] };
        expect(normalizeSystemRecords(base).enemyStillMotion).toBeUndefined();
        expect(normalizeSystemRecords({ ...base, enemyStillMotion: "all" }).enemyStillMotion).toBeUndefined();
        expect(normalizeSystemRecords({ ...base, enemyStillMotion: "stillOnly" }).enemyStillMotion).toBe("stillOnly");
        expect(normalizeSystemRecords({ ...base, enemyStillMotion: "off" }).enemyStillMotion).toBe("off");
        expect(resolveEnemyStillMotion({ system: {} })).toBe("all");
        expect(resolveEnemyStillMotion({ system: { enemyStillMotion: "off" } })).toBe("off");
      });

      it("조수 도구가 모드를 바꾸고 기본값으로 되돌린다", () => {
        const ctx = { project: createBlankProject() };
        expect(runTool(ctx, "set_project_settings", { battle: { enemyStillMotion: "stillOnly" } }).ok).toBe(true);
        expect(ctx.project.system.enemyStillMotion).toBe("stillOnly");
        expect(runTool(ctx, "set_project_settings", { battle: { enemyStillMotion: "off" } }).ok).toBe(true);
        expect(ctx.project.system.enemyStillMotion).toBe("off");
        expect(runTool(ctx, "set_project_settings", { battle: { enemyStillMotion: "all" } }).ok).toBe(true);
        expect("enemyStillMotion" in ctx.project.system).toBe(false);
        expect(runTool(ctx, "set_project_settings", { battle: { enemyStillMotion: true } }).ok).toBe(false);
      });
    });
    describe("엔진 연출 단계", () => {
      it("칸이 없는 정지 그림은 full, 칸 있는 그림은 all 에서 translate", () => {
        const still = node(STILL);
        expect(framedArt(still, imageOf(still))).toBe(false);
        expect(stillMotionLevel(still, imageOf(still), "all")).toBe("full");

        for (const attr of ["data-pixel-enemy", "data-pixel-party", "data-charset-enemy"]) {
          const framed = node(STILL, (element) => { element.setAttribute(attr, "dash"); });
          expect(framedArt(framed, imageOf(framed)), attr).toBe(true);
          expect(stillMotionLevel(framed, imageOf(framed), "all"), attr).toBe("translate");
        }

        const extended = node(STILL, (element) => { element.dataset.battlerExtended = "true"; });
        expect(stillMotionLevel(extended, imageOf(extended), "all")).toBe("translate");

        const strip = node(STILL, (element) => {
          element.querySelector<HTMLElement>(".battle-enemy-image")!.dataset.battlerAnim = "generated-enemy-slime-01";
        });
        expect(stillMotionLevel(strip, imageOf(strip), "all")).toBe("translate");
      });

      it("stillOnly 는 칸 있는 그림을 그대로 두고, off 는 아무 데도 걸지 않는다", () => {
        const still = node(STILL);
        expect(stillMotionLevel(still, imageOf(still), "stillOnly")).toBe("full");
        const sheet = node(STILL, (element) => { element.dataset.pixelEnemy = "dash"; });
        expect(stillMotionLevel(sheet, imageOf(sheet), "stillOnly")).toBe("off");
        expect(stillMotionLevel(sheet, imageOf(sheet), "all")).toBe("translate");
        expect(stillMotionLevel(still, imageOf(still), "off")).toBe("off");
        expect(stillMotionLevel(still, null, "all")).toBe("off");
      });

      it("허용 목록(오너 선택 A: 숲늑대·엄니멧돼지) 밖의 적은 어떤 모드에서도 움직이지 않는다", () => {
        expect([...ENEMY_MOTION_RECORD_IDS].sort()).toEqual(["enemy_fs_boar", "enemy_fs_wolf"]);
        const boar = node(STILL, (element) => { element.dataset.recordId = "enemy_fs_boar"; element.dataset.pixelEnemy = "dash"; });
        expect(stillMotionLevel(boar, imageOf(boar), "all")).toBe("translate");
        for (const recordId of ["enemy_fs_spider", ""]) {
          const other = node(STILL, (element) => { element.dataset.recordId = recordId; element.dataset.pixelEnemy = "dash"; });
          for (const mode of ["all", "stillOnly", "off"] as const) expect(stillMotionLevel(other, imageOf(other), mode), `${recordId}/${mode}`).toBe("off");
        }
        const unlisted = node(`<button class="battle-enemy"><img class="battle-enemy-image"></button>`);
        expect(stillMotionLevel(unlisted, imageOf(unlisted), "all")).toBe("off");
      });

      it("보스 무대·보스 입장은 filter·scale 을 스스로 쓴다", () => {
        const scene = (step: string, bigBoss: boolean) => {
          const host = document.createElement("div");
          host.innerHTML = `<div class="battle-scene" data-battle-director-step="${step}" ${bigBoss ? 'data-battle-big-boss="true"' : ""}><button class="battle-enemy"><img class="battle-enemy-image"></button></div>`;
          return host.querySelector<HTMLElement>(".battle-enemy")!;
        };
        expect(stageOwnsFilters(scene("intro", false))).toBe(true);
        expect(stageOwnsFilters(scene("action", false))).toBe(false);
        expect(stageOwnsFilters(scene("action", true))).toBe(true);
        const sink = node(`<button class="battle-enemy" data-collapse="bossSink"><img class="battle-enemy-image"></button>`);
        expect(stageOwnsFilters(sink)).toBe(true);
      });

      it("WAAPI 가 없는 환경에서는 조용히 건너뛴다", () => {
        const still = node(STILL);
        Object.defineProperty(imageOf(still)!, "animate", { value: undefined });
        const opts = { level: "full" as const, staged: false };
        expect(() => { enemyHit(still, opts); enemyDeath(still, opts); enemyIdle(still, opts); }).not.toThrow();
        expect(imageOf(still)!.hasAttribute("data-enemy-anim")).toBe(false);
      });
    });
  });
  describe("smallTaskHistory", () => {
    isolateTimers();
    let projectTemplate: ReturnType<typeof createBlankProject>;
    beforeAll(() => {
      const p = createBlankProject();
      const map = p.maps[p.startMapId];
      // The asset catalog is independent of undo ownership. Keep this fixture cheap to deep-compare.
      p.tilesets = { [map.tilesetId]: { ...p.tilesets[map.tilesetId], referenceDocuments: [] } };
      p.assets = { sprites: {}, uploaded: {} };
      p.resourceProfiles = [];
      map.events = [{ id: "ev_1", name: "상인", x: 2, y: 3, commands: [], trigger: { kind: "action" } }];
      projectTemplate = p;
    });
    beforeEach(() => {
      store.replaceProject(structuredClone(projectTemplate));
      resetMapEditHistory();
    });
    function task(eventId = "ev_1", name = "약초상") {
      const live = store.getCurrent();
      const target = mapTarget(live, live.startMapId, eventId)!;
      const before = smallTaskBase(live, target);
      const after = structuredClone(before);
      const event = after.maps[after.startMapId].events.find(e => e.id === eventId)!;
      event.name = name;
      event.commands.push({ kind: "text", body: "어서 오세요." });
      return { live, after, receipt: commitSmallTask(live, before, after, target)! };
    }
    it("한 작업의 모든 변경을 기록 하나로 복구하고 다시 실행한다", async () => {
      const { live, after, receipt } = task();
      expect(getMapEditHistoryDepth()).toBe(1);
      const draft = structuredClone(after);
      HISTORY_TOOLS.find(t => t.name === "revert_last_edit")!.run(draft, {});
      expect(jsonEqual(draft, live)).toBe(true);
      const confirm = vi.fn();
      expect(await receipt.undo(confirm)).toBe(true);
      expect(confirm).not.toHaveBeenCalled();
      expect(jsonEqual(store.getCurrent(), live)).toBe(true);
      expect(redoMapEdit()).toBe(true);
      expect(jsonEqual(store.getCurrent(), after)).toBe(true);
    });
    it("손편집이 뒤에 있으면 묻고, Ctrl+Z 순서와 오래된 카드의 소유권을 지킨다", async () => {
      const { live, after, receipt } = task();
      const hand = { ...after, meta: { ...after.meta, title: "직접 편집" } };
      applyProjectWithHistory(hand, "손편집");
      expect(await receipt.undo(async () => false)).toBe(false);
      expect(getMapEditHistoryDepth()).toBe(2);
      expect(undoMapEdit()).toBe(true);
      expect(jsonEqual(store.getCurrent(), after)).toBe(true);
      expect(await receipt.undo(async () => false)).toBe(true);
      expect(jsonEqual(store.getCurrent(), live)).toBe(true);
      applyProjectWithHistory(hand, "새 손편집");
      expect(await receipt.undo(async () => true)).toBe(false);
    });
    it("뒤의 손편집을 함께 되돌리기로 확인하면 그 전후를 한 번에 복원한다", async () => {
      const { live, after, receipt } = task();
      const hand = { ...after, meta: { ...after.meta, title: "직접 편집" } };
      expect(applyProjectWithHistory(hand, "손편집")).toBe(true);
      const confirm = vi.fn(async () => true);
      expect(await receipt.undo(confirm)).toBe(true);
      expect(confirm).toHaveBeenCalledOnce();
      expect(jsonEqual(store.getCurrent(), live)).toBe(true);
      expect(getMapEditHistoryDepth()).toBe(0);
      expect(redoMapEdit()).toBe(true);
      expect(jsonEqual(store.getCurrent(), hand)).toBe(true);
    });
    it("작업 중 다른 편집이 들어오면 사본을 덮어쓰지 않는다", () => {
      const live = store.getCurrent(), target = mapTarget(live, live.startMapId)!;
      store.update(p => { p.meta.title = "나중 편집"; });
      expect(() => commitSmallTask(live, live, live, target)).toThrow("프로젝트가 바뀌었어요");
      expect(getMapEditHistoryDepth()).toBe(0);
    });
    it.each([true, false])("열린 이벤트의 기존 초안과 적용 기준을 복원한다 (손편집 %s)", async dirty => {
      const mapId = store.getCurrent().startMapId;
      store.updateEvent(mapId, "ev_1", event => {
        event.draft = { kind: "edit", original: structuredClone(event) };
        if (dirty) event.name = "작성 중";
      });
      const { live, receipt } = task();
      const current = () => store.getCurrent().maps[mapId].events[0];
      expect(current().name).toBe("약초상");
      expect(current().draft?.original?.name).toBe(dirty ? "상인" : "약초상");
      expect(await receipt.undo(async () => false)).toBe(true);
      expect(jsonEqual(live, store.getCurrent())).toBe(true);
      expect(redoMapEdit()).toBe(true);
      expect(current().name).toBe("약초상");
    });
    it("이벤트 창을 닫은 뒤 되돌려도 닫힌 초안을 다시 열지 않는다", () => {
      const mapId = store.getCurrent().startMapId;
      store.updateEvent(mapId, "ev_1", event => {
        event.draft = { kind: "edit", original: structuredClone(event) };
      });
      task();
      expect(discardEventDraft(mapId, "ev_1")).toBe(true);
      const current = () => store.getCurrent().maps[mapId].events[0];
      expect(undoMapEdit()).toBe(true);
      expect(current().name).toBe("상인");
      expect(current().draft).toBeUndefined();
      expect(redoMapEdit()).toBe(true);
      expect(current().name).toBe("약초상");
      expect(current().draft).toBeUndefined();
    });
    it.each([
      ["undoMapEdit", false, () => undoMapEdit()],
      ["revertToHistoryMarker", false, (marker: number) => revertToHistoryMarker(marker)],
      ["revertToHistoryIndex", false, () => revertToHistoryIndex(0)],
      ["redoMapEdit", true, () => redoMapEdit()],
      ["redoToHistoryIndex", true, () => redoToHistoryIndex(0)],
    ] as const)("%s: 다시 연 창의 작업 뒤 손편집을 보호한다", (_name, redo, restore) => {
      const mapId = store.getCurrent().startMapId;
      beginExistingEventDraft(mapId, "ev_1");
      const marker = getMapEditHistoryMarker();
      task();
      if (redo) expect(undoMapEdit()).toBe(true);
      expect(discardEventDraft(mapId, "ev_1")).toBe(true);
      expect(beginExistingEventDraft(mapId, "ev_1")).toBe(true);
      store.updateEvent(mapId, "ev_1", event => { event.commands.push({ kind: "text", body: "다시 열어서 직접 작성" }); });
      const live = store.getCurrent();
      const undoEntries = getMapEditHistoryEntries(), redoEntries = getMapEditRedoEntries();
      const revision = getMapEditHistoryRevision();
      expect(restore(marker)).toBe(false);
      expect(store.getCurrent()).toBe(live);
      expect(getMapEditHistoryEntries()).toEqual(undoEntries);
      expect(getMapEditRedoEntries()).toEqual(redoEntries);
      expect(getMapEditHistoryRevision()).toBe(revision);
    });
    it.each([false, true])("두 초안을 각 작업의 전후 본문으로 복원한다 (개별 되돌리기 %s)", individually => {
      const mapId = store.getCurrent().startMapId;
      store.updateMap(mapId, map => { map.events.push({ ...structuredClone(map.events[0]), id: "ev_2", name: "경비" }); });
      for (const [id, body] of [["ev_1", "상인의 손편집"], ["ev_2", "경비의 손편집"]]) {
        beginExistingEventDraft(mapId, id);
        store.updateEvent(mapId, id, event => { event.commands.push({ kind: "text", body }); });
      }
      const before = store.getCurrent().maps[mapId].events;
      task("ev_1", "약초상");
      task("ev_2", "성문 경비");
      const after = store.getCurrent().maps[mapId].events;
      if (individually) {
        expect(undoMapEdit()).toBe(true);
        expect(undoMapEdit()).toBe(true);
      } else {
        expect(revertToHistoryIndex(0)).toBe(true);
      }
      expect(store.getCurrent().maps[mapId].events).toEqual(before);
      expect(redoToHistoryIndex(0)).toBe(true);
      expect(store.getCurrent().maps[mapId].events).toEqual(after);
    });
    it.each([false, true])("맵 기록까지 되돌릴 때만 그 이전 초안을 복원한다 (맵 기록 포함 %s)", includeMap => {
      const mapId = store.getCurrent().startMapId;
      const read = () => store.getCurrent().maps[mapId].events[0];
      beginExistingEventDraft(mapId, "ev_1");
      const d0 = read();
      recordProjectSnapshot("초안이 든 맵 기록", mapId, { kind: "map", includeEventDrafts: true });
      store.updateEvent(mapId, "ev_1", event => { event.name = "D1 직접 편집"; });
      const d1 = read();
      task();
      const d2 = read();
      expect(revertToHistoryIndex(includeMap ? 0 : 1)).toBe(true);
      expect(read()).toEqual(includeMap ? d0 : d1);
      expect(redoMapEdit()).toBe(true);
      expect(read()).toEqual(d2);
    });
    it.each([false, true])("작업을 적용한 뒤 연 초안을 되돌릴 때 직접 편집을 구별한다 (손편집 %s)", async dirty => {
      const mapId = store.getCurrent().startMapId;
      const read = () => store.getCurrent().maps[mapId].events[0];
      const original = read();
      const { receipt } = task();
      const edited = read();
      beginExistingEventDraft(mapId, "ev_1");
      if (dirty) store.updateEvent(mapId, "ev_1", event => { event.name = "직접 편집"; });
      const confirm = vi.fn(async () => false);
      expect(await receipt.undo(confirm)).toBe(true);
      expect(confirm).not.toHaveBeenCalled();
      expect(committedEventView(read())).toEqual(original);
      expect(read().name).toBe(dirty ? "직접 편집" : original.name);
      expect(read().draft?.conflict?.kind).toBe(dirty ? "remote-change" : undefined);
      if (!dirty) {
        expect(redoMapEdit()).toBe(true);
        expect(committedEventView(read())).toEqual(edited);
        expect(read().name).toBe(edited.name);
        expect(read().draft?.conflict).toBeUndefined();
      }
    });
    it.each([
      [["ev_removed", "ev_1", "ev_new", "ev_last"], ["ev_1", "ev_new", "ev_last"]],
      [["ev_removed", "ev_new", "ev_1", "ev_last"], ["ev_new", "ev_1", "ev_last"]],
    ])("앞선 초안이 빠진 스냅샷에서도 새 초안의 위치를 보존한다 (%j)", (order, expected) => {
      const mapId = store.getCurrent().startMapId;
      store.updateMap(mapId, map => {
        map.events = order.map(id => ({ ...structuredClone(map.events[0]), id,
          ...(id === "ev_removed" || id === "ev_new" ? { draft: { kind: "new" } as const } : {}),
        }));
      });
      task("ev_new");
      expect(peekPreviousProject()?.maps[mapId].events.map(event => event.id)).toEqual(expected);
    });
  });
});

describe("gen1IntroTypeBadge", () => {
  isolateTimers();
  // Gen1 UI 계약 2건.
  //  (1) 파티 몬스터 전투 인트로는 "야생의 X가 나타났다!" 다음에 "가라, Y!" 를 한 비트 더 준다.
  //      트레이너(종족 없는 아군)만 있는 전투에서는 그 비트가 없다.
  //  (2) 기술 서브메뉴 버튼에 타입 배지가 붙는다 — elementId 가 있는 기술에만.
  describe("gen1IntroTypeBadge", () => {
    isolateTimers();
    const EMBER = "skill_scarloxy_ember";
    const SCRATCH = "skill_scarloxy_scratch";
    const UNTYPED = "skill_gen1_ui_untyped";
    const MONSTER_NAME = "스파르츄";
    function starterMonster(project: Project): MonsterInstance {
      return {
        instanceId: "mon_gen1_ui_1",
        speciesId: scarloxySpeciesId("sparchu"),
        level: 5,
        exp: 0,
        skillIds: [EMBER, SCRATCH, UNTYPED],
        friendship: 70,
        caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
      };
    }
    function mount(options: { monsterParty: boolean; introHold: boolean }) {
      const project = createScarloxyPokemonDemoProject();
      project.database.skills.push(normalizeSkillRecord({ id: UNTYPED, name: "Untyped Move", maxPp: 10 }));
      store.replace(project);
      const host = document.createElement("div");
      document.body.append(host);
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_pkmn_grass_a",
        canEscape: true,
        canLose: true,
        ...(options.monsterParty ? { partyMonsters: [starterMonster(project)] } : {}),
        rng: () => 0.5,
      });
      const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: options.introHold });
      return { controller, runtime, project };
    }
    function message(root: ParentNode): string {
      return (root.querySelector(".battle-message-window")?.textContent ?? "").replace(/\s+/g, " ").trim();
    }
    describe("Gen1 인트로 — 내보내기 비트", () => {
      it("몬스터 파티는 '나타났다' 다음 비트에서 '가라, X!' 를 말한다", () => {
        vi.useFakeTimers();
        const { controller, runtime } = mount({ monsterParty: true, introHold: true });
        try {
          // 첫 비트: 야생 등장.
          expect(message(controller.root)).toContain("나타났다!");
          expect(message(controller.root)).not.toContain("가라");

          // 둘째 비트: 내보내기. 파티 선두 몬스터 이름을 부른다.
          // 메시지 창 textContent 에는 커서 글리프(>)가 함께 잡히므로 문장으로 대조한다.
          vi.advanceTimersByTime(BATTLE_INTRO_MS);
          expect(message(controller.root)).toContain(`가라, ${MONSTER_NAME}!`);
          expect(message(controller.root)).not.toContain("나타났다");

          // 셋째 비트: 커맨드 입력으로 넘어가고 시퀀스 점유가 풀린다.
          vi.advanceTimersByTime(BATTLE_INTRO_MS);
          expect(message(controller.root)).not.toContain("가라");
          expect(runtime.snapshot().phase).toBe("actorCommand");
          expect(controller.root.querySelector("[data-testid='actor-command-fight']")).toBeTruthy();
        } finally {
          controller.destroy();
          vi.useRealTimers();
        }
      });

      it("트레이너(종족 없는 아군)만 있는 전투에는 내보내기 비트가 없다", () => {
        vi.useFakeTimers();
        const { controller, runtime } = mount({ monsterParty: false, introHold: false });
        try {
          const snapshot = runtime.snapshot();
          expect(snapshot.actors.length).toBeGreaterThan(0);
          expect(snapshot.actors.some((actor) => actor.monsterInstanceId)).toBe(false);
          expect(sendOutDirectorState(snapshot)).toBeUndefined();
        } finally {
          controller.destroy();
          vi.useRealTimers();
        }
      });
    });
    describe("기술 타입 배지", () => {
      it("elementId 가 있는 기술에만 타입 배지가 붙는다", () => {
        vi.useFakeTimers();
        const { controller, runtime } = mount({ monsterParty: true, introHold: false });
        try {
          for (let i = 0; i < 200 && runtime.snapshot().phase !== "actorCommand"; i += 1) runtime.tick(1000);
          vi.advanceTimersByTime(300);
          controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-fight']")?.click();

          // 불씨 뿜기(elementId: "fire") → 완성 Gen1 타입 정의의 표시 이름.
          const ember = controller.root.querySelector<HTMLElement>(`[data-testid='actor-skill-${EMBER}']`);
          expect(ember, "불씨 뿜기 항목이 서브메뉴에 없다").toBeTruthy();
          const badge = ember!.querySelector<HTMLElement>(".battle-command-tag");
          expect(badge?.textContent).toBe("불꽃");
          expect(badge?.dataset.skillType).toBe("fire");
          // 기술명(strong) 뒤, 상세(small) 앞에 놓여야 배지로 읽힌다.
          expect(badge?.previousElementSibling?.tagName.toLowerCase()).toBe("strong");

          // 완성 Gen1 데이터에서 할퀴기는 Normal 타입이다.
          const scratch = controller.root.querySelector<HTMLElement>(`[data-testid='actor-skill-${SCRATCH}']`);
          expect(scratch, "할퀴기 항목이 서브메뉴에 없다").toBeTruthy();
          const scratchBadge = scratch!.querySelector<HTMLElement>(".battle-command-tag");
          expect(scratchBadge?.textContent).toBe("노말");
          expect(scratchBadge?.dataset.skillType).toBe("normal");

          // elementId가 없는 테스트 전용 기술에는 배지를 지어내지 않는다.
          const untyped = controller.root.querySelector<HTMLElement>(`[data-testid='actor-skill-${UNTYPED}']`);
          expect(untyped, "무속성 기술 항목이 서브메뉴에 없다").toBeTruthy();
          expect(untyped!.querySelector(".battle-command-tag")).toBeNull();
        } finally {
          controller.destroy();
          vi.useRealTimers();
        }
      });
    });
  });
  describe("monsterBattlerField", () => {
    isolateTimers();
    describe("파티 몬스터 전투 필드 렌더", () => {
      it("아군 필드에 파티 몬스터가 back 스프라이트로 그려진다", () => {
        const project = createScarloxyPokemonDemoProject();
        store.replace(project); // battleField가 store.getCurrent()로 종족 그래픽을 조회한다.
        const session = startSession(project, 7);
        giveMonster(project, session, { speciesId: scarloxySpeciesId("sparchu"), level: 5, nickname: "스파르츄" });
        const partyMonsters = session.monsterParty.map((id) => session.monsterInstances[id]!);

        const runtime = createBattleRuntime({
          project,
          troopId: "troop_pkmn_grass_a",
          canEscape: true,
          canLose: false,
          partyMonsters,
          sessionState: { switches: {}, variables: {}, inventory: {} },
          rng: () => 0,
        });
        const field = battleField(runtime.snapshot());

        // 아군 노드가 몬스터 배틀러로 표시되고, 종족 그래픽이 back 클래스로 렌더된다.
        const actorNode = field.querySelector<HTMLElement>('.battle-actor-group .battle-actor[data-monster-battler="true"]');
        expect(actorNode).toBeTruthy();
        const monsterImg = field.querySelector<HTMLImageElement>(".battle-actor-group .battle-monster-back");
        expect(monsterImg).toBeTruthy();
        expect(monsterImg?.getAttribute("src")).toContain("scarloxy-monster-sparchu");

        // 상대는 야생 몬스터가 그대로(정면).
        const enemyImg = field.querySelector<HTMLImageElement>(".battle-enemy-group .battle-enemy-image");
        expect(enemyImg?.getAttribute("src")).toContain("scarloxy-monster-larvea");
      });

      it("종족 그래픽이 없어도 배우용 스킨 스프라이트로 위장하지 않는다", () => {
        const project = createScarloxyPokemonDemoProject();
        const species = project.database.monsterSpecies?.find((record) => record.id === scarloxySpeciesId("sparchu"));
        if (!species) throw new Error("missing sparchu");
        species.graphic.monsterResourceId = "";
        store.replace(project);
        const session = startSession(project, 7);
        giveMonster(project, session, { speciesId: species.id, level: 5 });
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_pkmn_grass_a",
          canEscape: true,
          canLose: false,
          partyMonsters: session.monsterParty.map((id) => session.monsterInstances[id]!),
          rng: () => 0,
        });

        const actorNode = battleField(runtime.snapshot()).querySelector<HTMLElement>(".battle-actor-group .battle-actor");
        expect(actorNode?.dataset.monsterBattler).toBe("true");
        expect(actorNode?.querySelector(".battle-skin-actor-image")).toBeNull();
        expect(actorNode?.querySelector(".battle-monster-back")).toBeNull();
      });
    });
  });
});

describe("mapTileBacking", () => {
  isolateTimers();
  // 캔버스 공유 렌더러가 **투명 칩의 받침**을 깔아야 한다.
  //
  // 왜 테스트가 필요한가(2026-09-12 실측): 나무 밑동(290~293)은 하위에 앉고 칩에 투명
  // 픽셀이 있어, 받침 없이 그리면 그 자리가 검게 뚫린다. 편집기 캔버스(Phaser)와 런타임은
  // `tileBackingTile` 로 잔디를 깔았지만, 이 캔버스 렌더러만 빠져 있었다 — 맵 썸네일·
  // 스크린샷·미니맵·구운 마을 전경에 검은 사각형이 남았다(마을 40×40 에서 6,641픽셀).
  // 정책 함수 단위 테스트(`tileLayerPolicy.test.ts`)는 정책만 보고 렌더를 안 보므로
  // 이 결함을 못 잡는다.

  const CONIFER_TRUNK = 290;
  const CONIFER_CANOPY = 260;
  const GRASS = 240;
  type Draw = { readonly tile: number; readonly x: number; readonly y: number };
  let draws: Draw[];
  beforeEach(() => {
    draws = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      const context = {
        imageSmoothingEnabled: true,
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
        putImageData: vi.fn(),
        // 소스 x = (tile % 30) * 16 이므로 그 역산으로 어떤 타일을 그렸는지 되읽는다.
        drawImage: vi.fn((_image: unknown, sx: number, sy: number, sw: number) => {
          draws.push({ tile: Math.floor(sy / 16) * 30 + Math.floor(sx / 16), x: sw, y: sy });
        }),
      };
      void this;
      return context as unknown as CanvasRenderingContext2D;
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });
  function mapWith(lower: number[], upper: number[]): GameMap {
    return {
      id: "map_backing",
      name: "backing",
      width: 2,
      height: 1,
      tileSize: 16,
      tilesetId: "easyrpg_chipset_combined_town",
      lowerTiles: lower,
      upperTiles: upper,
      events: [],
    } as unknown as GameMap;
  }
  /** 그려진 타일 id 목록(그린 순서). */
  function drawnTiles(): number[] {
    return draws.map((draw) => draw.tile);
  }
  describe("공유 캔버스 렌더러 — 투명 칩 받침", () => {
    const tileset = defaultTileset() as TilesetDef;

    it("나무 밑동(하위)을 그릴 때 잔디 받침을 먼저 깐다", () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawMapTileLayers(context, document.createElement("canvas"), mapWith([CONIFER_TRUNK, GRASS], [-1, -1]), tileset, 1);

      const tiles = drawnTiles();
      // 밑동 칸: 받침(잔디) → 밑동 순서. 받침이 없으면 검은 사각형이 남는다.
      expect(tiles[0]).toBe(DEFAULT_TRUNK_BACKING_TILE);
      expect(tiles[1]).toBe(CONIFER_TRUNK);
      // 잔디 칸은 받침이 필요 없다 — 한 번만 그린다.
      expect(tiles.filter((tile) => tile === GRASS).length).toBe(2);
    });

    it("상위 레이어는 받침을 깔지 않는다 — 아래 지면이 이미 있다", () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawMapTileLayers(context, document.createElement("canvas"), mapWith([GRASS, GRASS], [-1, CONIFER_CANOPY]), tileset, 1);
      // 하위 잔디 2칸 + 상위 수관 1칸 = 3. 수관에 받침이 붙으면 4가 된다.
      expect(drawnTiles().length).toBe(3);
    });

    it("받침을 끄면(사용자 확정) 깔지 않는다", () => {
      const custom = defaultTileset() as TilesetDef;
      // 실제 편집기 경로와 같은 API 로 끈다 — 손으로 메타를 쓰면 `tileMetaOrigin` 이
      // user 가 아니어서 정책이 무시하고, 테스트가 제품과 다른 길을 걷는다.
      setTileBackingOverride(custom, CONIFER_TRUNK, "none");
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawMapTileLayers(context, document.createElement("canvas"), mapWith([CONIFER_TRUNK, GRASS], [-1, -1]), custom, 1);
      // 밑동 칸은 받침 없이 밑동만 — 첫 draw 가 밑동이어야 한다.
      expect(drawnTiles()[0]).toBe(CONIFER_TRUNK);
    });
  });
});

describe("playScene", () => {
  isolateTimers();
  describe("playSceneBattleCancellation", () => {
    isolateTimers();
    const previousProject = store.getCurrent();
    const hosts: HTMLElement[] = [];
    const aborters: AbortController[] = [];
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
      for (const controller of aborters.splice(0)) controller.abort();
      for (const host of hosts.splice(0)) { destroyBattleSceneOnHost(host); host.remove(); }
      vi.clearAllTimers(); vi.useRealTimers(); store.replaceProject(previousProject);
    });
    function setup(flow: "gauge" | "strict" = "strict") {
      const { project } = battleCase({ flow, commands: [choice({ options: [
        { text: "First", branch: [mark("first"), m2("m2-107-force-escape")] },
        { text: "Second", branch: [mark("second"), m2("m2-107-force-escape")] },
      ] })] });
      project.system.startActorIds = [ACTOR]; project.session.partyActorIds = [ACTOR];
      store.replaceProject(project);
      const host = document.createElement("div"); document.body.append(host); hosts.push(host);
      const dialogue = createDialogueUI(host);
      const session = startSession(project);
      const battleAbortController = new AbortController(); aborters.push(battleAbortController);
      const scene = { session, tileY: 0, map: { height: 20 }, battleAbortController,
        // An authored gameOver/killPlayer in the troop hands off to the host's game-over screen.
        showGameOverScreen: vi.fn(),
        game: { registry: { get: (key: string) => key === "dialogueHost" ? host : key === "dialogue" ? dialogue : undefined } },
      };
      const step = { kind: "battleProcessing", troopId: TROOP, canEscape: false, canLose: true, battleFlow: flow } as const;
      return { project, host, scene, session, battleAbortController, step };
    }
    function key(value: string) {
      (document.activeElement ?? document).dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }));
    }
    async function openChoice(host: HTMLElement) {
      await vi.advanceTimersByTimeAsync(30_000);
      const defend = host.querySelector<HTMLElement>("[data-testid='actor-command-defend']");
      assert.ok(defend); defend.focus(); key("Enter");
      await vi.advanceTimersByTimeAsync(30_000);
      expect(host.querySelector("[data-testid='runtime-choices']")).not.toBeNull();
    }
    describe("playBattle cancellation boundary", () => {
      it("abort during entry settles without mounting or writing a result", async () => {
        const { scene, step, host, session, battleAbortController } = setup();
        const before = structuredClone(session.variables);
        const pending = playBattle(scene, step, 0);
        battleAbortController.abort();
        await vi.advanceTimersByTimeAsync(30_000);
        expect(host.querySelector("[data-testid='battle-scene']")).toBeNull();
        expect(await pending).toBeNull();
        expect(session.variables).toEqual(before);
        expect(host.querySelector("[data-testid='battle-transition-overlay']")).toBeNull();
      });

      it.each(["gauge", "strict"] as const)("%s uses real keyboard input and writes back only the chosen branch", async flow => {
        const { scene, step, host, session } = setup(flow);
        const pending = playBattle(scene, step, 0);
        await openChoice(host);
        expect(session.variables.second).toBeUndefined();
        key("ArrowDown"); key("z");
        await vi.advanceTimersByTimeAsync(30_000);
        // 전투 이벤트의 「전투 중단」(m2-107-force-escape)이 끝낸 전투는 「후퇴」 결과 상자 없이 바로 필드로 돌아간다(574cd06132, endedByEvent).
        expect(host.querySelector("[data-testid='battle-result-panel']")).toBeNull();
        expect(await pending).toBe("escape");
        expect(session.variables.second).toBe(1);
        expect(session.variables.first).toBeUndefined();
        expect(session.variables.after).toBeUndefined();
      });

      it("replacing the session while choices are open abandons the old write-back and listener", async () => {
        const { project, scene, step, host, session, battleAbortController } = setup();
        const pending = playBattle(scene, step, 0);
        await openChoice(host);
        const replacement = startSession(project); replacement.variables.second = 71;
        scene.session = replacement; battleAbortController.abort();
        await vi.advanceTimersByTimeAsync(30_000);
        expect(await pending).toBeNull();
        key("ArrowDown"); key("Enter");
        expect(replacement.variables.second).toBe(71);
        expect(session.variables.second).toBeUndefined();
        expect(host.querySelector("[data-testid='runtime-choices']")).toBeNull();
      });

      it("host teardown after accepting a result cancels before reward/state write-back", async () => {
        const { scene, step, host, session } = setup();
        const pending = playBattle(scene, step, 0);
        await openChoice(host);
        key("ArrowDown"); key("Enter");
        // 전투 이벤트가 끝낸 전투는 결과 상자가 없다(574cd06132) — 결과는 마이크로태스크로 바로 호스트에 넘어간다.
        // 그 넘김을 한 번 흘려보낸 뒤(= 결과 수락) 호스트를 걷어도 보상·상태 기록 전에 취소돼야 한다.
        expect(host.querySelector("[data-testid='battle-result-panel']")).toBeNull();
        await Promise.resolve();
        destroyBattleSceneOnHost(host);
        await vi.advanceTimersByTimeAsync(30_000);
        expect(await pending).toBeNull();
        expect(session.variables.second).toBeUndefined();
        expect(host.querySelector("[data-testid='battle-transition-overlay']")).toBeNull();
      });
    });
  });
  // 보관 상자 창: 제목으로 이름 붙인 대화상자, 수량 칸은 보이는 「수량」 라벨에 묶인다.
  describe("playSceneChestA11y", () => {
    isolateTimers();
    function sceneFixture(): PlaySceneContext {
      store.replace(deserialize(serialize(createBlankProject())));
      const project = store.getCurrent();
      const host = document.createElement("div");
      document.body.append(host);
      return {
        session: startSession(project, 1),
        map: project.maps[project.startMapId],
        tileX: 0,
        tileY: 0,
        game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : undefined) } },
        syncRuntimeState() {},
        refreshRuntimeSurfaces() {},
      } as unknown as PlaySceneContext;
    }
    afterEach(() => {
      document.body.replaceChildren();
    });
    describe("storage chest dialog accessibility", () => {
      it("names the open chest and associates the quantity field with 수량", async () => {
        const scene = sceneFixture();
        const pending = playOpenChest(scene, { template: "warehouse", chestId: "box", displayName: "공동 창고" });
        const dialog = document.querySelector<HTMLElement>("[data-testid='chest-scene']");
        expect(dialog?.getAttribute("role")).toBe("dialog");
        expect(dialog?.getAttribute("aria-modal")).toBe("true");
        const titleId = dialog?.getAttribute("aria-labelledby");
        expect(titleId).toBeTruthy();
        expect(document.getElementById(titleId!)?.textContent).toBe("공동 창고");

        const qty = document.querySelector<HTMLInputElement>("[data-testid='chest-qty']");
        expect(qty?.id).toBeTruthy();
        expect(document.querySelector("label.runtime-chest-qty-label")?.getAttribute("for")).toBe(qty?.id);
        expect(document.querySelector("[data-testid='chest-search']")?.getAttribute("aria-label")).toBe("검색");
        expect(document.querySelector("[data-testid='chest-status']")?.getAttribute("role")).toBe("status");
        expect(document.querySelector("[data-testid='chest-tab-all']")?.getAttribute("aria-pressed")).toBe("true");
        expect(document.querySelector("[data-testid='chest-tab-medicine']")?.getAttribute("aria-pressed")).toBe("false");
        expect(document.querySelector("[data-testid='chest-qty-1']")?.getAttribute("aria-label")).toBe("수량 1");
        expect(document.querySelector("[data-testid='chest-qty-10']")?.getAttribute("aria-label")).toBe("수량 10");
        expect(document.querySelector("[data-testid='chest-qty-all']")?.getAttribute("aria-label")).toBe("수량 전부");

        document.querySelector<HTMLButtonElement>("[data-testid='chest-close']")?.click();
        await pending;
        expect(document.querySelector("[data-testid='chest-scene']")).toBeNull();
      });

      it("names a locked chest with the same dialog contract", async () => {
        const scene = sceneFixture();
        const pending = playOpenChest(scene, { chestId: "sealed", displayName: "잠긴 궤", lockSwitchId: "sw_missing" });
        const dialog = document.querySelector<HTMLElement>("[data-testid='chest-locked']");
        expect(dialog?.getAttribute("role")).toBe("dialog");
        expect(dialog?.getAttribute("aria-modal")).toBe("true");
        const titleId = dialog?.getAttribute("aria-labelledby");
        expect(document.getElementById(titleId!)?.textContent).toBe("잠긴 궤");
        expect(document.querySelector("[data-testid='chest-status']")?.getAttribute("role")).toBe("status");

        document.querySelector<HTMLButtonElement>("[data-testid='chest-close']")?.click();
        await pending;
        expect(document.querySelector("[data-testid='chest-locked']")).toBeNull();
      });
    });
  });
  // 여관 창: 제목으로 이름 붙인 대화상자, 질문·부족·휴식은 상태 영역,
  // 상태 회복 미리보기(「독 → 정상」)는 CSS 가 아니라 글자로 있다.
  describe("playSceneInnA11y", () => {
    isolateTimers();
    function sceneFixture(gold: number): { scene: PlaySceneContext; waits: Array<() => void> } {
      store.replace(deserialize(serialize(createBlankProject())));
      const project = store.getCurrent();
      const host = document.createElement("div");
      document.body.append(host);
      const session = startSession(project, 1);
      session.gold = gold;
      session.actorStateIds = { [DEFAULT_ACTOR_ID]: [DEFAULT_STATE_ID] };
      const waits: Array<() => void> = [];
      const scene = {
        session,
        map: project.maps[project.startMapId],
        tileX: 0,
        tileY: 0,
        game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : undefined) } },
        syncRuntimeState() {},
        time: {
          delayedCall(ms: number, cb: () => void) {
            void ms;
            waits.push(cb);
            return { remove() {} };
          },
        },
      } as unknown as PlaySceneContext;
      return { scene, waits };
    }
    afterEach(() => {
      document.body.replaceChildren();
      updatePlayerPreferences({ reduceMenuMotion: false });
    });
    describe("inn dialog accessibility", () => {
      it("names the inn, announces the question, and puts the cure preview in the text", async () => {
        const { scene } = sceneFixture(0);
        const pending = playInn(scene, { kind: "inn", price: 40 });
        const dialog = document.querySelector<HTMLElement>("[data-testid='inn-scene']");
        expect(dialog?.getAttribute("role")).toBe("dialog");
        expect(dialog?.getAttribute("aria-modal")).toBe("true");
        expect(dialog?.getAttribute("aria-label")).toBe("여관");

        const status = document.querySelector<HTMLElement>("[data-testid='commerce-status']");
        expect(status?.getAttribute("role")).toBe("status");
        expect(status?.textContent).toContain("40");
        expect(status?.textContent).toContain("묵으시겠습니까");

        const state = document.querySelector(`[data-testid='inn-party-row-${DEFAULT_ACTOR_ID}'] .runtime-inn-party-state`);
        expect(state?.textContent).toBe("독 → 정상");
        expect(document.querySelector(".runtime-inn-track")?.getAttribute("aria-hidden")).toBe("true");

        document.querySelector<HTMLButtonElement>("[data-testid='inn-stay']")?.click();
        expect(status?.textContent).toBe("소지금이 부족합니다.");
        expect(dialog?.getAttribute("aria-label")).toBe("여관");

        document.querySelector<HTMLButtonElement>("[data-testid='inn-cancel']")?.click();
        await pending;
        expect(document.querySelector("[data-testid='inn-scene']")).toBeNull();
      });

      it("moves from stay to cancel with the down arrow in the stacked pixel window", async () => {
        // fs2 스웜 I23: 도트 창은 예/아니오를 위아래로 쌓는다. 2열 커서여서 ↓ 가 먹지 않았고, 돈이 모자라면 「예」에 갇혔다.
        const { scene } = sceneFixture(0);
        const pending = playInn(scene, { kind: "inn", price: 40 });
        expect(document.querySelector(".runtime-inn-pixel")).not.toBeNull();
        const overlay = document.querySelector<HTMLElement>("[data-testid='inn-scene']")!;
        const press = (key: string) => overlay.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
        press("ArrowDown");
        expect(document.querySelector("[data-testid='inn-cancel']")?.getAttribute("aria-current")).toBe("true");
        press("Enter");
        await pending;
        expect(document.querySelector("[data-testid='inn-scene']")).toBeNull();
      });

      it("clears every party state on a stay, not only states whose removal text mentions rest", () => {
        // fs2 스웜 R2: 창은 「독 → 정상」을 보여 주는데 해제 문구에 「휴식」이 없는 상태는 남았다(RM2003 FullHeal 과 어긋남).
        const { scene } = sceneFixture(80);
        const project = store.getCurrent();
        project.database.states.push({ ...project.database.states[0]!, id: "state_curse", name: "저주", removalCondition: "전투 종료 시" });
        scene.session.actorStateIds = { [DEFAULT_ACTOR_ID]: [DEFAULT_STATE_ID, "state_curse"] };
        void playInn(scene, { kind: "inn", price: 10 });
        document.querySelector<HTMLButtonElement>("[data-testid='inn-stay']")?.click();
        expect(scene.session.actorStateIds?.[DEFAULT_ACTOR_ID] ?? []).toEqual([]);
      });

      it("names the rest blackout and skips the fade when menu motion is reduced", async () => {
        updatePlayerPreferences({ reduceMenuMotion: true });
        const { scene, waits } = sceneFixture(80);
        const pending = playInn(scene, { kind: "inn", price: 10, restDurationMs: 400, wakeDurationMs: 400 });
        document.querySelector<HTMLButtonElement>("[data-testid='inn-stay']")?.click();

        const fade = document.querySelector<HTMLElement>("[data-testid='inn-resting']");
        expect(fade?.getAttribute("role")).toBe("status");
        expect(fade?.getAttribute("aria-label")).toBe("휴식 중");
        expect(fade?.style.animation).toBe("none");
        expect(fade?.style.opacity).toBe("0.96");
        expect(document.querySelector("[data-testid='inn-scene']")?.getAttribute("aria-label")).toBe("여관");

        expect(waits).toHaveLength(1);
        waits.shift()?.();
        await Promise.resolve();
        const wake = document.querySelector<HTMLElement>("[data-testid='inn-wake']");
        expect(wake?.getAttribute("role")).toBe("status");
        expect(wake?.textContent).toContain("좋은 아침입니다");
        expect(document.querySelector("[data-testid='inn-scene']")?.getAttribute("aria-label")).toBe("여관");

        expect(waits).toHaveLength(1);
        waits.shift()?.();
        await pending;
        expect(document.querySelector("[data-testid='inn-scene']")).toBeNull();
      });

      it("uses the database gold, HP, and MP terms on the inn purse and gauges", async () => {
        const { scene } = sceneFixture(1250);
        store.getCurrent().meta.terms = { gold: "냥", hp: "체력", mp: "마력" };
        const actorId = scene.session.partyActorIds[0] ?? DEFAULT_ACTOR_ID;
        const vitals = scene.session.actorVitals[actorId];
        if (!vitals) throw new Error("missing party vitals");
        vitals.hp = Math.max(1, Math.floor(vitals.maxHp * 0.4));
        vitals.mp = Math.floor(vitals.maxMp * 0.25);

        const pending = playInn(scene, { kind: "inn", price: 30 });
        const dialog = document.querySelector<HTMLElement>("[data-testid='inn-scene']");
        expect(dialog?.textContent).toContain("30 냥");
        const purse = document.querySelector("[data-testid='inn-summary-gold']")?.textContent ?? "";
        expect(purse).toContain("냥");
        expect(purse).not.toContain("G");
        expect(document.querySelector("[data-testid='inn-party-hp-0']")?.textContent).toContain("체력");
        expect(document.querySelector("[data-testid='inn-party-mp-0']")?.textContent).toContain("마력");
        expect(document.querySelector("[data-testid='inn-summary-hp']")?.textContent).toContain("체력");
        expect(document.querySelector("[data-testid='inn-summary-mp']")?.textContent).toContain("마력");

        document.querySelector<HTMLButtonElement>("[data-testid='inn-cancel']")?.click();
        await pending;
      });
    });
  });
});
