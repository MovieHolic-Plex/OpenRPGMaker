import { el } from "@/util/dom";
import { t } from "@/i18n";
import type { createAiTeamSidebar } from "./aiTeamSidebar";
import { createWorkspaceLogs } from "./aiWorkspaceLogs";
import { createAiInbox } from "./aiInbox";
import { createSideThreads } from "./aiSideThreads";

const TAB_KEY = "oprn:ai-workspace-tab";
type Tab = "chat" | "team";

export function createAiWorkspace(options: {
  panel: HTMLElement; deck: HTMLElement; body: HTMLElement; commandBar: HTMLElement; outcome: HTMLElement;
  team: ReturnType<typeof createAiTeamSidebar>; input: HTMLTextAreaElement; requestOpen(): void; requestFold(): void;
  showTeamUi?: boolean;
}) {
  const showTeamUi = options.showTeamUi !== false;
  let active: Tab = "chat";
  try { if (showTeamUi && localStorage.getItem(TAB_KEY) === "team") active = "team"; } catch { /* Local preference is optional. */ }
  let explicitTeam = false;
  let wide = false;
  let studio = false;
  let empty = false;
  const { panel, deck, body, commandBar, outcome, team } = options;
  panel.classList.add("is-workspace");
  const tabs = el("div", { class: "ai-workspace-tabs", attrs: { role: "tablist", "aria-label": "AI 작업 보기" }, dataset: { testid: "ai-workspace-tabs" } });
  const chatTab = el("button", { text: "대화", attrs: { type: "button", title: "조수에게 묻고 지시하는 대화창", role: "tab", id: "ai-workspace-chat-tab", "aria-controls": "ai-workspace-chat" }, dataset: { testid: "ai-workspace-chat-tab" } }) as HTMLButtonElement;
  const teamTab = el("button", { text: "작업", attrs: { type: "button", title: "조수에게 맡긴 작업과 진행을 보는 곳", role: "tab", id: "ai-workspace-team-tab", "aria-controls": "ai-workspace-team" }, dataset: { testid: "ai-workspace-team-tab" } }) as HTMLButtonElement;
  body.id = "ai-workspace-chat"; body.setAttribute("role", "tabpanel"); body.setAttribute("aria-labelledby", chatTab.id);
  team.root.id = "ai-workspace-team"; team.root.setAttribute("role", "tabpanel"); team.root.setAttribute("aria-labelledby", teamTab.id);
  team.setEmbedded(true);
  tabs.append(...(showTeamUi ? [teamTab, chatTab] : [chatTab]));
  body.before(tabs);
  body.after(team.root);
  const logs = createWorkspaceLogs(() => team.getLogSelection(), () => options.requestOpen());
  tabs.after(logs.root);
  // 사람이 움직여야 하는 일(검토·실패)만 맨 위에 — 진행 상황은 지도와 상태 줄이 맡는다.
  const inbox = createAiInbox({ openLogs: () => { options.requestOpen(); logs.trigger.click(); } });
  tabs.before(inbox.root);
  // 다른 맵·영역에서 도는 일은 메인 대화 밖의 자기 스레드 — 대화(로그) 바로 위 트레이에 모은다.
  const sideThreads = createSideThreads();
  body.before(sideThreads.root);
  deck.querySelector(".ai-deck-rail-actions")?.prepend(logs.trigger);
  const starterButtons: HTMLButtonElement[] = [];
  const starter = el("section", { class: "ai-workspace-starter", attrs: { hidden: "", "aria-label": "첫 요청 시작하기" }, dataset: { testid: "ai-workspace-starter" }, children: [
    el("h3", { text: "무엇을 도와드릴까요?" }),
    el("p", { text: "원하는 일을 적어주세요. 아래 예시로 시작해도 좋아요." }),
  ] });
  for (const [label, request] of [
    ["현재 맵 살펴보기", "현재 맵을 살펴보고, 무엇이 있는지와 개선할 점을 알려줘. 아직 수정하지 마."],
    ["만들고 싶은 장면 설명하기", "만들고 싶은 장면: "]
  ]) {
    const button = el("button", { text: label, attrs: { type: "button" }, on: { click: () => {
      // A starter is a draft, never an execution or replacement of an existing request.
      if (!options.input.value.trim()) {
        options.input.value = t(request);
        options.input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      options.input.focus();
    } } }) as HTMLButtonElement;
    starterButtons.push(button); starter.append(button);
  }
  body.prepend(starter);
  const syncDraft = () => starterButtons.forEach(button => button.disabled = Boolean(options.input.value.trim()));
  options.input.addEventListener("input", syncDraft); syncDraft();
  const sync = () => {
    const count = team.root.querySelectorAll('[data-testid="ai-team-member"]').length;
    if (!count && active === "team" && !explicitTeam) active = "chat";
    starter.hidden = !empty || studio;
    panel.classList.toggle("has-workspace-starter", empty && !studio);
    const showChat = wide || studio || active === "chat";
    const showTeam = showTeamUi && !studio && (wide || active === "team");
    body.hidden = !showChat; body.inert = !showChat;
    team.root.hidden = !showTeam; team.root.inert = !showTeam;
    // 조수 탭에서는 팀원 상세가 자기 후속 입력창을 갖는다 — 아래 대화 입력창까지 보이면 입력창이 둘이 된다.
    commandBar.hidden = !showChat;
    commandBar.inert = commandBar.hidden;
    outcome.hidden = !showChat;
    // 조수 UI 가 켜져 있으면 「대화 | 조수」 탭을 늘 보인다 — 팀원이 0 명이어도 조수 탭의 「팀 설정」으로 실행 전에 팀을 꾸린다.
    tabs.hidden = !showTeamUi || wide || studio;
    // 같은 값을 다시 쓰지 않는다 — 조수 이벤트마다 sync 가 돌고(스트림 24초에 85번), 같은 값 쓰기도 스타일 무효화를 일으킨다(2026-10-15 실측).
    if (panel.dataset.workspaceTab !== active) panel.dataset.workspaceTab = active;
    const chatSelected = String(active === "chat"), teamSelected = String(active === "team");
    if (chatTab.getAttribute("aria-selected") !== chatSelected) chatTab.setAttribute("aria-selected", chatSelected);
    if (teamTab.getAttribute("aria-selected") !== teamSelected) teamTab.setAttribute("aria-selected", teamSelected);
    const chatIndex = active === "chat" ? 0 : -1, teamIndex = teamTab.isConnected && active === "team" ? 0 : -1;
    if (chatTab.tabIndex !== chatIndex) chatTab.tabIndex = chatIndex;
    if (teamTab.tabIndex !== teamIndex) teamTab.tabIndex = teamIndex;
    const teamLabel = count ? `작업 ${count}` : "작업";
    if (teamTab.textContent !== teamLabel) teamTab.textContent = teamLabel;
  };
  const select = (tab: Tab, remember = true) => {
    if (tab === "team" && !showTeamUi) {
      active = "chat";
      explicitTeam = false;
      sync();
      return;
    }
    active = tab;
    explicitTeam = tab === "team";
    if (remember) try { localStorage.setItem(TAB_KEY, tab); } catch { /* Local preference is optional. */ }
    if (tab === "team") team.openFirstMember();
    sync();
  };
  chatTab.addEventListener("click", () => select("chat"));
  teamTab.addEventListener("click", () => select("team"));
  tabs.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    select(event.key === "Home" ? "team" : event.key === "End" ? "chat" : active === "chat" ? "team" : "chat");
    (active === "chat" ? chatTab : teamTab).focus();
  });
  const onMember = () => { sync(); logs.refreshSelection(); };
  const onTeam = () => { if (showTeamUi) { options.requestOpen(); select("team", false); } };
  const onMap = () => options.requestFold();
  // 상태 줄 칩의 「조수 상세 패널 열기」: detail.id / detail.agentId 로 그 조수의 상세를 바로 연다.
  const memberId = (event: Event): string | undefined => {
    const detail = (event as CustomEvent<{ id?: string; agentId?: string } | null>).detail;
    return detail?.agentId ?? detail?.id;
  };
  const onOpenTeam = (event: Event) => {
    if (!showTeamUi) return;
    options.requestOpen();
    select("team", false);
    team.openMember(memberId(event));
  };
  // 칩만 눌렀을 때: 조수 화면이 이미 보이면 같은 조수로 맞춘다(도크를 열거나 탭을 바꾸지 않는다).
  const onSelectMember = (event: Event) => { if (showTeamUi && !team.root.hidden) team.openMember(memberId(event)); };
  const onOpenChat = () => { options.requestOpen(); select("chat", false); };
  window.addEventListener("oprn:ai-open-team", onOpenTeam);
  window.addEventListener("oprn:ai-team-select", onSelectMember);
  window.addEventListener("oprn:ai-open-chat", onOpenChat);
  team.root.addEventListener("oprn:ai-member-selection", onMember);
  team.root.addEventListener("oprn:ai-workspace-team", onTeam);
  team.root.addEventListener("oprn:ai-workspace-map", onMap);
  // Member render events update counts without opening or switching the workspace.
  sync();
  return {
    setEmpty(on: boolean) { empty = on; syncDraft(); sync(); },
    showChat() { select("chat", false); },
    setStudio(on: boolean) { studio = on; sync(); },
    setWide(on: boolean) { wide = on; team.setEmbedded(!on); if (on) logs.close(); sync(); },
    dispose() { window.removeEventListener("oprn:ai-open-team", onOpenTeam); window.removeEventListener("oprn:ai-team-select", onSelectMember); window.removeEventListener("oprn:ai-open-chat", onOpenChat); inbox.dispose(); inbox.root.remove(); sideThreads.dispose(); options.input.removeEventListener("input", syncDraft); starter.remove(); logs.dispose(); team.root.removeEventListener("oprn:ai-member-selection", onMember); team.root.removeEventListener("oprn:ai-workspace-team", onTeam); team.root.removeEventListener("oprn:ai-workspace-map", onMap); },
  };
}
