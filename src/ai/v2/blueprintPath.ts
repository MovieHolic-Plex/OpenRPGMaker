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
import { BLUEPRINT_PATH_IDS, codeStepBypass, escapeLeaks, eventGives, isCodeStep, walkBlueprint } from "./blueprint";
import { trivialCode } from "./puzzle";
import { repairEventReach } from "./eventReach";
import { dressInteriorExits } from "./exitDress";
import { OBJECTIVE_SURFACE, planObjective } from "./discoverability";
import { settleExamineSpots } from "./examineSpot";
import { ensureHealingAccess } from "./healingAccess";

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
  for (const [mapId, ids] of byMap) { const r = repairEventReach(run, mapId, ids); moved.push(...r.moved, ...settleExamineSpots(run, mapId, ids)); stuck.push(...r.stuck); }
  return { moved, stuck };
}

/**
 * 갇힌 방 게임(isEscapeBlueprint)에서 청사진 장소 밖으로 조건 없이 나가는 이동 이벤트를 지운다 — 탈출은 엔딩(잠긴 문)으로만.
 * 시작 맵이 장소 밖이면 시작을 청사진 첫 장소로 옮긴다(그 맵의 들어오던 착지 칸). 남는 막다른 틈은 exitDress 가 벽·문 그림으로 마감한다.
 */
