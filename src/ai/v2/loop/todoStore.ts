// 조수 v2 할 일 목록(omo todo 를 본뜸 — senpi todotools 의 init/start/done/drop/append/view + 막힘).
// 순수 상태만 갖는다: 항목·상태 전이·막힘 연쇄·직렬화·사람이 읽는 체크리스트. 기계 확인(runTodoCheck)은 부르는 쪽(todoVerb·runtime)이 한다.
// 계약: 진행 중(in_progress)은 하나. 끝(completed)은 기계 확인이 통과해야 붙는다(부르는 쪽이 확인 결과를 넘긴다).
// 출처(source): model = 조수가 적은 항목, gate = 끝맺음 관문(기계 검사·게임 검사·출하 차단), critic = 독립 비평가·검토자, vqa = 화면 검수.
import type { CheckResult, TodoCheck, TodoItem, TodoStatus } from "../todo/types";
import { refsLabel, type ProjectIndex } from "./refs";

export type TodoSource = TodoItem["source"];

/** 항목마다 따로 드는 기록(모델에게는 안 보인다). */
export interface TodoMeta {
  /** gate·critic·vqa 항목의 문제 열쇠 — 같은 문제가 다시 나오면 새 항목 대신 이 항목을 다시 연다. */
  key?: string;
  /** 마지막 실패(도구 거절·기계 확인 ✗)의 서명과 연속 횟수 — 같은 서명이 이어지면 막힘으로 닫는다. */
  failSig?: string;
  sigStreak?: number;
  lastFail?: string;
  lastCheck?: CheckResult;
  /** 누가 닫았나 — model(조수의 done/drop/block) · auto(함수가 확인해 닫음). */
  closedBy?: "model" | "auto";
  /** block 을 한 번 되돌렸는가(거절 글이 이른 대안 동사를 안 써 봤을 때). */
  blockBounced?: boolean;
  /** 앞 실행에서 이어 받은 항목 — refs 가 없으면 이번 기준선 대비 «새로» 를 묻지 않는다. */
  restored?: boolean;
}

/** 프로젝트에 같이 저장되는 모양(project.assistantTodo) — 다시 읽기·이어 하기에서 되살린다. */
export interface AssistantTodoState {
  readonly version: 1;
  readonly task: string;
  readonly at: number;
  readonly items: readonly TodoItem[];
  readonly meta: Readonly<Record<string, TodoMeta>>;
}

export interface TodoInput {
  readonly content: string;
  readonly id?: string;
  readonly check?: TodoCheck;
  readonly dependsOn?: readonly string[];
}
export interface TodoPhaseInput { readonly phase: string; readonly items: readonly TodoInput[] }

/** 같은 항목이 몇 번 실패하면 막힘으로 닫나(omo loop-guard 의 3회와 같은 값). */
export const TODO_MAX_ATTEMPTS = 3;
/** 같은 실패 서명이 몇 번 이어지면 막힘으로 닫나. */
export const TODO_SAME_FAIL_STREAK = 2;

export const isOpen = (status: TodoStatus): boolean => status === "pending" || status === "in_progress";
const MARK: Record<TodoStatus, string> = { pending: "○", in_progress: "→", completed: "✓", blocked: "✗막힘", dropped: "–뺌" };
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);
const norm = (text: string) => text.toLowerCase().replace(/\s+/gu, " ").trim();

export function checkLabel(check: TodoCheck | undefined): string {
  if (!check || check.kind === "none") return "눈 확인";
  switch (check.kind) {
    case "place": return `장소 「${check.name}」${check.placeKind ? `(${check.placeKind})` : ""}`;
    case "person": return `인물 「${check.name}」${check.map ? ` @${check.map}` : ""}`;
    case "talk": return `「${check.who}」 대사${check.says ? ` «${check.says}»` : ""}`;
    case "battle": return `${check.boss ? "보스 " : ""}전투${check.who ? ` 「${check.who}」` : ""}${check.map ? ` @${check.map}` : ""}`;
    case "link": return `「${check.from}」→「${check.to}」 이동`;
    case "ending": return `엔딩 닿음${check.map ? ` @${check.map}` : ""}`;
    case "item": return `아이템 「${check.name}」${check.gives ? " 지급" : ""}`;
    case "present_evidence": return `증거 「${check.item}」 내밀기${check.to ? ` → ${check.to}` : ""}`;
    case "objective": return `목표 줄${check.text ? ` «${check.text}»` : ""}`;
    case "reachable": return `「${check.target}」까지 걸어 닿음${check.from ? ` (from ${check.from})` : ""}`;
  }
}

