// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playCinematicSequence, type CinematicPlayback } from "@/player/cinematicSequence";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import type { CinematicScene, Project, Command } from "@/project/types";
import { startSession, type PlaySession } from "@/project/session";
import { store } from "@/project/store";
import { createLifeLedgerDetail } from "@/player/lifeLedger";
import { playerCanStep } from "@/player/playSceneMovement";
import { renderPlaceableOverlays } from "@/player/playScenePlaceables";
import type { StatusMenuDetail } from "@/player/playerStatusMenuDetailTypes";
import { adjacentSpatialPosition } from "@/project/spatialOccupancy";
import { resolvePlayerBody } from "@/project/playerFootprint";
import { installPlayPointerBlocker, shouldBlockPlayPointerEvent } from "@/player/playInputBlocker";
import { mountPlayLoadingOverlay } from "@/player/playLoadingOverlay";
import { createPlaySurface } from "@/player/playSurface";
import { preparePublication, upgradePublication } from "@/project/publication";
import { appendPredecessorSaveImports } from "@/player/predecessorSaveImports";
import { createSaveSnapshot, readSaveSlot, saveSlotKey, setSavePublication } from "@/player/saveSlots";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { getRelationshipState, setRelationshipState } from "@/project/relationshipState";
import { createDialogueUI } from "@/player/dialogue";
import type Phaser from "phaser";
import { Input } from "@/player/input";
import { isTextEntryTarget } from "@/player/keyBindings";
import { backgroundPreloadTurn, holdBackgroundPreload, preloadUrls } from "@/player/scenePreload";
import { affordableQuantityMax, shopQuantityMaxIn, SHOP_BAG_FULL_REASON, SHOP_GOLD_CAP_REASON, SHOP_QUANTITY_HARD_MAX, toGoods } from "@/player/playSceneShopParts";
import { GOLD_MAX } from "@/project/economyValues";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { adjustShopQuantity, createShopOverlay, renderShopItems, updateShopQuantityTotal } from "@/player/playSceneShopDom";
import { emitRuntimeJuice, runtimeJuiceLog } from "@/player/runtimeJuice";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import { resolveTerms } from "@/project/terms";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { ShopStep } from "@/player/playSceneShop";
import type { ItemRecord } from "@/project/types/database";
import { attachEmeraldShopInput } from "@/player/emeraldShopInput";
import { attachShopDecisionInput } from "@/player/shopDecisionInput";
import { isolateTimers } from "./mergedTeardown";

describe("openingMusicRuntime", () => {
  isolateTimers();
  const scenes: CinematicScene[] = [
    { id: "one", kind: "text", narration: "첫 장면", durationMs: 0 },
    { id: "two", kind: "text", narration: "둘째 장면", durationMs: 0 },
  ];
  let host: HTMLElement;
  let project: Project;
  let controller: AbortController;
  let playback: CinematicPlayback | undefined;
  const play = vi.fn<() => Promise<void>>();
  const pause = vi.fn();
  function start(musicResourceId?: string, skippable = true): CinematicPlayback {
    playback = playCinematicSequence({
      host,
      project,
      sequence: { enabled: true, skippable, scenes, ...(musicResourceId ? { musicResourceId } : {}) },
      signal: controller.signal,
    });
    return playback;
  }
  function root(): HTMLElement {
    const node = host.querySelector<HTMLElement>('[data-testid="cinematic-sequence"]');
    if (!node) throw new Error("Missing cinematic root");
    return node;
  }
  function music(): HTMLAudioElement | null {
    return host.querySelector<HTMLAudioElement>('[data-testid="cinematic-music"]');
  }
  function press(key: string): void {
    (document.activeElement ?? document).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  }
  beforeEach(() => {
    project = createBlankProject();
    project.assets.uploaded = {
      bgm: { id: "bgm", name: "오프닝 곡", kind: "music", dataUrl: "data:audio/ogg;base64,AQID", meta: {} },
    };
    host = document.createElement("div");
    document.body.append(host);
    controller = new AbortController();
    play.mockReset().mockResolvedValue();
    pause.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  });
  afterEach(() => {
    playback?.teardown();
    playback = undefined;
    controller.abort();
    host.remove();
    vi.restoreAllMocks();
  });
  describe("오프닝 배경음악 재생", () => {
    it("음악이 없으면 오디오 요소를 만들지 않는다", () => {
      start();
      expect(music()).toBeNull();
      expect(root().dataset.music).toBeUndefined();
    });

    it("시퀀스 시작에 반복 재생하고 장면이 넘어가도 끊지 않는다", async () => {
      start("bgm");
      const audio = music();
      expect(audio).not.toBeNull();
      expect(audio?.loop).toBe(true);
      expect(root().dataset.music).toBe("bgm");
      // #3440: 재생은 assets.prepareAudio 가 풀린 뒤에 건다(애니매틱을 얼리지 않게) — 마이크로태스크를 기다린다.
      await vi.waitFor(() => expect(play).toHaveBeenCalled());
      press("Enter");
      expect(root().dataset.sceneId).toBe("two");
      expect(music()).toBe(audio);
      expect(pause).not.toHaveBeenCalled();
    });

    it("끝나면 멈추고 정리한다", async () => {
      const run = start("bgm");
      press("Enter");
      press("Enter");
      await expect(run.done).resolves.toBe("completed");
      expect(pause).toHaveBeenCalled();
      expect(music()).toBeNull();
    });

    it("건너뛰어도 멈춘다", async () => {
      const run = start("bgm");
      press("Escape");
      await expect(run.done).resolves.toBe("skipped");
      expect(pause).toHaveBeenCalled();
    });

    it("재생할 수 없는 음악은 장면 진행을 막지 않는다", () => {
      start("없는-곡");
      expect(root().dataset.mediaState).toBe("ready");
      press("Enter");
      expect(root().dataset.sceneId).toBe("two");
    });
  });
});

