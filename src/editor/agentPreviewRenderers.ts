import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import type { AgentFocusBounds, AgentFocusCell, AgentFocusTarget } from "@/editor/agentFocus";
import {
  agentGhostPreviewsForMap,
  buildGhostRevealSchedule,
  getAgentGhostDraftMap,
  getAgentGhostPreviewState,
  type AgentGhostPreviewState,
  isAgentGhostPreviewHidden,
  type AgentGhostBounds,
  type AgentGhostCell,
  type AgentGhostPreview,
  type GhostRevealStep,
} from "@/editor/agentGhostPreview";
import { buildInlineApprovalToolbar, getInlineProposalActions } from "@/editor/proposalInlineApproval";
import { createChipsetTileObject } from "@/editor/chipsetTileRender";
import { ensureTilesetTexture } from "@/editor/tilesetImage";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

const AGENT_FOCUS_MAX_CELL_RECTS = 256;
const AGENT_FOCUS_HIGHLIGHT_MS = 2200;
export const AGENT_GHOST_MAX_CELL_RECTS = 256;
const AGENT_GHOST_FILL_COLOR = 0x20c997;
const AGENT_GHOST_STROKE_COLOR = 0x63e6be;
const AGENT_GHOST_INDIGO_COLOR = 0x4a57d6;
const AGENT_GHOST_AMBER_COLOR = 0xffc078;
const GHOST_SPRITE_ALPHA = 0.62;

// Animation timing constants
export const STAMP_POP_DURATION_MS = 180;
export const RING_FADE_DURATION_MS = 800;
export const AFTERGLOW_FADE_DURATION_MS = 800;
export const SPARK_DURATION_MS = 350;
export const FINISH_SHINE_DURATION_MS = 450;
const LAST_CELL_DISPLAY_MS = 300;

export type CellPhase = "pending" | "stamping" | "settling" | "done";

export interface GhostCellAnimState {
  readonly phase: CellPhase;
  readonly scale: number; // 1.5 -> 1.0 during stamping (180ms), then 1.0
  readonly ringAlpha: number; // 1.0 -> 0 over 800ms
  readonly afterglowAlpha: number; // 0.5 -> 0 over 800ms
  readonly sparkProgress: number; // 0 -> 1 over 350ms
}

export interface GhostAnimationState {
  readonly cellStates: readonly GhostCellAnimState[];
  readonly cursorCell: AgentGhostCell | null;
  readonly shineProgress: number; // 0 -> 1 over 450ms after full schedule finishes
  readonly isScheduleComplete: boolean;
  readonly stampedCount: number;
}

