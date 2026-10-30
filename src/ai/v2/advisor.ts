// 조수 v2 독립 검토자(advisor) — oh-my-pi 의 advisor 역할을 본떴다.
//
// 왜(2026-10-25 조수 단독 게임 G15·G31·G32·G35·G42): 끝맺음 검사(gameChecks.ts)는 사례마다 규칙을 하나씩 더해야 잡는다.
// 거짓 보고(«오프닝을 새로 만들었다» — 실제로는 공장 기본 그대로), 시키지 않은 삭제, 끊긴 고리는 모두 «보고의 주장 ↔ 실제로 바뀐 것»을
// 맞대면 드러난다. 검토자는 조수와 섞이지 않은 새 대화로 요청 원문·도구 기록(압축)·프로젝트 변경 요약·보고 초안만 보고,
// 주장 하나하나를 변경 요약에 대어 aside / concern / blocker 메모를 증거와 함께 돌려준다.
//
// 순수 모듈: 변경 요약·입력 압축·응답 해석·후속 지시문은 결정적 함수다. 모델 호출은 sideChat 하나로만 한다(워커·재생 하네스가 같이 쓴다).
import type { Project } from "@/project/types";
import { battleDataEmptied, placementContentProblems } from "./gameChecks";
import { unsafeSpawnLines } from "@/project/chaserSpawnSafety";
import { audioOnly, musicOnly } from "./musicWords";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);
const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export type AdvisorLevel = "aside" | "concern" | "blocker";
export interface AdvisorNote {
  readonly level: AdvisorLevel;
  /** 보고 속 주장(해당되면). */
  readonly claim?: string;
  readonly what: string;
  /** 변경 요약·도구 기록에서 그 판단을 받치는 줄. */
  readonly evidence: string;
}
export interface AdvisorToolCall {
  readonly name: string;
  readonly ok?: boolean;
  readonly args?: unknown;
  readonly summary?: string;
}
export interface AdvisorInput {
  readonly task: string;
  /** compactToolLog 결과(압축한 한 덩이 글). */
  readonly toolLog: string;
  readonly diff: string;
  readonly report: string;
}
export interface AdvisorVerdict {
  readonly notes: readonly AdvisorNote[];
  readonly ms: number;
  readonly inputChars: number;
  /** 응답을 읽지 못했거나 호출이 실패했으면 그 사유 — 막지 않는다(판정 불가 ≠ 통과). */
  readonly problem?: string;
}

/** 입력 상한(문자). 프로젝트 전체가 아니라 요약만 보낸다 — Argon low 한 번이 몇 초 안에 끝나는 크기. */
export const ADVISOR_LIMITS = { task: 2_000, toolLog: 9_000, diff: 14_000, report: 5_000, perCallArgs: 220, perCallSummary: 200 } as const;

// ───────────────────────── 변경 요약 ─────────────────────────

interface EventView { readonly mapId: string; readonly mapName: string; readonly id: string; readonly name: string; readonly x: number; readonly y: number; readonly pages: readonly Obj[] }

function eventsOf(project: Project): Map<string, EventView> {
  const out = new Map<string, EventView>();
  for (const map of Object.values(project.maps ?? {})) {
    for (const ev of map.events ?? []) {
      const e = ev as unknown as Obj;
      out.set(`${map.id}/${ev.id}`, { mapId: map.id, mapName: map.name || map.id, id: ev.id, name: String(e.name ?? "") || ev.id, x: Number(e.x ?? 0), y: Number(e.y ?? 0), pages: ((ev.pages ?? []) as unknown as Obj[]) });
    }
  }
  for (const ce of project.commonEvents ?? []) {
    const c = ce as unknown as Obj;
    out.set(`common/${String(c.id)}`, { mapId: "common", mapName: "공통 이벤트", id: String(c.id), name: String(c.name ?? c.id), x: 0, y: 0, pages: [{ trigger: { kind: c.trigger ?? "none" }, conditions: c.conditionSwitchId ? [{ kind: "switch", switchId: c.conditionSwitchId, value: true }] : [], commands: c.commands ?? [] }] });
  }
  return out;
}

/** 명령 나무를 모두 걷는다(선택지 갈래·fork then/else·중첩 commands). */
function walk(commands: unknown, visit: (cmd: Obj) => void): void {
  if (!Array.isArray(commands)) return;
  for (const raw of commands) {
    const cmd = obj(raw);
    if (!cmd) continue;
    visit(cmd);
    for (const [key, child] of Object.entries(cmd)) {
      if (key === "condition" || key === "conditions") continue;
      if (!Array.isArray(child)) continue;
      if (child.some((c) => typeof obj(c)?.kind === "string")) walk(child, visit);
      else for (const c of child) { const o = obj(c); if (o) { walk(o.branch, visit); walk(o.commands, visit); } }
    }
  }
}

function condText(conds: unknown): string {
  const list = Array.isArray(conds) ? conds : conds ? [conds] : [];
  const one = (c: Obj): string => {
    if (Array.isArray(c.conditions)) return `${String(c.kind ?? "all")}(${(c.conditions as unknown[]).map((x) => one(obj(x) ?? {})).join(",")})`;
    if (c.switchId) return `${String(c.switchId)}=${c.value === false ? "off" : "on"}`;
    if (c.variableId) return `${String(c.variableId)}${String(c.op ?? "==")}${String(c.value)}`;
    if (c.kind === "selfSwitch") return `self:${String(c.key)}=${c.value === false ? "off" : "on"}`;
    if (c.kind === "item" || c.itemId) return `item:${String(c.itemId ?? c.id)}`;
    return String(c.kind ?? "?");
  };
  const parts = list.map((c) => one(obj(c) ?? {}));
  return parts.length ? parts.join(" & ") : "always";
}

