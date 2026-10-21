/**
 * 『폴른 스타』 별빛 천문대 윗 홀 — 오프닝 컷(돔 아래 둥근 단 위 큰 놋쇠 망원경·혼천의·별 지도 탁자·촛대·태피스트리)에 맞춰
 * 홀을 다시 꾸민다(VQA r3 「집처럼 보이고 바닥 55% 가 맨 마루」).
 *
 * 망원경·혼천의·태양계의는 새로 그린 그림이 아니다 — 버들항 칩셋의 기존 손 도트 키트
 * (bd-pick-headland-lighthouse-telescope · bd-pick-wizard-tower-armillary · bd-pick-wizard-tower-orrery)를 화소 그대로
 * 실내 칩셋의 공방 칸으로 옮겨 쓴다(실내 칩셋엔 1칸짜리 작은 망원경뿐이다).
 */
import { bakeWorkshopObject, workshopAssetId } from "@/project/workshopTiles";
import type { GameMap, Project } from "@/project/types";

type Art = { key: string; title: string; from: string; png: string; cols: number; rows: number; foot: number; mask: readonly (readonly number[])[] };

const ART: Record<"telescope" | "armillary" | "orrery", Art> = {
  telescope: {
    key: "telescope", title: "삼각대 놋쇠 망원경", from: "bd-pick-headland-lighthouse-telescope", cols: 2, rows: 3, foot: 1,
    mask: [[0, 1], [1, 1], [1, 1]],
    png: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAwCAYAAABwrHhvAAACGklEQVR4nO2XPUvDQBzGn/oaYiGlgtJUQRRBWic3QTcRcXFy91v0M/gZsrg4uzm4KqiITrZIsR2KhoK0WmlradVzqNemzV2Sa5IimGfLJe3v+b/c5R8gUKBAgQIF+m/SUhLRUhKh12PDBAPAwe44jk5bnXXfDWyvyGR/7xsHu+PM+yN+GwDAhftuQEtJJKlO9Kx9brzje/m4c+1LCWi9ldHu2qEW/b25gNtc3R8DLHAPnCFPDNBG6wdnC7MAKpa/dWWARpy5mYAy2ugDs2VMvysDWkoi7Ii7Kund6Cn45PIl5MoAr85GOAWn9SYAYOqjbgJTMRdZYtU5W5hFmqwDAJKhSxP47KFu+/+2GXBa55JeEQLbGnCc6hiQzz2h9NYUAnMN8MAseDG2g3zuCddXF8JgKtNRfHf/ZapzP9jY3YtLc9hajREMKG4JWHvZWOd5RYL8eIZwZBoz8TD0skIyesV9CYrlCLIFuQcKmDt7c3GEAMBaRBRpY8AO3IaHCQCc56uhSblKkvEw4hEJAISzYDJQe62hpLeEt9TzW8P+IYaY80Bab28pFtwYfef55ypo5AlVEWpIkwEe2IkGMSE0EbGidyvPRzLRLDg24Ef0QgZEJJIFRwb8ih5wOA9YRfJ7AFmeA1aHk+080I7+ixu9GpWJFSShKiSh8t8TQ/kyspKlAS9qb9eQfzcDXna+VRa4Tej1lhtkWBmKfgBdXiX8Ig8CnQAAAABJRU5ErkJggg==",
  },
  armillary: {
    key: "armillary", title: "돌 받침 위 놋쇠 혼천의", from: "bd-pick-wizard-tower-armillary", cols: 2, rows: 4, foot: 2,
    mask: [[1, 1], [1, 1], [1, 1], [1, 1]],
    png: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAABACAYAAAB7jnWuAAAEsElEQVR4nO2XS2xUVRzGfwMMGWtB23TSUoFGJjZtiNG0CzuI5bEQMy0kI6ELuqmNVatufCSYBhMXjTKYuCskliCElAQWdGFhgY+GGnJZ2EYSoBPTMallBsZpO7Wt08FqjovpuT137r105paoi/k2c+//PL7v/F/3DBRQQAEFFFBAAf8xXE4XBv1eARAOJwAYTTrba41T8npfEeFwQieuLUE42csRgn6vyCZ0KiBvD8jTW+Ff8YLV6VcjYN3qJS2TVxYDWIuwS9JVCQj6vUJWAUBs3pqotgRRW4KwGssrB2T8W5uqDLkwmsT1sGoYTeLaUm6dN448MBxJLdW/FzvSXGErQDYaFfW+Ivouj+tuHtUSpnXS3Y4FqMSy0Uh3D14b1+e99fE5ATAWnQXg29Pv6PHNjnVtCWJ75Xom4ilTHhgESCL1lKqttamKwWvj7Hr3nNhzYD87nnmCz/vHllb3CFWEii3lRdyO/amLUUWYPJBNrtqGIykRm4c3Duzn+q0E128pFTBhDgfAyzVFAuBqOGWZpIYqCDTOmcj7tYSe4XK892SfgeTOzV/159073PpzZ5Nb+HyLOrkcV8NsKsOg3yuk22fvJkyKs5NTJVfR2eQWe55bSyTiNtnU3mEIQUco7Qr6N4h6XxFHOqbpu2zdWDKx7hGxiQSV218idvsH7nzziT5PEp26tIar4ZSrs8ktAKRN3dMyadQmU/5UXLe3Bdy0fOShX0sYyE5eXjSRazc8+BvSDN78WycGDOF4qIDZuwk2bvYa7BePpQn1lhpExaPlRJMx/d2z8Lie8SqyiSUsG1GgcY4vvoTvlJMCnLniEZJUonprnOqtawHQbnhIP/YHV8OLOd+ObDthTY3X1OkyOZISF4+ldVuot5yhHzPzXn81zalLbmAxV377e5zM9kDjnMHeFnAvEZcyHElRUTqDzIHsfMgFth7o1xKuoN8rrgxtMNjj0UxyDkdS+hywbkKrEiBFZNsCjR5xZWiDPlZROgNkTu9EQN53wo5Q2tAp708/qY+pTSdXOLoPBBrniEfLaQieEE/PvE9FqdvQ7/NBXgtCx08IgEMt+zh/dC9HOqYJ9ZZSvTWOdsODp+FDAD779OjqyzAbh1vbxaGWfcvv3d/D+PNApv4Pdn+tj5294BOxSCQnEXmFYGBgAIDm5mYAJqp+Yvfby13wzQ/ey2c7IM8QHG5tFwCCFADRaFQfm3qwQPK3JAC5nj5vARIvNOwU23ybDQLGJmJ5EUs4qoK9e19hU2WmQWmaRjQapXjdeidbOft3/ChREFAQUBCwYh+QHyAVL+58lpGREYOtYlMZBw92m+au9GGyFaB++bIRi8VMNoCm5l0W1owoOyGWAkLHTwgrYidYFtUtrET8P3NgZmba1s0SdXV1ht+VcPbCV7kLeJTo6upi6sGC7bilgPHxXwBjQqlZb3fqnp4ewHhPWAm2HpCEVmRyTNO0FQnU0xdvLGuTz/Ozk2dsBZzvO+2CdkNNq2R+v9+STJ5cJZW3pNnE76+pc4s3lrXNz06eWfEGI69hkcjPum2bb7OBUOL+vUkA5v9a/necTSwhPeD4SgaQTE4Z7LF7CROZJLLDP1G3Jf4350W9AAAAAElFTkSuQmCC",
  },
  orrery: {
    key: "orrery", title: "탁자 위 태양계의", from: "bd-pick-wizard-tower-orrery", cols: 2, rows: 2, foot: 1,
    mask: [[1, 1], [1, 1]],
    png: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACn0lEQVR4nO2VT0hUURTGf69xYJBKIybzD0SIGxX8F9gsgoakRZIxIC0CIYRZWBChYC1bBGkQRCEtCje1iDaPlBaBIrh5bZKCsUUSkak1vQQnxSZFb4uZe71v3sw4UxNt5lvd++455/vOPeedC0UUUUQR/xnGbgZ9nV4hWkcTxjO9eQU/+qkCgMHIQkaetAd9nV4h1ydv2I6zp1fqAGirLXV8f/1hXa1NyzZuN9aI8zX7AXi28IOPR6I8eLHp4ivJRC6NReu4CHadBWBqbBzTsg2AYFdYXOhuThA+GsB8ElfBQwG/YDV9YqkiSrIZhAJ+EZ3oZyq5v99xibYNn/hZ3oMkL1u6zsUzXmYiW6K10QNAeNg2TABqBCRLEEnP4bqBVJiWbWD1ANC24RPh4bhx7xZCkgOYLzeTxHHj4TWfKt9gZMEIBfzCFVTDHn0zV3GXjt6RrA4SqeQ6dBGQLIkGvcfUDXT0joj6E6eTuxExMXrZkM6y7ir4ymPA6yAPNnlYbBkS48DYzQHlC6D7A+RcAtOyjVDAL2Sg8PBOoJnIlgg2eZTt7DmLFrW7IzyTQyqGnnXGJkxknLj+uuhV6pSD7ezuJKoPlPJ+HpaXYhysKksrXidORw45DiK51jOWsF75CByPA4lbAGh4HmDq7VZG0pwFdLdXimO1+7IKjH79xrbXn/F8dnGNiciXjDyuHuhur1QZ70aeCxqq9wI7MVPFKAGSuBCk6UVIJHikEMcc+Bfk2cWkCPgTVBw+9Ff+qgTvPq8TW93mVLP7lyokpudsllc33AIkJt/E1LpQYqbn7IxnWSehLiZXfI//ysve0QOLK/G8CfOFfv2g98BSTP6fO+O23Fdw0nl73TEHsk7C+qqynJ5mHWub7uc5lbQIHb8BoIIP4WDnDF0AAAAASUVORK5CYII=",
  },
};

