// 「에이전트 모드 (실험)」 설정. 기본 꺼짐 — 켠 사람에게만 조수 도크에 에이전트 탭이 생긴다.
const KEY = "oprn:agent-mode";
export const AGENT_MODE_SETTING_EVENT = "oprn:agent-mode-setting";

export function isAgentModeEnabled(): boolean {
  try { return localStorage.getItem(KEY) === "on"; } catch { return false; }
}

export function setAgentModeEnabled(enabled: boolean): void {
  try { if (enabled) localStorage.setItem(KEY, "on"); else localStorage.removeItem(KEY); } catch { /* 저장소가 막힌 창: 이번 세션만 */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(AGENT_MODE_SETTING_EVENT, { detail: enabled }));
}

/** 에이전트를 띄울 수 있는 표면인가 — 데스크톱 앱과 이 컴퓨터의 로컬 브라우저 호스트만. */
export function agentModeAvailable(): boolean {
  return typeof window !== "undefined" && window.oprn?.agent !== undefined;
}
