import { TILE_SIZE } from "@/assets/bundled";
import { diagnosticObserved, publishDiagnostic } from "@/util/diagnosticObserver";
import type { BattleResult } from "@/battle/runtime";
import { takePendingPictureTransition, type AudioCommandState, type PictureState, type PlaySession } from "@/project/session";
import type { ActorVitals } from "@/project/sessionVitals";
import type { M2RuntimeState } from "@/project/sessionRuntimeTypes"
import type { RuntimeEventView } from "@/project/runtimeEventState"
import type { RuntimeMoverSnapshot } from "@/player/runtimeMoverSnapshots";
import { resourceDisplayName } from "@/player/resourceDisplay";
import { resolvePictureSource } from "@/player/pictures/pictureResources";
import {
  interpolatePictureTransform,
  pictureCssOpacity,
  pictureCssTransform,
  pictureTransformFromState,
  pictureTransformsEqual,
  pictureZIndex,
  tweenProgress,
  type PictureTransform,
} from "@/player/pictures/pictureTween";
import { store } from "@/project/store";
import type { CharacterFootprint, FootprintRect, Project } from "@/project/types";
import { formatGameTime, type GameTime, type TimePhase } from "@/project/gameTime";
import type { PlayResolution } from "@/project/types";

type RuntimeAssetProject = Pick<Project, "assets">;

// 픽처 슬롯(픽처 번호별). 이미지/텍스트 라벨 중 하나를 담고, Move Picture 트윈 상태를 보관한다.
type PictureSlot = {
  readonly container: HTMLElement;
  img: HTMLImageElement | null;
  label: HTMLElement | null;
  resourceId: string;
  displayed: PictureTransform;
  from: PictureTransform;
  to: PictureTransform;
  startedAt: number;
  durationMs: number;
};

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : 0;
}

/**
 * 마커를 이벤트의 몸 사각 크기·위치로 맞춘다. 좌표는 dataset 에 맵 픽셀로 남기고
 * `placeMarker` 가 카메라 기준으로 환산한다 — 카메라가 움직여도 크기는 다시 안 잰다.
 */
function applyMarkerBodyRect(marker: HTMLElement, view: RuntimeEventView, tileSize: number): void {
  const width = (view.bodyRect.right - view.bodyRect.left + 1) * tileSize;
  const height = (view.bodyRect.bottom - view.bodyRect.top + 1) * tileSize;
  marker.dataset.mapX = `${view.bodyRect.left * tileSize}`;
  marker.dataset.mapY = `${view.bodyRect.top * tileSize}`;
  marker.dataset.mapW = `${width}`;
  marker.dataset.mapH = `${height}`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
}

/**
 * `__oprnDebug` 가 노출하는 이벤트 상태. QA 시나리오가 단정할 수 있는 것은 여기 있는 것뿐이다.
 *
 * 사각을 **파생값까지 실어 보내는** 이유: 크기(footprint/passRows)만 주면 소비자가 발밑 앵커
 * 규약(top = y - (height-1), 짝수 폭은 앵커가 중앙 왼쪽)을 손으로 다시 구현해야 하고, 그 계산이
 * 어긋나면 시나리오가 조용히 엉뚱한 칸을 단정한다. 실제로 1차 QA 는 발자국 좌표를 시나리오
 * 주석에 손으로 적어 두는 것이 전부였다.
 */
export interface RuntimeEventSnapshot {
  readonly x: number;
  readonly y: number;
  readonly pageId?: string;
  readonly priority: string;
  readonly trigger: string;
  readonly direction?: string;
  /** 활성 페이지의 몸 크기(타일). 저작이 없으면 1x1. */
  readonly footprint: CharacterFootprint;
  /** 몸 사각 하단 몇 행이 통행을 막는가. 생략 저작이면 몸 높이와 같다. */
  readonly passRows: number;
  /** 조사·전투·클릭이 쓰는 사각. */
  readonly bodyRect: FootprintRect;
  /** 통행 차단이 쓰는 사각. passRows 가 몸 높이면 bodyRect 와 같다. */
  readonly passRect: FootprintRect;
}

