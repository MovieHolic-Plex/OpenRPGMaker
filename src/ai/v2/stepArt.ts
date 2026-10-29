// 청사진 단계의 «봉인·제단·결계» 칸에 보이는 그림을 세운다 — 끝맺음 clearLanes.
//
// 왜(2026-10-29 vm6 terra jrpg 판정 major «「막힌 바위」 안 보임», 감독 지시 «목표가 가리키는 대상은 그림으로»): 「동굴의 봉인」 단계가
// 동굴 입구 방 맨바닥 (12,27)의 투명 칸이었다(반짝임만). 열쇠를 들고도 판정자는 봉인이 어디인지 몰라 동굴을 30분 돌았다.
// 규칙: 버들항 바깥 맵에서 이름이 봉인·제단·결계·의식·마법진인 청사진 단계 이벤트가 모든 페이지 투명이고 그 칸에 그림이 없으면,
// 3걸음 안에 번들 「돌 제단」(2×2, 버들항 성 지하 카타콤 조각)을 세우고 이벤트를 제단 아랫줄로 옮긴다. 제단 네 칸은 빈 통행 칸·이벤트 없음이어야 하고,
// 세운 뒤 못 닿는 이벤트가 늘면 되돌린다. 새 그림은 그리지 않는다.
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { isDoorName, reachableCells, unreachableEvents } from "./eventReach";
import { isMysteryBlueprint, isProgressWord, resolveSteps } from "./mysteryCase";
import { resolveGraphic } from "@/editor/tools/eventCompile";
import { chestOpenCommands, chestOpenedGraphic } from "@/editor/lootFeedback";
import type { BuildRun } from "./types";

const ALTAR = "kit:beodeul_city/bd-pick-castle-catacombs-altar-stone";
const SEAL = /봉인|제단|결계|의식|마법진|seal|altar/iu;

const allTransparent = (ev: GameMap["events"][number]) => (ev.pages ?? []).length > 0 && (ev.pages ?? []).every((p) => {
  const g = (p.graphic ?? {}) as { transparent?: boolean; sprite?: unknown; appearanceId?: unknown; tileId?: number };
  return g.transparent === true || (!g.sprite && !g.appearanceId && !(typeof g.tileId === "number" && g.tileId > 0));
});
const upperAt = (map: GameMap, x: number, y: number) => {
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  return ["upperTiles", "upperOverlayTiles"].some((k) => (m[k]?.[y * map.width + x] ?? -1) >= 0);
};

export function dressBareSealSteps(run: BuildRun, mapId: string): string[] {
  const project0 = run.ctx.project;
  const map0 = project0.maps[mapId];
  if (!project0.gameBlueprint || !map0 || map0.tilesetId !== "beodeul_city") return [];
  if ((map0 as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor") return [];
  const notes: string[] = [];
  for (const r of resolveSteps(project0)) {
    if (r.map.id !== mapId) continue;
    const project = run.ctx.project;
    const map = project.maps[mapId]!;
    const ev = map.events.find((e) => e.id === r.ev.id);
    if (!ev || !SEAL.test(`${ev.name ?? ""} ${r.step.event}`) || !allTransparent(ev) || upperAt(map, ev.x, ev.y)) continue;
    const before = new Set(unreachableEvents(project, mapId));
    const others = new Set(map.events.filter((e) => e.id !== ev.id).map((e) => e.y * map.width + e.x));
    const cands: { tx: number; ty: number; at: { x: number; y: number }; d: number }[] = [];
    for (let ty = ev.y - 4; ty <= ev.y + 3; ty++) for (let tx = ev.x - 4; tx <= ev.x + 3; tx++) {
      if (tx < 1 || ty < 1 || tx + 1 >= map.width - 1 || ty + 1 >= map.height - 1) continue;
      const cells = [[tx, ty], [tx + 1, ty], [tx, ty + 1], [tx + 1, ty + 1]] as const;
      if (cells.some(([x, y]) => !isPassable(project, map, x, y) || upperAt(map, x, y) || others.has(y * map.width + x))) continue;
      for (const at of [{ x: tx, y: ty + 1 }, { x: tx + 1, y: ty + 1 }]) cands.push({ tx, ty, at, d: Math.abs(at.x - ev.x) + Math.abs(at.y - ev.y) });
    }
    cands.sort((a, b) => a.d - b.d || a.ty - b.ty || a.tx - b.tx);
    for (const c of cands.filter((c) => c.d <= 3).slice(0, 40)) {
      const snapshot = run.ctx.project;
      const stamped = run.call("stamp_object", { objectId: ALTAR, mapId, x: c.tx, y: c.ty });
      if (!stamped.ok) { run.ctx.project = snapshot; continue; }
      const cur = run.ctx.project.maps[mapId]!;
      const pages = (ev.pages ?? []).map((p) => ({ ...p, priority: "same", overlapForbidden: true }));
      run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: { ...cur, events: cur.events.map((e) => e.id === ev.id ? { ...e, x: c.at.x, y: c.at.y, pages: pages as typeof e.pages } : e) } } } as Project;
      if (unreachableEvents(run.ctx.project, mapId).some((id) => !before.has(id))) { run.ctx.project = snapshot; continue; }
      notes.push(`「${ev.name ?? ev.id}」 투명 칸 (${ev.x},${ev.y}) → 돌 제단 (${c.tx},${c.ty}) 위 (${c.at.x},${c.at.y})`);
      break;
    }
  }
  return notes;
}

