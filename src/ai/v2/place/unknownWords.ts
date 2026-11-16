// 표에 없는 낱말(벽·바닥·기물 id)을 한 번에 모아, 표에서 낱말 겹침으로 셈한 가까운 id 와 함께 알린다.
//
// 왜(2026-11-15 r6 묶음 은행): 버들항 표는 v5 보다 훨씬 작다(기물 643 → 287, 벽 23 → 8, 바닥 33 → 7). 모델이 v5 낱말(chair N · keg rack ·
// logdark · boards)을 쓰면 거절 글은 «use an exact id from the catalog.» 만 자리마다 되풀이했고(chair N 넷 = 네 줄), 벽 → 바닥 → 기물 순으로
// 한 단계씩만 드러나 고칠 때마다 새 거절을 받았다. 글은 900자에서 잘려 10~15건 중 6건만 모델에 닿았다.
// 여기서는: 낱말 갈래마다 한 줄, 같은 낱말은 ×n 으로 묶고, 가까운 id 는 표의 id 낱말과 겹치는 정도로 셈한다 — 손으로 쓴 짝 목록은 없다.
import type { HandInteriorSpec } from "@/editor/handInterior/builder";

const SIZED = /^([a-z-]+) (\d+)x(\d+)$/u;

/** id → 낱말(소문자, 글자만 — 크기 2x1·방향 N·폭 3w 는 떨어진다, 복수 s 는 뗀다). */
function wordsOf(id: string): string[] {
  return String(id).toLowerCase().split(/[^a-z]+/u).filter((w) => w.length > 1).map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}
/** 두 낱말이 얼마나 같은가: 같으면 1, 한쪽이 다른 쪽의 머리(3자 이상)·꼬리(4자 이상)면 0.6 — logdark~log · roundtable~round·table · workbench~work. */
function alike(a: string, b: string): number {
  if (a === b) return 1;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length >= 3 && l.startsWith(s)) return 0.6;
  if (s.length >= 4 && l.endsWith(s)) return 0.6;
  return 0;
}

/** 표에서 «흔한 낱말» — 이만큼의 id 에 나오는 낱말(table · shelf · rack · board · wall …) 하나만 겹친 것은 가깝다고 치지 않는다. */
const COMMON_DF = 5;

/**
 * 표의 id 가운데 word 와 낱말이 겹쳐 가까운 것(최대 max 개). 틀린 권유보다 «없다»가 낫다 — 아래 셋 중 하나일 때만 가깝다:
 *  (가) 표의 id 낱말이 모두 물음에 들어 있다(표의 것이 더 넓은 이름이다): chair N → chair · crate:fish → crate · great stone brazier → brazier.
 *  (나) 표의 id 낱말 둘 이상이 물음과 겹친다: keg rack → ale kegs rack · broom and bucket → broom and pail · roundtable → round table.
 *  (다) 하나만 겹치되 그것이 양쪽의 끝 낱말(갈래)이다 — 영어 겹낱말은 끝 낱말이 갈래다: desk 2x1 → writing desk · fireplace → great fireplace.
 *       물음이 한 낱말이거나 크기 붙은 탁자일 때만이고, 크기 탁자는 그 낱말이 표에서 흔하지 않아야 한다(df < COMMON_DF — «X table» 전부를 권하지 않는다).
 *       여러 낱말 물음에서 갈래 낱말 하나만 겹친 것은 가깝다고 치지 않는다: gear wall ≁ weapon wall · dart board ≁ key board · book pile ≁ sack pile · water jar ≁ umbrella jar.
 *       머리·꼬리만 걸린 것(logdark ~ log, armchair ~ chair)은 물음도 표의 id 도 한 낱말일 때만.
 * 꾸밈말끼리(wall torch ~ wall map), 물음의 꾸밈말과 표의 갈래(wall torch ~ weapon wall), 물음의 갈래와 표의 꾸밈말(water jar ~ jar shelf)은 가깝지 않다.
 * 크기 붙은 탁자 id(«dining 2x1»)는 탁자다 — 낱말 table 을 갈래로 더한다. 순서는 겹친 낱말 수 → 드문 낱말일수록 무거운 점수(표에서 센 idf).
 */