export type LifeRuntimeSnapshot = Readonly<Pick<PlaySession,
  "farmPlots" | "energy" | "makerInstances" | "farmAnimals" | "farmBuildingPlacements" | "lifeRecovery"
>>;

/** Observation only: retain optional absence and copy owners, never reconcile or advance them.
 * Future plot remaining / linked housing fields travel with their owners when implemented. */
export function buildLifeRuntimeSnapshot(session: LifeRuntimeSnapshot): LifeRuntimeSnapshot {
  return structuredClone({
    ...(session.farmPlots !== undefined ? { farmPlots: session.farmPlots } : {}),
    ...(session.energy !== undefined ? { energy: session.energy } : {}),
    ...(session.makerInstances !== undefined ? { makerInstances: session.makerInstances } : {}),
    ...(session.farmAnimals !== undefined ? { farmAnimals: session.farmAnimals } : {}),
    ...(session.farmBuildingPlacements !== undefined ? { farmBuildingPlacements: session.farmBuildingPlacements } : {}),
    ...(session.lifeRecovery !== undefined ? { lifeRecovery: session.lifeRecovery } : {}),
  });
}

export type RuntimeActionReceipt = {
  readonly sequence: number;
  readonly kind: "action";
  readonly mapId: string;
  /** Input was consumed, not a claim that an asynchronous event has finished. */
  readonly handled: boolean;
  readonly farmAttempts: readonly import("@/player/farming").FarmInteractionResult[];
};

export interface RuntimeStateSnapshot extends LifeRuntimeSnapshot {
  readonly actionReceipt?: RuntimeActionReceipt;
  readonly mapId: string;
  readonly inputEnabled: boolean;
  readonly running: boolean;
  readonly player: { readonly x: number; readonly y: number };
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly timers: Record<string, number>;
  readonly timerActive: Record<string, boolean>;
  readonly flags: Record<string, boolean>;
  readonly mapOverrides: PlaySession["mapOverrides"];
  readonly gold: number;
  readonly inventory: Record<string, number>;
  readonly partyActorIds: readonly string[];
  readonly actorSkillIds: PlaySession["actorSkillIds"];
  readonly actorExperience: Record<string, number>;
  readonly actorLevels: Record<string, number>;
  readonly actorVitals: Record<string, ActorVitals>;
  readonly eventLocations: PlaySession["eventLocations"];
  readonly followers?: PlaySession["followers"];
  readonly followerTrail?: PlaySession["followerTrail"];
  readonly removedEventIds?: PlaySession["removedEventIds"];
  readonly spawnedEvents?: PlaySession["spawnedEvents"];
  readonly camera?: PlaySession["camera"];
  readonly lighting?: PlaySession["lighting"];
  readonly actorEquipment: PlaySession["actorEquipment"];
  readonly shopLoyaltySpend?: PlaySession["shopLoyaltySpend"];
  readonly shopTradeCounts?: PlaySession["shopTradeCounts"];
  readonly shopMileagePoints?: PlaySession["shopMileagePoints"];
  readonly actorRows: PlaySession["actorRows"];
  readonly classOverrides: PlaySession["classOverrides"];
  readonly audio: AudioCommandState;
  readonly pictures: Record<string, PictureState>;
  readonly m2Runtime?: M2RuntimeState;
  readonly events: Record<string, RuntimeEventSnapshot>;
  readonly movers: Record<string, RuntimeMoverSnapshot>;
  readonly battleResult?: BattleResult;
  readonly gameTime?: GameTime;
  readonly timePhase?: TimePhase;
  readonly lifeCalendarHudLines?: readonly string[];
}

export type RuntimeDomOverlayOptions = {
  readonly qaInstrumentation?: boolean;
  readonly playResolution?: PlayResolution;
  /** Test seam for deterministic picture tween timing. */
  readonly pictureNow?: () => number;
  /** Test seam for proving resize reads are cached outside marker write batches. */
  readonly stageSizeProvider?: (resolution: PlayResolution) => PlayResolution;
  /** Test seam for counting marker write operations without depending on DOM internals. */
  readonly onMarkerWrite?: (marker: HTMLElement) => void;
};