interface PageFacts { readonly sets: Set<string>; readonly offs: Set<string>; readonly vars: Set<string>; readonly calls: Set<string>; readonly lines: string[]; readonly kinds: Map<string, number>; readonly endings: Set<string>; readonly transparent: boolean; readonly sprite: string }

function pageFacts(page: Obj): PageFacts {
  const sets = new Set<string>(), offs = new Set<string>(), vars = new Set<string>(), calls = new Set<string>(), endings = new Set<string>();
  const lines: string[] = [];
  const kinds = new Map<string, number>();
  walk(page.commands, (cmd) => {
    const kind = String(cmd.kind ?? "");
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    if (kind === "setSwitch" && typeof cmd.switchId === "string") (cmd.value === false ? offs : sets).add(cmd.switchId);
    if (kind === "setVariable" && typeof cmd.variableId === "string") vars.add(`${cmd.variableId}${String(cmd.op ?? "=")}${String(cmd.value ?? "")}`);
    if (kind === "callCommonEvent" && typeof cmd.commonEventId === "string") calls.add(cmd.commonEventId);
    if ((kind === "triggerEnding" || kind === "gameOver") ) endings.add(kind === "gameOver" ? "gameOver" : String(cmd.endingId ?? "ending"));
    if (kind === "text" && typeof cmd.body === "string") lines.push(`${cmd.speaker ? `${String(cmd.speaker)}: ` : ""}${cmd.body}`);
    if (kind === "choices" && Array.isArray(cmd.options)) lines.push(`[선택] ${(cmd.options as unknown[]).map((o) => String(obj(o)?.text ?? "")).join(" / ")}`);
  });
  const graphic = obj(page.graphic);
  const sprite = obj(graphic?.sprite);
  return { sets, offs, vars, calls, lines, kinds, endings, transparent: graphic?.transparent === true || (!sprite && !graphic?.tileId), sprite: sprite ? `${String(sprite.id ?? "")}${graphic?.pattern !== undefined ? `:${String(graphic.pattern)}` : ""}` : "" };
}

function pageLine(page: Obj, index: number, detail: "full" | "short"): string {
  const f = pageFacts(page);
  const trig = String(obj(page.trigger)?.kind ?? "action");
  const bits = [
    `p${index} [${condText(page.conditions)}] ${trig}${f.transparent ? " 보이지 않음" : f.sprite ? ` 그림 ${f.sprite}` : ""}`,
    f.lines.length ? `대사 ${f.lines.length}줄` : "",
    f.sets.size ? `켬 ${[...f.sets].join(",")}` : "",
    f.offs.size ? `끔 ${[...f.offs].join(",")}` : "",
    f.vars.size ? `변수 ${[...f.vars].slice(0, 4).join(",")}` : "",
    f.calls.size ? `부름 ${[...f.calls].join(",")}` : "",
    f.endings.size ? `끝 ${[...f.endings].join(",")}` : "",
  ].filter(Boolean);
  const special = [...f.kinds.entries()].filter(([k]) => !["text", "choices", "setSwitch", "setVariable", "callCommonEvent", "changeFace", "wait"].includes(k)).map(([k, n]) => (n > 1 ? `${k}×${n}` : k));
  if (special.length) bits.push(`명령 ${special.slice(0, 10).join(",")}`);
  const sample = detail === "full" ? f.lines.slice(0, 3).map((l) => `「${clip(l, 70)}」`).join(" ") : f.lines.slice(0, 1).map((l) => `「${clip(l, 50)}」`).join("");
  return `${bits.join(" · ")}${sample ? ` ${sample}` : ""}`;
}

function eventBlock(ev: EventView, detail: "full" | "short"): string {
  const head = ev.mapId === "common" ? `공통 이벤트 ${ev.id} «${ev.name}»` : `«${ev.name}» ${ev.id} (${ev.x},${ev.y}) @${ev.mapName}`;
  return [head, ...ev.pages.slice(0, detail === "full" ? 9 : 4).map((p, i) => `    ${pageLine(p, i, detail)}`), ...(ev.pages.length > (detail === "full" ? 9 : 4) ? [`    … 페이지 ${ev.pages.length}개`] : [])].join("\n");
}

