import type Phaser from "phaser";
import type { GameMap, TilesetDef } from "@/project/types";
import { mapTileSize } from "@/project/tileGeometry";
import { cellLift, reliefLiftField } from "@/project/relief/screen";
import { createRawChipsetTileObject } from "./chipsetTileRender";
import { structureKitUnitCells } from "./harnessSuggestion/structureKitModel";
import { RELIEF_DOODAD_HOVER_EVENT, type ReliefDoodadHoverDetail } from "./reliefDoodads";
import type { QuickHousePlan } from "./quickHouse";

/** Hover and drag display the exact plan that pointer release will commit. */
export function drawQuickHousePreview(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, map: GameMap, tileset: TilesetDef, plan: QuickHousePlan): void {
  const size = mapTileSize(map, tileset), lift = map.relief ? reliefLiftField(map.relief) : null;
  if (plan.kit) for (const cell of structureKitUnitCells(plan.kit)) {
    const x = plan.x + cell.dx, y = plan.y + cell.dy;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    const preview = createRawChipsetTileObject(scene, map, tileset, x, y, cell.tile);
    preview.setY(preview.y - (lift ? cellLift(lift, x, y) : 0) * size).setAlpha(.65);
    layer.add(preview);
  }
  const g = scene.add.graphics(), color = plan.ok ? 0x2f9e44 : 0xe03131;
  g.fillStyle(color, .22); g.lineStyle(1, color, .85);
  for (const i of plan.indices) {
    const x = i % map.width, y = Math.floor(i / map.width), top = (y - (lift ? cellLift(lift, x, y) : 0)) * size;
    g.fillRect(x * size, top, size, size); g.strokeRect(x * size, top, size, size);
  }
  layer.add(g);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<ReliefDoodadHoverDetail>(RELIEF_DOODAD_HOVER_EVENT, {
    detail: { ok: plan.ok, reason: `${plan.kit ? `${plan.kit.width}×${plan.kit.height}칸 · ` : ""}${plan.reason} · ${plan.resizedPlacementId ? "놓기: 지붕 변경" : "놓기: 배치"} · Esc: 취소`, label: "집 외관" },
  }));
}