export class RuntimeDomOverlay {
  private readonly eventMarkers: Map<string, HTMLElement> = new Map();
  private readonly spriteMarkers: Map<string, HTMLElement> = new Map();
  private readonly pictureSlots: Map<string, PictureSlot> = new Map();
  private readonly qaInstrumentation: boolean;
  private readonly playResolution: PlayResolution;
  private readonly stageSizeProvider: (resolution: PlayResolution) => PlayResolution;
  private readonly onMarkerWrite: ((marker: HTMLElement) => void) | undefined;
  private readonly pictureNow: () => number;
  private stageBounds: PlayResolution;
  private pictureRafId = 0;
  // QA 거울 노드와 직전에 쓴 문자열. 매 프레임 querySelector + textContent 쓰기를 하면
  // 세션 JSON 이 그대로 바뀌지 않았어도 노드가 무효화된다(실측 고정세 5.4ms).
  private stateJsonNode: HTMLElement | undefined;
  private stateJsonText: string | undefined;
  private audioJsonNode: HTMLElement | undefined;
  private audioJsonText: string | undefined;
  private lastActionReceipt?: RuntimeActionReceipt;

  constructor(
    private readonly host: () => HTMLElement | undefined,
    options: RuntimeDomOverlayOptions = {},
  ) {
    this.qaInstrumentation = options.qaInstrumentation === true;
    this.playResolution = options.playResolution ?? { width: 320, height: 240 };
    this.stageSizeProvider = options.stageSizeProvider ?? ((resolution) => resolution);
    this.onMarkerWrite = options.onMarkerWrite;
    this.pictureNow = options.pictureNow ?? nowMs;
    this.stageBounds = this.qaInstrumentation
      ? this.stageSizeProvider(this.playResolution)
      : this.playResolution;
  }

  /** True only under an explicit export-QA boot capability. Never true for a shipped player. */
  get instrumented(): boolean {
    return this.qaInstrumentation;
  }

  get actionReceipt(): RuntimeActionReceipt | undefined {
    return this.lastActionReceipt ? structuredClone(this.lastActionReceipt) : undefined;
  }

  /** Scene-local QA evidence, emitted only after the actual action and mirror sync. */
  recordAction(action: Omit<RuntimeActionReceipt, "sequence">, sync: () => void): void {
    if (!this.qaInstrumentation) return;
    this.lastActionReceipt = structuredClone({ ...action, sequence: (this.lastActionReceipt?.sequence ?? 0) + 1 });
    sync();
    this.host()?.dispatchEvent(new CustomEvent("oprn:action", { detail: this.actionReceipt }));
  }

  /**
   * Visible runtime HUD only (timer + calendar). This is the production path: it must not
   * depend on the debug snapshot, which exists solely for QA instrumentation.
   */
  syncVisibleHud(state: {
    readonly timers: Record<string, number>;
    readonly timerActive: Record<string, boolean>;
    readonly gameTime?: GameTime;
    readonly timePhase?: TimePhase;
    readonly lifeCalendarHudLines?: readonly string[];
  }): void {
    this.syncTimerHud(state.timers, state.timerActive);
    this.syncTimeHud(state.gameTime, state.timePhase, state.lifeCalendarHudLines);
  }

  /** Refresh cached logical bounds after an explicit play-surface resize signal. */
  signalResize(): void {
    if (!this.qaInstrumentation) return;
    this.stageBounds = this.stageSizeProvider(this.playResolution);
    this.placeAllMarkers();
  }

  /**
   * 카메라 스크롤(px). 마커를 **화면 좌표**로 놓기 위해 필요하다.
   *
   * 왜(2026-07-26 실측): 마커를 맵 타일 좌표에 그대로 놓으면 100×100 맵에서 무대의 스크롤
   * 콘텐츠가 1552×1552 로 부푼다(무대 client 는 320×240). `.play-stage` 는 `overflow: hidden`
   * 이라 잘라내지만 **여전히 스크롤 컨테이너**이므로, 화면 밖 마커를 클릭하면 브라우저가 그것을
   * 보이게 하려고 무대를 스크롤한다(scroll = 728,768). 그러면 무대 rect 는 그대로인데 캔버스만
   * 화면 밖으로 나가 **재생 화면이 완전히 검게 된다**(canvas rect 320,225 → -1136,-1311).
   * 마커를 화면 좌표에 두고 화면 밖을 비활성화하면 스크롤 오버플로 자체가 사라진다.
   *
   * 덤: 지금까지 히트박스가 실제 NPC 스프라이트 위치와 어긋나 있었다(카메라 보정이 없었으므로).
   */
  private cameraX = 0;
  private cameraY = 0;

