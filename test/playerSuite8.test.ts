import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { drawLightingMask, lightingGradientParams, lightingMaskSignature } from "@/player/lighting";
import { createInterpreter } from "@/player/interpreter";
import { resolveShowAnimationTargetTile } from "@/player/playSceneMapAnimations";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { createBlankProject, DEFAULT_EASYRPG_CHARSET_ID, createBlankMap } from "@/project/defaults";
import type { Command, GameMap, MapBgmSetting, MapTreeNode, EventAnimationType, EventPage, Project, GameEvent } from "@/project/types";
import * as playerAudio from "@/player/audio";
import { mapAncestorIds, resolveMapBgm, applyMapBgmToSession, startMapBgm, FALLBACK_BGM_RESOURCE_ID } from "@/player/mapBgm";
import { acceptsMinimapToggle, minimapToggleKeyHandler, syncMinimapPosition, syncMinimapVisibility, type MinimapRuntimeState, type MinimapToggleKeyEvent } from "@/player/minimap";
import { FakeElement, installFakeDom, findByTestId, renderWithFakeDom } from "./fakeDom";
import { integerArtBox } from "@/player/monsterArtScale";
import { monsterExpPlan } from "@/battle/rewardPolicy";
import { emeraldNoEscapeLine } from "@/player/emeraldBattleNarration";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { facingForStep, resolveDiagonalStep, resolveMovementIntent, type Dir } from "@/player/input";
import { charsetIdleFrameIndex } from "@/player/charsetMotion";
import { handleAction } from "@/player/playSceneMovement";
import { renderTiles } from "@/player/playSceneMapRuntime";
import { runtimeMoverSnapshots } from "@/player/runtimeMoverSnapshots";
import type { AutonomousMover, PlaySceneContext } from "@/player/playSceneTypes";
import { mockSprite, movementScene, renderSceneWith, type MockSprite, pageWith } from "./runtimeEventPageFixtures";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { nextChaseDecision } from "@/player/chaseAi";
import * as collision from "@/project/collision";
import { store } from "@/project/store";
import { event, fixture, ticks, pos } from "./fixtures/npcChasePathfinding";
import { canNpcMove, isPlayerOccupyingTile } from "@/player/playSceneAutonomousMapActions";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { startSession } from "@/project/session";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { getTileset } from "@/project/collision";
import { objectiveArrowAim, objectiveRoute, routeField, routeLeg } from "@/player/objectiveRoute";
import { transitionToNextDay } from "@/player/dayTransition";
import { p2LifeProject } from "./fixtures/p2LifeSystems";
import { isolateTimers } from "./mergedTeardown";
import { autosaveCardModel, autosaveTriggerLabel, formatSavedAt, renderPlayerLoadPanel, saveSlotCardModel } from "@/player/playerLoadPanel";
import { createSaveSnapshot, saveSlotKey, saveToSlot, writeAutosave, type SaveSlotReadResult, type SaveSnapshot } from "@/player/saveSlots";
import { menuItemUnavailableReason, previewMenuItemTarget, useItemFromMenu } from "@/player/playerItemUse";
import { startPlayerRoute, yieldPlayerRouteToEvents } from "@/player/playerRouteState";
import { timerConditionPages, updateRuntimeTimers } from "@/player/playSceneTimers";
import { calculatePlaySurfaceCropMetrics, calculatePlaySurfacePlacement, calculatePlaySurfaceScale } from "@/player/playSurfaceScale";
import { qaCheckpointStartEventId, sessionFromQaCheckpoint, type QaCheckpoint } from "@/player/qaCheckpoint";
import { executeInstantCommand } from "@/player/playSceneAutonomousCommands";
import { keptEventOpacity, type EventOpacityOverrides } from "@/player/eventOpacityOverrides";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";

