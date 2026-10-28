// 조수 v2 청사진 경로 짓기(build_blueprint_path) — 청사진의 단계(place·event·needs·gives)와 엔딩에서
// 맵 이벤트·조건·스위치·아이템·엔딩 호출을 결정적으로 짓는다. 모델은 대사·이름만 (원하면) 채운다.
//
// 왜(2026-10-28 mt2 방탈출, ~/z-project/assistant-whole-game/suite/runs/mt2-1028): Flash·Argon 은 define_ending 까지 하고
// 엔딩을 부르는 이벤트를 하나도 두지 못했다. Flash 는 upsert_event 에 RPG Maker MV 모양(code 101/401·trigger 0)을 보내
// 여섯 번 다 인자 검증에서 막혔고, 그 사이 write_blueprint 만 열 번 가까이 다시 불렀다. terra 만 author_puzzle_chain 한 번으로
// 고리를 만들어 자동 플레이가 엔딩까지 갔다. 그래서 고리는 청사진에서 함수가 만든다:
//  - 단계마다 그 맵의 이벤트(이름이 같으면 그 이벤트를 고쳐 쓰고, 없으면 그 낱말 이름표 물건 앞 빈 칸에 새로 둔다),
//  - 앞 단계의 gives 가 다음 단계의 조건(열쇠·쪽지 같은 물건이면 아이템, 아니면 스위치),
//  - 마지막 단계는 조건이 차면 엔딩을 부른다(엔딩이 없으면 청사진 ending 으로 정의한다).
// 짓는 것은 puzzle.ts 의 buildPuzzleChain(검증된 사슬 빌더) — 이 파일은 청사진 → 사슬 인자 번역과 자리 고르기만 한다.
// 지은 뒤 청사진의 place·event 를 실제 맵·이벤트 이름에 맞춰 둔다(출하 검사 walkBlueprint 가 같은 이름으로 걷는다).
import type { GameMap, Project } from "@/project/types";
import { normalizeGameBlueprint, type GameBlueprint } from "@/project/gameBlueprint";
import { buildPuzzleChain, type ChainLink } from "./puzzle";
import { resolveWhere } from "./people";
import type { BuildRun, ContentBuildResult } from "./types";
import { BLUEPRINT_PATH_IDS, walkBlueprint } from "./blueprint";
import { repairEventReach } from "./eventReach";

/**
 * 이미 지은 청사진 단계 이벤트·퍼즐 고리 이벤트를 걸어 가 조사할 수 있는 자리로 옮긴다(내용은 그대로). 옮긴 것 목록.
 * 모델이 지은 고리(숫자 자물쇠 등)를 다시 짓지 않고 자리만 고칠 때 — 끝맺음 단계와 build_blueprint_path 가 먼저 부른다.
 */
export function repairBlueprintReach(run: BuildRun): { moved: string[]; stuck: string[] } {
  const project = run.ctx.project;
  const bp = project.gameBlueprint;
  const byMap = new Map<string, string[]>();
  const push = (mapId: string, id: string) => { const list = byMap.get(mapId) ?? []; if (!list.includes(id)) list.push(id); byMap.set(mapId, list); };
  for (const step of bp?.steps ?? []) {
    const map = mapFor(project, step.place);
    const ev = map?.events.find((e) => e.id === step.event || norm(String((e as { name?: string }).name ?? "")) === norm(step.event)) ?? map?.events.find((e) => sameName(String((e as { name?: string }).name ?? ""), step.event));
    if (map && ev) push(map.id, ev.id);
  }
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) if (ev.id.startsWith("ev_chain_") && !ev.id.startsWith("ev_chain_seal_")) push(map.id, ev.id);
  const moved: string[] = [], stuck: string[] = [];
  for (const [mapId, ids] of byMap) { const r = repairEventReach(run, mapId, ids); moved.push(...r.moved); stuck.push(...r.stuck); }
  return { moved, stuck };
}

/** 모델이 단계별로 덧붙일 수 있는 글(전부 선택). 숫자 자물쇠를 원하면 code 와 앞 단계 lines 에 그 답을. */
export interface PathStepText {
  readonly id: string;
  readonly lines?: readonly string[];
  readonly lockedLines?: readonly string[];
  readonly doneLines?: readonly string[];
  readonly code?: string;
  readonly options?: readonly string[];
  readonly wrongLines?: readonly string[];
}

export const BUILD_BLUEPRINT_PATH_SCHEMA = {
  type: "object",
  properties: {
    steps: { type: "array", description: "(선택) 단계별 대사. 비우면 함수가 청사진 글로 채운다.", items: { type: "object", properties: {
      id: { type: "string", description: "청사진 단계 id(s1…)" },
      lines: { type: "array", items: { type: "string" }, description: "조건이 찼을 때 하는 말·보이는 글" },
      lockedLines: { type: "array", items: { type: "string" }, description: "아직 조건이 안 찼을 때(무엇이 필요한지 힌트)" },
      doneLines: { type: "array", items: { type: "string" }, description: "끝난 뒤 다시 조사하면" },
      code: { type: "string", description: "이 단계를 숫자 자물쇠로 — 답(3자리 이상, 앞 단계 lines 에 적는다)" },
      options: { type: "array", items: { type: "string" }, description: "code 를 고르기로(정답 포함)" },
      wrongLines: { type: "array", items: { type: "string" } },
    }, required: ["id"] } },
  },
} as const;