export class TodoStore {
  items: TodoItem[] = [];
  readonly meta = new Map<string, TodoMeta>();
  /** 조수가 init 을 한 번이라도 했나(또는 앞 실행 목록을 되살렸나). */
  initialized = false;
  /** 이번 쓰기 턴 시작 때 프로젝트 지문(맵·이벤트·아이템·적 그룹) — 판정의 changed 기준. */
  baseline: ProjectIndex | undefined;
  private seq = 0;

  private nextId(prefix = "t"): string {
    let id: string;
    do id = `${prefix}${++this.seq}`; while (this.items.some((i) => i.id === id));
    return id;
  }
  private metaOf(id: string): TodoMeta {
    let m = this.meta.get(id);
    if (!m) { m = {}; this.meta.set(id, m); }
    return m;
  }

  get(id: string): TodoItem | undefined { return this.items.find((i) => i.id === id); }

  /** id 그대로 → 내용 그대로 → 내용 일부(하나만 맞을 때). */
  resolve(ref: string | undefined): TodoItem | undefined {
    const r = (ref ?? "").trim();
    if (!r) return undefined;
    const byId = this.items.find((i) => i.id === r);
    if (byId) return byId;
    const n = norm(r);
    const exact = this.items.filter((i) => norm(i.content) === n);
    if (exact.length === 1) return exact[0];
    const part = this.items.filter((i) => norm(i.content).includes(n) || n.includes(norm(i.content)));
    return part.length === 1 ? part[0] : undefined;
  }

  current(): TodoItem | undefined { return this.items.find((i) => i.status === "in_progress"); }
  open(): TodoItem[] { return this.items.filter((i) => isOpen(i.status)); }
  openCount(): number { return this.open().length; }

  /** 앞선 항목이 모두 끝났나(완료·뺌). 막힌 선행이 있으면 false. */
  private ready(item: TodoItem): boolean {
    return (item.dependsOn ?? []).every((dep) => { const d = this.get(dep); return !d || d.status === "completed" || d.status === "dropped"; });
  }

  /** 다음에 할 항목 — 진행 중이 있으면 그것, 없으면 순서상 첫 준비된 열린 항목. */
  next(): TodoItem | undefined {
    return this.current() ?? this.items.find((i) => i.status === "pending" && this.ready(i)) ?? this.items.find((i) => i.status === "pending");
  }

  /** 진행 중이 없으면 다음 항목을 진행 중으로 올린다(omo: 완료마다 첫 열린 항목이 자동으로 올라온다). */
  promote(): TodoItem | undefined {
    if (this.current()) return this.current();
    const n = this.items.find((i) => i.status === "pending" && this.ready(i));
    if (n) n.status = "in_progress";
    return n;
  }

