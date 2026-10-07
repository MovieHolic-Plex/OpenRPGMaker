// src/harnesses/interior-props/editor/checks.ts
/**
 * 깨짐 검사(파이썬 check_candidate.py 의 hard 항목 중 격자로 잴 수 있는 것)와
 * 꼭대기 면 판정(harness.py _top_gate) 그리고 검수 답 해석.
 */
import { extractJsonObject } from "@/harnesses/_core/workshop/grid";
import type { Grid, Verdict, WorkshopItem } from "@/harnesses/_core/workshop/types";

/** 꼭대기 면 윗면 최소 행 수(16px). 칩셋 책장 3~4·옷장 4·찬장 6·벽난로 5 */
export const TOP_MIN = 3;
const FURNITURE = new Set(["floor", "wall"]);

function bottomRow(grid: Grid): number {
  for (let y = grid.height - 1; y >= 0; y--) {
    for (let x = 0; x < grid.width; x++) if (grid.cells[y * grid.width + x] !== null) return y;
  }
  return -1;
}

export function interiorHardCheck(item: WorkshopItem, grid: Grid, current: Grid | null): string[] {
  if (grid.width !== item.width || grid.height !== item.height) return [`크기: ${grid.width}×${grid.height} ≠ 캔버스 ${item.width}×${item.height}`];
  const at = (x: number, y: number) => grid.cells[y * grid.width + x];
  const problems: string[] = [];
  const bottom = bottomRow(grid);
  if (bottom < 0) return ["그림이 비었다(칠한 화소가 없다)"];
  // 배경 칠 검사. 물건이 캔버스 끝까지 닿으면 귀퉁이가 칠해지는 게 정상이다 — 번들 527종 중 91종(옷장 밑변 등)이 귀퉁이 둘 이상을 칠한다.
  // 그래서 지금 그림이 있으면 「지금 그림에서 비어 있던 귀퉁이」가 둘 이상 칠해졌을 때만, 없으면(새 기물) 네 귀퉁이가 다 칠해졌을 때만 배경으로 본다.
  // 2026-10-07 실측: 옛 규칙(칠한 귀퉁이 ≥2)이 맞게 그린 옷장을 되돌려 후보 셋 중 둘이 고치기 호출을 한 번 더 썼다.
  const cornerXY: readonly (readonly [number, number])[] = [[0, 0], [grid.width - 1, 0], [0, grid.height - 1], [grid.width - 1, grid.height - 1]];
  const painted = cornerXY.filter(([x, y]) => at(x, y) !== null);
  const sameCanvas = current !== null && current.width === grid.width && current.height === grid.height;
  const newlyPainted = sameCanvas ? painted.filter(([x, y]) => current!.cells[y * current!.width + x] === null).length : painted.length;
  if (sameCanvas ? newlyPainted >= 2 : painted.length === 4) problems.push("배경: 귀퉁이가 칠해졌다(물건 밖 배경은 투명이어야 한다)");
  for (let y = 0; y < item.padTop; y++) {
    if (Array.from({ length: grid.width }, (_, x) => at(x, y)).some((c) => c !== null)) {
      problems.push(`위 패딩: 맨 위 ${item.padTop}줄은 비워 둔다(y=${y} 에 그림이 있다)`);
      break;
    }
  }
  if (FURNITURE.has(item.kind)) {
    // 있는 기물은 지금 그림의 접지선 ±1, 새 기물은 캔버스 맨 아래 줄 그대로
    const expected = current ? bottomRow(current) : grid.height - 1;
    const tolerance = current ? 1 : 0;
    if (expected >= 0 && Math.abs(bottom - expected) > tolerance) problems.push(`접지선: 맨 아래 칠한 줄 y=${bottom} (기준 y=${expected}, 허용 ±${tolerance}) — 바닥에 닿게`);
  }
  return problems;
}

export function interiorGate(item: WorkshopItem, verdict: Verdict): Verdict {
  const rows = verdict.topRows;
  if (verdict.verdict !== "PASS" || !FURNITURE.has(item.kind) || rows === null || rows >= TOP_MIN) return verdict;
  return {
    ...verdict,
    verdict: "FAIL",
    codes: [...new Set([...verdict.codes, "FRONT"])],
    reasons: `꼭대기 면 윗면 ${rows}행 < ${TOP_MIN}행(하네스 규칙). ${verdict.reasons}`.trim(),
    fix: `${verdict.fix} 꼭대기 면(${verdict.top}) 윗면을 ${TOP_MIN}행 이상으로 — 필요하면 남쪽 면을 줄인다.`.trim(),
  };
}

export function parseInteriorVerdict(text: string): Verdict {
  try {
    const raw = extractJsonObject(text) as Record<string, unknown>;
    const verdict = String(raw.verdict ?? "").toUpperCase() === "PASS" ? "PASS" : "FAIL";
    const topRows = typeof raw.top_rows === "number" && Number.isInteger(raw.top_rows) ? raw.top_rows : null;
    return {
      verdict,
      codes: Array.isArray(raw.codes) ? raw.codes.filter((c): c is string => typeof c === "string") : [],
      top: typeof raw.top === "string" ? raw.top : "",
      topRows,
      reasons: typeof raw.reasons === "string" ? raw.reasons : "",
      fix: typeof raw.fix === "string" ? raw.fix : "",
      worse: raw.worse === true,
    };
  } catch {
    return { verdict: "FAIL", codes: ["READ"], top: "", topRows: null, reasons: "검수 답을 읽지 못했다", fix: "", worse: false };
  }
}