export function computeGhostAnimationState(
  schedule: readonly GhostRevealStep[],
  elapsedMs: number
): GhostAnimationState {
  if (schedule.length === 0) {
    return {
      cellStates: [],
      cursorCell: null,
      shineProgress: 1,
      isScheduleComplete: true,
      stampedCount: 0,
    };
  }

  let stampedCount = 0;
  let latestActiveCell: AgentGhostCell | null = null;
  let latestActiveStart = -1;

  const cellStates: GhostCellAnimState[] = schedule.map((step) => {
    const cellElapsed = elapsedMs - step.startMs;
    if (cellElapsed < 0) {
      return {
        phase: "pending" as const,
        scale: 1.5,
        ringAlpha: 0,
        afterglowAlpha: 0,
        sparkProgress: 0,
      };
    }

    stampedCount += 1;
    if (step.startMs >= latestActiveStart) {
      latestActiveStart = step.startMs;
      latestActiveCell = step.cell;
    }

    if (cellElapsed < STAMP_POP_DURATION_MS) {
      const popT = cellElapsed / STAMP_POP_DURATION_MS;
      const scale = 1.5 - 0.5 * popT;
      const ringAlpha = 1 - cellElapsed / RING_FADE_DURATION_MS;
      const afterglowAlpha = 0.5 * (1 - cellElapsed / AFTERGLOW_FADE_DURATION_MS);
      const sparkProgress = Math.min(1, cellElapsed / SPARK_DURATION_MS);
      return {
        phase: "stamping" as const,
        scale,
        ringAlpha: Math.max(0, ringAlpha),
        afterglowAlpha: Math.max(0, afterglowAlpha),
        sparkProgress,
      };
    }

    if (cellElapsed < RING_FADE_DURATION_MS) {
      const ringAlpha = 1 - cellElapsed / RING_FADE_DURATION_MS;
      const afterglowAlpha = 0.5 * (1 - cellElapsed / AFTERGLOW_FADE_DURATION_MS);
      const sparkProgress = Math.min(1, cellElapsed / SPARK_DURATION_MS);
      return {
        phase: "settling" as const,
        scale: 1.0,
        ringAlpha: Math.max(0, ringAlpha),
        afterglowAlpha: Math.max(0, afterglowAlpha),
        sparkProgress,
      };
    }

    return {
      phase: "done" as const,
      scale: 1.0,
      ringAlpha: 0,
      afterglowAlpha: 0,
      sparkProgress: 1,
    };
  });

  const lastStepStart = schedule[schedule.length - 1].startMs;
  // 경과 0ms에서 바로 완료로 뜨지 않게: 마지막 셀도 최소 표시 시간을 보장한다.
  const isScheduleComplete = elapsedMs >= lastStepStart + LAST_CELL_DISPLAY_MS;

  let shineProgress = 0;
  if (isScheduleComplete) {
    const shineElapsed = elapsedMs - lastStepStart - LAST_CELL_DISPLAY_MS;
    shineProgress = Math.min(1, Math.max(0, shineElapsed / FINISH_SHINE_DURATION_MS));
  }

  return {
    cellStates,
    cursorCell: latestActiveCell,
    shineProgress,
    isScheduleComplete,
    stampedCount,
  };
}

/** 프로젝트 diff 로 합성된 프리뷰가 쓰는 가짜 도구명 — 칩 라벨로는 쓸모가 없다. */
export const GHOST_DIFF_PSEUDO_TOOL = "live_project_diff";

/**
 * 칩에 쓸 도구명을 고른다. diff 프리뷰의 가짜 도구명(live_project_diff)보다
 * tool_started 로 들어온 실제 도구명을 우선한다.
 */
export function preferredGhostToolName(previewToolName: string, runningToolName: string): string {
  if (previewToolName && previewToolName !== GHOST_DIFF_PSEUDO_TOOL) return previewToolName;
  if (runningToolName) return runningToolName;
  return previewToolName;
}

export function koreanToolLabel(toolName: string): string {
  if (/^(?:build|author|paint|fill|create|scatter)/u.test(toolName)) {
    return "시공 중";
  }
  if (/^(?:place_npc|make_villager)/u.test(toolName)) {
    return "주민 배치 중";
  }
  if (/^upsert_event/u.test(toolName)) {
    return "이벤트 연결 중";
  }
  return "작업 중";
}

export interface PhaseChipInfo {
  readonly koreanLabel: string;
  readonly text: string;
  readonly spinner: boolean;
}

export function ghostPhaseChipInfo(options: {
  readonly toolName?: string;
  readonly stampedCount: number;
  readonly totalCount: number;
  readonly isScheduleComplete: boolean;
}): PhaseChipInfo {
  if (options.isScheduleComplete) {
    return {
      koreanLabel: "초안 완성",
      text: "초안 완성 · 검토 대기",
      spinner: false,
    };
  }

  const tool = options.toolName || "작업";
  const label = koreanToolLabel(tool);
  return {
    koreanLabel: label,
    text: `${label} · ${options.stampedCount}/${options.totalCount} 셀 · ${tool}`,
    spinner: true,
  };
}

/** 같은 셀 집합인지 판별하는 지문 — 셀 순서까지 같아야 같은 스케줄로 본다. */
function ghostScheduleKey(schedule: readonly GhostRevealStep[]): string {
  return schedule.map((step) => `${step.cell.x},${step.cell.y},${step.cell.layer ?? ""},${step.cell.tileId ?? ""}`).join("|");
}

