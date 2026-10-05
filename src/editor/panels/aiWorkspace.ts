import { el } from "@/util/dom";
import type { createAiTeamSidebar } from "./aiTeamSidebar";
import { createWorkspaceLogs } from "./aiWorkspaceLogs";

const TAB_KEY = "oprn:ai-workspace-tab";
type Tab = "chat" | "team";

/** One live workspace, with each existing session/input kept mounted. */
export function createAiWorkspace(options: {
  panel: HTMLElement; deck: HTMLElement; body: HTMLElement; commandBar: HTMLElement; outcome: HTMLElement;
  team: ReturnType<typeof createAiTeamSidebar>; requestOpen(): void; requestFold(): void;
}) {
  let active: Tab = "chat";
  try { if (localStorage.getItem(TAB_KEY) === "team") active = "team"; } catch { /* Local preference is optional. */ }
  let wide = false;
  let studio = false;
  const { panel, deck, body, commandBar, outcome, team } = options;
  panel.classList.add("is-workspace");
  const tabs = el("div", { class: "ai-workspace-tabs", attrs: { role: "tablist", "aria-label": "AI 작업 보기" }, dataset: { testid: "ai-workspace-tabs" } });
  const chatTab = el("button", { text: "대화", attrs: { type: "button", role: "tab", id: "ai-workspace-chat-tab", "aria-controls": "ai-workspace-chat" }, dataset: { testid: "ai-workspace-chat-tab" } }) as HTMLButtonElement;
  const teamTab = el("button", { text: "조수", attrs: { type: "button", role: "tab", id: "ai-workspace-team-tab", "aria-controls": "ai-workspace-team" }, dataset: { testid: "ai-workspace-team-tab" } }) as HTMLButtonElement;
  body.id = "ai-workspace-chat"; body.setAttribute("role", "tabpanel"); body.setAttribute("aria-labelledby", chatTab.id);
  team.root.id = "ai-workspace-team"; team.root.setAttribute("role", "tabpanel"); team.root.setAttribute("aria-labelledby", teamTab.id);
  team.setEmbedded(true);
  tabs.append(teamTab, chatTab);
  body.before(tabs);
  body.after(team.root);
  const logs = createWorkspaceLogs(() => team.getLogSelection(), () => options.requestOpen());
  tabs.after(logs.root);
  deck.querySelector(".ai-deck-rail-actions")?.prepend(logs.trigger);
  const sync = () => {
    const showChat = wide || studio || active === "chat";
    const showTeam = !studio && (wide || active === "team");
    body.hidden = !showChat; body.inert = !showChat;
    team.root.hidden = !showTeam; team.root.inert = !showTeam;
    commandBar.hidden = !showChat && !team.root.querySelector<HTMLElement>(".ai-team-member-detail")?.hidden;
    commandBar.inert = commandBar.hidden;
    outcome.hidden = !showChat;
    tabs.hidden = wide || studio;
    panel.dataset.workspaceTab = active;
    chatTab.setAttribute("aria-selected", String(active === "chat"));
    teamTab.setAttribute("aria-selected", String(active === "team"));
    chatTab.tabIndex = active === "chat" ? 0 : -1;
    teamTab.tabIndex = active === "team" ? 0 : -1;
    const count = team.root.querySelectorAll('[data-testid="ai-team-member"]').length;
    teamTab.textContent = count ? `조수 ${count}` : "조수";
  };
  const select = (tab: Tab, remember = true) => {
    active = tab;
    if (remember) try { localStorage.setItem(TAB_KEY, tab); } catch { /* Preference only. */ }
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
  const onTeam = () => { options.requestOpen(); select("team", false); };
  const onMap = () => options.requestFold();
  team.root.addEventListener("oprn:ai-member-selection", onMember);
  team.root.addEventListener("oprn:ai-workspace-team", onTeam);
  team.root.addEventListener("oprn:ai-workspace-map", onMap);
  // Member render events update counts without opening or switching the workspace.
  sync();
  return {
    showChat() { select("chat", false); },
    setStudio(on: boolean) { studio = on; sync(); },
    setWide(on: boolean) { wide = on; team.setEmbedded(!on); if (on) logs.close(); sync(); },
    dispose() { logs.dispose(); team.root.removeEventListener("oprn:ai-member-selection", onMember); team.root.removeEventListener("oprn:ai-workspace-team", onTeam); team.root.removeEventListener("oprn:ai-workspace-map", onMap); },
  };
}
