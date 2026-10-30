// 길 맵의 키큰 풀숲 모양 다듬기.
// 템플릿 1번길의 풀숲은 자로 그은 네모 다섯 덩이라 「풀이 경직된 격자로 깔렸다」(2026-10-28 장부 125).
// 덩이 가장자리를 칸 해시로 깎고(가장자리 칸의 일부를 들풀로), 트인 들풀 쪽으로 몇 칸 내밀어 둥근 덩이로 만든다.
// 새 그림은 없다 — 템플릿이 이미 가진 키큰 풀(tall0·tall1)과 모서리 둥근 변형(tall0rgN·tall1rgN, N = 둥근 모서리 비트
// 1 왼위·2 오른위·4 왼아래·8 오른아래), 들풀(grass0~3)만 쓴다. 길·턱·나무·물 곁 칸은 건드리지 않는다(통행·문·출구 그대로).
import type { GameMap } from "@/project/types";

interface Names { readonly [name: string]: number | undefined }

function hash(seed: number, x: number, y: number): number {
  let n = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) % 1000;
}

/** 바뀐 칸 수. 이름이 모자란 템플릿(키큰 풀 변형이 없는 판)은 손대지 않고 0. */
export function roughenTallGrass(map: GameMap, names: Names, seedText: string): number {
  const tall = [names.tall0, names.tall1];
  const grass = [names.grass0, names.grass1, names.grass2, names.grass3];
  if (tall.some((t) => t === undefined) || grass.some((g) => g === undefined)) return 0;
  const variant = (base: 0 | 1, mask: number): number | undefined => (mask === 0 ? tall[base] : names[`tall${base}rg${mask}`]);
  for (const base of [0, 1] as const) for (let m = 1; m < 16; m += 1) if (variant(base, m) === undefined) return 0;
  const tallSet = new Set<number>();
  for (const base of [0, 1] as const) for (let m = 0; m < 16; m += 1) tallSet.add(variant(base, m)!);
  const grassSet = new Set<number>(grass as number[]);
  const W = map.width, H = map.height;
  let seed = 0; for (const ch of seedText) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? -2 : map.lowerTiles[y * W + x]!);
  const upperFree = (x: number, y: number) => (map.upperTiles[y * W + x] ?? -1) < 0;
  const isTall = (x: number, y: number) => tallSet.has(at(x, y));
  const plain = (x: number, y: number) => grassSet.has(at(x, y)) && upperFree(x, y);
  const before = map.lowerTiles.slice();
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  // 내밀 칸: 들풀이고 맵 가장자리가 아닌 칸(길·턱·나무·물 칸 자체는 들풀이 아니라 자연히 빠진다).
  const open = (x: number, y: number) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  const cut: [number, number][] = [], grow: [number, number][] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (isTall(x, y)) {
      const outside = N4.filter(([dx, dy]) => !isTall(x + dx, y + dy)).length;
      if (outside === 0) continue;
      // 모서리(밖이 둘 이상)는 자주, 곧은 변은 드물게 깎는다 — 변 가운데를 많이 깎으면 이 빠진 톱니가 된다.
      if (hash(seed, x, y) < (outside >= 2 ? 600 : 140)) cut.push([x, y]);
    } else if (plain(x, y) && open(x, y)) {
      const touching = N4.filter(([dx, dy]) => isTall(x + dx, y + dy)).length;
      if (touching >= 1 && hash(seed ^ 0x5bd1e995, x, y) < (touching >= 2 ? 550 : 300)) grow.push([x, y]);
    }
  }
  for (const [x, y] of cut) map.lowerTiles[y * W + x] = grass[hash(seed + 7, x, y) % 4]!;
  for (const [x, y] of grow) map.lowerTiles[y * W + x] = tall[(x + y) & 1]!;
  // 한 칸짜리 섬·구멍 정리: 사방이 들풀인 키큰 풀 한 칸은 지우고, 사방이 키큰 풀인 들풀 한 칸은 메운다.
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const n = N4.filter(([dx, dy]) => isTall(x + dx, y + dy)).length;
    if (isTall(x, y) && n === 0 && before[y * W + x] !== map.lowerTiles[y * W + x]) map.lowerTiles[y * W + x] = grass[hash(seed + 7, x, y) % 4]!;
    else if (plain(x, y) && n === 4) map.lowerTiles[y * W + x] = tall[(x + y) & 1]!;
  }
  // 모서리 둥글림 다시 고르기: 그 모서리를 이루는 두 곧은 이웃이 모두 키큰 풀이 아니면 둥근 모서리.
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!isTall(x, y)) continue;
    const up = !isTall(x, y - 1), down = !isTall(x, y + 1), left = !isTall(x - 1, y), right = !isTall(x + 1, y);
    const mask = (up && left ? 1 : 0) | (up && right ? 2 : 0) | (down && left ? 4 : 0) | (down && right ? 8 : 0);
    map.lowerTiles[y * W + x] = variant(((x + y) & 1) as 0 | 1, mask)!;
  }
  let changed = 0;
  for (let i = 0; i < before.length; i += 1) if (before[i] !== map.lowerTiles[i]) changed += 1;
  return changed;
}