  /** 매 프레임 카메라 스크롤을 반영해 마커를 화면 좌표로 재배치한다. */
  syncCameraOffset(cameraX: number, cameraY: number): void {
    if (!this.qaInstrumentation || (cameraX === this.cameraX && cameraY === this.cameraY)) return;
    this.cameraX = cameraX;
    this.cameraY = cameraY;
    this.placeAllMarkers();
  }

  private placeAllMarkers(): void {
    for (const marker of this.eventMarkers.values()) this.placeMarker(marker);
    for (const marker of this.spriteMarkers.values()) this.placeMarker(marker);
  }

  /**
   * dataset 에 기록된 맵 좌표를 카메라 기준 화면 좌표로 환산해 놓는다.
   * 무대(320×240) 밖이면 좌상단으로 접고 비활성화한다 — 스크롤 영역을 넓히지 않고,
   * 보이지 않는 NPC 를 클릭하는 일도 막는다(마커는 opacity 0.01 의 히트박스다).
   */
  private placeMarker(marker: HTMLElement): void {
    const mapX = Number(marker.dataset.mapX ?? "0");
    const mapY = Number(marker.dataset.mapY ?? "0");
    const screenX = mapX - this.cameraX;
    const screenY = mapY - this.cameraY;
    // 마커 자기 크기로 가시성을 본다. 한 칸으로 고정하면 3x3 이벤트가 왼쪽·위로 두 칸
    // 걸쳐 있을 때 아직 화면에 보이는데도 접혀 클릭이 죽는다.
    const markerW = Number(marker.dataset.mapW ?? TILE_SIZE) || TILE_SIZE;
    const markerH = Number(marker.dataset.mapH ?? TILE_SIZE) || TILE_SIZE;
    const visible =
      screenX > -markerW
      && screenY > -markerH
      && screenX < this.stageBounds.width
      && screenY < this.stageBounds.height;
    marker.dataset.offscreen = visible ? "" : "1";
    marker.style.left = `${visible ? screenX : 0}px`;
    marker.style.top = `${visible ? screenY : 0}px`;
    marker.style.visibility = visible ? "" : "hidden";
    marker.style.pointerEvents = visible ? "" : "none";
    this.onMarkerWrite?.(marker);
  }

  upsertEventMarker(view: RuntimeEventView, onActivate?: (eventId: string) => void, tileSize: number = TILE_SIZE): void {
    if (!this.qaInstrumentation) return;
    const host = this.host();
    if (!host) return;
    let marker = this.eventMarkers.get(view.event.id);
    if (!marker) {
      marker = document.createElement("div");
      marker.className = "runtime-debug-marker";
      marker.dataset.testid = `event-${view.event.id}`;
      marker.addEventListener("click", () => onActivate?.(view.event.id));
      host.append(marker);
      this.eventMarkers.set(view.event.id, marker);
    }
    marker.textContent = view.pageId ?? view.event.id;
    // 히트박스는 **몸 사각**이다. 앵커 한 칸으로 두면 3x3 골렘의 머리를 클릭해도 아무 일이
    // 없다 — 이 마커가 `pointer-events: auto` 실행 히트박스이기 때문이다.
    applyMarkerBodyRect(marker, view, tileSize);
    marker.dataset.pageId = view.pageId ?? "";
    marker.dataset.priority = view.priority;
    marker.dataset.trigger = view.trigger.kind;
    this.placeMarker(marker);
    this.syncSpriteMarker(host, view, tileSize);
  }

  clearEventMarkers(): void {
    for (const marker of this.eventMarkers.values()) {
      marker.remove();
    }
    this.eventMarkers.clear();
    for (const marker of this.spriteMarkers.values()) {
      marker.remove();
    }
    this.spriteMarkers.clear();
  }