type SceneWithPhaserObjects = Phaser.Scene & {
  readonly add: Phaser.GameObjects.GameObjectFactory;
  readonly cameras: Phaser.Cameras.Scene2D.CameraManager;
  readonly game: Phaser.Game;
  readonly tweens: Phaser.Tweens.TweenManager;
  readonly events: Phaser.Events.EventEmitter;
};

export interface AgentGhostPreviewRendererOptions {
  readonly clock?: () => number;
}

export class AgentGhostPreviewRenderer {
  private readonly domMarkers: HTMLElement[] = [];
  private phaseChip: HTMLElement | null = null;
  private clock: () => number;
  private startTime: number | null = null;
  private schedule: readonly GhostRevealStep[] = [];
  private currentToolName: string = "";
  /** 초안 맵 공급자(선택) — 있으면 타일을 에디터 컴포지터 경로로 합성해 찍는다. */
  draftMapProvider?: (mapId: MapId) => import("@/project/types").GameMap | null | undefined;
  private cachedBounds: AgentGhostBounds | null = null;
  private animGroup: Phaser.GameObjects.Container | null = null;
  private scheduleKey: string = "";
  private tickerBound: (() => void) | null = null;

  constructor(
    private readonly scene: SceneWithPhaserObjects,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly mapId: () => MapId | null,
    options: AgentGhostPreviewRendererOptions = {}
  ) {
    this.clock = options.clock ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  }

  setClock(clock: () => number): void {
    this.clock = clock;
  }

  getCurrentSchedule(): readonly GhostRevealStep[] {
    return this.schedule;
  }

  render(): void {
    this.layer.removeAll(true);
    this.clearDomMarkers();
    const previews = this.currentPreviews();
    if (previews.length === 0) {
      this.clearPhaseChip();
      this.schedule = [];
      this.scheduleKey = "";
      this.startTime = null;
      this.animGroup = null;
      this.stopTicker();
      return;
    }

    const allCells = previews.flatMap((p) => p.cells);
    this.schedule = buildGhostRevealSchedule(allCells);
    // 같은 셀 집합으로 다시 렌더되면(스토어 emit, 카메라 변경 등) 시작 시각을 유지한다.
    // 아니면 공개 애니메이션이 매 emit 마다 처음으로 되돌아가 첫 프레임에서 얼어붙는다.
    const nextKey = ghostScheduleKey(this.schedule);
    if (this.startTime === null || nextKey !== this.scheduleKey) {
      this.startTime = this.clock();
    }
    this.scheduleKey = nextKey;
    this.currentToolName = preferredGhostToolName(previews[0]?.toolName ?? "", this.currentState().runningToolName ?? "");

    // compute union bounds
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const preview of previews) {
      minX = Math.min(minX, preview.bounds.x);
      minY = Math.min(minY, preview.bounds.y);
      maxX = Math.max(maxX, preview.bounds.x + preview.bounds.width);
      maxY = Math.max(maxY, preview.bounds.y + preview.bounds.height);
    }
    this.cachedBounds =
      Number.isFinite(minX) && maxX > minX && maxY > minY
        ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
        : null;

    if (!isAgentGhostPreviewHidden()) {
      const group = this.scene.add.container(0, 0);
      group.setName("agent-ghost-preview");
      this.layer.add(group);
      this.animGroup = group;

      for (const preview of previews) {
        group.add(this.boundsGraphic(preview.bounds));
      }
    }

