import { describe, expect, it } from "vitest";

import { formatViewportContextBlock } from "@/ai/mapViewportContext";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";

// 자동 주입 뷰포트 블록이 isPassable 과 같은 판정으로 통행 불가 칸을 기계가 읽을 수 있게 표시하는지.
// 포맷 계약: `pass:x,y` 다음 h줄이 각 행. 칸마다 한 글자, `#`=불가 `.`=가능.
// 산문 문구가 아니라 파싱된 마커·좌표만 검증한다.

const BLOCKED = "#";
const OPEN = ".";
const ORIGIN_RE = /^pass:(\d+),(\d+)$/;
const ROW_RE = /^[.#]+$/;

function fixture(): { project: Project; map: GameMap; mapId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  return { project, map, mapId };
}

function setTile(map: GameMap, x: number, y: number, tile: number): void {
  map.lowerTiles[y * map.width + x] = tile;
  map.upperTiles[y * map.width + x] = TILE.EMPTY;
}

function parsePassabilityGrid(block: string): {
  originX: number;
  originY: number;
  rows: string[];
} | null {
  const lines = block.split("\n");
  const originAt = lines.findIndex((line) => ORIGIN_RE.test(line));
  if (originAt < 0) return null;
  const match = ORIGIN_RE.exec(lines[originAt]);
  if (!match) return null;
  const rows: string[] = [];
  for (let i = originAt + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!ROW_RE.test(line)) break;
    rows.push(line);
  }
  if (rows.length === 0) return null;
  return { originX: Number(match[1]), originY: Number(match[2]), rows };
}

function markAt(
  grid: { originX: number; originY: number; rows: string[] },
  x: number,
  y: number,
): string {
  const row = grid.rows[y - grid.originY];
  if (row === undefined) throw new Error(`row missing for y=${y}`);
  const ch = row[x - grid.originX];
  if (ch === undefined) throw new Error(`col missing for x=${x}`);
  return ch;
}

describe("뷰포트 컨텍스트 통행 불가 표시", () => {
  it("물이 있는 뷰포트는 해당 칸을 # 마커로 표시한다", () => {
    const { project, map, mapId } = fixture();
    setTile(map, 2, 1, TILE.WATER);
    setTile(map, 3, 2, TILE.WALL);
    expect(isPassable(project, map, 2, 1)).toBe(false);
    expect(isPassable(project, map, 3, 2)).toBe(false);
    expect(isPassable(project, map, 1, 1)).toBe(true);

    const viewport = {
      mapId,
      centerX: 2,
      centerY: 2,
      x: 1,
      y: 1,
      w: 4,
      h: 3,
    };
    const block = formatViewportContextBlock(viewport, map.name, project);
    const grid = parsePassabilityGrid(block);
    expect(grid).not.toBeNull();
    expect(grid!.originX).toBe(1);
    expect(grid!.originY).toBe(1);
    expect(markAt(grid!, 2, 1)).toBe(BLOCKED);
    expect(markAt(grid!, 3, 2)).toBe(BLOCKED);
    expect(markAt(grid!, 1, 1)).toBe(OPEN);
    expect(markAt(grid!, 4, 3)).toBe(OPEN);
  });

  it("전부 통행 가능한 뷰포트에는 # 마커가 없다", () => {
    const { project, map, mapId } = fixture();
    const viewport = {
      mapId,
      centerX: 3,
      centerY: 3,
      x: 0,
      y: 0,
      w: 5,
      h: 4,
    };
    for (let y = 0; y < viewport.h; y += 1) {
      for (let x = 0; x < viewport.w; x += 1) {
        expect(isPassable(project, map, x, y)).toBe(true);
      }
    }

    const block = formatViewportContextBlock(viewport, map.name, project);
    const grid = parsePassabilityGrid(block);
    expect(grid).not.toBeNull();
    expect(grid!.rows.join("")).not.toContain(BLOCKED);
    expect(grid!.rows.every((row) => [...row].every((ch) => ch === OPEN))).toBe(true);
  });

  it("추가 비용은 칸당 한 글자·행당 한 줄로 묶인다", () => {
    const { project, map, mapId } = fixture();
    setTile(map, 5, 5, TILE.WATER);
    const viewport = {
      mapId,
      centerX: 8,
      centerY: 6,
      x: 2,
      y: 2,
      w: 10,
      h: 8,
    };
    const base = formatViewportContextBlock(viewport, map.name);
    const block = formatViewportContextBlock(viewport, map.name, project);
    const grid = parsePassabilityGrid(block);
    expect(grid).not.toBeNull();
    expect(grid!.rows).toHaveLength(viewport.h);
    for (const row of grid!.rows) {
      expect(row).toHaveLength(viewport.w);
    }
    const added = block.length - base.length;
    const originOverhead = 24;
    expect(added).toBeLessThanOrEqual(viewport.w * viewport.h + viewport.h + originOverhead);
  });
});
