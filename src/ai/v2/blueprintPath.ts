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
import { alignCodeClues, digitWord, shownToken } from "./codeClues";
import type { GameMap, Project } from "@/project/types";
import { normalizeGameBlueprint, type GameBlueprint } from "@/project/gameBlueprint";
import { buildPuzzleChain, type ChainLink } from "./puzzle";
import { resolveWhere } from "./people";
import type { BuildRun, ContentBuildResult } from "./types";
import { BLUEPRINT_PATH_IDS, battleStepBypass, codeStepBypass, escapeLeaks, eventGives, isBattleStep, isCodeStep, victoryGatedSwitches, walkBlueprint } from "./blueprint";
import { pickFittedTroops } from "@/editor/tools/jrpgVolumeTools";
import { fitTroopCopy } from "@/editor/tools/bossThreatScaling";
import { simulateBattle } from "@/battle/simulate";
import { trivialCode } from "./puzzle";
import { repairEventReach } from "./eventReach";
import { dressInteriorExits } from "./exitDress";
import { bearingWord, landmarkWord, OBJECTIVE_SURFACE, planObjective } from "./discoverability";
import { settleExamineSpots } from "./examineSpot";
import { ensureHealingAccess, ensureSupplyShop } from "./healingAccess";
import { stageMysteryCase } from "./mysteryCase";

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
    steps: { type: "array", description: "(optional) per-step dialogue. Empty = the function fills it from the blueprint text.", items: { type: "object", properties: {
      id: { type: "string", description: "blueprint step id (s1…)" },
      lines: { type: "array", items: { type: "string" }, description: "what is said or shown when the condition is met" },
      lockedLines: { type: "array", items: { type: "string" }, description: "when the condition is not met yet (a hint of what is needed)" },
      doneLines: { type: "array", items: { type: "string" }, description: "when examined again after it is done" },
      code: { type: "string", description: "make this step a number lock — the answer (3+ digits, written in the previous step's lines)" },
      options: { type: "array", items: { type: "string" }, description: "make code a choice instead (include the right answer)" },
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
/** 「~으로/로」 — 받침 ㄹ 이면 「로」. */
const towardJosa = (word: string): string => {
  const code = (word.trim().at(-1) ?? "").charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return "(으)로";
  return code % 28 === 0 || code % 28 === 8 ? "로" : "으로";
};
/** 「책상 조사를 살펴보았다」처럼 이벤트 이름의 행동 낱말까지 읽지 않게 — 「책상을 살펴보았다」. */
const lookLine = (event: string): string => {
  const noun = event.replace(/\s*(조사하기|조사|살펴보기|확인하기|확인|열기|탈출하기|탈출|찾기|수색)$/u, "").trim() || event;
  return `${noun}${josa(noun, "을", "를")} 살펴보았다.`;
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
 *  - 싸워 이기는 단계(「마왕과의 결전」)가 이기지 않아도 넘어가면 그 맵 보스 전투의 승리 스위치를 조건으로 건다(보스가 없으면 그 이벤트 안에서 싸우고 승리 갈래에서만 넘어간다).
 *  - 전투가 있는데 회복할 길이 없으면 시작 맵에 회복의 샘과 시작 회복약(healingAccess.ts).
 *  - 추리 청사진이면 용의자 셋·증거 제시·범인 고르기(mysteryCase.ts).
 * 둘 다 이미 지은 경로를 그대로 두는 경우(다시 짓지 않음)에도 한다.
 */
export function buildBlueprintPath(run: BuildRun, text: readonly PathStepText[] = []): BlueprintPathResult {
  const result = buildBlueprintPathCore(run, text);
  const extra: string[] = [];
  try { extra.push(...gateKeyedEntrances(run)); } catch { /* 잠금 실패는 경로를 깨지 않는다 */ }
  try { extra.push(...gateEntrySteps(run)); } catch { /* 들어가기 단계 잠금 실패는 경로를 깨지 않는다 */ }
  try { extra.push(...gateBattleSteps(run)); } catch { /* 전투 잠금 실패는 경로를 깨지 않는다 */ }
  try { extra.push(...orderStepBattles(run)); } catch { /* 순서 보호 실패는 경로를 깨지 않는다 */ }
  try { extra.push(...fitUnwinnableStepBattles(run)); } catch { /* 맞추기 실패는 경로를 깨지 않는다 */ }
  try { const heal = ensureHealingAccess(run); if (heal.length) extra.push(`회복 길을 넣었다: ${heal.join(", ")}`); } catch { /* 회복 넣기 실패는 경로를 깨지 않는다 */ }
  try { const shop = ensureSupplyShop(run); if (shop.length) extra.push(`상점을 넣었다: ${shop.join(", ")}`); } catch { /* 상점 넣기 실패는 경로를 깨지 않는다 */ }
  try { extra.push(...stageMysteryCase(run)); } catch { /* 추리 사건 세우기 실패는 경로를 깨지 않는다 */ }
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

/** 명령 나무에서 그 맵으로 옮기는 첫 칸. */
function transferArrival(value: unknown, mapId: string): { x: number; y: number } | undefined {
  if (Array.isArray(value)) { for (const v of value) { const hit = transferArrival(v, mapId); if (hit) return hit; } return undefined; }
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (record.kind === "transfer" && record.mapId === mapId && typeof record.x === "number" && typeof record.y === "number") return { x: record.x, y: record.y };
  for (const child of Object.values(record)) if (child && typeof child === "object") { const hit = transferArrival(child, mapId); if (hit) return hit; }
  return undefined;
}

/** 「문을 열고 <다음 장소>로 들어간다」 — 다음 장소에 들어가는 것이 이 단계의 일인 말. */
const ENTRY_WORD = /들어가|들어간|들어서|진입|입장|안으로/u;

/**
 * 「<다음 장소>로 들어간다」 단계(열쇠 관문 gateKeyedEntrances 와 같은 틀, 2026-10-29 vm1 argon jrpg): 청사진 s2 「마왕의 문 열기」(동굴)
 * 가 「열쇠로 굳게 닫힌 문을 열고 마왕의 방으로 들어간다」 인데 그 이벤트는 스위치만 켜고 아무 데로도 옮기지 않았고, 마왕의 방은 마을 문
 * (24,0)으로 잠금 없이 들어가졌다 — 동굴의 문은 장식이 됐고 목표는 「마을로 돌아가 마왕의 방으로」를 가리켰다.
 * 단계 글(action·gives)이 다음 단계 장소 이름과 들어가는 말을 함께 담고, 다음 단계가 다른 맵이면:
 *  - 그 단계 이벤트가 켜는 스위치(다음 단계 이벤트가 조건으로 읽는 것 우선)로 다음 맵으로 들어가는 다른 문들을 잠그고,
 *  - 이 맵에 다음 맵으로 가는 문이 없으면 그 이벤트가 스위치를 켠 페이지 끝에서 다음 맵의 들어오는 자리로 옮긴다.
 * 결정적·되풀이 안전(이미 잠긴 문·이미 옮기는 페이지는 건드리지 않는다).
 */
export function gateEntrySteps(run: BuildRun): string[] {
  const bp = run.ctx.project.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  const findEvent = (ref: string) => {
    for (const map of Object.values(run.ctx.project.maps)) {
      const ev = (map.events ?? []).find((e) => e.id === ref) ?? (map.events ?? []).find((e) => norm(String((e as { name?: string }).name ?? "")) === norm(ref));
      if (ev) return { map, ev };
    }
    for (const map of Object.values(run.ctx.project.maps)) {
      const ev = (map.events ?? []).find((e) => !e.id.startsWith("ev_objective") && sameName(String((e as { name?: string }).name ?? ""), ref));
      if (ev) return { map, ev };
    }
    return undefined;
  };
  bp.steps.forEach((step, k) => {
    const nextStep = bp.steps[k + 1];
    if (!nextStep) return;
    const cur = findEvent(step.event);
    const nxt = findEvent(nextStep.event);
    if (!cur || !nxt || cur.map.id === nxt.map.id) return;
    const target = nxt.map;
    const words = `${step.action ?? ""} ${step.gives ?? ""}`;
    if (!ENTRY_WORD.test(words) || !norm(words).includes(norm(String(target.name ?? nextStep.place)))) return;
    const pages = (cur.ev.pages ?? []) as unknown as RawPage[];
    const setsOf = (page: RawPage): string[] => {
      const out: string[] = [];
      const walk = (value: unknown): void => {
        if (Array.isArray(value)) { value.forEach(walk); return; }
        if (!value || typeof value !== "object") return;
        const r = value as Record<string, unknown>;
        if (r.kind === "setSwitch" && r.value === true && typeof r.switchId === "string") out.push(r.switchId);
        Object.values(r).forEach((child) => { if (child && typeof child === "object") walk(child); });
      };
      walk(page.commands ?? []);
      return out;
    };
    const readByNext = new Set([...JSON.stringify(nxt.ev.pages ?? []).matchAll(/"switchId":"([^"]+)"/gu)].map((m) => m[1]!));
    const milestone = pages.find((page) => setsOf(page).some((id) => readByNext.has(id))) ?? pages.find((page) => setsOf(page).length > 0);
    if (!milestone) return;
    const sw = setsOf(milestone).find((id) => readByNext.has(id)) ?? setsOf(milestone)[0]!;
    // 다음 맵으로 들어가는 문들(다음 맵 자신의 이벤트는 빼고) — 들어오는 자리는 첫 문의 옮기기 칸.
    const doors: { map: GameMap; ev: GameMap["events"][number] }[] = [];
    let arrival: { x: number; y: number } | undefined;
    for (const map of Object.values(run.ctx.project.maps)) {
      if (map.id === target.id) continue;
      for (const ev of map.events ?? []) {
        if (ev.id === cur.ev.id || !transfersTo(ev.pages ?? [], new Set()).has(target.id)) continue;
        doors.push({ map, ev });
        if (!arrival) {
          arrival = transferArrival(ev.pages ?? [], target.id);
        }
      }
    }
    for (const door of doors) {
      const dpages = (door.ev.pages ?? []) as unknown as RawPage[];
      if (!dpages.length || dpages.some((p) => (p.conditions ?? []).some((c) => (c as { switchId?: string }).switchId === sw))) continue;
      const first = dpages[0]!;
      const body = door.map.id === cur.map.id ? "문이 굳게 닫혀 있다." : `아직 이 길은 닫혀 있다. ${cur.map.name ?? ""}에서 길을 열어야 할 것 같다.`.replace("  ", " ");
      const locked = { ...structuredClone(first), id: `${String(first.id ?? "p")}_shut`, name: "닫힘", conditions: [], commands: [{ kind: "text", body }] };
      const open = dpages.map((p) => ({ ...structuredClone(p), conditions: [...(p.conditions ?? []), { kind: "switch", switchId: sw, value: true }] }));
      if (run.call("upsert_event", { mapId: door.map.id, event: { ...structuredClone(door.ev), pages: [locked, ...open] } as unknown as Record<string, unknown>, replacePages: true }).ok)
        notes.push(`${door.map.name ?? door.map.id} → ${target.name ?? target.id} 문(${door.ev.x},${door.ev.y})을 「${step.event}」 뒤에만 열리게 했다`);
    }
    const hereHasDoor = doors.some((d) => d.map.id === cur.map.id);
    if (!hereHasDoor && arrival && !transfersTo(milestone.commands ?? [], new Set()).has(target.id)) {
      const index = pages.indexOf(milestone);
      const moved = pages.map((page, i) => i === index ? { ...structuredClone(page), commands: [...(page.commands ?? []), { kind: "transfer", mapId: target.id, x: arrival!.x, y: arrival!.y, fade: "black" }] } : structuredClone(page));
      if (run.call("upsert_event", { mapId: cur.map.id, event: { ...structuredClone(cur.ev), pages: moved } as unknown as Record<string, unknown>, replacePages: true }).ok)
        notes.push(`「${String((cur.ev as { name?: string }).name ?? cur.ev.id)}」 이 문을 연 뒤 ${target.name ?? target.id}(${arrival.x},${arrival.y})로 옮긴다`);
    }
  });
  return notes;
}

type RawPage = Record<string, unknown> & { conditions?: unknown[]; commands?: unknown[] };
const PROGRESS = new Set(["triggerEnding", "setSwitch", "changeItem", "transfer"]);
function pageMoves(page: RawPage): boolean {
  const text = JSON.stringify(page.commands ?? []);
  return [...PROGRESS].some((k) => text.includes(`"kind":"${k}"`));
}

/**
 * 싸워 이기는 청사진 단계가 이기지 않아도 넘어가면(blueprint-battle-bypass) 고친다. 결정적·되풀이 안전.
 *  - 그 맵에 승리 갈래에서만 스위치를 켜는 전투 이벤트(보스)가 있으면: 넘어가는 페이지에 그 스위치 조건을 더하고, 바로 앞에 같은 조건의
 *    「먼저 <보스>를 쓰러뜨려야 한다」 페이지를 둔다(열쇠는 있는데 아직 못 이긴 때).
 *  - 없으면: 그 페이지 안에서 시작 파티에 맞춘 보스 그룹과 싸우고(도망·패배 불가), 원래 명령은 승리 갈래에서만 한다.
 */
export function gateBattleSteps(run: BuildRun): string[] {
  const bp = run.ctx.project.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  for (const step of bp.steps) {
    if (isCodeStep(step) || !isBattleStep(step)) continue;
    const project = run.ctx.project;
    const map = mapFor(project, step.place);
    const ev = map?.events.find((e) => e.id === step.event || norm(String((e as { name?: string }).name ?? "")) === norm(step.event))
      ?? map?.events.find((e) => !e.id.startsWith("ev_objective") && sameName(String((e as { name?: string }).name ?? ""), step.event));
    if (!map || !ev || !battleStepBypass(project, ev)) continue;
    const won = victoryGatedSwitches(project);
    const bosses = map.events.filter((e) => e.id !== ev.id).flatMap((e) => {
      const text = JSON.stringify(e.pages ?? []);
      const sw = [...text.matchAll(/"switchId":"([^"]+)"/gu)].map((m) => m[1]!).find((id) => won.has(id));
      const troopId = /"troopId":"([^"]+)"/u.exec(text)?.[1];
      // 보스·수문장만 — 도망칠 수 있는 떠도는 잡몹(임프 무리)을 「이겨야 할 상대」로 걸지 않는다.
      const boss = /boss|보스/iu.test(`${e.id} ${troopId ?? ""}`) || text.includes('"canEscape":false');
      return sw && boss ? [{ event: e, sw, troopId, named: /boss|보스/iu.test(`${e.id} ${troopId ?? ""}`) }] : [];
    });
    const boss = bosses.find((b) => b.named) ?? bosses.at(-1);
    const pages = structuredClone(ev.pages ?? []) as unknown as RawPage[];
    const out: RawPage[] = [];
    if (boss) {
      const troop = project.database.troops.find((t) => t.id === boss.troopId);
      const name = troop?.name ?? "길을 막는 적";
      const cond = { kind: "switch", switchId: boss.sw, value: true };
      for (const page of pages) {
        const gated = (page.conditions ?? []).some((c) => (c as { switchId?: string }).switchId === boss.sw);
        if (!pageMoves(page) || gated) { out.push(page); continue; }
        out.push({ ...structuredClone(page), id: `${String(page.id ?? "p")}_unbeaten`, name: "아직 못 이김", commands: [{ kind: "text", body: `먼저 ${name}${josa(name, "을", "를")} 쓰러뜨려야 한다.` }] });
        out.push({ ...page, conditions: [...(page.conditions ?? []), cond] });
      }
      notes.push(`「${step.event}」은 ${name}(${boss.event.id}) 승리 뒤에만 넘어간다`);
      // 보스 승리가 이제 이정표다 — 이긴 뒤 목표 줄이 이 단계 이벤트를 가리키게 한다(없으면 앞 목표가 남아 길을 잃는다).
      if (!JSON.stringify(boss.event.pages ?? []).includes(OBJECTIVE_SURFACE)) {
        const plan = planObjective(run.ctx.project, { text: `${step.event}${josa(step.event, "을", "를")} 마무리하자`, eventId: boss.event.id, mapId: map.id, where: ev.id });
        if (plan.ok) for (const entry of plan.events) run.call("upsert_event", { mapId: entry.mapId, event: entry.event, replacePages: true });
      }
    } else {
      const troopId = pickFittedTroops(project, undefined).boss;
      if (!troopId) continue;
      for (const page of pages) {
        if (!pageMoves(page)) { out.push(page); continue; }
        out.push({ ...page, commands: [
          { kind: "battleProcessing", troopId, canEscape: false, canLose: false },
          { kind: "fork", condition: { kind: "battleResult", result: "victory" }, then: page.commands ?? [] },
        ] });
      }
      notes.push(`「${step.event}」 안에서 ${troopId} 와 싸우고 이겨야 넘어간다`);
    }
    const event = { ...structuredClone(ev), pages: out };
    if (!run.call("upsert_event", { mapId: map.id, event: event as unknown as Record<string, unknown>, replacePages: true }).ok) notes.pop();
  }
  return notes;
}

/**
 * 싸우는 단계가 아닌데 gateBattleSteps 가 «안에서 싸우기»로 감싼 페이지를 푼다 — `[보스 그룹 전투(도망·패배 불가), 승리 갈래 { 원래 명령 }]`
 * 꼴이고 그룹이 경로 빌더 사본(`troop_path_*`)이면 원래 명령만 남긴다. 결정적·되풀이 안전.
 * 2026-10-29 vm7 argon jrpg: 「촌장에게 마왕 토벌의 부탁과 동굴 열쇠를 받는다」를 전투 단계로 읽어(낱말 「토벌」) 촌장에게 말 걸자마자 용과 싸웠다.
 * 낱말 판정은 고쳤지만(`isBattleStep` 의 맡는 일 구) 이미 감싼 저장본은 이 함수로 되돌린다.
 */
export function ungateTalkStepBattlesIn(project: Project): string[] {
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  for (const step of bp.steps) {
    if (isCodeStep(step) || isBattleStep(step)) continue;
    const map = mapFor(project, step.place);
    const ev = map?.events.find((e) => e.id === step.event || norm(String((e as { name?: string }).name ?? "")) === norm(step.event));
    if (!map || !ev) continue;
    let touched = false;
    const pages = ((ev.pages ?? []) as unknown as RawPage[]).map((page) => {
      const cmds = (page.commands ?? []) as { kind?: string; troopId?: unknown; canEscape?: unknown; canLose?: unknown; condition?: { kind?: string; result?: string }; then?: unknown; else?: unknown }[];
      const [fight, fork] = cmds;
      const wrapped = cmds.length === 2 && fight?.kind === "battleProcessing" && typeof fight.troopId === "string" && fight.troopId.startsWith("troop_path_")
        && fight.canEscape === false && fight.canLose === false
        && fork?.kind === "fork" && fork.condition?.kind === "battleResult" && fork.condition.result === "victory" && Array.isArray(fork.then)
        && !(Array.isArray(fork.else) && fork.else.length);
      if (!wrapped) return page;
      touched = true;
      return { ...page, commands: structuredClone(fork!.then) as RawPage["commands"] };
    });
    if (!touched) continue;
    map.events = map.events.map((e) => e.id === ev.id ? { ...e, pages: pages as unknown as typeof e.pages } : e);
    notes.push(`「${String((ev as { name?: string }).name ?? ev.id)}」은 싸우는 단계가 아니라 붙어 있던 보스 전투를 뺐다`);
  }
  return notes;
}

/**
 * 단계 순서 보호(2026-10-29 vm3 terra jrpg): 「마왕과의 결전」 이 「은신처 발견」(앞 단계 스위치)과 마왕 승리 스위치를 둘 다 요구하는데,
 * 마왕 전투 이벤트는 조건 없이 서 있어 앞 단계 단서(2칸 옆 「동굴의 흔적」)를 보기 전에 부딪혀 싸웠고, 이긴 뒤 목표 「마왕과의 결전을 마무리하자」 가
 * 채울 길 없는 조건(은신처 발견)에 막혔다. 단계 이벤트의 넘어가는 페이지가 승리 스위치 W 와 함께 요구하는 다른 스위치(앞 단계가 켜는 것)를,
 * W 를 켜는 전투 이벤트의 싸우는 페이지 조건에도 건다 — 앞 단계 전에는 그 적이 나타나지 않는다. 결정적·되풀이 안전.
 * 안내 줄도 고친다: 「X이 있어야 할 것 같다.」 만 말하던 잠김 대사에, X 를 주는 앞 단계 이벤트 이름을 붙인다.
 */
export function orderStepBattles(run: BuildRun): string[] {
  return orderStepBattlesIn(run.ctx.project);
}

/** orderStepBattles 의 본체 — 프로젝트를 제자리에서 고친다(끝맺음 조립 finishAutoBuild 도 부른다: 경로를 다시 짓지 않는 판에도 돌게). */
export function orderStepBattlesIn(project: Project): string[] {
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  const won = victoryGatedSwitches(project);
  type Ev = GameMap["events"][number];
  const all: { map: GameMap; ev: Ev }[] = Object.values(project.maps).flatMap((map) => (map.events ?? []).map((ev) => ({ map, ev })));
  const setsSwitch = (value: unknown, id: string): boolean => JSON.stringify(value ?? []).includes(`"switchId":"${id}"`) && JSON.stringify(value ?? []).includes('"setSwitch"');
  // 이름은 같은 이름 먼저 — 「마왕과의 결전」 이 품은 짧은 이름(보스 「마왕」)을 먼저 잡지 않게.
  const stepEvents = bp.steps.map((step) => all.find((r) => r.ev.id === step.event) ?? all.find((r) => norm(String((r.ev as { name?: string }).name ?? "")) === norm(step.event)) ?? all.find((r) => !r.ev.id.startsWith("ev_objective") && sameName(String((r.ev as { name?: string }).name ?? ""), step.event)));
  for (const ref of stepEvents) {
    if (!ref) continue;
    for (const page of (ref.ev.pages ?? []) as unknown as RawPage[]) {
      const conds = (page.conditions ?? []) as { kind?: string; switchId?: string; itemId?: string; present?: unknown }[];
      const w = conds.find((c) => c.kind === "switch" && c.switchId && won.has(c.switchId))?.switchId;
      if (!w || !pageMoves(page)) continue;
      // 앞 단계 조건 — 스위치와 아이템(vm5 flash jrpg: 「동굴 열쇠」 아이템 조건이라 보스가 열쇠 전에도 싸웠다).
      type Need = { kind: "switch" | "item"; id: string };
      const prereqs: Need[] = conds.flatMap((c): Need[] => c.kind === "switch" && c.switchId && c.switchId !== w ? [{ kind: "switch", id: c.switchId }] : c.kind === "item" && c.itemId && c.present !== false ? [{ kind: "item", id: c.itemId }] : []);
      if (!prereqs.length) continue;
      const holder = all.find((r) => r.ev.id !== ref.ev.id && (r.ev.pages ?? []).some((pg) => JSON.stringify(pg.commands ?? []).includes('"battleProcessing"') && setsSwitch(pg.commands, w)));
      if (!holder) continue;
      const givesItem = (value: unknown, id: string): boolean => JSON.stringify(value ?? []).includes(`"itemId":"${id}"`) && JSON.stringify(value ?? []).includes('"changeItem"');
      // 앞 단계 스위치·아이템을 다른 이벤트(전투 이벤트 자신이 아닌)가 켜야·줘야 건다 — 아무도 안 주면 적이 영영 안 나타난다.
      // 그 전투에 이겨야 켜지는 페이지만 주는 조건은 빼다 — 전투 앞에 걸면 서로 기다린다(vm4 flash jrpg: 동굴의 열쇠는 과부 거미를 이긴 뒤에야 나온다).
      const wonGated = (pg: RawPage) => ((pg.conditions ?? []) as { kind?: string; switchId?: string }[]).some((c) => c.kind === "switch" && c.switchId === w);
      const need = prereqs.filter((n) => all.some((r) => r.ev.id !== holder.ev.id && (r.ev.pages ?? []).some((pg) => !wonGated(pg as unknown as RawPage) && (n.kind === "switch" ? setsSwitch(pg.commands, n.id) : givesItem(pg.commands, n.id)))));
      if (!need.length) continue;
      let touched = false;
      const pages = ((holder.ev.pages ?? []) as unknown as RawPage[]).map((pg) => {
        const fights = JSON.stringify(pg.commands ?? []).includes('"battleProcessing"') && setsSwitch(pg.commands, w);
        const have = new Set(((pg.conditions ?? []) as { switchId?: string; itemId?: string }[]).map((c) => c.switchId ?? c.itemId));
        const add = fights ? need.filter((n) => !have.has(n.id)) : [];
        if (!add.length) return structuredClone(pg);
        touched = true;
        return { ...structuredClone(pg), conditions: [...(pg.conditions ?? []), ...add.map((n) => n.kind === "switch" ? { kind: "switch", switchId: n.id, value: true } : { kind: "item", itemId: n.id, present: true })] };
      });
      if (touched) {
        holder.map.events = holder.map.events.map((e) => e.id === holder.ev.id ? { ...e, pages: pages as unknown as typeof e.pages } : e);
        notes.push(`${String((holder.ev as { name?: string }).name || holder.ev.id)} 전투는 「${String((ref.ev as { name?: string }).name ?? ref.ev.id)}」 앞 단계 뒤에만 나타난다`);
      }
    }
  }
  // 잠김 대사 「X이 있어야 할 것 같다.」 → X 를 주는 앞 단계 이벤트를 함께 말한다.
  bp.steps.forEach((_step, k) => {
    const ref = stepEvents[k];
    const prev = k > 0 ? bp.steps[k - 1] : undefined;
    const prevRef = k > 0 ? stepEvents[k - 1] : undefined;
    if (!ref || !prev?.gives || !prevRef) return;
    const prevName = String((prevRef.ev as { name?: string }).name ?? prev.event);
    const where = prevRef.map.id === ref.map.id ? "" : `${prevRef.map.name ?? prevRef.map.id}의 `;
    let touched = false;
    const pages = ((ref.ev.pages ?? []) as unknown as RawPage[]).map((pg) => {
      const cmds = (pg.commands ?? []) as { kind?: string; body?: string }[];
      const hit = cmds.findIndex((c) => c.kind === "text" && typeof c.body === "string" && /^(.+?)(이|가) 있어야 할 것 같다\.$/u.test(c.body) && sameName(/^(.+?)(이|가) 있어야/u.exec(c.body)![1]!, prev.gives!));
      if (hit < 0) return structuredClone(pg);
      touched = true;
      const next = structuredClone(cmds);
      const talkTo = ((prevRef.ev.pages ?? []) as unknown as RawPage[]).some((p) => { const g = (p.graphic ?? {}) as { sprite?: unknown; transparent?: boolean }; return Boolean(g.sprite) && g.transparent !== true; }) && !JSON.stringify(prevRef.ev.pages ?? []).includes('"battleProcessing"');
      next[hit] = { ...next[hit], body: `${next[hit]!.body} 먼저 ${where}「${prevName}」${talkTo ? "에게 말을 걸어야 한다." : `${josa(prevName, "을", "를")} 마쳐야 한다.`}` };
      return { ...structuredClone(pg), commands: next };
    });
    if (touched) ref.map.events = ref.map.events.map((e) => e.id === ref.ev.id ? { ...e, pages: pages as unknown as typeof e.pages } : e);
    if (touched) notes.push(`「${String((ref.ev as { name?: string }).name ?? ref.ev.id)}」 잠김 대사가 「${prevName}」 을 가리킨다`);
  });
  return notes;
}

/** 시작 파티가 이 정도도 못 이기면 «길을 막는 전투»가 아니라 막힌 길이다. */
const STEP_BATTLE_MIN_WIN = 0.5;

/**
 * 청사진 단계 맵의 «이겨야 넘어가는» 전투(도망 불가 또는 보스 이름)를 시작 파티·시작 레벨로 모의하고, 승률이 STEP_BATTLE_MIN_WIN 아래면
 * 그 전투를 시작 파티에 맞춘 사본 무리(fitTroopCopy — 원본 DB 적은 그대로)로 바꾼다. 결정적(모의 시드 고정)·되풀이 안전(맞춘 사본은 다시 안 맞춘다).
 * 왜(2026-10-29 vm1 argon·flash jrpg): 승리 관문을 건 뒤 옛 빌더의 마왕(Lv3, 승률 0)이 길을 막아 자동 플레이가 보스전 패배로 끝났다.
 */
export function fitUnwinnableStepBattles(run: BuildRun): string[] {
  return fitUnwinnableStepBattlesIn(run.ctx.project, (mapId, ev, pages) => run.call("upsert_event", { mapId, event: { ...structuredClone(ev), pages } as unknown as Record<string, unknown>, replacePages: true }));
}
/**
 * 끝맺음에서도 같은 맞추기를 한다 — 청사진 경로에 막힘이 없으면 buildBlueprintPath 가 돌지 않아,
 * 시작 파티로 못 이기는 보스가 그대로 나갔다(2026-10-29 vm3 flash jrpg: Lv1 로 Lv3 리치를 못 이겨 판정 「전투 못 이김」).
 */
export function fitUnwinnableStepBattlesIn(project: Project, write?: (mapId: string, ev: GameMap["events"][number], pages: RawPage[]) => void): string[] {
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const put = write ?? ((mapId: string, ev: GameMap["events"][number], pages: RawPage[]) => {
    const live = project.maps[mapId]?.events.find((e) => e.id === ev.id);
    if (live) (live as { pages: unknown }).pages = pages;
  });
  if (project.system.battleParty === "monsters" || project.system.monsterBattleParty === true) return [];
  const party = (project.system.startActorIds ?? []).filter((id) => project.database.actors.some((a) => a.id === id));
  if (!party.length) return [];
  const level = Math.max(1, ...party.map((id) => project.database.actors.find((a) => a.id === id)!.initialLevel ?? 1));
  const mapIds = [...new Set(bp.steps.map((step) => mapFor(project, step.place)?.id).filter((id): id is string => !!id))];
  const verdict = new Map<string, string | undefined>();
  const notes: string[] = [];
  for (const mapId of mapIds) {
    const map = project.maps[mapId];
    if (!map) continue;
    for (const ev of map.events ?? []) {
      const text = JSON.stringify(ev.pages ?? []);
      if (!text.includes('"battleProcessing"')) continue;
      const pages = structuredClone(ev.pages ?? []) as unknown as RawPage[];
      let changed = false;
      const visit = (node: unknown): void => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!node || typeof node !== "object") return;
        const cmd = node as Record<string, unknown>;
        if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string") {
          const troopId = cmd.troopId;
          const gating = cmd.canEscape === false || /boss|보스|마왕/iu.test(`${ev.id} ${troopId} ${project.database.troops.find((t) => t.id === troopId)?.name ?? ""}`);
          if (gating) {
            if (!verdict.has(troopId)) {
              let replace: string | undefined;
              try {
                const sim = simulateBattle({ project, troopId, heroLevel: level, partyActorIds: party, n: 12, seed: 7, useSkills: true });
                if (sim.winRate < STEP_BATTLE_MIN_WIN) {
                  const fitted = fitTroopCopy(project, troopId, "boss");
                  if (fitted && fitted !== troopId) { replace = fitted; notes.push(`「${ev.name ?? ev.id}」 전투 ${troopId}(승률 ${Math.round(sim.winRate * 100)}%)를 시작 파티에 맞춘 ${fitted} 로`); }
                }
              } catch { /* 모의 실패는 그대로 둔다 */ }
              verdict.set(troopId, replace);
            }
            const replace = verdict.get(troopId);
            if (replace) { cmd.troopId = replace; changed = true; }
          }
        }
        for (const value of Object.values(cmd)) if (value && typeof value === "object") visit(value);
      };
      visit(pages);
      if (changed) put(mapId, ev, pages);
    }
  }
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
  // 바로 앞 단계가 모델(또는 앞선 빌드)이 지은 이벤트 그대로면 — 번호 단계의 답을 그 이벤트 대사에 적는다(따로 쪽지를 세우지 않는다).
  let prevKept: { mapId: string; eventId: string; gives: string; event: string } | undefined;
  // 그대로 둔 단계 이벤트를 gives 로 — 번호 단계 needs 가 단서 여럿(「일기장 단서, 그림 뒤 단서」)이면 번호를 나눠 적는다.
  const keptByGives = new Map<string, { mapId: string; eventId: string; gives: string; event: string }>();
  steps.forEach((step, k) => {
    const keptBefore = prevKept;
    prevKept = undefined;
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
      prevKept = { mapId: map.id, eventId: existing.id, gives: step.gives, event: step.event };
      keptByGives.set(norm(step.gives), prevKept);
      fixLookLines(run, map.id, existing.id, step.event);
      return;
    }
    const needs = k > 0 ? prevGives : undefined;
    const needText = step.needs && !/^(시작|없음|none|start)$/iu.test(step.needs.trim()) ? step.needs : needs;
    const needShown = needText ? shownToken(needText) : undefined;
    const lockedDefault = needShown ? [`${needShown}${josa(needShown, "이", "가")} 있어야 할 것 같다.`] : undefined;
    let base: Omit<ChainLink, "role"> = { mapId: map.id, ...(existing ? { eventId: existing.id } : { name: step.event, at: at! }), ...(needs ? { needs } : {}), ...(!needs && prevCondition ? { needsCondition: prevCondition } : {}) };
    prevCondition = undefined;
    // 번호·암호 단계(「비밀번호 입력」「숫자 자물쇠」): 모델이 code 를 안 줬어도 함수가 정답을 정하고, 앞 단계 대사에 답이 없으면
    // 그 답을 적은 단서 고리를 바로 앞에 둔다(앞 단계 결과로 열린다) — 이 단계는 그 단서를 읽어야 열리고 번호를 맞혀야 넘어간다.
    let clueLearn: string | undefined;
    // 모델이 code 를 안 줬어도 앞 단계·이 단계 대사(또는 그대로 둔 앞 이벤트 대사)에 번호를 적었으면 그 번호가 정답이다 — 함수가 새 번호를 정하면
    // 단서 번호가 둘이 된다(2026-10-29 vm3 flash escape: 책상 「비밀번호는 4862다」 + 함수 쪽지 「5858」).
    const told0 = isCodeStep(step) && !t?.code ? modelCode(run, [...(k > 0 ? byId.get(steps[k - 1]!.id)?.lines ?? [] : []), ...(t?.lines ?? [])], keptBefore) : undefined;
    const code = isCodeStep(step) || t?.code ? (t?.code ?? told0 ?? stepCode(`${bp.title}|${step.id}|${step.event}`)) : undefined;
    if (code) {
      const prevLink = links.at(-1);
      let told = prevLink && linkStep.at(-1) === k - 1 && (prevLink.lines ?? []).some((l) => l.includes(code));
      // 앞 단계가 그대로 둔 단서 이벤트(「비밀번호 단서」를 주는 책상)면 그 대사에 번호를 적는다 — 2026-10-29 vm2 flash: 「『비밀번호 단서』를
      // 알아냈다」 뿐이라 판정자가 단서 내용을 읽을 수 없었다.
      // needs 가 단서 여럿이고 모두 그대로 둔 앞 단계면 번호를 그 순서로 나눠 적는다(2026-10-29 vm4 argon 방탈출: 「첫 번째 숫자 단서」 책상 +
      // 「두 번째 숫자 단서」 그림 → 금고). 하나만 적으면 다른 단서는 «알아냈다»뿐인 빈 단서가 된다.
      const parts = (step.needs ?? "").split(/\s*(?:[,，、·+]|\s와\s|\s과\s|\sand\s)\s*/u).map((x) => x.trim()).filter(Boolean);
      const holders = parts.map((x) => keptByGives.get(norm(x)));
      if (!told && parts.length >= 2 && parts.length <= code.length && holders.every((h) => !!h && /단서|번호|암호|쪽지|힌트|메모|숫자|clue|hint|note|code/iu.test(h.gives))) {
        const size = Math.ceil(code.length / parts.length);
        const ord = ["첫", "두", "세", "네", "다섯", "여섯"];
        told = holders.every((h, i) => {
          const piece = code.slice(i * size, (i + 1) * size);
          if (!piece) return true;
          return tellCode(run, h!, code, `${h!.gives}: 번호의 ${ord[i] ?? String(i + 1)} 번째 조각 「${piece}」가 적혀 있다.${i === parts.length - 1 || (i + 1) * size >= code.length ? ` 조각을 차례로 이으면 ${digitWord(code.length)} 번호다.` : ""}`);
        });
      }
      if (!told && keptBefore && /단서|번호|암호|쪽지|힌트|메모|clue|hint|note|code/iu.test(keptBefore.gives)) told = tellCode(run, keptBefore, code);
      if (!told) {
        const gated = Boolean(base.needs || base.needsCondition?.length);
        const keyed = gated && needText ? /^(.+?)\s*열쇠$/u.exec(needText.trim()) : null;
        const clueName = keyed ? `잠긴 ${keyed[1]}` : "번호 쪽지";
        const avoid = [...(taken.get(map.id) ?? [])];
        const where = resolveWhere(run.ctx.project, map, `${keyed ? keyed[1] : "쪽지"} 앞`, { avoid, role: "event" });
        taken.set(map.id, [...avoid, where.cell]);
        const learn = `${step.event} 번호`;
        const note = `쪽지에는 ${digitWord(code.length)} 숫자 「${code}」. 어딘가의 번호인 것 같다.`;
        links.push({ ...base, eventId: undefined, name: clueName, at: where.cell, role: "clue", learn,
          lines: keyed && needText ? [`${needText}${josa(needText, "으로", "로")} 열자 안에 쪽지가 있다.`, note] : [`${clueName}${josa(clueName, "을", "를")} 살펴보았다.`, note],
          ...(lockedDefault ? { lockedLines: lockedDefault } : {}) });
        linkStep.push(-1);
        base = { mapId: map.id, ...(existing ? { eventId: existing.id } : { name: step.event, at: at! }), needs: learn };
        clueLearn = learn;
      }
    }
    linkStep.push(k);
    const lines = t?.lines?.length ? t.lines : [lookLine(step.event)];
    const codeLocked = clueLearn ? ["번호 자물쇠가 걸려 있다. 번호를 알아야 열 수 있을 것 같다."] : undefined;
    if (last) {
      const endLines = t?.lines?.length ? t.lines : code ? ["번호 자물쇠다. 알아낸 번호를 맞춰 보자."] : [lookLine(step.event), bp.ending.how];
      const locked = t?.lockedLines?.length ? t.lockedLines : codeLocked ?? lockedDefault;
      links.push({ ...base, role: "ending", endingId: ending!.id, lines: endLines, ...(code ? { code, reward: { lines: [bp.ending.how] }, ...(t?.options?.length ? { options: t.options } : {}), ...(t?.wrongLines?.length ? { wrongLines: t.wrongLines } : {}) } : {}), ...(locked ? { lockedLines: locked } : {}) });
    } else if (code) {
      const locked = t?.lockedLines?.length ? t.lockedLines : codeLocked ?? lockedDefault;
      const reward = isItem(step.gives) ? { item: step.gives } : { flag: step.gives };
      links.push({ ...base, role: "code", code, ...(t?.options?.length ? { options: t.options } : {}), lines: t?.lines ?? ["번호 자물쇠다. 알아낸 번호를 맞춰 보자."], ...(locked ? { lockedLines: locked } : {}), ...(t?.wrongLines?.length ? { wrongLines: t.wrongLines } : {}), ...(t?.doneLines?.length ? { doneLines: t.doneLines } : {}), reward });
    } else {
      const item = isItem(step.gives);
      const givesShown = shownToken(step.gives);
      const reward = item ? { item: step.gives } : { flag: step.gives, lines: [`『${givesShown}』${josa(givesShown, "을", "를")} 알아냈다.`] };
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
  // 자물쇠 대사가 입력 전에 결과(«입력하자 열렸다»)를 말하면 정답 뒤로 옮기고, 단서 번호와 정답을 맞춘다(codeClues.ts).
  const aligned = alignCodeClues(run.ctx.project);
  run.ctx.project = aligned.project;
  const objectiveNotes = stepObjectives(run, steps, links.map((l, li) => ({ step: linkStep[li]!, name: l.name ?? "", made: eventIds[li] })));
  const roles = links.map((l, i) => `${linkStep[i]! < 0 ? `(단서) ${l.name}` : `${steps[linkStep[i]!]!.id} ${steps[linkStep[i]!]!.event}`}(${l.role}${l.code ? ` 번호 ${l.code}` : ""}${l.needs ? ` ← ${l.needs}` : l.needsCondition ? " ← 앞 단계 이벤트가 켜는 것" : ""})`).join(" → ");
  return { ...built, ...(blueprint ? { blueprint } : {}), warnings: [...warnings, ...built.warnings], summary: `${sealed.length ? `${sealed.join(" / ")}. ` : ""}청사진 경로를 지었다: ${kept.length ? `(그대로 둔 단계: ${kept.join(", ")}) ` : ""}${roles} → 엔딩 「${ending!.name ?? ending!.id}」(${ending!.id}). ${built.summary}${objectiveNotes.length ? ` 목표 줄: ${objectiveNotes.join(" / ")}` : ""}` };
}

/** 모델 대사에 적힌 번호(3~6자리) 하나 — 둘 이상이면 고르지 않는다. */
function modelCode(run: BuildRun, lines: readonly string[], kept: { mapId: string; eventId: string } | undefined): string | undefined {
  const texts = [...lines];
  if (kept) {
    const ev = run.ctx.project.maps[kept.mapId]?.events.find((e) => e.id === kept.eventId);
    for (const m of JSON.stringify(ev?.pages ?? []).matchAll(/"body":"((?:[^"\\]|\\.)*)"/gu)) texts.push(m[1]!);
  }
  const nums = [...new Set(texts.filter((l) => /비밀번호|번호|암호|숫자|자물쇠|code|password/iu.test(l)).flatMap((l) => l.match(/(?<!\d)\d{3,6}(?!\d)/gu) ?? []))];
  return nums.length === 1 ? nums[0] : undefined;
}

/** 앞선 빌드가 남긴 「X 조사를 살펴보았다」(이벤트 이름 그대로) 대사를 「X를 살펴보았다」로 — 2026-10-29 vm2 flash 판정 「이벤트 이름을 그대로 노출」. */
function fixLookLines(run: BuildRun, mapId: string, eventId: string, event: string): void {
  const ev = run.ctx.project.maps[mapId]?.events.find((e) => e.id === eventId);
  const raw = `${event}${josa(event, "을", "를")} 살펴보았다.`;
  const fixed = lookLine(event);
  if (!ev || raw === fixed || !JSON.stringify(ev.pages ?? []).includes(raw)) return;
  const pages = structuredClone(ev.pages ?? []);
  for (const page of pages) for (const c of (page.commands ?? []) as { kind: string; body?: string }[]) if (c.kind === "text" && c.body === raw) c.body = fixed;
  run.call("upsert_event", { mapId, event: { ...ev, pages }, replacePages: true });
}

/**
 * 그대로 둔 단서 이벤트의 «얻는» 페이지(스위치를 켜거나 아이템을 주는 것) 대사에 번호를 적는다. 이미 적혀 있으면 그대로.
 * 「X 조사를 살펴보았다」 같은 이름 그대로의 대사도 「X를 살펴보았다」로 고친다. 성공하면 true.
 */
function tellCode(run: BuildRun, kept: { mapId: string; eventId: string; gives: string; event: string }, code: string, body?: string): boolean {
  const ev = run.ctx.project.maps[kept.mapId]?.events.find((e) => e.id === kept.eventId);
  if (!ev) return false;
  if (JSON.stringify(ev.pages ?? []).includes(body ?? code)) return true;
  const gives = (c: { kind?: string; value?: unknown; op?: unknown }) => (c.kind === "setSwitch" && c.value !== false) || (c.kind === "changeItem" && c.op !== "-=");
  const pageIndex = (ev.pages ?? []).findIndex((p) => (p.commands ?? []).some((c) => gives(c as { kind?: string })));
  if (pageIndex < 0) return false;
  const pages = structuredClone(ev.pages ?? []);
  const cmds = pages[pageIndex]!.commands as { kind: string; body?: string }[];
  for (const c of cmds) if (c.kind === "text" && typeof c.body === "string" && c.body === `${kept.event}${josa(kept.event, "을", "를")} 살펴보았다.`) c.body = lookLine(kept.event);
  const at = cmds.findIndex((c) => gives(c));
  const learned = cmds.findIndex((c) => c.kind === "text" && typeof c.body === "string" && c.body.includes(`『${kept.gives}』`));
  const note = { kind: "text", body: body ?? `${kept.gives}: ${digitWord(code.length)} 숫자 「${code}」가 적혀 있다.` };
  cmds.splice(learned >= 0 && learned < at ? learned + 1 : at, 0, note);
  return run.call("upsert_event", { mapId: kept.mapId, event: { ...ev, pages }, replacePages: true }).ok;
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

/**
 * 잠긴 조사 대사가 무엇을 먼저 해야 하는지 말하게 한다 — 대사만 있는 조건 없는 페이지(잠김)와 스위치·아이템 조건 페이지(열림)를 가진
 * 이벤트에서, 그 조건을 켜는·주는 이벤트가 한 곳뿐이고 잠김 대사가 그 이름을 말하지 않으면 「먼저 <자리> 「그 이벤트」…」 한 줄을 덧붙인다.
 * 왜(2026-10-29 vm3 판정): argon 추리 「열린 창문」은 「아직 조사할 필요가 없다」만 되풀이해 앞 단계(여관 주인)를 몰랐고,
 * deepseek jrpg 계단은 「동굴 안쪽의 봉인을 먼저 풀어야」라 했지만 봉인은 계단 바로 옆 투명 칸이었다. 보스 잠김 대사(orderStepBattlesIn)와 같은 방식.
 */
export function pointLockedPagesIn(project: Project): string[] {
  type Ev = GameMap["events"][number];
  type Cmd = { kind?: string; body?: string; switchId?: string; itemId?: string; value?: unknown; op?: string; amount?: number };
  const notes: string[] = [];
  const all: { map: GameMap; ev: Ev }[] = Object.values(project.maps).flatMap((map) => (map.events ?? []).map((ev) => ({ map, ev })));
  const cmdsOf = (ev: Ev): Cmd[] => {
    const out: Cmd[] = [];
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== "object") return;
      const c = node as Cmd & Record<string, unknown>;
      if (typeof c.kind === "string") out.push(c);
      for (const v of Object.values(c)) if (v && typeof v === "object") visit(v);
    };
    for (const page of ev.pages ?? []) visit(page.commands);
    return out;
  };
  const setters = (kind: "switch" | "item", id: string) => all.filter((r) => cmdsOf(r.ev).some((c) => kind === "switch" ? c.kind === "setSwitch" && c.switchId === id && c.value !== false : c.kind === "changeItem" && c.itemId === id && (c.op === undefined || c.op === "+=") && (c.amount ?? 1) > 0));
  const TEXT_ONLY = new Set(["text", "changeFace", "wait", "playSe", "showBalloon"]);
  const named = (ev: Ev) => String((ev as { name?: string }).name ?? "").trim();
  const stepIds = new Set((project.gameBlueprint?.steps ?? []).flatMap((step) => all.filter((r) => r.ev.id === step.event || norm(named(r.ev)) === norm(step.event)).map((r) => r.ev.id)));
  // 사물 칩(문·상자·철창 — Object 시트)은 사람이 아니다 — 「봉인된 동굴 문에게 말을 걸어 보자」가 되지 않게(2026-10-29 vm5 deepseek jrpg).
  const person = (ev: Ev) => (ev.pages ?? []).some((p) => { const g = (p.graphic ?? {}) as { sprite?: { id?: unknown }; appearanceId?: unknown; transparent?: boolean }; return g.transparent !== true && (Boolean(g.appearanceId) || (Boolean(g.sprite) && !/charset_object|_object\d|objects?$/iu.test(String(g.sprite?.id ?? "")))); });
  for (const { map, ev } of all) {
    const pages = (ev.pages ?? []) as unknown as RawPage[];
    if (pages.length < 2) continue;
    const lockedAt = pages.findIndex((p) => !(p.conditions ?? []).length && (p.commands ?? []).length > 0 && ((p.commands ?? []) as Cmd[]).every((c) => TEXT_ONLY.has(String(c.kind))) && ((p.commands ?? []) as Cmd[]).some((c) => c.kind === "text"));
    if (lockedAt < 0) continue;
    const open = pages.find((p, i) => i > lockedAt && (p.conditions ?? []).length > 0);
    const need: { kind: "switch" | "item"; id: string }[] = ((open?.conditions ?? []) as { kind?: string; switchId?: string; itemId?: string; value?: unknown; present?: unknown }[])
      .flatMap((c): { kind: "switch" | "item"; id: string }[] => c.kind === "switch" && c.switchId && c.value !== false ? [{ kind: "switch", id: c.switchId }] : c.kind === "item" && c.itemId && c.present !== false ? [{ kind: "item", id: c.itemId }] : []);
    if (need.length !== 1) continue;
    // 열림 페이지가 실제로 길을 여는 것(옮기기·켜기·주기·싸움·엔딩)만 — 인물의 진행별 잡담(대사만 바뀌는 페이지)에는 덧붙이지 않는다.
    // 단계 순서 잠금(lockStepOrderDoorsIn)이 열림 페이지 앞에 같은 조건의 「닫힘」 대사 페이지를 끼우므로 뒤 페이지들까지 본다.
    if (!/"kind":"(?:transfer|setSwitch|changeItem|battleProcessing|triggerEnding)"/u.test(JSON.stringify(pages.slice(lockedAt + 1).map((p) => p.commands ?? [])))) continue;
    if (person(ev) && !stepIds.has(ev.id)) continue;
    const by = setters(need[0]!.kind, need[0]!.id).filter((r) => r.ev.id !== ev.id);
    if (by.length !== 1) continue;
    const src = by[0]!;
    const name = named(src.ev);
    if (!name || /^ev_/u.test(name)) continue;
    const texts = ((pages[lockedAt]!.commands ?? []) as Cmd[]).filter((c) => c.kind === "text");
    // 말하는 사람의 대사(용의자 첫 탐문·「여관 주인: …」)는 잠김 안내가 아니다 — 대사 뒤에 「먼저 …」를 붙이지 않는다(vm5 argon 추리 상인 오언).
    if (texts.some((c) => typeof (c as { speaker?: unknown }).speaker === "string" && String((c as { speaker?: unknown }).speaker).trim() || /^[^:：\s]{1,8}\s?[:：]\s/u.test(String(c.body ?? ""))) || / · 탐문$/u.test(String(pages[lockedAt]!.name ?? ""))) continue;
    const flat = (s: string) => s.replace(/[\s「」『』]/gu, "");
    // 인물은 말하는 이름으로(이벤트 이름이 「촌장의 부탁」 같은 일 제목이면 「촌장 보른」).
    const speakers = cmdsOf(src.ev).flatMap((c) => typeof (c as { speaker?: unknown }).speaker === "string" && (c as { speaker: string }).speaker.trim() ? [(c as { speaker: string }).speaker.trim()] : []);
    const speaker = speakers.sort((a, b) => speakers.filter((x) => x === b).length - speakers.filter((x) => x === a).length)[0];
    const mentioned = texts.some((c) => flat(String(c.body ?? "")).includes(flat(name)) || (speaker && flat(String(c.body ?? "")).includes(flat(speaker))));
    // 이미 이름을 대는데(「동굴 열쇠가 있어야 한다」 — 주는 것이 그 물건 자체) 어디인지 없으면 자리만 붙인다(2026-10-29 vm8 flash jrpg).
    const located = texts.some((c) => /먼저|에 있다|근처|옆|쪽/u.test(String(c.body ?? "")));
    if (mentioned && (located || person(src.ev))) continue;
    // 물건은 눈에 띄는 것에 기대어(「회복의 샘 서쪽」), 사람은 방위로.
    const spot = landmarkWord(project, src.map, src.ev.x, src.ev.y, src.ev.id);
    const where = src.map.id === map.id
      ? (person(src.ev) ? `${bearingWord({ x: ev.x, y: ev.y }, { x: src.ev.x, y: src.ev.y })}의 ` : `${spot}의 `)
      : `${src.map.name ?? src.map.id}${person(src.ev) ? "" : ` ${spot}`}의 `;
    const line = mentioned
      ? `「${name}」${josa(name, "은", "는")} ${where.replace(/의 $/u, "")}에 있다.`
      : person(src.ev) ? `먼저 ${where}「${speaker ?? name}」에게 말을 걸어 보자.` : `먼저 ${where}「${name}」${josa(name, "을", "를")} 살펴보자.`;
    const next = structuredClone(pages);
    (next[lockedAt]!.commands as Cmd[]).push({ kind: "text", body: line });
    map.events = map.events.map((e) => e.id === ev.id ? { ...e, pages: next as unknown as typeof e.pages } : e);
    notes.push(`「${named(ev) || ev.id}」 잠김 대사가 「${name}」 을 가리킨다`);
  }
  return notes;
}

/**
 * 단계 순서 문 잠금 — 청사진 단계 k(맵 A) 다음 단계 k+1 이 다른 맵 B 에 있으면, A 에서 B 로 가는 문·계단을 단계 k 가 켜는(주는) 것으로 잠근다.
 * 왜(2026-10-29 vm5 deepseek jrpg): 지하 1층 계단은 「봉인된 동굴 문」 스위치로만 열려 「빛의 검」(같은 층 제단)을 뽑기 전에 지하 2층으로 내려가졌고,
 * 판정자는 2층에서 제단·옥좌를 찾다 시간이 다 갔다. 마을 서쪽 길 끝 출구도 조건 없는 첫 페이지가 옮겨 열쇠 없이 동굴에 들어가졌다
 * (모델이 열쇠 조건 페이지를 뒤에 두었을 뿐). 열쇠 관문(gateKeyedEntrances)·들어가기 단계(gateEntrySteps)는 경로를 다시 지을 때만 돌고
 * 「들어간다」 낱말·열쇠 낱말에 묶여 있어, 끝맺음에서 낱말 없이 단계 순서만 보고 건다.
 *  - 잠그는 것은 다음 단계 이벤트가 조건으로 읽는 스위치·아이템 중 단계 k 이벤트가 켜는·주는 것(없으면 건너뜀).
 *  - 단계 0..k 중 하나라도 B 에 있으면(B 를 앞서 지나야 하면) 건너뛴다. 시작 맵에서 B 를 거치지 않고 A 에 닿지 못해도 건너뛴다.
 *  - B 로 옮기는 페이지마다, 같은 조건의 「닫힘」 페이지를 바로 앞에 두고 원래 페이지에 그 조건을 더한다(뒤 페이지가 이긴다).
 * 결정적·되풀이 안전(이미 그 조건이 있는 페이지는 건드리지 않는다).
 */
export function lockStepOrderDoorsIn(project: Project): string[] {
  const bp = project.gameBlueprint;
  if (!bp) return [];
  type Ev = GameMap["events"][number];
  type Cond = { kind?: string; switchId?: string; itemId?: string; value?: unknown; present?: unknown };
  const notes: string[] = [];
  const all: { map: GameMap; ev: Ev }[] = Object.values(project.maps).flatMap((map) => (map.events ?? []).map((ev) => ({ map, ev })));
  const named = (ev: Ev) => String((ev as { name?: string }).name ?? "").trim();
  const stepEvents = bp.steps.map((step) => all.find((r) => r.ev.id === step.event) ?? all.find((r) => norm(named(r.ev)) === norm(step.event)) ?? all.find((r) => !r.ev.id.startsWith("ev_objective") && sameName(named(r.ev), step.event)));
  /** 시작 맵에서 B 를 거치지 않고 닿는 맵들. */
  const reachWithout = (avoid: string): Set<string> => {
    const seen = new Set<string>([project.startMapId]);
    const queue = [project.startMapId];
    for (let i = 0; i < queue.length; i += 1) {
      const map = project.maps[queue[i]!];
      if (!map) continue;
      for (const ev of map.events ?? []) for (const id of transfersTo(ev.pages ?? [], new Set())) {
        if (id === avoid || seen.has(id) || !project.maps[id]) continue;
        seen.add(id);
        queue.push(id);
      }
    }
    return seen;
  };
  const condHas = (page: RawPage, c: Cond) => ((page.conditions ?? []) as Cond[]).some((x) => x.kind === c.kind && (c.kind === "switch" ? x.switchId === c.switchId && x.value !== false : x.itemId === c.itemId && x.present !== false));
  bp.steps.forEach((step, k) => {
    const cur = stepEvents[k];
    const nxt = stepEvents[k + 1];
    if (!cur || !nxt || cur.map.id === nxt.map.id) return;
    const target = nxt.map;
    if (stepEvents.slice(0, k + 1).some((r) => r?.map.id === target.id)) return;
    if (!reachWithout(target.id).has(cur.map.id)) return;
    // 시작 맵·앞 단계로 가는 길목(허브 홀)은 잠그지 않는다 — 모든 앞 단계 맵이 B 를 거치지 않고 닿아야 한다
    // (vm3 deepseek 방탈출: 마지막 단계가 현관 홀이라 응접실→홀 문까지 잠그면 서재로 못 간다).
    const others = target.id === project.startMapId || stepEvents.slice(0, k + 1).some((r) => r && !reachWithout(target.id).has(r.map.id)) ? new Set([cur.map.id]) : undefined;
    const gives = eventGives(project, cur.ev);
    const reads = ((nxt.ev.pages ?? []) as unknown as RawPage[]).flatMap((p) => (p.conditions ?? []) as Cond[]);
    const readSwitch = reads.find((c) => c.kind === "switch" && c.value !== false && c.switchId && gives.switches.includes(c.switchId));
    const readItem = reads.find((c) => c.kind === "item" && c.present !== false && c.itemId && gives.items.includes(c.itemId));
    const cond: Cond | undefined = readSwitch ? { kind: "switch", switchId: readSwitch.switchId, value: true } : readItem ? { kind: "item", itemId: readItem.itemId, present: true } : undefined;
    if (!cond) return;
    const stepName = named(cur.ev) || step.event;
    // 단계 이벤트가 사람이면 말하는 이름으로(「촌장의 부탁」 → 「촌장 노인」에게 말을 걸어 보자).
    const speakers = JSON.stringify(cur.ev.pages ?? []).match(/"speaker":"([^"]+)"/gu)?.map((m) => m.slice(11, -1).trim()).filter(Boolean) ?? [];
    const speaker = speakers.sort((a, b) => speakers.filter((x) => x === b).length - speakers.filter((x) => x === a).length)[0];
    const itemName = cond.kind === "item" ? String(project.database.items.find((i) => i.id === cond.itemId)?.name ?? "").trim() : "";
    // 단계 k 맵의 문뿐 아니라 B 로 가는 모든 맵의 문을 잠근다 — 2026-10-29 vm3 argon jrpg: 단계 1(결계 해제)은 동굴, 단계 2(최후의 결전)는 옥좌인데
    // 마을 서쪽 가장자리 (0,20)이 조건 없이 옥좌로 옮겨 동굴·결계를 건너뛰었다(동굴 문만 잠갔다).
    for (const doorMap of Object.values(project.maps)) for (const door of doorMap.events ?? []) {
      if (doorMap.id === target.id || door.id === cur.ev.id || (others && !others.has(doorMap.id))) continue;
      const pages = (door.pages ?? []) as unknown as RawPage[];
      if (!pages.some((p) => transfersTo(p.commands ?? [], new Set()).has(target.id) && !condHas(p, cond))) continue;
      const bearing = doorMap.id === cur.map.id ? bearingWord({ x: door.x, y: door.y }, { x: cur.ev.x, y: cur.ev.y }) : "";
      const where = doorMap.id !== cur.map.id ? `${cur.map.name ?? cur.map.id}의` : bearing === "바로 옆" ? "바로 옆" : `${bearing}의`;
      const place = String(target.name ?? "").trim();
      const first = itemName ? `${itemName}${josa(itemName, "이", "가")} 있어야 이 길로 갈 수 있을 것 같다.` : place ? `아직 ${place}${towardJosa(place)} 갈 때가 아니다.` : "아직 이 길로 갈 때가 아니다.";
      const body = `${first} ${speaker ? `먼저 ${where} 「${speaker}」에게 말을 걸어 보자.` : `먼저 ${where} 「${stepName}」${josa(stepName, "을", "를")} 찾아보자.`}`;
      const next: RawPage[] = [];
      pages.forEach((p, i) => {
        if (!transfersTo(p.commands ?? [], new Set()).has(target.id) || condHas(p, cond)) { next.push(structuredClone(p)); return; }
        next.push({ ...structuredClone(p), id: `${String(p.id ?? `p${i}`)}_order`, name: "닫힘", commands: [{ kind: "text", body }] });
        next.push({ ...structuredClone(p), conditions: [...(p.conditions ?? []), cond] });
      });
      doorMap.events = doorMap.events.map((e) => e.id === door.id ? { ...e, pages: next as unknown as typeof e.pages } : e);
      notes.push(`${doorMap.name ?? doorMap.id} → ${target.name ?? target.id} (${door.x},${door.y})를 「${stepName}」 뒤에만 열리게`);
    }
  });
  return notes;
}
