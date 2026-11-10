// 화면 검수 결함 ↔ 할 일 항목. 판마다 결함을 장부(VqaFinding)에 맞추고, 모델이 고칠 것만 할 일로 올린다.
//
// 규칙(2026-11-11, openwiki/assistant-v2.md 「완료 판정」):
//   - 모델 밖 결함(런타임·빌더 몫 — vqaClassify)은 장부에만 남는다. 할 일이 되지 않는다.
//   - 막음 급 결함은 할 일 항목이 된다. 한 번 건넨 뒤 다음 판에도 그대로면 그 항목 자신의 이유로 막힘 — 이것만 완료를 막는다.
//   - 다듬기 급 결함은 고치는 호출이 있을 때만 한 번 건넨다. 남아도 완료를 막지 않고 다시 열지 않는다.
//   - 다시 찍어 볼 판이 남지 않아 건네지 못한 막음 급 결함은 항목이 아니어도 완료를 막는다(vqaUnofferedBlockers) — 다음 턴이 건넨다.
//   - 같은 결함인지는 대상(맵·장면)과 결함 글로 가른다(vqaSameDefect). 항목 열쇠는 결함 하나에 하나라 다른 결함이 내용을 덮어쓰지 않는다.
//   - 장부는 프로젝트에 같이 저장돼 다음 턴이 이어 받는다(saveVqaBook·loadVqaBook) — 이미 건넨 결함을 새 턴이 새 항목으로 다시 올리지 않는다.
import type { Project } from "@/project/types";
import { textHash } from "../loop/continuation";
import type { TodoStore } from "../loop/todoStore";
import type { TodoItem } from "../todo/types";
import { VQA_MAX_ROUNDS, VQA_ROUND_CAP, vqaClassify, vqaDefectLine, vqaFixCall, vqaSameDefect, type VqaDefect, type VqaRound, type VqaShot } from "../judge/vqa";

/** 화면 검수가 한 번이라도 짚은 결함 하나. */
export interface VqaFinding {
  readonly key: string;
  /** 처음 본 글 — 항목 내용은 이 글로 한 번 정해진다. */
  readonly defect: VqaDefect;
  /** 모델이 고칠 일인가(아니면 런타임·빌더 몫). */
  readonly work: boolean;
  /** 마지막으로 본 판과 그때의 글. */
  lastRound: number;
  lastWhat: string;
  itemId?: string;
  /** 할 일로 한 번 건넸다(그 항목이 지금 목록에 없어도) — 다시 건네지 않는다. */
  handed?: boolean;
  /** 대상 그림을 다시 찍은 판에서 보이지 않았다. */
  gone?: boolean;
  /** 이번 실행의 검수에서 보였다(저장하지 않는다) — 최종 보고의 장부는 이번에 본 것만 싣는다. */
  seen?: boolean;
}

interface VqaRoundOutcome {
  /** 이번 판에 새로 올린 할 일과 그 결함(같은 차례). 비었으면 화면 검수는 여기서 끝난다. */
  readonly opened: TodoItem[];
  readonly offered: VqaDefect[];
  /** 이번 판에 처음 본 모델 밖 결함. */
  readonly outside: VqaFinding[];
  /** 한 번 건넸는데 이번 판에도 그대로인 결함. */
  readonly left: VqaFinding[];
}

/** 항목 열쇠 — 대상과 결함 글에서 만든다. 판 번호·순번을 쓰지 않는다(턴마다 1판부터 다시 세어 다른 결함이 같은 열쇠를 받았다). */
const findingKey = (d: VqaDefect): string => `vqa:${d.target?.kind ?? "-"}:${d.target?.ref ?? "-"}:${textHash(d.what)}`;

/** 결함 한 줄을 할 일 글 길이로 — 결함 설명은 220자에서 자르되 뒤의 고치는 호출(« → …»)은 남긴다. */
function clipDefectLine(line: string): string {
  const cut = line.indexOf(" → ");
  return cut < 0 ? line.slice(0, 220) : `${line.slice(0, Math.min(cut, 220))}${line.slice(cut, cut + 280)}`;
}

