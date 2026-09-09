import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import { narrateAiActivity } from "@/editor/aiActivityNarration";
import { placeAiActivityChip } from "@/editor/aiActivityChipPlacement";
import type { AgentFocusBounds, AgentFocusCell, AgentFocusTarget } from "@/editor/agentFocus";
import {
  agentGhostPreviewsForMap,
  buildGhostRevealSchedule,
  getAgentGhostDraftMap,
  getAgentGhostPreviewState,
  GHOST_WIPE_HOLD_MS,
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
const GHOST_SPRITE_ALPHA = 0.62;

/** 와이프 셀 상태 — 선단이 지나기 전(pending)이거나 지나간 뒤(revealed) 둘뿐이다. */
export type CellPhase = "pending" | "revealed";

export interface GhostCellAnimState {
  readonly phase: CellPhase;
}

export interface GhostAnimationState {
  readonly cellStates: readonly GhostCellAnimState[];
  readonly isScheduleComplete: boolean;
  readonly revealedCount: number;
}

/**
 * 좌→우 와이프의 상태 — 셀당 팝·링·잔광·스파크가 아니라 "이미 드러났는가"만 다룬다.
 * 마지막 열이 드러난 뒤 GHOST_WIPE_HOLD_MS 가 지나면 완료로 본다(0ms 에 바로 완료로 뜨지 않게).
 */
export function computeGhostAnimationState(
  schedule: readonly GhostRevealStep[],
  elapsedMs: number
): GhostAnimationState {
  if (schedule.length === 0) {
    return { cellStates: [], isScheduleComplete: true, revealedCount: 0 };
  }
  let revealedCount = 0;
  const cellStates: GhostCellAnimState[] = schedule.map((step) => {
    if (elapsedMs < step.startMs) return { phase: "pending" as const };
    revealedCount += 1;
    return { phase: "revealed" as const };
  });

  const lastStepStart = schedule[schedule.length - 1].startMs;
  return {
    cellStates,
    isScheduleComplete: elapsedMs >= lastStepStart + GHOST_WIPE_HOLD_MS,
    revealedCount,
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
  return narrateAiActivity({ toolName }).action;
}

export interface PhaseChipInfo {
  readonly koreanLabel: string;
  readonly text: string;
  readonly spinner: boolean;
}

export function ghostPhaseChipInfo(options: {
  readonly toolName?: string;
  readonly revealedCount: number;
  readonly totalCount: number;
  readonly isScheduleComplete: boolean;
  readonly runningToolName?: string;
}): PhaseChipInfo {
  if (options.isScheduleComplete && !options.runningToolName) {
    return {
      koreanLabel: "초안 완성",
      text: "초안 완성",
      spinner: false,
    };
  }

  const narration = narrateAiActivity({ toolName: options.toolName ?? "" });
  return {
    koreanLabel: narration.action,
    text: `${narration.action} · ${options.revealedCount}/${options.totalCount} 셀`,
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
  private tileLayer: Phaser.GameObjects.Container | null = null;
  private tileLayerKey = "";
  private currentToolName: string = "";
  private tileLayerParent: Phaser.GameObjects.Container | null = null;
  /** 스케줄 순서의 타일 오브젝트 — 프레임마다 와이프 선단으로 visible 게이팅된다. */
  private tileObjects: Array<{ obj: Phaser.GameObjects.Container | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle; baseX: number; baseY: number }> = [];

  private animGroup: Phaser.GameObjects.Container | null = null;
  private scheduleKey: string = "";
  private tickerBound: (() => void) | null = null;
  /** 셀별 공개 시각(turn 시작 기준 ms) — 이미 드러난 셀이 다시 처음부터 나오지 않게 한다. */
  private readonly cellStartMs = new Map<string, number>();

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

  /**
   * 누적 스케줄 — 이미 드러난 셀은 공개 시각을 그대로 유지하고, 이번에 새로 들어온 셀만
   * 지금 시점을 기준으로 좌→우 와이프를 새로 받는다.
   *
   * 각 셀의 `startMs` 는 턴 시작(`startTime`) 기준 경과 시간이라 `computeGhostAnimationState`
   * 의 계약(상대 경과 시간)이 그대로 유지된다. 오름차순 정렬은 bbox 경로의 이분 탐색 전제다.
   */
  private accumulateSchedule(previews: readonly AgentGhostPreview[]): readonly GhostRevealStep[] {
    const keyed = previews.flatMap((preview) =>
      preview.cells.map((cell) => ({ cell, key: `${preview.mapId}:${cell.layer}:${cell.x},${cell.y}` }))
    );
    if (this.startTime === null) this.startTime = this.clock();
    const elapsedNow = Math.max(0, this.clock() - this.startTime);

    const fresh = keyed.filter((item) => !this.cellStartMs.has(item.key));
    if (fresh.length > 0) {
      const offsets = new Map<AgentGhostCell, number>();
      for (const step of buildGhostRevealSchedule(fresh.map((item) => item.cell))) {
        offsets.set(step.cell, step.startMs);
      }
      for (const item of fresh) {
        this.cellStartMs.set(item.key, elapsedNow + (offsets.get(item.cell) ?? 0));
      }
    }

    // 사라진 셀의 공개 시각은 버린다 — 프리뷰가 줄어든 뒤 같은 좌표가 다시 들어오면
    // 새 와이프를 받아야 한다. 비교 대상은 keyed.length 가 아니라 **서로 다른 키의 수**다:
    // 같은 맵에 프리뷰가 두 장 들어오면(appendAgentGhostPreviewForToolCall 경로) 같은 키가
    // 중복 계수돼 청소가 건너뛰어지고, 다시 추가된 셀이 와이프 없이 나타난다.
    const present = new Set(keyed.map((item) => item.key));
    if (this.cellStartMs.size > present.size) {
      for (const key of [...this.cellStartMs.keys()]) {
        if (!present.has(key)) this.cellStartMs.delete(key);
      }
    }

    return keyed
      .map((item) => ({
        cell: item.cell,
        startMs: this.cellStartMs.get(item.key) ?? elapsedNow,
        kind: item.cell.layer === "event" ? ("event" as const) : ("tile" as const),
      }))
      .sort((left, right) => left.startMs - right.startMs);
  }

  render(): void {
    this.layer.removeAll(true);
    this.clearDomMarkers();
    const state = this.currentState();
    const previews = agentGhostPreviewsForMap(state, this.mapId());
    if (previews.length === 0) {
      this.schedule = [];
      this.scheduleKey = "";
      this.startTime = null;
      this.cellStartMs.clear();
      this.animGroup = null;
      this.tileLayerParent = null;
      this.tileLayer = null; // layer.removeAll(true) 가 파괴했다 — 참조와 키를 반드시 리셋
      this.tileLayerKey = "";
      this.stopTicker();
      if (!state.runningToolName) {
        this.currentToolName = "";
        this.clearPhaseChip();
        return;
      }
      this.currentToolName = state.runningToolName;
      this.update();
      return;
    }

    this.schedule = this.accumulateSchedule(previews);
    // 셀 집합 지문은 타일 레이어를 다시 빌드할지 판단하는 데만 쓴다. 예전에는 이 지문이
    // 바뀔 때 startTime 까지 되감았는데, 라이브 프리뷰는 150ms 스로틀로 셀이 계속 늘어나므로
    // 툴 12개짜리 턴이 "왼쪽부터 쏵"을 12번 반복했다 — 쌓여가는 게 아니라 깜빡임으로 읽혔다.
    this.scheduleKey = ghostScheduleKey(this.schedule);
    this.currentToolName = preferredGhostToolName(previews[0]?.toolName ?? "", state.runningToolName ?? "");

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
      if (elapsed >= last + GHOST_WIPE_HOLD_MS) this.stopTicker();
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
    const state = this.currentState();
    const previews = agentGhostPreviewsForMap(state, this.mapId());
    if (previews.length === 0) {
      if (!state.runningToolName) {
        this.clearPhaseChip();
        return;
      }
      this.currentToolName = state.runningToolName;
      this.renderOrUpdatePhaseChip(0, {
        cellStates: [],
        isScheduleComplete: false,
        revealedCount: 0,
      }, previews);
      return;
    }

    this.currentToolName = preferredGhostToolName(previews[0]?.toolName ?? "", state.runningToolName);
    const cellCount = previews.reduce((total, preview) => total + preview.cells.length, 0);
    const now = this.clock();
    const elapsed = this.startTime !== null ? now - this.startTime : 0;
    // >256셀(bbox-only)에서는 프레임마다 스케줄 전체 상태를 계산하지 않는다 —
    // 100x100 채움이 셀당 상태 객체를 매 프레임 할당하는 낭비를 막는다. 칩은
    // 스케줄 길이로 진행/완료를 추정한다(셀별 게이팅은 bbox 케이스에서 불필요).
    const bboxOnly = cellCount > AGENT_GHOST_MAX_CELL_RECTS;
    const animState: GhostAnimationState = bboxOnly
      ? {
          cellStates: [],
          isScheduleComplete:
            this.schedule.length > 0 &&
            elapsed >= this.schedule[this.schedule.length - 1].startMs + GHOST_WIPE_HOLD_MS,
          revealedCount: Math.min(
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

    this.renderOrUpdatePhaseChip(cellCount, animState, previews);

    if (isAgentGhostPreviewHidden() || !this.animGroup) return;

    if (cellCount > 0 && cellCount <= AGENT_GHOST_MAX_CELL_RECTS) {
      this.drawAnimationLayers(animState);
    }
  }

  /**
   * 좌→우 와이프 렌더 — 선단이 지난 셀의 타일을 그냥 보이게 만든다.
   * 셀별 팝/링/잔광/스파크·커서 십자선·완료 샤인은 없앴다: 연출이 변경 내용을 가렸다.
   * 타일 레이어는 스케줄당 한 번만 만든다(수백 GameObject churn·재생 중 파괴 방지).
   */
  private drawAnimationLayers(animState: GhostAnimationState): void {
    if (!this.animGroup) return;

    if (!this.tileLayer || this.tileLayerKey !== this.scheduleKey || this.tileLayerParent !== this.animGroup) {
      this.buildTileLayer();
      this.tileLayerKey = this.scheduleKey;
      this.tileLayerParent = this.animGroup;
    }

    for (let i = 0; i < this.schedule.length; i++) {
      if (animState.cellStates[i]?.phase !== "revealed") continue;
      this.tileObjects[i]?.obj.setVisible(true);
    }
  }

  /** 타일 스탬프 레이어(컴포지터 경로 포함)를 스케줄당 한 번 빌드한다. */
  private buildTileLayer(): void {
    this.tileObjects = [];
    // layer.removeAll(true) 가 animGroup·그 안의 tileLayer 를 파괴한다. 파괴된 컨테이너를
    // 재사용하면 add 한 셀이 표시 목록에서 빠져 보이지 않는다(라운드3 blocker 1).
    if (this.tileLayer && this.tileLayer.parentContainer !== this.animGroup) {
      this.tileLayer = null;
      this.tileLayerKey = "";
    }
    if (this.tileLayer) {
      this.tileLayer.removeAll(true);
    } else if (this.animGroup) {
      this.tileLayer = this.scene.add.container(0, 0);
      this.animGroup.add(this.tileLayer);
    }
    if (!this.tileLayer) return;

    const project = store.getCurrent();
    const currentMap = this.mapId() ? project.maps[this.mapId()!] : undefined;
    const defaultTilesetId = currentMap?.tilesetId;
    const draftMap = getAgentGhostDraftMap(this.mapId() as MapId) ?? null;
    const objects: Array<{ obj: Phaser.GameObjects.Container | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle; baseX: number; baseY: number }> = [];

    // 스케줄 순서대로 만들어 cellStates 인덱스와 정렬한다 — 프레임마다 phase 게이팅이
    // 이 순서에 의존한다(스탬프 팝·순차 공개). 미공개 셀은 visible=false 로 둔다.
    for (const step of this.schedule) {
      const cell = step.cell;
      const px = cell.x * TILE_SIZE;
      const py = cell.y * TILE_SIZE;
      const tilesetId = cell.tilesetId ?? defaultTilesetId;
      const tileset = tilesetId ? project.tilesets[tilesetId] : undefined;

      if (tileset && typeof cell.tileId === "number" && cell.tileId > TILE.EMPTY) {
        // 에디터 본 렌더와 같은 컴포지터 경로(호수 쿼터·지형 쿼터·도로 오토타일·밑동 합성).
        // 애니메이션 스프라이트가 파괴/재생성되는 churn을 없애려고 스케줄당 한 번만 만든다.
        const composed = draftMap
          ? createChipsetTileObject(this.scene, draftMap, tileset, cell.x, cell.y, cell.tileId)
          : null;
        if (composed) {
          composed.setAlpha(GHOST_SPRITE_ALPHA);
          composed.setVisible(false);
          this.tileLayer.add(composed);
          objects.push({ obj: composed, baseX: px, baseY: py });
          continue;
        }
        const textureKey = ensureTilesetTexture(this.scene, tileset);
        const tileSprite = this.scene.add.image(px, py, textureKey, `tile_${cell.tileId}`);
        tileSprite.setOrigin(0, 0);
        tileSprite.setAlpha(GHOST_SPRITE_ALPHA);
        tileSprite.setVisible(false);
        this.tileLayer.add(tileSprite);
        objects.push({ obj: tileSprite, baseX: px, baseY: py });
      } else {
        const rect = this.cellRect(cell);
        rect.setVisible(false);
        this.tileLayer.add(rect);
        objects.push({ obj: rect, baseX: px, baseY: py });
      }
    }
    this.tileObjects = objects;
  }

  private renderOrUpdatePhaseChip(
    totalCount: number,
    animState: GhostAnimationState,
    previews: readonly AgentGhostPreview[],
  ): void {
    if (typeof document === "undefined") return;
    const host = this.scene.game?.canvas?.parentElement;
    if (!host) return;

    const info = ghostPhaseChipInfo({
      toolName: this.currentToolName,
      revealedCount: animState.revealedCount,
      totalCount,
      isScheduleComplete: animState.isScheduleComplete,
      runningToolName: this.currentState().runningToolName,
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
    this.positionPhaseChip(previews);
  }

  private positionPhaseChip(previews: readonly AgentGhostPreview[]): void {
    const chip = this.phaseChip;
    const canvas = this.scene.game?.canvas;
    if (!chip || !canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const hostRect = canvas.parentElement?.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    const placement = placeAiActivityChip({
      region: this.previewBoundingRegion(previews),
      camera: {
        worldView: {
          x: this.scene.cameras.main.worldView.x,
          y: this.scene.cameras.main.worldView.y,
        },
        zoom: this.scene.cameras.main.zoom,
      },
      viewport: {
        width: Math.max(1, canvasRect.width || canvas.width),
        height: Math.max(1, canvasRect.height || canvas.height),
      },
      chip: {
        width: Math.max(1, chipRect.width || chip.offsetWidth),
        height: Math.max(1, chipRect.height || chip.offsetHeight),
      },
    });
    const hostOffsetX = hostRect ? canvasRect.left - hostRect.left : 0;
    const hostOffsetY = hostRect ? canvasRect.top - hostRect.top : 0;
    chip.style.left = `${Math.round(hostOffsetX + placement.left)}px`;
    chip.style.top = `${Math.round(hostOffsetY + placement.top)}px`;
    chip.dataset.chipMode = placement.mode;
  }

  private previewBoundingRegion(previews: readonly AgentGhostPreview[]): AgentGhostBounds | null {
    if (previews.length === 0) return null;
    const left = Math.min(...previews.map((preview) => preview.bounds.x));
    const top = Math.min(...previews.map((preview) => preview.bounds.y));
    const right = Math.max(...previews.map((preview) => preview.bounds.x + preview.bounds.width));
    const bottom = Math.max(...previews.map((preview) => preview.bounds.y + preview.bounds.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  private clearPhaseChip(): void {
    this.phaseChip?.remove();
    this.phaseChip = null;
  }

  refreshDomMarkers(previews: readonly AgentGhostPreview[] = this.currentPreviews()): void {
    if (typeof document === "undefined") return;
    this.clearDomMarkers();
    this.positionPhaseChip(previews);
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
    this.cellStartMs.clear();
    this.animGroup = null;
    this.tileLayer = null;
    this.tileLayerParent = null;
    this.tileLayerKey = "";
    this.currentToolName = "";
  }

  private currentState(): AgentGhostPreviewState {
    const state = getAgentGhostPreviewState();
    const mapId = this.mapId();
    return {
      ...state,
      runningToolName: mapId && state.runningToolMapId === mapId ? state.runningToolName : "",
    };
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
    const x = Math.round((bounds.x * TILE_SIZE - camera.worldView.x) * camera.zoom);
    const y = Math.round((bounds.y * TILE_SIZE - camera.worldView.y) * camera.zoom);
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
    // Phaser 3.60+ 에서 scrollX 는 zoom!==1 일 때 뷰포트 좌상단이 아니다. worldView 를 써야 한다.
    const x = Math.round((bounds.x * TILE_SIZE - camera.worldView.x) * camera.zoom);
    const y = Math.round((bounds.y * TILE_SIZE - camera.worldView.y) * camera.zoom);
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