  private syncSpriteMarker(host: HTMLElement, view: RuntimeEventView, tileSize: number): void {
    const existing = this.spriteMarkers.get(view.event.id);
    if (!view.sprite) {
      existing?.remove();
      this.spriteMarkers.delete(view.event.id);
      return;
    }
    const marker = existing ?? document.createElement("div");
    if (!existing) {
      marker.className = "runtime-debug-marker runtime-sprite-marker";
      marker.dataset.testid = `event-sprite-${view.event.id}`;
      host.append(marker);
      this.spriteMarkers.set(view.event.id, marker);
    }
    marker.textContent = view.pageId ?? view.event.id;
    applyMarkerBodyRect(marker, view, tileSize);
    marker.dataset.pageId = view.pageId ?? "";
    marker.dataset.priority = view.priority;
    this.placeMarker(marker);
  }

  syncMissingResourceError(missingResources: ReadonlySet<string>): void {
    if (missingResources.size && diagnosticObserved("asset")) publishDiagnostic({ category: "asset", phase: "missing", count: missingResources.size });
    const host = this.host();
    if (!host) return;
    host.querySelector("[data-testid='missing-resource-error']")?.remove();
    if (missingResources.size === 0) return;
    const error = document.createElement("div");
    error.className = "runtime-missing-resource";
    error.dataset.testid = "missing-resource-error";
    // 자원 이름이 있으면 그것을 보여준다. 폴백이 원본 id 이므로 QA/e2e 가 단정하는 값은 남는다.
    const names = Array.from(missingResources, (id) => resourceDisplayName(id, id));
    error.textContent = `누락된 리소스: ${names.join(", ")}`;
    host.append(error);
  }

  syncRuntimeState(snapshot: RuntimeStateSnapshot): void {
    const host = this.host();
    if (!host) return;
    // The hidden JSON mirror is QA instrumentation, not player-visible UI. A shipped player
    // must not create the node or serialize session state; visible HUD sync still runs.
    if (!this.qaInstrumentation) {
      this.syncTimerHud(snapshot.timers, snapshot.timerActive);
      this.syncTimeHud(snapshot.gameTime, snapshot.timePhase, snapshot.lifeCalendarHudLines);
      return;
    }
    const node = this.mirrorNode(host, this.stateJsonNode, "runtime-state-json", "runtime-state-json");
    // 노드가 새로 잡혔으면 직전 문자열 기억은 버린다 — 안 그러면 새 노드가 빈 채로 남는다.
    if (node !== this.stateJsonNode) {
      this.stateJsonNode = node;
      this.stateJsonText = undefined;
    }
    const serialized = JSON.stringify(snapshot);
    if (serialized !== this.stateJsonText) {
      node.textContent = serialized;
      this.stateJsonText = serialized;
    }
    this.syncTimerHud(snapshot.timers, snapshot.timerActive);
    this.syncTimeHud(snapshot.gameTime, snapshot.timePhase, snapshot.lifeCalendarHudLines);
  }

  syncAudioState(audio: AudioCommandState): void {
    const host = this.host();
    if (!host) return;
    // QA-only mirror; audio playback itself is owned by the audio engine.
    if (!this.qaInstrumentation) return;
    const node = this.mirrorNode(
      host,
      this.audioJsonNode,
      "audio-state-json",
      "runtime-state-json runtime-audio-state-json"
    );
    if (node !== this.audioJsonNode) {
      this.audioJsonNode = node;
      this.audioJsonText = undefined;
    }
    const serialized = JSON.stringify(audio);
    if (serialized !== this.audioJsonText) {
      node.textContent = serialized;
      this.audioJsonText = serialized;
    }
  }

  /**
   * QA 거울 노드를 찾거나 만든다. 캐시한 노드가 여전히 이 host 의 자식이면 그대로 쓴다 —
   * host 가 바뀌거나(새 재생 세션) 노드가 떨어져 나가면 다시 질의한다.
   */
  private mirrorNode(
    host: HTMLElement,
    cached: HTMLElement | undefined,
    testId: string,
    className: string
  ): HTMLElement {
    if (cached && cached.parentElement === host) return cached;
    const existing = host.querySelector(`[data-testid='${testId}']`);
    if (existing instanceof HTMLElement) return existing;
    const node = document.createElement("pre");
    node.className = className;
    node.dataset.testid = testId;
    host.append(node);
    return node;
  }