/**
 * 할 일로 건넬 것인가 — 모델 일이고 그 항목이 목록에 없을 때. 막음은 건넨 적이 있어도 항목이 없으면 다시 건넨다(목록을 이어 받지 않은 턴),
 * 다듬기는 고치는 호출이 있고 건넨 적이 없을 때 한 번만.
 */
const handable = (f: VqaFinding, store: TodoStore, project: Project): boolean =>
  f.work && !f.gone && !(f.itemId && store.get(f.itemId)) && (f.defect.severity === "blocker" || (!f.handed && !!vqaFixCall(f.defect, project)));

function handOver(f: VqaFinding, store: TodoStore, project: Project, phase: string): TodoItem | undefined {
  const [item] = store.append(phase, [{ content: clipDefectLine(vqaDefectLine(f.defect, 0, project).replace(/^\d+\.\s*/u, "")), key: f.key, ...(f.defect.severity === "polish" ? { severity: "polish" as const } : {}) }], "vqa");
  if (item) { f.itemId = item.id; f.handed = true; }
  return item;
}

/** 이번 판이 그 대상을 찍었나 — 안 찍은 그림의 결함은 «사라졌다»고 하지 않는다(그림 수 상한으로 빠진 맵). */
const photographed = (round: VqaRound, d: VqaDefect): boolean =>
  !d.target || round.shots.some((s) => s.kind === d.target!.kind && (s.ref ?? "") === (d.target!.ref ?? ""));

const leftReason = (item: TodoItem, round: number, what: string): string =>
  item.severity === "polish" ? `화면 검수 ${round}판에도 남음(다듬기 — 완료를 막지 않음): ${what.slice(0, 120)}` : `화면 검수 두 판 연속 그대로 — ${what.slice(0, 120)}`;

/**
 * 검수 한 판을 장부와 할 일에 맞춘다. 검수하지 못한 판(problem)은 아무것도 바꾸지 않는다.
 * 새 항목은 판이 남았을 때만 올린다(막음이 있으면 VQA_ROUND_CAP, 다듬기만이면 VQA_MAX_ROUNDS) — 고친 뒤 다시 찍어 볼 수 없으면 건네지 않고 장부에 둔다.
 */
export function noteVqaRound(book: VqaFinding[], store: TodoStore, round: VqaRound, project: Project): VqaRoundOutcome {
  const none: VqaRoundOutcome = { opened: [], offered: [], outside: [], left: [] };
  if (round.problem) return none;
  const seen = new Set<VqaFinding>();
  const fresh: VqaFinding[] = [];
  for (const d of round.defects) {
    let f = book.find((old) => vqaSameDefect(old.defect, d) || vqaSameDefect({ ...old.defect, what: old.lastWhat }, d));
    if (!f) {
      f = { key: findingKey(d), defect: d, work: vqaClassify(d).fixable, lastRound: round.round, lastWhat: d.what };
      // 목록에 같은 열쇠의 항목이 이미 있으면 그 항목이 이 결함이다.
      const kept = store.byKey(f.key);
      if (kept) { f.itemId = kept.id; f.handed = true; }
      fresh.push(f);
      book.push(f);
    }
    f.lastRound = round.round; f.lastWhat = d.what; f.gone = false; f.seen = true;
    seen.add(f);
  }
  // 앞에서 건넨 항목: 사라졌으면 닫고, 그대로면 그 항목 자신의 글로 막는다.
  const left: VqaFinding[] = [];
  for (const f of book) {
    const item = f.itemId ? store.get(f.itemId) : undefined;
    const live = item && item.status !== "dropped" ? item : undefined;
    if (!seen.has(f)) {
      if (!photographed(round, f.defect)) continue;
      f.gone = true;
      if (live && live.status !== "completed") store.done(live, { pass: true, detail: `화면 검수 ${round.round}판에서 사라짐` }, "auto");
      continue;
    }
    if (!live) continue;
    left.push(f);
    if (live.status !== "blocked") store.block(live, leftReason(live, round.round, f.lastWhat), "auto");
  }
  const outside = fresh.filter((f) => !f.work);
  const candidates = [...seen].filter((f) => handable(f, store, project));
  const cap = candidates.some((f) => f.defect.severity === "blocker") ? VQA_ROUND_CAP : VQA_MAX_ROUNDS;
  if (!candidates.length || round.round >= cap) return { ...none, outside, left };
  const opened: TodoItem[] = [], offered: VqaDefect[] = [];
  for (const f of candidates) {
    const item = handOver(f, store, project, `화면 검수 ${round.round}판`);
    if (item) { opened.push(item); offered.push(f.defect); }
  }
  return { opened, offered, outside, left };
}

