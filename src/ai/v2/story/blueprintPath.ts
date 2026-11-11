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
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { normalizeGameBlueprint, type GameBlueprint } from "@/project/gameBlueprint";
import { buildPuzzleChain, type ChainLink } from "./puzzle";
import { programAnchor } from "../place/program";
import { incomingLandings, resolveWhere } from "../place/where";
import { applyThemeBackdrop, themeBossTroop } from "../place/placeTheme";
import { walkStart } from "../place/cells";
import type { BuildRun, ContentBuildResult } from "../shared/types";
import { BLUEPRINT_PATH_IDS, codeStepBypass, escapeLeaks, eventGives, isCodeStep, walkBlueprint } from "./blueprint";
import { pickFittedTroops, pickSpot } from "@/editor/tools/jrpgVolumeTools";
import { FITTED_TROOP_PREFIX } from "@/editor/tools/bossThreatScaling";
import { trivialCode } from "./puzzle";
import { repairEventReach } from "../place/reachRepairs";
import { dressInteriorExits } from "../place/exitDress";
import { settleExamineSpots } from "./examineSpot";
import { ensureHealingAccess, ensureSupplyShop } from "./healingAccess";
import { stageMysteryCase } from "./mysteryCase";
import { PathStepText, norm, sameName, mapFor, isItem, josa, lookLine } from "./blueprintPathNames";
import { gateKeyedEntrances, gateEntrySteps } from "./blueprintPathGates";
import { gateBattleSteps, orderStepBattles, fitUnwinnableStepBattles } from "./blueprintPathBattles";
import { storedStepText, modelCode, fixLookLines, tellCode, stepObjectives } from "./blueprintPathText";
import { foeGraphic, settleStepFoesIn, themeBattleBackdropsIn } from "./stepFoes";
import { remapGives, settleCarriedSteps } from "./blueprintCarry";

/**
 * 이미 지은 청사진 단계 이벤트·퍼즐 고리 이벤트를 걸어 가 조사할 수 있는 자리로 옮긴다(내용은 그대로). 옮긴 것 목록.
 * 모델이 지은 고리(숫자 자물쇠 등)를 다시 짓지 않고 자리만 고칠 때 — 끝맺음 단계와 build_blueprint_path 가 먼저 부른다.
 */
