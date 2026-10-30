// 조수 v2 멈춤 재주입 고리(omo goal continuation + todo-owed backstop 을 본뜸).
// 모델이 도구 없이 멈추려 할 때 열린 할 일이 있으면 숨은 지시로 다시 돌린다. 끝없이 돌지 않게:
//   - 한 묶음(조수 목록, 또는 관문·비평·검수가 덧붙인 묶음)에서 연속 재주입 8번(GOAL_CONTINUATION_CAP)
//   - 진척 없는 재주입 2번 연속 — 진척 = 성공한 쓰기 도구의 새 결과 지문, 또는 열린 항목 수 감소(omo toolEffectFingerprint: 실패는 진척이 아니다)
//   - 서명(열린 수/전체 수 · 프로젝트 지문 · 보고 해시)이 앞 재주입과 같으면(stale)
//   - 사용자에게 물으며 멈춘 실행(ask_user)은 다시 돌리지 않는다
import { checkLabel, type TodoStore } from "./todoStore";
import type { TodoItem } from "../todo/types";

export const LOOP_CONTINUATION_CAP = 8;
export const LOOP_NO_PROGRESS_LIMIT = 2;
/** 지문 창 — 같은 호출을 돌려 부른 결과가 진척으로 세지 않게(omo GOAL_TOOL_EFFECT_WINDOW). */
export const LOOP_EFFECT_WINDOW = 256;

export type LoopDecision = { readonly kind: "continue"; readonly n: number } | { readonly kind: "stop"; readonly reason: "ask_user" | "stale" | "no-progress" | "cap" };

/** FNV-1a 두 번(씨앗 다름) — 16자리 16진. 편집기 번들에서도 돌게 node:crypto 를 쓰지 않는다(omo hashAssistantText 와 같은 식). */
function hash(text: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}
// 실행마다 달라지는 값(시각·시간·긴 수·긴 16진 id) — 같은 결과를 다시 낸 호출이 진척으로 보이지 않게 가린다(omo VOLATILE_RESULT_TOKEN).
const VOLATILE = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?|\b\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\b|\b\d+(?:\.\d+)?\s?(?:ms|초|분|s)\b|\b\d{6,}\b|\b[0-9a-f]{8,}\b/giu;
export const maskVolatile = (text: string): string => text.replace(VOLATILE, "#");

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((k) => [k, canonical((value as Record<string, unknown>)[k])]));
  return value;
}
export const callKey = (name: string, args: unknown): string => `${name}\u0000${JSON.stringify(canonical(args ?? null))}`;
export const effectFingerprint = (name: string, args: unknown, resultText: string): string => hash(`${callKey(name, args)}\u0000${maskVolatile(resultText).slice(0, 4000)}`);

/** 프로젝트 지문 — 할 일 상태(assistantTodo)는 뺀다(목록만 바뀐 것은 짓기가 아니다). */
export function projectFingerprint(project: unknown): string {
  try { const { assistantTodo: _t, ...rest } = project as Record<string, unknown>; return hash(JSON.stringify(rest)); } catch { return ""; }
}
export const textHash = (text: string): string => hash(text.toLowerCase().replace(/\s+/gu, " ").trim());

export class TodoLoop {
  /** 이 묶음에서 연속 재주입 수. */
  consecutive = 0;
  /** 진척 없이 이어진 재주입 수. */
  noProgress = 0;
  /** 이 실행 전체의 재주입 수(기록용). */
  total = 0;
  private lastSig: string | undefined;
  private openAtLast: number | undefined;
  private readonly effects: string[] = [];
  private readonly effectSet = new Set<string>();
  private newEffects = 0;

  /** 성공한 쓰기 도구 하나의 결과 지문. 창 안에 없던 지문이면 진척. */
  noteEffect(fp: string): void {
    if (this.effectSet.has(fp)) return;
    this.effectSet.add(fp); this.effects.push(fp);
    if (this.effects.length > LOOP_EFFECT_WINDOW) this.effectSet.delete(this.effects.shift()!);
    this.newEffects += 1;
  }

