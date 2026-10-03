// 밑그림 시공 그리기 — 계획은 `agentConstructionReveal.ts`.
//
// 모양은 예전(09-21) 고스트 공개를 따른다: 무광 종이, 연필 커서(황토 연필·검은 심·조립 괄호), 옅은 먼지.
// 빛줄기·발광·불꽃·흔들림은 쓰지 않는다(2026-10-03 사용자: 「화려한 거 말고 계획적으로 착착 까는 게 맞다」).
//  ① 밑그림: 바뀐 칸을 종이로 덮고, 길·물 자국을 옅게, 집 자리 테두리를 한 채씩 긋는다.
//  ② 연필이 왼쪽에서 오른쪽으로 지나가며 바닥·길·물·나무 칸의 종이를 걷는다.
//  ③ 집을 읽는 순서로 한 채씩 놓는다(괄호가 잠깐 잡혔다 풀리고 밑동에 먼지).
//
// 종이는 칸당 8px 의 DynamicTexture 한 장이다 — 칸마다 사각형을 매 프레임 다시 그리지 않는다.
// 실제 칸은 이미 스토어에 적용돼 있다. 연출은 입력·저장·다음 도구를 막지 않는다.

import type Phaser from "phaser";
import { markEditRenderActive } from "@/editor/editRenderGate";
import { editorMapTileSize } from "@/editor/mapGeometry";
import {
  CONSTRUCTION_CELL_FADE_MS,
  type ConstructionRevealBuilding,
  type ConstructionRevealCell,
  type ConstructionRevealPlan,
} from "@/editor/agentConstructionReveal";
import type { MapId } from "@/project/types";

const CELL_PX = 8;
const PAPER = 0xefe9dc;
const PAPER_GRID = 0xdcd2bd;
const SKETCH_ROAD = 0xb9ab90;
const SKETCH_WATER = 0x9fb3bf;
const PENCIL_LINE = 0x5b5245;
const BRACKET = 0x493e30;
const DUST = 0xa18d70;
/** 연출 시계는 프레임당 이만큼만 간다 — 적용 직후 메인 스레드가 막혀도 단계를 건너뛰지 않고 멈췄다 잇는다. */
const MAX_STEP_MS = 48;
/** 집 자리 테두리가 그어지는 시간. */
const SKETCH_DRAW_MS = 260;

