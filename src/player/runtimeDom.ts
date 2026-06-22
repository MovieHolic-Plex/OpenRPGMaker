import { TILE_SIZE } from "@/assets/bundled";
import type { BattleResult } from "@/battle/runtime";
import type { AudioCommandState, PictureState } from "@/project/session";
import type { RuntimeEventView } from "@/player/runtimeEventState";

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
  readonly events: Record<string, RuntimeEventSnapshot>;
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
      item.textContent = `${picture.pictureId}:${picture.resourceId}`;
      item.style.left = `${picture.x}px`;
      item.style.top = `${picture.y}px`;
      layer.append(item);
    }
  }
}
