// 시공 기록 재생 그리기 — 계획은 `agentConstructionReveal.ts`, 기록은 `editor/tools/constructionLog.ts`.
//
// 도구가 실제로 밟은 단계를 그 순서대로 늦춰 그린다. 지어내는 것은 없다:
//  ① 계획 격자: 시공기가 구역마다 정한 칸(물·큰길·뒷길·광장·큰 건물·일터·집 자리·소품·밭숲)을 분류 색으로 칠한다.
//  ② 칠하기: 바탕·물가·길·광장·물 단계가 바꾼 칸을 그 시점의 실제 타일로 그린다. 그 단계가 마무리한 분류의 밑그림만 걷힌다.
//  ③ 찍기: 키트를 기록 순서대로 한 개씩 — 집·큰 건물·다리는 한 채씩 또렷하게, 나무·소품은 빠르게.
//  ④ 다듬기(막다른 길 정리) 뒤 잠깐 머물고 덮개가 걷힌다. 그 아래는 이미 적용된 실제 맵이다(마지막 단계 = 실제 맵).
//
// 모양은 예전 고스트의 연필 커서·괄호를 쓴다. 빛·불꽃·흔들림은 없다(2026-10-03 사용자: 「계획적으로 착착」).
// 위쪽 글줄은 지금 단계 이름과 「실제로는 몇 초 걸린 시공」을 밝힌다 — 재생이라는 걸 숨기지 않는다.
// 실제 칸은 이미 스토어에 적용돼 있다. 재생은 입력·저장·다음 도구를 막지 않는다.

import type Phaser from "phaser";
import { markEditRenderActive } from "@/editor/editRenderGate";
import { editorMapTileSize } from "@/editor/mapGeometry";
import { ensureTilesetTexture } from "@/editor/tilesetImage";
import { CONSTRUCTION_FADE_OUT_MS, type ConstructionRevealFrame, type ConstructionRevealPlan } from "@/editor/agentConstructionReveal";
import type { ConstructionStep } from "@/editor/tools/constructionLog";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { isUiInBackground } from "@/ai/yieldToUi";

/** 계획 격자 한 칸의 그림 크기(px). */
const PLAN_PX = 8;
const PLAN_ALPHA = 0.78;
/** 계획 분류 이름 → 밑그림 색(무광, 칩셋 위에서 읽히는 정도). */
const PLAN_COLORS: Record<string, number> = {
  road: 0xb89c6c, water: 0x5f8fb4, plaza: 0xd4c8ac, building: 0x8c5b3d, prop: 0x6f7d4c,
  field: 0xc8b25c, keep: 0x7b6a55, ring: 0x84b3a5,
};
const PLAN_EDGE = 0x3f3428;
const EMPTY_CELL = 0x1f232b;
const BRACKET = 0x493e30;
const DUST = 0xa18d70;
/**
 * 연출 시계는 프레임당 이만큼만 간다 — 적용 직후 메인 스레드가 길게 막혀도 단계를 건너뛰지 않고 멈췄다 잇는다.
 * 너무 작으면(48ms) 초당 몇 프레임밖에 못 그리는 기계에서 재생이 몇 배로 늘어진다(실측: 12초 계획이 50초).
 */
const MAX_STEP_MS = 120;
/** 그림 덮개 한 변 상한(px). 넘으면 재생하지 않는다(기존 강조로). */
const MAX_TEXTURE_PX = 4096;

type Active = {
  readonly plan: ConstructionRevealPlan;
  readonly tile: number;
  readonly tileSize: number;
  readonly textureKey: string;
  elapsed: number;
  readonly root: Phaser.GameObjects.Container;
  readonly ground: Phaser.GameObjects.RenderTexture;
  readonly blueprint: Phaser.GameObjects.RenderTexture;
  readonly overlay: Phaser.GameObjects.Graphics;
  caption: HTMLElement | null;
  /** 지금 계획 분류(칸마다). 칠하기가 마무리한 분류의 밑그림만 걷는다. */
  readonly planNow: Uint8Array;
  frame: number;
  /** 지금 단계에서 몇 칸까지 그렸나. */
  drawn: number;
  /** 연필 자리(픽셀). */
  pen: { x: number; y: number } | null;
  /** 지금 놓이는 큰 키트 — 괄호를 잠깐 그린다. */
  placing: { readonly rect: NonNullable<ConstructionStep["rect"]>; readonly at: number } | null;
  readonly onUpdate: (time: number, delta: number) => void;
};