  /** 새 일감 묶음(관문·비평·검수가 덧붙임) — 연속·진척 수를 새로 센다. 서명은 남긴다. */
  resetBatch(): void { this.consecutive = 0; this.noProgress = 0; this.openAtLast = undefined; }

  /** 멈추려는 순간의 판단. 계속이면 상태를 앞으로 옮긴다. */
  evaluate(input: { open: number; total: number; projectFp: string; draftHash: string; asked: boolean }): LoopDecision {
    if (input.asked) return { kind: "stop", reason: "ask_user" };
    const progressed = this.openAtLast === undefined || this.newEffects > 0 || input.open < this.openAtLast;
    this.noProgress = progressed ? 0 : this.noProgress + 1;
    const sig = `${input.open}/${input.total}:${input.projectFp}:${input.draftHash}`;
    if (this.lastSig !== undefined && sig === this.lastSig) return { kind: "stop", reason: "stale" };
    if (this.noProgress >= LOOP_NO_PROGRESS_LIMIT) return { kind: "stop", reason: "no-progress" };
    if (this.consecutive >= LOOP_CONTINUATION_CAP) return { kind: "stop", reason: "cap" };
    this.consecutive += 1; this.total += 1;
    this.lastSig = sig; this.openAtLast = input.open; this.newEffects = 0;
    return { kind: "continue", n: this.consecutive };
  }
}

export const STOP_REASON_KO: Record<Exclude<LoopDecision, { kind: "continue" }>["reason"], string> = {
  ask_user: "사용자에게 물음",
  stale: "앞 재주입 뒤로 목록·프로젝트·보고가 그대로",
  "no-progress": `진척 없는 재주입 ${LOOP_NO_PROGRESS_LIMIT}번 연속`,
  cap: `한 묶음에서 재주입 ${LOOP_CONTINUATION_CAP}번`,
};

const failingLine = (store: TodoStore, item: TodoItem): string | undefined => {
  const m = store.meta.get(item.id);
  if (m?.lastCheck && !m.lastCheck.pass) return `- ${item.id} «${item.content}» machine check ✗ — ${m.lastCheck.detail}${m.lastCheck.detail.startsWith("모호함") ? ` → bind it with todo(op:"bind", task:"${item.id}", mapId|eventId|itemId|troopId:<candidate id>)` : ""}`;
  if (m?.lastFail) return `- ${item.id} «${item.content}» last failure — ${m.lastFail}`;
  return undefined;
};

/** 숨은 재주입 글(사용자에게는 안 보인다). 다음 항목·남은 수·✗ 항목·전체 목록. */
export function continuationPrompt(store: TodoStore, opts: { readonly brief?: string; readonly batchNote?: string; readonly nextCallFor?: (item: TodoItem) => string | undefined } = {}): string {
  const c = store.counts();
  const next = store.promote() ?? store.next();
  const failing = store.items.filter((i) => i.status !== "completed" && i.status !== "dropped").map((i) => failingLine(store, i)).filter((l): l is string => !!l).slice(0, 8);
  return [
    ...(opts.brief ? [opts.brief, ""] : []),
    ...(opts.batchNote ? [opts.batchNote] : []),
    `[Todo loop] open items ${c.open}/${c.total}${next ? ` — Do now: ${next.id} «${next.content}»${next.check && next.check.kind !== "none" ? ` (machine check: ${checkLabel(next.check)})` : ""}` : ""}.`,
    // H7: 「지금 할 것」 바로 뒤에 그 항목의 다음 호출 한 개(동사+채운 인자 뼈대) — 추상 지시 대신 바로 부를 모양.
    ...(next && opts.nextCallFor ? (() => { const call = opts.nextCallFor!(next); return call ? [`Next call: ${call}`] : []; })() : []),
    "Continue with real tool calls, or if you cannot, mark it with todo(op:\"block\", task:<id>, reason:<one-line reason>) and go to the next item. Do not restate the plan. Mark finished items with todo(op:\"done\") — done re-runs the machine check. Marking an item completed while its machine check is ✗ is a false completion.",
    ...(failing.length ? ["Not done yet (machine record):", ...failing] : []),
    store.view(),
  ].join("\n");
}
