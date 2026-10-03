import type Phaser from "phaser";
import { isAiLiveCanvasEnabled } from "@/editor/aiLiveCanvas";
import { narrateAiActivity } from "@/editor/aiActivityNarration";
import { placeAiActivityChip } from "@/editor/aiActivityChipPlacement";
import { summarizeAgentGhostPreviewForProjectDiff } from "@/editor/agentGhostPreview";
import { editorMapTileSize } from "@/editor/mapGeometry";
import { prefersReducedMotion } from "@/util/reducedMotion";
import type { GameMap, MapId, Project } from "@/project/types";

// 실시간 적용의 시공 연출 — 조수가 맵에 쓴 칸을 «설계도 막» 으로 덮었다가 연필이 지나가며 걷어 낸다.
//
// 왜 고스트와 따로인가(2026-10-03 실측): 고스트는 «초안을 원래 맵 위에 덮어 그리는» 방식이다. 실시간 적용은
// 체크포인트가 도구 결과보다 먼저 와서 실제 맵에 바로 반영되므로, 고스트가 그릴 차이(base↔초안)가 늘 0칸이었다.
// 그래서 방향을 뒤집는다: 실제 칸은 이미 바뀌어 있고, 그 위의 막을 순서대로 걷어 «지어지는» 순간을 보여 준다.
// 적용을 붙잡지 않는다 — 막은 그림일 뿐이고 워커는 다음 도구로 바로 간다.

export interface ConstructionRevealJob {
  readonly id: number;
  readonly mapId: MapId;
  readonly label: string;
  /** 공개 순서대로 정렬된 칸. */
  readonly cells: readonly { readonly x: number; readonly y: number }[];
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly createdMap: boolean;
  readonly durationMs: number;
  readonly queuedAt: number;
  /** 그 맵이 화면에 처음 그려진 시각. 사용자가 다른 맵을 보고 있으면 볼 때까지 기다린다. */
  startedAt: number | null;
  /**
   * 연출 시계. 벽시계가 아니라 프레임마다 최대 MAX_FRAME_STEP_MS 씩만 간다 — 큰 적용·해시 예열로 메인 스레드가
   * 몇 초 멈추면 벽시계 기준 연출은 그 사이에 끝나 버린다(2026-10-03 실측: 첫 40% 가 멈춤 동안 지나갔다).
   */
  elapsedMs: number;
  lastTickAt: number | null;
}

const MAX_FRAME_STEP_MS = 48;

/** 한 칸이 막을 벗는 데 걸리는 시간과 섬광 길이. */
const CELL_FLASH_MS = 420;
/** 안 보는 맵의 작업은 이 시간 안에 그 맵을 열지 않으면 버린다. */
const UNSEEN_EXPIRE_MS = 20_000;
const DONE_LINGER_MS = 1400;

const jobs: ConstructionRevealJob[] = [];
const listeners = new Set<() => void>();
let seq = 0;

const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function subscribeConstructionReveal(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const listener of [...listeners]) listener();
}

export function constructionRevealJobs(): readonly ConstructionRevealJob[] {
  return jobs;
}

export function clearConstructionReveal(): void {
  if (!jobs.length) return;
  jobs.length = 0;
  emit();
}

/** 칸 수에 비례하되 짧은 수정도 눈에 띄고, 큰 마을도 지루하지 않게 자른다. */
export function constructionDurationMs(cellCount: number): number {
  return Math.round(Math.min(5200, Math.max(1800, 1000 + cellCount * 2.6)));
}

/** 좌상단에서 우하단으로 흐르는 대각선 물결. 같은 대각선 안은 칸마다 조금씩 어긋나 손으로 칠하는 결이 난다. */
export function constructionOrder(cells: readonly { readonly x: number; readonly y: number }[]): { x: number; y: number }[] {
  const jitter = (x: number, y: number): number => {
    const h = Math.imul(x * 374761393 + y * 668265263, 1274126177) >>> 0;
    return (h % 1000) / 1000;
  };
  return cells
    .map((cell) => ({ x: cell.x, y: cell.y, key: cell.x + cell.y * 0.8 + jitter(cell.x, cell.y) * 2.2 }))
    .sort((a, b) => a.key - b.key)
    .map(({ x, y }) => ({ x, y }));
}

