// editor/stampOrderRenderer.ts
// 바로 깔기 주문을 맵 위에 그린다 — 드래그한 자리마다 「#3 연못 · 읽는 중」 사각형.
//
// 왜: 드래그로 주문을 연달아 내리면 채팅 말풍선만으로는 어느 칸이 어느 주문이고 무엇을 기다리는지 알 수 없다.
// 주문이 놓인 자리에 번호와 상태를 붙여 두면 다음 드래그를 어디에 할지 바로 정할 수 있다.
//
// 청사진(agentBlueprintRenderer)과 같은 규약: Phaser Graphics + Text, DOM 을 쓰지 않아 새 CSS 가 없다.
// 스튜디오 모드에서도 같은 EditScene 캔버스가 모니터로 옮겨질 뿐이라 그대로 보인다.
// 실시간 시공 연출 설정(aiLiveCanvas)과는 무관하게 늘 그린다 — 연출이 아니라 주문의 위치다.
// 원본 보기(꾹 누름)는 따른다.

import type Phaser from "phaser";
import { isAgentGhostPreviewHidden } from "@/editor/agentGhostPreview";
import { EVENT_LABEL_FONT_SIZE, eventLabelFontFamily, eventLabelResolution } from "@/editor/editSceneEventMarkers";
import { editorMapTileSize } from "@/editor/mapGeometry";
import { JOB_TONE_CSS, jobNumber, jobTone } from "@/editor/aiJobNumbers";
import {
  isStampOrderActive,
  peekStampOrderQueue,
  stampOrderCaption,
  type StampOrder,
} from "@/editor/stampOrderQueue";
import type { MapId } from "@/project/types";

/** 색 번호(0~3) → 선 색. CSS 의 --tone-0..3(34-ai-presence.css)과 같은 값 — 지도 위 상자 = 작업 목록 번호 색. */
const TONE_COLORS: readonly number[] = [0x3b5bdb, 0x12a150, 0xc2410c, 0x7c3aed];
const TONE_CSS = JOB_TONE_CSS;
const HALO_COLOR = 0x0b1b2b;

interface OrderStyle {
  readonly color: number;
  readonly fillAlpha: number;
  readonly strokeAlpha: number;
  readonly strokeWidth: number;
}

/** 주문 상태별 선 모양 — 색은 번호의 색, 상태는 채움 농도·선 굵기로(글자는 캡션이 말한다). 순수 매핑이라 렌더러 없이 테스트한다. */
export function stampOrderStyle(order: Pick<StampOrder, "status" | "wait">, tone = 0): OrderStyle {
  const color = TONE_COLORS[((tone % 4) + 4) % 4]!;
  if (order.status === "applying" && order.wait !== "chat") return { color, fillAlpha: 0.2, strokeAlpha: 0.95, strokeWidth: 3 };
  if (order.status === "planning" || order.status === "applying") return { color, fillAlpha: 0.12, strokeAlpha: 0.95, strokeWidth: 2 };
  return { color, fillAlpha: 0.06, strokeAlpha: 0.7, strokeWidth: 1 };
}

/** 이 맵에 그릴 주문 — 도는 주문과 기다리는 주문만. */
export function stampOrdersForMap(orders: readonly StampOrder[], mapId: MapId | null): readonly StampOrder[] {
  if (!mapId) return [];
  return orders.filter((order) => order.mapId === mapId && isStampOrderActive(order));
}

/** 주문 id → 화면 번호. 작업 목록 행과 같은 번호다(aiJobNumbers). */
export function stampOrderNumber(id: number): number {
  return jobNumber(`stamp:${id}`);
}

type SceneWithPhaserObjects = Phaser.Scene & {
  readonly add: Phaser.GameObjects.GameObjectFactory;
  readonly cameras: Phaser.Cameras.Scene2D.CameraManager;
};

interface DrawnOrder {
  readonly sig: string;
  readonly objects: readonly Phaser.GameObjects.GameObject[];
}

export class StampOrderRenderer {
  /** 주문 id → 그려 둔 Phaser 객체. 바뀐 주문만 다시 그린다. */
  private readonly drawn = new Map<number, DrawnOrder>();

  constructor(
    private readonly scene: SceneWithPhaserObjects,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly mapId: () => MapId | null,
  ) {}

  /**
   * 왜 키별 비교인가(2026-10-16): 주문이 여럿 도는 동안 주문 하나의 상태가 바뀔 때마다(읽는 중 → 까는 중, 앞 주문 끝남) 전체를
   * `removeAll(true)` 하고 모든 주문의 Graphics 와 Text(텍스처 생성)를 다시 만들었다. 이제 모양이 같은 주문은 그대로 두고 바뀐 주문만 다시 그린다.
   */
  render(): void {
    if (isAgentGhostPreviewHidden()) { this.clear(); return; }
    const queue = peekStampOrderQueue();
    const mapId = this.mapId();
    const orders = queue ? stampOrdersForMap(queue.orders(), mapId) : [];
    if (orders.length === 0) { this.clear(); return; }
    const tile = editorMapTileSize(mapId);
    const live = new Set<number>();
    for (const order of orders) {
      live.add(order.id);
      const no = stampOrderNumber(order.id);
      const sig = [order.status, order.wait, order.blockedBy, order.repairing, tile, no, order.label, order.rect.x, order.rect.y, order.rect.w, order.rect.h].join("|");
      const previous = this.drawn.get(order.id);
      if (previous?.sig === sig) continue;
      if (previous) this.destroy(previous);
      this.drawn.set(order.id, { sig, objects: this.draw(order, no, tile) });
    }
    for (const [id, entry] of this.drawn) {
      if (live.has(id)) continue;
      this.destroy(entry);
      this.drawn.delete(id);
    }
  }

  clear(): void {
    this.drawn.clear();
    this.layer.removeAll(true);
  }

  private destroy(entry: DrawnOrder): void {
    for (const object of entry.objects) {
      this.layer.remove(object, true);
    }
  }

  private draw(order: StampOrder, no: number, tile: number): Phaser.GameObjects.GameObject[] {
    const tone = jobTone(no);
    const style = stampOrderStyle(order, tone);
    const graphics = this.scene.add.graphics();
    const x = order.rect.x * tile;
    const y = order.rect.y * tile;
    const width = order.rect.w * tile;
    const height = order.rect.h * tile;
    graphics.fillStyle(style.color, style.fillAlpha);
    graphics.fillRect(x, y, width, height);
    graphics.lineStyle(style.strokeWidth + 2, HALO_COLOR, 0.55);
    graphics.strokeRect(x, y, width, height);
    graphics.lineStyle(style.strokeWidth, style.color, style.strokeAlpha);
    graphics.strokeRect(x, y, width, height);
    this.layer.add(graphics);
    const objects: Phaser.GameObjects.GameObject[] = [graphics];
    const label = this.label(order, x, y, TONE_CSS[tone]!);
    if (label) {
      this.layer.add(label);
      objects.push(label);
    }
    return objects;
  }

  private label(order: StampOrder, x: number, y: number, background: string): Phaser.GameObjects.Text | null {
    if (typeof this.scene.add.text !== "function") return null;
    return this.scene.add.text(x + 2, y + 2, stampOrderCaption(order, (id) => stampOrderNumber(id)), {
      backgroundColor: background,
      color: "#ffffff",
      fontFamily: eventLabelFontFamily(),
      fontSize: EVENT_LABEL_FONT_SIZE,
      resolution: eventLabelResolution(globalThis.devicePixelRatio, this.scene.cameras?.main?.zoom ?? 1),
      padding: { left: 3, right: 3, top: 1, bottom: 1 },
    });
  }
}
