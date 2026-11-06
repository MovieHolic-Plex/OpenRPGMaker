// 「에이전트 모드」 설정. 에이전트를 띄울 수 있는 표면(데스크톱 앱·이 PC 의 로컬 호스트)에서는 기본으로 켜져
// 조수 창에 「에이전트」 탭이 생긴다 — 앱 안에서 설치·로그인까지 하므로 새 사용자가 찾을 수 있어야 한다.
// 사용자가 설정에서 끄면 그 선택("off")을 지킨다.
const KEY = "oprn:agent-mode";
export const AGENT_MODE_SETTING_EVENT = "oprn:agent-mode-setting";

export function isAgentModeEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function setAgentModeEnabled(enabled: boolean): void {
  try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch { /* 저장소가 막힌 창: 이번 세션만 */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(AGENT_MODE_SETTING_EVENT, { detail: enabled }));
}

/** 에이전트를 띄울 수 있는 표면인가 — 데스크톱 앱과 이 컴퓨터의 로컬 브라우저 호스트만. */
export function agentModeAvailable(): boolean {
  return typeof window !== "undefined" && window.oprn?.agent !== undefined;
}
