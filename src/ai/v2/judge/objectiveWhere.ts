// 목표 글 꼬리의 「어디」 — 방위 낱말·랜드마크·출구·다음 맵 구간으로 대상 자리를 말로 만든다(whereHint · withWhere).
import type { GameMap, Project } from "@/project/types";
import { mapRoute } from "@/player/objectiveTarget";

/** 맵을 3×3 으로 나눈 방위(「북서쪽」 「가운데」 …). 플레이어 자리와 무관하게 늘 맞는 「어디」다. */
export function mapRegion(map: GameMap, x: number, y: number): string {
  const col = Math.min(2, Math.floor((x * 3) / Math.max(1, map.width)));
  const row = Math.min(2, Math.floor((y * 3) / Math.max(1, map.height)));
  const names = [["북서쪽", "북쪽", "북동쪽"], ["서쪽", "가운데", "동쪽"], ["남서쪽", "남쪽", "남동쪽"]] as const;
  return names[row]![col]!;
}

export function transferTargets(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) { for (const item of value) transferTargets(item, out); return; }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.kind === "transfer" && typeof record.mapId === "string") out.add(record.mapId);
  for (const child of Object.values(record)) if (child && typeof child === "object") transferTargets(child, out);
}

export type Cell = { readonly x: number; readonly y: number };

const BEARINGS = ["동쪽", "남동쪽", "남쪽", "남서쪽", "서쪽", "북서쪽", "북쪽", "북동쪽"] as const;

/**
 * origin 에서 본 to 의 방위(8방). 2칸 안이면 「바로 옆」.
 * 왜(2026-10-29 vm2 terra jrpg): 맵을 3×3 으로 나눈 방위는 「서쪽」 띠에 선 문을 「서쪽」이라 불렀는데, 플레이어는 이미 맵 서쪽 끝(1,4)에 있었고
 * 문은 같은 줄 26칸 남쪽(1,30)이었다 — 판정자가 「목표의 서쪽은 이미 맵 끝」이라며 길을 못 찾았다. 목표가 걸리는 자리에서 본 방위를 쓴다.
 */
export function bearingWord(origin: Cell, to: Cell): string {
  const dx = to.x - origin.x, dy = to.y - origin.y;
  if (Math.abs(dx) + Math.abs(dy) <= 2) return "바로 옆";
  return BEARINGS[(((Math.round(Math.atan2(dy, dx) / (Math.PI / 4))) % 8) + 8) % 8]!;
}

/**
 * 출구 자리를 맵에 붙박인 말로 — 가장자리(두 칸 안)면 「서쪽 끝 가운데」「북쪽 끝 동쪽 편」「남서쪽 구석」, 아니면 맵 3×3 방위(「북쪽」).
 * 걸어 다니는 동안에도 같은 뜻이고(목표 줄은 한 번 걸리면 플레이어가 움직여도 그대로다), 사람이 맵 전체를 놓고 읽는 말이다.
 * 왜(2026-10-29 vm7 argon jrpg): 촌장 자리에서 본 8방 「남서쪽」은 마을 서쪽 끝 가운데 (0,21) 길 끝이었는데, 판정자는 맵의 남서쪽 구석 숲을
 * 30분 가까이 헤맸다. flash jrpg: 촌장에서 본 「동쪽」은 마을 북쪽 한가운데 (28,5)였고 판정자는 동쪽 끝을 찾다 막혔다.
 * vm2 terra(서쪽 끝에 선 플레이어에게 「서쪽」)는 가장자리 말 「서쪽 끝 남쪽 편」이 푼다.
 */
