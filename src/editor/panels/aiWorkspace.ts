import { el } from "@/util/dom";
import { t } from "@/i18n";
import type { createAiTeamSidebar } from "./aiTeamSidebar";
import { createWorkspaceLogs } from "./aiWorkspaceLogs";
import { createAiInbox } from "./aiInbox";

const TAB_KEY = "oprn:ai-workspace-tab";
type Tab = "chat" | "team";

/** One live workspace, with each existing session/input kept mounted. */
export function createAiWorkspace(options: {
  panel: HTMLElement; deck: HTMLElement; body: HTMLElement; commandBar: HTMLElement; outcome: HTMLElement;
  team: ReturnType<typeof createAiTeamSidebar>; input: HTMLTextAreaElement; requestOpen(): void; requestFold(): void;
}) {
  let active: Tab = "chat";
  try { if (localStorage.getItem(TAB_KEY) === "team") active = "team"; } catch { /* Local preference is optional. */ }
  let explicitTeam = false;
  let wide = false;
  let studio = false;
  let empty = false;
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
  // 사람이 움직여야 하는 일(검토·실패)만 맨 위에 — 진행 상황은 지도와 상태 줄이 맡는다.
  const inbox = createAiInbox({ openLogs: () => { options.requestOpen(); logs.trigger.click(); } });
  tabs.before(inbox.root);
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
    const showTeam = !studio && (wide || active === "team");
    body.hidden = !showChat; body.inert = !showChat;
    team.root.hidden = !showTeam; team.root.inert = !showTeam;
    commandBar.hidden = !showChat && !team.root.querySelector<HTMLElement>(".ai-team-member-detail")?.hidden;
    commandBar.inert = commandBar.hidden;
    outcome.hidden = !showChat;
    // 대화 화면에서는 탭이 없다 — 받은함 + 대화 한 화면. 조수 상세는 상태 줄 팝오버의 「조수 상세」로 들어오고, 거기서 탭으로 돌아간다.
    tabs.hidden = wide || studio || active === "chat";
    panel.dataset.workspaceTab = active;
    chatTab.setAttribute("aria-selected", String(active === "chat"));
    teamTab.setAttribute("aria-selected", String(active === "team"));
    chatTab.tabIndex = active === "chat" ? 0 : -1;
    teamTab.tabIndex = active === "team" ? 0 : -1;
    teamTab.textContent = count ? `조수 ${count}` : "조수";
  };
  const select = (tab: Tab, remember = true) => {
    active = tab;
    explicitTeam = tab === "team";
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
  const onOpenTeam = () => { options.requestOpen(); select("team"); };
  const onOpenChat = () => { options.requestOpen(); select("chat", false); };
  window.addEventListener("oprn:ai-open-team", onOpenTeam);
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
    dispose() { window.removeEventListener("oprn:ai-open-team", onOpenTeam); window.removeEventListener("oprn:ai-open-chat", onOpenChat); inbox.dispose(); inbox.root.remove(); options.input.removeEventListener("input", syncDraft); starter.remove(); logs.dispose(); team.root.removeEventListener("oprn:ai-member-selection", onMember); team.root.removeEventListener("oprn:ai-workspace-team", onTeam); team.root.removeEventListener("oprn:ai-workspace-map", onMap); },
  };
}
