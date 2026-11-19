// project/modernCityKoreanBuildings.ts
// 한국 지구의 건물 줄 — 건물 키트를 급(tier)·유형으로 골라 벽을 맞대어 세운다. 한 맵에 같은 키트는 한 번, 이웃끼리 유형·높이가 다르게(줄의 윗선이 들쭉날쭉).
// 한국 건물 키트(mc-bld-kr-*, 태그 country:kr · tier:* · program:*)가 시트에 있으면 그것을 먼저, 없으면 나라 표시 없는 공용 키트(mc-bld-*)로 짓는다.
// 다른 나라 키트(country:west …)는 쓰지 않는다. 실내 구성(program)이 없는 키트는 풍경으로만 선다(건물 목록에 넣지 않는다).
import { MC_BUILDING_TYPES, type Board, type MCPalette } from "./modernCityBoard";
import { KR_DISTRICT_DATA, type KRMix, type KRTier } from "./modernCityDistrictKinds";

export interface KRCand { readonly id: string; readonly type: string; readonly tier: KRTier; readonly w: number; readonly h: number; readonly name: string; readonly program?: string }
export interface KRRowState { readonly counts: Map<string, number>; readonly usedKits: Set<string>; readonly wishes: string[]; /** 지금 줄(길 하나를 마주한 건물 줄)에 선 유형별 수 — 같은 키트는 맵에 한 번뿐이고, 같은 유형(색·지붕이 다른 그림)은 한 줄에 둘까지·이웃하지 않게. */ row: Map<string, number>; /** 맵에 하나뿐인 초대형·랜드마크가 이미 섰으면 그 키트 */ big?: string; /** 그 줄에서 바로 앞에 선 건물(틈·세로 길 건너도 이웃이다) */ last?: { readonly h: number; readonly type: string } }
export interface KRPlaced { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly type: string; readonly kit: string }
const isBig = (c: KRCand) => c.tier === "xlarge" || c.tier === "landmark";

export function koreanBuildingCatalog(pal: MCPalette): KRCand[] {
  const D = KR_DISTRICT_DATA, out: KRCand[] = [];
  for (const id of pal.buildingKits()) {
    const kit = pal.kit(id); if (!kit) continue;
    const tags = kit.tags ?? [];
    const country = tags.find((t) => t.startsWith("country:"));
    if (country && country !== "country:kr") continue;
    const tag = (head: string) => tags.find((t) => t.startsWith(head))?.slice(head.length);
    if (id.startsWith("mc-bld-kr-")) {
      const program = tag("program:");
      out.push({ id, type: `kr-${id.slice(10)}`, tier: (tag("tier:") as KRTier | undefined) ?? "medium", w: kit.width, h: kit.height, name: kit.name ?? id.slice(10), ...(program ? { program } : {}) });
      continue;
    }
    const m = /^mc-bld-(.+?)-[A-C](?:-.+)?$/.exec(id); if (!m) continue;
    const type = m[1]!;
    const tier = (Object.keys(D.oldTier) as KRTier[]).find((t) => D.oldTier[t]!.includes(type)); if (!tier) continue;
    const info = MC_BUILDING_TYPES[type];
    const program = info?.program ?? D.oldProgram[type];
    out.push({ id, type, tier, w: kit.width, h: kit.height, name: info?.ko ?? type, ...(program ? { program } : {}) });
  }
  return out;
}