type Active = {
  readonly plan: ConstructionRevealPlan;
  readonly tile: number;
  elapsed: number;
  readonly root: Phaser.GameObjects.Container;
  readonly paper: Phaser.GameObjects.RenderTexture;
  /** 걷히는 중인 종이·밑그림 테두리·연필·먼지(매 프레임 다시 그림). */
  readonly overlay: Phaser.GameObjects.Graphics;
  pointer: number;
  buildingPointer: number;
  readonly revealing: ConstructionRevealCell[];
  /** 지금 놓이는 집과 놓인 시각 — 괄호를 잠깐 그린다. */
  placing: { readonly b: ConstructionRevealBuilding; readonly at: number } | null;
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

    const paper = scene.add.renderTexture(0, 0, plan.width * CELL_PX, plan.height * CELL_PX);
    paper.setOrigin(0, 0);
    paper.setScale(tile / CELL_PX);
    root.add(paper);
    this.paintPaper(paper, plan);

    const overlay = scene.add.graphics();
    root.add(overlay);

    const active: Active = {
      plan, tile, elapsed: 0, root, paper, overlay,
      pointer: 0, buildingPointer: 0, revealing: [], placing: null,
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
    active.root.destroy(true);
    if (typeof document !== "undefined") delete document.documentElement.dataset.aiConstructionReveal;
    markEditRenderActive(this.scene.game);
  }

  /** 빈 종이 + 옅은 칸 눈금 + 길·물 자국. 바뀌지 않은 칸은 투명(기존 맵이 그대로 보인다). */
  private paintPaper(paper: Phaser.GameObjects.RenderTexture, plan: ConstructionRevealPlan): void {
    const g = this.scene.make.graphics({}, false);
    for (const cell of plan.cells) {
      const px = cell.x * CELL_PX, py = cell.y * CELL_PX;
      g.fillStyle(PAPER, 1);
      g.fillRect(px, py, CELL_PX, CELL_PX);
      g.fillStyle(PAPER_GRID, 1);
      g.fillRect(px, py, CELL_PX, 1);
      g.fillRect(px, py, 1, CELL_PX);
      if (cell.sketch) {
        // 연필로 옅게 그은 길·물 자국 — 계획된 동선이 먼저 보인다.
        g.fillStyle(cell.sketch === "road" ? SKETCH_ROAD : SKETCH_WATER, 0.55);
        g.fillRect(px + 2, py + 2, CELL_PX - 4, CELL_PX - 4);
      }
    }
    paper.draw(g);
    g.destroy();
  }

  private tick(delta: number): void {
    const active = this.active;
    if (!active) return;
    // 사용자가 다른 맵으로 옮겼으면 연출은 그 자리에서 끝낸다(종이가 다른 맵을 가리면 안 된다).
    if (active.plan.mapId !== this.mapId()) {
      this.clear();
      return;
    }
    markEditRenderActive(this.scene.game);
    active.elapsed += Math.max(0, Math.min(Number.isFinite(delta) ? delta : 16, MAX_STEP_MS));
    const elapsed = active.elapsed;
    const { plan, tile } = active;
    const texture = active.paper.texture as unknown as Phaser.Textures.DynamicTexture;

    const cells = plan.cells;
    while (active.pointer < cells.length && cells[active.pointer]!.at <= elapsed) {
      const cell = cells[active.pointer++]!;
      // DynamicTexture.clear 는 dirty 일 때만 지우고 dirty 를 내린다 — 다음 칸부터 조용히 안 지워진다(Phaser 3.90).
      texture.dirty = true;
      texture.clear(cell.x * CELL_PX, cell.y * CELL_PX, CELL_PX, CELL_PX);
      active.revealing.push(cell);
    }
    while (active.buildingPointer < plan.buildings.length && plan.buildings[active.buildingPointer]!.at <= elapsed) {
      const b = plan.buildings[active.buildingPointer++]!;
      active.placing = { b, at: b.at };
    }

    const g = active.overlay;
    g.clear();

    // ① 집 자리 테두리: 아직 안 놓인 집만, 정해진 시각부터 한 채씩 그어진다.
    for (let i = active.buildingPointer; i < plan.buildings.length; i++) {
      const b = plan.buildings[i]!;
      const t = (elapsed - b.sketchAt) / SKETCH_DRAW_MS;
      if (t <= 0) continue;
      this.sketchRect(g, b, tile, Math.min(1, t));
    }

    // 걷히는 중인 종이 칸.
    let keep = 0;
    let recent = 0, edgeX = -Infinity, sumY = 0;
    for (const cell of active.revealing) {
      const age = elapsed - cell.at;
      const t = age / CONSTRUCTION_CELL_FADE_MS;
      if (t >= 1) continue;
      active.revealing[keep++] = cell;
      const x = cell.x * tile, y = cell.y * tile;
      g.fillStyle(PAPER, (1 - t) * (1 - t));
      g.fillRect(x, y, tile, tile);
      if (cell.phase === "sweep") {
        edgeX = Math.max(edgeX, x + tile);
        sumY += y + tile / 2;
        if (recent % 5 === 0) {
          g.fillStyle(DUST, (1 - t) * 0.55);
          g.fillRect(x + 3 + Math.sin(cell.index) * 4, y + tile - age / 35, 2, 2);
        }
        recent++;
      }
    }
    active.revealing.length = keep;

    // ② 연필: 바닥을 까는 동안 맨 앞 열에 선다.
    if (recent && elapsed <= plan.sweepEndMs + CONSTRUCTION_CELL_FADE_MS) this.pencil(g, edgeX, sumY / recent);

    // ③ 지금 놓는 집: 괄호가 잡혔다 풀리고 밑동에 먼지. 연필은 그 집 오른쪽 아래.
    const placing = active.placing;
    if (placing) {
      const age = elapsed - placing.at;
      if (age > 360) active.placing = null;
      else {
        const { b } = placing;
        const t = age / 360;
        const pad = 3 * (1 - t);
        g.lineStyle(1, BRACKET, 0.7 * (1 - t));
        g.strokeRect(b.x * tile - pad, b.y * tile - pad, b.w * tile + pad * 2, b.h * tile + pad * 2);
        g.fillStyle(DUST, 0.5 * (1 - t));
        for (let i = 0; i < Math.min(8, b.w * 2); i++) {
          g.fillRect(b.x * tile + ((i + 0.5) * b.w * tile) / Math.min(8, b.w * 2), (b.y + b.h) * tile - 2 - age / 40, 2, 2);
        }
        this.pencil(g, (b.x + b.w) * tile, (b.y + b.h) * tile - tile / 2);
      }
    }

    if (elapsed >= plan.durationMs) this.clear();
  }

  /** 집 자리 테두리를 t(0~1)만큼 둘레를 따라 긋는다 — 위 → 오른쪽 → 아래 → 왼쪽. */
  private sketchRect(g: Phaser.GameObjects.Graphics, b: { x: number; y: number; w: number; h: number }, tile: number, t: number): void {
    const x = b.x * tile + 1, y = b.y * tile + 1, w = b.w * tile - 2, h = b.h * tile - 2;
    const perimeter = 2 * (w + h);
    let left = perimeter * t;
    g.lineStyle(1, PENCIL_LINE, 0.8);
    const seg = (x1: number, y1: number, x2: number, y2: number, len: number) => {
      if (left <= 0) return;
      const k = Math.min(1, left / len);
      g.lineBetween(x1, y1, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k);
      left -= len;
    };
    seg(x, y, x + w, y, w);
    seg(x + w, y, x + w, y + h, h);
    seg(x + w, y + h, x, y + h, w);
    seg(x, y + h, x, y, h);
    if (t >= 1) {
      // 다 그은 자리에는 옅은 사선 — 「여기 집이 선다」.
      g.lineStyle(1, PENCIL_LINE, 0.25);
      g.lineBetween(x + 2, y + h - 2, x + w - 2, y + 2);
    }
  }

  /** 예전 고스트 공개의 연필 커서와 같은 모양: 조립 괄호, 황토 연필, 검은 심. */
  private pencil(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // 마을 전체가 보이게 줄여 보는 동안에도 연필이 화면에서 같은 크기로 보이게 한다.
    const s = Math.max(1, 1 / Math.max(0.1, this.scene.cameras.main.zoom));
    g.lineStyle(s, BRACKET, 0.65);
    g.strokeRect(x - 10 * s, y - 10 * s, 20 * s, 20 * s);
    g.fillStyle(BRACKET, 0.25);
    for (let i = 1; i <= 4; i++) g.fillRect(x - (12 + i * 6) * s, y + 8 * s, 3 * s, s);
    g.fillStyle(0x2e302c, 0.95);
    g.fillRect(x + s, y - 20 * s, 9 * s, 19 * s);
    g.fillRect(x - s, y - 5 * s, 5 * s, 7 * s);
    g.fillStyle(0xd6a254, 1);
    g.fillRect(x + 3 * s, y - 18 * s, 5 * s, 14 * s);
    g.fillStyle(0xf4e6ce, 1);
    g.fillRect(x + s, y - 4 * s, 4 * s, 3 * s);
  }
}