describe("playerSuite8", () => {
  isolateTimers();
  describe("lightingDarkMargin", () => {
    isolateTimers();
    type Rect = { x: number; y: number; w: number; h: number };
    function recordingCanvas(): { canvas: HTMLCanvasElement; fills: Rect[] } {
      const fills: Rect[] = [];
      const context = {
        globalCompositeOperation: "source-over", globalAlpha: 1, fillStyle: "",
        save() {}, restore() {}, clearRect() {}, beginPath() {}, rect() {}, clip() {}, translate() {}, scale() {},
        fillRect(x: number, y: number, w: number, h: number) { fills.push({ x, y, w, h }); },
        createRadialGradient() { return { addColorStop() {} }; },
        arc() {}, fill() {}, moveTo() {}, lineTo() {}, closePath() {},
      };
      const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
      return { canvas, fills };
    }
    const base = {
      viewportWidth: 320, viewportHeight: 240, tileSize: 16, cameraX: 0, cameraY: 0, zoom: 1, timeMs: 0,
      resolveAnchor: () => null,
      // 맵이 화면 가운데 160px 만 차지한다(양옆 80px 은 맵 밖 여백).
      mapBounds: { x: 80, y: 0, width: 160, height: 240 },
    };
    describe("darkness mask over a drawn map margin (fs-vqa-fix-all, sky tower seam)", () => {
      const lighting = { ambient: 0.5, color: "#0c1424", sources: [] };

      it("keeps the darkness inside the map when the margin is plain", () => {
        const params = lightingGradientParams(lighting, base);
        const { canvas, fills } = recordingCanvas();
        drawLightingMask(canvas, params);
        expect(fills[0]).toEqual({ x: 80, y: 0, w: 160, h: 240 });
      });

      it("darkens the whole screen when the map background is drawn in empty cells", () => {
        const params = lightingGradientParams(lighting, { ...base, darkMargin: true });
        const { canvas, fills } = recordingCanvas();
        drawLightingMask(canvas, params);
        expect(fills[0]).toEqual({ x: 0, y: 0, w: 320, h: 240 });
        expect(lightingMaskSignature(params)).not.toBe(lightingMaskSignature(lightingGradientParams(lighting, base)));
      });
    });
    // 2026-11-14 QA minor 16: 카메라가 흔들리면 화면 고정 층도 같이 밀려, 화면 크기에 딱 맞춘 어둠 막 가장자리에 낮 밝기의 띠가 드러났다.
    describe("darkness mask while the camera shakes", () => {
      const lighting = { ambient: 0.5, color: "#0c1424", sources: [{ id: "lamp", at: { x: 4, y: 3 }, radius: 2, intensity: 1 }] };
      const whole = { ...base, mapBounds: undefined, resolveAnchor: (anchor: unknown) => anchor as { x: number; y: number } };

      it("is exactly the screen when nothing shakes", () => {
        const params = lightingGradientParams(lighting, whole);
        expect([params.width, params.height, params.bleed]).toEqual([320, 240, undefined]);
      });

      it("grows by the shake reach on every side and keeps lights on the same world spot", () => {
        const still = lightingGradientParams(lighting, whole);
        const shaking = lightingGradientParams(lighting, { ...whole, bleed: 24 });
        expect([shaking.width, shaking.height, shaking.bleed]).toEqual([368, 288, 24]);
        expect(shaking.gradients[0]!.centerX - still.gradients[0]!.centerX).toBe(24);
        expect(shaking.gradients[0]!.centerY - still.gradients[0]!.centerY).toBe(24);
        const { canvas, fills } = recordingCanvas();
        drawLightingMask(canvas, shaking);
        expect(fills[0]).toEqual({ x: 0, y: 0, w: 368, h: 288 });
        expect(lightingMaskSignature(shaking)).not.toBe(lightingMaskSignature(still));
      });

      it("moves the map rectangle with the margin so a small room keeps its edges", () => {
        const params = lightingGradientParams(lighting, { ...base, resolveAnchor: () => null, bleed: 10 });
        expect(params.clip).toEqual({ x: 90, y: 10, width: 160, height: 240 });
      });
    });
  });
  describe("mapAnimationRuntime", () => {
    isolateTimers();
    function mkSession(): PlaySessionLike {
      return {
        flags: {},
        switches: { sw_after_animation: false },
        variables: {},
        timers: {},
        gold: 0,
        inventory: {},
        partyActorIds: [],
        actorVitals: {},
        currentMapId: "m1",
        x: 1,
        y: 2,
        audio: {},
        pictures: {},
      };
    }
    describe("showAnimation 런타임", () => {
      it("player/eventId/좌표 target을 시작 시점 타일 좌표로 해석한다", () => {
        const resolver = {
          player: { x: 4, y: 5 },
          currentEventId: "ev_current",
          eventPosition: (eventId: string) =>
            ({
              ev_door: { x: 7, y: 2 },
              ev_current: { x: 3, y: 8 },
            })[eventId],
        };

        expect(resolveShowAnimationTargetTile("player", resolver)).toEqual({ x: 4, y: 5 });
        expect(resolveShowAnimationTargetTile({ eventId: "ev_door" }, resolver)).toEqual({ x: 7, y: 2 });
        expect(resolveShowAnimationTargetTile({ eventId: "" }, resolver)).toEqual({ x: 3, y: 8 });
        expect(resolveShowAnimationTargetTile({ x: 9, y: 1 }, resolver)).toEqual({ x: 9, y: 1 });
      });

      it("wait:true는 showAnimation step을 resume하기 전까지 다음 커맨드 진행을 멈춘다", () => {
        const project = createBlankProject();
        const session = mkSession();
        const commands: Command[] = [
          { kind: "showAnimation", target: "player", animationId: "anim_hit", wait: true },
          { kind: "setSwitch", switchId: "sw_after_animation", value: true },
        ];

        const interpreter = createInterpreter(commands, session, project);
        const step = interpreter.start();

        expect(step).toEqual({ kind: "showAnimation", target: "player", animationId: "anim_hit", wait: true });
        expect(session.switches.sw_after_animation).toBe(false);

        const done = interpreter.resume(undefined);

        expect(done.kind).toBe("done");
        expect(session.switches.sw_after_animation).toBe(true);
      });
    });
  });
  // 맵 진입 BGM 해석 — GameMap.bgm 이 실제로 소리로 이어지는지 지키는 가드.
  // 배경: bgm 타입과 에디터 UI 는 있었지만 플레이어가 읽는 곳이 없어 게임이 무음이었다.
  describe("mapBgm", () => {
    isolateTimers();
    function map(id: string, bgm?: MapBgmSetting): GameMap {
      return { id, name: id, width: 1, height: 1, lowerTiles: [0], upperTiles: [-1], events: [], tilesetId: "t", bgm } as unknown as GameMap;
    }
    // 루트 → 지역 → 마을 → 여관 4단 트리. 상속 체인을 실제로 타는지 보려면 2단 이상이어야 한다.
    const TREE: MapTreeNode = {
      mapId: "root",
      children: [
        { mapId: "region", children: [{ mapId: "town", children: [{ mapId: "inn", children: [] }] }] },
        { mapId: "orphanless", children: [] },
      ],
    };
    function project(maps: GameMap[], defaultBgmResourceId?: string) {
      return {
        maps: Object.fromEntries(maps.map((m) => [m.id, m])),
        mapTree: TREE,
        system: { defaultBgmResourceId },
      } as unknown as Parameters<typeof resolveMapBgm>[0];
    }
    describe("resolveMapBgm", () => {
      it("custom 은 지정 곡을 그대로 쓴다", () => {
        const p = project([map("inn", { mode: "custom", resourceId: "bgm-inn", fadeInMs: 800 })]);
        expect(resolveMapBgm(p, "inn")).toEqual({ kind: "play", resourceId: "bgm-inn", fadeInMs: 800 });
      });

      it("none 은 무음이며 부모로 상속하지 않는다", () => {
        const p = project([
          map("town", { mode: "custom", resourceId: "bgm-town" }),
          map("inn", { mode: "none" }),
        ]);
        expect(resolveMapBgm(p, "inn")).toEqual({ kind: "silence" });
      });

      it("parent 는 가장 가까운 조상의 결정을 따른다", () => {
        const p = project([
          map("region", { mode: "custom", resourceId: "bgm-field" }),
          map("town", { mode: "custom", resourceId: "bgm-town" }),
          map("inn", { mode: "parent" }),
        ]);
        // region 이 아니라 town — 가까운 쪽이 이겨야 한다.
        expect(resolveMapBgm(p, "inn")).toEqual({ kind: "play", resourceId: "bgm-town" });
      });

      it("bgm 미지정 맵도 조상 곡을 물려받는다", () => {
        const p = project([map("region", { mode: "custom", resourceId: "bgm-field" }), map("inn")]);
        expect(resolveMapBgm(p, "inn")).toEqual({ kind: "play", resourceId: "bgm-field" });
      });

      it("조상 중 아무도 정하지 않으면 프로젝트 기본으로 떨어진다", () => {
        const p = project([map("inn", { mode: "parent" })], "bgm-default");
        expect(resolveMapBgm(p, "inn")).toEqual({ kind: "play", resourceId: "bgm-default" });
      });

      it("프로젝트 기본이 없어도 내장 폴백으로 소리가 난다 — 기존 프로젝트는 이 필드를 영원히 갖지 않는다", () => {
        // 실측: 샘플 게임은 동결된 JSON fixture 라 defaultBgmResourceId 가 없다.
        // 폴백이 없으면 기존 게임 전부가 계속 무음이었다.
        expect(resolveMapBgm(project([map("inn")]), "inn")).toEqual({
          kind: "play",
          resourceId: FALLBACK_BGM_RESOURCE_ID,
        });
      });

      it("명시적 none 은 폴백보다 우선한다 — 침묵의 탈출구가 남아 있어야 한다", () => {
        expect(resolveMapBgm(project([map("inn", { mode: "none" })]), "inn")).toEqual({ kind: "silence" });
      });

      it("custom 인데 resourceId 가 비면 지정이 없는 것으로 보고 상속한다", () => {
        const p = project([
          map("region", { mode: "custom", resourceId: "bgm-field" }),
          map("inn", { mode: "custom", resourceId: "   " }),
        ]);
        expect(resolveMapBgm(p, "inn")).toEqual({ kind: "play", resourceId: "bgm-field" });
      });

      it("트리에 없는 고아 맵은 조상이 없어 프로젝트 기본을 쓴다", () => {
        const p = project([map("nowhere", { mode: "parent" })], "bgm-default");
        expect(resolveMapBgm(p, "nowhere")).toEqual({ kind: "play", resourceId: "bgm-default" });
      });
    });
    describe("mapAncestorIds", () => {
      it("가까운 부모부터 뿌리 방향으로 반환한다", () => {
        expect(mapAncestorIds(TREE, "inn")).toEqual(["town", "region", "root"]);
      });

      it("트리에 없는 맵은 빈 배열이다", () => {
        expect(mapAncestorIds(TREE, "nowhere")).toEqual([]);
      });
    });
    describe("applyMapBgmToSession", () => {
      it("재생은 세션에 기록한다 — 전투 진입 시 필드 BGM 복원과 세이브가 이 값을 쓴다", () => {
        const audio: { bgm?: { resourceId: string; loop: boolean } } = {};
        applyMapBgmToSession(audio, { kind: "play", resourceId: "bgm-town" });
        expect(audio.bgm).toEqual({ resourceId: "bgm-town", loop: true });
      });

      it("무음은 세션 값을 지운다", () => {
        const audio: { bgm?: { resourceId: string; loop: boolean } } = { bgm: { resourceId: "x", loop: true } };
        applyMapBgmToSession(audio, { kind: "silence" });
        expect(audio.bgm).toBeUndefined();
      });

      it("지정한 페이드인(0 포함)을 세션에 싣고, 없으면 필드를 빼 둔다", () => {
        const audio: { bgm?: { resourceId: string; loop: boolean; fadeInMs?: number } } = {};
        applyMapBgmToSession(audio, { kind: "play", resourceId: "bgm-town", fadeInMs: 0 });
        expect(audio.bgm).toEqual({ resourceId: "bgm-town", loop: true, fadeInMs: 0 });
        applyMapBgmToSession(audio, { kind: "play", resourceId: "bgm-town", fadeInMs: 800 });
        expect(audio.bgm).toEqual({ resourceId: "bgm-town", loop: true, fadeInMs: 800 });
        applyMapBgmToSession(audio, { kind: "play", resourceId: "bgm-town" });
        expect(audio.bgm).toEqual({ resourceId: "bgm-town", loop: true });
      });
    });
    describe("startMapBgm", () => {
      it("맵에 적은 페이드인으로 재생한다", () => {
        const play = vi.spyOn(playerAudio, "playAudioCommand").mockImplementation(() => {});
        try {
          const p = project([map("inn", { mode: "custom", resourceId: "bgm-inn", fadeInMs: 0 })]) as Parameters<typeof startMapBgm>[0];
          const session: Parameters<typeof startMapBgm>[1] = { audio: {} };
          startMapBgm(p, session, "inn");
          expect(session.audio.bgm).toEqual({ resourceId: "bgm-inn", loop: true, fadeInMs: 0 });
          expect(play).toHaveBeenCalledWith(session.audio.bgm, p);
        } finally {
          play.mockRestore();
        }
      });
    });
  });
  // M toggles the field minimap from a document keydown, outside Phaser's keyboard plugin.
  // That listener used to accept every "m", including repeats, IME composition, modifier
  // chords, text fields, and surfaces that already hide the minimap. A press the player
  // cannot see then left minimapUserHidden set, so the map stayed gone after dialogue closed.
  describe("minimapToggleKey", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });
    function key(partial: Partial<MinimapToggleKeyEvent> & Pick<MinimapToggleKeyEvent, "key">): MinimapToggleKeyEvent {
      return { repeat: false, isComposing: false, ctrlKey: false, metaKey: false, altKey: false, ...partial };
    }
    function openField(): FakeElement {
      restoreDom = installFakeDom();
      return new FakeElement("div");
    }
    describe("minimap M key", () => {
      it("accepts a plain M on an open field and ignores repeats, IME, and modifier chords", () => {
        const host = openField();
        expect(acceptsMinimapToggle(key({ key: "m" }), host as unknown as HTMLElement)).toBe(true);
        expect(acceptsMinimapToggle(key({ key: "M" }), host as unknown as HTMLElement)).toBe(true);
        expect(acceptsMinimapToggle(key({ key: "m", repeat: true }), host as unknown as HTMLElement)).toBe(false);
        expect(acceptsMinimapToggle(key({ key: "m", isComposing: true }), host as unknown as HTMLElement)).toBe(false);
        expect(acceptsMinimapToggle(key({ key: "m", keyCode: 229 }), host as unknown as HTMLElement)).toBe(false);
        expect(acceptsMinimapToggle(key({ key: "m", ctrlKey: true }), host as unknown as HTMLElement)).toBe(false);
        expect(acceptsMinimapToggle(key({ key: "m", metaKey: true }), host as unknown as HTMLElement)).toBe(false);
        expect(acceptsMinimapToggle(key({ key: "m", altKey: true }), host as unknown as HTMLElement)).toBe(false);
        expect(acceptsMinimapToggle(key({ key: "n" }), host as unknown as HTMLElement)).toBe(false);
      });

      it("does not toggle while a text field has the key, or while dialogue already hides the minimap", () => {
        const host = openField();
        const input = new FakeElement("input");
        const dialogue = new FakeElement("div");
        dialogue.dataset.testid = "dialogue-box";
        host.append(dialogue);
        expect(acceptsMinimapToggle(key({ key: "m", target: input }), new FakeElement("div") as unknown as HTMLElement)).toBe(false);
        expect(acceptsMinimapToggle(key({ key: "m" }), host as unknown as HTMLElement)).toBe(false);
      });

      it("the document handler skips the opening handoff and only toggles when the key is accepted", () => {
        const host = openField();
        let toggles = 0;
        const onKey = minimapToggleKeyHandler({
          presentationPending: () => false,
          host: () => host as unknown as HTMLElement,
          toggle: () => { toggles += 1; },
        });
        onKey(key({ key: "m" }));
        onKey(key({ key: "m", isComposing: true }));
        expect(toggles).toBe(1);

        const blocked = minimapToggleKeyHandler({
          presentationPending: () => true,
          host: () => host as unknown as HTMLElement,
          toggle: () => { toggles += 1; },
        });
        blocked(key({ key: "m" }));
        expect(toggles).toBe(1);
      });

      it("hides the map for a shop mounted outside the dialogue host", () => {
        const host = openField();
        const shop = new FakeElement("div");
        shop.dataset.testid = "shop-scene";
        document.body.append(shop as unknown as Node);
        expect(acceptsMinimapToggle(key({ key: "m" }), host as unknown as HTMLElement)).toBe(false);
      });

      it("looks up suppressing overlays once per check", () => {
        const host = openField();
        let hostScans = 0;
        let documentScans = 0;
        const hostQuery = host.querySelector.bind(host);
        host.querySelector = ((selector: string) => {
          hostScans += 1;
          return hostQuery(selector);
        }) as typeof host.querySelector;
        const doc = document as Document & { querySelector: (selector: string) => Element | null };
        const documentQuery = doc.querySelector.bind(document);
        doc.querySelector = ((selector: string) => {
          documentScans += 1;
          return documentQuery(selector);
        }) as typeof doc.querySelector;
        expect(acceptsMinimapToggle(key({ key: "m" }), host as unknown as HTMLElement)).toBe(true);
        expect(hostScans).toBe(1);
        expect(documentScans).toBe(1);
      });
    });
    describe("minimap frame writes", () => {
      function state(dot: FakeElement, root: FakeElement): MinimapRuntimeState {
        return {
          mapId: "field",
          setting: { enabled: true },
          scale: 1,
          canvas: new FakeElement("canvas") as unknown as HTMLCanvasElement,
          dot: dot as unknown as HTMLElement,
          root: root as unknown as HTMLElement,
          hidden: false,
        };
      }

      it("writes the player dot only when the tile changes", () => {
        restoreDom = installFakeDom();
        const dot = new FakeElement("div");
        const writes: string[] = [];
        for (const prop of ["left", "top"] as const) {
          let value = "";
          Object.defineProperty(dot.style, prop, {
            configurable: true,
            get: () => value,
            set: (next: string) => {
              writes.push(`${prop}=${next}`);
              value = next;
            },
          });
        }
        const map = { tileSize: 16 } as GameMap;
        const minimap = state(dot, new FakeElement("div"));
        syncMinimapPosition(minimap, 2, 3, map);
        syncMinimapPosition(minimap, 2, 3, map);
        syncMinimapPosition(minimap, 3, 3, map);
        expect(writes).toEqual(["left=29.5px", "top=45.5px", "left=45.5px", "top=45.5px"]);
      });

      it("writes minimap visibility only when the hidden flag changes", () => {
        const host = openField();
        const root = new FakeElement("div");
        const writes: string[] = [];
        let display = "";
        Object.defineProperty(root.style, "display", {
          configurable: true,
          get: () => display,
          set: (next: string) => {
            writes.push(next);
            display = next;
          },
        });
        const minimap = state(new FakeElement("div"), root);
        expect(syncMinimapVisibility(minimap, host as unknown as HTMLElement, false)).toBe(false);
        expect(syncMinimapVisibility(minimap, host as unknown as HTMLElement, false)).toBe(false);
        expect(syncMinimapVisibility(minimap, host as unknown as HTMLElement, true)).toBe(true);
        expect(syncMinimapVisibility(minimap, host as unknown as HTMLElement, true)).toBe(true);
        expect(writes).toEqual(["none"]);
        expect(minimap.hidden).toBe(true);
        expect(root.hidden).toBe(true);
      });
    });
  });
  describe("monsterArtScale", () => {
    isolateTimers();
    describe("integerArtBox (pixel grid contract)", () => {
      it("draws a 64 canvas at exactly 2x inside the 128 box", () => {
        expect(integerArtBox(64, 64)).toEqual({ scale: 2, width: 128, height: 128 });
      });
      it("draws a 112 canvas at 1x, never the old 1.14x", () => {
        expect(integerArtBox(112, 112)).toEqual({ scale: 1, width: 112, height: 112 });
      });
      it("keeps non-square art integral and falls back to the 128 box for unknown sizes", () => {
        expect(integerArtBox(48, 32)).toEqual({ scale: 2, width: 96, height: 64 });
        expect(integerArtBox(0, 0)).toEqual({ scale: 2, width: 128, height: 128 });
      });
      it("never scales below 1x", () => {
        expect(integerArtBox(200, 200).scale).toBe(1);
      });
    });
  });
  // 경험치 분배 expSplitAlive — 쓰러진 참전자 제외·총량 나누기, 꺼져 있으면 기존 전액. 도망 불가 안내 문장.
  // 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
  describe("monsterExpSplitAlive", () => {
    isolateTimers();
    describe("monsterExpPlan", () => {
      const alive = new Set(["a", "b"]);

      it("is a no-op while expSplitAlive is off (every participant gets the full amount, fainted too)", () => {
        expect(monsterExpPlan(undefined, 90, ["a", "b", "c"], alive)).toEqual({ exp: 90, participantIds: ["a", "b", "c"] });
        expect(monsterExpPlan({ expShare: true }, 90, undefined, alive)).toEqual({ exp: 90, participantIds: undefined });
      });

      it("splits among the participants that are still standing and drops the fainted one", () => {
        expect(monsterExpPlan({ expSplitAlive: true }, 90, ["a", "b", "c"], alive)).toEqual({ exp: 45, participantIds: ["a", "b"] });
      });

      it("gives at least 1 exp each while there is any exp, and nothing when nobody is standing", () => {
        expect(monsterExpPlan({ expSplitAlive: true }, 1, ["a", "b"], alive).exp).toBe(1);
        expect(monsterExpPlan({ expSplitAlive: true }, 90, ["c"], alive)).toEqual({ exp: 0, participantIds: [] });
        expect(monsterExpPlan({ expSplitAlive: true }, 0, ["a"], alive).exp).toBe(0);
      });
    });
    describe("emeraldNoEscapeLine", () => {
      it("says the trainer line only for trainer troops", () => {
        expect(emeraldNoEscapeLine({ troopId: "no_such_troop" })).toBe("도망칠 수 없다!");
      });
    });
    describe("rewardPolicy save bytes", () => {
      it("keeps expSplitAlive out of the saved policy unless it is on", () => {
        // Break: a new optional field must not appear for projects that never opted in.
        const off = normalizeSystemRecords({ startActorIds: [], rewardPolicy: { participationOnly: true } });
        expect(off.rewardPolicy).toEqual({ participationOnly: true, levelGapPenalty: false });
        const on = normalizeSystemRecords({ startActorIds: [], rewardPolicy: { expSplitAlive: true } });
        expect(on.rewardPolicy?.expSplitAlive).toBe(true);
      });
    });
  });
  describe("movement", () => {
    isolateTimers();
    describe("resolveMovementIntent (8방향 입력 해석)", () => {
      it("입력이 없으면 방향/성분 모두 비어있다", () => {
        expect(resolveMovementIntent([])).toEqual({ dir: null, x: 0, y: 0 });
      });

      it("단일 직교 입력을 성분과 facing 으로 변환한다", () => {
        expect(resolveMovementIntent(["right"])).toEqual({ dir: "right", x: 1, y: 0 });
        expect(resolveMovementIntent(["left"])).toEqual({ dir: "left", x: -1, y: 0 });
        expect(resolveMovementIntent(["up"])).toEqual({ dir: "up", x: 0, y: -1 });
        expect(resolveMovementIntent(["down"])).toEqual({ dir: "down", x: 0, y: 1 });
      });

      it("대각선 입력 시 두 축 성분을 만들고 facing 은 수평 우선이다", () => {
        expect(resolveMovementIntent(["right", "up"])).toEqual({ dir: "right", x: 1, y: -1 });
        // 눌린 순서와 무관하게 수평을 바라본다.
        expect(resolveMovementIntent(["up", "right"])).toEqual({ dir: "right", x: 1, y: -1 });
        expect(resolveMovementIntent(["down", "left"])).toEqual({ dir: "left", x: -1, y: 1 });
      });

      it("같은 축의 반대 키가 나중에 눌리면 최신 키를 따른다", () => {
        expect(resolveMovementIntent(["left", "right"])).toEqual({ dir: "right", x: 1, y: 0 });
        expect(resolveMovementIntent(["up", "down"])).toEqual({ dir: "down", x: 0, y: 1 });
      });

      it("세 방향 조합에서 각 축의 최신 입력을 성분으로 채택한다", () => {
        // 수평 최신 = left, 수직 최신 = up → 대각선(왼쪽 위), facing 은 수평(left).
        expect(resolveMovementIntent(["left", "down", "up"])).toEqual({ dir: "left", x: -1, y: -1 });
      });
    });
    describe("resolveDiagonalStep (대각선 통행/미끄러짐 판정)", () => {
      // blocked: 통행 불가한 (dx,dy) 목록
      const stepper = (blocked: ReadonlyArray<[number, number]>) => (dx: number, dy: number): boolean =>
        !blocked.some(([bx, by]) => bx === dx && by === dy);

      it("입력이 없으면 이동 없음", () => {
        expect(resolveDiagonalStep(0, 0, () => true)).toBeNull();
      });

      it("직교 입력은 해당 칸 통행 여부로 결정된다", () => {
        expect(resolveDiagonalStep(1, 0, stepper([]))).toEqual({ dx: 1, dy: 0 });
        expect(resolveDiagonalStep(1, 0, stepper([[1, 0]]))).toBeNull();
      });

      it("대각선은 양쪽 직교 칸이 모두 열려야 대각선으로 이동한다", () => {
        expect(resolveDiagonalStep(1, -1, stepper([]))).toEqual({ dx: 1, dy: -1 });
      });

      it("수직 직교가 막히면 가로로 미끄러진다(모서리 끼임 방지)", () => {
        // (0,-1) 막힘 → 세로 불가 → 가로 슬라이드
        expect(resolveDiagonalStep(1, -1, stepper([[0, -1]]))).toEqual({ dx: 1, dy: 0 });
      });

      it("수평 직교가 막히면 세로로 미끄러진다", () => {
        // (1,0) 막힘 → 가로 불가 → 세로 슬라이드
        expect(resolveDiagonalStep(1, -1, stepper([[1, 0]]))).toEqual({ dx: 0, dy: -1 });
      });

      it("양쪽 직교가 열려도 대각선 목적지가 막혀 있으면 대각선으로 들어가지 않는다", () => {
        // 코너컷 버그: (1,0)/(0,-1) 은 열려 있고 대각선 목적지 (1,-1) 만 통행 불가.
        // 목적지로 진입할 수 없으므로 대각선 대신 직교로 미끄러져야 한다.
        expect(resolveDiagonalStep(1, -1, stepper([[1, -1]]))).toEqual({ dx: 1, dy: 0 });
      });

      it("양쪽 직교가 모두 막히면 이동하지 않는다", () => {
        expect(resolveDiagonalStep(1, -1, stepper([[1, 0], [0, -1]]))).toBeNull();
      });
    });
    describe("facingForStep (이동 성분 → 4방향 facing)", () => {
      it("직교 이동은 그대로 매핑된다", () => {
        const cases: Array<[number, number, Dir]> = [
          [1, 0, "right"],
          [-1, 0, "left"],
          [0, 1, "down"],
          [0, -1, "up"],
        ];
        for (const [dx, dy, expected] of cases) {
          expect(facingForStep(dx, dy)).toBe(expected);
        }
      });

      it("대각선 이동은 수평 우선으로 facing 을 정한다", () => {
        expect(facingForStep(1, -1)).toBe("right");
        expect(facingForStep(-1, 1)).toBe("left");
      });
    });
  });
  describe("npcActionFacing", () => {
    isolateTimers();
    type ActionScene = Parameters<typeof handleAction>[0];
    type ActionSceneFixture = {
      readonly scene: ActionScene;
      readonly sprite: MockSprite;
    };
    function actionScene(
      animationType: EventAnimationType = "normal",
      textureKey = "tex_easyrpg_charset_actor1",
      player: { readonly x: number; readonly y: number; readonly facing: Dir } = { x: 0, y: 1, facing: "right" }
    ): ActionSceneFixture {
      const scene = movementScene({
        animationType,
        graphic: {
          direction: "down",
          pattern: 0,
          sprite: { type: "bundled", id: "easyrpg-charset-actor1" },
        },
        movement: { type: "fixed", speed: 3, frequency: 3 },
      });
      const sprite = mockSprite(0, 0, textureKey);
      return {
        sprite,
        scene: {
          ...scene,
          tileX: player.x,
          tileY: player.y,
          facing: player.facing,
          lastActionTargetKey: "",
          eventSprites: new Map([["npc", sprite]]),
          runEvent: async () => undefined,
        },
      };
    }
    describe("NPC action facing", () => {
      it.each([
        ["west", { x: 0, y: 1, facing: "right" }, "left"],
        ["east", { x: 2, y: 1, facing: "left" }, "right"],
        ["north", { x: 1, y: 0, facing: "down" }, "up"],
        ["south", { x: 1, y: 2, facing: "up" }, "down"],
      ] satisfies Array<readonly [string, { readonly x: number; readonly y: number; readonly facing: Dir }, Dir]>)(
        "turns a static action NPC toward a player on the %s side before dialogue starts",
        (_label, player, expectedDirection) => {
          const { scene, sprite } = actionScene("normal", "tex_easyrpg_charset_actor1", player);

          handleAction(scene);

          expect(scene.eventPositions.npc?.direction).toBe(expectedDirection);
          expect(sprite.frame).toBe(charsetIdleFrameIndex(0, expectedDirection));
        }
      );

      it("uses runtime direction when action-facing static events are rendered again", () => {
        const scene = renderSceneWith({
          graphic: {
            direction: "down",
            pattern: 0,
            sprite: { type: "bundled", id: "tex_easyrpg_charset_actor1" },
          },
        });
        scene.eventPositions.npc = { ...scene.eventPositions.npc!, direction: "right" };

        renderTiles(scene);

        expect(scene.eventSprites.get("npc")?.frame).toBe(charsetIdleFrameIndex(0, "right"));
      });

      it("turns a default bundled NPC sprite toward the player before dialogue starts", () => {
        const { scene, sprite } = actionScene("normal", DEFAULT_EASYRPG_CHARSET_ID);

        handleAction(scene);

        expect(sprite.frame).toBe(charsetIdleFrameIndex(0, "left"));
      });

      it("keeps fixed-direction action NPCs facing their authored direction", () => {
        const { scene, sprite } = actionScene("fixedDirection");

        handleAction(scene);

        expect(sprite.frame).toBeNull();
        expect(scene.eventPositions.npc?.direction).toBeUndefined();
      });

      it("updates autonomous mover facing and runtime mover snapshots before dialogue starts", () => {
        const { scene, sprite } = actionScene("normal", "tex_easyrpg_charset_actor1", { x: 2, y: 1, facing: "left" });
        const mover = autonomousMover("down");
        scene.autonomousNPCs.set("npc", mover);

        handleAction(scene);

        expect(mover.facing).toBe("right");
        expect(runtimeMoverSnapshots(scene.autonomousNPCs).npc?.facing).toBe("right");
        expect(sprite.frame).toBe(charsetIdleFrameIndex(0, "right"));
      });

      it("respects move route direction fix on autonomous action NPCs", () => {
        const { scene, sprite } = actionScene("normal", "tex_easyrpg_charset_actor1", { x: 2, y: 1, facing: "left" });
        const mover = autonomousMover("down", true);
        scene.autonomousNPCs.set("npc", mover);

        handleAction(scene);

        expect(mover.facing).toBe("down");
        expect(runtimeMoverSnapshots(scene.autonomousNPCs).npc?.directionFix).toBe(true);
        expect(sprite.frame).toBe(charsetIdleFrameIndex(0, "down"));
      });
    });
    function autonomousMover(facing: Dir, directionFix = false): AutonomousMover {
      return {
        moves: [],
        step: 0,
        timer: 0,
        repeat: false,
        strategy: "sequence",
        facing,
        directionFix,
        through: false,
        animationEnabled: true,
        opacity: 255,
        speedRank: 3,
        frequencyRank: 3,
        moveIntervalMs: 560,
        moveDurationMs: 400,
        activeMove: null,
      };
    }
  });
  describe("npcChasePathfinding7", () => {
    isolateTimers();
    const getCurrent = store.getCurrent;
    afterEach(() => { store.getCurrent = getCurrent; vi.restoreAllMocks(); });
    const fixed = { movement: { type: 'fixed', speed: 3, frequency: 3 } };
    function swarm(n = 20) {
      const es = Array.from({ length: n }, (_, i) => event('s' + i, 1 + i, 1));
      for (const [x, y] of [[24, 25], [26, 25], [25, 24], [25, 26]]) es.push(event(`b${x}-${y}`, x, y, fixed));
      return fixture(50, 50, es, 25, 25);
    }
    describe('7차 추격 통행과 접촉', () => {
      it('faction: excludes only the target and approaches without stacking or firing eventTouch', () => {
        const f = fixture(7, 5, [event('a', 1, 2), event('b', 5, 2, fixed)], 0, 0);
        f.scene.autonomousNPCs.get('a').chaseTarget = { x: 5, y: 2 };
        ticks(f.scene);
        expect(pos(f.scene)).toMatchObject({ x: 4, y: 2 });
        expect(f.scene.touches).toBe(0);
      });
      it('faction: third-party blockers still require a detour', () => {
        const f = fixture(7, 5, [event('a', 1, 2), event('b', 5, 2, fixed), event('c', 3, 2, fixed)], 0, 0);
        f.scene.autonomousNPCs.get('a').chaseTarget = { x: 5, y: 2 };
        const visited = [];
        for (let i = 0; i < 50; i++) { ticks(f.scene, 1); visited.push({ ...pos(f.scene) }); }
        expect(visited.some(p => p.y !== 2)).toBe(true);
        expect(visited.some(p => p.x === 3 && p.y === 2)).toBe(false);
        expect(f.scene.touches).toBe(0);
      });
      it('passRows: lets the upper body pass an event above the feet corridor', () => {
        const f = fixture(7, 5, [event('a', 1, 2, { footprint: { width: 1, height: 3 }, passRows: 1 }), event('b', 3, 1, fixed)], 5, 2);
        for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) if (y !== 2) f.map.lowerTiles[y * 7 + x] = 1;
        ticks(f.scene);
        expect(pos(f.scene)).toMatchObject({ x: 4, y: 2 });
        expect(f.scene.touches).toBeGreaterThan(0);
      });
      it('decoration: follows the available detour around placed furniture', () => {
        const f = fixture(7, 5, [event('a', 1, 2)], 5, 2);
        f.project.database.homeDecorationTypes = [{ id: 'box', blocksMovement: true, footprint: { width: 1, height: 1 } }];
        f.session.homeDecorationPlacements = { box: { instanceId: 'box', typeId: 'box', mapId: 'm', x: 3, y: 2, orientation: 'down' } };
        ticks(f.scene);
        expect(Math.abs(pos(f.scene).x - 5) + Math.abs(pos(f.scene).y - 2)).toBe(1);
        expect(f.scene.touches).toBeGreaterThan(0);
      });
      it.each([false, true])('wideTouch: touches with passage rectangles (moving player %s)', moving => {
        const f = fixture(8, 5, [event('a', 1, 2, { footprint: { width: 3, height: 1 }, passRows: 1 })], 5, 2);
        // 접촉은 그림 자리로 잰다(chaseContact, 4127a63455): 걸음이 막 끝나 가는 주인공(진행률 1)은 예약 칸 (5,2) 에 그려진다.
        if (moving) { f.scene.tileX = 6; f.scene.moving = true; f.scene.movingTo = { x: 5, y: 2 }; f.scene.moveProgress = 1; }
        ticks(f.scene);
        expect(pos(f.scene)).toMatchObject({ x: 3, y: 2 });
        expect(f.scene.touches).toBeGreaterThan(0);
      });
      it('wide player: stops before overlapping the player feet', () => {
        const f = fixture(8, 5, [event('a', 1, 2)], 5, 2);
        f.session.playerFootprint = { width: 3, height: 3 }; f.session.playerPassRows = 1;
        ticks(f.scene);
        expect(pos(f.scene)).toMatchObject({ x: 3, y: 2 });
        expect(f.scene.touches).toBeGreaterThan(0);
      });
    });
    // 한 번 업데이트에서 재탐색을 받은 추격자 — 쫓는 동안은 칸 사이 시간을 이어받아(glide) 재탐색 타이머가 0 에 머물므로
    // 「타이머 == 0」만 보면 지난 프레임에 찾은 추격자가 매번 다시 잡힌다. 타이머가 0 이 아니었다가 0 이 된 추격자만 센다.
    function updateAndSearched(f: any, ms: number): string[] {
      const before = new Map([...f.scene.autonomousNPCs.entries()].map(([id, m]: any) => [id, m.chaseRepathTimerMs]));
      updateAutonomousNPCs(f.scene, ms);
      return [...f.scene.autonomousNPCs.entries()].filter(([id, m]: any) => m.chaseRepathTimerMs === 0 && ((before.get(id) as number | undefined) ?? 1) > 0).map(([id]) => id as string);
    }
    describe('7차 추격 재탐색 예산', () => {
      it('unreachableSwarm: limits initial and repeated A* to two per update and serves every waiter', () => {
        const f = swarm();
        const served = new Set<string>();
        for (let frame = 0; frame < 20; frame++) {
          const searched = updateAndSearched(f, 500);
          expect(searched).toHaveLength(2);
          searched.forEach((id) => served.add(id));
          if (frame === 9) expect(served.size).toBe(20);
        }
        expect(served.size).toBe(20);
      });
      it('shares the budget across logical ticks in the same rendered frame', () => {
        const f = swarm(6); f.scene.game = { loop: { frame: 1 } };
        // 막힘 표시(chasePathBlocked)는 목표가 바뀌면 지워지므로 재탐색을 받은 추격자를 직접 센다.
        const first = new Set([...updateAndSearched(f, 500), ...updateAndSearched(f, 500)]);
        expect(first.size).toBe(2);
        f.scene.game.loop.frame++;
        const second = new Set([...first, ...updateAndSearched(f, 500)]);
        expect(second.size).toBe(4);
      });
      it('does not let removed or frozen pending movers permanently starve remaining callers', () => {
        const f = swarm(6); updateAutonomousNPCs(f.scene, 500);
        f.scene.autonomousNPCs.delete('s2'); f.scene.autonomousNPCs.get('s3').actionFrozen = true;
        for (let i = 0; i < 3; i++) updateAutonomousNPCs(f.scene, 500);
        expect(f.scene.autonomousNPCs.get('s4').chasePathBlocked).toBe(true);
        expect(f.scene.autonomousNPCs.get('s5').chasePathBlocked).toBe(true);
      });
      it('keeps an existing path when periodic replanning is denied', () => {
        const f = fixture(8, 5, [], 6, 2);
        const mover = { timer: 0, moveIntervalMs: 80, chaseRepathTimerMs: 500, chasePath: [{ x: 2, y: 2 }, { x: 3, y: 2 }] };
        const blocked = vi.fn(() => false);
        const decision = nextChaseDecision({ ...f, from: { x: 1, y: 2 }, player: { x: 6, y: 2 }, mover, deltaMs: 80,
          requestRepath: () => false, pass: { footprint: { width: 1, height: 1 }, passRows: 1, blocked } });
        expect(decision).toMatchObject({ kind: 'move', x: 2, y: 2 });
        expect(mover.chasePath).toEqual([{ x: 3, y: 2 }]);
        expect(blocked).not.toHaveBeenCalled();
      });
      it('immediately replans exhausted reachable paths even when the budget is denied', () => {
        const f = fixture(8, 5, [], 6, 2);
        const requestRepath = vi.fn(() => false);
        const mover = { timer: 0, moveIntervalMs: 80, chaseRepathTimerMs: 0, chasePath: [], chasePathBlocked: false };
        expect(nextChaseDecision({ ...f, from: { x: 1, y: 2 }, player: { x: 6, y: 2 }, mover, deltaMs: 80, requestRepath }))
          .toMatchObject({ kind: 'move', x: 2, y: 2 });
        expect(requestRepath).not.toHaveBeenCalled();
      });
      it('300 unobstructed cached paths add no searches or terrain probes beyond actual steps', () => {
        const f = fixture(310, 5, Array.from({ length: 300 }, (_, i) => event('s' + i, i + 1, 1)), 305, 4);
        for (const [id, m] of f.scene.autonomousNPCs) {
          const p = pos(f.scene, id);
          m.chasePath = [{ x: p.x, y: 2 }, { x: p.x, y: 3 }]; m.chaseRepathTimerMs = 0;
        }
        const calls = vi.spyOn(collision, 'canMoveFootprint');
        updateAutonomousNPCs(f.scene, 80);
        expect(calls).toHaveBeenCalledTimes(300);
        expect([...f.scene.autonomousNPCs.values()].every((m: any) => m.chaseRepathTimerMs === 80 && m.activeMove)).toBe(true);
      });
    });
  });
  describe("npcPlayerCollision", () => {
    isolateTimers();
    describe("NPC-player character collision", () => {
      it("blocks an NPC from stepping onto the player's committed tile when through is off", () => {
        const scene = movementScene({
          movement: {
            type: "custom",
            speed: 6,
            frequency: 6,
            route: { moves: [{ kind: "move", dir: "right" }], repeat: false },
          },
        });
        registerPageMoveRoutes(scene);
        const runtimeScene = {
          ...scene,
          tileX: 2,
          tileY: 1,
          moving: false,
          movingTo: { x: 2, y: 1 },
          eventSprites: new Map(),
          runtimeDom: { upsertEventMarker: () => undefined },
          runEvent: async () => undefined,
        };
        const mover = scene.autonomousNPCs.get("npc");
        if (!mover) throw new Error("missing mover");

        updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);

        expect(scene.eventPositions.npc).toEqual({ x: 1, y: 1 });
        expect(mover.activeMove).toBeNull();
      });

      it("blocks an NPC from stepping onto the player's mid-move destination", () => {
        const scene = movementScene({
          movement: {
            type: "custom",
            speed: 6,
            frequency: 6,
            route: { moves: [{ kind: "move", dir: "right" }], repeat: false },
          },
        });
        registerPageMoveRoutes(scene);
        const runtimeScene = {
          ...scene,
          // Player is mid-step from (3,1) into (2,1) — the tile the NPC wants.
          tileX: 3,
          tileY: 1,
          moving: true,
          movingTo: { x: 2, y: 1 },
          eventSprites: new Map(),
          runtimeDom: { upsertEventMarker: () => undefined },
          runEvent: async () => undefined,
        };
        const mover = scene.autonomousNPCs.get("npc");
        if (!mover) throw new Error("missing mover");

        updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);

        expect(scene.eventPositions.npc).toEqual({ x: 1, y: 1 });
        expect(mover.activeMove).toBeNull();
      });

      it("allows through ON to enter the player tile", () => {
        const scene = movementScene({
          movement: {
            type: "custom",
            speed: 6,
            frequency: 6,
            route: {
              moves: [
                { kind: "setThrough", enabled: true },
                { kind: "move", dir: "right" },
              ],
              repeat: false,
            },
          },
        });
        registerPageMoveRoutes(scene);
        const runtimeScene = {
          ...scene,
          tileX: 2,
          tileY: 1,
          moving: false,
          movingTo: { x: 2, y: 1 },
          eventSprites: new Map(),
          runtimeDom: { upsertEventMarker: () => undefined },
          runEvent: async () => undefined,
        };
        const mover = scene.autonomousNPCs.get("npc");
        if (!mover) throw new Error("missing mover");

        updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs); // setThrough
        // A page route strolls (naturalStroll): after an instant command the next step waits
        // moveIntervalMs * pauseScale, and pauseScale is drawn from the session RNG in [0.6, 1.5]
        // (strollPauseScale). One plain interval only covers scales <= 1, so this test failed whenever
        // the unseeded draw was larger. Advance by the pause the mover actually drew so the step always runs.
        updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs * (mover.pauseScale ?? 1)); // move onto player

        expect(scene.eventPositions.npc).toEqual({ x: 2, y: 1, direction: "right" });
      });

      it("blocks an NPC from stepping onto another same-priority solid event", () => {
        const scene = twoNpcMovementScene(
          {
            movement: {
              type: "custom",
              speed: 6,
              frequency: 6,
              route: { moves: [{ kind: "move", dir: "right" }], repeat: false },
            },
          },
          { id: "blocker", x: 2, y: 1, overlapForbidden: true, priority: "same" }
        );
        registerPageMoveRoutes(scene);
        const runtimeScene = {
          ...scene,
          tileX: 9,
          tileY: 9,
          moving: false,
          movingTo: { x: 9, y: 9 },
          eventSprites: new Map(),
          runtimeDom: { upsertEventMarker: () => undefined },
          runEvent: async () => undefined,
        };
        const mover = scene.autonomousNPCs.get("npc");
        if (!mover) throw new Error("missing mover");

        updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);

        expect(scene.eventPositions.npc).toEqual({ x: 1, y: 1 });
        expect(mover.activeMove).toBeNull();
      });

      it("blocks an NPC from stepping into any cell of a 2x3 solid event's footprint, not just its anchor", () => {
        // 앵커 (6,4) 의 2x3(가로2·세로3) 발자국은 footprintBounds 로 x 6..7 / y 2..4 를 덮는다.
        // NPC 는 (5,2) 에서 오른쪽으로 한 칸 움직여 (6,2) 로 가려 한다 — 이건 발자국의 좌상단 칸이고 앵커가 아니다.
        // 폭·높이가 다른 발자국을 쓰는 이유: footprintContains 의 인자가 뒤바뀌면(주체↔조사점)
        // 대칭이 아니라 (top = y - (height-1)) 편향 때문에 이 사례에서 결과가 갈린다.
        const scene = twoNpcMovementScene(
          {
            movement: {
              type: "custom",
              speed: 6,
              frequency: 6,
              route: { moves: [{ kind: "move", dir: "right" }], repeat: false },
            },
          },
          { id: "blocker", x: 6, y: 4, overlapForbidden: true, priority: "same", footprint: { width: 2, height: 3 } },
          { x: 5, y: 2 }
        );
        registerPageMoveRoutes(scene);
        const runtimeScene = {
          ...scene,
          tileX: 9,
          tileY: 9,
          moving: false,
          movingTo: { x: 9, y: 9 },
          eventSprites: new Map(),
          runtimeDom: { upsertEventMarker: () => undefined },
          runEvent: async () => undefined,
        };
        const mover = scene.autonomousNPCs.get("npc");
        if (!mover) throw new Error("missing mover");

        updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);

        expect(scene.eventPositions.npc).toEqual({ x: 5, y: 2 });
        expect(mover.activeMove).toBeNull();
      });

      it("isPlayerOccupyingTile covers committed and mid-move destination tiles", () => {
        expect(isPlayerOccupyingTile({ tileX: 4, tileY: 5 }, 4, 5)).toBe(true);
        expect(isPlayerOccupyingTile({ tileX: 4, tileY: 5, moving: false, movingTo: { x: 5, y: 5 } }, 5, 5)).toBe(false);
        expect(isPlayerOccupyingTile({ tileX: 4, tileY: 5, moving: true, movingTo: { x: 5, y: 5 } }, 5, 5)).toBe(true);
        expect(isPlayerOccupyingTile({ tileX: 4, tileY: 5, moving: true, movingTo: { x: 5, y: 5 } }, 4, 5)).toBe(true);
      });

      it("canNpcMove rejects player-occupied destinations when through is off", () => {
        const scene = movementScene({
          movement: { type: "fixed", speed: 3, frequency: 3 },
        });
        const request = {
          project: store.getCurrent(),
          scene: {
            ...scene,
            tileX: 2,
            tileY: 1,
            moving: false,
            movingTo: { x: 2, y: 1 },
            eventSprites: new Map(),
            runtimeDom: { upsertEventMarker: () => undefined },
            runEvent: async () => undefined,
          },
          mover: {
            moves: [],
            step: 0,
            timer: 0,
            repeat: false,
            strategy: "sequence" as const,
            facing: "right" as const,
            directionFix: false,
            through: false,
            animationEnabled: true,
            opacity: 255,
            speedRank: 3,
            frequencyRank: 3,
            moveIntervalMs: 100,
            moveDurationMs: 100,
            activeMove: null,
          },
          eventId: "npc",
          from: { x: 1, y: 1 },
          to: { x: 2, y: 1 },
        };
        expect(canNpcMove(request, { x: 1, y: 0, face: "right" })).toBe(false);
        request.mover.through = true;
        expect(canNpcMove(request, { x: 1, y: 0, face: "right" })).toBe(true);
      });
    });
    function twoNpcMovementScene(
      walkerPage: Partial<EventPage>,
      blocker: {
        id: string;
        x: number;
        y: number;
        overlapForbidden: boolean;
        priority: EventPage["priority"];
        footprint?: { width: number; height: number };
      },
      npcStart: { x: number; y: number } = { x: 1, y: 1 }
    ): Parameters<typeof registerPageMoveRoutes>[0] {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.events = [
        {
          id: "npc",
          x: npcStart.x,
          y: npcStart.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [pageWith(walkerPage)],
        },
        {
          id: blocker.id,
          x: blocker.x,
          y: blocker.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            pageWith({
              id: `${blocker.id}_page`,
              priority: blocker.priority,
              overlapForbidden: blocker.overlapForbidden,
              footprint: blocker.footprint,
              movement: { type: "fixed", speed: 3, frequency: 3 },
            }),
          ],
        },
      ];
      store.replace(project);

      let scene: Parameters<typeof registerPageMoveRoutes>[0];
      scene = {
        map,
        session: startSession(project),
        eventPositions: initialRuntimeEventPositions(map.events),
        pageMoveRouteKeys: new Set(),
        pageMoveRouteEventIds: new Set(),
        autonomousNPCs: new Map(),
        registerAutonomousMover: (eventId, moves, repeat) => {
          registerAutonomousMover(scene, eventId, moves, repeat);
        },
      };
      return scene;
    }
  });
  // 목표 화살표는 걸어갈 길의 다음 곧은 구간 끝(성문·모퉁이)을 가리킨다 — 벽면·집 모서리·막는 이벤트를 향하지 않는다.
  // 2026-11-11 fun-x1 눈가림 플레이: 「세 걸음 앞 칸」 화살표가 숙영지 성벽·궁전 정원 벽을 가리켰다(openwiki/assistant-v2.md 「목표 화살표는 길목을 가리킨다」).
  describe("objectiveRouteLeg", () => {
    isolateTimers();
    /** 행 문자열로 만든 맵: '#' 벽, '.' 바닥. */
    function world(rows: string[]): { project: Project; map: GameMap } {
      const project = createBlankProject();
      const base = project.maps[project.startMapId]!;
      const tileset = getTileset(project, base)!;
      const floor = tileset.passability.findIndex((p) => p && p.up && p.down && p.left && p.right);
      const wall = tileset.passability.findIndex((p) => p && !p.up && !p.down && !p.left && !p.right);
      const map = createBlankMap("t", rows[0]!.length, rows.length, base.tilesetId);
      map.lowerTiles = rows.flatMap((row) => [...row].map((ch) => (ch === "#" ? wall : floor)));
      map.upperTiles = map.lowerTiles.map(() => -1);
      project.maps[map.id] = map;
      return { project, map };
    }
    const OFF_SCREEN = { x: 100, y: 100, right: 120, bottom: 115 };
    const ON_SCREEN = { x: 0, y: 0, right: 20, bottom: 15 };
    const degrees = (angle: number) => Math.round((angle * 180) / Math.PI);
    describe("objective arrow follows the walkable leg", () => {
      // 벽 한 줄에 성문 하나(4,2). 대상은 벽 너머 (1,0).
      const walled = ["..........", "..........", "####.#####", "..........", ".........."];

      it("aims at the cell in front of the gate, not at the wall face above the hero", () => {
        const { project, map } = world(walled);
        const targets = [{ x: 1, y: 0 }];
        const route = objectiveRoute(project, map, targets, new Set());
        const aim = objectiveArrowAim(project, map, route, targets, { x: 8, y: 4 }, OFF_SCREEN)!;
        expect(aim.kind).toBe("route");
        expect(aim.cell).toEqual({ x: 4, y: 3 });
        expect(degrees(aim.angle)).toBe(-166); // 왼쪽(성문 쪽) — 위(벽면)가 아니다
      });

      it("points straight through the gate once the hero stands under it", () => {
        const { project, map } = world(walled);
        const targets = [{ x: 1, y: 0 }];
        const route = objectiveRoute(project, map, targets, new Set());
        const aim = objectiveArrowAim(project, map, route, targets, { x: 4, y: 3 }, OFF_SCREEN)!;
        expect(aim.cell).toEqual({ x: 4, y: 0 });
        expect(degrees(aim.angle)).toBe(-90);
      });

      it("every leg is a straight walk: each cell on the line is a step closer and never a wall", () => {
        const { project, map } = world(walled);
        const targets = [{ x: 1, y: 0 }];
        const field = routeField(project, map, targets);
        for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
          const d = field[y * map.width + x]!;
          if (d <= 0) continue;
          const leg = routeLeg(project, map, field, { x, y })!;
          expect(leg, `(${x},${y})`).toBeDefined();
          expect(field[leg.cell.y * map.width + leg.cell.x]).toBe(leg.left);
          // 구간 끝까지 맨해튼 거리만큼 가까워진다 = 돌아가지 않는 곧은 걸음.
          expect(d - leg.left).toBe(Math.abs(leg.cell.x - x) + Math.abs(leg.cell.y - y));
          // 화살표가 가리키는 축(크게 기운 쪽)으로 한 칸 걸으면 대상에 가까워진다.
          const dx = leg.cell.x - x, dy = leg.cell.y - y;
          const step = Math.abs(dx) >= Math.abs(dy) ? { x: x + Math.sign(dx), y } : { x, y: y + Math.sign(dy) };
          expect(field[step.y * map.width + step.x], `(${x},${y}) → (${leg.cell.x},${leg.cell.y})`).toBe(d - 1);
        }
      });

      it("shows the arrow for a visible target behind a wall and hides it when a straight walk reaches the target", () => {
        const { project, map } = world(walled);
        const targets = [{ x: 1, y: 0 }];
        const route = objectiveRoute(project, map, targets, new Set());
        // (1,4): 대상은 바로 위 4칸이지만 벽 너머다 — 예전 규칙(걸음 수 > 직선×1.5+4)은 화살표를 숨겼다.
        const behindWall = objectiveArrowAim(project, map, route, targets, { x: 1, y: 4 }, ON_SCREEN)!;
        expect(behindWall.cell).toEqual({ x: 4, y: 3 });
        expect(objectiveArrowAim(project, map, route, targets, { x: 4, y: 1 }, ON_SCREEN)).toBeUndefined();
        // 화면 밖이면 곧게 닿는 대상도 가리킨다.
        expect(objectiveArrowAim(project, map, route, targets, { x: 4, y: 1 }, OFF_SCREEN)!.cell).toEqual({ x: 1, y: 0 });
      });

      it("walks around a blocking event (a person or a locked door standing in the near gate)", () => {
        const { project, map } = world(["............", "............", "####.###.###", "............", "............"]);
        const targets = [{ x: 3, y: 0 }];
        const from = { x: 5, y: 4 };
        const open = objectiveRoute(project, map, targets, new Set());
        expect(objectiveArrowAim(project, map, open, targets, from, OFF_SCREEN)!.cell).toEqual({ x: 3, y: 0 }); // 가까운 성문 (4,2)을 곧게 지난다
        const nearGateBlocked = objectiveRoute(project, map, targets, new Set([2 * map.width + 4]));
        expect(nearGateBlocked.field[from.y * map.width + from.x]).toBeGreaterThan(open.field[from.y * map.width + from.x]!);
        expect(objectiveArrowAim(project, map, nearGateBlocked, targets, from, OFF_SCREEN)!.cell).toEqual({ x: 8, y: 3 }); // 먼 성문 앞
        // 두 성문이 다 막히면(말을 걸어야 비키는 사람) 타일 길로 그 사람 앞까지는 데려간다 — 직선으로 벽을 가리키지 않는다.
        const bothBlocked = objectiveRoute(project, map, targets, new Set([2 * map.width + 4, 2 * map.width + 8]));
        expect(bothBlocked.field[from.y * map.width + from.x]).toBe(-1);
        expect(objectiveArrowAim(project, map, bothBlocked, targets, from, OFF_SCREEN)!.kind).toBe("route");
      });

      it("measures the angle from the hero's cell centre (a target due east reads exactly east)", () => {
        const { project, map } = world(["....", "....", "...."]);
        const targets = [{ x: 3, y: 1 }];
        const route = objectiveRoute(project, map, targets, new Set());
        // 예전에는 발끝(칸 아래 끝)에서 재서 한 칸 옆 대상이 -27°(오른쪽 위)로 읽혔다.
        expect(objectiveArrowAim(project, map, route, targets, { x: 0, y: 1 }, OFF_SCREEN)!.angle).toBe(0);
        expect(objectiveArrowAim(project, map, route, targets, { x: 2, y: 1 }, OFF_SCREEN)!.angle).toBe(0);
        // 길을 못 찾으면 가장 가까운 대상으로 곧장.
        expect(objectiveArrowAim(project, map, null, targets, { x: 0, y: 1 }, OFF_SCREEN)).toMatchObject({ kind: "straight", angle: 0 });
      });

      it("does not aim through the pinch between two wall corners", () => {
        // (1,1)→(2,0) 대각선은 벽 모서리 (1,0)·(2,1) 사이 틈이다 — 그 틈으로는 못 걷는다.
        const { project, map } = world([".#...", "..#..", "....."]);
        const targets = [{ x: 4, y: 0 }];
        const route = objectiveRoute(project, map, targets, new Set());
        const aim = objectiveArrowAim(project, map, route, targets, { x: 1, y: 1 }, OFF_SCREEN)!;
        expect(aim.cell).not.toEqual({ x: 2, y: 0 });
        expect(route.field[aim.cell.y * map.width + aim.cell.x]).toBeLessThan(route.field[1 * map.width + 1]!);
      });
    });
  });
  describe("p2DayTransition", () => {
    isolateTimers();
    describe("P2 forage day-transition integration", () => {
      it("settles the source day then spawns destination-day forage through the one transition authority", () => {
        // Break caught: forage runs against the source season or outside the atomic day-transition draft.
        const project = p2LifeProject();
        const session = startSession(project, 501);
        session.shippingQueue = { item_trout: 1 };
        session.energy = 1;

        const result = transitionToNextDay(project, session, "1:spring:1");
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(result.reason);
        expect(result.receipt.stages).toEqual([
          "recovery", "shipping", "calendar", "dailyWeather", "rainWatering", "farm", "forage", "energy", "makers", "animals",
        ]);
        expect(result.receipt.forage).toMatchObject({ ok: true, dayKey: "1:spring:2", spawned: 2 });
        expect(session.shippingLastSettledDayKey).toBe("1:spring:1");
        expect(session.collections?.item_trout?.shippedCount).toBe(1);
        expect(session.forageLastAdvancedDayKey).toBe("1:spring:2");
        expect(session.energy).toBe(6);
      });

      it("rolls back shipping, calendar, forage, and energy when forage validation fails", () => {
        // Break caught: a mid-transition forage failure leaves prior stages committed.
        const project = p2LifeProject();
        project.system.seasonalForage!.areas[0]!.area.w = 0;
        const session = startSession(project, 502);
        session.shippingQueue = { item_trout: 1 };
        const before = structuredClone(session);

        expect(transitionToNextDay(project, session, "1:spring:1")).toEqual({ ok: false, reason: "forage", stage: "forage" });
        expect(session).toEqual(before);
      });
    });
  });
});

