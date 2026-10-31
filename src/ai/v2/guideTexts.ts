// 안내 글이 실제 자리와 맞는가 — 목표 줄의 보이지 않는 대상에 기댈 곳을 붙이고, 사람 대사의 「누가 어디에서」를 실제 자리로 고친다(끝맺음 lanes, 맵마다).
//
// 왜(2026-10-30 회귀 ebfe-sl):
//  - sl1 terra jrpg: 목표 「마왕에게 맞설 보급품을 챙긴다 (용사의 보급품)」 — 「용사의 보급품」은 회복의 샘 남서쪽 (8,6)의 그림 없는 조사 칸이었다.
//    같은 맵 대상은 이름만 적는 규칙(whereHint)이라 어디인지가 없었고, 판정자는 마을을 다 돌고도 못 찾았다(«얻는 곳 안내 없음»).
//  - sl3 opus jrpg: 대장장이 대사 「촌장님이 광장에서 널 찾던데」 — 촌장은 광장이 아니라 대장간 남쪽 (19,29)에 서 있었다. 판정자는 광장들을 돌았다.
// 규칙:
//  1) 목표 줄(objectiveChip) 글 끝의 「(이름)」이 그 목표를 거는 맵의 이벤트 이름이고 그 이벤트에 보이는 그림이 없으면
//     「(이름: 기댈 곳)」으로 바꾼다(landmarkWord — 회복의 샘·상인·그림 있는 이름 이벤트·처음 선 자리, 6칸 안).
//  2) 대사 글의 「<사람>(님)이 <곳>에서/에」에서 <사람>이 같은 맵 이벤트 이름이고 <곳> 낱말이 그 사람 둘레(3칸) 칸 이름표·이벤트 이름에 없으면,
//     <곳>을 말하는 이(그 대사 이벤트)에서 본 방위(「바로 남쪽」 「동쪽」)로 바꾼다. 말하는 이가 그 사람 자신이면 두지 않는다.
// 고친 것만 적는다. 새 그림은 없다.
import { isObjectiveCommand, landmarkWord, bearingWord } from "./discoverability";
import { tileLabel } from "./people";
import type { GameEvent, GameMap, Project } from "@/project/types";
import type { BuildRun } from "./types";

type Obj = Record<string, unknown>;
const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;
const PLACE = "광장|분수대|분수|시장|장터|대장간|교회|성당|신전|여관|주점|항구|부두|선착장|다리|언덕|우물|회관|입구|정원|광산";

/** 보이는 그림이 있는 이벤트인가(첫 그림 있는 페이지 기준 — 투명·그림 없음이면 아니다). */
function visible(ev: GameEvent): boolean {
  return (ev.pages ?? []).some((p) => {
    const g = (p.graphic ?? {}) as { transparent?: boolean; sprite?: unknown; appearanceId?: unknown; tileId?: unknown };
    return g.transparent !== true && !!(g.sprite || g.appearanceId || typeof g.tileId === "number");
  });
}

function eachCommand(node: unknown, fn: (c: Obj) => void): void {
  if (Array.isArray(node)) { for (const n of node) eachCommand(n, fn); return; }
  if (!node || typeof node !== "object") return;
  const r = node as Obj;
  if (typeof r.kind === "string") fn(r);
  for (const v of Object.values(r)) if (v && typeof v === "object") eachCommand(v, fn);
}

/** 사람 둘레(3칸)에 그 곳 낱말이 붙은 칸 이름표·이벤트 이름이 있나. */
function placeNear(project: Project, map: GameMap, at: { x: number; y: number }, word: string): boolean {
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  for (let y = at.y - 3; y <= at.y + 3; y++) for (let x = at.x - 3; x <= at.x + 3; x++) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    for (const k of LAYERS) if (tileLabel(project, map, m[k]?.[y * map.width + x]).includes(word)) return true;
  }
  return (map.events ?? []).some((e) => Math.abs(e.x - at.x) <= 4 && Math.abs(e.y - at.y) <= 4 && String(e.name ?? "").includes(word));
}

/** 이 맵 이벤트의 목표 줄·대사를 실제 자리에 맞춘다. project 를 그 자리에서 고친다. 한 일 글. */
export function fixGuideTexts(project: Project, mapId: string): string[] {
  const map = project.maps[mapId];
  if (!map) return [];
  const notes: string[] = [];
  const byName = new Map<string, GameEvent>();
  for (const e of map.events ?? []) { const n = String(e.name ?? "").trim(); if (n.length >= 2 && !byName.has(n)) byName.set(n, e); }
  for (const ev of map.events ?? []) eachCommand(ev.pages ?? [], (c) => {
    // 1) 목표 줄의 「(이름)」
    if (isObjectiveCommand(c as never)) {
      const fields = c.fields as Obj;
      const message = String(fields.message);
      const m = /\(([^():]{2,30})\)\s*$/u.exec(message);
      const target = m ? byName.get(m[1]!.trim()) : undefined;
      if (m && target && !visible(target)) {
        const where = landmarkWord(project, map, target.x, target.y, target.id);
        if (where) {
          fields.message = `${message.slice(0, m.index)}(${m[1]!.trim()}: ${where})`;
          notes.push(`목표 「${message.slice(0, 30)}…」 대상 「${m[1]!.trim()}」은 그림이 없다 → 「${where}」를 붙임`);
        }
      }
      return;
    }
    // 2) 대사의 「누가 어디에서」
    if (c.kind !== "text" || typeof c.body !== "string") return;
    let body = c.body as string;
    for (const [name, person] of byName) {
      if (person.id === ev.id) continue;
      const re = new RegExp(`(${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:님|씨)?(?:께서|이|가|은|는|도)?\\s*)(${PLACE})(에서|에|쪽에서|쪽)`, "u");
      const hit = re.exec(body);
      if (!hit || placeNear(project, map, person, hit[2]!)) continue;
      const dir = bearingWord({ x: ev.x, y: ev.y }, { x: person.x, y: person.y });
      const near = Math.abs(person.x - ev.x) + Math.abs(person.y - ev.y) <= 5;
      const said = dir === "바로 옆" ? "바로 옆" : `${near ? "바로 " : ""}${dir}`;
      const tail = hit[3]!.replace(/^쪽/u, "");
      const next = body.replace(re, (_all, who: string) => `${who}${said}${tail}`);
      if (next !== body) { notes.push(`「${ev.name ?? ev.id}」 대사의 「${name} … ${hit[2]}${hit[3]}」 — ${name}은 ${hit[2]}에 없다(${person.x},${person.y}) → 「${said}${tail}」`); body = next; }
    }
    c.body = body;
  });
  return notes;
}

/** 끝맺음 lanes 용: 사본에서 고쳐 바뀌었으면 바꿔 넣는다. */
export function checkGuideTexts(run: BuildRun, mapId: string): string[] {
  const next = structuredClone(run.ctx.project) as Project;
  const notes = fixGuideTexts(next, mapId);
  if (notes.length) run.ctx.project = next;
  return notes;
}