/** 프로젝트 전체에서 켜는 쪽·기다리는 쪽(스위치). */
function switchGraph(project: Project): { setters: Map<string, Set<string>>; readers: Map<string, Set<string>> } {
  const setters = new Map<string, Set<string>>(), readers = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, id: string, who: string) => { const s = m.get(id) ?? new Set<string>(); s.add(who); m.set(id, s); };
  const readCond = (c: unknown, who: string): void => {
    const o = obj(c);
    if (!o) { if (Array.isArray(c)) for (const x of c) readCond(x, who); return; }
    if (typeof o.switchId === "string" && o.value !== false) add(readers, o.switchId, who);
    readCond(o.conditions, who); readCond(o.condition, who);
  };
  for (const ev of eventsOf(project).values()) {
    for (const page of ev.pages) {
      readCond(page.conditions, ev.name);
      walk(page.commands, (cmd) => {
        readCond(cmd.condition, ev.name);
        if (cmd.kind === "setSwitch" && typeof cmd.switchId === "string" && cmd.value !== false) add(setters, cmd.switchId, ev.name);
        if ((cmd.kind === "setSwitchRange" || cmd.kind === "controlSwitches") && typeof cmd.switchId === "string") add(setters, cmd.switchId, ev.name);
      });
    }
  }
  for (const ending of project.endings ?? []) readCond(ending.conditions, `엔딩 ${ending.name}`);
  for (const ce of project.commonEvents ?? []) if (ce.conditionSwitchId && ce.trigger !== "none") add(readers, ce.conditionSwitchId, `공통 이벤트 ${ce.name}`);
  return { setters, readers };
}

function openingText(project: Project): string {
  const op = project.system?.opening as unknown as Obj | undefined;
  if (!op) return "없음";
  const scenes = (Array.isArray(op.scenes) ? op.scenes : []) as Obj[];
  const entry = obj(op.entry);
  const factory = scenes.some((s) => /강을 낀 왕국에는 오래도록 전쟁이 없었다/u.test(String(s.narration ?? "")) || s.resourceId === "oprn-still-kingdom-day");
  return `${op.enabled ? "켜짐" : "꺼짐"}${entry ? ` 재생 ${String(entry.mode ?? "")}` : ""} · 장면 ${scenes.length}개${factory ? " · ⚠ 프로젝트 공장 기본(왕국·검 이야기) 그대로" : ""}: ${scenes.slice(0, 5).map((s) => `${String(s.kind)}${s.resourceId ? `(${String(s.resourceId)})` : ""} 「${clip(String(s.narration ?? ""), 40)}」`).join(" / ")}`;
}

function titleText(project: Project): string {
  const t = project.system?.titleScreen as unknown as Obj | undefined;
  if (!t) return "없음";
  const menu = obj(t.menuLabels);
  return `「${String(t.title ?? "")}」 배경 ${String(t.backgroundResourceId ?? "-")}${t.preset ? ` 프리셋 ${String(t.preset)}` : ""}${obj(t.titleGraphic) ? ` 로고 ${String(obj(t.titleGraphic)!.resourceId ?? "")}` : ""}${menu ? ` 메뉴 ${Object.values(menu).map(String).join("/")}` : ""}`;
}

function hudText(project: Project): string {
  const h = obj((project.system as unknown as Obj | undefined)?.fieldHud);
  const time = obj((project.system as unknown as Obj | undefined)?.timeSystem);
  return `${h ? `HUD ${String(h.theme ?? "")} 체력 ${h.vitals ? "보임" : "숨김"} 시계 ${h.clock ? "보임" : "숨김"}` : "HUD 기본(체력 하트 보임)"}${time ? ` · 시간 시스템 ${time.enabled === false ? "꺼짐" : "켜짐"}` : ""}`;
}

const stable = (v: unknown): string => JSON.stringify(v ?? null);

/**
 * 이 실행이 프로젝트에 한 일의 요약 — 검토자가 보고 속 주장을 대어 볼 «사실». 결정적이고 상한이 있다.
 * 맵(추가·삭제·이름) · 이벤트(추가·삭제·바뀐 것의 페이지 한 줄씩) · 스위치/변수/공통 이벤트 · 오프닝 · 타이틀 · HUD · 엔딩 ·
 * 끊긴 고리(전에는 켜는 곳이 있었는데 지금은 없고 지금도 기다리는 곳이 있는 스위치) · 아무도 켜지 않는데 기다리는 스위치(이번에 바뀐 이벤트만).
 */