export function nearIds(word: string, ids: readonly string[], max = 2): string[] {
  const own = wordsOf(word), sized = SIZED.test(word);
  const q = [...new Set([...own, ...(SIZED.test(word) ? ["table"] : [])])];
  if (!q.length || !ids.length) return [];
  const heads = new Set([own[own.length - 1], ...(SIZED.test(word) ? ["table"] : [])].filter((w): w is string => !!w));
  const toks = ids.map(wordsOf);
  const df = new Map<string, number>();
  for (const t of toks) for (const w of new Set(t)) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = (w: string) => Math.log(1 + ids.length / (df.get(w) ?? 1));
  const scored: [number, number, number][] = [];
  toks.forEach((ct, i) => {
    if (!ct.length) return;
    const hit = ct.map((c) => Math.max(...q.map((qt) => alike(qt, c))));
    const covered = hit.filter((h) => h > 0).length, exact = hit.filter((h) => h === 1).length;
    if (!covered) return;
    const last = ct[ct.length - 1]!;
    const whole = exact === ct.length;
    const two = covered >= 2 && (exact >= 1 || own.length === 1);
    const headExact = hit[ct.length - 1] === 1 && heads.has(last) && (own.length === 1 || (sized && (df.get(last) ?? 0) < COMMON_DF));
    const headPart = own.length === 1 && !sized && ct.length === 1 && hit[0]! > 0;
    if (!(whole || two || headExact || headPart)) return;
    scored.push([covered, ct.reduce((sum, c, k) => sum + hit[k]! * idf(c), 0) / Math.sqrt(ct.length), i]);
  });
  scored.sort((a, b) => b[0] - a[0] || b[1] - a[1] || a[2] - b[2]);
  const top = scored[0];
  return top ? scored.filter(([, sc]) => sc >= top[1] * 0.9).slice(0, max).map(([, , i]) => ids[i]!) : [];
}

/** 기물 id 가 표에 있나(크기 붙은 탁자 «dining 3x2» 는 표에 그 탁자 갈래가 있을 때만). */
export function knownObject(S: HandInteriorSpec, id: unknown): boolean {
  if (typeof id !== "string") return false;
  const s = SIZED.exec(id);
  return !!S.objects[id] || !!(s && S.tables[s[1]!]);
}

/** 배치에 쓰인 낱말 — 갈래마다 [낱말, 쓰인 곳]. */
export interface UsedWords {
  readonly walls: readonly (readonly [string, string])[];
  readonly floors: readonly (readonly [string, string])[];
  readonly objects: readonly string[];
}

const listed = (ids: readonly string[], n: number) => (ids.length <= n ? ids.join(", ") : `${ids.slice(0, n).join(", ")}, … (${ids.length} in the catalog card)`);

/**
 * 표에 없는 낱말 전부를 갈래마다 한 줄로(벽 · 바닥 · 기물). 없으면 빈 배열.
 * 벽·바닥은 표가 작으니 표의 id 를 같이 싣고, 기물은 가까운 id 를 붙인다. 가까운 것이 없으면 «이 표에는 그 갈래가 없다»고 말한다.
 */
export function unknownWordLines(S: HandInteriorSpec, used: UsedWords): string[] {
  const out: string[] = [];
  const material = (label: string, uses: readonly (readonly [string, string])[], table: readonly string[]) => {
    const bad = new Map<string, string[]>();
    for (const [id, where] of uses) if (!table.includes(id)) bad.set(id, [...(bad.get(id) ?? []), where]);
    if (!bad.size) return;
    const parts = [...bad].map(([id, where]) => { const near = nearIds(id, table, 2); return `"${id}" (${where.slice(0, 4).join(", ")}${where.length > 4 ? ", …" : ""})${near.length ? ` → ${near.join(" / ")}` : ""}`; });
    out.push(`${label} not in this chipset's table: ${parts.join("; ")}. The table's ${label}: ${listed(table, 14)}.`);
  };
  material("walls", used.walls, Object.keys(S.walls));
  material("floors", used.floors, Object.keys(S.floors));
  const count = new Map<string, number>();
  for (const id of used.objects) if (!knownObject(S, id)) count.set(id, (count.get(id) ?? 0) + 1);
  if (count.size) {
    const ids = Object.keys(S.objects).filter((id) => S.objects[id]!.kind !== "door" && S.objects[id]!.kind !== "sidedoor");
    const tag = (id: string, n: number) => `"${id}"${n > 1 ? ` ×${n}` : ""}`;
    const near: string[] = [], none: string[] = [];
    for (const [id, n] of count) { const hit = nearIds(id, ids, 2); if (hit.length) near.push(`${tag(id, n)} → ${hit.join(" / ")}`); else none.push(tag(id, n)); }
    out.push(`pieces not in this chipset's table${near.length ? ` (→ its nearest ids): ${near.join("; ")}` : ""}${none.length ? `${near.length ? ". N" : " — n"}o near id in this table (leave out, or pick another piece from the card): ${none.join(", ")}` : ""}.`);
  }
  return out;
}

/** 깔개(carpets) id 가 표에 없을 때의 한 줄 — 표에 사각 깔개가 아예 없으면 그렇게 말하고, 이름이 가까운 기물(깔개 기물)을 붙인다. */
export function carpetMiss(S: HandInteriorSpec, id: string): string {
  const flat = Object.keys(S.lines).filter((k) => S.lines[k]!.kind === "flat");
  if (flat.length) return `unknown carpet id "${id}" — use one of: ${flat.join(", ")}.`;
  const near = nearIds(`${id} rug`, Object.keys(S.objects), 3);
  return `carpet "${id}": this chipset has no rect carpets — drop "carpets"${near.length ? ` and place a rug piece in "objects" (${near.join(", ")})` : ""}.`;
}