describe("p2SpatialPlayIntegration", () => {
  isolateTimers();
  function spatialProject() {
    const project = createBlankProject();
    const item = project.database.items[0];
    if (!item) throw new Error("blank project requires a starter item");
    const itemId = item.id;
    project.database.farmBuildingTypes = [{
      id: "shed",
      name: "Shed",
      levels: [{
        level: 1,
        footprint: { width: 2, height: 1 },
        capacity: 4,
        graphicResourceId: "building-default",
        orientationGraphicResourceIds: { left: "building-left" },
      }],
    }];
    project.database.homeDecorationTypes = [{
      id: "table",
      name: "Table",
      placementItemId: itemId,
      footprint: { width: 1, height: 1 },
      blocksMovement: false,
      allowedOrientations: ["down", "left"],
      graphicResourceId: "decor-default",
    }];
    return { project, itemId };
  }
  function activate(detail: StatusMenuDetail, testId: string): void {
    const entry = detail.entries.find((candidate) => candidate.testId === testId);
    expect(entry, `missing ledger action ${testId}`).toBeDefined();
    expect(entry?.disabled).not.toBe(true);
    entry?.onActivate?.();
  }
  describe("P2 spatial play integration", () => {
    it("lets the player place, move, and remove buildings and decorations from the life ledger", () => {
      // Given: authored spatial types and enough inventory to place one decoration.
      const { project, itemId } = spatialProject();
      const session = startSession(project, 1201);
      session.currentMapId = project.startMapId;
      session.x = 2;
      session.y = 2;
      session.inventory[itemId] = 1;
      const mutations: boolean[] = [];
      const liveFor = (current: PlaySession) => () => {
        const body = resolvePlayerBody(project, current);
        return {
          player: {
            mapId: current.currentMapId,
            x: current.x,
            y: current.y,
            footprint: body.footprint,
            passRows: body.passRows,
          },
          npcs: [],
        };
      };
      const adjacent = (current: PlaySession, width: number, height: number) => {
        const body = resolvePlayerBody(project, current);
        return adjacentSpatialPosition(
          { mapId: current.currentMapId, x: current.x, y: current.y, footprint: body.footprint, passRows: body.passRows },
          "down",
          { width, height },
          "down",
        );
      };
      const detail = (): StatusMenuDetail => createLifeLedgerDetail({
        project,
        session,
        tab: "spaces",
        onMutation: (ok) => mutations.push(ok),
        readLive: liveFor(session),
        placementDirection: "down",
      });

      // When: each player-facing building action is activated against the adjacent body, not the foot tile.
      const buildingAt = adjacent(session, 2, 1);
      expect(buildingAt).toEqual({ mapId: project.startMapId, x: 2, y: 3, orientation: "down" });
      expect(detail().entries.find((entry) => entry.testId === "life-ledger-space-building-place-shed")?.value)
        .toBe(`${project.startMapId} (2, 3)`);
      activate(detail(), "life-ledger-space-building-place-shed");
      const buildingId = Object.keys(session.farmBuildingPlacements ?? {})[0];
      if (!buildingId) throw new Error("building placement was not created");
      expect(session.farmBuildingPlacements?.[buildingId]).toMatchObject({ x: 2, y: 3 });
      expect(session.farmBuildingPlacements?.[buildingId]).not.toMatchObject({ x: 2, y: 2 });
      session.x = 5;
      const movedBuilding = adjacent(session, 2, 1);
      activate(detail(), `life-ledger-space-building-move-${buildingId}`);
      expect(session.farmBuildingPlacements?.[buildingId]).toMatchObject({ x: movedBuilding.x, y: movedBuilding.y });
      expect(session.farmBuildingPlacements?.[buildingId]).not.toMatchObject({ x: 5, y: 2 });
      activate(detail(), `life-ledger-space-building-remove-${buildingId}`);

      // Then: decoration place/move/remove is reachable through the same ledger and conserves its item.
      session.x = 8;
      const decorationAt = adjacent(session, 1, 1);
      activate(detail(), "life-ledger-space-decoration-place-table");
      const decorationId = Object.keys(session.homeDecorationPlacements ?? {})[0];
      if (!decorationId) throw new Error("decoration placement was not created");
      expect(session.inventory[itemId] ?? 0).toBe(0);
      expect(session.homeDecorationPlacements?.[decorationId]).toMatchObject({ x: decorationAt.x, y: decorationAt.y });
      expect(session.homeDecorationPlacements?.[decorationId]).not.toMatchObject({ x: 8, y: 2 });
      session.x = 10;
      const movedDecoration = adjacent(session, 1, 1);
      activate(detail(), `life-ledger-space-decoration-move-${decorationId}`);
      expect(session.homeDecorationPlacements?.[decorationId]).toMatchObject({ x: movedDecoration.x, y: movedDecoration.y });
      activate(detail(), `life-ledger-space-decoration-remove-${decorationId}`);
      expect(session.inventory[itemId]).toBe(1);
      expect(session.farmBuildingPlacements).toEqual({});
      expect(session.homeDecorationPlacements).toEqual({});
      expect(mutations).toEqual([true, true, true, true, true, true]);
    });

    it("renders current-map placements with orientation-specific graphics and fallback graphics", () => {
      // Given: one rotated building and one decoration on the current map.
      const { project } = spatialProject();
      const session = startSession(project, 1202);
      session.farmBuildingPlacements = {
        shed_1: {
          instanceId: "shed_1",
          typeId: "shed",
          level: 1,
          mapId: project.startMapId,
          x: 2,
          y: 3,
          orientation: "left",
        },
      };
      session.homeDecorationPlacements = {
        table_1: {
          instanceId: "table_1",
          typeId: "table",
          mapId: project.startMapId,
          x: 6,
          y: 4,
          orientation: "down",
        },
      };
      store.replaceProject(project);
      const calls: unknown[][] = [];
      const added: unknown[] = [];
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("blank project requires a start map");
      const scene = {
        map,
        session,
        tileLayer: { add: (object: unknown) => added.push(object) },
        add: {
          sprite: (...args: unknown[]) => {
            calls.push(args);
            return { setOrigin() {}, setDepth() {} };
          },
        },
      };

      // When: the map's existing session-overlay renderer runs.
      renderPlaceableOverlays(scene);

      // Then: the selected orientation resource and the default fallback are consumed as textures.
      expect(calls.map((args) => args[2])).toEqual(["building-left", "decor-default"]);
      expect(added).toHaveLength(2);
    });

    it("consults decoration blocksMovement when the player steps into its footprint", () => {
      // Given: a non-blocking decoration in the destination tile.
      const { project } = spatialProject();
      const session = startSession(project, 1203);
      session.homeDecorationPlacements = {
        table_1: {
          instanceId: "table_1",
          typeId: "table",
          mapId: project.startMapId,
          x: 3,
          y: 2,
          orientation: "down",
        },
      };
      store.replaceProject(project);
      const map = project.maps[project.startMapId];
      const decorationType = project.database.homeDecorationTypes?.[0];
      if (!map || !decorationType) throw new Error("spatial fixture is incomplete");
      const scene = { map, session, tileX: 2, tileY: 2 };

      // When/Then: non-blocking decor permits the step, while the same authored footprint blocks when enabled.
      expect(playerCanStep(scene, { footprint: { width: 1, height: 1 }, passRows: 1 }, 1, 0)).toBe(true);
      project.database.homeDecorationTypes = [{
        ...decorationType,
        blocksMovement: true,
      }];
      store.replaceProject(project);
      expect(playerCanStep(scene, { footprint: { width: 1, height: 1 }, passRows: 1 }, 1, 0)).toBe(false);
    });
  });
});

