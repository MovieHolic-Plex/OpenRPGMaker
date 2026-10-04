import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { isAiLiveCanvasEnabled, subscribeAiLiveCanvas } from "@/editor/aiLiveCanvas";
import { narrateAiActivity } from "@/editor/aiActivityNarration";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { bindActivityLevel, getActivityLevel } from "./aiActivityPreference";

interface Activity {
  readonly agentId: string;
  readonly callId: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
}

type WorkerPhase = "thinking" | "reading" | "building" | "reviewing" | "attention" | "done" | "failed";
interface Worker {
  readonly id: string;
  readonly number: number;
  label?: string;
  mapId?: string;
  mapName?: string;
  phase: WorkerPhase;
}

export interface CanvasActivity {
  handleEvent(event: PiAgentEvent): void;
  dispose(): void;
}

let releasePrevious: (() => void) | undefined;

/** Run-owned, observational UI. Tool completion never claims application or storage. */
export function createCanvasActivity(getProject: () => Project): CanvasActivity {
  releasePrevious?.();
  if (typeof document === "undefined") return { handleEvent() {}, dispose() {} };
  const host = document.querySelector<HTMLElement>(".phaser-container");
  if (!host) return { handleEvent() {}, dispose() {} };

  const started = performance.now();
  const active = new Map<string, Activity>();
  const workers = new Map<string, Worker>();
  const history: { label: string; target: string; ok: boolean }[] = [];
  let processed = 0;
  let disposed = false;
  let phase = "preparing";
  let action = "작업을 준비하는 중";
  let target = "";
  let folded = false;

  const title = el("span", { class: "ai-canvas-activity-title", text: "AI 작업" });
  const clock = el("span", { class: "ai-canvas-activity-clock", attrs: { "aria-hidden": "true", translate: "no" }, text: "0:00" });
  const toggle = el("button", {
    class: "ai-canvas-activity-toggle", text: "−",
    attrs: { type: "button", "aria-label": "작업 상태판 접기", "aria-expanded": "true" },
  });
  const status = el("div", { class: "ai-canvas-activity-action", attrs: { role: "status", "aria-live": "polite" }, text: action });
  const location = el("div", { class: "ai-canvas-activity-target", text: "프로젝트" });
  const count = el("span", { text: "처리한 작업 0건" });
  const parallel = el("ol", { class: "ai-canvas-activity-workers", attrs: { "aria-label": "병렬 작업" } });
  const remaining = el("div", { class: "ai-canvas-activity-more" });
  const recent = el("ol", { class: "ai-canvas-activity-recent", attrs: { "aria-label": "최근 처리한 작업" } });
  const root = el("aside", {
    class: "ai-canvas-activity", attrs: { "aria-label": "조수 실시간 작업" },
    dataset: { testid: "ai-canvas-activity", phase },
    children: [
      el("div", { class: "ai-canvas-activity-head", children: [
        el("span", { class: "ai-canvas-activity-signal", attrs: { "aria-hidden": "true" } }), title, clock, toggle,
      ] }),
      el("div", { class: "ai-canvas-activity-body", children: [status, location,
        parallel, remaining,
        el("div", { class: "ai-canvas-activity-meta", children: [count] }), recent,
      ] }),
      el("div", { class: "ai-canvas-activity-sweep", attrs: { "aria-hidden": "true" } }),
    ],
  });
  toggle.addEventListener("click", () => {
    folded = !folded;
    root.classList.toggle("is-folded", folded);
    toggle.textContent = folded ? "+" : "−";
    toggle.setAttribute("aria-label", folded ? "작업 상태판 펼치기" : "작업 상태판 접기");
    toggle.setAttribute("aria-expanded", String(!folded));
  });
  const syncVisibility = (): void => {
    root.hidden = !isAiLiveCanvasEnabled() || getActivityLevel() === "none";
  };
  bindActivityLevel(root, syncVisibility);
  const unsubscribe = subscribeAiLiveCanvas(syncVisibility);
  host.append(root);
  const timer = setInterval(() => {
    const seconds = Math.floor((performance.now() - started) / 1000);
    clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }, 1000);

  const describe = (activity: Activity, done = false, ok = true) => {
    const project = getProject();
    const args = activity.args;
    const nested = args.target && typeof args.target === "object" ? args.target as Record<string, unknown> : undefined;
    const mapId = typeof args.mapId === "string" ? args.mapId : typeof nested?.mapId === "string" ? nested.mapId : workers.get(activity.agentId)?.mapId;
    const tilesetId = typeof args.tilesetId === "string" ? args.tilesetId : undefined;
    const narration = narrateAiActivity({ toolName: activity.name, args, done, ok, mapName: mapId ? project.maps[mapId]?.name ?? mapId : undefined });
    const tileset = tilesetId ? project.tilesets[tilesetId] : undefined;
    return { label: narration.action, target: narration.target || tileset?.name || tilesetId || "" };
  };
  const show = (nextPhase: string, nextAction: string, nextTarget = target): void => {
    phase = nextPhase;
    root.dataset.phase = phase;
    if (action !== nextAction) { action = nextAction; status.textContent = action; }
    if (target !== nextTarget) {
      target = nextTarget;
      location.setAttribute("translate", target ? "no" : "yes");
      location.textContent = target || "프로젝트";
    }
  };
  const ensureWorker = (id: string): Worker => {
    let worker = workers.get(id);
    if (!worker) { worker = { id, number: workers.size + 1, phase: "thinking" }; workers.set(id, worker); }
    return worker;
  };
  const latestFor = (id: string): Activity | undefined => [...active.values()].filter(item => item.agentId === id).at(-1);
  const toolPhase = (name: string): WorkerPhase => /^(check|evaluate|inspect|validate|lint)_/.test(name) ? "reviewing"
    : /^(get|read|list|find|show|query|analyze|suggest|preview|render|explain)_/.test(name) ? "reading" : "building";
  const workerAction = (worker: Worker): string => {
    const current = latestFor(worker.id);
    if (current) return describe(current).label;
    return worker.phase === "done" ? "작업을 마쳤어요" : worker.phase === "failed" ? "작업을 마치지 못했어요"
      : worker.phase === "attention" ? "작업 상태를 확인하는 중" : "다음 작업을 정리하는 중";
  };
  const pendingWorkers = (): Worker[] => [...workers.values()].filter(worker => worker.phase !== "done" && worker.phase !== "failed");
  const pendingCount = (): number => active.size + pendingWorkers().filter(worker => !latestFor(worker.id)).length;
  const renderWorkers = (): void => {
    const pending = pendingWorkers();
    // Keep ongoing workers first; completed workers remain visible as context.
    const ordered = [...pending.flatMap<{ worker: Worker; current: Activity | undefined }>(worker => {
      const calls = [...active.values()].filter(item => item.agentId === worker.id);
      return calls.length ? calls.map(current => ({ worker, current })) : [{ worker, current: undefined }];
    }), ...[...workers.values()].filter(worker => !pending.includes(worker)).map(worker => ({ worker, current: undefined }))];
    parallel.hidden = ordered.length < 2;
    root.classList.toggle("has-parallel-work", !parallel.hidden);
    remaining.hidden = ordered.length <= 4;
    if (parallel.hidden) { parallel.replaceChildren(); return; }
    parallel.replaceChildren(...ordered.slice(0, 4).map(({ worker, current }) => {
      const rowPhase = current ? toolPhase(current.name) : worker.phase;
      const description = current ? describe(current) : undefined;
      const name = worker.label || worker.mapName || (worker.mapId ? getProject().maps[worker.mapId]?.name ?? worker.mapId : "");
      return el("li", { class: `is-${rowPhase}`, dataset: { agentId: worker.id, toolCallId: current?.callId ?? "" }, children: [
        el("span", { class: "ai-canvas-worker-signal", text: rowPhase === "done" ? "✓" : rowPhase === "failed" || rowPhase === "attention" ? "!" : "•", attrs: { "aria-hidden": "true" } }),
        el("div", { children: [
          el("div", { class: "ai-canvas-worker-name", text: name || `작업 ${worker.number}`, attrs: name ? { translate: "no" } : {} }),
          el("div", { class: "ai-canvas-worker-action", text: description?.label ?? workerAction(worker) }),
          ...(description?.target && description.target !== name ? [el("div", { class: "ai-canvas-worker-target", text: description.target, attrs: { translate: "no" } })] : []),
        ] }),
      ] });
    }));
    remaining.textContent = `추가 작업 ${Math.max(0, ordered.length - 4)}개`;
  };
  const showActive = (): void => {
    renderWorkers();
    const pending = pendingWorkers();
    const concurrent = pendingCount();
    const latest = [...active.values()].at(-1);
    if (!latest) {
      const issue = [...workers.values()].find(worker => worker.phase === "attention" || worker.phase === "failed");
      const checking = workers.size > 0 && pending.length === 0;
      show(issue ? "attention" : checking ? "reviewing" : "thinking", issue ? "작업 상태를 확인하는 중"
        : checking ? "작업 결과를 확인하는 중" : concurrent > 1 ? `동시에 ${concurrent}개 작업 중` : "다음 작업을 정리하는 중");
      return;
    }
    const text = describe(latest);
    show(toolPhase(latest.name), concurrent > 1 ? `동시에 ${concurrent}개 작업 중` : text.label, concurrent > 1 ? "" : text.target);
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    clearInterval(timer);
    unsubscribe();
    root.remove();
    active.clear();
    workers.clear();
    if (releasePrevious === dispose) releasePrevious = undefined;
  };
  releasePrevious = dispose;
  return {
    dispose,
    handleEvent(raw) {
      if (disposed) return;
      let event = raw;
      let agentId = "root";
      while (event.type === "agent_event") { agentId = event.agentId; event = event.event; }
      const keyFor = (id: string): string => JSON.stringify([agentId, id]);
      const clearWorker = (id: string): void => { for (const [key, activity] of active) if (activity.agentId === id) active.delete(key); };
      if (event.type === "agent_spawn") {
        const worker = ensureWorker(event.agentId);
        worker.label = event.label;
        worker.mapId = event.mapId ?? undefined;
        worker.mapName = event.mapName ?? undefined;
        worker.phase = "thinking";
        showActive();
      } else if (event.type === "tool_start") {
        const worker = ensureWorker(agentId);
        const args = event.args && typeof event.args === "object" ? event.args as Record<string, unknown> : {};
        worker.phase = toolPhase(event.name);
        if (!worker.mapId && typeof args.mapId === "string") worker.mapId = args.mapId;
        active.set(keyFor(event.id), { agentId, callId: event.id, name: event.name, args });
        showActive();
      } else if (event.type === "tool_end") {
        const key = keyFor(event.id);
        const activity = active.get(key);
        // Replayed ends, or events without their start, must not invent completed work.
        if (!activity) return;
        active.delete(key);
        const worker = ensureWorker(agentId);
        const other = latestFor(agentId);
        worker.phase = other ? toolPhase(other.name) : event.ok ? "thinking" : "attention";
        const text = describe(activity, true, event.ok);
        history.push({ ...text, ok: event.ok });
        if (history.length > 3) history.shift();
        processed += 1;
        count.textContent = `처리한 작업 ${processed}건`;
        recent.replaceChildren(...history.map(item => el("li", {
          class: item.ok ? "is-ok" : "is-failed", children: [
            el("span", { class: "ai-canvas-activity-result", text: item.ok ? "✓" : "!", attrs: { "aria-hidden": "true" } }),
            el("span", { class: "ai-canvas-activity-recent-label", text: item.label }),
            el("span", { class: "ai-canvas-activity-recent-target", text: item.target, attrs: { translate: "no" } }),
          ],
        })));
        showActive();
        if (!event.ok && !active.size && workers.size === 1) show("attention", text.label, text.target);
      } else if (event.type === "start" || event.type === "turn") {
        const worker = ensureWorker(agentId);
        if (!latestFor(agentId)) worker.phase = "thinking";
        showActive();
      } else if (event.type === "error") {
        ensureWorker(agentId).phase = "attention";
        showActive();
      } else if (event.type === "done") {
        if (raw.type === "done") {
          active.clear();
          for (const worker of workers.values()) if (worker.phase !== "failed") worker.phase = "done";
        } else clearWorker(agentId);
        ensureWorker(agentId).phase = event.stoppedEarly ? "failed" : "done";
        showActive();
      } else if (event.type === "agent_done") {
        clearWorker(event.agentId);
        ensureWorker(event.agentId).phase = event.ok ? "done" : "failed";
        showActive();
      }
    },
  };
}
