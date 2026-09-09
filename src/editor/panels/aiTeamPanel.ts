// 팀 패널 — 조수 데크의 레일 아래에 접힌 막대로 산다. 접힌 상태에서도 「누가 무엇을 하고 있는지」 한 줄로
// 보이고, 펼치면 ① 지금 각 팀원이 하는 일 ② 팀원 명단 편집(추가·수정·끄기·삭제·기본값) ③ 팀장 지침이 나온다.
// 상태는 teamActivity 버스(실행 중 보드 상태)와 teamSpecStore(명세)에서 온다. 이 파일은 그리기와 편집 폼만.

import { el } from "@/util/dom";
import { subscribeTeamActivity } from "@/ai/piAgent/teamActivity";
import type { TeamBoardAgent, TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { TEAM_TOOL_DOMAINS, slugifyMemberId, type PiTeamMember, type PiTeamMemberKind, type PiTeamSpec } from "@/ai/piAgent/teamSpec";
import { loadTeamSpec, resetTeamSpec, saveTeamSpec, subscribeTeamSpec } from "@/ai/piAgent/teamSpecStore";

export interface TeamPanelHandle {
  readonly root: HTMLElement;
  /** 펼침 상태가 바뀔 때(패널 폭 조정용). */
  readonly onToggle: (listener: (open: boolean) => void) => void;
  dispose(): void;
}

const KIND_LABEL: Record<PiTeamMemberKind, string> = { builder: "시공", reviewer: "검수" };
const DOMAIN_LABEL: Record<string, string> = {
  core: "기본", tile: "타일", map: "맵", event: "이벤트", database: "데이터베이스", system: "시스템", world: "세계", quest: "퀘스트", battle: "전투",
};

function agentsOf(state: TeamBoardState | null, memberId: string): TeamBoardAgent[] {
  return state?.agents.filter((agent) => agent.memberId === memberId) ?? [];
}

function liveSummary(spec: PiTeamSpec, state: TeamBoardState | null): string {
  if (!state || state.phase === "적용됨" || state.phase === "버림" || state.phase === "중단" || state.phase === "실패") {
    const enabled = spec.members.filter((member) => member.enabled);
    const tail = state?.phase === "적용됨" ? " · 마지막 작업 적용됨" : state?.phase === "버림" ? " · 마지막 작업 버림" : state?.phase === "중단" ? " · 마지막 작업 중단" : state?.phase === "실패" ? " · 마지막 작업 실패" : "";
    return `${enabled.map((member) => member.label).join(" · ") || "팀원 없음"} · 대기${tail}`;
  }
  if (state.phase === "검토 대기") return "검토 대기 — 보드에서 적용 또는 버리기";
  const parts: string[] = [];
  const orchestrator = state.agents.find((agent) => agent.role === "orchestrator");
  if (orchestrator) parts.push(`팀장 ${orchestrator.state === "실행 중" ? "지휘 중" : orchestrator.state}`);
  for (const member of spec.members) {
    const agents = agentsOf(state, member.id);
    if (agents.length === 0) continue;
    const running = agents.filter((agent) => agent.state === "실행 중").length;
    const done = agents.filter((agent) => agent.state === "완료").length;
    parts.push(`${member.label} ${running > 0 ? `${running}명 작업 중` : `${done}건 완료`}`);
  }
  // 명세에 없는 팀원(단일 /pi 의 임시 행)도 셈에 넣는다.
  const anonymous = state.agents.filter((agent) => agent.role !== "orchestrator" && !spec.members.some((member) => member.id === agent.memberId));
  if (anonymous.length > 0) {
    const running = anonymous.filter((agent) => agent.state === "실행 중").length;
    parts.push(running > 0 ? `에이전트 ${running}개 작업 중` : `에이전트 ${anonymous.length}개 완료`);
  }
  return parts.join(" · ") || state.phase;
}

export function createTeamPanel(): TeamPanelHandle {
  let spec = loadTeamSpec();
  let activity: TeamBoardState | null = null;
  let open = false;
  let editing: string | null = null;
  let draft: PiTeamMember | null = null;
  const toggleListeners = new Set<(open: boolean) => void>();

  const dot = el("span", { class: "ai-team-panel-dot", attrs: { "aria-hidden": "true" } });
  const summary = el("span", { class: "ai-team-panel-summary", dataset: { testid: "ai-team-panel-summary" }, attrs: { "aria-live": "polite" } });
  const bodyId = "ai-team-panel-body";
  const bar = el("button", {
    class: "ai-team-panel-bar",
    dataset: { testid: "ai-team-panel-toggle" },
    attrs: { type: "button", "aria-expanded": "false", "aria-controls": bodyId, title: "팀원과 진행 상황" },
  });
  bar.append(dot, el("span", { class: "ai-team-panel-title", text: "팀" }), summary, el("span", { class: "ai-team-panel-chevron", attrs: { "aria-hidden": "true" } }));
  const body = el("div", { class: "ai-team-panel-body", attrs: { id: bodyId, hidden: "" } });
  const root = el("section", { class: "ai-team-panel", dataset: { testid: "ai-team-panel", open: "false" }, attrs: { "aria-label": "Pi 팀" } });
  root.append(bar, body);

  const setOpen = (next: boolean): void => {
    open = next;
    root.dataset.open = String(open);
    bar.setAttribute("aria-expanded", String(open));
    if (open) body.removeAttribute("hidden"); else body.setAttribute("hidden", "");
    for (const listener of toggleListeners) listener(open);
    if (open) render();
  };
  bar.addEventListener("click", () => setOpen(!open));

  // ── 지금 ────────────────────────────────────────────────────────────────
  const renderNow = (): HTMLElement => {
    const section = el("div", { class: "ai-team-section ai-team-now", dataset: { testid: "ai-team-now" } });
    section.append(el("h3", { class: "ai-team-section-title", text: "지금" }));
    if (!activity || activity.agents.length === 0) {
      section.append(el("p", { class: "ai-team-empty", text: "실행 중인 팀 작업이 없습니다. 컴포저에 /pi team <지시> 를 보내면 여기서 팀원별 진행을 봅니다." }));
      return section;
    }
    const list = el("ul", { class: "ai-team-live" });
    const rows: { label: string; kind: string; agents: TeamBoardAgent[] }[] = [];
    const orchestrator = activity.agents.filter((agent) => agent.role === "orchestrator");
    if (orchestrator.length > 0) rows.push({ label: "팀장", kind: "orchestrator", agents: orchestrator });
    for (const member of spec.members) {
      const agents = agentsOf(activity, member.id);
      if (agents.length > 0) rows.push({ label: member.label, kind: member.kind, agents });
    }
    const anonymous = activity.agents.filter((agent) => agent.role !== "orchestrator" && !spec.members.some((member) => member.id === agent.memberId));
    if (anonymous.length > 0) rows.push({ label: "에이전트", kind: "builder", agents: anonymous });
    for (const row of rows) {
      const item = el("li", { class: `ai-team-live-row role-${row.kind}`, dataset: { testid: "ai-team-live-row" } });
      const head = el("div", { class: "ai-team-live-head" });
      const running = row.agents.filter((agent) => agent.state === "실행 중");
      head.append(
        el("span", { class: "ai-team-role", text: row.label }),
        el("span", { class: "ai-team-live-count", text: running.length > 0 ? `${running.length}명 작업 중` : `${row.agents.length}건 ${row.agents.every((agent) => agent.state === "완료") ? "완료" : row.agents.at(-1)!.state}` }),
      );
      if (running.length > 0) head.append(el("span", { class: "ai-deck-spin ai-team-spin", attrs: { "aria-hidden": "true" } }));
      item.append(head);
      for (const agent of row.agents.slice(-3)) {
        const where = agent.mapName ?? agent.mapId ?? "전체";
        const line = agent.review ? (agent.review.ok ? "검수 통과" : `지적 ${agent.review.findings.length}건`) : agent.lastLine || agent.task;
        item.append(el("p", { class: `ai-team-live-line is-${agent.state === "실행 중" ? "running" : agent.state === "실패" ? "error" : "done"}`, text: `${where} — ${line}`.slice(0, 180) }));
      }
      list.append(item);
    }
    section.append(list);
    return section;
  };

  // ── 팀원 명단 ─────────────────────────────────────────────────────────
  const commit = (next: PiTeamSpec): void => { spec = saveTeamSpec(next); render(); };
  const updateMember = (id: string, patch: Partial<PiTeamMember>): void => {
    commit({ ...spec, members: spec.members.map((member) => (member.id === id ? { ...member, ...patch } : member)) });
  };
  const startEdit = (member: PiTeamMember): void => { editing = member.id; draft = { ...member, toolDomains: [...member.toolDomains] }; render(); };
  const cancelEdit = (): void => { editing = null; draft = null; render(); };

  const renderForm = (member: PiTeamMember): HTMLElement => {
    const current = draft ?? member;
    const form = el("form", { class: "ai-team-form", dataset: { testid: "ai-team-member-form" } });
    const field = (label: string, control: HTMLElement): HTMLElement => {
      const wrap = el("label", { class: "ai-team-field" });
      wrap.append(el("span", { class: "ai-team-field-label", text: label }), control);
      return wrap;
    };
    const name = el("input", { class: "ai-team-input", attrs: { type: "text", maxlength: "24", required: "", value: current.label }, dataset: { testid: "ai-team-form-label" } });
    name.addEventListener("input", () => { draft = { ...current, label: name.value }; });
    const kind = el("select", { class: "ai-team-input", dataset: { testid: "ai-team-form-kind" } });
    for (const value of ["builder", "reviewer"] as PiTeamMemberKind[]) {
      const option = el("option", { text: KIND_LABEL[value], attrs: { value } });
      if (value === current.kind) option.selected = true;
      kind.append(option);
    }
    kind.addEventListener("change", () => { draft = { ...(draft ?? current), kind: kind.value as PiTeamMemberKind }; });
    const summaryInput = el("input", { class: "ai-team-input", attrs: { type: "text", maxlength: "200", value: current.summary, placeholder: "팀장이 배정할 때 참고하는 한 줄" }, dataset: { testid: "ai-team-form-summary" } });
    summaryInput.addEventListener("input", () => { draft = { ...(draft ?? current), summary: summaryInput.value }; });
    const prompt = el("textarea", { class: "ai-team-input ai-team-textarea", attrs: { rows: "4", maxlength: "4000", placeholder: "이 팀원에게 주는 역할 프롬프트" }, dataset: { testid: "ai-team-form-prompt" } });
    prompt.value = current.prompt;
    prompt.addEventListener("input", () => { draft = { ...(draft ?? current), prompt: prompt.value }; });
    const domains = el("div", { class: "ai-team-domains", attrs: { role: "group", "aria-label": "도구 범위" } });
    for (const domain of TEAM_TOOL_DOMAINS) {
      const chip = el("label", { class: "ai-team-domain-chip" });
      const box = el("input", { attrs: { type: "checkbox", value: domain } });
      box.checked = current.toolDomains.includes(domain);
      box.addEventListener("change", () => {
        const set = new Set((draft ?? current).toolDomains);
        if (box.checked) set.add(domain); else set.delete(domain);
        draft = { ...(draft ?? current), toolDomains: [...set] };
      });
      chip.append(box, el("span", { text: DOMAIN_LABEL[domain] ?? domain }));
      domains.append(chip);
    }
    const turns = el("input", { class: "ai-team-input ai-team-input-narrow", attrs: { type: "number", min: "1", max: "120", value: String(current.maxTurns) }, dataset: { testid: "ai-team-form-turns" } });
    turns.addEventListener("input", () => { draft = { ...(draft ?? current), maxTurns: Number(turns.value) || current.maxTurns }; });
    const model = el("input", { class: "ai-team-input", attrs: { type: "text", value: current.model ?? "", placeholder: "비우면 세션 모델" } });
    model.addEventListener("input", () => { const value = model.value.trim(); const next = { ...(draft ?? current) } as PiTeamMember & { model?: string }; if (value) next.model = value; else delete next.model; draft = next; });
    form.append(
      field("이름", name), field("종류", kind), field("소개", summaryInput), field("프롬프트", prompt),
      field("도구 범위 (비우면 전부)", domains), field("턴 상한", turns), field("모델", model),
    );
    const actions = el("div", { class: "ai-team-form-actions" });
    const save = el("button", { class: "ai-team-btn is-primary", text: "저장", attrs: { type: "submit" }, dataset: { testid: "ai-team-form-save" } });
    const cancel = el("button", { class: "ai-team-btn", text: "취소", attrs: { type: "button" } });
    cancel.addEventListener("click", cancelEdit);
    const remove = el("button", { class: "ai-team-btn is-danger", text: "삭제", attrs: { type: "button" }, dataset: { testid: "ai-team-form-remove" } });
    remove.addEventListener("click", () => {
      if (spec.members.length <= 1) return;
      editing = null; draft = null;
      commit({ ...spec, members: spec.members.filter((other) => other.id !== member.id) });
    });
    actions.append(save, cancel, remove);
    form.append(actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = draft ?? current;
      if (!next.label.trim()) { name.focus(); return; }
      editing = null; draft = null;
      commit({ ...spec, members: spec.members.map((other) => (other.id === member.id ? { ...next, label: next.label.trim() } : other)) });
    });
    return form;
  };

  const renderRoster = (): HTMLElement => {
    const section = el("div", { class: "ai-team-section ai-team-roster", dataset: { testid: "ai-team-roster" } });
    const head = el("div", { class: "ai-team-section-head" });
    head.append(el("h3", { class: "ai-team-section-title", text: `팀원 ${spec.members.length}` }));
    const add = el("button", { class: "ai-team-btn", text: "팀원 추가", attrs: { type: "button" }, dataset: { testid: "ai-team-add" } });
    add.addEventListener("click", () => {
      const id = slugifyMemberId("member", new Set(spec.members.map((member) => member.id)));
      const member: PiTeamMember = { id, label: "새 팀원", kind: "builder", summary: "", prompt: "", toolDomains: [], maxTurns: 30, enabled: true };
      spec = saveTeamSpec({ ...spec, members: [...spec.members, member] });
      startEdit(member);
    });
    const reset = el("button", { class: "ai-team-btn", text: "기본 팀으로", attrs: { type: "button" }, dataset: { testid: "ai-team-reset" } });
    reset.addEventListener("click", () => { editing = null; draft = null; spec = resetTeamSpec(); render(); });
    head.append(add, reset);
    section.append(head);
    const list = el("ul", { class: "ai-team-roster-list" });
    for (const member of spec.members) {
      const item = el("li", { class: `ai-team-member role-${member.kind}${member.enabled ? "" : " is-off"}`, dataset: { testid: "ai-team-member", memberId: member.id } });
      const row = el("div", { class: "ai-team-member-row" });
      const toggle = el("input", { attrs: { type: "checkbox", title: member.enabled ? "끄기" : "켜기", "aria-label": `${member.label} 사용` }, dataset: { testid: "ai-team-member-enabled" } });
      toggle.checked = member.enabled;
      toggle.addEventListener("change", () => updateMember(member.id, { enabled: toggle.checked }));
      row.append(
        toggle,
        el("span", { class: "ai-team-role", text: KIND_LABEL[member.kind] }),
        el("span", { class: "ai-team-member-name", text: member.label }),
        el("span", { class: "ai-team-member-summary", text: member.summary || member.prompt.slice(0, 80) || "소개 없음" }),
      );
      const edit = el("button", { class: "ai-team-btn is-quiet", text: editing === member.id ? "닫기" : "편집", attrs: { type: "button", "aria-expanded": String(editing === member.id) }, dataset: { testid: "ai-team-member-edit" } });
      edit.addEventListener("click", () => (editing === member.id ? cancelEdit() : startEdit(member)));
      row.append(edit);
      item.append(row);
      if (editing === member.id) item.append(renderForm(member));
      list.append(item);
    }
    section.append(list);
    const notes = el("textarea", { class: "ai-team-input ai-team-textarea", attrs: { rows: "2", maxlength: "2000", placeholder: "팀장에게 주는 운영 지침 (예: 검수는 한 번만, 장식은 마지막에)" }, dataset: { testid: "ai-team-notes" } });
    notes.value = spec.orchestratorNotes;
    notes.addEventListener("change", () => commit({ ...spec, orchestratorNotes: notes.value }));
    const notesField = el("label", { class: "ai-team-field" });
    notesField.append(el("span", { class: "ai-team-field-label", text: "팀장 지침" }), notes);
    section.append(notesField);
    return section;
  };

  const render = (): void => {
    const running = Boolean(activity && (activity.phase === "실행 중" || activity.phase === "적용 중" || activity.phase === "준비"));
    dot.className = `ai-team-panel-dot${running ? " is-running ai-deck-spin" : activity?.phase === "적용됨" ? " is-done" : activity?.phase === "실패" ? " is-error" : ""}`;
    summary.textContent = liveSummary(spec, activity);
    root.classList.toggle("is-running", running);
    if (!open) return;
    body.replaceChildren(renderNow(), renderRoster());
  };

  const unsubscribeSpec = subscribeTeamSpec((next) => { spec = next; render(); });
  const unsubscribeActivity = subscribeTeamActivity((state) => { activity = state; render(); });
  render();
  return {
    root,
    onToggle: (listener) => { toggleListeners.add(listener); },
    dispose: () => { unsubscribeSpec(); unsubscribeActivity(); },
  };
}