export function sealEscapeExits(run: BuildRun): string[] {
  const notes: string[] = [];
  const leaks = escapeLeaks(run.ctx.project);
  if (!leaks.length) return notes;
  const project = run.ctx.project;
  const bp = project.gameBlueprint!;
  const first = bp.steps.map((s) => mapFor(project, s.place)).find((m): m is GameMap => Boolean(m));
  const places = new Set(bp.steps.flatMap((s) => { const m = mapFor(project, s.place); return m ? [m.id] : []; }));
  if (first && !places.has(project.startMapId)) {
    // 장소 밖 시작 맵에서 첫 장소로 들어오던 착지 칸 — 없으면 시작을 옮기지 않는다(시작 맵에서 걸어 들어오는 게임은 그대로).
    const landing = (project.maps[project.startMapId]?.events ?? []).flatMap((e) => JSON.stringify(e.pages ?? []).match(/\{[^{}]*"kind":"transfer"[^{}]*\}/gu) ?? [])
      .map((t) => JSON.parse(t) as { mapId?: string; x?: number; y?: number }).find((t) => t.mapId === first.id && typeof t.x === "number" && typeof t.y === "number");
    if (landing) {
      const moved = run.call("set_start_position", { mapId: first.id, x: landing.x, y: landing.y });
      if (moved.ok) notes.push(`방탈출 시작을 「${first.name ?? first.id}」(${landing.x},${landing.y})로 옮김(장소 밖 시작 맵에서 들어오던 자리)`);
    }
  }
  for (const leak of leaks) {
    const r = run.call("remove_event", { mapId: leak.mapId, eventId: leak.eventId });
    if (r.ok) notes.push(`방탈출 「${project.maps[leak.mapId]?.name ?? leak.mapId}」의 바깥 이동 (${leak.x},${leak.y}) → 「${project.maps[leak.toMapId]?.name ?? leak.toMapId}」 지움(탈출은 잠긴 문으로만)`);
  }
  // 시작이 장소 안이면 장소 밖 맵은 이제 아무도 못 가는 맵이다 — 그 맵에서 방으로 들어오던 이동도 지운다. 남겨 두면 그 착지 칸 때문에
  // exitDress 가 남쪽 틈을 «쓰는 입구»로 보고 메우지 않아, 어둠으로 뻗은 빈 통로가 남았다.
  if (places.has(run.ctx.project.startMapId)) {
    for (const m of Object.values(run.ctx.project.maps)) {
      if (places.has(m.id)) continue;
      for (const ev of m.events ?? []) {
        if (!/"kind":"transfer"/u.test(JSON.stringify(ev.pages ?? [])) || ![...places].some((id) => JSON.stringify(ev.pages ?? []).includes(`"mapId":"${id}"`))) continue;
        const r = run.call("remove_event", { mapId: m.id, eventId: ev.id });
        if (r.ok) notes.push(`못 가는 바깥 맵 「${m.name ?? m.id}」에서 방으로 들어오던 이동 (${ev.x},${ev.y}) 지움`);
      }
    }
  }
  return notes;
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
export function blueprintMapFor(project: Project, place: string): GameMap | undefined { return mapFor(project, place); }
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

/** 번호 단계의 정답 — 같은 청사진이면 늘 같은 네 자리(앞자리 0 없음, 흔한 번호 아님). */
export function stepCode(seed: string): string {
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  for (let n = 0; ; n += 1) {
    const v = Math.abs((h + n * 7919) | 0);
    const code = String(1000 + (v % 9000));
    if (!trivialCode(code)) return code;
  }
}

const RICH_KIND = /battle|shop|monster|trainer|recruit|encounter|party|gym|league|starter|capture/iu;

export interface BlueprintPathResult extends ContentBuildResult {
  /** 실제 이름에 맞춘 청사진(지은 경우). */
  readonly blueprint?: GameBlueprint;
}

/**
 * 청사진 → 사슬 인자 → 짓기. 맵이 하나도 없으면(장소를 아직 안 지었으면) 거절한다.
 * 청사진의 장소가 없는 단계는 앞 단계 장소(없으면 시작 맵)에 둔다 — 청사진 place 는 그 맵 이름으로 맞춘다.
 */
/**
 * 청사진 경로를 짓고, 그 뒤 두 가지를 결정적으로 맞춘다(2026-10-29 vm1 flash jrpg 판정):
 *  - 청사진 단계가 「<장소> 열쇠」 같은 열쇠를 needs 로 적었고 그 단계가 앞 단계와 다른 맵이면, 앞 맵에서 그 맵으로 가는 문을 열쇠로 잠근다
 *    (열쇠가 엔딩 이벤트에만 걸려 동굴엔 그냥 들어가졌다 — 「열쇠가 어디에도 쓰이지 않았다」). 청사진에 needs 가 없으면 잠그지 않는다.
 *  - 전투가 있는데 회복할 길이 없으면 시작 맵에 회복의 샘과 시작 회복약(healingAccess.ts).
 * 둘 다 이미 지은 경로를 그대로 두는 경우(다시 짓지 않음)에도 한다.
 */
export function buildBlueprintPath(run: BuildRun, text: readonly PathStepText[] = []): BlueprintPathResult {
  const result = buildBlueprintPathCore(run, text);
  const extra: string[] = [];
  try { extra.push(...gateKeyedEntrances(run)); } catch { /* 잠금 실패는 경로를 깨지 않는다 */ }
  try { const heal = ensureHealingAccess(run); if (heal.length) extra.push(`회복 길을 넣었다: ${heal.join(", ")}`); } catch { /* 회복 넣기 실패는 경로를 깨지 않는다 */ }
  return extra.length ? { ...result, summary: `${result.summary} ${extra.join(". ")}.` } : result;
}

/** 이벤트 페이지들이 옮겨 가는 맵 id. */
function transfersTo(value: unknown, out: Set<string>): Set<string> {
  if (Array.isArray(value)) { for (const v of value) transfersTo(v, out); return out; }
  if (!value || typeof value !== "object") return out;
  const record = value as Record<string, unknown>;
  if (record.kind === "transfer" && typeof record.mapId === "string") out.add(record.mapId);
  for (const child of Object.values(record)) if (child && typeof child === "object") transfersTo(child, out);
  return out;
}

const KEY_WORD = /열쇠|키\b|key/iu;

/** 청사진 needs 의 열쇠로 앞 맵 → 그 단계 맵 문을 잠근다(잠긴 페이지 + 열쇠가 있을 때의 원래 페이지). 이미 잠갔으면 그대로. */
export function gateKeyedEntrances(run: BuildRun): string[] {
  const project = run.ctx.project;
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  bp.steps.forEach((step, k) => {
    if (k === 0) return;
    const need = step.needs?.trim();
    if (!need || /^(시작|없음|none|start)$/iu.test(need) || !isItem(need) || !KEY_WORD.test(need)) return;
    const here = mapFor(run.ctx.project, step.place);
    const prev = mapFor(run.ctx.project, bp.steps[k - 1]!.place);
    if (!here || !prev || here.id === prev.id) return;
    const item = run.ctx.project.database.items.find((i) => sameName(i.name ?? "", need));
    if (!item) return;
    for (const gate of prev.events ?? []) {
      const pages = gate.pages ?? [];
      if (!pages.length || !transfersTo(pages, new Set()).has(here.id)) continue;
      if (pages.some((p) => (p.conditions ?? []).some((c) => (c as { kind?: string; itemId?: string }).kind === "item" && (c as { itemId?: string }).itemId === item.id))) continue;
      const first = pages[0]!;
      const locked = { ...structuredClone(first), id: `${first.id ?? "p"}_locked`, name: "잠김", conditions: [], commands: [{ kind: "text", body: `${need}${josa(need, "이", "가")} 있어야 들어갈 수 있을 것 같다.` }] };
      const open = pages.map((p) => ({ ...structuredClone(p), conditions: [...(p.conditions ?? []), { kind: "item", itemId: item.id, present: true }] }));
      const event = { ...structuredClone(gate), pages: [locked, ...open] };
      if (run.call("upsert_event", { mapId: prev.id, event: event as unknown as Record<string, unknown>, replacePages: true }).ok) notes.push(`${prev.name ?? prev.id} → ${here.name ?? here.id} 문(${gate.x},${gate.y})을 「${need}」로 잠갔다`);
    }
  });
  return notes;
}

function buildBlueprintPathCore(run: BuildRun, text: readonly PathStepText[] = []): BlueprintPathResult {
  const project0 = run.ctx.project;
  const bp = project0.gameBlueprint;
  const fail = (summary: string): BlueprintPathResult => ({ ok: false, mapIds: [], summary, warnings: [], missingArt: [], calls: [] });
  if (!bp) return fail("청사진이 없다 — write_blueprint 로 먼저 쓴다.");
  const byId = new Map(text.map((t) => [t.id, t]));
  const warnings: string[] = [];
  // 갇힌 방에서 걸어 나가는 이동부터 치운다(경로 막힘 blueprint-escape-leak) — 그 뒤 사슬·출구 마감이 틈을 메운다.
  const sealed = sealEscapeExits(run);
  // 이미 지은 경로가 자리만 틀렸으면(닿지 않음·길목 막음) 옮기기만 한다 — 모델이 지은 숫자 자물쇠를 줍기로 덮어쓰지 않는다.
  if (!text.length) {
    const fixed = repairBlueprintReach(run);
    if (!walkBlueprint(run.ctx.project).blockers.some((b) => BLUEPRINT_PATH_IDS.has(b.id))) {
      if (sealed.length) for (const mapId of Object.keys(run.ctx.project.maps)) for (const n of dressInteriorExits(run, mapId).notes) sealed.push(n);
      return { ok: true, mapIds: [], summary: (sealed.length ? `${sealed.join(" / ")}. ` : "") + (fixed.moved.length ? `청사진 경로는 이미 엔딩까지 이어져 있어 다시 짓지 않고 자리만 고쳤다 — 걸어 가서 조사할 수 있게 옮김: ${fixed.moved.join(", ")}` : "청사진 경로가 이미 엔딩까지 이어져 있다 — 다시 짓지 않았다(대사를 바꾸려면 steps[{id,lines}] 를 준다)."), warnings: fixed.stuck.map((s) => `조사할 자리를 못 찾았다: ${s}`), missingArt: [], calls: [] };
    }
  }

  // 모델이 지은 전투·상점·몬스터 같은 복잡한 단계 이벤트는 줍기 고리로 덮어쓰지 않는다(2026-10-28: 몬스터 리그 챔피언 이벤트).
  const rich = bp.steps.flatMap((step) => {
    const map = mapFor(project0, step.place);
    const ev = map?.events.find((e) => e.id === step.event || norm(String((e as { name?: string }).name ?? "")) === norm(step.event));
    const kinds = JSON.stringify(ev?.pages ?? []).match(/"kind":"([A-Za-z_]+)"/gu) ?? [];
    return kinds.some((k) => RICH_KIND.test(k)) ? [`${step.id} ${step.event}`] : [];
  });
  if (rich.length) return fail(`청사진 단계 이벤트 ${rich.join("·")} 에 전투·상점·몬스터 같은 명령이 있어 다시 짓지 않았다 — 그 이벤트의 조건·결과(스위치)를 patch_event_page 로 앞뒤 단계와 맞춘다.`);
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
  // 앞 단계가 모델이 지은 이벤트 그대로면 그 이벤트가 켜는 스위치·주는 아이템이 다음 조건이다.
  let prevCondition: Record<string, unknown>[] | undefined;
  const ids: string[] = [];
  const linkStep: number[] = [];
  const kept: string[] = [];
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
    // 대사를 주지 않았으면 모델이 지은 단계 이벤트(명령이 있고, 마지막이면 엔딩을 부르는 것)는 그대로 둔다 — 빠진 단계만 짓는다
    // (standin magic: 마지막 장소 하나가 없을 뿐인데 교장·사서 대화까지 줍기로 덮을 뻔했다).
    // 번호·암호 단계인데 입력 없이 넘어가는 이벤트는 그대로 두지 않는다(mt3 flash: 「비밀번호 입력」이 조사만으로 엔딩).
    const bypass = existing && isCodeStep(step) ? codeStepBypass(run.ctx.project, existing) : undefined;
    if (!text.length && existing && !bypass && (existing.pages ?? []).some((p) => (p.commands ?? []).length) && (!last || eventGives(run.ctx.project, existing).ends)) {
      const g = eventGives(run.ctx.project, existing);
      prevCondition = g.switches[0] ? [{ kind: "switch", switchId: g.switches[0], value: true }] : g.items[0] ? [{ kind: "item", itemId: g.items[0], present: true }] : undefined;
      prevGives = undefined;
      kept.push(`${step.id} ${step.event}`);
      ids.push(existing.id);
      return;
    }
    const needs = k > 0 ? prevGives : undefined;
    const needText = step.needs && !/^(시작|없음|none|start)$/iu.test(step.needs.trim()) ? step.needs : needs;
    const lockedDefault = needText ? [`${needText}${josa(needText, "이", "가")} 있어야 할 것 같다.`] : undefined;
    let base: Omit<ChainLink, "role"> = { mapId: map.id, ...(existing ? { eventId: existing.id } : { name: step.event, at: at! }), ...(needs ? { needs } : {}), ...(!needs && prevCondition ? { needsCondition: prevCondition } : {}) };
    prevCondition = undefined;
    // 번호·암호 단계(「비밀번호 입력」「숫자 자물쇠」): 모델이 code 를 안 줬어도 함수가 정답을 정하고, 앞 단계 대사에 답이 없으면
    // 그 답을 적은 단서 고리를 바로 앞에 둔다(앞 단계 결과로 열린다) — 이 단계는 그 단서를 읽어야 열리고 번호를 맞혀야 넘어간다.
    let clueLearn: string | undefined;
    const code = isCodeStep(step) || t?.code ? (t?.code ?? stepCode(`${bp.title}|${step.id}|${step.event}`)) : undefined;
    if (code) {
      const prevLink = links.at(-1);
      const told = prevLink && linkStep.at(-1) === k - 1 && (prevLink.lines ?? []).some((l) => l.includes(code));
      if (!told) {
        const gated = Boolean(base.needs || base.needsCondition?.length);
        const keyed = gated && needText ? /^(.+?)\s*열쇠$/u.exec(needText.trim()) : null;
        const clueName = keyed ? `잠긴 ${keyed[1]}` : "번호 쪽지";
        const avoid = [...(taken.get(map.id) ?? [])];
        const where = resolveWhere(run.ctx.project, map, `${keyed ? keyed[1] : "쪽지"} 앞`, { avoid, role: "event" });
        taken.set(map.id, [...avoid, where.cell]);
        const learn = `${step.event} 번호`;
        const note = `쪽지에는 네 자리 숫자 「${code}」. 어딘가의 번호인 것 같다.`;
        links.push({ ...base, eventId: undefined, name: clueName, at: where.cell, role: "clue", learn,
          lines: keyed && needText ? [`${needText}${josa(needText, "으로", "로")} 열자 안에 쪽지가 있다.`, note] : [`${clueName}${josa(clueName, "을", "를")} 살펴보았다.`, note],
          ...(lockedDefault ? { lockedLines: lockedDefault } : {}) });
        linkStep.push(-1);
        base = { mapId: map.id, ...(existing ? { eventId: existing.id } : { name: step.event, at: at! }), needs: learn };
        clueLearn = learn;
      }
    }
    linkStep.push(k);
    const lines = t?.lines?.length ? t.lines : [`${step.event}${josa(step.event, "을", "를")} 살펴보았다.`];
    const codeLocked = clueLearn ? ["번호 자물쇠가 걸려 있다. 번호를 알아야 열 수 있을 것 같다."] : undefined;
    if (last) {
      const endLines = t?.lines?.length ? t.lines : code ? ["번호 자물쇠다. 알아낸 번호를 맞춰 보자."] : [`${step.event}${josa(step.event, "을", "를")} 살펴보았다.`, bp.ending.how];
      const locked = t?.lockedLines?.length ? t.lockedLines : codeLocked ?? lockedDefault;
      links.push({ ...base, role: "ending", endingId: ending!.id, lines: endLines, ...(code ? { code, reward: { lines: [bp.ending.how] }, ...(t?.options?.length ? { options: t.options } : {}), ...(t?.wrongLines?.length ? { wrongLines: t.wrongLines } : {}) } : {}), ...(locked ? { lockedLines: locked } : {}) });
    } else if (code) {
      const locked = t?.lockedLines?.length ? t.lockedLines : codeLocked ?? lockedDefault;
      const reward = isItem(step.gives) ? { item: step.gives } : { flag: step.gives };
      links.push({ ...base, role: "code", code, ...(t?.options?.length ? { options: t.options } : {}), lines: t?.lines ?? ["번호 자물쇠다. 알아낸 번호를 맞춰 보자."], ...(locked ? { lockedLines: locked } : {}), ...(t?.wrongLines?.length ? { wrongLines: t.wrongLines } : {}), ...(t?.doneLines?.length ? { doneLines: t.doneLines } : {}), reward });
    } else {
      const item = isItem(step.gives);
      const reward = item ? { item: step.gives } : { flag: step.gives, lines: [`『${step.gives}』${josa(step.gives, "을", "를")} 알아냈다.`] };
      links.push({ ...base, role: "pickup", lines, reward, ...(t?.lockedLines?.length ? { lockedLines: t.lockedLines } : lockedDefault ? { lockedLines: lockedDefault } : {}), doneLines: t?.doneLines?.length ? t.doneLines : ["더는 볼 것이 없다."] });
    }
    prevGives = step.gives;
    ids.push(existing?.id ?? "");
  });

  if (!links.length && sealed.length) for (const mapId of Object.keys(run.ctx.project.maps)) for (const n of dressInteriorExits(run, mapId).notes) sealed.push(n);
  if (!links.length) return { ok: true, mapIds: [], summary: `${sealed.length ? `${sealed.join(" / ")}. ` : ""}청사진 단계 이벤트가 모두 이미 있다(${kept.join(", ")}) — 다시 짓지 않았다.`, warnings, missingArt: [], calls: [] };
  const built = buildPuzzleChain(run, { mapId: fallbackMap.id, name: bp.title, links });
  if (!built.ok) return { ...built, warnings: [...warnings, ...built.warnings] };

  // 3) 청사진 이름을 실제로 지은 맵·이벤트에 맞춘다(출하 검사가 같은 이름으로 걷는다).
  const eventIds = built.eventIds ?? [];
  links.forEach((_, li) => {
    const k = linkStep[li]!;
    if (k < 0) return; // 함수가 덧붙인 단서 고리 — 청사진 단계가 아니다.
    const step = steps[k]!;
    const made = eventIds[li];
    if (!made) return;
    const map = run.ctx.project.maps[made.mapId];
    const ev = map?.events.find((e) => e.id === made.eventId);
    if (map && !mapFor(run.ctx.project, step.place)) step.place = map.name || map.id;
    if (ev && !sameName(String((ev as { name?: string }).name ?? ""), step.event) && ev.id !== step.event) step.event = ev.id;
  });
  let blueprint: GameBlueprint | undefined;
  try { blueprint = normalizeGameBlueprint({ ...bp, steps }); } catch { blueprint = undefined; }
  if (blueprint) run.ctx.project = { ...run.ctx.project, gameBlueprint: blueprint };
  const objectiveNotes = stepObjectives(run, steps, links.map((l, li) => ({ step: linkStep[li]!, name: l.name ?? "", made: eventIds[li] })));
  const roles = links.map((l, i) => `${linkStep[i]! < 0 ? `(단서) ${l.name}` : `${steps[linkStep[i]!]!.id} ${steps[linkStep[i]!]!.event}`}(${l.role}${l.code ? ` 번호 ${l.code}` : ""}${l.needs ? ` ← ${l.needs}` : l.needsCondition ? " ← 앞 단계 이벤트가 켜는 것" : ""})`).join(" → ");
  return { ...built, ...(blueprint ? { blueprint } : {}), warnings: [...warnings, ...built.warnings], summary: `${sealed.length ? `${sealed.join(" / ")}. ` : ""}청사진 경로를 지었다: ${kept.length ? `(그대로 둔 단계: ${kept.join(", ")}) ` : ""}${roles} → 엔딩 「${ending!.name ?? ending!.id}」(${ending!.id}). ${built.summary}${objectiveNotes.length ? ` 목표 줄: ${objectiveNotes.join(" / ")}` : ""}` };
}

