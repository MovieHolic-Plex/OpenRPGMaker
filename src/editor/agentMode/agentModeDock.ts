// 조수 도크 위에 「조수 | 에이전트 (실험)」 탭을 붙인다. 설정이 꺼져 있거나 에이전트를 띄울 수 없는 표면이면 아무것도 붙이지 않는다.
import { el } from "@/util/dom";
import { AGENT_MODE_SETTING_EVENT, agentModeAvailable, isAgentModeEnabled } from "./agentModeSetting";
import { renderAgentModePanel } from "./agentModePanel";

export function mountAgentModeDock(host: HTMLElement): () => void {
  let mounted: { tabs: HTMLElement; panel: { root: HTMLElement; dispose: () => void } } | null = null;

  const unmount = (): void => {
    if (!mounted) return;
    mounted.panel.dispose();
    mounted.tabs.remove();
    mounted.panel.root.remove();
    host.classList.remove("has-agent-mode", "is-agent-mode");
    mounted = null;
  };

  const mount = (): void => {
    const bridge = window.oprn?.agent;
    if (mounted || !bridge) return;
    const select = (agentMode: boolean): void => {
      host.classList.toggle("is-agent-mode", agentMode);
      assistantTab.setAttribute("aria-selected", String(!agentMode));
      agentTab.setAttribute("aria-selected", String(agentMode));
    };
    const assistantTab = el("button", { class: "agent-mode-tab", text: "조수", attrs: { type: "button", role: "tab" }, dataset: { testid: "agent-mode-tab-assistant" }, on: { click: () => select(false) } });
    const agentTab = el("button", { class: "agent-mode-tab", text: "에이전트", attrs: { type: "button", role: "tab" }, dataset: { testid: "agent-mode-tab-agent" }, on: { click: () => select(true) } });
    const tabs = el("div", { class: "agent-mode-tabs", attrs: { role: "tablist" }, children: [assistantTab, agentTab] });
    // 처음엔 조수 탭. 쓸 수 있는 에이전트가 생기면(설치·로그인 완료) 사용자가 탭을 직접 고르기 전까지 에이전트 탭을 기본으로 연다.
    let userPicked = false;
    assistantTab.addEventListener("click", () => { userPicked = true; });
    agentTab.addEventListener("click", () => { userPicked = true; });
    let wasReady: boolean | null = null;
    const panel = renderAgentModePanel(bridge, (ready) => {
      if (ready === wasReady) return;
      const first = wasReady === null;
      wasReady = ready;
      agentTab.classList.toggle("is-setup-needed", !ready);
      agentTab.title = ready ? "" : "에이전트 설치·로그인이 필요합니다";
      if (!userPicked && (ready || first)) select(ready);
    });
    host.classList.add("has-agent-mode");
    host.prepend(tabs);
    host.append(panel.root);
    mounted = { tabs, panel };
    select(false);
  };

  const sync = (): void => {
    if (isAgentModeEnabled() && agentModeAvailable()) mount();
    else unmount();
  };
  window.addEventListener(AGENT_MODE_SETTING_EVENT, sync);
  sync();
  return () => {
    window.removeEventListener(AGENT_MODE_SETTING_EVENT, sync);
    unmount();
  };
}