export function summarizeProjectDiff(before: Project, after: Project, maxChars: number = ADVISOR_LIMITS.diff): string {
  const out: string[] = [];
  // 맵
  const bm = before.maps ?? {}, am = after.maps ?? {};
  const mapsAdded = Object.keys(am).filter((id) => !bm[id]);
  const mapsRemoved = Object.keys(bm).filter((id) => !am[id]);
  const mapsRenamed = Object.keys(am).filter((id) => bm[id] && bm[id]!.name !== am[id]!.name);
  const tilesChanged = Object.keys(am).filter((id) => bm[id] && (stable(bm[id]!.lowerTiles) !== stable(am[id]!.lowerTiles) || stable(bm[id]!.upperTiles) !== stable(am[id]!.upperTiles) || bm[id]!.width !== am[id]!.width || bm[id]!.height !== am[id]!.height));
  const bgmChanged = Object.keys(am).filter((id) => bm[id] && stable((bm[id] as unknown as Obj).bgm) !== stable((am[id] as unknown as Obj).bgm));
  out.push(`## 맵 (지금 ${Object.keys(am).length}개)`);
  if (mapsAdded.length) out.push(`추가: ${mapsAdded.map((id) => `${am[id]!.name || id} ${am[id]!.width}×${am[id]!.height}`).join(", ")}`);
  if (mapsRemoved.length) out.push(`삭제: ${mapsRemoved.map((id) => bm[id]!.name || id).join(", ")}`);
  if (mapsRenamed.length) out.push(`이름 바뀜: ${mapsRenamed.map((id) => `${bm[id]!.name} → ${am[id]!.name}`).join(", ")}`);
  if (tilesChanged.length) out.push(`타일·크기 바뀜: ${tilesChanged.map((id) => am[id]!.name || id).join(", ")}`);
  if (bgmChanged.length) out.push(`배경음 바뀜: ${bgmChanged.map((id) => am[id]!.name || id).join(", ")}`);
  if (!mapsAdded.length && !mapsRemoved.length && !mapsRenamed.length && !tilesChanged.length && !bgmChanged.length) out.push("바뀐 맵 없음");
  if (before.startMapId !== after.startMapId || stable(before.startPos) !== stable(after.startPos)) out.push(`시작 위치: ${before.startMapId}${stable(before.startPos)} → ${after.startMapId}${stable(after.startPos)}`);

  // 이벤트
  const be = eventsOf(before), ae = eventsOf(after);
  const added = [...ae.entries()].filter(([k]) => !be.has(k)).map(([, v]) => v);
  const removed = [...be.entries()].filter(([k]) => !ae.has(k)).map(([, v]) => v);
  const changed = [...ae.entries()].filter(([k, v]) => be.has(k) && (stable(be.get(k)!.pages) !== stable(v.pages) || be.get(k)!.name !== v.name)).map(([k, v]) => ({ now: v, was: be.get(k)! }));
  const moved = [...ae.entries()].filter(([k, v]) => be.has(k) && (be.get(k)!.x !== v.x || be.get(k)!.y !== v.y)).map(([k, v]) => `«${v.name}» (${be.get(k)!.x},${be.get(k)!.y})→(${v.x},${v.y})`);
  out.push(`## 이벤트 (추가 ${added.length} · 삭제 ${removed.length} · 바뀜 ${changed.length} · 옮김 ${moved.length})`);
  // 이름·id 가 같은 것이 지워졌다가 다시 생겼으면(삭제 후 재생성) 그렇다고 적는다 — 「되돌렸다/그대로 둔다」 주장을 가린다.
  for (const ev of removed) out.push(`삭제: ${eventBlock(ev, "short")}`);
  for (const ev of added) out.push(`추가: ${eventBlock(ev, "full")}`);
  for (const { now, was } of changed) {
    const rename = was.name !== now.name ? ` (이름 «${was.name}» → «${now.name}»)` : "";
    out.push(`바뀜${rename}: ${eventBlock(now, "full")}`);
    const nowLines = new Set(pageFacts({ commands: now.pages.flatMap((p) => (Array.isArray(p.commands) ? p.commands : [])) }).lines);
    const lostLines = pageFacts({ commands: was.pages.flatMap((p) => (Array.isArray(p.commands) ? p.commands : [])) }).lines.filter((l) => !nowLines.has(l));
    // 사라진 페이지 — 조건이 같은 페이지가 더는 없다(예: 호감 ≥4 페이지가 날짜별 다시 쓰기에서 빠졌다, G15). 그 페이지의 대사·선택지를 함께 적는다.
    const nowConds = new Set(now.pages.map((p) => condText(p.conditions)));
    const lostPages = was.pages.map((p, i) => ({ p, i, cond: condText(p.conditions) })).filter((x) => !nowConds.has(x.cond));
    for (const { p, i, cond } of lostPages.slice(0, 4)) {
      const f = pageFacts(p);
      out.push(`    ⚠ 사라진 페이지 p${i} [${cond}] (이 조건의 페이지가 이제 없다)${f.sets.size ? ` 켜던 것 ${[...f.sets].join(",")}` : ""}${f.calls.size ? ` 부르던 것 ${[...f.calls].join(",")}` : ""}: ${f.lines.slice(0, 3).map((l) => `「${clip(l, 70)}」`).join(" ")}`);
    }
    if (lostLines.length) out.push(`    전에 있던 대사 중 사라진 것 ${lostLines.length}줄: ${lostLines.slice(0, 5).map((l) => `「${clip(l, 60)}」`).join(" ")}`);
    if (was.pages.length !== now.pages.length) out.push(`    페이지 ${was.pages.length} → ${now.pages.length}`);
  }
  if (moved.length) out.push(`옮김: ${moved.slice(0, 12).join(", ")}`);

  // 스위치·변수·공통 이벤트
  const sw = (p: Project) => new Map((p.switches ?? []).map((s) => [s.id, s.name]));
  const bs = sw(before), as = sw(after);
  const swAdded = [...as.keys()].filter((id) => !bs.has(id) || (!bs.get(id) && as.get(id)));
  const vAdded = (after.variables ?? []).filter((v) => !(before.variables ?? []).some((b) => b.id === v.id));
  const ceAdded = (after.commonEvents ?? []).filter((c) => !(before.commonEvents ?? []).some((b) => b.id === c.id));
  if (swAdded.length || vAdded.length || ceAdded.length) out.push(`## 깃발\n${swAdded.length ? `스위치 새 이름/추가: ${swAdded.slice(0, 12).map((id) => `${id} «${as.get(id) ?? ""}»`).join(", ")}\n` : ""}${vAdded.length ? `변수 추가: ${vAdded.slice(0, 10).map((v) => `${v.id} «${v.name}»`).join(", ")}\n` : ""}${ceAdded.length ? `공통 이벤트 추가: ${ceAdded.map((c) => `${c.id} «${c.name}»`).join(", ")}` : ""}`.trimEnd());

  // 끊긴 고리 / 아무도 켜지 않는 스위치(이번에 바뀐 이벤트가 기다리는 것만)
  const g0 = switchGraph(before), g1 = switchGraph(after);
  const lost = [...g0.setters.keys()].filter((id) => !g1.setters.has(id) && g1.readers.has(id));
  const touchedNames = new Set([...added, ...changed.map((c) => c.now)].map((e) => e.name));
  // 켜는 곳 없이 기다리는 스위치 — 이번에 바뀐 이벤트가 기다리는 것과, 전부터 그랬던 것을 나눠 적는다(전부터 그랬던 것은 이 실행 탓이 아닐 수 있다).
  const orphan = [...g1.readers.entries()].filter(([id]) => !g1.setters.has(id) && !lost.includes(id));
  const orphanNow = orphan.filter(([, who]) => [...who].some((w) => touchedNames.has(w)));
  const orphanOld = orphan.filter(([, who]) => ![...who].some((w) => touchedNames.has(w)));
  if (lost.length || orphan.length) {
    out.push("## 고리 검사(결정적)");
    for (const id of lost) out.push(`끊김(이번 실행): ${id} — 전에는 ${[...g0.setters.get(id)!].join(",")}가 켰는데 이제 켜는 곳이 없다; 기다리는 쪽 ${[...g1.readers.get(id)!].join(",")}`);
    for (const [id, who] of orphanNow.slice(0, 8)) out.push(`켜는 곳 없음(이번에 바뀐 이벤트): ${id} — ${[...who].join(",")}가 기다리지만 아무도 켜지 않는다`);
    for (const [id, who] of orphanOld.slice(0, 6)) out.push(`켜는 곳 없음(이번 실행 전부터): ${id} — ${[...who].join(",")}가 기다린다`);
  }

  // 오프닝·타이틀·HUD·엔딩
  const bo = stable(before.system?.opening), ao = stable(after.system?.opening);
  out.push(`## 오프닝 ${bo === ao ? "(이번에 바뀌지 않음)" : "(바뀜)"}\n지금: ${openingText(after)}${bo !== ao ? `\n전: ${openingText(before)}` : ""}`);
  const bt = stable(before.system?.titleScreen), at = stable(after.system?.titleScreen);
  out.push(`## 타이틀 ${bt === at ? "(바뀌지 않음)" : "(바뀜)"}: ${titleText(after)}`);
  const bh = hudText(before), ah = hudText(after);
  out.push(`## 화면 표시 ${bh === ah ? "(바뀌지 않음)" : `(바뀜, 전: ${bh})`}: ${ah}`);
  const ben = before.endings ?? [], aen = after.endings ?? [];
  if (stable(ben) !== stable(aen) || aen.length) out.push(`## 엔딩 ${stable(ben) === stable(aen) ? "(바뀌지 않음)" : "(바뀜)"}: ${aen.map((e) => `${e.id} «${e.name}» 조건 ${condText(e.conditions)}${e.epilogue?.length ? ` 에필로그 ${e.epilogue.length}개` : ""}`).join(" / ") || "없음"}${ben.filter((e) => !aen.some((a) => a.id === e.id)).map((e) => ` · 삭제 ${e.id}`).join("")}`);

  // 데이터베이스(개수만)
  const db0 = (before.database ?? {}) as unknown as Obj, db1 = (after.database ?? {}) as unknown as Obj;
  const dbChanged = Object.keys(db1).filter((k) => Array.isArray(db1[k]) && stable(db0[k]) !== stable(db1[k])).map((k) => `${k} ${Array.isArray(db0[k]) ? (db0[k] as unknown[]).length : 0}→${(db1[k] as unknown[]).length}`);
  if (dbChanged.length) out.push(`## 데이터베이스 바뀜: ${dbChanged.slice(0, 12).join(", ")}`);
  // 개수만으로는 «주인공 기술·직업 전투 데이터를 비웠다»가 안 보인다(2026-10-25 장난감 가게 고치기 4턴: actors 136→136).
  for (const line of battleDataEmptied(before, after, "").slice(0, 4)) out.push(`⚠ 비운 데이터: ${line.replace(/^\[[^\]]*\]\s*/u, "").split(" — ")[0]}`);
  // 놓기·방 쓰임(J5·J6·J40·J42·J64, 사용자 규칙): 차도 위 사람, 출구 길막, 카운터 손님 쪽 주인, 물건 밖 조사 이벤트, 다른 방 가구 — 「방을 예배당답게 꾸몄다」 같은 주장에 대어 본다.
  for (const line of placementContentProblems(before, after).slice(0, 5)) out.push(`⚠ 놓기: ${clip(line.split(" — ")[0]!, 360)}`);

  // 추격자(J54·J61): 「순찰하다 보면 쫓는다」는 주장에 대어 볼 사실 — 순찰 길 유무·시야, 그리고 태어나자마자 잡히는 시작·체크포인트.
  for (const map of Object.values(after.maps ?? {})) for (const ev of map.events ?? []) {
    const mv = (ev.pages ?? []).map((page) => obj((page as unknown as Obj).movement)).find((m) => m?.type === "chase");
    if (!mv) continue;
    const steps = Array.isArray(obj(mv.route)?.moves) ? (obj(mv.route)!.moves as unknown[]).filter((m) => obj(m)?.kind === "move").length : 0;
    const sight = Number(obj(mv.sight)?.range ?? mv.sightRange ?? 0);
    out.push(`추격자 «${ev.name || ev.id}» ${ev.id} (${ev.x},${ev.y}) @${map.name || map.id}: ${steps ? `순찰 ${steps}걸음` : "순찰 없음(제자리)"} · 시야 ${sight || "기본"}`);
  }
  for (const entry of unsafeSpawnLines(after).slice(0, 3)) out.push(`⚠ 위협: ${clip(entry.line.split(" — ")[0]!, 300)}`);

  const text = out.join("\n");
  return text.length > maxChars ? `${text.slice(0, maxChars - 40)}\n… (요약 ${text.length}자 중 앞부분)` : text;
}

