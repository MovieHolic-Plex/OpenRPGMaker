// 맵 위 실시간 시공 연출(고스트·시공 막·청사진·카메라 따라가기).
// 기본은 켜짐 — 2026-09-25 에 유리 블러 성능 수정과 함께 꺼짐으로 뒤집혔는데, 그 뒤로 사용자는 조수가
// 맵에 무엇을 하는지 한 번도 보지 못했다(2026-10-03 실측). 렉이 문제면 사용자가 「맵에 시공 보이기」로 끈다.
// 작업 기록의 표시 수준과는 별개고, 꺼도 도구 실행·초안·적용은 그대로다.

export const AI_LIVE_CANVAS_EVENT = "oprn-ai-live-canvas";
const KEY = "oprn:ai-live-canvas";
const listeners = new Set<() => void>();
let fallback = true;
let cached: boolean | undefined;

function readStored(): boolean {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === null ? fallback : stored !== "off";
  } catch {
    return fallback;
  }
}

export function subscribeAiLiveCanvas(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isAiLiveCanvasEnabled(): boolean {
  if (cached === undefined) cached = readStored();
  return cached;
}

export function setAiLiveCanvasEnabled(enabled: boolean): void {
  fallback = enabled;
  cached = enabled;
  try {
    localStorage.setItem(KEY, enabled ? "on" : "off");
  } catch {
    // 저장이 막혀도 이 세션의 cached 값이 연출을 결정한다.
  }
  for (const listener of [...listeners]) listener();
  if (typeof document !== "undefined") {
    document.querySelectorAll<HTMLElement>("[data-ai-live-canvas-surface]").forEach((node) => {
      node.dispatchEvent(new Event(AI_LIVE_CANVAS_EVENT));
    });
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AI_LIVE_CANVAS_EVENT));
}
