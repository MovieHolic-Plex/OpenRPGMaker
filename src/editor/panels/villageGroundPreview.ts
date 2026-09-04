// 바닥 테마 스와치 — 잔디 미니 맵에 시공과 같은 눈 페인터를 돌린다.
//
// 타일 번호는 여기 두지 않는다. `paintGroundThemeStrip` 이 builder 안에서
// DEFAULT_SNOW_AUTOTILE_GROUP + shapeAutotileGroupAround 를 소유한다.
// grass 카드는 칠하지 않은 잔디, snow 카드는 그 맵에 진짜 눈을 깐 것.

import { createMapShot, houseKitTileset } from "@/editor/panels/villageHousePreview";
import { paintGroundThemeStrip } from "@/editor/tools/village/builder";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

/** 오토타일 가장자리가 보이려면 몸통 + 테두리가 들어갈 최소 칸. */
const STRIP = 8;

export function groundThemePreviewMap(
  value: string | undefined,
  project: Project,
): { readonly map: GameMap; readonly tileset: TilesetDef } | undefined {
  const tileset = houseKitTileset(project);
  if (!tileset) return undefined;
  const map = createBlankMap("바닥", STRIP, STRIP, tileset.id, tileset.tileSize);
  paintGroundThemeStrip(map, { x: 0, y: 0, w: STRIP, h: STRIP }, value);
  return { map, tileset };
}

export function createGroundThemePreview(
  value: string | undefined,
  project: Project,
  options: { readonly label?: string; readonly testid?: string } = {},
): HTMLElement {
  const scratch = groundThemePreviewMap(value, project);
  if (!scratch) {
    return el("span", {
      class: "db-village-ground-shot is-empty",
      attrs: { "aria-hidden": "true" },
    });
  }
  const canvas = createMapShot(scratch.map, scratch.tileset, {
    label: options.label ?? (value === "snow" ? "눈 바닥" : value === "grass" ? "풀 바닥" : "지정 안 함"),
    testid: options.testid ?? (value ? `db-village-preset-ground-${value}-shot` : "db-village-preset-ground-unset-shot"),
    width: 72,
    height: 72,
  });
  canvas.classList.add("db-village-ground-shot");
  return canvas;
}