  // 픽처 레이어를 실제 이미지로 렌더한다. 리소스가 이미지로 해석되면 <img> 슬롯을,
  // 아니면 기존 텍스트 라벨을 배치한다(폴백/테스트 호환). z-order 는 픽처 번호로 유도하고,
  // durationMs 와 실행 중인 Show/Move Picture 의 일회성 의도가 함께 있을 때만 트윈한다.
  syncPictureLayer(pictures: Record<string, PictureState>): void {
    const host = this.host();
    if (!host) return;
    const existing = host.querySelector("[data-testid='picture-layer']");
    const layer = existing instanceof HTMLElement ? existing : document.createElement("div");
    if (!existing) {
      layer.className = "picture-layer";
      layer.dataset.testid = "picture-layer";
      host.append(layer);
    }
    const project = safeProject();
    const present = new Set<string>();
    for (const picture of Object.values(pictures)) {
      present.add(picture.pictureId);
      this.syncPictureSlot(layer, picture, project);
    }
    for (const [id, slot] of this.pictureSlots) {
      if (present.has(id)) continue;
      slot.container.remove();
      this.pictureSlots.delete(id);
    }
    this.ensurePictureTicker();
  }

  private syncPictureSlot(
    layer: HTMLElement,
    picture: PictureState,
    project: RuntimeAssetProject | undefined
  ): void {
    const target = pictureTransformFromState(picture);
    let slot = this.pictureSlots.get(picture.pictureId);
    // 슬롯이 이 호출에서 처음 만들어졌는지. 첫 표시는 트윈 분기 조건이 다르다(아래 주석).
    const created = !slot;
    if (!slot) {
      const container = document.createElement("div");
      container.className = "picture-layer-item";
      container.dataset.pictureId = picture.pictureId;
      container.dataset.testid = `picture-${picture.pictureId}`;
      layer.append(container);
      slot = {
        container,
        img: null,
        label: null,
        resourceId: "",
        displayed: target,
        from: target,
        to: target,
        startedAt: this.pictureNow(),
        durationMs: 0,
      };
      this.pictureSlots.set(picture.pictureId, slot);
    }
    this.syncPictureMedia(slot, picture, project);
    slot.container.style.zIndex = String(20 + pictureZIndex(picture.pictureId));
    const duration = picture.durationMs ?? 0;
    const transitionRequested = takePendingPictureTransition(picture);
    if (created && duration > 0 && transitionRequested) {
      const from: PictureTransform = { ...target, opacity: 0 };
      slot.from = from;
      slot.to = target;
      slot.startedAt = this.pictureNow();
      slot.durationMs = duration;
      slot.displayed = from;
      applyPictureTransform(slot.container, from);
    } else if (duration > 0 && transitionRequested && !pictureTransformsEqual(slot.to, target)) {
      slot.from = slot.displayed;
      slot.to = target;
      slot.startedAt = this.pictureNow();
      slot.durationMs = duration;
    } else if (created || duration <= 0 || !pictureTransformsEqual(slot.to, target)) {
      slot.from = target;
      slot.to = target;
      slot.durationMs = 0;
      slot.displayed = target;
      applyPictureTransform(slot.container, target);
    }
  }

  private syncPictureMedia(
    slot: PictureSlot,
    picture: PictureState,
    project: RuntimeAssetProject | undefined
  ): void {
    const url = resolvePictureSource(picture.resourceId, project);
    if (url) {
      slot.label?.remove();
      slot.label = null;
      if (!slot.img) {
        const img = document.createElement("img");
        img.className = "picture-layer-image";
        img.alt = picture.pictureId;
        slot.container.append(img);
        slot.img = img;
      }
      if (slot.resourceId !== picture.resourceId) {
        slot.img.src = url;
      }
      slot.container.dataset.render = "image";
    } else {
      slot.img?.remove();
      slot.img = null;
      if (!slot.label) {
        const label = document.createElement("span");
        label.className = "picture-layer-label";
        slot.container.append(label);
        slot.label = label;
      }
      slot.label.textContent = resourceDisplayName(picture.resourceId, picture.pictureId);
      slot.container.dataset.render = "label";
    }
    slot.resourceId = picture.resourceId;
  }

