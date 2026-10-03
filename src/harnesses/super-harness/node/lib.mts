// 슈퍼하네스 노드 쪽 공통 — 맵 그림(이벤트 종류 표식 포함)과 「장치 그림만 있고 이벤트가 없는 칸」 검사.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import spec from "../../../assets/handInteriorSpec.json";
import { tileAt } from "../../../project/collision.ts";
import { renderMapPng } from "../../../../scripts/qa-game/render.mts";
import type { GameMap, Project } from "../../../project/types.ts";

type SpecObject = { ko?: string; category?: string; cells?: [number, number, number, number][] };

/** 손 도트 실내 v5 「JRPG 장치」 그림 칸 → 장치 이름. 이 그림이 있는 칸 근처에는 이벤트가 있어야 동작한다. */
const GIMMICK_TILES: ReadonlyMap<number, string> = (() => {
  const out = new Map<number, string>();
  for (const [id, raw] of Object.entries((spec as { objects: Record<string, SpecObject> }).objects)) {
    if (raw.category !== "gimmick") continue;
    for (const cell of raw.cells ?? []) out.set(cell[2], raw.ko ?? id);
  }
  return out;
})();

export type EventKind = "chest" | "trap" | "save" | "door" | "battle" | "switch" | "talk" | "other";

const KIND_COLOR: Record<EventKind, [number, number, number]> = {
  chest: [255, 196, 40], trap: [235, 60, 60], save: [60, 220, 240], door: [70, 150, 255],
  battle: [200, 40, 120], switch: [180, 110, 255], talk: [120, 230, 120], other: [230, 230, 230],
};

function commandKinds(event: GameMap["events"][number]): Set<string> {
  const kinds = new Set<string>();
  const walk = (list: unknown): void => {
    for (const command of Array.isArray(list) ? list : []) {
      if (!command || typeof command !== "object") continue;
      kinds.add(String((command as { kind?: unknown }).kind));
      for (const value of Object.values(command as Record<string, unknown>)) {
        if (Array.isArray(value)) walk(value);
        else if (value && typeof value === "object") for (const inner of Object.values(value)) if (Array.isArray(inner)) walk(inner);
      }
    }
  };
  for (const page of (event as { pages?: { commands?: unknown }[] }).pages ?? []) walk(page.commands);
  walk((event as { commands?: unknown }).commands);
  return kinds;
}

export function eventKind(event: GameMap["events"][number]): EventKind {
  const kinds = commandKinds(event);
  const name = String((event as { name?: string }).name ?? "");
  if (kinds.has("transfer")) return "door";
  if (kinds.has("battleProcessing")) return "battle";
  if (/상자|chest/i.test(name) || ((kinds.has("changeItems") || kinds.has("changeGold")) && kinds.has("setSelfSwitch"))) return "chest";
  if (/함정|trap/i.test(name) || kinds.has("changeHp") || kinds.has("killPlayer") || kinds.has("gameOver")) return "trap";
  if (/세이브|save/i.test(name) || kinds.has("openSaveMenu") || kinds.has("save") || kinds.has("checkpointSave")) return "save";
  if (kinds.has("setSwitch") || kinds.has("setSelfSwitch")) return "switch";
  if (kinds.has("showText") || kinds.has("text")) return "talk";
  return "other";
}

export interface GimmickProblem { x: number; y: number; what: string }

/** 장치 그림이 칠해진 칸 중 같은 열 위아래 두 칸 안에 이벤트가 하나도 없는 곳. */
export function gimmicksWithoutEvents(map: GameMap): GimmickProblem[] {
  const events = map.events ?? [];
  const out: GimmickProblem[] = [];
  const seen = new Set<string>();
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const { layers } = tileAt(map, x, y);
    for (const tile of layers) {
      const what = tile >= 0 ? GIMMICK_TILES.get(tile) : undefined;
      if (!what) continue;
      const near = events.some((e) => e.x === x && e.y >= y - 2 && e.y <= y + 2);
      if (near) continue;
      // 여러 칸짜리 장치는 맨 아래 칸 하나로 센다.
      const key = `${what}@${x}`;
      if (seen.has(key) && out.some((p) => p.x === x && p.what === what && Math.abs(p.y - y) <= 2)) continue;
      seen.add(key);
      out.push({ x, y, what });
    }
  }
  return out;
}

export function eventCounts(map: GameMap): Record<EventKind, number> {
  const counts: Record<EventKind, number> = { chest: 0, trap: 0, save: 0, door: 0, battle: 0, switch: 0, talk: 0, other: 0 };
  for (const event of map.events ?? []) counts[eventKind(event)] += 1;
  return counts;
}

/** 맵을 2배로 그리고, 이벤트는 종류별 색 테두리, 이벤트 없는 장치 칸은 빨간 X 로 표시한다. */
export function renderAnnotated(project: Project, map: GameMap, file: string): void {
  const scale = 2;
  const size = (project.tilesets[map.tilesetId]?.tileSize ?? 16) * scale;
  const png = PNG.sync.read(renderMapPng(project, map, scale).png);
  const put = (px: number, py: number, rgb: readonly number[]) => {
    if (px < 0 || py < 0 || px >= png.width || py >= png.height) return;
    const i = (py * png.width + px) * 4;
    png.data[i] = rgb[0]!; png.data[i + 1] = rgb[1]!; png.data[i + 2] = rgb[2]!; png.data[i + 3] = 255;
  };
  for (const event of map.events ?? []) {
    const rgb = KIND_COLOR[eventKind(event)];
    const x0 = event.x * size, y0 = event.y * size;
    for (let t = 0; t < 3; t++) for (let k = 0; k < size; k++) {
      put(x0 + k, y0 + t, rgb); put(x0 + k, y0 + size - 1 - t, rgb); put(x0 + t, y0 + k, rgb); put(x0 + size - 1 - t, y0 + k, rgb);
    }
  }
  for (const problem of gimmicksWithoutEvents(map)) {
    const x0 = problem.x * size, y0 = problem.y * size;
    for (let k = 0; k < size; k++) for (let t = -1; t <= 1; t++) {
      put(x0 + k + t, y0 + k, [255, 30, 30]); put(x0 + size - 1 - k + t, y0 + k, [255, 30, 30]);
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
}
