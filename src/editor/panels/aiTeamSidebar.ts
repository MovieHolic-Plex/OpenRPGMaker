import { friendlyExecutionError } from "@/ai/piAgent/userFacingCopy";
// Live team members have a separate right rail. Opening a member never replaces
// the main conversation. Follow-ups use the existing scoped lane/apply lifecycle.
import { el } from "@/util/dom";
import { store } from "@/project/store";
import { currentTeamReviewActions, subscribeTeamActivity } from "@/ai/piAgent/teamActivity";
import type { TeamBoardAgent, TeamBoardState } from "@/ai/piAgent/teamBoardState";
import type { LaneState } from "@/ai/piAgent/lane";
import { createTeamBudget } from "./aiTeamBudget";
import { loadTeamSpec, saveTeamSpec, subscribeTeamSpec } from "@/ai/piAgent/teamSpecStore";
import { deckIcon, type DeckIconName } from "./aiDeckIcons";
import { createTeamTranscript } from "./aiTeamTranscript";
import { laneSession } from "./aiLaneSession";

interface Member {
  key: string;
  name: string;
  state: string;
  icon: DeckIconName;
  agent?: TeamBoardAgent;
  lane?: LaneState;
}

const laneLabel: Record<LaneState["status"], string> = {
  idle: "대기", running: "실행 중", review: "검토 대기", applied: "적용됨",
  discarded: "버림", failed: "실패", stopped: "중단",
};
const terminalPhases = new Set(["적용됨", "완료", "버림", "중단", "실패"]);

