// Every placed life prop needs a reason next to it (FILL-RULES 3차 판정, 2026-09-24: 「뜬금없는 소재가 뜬금없는 곳에
// 있는 건 싫다」). A prop is owned when, within two cells, there is the thing it serves — a house, a farm plot, the
// well, the dock, the water it fishes, a working centre (fire, stall, arch, work table) — or, for roadside pieces
// (signs, lanterns, benches, mailboxes, notice boards), a road beside it. A tight group (pieces one cell apart) is
// owned when any piece of it is. Unowned props are removed, with their civic items, use cells and dependents.
const distance = (a, b) => Math.max(0, a.x - b.x - (b.w ?? 1) + 1, b.x - a.x - (a.w ?? 1) + 1) + Math.max(0, a.y - b.y - (b.h ?? 1) + 1, b.y - a.y - (a.h ?? 1) + 1);
const CENTRES = new Set(["낮은 돌 우물", "모닥불", "장터 노점", "덩굴 아치", "가로 탁자", "돌 오벨리스크"]);
const ROADSIDE = new Set(["표지판", "나무 이정표", "게시판", "우편함"]);
const SEATS = new Set(["벤치"]);
const LIGHTS = new Set(["돌등"]);
const WATERSIDE = new Set(["낚시 바구니"]);

/** Why each life prop is (or is not) where it is. Returns { owned: Map(prop → reason), unowned: [prop] }. */
export function propOwnership({ map, plan, roads, water }) {
  const W = map.width, props = plan.placements.filter((o) => o.kind === "prop" || o.kind === "civic-prop");
  const near = (o, cells, r) => {
    for (let y = o.y - r; y < o.y + (o.h ?? 1) + r; y++) for (let x = o.x - r; x < o.x + (o.w ?? 1) + r; x++)
      if (x >= 0 && y >= 0 && x < W && y < map.height && cells.has(y * W + x)) return true;
    return false;
  };
  const houses = plan.houses, farms = [...plan.placements.filter((o) => o.kind === "farm" || o.name === "채소밭")];
  const landmarks = plan.landmarks ?? [];
  const dock = plan.dock ? [{ x: plan.dock[0], y: plan.dock[1], w: plan.dock[2], h: plan.dock[3] }] : [];
  const within = (o, list, r) => list.some((q) => q !== o && distance(o, q) <= r);
  const owned = new Map();
  const base = (o) => {
    if (o.name === "벽걸이 등불") return houses.some((h) => distance(o, h) === 0) && "집 벽";
    if (o.name === "허수아비") return within(o, farms, 1) && "밭";
    // A notice board also belongs to the stall or well it announces for.
    if (ROADSIDE.has(o.name)) return (near(o, roads, 1) && "길가") || (o.name === "게시판" && within(o, props.filter((q) => CENTRES.has(q.name) && q.name !== "가로 탁자"), 2) && "장터");
    // A bench by a road alone is still a bench alone on the lawn (review 2026-09-24): it needs a place to sit at — a
    // well, campfire, stall or arch, the water's edge, or a landmark.
    if (SEATS.has(o.name)) return (within(o, props.filter((q) => CENTRES.has(q.name) && q.name !== "가로 탁자"), 2) && "쉼터") || (near(o, water, 1) && "물가") || (within(o, landmarks, 2) && "랜드마크");
    if (LIGHTS.has(o.name)) return (near(o, roads, 1) && "길가") || (within(o, props.filter((q) => q.name === "낮은 돌 우물"), 2) && "우물") || (within(o, landmarks, 2) && "랜드마크");
    if (WATERSIDE.has(o.name)) return (near(o, water, 2) && "물가") || (within(o, dock, 2) && "부두");
    if (CENTRES.has(o.name)) return (near(o, roads, 3) || within(o, houses, 3)) && "마을 안";
    return (within(o, houses, 2) && "집") || (within(o, farms, 2) && "밭") || (within(o, dock, 2) && "부두")
      || (within(o, landmarks, 2) && "랜드마크") || (within(o, props.filter((q) => CENTRES.has(q.name)), 2) && "작업터");
  };
  for (const o of props) { const r = base(o); if (r) owned.set(o, r); }
  // Tight groups: a piece within two cells of an owned piece of the same owner/zone is owned by it — a yard kit is laid
  // with one-cell gaps (except roadside pieces and seats, which need their own road or centre).
  for (let changed = true; changed;) {
    changed = false;
    for (const o of props) {
      if (owned.has(o) || ROADSIDE.has(o.name) || SEATS.has(o.name) || o.name === "허수아비") continue;
      const mate = props.find((q) => owned.has(q) && distance(o, q) <= 2 && ((o.ownerId && q.ownerId === o.ownerId) || (o.placeId && q.placeId === o.placeId)));
      if (mate) { owned.set(o, "묶음(" + mate.name + ")"); changed = true; }
    }
  }
  return { owned, unowned: props.filter((o) => !owned.has(o)) };
}

/** Remove unowned props (and whatever depends on them) from the map and the plan. Returns the removed props. */
export function pruneUnowned({ map, plan, roads, water, inspect = () => [] }) {
  const removed = [];
  const DEPENDENT = new Set(["prop-purpose-anchor-missing", "scarecrow-without-garden", "civic-anchor-missing"]);
  for (;;) {
    const { unowned } = propOwnership({ map, plan, roads, water });
    // A piece whose purpose anchor (another piece) is gone goes too — found by the catalog's own checks.
    if (!unowned.length) for (const e of inspect()) if (DEPENDENT.has(e.code)) {
      const o = plan.placements.find((q) => (q.kind === "prop" || q.kind === "civic-prop") && e.x >= q.x && e.x < q.x + q.w && e.y >= q.y && e.y < q.y + q.h);
      if (o && !unowned.includes(o)) unowned.push(o);
    }
    // A civic piece whose `near` partner is gone goes too (the civic check requires the partner).
    const civic = plan.placements.filter((o) => o.kind === "civic-prop");
    const orphaned = civic.filter((o) => !unowned.includes(o) && o.near && !civic.some((q) => q !== o && !unowned.includes(q) && q.placeId === o.placeId && q.name === o.near));
    const gone = [...unowned, ...orphaned];
    if (!gone.length) break;
    for (const o of gone) {
      for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) map.upperTiles[y * map.width + x] = -1;
      if (Array.isArray(o.lower)) for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) map.lowerTiles[y * map.width + x] = 240;
      removed.push({ name: o.name, kind: o.kind, x: o.x, y: o.y, owner: o.ownerId ?? o.placeId ?? null });
    }
    const goneSet = new Set(gone);
    plan.placements = plan.placements.filter((o) => !goneSet.has(o));
    for (const z of plan.civicPlaces ?? []) z.items = z.items.filter((i) => !gone.some((o) => o.kind === "civic-prop" && o.placeId === z.id && o.id === i.id));
    plan.access = plan.access.filter((a) => !(a.role === "civic-use" && gone.some((o) => o.id && o.id === a.propId)));
  }
  // Yards whose every prop is gone are no longer yards.
  if (plan.yards) plan.yards = plan.yards.filter((y) => plan.placements.some((o) => o.kind === "prop" && o.ownerId === y.ownerId));
  return removed;
}