describe("playInputBlocker", () => {
  isolateTimers();
  const FORCE_BLOCK_GLOBAL = globalThis as { __oprnForcePointerBlock?: boolean };
  describe("play pointer blocker", () => {
    beforeEach(() => {
      FORCE_BLOCK_GLOBAL.__oprnForcePointerBlock = true;
    });

    afterEach(() => {
      delete FORCE_BLOCK_GLOBAL.__oprnForcePointerBlock;
    });

    it("blocks trusted mouse-style clicks while allowing keyboard-synthetic button clicks", () => {
      expect(shouldBlockPlayPointerEvent({ type: "pointerdown" })).toBe(true);
      expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1 })).toBe(true);
      expect(shouldBlockPlayPointerEvent({ type: "click", detail: 0 })).toBe(false);
      expect(shouldBlockPlayPointerEvent({ type: "click" })).toBe(false);
    });

    it("lets the wheel through over scrollable reading lists and nowhere else", () => {
      for (const className of ["status-menu-detail-list", "dialogue-backlog-list", "dialogue-log-list"]) {
        const list = document.createElement("ol");
        list.className = className;
        const row = document.createElement("li");
        list.append(row);
        expect(shouldBlockPlayPointerEvent({ type: "wheel", target: row })).toBe(false);
        // 목록 위라도 누르기·움직임은 그대로 막는다.
        expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: row })).toBe(true);
        expect(shouldBlockPlayPointerEvent({ type: "mousemove", target: row })).toBe(true);
      }
      expect(shouldBlockPlayPointerEvent({ type: "wheel", target: document.createElement("div") })).toBe(true);
    });

    it("blocks title-control pointers with the rest of keyboard-only play", () => {
      const g = globalThis as { __oprnForcePointerBlock?: boolean };
      g.__oprnForcePointerBlock = true;
      try {
        const titleControls = document.createElement("section");
        titleControls.dataset.playInputOwner = "title-controls";
        const option = document.createElement("button");
        titleControls.append(option);
        expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1, target: option })).toBe(true);
        expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: option })).toBe(true);
        // 필드 클릭은 여전히 차단
        expect(
          shouldBlockPlayPointerEvent({ type: "click", detail: 1, target: document.createElement("div") })
        ).toBe(true);
      } finally {
        delete g.__oprnForcePointerBlock;
      }
    });

    it("allows only explicitly owned touch and host-fullscreen descendants", () => {
      const touchOwner = document.createElement("div");
      touchOwner.dataset.playInputOwner = "touch-controls";
      const control = document.createElement("button");
      touchOwner.append(control);
      const fullscreen = document.createElement("button");
      fullscreen.dataset.playInputOwner = "host-fullscreen";
      const ordinaryStage = document.createElement("div");

      expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: control })).toBe(false);
      expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: fullscreen })).toBe(false);
      expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: ordinaryStage })).toBe(true);
    });

    // 사장 1.37 VQA D1(2026-11-05): 데스크톱 1440 에서 전투 커맨드 여섯 개가 모두 마우스로
    // 눌리지 않았다(같은 버튼 Enter 는 대상 선택을 열었다, 아이폰 터치는 동작했다). 원인은 둘이었다 —
    // 09-keyboard-result-panel.css 가 pointer-events:none 을 걸었고, 게다 이 차단기가 capture 단계에서
    // detail>0 인 실제 click 을 막았다. 커맨드·대상은 누름/클릭만 통과하고 나머지 포인터는 그대로 막는지 고정한다.
    it("lets real mouse clicks reach battle commands and enemy targets", () => {
      const scene = document.createElement("div");
      scene.className = "battle-scene";
      const commandHost = document.createElement("div");
      commandHost.className = "battle-command-host";
      const button = document.createElement("button");
      button.className = "battle-command";
      const label = document.createElement("strong");
      commandHost.append(button);
      button.append(label);
      scene.append(commandHost);
      const field = document.createElement("div");
      field.className = "battle-field";
      const sprite = document.createElement("div");
      sprite.dataset.battleTargetable = "true";
      sprite.dataset.battleTargetId = "enemy-1";
      field.append(sprite);
      scene.append(field);

      // 커맨드 단추(안쪽 <strong> 이 실제 target 이다)와 적 스프라이트는 마우스로 눌린다.
      for (const target of [label, button, sprite]) {
        expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1, target })).toBe(false);
        expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target })).toBe(false);
      }
      // 호버·끌기·휠은 전투 패널에서도 그대로 막힌다 — 통과시키는 것은 누름/클릭뿐이다.
      for (const type of ["mouseover", "mousemove", "pointermove", "wheel", "dragstart"]) {
        expect(shouldBlockPlayPointerEvent({ type, target: label })).toBe(true);
      }
      // 맵·스테이지 같은 나머지 누름도 여전히 막힌다.
      const stage = document.createElement("div");
      expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1, target: stage })).toBe(true);

      let activations = 0;
      button.addEventListener("click", () => {
        activations += 1;
      });
      const mouseClick = detailedClick(1);
      label.dispatchEvent(mouseClick);
      expect(mouseClick.defaultPrevented).toBe(false);
      expect(activations).toBe(1);
    });

    it("prevents dispatched mouse clicks from changing state but allows keyboard-synthetic clicks", () => {
      const root = document.createElement("div");
      const cleanup = installPlayPointerBlocker(root);
      let activations = 0;
      root.addEventListener("click", () => {
        activations += 1;
      });

      const mouseClick = detailedClick(1);
      root.dispatchEvent(mouseClick);
      expect(mouseClick.defaultPrevented).toBe(true);
      expect(activations).toBe(0);

      const keyboardClick = detailedClick(0);
      root.dispatchEvent(keyboardClick);
      expect(keyboardClick.defaultPrevented).toBe(false);
      expect(activations).toBe(1);
      cleanup();
    });

    // 실측 2026-09-17: 편집기 타일 검색창에 포커스가 한 번 들어가면 테스트 플레이에서
    // 방향키가 죽는다. input.ts 의 두 이동 경로가 isTextEntryFocused() 로 스스로를 끄기
    // 때문이다. 차단기가 mousedown 을 preventDefault 하므로 브라우저 기본 포커스 이전도
    // 취소된다 — 플레이 화면을 눌러도 영영 복구되지 않는다. 눌림을 가로채는 쪽이 포커스
    // 이전까지 책임진다.
    it("returns keyboard ownership to play when a stranded text field holds focus", () => {
      const stranded = document.createElement("input");
      stranded.type = "search";
      document.body.append(stranded);
      const root = document.createElement("div");
      document.body.append(root);
      const cleanup = installPlayPointerBlocker(root);
      stranded.focus();
      expect(document.activeElement).toBe(stranded);

      root.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
      expect(document.activeElement).not.toBe(stranded);

      cleanup();
      stranded.remove();
      root.remove();
    });

    it("leaves focus alone while the pointer merely moves over play", () => {
      const stranded = document.createElement("input");
      stranded.type = "search";
      document.body.append(stranded);
      const root = document.createElement("div");
      document.body.append(root);
      const cleanup = installPlayPointerBlocker(root);
      stranded.focus();

      for (const type of ["pointermove", "mousemove", "mouseover", "pointerover", "wheel"]) {
        root.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      }
      expect(document.activeElement).toBe(stranded);

      cleanup();
      stranded.remove();
      root.remove();
    });

    it("automation receives the same production pointer semantics", () => {
      const navigatorPrototype = Object.getPrototypeOf(navigator);
      const original = Object.getOwnPropertyDescriptor(navigatorPrototype, "webdriver");
      Object.defineProperty(navigator, "webdriver", { configurable: true, value: true });
      try {
        expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1 })).toBe(true);
        expect(shouldBlockPlayPointerEvent({ type: "pointerdown" })).toBe(true);
      } finally {
        if (original) Object.defineProperty(navigatorPrototype, "webdriver", original);
        else Object.defineProperty(navigator, "webdriver", { configurable: true, value: undefined });
      }
    });
  });
  function detailedClick(detail: number): Event {
    const event = new Event("click", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "detail", { configurable: true, value: detail });
    return event;
  }
});

describe("playLoadingOverlay", () => {
  isolateTimers();
  describe("playLoadingOverlay", () => {
    afterEach(() => {
      document.body.replaceChildren();
    });

    it("mounts staged loading UI with message and progress", () => {
      const host = document.createElement("div");
      document.body.append(host);

      const loading = mountPlayLoadingOverlay(host, "saving");
      expect(host.querySelector("[data-testid='play-loading-overlay']")).toBeTruthy();
      expect(host.querySelector("[data-testid='play-loading-message']")?.textContent).toContain("저장");
      expect(loading.root.dataset.stage).toBe("saving");

      loading.setStage("assets");
      expect(loading.root.dataset.stage).toBe("assets");
      expect(host.querySelector("[data-testid='play-loading-message']")?.textContent).toContain("에셋");

      loading.setProgress(0.42);
      const bar = host.querySelector<HTMLElement>("[data-testid='play-loading-bar']");
      expect(bar?.classList.contains("is-indeterminate")).toBe(false);
      expect(bar?.dataset.progress).toBe("42");

      loading.setStage("ready");
      loading.remove();
      expect(host.querySelector("[data-testid='play-loading-overlay']")).toBeNull();
    });
  });
});

