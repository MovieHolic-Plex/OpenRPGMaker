// 버들항 던전 시공기(compose.ts) 표본을 JSON 으로 쏟는다 — 렌더는 render-beodeul-dungeon-samples.py.
//   bun scripts/content/beodeul-dungeon-samples.mts <outDir>
import fs from "node:fs";
import path from "node:path";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { composeDungeon, type DungeonSpec } from "@/editor/beodeulDungeon/compose";

const out = process.argv[2] ?? "/tmp/dq/run";
fs.mkdirSync(out, { recursive: true });
const ts = createBeodeulCityTileset();
export const SAMPLES: Record<string, DungeonSpec> = {
  // 1. 조수가 「필드에 몬스터가 돌아다니는 던전 층」에 실제로 보낸 방 목록(재시험 trace)
  fe1: { rooms: [{ kind: "entrance" }, { kind: "hall", w: 18, h: 10 }, { kind: "crypt" }, { kind: "hall" }, { kind: "cell" }, { kind: "storage" }, { kind: "boss" }], seed: 7 },
  // 2. 짧은 4방 층(도구 예시)
  short4: { rooms: [{ kind: "entrance" }, { kind: "hall" }, { kind: "crypt" }, { kind: "boss" }], seed: 3 },
  // 3. 성 지하 6방 castle
  castle6: { rooms: [{ kind: "entrance" }, { kind: "hall" }, { kind: "cell", from: "hall2", dir: "W" }, { kind: "storage", from: "hall2", dir: "E" }, { kind: "shrine", from: "hall2", dir: "N" }, { kind: "vault" }], style: "castle", seed: 11 },
  // 4. 큰 층 9방
  big9: { rooms: [{ kind: "entrance" }, { kind: "hall", w: 20, h: 11 }, { kind: "crypt" }, { kind: "cell" }, { kind: "hall" }, { kind: "storage" }, { kind: "shrine" }, { kind: "vault" }, { kind: "boss" }], seed: 21 },
  // 5. 감옥 층(감방 여럿)
  prison: { rooms: [{ kind: "entrance" }, { kind: "hall" }, { kind: "cell" }, { kind: "cell" }, { kind: "cell" }, { kind: "boss" }], style: "castle", seed: 5 },
  // 6. 방 두 개
  tiny2: { rooms: [{ kind: "entrance" }, { kind: "vault" }], seed: 2 },
  // 7~8. 방 목록 없이 크기만(조수가 「던전 하나 만들어줘」에 쓰는 길)
  autoMedium: { size: "medium", seed: 7 },
  autoLarge: { size: "large", seed: 19, style: "castle" },
  // 9~11. 무작위 방 목록 400판 훑기에서 새 천장 모양이 처음 나온 판(관문 표본이 실제로 나오는 모양을 다 덮게)
  rnd5: randomRooms(5), rnd64: randomRooms(64), rnd237: randomRooms(237),
};
function randomRooms(seed: number): DungeonSpec {
  const KINDS = ["hall", "crypt", "cell", "shrine", "storage", "vault", "boss"] as const;
  let s0 = seed;
  const rnd = () => { s0 = (s0 * 1103515245 + 12345) % 2147483648; return s0 / 2147483648; };
  const rooms = [{ kind: "entrance" as const }, ...Array.from({ length: 2 + Math.floor(rnd() * 9) }, () => ({ kind: KINDS[Math.floor(rnd() * KINDS.length)]!, ...(rnd() < 0.3 ? { w: 6 + Math.floor(rnd() * 18), h: 5 + Math.floor(rnd() * 9) } : {}) }))];
  return { rooms, seed, style: seed % 2 ? "catacomb" : "castle", ...(seed % 3 === 0 ? { width: 60, height: 45 } : {}) };
}
// 종류별 표본(2026-10-14 던전 종류 확장): 종류마다 시드 3개 × 크기
for (const t of ["catacomb", "castle", "labyrinth", "sewer", "cave", "temple", "mine", "volcano"] as const) {
  for (const seed of [3, 7, 12]) SAMPLES[`t-${t}-${seed}`] = { type: t, seed, size: seed === 12 ? "large" : seed === 3 ? "small" : "medium" };
}
const only = process.argv.slice(3);
for (const [name, spec] of Object.entries(SAMPLES)) {
  if (only.length && !only.includes(name)) continue;
  const t0 = performance.now();
  try {
    const c = composeDungeon(ts, spec);
    fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ name, ms: Math.round(performance.now() - t0), ...c, passability: undefined }));
    console.log(name, `${c.width}x${c.height}`, `${Math.round(performance.now() - t0)}ms`, "rooms", c.rooms.length, "warn", c.warnings.length);
  } catch (e) {
    console.log(name, "ERROR", (e as Error).message);
  }
}
