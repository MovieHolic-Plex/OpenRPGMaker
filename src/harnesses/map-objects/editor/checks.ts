// src/harnesses/map-objects/editor/checks.ts
/** 맵 기물의 깨짐 검사(격자로 잴 수 있는 것)와 검수 답 해석. */
import { extractJsonObject } from "@/harnesses/_core/workshop/grid";
import type { Grid, Verdict, WorkshopItem } from "@/harnesses/_core/workshop/types";

const STANDING = new Set(["floor", "wall"]);

export function mapObjectHardCheck(item: WorkshopItem, grid: Grid): string[] {
  if (grid.width !== item.width || grid.height !== item.height) return [`크기: ${grid.width}×${grid.height} ≠ 캔버스 ${item.width}×${item.height}`];
  const at = (x: number, y: number) => grid.cells[y * grid.width + x];
  let bottom = -1;
  for (let y = grid.height - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < grid.width; x++) if (at(x, y) !== null) { bottom = y; break; }
  if (bottom < 0) return ["그림이 비었다(칠한 화소가 없다)"];
  const problems: string[] = [];
  // 새 기물이라 비교할 지금 그림이 없다 — 네 귀퉁이가 다 칠해졌을 때만 배경을 칠했다고 본다(바닥 무늬는 칸을 채우는 게 정상)
  const corners = [[0, 0], [grid.width - 1, 0], [0, grid.height - 1], [grid.width - 1, grid.height - 1]] as const;
  if (item.kind !== "flat" && corners.every(([x, y]) => at(x, y) !== null)) problems.push("배경: 네 귀퉁이가 다 칠해졌다(물건 밖은 투명이어야 한다)");
  for (let y = 0; y < item.padTop; y++) {
    if (Array.from({ length: grid.width }, (_, x) => at(x, y)).some((c) => c !== null)) {
      problems.push(`위 패딩: 맨 위 ${item.padTop}줄은 비워 둔다(y=${y} 에 그림이 있다)`);
      break;
    }
  }
  if (STANDING.has(item.kind) && bottom !== grid.height - 1) problems.push(`접지선: 맨 아래 칠한 줄 y=${bottom} — 캔버스 맨 아래(y=${grid.height - 1})에 닿게`);
  return problems;
}

export function parseMapObjectVerdict(text: string): Verdict {
  try {
    const raw = extractJsonObject(text) as Record<string, unknown>;
    return {
      verdict: String(raw.verdict ?? "").toUpperCase() === "PASS" ? "PASS" : "FAIL",
      codes: Array.isArray(raw.codes) ? raw.codes.filter((c): c is string => typeof c === "string") : [],
      top: typeof raw.top === "string" ? raw.top : "",
      topRows: typeof raw.top_rows === "number" && Number.isInteger(raw.top_rows) ? raw.top_rows : null,
      reasons: typeof raw.reasons === "string" ? raw.reasons : "",
      fix: typeof raw.fix === "string" ? raw.fix : "",
      worse: raw.worse === true,
    };
  } catch {
    return { verdict: "FAIL", codes: ["READ"], top: "", topRows: null, reasons: "검수 답을 읽지 못했다", fix: "", worse: false };
  }
}
