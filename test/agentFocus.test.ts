// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { paintTile } from "@/editor/actions";
import { subscribeAgentFocusHighlight, type AgentFocusTarget, focusAcceptedAgentChanges } from "@/editor/agentFocus";
import { applyToolSequenceToStore } from "@/editor/tools/applyChangesetToStore";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { createBlankMap, TILE } from "@/project/defaults";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { store } from "@/project/store";
import type { GameMap, Project } from "@/project/types";
import { subscribeEditorCameraFocus, type CameraFocusTarget } from "@/editor/editorCameraFocus";
import { createAssistantViewNavigation } from "@/editor/assistantViewNavigation";
import { navigateToEditorReference } from "@/editor/editorReferenceNavigation";
import { computeOnFieldAnchors, hideOnFieldSprites, instantBattleTransition, onFieldEnemyPoint, onFieldPartyPoint, onFieldPointToAuthored } from "@/player/battleOnField";
import { runTool } from "@/editor/tools/toolRunner";
import { deserialize, serialize } from "@/project/io";
import { isolateTimers } from "./mergedTeardown";

describe("agentFocus", () => {
  isolateTimers();
  let unsubscribeHighlight: (() => void) | null = null;
  let highlights: AgentFocusTarget[] = [];
  beforeEach(() => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    highlights = [];
    unsubscribeHighlight = subscribeAgentFocusHighlight((target) => highlights.push(target));
    editorState.set({
      currentMapId: null,
      selectedEventId: null,
      selectedEventPageId: null,
      selection: null,
      layer: "lower",
      tool: "paint",
    });
  });
  afterEach(() => {
    unsubscribeHighlight?.();
    unsubscribeHighlight = null;
    vi.restoreAllMocks();
  });
  describe("accepted agent changes preserve the editor view", () => {
    it("creates a map without leaving the map the user is editing", () => {
      const project = projectWithMap(blankMap("start_map", 8, 8));
      store.replace(project);
      editorState.set({ currentMapId: "start_map" });

      const results = applyToolSequenceToStore([
        { name: "create_map", args: { id: "ai_new_map", name: "AI New Map", width: 8, height: 6 } },
      ], { source: "agent", agentName: "unit-test-agent" });

      expect(results.every((result) => result.ok)).toBe(true);
      expect(store.getCurrent().maps.ai_new_map).toBeDefined();
      expect(editorState.get().currentMapId).toBe("start_map");
      expect(highlights).toEqual([]);
    });

    it("keeps the current map selected and highlights changed paint cells", () => {
      const project = projectWithMap(blankMap("paint_map", 8, 8));
      store.replace(project);
      editorState.set({ currentMapId: "paint_map" });

      const results = applyToolSequenceToStore([
        {
          name: "paint_tiles",
          args: {
            mapId: "paint_map",
            layer: "lower",
            mode: "cells",
            tile: TILE.WATER,
            cells: [{ x: 2, y: 3 }, { x: 4, y: 3 }],
          },
        },
      ], { source: "agent", agentName: "unit-test-agent" });

      expect(results.every((result) => result.ok)).toBe(true);
      expect(editorState.get().currentMapId).toBe("paint_map");
      expect(highlights).toHaveLength(1);
      expect(highlights[0]?.bounds).toEqual({ x: 2, y: 3, width: 3, height: 1 });
      expect(highlights[0]?.cells).toEqual([
        { x: 2, y: 3, layer: "lower" },
        { x: 4, y: 3, layer: "lower" },
      ]);
    });

    it("places an NPC on another map without switching the view", () => {
      const base = blankMap("start_map", 8, 8);
      const target = blankMap("target_map", 8, 8);
      const project = projectWithMap(base);
      project.maps[target.id] = target;
      project.mapTree.children.push({ mapId: target.id, children: [] });
      store.replace(project);
      editorState.set({ currentMapId: base.id });

      const results = applyToolSequenceToStore([
        {
          name: "place_npc",
          args: {
            mapId: target.id,
            id: "npc_lina",
            x: 2,
            y: 2,
            name: "Lina",
            pages: [{ lines: ["hello"] }],
          },
        },
      ], { source: "agent", agentName: "unit-test-agent" });

      expect(results.every((result) => result.ok)).toBe(true);
      expect(store.getCurrent().maps[target.id].events.some(event => event.id === "npc_lina")).toBe(true);
      expect(editorState.get().currentMapId).toBe(base.id);
      expect(highlights).toEqual([]);
    });

    it("does not emit agent highlights for direct manual paint actions", () => {
      const project = projectWithMap(blankMap("manual_map", 8, 8));
      store.replace(project);
      editorState.set({ currentMapId: "manual_map" });

      paintTile("manual_map", "lower", 1, 1, TILE.WATER);

      expect(editorState.get().currentMapId).toBe("manual_map");
      expect(highlights).toEqual([]);
    });
  });
  function blankMap(id: string, width: number, height: number): GameMap {
    const map = createBlankMap(id, width, height);
    map.id = id;
    map.name = id;
    return map;
  }
  function projectWithMap(map: GameMap): Project {
    const project = createEmptyToolProject();
    project.maps[map.id] = map;
    project.mapTree = { mapId: map.id, children: [] };
    project.startMapId = map.id;
    project.startPos = { x: 1, y: 1 };
    return project;
  }
});

