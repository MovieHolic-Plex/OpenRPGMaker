import { TILE_SIZE } from "@/assets/bundled";
import type { BattleResult } from "@/battle/runtime";
import type { AudioCommandState, PictureState, PlaySession } from "@/project/session";
import type { ActorVitals } from "@/project/sessionVitals";
import type { M2RuntimeState } from "@/player/types";
import type { RuntimeEventView } from "@/player/runtimeEventState";
import type { RuntimeMoverSnapshot } from "@/player/runtimeMoverSnapshots";
import { resourceDisplayName } from "@/player/resourceDisplay";

export interface RuntimeEventSnapshot {
  readonly x: number;
  readonly y: number;
  readonly pageId?: string;
  readonly priority: string;
  readonly trigger: string;
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
  readonly actorEquipment: PlaySession["actorEquipment"];
  readonly actorRows: PlaySession["actorRows"];
  readonly audio: AudioCommandState;
  readonly pictures: Record<string, PictureState>;
  readonly m2Runtime?: M2RuntimeState;
  readonly events: Record<string, RuntimeEventSnapshot>;
  readonly movers: Record<string, RuntimeMoverSnapshot>;
  readonly battleResult?: BattleResult;
}

export class RuntimeDomOverlay {
  private readonly eventMarkers: Map<string, HTMLElement> = new Map();
  private readonly spriteMarkers: Map<string, HTMLElement> = new Map();

  constructor(private readonly host: () => HTMLElement | undefined) {}

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
    marker.style.left = `${view.x * TILE_SIZE}px`;
    marker.style.top = `${view.y * TILE_SIZE}px`;
    marker.style.width = `${TILE_SIZE}px`;
    marker.style.height = `${TILE_SIZE}px`;
    marker.dataset.pageId = view.pageId ?? "";
    marker.dataset.priority = view.priority;
    marker.dataset.trigger = view.trigger.kind;
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
    marker.style.left = `${view.x * TILE_SIZE}px`;
    marker.style.top = `${view.y * TILE_SIZE}px`;
    marker.style.width = `${TILE_SIZE}px`;
    marker.style.height = `${TILE_SIZE}px`;
    marker.dataset.pageId = view.pageId ?? "";
    marker.dataset.priority = view.priority;
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
    while (layer.firstChild) {
      layer.removeChild(layer.firstChild);
    }
    for (const picture of Object.values(pictures)) {
      const item = document.createElement("div");
      item.className = "picture-layer-item";
      item.dataset.pictureId = picture.pictureId;
      item.textContent = resourceDisplayName(picture.resourceId, picture.pictureId);
      item.style.left = `${picture.x}px`;
      item.style.top = `${picture.y}px`;
      layer.append(item);
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
}

function formatTimer(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
