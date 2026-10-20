// editor/jpCityPinRepairDialog.ts
// 「jp_city 칸 번호 복구」 창 — 2026-10-14~18 칸 번호가 밀린 판에서 그린 jp_city 맵을 지금 번호로 옮긴다.
//
// 프로젝트는 맵을 어느 시트 판에서 그렸는지 저장하지 않아(project/defaults/jpCityPinRepair.ts 머리말) 자동으로 옮기지 않는다.
// 대신 「지금 그대로」와 판마다 옮긴 결과를 같은 자리에서 그려 보여 주고, 사람이 맞게 보이는 판을 고른다.
// 적용: 로컬 폴더면 backups/ 사본을 먼저 만들고, 실행 취소 기록(applyProjectWithHistory)에 한 단계로 넣는다.
import { loadTilesetImage } from "@/editor/mapTileDraw";
import { drawMapTileLayers, type TilesetCanvasImage } from "@/editor/mapTileDrawCore";
import { applyProjectWithHistory } from "@/editor/mapEditHistory";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import {
  applyJpCityPinRepair,
  jpCityPinRepairCandidates,
  jpCityPinRepairRecordFor,
  loadJpCityPinEras,
  remapJpCityMap,
  type JpCityPinEra,
} from "@/project/defaults/jpCityPinRepair";
import { projectRepository } from "@/project/persistence/repository";
import { isLocalTarget } from "@/project/persistence/target";
import { store } from "@/project/store";
import type { GameMap, MapId, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

/** 미리보기 창(칸). 판마다 같은 자리를 그린다 — 후보들이 지금과 가장 많이 다른 32×20 칸. */
const VIEW_W = 32;
const VIEW_H = 20;

/** 후보 맵들이 지금 맵과 다른 칸이 가장 많은 창의 왼쪽 위(칸). */
function busiestWindow(map: GameMap, others: readonly GameMap[]): { readonly left: number; readonly top: number; readonly w: number; readonly h: number } {
  const w = Math.min(VIEW_W, map.width);
  const h = Math.min(VIEW_H, map.height);
  const W = map.width;
  const sum = new Int32Array((map.width + 1) * (map.height + 1));
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const differs = others.some((other) => other.lowerTiles[i] !== map.lowerTiles[i] || other.upperTiles[i] !== map.upperTiles[i]
        || other.lowerOverlayTiles?.[i] !== map.lowerOverlayTiles?.[i] || other.upperOverlayTiles?.[i] !== map.upperOverlayTiles?.[i]);
      sum[(y + 1) * (W + 1) + x + 1] = (differs ? 1 : 0) + sum[y * (W + 1) + x + 1]! + sum[(y + 1) * (W + 1) + x]! - sum[y * (W + 1) + x]!;
    }
  }
  let best = { left: 0, top: 0, n: -1 };
  for (let top = 0; top + h <= map.height; top += 1) {
    for (let left = 0; left + w <= W; left += 1) {
      const n = sum[(top + h) * (W + 1) + left + w]! - sum[top * (W + 1) + left + w]! - sum[(top + h) * (W + 1) + left]! + sum[top * (W + 1) + left]!;
      if (n > best.n) best = { left, top, n };
    }
  }
  return { left: best.left, top: best.top, w, h };
}

function drawWindow(map: GameMap, tileset: TilesetDef, image: TilesetCanvasImage, view: { left: number; top: number; w: number; h: number }): HTMLCanvasElement {
  const tile = tileset.tileSize || 16;
  const canvas = document.createElement("canvas");
  canvas.width = view.w * tile;
  canvas.height = view.h * tile;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return canvas;
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#1b2430";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(-view.left * tile, -view.top * tile);
  drawMapTileLayers(context, image, map, tileset, 1);
  return canvas;
}

export function isJpCityMap(mapId: MapId): boolean {
  return store.getCurrent().maps[mapId]?.tilesetId === "jp_city";
}

