// 화면 검수 결함 ↔ 할 일 항목. 판마다 결함을 장부(VqaFinding)에 맞추고, 모델이 고칠 것만 할 일로 올린다.
//
// 규칙(2026-11-11, openwiki/assistant-v2.md 「완료 판정」):
//   - 모델 밖 결함(런타임·빌더 몫 — vqaClassify)은 장부에만 남는다. 할 일이 되지 않는다.
//   - 막음 급 결함은 할 일 항목이 된다. 한 번 건넨 뒤 다음 판에도 그대로면 그 항목 자신의 이유로 막힘 — 이것만 완료를 막는다.
//   - 다듬기 급 결함은 고치는 호출이 있을 때만 한 번 건넨다. 남아도 완료를 막지 않고 다시 열지 않는다.
//   - 다시 찍어 볼 판이 남지 않아 건네지 못한 막음 급 결함은 항목이 아니어도 완료를 막는다(vqaUnofferedBlockers) — 다음 턴이 건넨다.
//   - 같은 결함인지는 대상(맵·장면)과 결함 글로 가른다(vqaSameDefect). 항목 열쇠는 결함 하나에 하나라 다른 결함이 내용을 덮어쓰지 않는다.
import type { Project } from "@/project/types";
import { textHash } from "../loop/continuation";
import type { TodoStore } from "../loop/todoStore";
import type { TodoItem } from "../todo/types";
import { VQA_MAX_ROUNDS, VQA_ROUND_CAP, vqaClassify, vqaDefectLine, vqaFixCall, vqaSameDefect, type VqaDefect, type VqaRound } from "../vqa";

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
  /** 대상 그림을 다시 찍은 판에서 보이지 않았다. */
  gone?: boolean;
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
      // 앞 턴에서 이어 받은 항목이 같은 열쇠를 갖고 있으면 그 항목이 이 결함이다.
      const kept = store.byKey(f.key);
      if (kept) f.itemId = kept.id; else fresh.push(f);
      book.push(f);
    }
    f.lastRound = round.round; f.lastWhat = d.what; f.gone = false;
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
  const candidates = fresh.filter((f) => f.work && (f.defect.severity === "blocker" || !!vqaFixCall(f.defect, project)));
  const cap = candidates.some((f) => f.defect.severity === "blocker") ? VQA_ROUND_CAP : VQA_MAX_ROUNDS;
  if (!candidates.length || round.round >= cap) return { ...none, outside, left };
  const opened: TodoItem[] = [], offered: VqaDefect[] = [];
  for (const f of candidates) {
    const [item] = store.append(`화면 검수 ${round.round}판`, [{ content: clipDefectLine(vqaDefectLine(f.defect, 0, project).replace(/^\d+\.\s*/u, "")), key: f.key, ...(f.defect.severity === "polish" ? { severity: "polish" as const } : {}) }], "vqa");
    if (!item) continue;
    f.itemId = item.id;
    opened.push(item); offered.push(f.defect);
  }
  return { opened, offered, outside, left };
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
/** 할 일 표에 없는 남은 결함. */
const offTable = (book: readonly VqaFinding[], store: TodoStore): VqaFinding[] => book.filter((f) => !f.gone && !(f.itemId && store.get(f.itemId)));
/** 모델이 고칠 막음인데 할 일로 건네지 못했다(다시 찍어 볼 판이 남지 않았다). */
const unofferedBlocker = (f: VqaFinding): boolean => f.work && f.defect.severity === "blocker";

/** 최종 보고의 장부 줄 — 할 일 표에 없는 남은 결함 가운데 완료를 막지 않는 것(모델 밖·고치는 호출이 없는 다듬기·건네지 못한 다듬기). */
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