// 자동 적용은 맵·카메라를 유지한다. 사람이 미리보기 버튼을 직접 누른 경우만 이동한다.
describe("agentFocusCamera", () => {
  isolateTimers();
  let unsubscribeHighlight: (() => void) | null = null;
  let unsubscribeCamera: (() => void) | null = null;
  let highlights: AgentFocusTarget[] = [];
  let cameraRequests: CameraFocusTarget[] = [];
  beforeEach(() => {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    highlights = [];
    cameraRequests = [];
    unsubscribeHighlight = subscribeAgentFocusHighlight((target) => highlights.push(target));
    unsubscribeCamera = subscribeEditorCameraFocus((target) => cameraRequests.push(target));
    editorState.set({ currentMapId: null, selection: null, layer: "lower", tool: "paint" });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
  });
  afterEach(() => {
    unsubscribeHighlight?.();
    unsubscribeCamera?.();
    unsubscribeHighlight = null;
    unsubscribeCamera = null;
    vi.restoreAllMocks();
  });
  function projectWithMap(width: number, height: number): Project {
    const project = createEmptyToolProject();
    project.maps["m1"] = createBlankMap("m1", width, height);
    project.startMapId = "m1";
    return project;
  }
  describe("사용자가 직접 요청한 변경 위치 이동", () => {
    it("변경 bbox 중심을 화면 밖일 때만 이동하도록 요청한다", () => {
      const before = projectWithMap(40, 30);
      store.replace(before);
      const after = structuredClone(before);
      // (20,10) 한 칸만 바꾼다.
      after.maps["m1"].lowerTiles[10 * 40 + 20] = 77;

      const target = focusAcceptedAgentChanges(before, after, { follow: true });
      expect(target?.bounds).toEqual({ x: 20, y: 10, width: 1, height: 1 });
      expect(highlights).toHaveLength(1);
      expect(cameraRequests).toHaveLength(1);
      expect(cameraRequests[0]).toEqual({
        mapId: "m1",
        // bbox 의 정확한 중심(분수) — 내림하면 짝수 크기에서 반 타일(8px)이 밀린다.
        tileX: 20.5,
        tileY: 10.5,
        bounds: { x: 20, y: 10, width: 1, height: 1 },
        onlyIfOffscreen: true,
      });
    });

    it("넓은 변경은 bbox 중심으로 요청한다", () => {
      const before = projectWithMap(40, 30);
      store.replace(before);
      const after = structuredClone(before);
      for (let y = 4; y < 12; y += 1) {
        for (let x = 6; x < 16; x += 1) after.maps["m1"].lowerTiles[y * 40 + x] = 5;
      }

      focusAcceptedAgentChanges(before, after, { follow: true });
      expect(cameraRequests).toHaveLength(1);
      expect(cameraRequests[0].bounds).toEqual({ x: 6, y: 4, width: 10, height: 8 });
      expect(cameraRequests[0].tileX).toBe(11);
      expect(cameraRequests[0].tileY).toBe(8);
    });

    it("변경이 없으면 하이라이트도 카메라 요청도 없다", () => {
      const before = projectWithMap(40, 30);
      store.replace(before);
      const after = structuredClone(before);

      expect(focusAcceptedAgentChanges(before, after)).toBeNull();
      expect(highlights).toHaveLength(0);
      expect(cameraRequests).toHaveLength(0);
    });

    it("자동 적용은 같은 맵의 화면 밖 변경도 따라가지 않는다", () => {
      const before = projectWithMap(40, 30);
      store.replace(before);
      editorState.set({ currentMapId: "m1", zoom: 2 });
      const view = editorState.get();
      const after = structuredClone(before);
      after.maps.m1.lowerTiles[20 * 40 + 35] = 77;
      focusAcceptedAgentChanges(before, after);
      expect(cameraRequests).toEqual([]);
      expect(editorState.get()).toEqual(view);
      expect(highlights).toHaveLength(1);
    });

    it("새 맵을 만들거나 다른 맵을 고쳐도 현재 맵을 유지한다", () => {
      const before = projectWithMap(40, 30);
      store.replace(before);
      editorState.set({ currentMapId: "m1" });
      const after = structuredClone(before);
      after.maps.m2 = { ...createBlankMap("m2", 20, 20), id: "m2" };
      store.replace(after);
      focusAcceptedAgentChanges(before, after);
      expect(editorState.get().currentMapId).toBe("m1");
      expect(cameraRequests).toEqual([]);
      expect(highlights).toEqual([]);
    });

    it("앱이 백그라운드면 강조·이동 요청을 남기지 않는다", () => {
      vi.mocked(document.hasFocus).mockReturnValue(false);
      const before = projectWithMap(40, 30);
      store.replace(before);
      const after = structuredClone(before);
      after.maps.m1.lowerTiles[15] = 77;
      focusAcceptedAgentChanges(before, after);
      vi.mocked(document.hasFocus).mockReturnValue(true);
      expect(cameraRequests).toEqual([]);
      expect(highlights).toEqual([]);
    });
  });
});