// ───────────────────────── 입력 압축 ─────────────────────────

const READ_TOOLS = new Set(["inspect", "find_events", "get_event", "get_story_state", "get_database_records", "list_npc_graphics", "list_resources", "inspect_opening_timeline", "find_switch_usage", "read_npc_layout", "list_endings", "get_animatic_capabilities", "get_title_screen", "get_opening", "find_empty_ground", "show_map_region", "read_directing_guide", "find_tools"]);

function argsText(args: unknown): string {
  if (args === undefined || args === null) return "";
  const raw = typeof args === "string" ? args : JSON.stringify(args);
  return clip(raw.replace(/\s+/gu, " "), ADVISOR_LIMITS.perCallArgs);
}

/** 도구 기록 압축: 쓰기·실패는 한 줄씩(인자 앞부분 + 요약), 읽기는 이름별 횟수로 묶는다. */
export function compactToolLog(calls: readonly AdvisorToolCall[], maxChars: number = ADVISOR_LIMITS.toolLog): string {
  const lines: string[] = [];
  const reads = new Map<string, number>();
  const flushReads = () => { if (reads.size) { lines.push(`(읽기 ${[...reads.entries()].map(([n, c]) => (c > 1 ? `${n}×${c}` : n)).join(", ")})`); reads.clear(); } };
  calls.forEach((c) => {
    if (READ_TOOLS.has(c.name) && c.ok !== false) { reads.set(c.name, (reads.get(c.name) ?? 0) + 1); return; }
    flushReads();
    lines.push(`${lines.length + 1}. ${c.name}${c.ok === false ? " ✗실패" : ""} ${argsText(c.args)} → ${clip(String(c.summary ?? "").replace(/\s+/gu, " "), ADVISOR_LIMITS.perCallSummary)}`);
  });
  flushReads();
  let text = lines.join("\n");
  if (text.length > maxChars) {
    // 앞(무엇을 지었나)과 뒤(마지막 상태)를 남기고 가운데를 줄인다.
    const head = text.slice(0, Math.floor(maxChars * 0.45)), tail = text.slice(text.length - Math.floor(maxChars * 0.5));
    text = `${head}\n… (도구 기록 ${calls.length}건 중 가운데 생략)\n${tail}`;
  }
  return text;
}

