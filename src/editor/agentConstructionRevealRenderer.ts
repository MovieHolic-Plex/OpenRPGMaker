// 시공 연출 그리기 — 계획은 `agentConstructionReveal.ts`.
//
// 모양: 바뀐 칸 전체를 청사진(남색 바탕·옅은 눈금·집 자리 하늘색 테두리)으로 덮고, 빛줄기가 한 번 훑은 뒤
// 바닥이 가운데서 번지고, 물이 흘러들고, 길이 금빛 불똥을 튀기며 뻗고, 집이 하얗게 번쩍이며 먼지를 날리고
// 내려앉고, 나무·소품이 초록 반짝임으로 돋는다. 마지막에 금빛 테두리와 「시공 완료」 표식.
//
// 덮개는 칸당 8px 의 DynamicTexture 한 장이다 — 칸마다 사각형을 매 프레임 다시 그리면 88×56 마을에서
// 1만 개가 넘는다. 걷히기 시작한 칸만 텍스처에서 지우고, 걷히는 중인 칸(수백 개)만 매 프레임 그린다.
// 실제 칸은 이미 스토어에 적용돼 있다. 연출은 입력·저장·다음 도구를 막지 않는다.

import type Phaser from "phaser";
import { markEditRenderActive } from "@/editor/editRenderGate";
import { editorMapTileSize } from "@/editor/mapGeometry";
import {
  CONSTRUCTION_CELL_FADE_MS,
  CONSTRUCTION_SCAN_MS,
  type ConstructionPhase,
  type ConstructionRevealCell,
  type ConstructionRevealPlan,
} from "@/editor/agentConstructionReveal";
import type { MapId } from "@/project/types";

const CELL_PX = 8;
const COVER_COLOR = 0x0f2440;
const COVER_ALPHA = 0.93;
const GRID_COLOR = 0x2c5a86;
const OUTLINE_COLOR = 0x7fd8ff;
const MAX_PARTICLES = 240;
const MAX_SHAKES = 6;
const MAX_STEP_MS = 48;

const GLOW: Readonly<Record<ConstructionPhase, number>> = {
  ground: 0xbff2c4,
  water: 0x6fe3ff,
  road: 0xffcf5a,
  building: 0xffffff,
  detail: 0x9dff7a,
  event: 0xffa8f0,
};

type Active = {
  readonly plan: ConstructionRevealPlan;
  readonly tile: number;
  /** 연출 시계(ms). 프레임마다 최대 MAX_STEP_MS 만 간다 — 메인 스레드가 멈춰도 단계를 건너뛰지 않고 멈췄다 잇는다. */
  elapsed: number;
  readonly root: Phaser.GameObjects.Container;
  readonly cover: Phaser.GameObjects.RenderTexture;
  readonly fading: Phaser.GameObjects.Graphics;
  readonly glow: Phaser.GameObjects.Graphics;
  readonly fx: Phaser.GameObjects.Container;
  pointer: number;
  buildingPointer: number;
  shakes: number;
  finished: boolean;
  readonly revealing: ConstructionRevealCell[];
  readonly onUpdate: (time: number, delta: number) => void;
};