/**
 * 앞 턴이 건네지 못한 막음(판이 남지 않았다)을 다시 찍지 않고 바로 건넨다 — 앞 턴의 마지막 검수 뒤로 프로젝트가 그대로라 그림도 그대로다.
 */
export function handCarriedBlockers(book: readonly VqaFinding[], store: TodoStore, project: Project): { opened: TodoItem[]; offered: VqaDefect[] } {
  const opened: TodoItem[] = [], offered: VqaDefect[] = [];
  for (const f of book) {
    if (f.defect.severity !== "blocker" || !handable(f, store, project)) continue;
    const item = handOver(f, store, project, "화면 검수(앞 턴에서 이어 받음)");
    if (item) { f.seen = true; opened.push(item); offered.push(f.defect); }
  }
  return { opened, offered };
}

/**
 * 고치라고 건넨 뒤 프로젝트가 한 글자도 안 바뀌었다 — 같은 그림이니 다시 찍지 않고, 건넨 결함은 모두 그대로로 닫는다
 * (조수가 «끝»이라 표시했어도 화면은 그대로다).
 */
export function closeVqaUnchanged(book: readonly VqaFinding[], store: TodoStore): VqaFinding[] {
  const left: VqaFinding[] = [];
  for (const f of book) {
    const item = f.itemId ? store.get(f.itemId) : undefined;
    if (!item || f.gone || item.status === "dropped") continue;
    left.push(f);
    if (item.status !== "blocked") store.block(item, `고치는 동안 프로젝트가 바뀌지 않음${item.severity === "polish" ? "(다듬기 — 완료를 막지 않음)" : ""} — ${f.lastWhat.slice(0, 120)}`, "auto");
  }
  return left;
}

const LEDGER_MAX_LINES = 12;
/** 그 결함의 할 일 항목이 지금 목록에 있나(뺀 항목도 있는 것이다 — 조수가 검수자를 틀렸다고 한 것). */
const onTable = (f: VqaFinding, store: TodoStore): boolean => !!f.itemId && !!store.get(f.itemId);
/** 이번 실행의 검수에서 보였고 할 일 표에 없는 남은 결함. */
const offTable = (book: readonly VqaFinding[], store: TodoStore): VqaFinding[] => book.filter((f) => f.seen && !f.gone && !onTable(f, store));
/** 모델이 고칠 막음인데 할 일로 건네지 못했다(다시 찍어 볼 판이 남지 않았다). */
const unofferedBlocker = (f: VqaFinding): boolean => f.work && f.defect.severity === "blocker";

/** 최종 보고의 장부 줄 — 이번 실행의 검수에서 보였고 할 일 표에 없는 남은 결함 가운데 완료를 막지 않는 것(모델 밖·고치는 호출이 없는 다듬기·건네지 못한 다듬기). */
export function vqaLedgerLines(book: readonly VqaFinding[], store: TodoStore): string[] {
  const rest = offTable(book, store).filter((f) => !unofferedBlocker(f));
  const lines = rest.slice(0, LEDGER_MAX_LINES).map((f) => `[${f.work ? "다듬기" : `런타임·빌더 몫(${vqaClassify(f.defect).kind})`}] ${f.defect.where} — ${f.lastWhat}`);
  return rest.length > LEDGER_MAX_LINES ? [...lines, `…${rest.length - LEDGER_MAX_LINES}건 더`] : lines;
}

