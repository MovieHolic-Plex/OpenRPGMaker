/**
 * 2막 보급 상인 — 「중간에 상인 하나 적절한 위치에서 만나서 보급을 좀 받을 수 있게해야할듯」(사용자 2026-11-04).
 * 관문 요새를 넘은 뒤 서리 가도(map_snow_north_1)는 서리나루까지 눈길 둘·얼음 호수를 상점 없이 지난다.
 * 서리 가도 입구 쪽 빈 눈밭에 떠돌이 행상 「베른」이 모닥불을 피우고 있다 —
 * 모닥불 키트·판자 더미(번들, 새 그림 없음)와 사람 칩(People4), 회복약·마력약·해독초·만능약·각성초·불씨 병·연막 구슬을 판다.
 * 이벤트는 snowLandmarks 가 다 깐 뒤(맵 마감) 덧붙인다 — 그 파일과 act2Opening.ts 는 건드리지 않는다.
 */
import { isPassable } from "@/project/collision";
import type { Command, Condition, Project } from "@/project/types";
import { type Cell, chipGraphic, mustMap, page, putEvent, say, shop } from "./common";

export const FS2_MERCHANT_STOCK = [
  "item_potion", "item_hi_potion", "item_ether", "item_antidote", "item_panacea", "item_wake_herb", "item_fs_fire_flask", "item_fs_smoke_pellet",
] as const;
const BERN = "떠돌이 행상 베른";

function stampKit(project: Project, mapId: string, kitId: string, at: Cell): void {
  const map = mustMap(project, mapId);
  const kit = project.tilesets[map.tilesetId]?.structureKits?.find((k) => k.id === kitId);
  if (!kit) throw new Error(`[fallen-world] ${map.tilesetId} 에 키트 ${kitId} 가 없다`);
  kit.rows.forEach((row, ky) => (row.upperTiles ?? []).forEach((t, kx) => {
    if (t !== undefined && t >= 0) map.upperTiles[(at.y + ky) * map.width + at.x + kx] = t;
  }));
}

export function placeSnowMerchant(project: Project, mapId: string, at: Cell, entry: Cell): void {
  const map = mustMap(project, mapId);
  const W = map.width;
  const before = reachable(project, mapId, entry);
  for (const [x, y] of [[at.x, at.y], [at.x, at.y + 1]] as const) {
    if (!isPassable(project, map, x, y) || map.events.some((e) => e.x === x && e.y === y)) throw new Error(`[fallen-world] 행상 자리 (${x},${y}) 가 막혔다`);
  }
  const crate = { x: at.x - 2, y: at.y - 1 }, fire = { x: at.x + 1, y: at.y - 1 };
  for (const [kit, c] of [["bd-pick-snowfield-board", crate], ["bd-pick-snowfield-bonfire", fire]] as const) {
    for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) {
      const i = (c.y + dy) * W + c.x + dx;
      if ((map.upperTiles[i] ?? -1) >= 0 || !isPassable(project, map, c.x + dx, c.y + dy)) throw new Error(`[fallen-world] 행상 소품 자리 (${c.x + dx},${c.y + dy}) 가 비어 있지 않다`);
    }
    stampKit(project, mapId, kit, c);
  }
  const greet = [
    say(BERN, "이런 눈길에 사람이라니. 반갑네.\n서리나루까지 가게는 여기뿐이야."),
    say(BERN, "고개 넘으면 얼음 호수다. 약은 넉넉히 챙겨."),
  ];
  putEvent(map, "ev_fs2_snow_merchant", BERN, at, [
    page("ev_fs2_snow_merchant_first", "처음", [], [...greet, { kind: "setSelfSwitch", key: "A", value: true } satisfies Command, shop(FS2_MERCHANT_STOCK, "행상 베른")],
      { graphic: chipGraphic("tex_easyrpg_charset_people4", 4), trigger: { kind: "action" } }),
    page("ev_fs2_snow_merchant_again", "다시", [{ kind: "selfSwitch", key: "A", value: true } satisfies Condition],
      [say(BERN, "또 왔군. 불 쬐고 가."), shop(FS2_MERCHANT_STOCK, "행상 베른")],
      { graphic: chipGraphic("tex_easyrpg_charset_people4", 4), trigger: { kind: "action" } }),
  ]);
  const after = reachable(project, mapId, entry);
  const front = { x: at.x, y: at.y + 1 };
  const lost = [...before].filter((k) => !after.has(k) && k !== `${at.x},${at.y}`);
  if (!after.has(`${front.x},${front.y}`) || lost.length > 6) {
    throw new Error(`[fallen-world] 행상이 서리 가도 길을 막는다 — 앞 칸 ${after.has(`${front.x},${front.y}`) ? "닿음" : "막힘"}, 잃은 칸 ${lost.length}`);
  }
}

/** 입구에서 걸어서 닿는 칸(행상 칸은 막힘) — 놓기 전·후를 비교한다(얼음 틈 너머 북쪽 출구는 둘 다 안 닿는다). */
function reachable(project: Project, mapId: string, entry: Cell): Set<string> {
  const map = mustMap(project, mapId);
  const seen = new Set([`${entry.x},${entry.y}`]);
  const q = [entry];
  while (q.length) {
    const c = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = c.x + dx, y = c.y + dy, k = `${x},${y}`;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || seen.has(k)) continue;
      if (!isPassable(project, map, x, y) || map.events.some((e) => e.x === x && e.y === y && e.id === "ev_fs2_snow_merchant")) continue;
      seen.add(k);
      q.push({ x, y });
    }
  }
  return seen;
}