/**
 * 연 문은 열려 보이게 — 이름이 문인 청사진 단계 이벤트(이동 없음)에서, 여는 페이지가 켜는 스위치를 조건으로 갖는 뒤 페이지(「더는 볼 것이 없다」)를
 * 투명·아래층·명령 없음으로 바꾼다. 문 그림이 사라지고 그 칸을 지나갈 수 있다.
 * 왜(2026-10-29 vm7 argon jrpg): 「동굴 열쇠로 문을 열었다」 뒤에도 쇠창살 그림이 그대로였고 다시 조사하면 「더는 볼 것이 없다」뿐이라
 * 판정자가 문을 지났는지 끝내 몰랐다(퍼즐 빌더의 열쇠 문은 이미 연 뒤 투명·아래층이다 — puzzle.ts).
 */
export function openDoorSteps(project: Project): string[] {
  if (!project.gameBlueprint) return [];
  const notes: string[] = [];
  type Page = NonNullable<GameMap["events"][number]["pages"]>[number];
  const sets = (page: Page): string[] => {
    const out: string[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (!node || typeof node !== "object") return;
      const r = node as Record<string, unknown>;
      if (r.kind === "setSwitch" && r.value !== false && typeof r.switchId === "string") out.push(r.switchId);
      Object.values(r).forEach((v) => { if (v && typeof v === "object") walk(v); });
    };
    walk(page.commands ?? []);
    return out;
  };
  const sprited = (page: Page) => { const g = (page.graphic ?? {}) as { transparent?: boolean; sprite?: unknown; tileId?: number }; return g.transparent !== true && (!!g.sprite || (typeof g.tileId === "number" && g.tileId > 0)); };
  for (const r of resolveSteps(project)) {
    const map = project.maps[r.map.id];
    const ev = map?.events.find((e) => e.id === r.ev.id);
    if (!map || !ev || !isDoorName(`${ev.name ?? ""} ${r.step.event}`) || JSON.stringify(ev.pages ?? []).includes('"transfer"')) continue;
    const pages = ev.pages ?? [];
    const opener = pages.findIndex((p) => sets(p).length > 0 && (p.conditions ?? []).length > 0);
    if (opener < 0) continue;
    const opened = new Set(sets(pages[opener]!));
    let changed = 0;
    const next = pages.map((p, i) => {
      if (i <= opener || !sprited(p)) return p;
      const after = (p.conditions ?? []).some((c) => (c as { kind?: string; switchId?: string; value?: unknown }).kind === "switch" && opened.has(String((c as { switchId?: string }).switchId)) && (c as { value?: unknown }).value !== false);
      if (!after) return p;
      const commands = (p.commands ?? []).filter((c) => !((c as { kind?: string }).kind === "text" && /^더는 볼 것이 없다\.?$/u.test(String((c as { body?: unknown }).body ?? ""))));
      changed += 1;
      const { nearSparkle: _s, ...rest } = p as Page & { nearSparkle?: unknown };
      return { ...rest, graphic: { transparent: true }, priority: "below", overlapForbidden: false, commands } as Page;
    });
    if (!changed) continue;
    map.events = map.events.map((e) => e.id === ev.id ? { ...e, pages: next } : e);
    notes.push(`「${ev.name ?? ev.id}」 연 뒤 문 그림을 걷고 지나갈 수 있게(${changed}페이지)`);
  }
  return notes;
}

/**
 * 「입구·굴·구멍」 이름의 투명 단계 칸을 맵에 그려진 굴 입구(거목 밑동 굴 문·갱구·구멍)의 «들어가는 칸»으로 옮긴다 — 그 그림 안의 걸을 수 있는 칸,
 * 좌우가 그림의 막힌 칸이면 더 좋다(문틈). 14걸음 안, 걸어 닿는 칸만, 옮긴 뒤 못 닿는 이벤트가 늘면 되돌린다.
 * 왜(2026-10-29 vm7 flash jrpg): 「동굴 입구」 단계가 숲 맵 왼쪽 위 풀밭 (6,8) 투명 칸이었고, 바로 곁 거목 밑동의 굴 문 (10,12)은
 * 판정자가 「들어갈 수 있는 입구처럼 보이는데 여러 방향에서 걷고 조사해도 반응이 없다」고 했다.
 */