export async function openJpCityPinRepairDialog(mapId: MapId): Promise<void> {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset || map.tilesetId !== "jp_city") return;
  const done = jpCityPinRepairRecordFor(project, mapId);
  const table = await loadJpCityPinEras();
  const candidates = jpCityPinRepairCandidates(project, mapId, table);
  const image = await loadTilesetImage(tileset);
  const previews = candidates.map((candidate) => remapJpCityMap(map, candidate.era).map);
  const view = busiestWindow(map, done ? [] : previews);
  const draw = (target: GameMap): HTMLCanvasElement => drawWindow(target, tileset, image, view);

  const opener = document.activeElement;
  const overlay = el("div", { class: "app-modal-overlay", dataset: { testid: "jp-pin-repair-modal" } });
  let selected: JpCityPinEra | null = null;
  const applyButton = el("button", {
    class: "app-modal-button is-confirm",
    text: "이 판으로 옮기기",
    attrs: { type: "button", disabled: "" },
    dataset: { testid: "jp-pin-repair-apply" },
  }) as HTMLButtonElement;
  const close = (): void => {
    unregisterModal(overlay);
    overlay.remove();
    if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
  };
  const choiceButtons: HTMLButtonElement[] = [];
  const figure = (title: string, meta: string, canvas: HTMLCanvasElement, era: JpCityPinEra | null): HTMLButtonElement => {
    const button = el("button", {
      class: "jp-pin-repair-choice" + (era ? "" : " is-current"),
      attrs: { type: "button", "aria-pressed": "false" },
      dataset: { testid: era ? `jp-pin-repair-choice-${era.id}` : "jp-pin-repair-current" },
      children: [canvas, el("span", { class: "jp-pin-repair-choice-title", text: title }), el("span", { class: "jp-pin-repair-choice-meta", text: meta })],
    }) as HTMLButtonElement;
    if (era) {
      button.addEventListener("click", () => {
        selected = era;
        for (const other of choiceButtons) other.setAttribute("aria-pressed", String(other === button));
        applyButton.disabled = false;
      });
      choiceButtons.push(button);
    }
    return button;
  };

  const message = done
    ? `이 맵은 ${done.at.slice(0, 10)} 에 「${table.eras.find((era) => era.id === done.era)?.label ?? done.era}」 판으로 이미 옮겼습니다(${done.moved}칸). 한 맵은 한 번만 옮깁니다 — 잘못 골랐으면 실행 취소나 백업으로 되돌리세요.`
    : candidates.length === 0
      ? "이 맵에는 옮길 칸이 없습니다 — 지금 칸 번호로 그린 맵입니다."
      : "2026년 10월 14~18일 사이 jp_city 시트가 다시 구워지며 칸 번호가 밀렸습니다. 그 사이에 그린 맵은 건물·바닥이 엉뚱한 칸으로 보입니다.\n"
        + "프로젝트에는 맵을 어느 판에서 그렸는지 기록이 없어 자동으로 옮기지 않습니다. 아래에서 제대로 보이는 그림을 고르세요. 「지금 그대로」가 맞으면 닫으면 됩니다.";
  const grid = el("div", { class: "jp-pin-repair-grid", dataset: { testid: "jp-pin-repair-grid" } });
  grid.append(figure("지금 그대로", "옮기지 않음", draw(map), null));
  if (!done) {
    for (const [index, candidate] of candidates.entries()) {
      const preview = previews[index]!;
      grid.append(figure(`${candidate.era.label} 에 그린 맵`, `옮길 칸 ${candidate.moved}` + (candidate.lost > 0 ? ` · 지금 시트에 없는 칸 ${candidate.lost}` : ""), draw(preview), candidate.era));
    }
  }
  applyButton.addEventListener("click", () => {
    if (!selected) return;
    const era = selected;
    applyButton.disabled = true;
    void (async () => {
      const repository = projectRepository();
      const target = repository.currentTarget();
      if (repository.backup && target && isLocalTarget(target)) {
        try {
          await store.flush();
          await repository.backup(target);
        } catch (error) {
          toast(`백업을 만들지 못해 옮기지 않았습니다: ${error instanceof Error ? error.message : String(error)}`, "error");
          applyButton.disabled = false;
          return;
        }
      }
      const current = store.getCurrent();
      const next = { ...current, meta: { ...current.meta } };
      const record = applyJpCityPinRepair(next, mapId, era, new Date().toISOString());
      if (!record) { close(); return; }
      applyProjectWithHistory(next, "jp_city 칸 번호 복구");
      close();
      toast(`칸 ${record.moved}개를 지금 번호로 옮겼습니다` + (record.commands ? ` · 타일 바꾸기 명령 ${record.commands}개` : "") + (record.lost ? ` · 지금 시트에 없는 칸 ${record.lost}개는 그대로` : ""), "ok");
    })();
  });
  const card = el("div", {
    class: "app-modal-card jp-pin-repair-window",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": "jp_city 칸 번호 복구" },
    children: [
      el("div", { class: "app-modal-title", text: `jp_city 칸 번호 복구 — ${map.name}` }),
      el("div", { class: "app-modal-message", text: message }),
      grid,
      el("div", {
        class: "app-modal-actions",
        children: [
          el("button", { class: "app-modal-button", text: "닫기", attrs: { type: "button" }, dataset: { testid: "jp-pin-repair-cancel" }, on: { click: close } }),
          ...(done || candidates.length === 0 ? [] : [applyButton]),
        ],
      }),
    ],
  });
  card.addEventListener("click", (event) => event.stopPropagation());
  overlay.addEventListener("click", close);
  overlay.append(card);
  document.body.append(overlay);
  registerModal(overlay, close);
}