describe("playLoadingOverlayRecovery", () => {
  isolateTimers();
  function mountHost(): HTMLElement {
    const host = document.createElement("div");
    document.body.append(host);
    return host;
  }
  describe("playLoadingOverlay recovery", () => {
    afterEach(() => {
      document.body.replaceChildren();
      vi.restoreAllMocks();
    });

    it("renders an announced recovery panel with diagnostics and repairs", () => {
      const host = mountHost();
      const reason = "BOOT_PREFLIGHT_FAILED: map/start-point@0:0";
      const loading = mountPlayLoadingOverlay(host);

      loading.showRecovery({
        title: "테스트 플레이를 시작하지 못했습니다",
        reason,
        repairs: ["시작 위치를 가장 가까운 통행 가능 타일로 옮겼습니다"],
        diagnostics: "boot-id=boot-17\nphase=preflight",
        onRetry: () => undefined,
        onSafeMode: () => undefined,
      });

      const testIds = [
        "play-recovery-panel",
        "play-recovery-reason",
        "play-recovery-retry",
        "play-recovery-safe-mode",
        "play-recovery-copy",
        "play-recovery-repairs",
      ];
      for (const testId of testIds) {
        expect(host.querySelector(`[data-testid='${testId}']`)).toBeTruthy();
      }
      expect(host.querySelector("[data-testid='play-recovery-panel']")?.getAttribute("role")).toBe("alert");
      expect(host.querySelector("[data-testid='play-recovery-reason']")?.textContent).toBe(reason);
      expect(host.querySelector("[data-testid='play-recovery-repairs']")?.textContent).toContain("시작 위치");

      const buttons = Array.from(host.querySelectorAll("[data-testid='play-recovery-panel'] button"));
      expect(buttons.map((button) => button.getAttribute("data-testid"))).toEqual([
        "play-recovery-retry",
        "play-recovery-safe-mode",
        "play-recovery-copy",
      ]);
    });

    it("omits callback actions when their callbacks are not supplied", () => {
      const host = mountHost();
      const loading = mountPlayLoadingOverlay(host);

      loading.showRecovery({
        title: "복구 필요",
        reason: "ENGINE_IMPORT_FAILED",
        diagnostics: "engine import rejected",
      });

      expect(host.querySelector("[data-testid='play-recovery-retry']")).toBeNull();
      expect(host.querySelector("[data-testid='play-recovery-safe-mode']")).toBeNull();
    });

    it("invokes retry and safe-mode callbacks from their buttons", () => {
      const host = mountHost();
      const onRetry = vi.fn();
      const onSafeMode = vi.fn();
      const loading = mountPlayLoadingOverlay(host);

      loading.showRecovery({
        title: "복구 필요",
        reason: "ASSET_LOAD_FAILED",
        onRetry,
        onSafeMode,
      });

      host.querySelector<HTMLButtonElement>("[data-testid='play-recovery-retry']")?.click();
      host.querySelector<HTMLButtonElement>("[data-testid='play-recovery-safe-mode']")?.click();
      expect(onRetry).toHaveBeenCalledOnce();
      expect(onSafeMode).toHaveBeenCalledOnce();
    });

    it("offers a page reload action for stale engine-module failures", () => {
      const host = mountHost();
      const onReload = vi.fn();
      const loading = mountPlayLoadingOverlay(host);

      loading.showRecovery({
        title: "플레이를 시작하지 못했습니다",
        reason: "TypeError: Failed to fetch dynamically imported module: http://host/assets/PlayScene-aaa.js",
        onRetry: () => undefined,
        onReload,
      });

      const reload = host.querySelector<HTMLButtonElement>("[data-testid='play-recovery-reload']");
      expect(reload?.textContent).toBe("페이지 새로고침");
      reload?.click();
      expect(onReload).toHaveBeenCalledOnce();
    });

    it("copies the supplied diagnostics text", async () => {
      const host = mountHost();
      const writeText = vi.fn(async () => undefined);
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });
      const loading = mountPlayLoadingOverlay(host);
      const diagnostics = "boot-id=boot-17\nphase=preflight";

      loading.showRecovery({
        title: "복구 필요",
        reason: "PREFLIGHT_FAILED",
        diagnostics,
      });

      host.querySelector<HTMLButtonElement>("[data-testid='play-recovery-copy']")?.click();
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(diagnostics));
    });

    it("does not throw when diagnostics are copied without a clipboard API", () => {
      const host = mountHost();
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
      const loading = mountPlayLoadingOverlay(host);

      loading.showRecovery({
        title: "복구 필요",
        reason: "MAP_LOAD_FAILED",
        diagnostics: "map=field_01\nreason=missing tileset",
      });

      const copy = host.querySelector<HTMLButtonElement>("[data-testid='play-recovery-copy']");
      expect(copy).toBeTruthy();
      expect(() => copy?.click()).not.toThrow();
    });
  });
});

describe("playSurfaceScaleMode", () => {
  isolateTimers();
  type ResizeCallback = () => void;
  let resizeCallbacks: ResizeCallback[] = [];
  let animationFrames: FrameRequestCallback[] = [];
  let previousResizeObserver: typeof globalThis.ResizeObserver | undefined;
  let previousRaf: typeof globalThis.requestAnimationFrame;
  let previousCancelRaf: typeof globalThis.cancelAnimationFrame;
  // 뷰포트 크기는 happy-dom 이 0 으로 보고한다. 실측한 테스트 플레이 창 본문(1214x640)을
  // 직접 물려 스케일 계산 경로만 결정론적으로 굳힌다.
  function stubViewportBounds(viewport: HTMLElement, width: number, height: number): void {
    Object.defineProperty(viewport, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
  }
  beforeEach(() => {
    resizeCallbacks = [];
    animationFrames = [];
    previousResizeObserver = globalThis.ResizeObserver;
    previousRaf = globalThis.requestAnimationFrame;
    previousCancelRaf = globalThis.cancelAnimationFrame;
    class TestResizeObserver {
      constructor(private readonly callback: ResizeCallback) {}
      observe(): void {
        resizeCallbacks.push(this.callback);
      }
      unobserve(): void {}
      disconnect(): void {
        resizeCallbacks = resizeCallbacks.filter((entry) => entry !== this.callback);
      }
    }
    globalThis.ResizeObserver = TestResizeObserver as unknown as typeof globalThis.ResizeObserver;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => undefined) as typeof globalThis.cancelAnimationFrame;
  });
  afterEach(() => {
    if (previousResizeObserver) globalThis.ResizeObserver = previousResizeObserver;
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCancelRaf;
  });
  describe("createPlaySurface scale mode", () => {
    it("keeps the integer scale by default for the shipped player", () => {
      const surface = createPlaySurface({ width: 320, height: 240 });
      stubViewportBounds(surface.viewport, 1214, 640);

      surface.sync();

      expect(surface.viewport.dataset.scale).toBe("2.000");
      expect(surface.viewport.style.getPropertyValue("--play-scale")).toBe("2");
      surface.cleanup();
    });

    it("fills the host with the unfloored contain scale in fit mode", () => {
      const surface = createPlaySurface({ width: 320, height: 240 }, "fit");
      stubViewportBounds(surface.viewport, 1214, 640);

      surface.sync();

      expect(Number(surface.viewport.dataset.scale)).toBeCloseTo(8 / 3, 3);
      expect(surface.viewport.style.getPropertyValue("--play-stage-top")).toBe("0px");
      surface.cleanup();
    });

    it("applies the fit mode on the initial animation-frame apply and on resize sync", () => {
      const surface = createPlaySurface({ width: 320, height: 240 }, "fit");
      stubViewportBounds(surface.viewport, 640, 480);

      // 최초 적용(requestAnimationFrame) 경로.
      expect(animationFrames).toHaveLength(1);
      for (const frame of animationFrames.splice(0)) frame(0);
      expect(Number(surface.viewport.dataset.scale)).toBeCloseTo(2, 3);

      // ResizeObserver 경로: 창을 늘리면 분수 배율도 그대로 반영돼야 한다.
      stubViewportBounds(surface.viewport, 1214, 640);
      expect(resizeCallbacks).toHaveLength(1);
      for (const callback of resizeCallbacks) callback();
      expect(Number(surface.viewport.dataset.scale)).toBeCloseTo(8 / 3, 3);

      surface.cleanup();
      expect(resizeCallbacks).toHaveLength(0);
    });
  });
});