describe("playerSuite9", () => {
  isolateTimers();
  describe("playerLoadPanel", () => {
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
    function presentSnapshot(): SaveSnapshot {
      const project = createBlankProject();
      const session = startSession(project);
      return {
        ...createSaveSnapshot(project, session),
        mapName: "아주 긴 시작의 마을 바깥 평원 지도",
        partyLevel: 7,
        playTimeSeconds: 4262,
        // 로컬 시각 기준으로 생성해 타임존과 무관하게 기대값이 고정된다.
        savedAt: new Date(2026, 7, 21, 14, 5).toISOString(),
      };
    }
    function renderPanelWithStorage(
      storage: Storage,
      extra: { readonly onLoadAutosave?: () => void } = {},
    ): FakeElement {
      const previousWindow = globalThis.window;
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: { localStorage: storage },
      });
      try {
        return renderWithFakeDom(() => renderPlayerLoadPanel({
          fromTitle: true,
          onBack: () => undefined,
          onLoadSlot: () => undefined,
          ...extra,
        }));
      } finally {
        restoreWindow(previousWindow);
      }
    }
    function autosaveSnapshot(trigger: "transfer" | "battleVictory"): SaveSnapshot {
      return {
        ...presentSnapshot(),
        savedBy: "auto",
        autosaveTrigger: trigger,
      };
    }
    describe("player load panel", () => {
      it("renders the title load screen with the title background, not the system graphic", () => {
        const restoreDom = installFakeDom();
        try {
          const panel = renderPanelWithStorage(new MemoryStorage());

          expect(panel.className).toContain("oprn-load-panel");
          expect(findByTestId(panel, "player-load-window")?.className).toContain("oprn-load-window");
          expect(findByTestId(panel, "save-slot-1")?.className).toContain("oprn-load-slot");
          expect(findByTestId(panel, "player-load-back")).not.toBeNull();
          expect(panel.dataset.systemResource).toBeUndefined();
          expect(panel.style.backgroundImage).toMatch(/^url\("/);
        } finally {
          restoreDom();
        }
      });

      it("renders a present slot as a card with map name, level, play time, and saved-at", () => {
        const restoreDom = installFakeDom();
        try {
          const storage = new MemoryStorage();
          saveToSlot(storage, 1, presentSnapshot());
          const panel = renderPanelWithStorage(storage);

          const slot = findByTestId(panel, "save-slot-1");
          expect(slot).not.toBeNull();
          expect(slot?.className).toContain("is-present");
          expect(slot?.querySelector(".oprn-load-slot-title")?.textContent).toBe("1번 저장");
          expect(slot?.querySelector(".oprn-load-slot-map")?.textContent).toBe("아주 긴 시작의 마을 바깥 평원 지도");
          expect(slot?.querySelector(".oprn-load-slot-level")?.textContent).toBe("Lv 7");
          expect(slot?.querySelector(".oprn-load-slot-playtime")?.textContent).toBe("1:11:02");
          expect(slot?.querySelector(".oprn-load-slot-saved-at")?.textContent).toBe("2026.08.21 14:05");
        } finally {
          restoreDom();
        }
      });

      it("renders empty and corrupt slots as single-row status cards with the legacy wording", () => {
        const restoreDom = installFakeDom();
        try {
          const storage = new MemoryStorage();
          storage.setItem(saveSlotKey(2), "{broken json");
          const panel = renderPanelWithStorage(storage);

          const empty = findByTestId(panel, "save-slot-1");
          expect(empty?.className).toContain("is-empty");
          expect(empty?.querySelector(".oprn-load-slot-title")?.textContent).toBe("1번 저장: 비어 있음");
          expect(empty?.querySelector(".oprn-load-slot-map")).toBeNull();
          expect(empty?.querySelector(".oprn-load-slot-meta")).toBeNull();

          const corrupt = findByTestId(panel, "save-slot-2");
          expect(corrupt?.className).toContain("is-corrupt");
          expect(corrupt?.querySelector(".oprn-load-slot-title")?.textContent).toBe("2번 저장: 이상함");
          expect(corrupt?.querySelector(".oprn-load-slot-meta")).toBeNull();
          // 손상 안내 문구는 버튼 밖 별도 알림으로 유지된다.
          expect(findByTestId(panel, "save-slot-corrupt-2")?.textContent).toContain("2번 저장 칸 이상");
        } finally {
          restoreDom();
        }
      });

      it("keeps every slot as a BUTTON with the save-slot testid for the keyboard cursor menu", () => {
        const restoreDom = installFakeDom();
        try {
          const storage = new MemoryStorage();
          saveToSlot(storage, 1, presentSnapshot());
          storage.setItem(saveSlotKey(2), "{broken json");
          const panel = renderPanelWithStorage(storage);

          // player.ts 는 [data-testid^='save-slot-'] + tagName === "BUTTON" 으로 커서 메뉴를 붙인다.
          for (const slot of [1, 2, 3] as const) {
            const element = findByTestId(panel, `save-slot-${slot}`);
            expect(element?.tagName).toBe("BUTTON");
          }
          // 손상 알림은 접두사가 겹치지만 버튼이 아니어야 커서 메뉴에서 걸러진다.
          expect(findByTestId(panel, "save-slot-corrupt-2")?.tagName).toBe("DIV");
        } finally {
          restoreDom();
        }
      });

      it("renders a read-only autosave card on top when an autosave exists and the callback is wired", () => {
        const restoreDom = installFakeDom();
        try {
          const storage = new MemoryStorage();
          writeAutosave(storage, autosaveSnapshot("transfer"));
          saveToSlot(storage, 1, presentSnapshot());
          let loaded = 0;
          const panel = renderPanelWithStorage(storage, { onLoadAutosave: () => { loaded += 1; } });

          const card = findByTestId(panel, "save-slot-auto");
          expect(card).not.toBeNull();
          expect(card?.tagName).toBe("BUTTON");
          expect(card?.className).toContain("is-autosave");
          expect(card?.querySelector(".oprn-load-slot-title")?.textContent).toBe("자동 저장");
          expect(card?.querySelector(".oprn-load-slot-trigger")?.textContent).toBe("맵 이동");
          // 최상단: 수동 1번 슬롯보다 앞에 온다.
          const slots = findByTestId(panel, "player-load-slots");
          const first = slots?.childNodes[0];
          expect(first && (first as FakeElement).dataset?.testid).toBe("save-slot-auto");

          card?.dispatchEvent?.(new Event("click", { bubbles: true }));
          expect(loaded).toBe(1);
        } finally {
          restoreDom();
        }
      });

      it("renders no autosave card when the autosave slot is empty or the callback is omitted", () => {
        const restoreDom = installFakeDom();
        try {
          // 오토세이브 없음 + 콜백 있음 → 카드 없음.
          const empty = renderPanelWithStorage(new MemoryStorage(), { onLoadAutosave: () => undefined });
          expect(findByTestId(empty, "save-slot-auto")).toBeNull();

          // 오토세이브 있음 + 콜백 없음(레거시 호출부) → 카드 없음.
          const storage = new MemoryStorage();
          writeAutosave(storage, autosaveSnapshot("battleVictory"));
          const noCallback = renderPanelWithStorage(storage);
          expect(findByTestId(noCallback, "save-slot-auto")).toBeNull();
        } finally {
          restoreDom();
        }
      });

      it("maps autosave snapshots to a card model with the trigger label", () => {
        expect(autosaveCardModel(autosaveSnapshot("battleVictory"))).toEqual({
          title: "자동 저장",
          mapName: "아주 긴 시작의 마을 바깥 평원 지도",
          level: "Lv 7",
          playTime: "1:11:02",
          savedAt: "2026.08.21 14:05",
          trigger: "전투 승리",
        });
        // 구 스냅샷(트리거 없음)은 표기를 생략한다.
        expect(autosaveCardModel(presentSnapshot()).trigger).toBeUndefined();
        expect(autosaveTriggerLabel("transfer")).toBe("맵 이동");
        expect(autosaveTriggerLabel(undefined)).toBeUndefined();
      });

      it("formats saved-at as local 'YYYY.MM.DD HH:mm' and returns empty string for invalid ISO", () => {
        expect(formatSavedAt(new Date(2026, 0, 5, 9, 7).toISOString())).toBe("2026.01.05 09:07");
        expect(formatSavedAt(new Date(2025, 11, 31, 23, 59).toISOString())).toBe("2025.12.31 23:59");
        expect(formatSavedAt("not-a-date")).toBe("");
        expect(formatSavedAt("")).toBe("");
      });

      describe("saveSlotCardModel", () => {
        it("maps a present slot to a card model", () => {
          const slot: SaveSlotReadResult = { kind: "present", slot: 1, snapshot: presentSnapshot() };
          expect(saveSlotCardModel(slot)).toEqual({
            title: "1번 저장",
            mapName: "아주 긴 시작의 마을 바깥 평원 지도",
            level: "Lv 7",
            playTime: "1:11:02",
            savedAt: "2026.08.21 14:05",
          });
        });

        it("falls back to the project title when the map name is missing and drops invalid saved-at", () => {
          const base = presentSnapshot();
          const slot: SaveSlotReadResult = {
            kind: "present",
            slot: 2,
            snapshot: { ...base, projectTitle: "테스트 게임", mapName: undefined, savedAt: "garbage" },
          };
          const model = saveSlotCardModel(slot);
          expect(model.mapName).toBe("테스트 게임");
          expect(model.savedAt).toBeUndefined();
        });

        it("keeps the legacy single-line wording for empty and corrupt slots", () => {
          expect(saveSlotCardModel({ kind: "empty", slot: 2 })).toEqual({ title: "2번 저장: 비어 있음" });
          expect(saveSlotCardModel({ kind: "corrupt", slot: 3, message: "bad" })).toEqual({ title: "3번 저장: 이상함" });
        });

        it("is pure: same frozen input gives equal output and the input is not mutated", () => {
          const snapshot = presentSnapshot();
          const slot: SaveSlotReadResult = Object.freeze({
            kind: "present" as const,
            slot: 1 as const,
            snapshot: Object.freeze(snapshot) as SaveSnapshot,
          });
          const before = JSON.stringify(slot);
          const first = saveSlotCardModel(slot);
          const second = saveSlotCardModel(slot);
          expect(first).toEqual(second);
          expect(first).not.toBe(second);
          expect(JSON.stringify(slot)).toBe(before);
        });
      });
    });
    function restoreWindow(previousWindow: Window & typeof globalThis | undefined): void {
      if (previousWindow === undefined) {
        Reflect.deleteProperty(globalThis, "window");
        return;
      }
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: previousWindow,
      });
    }
  });
  describe("playerMenuItemPreview", () => {
    isolateTimers();
    function fixture() {
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      const item = project.database.items.find((item) => item.id === "item_potion")!;
      Object.assign(item, { type: "medicine", occasion: "always", scope: "ally", hpRecovery: { flat: 50, percentMax: 0 } });
      session.actorVitals[actorId] = { hp: 80, maxHp: 100, mp: 5, maxMp: 20 };
      session.inventory[item.id] = 2;
      return { project, session, actorId, item };
    }
    describe("menu item previews share the execution rules", () => {
      it("predicts clamped recovery without mutating the session or its random stream", () => {
        const { project, session, actorId, item } = fixture();
        const before = structuredClone(session);
        const preview = previewMenuItemTarget(project, session, item, actorId);
        expect(preview).toMatchObject({ hp: 80, hpAfter: 100, mp: 5, mpAfter: 5, reason: undefined });
        expect(session).toEqual(before);
        expect(useItemFromMenu(project, session, item.id, actorId).kind).toBe("used");
        expect(session.actorVitals[actorId]!.hp).toBe(preview.hpAfter);
        expect(session.inventory[item.id]).toBe(1);
      });

      it("does not advertise saved medicine effects after changing an item to goods", () => {
        const { project, session, actorId, item } = fixture();
        item.type = "normalGoods";
        const preview = previewMenuItemTarget(project, session, item, actorId);
        expect(preview.reason).toBeTruthy();
        expect(preview.hpAfter).toBe(80);
        expect(useItemFromMenu(project, session, item.id, actorId)).toEqual({ kind: "unusable", message: preview.reason });
        expect(session.inventory[item.id]).toBe(2);
      });

      it("explains battle-only items before opening a target list", () => {
        const { item } = fixture();
        item.occasion = "battle";
        expect(menuItemUnavailableReason(item)).toBe("전투 중에만 사용할 수 있습니다");
      });

      it("keeps state-removal targets usable even with full HP and MP", () => {
        const { project, session, actorId, item } = fixture();
        const state = project.database.states[0]!;
        item.healStateIds = [state.id];
        session.actorVitals[actorId] = { hp: 100, maxHp: 100, mp: 20, maxMp: 20 };
        session.actorStateIds[actorId] = [state.id];
        expect(previewMenuItemTarget(project, session, item, actorId).reason).toBeUndefined();
        expect(useItemFromMenu(project, session, item.id, actorId).kind).toBe("used");
        expect(session.actorStateIds[actorId]).toEqual([]);
      });

      it("explains dead-only and full-health targets without consuming a charge", () => {
        const { project, session, actorId, item } = fixture();
        item.onlyEffectiveOnDeadActors = true;
        expect(previewMenuItemTarget(project, session, item, actorId).reason).toContain("전투불능 대상");
        item.onlyEffectiveOnDeadActors = false;
        session.actorVitals[actorId]!.hp = 100;
        expect(previewMenuItemTarget(project, session, item, actorId).reason).toBe("적용할 효과가 없습니다");
        expect(session.inventory[item.id]).toBe(2);
      });
    });
  });
  // J62: 맵 탭·QA 걷기로 걷는 중 닿기 이벤트(놀래킴 대사)가 돌면 주인공은 칸 경계에서 멈춘다. 이벤트가 시킨 강제 이동은 계속 걷는다.
  describe("playerRouteYieldsToEvents", () => {
    isolateTimers();
    type Scene = Pick<PlaySceneContext, "playerRoute" | "playerSlide" | "playerSlideKind" | "running">;
    const scene = (): Scene => ({ playerRoute: null, playerSlide: null, playerSlideKind: null, running: false });
    const moves = [{ kind: "move" as const, dir: "right" as const }, { kind: "move" as const, dir: "right" as const }];
    describe("자유 걷기는 이벤트에 자리를 내준다", () => {
      it("이벤트가 돌면 탭 걷기를 그만둔다", () => {
        const s = scene();
        startPlayerRoute(s, moves, false);
        s.playerRoute!.yieldsToEvents = true;
        expect(yieldPlayerRouteToEvents(s, false)).toBe(false);
        s.running = true;
        expect(yieldPlayerRouteToEvents(s, false)).toBe(true);
        expect(s.playerRoute).toBeNull();
      });

      it("컷신 입력 잠금도 멈춘다", () => {
        const s = scene();
        startPlayerRoute(s, moves, false);
        s.playerRoute!.yieldsToEvents = true;
        expect(yieldPlayerRouteToEvents(s, true)).toBe(true);
      });

      it("이벤트가 시킨 강제 이동은 계속 걷는다", () => {
        const s = scene();
        startPlayerRoute(s, moves, false);
        s.running = true;
        expect(yieldPlayerRouteToEvents(s, true)).toBe(false);
        expect(s.playerRoute?.moves.length).toBe(2);
      });
    });
  });
  // 타이머가 0 이 되는 순간 타이머 조건 페이지를 다시 고르게 하는 두 조각(2026-10-31 sab-1031 A dungeon-2 「철창 닫힘」 20초 지연).
  describe("playSceneTimerPages", () => {
    isolateTimers();
    function scene(seconds: number): PlaySceneContext {
      return { session: { timers: { timer1: seconds }, timerActive: { timer1: true } }, runtimeTimers: new Map([["timer1", { remaining: seconds, active: true }]]) } as unknown as PlaySceneContext;
    }
    describe("timer condition pages", () => {
      it("reports a change only when the shown second changes, and when the timer hits 0", () => {
        const s = scene(2);
        expect(updateRuntimeTimers(s, 400)).toBe(false); // 1.6s → 2 shown
        expect(updateRuntimeTimers(s, 700)).toBe(true); // 0.9s → 1 shown
        expect(updateRuntimeTimers(s, 2000)).toBe(true); // 0 → stops
        expect(s.session.timers.timer1).toBe(0);
        expect(s.runtimeTimers.get("timer1")!.active).toBe(false);
        expect(updateRuntimeTimers(s, 1000)).toBe(false);
      });

      it("finds auto pages gated on a timer, inside condition groups too", () => {
        const map = { events: [
          { id: "ev_gate", pages: [
            { id: "p0", conditions: [], trigger: { kind: "parallel" } },
            { id: "p1", conditions: [{ kind: "switch", switchId: "sw", value: true }, { kind: "timer", timerId: "timer1", seconds: 0 }], trigger: { kind: "auto" } },
          ] },
          { id: "ev_sign", pages: [{ id: "q0", conditions: [{ kind: "any", conditions: [{ kind: "timer", timerId: "timer2", seconds: 5, op: ">=" }] }], trigger: { kind: "action" } }] },
          { id: "ev_npc", pages: [{ id: "r0", conditions: [{ kind: "switch", switchId: "sw", value: true }], trigger: { kind: "action" } }] },
        ] } as unknown as GameMap;
        expect(timerConditionPages(map)).toEqual([
          { eventId: "ev_gate", pageId: "p1", auto: true },
          { eventId: "ev_sign", pageId: "q0", auto: false },
        ]);
      });
    });
  });
  describe("playSurfaceScale", () => {
    isolateTimers();
    describe("calculatePlaySurfaceScale", () => {
      it("allows a 1.5x step when 1x would leave more than 35% of the box empty", () => {
        expect(calculatePlaySurfaceScale(768, 740, 480, 270)).toBe(1.5); // iPad mini portrait: 1x fills 23%
        expect(calculatePlaySurfaceScale(863, 316, 480, 270)).toBe(1); // below 1.5x: stays 1x
        expect(calculatePlaySurfaceScale(1280, 720, 480, 270)).toBe(2); // 2x and up stay integer
      });

      it("uses the largest integer contain scale while the logical stage fits at 1x", () => {
        expect(calculatePlaySurfaceScale(1600, 900)).toBe(3);
        expect(calculatePlaySurfaceScale(1280, 800)).toBe(3);
        expect(calculatePlaySurfaceScale(960, 720)).toBe(3);
        expect(calculatePlaySurfaceScale(800, 600)).toBe(2);
        expect(calculatePlaySurfaceScale(640, 480)).toBe(2);
        expect(calculatePlaySurfaceScale(400, 300)).toBe(1);
        expect(calculatePlaySurfaceScale(320, 240)).toBe(1);
      });

      it("rounds down when either axis cannot fit the next exact multiple", () => {
        expect(calculatePlaySurfaceScale(1279, 960)).toBe(3);
        expect(calculatePlaySurfaceScale(1280, 959)).toBe(3);
      });

      it("shrinks oversized logical stages to keep the full game visible", () => {
        // Break named: the current scale floor of 1 crops custom resolutions larger than the host.
        expect(calculatePlaySurfaceScale(300, 200)).toBeCloseTo(5 / 6);
        expect(calculatePlaySurfaceScale(1320, 690, 1920, 1080)).toBeCloseTo(23 / 36);
      });

      it("keeps scale 1 until a viewport has a measurable size", () => {
        expect(calculatePlaySurfaceScale(0, 0)).toBe(1);
        expect(calculatePlaySurfaceScale(-100, Number.NaN)).toBe(1);
      });

      it("supports custom logical dimensions", () => {
        expect(calculatePlaySurfaceScale(800, 600, 400, 300)).toBe(2);
        expect(calculatePlaySurfaceScale(801, 600, 400, 300)).toBe(2);
      });
    });
    describe("calculatePlaySurfaceScale scale modes", () => {
      // 실측: 테스트 플레이 창 본문 1214x640 CSS px / 논리 320x240 에서 integer 모드는 2.000 이라
      // 640x480 만 그리고 나머지 73% 가 죽은 레터박스였다. 배포/커뮤니티 플레이어는 이 값이 바뀌면 안 된다.
      it("keeps the shipped integer contain scale for the measured test play window body", () => {
        expect(calculatePlaySurfaceScale(1214, 640, 320, 240)).toBe(2);
        expect(calculatePlaySurfaceScale(1214, 640, 320, 240, "integer")).toBe(2);
      });

      it("returns the unfloored contain scale in fit mode so the window is filled", () => {
        expect(calculatePlaySurfaceScale(1214, 640, 320, 240, "fit")).toBeCloseTo(8 / 3);
        expect(calculatePlaySurfaceScale(1600, 900, 320, 240, "fit")).toBeCloseTo(3.75);
      });

      it("treats shrinking and empty viewports identically in both modes", () => {
        expect(calculatePlaySurfaceScale(300, 200, 320, 240, "fit")).toBeCloseTo(5 / 6);
        expect(calculatePlaySurfaceScale(300, 200, 320, 240, "integer")).toBeCloseTo(5 / 6);
        expect(calculatePlaySurfaceScale(0, 0, 320, 240, "fit")).toBe(1);
      });

      it("reports no crop for a fractional fit scale", () => {
        const scale = calculatePlaySurfaceScale(1214, 640, 320, 240, "fit");
        const crop = calculatePlaySurfaceCropMetrics(1214, 640, scale, 320, 240);
        expect(crop.left).toBe(0);
        expect(crop.top).toBe(0);
        expect(crop.visibleWidth).toBe(320);
        expect(crop.visibleHeight).toBe(240);
        const placement = calculatePlaySurfacePlacement(1214, 640, scale, 320, 240);
        expect(placement.top).toBe(0);
        expect(placement.left).toBeCloseTo((1214 - 320 * (8 / 3)) / 2);
      });
    });
    describe("calculatePlaySurfaceCropMetrics", () => {
      it("reports no crop when contain scaling leaves letterbox space", () => {
        const cases: Array<readonly [number, number]> = [
          [1600, 900],
          [1280, 800],
          [960, 720],
          [800, 600],
          [640, 480],
          [400, 300],
          [320, 240],
        ];
        for (const [w, h] of cases) {
          const crop = calculatePlaySurfaceCropMetrics(w, h, calculatePlaySurfaceScale(w, h));
          expect(crop.left).toBe(0);
          expect(crop.right).toBe(0);
          expect(crop.top).toBe(0);
          expect(crop.bottom).toBe(0);
          expect(crop.visibleWidth).toBe(320);
          expect(crop.visibleHeight).toBe(240);
        }
      });

      it("reports the full logical stage after automatic contain shrinking", () => {
        // Break named: crop metrics currently coerce a fractional fit scale back to 1.
        const scale = calculatePlaySurfaceScale(300, 200);
        const crop = calculatePlaySurfaceCropMetrics(300, 200, scale);
        expect(crop.left).toBe(0);
        expect(crop.right).toBe(0);
        expect(crop.top).toBe(0);
        expect(crop.bottom).toBe(0);
        expect(crop.visibleWidth).toBe(320);
        expect(crop.visibleHeight).toBe(240);
      });
    });
    describe("calculatePlaySurfacePlacement", () => {
      it("centers a fractionally scaled stage inside the host instead of centering its unscaled box", () => {
        // Break named: CSS grid safely aligns an overflowing unscaled stage to the start edge,
        // so transform-origin center shifts the contained pixels down and right.
        const scale = calculatePlaySurfaceScale(1320, 690, 1920, 1080);
        const placement = calculatePlaySurfacePlacement(1320, 690, scale, 1920, 1080);
        expect(placement.left).toBeCloseTo(140 / 3);
        expect(placement.top).toBe(0);
      });

      it("keeps an integer-scaled stage on whole screen pixels so pixel text is not shifted half a pixel", () => {
        // Break named: a 1281×721 window at 2× put the stage at (160.5, 90.5) and blurred the canvas and the dialogue font.
        const placement = calculatePlaySurfacePlacement(1281, 721, 2, 480, 270);
        expect(placement.left).toBe(160);
        expect(placement.top).toBe(90);
      });
    });
  });
  // QA 체크포인트 startTroopId: 필드 적 이벤트 id 는 굽기마다 새로 뽑히므로, 부대 id 로 그 부대와 싸우는 맵 이벤트를 찾는다.
  describe("qaCheckpointStartTroop", () => {
    isolateTimers();
    function fieldEnemy(id: string, x: number, y: number, troopId: string): GameEvent {
      return {
        id, x, y, trigger: { kind: "eventTouch" }, commands: [],
        pages: [{
          id: `${id}_fight`, name: "필드 적", conditions: [], trigger: { kind: "eventTouch" },
          commands: [{ kind: "fork", condition: { kind: "switch", switchId: "sw_x", value: true },
            then: [{ kind: "battleProcessing", troopId, canEscape: true, canLose: false }] }],
        }],
      } as unknown as GameEvent;
    }
    function projectWith(events: GameEvent[]): { project: Project; mapId: string } {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.maps[mapId]!.events.push(...events);
      return { project, mapId };
    }
    describe("QA checkpoint startTroopId", () => {
      it("finds the field enemy that fights the troop, whatever its generated id", () => {
        const { project, mapId } = projectWith([
          fieldEnemy("ev_field_enemy_aaa", 3, 3, "troop_wolves"),
          fieldEnemy("ev_field_enemy_bbb", 9, 9, "troop_golem"),
        ]);
        const checkpoint: QaCheckpoint = { id: "golem", mapId, x: 9, y: 10, startTroopId: "troop_golem" };
        const session = sessionFromQaCheckpoint(project, checkpoint);
        expect(qaCheckpointStartEventId(project, checkpoint, session.currentMapId)).toBe("ev_field_enemy_bbb");
      });

      it("picks the event nearest the player when several fight the same troop", () => {
        const { project, mapId } = projectWith([
          fieldEnemy("ev_field_enemy_far", 1, 1, "troop_dogs"),
          fieldEnemy("ev_field_enemy_near", 14, 3, "troop_dogs"),
        ]);
        const checkpoint: QaCheckpoint = { id: "dogs", mapId, x: 14, y: 4, startTroopId: "troop_dogs" };
        expect(qaCheckpointStartEventId(project, checkpoint, mapId)).toBe("ev_field_enemy_near");
      });

      it("keeps startEventId ahead of startTroopId", () => {
        const { project, mapId } = projectWith([fieldEnemy("ev_field_enemy_aaa", 3, 3, "troop_wolves")]);
        const checkpoint: QaCheckpoint = { id: "fixed", mapId, startEventId: "ev_field_enemy_aaa", startTroopId: "troop_missing" };
        expect(qaCheckpointStartEventId(project, checkpoint, mapId)).toBe("ev_field_enemy_aaa");
      });

      it("throws when no event on the map fights the troop", () => {
        const { project, mapId } = projectWith([fieldEnemy("ev_field_enemy_aaa", 3, 3, "troop_wolves")]);
        expect(() => qaCheckpointStartEventId(project, { id: "none", mapId, startTroopId: "troop_golem" }, mapId))
          .toThrow(/부대 troop_golem 와 싸우는 이벤트가 없다/u);
      });
    });
  });
  describe("routeOpacityPersists", () => {
    isolateTimers();
    // 이동 경로 changeOpacity 는 경로가 끝난 뒤에도 남는다 — 흐려져 떠난 인물이 다음 표면 갱신에 255 로 되살아나
    // 몸과 들고 있던 빛이 다시 보였다(폴른 스타 B4 숲지기, 2026-11-03).
    describe("route changeOpacity persists", () => {
      it("records the faded opacity for the event and clears it at full opacity", () => {
        const eventOpacityOverrides: EventOpacityOverrides = new Map();
        const alphas: number[] = [];
        const sprite = { setAlpha: (a: number) => alphas.push(a) };
        const mover = { opacity: 255 } as never as { opacity: number };
        const ctx = { scene: { eventOpacityOverrides }, eventId: "ev_bram", mover } as never;
        const target = { mover, view: { pageId: "forest" }, sprite } as never;
        executeInstantCommand(ctx, target, { kind: "changeOpacity", delta: -255 } as never);
        expect(keptEventOpacity(eventOpacityOverrides, "ev_bram", "forest")).toBe(0);
        expect(alphas.at(-1)).toBe(0);
        executeInstantCommand(ctx, target, { kind: "changeOpacity", delta: 255 } as never);
        expect(eventOpacityOverrides.has("ev_bram")).toBe(false);
      });

      it("forgets the kept opacity once the event shows another page", () => {
        const overrides: EventOpacityOverrides = new Map([["ev_bram", { pageId: "leaving", opacity: 0 }]]);
        expect(keptEventOpacity(overrides, "ev_bram", "leaving")).toBe(0);
        expect(keptEventOpacity(overrides, "ev_bram", "back")).toBeUndefined();
        expect(overrides.has("ev_bram")).toBe(false);
      });
    });
  });
  describe("runtimeCursorMenu", () => {
    isolateTimers();
    // fakeDom 은 KeyboardEvent 클래스가 없으므로 dispatchEvent 가 읽는 필드만 갖춘 가짜 이벤트를 만든다.
    function keydown(key: string): KeyboardEvent {
      return {
        type: "keydown",
        key,
        bubbles: true,
        defaultPrevented: false,
        target: null,
        isComposing: false,
        repeat: false,
        preventDefault(): void {
          (this as { defaultPrevented: boolean }).defaultPrevented = true;
        },
        stopPropagation(): void {},
      } as unknown as KeyboardEvent;
    }
    describe("attachCursorMenu (DOM)", () => {
      let restore: () => void;
      beforeEach(() => {
        restore = installFakeDom();
      });
      afterEach(() => {
        restore();
      });

      function build(count: number): { root: HTMLElement; items: HTMLElement[]; clicks: number[] } {
        const root = document.createElement("div");
        const items: HTMLElement[] = [];
        const clicks: number[] = [];
        for (let i = 0; i < count; i += 1) {
          const button = document.createElement("button");
          button.dataset.testid = `item-${i}`;
          button.addEventListener("click", () => clicks.push(i));
          root.append(button);
          items.push(button);
        }
        document.body.append(root);
        return { root, items, clicks };
      }

      it("selects the first item and moves with wrapping arrows", () => {
        const { root, items } = build(3);
        attachCursorMenu(root, { items });
        expect(items[0].classList.contains("selected")).toBe(true);

        root.dispatchEvent(keydown("ArrowDown"));
        expect(items[1].classList.contains("selected")).toBe(true);
        expect(items[0].classList.contains("selected")).toBe(false);
        expect(items[1].getAttribute("aria-current")).toBe("true");

        root.dispatchEvent(keydown("ArrowUp"));
        root.dispatchEvent(keydown("ArrowUp"));
        expect(items[2].classList.contains("selected")).toBe(true);
      });

      it("confirm key (Z / Enter) clicks the selected item", () => {
        const { root, items, clicks } = build(3);
        attachCursorMenu(root, { items });
        root.dispatchEvent(keydown("ArrowDown"));
        root.dispatchEvent(keydown("z"));
        expect(clicks).toEqual([1]);
        root.dispatchEvent(keydown("Enter"));
        expect(clicks).toEqual([1, 1]);
        void items;
      });

      it("cancel key (X / Esc) clicks the cancel element", () => {
        const { root, items } = build(2);
        const cancel = document.createElement("button");
        let cancelled = 0;
        cancel.addEventListener("click", () => {
          cancelled += 1;
        });
        root.append(cancel);
        attachCursorMenu(root, { items, cancelEl: cancel });
        root.dispatchEvent(keydown("x"));
        expect(cancelled).toBe(1);
        root.dispatchEvent(keydown("Escape"));
        expect(cancelled).toBe(2);
      });

      it("onHorizontal consumes ←→ without moving the cursor", () => {
        const { root, items } = build(3);
        const dirs: number[] = [];
        attachCursorMenu(root, {
          items,
          onHorizontal: (dir) => {
            dirs.push(dir);
            return true;
          },
        });
        root.dispatchEvent(keydown("ArrowRight"));
        root.dispatchEvent(keydown("ArrowLeft"));
        expect(dirs).toEqual([1, -1]);
        expect(items[0].classList.contains("selected")).toBe(true);
      });

      it("stops handling and clears selection after detach", () => {
        const { root, items, clicks } = build(3);
        const detach = attachCursorMenu(root, { items });
        detach();
        root.dispatchEvent(keydown("ArrowDown"));
        root.dispatchEvent(keydown("z"));
        expect(clicks).toEqual([]);
        expect(items[0].classList.contains("selected")).toBe(false);
        expect(items[0].classList.contains("rm-nav-item")).toBe(false);
      });

      it("skips disabled items", () => {
        const { root, items } = build(3);
        (items[1] as unknown as { disabled: boolean }).disabled = true;
        attachCursorMenu(root, { items });
        root.dispatchEvent(keydown("ArrowDown"));
        expect(items[2].classList.contains("selected")).toBe(true);
        expect(items[1].classList.contains("selected")).toBe(false);
      });
    });
  });
});