/**
 * 적용 직전에 부른다. 바뀐 맵마다 바뀐 칸을 모아 막을 친다. 맵 객체가 같으면(안 바뀐 맵) 칸을 훑지 않는다.
 * 돌려주는 값은 등록한 작업 수(테스트·계측용).
 */
export function startConstructionRevealForProjects(before: Project, next: Project, toolName = ""): number {
  if (!isAiLiveCanvasEnabled() || prefersReducedMotion()) return 0;
  let added = 0;
  for (const [mapId, after] of Object.entries(next.maps ?? {})) {
    const prior = before.maps?.[mapId];
    if (prior === after || !after) continue;
    if (startConstructionReveal(mapId, prior, after, toolName)) added += 1;
  }
  return added;
}

export function startConstructionReveal(mapId: MapId, before: GameMap | undefined, after: GameMap, toolName = ""): ConstructionRevealJob | null {
  const previews = summarizeAgentGhostPreviewForProjectDiff(
    { maps: before ? { [mapId]: before } : {} } as unknown as Project,
    { maps: { [mapId]: after } } as unknown as Project,
  );
  const seen = new Set<number>();
  const cells: { x: number; y: number }[] = [];
  for (const preview of previews) {
    for (const cell of preview.cells) {
      if (cell.x < 0 || cell.y < 0 || cell.x >= after.width || cell.y >= after.height) continue;
      const key = cell.y * after.width + cell.x;
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push({ x: cell.x, y: cell.y });
    }
  }
  // 크기만 바뀐 맵(resize_map)은 칸 비교가 겹치는 영역만 본다 — 새로 생긴 띠도 지어지는 것으로 보인다.
  if (before && (before.width !== after.width || before.height !== after.height)) {
    for (let y = 0; y < after.height; y += 1) {
      for (let x = 0; x < after.width; x += 1) {
        if (x < before.width && y < before.height) continue;
        const key = y * after.width + x;
        if (seen.has(key)) continue;
        seen.add(key);
        cells.push({ x, y });
      }
    }
  }
  if (!cells.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const cell of cells) {
    x0 = Math.min(x0, cell.x); y0 = Math.min(y0, cell.y);
    x1 = Math.max(x1, cell.x); y1 = Math.max(y1, cell.y);
  }
  const job: ConstructionRevealJob = {
    id: ++seq,
    mapId,
    label: toolName ? narrateAiActivity({ toolName }).action : "AI 시공",
    cells: constructionOrder(cells),
    bounds: { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 },
    createdMap: !before,
    durationMs: constructionDurationMs(cells.length),
    queuedAt: now(),
    startedAt: null,
    elapsedMs: 0,
    lastTickAt: null,
  };
  jobs.push(job);
  emit();
  return job;
}

/** 작업 하나의 진행 — 몇 칸이 막을 벗었나, 끝났나. */
export function constructionProgress(job: ConstructionRevealJob): { revealed: number; done: boolean; elapsed: number } {
  if (job.startedAt === null) return { revealed: 0, done: false, elapsed: 0 };
  const elapsed = job.elapsedMs;
  const n = job.cells.length;
  const revealed = Math.min(n, Math.max(0, Math.floor((elapsed / job.durationMs) * n)));
  return { revealed, done: elapsed >= job.durationMs, elapsed };
}

function revealTime(job: ConstructionRevealJob, index: number): number {
  return (index / Math.max(1, job.cells.length)) * job.durationMs;
}

type Scene = Phaser.Scene & {
  readonly add: Phaser.GameObjects.GameObjectFactory;
  readonly cameras: Phaser.Cameras.Scene2D.CameraManager;
  readonly game: Phaser.Game;
  readonly events: Phaser.Events.EventEmitter;
};

interface Spark { x: number; y: number; vx: number; vy: number; born: number; life: number; color: number; size: number }

/**
 * 막·연필·섬광·불꽃·행진 점선 테두리를 그리는 렌더러. 진행 중인 작업이 있을 때만 프레임마다 그리고,
 * 끝나면 스스로 프레임 구독을 뗀다.
 */
export class ConstructionRevealRenderer {
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private chip: HTMLElement | null = null;
  private chipKey = "";
  private ticking = false;
  private sparks: Spark[] = [];
  private lastFrame = 0;
  private finishedAt = new Map<number, number>();
  private readonly tick = (): void => this.frame();