describe("assistantViewNavigation", () => {
  isolateTimers();
  let requests: CameraFocusTarget[];
  let unsubscribe: () => void;
  const other = { mapId: "m2", x: 6, y: 9, w: 1, h: 1 };
  beforeEach(() => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    const project = createEmptyToolProject();
    for (const id of ["m1", "m2"]) project.maps[id] = { ...createBlankMap(id, 40, 30), id };
    project.startMapId = "m1";
    store.replace(project);
    editorState.set({ currentMapId: "m1", selection: null });
    requests = [];
    unsubscribe = subscribeEditorCameraFocus(target => requests.push(target));
  });
  afterEach(() => { unsubscribe(); vi.restoreAllMocks(); });
  describe("request-local assistant navigation", () => {
    it("blocks unsolicited focus and interview highlights, including other maps", () => {
      const navigate = createAssistantViewNavigation(() => false);
      navigate("focus_editor_view", other);
      navigate("highlight_map_region", other);
      navigate("highlight_map_region", { ...other, mapId: "m1" });
      expect(editorState.get().currentMapId).toBe("m1");
      expect(editorState.get().selection).toBeNull();
      expect(requests).toEqual([]);
    });

    it("locates the requested place once without enabling subsequent automatic moves", () => {
      const navigate = createAssistantViewNavigation(() => true);
      expect(navigate("focus_editor_view", other)).toBe(true);
      expect(editorState.get().currentMapId).toBe("m2");
      navigate("focus_editor_view", { ...other, mapId: "m1" });
      expect(editorState.get().currentMapId).toBe("m2");
      expect(requests).toHaveLength(1);
    });

    it("drops a background location request and does not replay it on focus", () => {
      const navigate = createAssistantViewNavigation(() => true);
      vi.mocked(document.hasFocus).mockReturnValue(false);
      navigate("focus_editor_view", other);
      vi.mocked(document.hasFocus).mockReturnValue(true);
      navigate("focus_editor_view", other);
      expect(editorState.get().currentMapId).toBe("m1");
      expect(requests).toEqual([]);
    });

    it("does not allow a parallel map run or a cancelled run to navigate", () => {
      createAssistantViewNavigation(() => true, { background: true })("focus_editor_view", other);
      createAssistantViewNavigation(() => true, { signal: AbortSignal.abort() })("focus_editor_view", other);
      expect(requests).toEqual([]);
    });

    it("rejects malformed tool data before consuming location guidance", () => {
      const navigate = createAssistantViewNavigation(() => true);
      expect(navigate("focus_editor_view", { ...other, x: NaN })).toBe(false);
      expect(navigate("focus_editor_view", other)).toBe(true);
      expect(requests).toHaveLength(1);
    });

    it("keeps direct answer-link navigation available after a blocked AI call", () => {
      createAssistantViewNavigation(() => false)("focus_editor_view", other);
      expect(navigateToEditorReference({ kind: "map", mapId: "m2" })).toBe(true);
      expect(editorState.get().currentMapId).toBe("m2");
    });
  });
});