function placeWord(map: GameMap, x: number, y: number): string {
  const w = Math.max(1, map.width), h = Math.max(1, map.height);
  const west = x <= 1, east = x >= w - 2, north = y <= 1, south = y >= h - 2;
  if ((west || east) && (north || south)) return `${north ? "북" : "남"}${west ? "서" : "동"}쪽 구석`;
  const third = (v: number, n: number) => Math.min(2, Math.floor((v * 3) / n));
  if (west || east) {
    const along = ["북쪽 편", "가운데", "남쪽 편"][third(y, h)]!;
    return `${west ? "서쪽" : "동쪽"} 끝 ${along}`;
  }
  if (north || south) {
    const along = ["서쪽 편", "가운데", "동쪽 편"][third(x, w)]!;
    return `${north ? "북쪽" : "남쪽"} 끝 ${along}`;
  }
  return mapRegion(map, x, y);
}

/**
 * 맵 안 한 칸을 눈에 띄는 것에 기대어 부르는 말 — 「회복의 샘 서쪽」「「떠돌이 상인」 옆」「처음 선 자리 북쪽」, 없으면 placeWord.
 * 기댈 것: 그림이 보이는 이름 있는 이벤트(사람·물건, 단계 대상 자신·막힌 길 표지·잠긴 집 문 제외), 회복의 샘·상인·쉼터 결정(이름 없는 기본 id), 시작 자리.
 * 6칸 안 가장 가까운 것. 2칸 안이면 「옆」.
 * 왜(2026-10-29 vm8 flash jrpg): 동굴 문은 「동굴 열쇠가 있어야 한다」만 말했고, 열쇠는 처음 선 자리 곁 회복의 샘 옆 (7,11)이었다 —
 * 판정자는 마을을 30분 가까이 돌았다. 「서쪽」 같은 방위 한 낱말로는 못 찾는다.
 */
export function landmarkWord(project: Project, map: GameMap, x: number, y: number, exceptId?: string | readonly string[]): string {
  const except = new Set(typeof exceptId === "string" ? [exceptId] : exceptId ?? []);
  const KNOWN: Record<string, string> = { ev_heal_spring: "회복의 샘", ev_supply_shop: "떠돌이 상인" };
  const cands: { name: string; x: number; y: number; quote: boolean }[] = [];
  for (const ev of map.events ?? []) {
    if (except.has(ev.id) || /^ev_(dead_end|locked_door|objective|world_gate)/u.test(ev.id) || ev.id.includes("__")) continue;
    // 보스 앞 「쉼터 결정」(ensureBossRest·던전 빌더 `ev_<맵>_rest`)은 이름 없이 저장되기도 하지만 빛나는 결정이라 눈에 잘 띈다.
    const known = KNOWN[ev.id] ?? (/^ev_.+_rest$/u.test(ev.id) ? "쉼터 결정" : undefined);
    const name = known ?? String((ev as { name?: string }).name ?? "").trim();
    if (!name || /^ev_/u.test(name)) continue;
    const g = ((ev.pages ?? [])[0]?.graphic ?? {}) as { transparent?: boolean; sprite?: unknown; appearanceId?: unknown };
    if (!known && (g.transparent === true || !(g.sprite || g.appearanceId))) continue;
    cands.push({ name, x: ev.x, y: ev.y, quote: !known });
  }
  const start = project as unknown as { startMapId?: string; startPos?: { x: number; y: number } };
  if (start.startMapId === map.id && start.startPos) cands.push({ name: "처음 선 자리", x: start.startPos.x, y: start.startPos.y, quote: false });
  const dist = (c: { x: number; y: number }) => Math.abs(c.x - x) + Math.abs(c.y - y);
  const best = cands.filter((c) => dist(c) <= 6).sort((a, b) => dist(a) - dist(b))[0];
  if (!best) return placeWord(map, x, y);
  const label = best.quote ? `「${best.name}」` : best.name;
  return dist(best) <= 2 ? `${label} 옆` : `${label} ${bearingWord(best, { x, y })}`;
}

/** 출구 자리 말 — 2칸 안이면 「바로 옆」, 아니면 맵에 붙박인 말(placeWord). */
function exitWord(map: GameMap, origin: Cell | undefined, gate: Cell): string {
  if (origin && Math.abs(gate.x - origin.x) + Math.abs(gate.y - origin.y) <= 2) return "바로 옆";
  return placeWord(map, gate.x, gate.y);
}