/**
 * 단계마다 「현재 목표」 — 시작 목표(없을 때만)와, 단계 이벤트가 이정표를 켠 바로 뒤에 다음 단계 할 일 + 그 이벤트 자리.
 * 왜(2026-10-28 mt3 argon escape): 사슬은 함수가 지었지만 목표 줄은 모델 몫이라, 모델이 set_objective 를 잘못 걸자(where 만 줌)
 * 게임 시작부터 마지막 목표만 떠 판정자가 「조사할 위치를 잡는 데 헤맸다」. 이미 목표가 있는 이벤트는 건드리지 않는다
 * (모델이 나중에 같은 이벤트에 set_objective 를 부르면 같은 자리를 바꾼다).
 */
function stepObjectives(run: BuildRun, steps: readonly { event: string; action: string }[], made: readonly { step: number; name: string; made?: { mapId: string; eventId: string } }[]): string[] {
  const notes: string[] = [];
  const has = (pages: unknown, auto = false): boolean => (Array.isArray(pages) ? pages : []).some((p: { trigger?: { kind?: string }; commands?: unknown }) => (!auto || ["auto", "parallel"].includes(String(p.trigger?.kind))) && JSON.stringify(p.commands ?? []).includes(OBJECTIVE_SURFACE));
  const write = (plan: ReturnType<typeof planObjective>): boolean => {
    if (!plan.ok) return false;
    for (const entry of plan.events) if (!run.call("upsert_event", { mapId: entry.mapId, event: entry.event, replacePages: true }).ok) return false;
    return true;
  };
  const project = run.ctx.project;
  const start = project.maps[project.startMapId];
  const bp = project.gameBlueprint;
  if (bp && start && !(start.events ?? []).some((e) => has(e.pages, true))) {
    const plan = planObjective(project, { at: "start", text: bp.playerGoal.trim().replace(/[.。!]+$/u, "") });
    if (write(plan)) notes.push("시작 목표");
  }
  for (let i = 0; i + 1 < made.length; i += 1) {
    const cur = made[i]!.made, next = made[i + 1]!.made;
    // 다음 고리가 함수가 덧붙인 번호 단서(step < 0)면 그 단서를 살펴보라고 한다.
    const k = made[i + 1]!.step;
    const nextStep = k >= 0 ? steps[k] : undefined;
    const nextName = made[i + 1]!.name;
    if (!cur || !next || (!nextStep && !nextName)) continue;
    const ev = run.ctx.project.maps[cur.mapId]?.events.find((e) => e.id === cur.eventId);
    if (!ev || has(ev.pages)) continue;
    const text = nextStep ? nextStep.action.trim().replace(/[.。!]+$/u, "").slice(0, 60) : `${nextName}${josa(nextName, "을", "를")} 살펴보자`;
    if (write(planObjective(run.ctx.project, { text, eventId: cur.eventId, mapId: cur.mapId, where: next.eventId }))) notes.push(`${String(ev.name ?? ev.id)} 뒤`);
  }
  if (notes.length && run.ctx.project.system.fieldHud?.objective === false) run.call("set_field_hud", { objective: true });
  return notes;
}