  constructor(
    private readonly scene: Scene,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly mapId: () => MapId | null,
  ) {}

  render(): void {
    if (!isAiLiveCanvasEnabled()) {
      this.clear();
      return;
    }
    if (this.activeJobs(now()).length) this.startTicker();
    this.frame();
  }

  clear(): void {
    this.stopTicker();
    this.graphics?.destroy();
    this.graphics = null;
    this.chip?.remove();
    this.chip = null;
    this.chipKey = "";
    this.sparks = [];
  }

  private activeJobs(at: number): ConstructionRevealJob[] {
    // 보지 않는 맵에서 오래 기다린 작업, 끝나고 여운도 지난 작업을 버린다.
    for (let i = jobs.length - 1; i >= 0; i -= 1) {
      const job = jobs[i]!;
      const stale = job.startedAt === null && at - job.queuedAt > UNSEEN_EXPIRE_MS;
      const over = job.startedAt !== null && job.elapsedMs > job.durationMs + DONE_LINGER_MS;
      if (stale || over) {
        jobs.splice(i, 1);
        this.finishedAt.delete(job.id);
      }
    }
    const mapId = this.mapId();
    return jobs.filter((job) => job.mapId === mapId);
  }

  private startTicker(): void {
    if (this.ticking) return;
    this.ticking = true;
    this.scene.events.on("update", this.tick);
  }

  private stopTicker(): void {
    if (!this.ticking) return;
    this.ticking = false;
    this.scene.events.off("update", this.tick);
  }