const norm = (s: string) => s.normalize("NFC").replace(/[\s·・,.!?'"「」『』()[\]~\-_/]+/gu, "").toLowerCase();
function sameName(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 2 && long.includes(short);
}
function mapFor(project: Project, place: string): GameMap | undefined {
  const maps = Object.values(project.maps);
  return maps.find((m) => m.id === place || norm(m.name ?? "") === norm(place)) ?? maps.find((m) => sameName(m.name ?? "", place));
}
/** 들고 다니는 물건 낱말이면 아이템, 아니면(알게 된 것·켜진 장치·호감) 스위치. */
const ITEM_WORD = /열쇠|키\b|카드|쪽지|메모|편지|지도|부적|반지|목걸이|도구|상자|병|약|책|일지|사진|조각|부품|톱니|태엽|램프|등불|key|card|note|letter|map|amulet|ring|tool|potion|book|photo|piece|gear/iu;
const isItem = (gives: string) => ITEM_WORD.test(gives) && !/엔딩|ending|열림|풀림|알게|비밀번호|암호|번호|단서/iu.test(gives);
const josa = (word: string, withBatchim: string, without: string) => {
  const last = word.trim().at(-1) ?? "";
  const code = last.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 ? (code % 28 ? withBatchim : without) : `${withBatchim}(${without})`;
};

export interface BlueprintPathResult extends ContentBuildResult {
  /** 실제 이름에 맞춘 청사진(지은 경우). */
  readonly blueprint?: GameBlueprint;
}

/**
 * 청사진 → 사슬 인자 → 짓기. 맵이 하나도 없으면(장소를 아직 안 지었으면) 거절한다.
 * 청사진의 장소가 없는 단계는 앞 단계 장소(없으면 시작 맵)에 둔다 — 청사진 place 는 그 맵 이름으로 맞춘다.
 */
export function buildBlueprintPath(run: BuildRun, text: readonly PathStepText[] = []): BlueprintPathResult {
  const project0 = run.ctx.project;
  const bp = project0.gameBlueprint;
  const fail = (summary: string): BlueprintPathResult => ({ ok: false, mapIds: [], summary, warnings: [], missingArt: [], calls: [] });
  if (!bp) return fail("청사진이 없다 — write_blueprint 로 먼저 쓴다.");
  const byId = new Map(text.map((t) => [t.id, t]));
  const warnings: string[] = [];
  // 이미 지은 경로가 자리만 틀렸으면(닿지 않음·길목 막음) 옮기기만 한다 — 모델이 지은 숫자 자물쇠를 줍기로 덮어쓰지 않는다.
  if (!text.length) {
    const fixed = repairBlueprintReach(run);
    if (!walkBlueprint(run.ctx.project).blockers.some((b) => BLUEPRINT_PATH_IDS.has(b.id))) {
      return { ok: true, mapIds: [], summary: fixed.moved.length ? `청사진 경로는 이미 엔딩까지 이어져 있어 다시 짓지 않고 자리만 고쳤다 — 걸어 가서 조사할 수 있게 옮김: ${fixed.moved.join(", ")}` : "청사진 경로가 이미 엔딩까지 이어져 있다 — 다시 짓지 않았다(대사를 바꾸려면 steps[{id,lines}] 를 준다).", warnings: fixed.stuck.map((s) => `조사할 자리를 못 찾았다: ${s}`), missingArt: [], calls: [] };
    }
  }

  // 1) 엔딩 — 청사진 ending 이름과 같은 엔딩이 있으면 그것, 없으면 하나뿐인 엔딩, 그래도 없으면 새로 정의한다.
  const endings = (project0.endings ?? []) as { id: string; name?: string }[];
  let ending = endings.find((e) => sameName(e.name ?? "", bp.ending.name)) ?? (endings.length === 1 ? endings[0] : undefined);
  if (!ending) {
    const id = `ending_${Math.abs([...bp.ending.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)}`;
    const res = run.call("define_ending", { id, name: bp.ending.name, conditions: [], epilogue: [{ kind: "say", text: bp.ending.how }], presentation: { finalTitle: bp.ending.name, credits: bp.title } });
    if (!res.ok) return fail(`엔딩 「${bp.ending.name}」을 정의하지 못했다: ${String(res.summary).slice(0, 200)}`);
    ending = { id, name: bp.ending.name };
  }

  // 2) 단계 → 사슬 고리. 자리: 이름이 같은 이벤트가 있으면 그것, 없으면 그 낱말 물건 앞 빈 칸.
  const fallbackMap = project0.maps[project0.startMapId] ?? Object.values(project0.maps)[0];
  if (!fallbackMap) return fail("맵이 하나도 없다 — make_place 로 장소를 먼저 짓는다.");
  const taken = new Map<string, { x: number; y: number }[]>();
  const links: ChainLink[] = [];
  const steps = bp.steps.map((s) => ({ ...s }));
  let prevMap: GameMap = fallbackMap;
  let prevGives: string | undefined;
  const ids: string[] = [];
  steps.forEach((step, k) => {
    const last = k === steps.length - 1;
    let map = mapFor(run.ctx.project, step.place);
    if (!map) { map = prevMap; warnings.push(`${step.id} 장소 「${step.place}」 맵이 없어 「${map.name}」에 두었다`); step.place = map.name || map.id; }
    prevMap = map;
    const existing = (map.events ?? []).find((e) => e.id === step.event || norm(String((e as { name?: string }).name ?? "")) === norm(step.event))
      ?? (map.events ?? []).find((e) => !e.id.startsWith("ev_objective") && sameName(String((e as { name?: string }).name ?? ""), step.event));
    let at: { x: number; y: number } | undefined;
    if (!existing) {
      const avoid = [...(taken.get(map.id) ?? [])];
      const where = resolveWhere(run.ctx.project, map, `${step.event} 앞`, { avoid, role: "event" });
      at = where.cell;
      taken.set(map.id, [...avoid, at]);
    }
    const t = byId.get(step.id);
    const needs = k > 0 ? prevGives : undefined;
    const needText = step.needs && !/^(시작|없음|none|start)$/iu.test(step.needs.trim()) ? step.needs : needs;
    const lockedDefault = needText ? [`${needText}${josa(needText, "이", "가")} 있어야 할 것 같다.`] : undefined;
    const base = { mapId: map.id, ...(existing ? { eventId: existing.id } : { name: step.event, at: at! }), ...(needs ? { needs } : {}) };
    const lines = t?.lines?.length ? t.lines : [`${step.event}${josa(step.event, "을", "를")} 살펴보았다.`];
    if (last) {
      links.push({ ...base, role: "ending", endingId: ending!.id, lines: t?.lines?.length ? t.lines : [`${step.event}${josa(step.event, "을", "를")} 살펴보았다.`, bp.ending.how], ...(t?.lockedLines?.length || lockedDefault ? { lockedLines: t?.lockedLines?.length ? t.lockedLines : lockedDefault } : {}) });
    } else if (t?.code) {
      const reward = isItem(step.gives) ? { item: step.gives } : { flag: step.gives };
      links.push({ ...base, role: "code", code: t.code, ...(t.options?.length ? { options: t.options } : {}), lines: t.lines ?? [], ...(t.lockedLines?.length ? { lockedLines: t.lockedLines } : lockedDefault ? { lockedLines: lockedDefault } : {}), ...(t.wrongLines?.length ? { wrongLines: t.wrongLines } : {}), ...(t.doneLines?.length ? { doneLines: t.doneLines } : {}), reward });
    } else {
      const item = isItem(step.gives);
      const reward = item ? { item: step.gives } : { flag: step.gives, lines: [`『${step.gives}』${josa(step.gives, "을", "를")} 알아냈다.`] };
      links.push({ ...base, role: "pickup", lines, reward, ...(t?.lockedLines?.length ? { lockedLines: t.lockedLines } : lockedDefault ? { lockedLines: lockedDefault } : {}), doneLines: t?.doneLines?.length ? t.doneLines : ["더는 볼 것이 없다."] });
    }
    prevGives = step.gives;
    ids.push(existing?.id ?? "");
  });

  const built = buildPuzzleChain(run, { mapId: fallbackMap.id, name: bp.title, links });
  if (!built.ok) return { ...built, warnings: [...warnings, ...built.warnings] };

  // 3) 청사진 이름을 실제로 지은 맵·이벤트에 맞춘다(출하 검사가 같은 이름으로 걷는다).
  const eventIds = built.eventIds ?? [];
  steps.forEach((step, k) => {
    const made = eventIds[k];
    if (!made) return;
    const map = run.ctx.project.maps[made.mapId];
    const ev = map?.events.find((e) => e.id === made.eventId);
    if (map && !mapFor(run.ctx.project, step.place)) step.place = map.name || map.id;
    if (ev && !sameName(String((ev as { name?: string }).name ?? ""), step.event) && ev.id !== step.event) step.event = ev.id;
  });
  let blueprint: GameBlueprint | undefined;
  try { blueprint = normalizeGameBlueprint({ ...bp, steps }); } catch { blueprint = undefined; }
  if (blueprint) run.ctx.project = { ...run.ctx.project, gameBlueprint: blueprint };
  const roles = links.map((l, i) => `${steps[i]!.id} ${steps[i]!.event}(${l.role}${l.needs ? ` ← ${l.needs}` : ""})`).join(" → ");
  return { ...built, ...(blueprint ? { blueprint } : {}), warnings: [...warnings, ...built.warnings], summary: `청사진 경로를 지었다: ${roles} → 엔딩 「${ending!.name ?? ending!.id}」(${ending!.id}). ${built.summary}` };
}