  private add(phase: string, input: TodoInput, source: TodoSource, key?: string): TodoItem {
    const wanted = input.id?.trim().replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 24);
    const id = wanted && !this.items.some((i) => i.id === wanted) ? wanted : this.nextId(source === "model" ? "t" : source === "vqa" ? "v" : source === "critic" ? "c" : "g");
    const item: TodoItem = { id, phase: clip(phase.trim() || "할 일", 40), content: clip(input.content.trim(), 220), status: "pending", attempts: 0, source,
      ...(input.check ? { check: input.check } : {}),
      ...(input.dependsOn?.length ? { dependsOn: [...input.dependsOn] } : {}) };
    this.items.push(item);
    if (key) this.metaOf(id).key = key;
    return item;
  }

  /** dependsOn 을 id 로 고친다(내용으로 적은 것도 받는다). 못 찾은 것은 버린다. */
  private linkDeps(items: readonly TodoItem[]): void {
    for (const item of items) {
      if (!item.dependsOn?.length) continue;
      const ids = item.dependsOn.map((d) => this.resolve(d)?.id).filter((d): d is string => !!d && d !== item.id);
      if (ids.length) item.dependsOn = [...new Set(ids)]; else delete item.dependsOn;
    }
  }

  /** 조수 목록을 새로 적는다 — 조수가 적은 항목만 바꾸고, 관문·비평·검수 항목은 남긴다. */
  init(phases: readonly TodoPhaseInput[]): TodoItem[] {
    const kept = this.items.filter((i) => i.source !== "model");
    for (const i of this.items) if (i.source === "model") this.meta.delete(i.id);
    this.items = kept;
    const added = phases.flatMap((p) => p.items.filter((it) => it.content?.trim()).map((it) => this.add(p.phase, it, "model")));
    this.linkDeps(added);
    this.initialized = true;
    this.promote();
    return added;
  }

  /** 항목을 덧붙인다. key 가 같은 항목이 이미 있으면 새로 만들지 않고, 닫혀 있으면 다시 연다(시도 +1). 돌려주는 값: 새로 열린 항목. */
  append(phase: string, inputs: readonly (TodoInput & { key?: string })[], source: TodoSource): TodoItem[] {
    const opened: TodoItem[] = [];
    const fresh: TodoItem[] = [];
    for (const input of inputs) {
      if (!input.content?.trim()) continue;
      const same = input.key ? this.items.find((i) => this.meta.get(i.id)?.key === input.key) : undefined;
      if (same) {
        // 끝났다던 문제가 다시 나왔다 — 거짓 완료이거나 고치기가 효과가 없었다. 다시 열고 한 번 실패로 센다.
        // 막힘(이유를 적고 닫음)·뺌은 다시 열지 않는다 — 같은 문제가 남는 것이 당연하다(남은 문제로 보고된다).
        if (same.status === "completed") { same.attempts += 1; same.status = "pending"; delete this.metaOf(same.id).closedBy; opened.push(same); }
        // 같은 열쇠(맵마다 하나인 장소 고치기)라도 문제 글은 바뀐다 — 지금 글로 바꿔 둔다.
        if (isOpen(same.status)) same.content = clip(input.content.trim(), 220);
        continue;
      }
      const item = this.add(phase, input, source, input.key);
      fresh.push(item); opened.push(item);
    }
    this.linkDeps(fresh);
    if (source === "model" && fresh.length) this.initialized = true;
    this.promote();
    return opened;
  }

  start(item: TodoItem): void {
    for (const i of this.items) if (i.status === "in_progress" && i !== item) i.status = "pending";
    if (item.status === "blocked") delete item.blockedReason;
    item.status = "in_progress";
    delete this.metaOf(item.id).closedBy;
  }

  /** 끝 표시. 확인 결과가 ✗ 면 끝나지 않는다(진행 중으로 남음, 실패 세기는 부르는 쪽이 recordFailure 로) — 돌려주는 값: 실제로 끝났나. */
  done(item: TodoItem, result: CheckResult | undefined, by: "model" | "auto" = "model"): boolean {
    const m = this.metaOf(item.id);
    if (result) m.lastCheck = result;
    if (result && !result.pass) {
      if (item.status !== "in_progress" && by === "model") this.start(item);
      return false;
    }
    item.status = "completed";
    delete item.blockedReason;
    m.closedBy = by;
    this.promote();
    return true;
  }

  /** 끝났던 항목이 지금 기계 확인에서 ✗ — 다시 연다(시도 +1). */
  reopen(item: TodoItem, result: CheckResult): void {
    item.attempts += 1;
    item.status = "pending";
    const m = this.metaOf(item.id);
    m.lastCheck = result;
    delete m.closedBy;
    this.promote();
  }

  drop(item: TodoItem, reason: string, by: "model" | "auto" = "model"): void {
    item.status = "dropped";
    item.blockedReason = clip(reason.trim() || "이유 없음", 200);
    this.metaOf(item.id).closedBy = by;
    this.promote();
  }

  /** 막힘으로 닫고, 이 항목에 기대는(dependsOn) 열린 항목도 막힘으로 닫는다. 돌려주는 값: 같이 닫힌 항목. */
  block(item: TodoItem, reason: string, by: "model" | "auto" = "model"): TodoItem[] {
    item.status = "blocked";
    item.blockedReason = clip(reason.trim() || "이유 없음", 240);
    this.metaOf(item.id).closedBy = by;
    const cascaded: TodoItem[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const other of this.items) {
        if (!isOpen(other.status) || !other.dependsOn?.length) continue;
        const dep = other.dependsOn.map((d) => this.get(d)).find((d) => d?.status === "blocked");
        if (!dep) continue;
        other.status = "blocked";
        other.blockedReason = `«${clip(dep.content, 40)}»(${dep.id}) 막힘에 기대 있음`;
        this.metaOf(other.id).closedBy = "auto";
        cascaded.push(other);
        changed = true;
      }
    }
    this.promote();
    return cascaded;
  }

  /**
   * 진행 중 항목의 실패 하나를 센다(쓰기 도구 거절·예외, 기계 확인 ✗). 같은 항목 3회째이거나 같은 실패 서명이 이어지면 막힘으로 닫는다.
   * 돌려주는 값: 막힘으로 닫았으면 그 이유.
   */
  recordFailure(item: TodoItem, sig: string, detail: string): string | undefined {
    const m = this.metaOf(item.id);
    item.attempts += 1;
    m.sigStreak = m.failSig === sig ? (m.sigStreak ?? 1) + 1 : 1;
    m.failSig = sig;
    m.lastFail = clip(detail, 300);
    if (item.attempts >= TODO_MAX_ATTEMPTS) return `${item.attempts}번 실패 — 마지막: ${clip(detail, 160)}`;
    if ((m.sigStreak ?? 0) >= TODO_SAME_FAIL_STREAK) return `같은 실패가 ${m.sigStreak}번 이어짐 — ${clip(detail, 160)}`;
    return undefined;
  }

  counts(): { open: number; total: number; done: number; blocked: number; dropped: number } {
    const c = { open: 0, total: this.items.length, done: 0, blocked: 0, dropped: 0 };
    for (const i of this.items) {
      if (isOpen(i.status)) c.open += 1;
      else if (i.status === "completed") c.done += 1;
      else if (i.status === "blocked") c.blocked += 1;
      else c.dropped += 1;
    }
    return c;
  }

  /** 사람이 읽는 짧은 체크리스트(조수에게도 이 글을 준다). */
  view(maxItems = 40): string {
    if (!this.items.length) return "할 일 목록이 비었다.";
    const c = this.counts();
    const lines = [`할 일 ${c.done}/${c.total} 끝 · 열림 ${c.open}${c.blocked ? ` · 막힘 ${c.blocked}` : ""}${c.dropped ? ` · 뺌 ${c.dropped}` : ""}`];
    let phase = "";
    for (const item of this.items.slice(0, maxItems)) {
      if (item.phase !== phase) { phase = item.phase; lines.push(`[${phase}]`); }
      const m = this.meta.get(item.id);
      const check = item.check && item.check.kind !== "none" ? ` · 확인: ${checkLabel(item.check)}${m?.lastCheck ? (m.lastCheck.pass ? " ✓" : ` ✗ ${clip(m.lastCheck.detail, 90)}`) : ""}` : "";
      const why = item.blockedReason ? ` — ${item.blockedReason}` : "";
      const bound = refsLabel(item.refs);
      const src = item.source === "model" ? "" : ` (${item.source === "gate" ? "함수 검사" : item.source === "critic" ? "비평" : "화면 검수"})`;
      lines.push(` ${MARK[item.status]} ${item.id} ${item.content}${src}${check}${bound ? ` · ${bound}` : ""}${item.attempts ? ` · 시도 ${item.attempts}` : ""}${why}`);
    }
    if (this.items.length > maxItems) lines.push(` …항목 ${this.items.length - maxItems}개 더`);
    return lines.join("\n");
  }

  serialize(task: string): AssistantTodoState {
    return { version: 1, task: clip(task, 1500), at: Date.now(), items: this.items.map((i) => ({ ...i, ...(i.dependsOn ? { dependsOn: [...i.dependsOn] } : {}) })), meta: Object.fromEntries([...this.meta].map(([k, v]) => [k, { ...v }])) };
  }

  /** 앞 실행이 남긴 목록을 되살린다. 열린 항목이 없으면 아무것도 안 하고 false. */
  restore(state: unknown): boolean {
    const s = state as Partial<AssistantTodoState> | undefined;
    if (!s || s.version !== 1 || !Array.isArray(s.items)) return false;
    const items = s.items.filter((i): i is TodoItem => !!i && typeof i === "object" && typeof (i as TodoItem).id === "string" && typeof (i as TodoItem).content === "string")
      .map((i) => ({ ...i, attempts: Number(i.attempts) || 0, status: (["pending", "in_progress", "completed", "blocked", "dropped"] as const).includes(i.status) ? i.status : "pending" }));
    if (!items.some((i) => isOpen(i.status) || i.status === "blocked")) return false;
    // 앞 실행에서 막혔던 항목은 이번 실행에서 다시 시도한다(새 요청 «계속»).
    for (const i of items) if (i.status === "blocked") { i.status = "pending"; delete i.blockedReason; i.attempts = 0; }
    this.items = items;
    this.meta.clear();
    for (const [k, v] of Object.entries(s.meta ?? {})) if (v && typeof v === "object") this.meta.set(k, { key: (v as TodoMeta).key });
    for (const i of items) this.meta.set(i.id, { ...(this.meta.get(i.id) ?? {}), restored: true });
    this.seq = items.length;
    this.initialized = true;
    for (const i of this.items) if (i.status === "in_progress") i.status = "pending";
    this.promote();
    return true;
  }
}
