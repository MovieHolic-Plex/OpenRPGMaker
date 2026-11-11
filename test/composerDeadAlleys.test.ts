// 구성기 공용 막다른 골목 찾기(composerDeadAlleys) — 어디로도 가지 않는 한 칸 폭 골목의 어귀만 고른다.
import { describe, expect, it } from "vitest";
import { deadAlleyMouths, type AlleyBoard } from "@/project/composerDeadAlleys";

/** '#' 길(쓰임 있는 칸) · '.' 맨땅 · 그 밖은 막힌 칸. */
const board = (rows: readonly string[]): AlleyBoard => ({
  W: rows[0]!.length, H: rows.length,
  walk: (x, y) => rows[y]?.[x] === "#" || rows[y]?.[x] === ".",
  plain: (x, y) => rows[y]?.[x] === ".",
});
const START = { x: 0, y: 5 };

describe("composerDeadAlleys", () => {
  it("집 사이 틈으로만 닿는 성벽 밑 띠는 틈의 길 쪽 어귀를 막는다", () => {
    const rows = [
      "XXXXXXXXXXXX",
      "X..........X",   // 성벽 밑 맨땅 띠
      "XHH.HHH.HHHX",   // 집 줄(틈 x=3, x=7)
      "XHH.HHH.HHHX",
      "XHH.HHH.HHHX",
      "############",   // 길
    ];
    expect(deadAlleyMouths(board(rows), START).map((c) => `${c.x},${c.y}`).sort()).toEqual(["3,4", "7,4"]);
  });

  it("길과 길을 잇는 골목은 지나가는 길이라 그대로 둔다", () => {
    const rows = [
      "############",
      "XHH.HHHHHHHX",
      "XHH.HHHHHHHX",
      "XHH.HHHHHHHX",
      "XHH.HHHHHHHX",
      "############",
    ];
    expect(deadAlleyMouths(board(rows), START)).toEqual([]);
  });

  it("넓은 빈터로 나가는 골목과 한 칸짜리 구석은 막지 않는다", () => {
    const wide = ["XXXXXXXXXXXXXX", ...Array.from({ length: 6 }, () => "X............X"), "XHHHHHH.HHHHHX", "##############"];
    expect(deadAlleyMouths(board(wide), { x: 0, y: 8 })).toEqual([]);
    const nook = ["XXXXXX", "XHH.HX", "######"];
    expect(deadAlleyMouths(board(nook), { x: 0, y: 2 })).toEqual([]);
  });
});