type Grid = number[][];

function bake(project: Project, tilesetId: string, art: Art): Grid {
  const ts = project.tilesets[tilesetId]!;
  const before = ts.tileGrafts?.length ?? 0;
  const cells: { sourceTile: number; dx: number; dy: number }[] = [];
  art.mask.forEach((row, dy) => row.forEach((on, dx) => { if (on) cells.push({ sourceTile: dy * art.cols + dx, dx, dy }); }));
  const kit = bakeWorkshopObject(project as unknown as Parameters<typeof bakeWorkshopObject>[0], tilesetId, {
    objectId: `workshop:fallen-observatory-${art.key}`, title: art.title, description: `${art.title} — 버들항 ${art.from} 화소 그대로(폴른 스타 천문대)`,
    kind: "floor", columns: art.cols, rows: art.rows, footRows: art.foot, risePx: 0, use: ["천문대"], gridHash: `fallen-observatory-${art.key}-v1`,
    asset: { id: workshopAssetId(art.png), dataUrl: art.png, width: art.cols * 16, height: art.rows * 16 },
    cells,
    provenance: { aiGenerated: false, tool: `pixel copy of beodeul_city ${art.from}` },
  });
  for (const g of (ts.tileGrafts ?? []).slice(before)) { (g as { sourceTileSize?: number }).sourceTileSize = 16; (g as { sourceTilesPerRow?: number }).sourceTilesPerRow = art.cols; }
  return kit.rows.map((r) => [...(r.upperTiles ?? r.tiles ?? [])]);
}