function repairBlueprintReach(run: BuildRun): { moved: string[]; stuck: string[] } {
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

export const BUILD_BLUEPRINT_PATH_SCHEMA = {
  type: "object",
  properties: {
    steps: { type: "array", description: "(optional) per-step dialogue. Empty = the function fills it from the blueprint text.", items: { type: "object", properties: {
      id: { type: "string", description: "blueprint step id (s1…)" },
      lines: { type: "array", items: { type: "string" }, description: "what is said or shown when the condition is met — for a talk/choice/battle step the person's own words (a line starting with «(» is narration)" },
      lockedLines: { type: "array", items: { type: "string" }, description: "when the condition is not met yet — a hint naming this step's own needs (never another step)" },
      doneLines: { type: "array", items: { type: "string" }, description: "when examined again after it is done" },
      code: { type: "string", description: "make this step a number lock — the answer (3+ digits, written in an earlier step's lines)" },
      options: { type: "array", items: { type: "string" }, description: "make code a choice instead (include the right answer)" },
      wrongLines: { type: "array", items: { type: "string" } },
      winLines: { type: "array", items: { type: "string" }, description: "battle step: 1–2 lines after the player wins — the foe's own words, or narration wrapped in parentheses: «(The beast backs into the reeds.)». A foe drawn as a monster leaves the map after the win, so its doneLines are not shown" },
      choices: { type: "array", description: "choice step: the 2–3 options the player picks from", items: { type: "object", properties: {
        text: { type: "string", description: "the option as the player reads it" },
        lines: { type: "array", items: { type: "string" }, description: "what the person answers when this is picked" },
        later: { type: "string", description: "one line shown at the ending: what this choice led to" },
      }, required: ["text"] } },
    }, required: ["id"] } },
  },
} as const;

/** 번호 단계의 정답 — 같은 청사진이면 늘 같은 네 자리(앞자리 0 없음, 흔한 번호 아님). */
function stepCode(seed: string): string {
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  for (let n = 0; ; n += 1) {
    const v = Math.abs((h + n * 7919) | 0);
    const code = String(1000 + (v % 9000));
    if (!trivialCode(code)) return code;
  }
}

const RICH_KIND = /battle|shop|monster|trainer|recruit|encounter|party|gym|league|starter|capture/iu;

interface BlueprintPathResult extends ContentBuildResult {
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
  const gaps: string[] = [];
  try { extra.push(...settleStepFoesIn(run.ctx.project)); const bg = themeBattleBackdropsIn(run.ctx.project); extra.push(...bg.notes); gaps.push(...bg.gaps); } catch { /* 상대 그림·배경 맞추기 실패는 경로를 깨지 않는다 */ }
  try { const heal = ensureHealingAccess(run); if (heal.length) extra.push(`회복 길을 넣었다: ${heal.join(", ")}`); } catch { /* 회복 넣기 실패는 경로를 깨지 않는다 */ }
  try { const shop = ensureSupplyShop(run); if (shop.length) extra.push(`상점을 넣었다: ${shop.join(", ")}`); } catch { /* 상점 넣기 실패는 경로를 깨지 않는다 */ }
  try { extra.push(...stageMysteryCase(run)); } catch { /* 추리 사건 세우기 실패는 경로를 깨지 않는다 */ }
  const missingArt = [...new Set([...result.missingArt, ...gaps])];
  return extra.length ? { ...result, missingArt, summary: `${result.summary} ${extra.join(". ")}.` } : { ...result, missingArt };
}

function buildBlueprintPathCore(run: BuildRun, text: readonly PathStepText[] = []): BlueprintPathResult {
  const project0 = run.ctx.project;
  const bp = project0.gameBlueprint;
  const fail = (summary: string): BlueprintPathResult => ({ ok: false, mapIds: [], summary, warnings: [], missingArt: [], calls: [] });
  if (!bp) return fail("청사진이 없다 — write_blueprint 로 먼저 쓴다.");
  // 이번에 받은 글이 먼저, 없으면 청사진에 남긴 그 단계의 글(GameBlueprintStep.text) — 한 단계만 고쳐 불러도 나머지 단계의 글이 남는다.
  const given = new Map(text.map((t) => [t.id, t]));
  const byId = { get: (id: string): PathStepText | undefined => given.get(id) ?? storedStepText(bp, id) };
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
    // 이 함수가 지은 싸우는 단계(kind battle 의 사슬 고리)는 다시 짓는다 — 대사만 바꿔 다시 부를 수 있게.
    if (step.kind === "battle" && ev?.id.startsWith("ev_chain_")) return [];
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

  // 다시 쓴 청사진이면 앞 경로가 지어 둔 것부터 새 단계에 맞춘다(이름 바꾸기 · 옮긴/빠진 단계의 이벤트 걷기) — blueprintCarry.ts.
  const carried = settleCarriedSteps(run.ctx.project);
  for (const note of carried.notes) warnings.push(note);
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
  /** 고르기 단계가 남긴 «그 선택의 결과» 줄 — 마지막(엔딩) 고리가 읽는다. */
  const variants: { needs: string; lines: string[] }[] = [];
  const linkStep: number[] = [];
  /**
   * 고리 하나가 설 칸. 낱말(«책상 앞»)이 그 맵의 물건을 가리키면 그 앞. 종류를 적은 청사진에서 낱말이 없거나(사람) 못 찾았으면
   * 들어온 칸에서 rank(0 가까움 ~ 1 가장 먼 곳)쯤의 길을 막지 않는 칸 — 못 찾은 낱말의 기본 자리는 맵 가장자리 구석이었다.
   */
  const spotFor = (map: GameMap, word: string | undefined, kinded: boolean, rank: number, who?: string): { x: number; y: number } => {
    const project = run.ctx.project;
    const avoid = [...(taken.get(map.id) ?? [])];
    // 사람은 제 역할 건물(목적표의 집·얼굴 건물) 문 옆에 선다 — 없으면 아래 예전 자리 고르기.
    const home = programAnchor(project, map, who, avoid);
    let where = home ? resolveWhere(project, map, undefined, { avoid, role: "event", at: home, roadOk: true }) : word ? resolveWhere(project, map, word, { avoid, role: "event" }) : undefined;
    if (kinded && (!where || where.note)) {
      const landing = incomingLandings(project, map.id).find((c) => isPassable(project, map, c.x, c.y));
      const hint = pickSpot(project, map, landing ?? walkStart(project, map), new Set(avoid.map((c) => `${c.x},${c.y}`)), rank, 3);
      if (hint) where = resolveWhere(project, map, undefined, { avoid, role: "event", at: hint });
    }
    where ??= resolveWhere(project, map, word, { avoid, role: "event" });
    taken.set(map.id, [...avoid, where.cell]);
    return where.cell;
  };
  /** 이 단계가 전에 지어 둔 스위치·물건 — 다시 지어도 같은 것을 쓴다(그것으로 잠가 둔 문·길이 그대로 열린다). */
  const keptGives = (step: { built?: { switchId?: string; itemId?: string } }): { switchId?: string; itemId?: string } => ({ ...(step.built?.switchId ? { switchId: step.built.switchId } : {}), ...(step.built?.itemId ? { itemId: step.built.itemId } : {}) });
  const lastBattle = steps.reduce((hit, st, i) => (st.kind === "battle" ? i : hit), -1);
  /** 테마에 맞는 그림이 없어 대역을 쓴 것(place/placeTheme 의 없는 그림 줄) — 결과의 missingArt 에 싣는다. */
  const artGaps: string[] = [];
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
    // 사람 단계(종류를 적은 청사진만): talk·choice 는 맵 가운데쯤, battle 은 들어온 곳에서 가장 먼 안쪽에 선다 — 이름으로 물건을 찾는 조사 자리와 다르다.
    const who = step.who?.trim() || undefined;
    const personal = !!who && (step.kind === "talk" || step.kind === "choice" || step.kind === "battle");
    const at = existing ? undefined : spotFor(map, personal ? undefined : `${step.event} 앞`, !!step.kind, step.kind === "battle" ? 0.92 : personal ? 0.45 : 0.3 + 0.13 * (k % 5), personal && step.kind !== "battle" ? who : undefined);
    const t = byId.get(step.id);
    // 대사를 주지 않았으면 모델이 지은 단계 이벤트(명령이 있고, 마지막이면 엔딩을 부르는 것)는 그대로 둔다 — 빠진 단계만 짓는다
    // (standin magic: 마지막 장소 하나가 없을 뿐인데 교장·사서 대화까지 줍기로 덮을 뻔했다).
    // 번호·암호 단계인데 입력 없이 넘어가는 이벤트는 그대로 두지 않는다(mt3 flash: 「비밀번호 입력」이 조사만으로 엔딩).
    const bypass = existing && isCodeStep(step) ? codeStepBypass(run.ctx.project, existing) : undefined;
    if (!text.length && existing && !bypass && !carried.renamed.has(existing.id) && (existing.pages ?? []).some((p) => (p.commands ?? []).length) && (!last || eventGives(run.ctx.project, existing).ends)) {
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
    let base: Omit<ChainLink, "role"> = { mapId: map.id, ...(existing ? { eventId: existing.id } : { name: step.event, at: at! }), ...(needs ? { needs } : {}), ...(!needs && prevCondition ? { needsCondition: prevCondition } : {}), ...(personal ? { person: who, speaker: who } : {}), ...(step.kind === "find" || step.kind === "puzzle" ? { thing: true } : {}), ...(existing && carried.renamed.has(existing.id) ? { relook: true } : {}) };
    prevCondition = undefined;
    // 번호·암호 단계(「비밀번호 입력」「숫자 자물쇠」): 모델이 code 를 안 줬어도 함수가 정답을 정하고, 앞 단계 대사에 답이 없으면
    // 그 답을 적은 단서 고리를 바로 앞에 둔다(앞 단계 결과로 열린다) — 이 단계는 그 단서를 읽어야 열리고 번호를 맞혀야 넘어간다.
    let clueLearn: string | undefined;
    // 모델이 code 를 안 줬어도 앞 단계·이 단계 대사(또는 그대로 둔 앞 이벤트 대사)에 번호를 적었으면 그 번호가 정답이다 — 함수가 새 번호를 정하면
    // 단서 번호가 둘이 된다(2026-10-29 vm3 flash escape: 책상 「비밀번호는 4862다」 + 함수 쪽지 「5858」).
    const told0 = isCodeStep(step) && !t?.code ? modelCode(run, [...steps.slice(0, k).flatMap((st) => byId.get(st.id)?.lines ?? []), ...(t?.lines ?? [])], keptBefore) : undefined;
    const code = isCodeStep(step) || t?.code ? (t?.code ?? told0 ?? stepCode(`${bp.title}|${step.id}|${step.event}`)) : undefined;
    if (code) {
      // 앞선 고리 어느 것이든 그 대사에 번호가 있으면 이미 알려 준 것이다 — 사슬은 순서대로만 열리므로 이 단계에 닿은 플레이어는 그 대사를 지났다.
      // 바로 앞 단계만 보면 두세 단계 앞의 기록이 알려 준 번호를 같은 방의 «번호 쪽지»로 한 번 더 읽어야 자물쇠가 열렸다.
      let told = links.some((l) => [...(l.lines ?? []), ...(l.choice?.options ?? []).flatMap((o) => o.lines ?? [])].some((line) => line.includes(code)));
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
        const where = { cell: spotFor(map, `${keyed ? keyed[1] : "쪽지"} 앞`, !!step.kind, 0.55) };
        const learn = `${step.event} 번호`;
        const note = `쪽지에는 ${digitWord(code.length)} 숫자 「${code}」. 어딘가의 번호인 것 같다.`;
        links.push({ ...base, eventId: undefined, person: undefined, speaker: undefined, thing: true, name: clueName, at: where.cell, role: "clue", learn,
          lines: keyed && needText ? [`${needText}${josa(needText, "으로", "로")} 열자 안에 쪽지가 있다.`, note] : [`${clueName}${josa(clueName, "을", "를")} 살펴보았다.`, note],
          ...(lockedDefault ? { lockedLines: lockedDefault } : {}) });
        linkStep.push(-1);
        base = { mapId: map.id, ...(existing ? { eventId: existing.id } : { name: step.event, at: at! }), needs: learn, ...(base.thing ? { thing: true } : {}), ...(base.person ? { person: base.person, speaker: base.speaker } : {}) };
        clueLearn = learn;
      }
    }
    linkStep.push(k);
    // 사람 단계에 대사를 안 줬으면 «살펴보았다» 대신 그 단계의 할 일을 서술 한 줄로.
    const lines = t?.lines?.length ? t.lines : personal ? [`(${step.action.trim().replace(/[.。]+$/u, "")}.)`] : [lookLine(step.event)];
    // 고르기(choice): 고른 것마다 깃발 — 엔딩 직전에 그 선택의 결과 한 줄(later)이 달라진다.
    const options = step.kind === "choice" ? (t?.choices ?? []).filter((o) => o?.text?.trim()).slice(0, 4) : [];
    const choice = options.length >= 2 ? { options: options.map((o, i) => ({ text: o.text.trim(), ...(o.lines?.length ? { lines: o.lines } : {}), flag: `${step.id} 선택 ${i + 1}` })) } : undefined;
    if (choice) for (const [i, o] of options.entries()) if (o.later?.trim()) variants.push({ needs: `${step.id} 선택 ${i + 1}`, lines: [o.later.trim()] });
    // 싸우기(battle): 대사 뒤 그 상대와 싸워 이겨야 보상·엔딩이 이어진다 — 마지막 싸움은 보스, 앞 싸움은 중간 보스 세기.
    const troopId = step.kind === "battle" && !code ? foeTroop(run.ctx.project, step.id, who, k === lastBattle, map.id, k, artGaps) : undefined;
    if (troopId) { const bg = applyThemeBackdrop(run.ctx.project, map.id); if (bg.gap) artGaps.push(bg.gap); }
    const battle = troopId ? { troopId, winLines: t?.winLines?.length ? t.winLines : [`(${who ?? step.event}${josa(who ?? step.event, "을", "를")} 쓰러뜨렸다.)`] } : undefined;
    const foeLook = troopId ? foeGraphic(run.ctx.project, troopId) : undefined;
    // 몬스터 그림으로 선 상대는 이기면 맵에서 사라진다 — 사람 칩으로 선 상대(그림을 못 찾은 사람)는 남아 뒷말을 한다.
    if (battle) base = { ...base, battle: { ...battle, ...(foeLook ? { leaves: true } : {}) }, ...(foeLook ? { graphic: foeLook } : {}) };
    const codeLocked = clueLearn ? ["번호 자물쇠가 걸려 있다. 번호를 알아야 열 수 있을 것 같다."] : undefined;
    // 모델의 잠김 글은 청사진의 needs 를 보고 쓴 글이다 — 함수가 단서 고리를 끼워 이 단계의 조건을 그 단서로 바꿨으면 쓰지 않는다(조건에서 지은 글만).
    const modelLocked = clueLearn ? undefined : t?.lockedLines?.length ? t.lockedLines : undefined;
    if (last) {
      // 사람이 마지막 단계면: 대사가 없을 때 «살펴보았다»·엔딩 글을 그 사람 입으로 말하게 하지 않는다 — 할 일 한 줄 서술로 열고, 엔딩 글은 (싸움이 있으면 이긴 뒤) 서술로 붙인다.
      const endLines = t?.lines?.length ? t.lines : code ? ["번호 자물쇠다. 알아낸 번호를 맞춰 보자."] : personal ? lines : [lookLine(step.event), bp.ending.how];
      const closingNarration = personal && !t?.lines?.length && !code ? { closeLines: [`(${bp.ending.how.trim()})`] } : {};
      const lockedPerson = personal && needShown ? [`(${who}${josa(who!, "은", "는")} 아직 할 말이 없는 듯하다. ${needShown}${josa(needShown, "이", "가")} 먼저다.)`] : undefined;
      const locked = modelLocked ?? codeLocked ?? lockedPerson ?? lockedDefault;
      links.push({ ...base, role: "ending", endingId: ending!.id, lines: endLines, ...closingNarration, ...(choice ? { choice } : {}), ...(variants.length ? { variants } : {}), ...(code ? { code, reward: { lines: [bp.ending.how] }, ...(t?.options?.length ? { options: t.options } : {}), ...(t?.wrongLines?.length ? { wrongLines: t.wrongLines } : {}) } : {}), ...(locked ? { lockedLines: locked } : {}) });
    } else if (code) {
      const locked = modelLocked ?? codeLocked ?? lockedDefault;
      const reward = isItem(step.gives) ? { item: step.gives, ...keptGives(step) } : { flag: step.gives, ...keptGives(step) };
      links.push({ ...base, role: "code", code, ...(t?.options?.length ? { options: t.options } : {}), lines: t?.lines ?? ["번호 자물쇠다. 알아낸 번호를 맞춰 보자."], ...(locked ? { lockedLines: locked } : {}), ...(t?.wrongLines?.length ? { wrongLines: t.wrongLines } : {}), ...(t?.doneLines?.length ? { doneLines: t.doneLines } : {}), reward });
    } else {
      const item = isItem(step.gives);
      const givesShown = shownToken(step.gives);
      // 사람이 제 말로 건넨 것에는 «『…』을 알아냈다» 를 덧붙이지 않는다(대사가 그 뜻을 전한다 — 다음 할 일은 목표 줄이 알린다).
      const spoken = personal && !!t?.lines?.length && !battle;
      const reward = item ? { item: step.gives, ...keptGives(step) } : { flag: step.gives, ...keptGives(step), ...(spoken ? {} : { lines: [`『${givesShown}』${josa(givesShown, "을", "를")} 알아냈다.`] }) };
      const lockedPerson = personal && needShown ? [`(${who}${josa(who!, "은", "는")} 아직 할 말이 없는 듯하다. ${needShown}${josa(needShown, "이", "가")} 먼저다.)`] : undefined;
      links.push({ ...base, role: "pickup", lines, reward, ...(choice ? { choice } : {}), ...(t?.lockedLines?.length ? { lockedLines: t.lockedLines } : lockedPerson ? { lockedLines: lockedPerson } : lockedDefault ? { lockedLines: lockedDefault } : {}), ...(personal ? (t?.doneLines?.length ? { doneLines: t.doneLines } : battle ? { doneLines: [`(${who}${josa(who!, "은", "는")} 더는 덤비지 않는다.)`] } : choice ? { doneLines: [`(${who}${josa(who!, "과", "와")}는 이미 이야기를 마쳤다.)`] } : {}) : { doneLines: t?.doneLines?.length ? t.doneLines : ["더는 볼 것이 없다."] }) });
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
    // 이 단계가 지어 둔 것을 적는다 — 청사진을 다시 써도 같은 단계가 같은 이벤트·스위치를 물려받는다(blueprintCarry.ts).
    const gave = built.gives?.[li];
    // 넘기는 것이 바뀐 단계(물건 → 깃발 등): 옛 것을 기다리던 문·길의 조건을 새 것으로 옮긴다.
    const moved = step.built ? remapGives(run.ctx.project, step.built, gave) : 0;
    if (moved) warnings.push(`${step.id}: 넘기는 것이 바뀌어 그것을 기다리던 조건 ${moved}개를 새 것으로 옮겼다`);
    step.built = { mapId: made.mapId, eventId: made.eventId, ...(gave?.switchId ? { switchId: gave.switchId } : {}), ...(gave?.itemId ? { itemId: gave.itemId } : {}) };
  });
  let blueprint: GameBlueprint | undefined;
  try { blueprint = normalizeGameBlueprint({ ...bp, steps, retired: undefined }); } catch { blueprint = undefined; }
  if (blueprint) run.ctx.project = { ...run.ctx.project, gameBlueprint: blueprint };
  // 자물쇠 대사가 입력 전에 결과(«입력하자 열렸다»)를 말하면 정답 뒤로 옮기고, 단서 번호와 정답을 맞춘다(codeClues.ts).
  const aligned = alignCodeClues(run.ctx.project);
  run.ctx.project = aligned.project;
  const objectiveNotes = stepObjectives(run, steps, links.map((l, li) => ({ step: linkStep[li]!, name: l.name ?? "", made: eventIds[li] })));
  const roles = links.map((l, i) => `${linkStep[i]! < 0 ? `(단서) ${l.name}` : `${steps[linkStep[i]!]!.id} ${steps[linkStep[i]!]!.event}`}(${l.role}${l.code ? ` 번호 ${l.code}` : ""}${l.needs ? ` ← ${l.needs}` : l.needsCondition ? " ← 앞 단계 이벤트가 켜는 것" : ""})`).join(" → ");
  return { ...built, ...(blueprint ? { blueprint } : {}), warnings: [...warnings, ...built.warnings], missingArt: [...new Set([...built.missingArt, ...artGaps])], summary: `${sealed.length ? `${sealed.join(" / ")}. ` : ""}청사진 경로를 지었다: ${kept.length ? `(그대로 둔 단계: ${kept.join(", ")}) ` : ""}${roles} → 엔딩 「${ending!.name ?? ending!.id}」(${ending!.id}). ${built.summary}${objectiveNotes.length ? ` 목표 줄: ${objectiveNotes.join(" / ")}` : ""}` };
}