describe("publicationSaveImportPanel", () => {
  isolateTimers();
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); setSavePublication(undefined); document.body.replaceChildren(); });
  it("does not expose another listing's accepted predecessor manual or auto saves", () => {
    const project = createBlankProject();
    const original = preparePublication("a".repeat(64)); project.meta.publication = original;
    setSavePublication(original, "listing-a");
    const snapshot = createSaveSnapshot(project, startSession(project, 1));
    const raw = JSON.stringify(snapshot);
    const sourceKey = saveSlotKey(1); localStorage.setItem(sourceKey, raw);
    const sourceAuto = sourceKey.replace(/:1$/, ":auto"); localStorage.setItem(sourceAuto, raw);
    project.meta.publication = { ...upgradePublication(original, "b".repeat(64)), acceptedSaveCompatibilityIds: [original.saveCompatibilityId] };
    setSavePublication(project.meta.publication, "listing-b");
    const host = document.createElement("section"); document.body.append(host);
    const reads = vi.spyOn(localStorage, "getItem");
    const enumeration = vi.spyOn(localStorage, "key");
    appendPredecessorSaveImports(host, { project, storage: localStorage, onLoadSlot: () => { throw new Error("Foreign save exposed"); } });
    expect(host.querySelectorAll('[data-testid^="save-slot-import-"]')).toHaveLength(0);
    expect(reads).not.toHaveBeenCalledWith(sourceKey);
    expect(reads).not.toHaveBeenCalledWith(sourceAuto);
    expect(enumeration).not.toHaveBeenCalled();
    expect(localStorage.getItem(sourceKey)).toBe(raw);
    expect(localStorage.getItem(sourceAuto)).toBe(raw);
  });
  it("copies an explicitly accepted predecessor through a visible load control", () => {
    const project = createBlankProject();
    const original = preparePublication("a".repeat(64)); project.meta.publication = original;
    setSavePublication(original);
    const raw = JSON.stringify(createSaveSnapshot(project, startSession(project, 1)), null, 2);
    const sourceKey = saveSlotKey(1); localStorage.setItem(sourceKey, raw);
    project.meta.publication = { ...upgradePublication(original, "b".repeat(64)), acceptedSaveCompatibilityIds: [original.saveCompatibilityId] };
    setSavePublication(project.meta.publication);
    const host = document.createElement("section"); document.body.append(host);
    const loaded: number[] = [];
    appendPredecessorSaveImports(host, { project, storage: localStorage, onLoadSlot: slot => loaded.push(slot) });
    const button = host.querySelector("button");
    if (!button) throw new Error("Missing copy control");
    button.click();
    expect(loaded).toEqual([1]);
    expect(localStorage.getItem(sourceKey)).toBe(raw);
    expect(readSaveSlot(localStorage, 1)).toMatchObject({ kind: "present", snapshot: { identity: { saveCompatibilityId: project.meta.publication.saveCompatibilityId } } });
  });
});

describe("relationshipBattleWriteBack", () => {
  isolateTimers();
  const PAGE_ID = "page_relationship";
  function tier1Project(): Project {
    return deserialize(JSON.stringify(battleFixture));
  }
  function runBattle(project: Project, commands: readonly Command[], relationships: Record<string, string>) {
    const troop = project.database.troops.find((record) => record.id === "troop_slime");
    if (!troop) throw new Error("missing troop_slime");
    troop.battleEventPages = [{
      id: PAGE_ID,
      name: "관계",
      conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
      span: "battle",
      commands: [...commands],
    }];
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      sessionState: { relationships } as never,
    } as never);
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "defend" });
    return runtime;
  }
  /* 이 스위트는 손으로 만든 스냅숏이 아니라 실제 createBattleRuntime 을 지나야 한다.
     스냅숏 빌더가 관계 지도 전체를 싣는지 전투가 쓴 키만 싣는지가 여기서만 드러난다. */
  describe("전투 관계 write-back", () => {
    it("전투가 건드리지 않은 관계는 스냅숏에 실리지 않는다", () => {
      const runtime = runBattle(tier1Project(), [], { npc_ha: "married" });
      expect(runtime.snapshot().eventState.relationships ?? {}).toEqual({});
    });

    it("전투 중 맵에서 헤어진 관계를 전투 종료가 되살리지 않는다", () => {
      const project = tier1Project();
      const runtime = runBattle(project, [], { npc_ha: "married" });
      const session = startSession(project);
      setRelationshipState(session, "npc_ha", "married");
      setRelationshipState(session, "npc_ha", "single");

      applyBattleRewardsToSession(
        session,
        { result: "escape", rewards: { exp: 0, gold: 0, items: [] }, actors: [], eventState: runtime.snapshot().eventState },
        project
      );
      expect(getRelationshipState(session, "npc_ha")).toBe("single");
    });

    it("전투에서 바꾼 관계만 세션으로 되돌아온다", () => {
      const project = tier1Project();
      const runtime = runBattle(
        project,
        [{ kind: "setRelationship", npcKey: "npc_yu", state: "married" } as Command],
        { npc_ha: "dating" }
      );
      expect(runtime.snapshot().eventState.relationships ?? {}).toEqual({ npc_yu: "married" });

      const session = startSession(project);
      setRelationshipState(session, "npc_ha", "dating");
      applyBattleRewardsToSession(
        session,
        { result: "victory", rewards: { exp: 0, gold: 0, items: [] }, actors: [], eventState: runtime.snapshot().eventState },
        project
      );
      expect(session.relationships).toEqual({ npc_ha: "dating", npc_yu: "married" });
    });

    it("전투가 관계 없음으로 바꾸면 항목이 삭제된다", () => {
      const project = tier1Project();
      const runtime = runBattle(
        project,
        [{ kind: "setRelationship", npcKey: "npc_ha", state: "single" } as Command],
        { npc_ha: "married" }
      );
      const session = startSession(project);
      setRelationshipState(session, "npc_ha", "married");
      applyBattleRewardsToSession(
        session,
        { result: "victory", rewards: { exp: 0, gold: 0, items: [] }, actors: [], eventState: runtime.snapshot().eventState },
        project
      );
      expect(session.relationships).toEqual({});
    });
  });
});

