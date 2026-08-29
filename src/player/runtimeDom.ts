import { TILE_SIZE } from "@/assets/bundled";
import type { BattleResult } from "@/battle/runtime";
import type { AudioCommandState, PictureState, PlaySession } from "@/project/session";
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
import type { Project } from "@/project/types";
import { formatGameTime, type GameTime, type TimePhase } from "@/project/gameTime";
import { resolvePlayResolution } from "@/project/playResolution";

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

export interface RuntimeEventSnapshot {
  readonly x: number;
  readonly y: number;
  readonly pageId?: string;
  readonly priority: string;
  readonly trigger: string;
  readonly direction?: string;
}

export interface RuntimeStateSnapshot {
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

export class RuntimeDomOverlay {
  private readonly eventMarkers: Map<string, HTMLElement> = new Map();
  private readonly spriteMarkers: Map<string, HTMLElement> = new Map();
  private readonly pictureSlots: Map<string, PictureSlot> = new Map();
  private pictureRafId = 0;

  constructor(private readonly host: () => HTMLElement | undefined) {}

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
    if (cameraX === this.cameraX && cameraY === this.cameraY) return;
    this.cameraX = cameraX;
    this.cameraY = cameraY;
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
    const { width: stageWidth, height: stageHeight } = this.stageSize();
    const visible =
      screenX > -TILE_SIZE && screenY > -TILE_SIZE && screenX < stageWidth && screenY < stageHeight;
    marker.dataset.offscreen = visible ? "" : "1";
    marker.style.left = `${visible ? screenX : 0}px`;
    marker.style.top = `${visible ? screenY : 0}px`;
    marker.style.visibility = visible ? "" : "hidden";
    marker.style.pointerEvents = visible ? "" : "none";
  }

  private stageSize(): { readonly width: number; readonly height: number } {
    const host = this.host();
    const width = host?.clientWidth || Number.parseFloat(host?.style.width ?? "");
    const height = host?.clientHeight || Number.parseFloat(host?.style.height ?? "");
    const fallback = resolvePlayResolution(store.getCurrent().system);
    return {
      width: Number.isFinite(width) && width > 0 ? width : fallback.width,
      height: Number.isFinite(height) && height > 0 ? height : fallback.height,
    };
  }

  upsertEventMarker(view: RuntimeEventView, onActivate?: (eventId: string) => void): void {
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
    marker.dataset.mapX = `${view.x * TILE_SIZE}`;
    marker.dataset.mapY = `${view.y * TILE_SIZE}`;
    marker.style.width = `${TILE_SIZE}px`;
    marker.style.height = `${TILE_SIZE}px`;
    marker.dataset.pageId = view.pageId ?? "";
    marker.dataset.priority = view.priority;
    marker.dataset.trigger = view.trigger.kind;
    this.placeMarker(marker);
    this.syncSpriteMarker(host, view);
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

  private syncSpriteMarker(host: HTMLElement, view: RuntimeEventView): void {
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
    marker.dataset.mapX = `${view.x * TILE_SIZE}`;
    marker.dataset.mapY = `${view.y * TILE_SIZE}`;
    marker.style.width = `${TILE_SIZE}px`;
    marker.style.height = `${TILE_SIZE}px`;
    marker.dataset.pageId = view.pageId ?? "";
    marker.dataset.priority = view.priority;
    this.placeMarker(marker);
  }

  syncMissingResourceError(missingResources: ReadonlySet<string>): void {
    const host = this.host();
    if (!host) return;
    host.querySelector("[data-testid='missing-resource-error']")?.remove();
    if (missingResources.size === 0) return;
    const error = document.createElement("div");
    error.className = "runtime-missing-resource";
    error.dataset.testid = "missing-resource-error";
    error.textContent = `누락된 리소스: ${Array.from(missingResources).join(", ")}`;
    host.append(error);
  }

  syncRuntimeState(snapshot: RuntimeStateSnapshot): void {
    const host = this.host();
    if (!host) return;
    const existing = host.querySelector("[data-testid='runtime-state-json']");
    const node = existing instanceof HTMLElement ? existing : document.createElement("pre");
    if (!existing) {
      node.className = "runtime-state-json";
      node.dataset.testid = "runtime-state-json";
      host.append(node);
    }
    node.textContent = JSON.stringify(snapshot);
    this.syncTimerHud(snapshot.timers, snapshot.timerActive);
    this.syncTimeHud(snapshot.gameTime, snapshot.timePhase, snapshot.lifeCalendarHudLines);
  }

  syncAudioState(audio: AudioCommandState): void {
    const host = this.host();
    if (!host) return;
    const existing = host.querySelector("[data-testid='audio-state-json']");
    const node = existing instanceof HTMLElement ? existing : document.createElement("pre");
    if (!existing) {
      node.className = "runtime-state-json runtime-audio-state-json";
      node.dataset.testid = "audio-state-json";
      host.append(node);
    }
    node.textContent = JSON.stringify(audio);
  }

  // 픽처 레이어를 실제 이미지로 렌더한다. 리소스가 이미지로 해석되면 <img> 슬롯을,
  // 아니면 기존 텍스트 라벨을 배치한다(폴백/테스트 호환). z-order 는 픽처 번호로 유도하고,
  // durationMs 가 있으면 Move Picture 트윈(이동/스케일/불투명/회전)을 시작한다.
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
        startedAt: nowMs(),
        durationMs: 0,
      };
      this.pictureSlots.set(picture.pictureId, slot);
    }
    this.syncPictureMedia(slot, picture, project);
    slot.container.style.zIndex = String(20 + pictureZIndex(picture.pictureId));
    const duration = picture.durationMs ?? 0;
    if (duration > 0 && !pictureTransformsEqual(slot.displayed, target)) {
      slot.from = slot.displayed;
      slot.to = target;
      slot.startedAt = nowMs();
      slot.durationMs = duration;
    } else if (duration <= 0) {
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
    const now = nowMs();
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