    this.renderDomMarkers(previews);
    this.update();
    this.startTicker();
  }

  /**
   * 씬 update 이벤트에 붙어 공개 스케줄을 프레임마다 진행시킨다.
   * 스케줄 + 마무리 샤인이 끝나면 스스로 떨어진다(유휴 시 프레임 작업 0).
   */
  private startTicker(): void {
    if (this.tickerBound || this.schedule.length === 0) return;
    const tick = (): void => {
      if (this.startTime === null || this.schedule.length === 0) {
        this.stopTicker();
        return;
      }
      // 한 프레임의 렌더 오류(예: 컴포지터 경로의 예외)가 리빌 전체를 얼리는 것을 막는다 —
      // 칩 텍스트 갱신은 drawAnimationLayers 보다 앞서므로, 예외가 나도 진행 상태는 살아 있다.
      try {
        this.update();
      } catch (error) {
        console.warn("[agent-ghost] reveal frame error", error);
      }
      const elapsed = this.clock() - this.startTime;
      const last = this.schedule[this.schedule.length - 1].startMs;
      if (elapsed >= last + LAST_CELL_DISPLAY_MS + FINISH_SHINE_DURATION_MS) this.stopTicker();
    };
    this.tickerBound = tick;
    this.scene.events.on("update", tick);
    this.scene.events.once("shutdown", this.stopTicker, this);
    this.scene.events.once("destroy", this.stopTicker, this);
  }

  private stopTicker(): void {
    if (!this.tickerBound) return;
    this.scene.events.off("update", this.tickerBound);
    this.tickerBound = null;
  }

  update(): void {
    const previews = this.currentPreviews();
    if (previews.length === 0) {
      this.clearPhaseChip();
      return;
    }

    const cellCount = previews.reduce((total, preview) => total + preview.cells.length, 0);
    const now = this.clock();
    const elapsed = this.startTime !== null ? now - this.startTime : 0;
    // >256셀(bbox-only)에서는 프레임마다 스케줄 전체 상태를 계산하지 않는다 —
    // 100x100 채움이 셀당 상태 객체를 매 프레임 할당하는 낭비를 막는다. 칩은
    // 스케줄 길이로 완료 여부를 추정한다(스탬프된 셀 수는 bbox 케이스에서 불필요).
    const bboxOnly = cellCount > AGENT_GHOST_MAX_CELL_RECTS;
    const animState = bboxOnly
      ? {
          cellStates: [],
          cursorCell: null,
          shineProgress: 0,
          isScheduleComplete:
            this.schedule.length > 0 &&
            elapsed >= this.schedule[this.schedule.length - 1].startMs + LAST_CELL_DISPLAY_MS,
          stampedCount: Math.min(
            // O(log n): 스케줄은 startMs 오름차순 정렬 — 경과 지난 첫 미스를 이분 탐색한다.
            (() => {
              const ends = this.schedule;
              let lo = 0;
              let hi = ends.length;
              while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (elapsed >= ends[mid].startMs) lo = mid + 1;
                else hi = mid;
              }
              return lo;
            })(),
            cellCount,
          ),
        }
      : computeGhostAnimationState(this.schedule, elapsed);

    this.renderOrUpdatePhaseChip(cellCount, animState);

    if (isAgentGhostPreviewHidden() || !this.animGroup) return;

    if (cellCount > 0 && cellCount <= AGENT_GHOST_MAX_CELL_RECTS) {
      this.drawAnimationLayers(animState);
    }
  }

  private drawAnimationLayers(animState: GhostAnimationState): void {
    if (!this.animGroup) return;
    // Clear dynamic anim parts while preserving bounds
    // We recreate anim container or redraw on graphics
    const group = this.animGroup;
    group.removeAll(true);

    const previews = this.currentPreviews();
    for (const preview of previews) {
      group.add(this.boundsGraphic(preview.bounds));
    }

    // 1. Draw stamped cells
    const project = store.getCurrent();
    const currentMap = this.mapId() ? project.maps[this.mapId()!] : undefined;
    const defaultTilesetId = currentMap?.tilesetId;

    for (let i = 0; i < this.schedule.length; i++) {
      const step = this.schedule[i];
      const cell = step.cell;
      const cellAnim = animState.cellStates[i];
      if (!cellAnim || cellAnim.phase === "pending") continue;

      const px = cell.x * TILE_SIZE;
      const py = cell.y * TILE_SIZE;

      // Draw real tile or fallback rect. tileId <= EMPTY(-1) 는 지워진 칸이다 —
      // 존재하지 않는 tile_-1 프레임(=칩셋 전체 시트)이 찍히는 것을 막는다.
      const tilesetId = cell.tilesetId ?? defaultTilesetId;
      const tileset = tilesetId ? project.tilesets[tilesetId] : undefined;

      if (tileset && typeof cell.tileId === "number" && cell.tileId > TILE.EMPTY) {
        // 에디터 본 렌더와 같은 컴포지터 경로(호수 쿼터·지형 쿼터·도로 오토타일·밑동 합성)로
        // 찍는다 — raw 프레임 스탬프는 수락 후 결과물과 다른 그림을 보여주는 오덕정이 된다.
        // 초안 맵을 만들어 다음 셀 좌표를 대입하면 createChipsetTileObject 가
        // 다음 셀의 이웃 타일까지 반영한 조합을 내려준다.
        const draftMap = getAgentGhostDraftMap(this.mapId() as MapId) ?? null;
        const composed = draftMap
          ? createChipsetTileObject(this.scene, draftMap, tileset, cell.x, cell.y, cell.tileId)
          : null;
        if (composed) {
          composed.setAlpha(GHOST_SPRITE_ALPHA);
          if (cellAnim.scale !== 1.0) {
            const s = cellAnim.scale;
            composed.setScale(s);
            composed.x = px - (TILE_SIZE * (s - 1)) / 2;
            composed.y = py - (TILE_SIZE * (s - 1)) / 2;
          }
          group.add(composed);
        } else {
          const textureKey = ensureTilesetTexture(this.scene, tileset);
          const tileSprite = this.scene.add.image(px, py, textureKey, `tile_${cell.tileId}`);
          tileSprite.setOrigin(0, 0);
          tileSprite.setAlpha(GHOST_SPRITE_ALPHA);
          if (cellAnim.scale !== 1.0) {
            tileSprite.setScale(cellAnim.scale);
            const offset = (TILE_SIZE * (cellAnim.scale - 1)) / 2;
            (tileSprite as any).x = px - offset;
            (tileSprite as any).y = py - offset;
          }
          group.add(tileSprite);
        }
      } else {
        // Fallback translucent rect for cells without tileId
        const rect = this.cellRect(cell);
        group.add(rect);
      }

      // FX overlays per cell during stamp / settling
      if (cellAnim.afterglowAlpha > 0) {
        const glow = this.scene.add.rectangle(px, py, TILE_SIZE, TILE_SIZE, AGENT_GHOST_AMBER_COLOR, cellAnim.afterglowAlpha);
        glow.setOrigin(0, 0);
        group.add(glow);
      }

      if (cellAnim.ringAlpha > 0) {
        const ringGfx = this.scene.add.graphics();
        ringGfx.lineStyle(2, AGENT_GHOST_INDIGO_COLOR, cellAnim.ringAlpha);
        const expand = (1 - cellAnim.ringAlpha) * 6;
        ringGfx.strokeRect(px - expand, py - expand, TILE_SIZE + expand * 2, TILE_SIZE + expand * 2);
        group.add(ringGfx);
      }

      if (cellAnim.sparkProgress > 0 && cellAnim.sparkProgress < 1) {
        const sparkGfx = this.scene.add.graphics();
        sparkGfx.fillStyle(AGENT_GHOST_AMBER_COLOR, 1 - cellAnim.sparkProgress);
        const cx = px + TILE_SIZE / 2;
        const cy = py + TILE_SIZE / 2;
        const dist = cellAnim.sparkProgress * 12;
        // 4 radial sparks
        sparkGfx.fillRect(cx + dist, cy, 2, 2);
        sparkGfx.fillRect(cx - dist, cy, 2, 2);
        sparkGfx.fillRect(cx, cy + dist, 2, 2);
        sparkGfx.fillRect(cx, cy - dist, 2, 2);
        group.add(sparkGfx);
      }
    }

    // 2. Cursor crosshair on latest active stamped cell
    if (animState.cursorCell && !animState.isScheduleComplete) {
      const cur = animState.cursorCell;
      const cx = cur.x * TILE_SIZE;
      const cy = cur.y * TILE_SIZE;

      const cursorGfx = this.scene.add.graphics();
      cursorGfx.lineStyle(2, AGENT_GHOST_INDIGO_COLOR, 0.9);
      cursorGfx.strokeRect(cx - 2, cy - 2, TILE_SIZE + 4, TILE_SIZE + 4);

      // crosshair tick marks
      cursorGfx.lineStyle(1, 0xffffff, 0.85);
      cursorGfx.beginPath();
      cursorGfx.moveTo(cx + TILE_SIZE / 2, cy - 5);
      cursorGfx.lineTo(cx + TILE_SIZE / 2, cy + TILE_SIZE + 5);
      cursorGfx.moveTo(cx - 5, cy + TILE_SIZE / 2);
      cursorGfx.lineTo(cx + TILE_SIZE + 5, cy + TILE_SIZE / 2);
      cursorGfx.strokePath();

      group.add(cursorGfx);
    }

    // 3. Diagonal white shine sweep across preview bounds after completion
    if (this.cachedBounds && animState.isScheduleComplete && animState.shineProgress < 1) {
      const bx = this.cachedBounds.x * TILE_SIZE;
      const by = this.cachedBounds.y * TILE_SIZE;
      const bw = this.cachedBounds.width * TILE_SIZE;
      const bh = this.cachedBounds.height * TILE_SIZE;

      const shineGfx = this.scene.add.graphics();
      const t = animState.shineProgress;
      const diagonalDist = bw + bh;
      const currentPos = t * diagonalDist;

      shineGfx.lineStyle(16, 0xffffff, 0.35 * (1 - Math.abs(t - 0.5) * 2));
      shineGfx.beginPath();
      shineGfx.moveTo(bx + currentPos, by);
      shineGfx.lineTo(bx + currentPos - bh, by + bh);
      shineGfx.strokePath();

      group.add(shineGfx);
    }
  }

  private renderOrUpdatePhaseChip(totalCount: number, animState: GhostAnimationState): void {
    if (typeof document === "undefined") return;
    const host = this.scene.game?.canvas?.parentElement;
    if (!host) return;

    const info = ghostPhaseChipInfo({
      toolName: this.currentToolName,
      stampedCount: animState.stampedCount,
      totalCount,
      isScheduleComplete: animState.isScheduleComplete,
    });

    if (!this.phaseChip) {
      const chip = document.createElement("div");
      chip.className = "ai-ghost-phase-chip";
      chip.dataset.testid = "ai-ghost-phase-chip";
      host.append(chip);
      this.phaseChip = chip;
    }

    if (isAgentGhostPreviewHidden()) {
      this.phaseChip.classList.add("is-ghost-hidden");
    } else {
      this.phaseChip.classList.remove("is-ghost-hidden");
    }

    this.phaseChip.replaceChildren();
    if (info.spinner) {
      const spinner = document.createElement("span");
      spinner.className = "ai-ghost-phase-spinner";
      this.phaseChip.append(spinner);
    }
    const labelSpan = document.createElement("span");
    labelSpan.className = "ai-ghost-phase-text";
    labelSpan.textContent = info.text;
    this.phaseChip.append(labelSpan);
  }

  private clearPhaseChip(): void {
    this.phaseChip?.remove();
    this.phaseChip = null;
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
    this.stopTicker();
    this.layer.removeAll(true);
    this.clearDomMarkers();
    this.clearPhaseChip();
    this.schedule = [];
    this.scheduleKey = "";
    this.startTime = null;
    this.animGroup = null;
  }

  private currentState(): AgentGhostPreviewState {
    return getAgentGhostPreviewState();
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
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return;
  const unitX = dx / distance;
  const unitY = dy / distance;
  let cursor = 0;
  graphics.beginPath();
  while (cursor < distance) {
    const startX = x0 + unitX * cursor;
    const startY = y0 + unitY * cursor;
    const endDist = Math.min(cursor + dash, distance);
    const endX = x0 + unitX * endDist;
    const endY = y0 + unitY * endDist;
    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
    cursor += dash + gap;
  }
  graphics.strokePath();
}