  private frame(): void {
    const at = now();
    const mine = this.activeJobs(at);
    if (!mine.length) {
      if (this.sparks.length === 0) {
        this.clear();
        return;
      }
    }
    for (const job of mine) {
      if (job.startedAt === null) job.startedAt = at;
      else if (job.lastTickAt !== null) job.elapsedMs += Math.min(MAX_FRAME_STEP_MS, Math.max(0, at - job.lastTickAt));
      job.lastTickAt = at;
    }
    if (!this.graphics || !this.graphics.active) {
      this.graphics = this.scene.add.graphics();
      this.layer.add(this.graphics);
    }
    const g = this.graphics;
    g.clear();
    const tile = editorMapTileSize(this.mapId());
    const view = this.scene.cameras.main.worldView;
    const vx0 = Math.floor(view.x / tile) - 1, vy0 = Math.floor(view.y / tile) - 1;
    const vx1 = Math.ceil((view.x + view.width) / tile) + 1, vy1 = Math.ceil((view.y + view.height) / tile) + 1;
    const inView = (x: number, y: number): boolean => x >= vx0 && x <= vx1 && y >= vy0 && y <= vy1;
    const dt = this.lastFrame ? Math.min(64, at - this.lastFrame) : 16;
    this.lastFrame = at;
    let chipJob: ConstructionRevealJob | null = null;
    let chipRevealed = 0;

    for (const job of mine) {
      const { revealed, done, elapsed } = constructionProgress(job);
      if (!chipJob || !done) { chipJob = job; chipRevealed = revealed; }
      if (done && !this.finishedAt.has(job.id)) this.finishedAt.set(job.id, at);

      // 1) 아직 안 지은 칸 — 남색 설계도 종이와 옅은 모눈.
      g.fillStyle(job.createdMap ? 0x0b2140 : 0x10284a, 0.93);
      for (let i = revealed; i < job.cells.length; i += 1) {
        const cell = job.cells[i]!;
        if (inView(cell.x, cell.y)) g.fillRect(cell.x * tile, cell.y * tile, tile, tile);
      }
      g.lineStyle(1, 0x6fa8ff, 0.32);
      for (let i = revealed; i < job.cells.length; i += 1) {
        const cell = job.cells[i]!;
        if (inView(cell.x, cell.y)) g.strokeRect(cell.x * tile + 0.5, cell.y * tile + 0.5, tile - 1, tile - 1);
      }

      // 2) 막 벗은 칸 — 금빛 섬광이 식으며 실제 타일이 드러난다.
      let frontX = 0, frontY = 0, frontN = 0;
      for (let i = revealed - 1; i >= 0; i -= 1) {
        const cell = job.cells[i]!;
        const age = elapsed - revealTime(job, i);
        if (age > CELL_FLASH_MS) break;
        if (!inView(cell.x, cell.y)) continue;
        const t = Math.max(0, age / CELL_FLASH_MS);
        const fade = (1 - t) * (1 - t);
        g.fillStyle(0xfff1b8, 0.62 * fade);
        g.fillRect(cell.x * tile, cell.y * tile, tile, tile);
        g.lineStyle(2, 0xffc44d, 0.9 * fade);
        g.strokeRect(cell.x * tile + 1, cell.y * tile + 1, tile - 2, tile - 2);
        if (age < 120) { frontX += cell.x; frontY += cell.y; frontN += 1; }
      }

      // 3) 행진하는 점선 테두리 + 금색 모서리 괄호 — 「여기가 공사장」.
      if (!done || at - (this.finishedAt.get(job.id) ?? at) < 600) {
        const b = job.bounds;
        const pad = 3;
        const left = b.x * tile - pad, top = b.y * tile - pad;
        const w = b.width * tile + pad * 2, h = b.height * tile + pad * 2;
        const settle = done ? Math.max(0, 1 - (at - (this.finishedAt.get(job.id) ?? at)) / 600) : 1;
        this.marchingRect(g, left, top, w, h, at, 0x4cc9f0, 0.95 * settle);
        const arm = Math.min(18, w / 3, h / 3);
        g.lineStyle(3, 0xffc44d, settle);
        for (const [cx, cy, sx, sy] of [[left, top, 1, 1], [left + w, top, -1, 1], [left, top + h, 1, -1], [left + w, top + h, -1, -1]] as const) {
          g.beginPath();
          g.moveTo(cx + sx * arm, cy);
          g.lineTo(cx, cy);
          g.lineTo(cx, cy + sy * arm);
          g.strokePath();
        }
      }

      // 3-1) 끝나는 순간 — 공사장 테두리에서 빛이 한 번 퍼진다.
      const finished = this.finishedAt.get(job.id);
      if (finished !== undefined && at - finished < 700) {
        const t = (at - finished) / 700;
        const b = job.bounds;
        const grow = 4 + t * 26;
        g.lineStyle(4 * (1 - t) + 1, 0xfff1b8, 0.85 * (1 - t));
        g.strokeRect(b.x * tile - grow, b.y * tile - grow, b.width * tile + grow * 2, b.height * tile + grow * 2);
        g.fillStyle(0xfff6d6, 0.22 * (1 - t) * (1 - t));
        g.fillRect(b.x * tile, b.y * tile, b.width * tile, b.height * tile);
      }

      // 4) 연필 — 물결의 앞머리를 따라간다. 불꽃을 뿌린다.
      if (!done && frontN > 0) {
        const px = (frontX / frontN + 0.5) * tile, py = (frontY / frontN + 0.5) * tile;
        for (let k = 0; k < 3; k += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.04 + Math.random() * 0.09;
          this.sparks.push({
            x: px + (Math.random() - 0.5) * tile, y: py + (Math.random() - 0.5) * tile,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.05,
            born: at, life: 380 + Math.random() * 420,
            color: Math.random() < 0.35 ? 0xffffff : Math.random() < 0.5 ? 0xffd166 : 0x7dd3fc,
            size: Math.random() < 0.3 ? 3 : 2,
          });
        }
        this.drawPencil(g, px, py, at);
      }
    }

    // 5) 불꽃 — 작업이 끝나도 남은 것은 다 식을 때까지 그린다.
    const alive: Spark[] = [];
    for (const spark of this.sparks) {
      const age = at - spark.born;
      if (age > spark.life) continue;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vy += 0.00018 * dt;
      g.fillStyle(spark.color, 1 - age / spark.life);
      g.fillRect(spark.x, spark.y, spark.size, spark.size);
      alive.push(spark);
    }
    this.sparks = alive.length > 600 ? alive.slice(-600) : alive;

    this.renderChip(chipJob, chipRevealed);
    if ((mine.length || this.sparks.length) && !this.ticking) this.startTicker();
  }