describe("battleOnField", () => {
  isolateTimers();
  function sprite(x: number, y: number, alpha = 1) {
    return { x, y, alpha, active: true, setAlpha(value: number) { this.alpha = value; return this; } };
  }
  function rectOf(left: number, top: number, width: number, height: number): () => DOMRect {
    return () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
  }
  const camera = { main: { worldView: { x: 100, y: 50, width: 320, height: 240 } } };
  describe("battleOnField", () => {
    it("anchors the enemy on the owner symbol and the party on the field sprites (canvas fractions)", () => {
      const player = sprite(260, 170);
      const follower = sprite(260, 186);
      const bat = sprite(260, 122);
      const canvas = document.createElement("canvas");
      const anchors = computeOnFieldAnchors(
        { player, followerSprites: new Map([["f", follower]]), eventSprites: new Map([["ev_bat", bat]]), cameras: camera, facing: "up" },
        canvas, "ev_bat", 16,
      )!;
      expect(anchors.enemy).toEqual({ fx: 0.5, fy: 72 / 240 });
      expect(anchors.party).toEqual([{ fx: 0.5, fy: 0.5 }, { fx: 0.5, fy: 136 / 240 }]);
      expect(anchors.tileFx).toBe(16 / 320);
      // 적 여럿은 심볼을 중심으로 한 칸 간격, 모자란 아군 자리는 주인공 옆으로.
      expect(onFieldEnemyPoint(anchors, 0, 2).fx).toBeCloseTo(0.5 - 8 / 320);
      expect(onFieldEnemyPoint(anchors, 1, 2).fx).toBeCloseTo(0.5 + 8 / 320);
      // 모자란 자리는 주인공 등 뒤 대형으로 엇갈려 선다(#2624): 3번은 두 줄 뒤(0.8칸×2) 오른쪽(0.6칸).
      const third = onFieldPartyPoint(anchors, 3);
      expect(third.fx).toBeCloseTo(0.5 + 0.6 * 16 / 320);
      expect(third.fy).toBeCloseTo(0.5 + 2 * 0.8 * 16 / 240);
    });

    it("falls back to three tiles in front of the hero when no symbol sprite exists", () => {
      const anchors = computeOnFieldAnchors({ player: sprite(260, 170), cameras: camera, facing: "left" }, document.createElement("canvas"), undefined, 16)!;
      expect(anchors.enemy).toEqual({ fx: (260 - 48 - 100) / 320, fy: 0.5 });
    });

    it("maps canvas fractions into the battler group's 320x160 authored space regardless of stage scale", () => {
      const canvas = document.createElement("canvas");
      canvas.getBoundingClientRect = rectOf(32, 24, 960, 720);
      const group = document.createElement("div");
      group.getBoundingClientRect = rectOf(32, 72, 960, 480);
      expect(onFieldPointToAuthored({ fx: 0.5, fy: 0.5 }, canvas, group)).toEqual({ x: 160, y: ((24 + 360 - 72) / 480) * 160 });
      group.getBoundingClientRect = rectOf(0, 0, 0, 0);
      expect(onFieldPointToAuthored({ fx: 0.5, fy: 0.5 }, canvas, group)).toBeUndefined();
    });

    it("hides hero, followers and the symbol during battle and restores the original alpha once", () => {
      const player = sprite(0, 0, 1);
      const follower = sprite(0, 0, 0.8);
      const bat = sprite(0, 0, 1);
      const other = sprite(0, 0, 1);
      const restore = hideOnFieldSprites({ player, followerSprites: new Map([["f", follower]]), eventSprites: new Map([["ev_bat", bat], ["ev_other", other]]) }, "ev_bat");
      expect([player.alpha, follower.alpha, bat.alpha, other.alpha]).toEqual([0, 0, 0, 1]);
      bat.active = false; // 이긴 뒤 지워진 심볼은 되살리지 않는다
      restore();
      restore();
      expect([player.alpha, follower.alpha, bat.alpha]).toEqual([1, 0.8, 0]);
    });

    it("uses an instant transition", async () => {
      const transition = instantBattleTransition();
      await expect(Promise.all([transition.cover(), transition.reveal(), transition.exit()])).resolves.toBeDefined();
    });

    it("set_project_settings battle.presentation toggles system.battlePresentation and survives serialize", () => {
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "set_project_settings", { battle: { presentation: "onField" } }).ok).toBe(true);
      expect(deserialize(serialize(ctx.project)).system.battlePresentation).toBe("onField");
      expect(runTool(ctx, "set_project_settings", { battle: { presentation: "default" } }).ok).toBe(true);
      expect(ctx.project.system.battlePresentation).toBeUndefined();
    });
  });
});