const ENTRANCE_NAME = /입구|동굴|굴|구멍|hollow|entrance|mouth|cave/iu;
const ENTRANCE_ART = /굴\s?문|굴\s?입구|갱구|구멍|동굴\s?입구|hollow|adit|cave mouth|cave entrance/iu;
export function seatEntranceSteps(run: BuildRun, mapId: string): string[] {
  const project0 = run.ctx.project;
  const map0 = project0.maps[mapId];
  if (!project0.gameBlueprint || !map0) return [];
  const meta = (project0.tilesets[map0.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
  const m = map0 as unknown as Record<string, ArrayLike<number> | undefined>;
  const art = (x: number, y: number) => x >= 0 && y >= 0 && x < map0.width && y < map0.height
    && ["lowerOverlayTiles", "upperTiles", "upperOverlayTiles"].some((k) => { const t = m[k]?.[y * map0.width + x]; return typeof t === "number" && t >= 0 && ENTRANCE_ART.test(String(meta[t]?.label ?? "")); });
  const doorways: { x: number; y: number; gap: boolean }[] = [];
  for (let y = 0; y < map0.height; y++) for (let x = 0; x < map0.width; x++) {
    if (!art(x, y) || !isPassable(project0, map0, x, y)) continue;
    const gap = art(x - 1, y) && art(x + 1, y) && !isPassable(project0, map0, x - 1, y) && !isPassable(project0, map0, x + 1, y);
    // 그림 칸 가운데 걸을 수 있는 칸은 밑동·입구 틈이거나, 키 큰 그림의 윗부분(머리 위로 지나가는 칸)이다 — 아래 칸이 그림 밖이거나 틈일 때만 입구로 친다.
    if (!gap && art(x, y + 1)) continue;
    doorways.push({ x, y, gap });
  }
  if (!doorways.length) return [];
  const notes: string[] = [];
  for (const r of resolveSteps(project0)) {
    if (r.map.id !== mapId) continue;
    const project = run.ctx.project;
    const map = project.maps[mapId]!;
    const ev = map.events.find((e) => e.id === r.ev.id);
    if (!ev || !ENTRANCE_NAME.test(`${ev.name ?? ""} ${r.step.event}`) || !allTransparent(ev) || JSON.stringify(ev.pages ?? []).includes('"transfer"')) continue;
    if (doorways.some((d) => d.x === ev.x && d.y === ev.y)) continue;
    const before = new Set(unreachableEvents(project, mapId));
    const others = new Set(map.events.filter((e) => e.id !== ev.id).map((e) => `${e.x},${e.y}`));
    const cands = doorways.filter((d) => !others.has(`${d.x},${d.y}`) && Math.abs(d.x - ev.x) + Math.abs(d.y - ev.y) <= 14)
      .sort((a, b) => Number(b.gap) - Number(a.gap) || (Math.abs(a.x - ev.x) + Math.abs(a.y - ev.y)) - (Math.abs(b.x - ev.x) + Math.abs(b.y - ev.y)));
    for (const d of cands) {
      const snapshot = run.ctx.project;
      run.ctx.project = { ...snapshot, maps: { ...snapshot.maps, [mapId]: { ...map, events: map.events.map((e) => e.id === ev.id ? { ...e, x: d.x, y: d.y } : e) } } } as Project;
      if (unreachableEvents(run.ctx.project, mapId).some((id) => !before.has(id))) { run.ctx.project = snapshot; continue; }
      notes.push(`「${ev.name ?? ev.id}」 투명 칸 (${ev.x},${ev.y}) → 굴 입구 그림의 들어가는 칸 (${d.x},${d.y})`);
      break;
    }
  }
  return notes;
}

/**
 * 물건을 얻는 투명 단계 칸(「용사의 검」 — 맨바닥 반짝임뿐)을 보물상자로 세운다: 여는 페이지까지는 닫힌 상자(여는 페이지 앞에 뚜껑 여는 연출),
 * 그 뒤 페이지는 열린 상자. 그림 위(가구·소품) 조사 칸·사람·문·봉인·입구·이동 칸·추리 게임은 건드리지 않는다. 상자가 길을 막으면 2칸 안 다른 칸으로,
 * 그래도 막으면 두지 않는다.
 * 왜(2026-10-29 vm7 terra jrpg): 목표가 「마을에서 용사의 검을 얻는다」로 바뀐 뒤, 검은 촌장 바로 옆 길 위 투명 칸 (2,33)이었다.
 * 판정자는 ▼ 표식을 「뜻 모를 화살표」로 보고 어느 건물에 검이 있는지 찾아 마을을 30분 돌았다.
 */
const PICKUP_ACTION = /얻|손에 넣|줍|주워|챙기|획득|가져|찾아/u;
const NOT_PICKUP = /봉인|제단|결계|의식|마법진|입구|동굴|굴|구멍|문|출구|seal|altar|door|gate|entrance/iu;
export function dressPickupSteps(run: BuildRun, mapId: string): string[] {
  const project0 = run.ctx.project;
  const map0 = project0.maps[mapId];
  if (!project0.gameBlueprint || !map0 || isMysteryBlueprint(project0)) return [];
  const notes: string[] = [];
  for (const r of resolveSteps(project0)) {
    if (r.map.id !== mapId || !PICKUP_ACTION.test(r.step.action) || !r.step.gives || isProgressWord(r.step.gives) || /엔딩|ending/iu.test(r.step.gives)) continue;
    const project = run.ctx.project;
    const map = project.maps[mapId]!;
    const ev = map.events.find((e) => e.id === r.ev.id);
    if (!ev || NOT_PICKUP.test(`${ev.name ?? ""} ${r.step.event}`) || !allTransparent(ev) || upperAt(map, ev.x, ev.y)) continue;
    const text = JSON.stringify(ev.pages ?? []);
    if (/"kind":"(?:transfer|battleProcessing|showChoices|choices|presentItem|shop)"/u.test(text) || /"speaker"/u.test(text)) continue;
    const pages = ev.pages ?? [];
    const sets = (p: typeof pages[number]) => (JSON.stringify(p.commands ?? []).match(/"kind":"setSwitch","switchId":"([^"]+)","value":true/gu) ?? []).map((s) => s.replace(/^.*"switchId":"([^"]+)".*$/u, "$1"));
    const opener = pages.findIndex((p) => sets(p).length > 0 || JSON.stringify(p.commands ?? []).includes('"changeItem"'));
    if (opener < 0) continue;
    const opened = new Set(sets(pages[opener]!));
    const closed = resolveGraphic({ query: "보물상자" }, { overrides: project.charsetLabels });
    const open = chestOpenedGraphic(closed);
    const next = pages.map((p, i) => {
      const after = i > opener && (p.conditions ?? []).some((c) => (c as { kind?: string }).kind === "switch" && opened.has(String((c as { switchId?: string }).switchId)));
      const commands = i === opener ? [...chestOpenCommands(ev.id, closed), ...(p.commands ?? [])] : (p.commands ?? []);
      return { ...p, graphic: after ? open : closed, priority: "same", overlapForbidden: true, animationType: "fixedGraphic", commands } as typeof p;
    });
    const reach0 = reachableCells(project, map);
    const count = (a: Uint8Array | undefined) => (a ? a.reduce((n, v) => n + (v ? 1 : 0), 0) : 0);
    const before = new Set(unreachableEvents(project, mapId));
    const taken = new Set(map.events.filter((e) => e.id !== ev.id).map((e) => `${e.x},${e.y}`));
    const spots = [{ x: ev.x, y: ev.y }];
    for (let d = 1; d <= 2; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (Math.abs(dx) + Math.abs(dy) === d) spots.push({ x: ev.x + dx, y: ev.y + dy });
    for (const s of spots) {
      if (s.x < 1 || s.y < 1 || s.x >= map.width - 1 || s.y >= map.height - 1 || taken.has(`${s.x},${s.y}`) || !isPassable(project, map, s.x, s.y) || upperAt(map, s.x, s.y)) continue;
      const snapshot = run.ctx.project;
      const moved = { ...map, events: map.events.map((e) => e.id === ev.id ? { ...e, x: s.x, y: s.y, pages: next } : e) };
      run.ctx.project = { ...snapshot, maps: { ...snapshot.maps, [mapId]: moved } } as Project;
      // 상자는 막는 칸이다 — 그 칸 하나 말고는 걸어 닿던 칸이 줄면 안 되고, 못 닿는 이벤트도 늘면 안 된다.
      const lost = count(reach0) - count(reachableCells(run.ctx.project, moved));
      if (lost > 1 || unreachableEvents(run.ctx.project, mapId).some((id) => !before.has(id))) { run.ctx.project = snapshot; continue; }
      notes.push(`「${ev.name ?? ev.id}」 투명 칸 (${ev.x},${ev.y}) → 보물상자 (${s.x},${s.y})`);
      break;
    }
  }
  return notes;
}