export class AgentConstructionRevealRenderer {
  private active: Active | null = null;
  private readonly stopInBackground = (): void => { if (isUiInBackground()) this.clear(); };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly mapId: () => MapId | null,
  ) {}

  get playing(): boolean {
    return this.active !== null;
  }

  play(plan: ConstructionRevealPlan): boolean {
    if (isUiInBackground()) return false;
    if (plan.mapId !== this.mapId()) return false;
    const tileset = store.getCurrent().tilesets[plan.tilesetId];
    if (!tileset) return false;
    const tileSize = tileset.tileSize || 16;
    if (plan.width * tileSize > MAX_TEXTURE_PX || plan.height * tileSize > MAX_TEXTURE_PX) return false;
    this.clear();
    const scene = this.scene;
    const tile = editorMapTileSize(plan.mapId);
    const textureKey = ensureTilesetTexture(scene, tileset);
    const root = scene.add.container(0, 0);
    root.setName("agent-construction-reveal");
    this.layer.add(root);

    // 실제 타일 덮개: 단계가 건드리는 칸만 그 시점 값으로 그린다. 안 건드리는 칸은 투명 — 적용된 맵이 그대로 보인다.
    const ground = scene.add.renderTexture(0, 0, plan.width * tileSize, plan.height * tileSize);
    ground.setOrigin(0, 0);
    ground.setScale(tile / tileSize);
    root.add(ground);
    const blueprint = scene.add.renderTexture(0, 0, plan.width * PLAN_PX, plan.height * PLAN_PX);
    blueprint.setOrigin(0, 0);
    blueprint.setScale(tile / PLAN_PX);
    blueprint.setAlpha(PLAN_ALPHA);
    root.add(blueprint);
    const overlay = scene.add.graphics();
    root.add(overlay);

    const active: Active = {
      plan, tile, tileSize, textureKey, elapsed: 0, root, ground, blueprint, overlay,
      caption: this.mountCaption(plan),
      planNow: new Uint8Array(plan.width * plan.height),
      frame: 0, drawn: 0, pen: null, placing: null,
      onUpdate: (_time, delta) => this.tick(delta),
    };
    this.active = active;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.stopInBackground);
      document.defaultView?.addEventListener("blur", this.stopInBackground);
    }
    const initial = plan.log.initial;
    if (initial) this.drawCells(active, initial, initial.cells.map((_, k) => k), true);
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
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.stopInBackground);
      document.defaultView?.removeEventListener("blur", this.stopInBackground);
    }
    this.scene.events.off("update", active.onUpdate);
    active.root.destroy(true);
    active.caption?.remove();
    if (typeof document !== "undefined") {
      delete document.documentElement.dataset.aiConstructionReveal;
      delete document.documentElement.dataset.aiConstructionStep;
    }
    markEditRenderActive(this.scene.game);
  }

  /**
   * 지금 단계 + 실제 걸린 시간. 재생이라는 걸 밝힌다. 캔버스의 「AI 작업」 카드가 있으면 그 안에 한 줄로 붙이고
   * (위쪽은 캔버스 도구 막대가 가린다), 없으면 캔버스 왼쪽 아래에 같은 모양의 작은 카드를 띄운다.
   */
  private mountCaption(plan: ConstructionRevealPlan): HTMLElement | null {
    if (typeof document === "undefined") return null;
    const card = document.querySelector<HTMLElement>(".ai-canvas-progress:not([hidden])");
    const host = card ?? document.querySelector(".phaser-container");
    if (!host) return null;
    const box = document.createElement("div");
    box.dataset.testid = "ai-construction-step";
    box.setAttribute("role", "status");
    box.style.cssText = card
      ? "margin-top:6px;padding-top:6px;border-top:1px solid rgba(0,0,0,.08);font-size:12px;line-height:1.45"
      : "position:absolute;left:16px;bottom:56px;z-index:6;pointer-events:none;padding:8px 12px;border-radius:10px;"
        + "background:rgba(255,255,255,.95);color:#2a2f3a;font:12px/1.45 system-ui,sans-serif;max-width:min(360px,70%);"
        + "box-shadow:0 2px 8px rgba(0,0,0,.12)";
    const step = document.createElement("strong");
    step.style.cssText = "display:block;font-size:13px;font-weight:600";
    const note = document.createElement("span");
    note.style.cssText = "display:block;opacity:.7";
    const seconds = Math.max(0.1, plan.log.elapsedMs / 1000);
    note.textContent = `도구가 실제로 ${seconds.toFixed(1)}초에 지은 순서를 그대로 늦춰 보여 줘요 · 단계 ${plan.frames.length}개`;
    box.append(step, note);
    host.append(box);
    return box;
  }

  private setCaption(active: Active, frame: ConstructionRevealFrame): void {
    const phase = frame.step.kind === "plan" ? "계획" : frame.step.kind === "paint" ? "칠하기" : frame.step.kind === "stamp" ? "찍기" : "다듬기";
    const text = `${phase} · ${frame.step.label}`;
    // 턴이 끝나 「AI 작업」 카드가 먼저 닫혔으면 캔버스 위 작은 카드로 옮겨 붙인다.
    if (active.caption && !active.caption.isConnected) active.caption = this.mountCaption(active.plan);
    const strong = active.caption?.firstElementChild;
    if (strong) strong.textContent = text;
    if (typeof document !== "undefined") document.documentElement.dataset.aiConstructionStep = text;
  }

  /**
   * 칸 여럿을 기록된 값으로 다시 그린다(아래층 → 아래 덧층 → 위층 → 위 덧층). 지우기를 먼저 다 하고 그리기는 한 묶음으로 —
   * 칸마다 drawFrame 을 부르면 호출마다 그리기 묶음을 열고 닫아 프레임이 무너진다.
   */
  private drawCells(active: Active, values: Omit<ConstructionStep, "kind" | "label">, ks: readonly number[], fresh = false): void {
    if (!ks.length) return;
    const width = active.plan.width, ts = active.tileSize;
    const texture = active.ground.texture as unknown as Phaser.Textures.DynamicTexture;
    for (const k of ks) {
      const c = values.cells[k]!;
      const x = (c % width) * ts, y = Math.floor(c / width) * ts;
      if (!fresh) {
        // DynamicTexture.clear 는 dirty 일 때만 지우고 dirty 를 내린다 — 다음 칸부터 조용히 안 지워진다(Phaser 3.90).
        texture.dirty = true;
        texture.clear(x, y, ts, ts);
      }
      if ((values.lower?.[k] ?? -1) < 0) texture.fill(EMPTY_CELL, 1, x, y, ts, ts);
    }
    texture.beginDraw();
    for (const k of ks) {
      const c = values.cells[k]!;
      const x = (c % width) * ts, y = Math.floor(c / width) * ts;
      for (const tile of [values.lower?.[k] ?? -1, values.lowerOverlay?.[k] ?? -1, values.upper?.[k] ?? -1, values.upperOverlay?.[k] ?? -1]) {
        if (tile < 0) continue;
        const name = `tile_${tile}`;
        if (this.scene.textures.getFrame(active.textureKey, name)) texture.batchDrawFrame(active.textureKey, name, x, y);
      }
    }
    texture.endDraw();
  }

  private clearBlueprintCell(active: Active, c: number): void {
    const width = active.plan.width;
    const texture = active.blueprint.texture as unknown as Phaser.Textures.DynamicTexture;
    texture.dirty = true;
    texture.clear((c % width) * PLAN_PX, Math.floor(c / width) * PLAN_PX, PLAN_PX, PLAN_PX);
  }

  /** 계획 칸 여럿을 분류 색으로 — 한 Graphics 에 모아 덮개에 한 번 찍는다. */
  private drawBlueprintCells(active: Active, step: ConstructionStep, from: number, to: number): void {
    const width = active.plan.width;
    const g = this.scene.make.graphics({}, false);
    for (let k = from; k < to; k++) {
      const c = step.cells[k]!;
      const cls = step.plan?.[k] ?? 0;
      // 이미 칠한 칸의 분류가 바뀌거나 빈 땅으로 돌아가면(막다른 길 다듬기) 먼저 지운다.
      if (active.planNow[c]) this.clearBlueprintCell(active, c);
      active.planNow[c] = cls;
      const color = PLAN_COLORS[active.plan.log.planClasses[cls] ?? ""];
      if (color === undefined) continue;
      const x = (c % width) * PLAN_PX, y = Math.floor(c / width) * PLAN_PX;
      g.fillStyle(color, 1);
      g.fillRect(x, y, PLAN_PX, PLAN_PX);
      // 칸 눈금 — 방안지에 칠한 계획처럼 보이게(건물 자리는 더 진하게).
      g.fillStyle(PLAN_EDGE, active.plan.log.planClasses[cls] === "building" ? 0.55 : 0.22);
      g.fillRect(x, y, PLAN_PX, 1);
      g.fillRect(x, y, 1, PLAN_PX);
    }
    active.blueprint.draw(g);
    g.destroy();
  }

  /** 단계의 칸 from..to 를 그린다. 칠하기·찍기는 실제 타일, 계획은 분류 색. */
  private apply(active: Active, step: ConstructionStep, from: number, to: number): void {
    if (to <= from) return;
    if (step.kind === "plan") {
      this.drawBlueprintCells(active, step, from, to);
      return;
    }
    const ks: number[] = [];
    for (let k = from; k < to; k++) ks.push(k);
    this.drawCells(active, step, ks);
    // 칠하기는 자기가 마무리한 분류의 밑그림만, 찍기·다듬기는 그 칸의 밑그림을 걷는다.
    for (const k of ks) {
      const c = step.cells[k]!;
      if (!active.planNow[c]) continue;
      if (step.kind !== "paint" || step.realizes?.includes(active.planNow[c]!)) { this.clearBlueprintCell(active, c); active.planNow[c] = 0; }
    }
  }

  private tick(delta: number): void {
    const active = this.active;
    if (!active) return;
    // 사용자가 다른 맵으로 옮겼으면 재생은 그 자리에서 끝낸다(덮개가 다른 맵을 가리면 안 된다).
    if (active.plan.mapId !== this.mapId()) {
      this.clear();
      return;
    }
    markEditRenderActive(this.scene.game);
    active.elapsed += Math.max(0, Math.min(Number.isFinite(delta) ? delta : 16, MAX_STEP_MS));
    const elapsed = active.elapsed;
    const { plan, tile } = active;

    // 단계 진행: 지금 단계의 칸을 시간 비율만큼 그리고, 끝났으면 다음 단계로.
    while (active.frame < plan.frames.length) {
      const frame = plan.frames[active.frame]!;
      if (elapsed < frame.at) break;
      if (active.drawn === 0) {
        this.setCaption(active, frame);
        if (frame.step.kind === "stamp" && frame.step.major && frame.step.rect) active.placing = { rect: frame.step.rect, at: frame.at };
      }
      const cells = frame.step.cells;
      const due = Math.min(cells.length, Math.ceil(((elapsed - frame.at) / frame.duration) * cells.length));
      this.apply(active, frame.step, active.drawn, due);
      active.drawn = Math.max(active.drawn, due);
      if (due > 0) {
        const last = cells[due - 1]!;
        const rect = frame.step.rect;
        active.pen = rect
          ? { x: (rect.x + rect.w) * tile, y: (rect.y + rect.h) * tile - tile / 2 }
          : { x: ((last % plan.width) + 1) * tile, y: (Math.floor(last / plan.width) + 0.5) * tile };
      }
      if (active.drawn < cells.length) break;
      active.frame++;
      active.drawn = 0;
    }

    const g = active.overlay;
    g.clear();
    const running = active.frame < plan.frames.length;
    const placing = active.placing;
    if (placing) {
      const age = elapsed - placing.at;
      if (age > 380) active.placing = null;
      else {
        // 집 한 채가 놓이는 순간: 괄호가 잡혔다 풀리고 밑동에 먼지.
        const { rect } = placing;
        const t = age / 380;
        const pad = 3 * (1 - t);
        g.lineStyle(1, BRACKET, 0.75 * (1 - t));
        g.strokeRect(rect.x * tile - pad, rect.y * tile - pad, rect.w * tile + pad * 2, rect.h * tile + pad * 2);
        g.fillStyle(DUST, 0.5 * (1 - t));
        const n = Math.min(8, rect.w * 2);
        for (let i = 0; i < n; i++) g.fillRect(rect.x * tile + ((i + 0.5) * rect.w * tile) / n, (rect.y + rect.h) * tile - 2 - age / 40, 2, 2);
      }
    }
    if (running && active.pen) this.pencil(g, active.pen.x, active.pen.y);

    if (!running && elapsed >= plan.holdUntilMs) {
      // 마지막 단계 = 실제 맵. 남은 밑그림·덮개를 걷어 적용된 맵을 드러낸다.
      active.root.setAlpha(Math.max(0, 1 - (elapsed - plan.holdUntilMs) / CONSTRUCTION_FADE_OUT_MS));
    }
    if (!running && elapsed >= plan.durationMs) this.clear();
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
