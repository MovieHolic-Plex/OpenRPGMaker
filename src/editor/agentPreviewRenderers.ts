import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import type { AgentFocusBounds, AgentFocusCell, AgentFocusTarget } from "@/editor/agentFocus";
import {
  agentGhostPreviewsForMap,
  getAgentGhostPreviewState,
  isAgentGhostPreviewHidden,
  type AgentGhostBounds,
  type AgentGhostCell,
  type AgentGhostPreview,
} from "@/editor/agentGhostPreview";
import { buildInlineApprovalToolbar, getInlineProposalActions } from "@/editor/proposalInlineApproval";
import type { MapId } from "@/project/types";

const AGENT_FOCUS_MAX_CELL_RECTS = 256;
const AGENT_FOCUS_HIGHLIGHT_MS = 2200;
const AGENT_GHOST_MAX_CELL_RECTS = 256;
const AGENT_GHOST_FILL_COLOR = 0x20c997;
const AGENT_GHOST_STROKE_COLOR = 0x63e6be;

type SceneWithPhaserObjects = Phaser.Scene & {
  readonly add: Phaser.GameObjects.GameObjectFactory;
  readonly cameras: Phaser.Cameras.Scene2D.CameraManager;
  readonly game: Phaser.Game;
  readonly tweens: Phaser.Tweens.TweenManager;
};

export class AgentGhostPreviewRenderer {
  private readonly domMarkers: HTMLElement[] = [];

  constructor(
    private readonly scene: SceneWithPhaserObjects,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly mapId: () => MapId | null
  ) {}

  render(): void {
    this.layer.removeAll(true);
    this.clearDomMarkers();
    const previews = this.currentPreviews();
    if (previews.length === 0) return;

    if (!isAgentGhostPreviewHidden()) {
      const group = this.scene.add.container(0, 0);
      group.setName("agent-ghost-preview");
      this.layer.add(group);
      const cellCount = previews.reduce((total, preview) => total + preview.cells.length, 0);
      for (const preview of previews) {
        group.add(this.boundsGraphic(preview.bounds));
        if (cellCount > 0 && cellCount <= AGENT_GHOST_MAX_CELL_RECTS) {
          for (const cell of preview.cells) group.add(this.cellRect(cell));
        }
      }
    }
    this.renderDomMarkers(previews);
  }

  refreshDomMarkers(previews: readonly AgentGhostPreview[] = this.currentPreviews()): void {
    if (typeof document === "undefined") return;
    this.clearDomMarkers();
    if (previews.length === 0) return;
    const host = this.scene.game.canvas.parentElement;
    if (!host) return;
    for (const preview of previews) {
      const rect = this.screenRect(preview.bounds);
      const marker = document.createElement("div");
      marker.className = "agent-ghost-preview";
      marker.dataset.testid = "agent-ghost-preview";
      marker.setAttribute("aria-hidden", "true");
      marker.setAttribute("title", preview.label || "AI 작업 중");
      marker.style.left = `${rect.x}px`;
      marker.style.top = `${rect.y}px`;
      marker.style.width = `${rect.width}px`;
      marker.style.height = `${rect.height}px`;
      if (isAgentGhostPreviewHidden()) marker.classList.add("is-ghost-hidden");
      host.append(marker);
      this.domMarkers.push(marker);
    }
    const actions = getInlineProposalActions();
    if (actions && previews.length > 0) {
      const firstMarker = this.domMarkers[0];
      if (firstMarker) {
        const toolbar = buildInlineApprovalToolbar(actions);
        if (previews.length > 1) {
          toolbar.prepend(
            Object.assign(document.createElement("span"), {
              className: "ghost-inline-count",
              textContent: `제안 ${previews.length}곳`,
            }),
          );
        }
        firstMarker.append(toolbar);
      }
    }
  }

  clear(): void {
    this.layer.removeAll(true);
    this.clearDomMarkers();
  }

  private currentPreviews(): readonly AgentGhostPreview[] {
    return agentGhostPreviewsForMap(getAgentGhostPreviewState(), this.mapId());
  }

  private cellRect(cell: AgentGhostCell): Phaser.GameObjects.Rectangle {
    const color = cell.layer === "event" ? 0x15aabf : cell.layer === "upper" ? 0x38d9a9 : AGENT_GHOST_FILL_COLOR;
    const rect = this.scene.add.rectangle(cell.x * TILE_SIZE, cell.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, color, 0.12);
    rect.setOrigin(0, 0);
    rect.setStrokeStyle(1, color, 0.52);
    return rect;
  }

  private boundsGraphic(bounds: AgentGhostBounds): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    const x = bounds.x * TILE_SIZE;
    const y = bounds.y * TILE_SIZE;
    const width = bounds.width * TILE_SIZE;
    const height = bounds.height * TILE_SIZE;
    graphics.fillStyle(AGENT_GHOST_FILL_COLOR, 0.09);
    graphics.fillRect(x, y, width, height);
    graphics.lineStyle(2, AGENT_GHOST_STROKE_COLOR, 0.88);
    drawDashedRect(graphics, x, y, width, height, 10, 6);
    return graphics;
  }

  private renderDomMarkers(previews: readonly AgentGhostPreview[]): void {
    this.refreshDomMarkers(previews);
  }

  private screenRect(bounds: AgentGhostBounds): AgentGhostBounds {
    const camera = this.scene.cameras.main;
    const x = Math.round((bounds.x * TILE_SIZE - camera.scrollX) * camera.zoom);
    const y = Math.round((bounds.y * TILE_SIZE - camera.scrollY) * camera.zoom);
    const width = Math.max(1, Math.round(bounds.width * TILE_SIZE * camera.zoom));
    const height = Math.max(1, Math.round(bounds.height * TILE_SIZE * camera.zoom));
    return { x, y, width, height };
  }

  private clearDomMarkers(): void {
    for (const marker of this.domMarkers) marker.remove();
    this.domMarkers.length = 0;
  }
}