// 편집기 테스트 플레이 창의 런타임 디버그 패널(숫자 입력)에서 실측한 결함 두 가지의 회귀 증거.
//  - 입력창에 포커스를 두고 방향키·w 를 치면 캐릭터가 움직였다(키 누출).
//  - 숫자를 치면 손 슬롯 핸들러가 preventDefault 로 삼켜 값이 비었다(player.ts 쪽 — e2e 가 잠근다).
// 런타임 키 계약(keyBindings)에 「텍스트 입력 컨트롤이 대상이면 게임 키가 아니다」 규칙을 두고
// Input 이 그 규칙을 따르는지 본다.
describe("runtimeInputEditableTargets", () => {
  isolateTimers();
  const detachInputs: Array<() => void> = [];
  afterEach(() => {
    for (const detach of detachInputs.splice(0)) detach();
    vi.useRealTimers();
    document.body.replaceChildren();
  });
  function keyboardStubScene(cursorState: { right: boolean } = { right: false }): Phaser.Scene {
    const key = (down = false): { isDown: boolean } => ({ isDown: down });
    return {
      input: {
        keyboard: {
          createCursorKeys: () => ({
            up: key(),
            down: key(),
            left: key(),
            get right() {
              return key(cursorState.right);
            },
            space: key(),
            shift: key(),
          }),
          addKeys: () => ({}),
          on: () => undefined,
        },
      },
      events: { once: (_event: string, detach: () => void) => { detachInputs.push(detach); } },
    } as unknown as Phaser.Scene;
  }
  describe("isTextEntryTarget", () => {
    it("글자를 받는 컨트롤만 텍스트 입력 대상이다", () => {
      const number = document.createElement("input");
      number.type = "number";
      const text = document.createElement("input");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      const button = document.createElement("button");
      const textarea = document.createElement("textarea");
      const select = document.createElement("select");
      const editable = document.createElement("div");
      editable.setAttribute("contenteditable", "true");
      expect(isTextEntryTarget(number)).toBe(true);
      expect(isTextEntryTarget(text)).toBe(true);
      expect(isTextEntryTarget(textarea)).toBe(true);
      expect(isTextEntryTarget(select)).toBe(true);
      expect(isTextEntryTarget(checkbox)).toBe(false);
      expect(isTextEntryTarget(button)).toBe(false);
      expect(isTextEntryTarget(document.body)).toBe(false);
      expect(isTextEntryTarget(null)).toBe(false);
      expect(isTextEntryTarget(document)).toBe(false);
      // happy-dom 은 isContentEditable 을 구현하지 않을 수 있다 — 속성으로도 판정한다.
      expect(isTextEntryTarget(editable)).toBe(true);
    });
  });
  describe("Input 은 텍스트 입력 컨트롤에 친 키를 게임 입력으로 받지 않는다", () => {
    it("document 에서 소비한 짧은 탭을 Phaser 가 다음 프레임에 다시 전달해도 새 탭을 만들지 않는다", () => {
      const scene = keyboardStubScene();
      const handlers = new Map<string, (event: KeyboardEvent) => void>();
      scene.input.keyboard!.on = ((name: string, callback: (event: KeyboardEvent) => void) => {
        handlers.set(name, callback);
        return scene.input.keyboard!;
      }) as NonNullable<typeof scene.input.keyboard>["on"];
      const input = new Input(scene);
      const down = new KeyboardEvent("keydown", { key: "ArrowRight" });
      const up = new KeyboardEvent("keyup", { key: "ArrowRight" });
      document.dispatchEvent(down);
      document.dispatchEvent(up);
      expect(input.update()).toMatchObject({ x: 1, y: 0 });
      handlers.get("keydown")!(down);
      handlers.get("keyup")!(up);
      expect(input.update()).toMatchObject({ x: 0, y: 0 });
    });
    it("숫자 입력창에서 친 방향키는 걸음도 탭도 만들지 않는다", () => {
      const field = document.createElement("input");
      field.type = "number";
      document.body.append(field);
      const input = new Input(keyboardStubScene());
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(input.update()).toMatchObject({ x: 0, y: 0, dir: null });
      field.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true }));
      expect(input.update()).toMatchObject({ x: 0, y: 0 });
      field.remove();
    });

    it("입력창에서 친 확인키는 조사 엣지를 만들지 않는다", () => {
      const field = document.createElement("input");
      document.body.append(field);
      const input = new Input(keyboardStubScene());
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      expect(input.update()).toMatchObject({ actionPressed: false, confirmPressed: false });
      field.remove();
    });

    it("키를 누른 채 입력창으로 들어가 떼면 눌림이 풀린다(keyup 은 어디서 와도 처리한다)", () => {
      const field = document.createElement("input");
      document.body.append(field);
      const input = new Input(keyboardStubScene());
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
      expect(input.update()).toMatchObject({ y: -1 });
      field.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowUp", bubbles: true }));
      expect(input.update()).toMatchObject({ y: 0 });
      expect(input.update()).toMatchObject({ y: 0 });
      field.remove();
    });

    it("텍스트 입력창에 포커스가 있으면 Phaser 커서 키 상태도 무시한다", () => {
      const cursorState = { right: true };
      const field = document.createElement("input");
      field.type = "number";
      document.body.append(field);
      const input = new Input(keyboardStubScene(cursorState));
      expect(input.update(), "포커스 없을 때는 Phaser 커서 상태로 걷는다").toMatchObject({ x: 1 });
      field.focus();
      expect(document.activeElement).toBe(field);
      expect(input.update(), "입력창 포커스 중에는 걷지 않는다").toMatchObject({ x: 0, dir: null });
      field.blur();
      expect(input.update()).toMatchObject({ x: 1 });
      field.remove();
    });
  });
  describe("대사창도 텍스트 입력 컨트롤에 친 키를 받지 않는다", () => {
    it("입력창에서 친 Enter 는 대사를 넘기지 않고, 문서에서 친 Enter 는 넘긴다", async () => {
      vi.useFakeTimers();
      const host = document.createElement("div");
      document.body.append(host);
      const field = document.createElement("input");
      document.body.append(field);
      const dialogue = createDialogueUI(host);
      let resolved = false;
      const shown = dialogue.showText({ body: "A", playerTileY: 0, mapHeight: 10 }).then(() => {
        resolved = true;
      });
      // One page and a controlled clock keep this about event ownership, not typing speed.
      await vi.runAllTimersAsync();
      expect(host.querySelector(".dialogue-box .body")?.textContent).toBe("A");
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await Promise.resolve();
      expect(resolved).toBe(false);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      await shown;
      expect(resolved).toBe(true);
      dialogue.close();
      await vi.runAllTimersAsync();
    });
  });
});

describe("scenePreloadForegroundHold", () => {
  isolateTimers();
  const body = (text: string) => new Response(new Blob([text]).stream(), { status: 200 });
  describe("background preload yields to a running opening", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("low-priority files wait while an opening holds the gate, then resume on release", async () => {
      const fetched: string[] = [];
      vi.stubGlobal("fetch", vi.fn(async (url: string) => { fetched.push(url); return body("x"); }));
      const release = holdBackgroundPreload();
      let finished = false;
      const done = preloadUrls(["/a.png", "/b.png"], { priority: "low", concurrency: 1 }).finally(() => { finished = true; });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(finished).toBe(false);
      expect(fetched).toEqual([]);
      release();
      await expect(done).resolves.toMatchObject({ doneFiles: 2, totalFiles: 2 });
      expect(fetched).toEqual(["/a.png", "/b.png"]);
    });

    it("high-priority (screen-requested) files are never held", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => body("y")));
      const release = holdBackgroundPreload();
      try {
        await expect(preloadUrls(["/c.png"], { priority: "high" })).resolves.toMatchObject({ doneFiles: 1 });
      } finally { release(); }
    });

    it("a release called twice does not free another holder", async () => {
      const first = holdBackgroundPreload(), second = holdBackgroundPreload();
      first(); first();
      let passed = false;
      void backgroundPreloadTurn().then(() => { passed = true; });
      await Promise.resolve();
      expect(passed).toBe(false);
      second();
      await Promise.resolve();
      expect(passed).toBe(true);
    });
  });
});