/** [x0..x1] 에 건물을 왼쪽부터 벽을 맞대어 세운다(밑변 = y1, 문 앞 접근칸 줄 = y1+1). 놓은 건물 목록을 준다 — 남은 오른쪽 칸은 호출자가 골목 틈으로 쓴다. */
export function fillBuildingRow(b: Board, r: () => number, cat: readonly KRCand[], mix: KRMix, st: KRRowState, x0: number, x1: number, y0: number, y1: number, anchor?: readonly string[], maxCount = 99): KRPlaced[] {
  const D = KR_DISTRICT_DATA, Hs = y1 - y0 + 1, placed: KRPlaced[] = [];
  const limit = (type: string) => (D.onePerMap.includes(type) ? 1 : mix.limit ?? 3);
  let x = x0, prev: { readonly h: number; readonly type: string } | undefined = st.last;
  const usable = (c: KRCand, at: number) => c.h <= Hs && !(isBig(c) && st.big) && at + c.w - 1 <= x1 && !st.usedKits.has(c.id) && (mix.repeat || (st.row.get(c.type) ?? 0) < (mix.rowLimit ?? 2)) && (st.counts.get(c.type) ?? 0) < limit(c.type) && b.fits(c.id, at, y1 - c.h + 1, ["walk", "ground"]);
  const put = (c: KRCand) => {
    const kit = b.kit(c.id), y = y1 - c.h + 1;
    b.stamp(c.id, x, y, "bld");
    st.usedKits.add(c.id); st.counts.set(c.type, (st.counts.get(c.type) ?? 0) + 1); st.row.set(c.type, (st.row.get(c.type) ?? 0) + 1);
    if (c.program) {
      const acc = (kit.access?.length ? kit.access : [{ dx: Math.floor(kit.width / 2), dy: kit.height }]).filter((a, i, all) => all.findIndex((o) => o.dx === a.dx) === i);
      const access = acc.map((a) => ({ x: x + a.dx, y: y + a.dy }));
      for (const a of access) for (const dx of [-1, 0, 1]) for (const dy of [0, 1]) if (b.in(a.x + dx, a.y + dy)) b.keep[b.k(a.x + dx, a.y + dy)] = true;
      b.buildings.push({ name: c.name, kind: c.type, kit: c.id, rect: { x, y, w: c.w, h: c.h }, doors: access.map((a) => ({ x: a.x, y: a.y - 1 })), access, program: c.program });
    }
    if (isBig(c)) st.big = c.id;
    placed.push({ x, y, w: c.w, h: c.h, type: c.type, kit: c.id });
    x += c.w + (mix.space ?? 0); prev = c; st.last = { h: c.h, type: c.type };
  };
  // 제자리 건물(초대형·랜드마크·그 지구의 얼굴): 줄 맨 앞에 하나. 초대형·랜드마크는 맵에 하나뿐이다.
  if (anchor) for (const type of anchor) { const c = cat.filter((k) => k.type === type && usable(k, x)); if (c.length) { put(c[Math.floor(r() * c.length)]!); break; } }
  for (let guard = 0; guard < 40 && x <= x1 - 2 && placed.length < maxCount; guard++) {
    let chosen: KRCand | undefined;
    // 손님이 바란 가게 — 한국 키트 먼저, 없으면 공용 키트.
    for (let i = 0; i < st.wishes.length && !chosen; i++) {
      for (const type of D.wish[st.wishes[i]!] ?? [st.wishes[i]!]) {
        const c = cat.filter((k) => k.type === type && k.type !== prev?.type && usable(k, x));
        if (c.length) { chosen = c[Math.floor(r() * c.length)]!; st.wishes.splice(i, 1); break; }
      }
    }
    if (!chosen) {
      const rem = x1 - x + 1;
      const weight = (c: KRCand): number => {
        if ((c.type === prev?.type && !mix.repeat) || !usable(c, x)) return 0;
        if (mix.only ? !mix.only.includes(c.type) : mix.avoid?.includes(c.type)) return 0;
        let w = mix.tiers[c.tier] ?? 0; if (w <= 0) return 0;
        if (mix.prefer?.includes(c.type)) w *= 2.5;
        if (st.row.has(c.type)) w *= 0.35;                           // 그 줄에 아직 없는 유형 먼저
        if (c.type.startsWith("kr-")) w *= 3;                       // 한국 건물이 있으면 그것이 거리의 얼굴이다
        if (prev && c.h === prev.h) w *= sameH;                      // 이웃과 높이가 다르게(다른 높이 후보가 하나라도 있으면 같은 높이는 세우지 않는다)
        w *= 0.15 + 2 * (c.h / Hs) ** 2;                             // 띠 높이에 가까운 건물을 더(뒤 빈터가 깊어지지 않게)
        const left = rem - c.w - (mix.space ?? 0);
        return w * (left === 0 ? 2.5 : left > 0 && left <= 2 ? 1.5 : left <= 4 ? 0.2 : 1); // 남는 1~2칸은 골목 틈이 된다 — 3~4칸은 어정쩡하다
      };
      let sameH = 0; let ws = cat.map(weight), total = ws.reduce((a, c) => a + c, 0);
      if (total <= 0) { sameH = 0.5; ws = cat.map(weight); total = ws.reduce((a, c) => a + c, 0); }
      if (total <= 0) break;
      let t = r() * total;
      chosen = cat[ws.findIndex((w) => (t -= w) < 0)] ?? cat[ws.findIndex((w) => w > 0)]!;
    }
    put(chosen);
  }
  return placed;
}
