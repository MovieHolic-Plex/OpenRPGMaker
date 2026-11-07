import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// 왜: 게임 공장의 관제 영상·보고서는 이 두 출력만 믿는다 — 게임마다 소유 레인 id 가 붙은 events.jsonl 행과,
// 「게임들이 서로 얼마나 같은가」 수치. 둘이 조용히 틀리면 「서로 다른 게임 30개」 주장이 거짓이 된다.
const REPO = resolve(__dirname, "..");
const node = (args: string[]) => execFileSync(process.execPath, args, { cwd: REPO, encoding: "utf8" });

function game(dir: string, id: string, genre: string, tilesetId: string, tiles: number[]) {
  mkdirSync(join(dir, id, "check"), { recursive: true });
  writeFileSync(join(dir, id, "spec.json"), JSON.stringify({ id, genre }));
  const map = { id: "m", tilesetId, lowerTiles: tiles, upperTiles: tiles.map(() => -1) };
  writeFileSync(join(dir, id, "check", "project.json"), JSON.stringify({ maps: { m: map } }));
}

describe("game-factory sameness", () => {
  it("scores identical games 1, disjoint games 0, and counts genres", () => {
    const dir = mkdtempSync(join(tmpdir(), "gf-same-"));
    game(dir, "g01", "puzzle", "beodeul_city", [1, 2, 3]);
    game(dir, "g02", "farming", "beodeul_city", [3, 2, 1]);
    game(dir, "g03", "puzzle", "sf_station", [1, 2, 3]);
    const out = JSON.parse(node(["scripts/game-factory/sameness.mjs", dir]));
    expect(out.games).toBe(3);
    expect(out.mostSimilar[0]).toMatchObject({ a: "g01", b: "g02", jaccard: 1 });
    expect(out.jaccard.min).toBe(0);
    expect(out.distinctGenres).toBe(2);
    expect(out.distinctTilesets).toBe(2);
  });
});

describe("game-factory dispatcher events", () => {
  it("queues every game under its own lane id on a monotonic clock", () => {
    const dir = mkdtempSync(join(tmpdir(), "gf-dry-"));
    node(["scripts/game-factory/dispatch.mjs", "--out", dir, "--only", "g01,g02,g03", "--dry"]);
    const rows = readFileSync(join(dir, "events.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const queued = rows.filter((r) => r.type === "queued");
    expect(queued.map((r) => [r.id, r.owner])).toEqual([["g01", "g01"], ["g02", "g02"], ["g03", "g03"]]);
    expect(rows.every((r, i) => i === 0 || r.mono >= rows[i - 1].mono)).toBe(true);
  });
});