/** from 맵에서 to 맵으로 바로 가는 문(옮기기 이벤트) 자리들. */
function gatesTo(from: GameMap, toMapId: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const event of from.events ?? []) {
    const targets = new Set<string>();
    transferTargets(event.pages ?? [], targets);
    if (targets.has(toMapId)) out.push({ x: event.x, y: event.y });
  }
  return out;
}

export const bare = (text: string) => text.replace(/[\s「」『』"'·]/gu, "");

/** 글에 이름이 나온 다른 맵들(긴 이름 먼저, 겹치는 짧은 이름은 뺀다). */
function namedMaps(project: Project, text: string, except: string): GameMap[] {
  const plain = bare(text);
  const maps = Object.values(project.maps).filter((map) => map.id !== except && map.name && bare(map.name).length >= 2 && plain.includes(bare(map.name)));
  return maps.filter((map) => !maps.some((other) => other !== map && bare(other.name!).includes(bare(map.name!)) && bare(other.name!).length > bare(map.name!).length));
}

/**
 * 「어디」 한 줄 — 목표가 걸리는 맵(from)에서 본 자리. 같은 맵의 대상은 그 맵의 방위, 다른 맵은 거기로 가는 문의 방위.
 * 새 플레이어가 「지하철역」이 어디인지 몰라 2일차에 멈췄다(2026-10-27 romance-j91 J105).
 */
/**
 * 같은 줄에 다른 곳으로 가는 문이 나란히 있으면 그 가운데 몇째인지 — 「 · 문 셋 중 왼쪽」.
 * 왜(2026-10-29 vm3 deepseek 방탈출 판정): 현관 홀 남쪽 벽에 응접실·서재·지하실 문이 3칸 간격으로 붙어 있었는데 목표는 「응접실 입구: 남동쪽」뿐이라
 * 판정자가 응접실 문을 끝내 고르지 못했다.
 */
function siblingOrdinal(project: Project, from: GameMap, gate: { x: number; y: number }, hopId: string): string {
  const others: { x: number; y: number; to: string }[] = [];
  for (const map of Object.values(project.maps)) {
    if (map.id === from.id) continue;
    const cells = gatesTo(from, map.id);
    if (!cells.length) continue;
    const pick = [...cells].sort((a, b) => Math.abs(a.x - gate.x) + Math.abs(a.y - gate.y) - (Math.abs(b.x - gate.x) + Math.abs(b.y - gate.y)))[0]!;
    others.push({ ...pick, to: map.id });
  }
  const row = others.filter((o) => Math.abs(o.y - gate.y) <= 1 && Math.abs(o.x - gate.x) <= 8);
  const col = others.filter((o) => Math.abs(o.x - gate.x) <= 1 && Math.abs(o.y - gate.y) <= 8);
  const line = row.length >= col.length ? row : col;
  if (line.length < 2 || !line.some((o) => o.to === hopId)) return "";
  const horizontal = line === row;
  line.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
  const k = line.findIndex((o) => o.to === hopId);
  const n = line.length;
  const COUNT = ["", "", "둘", "셋", "넷", "다섯"];
  const [first, last] = horizontal ? ["왼쪽", "오른쪽"] : ["위쪽", "아래쪽"];
  const pos = k === 0 ? first : k === n - 1 ? last : n === 3 ? "가운데" : `${first}에서 ${k + 1}번째`;
  return ` · 문 ${COUNT[n] ?? n} 중 ${pos}`;
}

export function whereHint(project: Project, fromMapId: string, target: { mapId: string; x?: number; y?: number; label?: string }, origin?: Cell): string | undefined {
  const from = project.maps[fromMapId];
  const to = project.maps[target.mapId];
  if (!from || !to) return undefined;
  // 같은 맵: 이벤트 이름만(「책장」) — 자리는 조사 칸 반짝이·목표 화살표가 가리킨다. 「(책장: 잠긴 서재 가운데)」 처럼 지금 서 있는 맵 이름과
  // 방위까지 붙이면 개발 메모처럼 읽히고 목표 칩이 4~5줄로 접혔다(2026-10-29 VQA 트리아지 B, 12건). 이름이 없으면 방위 한 낱말.
  if (to.id === from.id) {
    if (target.x === undefined || target.y === undefined) return undefined;
    return target.label?.trim() || (origin ? bearingWord(origin, { x: target.x, y: target.y }) : mapRegion(from, target.x, target.y));
  }
  // 다른 맵: 지금 맵에서 «첫 출구»의 방위(지금 맵 이름은 빼고) — 새 플레이어가 「지하철역」 이 어디인지 몰라 멈춘 것(J105)은 이것으로 푼다.
  // 바로 가는 문이 없으면 맵 경로의 첫 맵으로 가는 문을 가리키고 목적지를 「→」 뒤에 적는다(2026-10-29 vm2 flash jrpg: 숲에서 동굴로 가는 문은
  // 없고 마을을 거쳐야 하는데 목표는 「마왕의 동굴」만 말해 숲 안에서 동굴 입구를 찾다 막혔다). 대상 이벤트 이름도 「→」 뒤에 붙여,
  // 그 맵에 들어선 뒤 런타임 목표 표시(src/player/objectiveTarget)가 그 이벤트를 짚게 한다.
  const route = mapRoute(project, from.id, to.id);
  const hop = route?.[1] ? project.maps[route[1]] : undefined;
  if (!hop) return undefined;
  const gates = gatesTo(from, hop.id);
  if (gates.length === 0) return undefined;
  const near = origin ? [...gates].sort((a, b) => Math.abs(a.x - origin.x) + Math.abs(a.y - origin.y) - (Math.abs(b.x - origin.x) + Math.abs(b.y - origin.y)))[0]! : undefined;
  const dir0 = near ? exitWord(from, origin, near) : [...new Set(gates.map((gate) => placeWord(from, gate.x, gate.y)))].slice(0, 2).join("·");
  const dir = `${dir0}${siblingOrdinal(project, from, near ?? gates[0]!, hop.id)}`;
  const label = target.label?.trim();
  if (hop.id === to.id) return `${to.name ?? to.id} 입구: ${dir}${label ? ` → ${label}` : ""}`;
  // 거쳐 가는 맵 안에서 다음 문의 방위도 적는다 — 그 맵에 들어선 뒤에도 같은 꼬리가 보이므로, 앞 맵의 방위(「남쪽」)만 남으면 거기서도 남쪽으로 간다.
  // 왜(2026-10-29 vm3 flash 추리 BLOCKER): 객실 목표 「여관 로비 입구: 남쪽 → 여관 뒤뜰」을 로비에서도 따라 로비 남쪽 끝(8,13)에서 막혔다 — 뒤뜰 문은 로비 서쪽(1,7)이었다.
  const next = route?.[2] ? nextLeg(project, from, near ?? gates[0]!, hop, route[2]) : undefined;
  return `${hop.name ?? hop.id} 입구: ${dir} → ${next ? `${hop.name ?? hop.id}에서 ${next} → ` : ""}${to.name ?? to.id}${label ? ` · ${label}` : ""}`;
}

/** from 의 gate 로 hop 에 들어선 자리(옮기기 착지)에서 본, hop 에서 then 으로 가는 문의 방위(+ 나란한 문 가운데 몇째). */
function nextLeg(project: Project, from: GameMap, gate: Cell, hop: GameMap, then: string): string | undefined {
  const gates = gatesTo(hop, then);
  if (!gates.length) return undefined;
  const event = (from.events ?? []).find((e) => e.x === gate.x && e.y === gate.y);
  let landing: Cell | undefined;
  const find = (value: unknown): void => {
    if (landing || !value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(find); return; }
    const r = value as Record<string, unknown>;
    if (r.kind === "transfer" && r.mapId === hop.id && typeof r.x === "number" && typeof r.y === "number") { landing = { x: r.x, y: r.y }; return; }
    Object.values(r).forEach(find);
  };
  find(event?.pages ?? []);
  const near = landing ? [...gates].sort((a, b) => Math.abs(a.x - landing!.x) + Math.abs(a.y - landing!.y) - (Math.abs(b.x - landing!.x) + Math.abs(b.y - landing!.y)))[0]! : gates[0]!;
  const dir = exitWord(hop, landing, near);
  return `${dir}${siblingOrdinal(project, hop, near, then)}`;
}

/** 글에 이름이 나온 이벤트(두 글자 이상, 긴 이름 먼저, 목표 맵의 것 먼저). 출입구·자동 실행 목표 이벤트는 뺀다. */
function namedEvent(project: Project, text: string, fromMapId: string): { mapId: string; x: number; y: number; label: string } | undefined {
  const plain = bare(text);
  const found: { mapId: string; x: number; y: number; label: string; len: number; here: boolean }[] = [];
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    const name = String(event.name ?? "");
    if (bare(name).length < 2 || event.id.startsWith("ev_objective") || event.id.startsWith("ev_gate_")) continue;
    if (plain.includes(bare(name))) found.push({ mapId: map.id, x: event.x, y: event.y, label: name, len: bare(name).length, here: map.id === fromMapId });
  }
  found.sort((a, b) => Number(b.here) - Number(a.here) || b.len - a.len);
  const best = found[0];
  return best ? { mapId: best.mapId, x: best.x, y: best.y, label: best.label } : undefined;
}

/** 목표 글에 「어디」를 붙인다 — where(이벤트·맵 이름/id)를 주거나, 글에 다른 맵 이름이 나오면 그 맵으로 가는 문의 방위를 붙인다. */
export function withWhere(project: Project, fromMapId: string, text: string, where?: string, origin?: Cell): string {
  const hints: string[] = [];
  if (where) {
    for (const map of Object.values(project.maps)) {
      const event = (map.events ?? []).find((candidate) => candidate.id === where || candidate.name === where);
      if (event) {
        const hint = whereHint(project, fromMapId, { mapId: map.id, x: event.x, y: event.y, ...(event.name ? { label: event.name } : {}) }, origin);
        if (hint) hints.push(hint);
        break;
      }
      if (map.id === where || map.name === where) {
        const hint = whereHint(project, fromMapId, { mapId: map.id }, origin);
        if (hint) hints.push(hint);
        break;
      }
    }
  }
  // 글에 나온 두 장소 중 하나가 다른 하나로 가는 길 위에 있으면 길 위의 곳만 — 「1번길 풀숲에서 잡고 새순 마을로 가자」 에
  // 두 꼬리가 같은 첫 출구를 되풀이해 「(… → 새순 마을 / … → 1번길)」 여섯 줄 창이 됐다(2026-10-29 standin monster 연구소).
  const mentioned = namedMaps(project, text, fromMapId);
  const onTheWay = (map: GameMap) => mentioned.some((other) => other !== map && (mapRoute(project, fromMapId, map.id) ?? []).slice(1, -1).includes(other.id));
  const places = mentioned.length > 1 ? mentioned.filter((map) => !onTheWay(map)) : mentioned;
  if (hints.length === 0) for (const map of places.length ? places : mentioned) {
    const hint = whereHint(project, fromMapId, { mapId: map.id }, origin);
    if (hint) hints.push(hint);
    if (hints.length >= 2) break;
  }
  // 글에 이벤트 이름(「책장」)만 나오면 그 이벤트 자리 — 같은 맵이면 방위, 다른 맵이면 그 맵 입구(2026-10-28 mt3 argon escape:
  // 「책장 주변에서 두 번째 단서를 찾자」 에 어디가 안 붙어 판정자가 「조사할 위치를 잡는 데 헤맸다」).
  if (hints.length === 0) {
    const named = namedEvent(project, text, fromMapId);
    if (named) { const hint = whereHint(project, fromMapId, named, origin); if (hint) hints.push(hint); }
  }
  const extra = hints.filter((hint) => !text.includes(hint));
  return extra.length ? `${text} (${extra.join(" / ")})` : text;
}
