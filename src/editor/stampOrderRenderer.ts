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
import {
  isStampOrderActive,
  peekStampOrderQueue,
  stampOrderCaption,
  type StampOrder,
} from "@/editor/stampOrderQueue";
import type { MapId } from "@/project/types";

const WAIT_COLOR = 0x9aa4ad;
const PLAN_COLOR = 0x4dabf7;
const APPLY_COLOR = 0xf8f9fa;
const HALO_COLOR = 0x0b1b2b;

interface OrderStyle {
  readonly color: number;
  readonly fillAlpha: number;
  readonly strokeAlpha: number;
  readonly strokeWidth: number;
}

/** 주문 상태별 선 모양 — 순수 매핑이라 렌더러 없이 테스트한다. */
export function stampOrderStyle(order: Pick<StampOrder, "status" | "wait">): OrderStyle {
  if (order.status === "applying" && order.wait !== "chat") return { color: APPLY_COLOR, fillAlpha: 0.16, strokeAlpha: 0.95, strokeWidth: 2 };
  if (order.status === "planning" || order.status === "applying") return { color: PLAN_COLOR, fillAlpha: 0.12, strokeAlpha: 0.95, strokeWidth: 2 };
  return { color: WAIT_COLOR, fillAlpha: 0.08, strokeAlpha: 0.8, strokeWidth: 1 };
}

/** 이 맵에 그릴 주문 — 도는 주문과 기다리는 주문만. */
export function stampOrdersForMap(orders: readonly StampOrder[], mapId: MapId | null): readonly StampOrder[] {
  if (!mapId) return [];
  return orders.filter((order) => order.mapId === mapId && isStampOrderActive(order));
}

type SceneWithPhaserObjects = Phaser.Scene & {
  readonly add: Phaser.GameObjects.GameObjectFactory;
  readonly cameras: Phaser.Cameras.Scene2D.CameraManager;
};

export class StampOrderRenderer {
  constructor(
    private readonly scene: SceneWithPhaserObjects,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly mapId: () => MapId | null,
  ) {}

  render(): void {
    this.layer.removeAll(true);
    if (isAgentGhostPreviewHidden()) return;
    const queue = peekStampOrderQueue();
    if (!queue) return;
    const mapId = this.mapId();
    const orders = stampOrdersForMap(queue.orders(), mapId);
    if (orders.length === 0) return;
    const tile = editorMapTileSize(mapId);
    for (const order of orders) {
      const style = stampOrderStyle(order);
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
      const label = this.label(order, x, y);
      if (label) this.layer.add(label);
    }
  }

  clear(): void {
    this.layer.removeAll(true);
  }

  private label(order: StampOrder, x: number, y: number): Phaser.GameObjects.Text | null {
    if (typeof this.scene.add.text !== "function") return null;
    return this.scene.add.text(x + 2, y + 2, stampOrderCaption(order), {
      backgroundColor: "#0b1b2b",
      color: "#e7f5ff",
      fontFamily: eventLabelFontFamily(),
      fontSize: EVENT_LABEL_FONT_SIZE,
      resolution: eventLabelResolution(globalThis.devicePixelRatio, this.scene.cameras?.main?.zoom ?? 1),
      padding: { left: 3, right: 3, top: 1, bottom: 1 },
    });
  }
}