//
// RM2003 System SE 계약 + 수량 상한 계약.
//
// 근거는 EasyRPG Player(RM2000/2003 정본 재구현)에서 확인했다:
//   - scene_shop.cpp  : 무효한 거래에 SFX_Buzzer, 확정에 SFX_Decision, 취소에 SFX_Cancel
//   - window_shopbuy.cpp : CheckEnable = 소지금 AND 소지 한도
//   - scene_shop.cpp  : 수량 상한 = std::min(max, gold / price)
//
// 베끼지 않은 것: RM 의 소지 한도 99. 이 저장소의 한도는 ITEM_QUANTITY_MAX(9,999,999)
// 이고 99로 낮추면 아이템을 다루는 전 시스템에 걸친 회귀가 된다.
describe("shopFeedbackJuice", () => {
  isolateTimers();
  const SELECT_STEP = { allowSell: true, quantityMode: "select" } as ShopStep;
  function item(overrides: Partial<ItemRecord> & Pick<ItemRecord, "id" | "name" | "price">): ItemRecord {
    const base = createBlankProject().database.items[0];
    return { ...base, description: "", ...overrides } as ItemRecord;
  }
  const POTION = item({ id: "item_potion", name: "포션", price: 12, description: "HP 회복", type: "medicine" });
  const CROWN = item({ id: "item_crown", name: "왕관", price: 9999, description: "비싸다", type: "normalGoods" });
  const FREEBIE = item({ id: "item_free", name: "전단지", price: 0, description: "공짜", type: "normalGoods" });
  function scene(gold: number, inventory: Record<string, number> = {}): PlaySceneContext {
    return {
      session: { gold, inventory, partyActorIds: ["actor_1"] },
      syncRuntimeState: () => {},
    } as unknown as PlaySceneContext;
  }
  function render(options: {
    readonly gold: number;
    readonly items: readonly ItemRecord[];
    readonly mode?: "buy" | "sell";
    readonly merchantGold?: number;
    readonly inventory?: Record<string, number>;
  }): HTMLElement {
    store.replace(createBlankProject());
    const overlay = createShopOverlay();
    overlay.append(
      renderShopItems({
        scene: scene(options.gold, options.inventory ?? {}),
        step: SELECT_STEP,
        items: options.items,
        mode: options.mode ?? "buy",
        prompt: "무엇을 구매하시겠습니까?",
        terms: resolveTerms(createBlankProject()),
        merchantGold: options.merchantGold ?? 900,
        setStatus: () => {},
        showMenu: () => {},
        onItem: () => {},
      })
    );
    document.body.append(overlay);
    return overlay;
  }
  function lastJuice(): string | undefined {
    return runtimeJuiceLog().at(-1)?.event;
  }
  function clearJuice(): void {
    const host = window as Window & { __oprnRuntimeJuice?: { log: unknown[] } };
    host.__oprnRuntimeJuice = { log: [] };
  }
  beforeEach(() => {
    document.body.innerHTML = "";
    clearJuice();
  });
  describe("수량 상한 — RM2003 std::min(max, gold / price)", () => {
    it("살 수 있는 개수까지만 올라간다", () => {
      // 200G / 12G = 16개. 예전에는 99까지 올라간 뒤 결정 시점에 거절당했다.
      const goods = toGoods(POTION);
      expect(affordableQuantityMax(goods, "buy", 200, 900, 0)).toBe(16);
    });

    it("한 개도 못 사면 0을 반환한다 — 목록에서 막지는 않는다", () => {
      expect(affordableQuantityMax(toGoods(CROWN), "buy", 200, 900, 0)).toBe(0);
    });

    it("공짜 물건은 소지금이 상한을 만들지 못한다", () => {
      expect(affordableQuantityMax(toGoods(FREEBIE), "buy", 0, 900, 0)).toBe(SHOP_QUANTITY_HARD_MAX);
    });

    it("절대 상한 99를 넘지 않는다 — 소지금이 아무리 많아도", () => {
      expect(affordableQuantityMax(toGoods(POTION), "buy", 9_999_999, 900, 0)).toBe(99);
    });

    it("구매 수량은 가방에 남은 칸에서 멈춘다", () => {
      // 골드로는 99개까지 보여도, 한도까지 3칸이면 3에서 멈춘다. 넘기면 결정이 통째로 거절된다.
      expect(affordableQuantityMax(toGoods(POTION), "buy", 9_999_999, 900, ITEM_QUANTITY_MAX - 3)).toBe(3);
      expect(affordableQuantityMax(toGoods(POTION), "buy", 9_999_999, 900, ITEM_QUANTITY_MAX)).toBe(0);
      expect(affordableQuantityMax(toGoods(FREEBIE), "buy", 0, 900, ITEM_QUANTITY_MAX)).toBe(0);
    });

    it("판매 수량은 소지금 한도까지 남은 금액에서 멈춘다", () => {
      const project = createBlankProject();
      project.database.items = [...project.database.items.filter((entry) => entry.id !== POTION.id), POTION];
      project.system.sellPrices = (project.system.sellPrices ?? []).filter((entry) => entry.itemId !== POTION.id);
      store.replace(project);
      const goods = toGoods(POTION);
      // 판매가 6G. 한도까지 20G 남으면 3개, 한도에 닿아 있으면 0개.
      expect(affordableQuantityMax(goods, "sell", GOLD_MAX - 20, 900, 5)).toBe(3);
      expect(affordableQuantityMax(goods, "sell", GOLD_MAX, 900, 5)).toBe(0);
    });

    it("판매는 가진 개수가 먼저 상한이고 상인 지갑이 그다음이다", () => {
      // listingPrice reads the active project sell helper; keep the fixture item authoritative.
      const project = createBlankProject();
      project.database.items = [...project.database.items.filter((entry) => entry.id !== POTION.id), POTION];
      project.system.sellPrices = (project.system.sellPrices ?? []).filter((entry) => entry.itemId !== POTION.id);
      store.replace(project);
      const goods = toGoods(POTION);
      // 5개 보유, 상인 지갑 넉넉 → 5
      expect(affordableQuantityMax(goods, "sell", 0, 900, 5)).toBe(5);
      // 5개 보유지만 상인이 판매가(6G) 2개분만 있음 → 2
      expect(affordableQuantityMax(goods, "sell", 0, 13, 5)).toBe(2);
    });

    it("행에 상한이 실려서 오버레이가 읽어간다", () => {
      const overlay = render({ gold: 200, items: [POTION] });
      const row = overlay.querySelector<HTMLElement>("[data-testid='shop-buy-item_potion']");
      expect(row?.dataset.maxQty).toBe("16");
      expect(shopQuantityMaxIn(overlay)).toBe(16);
    });

    it("한 개도 못 사는 행에서도 수량칸은 1을 보인다(거절은 결정 시점의 몫)", () => {
      const overlay = render({ gold: 200, items: [CROWN] });
      expect(overlay.querySelector<HTMLElement>("[data-testid='shop-buy-item_crown']")?.dataset.maxQty).toBe("0");
      expect(shopQuantityMaxIn(overlay)).toBe(1);
    });

    it("가방이 가득 찬 구매 행은 그 이유를 말한다", () => {
      const overlay = render({ gold: 9_999_999, items: [POTION], inventory: { item_potion: ITEM_QUANTITY_MAX } });
      const row = overlay.querySelector<HTMLElement>("[data-testid='shop-buy-item_potion']");
      expect(row?.dataset.maxQty).toBe("0");
      expect(row?.classList.contains("is-unaffordable")).toBe(true);
      expect(row?.getAttribute("aria-label")).toContain(SHOP_BAG_FULL_REASON);
    });

    it("소지금이 한도인 판매 행은 한도 너머 잔액을 보여 주지 않는다", () => {
      const overlay = render({
        gold: GOLD_MAX,
        items: [POTION],
        mode: "sell",
        merchantGold: 900,
        inventory: { item_potion: 4 },
      });
      const row = overlay.querySelector<HTMLElement>("[data-testid='shop-sell-item_potion']");
      expect(row?.dataset.maxQty).toBe("0");
      expect(row?.getAttribute("aria-label")).toContain(SHOP_GOLD_CAP_REASON);
      updateShopQuantityTotal(overlay);
      const balance = overlay.querySelector<HTMLElement>("[data-testid='shop-balance-after']");
      expect(balance?.dataset.goldCap).toBe("1");
      expect(balance?.dataset.balance).toBeUndefined();
      expect(balance?.textContent).toBe("소지금이 한도를 넘습니다");
    });
  });
  describe("수량 스테퍼가 상한에 부딪히면 버저", () => {
    it("상한까지는 조용히 올라간다", () => {
      const overlay = render({ gold: 200, items: [POTION] });
      const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
      adjustShopQuantity(overlay, 1);
      expect(input?.value).toBe("2");
      expect(lastJuice()).toBeUndefined();
    });

    it("상한을 넘기려 하면 값이 그대로고 버저가 울린다", () => {
      const overlay = render({ gold: 200, items: [POTION] });
      const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
      if (input) input.value = "16";
      clearJuice();
      adjustShopQuantity(overlay, 1);
      expect(input?.value).toBe("16");
      expect(lastJuice()).toBe("menu-invalid");
    });

    it("1에서 더 줄이려 하면 버저가 울린다", () => {
      const overlay = render({ gold: 200, items: [POTION] });
      adjustShopQuantity(overlay, -1);
      expect(overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']")?.value).toBe("1");
      expect(lastJuice()).toBe("menu-invalid");
    });

    it("input 의 max 속성과 안내 문구가 상한을 따라간다", () => {
      const overlay = render({ gold: 200, items: [POTION] });
      updateShopQuantityTotal(overlay);
      const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
      expect(input?.max).toBe("16");
      // 낭독되는 라벨이 실제 상한을 말해야 한다 — "1~99" 고정이면 16개까지만 살 수 있는
      // 물건에서 거짓 안내가 된다. 안내는 title 이 아니라 aria-label 에만 담는다: title 은
      // 낭독이 보장되지 않고 키보드 전용 출하 표면에서는 마우스에만 뜨는 장식이다
      // (runtimeDomTitleGuard 가 출하 런타임의 title 쓰기를 금지한다).
      expect(input?.title).toBe("");
      expect(input?.getAttribute("aria-label")).toBe("수량 — ←/→ 로 1~16 조절");
    });

    it("마운트 전에도 라벨이 있다 — 첫 렌더에 aria-label 이 비지 않는다", () => {
      const overlay = render({ gold: 200, items: [POTION] });
      const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
      expect(input?.getAttribute("aria-label")).toMatch(/^수량 — ←\/→ 로 1~\d+ 조절$/);
    });
  });
  describe("커서음 — 키보드에만 울린다", () => {
    function menu(): { root: HTMLElement; items: HTMLElement[] } {
      const root = document.createElement("div");
      const items = ["a", "b", "c"].map((id) => {
        const button = document.createElement("button");
        button.dataset.testid = id;
        root.append(button);
        return button;
      });
      document.body.append(root);
      return { root, items };
    }

    it("방향키 이동에 커서음이 울린다", () => {
      const { root, items } = menu();
      const detach = attachCursorMenu(root, { items, sound: true });
      clearJuice();
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      expect(lastJuice()).toBe("menu-select");
      detach();
    });

    it("마우스 호버에는 울리지 않는다 — 스칠 때마다 삑삑거리면 못 쓴다", () => {
      const { root, items } = menu();
      const detach = attachCursorMenu(root, { items, sound: true });
      clearJuice();
      items[1]?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
      expect(runtimeJuiceLog()).toHaveLength(0);
      detach();
    });

    it("sound 를 켜지 않으면 아무 소리도 울리지 않는다(기본 꺼짐)", () => {
      const { root, items } = menu();
      const detach = attachCursorMenu(root, { items });
      clearJuice();
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      expect(runtimeJuiceLog()).toHaveLength(0);
      detach();
    });

    it("취소키에 취소음이 울린다", () => {
      const { root, items } = menu();
      const cancelEl = document.createElement("button");
      root.append(cancelEl);
      const detach = attachCursorMenu(root, { items, cancelEl, sound: true });
      clearJuice();
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(lastJuice()).toBe("menu-back");
      detach();
    });

    it("cancelEl 이 없으면 취소음도 울리지 않는다 — 빈 약속 금지", () => {
      const { root, items } = menu();
      const detach = attachCursorMenu(root, { items, sound: true });
      clearJuice();
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(runtimeJuiceLog()).toHaveLength(0);
      detach();
    });

    it("결정키에는 커서 메뉴가 소리를 내지 않는다 — 성공/거절 판단은 도메인 몫", () => {
      const { root, items } = menu();
      const detach = attachCursorMenu(root, { items, sound: true });
      clearJuice();
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      expect(runtimeJuiceLog()).toHaveLength(0);
      detach();
    });
  });
  describe("모션 클래스가 실제로 얹힌다", () => {
    it("거절 대상에 juice-menu-invalid 가 붙는다", async () => {
      const target = document.createElement("div");
      document.body.append(target);
      emitRuntimeJuice({ event: "menu-invalid", target });
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      expect(target.classList.contains("juice-menu-invalid")).toBe(true);
    });
  });
});

describe("shopImeKeys", () => {
  isolateTimers();
  function imeKey(code: string, init: KeyboardEventInit = {}): KeyboardEvent {
    return new KeyboardEvent("keydown", {
      key: "Process",
      code,
      bubbles: true,
      cancelable: true,
      ...init,
    });
  }
  describe("shop menus read physical keys while an IME is active", () => {
    afterEach(() => {
      document.body.replaceChildren();
    });

    it("moves the stock list, changes quantity, confirms, and cancels from Process keys", () => {
      const root = document.createElement("div");
      root.className = "runtime-shop-overlay";
      const rows = [0, 1].map((index) => {
        const button = document.createElement("button");
        button.className = "runtime-shop-item-row";
        button.textContent = `item ${index}`;
        return button;
      });
      const quantity = document.createElement("input");
      quantity.type = "number";
      quantity.dataset.testid = "shop-quantity-input";
      const cancel = document.createElement("button");
      cancel.dataset.testid = "shop-item-cancel";
      root.append(...rows, quantity, cancel);
      document.body.append(root);

      const quantities: number[] = [];
      let bought = 0;
      let cancelled = 0;
      rows[1]!.addEventListener("click", () => { bought += 1; });
      cancel.addEventListener("click", () => { cancelled += 1; });
      attachShopDecisionInput(root, {
        initialIndex: 0,
        onSelect: () => {},
        onQuantity: (direction) => quantities.push(direction),
      });

      root.dispatchEvent(imeKey("ArrowDown"));
      expect(rows[1]!.classList.contains("selected")).toBe(true);
      expect(document.activeElement).toBe(rows[1]);

      root.dispatchEvent(imeKey("ArrowLeft"));
      expect(quantities).toEqual([-1]);

      root.dispatchEvent(imeKey("KeyZ"));
      expect(bought).toBe(1);

      const syllable = new KeyboardEvent("keydown", {
        key: "가", code: "KeyR", isComposing: true, bubbles: true, cancelable: true,
      });
      root.dispatchEvent(syllable);
      expect(syllable.defaultPrevented).toBe(false);
      expect(bought).toBe(1);
      expect(rows[1]!.classList.contains("selected")).toBe(true);

      root.dispatchEvent(imeKey("Escape"));
      expect(cancelled).toBe(1);
    });

    it("drives the emerald shop, including detail scroll, from the same physical keys", () => {
      const root = document.createElement("div");
      document.body.append(root);
      const directions: string[] = [];
      const scrolls: string[] = [];
      let confirmed = 0;
      attachEmeraldShopInput(root, {
        onDirection: (direction) => directions.push(direction),
        onConfirm: () => { confirmed += 1; },
        onCancel: () => {},
        onScroll: (key) => scrolls.push(key),
      });

      window.dispatchEvent(imeKey("ArrowUp"));
      window.dispatchEvent(imeKey("KeyZ"));
      window.dispatchEvent(imeKey("PageDown"));
      const syllable = new KeyboardEvent("keydown", {
        key: "가", isComposing: true, bubbles: true, cancelable: true,
      });
      window.dispatchEvent(syllable);

      expect(directions).toEqual(["up"]);
      expect(confirmed).toBe(1);
      expect(scrolls).toEqual(["PageDown"]);
      expect(syllable.defaultPrevented).toBe(false);
    });
  });
});