  // 진행 중인 픽처 트윈이 있으면 requestAnimationFrame 으로 프레임마다 보간을 적용한다.
  private ensurePictureTicker(): void {
    if (this.pictureRafId !== 0) return;
    if (typeof requestAnimationFrame !== "function") {
      // rAF 미지원 환경(테스트 등)에서는 트윈 없이 최종 상태로 즉시 확정한다.
      this.finishPictureTweens();
      return;
    }
    const tick = (): void => {
      const stillAnimating = this.stepPictureTweens();
      this.pictureRafId = stillAnimating ? requestAnimationFrame(tick) : 0;
    };
    this.pictureRafId = requestAnimationFrame(tick);
  }

  private stepPictureTweens(): boolean {
    let animating = false;
    const now = this.pictureNow();
    for (const slot of this.pictureSlots.values()) {
      if (slot.durationMs <= 0) continue;
      const progress = tweenProgress(now - slot.startedAt, slot.durationMs);
      slot.displayed = interpolatePictureTransform(slot.from, slot.to, progress);
      applyPictureTransform(slot.container, slot.displayed);
      if (progress >= 1) {
        slot.durationMs = 0;
        slot.from = slot.to;
        slot.displayed = slot.to;
      } else {
        animating = true;
      }
    }
    return animating;
  }

  private finishPictureTweens(): void {
    for (const slot of this.pictureSlots.values()) {
      if (slot.durationMs <= 0) continue;
      slot.displayed = slot.to;
      slot.durationMs = 0;
      slot.from = slot.to;
      applyPictureTransform(slot.container, slot.to);
    }
  }

  private syncTimerHud(timers: Record<string, number>, active: Record<string, boolean>): void {
    const host = this.host();
    if (!host) return;
    const entries = Object.entries(timers).filter(([id, seconds]) => seconds > 0 || active[id] === true);
    const existing = host.querySelector("[data-testid='runtime-timer-hud']");
    if (entries.length === 0) {
      existing?.remove();
      return;
    }
    const node = existing instanceof HTMLElement ? existing : document.createElement("div");
    if (!existing) {
      node.className = "runtime-timer-hud";
      node.dataset.testid = "runtime-timer-hud";
      host.append(node);
    }
    node.textContent = entries.map(([id, seconds]) => `${id}: ${formatTimer(seconds)}${active[id] ? "" : " paused"}`).join("  ");
  }

  private syncTimeHud(gameTime: GameTime | undefined, phase: TimePhase | undefined, lines?: readonly string[]): void {
    const host = this.host();
    if (!host) return;
    const existing = host.querySelector("[data-testid='runtime-time-hud']");
    if (!gameTime) {
      existing?.remove();
      return;
    }
    const node = existing instanceof HTMLElement ? existing : document.createElement("div");
    if (!existing) {
      node.className = "runtime-time-hud";
      node.dataset.testid = "runtime-time-hud";
      host.append(node);
    }
    node.dataset.phase = phase ?? "";
    node.textContent = lines?.length ? lines.join("\n") : formatGameTime(gameTime);
  }
}

// 현재 프로젝트(에셋 해석용). store 가 아직 준비되지 않았어도 안전하게 undefined 반환.
function safeProject(): RuntimeAssetProject | undefined {
  try {
    return store.getCurrent();
  } catch {
    return undefined;
  }
}

// 픽처 변환값을 컨테이너 DOM 스타일에 적용한다. 위치는 left/top, 크기/회전은 transform, 투명도는 opacity.
function applyPictureTransform(container: HTMLElement, transform: PictureTransform): void {
  container.style.left = `${transform.x}px`;
  container.style.top = `${transform.y}px`;
  container.style.transform = pictureCssTransform(transform);
  container.style.opacity = String(pictureCssOpacity(transform));
}

function formatTimer(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