/**
 * 건네지 못한 막음 — 모델이 고칠 막음 급 결함이 판이 남지 않은 판에 처음 보였다. 할 일 항목은 아니지만 알려진 막음이라 완료를 막는다
 * (다음 턴의 화면 검수가 할 일로 건넨다).
 */
export function vqaUnofferedBlockers(book: readonly VqaFinding[], store: TodoStore): string[] {
  return offTable(book, store).filter(unofferedBlocker).map((f) => `${f.defect.where} — ${f.lastWhat}`);
}

// ── 턴 사이 기억 ─────────────────────────────────────────────────────────────────────────
/** 프로젝트에 같이 저장되는 장부(assistantTodo.memory.vqa). 작게 둔다: 사라진 것·지워진 맵의 것은 빼고 40건까지. */
interface SavedFinding { key: string; kind?: VqaShot["kind"]; ref?: string; where: string; what: string; last: string; severity: VqaDefect["severity"]; work: boolean; item?: string; handed?: boolean }
interface VqaMemory { readonly fp?: string; readonly findings: readonly SavedFinding[] }
const BOOK_MAX = 40;

/** reviewedFp = 마지막으로 검수한 프로젝트 지문 — 다음 턴이 그대로면 다시 찍지 않는다. */
export function saveVqaBook(book: readonly VqaFinding[], store: TodoStore, project: Project, reviewedFp: string | undefined): VqaMemory | undefined {
  const live = book.filter((f) => !f.gone && !(f.defect.target?.kind === "map" && f.defect.target.ref && !project.maps[f.defect.target.ref]));
  // 넘치면 건넨 것(다시 건네지 않으려면 꼭 기억해야 한다)을 먼저, 그다음 최근 것.
  const kept = live.length <= BOOK_MAX ? live : [...live.filter((f) => f.handed), ...live.filter((f) => !f.handed).reverse()].slice(0, BOOK_MAX);
  if (!kept.length && !reviewedFp) return undefined;
  return { ...(reviewedFp ? { fp: reviewedFp } : {}), findings: kept.map((f) => ({
    key: f.key, ...(f.defect.target ? { kind: f.defect.target.kind, ...(f.defect.target.ref ? { ref: f.defect.target.ref } : {}) } : {}),
    where: f.defect.where.slice(0, 120), what: f.defect.what.slice(0, 240), last: f.lastWhat.slice(0, 240), severity: f.defect.severity, work: f.work,
    ...(f.itemId && store.get(f.itemId) ? { item: f.itemId } : {}), ...(f.handed ? { handed: true } : {}) })) };
}

/** 저장된 장부를 읽는다. 항목 연결은 그 항목이 지금 목록에 같은 열쇠로 있을 때만 잇는다(목록을 이어 받지 않은 턴은 id 가 새로 매겨진다). */
export function loadVqaBook(memory: unknown, store: TodoStore): { book: VqaFinding[]; reviewedFp?: string } {
  const m = memory as Partial<VqaMemory> | undefined;
  if (!m || typeof m !== "object" || !Array.isArray(m.findings)) return { book: [] };
  const book = m.findings.flatMap((raw): VqaFinding[] => {
    const s = raw as Partial<SavedFinding> | undefined;
    if (!s || typeof s.key !== "string" || typeof s.what !== "string") return [];
    const item = typeof s.item === "string" && store.byKey(s.key)?.id === s.item ? s.item : undefined;
    return [{ key: s.key, defect: { where: String(s.where ?? ""), what: s.what, severity: s.severity === "polish" ? "polish" : "blocker", ...(s.kind ? { target: { kind: s.kind, ...(s.ref ? { ref: s.ref } : {}) } } : {}) },
      work: s.work !== false, lastRound: 0, lastWhat: typeof s.last === "string" ? s.last : s.what, ...(item ? { itemId: item } : {}), ...(s.handed ? { handed: true } : {}) }];
  });
  return { book, ...(typeof m.fp === "string" ? { reviewedFp: m.fp } : {}) };
}