// ───────────────────────── 지시문 ─────────────────────────

export function advisorPrompt(input: AdvisorInput): string {
  return [
    "You are an independent ADVISOR reviewing one turn of an AI assistant that edits an RPG-maker style game project for a non-expert Korean user.",
    "You did not take part in the turn. You see: the user's request, a compact log of the assistant's tool calls, a deterministic SUMMARY OF WHAT ACTUALLY CHANGED (computed from the project before and after the turn — this is the ground truth), and the assistant's draft final report to the user.",
    "Do four checks. Judge only from the evidence. Be literal: names, ids, counts and states in the summary are exact.",
    "1. claims — list every concrete thing the report says was built, changed, renamed, fixed, removed or kept. For each, status is:",
    "   \"shown\" = the summary (or a write in the tool log) shows it; \"contradicted\" = the summary shows the opposite (e.g. report says an event was renamed to X but the summary shows the event still named Y or no rename; report says the opening was rebuilt but the summary says the opening did not change or is still the factory default ⚠); \"not_shown\" = it is a change claim but nothing in the summary or the write log shows it. Claims about tests/checks passing, about how something plays, or about things left undone are not checked here — skip them.",
    "   Names count: when the report calls an event, person, map or switch by a name, that name must match the summary. If the report uses a new name (e.g. «태엽 병정 장난감») but the summary still shows the event under its old name (no 이름 바뀜 line), that claim is contradicted.",
    "   What the summary cannot show: it lists events, pages, flags, opening, title, HUD and endings exactly, but for map tiles it only says «타일·크기 바뀜». Claims about furniture, props, floor, walls or decoration inside a map whose tiles changed are \"shown\" if a successful build/edit write touched that map — never \"contradicted\". A later tool call that changed nothing (바꾼 것 없음) or was reverted does not undo an earlier successful one.",
    "   Keeping counts: «기존 … 유지 / 그대로 작동 / 원래대로» is a claim. A ⚠ 사라진 페이지 line or 사라진 대사 for that behaviour contradicts it — content moved to a different condition (e.g. from an affection condition to a day condition) is NOT kept.",
    "2. removals — every event, map, ⚠ 사라진 페이지 or ⚠ 비운 데이터 line the summary shows as deleted that the user did not ask to remove (a page rewritten under a different condition counts as removed). mentioned = true ONLY if the report explicitly tells the user that this was removed, replaced or deleted; saying the old behaviour is kept/유지 is NOT mentioning it.",
    "3. unreachable — lines of the summary's 고리 검사. Include an «이번 실행 전부터» line only if it is about the same person/event/feature the user asked about in this request. report_says_works = the report says everything works / nothing left (못 한 것 없음 / 다 됐습니다 / 그대로 작동).",
    "4. missing — parts of the request that the summary shows were not done at all. report_says_done = the report claims that part is done.",
    "Do not flag style, wording or ideas the user did not ask for. Reads, previews and tests do not change the project. An empty list is the right answer when nothing is wrong. Korean one-line texts.",
    'Reply with JSON only: {"claims":[{"claim":"보고 문장 그대로(짧게)","status":"shown|contradicted|not_shown","evidence":"요약·기록의 근거 줄"}],"removals":[{"what":"무엇이 지워졌나","mentioned":true|false,"evidence":"근거 줄"}],"unreachable":[{"what":"...","report_says_works":true|false,"evidence":"..."}],"missing":[{"part":"요청의 어느 부분","report_says_done":true|false,"evidence":"..."}],"notes":[{"level":"concern|aside","what":"그 밖의 우려(있으면)","evidence":"..."}]}',
    "",
    `# 사용자 요청\n${clip(input.task, ADVISOR_LIMITS.task)}`,
    `# 도구 기록(압축)\n${input.toolLog || "(도구 호출 없음)"}`,
    `# 실제로 바뀐 것(정본 요약)\n${input.diff}`,
    `# 보고 초안\n${clip(input.report || "(보고 없음)", ADVISOR_LIMITS.report)}`,
  ].join("\n");
}