export class AgentFocusRenderer {
  private domMarker: HTMLElement | null = null;
  private domTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly scene: SceneWithPhaserObjects,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly mapId: () => MapId | null
  ) {}

  show(target: AgentFocusTarget): void {
    if (!target.bounds || target.mapId !== this.mapId()) return;
    this.clear();

    const group = this.scene.add.container(0, 0);
    group.setName("agent-focus-highlight");
    this.layer.add(group);

    const cells = target.cells.filter((cell) => cell.x >= 0 && cell.y >= 0);
    if (cells.length > 0 && cells.length <= AGENT_FOCUS_MAX_CELL_RECTS) {
      for (const cell of cells) group.add(this.cellRect(cell));
    }
    group.add(this.boundsRect(target.bounds, cells.length > AGENT_FOCUS_MAX_CELL_RECTS));
    group.setAlpha(1);
    this.scene.tweens.add({
      targets: group,
      alpha: 0,
      duration: AGENT_FOCUS_HIGHLIGHT_MS,
      ease: "Cubic.easeOut",
      onComplete: () => group.destroy(true),
    });
    this.renderDomMarker(target.bounds);
  }

  clear(): void {
    this.layer.removeAll(true);
    this.clearDomMarker();
  }

  private cellRect(cell: AgentFocusCell): Phaser.GameObjects.Rectangle {
    const color = cell.layer === "event" ? 0xff922b : cell.layer === "upper" ? 0x74c0fc : 0xffd43b;
    const rect = this.scene.add.rectangle(cell.x * TILE_SIZE, cell.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, color, 0.2);
    rect.setOrigin(0, 0);
    rect.setStrokeStyle(1, color, 0.72);
    return rect;
  }

  private boundsRect(bounds: AgentFocusBounds, strongFill: boolean): Phaser.GameObjects.Rectangle {
    const rect = this.scene.add.rectangle(
      bounds.x * TILE_SIZE,
      bounds.y * TILE_SIZE,
      bounds.width * TILE_SIZE,
      bounds.height * TILE_SIZE,
      0xffd43b,
      strongFill ? 0.16 : 0.08
    );
    rect.setOrigin(0, 0);
    rect.setStrokeStyle(3, 0xfff3bf, 0.95);
    return rect;
  }

  private renderDomMarker(bounds: AgentFocusBounds): void {
    if (typeof document === "undefined") return;
    const host = this.scene.game.canvas.parentElement;
    if (!host) return;
    const rect = this.screenRect(bounds);
    const marker = document.createElement("div");
    marker.className = "agent-focus-highlight";
    marker.dataset.testid = "agent-focus-highlight";
    marker.setAttribute("aria-hidden", "true");
    marker.style.left = `${rect.x}px`;
    marker.style.top = `${rect.y}px`;
    marker.style.width = `${rect.width}px`;
    marker.style.height = `${rect.height}px`;
    host.append(marker);
    this.domMarker = marker;
    this.domTimer = setTimeout(() => this.clearDomMarker(), AGENT_FOCUS_HIGHLIGHT_MS + 100);
  }

  private screenRect(bounds: AgentFocusBounds): AgentFocusBounds {
    const camera = this.scene.cameras.main;
    const x = Math.round((bounds.x * TILE_SIZE - camera.scrollX) * camera.zoom);
    const y = Math.round((bounds.y * TILE_SIZE - camera.scrollY) * camera.zoom);
    const width = Math.max(1, Math.round(bounds.width * TILE_SIZE * camera.zoom));
    const height = Math.max(1, Math.round(bounds.height * TILE_SIZE * camera.zoom));
    return { x, y, width, height };
  }

  private clearDomMarker(): void {
    if (this.domTimer) {
      clearTimeout(this.domTimer);
      this.domTimer = null;
    }
    this.domMarker?.remove();
    this.domMarker = null;
  }
}

function drawDashedRect(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  dash: number,
  gap: number
): void {
  drawDashedLine(graphics, x, y, x + width, y, dash, gap);
  drawDashedLine(graphics, x + width, y, x + width, y + height, dash, gap);
  drawDashedLine(graphics, x + width, y + height, x, y + height, dash, gap);
  drawDashedLine(graphics, x, y + height, x, y, dash, gap);
}

function drawDashedLine(
  graphics: Phaser.GameObjects.Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  dash: number,
  gap: number
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy);
  if (length <= 0) return;
  const ux = dx / length;
  const uy = dy / length;
  let cursor = 0;
  while (cursor < length) {
    const next = Math.min(cursor + dash, length);
    graphics.beginPath();
    graphics.moveTo(x0 + ux * cursor, y0 + uy * cursor);
    graphics.lineTo(x0 + ux * next, y0 + uy * next);
    graphics.strokePath();
    cursor = next + gap;
  }
}
