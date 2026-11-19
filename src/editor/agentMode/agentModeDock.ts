// The ChatGPT route uses the editor's Pi composer. The local agent panel owns ACP sessions.
import { AI_CONFIG_CHANGED_EVENT } from "@/ai/llmClient";
import { CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";
import { AI_CONNECTION_STATUS_CHANGED_EVENT, getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { el } from "@/util/dom";
import { AGENT_MODE_SETTING_EVENT, agentModeAvailable, isAgentModeEnabled } from "./agentModeSetting";
import { renderAgentModePanel } from "./agentModePanel";

export function mountAgentModeDock(host: HTMLElement): () => void {
  let unmount: (() => void) | undefined;

  const mount = (): void => {
    const bridge = window.oprn?.agent;
    if (unmount || !bridge) return;
    let selectedAgent = false;
    let userPicked = false;
    let preferLocal = false;
    let localReady: boolean | undefined;
    const usesChatGpt = (status: ReturnType<typeof getAiConnectionStatus>): boolean =>
      status.authMode === "chatgpt" && status.providerId === CODEX_PROVIDER_ID;

    const select = (agent: boolean): void => {
      userPicked = true;
      selectedAgent = agent;
      render();
    };
    const assistantTab = el("button", {
      class: "agent-mode-tab", text: "조수", attrs: { type: "button", role: "tab" },
      dataset: { testid: "agent-mode-tab-assistant" }, on: { click: () => select(false) },
    });
    const setupLabel = el("span", { class: "agent-mode-tab-setup", text: "설정 필요", attrs: { hidden: "" } });
    const agentTab = el("button", {
      class: "agent-mode-tab", attrs: { type: "button", role: "tab" },
      dataset: { testid: "agent-mode-tab-agent" }, on: { click: () => select(true) },
      children: [el("span", { text: "에이전트" }), setupLabel],
    });
    const tabs = el("div", {
      class: "agent-mode-tabs", attrs: { role: "tablist", "aria-label": "AI 작업 방식" }, children: [assistantTab, agentTab],
      on: { keydown: (event) => {
        const key = (event as KeyboardEvent).key;
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
        event.preventDefault();
        const agent = key === "End" || (key !== "Home" && !selectedAgent);
        select(agent);
        (agent ? agentTab : assistantTab).focus();
      } },
    });

    const status = el("span", {
      text: "ChatGPT 사용 준비됨", attrs: { role: "status" }, dataset: { testid: "agent-mode-chatgpt-ready" },
    });
    const switchRoute = el("button", {
      class: "agent-mode-btn", attrs: { type: "button" }, dataset: { testid: "agent-mode-switch-route" },
      on: { click: () => { preferLocal = !preferLocal; render(); } },
    });
    const route = el("div", { class: "agent-mode-route", children: [status, switchRoute] });

    function render(): void {
      const connection = getAiConnectionStatus();
      const isChatGpt = usesChatGpt(connection);
      const chatGptReady = isChatGpt && connection.kind === "ready";
      const usingChatGpt = selectedAgent && chatGptReady && !preferLocal;
      const needsSetup = localReady === false && !chatGptReady && !(isChatGpt && connection.kind === "checking");
      host.classList.toggle("is-agent-mode", selectedAgent && !usingChatGpt);
      host.classList.toggle("is-chatgpt-agent", selectedAgent && chatGptReady);
      assistantTab.setAttribute("aria-selected", String(!selectedAgent));
      agentTab.setAttribute("aria-selected", String(selectedAgent));
      assistantTab.tabIndex = selectedAgent ? -1 : 0;
      agentTab.tabIndex = selectedAgent ? 0 : -1;
      setupLabel.hidden = !needsSetup;
      agentTab.title = needsSetup ? "에이전트 설치·로그인이 필요합니다" : "";
      route.hidden = !(selectedAgent && chatGptReady);
      status.hidden = !usingChatGpt;
      status.textContent = connection.limited ? connection.label : "ChatGPT 사용 준비됨";
      switchRoute.textContent = usingChatGpt ? "이 PC의 에이전트 사용" : "ChatGPT 사용";
    }

    const panel = renderAgentModePanel(bridge, (ready) => {
      localReady = ready;
      const connection = getAiConnectionStatus();
      if (!userPicked && ready && !(usesChatGpt(connection) && (connection.kind === "ready" || connection.kind === "checking"))) {
        selectedAgent = true;
      }
      render();
    });
    host.classList.add("has-agent-mode");
    host.prepend(tabs, route);
    host.append(panel.root);
    window.addEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, render);
    window.addEventListener(AI_CONFIG_CHANGED_EVENT, render);
    render();
    unmount = () => {
      window.removeEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, render);
      window.removeEventListener(AI_CONFIG_CHANGED_EVENT, render);
      panel.dispose();
      tabs.remove();
      route.remove();
      panel.root.remove();
      host.classList.remove("has-agent-mode", "is-agent-mode", "is-chatgpt-agent");
      unmount = undefined;
    };
  };

  const sync = (): void => {
    if (isAgentModeEnabled() && agentModeAvailable()) mount();
    else unmount?.();
  };
  window.addEventListener(AGENT_MODE_SETTING_EVENT, sync);
  sync();
  return () => {
    window.removeEventListener(AGENT_MODE_SETTING_EVENT, sync);
    unmount?.();
  };
}