/**
 * 응답을 메모로 바꾼다. 등급은 모델이 아니라 여기서 정한다 — 모델에게 「막음/우려」를 고르게 하면(2026-10-25 재생 1판) 시키지 않은 삭제와
 * 거짓 오프닝 주장을 모두 「우려」로 낮췄다. 모델은 사실(주장이 보이나·삭제를 알렸나)만 가리고, 막음 기준은 코드가 쥔다:
 * 반대되는 주장·알리지 않은 삭제·「다 됐다」면서 빠진 부분·「다 된다」면서 끊긴 고리 = 막음, 보이지 않는 주장 = 우려.
 */
export function parseAdvisorReply(text: string): { notes: AdvisorNote[]; problem?: string } {
  const match = text.match(/\{[\s\S]*\}/u)?.[0];
  let parsed: Obj | undefined;
  try { parsed = match ? (JSON.parse(match) as Obj) : undefined; } catch { parsed = undefined; }
  if (!parsed) return { notes: [], problem: "검토자 응답을 읽지 못했다" };
  const rows = (key: string): Obj[] => (Array.isArray(parsed![key]) ? (parsed![key] as unknown[]).map(obj).filter((x): x is Obj => !!x) : []);
  const str = (v: unknown, n: number) => clip(String(v ?? "").trim(), n);
  const notes: AdvisorNote[] = [];
  for (const c of rows("claims")) {
    const claim = str(c.claim, 200);
    if (!claim) continue;
    if (c.status === "contradicted") notes.push({ level: "blocker", claim, what: `보고의 주장이 실제 변경과 반대다`, evidence: str(c.evidence, 300) });
    else if (c.status === "not_shown") notes.push({ level: "concern", claim, what: `보고의 주장이 실제 변경에 보이지 않는다`, evidence: str(c.evidence, 300) });
  }
  for (const r of rows("removals")) if (str(r.what, 10)) notes.push({ level: r.mentioned === true ? "aside" : "blocker", what: `${r.mentioned === true ? "알린 삭제" : "시키지 않았고 보고에도 없는 삭제"}: ${str(r.what, 240)}`, evidence: str(r.evidence, 300) });
  for (const u of rows("unreachable")) if (str(u.what, 10)) notes.push({ level: u.report_says_works === true ? "blocker" : "concern", what: `닿을 수 없는 내용: ${str(u.what, 240)}`, evidence: str(u.evidence, 300) });
  for (const m of rows("missing")) if (str(m.part, 10)) notes.push({ level: m.report_says_done === true ? "blocker" : "concern", what: `요청 중 안 된 부분: ${str(m.part, 240)}`, evidence: str(m.evidence, 300) });
  for (const n of rows("notes")) if (str(n.what, 10)) notes.push({ level: n.level === "concern" ? "concern" : "aside", what: str(n.what, 300), evidence: str(n.evidence, 300) });
  if (!["claims", "removals", "unreachable", "missing", "notes"].some((k) => Array.isArray(parsed![k]))) return { notes: [], problem: "검토자 응답 형식이 다르다" };
  return { notes: notes.slice(0, 16) };
}