  private marchingRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, at: number, color: number, alpha: number): void {
    const dash = 7, gap = 5, period = dash + gap;
    const offset = (at / 28) % period;
    g.lineStyle(2, color, alpha);
    const edge = (x0: number, y0: number, dx: number, dy: number, length: number): void => {
      for (let s = -offset; s < length; s += period) {
        const a = Math.max(0, s), z = Math.min(length, s + dash);
        if (z <= a) continue;
        g.beginPath();
        g.moveTo(x0 + dx * a, y0 + dy * a);
        g.lineTo(x0 + dx * z, y0 + dy * z);
        g.strokePath();
      }
    };
    edge(x, y, 1, 0, w);
    edge(x + w, y, 0, 1, h);
    edge(x + w, y + h, -1, 0, w);
    edge(x, y + h, 0, -1, h);
  }

  private drawPencil(g: Phaser.GameObjects.Graphics, x: number, y: number, at: number): void {
    const bob = Math.sin(at / 90) * 1.5;
    // 빛무리
    g.fillStyle(0xffd166, 0.18);
    g.fillCircle(x, y, 22);
    g.fillStyle(0xffe8a3, 0.28);
    g.fillCircle(x, y, 11);
    // 연필 몸통(비스듬히): 그림자 → 몸통 → 지우개 → 깎은 나무 → 심
    const ox = x + 4, oy = y - 26 + bob;
    g.fillStyle(0x1f2937, 0.35);
    g.fillRect(ox + 3, oy + 3, 9, 22);
    g.fillStyle(0x2b2f36, 1);
    g.fillRect(ox - 1, oy - 1, 11, 24);
    g.fillStyle(0xf2b134, 1);
    g.fillRect(ox + 1, oy + 4, 7, 15);
    g.fillStyle(0xd98f1f, 1);
    g.fillRect(ox + 6, oy + 4, 2, 15);
    g.fillStyle(0xe8798b, 1);
    g.fillRect(ox + 1, oy, 7, 4);
    g.fillStyle(0xf4e2c4, 1);
    g.fillRect(ox + 2, oy + 19, 5, 3);
    g.fillStyle(0x1b1b1b, 1);
    g.fillRect(ox + 3, oy + 22, 3, 2);
  }

  private renderChip(job: ConstructionRevealJob | null, revealed: number): void {
    if (typeof document === "undefined") return;
    const host = this.scene.game?.canvas?.parentElement;
    if (!job || !host) {
      this.chip?.remove();
      this.chip = null;
      this.chipKey = "";
      return;
    }
    const done = constructionProgress(job).done;
    if (!this.chip) {
      const chip = document.createElement("div");
      chip.className = "ai-ghost-phase-chip ai-construction-chip";
      chip.dataset.testid = "ai-construction-chip";
      chip.setAttribute("role", "status");
      const spinner = document.createElement("span");
      spinner.className = "ai-construction-chip-mark";
      const label = document.createElement("span");
      label.className = "ai-ghost-phase-text";
      const bar = document.createElement("span");
      bar.className = "ai-construction-chip-bar";
      bar.append(document.createElement("i"));
      chip.append(spinner, label, bar);
      host.append(chip);
      this.chip = chip;
    }
    const text = done ? `시공 완료 · ${job.cells.length.toLocaleString()}칸` : `${job.label} · ${revealed.toLocaleString()}/${job.cells.length.toLocaleString()}칸`;
    this.chip.classList.toggle("is-done", done);
    const label = this.chip.querySelector(".ai-ghost-phase-text");
    if (label && label.textContent !== text) label.textContent = text;
    const fill = this.chip.querySelector<HTMLElement>(".ai-construction-chip-bar > i");
    if (fill) fill.style.width = `${Math.round((revealed / Math.max(1, job.cells.length)) * 100)}%`;
    const cam = this.scene.cameras.main;
    const key = `${job.id}|${done}|${cam.worldView.x}|${cam.worldView.y}|${cam.zoom}`;
    if (key === this.chipKey) return;
    this.chipKey = key;
    const canvas = this.scene.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const chipRect = this.chip.getBoundingClientRect();
    const placement = placeAiActivityChip({
      region: job.bounds,
      camera: { worldView: { x: cam.worldView.x, y: cam.worldView.y }, zoom: cam.zoom },
      viewport: { width: Math.max(1, canvasRect.width || canvas.width), height: Math.max(1, canvasRect.height || canvas.height) },
      chip: { width: Math.max(1, chipRect.width || 220), height: Math.max(1, chipRect.height || 30) },
    });
    this.chip.style.left = `${Math.round(canvasRect.left - hostRect.left + placement.left)}px`;
    this.chip.style.top = `${Math.round(canvasRect.top - hostRect.top + placement.top)}px`;
  }
}