function handKit(project: Project, tilesetId: string, id: string): Grid {
  const kits = (project.tilesets[tilesetId] as unknown as { structureKits?: { id: string; rows: { tiles?: number[]; upperTiles?: number[] }[] }[] }).structureKits ?? [];
  const kit = kits.find((k) => k.id === `hand-interior:${id}`);
  return kit ? kit.rows.map((r) => [...(r.upperTiles ?? r.tiles ?? [])]) : [];
}

/** 망원경 이벤트(scopeId)가 선 방을 찾아 홀을 다시 꾸민다. 망원경 받침 칸이 곧 그 이벤트 칸이 된다. */
export function dressObservatoryHall(project: Project, map: GameMap, scopeId: string): void {
  const scope = map.events.find((e) => e.id === scopeId);
  if (!scope) return;
  const ts = project.tilesets[map.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[]; passability: { up: boolean }[] };
  const W = map.width, H = map.height;
  const label = (t: number | undefined): string => (t !== undefined && t >= 0 ? ts.tileMeta?.[t]?.label ?? "" : "");
  const isFloor = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && label(map.lowerTiles[y * W + x]).startsWith("바닥");
  // 방 = 망원경 칸에서 이어진 바닥 칸. 벽 틈(통로 한 칸) 너머는 다른 방이라 폭 1 의 목에서 멈춘다.
  const room = new Set<number>();
  const queue = [scope.y * W + scope.x];
  while (queue.length) {
    const i = queue.pop()!;
    if (room.has(i)) continue;
    const x = i % W, y = Math.floor(i / W);
    if (!isFloor(x, y)) continue;
    // 통로 목: 좌우가 모두 바닥이 아니면(세로 통로) 방이 아니다.
    if (!isFloor(x - 1, y) && !isFloor(x + 1, y)) continue;
    room.add(i);
    queue.push(i - 1, i + 1, i - W, i + W);
  }
  if (room.size < 40) return;
  const xs = [...room].map((i) => i % W), ys = [...room].map((i) => Math.floor(i / W));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const up = map.upperTiles;
  // 홀 바닥 물건을 걷는다 — 맨 윗줄은 벽에 붙은 키 큰 가구(책장)의 밑동일 수 있어 위 칸이 비었을 때만.
  for (const i of room) {
    const y = Math.floor(i / W);
    if (y > y0 || (up[i - W] ?? -1) < 0) up[i] = -1;
  }
  // 바닥 덧그림(마법진·떨어진 수정 같은 홀과 무관한 것)도 걷는다 — 오프닝 천문대엔 마법진이 없다(VQA r4).
  if (map.lowerOverlayTiles) for (const i of room) map.lowerOverlayTiles[i] = -1;
  if (map.upperOverlayTiles) for (const i of room) map.upperOverlayTiles[i] = -1;
  const taken = new Set<number>();
  const others = new Set(map.events.filter((e) => e.id !== scopeId).map((e) => e.y * W + e.x));
  const put = (grid: Grid, x: number, y: number, layer: "upper" | "lowerOverlay" = "upper"): boolean => {
    const cells: [number, number][] = [];
    grid.forEach((row, dy) => row.forEach((t, dx) => { if (t >= 0) cells.push([(y + dy) * W + x + dx, t]); }));
    if (!cells.length) return false;
    if (layer === "upper" && cells.some(([i]) => !room.has(i) || taken.has(i) || others.has(i))) return false;
    if (layer === "lowerOverlay" && cells.some(([i]) => !room.has(i))) return false;
    const target = layer === "upper" ? up : (map.lowerOverlayTiles ??= new Array<number>(W * H).fill(-1));
    for (const [i, t] of cells) { target[i] = t; if (layer === "upper") taken.add(i); }
    return true;
  };
  const telescope = bake(project, map.tilesetId, ART.telescope);
  const armillary = bake(project, map.tilesetId, ART.armillary);
  const orrery = bake(project, map.tilesetId, ART.orrery);
  // 가운데 단: 둥근 양탄자 위 큰 망원경(받침 = 이벤트 칸), 양옆 큰 촛대.
  const sx = scope.x, sy = scope.y;
  put(handKit(project, map.tilesetId, "round rug"), sx, sy - 1, "lowerOverlay");
  put(telescope, sx, sy - 2);
  put(handKit(project, map.tilesetId, "candelabra"), sx - 1, sy - 1);
  put(handKit(project, map.tilesetId, "candelabra"), sx + 2, sy - 1);
  // 왼쪽 혼천의, 오른쪽 태양계의 탁자·지구본, 아래 오른쪽 별 지도 탁자, 아래 왼쪽 책·두루마리 탁자.
  put(armillary, x0 + 1, y0) || put(armillary, x0, y0);
  put(orrery, x1 - 3, y0 + 1) || put(orrery, x1 - 4, y0 + 1);
  put(handKit(project, map.tilesetId, "globe"), x1, y0 + 1);
  put(handKit(project, map.tilesetId, "war map table"), x1 - 4, y1 - 1) || put(handKit(project, map.tilesetId, "chart table"), x1 - 5, y1 - 1);
  put(handKit(project, map.tilesetId, "case scroll"), x0 + 1, y1 - 1) || put(handKit(project, map.tilesetId, "map case"), x0 + 1, y1 - 1);
  put(handKit(project, map.tilesetId, "candle stubs"), x1, y1);
  put(handKit(project, map.tilesetId, "armchair"), x0 + 3, y1) || put(handKit(project, map.tilesetId, "armchair"), x0 + 4, y1);
  put(handKit(project, map.tilesetId, "map rolls"), x1 - 1, y0 + 4);
  put(handKit(project, map.tilesetId, "scroll pile"), x0 + 4, y0 + 1);
  // 남쪽 계단에서 단까지 긴 양탄자 — 맨 마루 아래쪽 절반이 비어 보였다. 계단 칸(방 아래 통로)의 열에서 단 앞 줄까지.
  const aisle = handKit(project, map.tilesetId, "aisle runner");
  const neck = [...Array(x1 - x0 + 1).keys()].map((k) => x0 + k).find((x) => isFloor(x, y1 + 1));
  if (aisle.length === 3 && neck !== undefined) {
    const ax = Math.min(Math.max(neck, sx - 1), sx + 1);
    for (let y = sy + 1; y <= y1; y += 1) put([aisle[y === sy + 1 ? 0 : y === y1 ? 2 : 1]!], ax, y, "lowerOverlay");
  }
  // 뒷벽 태피스트리(별 문양 천) — 벽면 두 줄, 비어 있는 곳에만.
  const tapestry = handKit(project, map.tilesetId, "tapestry");
  for (const tx of [x0 + 4, x1 - 4]) {
    const cells = tapestry.flatMap((row, dy) => row.map((t, dx) => [(y0 - 2 + dy) * W + tx + dx, t] as const)).filter(([, t]) => t >= 0);
    if (cells.length && cells.every(([i]) => (up[i] ?? -1) < 0 && !label(map.lowerTiles[i]).startsWith("바닥"))) for (const [i, t] of cells) up[i] = t;
  }
  // 망원경 이벤트는 단단한 받침 칸 위 — 같은 층에서 마주 보고 조사한다.
  for (const page of scope.pages ?? []) page.priority = "same";
}