/** 검토 한 번. sideChat 은 조수와 섞이지 않는 새 대화(같은 모델 또는 별도 검토 모델). 실패해도 던지지 않는다. */
export async function adviseTurn(input: AdvisorInput, sideChat: (messages: readonly unknown[], signal?: AbortSignal) => Promise<string>, signal?: AbortSignal): Promise<AdvisorVerdict> {
  const t0 = Date.now();
  const text = advisorPrompt(input);
  try {
    const reply = await sideChat([{ role: "user", content: text }], signal);
    const { notes, problem } = parseAdvisorReply(reply);
    return { notes, ms: Date.now() - t0, inputChars: text.length, ...(problem ? { problem } : {}) };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { notes: [], ms: Date.now() - t0, inputChars: text.length, problem: `검토자 호출 실패: ${clip(error instanceof Error ? error.message : String(error), 160)}` };
  }
}

/**
 * 출하 검사(src/ai/v2/shipChecks.ts shipBlockers — 편집기 기본값이 남음·한 줄 엔딩·제목 스포일러)를 막는 메모로 붙인다.
 * 모델 판단이 아니라 코드 검사라 항상 blocker 다. 같은 id 를 두 번 넣지 않는다.
 */
export function withShipBlockers(verdict: AdvisorVerdict, blockers: readonly { readonly id: string; readonly message: string; readonly evidence: string }[]): AdvisorVerdict {
  if (!blockers.length) return verdict;
  const seen = new Set(verdict.notes.map((n) => n.what));
  const extra = blockers.map((b): AdvisorNote => ({ level: "blocker", what: `[출하 차단 ${b.id}] ${b.message}`, evidence: b.evidence }))
    .filter((n) => !seen.has(n.what));
  return { ...verdict, notes: [...verdict.notes, ...extra] };
}

/** 요청 자체를 두고 한 지적(보고 주장·삭제·빠진 부분) — 음악만 바라는 요청에서도 일감이다. 나머지는 프로젝트에 이미 있던 것에 대한 지적이다. */
const ABOUT_THIS_REQUEST = /^(보고의 주장|알린 삭제|시키지 않았고|요청 중 안 된 부분)/u;
/**
 * 음악·효과음만 바라는 요청(musicWords.audioOnly)이면 요청 밖 지적(출하 차단·끊긴 고리·그 밖의 우려)을 참고(aside)로 낮춘다 — 일감으로 넘기지 않는다.
 * 2026-10-30 실조수 r12: 「추격 음악」에 «체크포인트가 추격자 시야 안» 우려가 넘어가 조수가 상자를 찍고 make_chase_scene 을 불렀다.
 */
export function scopeAdviceToRequest(verdict: AdvisorVerdict, task: string): AdvisorVerdict {
  if (!audioOnly(task)) return verdict;
  const label = musicOnly(task) ? "음악" : "효과음";
  return { ...verdict, notes: verdict.notes.map((n) => ABOUT_THIS_REQUEST.test(n.what) ? n : { ...n, level: "aside" as const, what: `(${label} 요청 밖 — 고치지 않음) ${n.what}` }) };
}

/** 막는 메모가 있으면 한 차례 더 돌릴 지시문. 없으면 undefined(검토 메모는 조수 기록에만 남는다). */
export function advisorFollowUp(verdict: AdvisorVerdict): string | undefined {
  const blockers = verdict.notes.filter((n) => n.level === "blocker");
  if (!blockers.length) return undefined;
  const others = verdict.notes.filter((n) => n.level !== "blocker");
  return [
    "[독립 검토자] 보고 초안을 실제 변경 기록과 맞대어 본 독립 검토자가 아래를 막았다. 「다 됐다」고 끝내기 전에 하나씩 처리한다:",
    ...blockers.map((n, i) => `${i + 1}. ${n.claim ? `보고 「${n.claim}」 — ` : ""}${n.what} (근거: ${n.evidence || "-"})`),
    "각각 둘 중 하나: (가) 고친다 — 도구로 실제로 바꾸고 get_event 등으로 다시 읽어 확인한다. (나) 고칠 수 없거나 사용자가 원한 게 아니면 고치지 않고, 최종 보고에 그 사실을 그대로 쓴다(«했다»고 쓰지 않는다).",
    "시키지 않은 삭제·재작성이었다면 restore_event{eventId} 로 요청 전 그대로 되살리거나(기억으로 upsert_event 를 다시 쓰지 않는다 — 이름·조건이 달라진다), 왜 지웠는지 보고에 분명히 쓴다.",
    ...(others.length ? ["참고(막지는 않음):", ...others.map((n) => `- [${n.level}] ${n.what}`)] : []),
    "끝나면 앞 보고를 대신하는 최종 보고 하나를 「최종 보고(앞 보고를 고침):」로 시작해 다시 쓴다. 보고에는 실제로 바뀐 것만 «했다»고 쓰고, 검토자가 짚은 것을 어떻게 처리했는지(고침/못 함) 밝힌다.",
  ].join("\n");
}

/** 기록용 한 줄 요약. */
export function advisorSummary(verdict: AdvisorVerdict): string {
  const count = (l: AdvisorLevel) => verdict.notes.filter((n) => n.level === l).length;
  return `독립 검토자: 막음 ${count("blocker")} · 우려 ${count("concern")} · 참고 ${count("aside")} · ${(verdict.ms / 1000).toFixed(1)}초 · 입력 ${verdict.inputChars}자${verdict.problem ? ` · ${verdict.problem}` : ""}`;
}
