/** 용암 곧은 가장자리 자국을 섞는다. 던전·체육관이 같은 그림과 같은 배치 규칙을 쓴다. */
import type { Field } from "./kitlib.mts";

export function mixLavaEdges(f: Field, pre: string, salt: number) {
  for (const m of [55, 205, 110, 155]) {
    const re = new RegExp(`^${pre}_at${m}(_f0)?$`);
    for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
      const base = f.at(x, y); if (!re.test(base)) continue;
      const pool = [base, `${pre}_ate${m}_1_f0`, `${pre}_ate${m}_2_f0`];
      const h = (Math.imul(x + salt, 73856093) ^ Math.imul(y + m, 19349663)) >>> 0;
      const near = new Set([f.at(x - 1, y), f.at(x, y - 1)]);
      let v = h % pool.length;
      for (let n = 0; n < pool.length && near.has(pool[v]); n++) v = (v + 1) % pool.length;
      f.lo(x, y, pool[v]);
    }
  }
}