export class AgentConstructionRevealRenderer {
  private active: Active | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly mapId: () => MapId | null,
  ) {}

  get playing(): boolean {
    return this.active !== null;
  }

  play(plan: ConstructionRevealPlan): boolean {
    if (plan.mapId !== this.mapId()) return false;
    this.clear();
    const scene = this.scene;
    const tile = editorMapTileSize(plan.mapId);
    const root = scene.add.container(0, 0);
    root.setName("agent-construction-reveal");
    this.layer.add(root);

    const cover = scene.add.renderTexture(0, 0, plan.width * CELL_PX, plan.height * CELL_PX);
    cover.setOrigin(0, 0);
    cover.setScale(tile / CELL_PX);
    cover.setAlpha(COVER_ALPHA);
    root.add(cover);
    this.paintBlueprint(cover, plan);

    const fading = scene.add.graphics();
    const glow = scene.add.graphics();
    glow.setBlendMode("ADD");
    const fx = scene.add.container(0, 0);
    root.add([fading, glow, fx]);

    const active: Active = {
      plan, tile, elapsed: 0, root, cover, fading, glow, fx,
      pointer: 0, buildingPointer: 0, shakes: 0, finished: false, revealing: [],
      onUpdate: (_time, delta) => this.tick(delta),
    };
    this.active = active;
    // 관측점: QA·디버깅이 연출 중인지 DOM 에서 읽는다(캔버스 안 객체는 셀렉터로 못 잡는다).
    if (typeof document !== "undefined") document.documentElement.dataset.aiConstructionReveal = "playing";
    scene.events.on("update", active.onUpdate);
    markEditRenderActive(scene.game);
    return true;
  }

  clear(): void {
    const active = this.active;
    if (!active) return;
    this.active = null;
    this.scene.events.off("update", active.onUpdate);
    this.scene.tweens.killTweensOf(active.fx.list);
    active.root.destroy(true);
    if (typeof document !== "undefined") delete document.documentElement.dataset.aiConstructionReveal;
    markEditRenderActive(this.scene.game);
  }

  /** 청사진: 바뀐 칸만 남색으로 칠하고 칸 눈금, 새 집 자리는 하늘색 테두리. 바뀌지 않은 칸은 투명. */
  private paintBlueprint(cover: Phaser.GameObjects.RenderTexture, plan: ConstructionRevealPlan): void {
    const g = this.scene.make.graphics({}, false);
    for (const cell of plan.cells) {
      const px = cell.x * CELL_PX, py = cell.y * CELL_PX;
      g.fillStyle(COVER_COLOR, 1);
      g.fillRect(px, py, CELL_PX, CELL_PX);
      g.fillStyle(GRID_COLOR, 1);
      g.fillRect(px, py, CELL_PX, 1);
      g.fillRect(px, py, 1, CELL_PX);
    }
    g.lineStyle(1, OUTLINE_COLOR, 1);
    for (const b of plan.buildings) {
      g.strokeRect(b.x * CELL_PX + 1.5, b.y * CELL_PX + 1.5, b.w * CELL_PX - 3, b.h * CELL_PX - 3);
      // 지붕 자리 대각선 — 「여기 집이 선다」는 표시.
      g.lineBetween(b.x * CELL_PX + 2, b.y * CELL_PX + 2, (b.x + b.w) * CELL_PX - 2, (b.y + b.h) * CELL_PX - 2);
    }
    cover.draw(g);
    g.destroy();
  }

  private tick(delta: number): void {
    const active = this.active;
    if (!active) return;
    // 사용자가 다른 맵으로 옮겼으면 연출은 그 자리에서 끝낸다(덮개가 다른 맵을 가리면 안 된다).
    if (active.plan.mapId !== this.mapId()) {
      this.clear();
      return;
    }
    markEditRenderActive(this.scene.game);
    // 적용 직후에는 커밋 기록·ACK 압축이 메인 스레드를 잡아 프레임이 띄엄띄엄 온다. 벽시계로 가면 그 사이 단계가
    // 통째로 지나가 「짠」 하고 완성본이 뜬다 — 연출 시계는 프레임당 최대 MAX_STEP_MS 만 간다.
    active.elapsed += Math.max(0, Math.min(Number.isFinite(delta) ? delta : 16, MAX_STEP_MS));
    const elapsed = active.elapsed;
    const { plan, tile } = active;

    // 걷히기 시작한 칸을 텍스처에서 지우고 페이드 목록으로 옮긴다.
    const cells = plan.cells;
    while (active.pointer < cells.length && cells[active.pointer]!.at <= elapsed) {
      const cell = cells[active.pointer++]!;
      // DynamicTexture.clear 는 dirty 일 때만 지우고 dirty 를 내린다 — 다음 칸부터 조용히 안 지워진다(Phaser 3.90).
      const texture = active.cover.texture as unknown as Phaser.Textures.DynamicTexture;
      texture.dirty = true;
      texture.clear(cell.x * CELL_PX, cell.y * CELL_PX, CELL_PX, CELL_PX);
      active.revealing.push(cell);
      this.cellBurst(active, cell);
    }
    // 집이 내려앉는 순간.
    while (active.buildingPointer < plan.buildings.length && plan.buildings[active.buildingPointer]!.at <= elapsed) {
      this.buildingDrop(active, plan.buildings[active.buildingPointer++]!);
    }

    // 걷히는 중인 칸: 남색이 옅어지고 단계 색 빛이 번쩍였다 사라진다.
    active.fading.clear();
    active.glow.clear();
    let keep = 0;
    for (const cell of active.revealing) {
      const t = (elapsed - cell.at) / CONSTRUCTION_CELL_FADE_MS;
      if (t >= 1) continue;
      active.revealing[keep++] = cell;
      const x = cell.x * tile, y = cell.y * tile;
      active.fading.fillStyle(COVER_COLOR, COVER_ALPHA * (1 - t) * (1 - t));
      active.fading.fillRect(x, y, tile, tile);
      active.glow.fillStyle(GLOW[cell.phase], 0.75 * (1 - t));
      active.glow.fillRect(x, y, tile, tile);
    }
    active.revealing.length = keep;

    // 시작 빛줄기: 바뀐 영역을 위에서 아래로 한 번 훑는다.
    if (elapsed < CONSTRUCTION_SCAN_MS) {
      const b = plan.bounds;
      const t = elapsed / CONSTRUCTION_SCAN_MS;
      const y = (b.y + b.height * t) * tile;
      const band = Math.max(tile * 1.5, b.height * tile * 0.06);
      active.glow.fillStyle(0x9fe9ff, 0.55 * (1 - t * 0.5));
      active.glow.fillRect(b.x * tile, y - band, b.width * tile, band);
      active.glow.fillStyle(0xffffff, 0.8);
      active.glow.fillRect(b.x * tile, y - 2, b.width * tile, 2);
    }

    if (!active.finished && active.pointer >= cells.length && !active.revealing.length) {
      active.finished = true;
      this.finishFlourish(active);
    }
    if (elapsed >= plan.durationMs + 900) this.clear();
  }

  private spawn(active: Active, x: number, y: number, size: number, color: number, dx: number, dy: number, duration: number): void {
    if (active.fx.length >= MAX_PARTICLES) return;
    const p = this.scene.add.rectangle(x, y, size, size, color, 1);
    p.setBlendMode("ADD");
    active.fx.add(p);
    this.scene.tweens.add({
      targets: p, x: x + dx, y: y + dy, alpha: 0, scale: 0.3, duration, ease: "Cubic.easeOut",
      onComplete: () => p.destroy(),
    });
  }

  /** 길·물·소품 칸이 드러날 때 드문드문 불똥·물보라·반짝임. */
  private cellBurst(active: Active, cell: ConstructionRevealCell): void {
    const { tile } = active;
    const cx = (cell.x + 0.5) * tile, cy = (cell.y + 0.5) * tile;
    const roll = ((cell.index * 2654435761) >>> 0) % 7;
    if (cell.phase === "road" && roll < 2) {
      this.spawn(active, cx, cy, tile * 0.22, GLOW.road, (roll - 0.5) * tile * 0.8, -tile * 1.2, 520);
    } else if (cell.phase === "water" && roll === 0) {
      this.spawn(active, cx, cy, tile * 0.18, GLOW.water, 0, -tile * 0.7, 420);
    } else if (cell.phase === "detail" && roll < 2) {
      this.spawn(active, cx, cy - tile * 0.3, tile * 0.2, GLOW.detail, 0, -tile * 0.9, 560);
    } else if (cell.phase === "event") {
      this.spawn(active, cx, cy, tile * 0.3, GLOW.event, 0, -tile, 640);
    }
  }

  /** 집이 내려앉는다: 하얀 섬광, 퍼지는 테두리, 밑동 먼지, 약한 흔들림. */
  private buildingDrop(active: Active, b: { x: number; y: number; w: number; h: number }): void {
    const { tile } = active;
    const scene = this.scene;
    const x = b.x * tile, y = b.y * tile, w = b.w * tile, h = b.h * tile;
    const flash = scene.add.rectangle(x, y, w, h, 0xffffff, 0.85).setOrigin(0, 0);
    flash.setBlendMode("ADD");
    active.fx.add(flash);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 340, ease: "Quad.easeOut", onComplete: () => flash.destroy() });
    const ring = scene.add.rectangle(x + w / 2, y + h / 2, w, h).setStrokeStyle(Math.max(1, tile / 8), 0xfff2b0, 1);
    active.fx.add(ring);
    scene.tweens.add({ targets: ring, scaleX: 1.35, scaleY: 1.35, alpha: 0, duration: 520, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });
    const base = y + h;
    const puffs = Math.min(12, 4 + b.w * 2);
    for (let i = 0; i < puffs; i++) {
      const px = x + (w * (i + 0.5)) / puffs;
      const side = px < x + w / 2 ? -1 : 1;
      this.spawn(active, px, base - tile * 0.2, tile * (0.25 + (i % 3) * 0.08), 0xd9c7a3, side * tile * (0.6 + (i % 4) * 0.25), -tile * (0.3 + (i % 2) * 0.4), 620);
    }
    if (active.shakes < MAX_SHAKES) {
      active.shakes++;
      scene.cameras.main.shake(90, 0.0016);
    }
  }

  private finishFlourish(active: Active): void {
    const { tile, plan } = active;
    const scene = this.scene;
    const b = plan.bounds;
    const frame = scene.add.rectangle((b.x + b.width / 2) * tile, (b.y + b.height / 2) * tile, b.width * tile, b.height * tile)
      .setStrokeStyle(Math.max(2, tile / 6), 0xffd56b, 1);
    frame.setBlendMode("ADD");
    active.fx.add(frame);
    scene.tweens.add({ targets: frame, scaleX: 1.04, scaleY: 1.04, alpha: 0, duration: 900, ease: "Sine.easeOut", onComplete: () => frame.destroy() });
    if (typeof scene.add.text !== "function") return;
    const badge = scene.add.text(b.x * tile + 6, b.y * tile + 6, "✨ 시공 완료", {
      fontFamily: "sans-serif", fontSize: "14px", color: "#2b2410", backgroundColor: "#ffd56b", padding: { x: 8, y: 4 },
    });
    // 확대 배율과 상관없이 같은 화면 크기로 보이게 한다.
    badge.setScale(1 / Math.max(0.25, scene.cameras.main.zoom));
    active.fx.add(badge);
    scene.tweens.add({ targets: badge, y: badge.y - tile * 0.5, duration: 420, ease: "Back.easeOut" });
  }
}
