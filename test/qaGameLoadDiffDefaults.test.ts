import { describe, expect, it } from "vitest";
import { diffLoadNormalization } from "@/qa/gameCheck/loadDiff";
import type { Project } from "@/project/types";

function projectWith(command: Record<string, unknown>): Project {
  return {
    maps: { m: { id: "m", name: "상점", width: 1, height: 1, events: [{ id: "ev_shop", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [{ id: "p", conditions: [], trigger: { kind: "action" }, commands: [command] }] }] } },
    commonEvents: [],
  } as unknown as Project;
}

describe("qa-game load-normalized", () => {
  const shop = { kind: "shop", itemIds: ["item_orb"], allowSell: true };
  it("로더가 없던 칸에 기본값만 채운 것은 경고하지 않는다", () => {
    const loaded = projectWith({ ...shop, branchOnTransaction: false, branchOnFailedTransaction: false });
    expect(diffLoadNormalization(projectWith(shop), loaded)).toEqual([]);
  });
  it("값을 바꾸거나 의미 있는 칸을 채우면 여전히 경고한다", () => {
    expect(diffLoadNormalization(projectWith(shop), projectWith({ ...shop, allowSell: false }))).toHaveLength(1);
    expect(diffLoadNormalization(projectWith(shop), projectWith({ ...shop, shopType: "normal" }))).toHaveLength(1);
  });
});
