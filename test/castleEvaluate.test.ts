import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { getTool } from "@/editor/tools/toolRegistry";
import { evaluateCastle, stampCastle } from "@/editor/castleKit";
import type { GameMap } from "@/project/types";

function grassMap(w: number, h: number): GameMap {
  return {
    id: "m_castle",
    name: "성",
    width: w,
    height: h,
    tilesetId: "tileset_combined_town",
    tileSize: 16,
    lowerTiles: new Array(w * h).fill(240), // GRASS
    upperTiles: new Array(w * h).fill(-1),
    events: [],
  };
}

describe("castle evaluate", () => {
  it("정상 성채는 평가를 통과한다(문 개방·마당 도달·시공량)", () => {
    const map = grassMap(40, 34);
    const stamp = stampCastle(map, { area: { x: 2, y: 2, w: 36, h: 30 } });
    expect(stamp.ok).toBe(true);
    if (!stamp.ok) return;
    const report = evaluateCastle(map, stamp);
    expect(report.ok, report.issues.join("; ")).toBe(true);
    expect(report.metrics.gateOpen).toBe(true);
    expect(report.metrics.courtyardReachable).toBe(true);
    expect(report.metrics.roofCells).toBeGreaterThan(0);
    expect(report.metrics.wallCells).toBeGreaterThan(0);
    expect(report.grammar.pass).toBe(true);
    expect(report.grammar.checks.length).toBeGreaterThanOrEqual(8);
    expect(report.score).toBe(100);
  });

  it("데크 없는 맨 성벽(문법 위반)은 평가가 잡아낸다", () => {
    const map = grassMap(40, 34);
    const stamp = stampCastle(map, { area: { x: 2, y: 2, w: 36, h: 30 } });
    if (!stamp.ok) return;
    // 남 커튼 한 열의 데크 보행면을 잔디로 바꿔 "맨 벽"을 만든다.
    const x = stamp.outer.x + 4;
    for (let y = stamp.outer.y; y <= stamp.gate.y - 1; y += 1) {
      const t = map.lowerTiles[y * map.width + x]!;
      if (t === 49 || t === 19 || t === 78 || t === 80) map.lowerTiles[y * map.width + x] = 240;
    }
    const report = evaluateCastle(map, stamp);
    expect(report.grammar.pass).toBe(false);
    expect(report.issues.some((i) => i.includes("문법(a)"))).toBe(true);
  });

  it("캡 아래 lower를 잔디로 강제하면(구버그 재현) 평가가 잡아낸다", () => {
    const map = grassMap(40, 34);
    const stamp = stampCastle(map, { area: { x: 2, y: 2, w: 36, h: 30 } });
    if (!stamp.ok) return;
    const tower = stamp.towers[0];
    expect(tower).toBeDefined();
    if (!tower) return;
    map.lowerTiles[tower.capRow * map.width + tower.x] = 240; // 구 paintRoundTower의 잔디 강제
    const report = evaluateCastle(map, stamp);
    expect(report.grammar.pass).toBe(false);
    expect(report.issues.some((i) => i.includes("문법(d)") || i.includes("문법(a)") || i.includes("문법(c)"))).toBe(true);
  });

  it("성문을 벽으로 막으면 평가가 불합격한다", () => {
    const map = grassMap(40, 34);
    const stamp = stampCastle(map, { area: { x: 2, y: 2, w: 36, h: 30 } });
    if (!stamp.ok) return;
    for (let x = stamp.gate.x; x < stamp.gate.x + stamp.gate.w; x += 1) {
      map.lowerTiles[stamp.gate.y * map.width + x] = 81; // CASTLE_WALL_BOT
    }
    const report = evaluateCastle(map, stamp);
    expect(report.ok).toBe(false);
    expect(report.metrics.gateOpen).toBe(false);
    expect(report.issues.some((i) => i.includes("성문"))).toBe(true);
  });

  it("build_castle 툴이 평가 리포트를 반환한다", () => {
    const project = createBlankProject();
    const res = getTool("build_castle")!.run(project, { width: 44, height: 36 });
    const data = res.data as { evaluation?: { ok: boolean; score: number; metrics: unknown } };
    expect(data.evaluation).toBeDefined();
    expect(typeof data.evaluation!.ok).toBe("boolean");
    expect(typeof data.evaluation!.score).toBe("number");
  });
});
