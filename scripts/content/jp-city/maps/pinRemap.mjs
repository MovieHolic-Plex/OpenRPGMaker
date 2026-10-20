// jp_city 칸 번호 옮기기 표 — 「옛 pins.json → 지금 pins.json」을 자리 키로 잇는다. 하나뿐인 정본 로직이다:
//   remap-refs.mjs(게시 장소 32곳 옮기기)와 bake-pin-eras.mjs(사용자 프로젝트 복구 표 src/assets/jpCityPinEras.json)가 같이 쓴다.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { join } from "node:path";

export const PINS_PATH = "tiledata/jp-city/pins.json";

/** <rev> 의 pins.json 칸 표(자리 키 → 번호). rev 가 null 이면 작업 트리의 파일. */
export function readPinCells(root, rev = null) {
  if (rev === null) return JSON.parse(fs.readFileSync(join(root, PINS_PATH), "utf8")).cells;
  const show = spawnSync("git", ["show", `${rev}:${PINS_PATH}`], { cwd: root, encoding: "utf8", maxBuffer: 1 << 30 });
  if (show.status !== 0) throw new Error(`git show ${rev}:${PINS_PATH} 실패: ${show.stderr}`);
  return JSON.parse(show.stdout).cells;
}

/**
 * 옛 번호 → 지금 번호. 옛 번호의 자리 키를 지금 표에서 찾는다.
 * 돌려주는 값: { to(old) → 새 번호 | undefined(지금 표에 그 자리 키가 없음) , oldCount }
 * oldCount 이상 번호는 옛 시트에 없던 칸이라 그대로 둔다(to 가 그 번호를 돌려준다).
 */
export function buildIdRemap(oldCells, nowCells) {
  const keyOf = new Map(Object.entries(oldCells).map(([k, v]) => [v, k]));
  let oldCount = 0;
  for (const v of Object.values(oldCells)) if (v + 1 > oldCount) oldCount = v + 1;
  return {
    oldCount,
    keyOf: (t) => keyOf.get(t),
    to(t) {
      if (t == null || t < 0) return t;
      const key = keyOf.get(t);
      if (key === undefined) return t >= oldCount ? t : undefined;
      return nowCells[key];
    },
  };
}