/**
 * 싸우는 단계의 상대 무리 — 시작 파티에 맞춘 보스(마지막 싸움)·중간 보스 사본. 상대 이름(who)이 있으면 그 이름을 단 사본을 단계마다 하나 둔다
 * (원본 DB 적은 그대로, 다시 지으면 같은 사본을 고쳐 쓴다). 전투 화면의 적 이름이 청사진의 그 사람이 된다.
 */
function foeTroop(project: Project, stepId: string, who: string | undefined, final: boolean, mapId: string, salt: number, gaps: string[]): string | undefined {
  // 그 장소의 테마에 맞는 상대가 먼저다(사막 유적의 수호자가 늘 «붉은 드래곤» 사본이었다) — 테마가 없는 맵(버들항)만 종전대로 DB 에서 가장 센 무리.
  const themed = themeBossTroop(project, mapId, who, final, salt);
  if (themed.gap) gaps.push(themed.gap);
  const picked = themed.troopId ? undefined : pickFittedTroops(project, undefined);
  const baseId = themed.troopId ?? (final ? picked!.boss : picked!.midBoss) ?? picked!.boss ?? picked!.midBoss ?? picked!.field.at(-1);
  const name = who?.trim();
  const source = project.database.troops.find((t) => t.id === baseId);
  if (!baseId || !source || !name) return baseId;
  const key = stepId.replace(/[^A-Za-z0-9]+/gu, "_").toLowerCase() || "s";
  const id = `${FITTED_TROOP_PREFIX}foe_${key}`, enemyCopyId = `enemy_fit_foe_${key}`;
  const members = (source.members?.length ? source.members.map((m) => m.enemyId) : source.enemyIds) ?? [];
  const lead = project.database.enemies.find((e) => e.id === members[0]);
  if (!lead) return baseId;
  const enemy = { ...structuredClone(lead), id: enemyCopyId, name } as typeof lead;
  const troop = structuredClone(source) as typeof source;
  (troop as { id: string }).id = id;
  (troop as { name?: string }).name = name;
  // 이름은 앞장선 하나만 — 같은 적이 여럿인 무리에서 모두가 그 사람이 되지 않게.
  let renamed = false;
  const swap = (enemyId: string): string => { if (renamed || enemyId !== lead.id) return enemyId; renamed = true; return enemyCopyId; };
  (troop as { enemyIds: string[] }).enemyIds = (source.enemyIds ?? members).map(swap);
  renamed = false;
  if (source.members?.length) (troop as { members: unknown[] }).members = source.members.map((m) => ({ ...m, enemyId: swap(m.enemyId) }));
  const put = <T extends { id: string }>(list: T[], row: T) => { const i = list.findIndex((x) => x.id === row.id); if (i >= 0) list[i] = row; else list.push(row); };
  put(project.database.enemies as { id: string }[], enemy);
  put(project.database.troops as { id: string }[], troop);
  return id;
}
