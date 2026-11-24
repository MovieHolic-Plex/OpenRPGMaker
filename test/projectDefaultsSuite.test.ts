// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi, beforeAll } from "vitest";
import { drawMapTileLayers } from "@/editor/mapTileDraw";
import { DEFAULT_TRUNK_BACKING_TILE } from "@/editor/tileLayerPolicy";
import { setTileBackingOverride } from "@/editor/runtimeTileMetadata";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import type { GameMap, TilesetDef } from "@/project/types";
import { battleField } from "@/player/battleFieldDom";
import { createBattleRuntime } from "@/battle/runtime";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { giveMonster } from "@/project/monsterCollection";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { beginExistingEventDraft, discardEventDraft } from "@/editor/eventDraftActions";
import { applyProjectWithHistory, getMapEditHistoryDepth, getMapEditHistoryEntries, getMapEditHistoryMarker, getMapEditHistoryRevision, getMapEditRedoEntries, peekPreviousProject, recordProjectSnapshot, redoMapEdit, redoToHistoryIndex, resetMapEditHistory, revertToHistoryIndex, revertToHistoryMarker, undoMapEdit } from "@/editor/mapEditHistory";
import { commitSmallTask, smallTaskBase } from "@/editor/smallTask/history";
import { mapTarget } from "@/editor/smallTask/target";
import { HISTORY_TOOLS } from "@/editor/tools/historyTools";
import { createBlankProject } from "@/project/defaults/blankProject";
import { committedEventView } from "@/project/eventDrafts";
import { jsonEqual } from "@/util/structuralJson";
import { isolateTimers } from "./mergedTeardown";

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