export function createAiTeamSidebar(options: { settings: HTMLElement }): { root: HTMLElement; dispose(): void } {
  const manager = laneSession();
  let activity: TeamBoardState | null = null;
  let selected: string | null = null;
  let view: "team" | "settings" = "team";
  let tab: "chat" | "changes" = "chat";
  let disposed = false;
  let rosterSignature = "";
  const drafts = new Map<string, string>();
  const followUps = new Map<string, string>();
  const notices = new Map<string, string>();
  const transcript = createTeamTranscript({ detail: true });

  const processBody = el("div", { class: "ai-team-process-body" });
  const process = el("details", { class: "ai-team-process", dataset: { testid: "ai-member-process" }, children: [el("summary", { text: "작업 과정" }), processBody] });
  const resultText = el("p", { class: "ai-team-result", dataset: { testid: "ai-member-result" } });
  const conversation = el("div", { children: [resultText, process] });
  let processOwner: string | null = null;
  const title = el("strong");
  const stateText = el("span", { class: "ai-team-member-subtitle" });
  const avatar = el("span", { class: "ai-team-member-avatar" });
  const content = el("div", { class: "ai-team-member-content", dataset: { testid: "ai-member-content", editorNavigationOwner: "true" } });
  const changes = el("div", { class: "ai-team-member-changes" });
  const actions = el("div", { class: "ai-team-member-actions" });
  const notice = el("p", { class: "ai-team-member-notice", attrs: { role: "status" } });
  const receiver = el("label", { class: "ai-team-member-receiver", attrs: { for: "ai-member-input" } });
  const input = el("textarea", {
    attrs: { id: "ai-member-input", rows: "2", placeholder: "이 담당에게 후속 요청…", "aria-label": "팀원 후속 요청" },
    dataset: { testid: "ai-member-input" },
    on: { input: () => { if (selected) drafts.set(selected, input.value); updateSend(); } },
  }) as HTMLTextAreaElement;
  const hint = el("span", { class: "ai-team-member-input-hint" });
  const send = el("button", {
    class: "ai-team-member-send", attrs: { type: "button", "aria-label": "선택한 팀원에게 후속 요청 보내기" },
    dataset: { testid: "ai-member-send" }, children: [deckIcon("arrow-up")],
    on: { click: () => { void sendFollowUp(); } },
  }) as HTMLButtonElement;
  const composer = el("div", { class: "ai-team-member-composer", children: [receiver, input, el("div", { class: "ai-team-member-composer-foot", children: [hint, send] })] });
  const close = el("button", {
    class: "ai-team-member-close", attrs: { type: "button", "aria-label": "팀원 상세 닫기" },
    dataset: { testid: "ai-member-close" }, children: [deckIcon("x")],
    on: { click: () => closeDetail() },
  });
  const tabs = el("div", { class: "ai-team-member-tabs", attrs: { "aria-label": "팀원 보기" } });
  for (const [id, label] of [["chat", "대화 · 진행"], ["changes", "변경 내용"]] as const) tabs.append(el("button", {
    attrs: { type: "button", "aria-pressed": String(id === tab) }, text: label, dataset: { memberTab: id },
    on: { click: () => { tab = id; renderDetail(); } },
  }));
  const budget = createTeamBudget(maxTurns => {
    const m = member();
    if (!m) return;
    const memberId = m.agent?.memberId ?? m.lane?.spec.memberId;
    const spec = loadTeamSpec();
    if (memberId && spec.members.some(s => s.id === memberId)) {
      saveTeamSpec({ ...spec, members: spec.members.map(s => s.id === memberId ? { ...s, maxTurns } : s) });
    } else {
      try { localStorage.setItem(`oprn:team-budget:${m.key}`, String(maxTurns)); } catch { /* Session fallback below. */ }
    }
    budgetOverrides.set(m.key, maxTurns);
    renderDetail();
  });
  const budgetOverrides = new Map<string, number>();
  function selectedBudget(m: Member): number {
    const memberId = m.agent?.memberId ?? m.lane?.spec.memberId;
    const spec = loadTeamSpec().members.find(s => s.id === memberId);
    if (spec) return spec.maxTurns;
    if (budgetOverrides.has(m.key)) return budgetOverrides.get(m.key)!;
    try {
      const saved = Number(localStorage.getItem(`oprn:team-budget:${m.key}`));
      if ([100, 300, 600].includes(saved)) return saved;
    } catch { /* Storage may be unavailable. */ }
    return m.lane?.spec.maxTurns ?? 300;
  }
  const budgetHint = el("small", { text: "다음 실행부터 적용" });
  const budgetSection = el("div", { class: "ai-team-budget-section", children: [el("span", { text: "작업 예산" }), budget.root, budgetHint] });
  const detail = el("section", {
    class: "ai-team-member-detail", attrs: { hidden: "", "aria-label": "선택한 팀원" }, dataset: { testid: "ai-member-detail" },
    children: [el("header", { class: "ai-team-member-head", children: [avatar, el("div", { children: [title, stateText] }), close] }), budgetSection, tabs, content, notice, actions, composer],
  });
  const team = el("button", { class: "ai-team-rail-tab", attrs: { type: "button", "aria-pressed": "true" }, text: "AI 팀", on: { click: () => { view = "team"; render(); } } });
  const roster = el("div", { class: "ai-team-avatar-list", dataset: { testid: "ai-team-avatar-list" }, attrs: { "aria-label": "팀원" } });
  const empty = el("p", { class: "ai-team-sidebar-empty", text: "팀 작업\n없음" });
  const settings = el("button", {
    class: "ai-team-settings-button", attrs: { type: "button", "aria-label": "AI 팀 설정" },
    children: [deckIcon("gear"), el("span", { text: "팀 설정" })],
    on: { click: () => { view = "settings"; render(); } },
  });
  const root = el("aside", {
    class: "ai-team-sidebar", dataset: { testid: "ai-team-sidebar" }, attrs: { "aria-label": "AI 팀 패널" },
    children: [el("div", { class: "ai-team-rail-tabs", children: [team] }), roster, empty, settings, detail],
  });

  const members = (): Member[] => [
    ...(activity?.mode === "team" ? activity.agents : []).filter(a =>
      a.role !== "orchestrator" && !followUps.has(a.agentId)
      // The reducer's flat top-level report placeholder is not a spawned worker.
      && !(a.agentId === "agent" && !a.memberId && !a.task),
    ).map(agent => ({
      key: agent.agentId, name: agent.roleLabel, state: agent.state,
      icon: (agent.role === "reviewer" ? "shield" : /장식|정원|숲/.test(agent.roleLabel) ? "tree" : /이벤트|대화/.test(agent.roleLabel) ? "user" : "house") as DeckIconName, agent,
    })),
    ...manager.lanes().map(lane => ({ key: `lane:${lane.spec.id}`, name: lane.spec.agentLabel, state: laneLabel[lane.status], icon: (lane.spec.readOnly ? "shield" : "user") as DeckIconName, lane })),
  ];
  const member = (): Member | undefined => members().find(m => m.key === selected);
  function blocked(m: Member): string | null {
    if (activity && !terminalPhases.has(activity.phase)) return activity.phase === "검토 대기" ? "팀 결과를 적용하거나 버린 뒤 보낼 수 있어요." : "현재 팀 작업이 끝나면 보낼 수 있어요.";
    if (manager.lanes().some(l => l.status === "running")) return "진행 중인 작업이 끝나면 보낼 수 있어요.";
    if (m.lane?.status === "review") return "결과를 적용하거나 버린 뒤 보낼 수 있어요.";
    if (m.agent && !m.agent.mapId) return "맵 범위가 없는 작업은 왼쪽 AI에 요청하세요.";
    return null;
  }
  function updateSend(): void {
    const m = member(); const reason = m ? blocked(m) : "팀원을 선택하세요.";
    send.disabled = !!reason || !input.value.trim();
    hint.textContent = reason ?? "이전 작업을 이어받는 새 실행";
  }
  function closeDetail(): void {
    const previous = selected; selected = null; view = "team"; render();
    Array.from(roster.querySelectorAll<HTMLButtonElement>("button")).find(b => b.dataset.agentId === previous)?.focus();
  }
  function action(label: string, id: string, fn: () => void): HTMLButtonElement {
    return el("button", { text: label, attrs: { type: "button" }, dataset: { testid: id }, on: { click: fn } }) as HTMLButtonElement;
  }
  function renderDetail(): void {
    if (disposed) return;
    detail.hidden = view === "team" && selected === null;
    if (detail.hidden) return;
    budgetSection.hidden = view !== "team";
    tabs.hidden = view !== "team"; composer.hidden = view !== "team"; notice.hidden = true; actions.replaceChildren();
    if (view === "settings") {
      title.textContent = "AI 팀 설정"; stateText.textContent = "역할 · 모델 · 작업 범위"; avatar.replaceChildren(deckIcon("gear"));
      if (!content.contains(options.settings)) content.replaceChildren(options.settings);
      const toggle = options.settings.querySelector<HTMLButtonElement>("[data-testid=ai-team-panel-toggle]");
      if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
      return;
    }
    const m = member();
    if (!m) { selected = null; detail.hidden = true; return; }
    const turns = selectedBudget(m);
    budget.update(turns);
    budgetHint.textContent = ([100, 300, 600].includes(turns) ? "" : "기존 사용자 설정 유지 · ") + "다음 실행부터 적용";
    title.textContent = m.name; stateText.textContent = m.state;
    avatar.replaceChildren(deckIcon(m.icon)); avatar.dataset.state = m.state;
    receiver.textContent = `${m.name}에게 · 후속 요청`;
    // Keep the textarea node, selection and draft intact during streamed updates.
    if (input.dataset.owner !== m.key) { input.dataset.owner = m.key; input.value = drafts.get(m.key) ?? ""; }
    tabs.querySelectorAll<HTMLElement>("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.memberTab === tab)));
    if (processOwner !== m.key) { process.open = false; processOwner = m.key; }
    if (tab === "chat") {
      if (!content.contains(conversation)) content.replaceChildren(conversation);
      if (m.agent) {
        resultText.textContent = m.agent.summary || (m.state === "실행 중" ? "맡은 작업을 진행하고 있어요." : "아직 결과가 없어요.");
        if (!processBody.contains(transcript.root)) processBody.replaceChildren(transcript.root);
        transcript.update(m.agent);
      } else if (m.lane) {
        const lane = m.lane;
        resultText.textContent = lane.status === "review" ? "결과가 준비됐어요. 변경 내용을 확인하고 적용해 주세요."
          : lane.status === "applied" ? "변경 내용을 적용했어요."
          : lane.status === "discarded" ? "변경안을 버렸어요."
          : lane.status === "stopped" ? "작업을 중단했어요."
          : lane.status === "failed" ? "작업을 끝내지 못했어요."
          : lane.status === "running" ? "맡은 작업을 진행하고 있어요." : "요청을 기다리고 있어요.";
        if (lane.result?.answer) resultText.textContent = lane.result.answer + "\n\n" + resultText.textContent;
        if (lane.result?.spills.length) resultText.textContent += "\n선택한 범위를 벗어난 변경은 제외해요.";
        processBody.replaceChildren(el("p", { class: "ai-team-member-assignment", text: lane.spec.instruction }),
          ...lane.steps.map(step => el("p", { class: `ai-team-member-step is-${step.kind}`, text: step.text })),
          ...(lane.error ? [el("p", { text: lane.error })] : []),
          ...(notices.has(m.key) ? [el("p", { text: notices.get(m.key)! })] : []));
      }
    } else {
      const keys = m.agent?.changedKeys ?? m.lane?.result?.changedKeys ?? [];
      changes.replaceChildren(el("p", { text: m.agent?.summary || m.lane?.result?.answer || (keys.length ? "변경 내용이 있어요. 적용하기 전에 확인해 주세요." : "변경한 내용이 없어요.") }));
      if (m.agent?.review) changes.append(el("p", { text: m.agent.review.ok ? "확인을 마쳤어요." : m.agent.review.findings.join("\n") }));
      if (!content.contains(changes)) content.replaceChildren(changes);
    }
    if (m.lane) {
      const lane = m.lane;
      if (lane.status === "running") actions.append(action("이 작업 중지", "ai-member-stop", () => manager.stop(lane.spec.id)));
      if (lane.status === "review") {
        actions.append(action("적용", "ai-member-apply", () => { void manager.apply(lane.spec.id).then(outcome => { if (!outcome.ok) notices.set(m.key, outcome.issue); renderDetail(); }); }));
        actions.append(action("버리기", "ai-member-discard", () => manager.discard(lane.spec.id)));
      }
    } else if (activity?.phase === "검토 대기") {
      const review = currentTeamReviewActions();
      if (review) {
        if (review.openReport) actions.append(action("팀 변경 보기", "ai-member-report", review.openReport));
        actions.append(action("팀 결과 적용", "ai-member-team-apply", review.apply));
        actions.append(action("팀 결과 버리기", "ai-member-team-discard", review.discard));
      }
    }
    const error = notices.get(m.key) ?? m.lane?.error;
    if (error) { notice.textContent = friendlyExecutionError(error); notice.hidden = false; }
    updateSend();
  }
  function render(): void {
    if (disposed) return;
    const rows = members();
    const signature = JSON.stringify(rows.map(m => [m.key, m.name, m.state, m.icon, view === "team" && selected === m.key]));
    if (signature !== rosterSignature) {
      rosterSignature = signature;
      const focusKey = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(".ai-team-member")?.dataset.agentId;
      roster.replaceChildren(...rows.map(m => {
        const mark = m.state === "완료" || m.state === "적용됨" ? "✓" : m.state === "실패" ? "!" : m.state === "검토 대기" ? "!" : "";
        return el("button", {
          class: "ai-team-member", attrs: { type: "button", "aria-pressed": String(view === "team" && selected === m.key), "aria-label": `${m.name} · ${m.state} · 대화 열기` },
          dataset: { testid: "ai-team-member", agentId: m.key, state: m.state },
          children: [el("span", { class: "ai-team-member-avatar", children: [deckIcon(m.icon, { size: 22 }), el("span", { class: "ai-team-member-badge", text: mark, attrs: { "aria-hidden": "true" } })] }), el("span", { class: "ai-team-member-name", text: m.name }), el("span", { class: "ai-team-member-state", text: m.state })],
          on: { click: () => { selected = selected === m.key && view === "team" ? null : m.key; view = "team"; tab = "chat"; render(); } },
        });
      }));
      if (focusKey) Array.from(roster.querySelectorAll<HTMLButtonElement>("button")).find(b => b.dataset.agentId === focusKey)?.focus();
    }
    empty.hidden = rows.length > 0;
    team.setAttribute("aria-pressed", String(view === "team"));
    renderDetail();
  }
  async function sendFollowUp(): Promise<void> {
    const m = member(); const text = input.value.trim();
    if (!m || !text || blocked(m)) { updateSend(); return; }
    const sourceKey = m.key;
    let lane = m.lane;
    if (!lane && m.agent?.mapId) {
      const agent = m.agent;
      const mapId = agent.mapId;
      if (!mapId) return;
      const spec = loadTeamSpec().members.find(s => s.id === agent.memberId);
      const defaults = manager.defaults();
      const id = `follow_${crypto.randomUUID()}`;
      lane = manager.add({
        id, label: agent.mapName ?? mapId, mapIds: [mapId], agentLabel: agent.roleLabel,
        ...defaults, ...(spec?.model ? { model: spec.model } : {}),
        instruction: [spec?.prompt, `이전 작업: ${agent.task}`, `이전 보고: ${agent.summary || agent.lastLine}`].filter(Boolean).join("\n"),
        memberId: agent.memberId,
        readOnly: agent.role === "reviewer", ...(spec ? { toolDomains: spec.toolDomains, maxTurns: spec.maxTurns } : {}),
      });
      followUps.set(agent.agentId, id);
    }
    if (!lane) return;
    const instruction = [lane.spec.instruction, lane.result?.summary ? `이전 보고: ${lane.result.summary}` : "", `후속 요청: ${text}`].filter(Boolean).join("\n");
    selected = `lane:${lane.spec.id}`;
    notices.delete(selected);
    drafts.set(selected, text); render();
    // start() publishes running before yielding. Only clear a draft after that
    // acknowledgement; a rejected launch must leave the user's message intact.
    const maxTurns = selectedBudget(m);
    budgetOverrides.set(`lane:${lane.spec.id}`, maxTurns);
    const pending = manager.start(lane.spec.id, { instruction, maxTurns });
    if (manager.get(lane.spec.id)?.status === "running") {
      drafts.delete(sourceKey); drafts.delete(`lane:${lane.spec.id}`);
      if (selected === `lane:${lane.spec.id}`) input.value = "";
    }
    const outcome = await pending;
    if (!outcome.ok) {
      const key = `lane:${lane.spec.id}`;
      notices.set(key, outcome.issue ?? "후속 작업을 시작하지 못했습니다.");
      // Preserve a newer draft, but recover the failed request for an easy retry.
      if (!drafts.get(key)) {
        drafts.set(key, text);
        if (selected === key && !input.value) input.value = text;
      }
    }
    if (!disposed) render();
  }
  const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape" && !detail.hidden && root.contains(document.activeElement)) { event.stopPropagation(); closeDetail(); } };
  root.addEventListener("keydown", onKey);
  const unsubscribeTeam = subscribeTeamActivity(next => {
    if (activity?.task !== next?.task) { if (!selected?.startsWith("lane:")) selected = null; followUps.clear(); }
    activity = next; render();
  });
  const unsubscribeBudget = subscribeTeamSpec(() => renderDetail());
  const unsubscribeLanes = manager.subscribe(() => render());

  const unsubscribeStore = store.subscribe((_project, change) => {
    if (change?.projectSwitch) { selected = null; view = "team"; drafts.clear(); followUps.clear(); activity = null; render(); }
  });
  render();
  return { root, dispose: () => { disposed = true; unsubscribeBudget(); unsubscribeTeam(); unsubscribeLanes(); unsubscribeStore(); root.removeEventListener("keydown", onKey); root.remove(); } };
}
