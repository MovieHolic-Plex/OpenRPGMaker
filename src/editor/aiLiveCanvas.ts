// 맵 위 실시간 시공 연출(고스트·청사진·카메라 따라가기·공개 대기)의 켜짐.
// 작업 기록의 표시 수준과는 별개다. 꺼도 도구 실행·초안·적용은 그대로다.

export const AI_LIVE_CANVAS_EVENT = "oprn-ai-live-canvas";
const KEY = "oprn:ai-live-canvas";
const listeners = new Set<() => void>();
let fallback = true;
let cached: boolean | undefined;

function readStored(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
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
