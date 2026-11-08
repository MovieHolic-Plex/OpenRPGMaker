// editor/panels/aiLiveStatus.ts
// 입력창 바로 위 한 줄 — 조수가 지금 무엇을 하는지 쉬운 말로(「숲속 마을에 집 짓는 중 · 4/9 단계」).
// 누르면 단계 목록(✓ 끝 · ● 지금 · ○ 다음)이 펼쳐지고, 맵을 바꾼 단계에는 전/후 작은 그림이 붙는다.
// 재료는 실행 이벤트뿐이다: tool_start/tool_end(단계), map_delta(전/후 그림), v2 의 todo 도구 인자(다음 단계).
// 단계 이름은 aiToolLabels 의 사람 말을 쓴다 — 도구 원문 이름은 화면에 내지 않는다.
import { applyMapDeltas } from "@/ai/piAgent/mapDelta";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { followRegionsFromDeltas } from "@/editor/aiFollowCamera";
import { aiActivityActionLabel } from "@/editor/aiActivityNarration";
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import type { GameMap, Project } from "@/project/types";
import { el } from "@/util/dom";
import { toolLabel } from "./aiToolLabels";

export type LiveStepState = "done" | "now" | "next" | "failed";

export interface LiveStep {
  readonly key: string;
  readonly label: string;
  state: LiveStepState;
  mapId?: string;
  before?: GameMap;
  after?: GameMap;
  region?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

/** 읽기·확인 도구는 단계로 세지 않는다 — 단계 목록이 「살펴보는 중」으로 가득 차면 무엇을 지었는지가 묻힌다. */
const QUIET_PREFIXES = ["get_", "show_", "find_", "list_", "query_", "check_", "lint_", "evaluate_", "explain_", "analyze_", "look_", "read_", "inspect_", "preview_", "search_"];
const QUIET_TOOLS = new Set(["todo", "find_tools", "web_search", "focus_editor_view", "highlight_map_region", "set_build_spec"]);

export function isQuietTool(name: string): boolean {
  return QUIET_TOOLS.has(name) || QUIET_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/** v2 todo 도구의 init/append 인자에서 할 일 문장을 꺼낸다(다음 단계 ○ 재료). */
export function plannedStepsFromTodoArgs(args: unknown): { readonly op: "init" | "append"; readonly items: readonly string[] } | null {
  if (!args || typeof args !== "object") return null;
  const p = args as { op?: unknown; list?: unknown; items?: unknown };
  const text = (item: unknown): string | null => {
    if (typeof item === "string") return item.trim() || null;
    if (item && typeof item === "object") {
      const content = (item as { content?: unknown }).content;
      return typeof content === "string" && content.trim() ? content.trim() : null;
    }
    return null;
  };
  const op = p.op === "append" ? "append" : p.op === "init" || (p.op === undefined && Array.isArray(p.list)) ? "init" : null;
  if (!op) return null;
  const groups = Array.isArray(p.list) ? p.list as { items?: unknown }[] : [{ items: p.items }];
  const items = groups.flatMap((group) => Array.isArray(group?.items) ? group.items.map(text).filter((t): t is string => Boolean(t)) : []);
  return items.length ? { op, items } : null;
}

/** 한 줄 — 「<맵>에서 <하는 일> · n/m 단계」. 계획이 없으면 분모를 지어내지 않는다. */
export function liveStatusHeadline(input: { readonly action: string; readonly mapName?: string; readonly done: number; readonly planned: number }): string {
  const where = input.mapName ? `${input.mapName}에서 ` : "";
  const total = Math.max(input.planned, input.done);
  const count = input.planned > 0 ? `${Math.min(input.done + 1, total)}/${total} 단계` : input.done > 0 ? `${input.done}단계 끝` : "";
  return [`${where}${input.action}`, count].filter(Boolean).join(" · ");
}

export interface AiLiveStatus {
  readonly root: HTMLElement;
  event(event: PiAgentEvent): void;
  status(text: string): void;
  finish(): void;
}

const THUMB_WIDTH = 88;
const THUMB_STEP_LIMIT = 12;

export function createAiLiveStatus(options: { readonly baseProject: Project }): AiLiveStatus {
  let project = options.baseProject;
  let maps: Record<string, GameMap> = { ...(project.maps ?? {}) };
  const steps: LiveStep[] = [];
  const planned: string[] = [];
  const running = new Map<string, LiveStep>();
  let lastWrite: LiveStep | null = null;
  let finished = false;
  let fallback = "요청을 읽고 있어요";

  const line = el("span", { class: "ai-status-live-line", dataset: { testid: "ai-live-status-line" }, text: fallback });
  const caret = el("span", { class: "ai-status-live-caret", attrs: { "aria-hidden": "true" } });
  const toggle = el("button", {
    class: "ai-status-live-toggle",
    attrs: { type: "button", "aria-expanded": "false", "aria-controls": "ai-status-live-steps" },
    dataset: { testid: "ai-live-status" },
    children: [el("span", { class: "ai-status-live-signal", attrs: { "aria-hidden": "true" } }), line, caret],
  }) as HTMLButtonElement;
  const list = el("ol", { class: "ai-status-live-steps", attrs: { id: "ai-status-live-steps", "aria-label": "작업 단계" }, dataset: { testid: "ai-live-status-steps" } });
  list.hidden = true;
  const root = el("div", { class: "ai-status-live", attrs: { role: "status", "aria-live": "polite" }, children: [toggle, list] });
  toggle.addEventListener("click", () => {
    list.hidden = !list.hidden;
    toggle.setAttribute("aria-expanded", String(!list.hidden));
    root.classList.toggle("is-open", !list.hidden);
    if (!list.hidden) renderList();
  });

  const mapName = (mapId: string | undefined): string | undefined => {
    if (!mapId) return undefined;
    const map = maps[mapId];
    return map?.name?.trim() || undefined;
  };
  const mapIdOf = (args: unknown): string | undefined => {
    const id = args && typeof args === "object" ? (args as { mapId?: unknown }).mapId : undefined;
    return typeof id === "string" ? id : undefined;
  };

  const paintLine = (): void => {
    const now = [...running.values()].at(-1);
    const done = steps.filter((step) => step.state === "done").length;
    const text = now
      ? liveStatusHeadline({ action: aiActivityActionLabel(now.key.split("|")[1] ?? ""), mapName: mapName(now.mapId), done, planned: planned.length })
      : finished
        ? (done ? `${done}단계를 마쳤어요` : steps.length ? `${steps.length}단계를 시도했지만 끝내지 못했어요` : fallback)
        : liveStatusHeadline({ action: fallback, done, planned: planned.length });
    line.textContent = text;
    toggle.disabled = steps.length === 0 && planned.length === 0;
    // 단계 없이 끝난 턴(연결 실패·시작 거부)은 「요청을 읽고 있어요」를 남기지 않는다 — 실패 안내는 대화 쪽에 있다.
    root.hidden = finished && steps.length === 0;
  };

  const thumb = (step: LiveStep, which: "before" | "after"): HTMLElement => {
    const slot = el("span", { class: `ai-status-live-step-thumb is-${which}`, attrs: { title: which === "before" ? "전" : "후" } });
    const map = which === "before" ? step.before : step.after;
    if (map && step.region) {
      void renderRegionSnapshot({ ...project, maps: { ...project.maps, [map.id]: map } } as Project, map, step.region, { targetWidth: THUMB_WIDTH })
        .then((canvas) => slot.replaceChildren(canvas))
        .catch(() => { slot.classList.add("is-empty"); });
    } else slot.classList.add("is-empty");
    return slot;
  };

  const renderList = (): void => {
    if (list.hidden) return;
    const shownSteps = steps.slice(-30);
    const thumbFrom = Math.max(0, shownSteps.length - THUMB_STEP_LIMIT);
    const rows = shownSteps.map((step, index) => {
      const mark = step.state === "done" ? "✓" : step.state === "now" ? "●" : step.state === "failed" ? "!" : "○";
      const children: HTMLElement[] = [
        el("span", { class: "ai-status-live-step-mark", attrs: { "aria-hidden": "true" }, text: mark }),
        el("span", { class: "ai-status-live-step-label", text: [step.label, mapName(step.mapId)].filter(Boolean).join(" · ") }),
      ];
      if (step.region && index >= thumbFrom) {
        children.push(el("span", { class: "ai-status-live-step-pair", children: [thumb(step, "before"), el("span", { class: "ai-status-live-step-arrow", attrs: { "aria-hidden": "true" }, text: "→" }), thumb(step, "after")] }));
      }
      return el("li", { class: `ai-status-live-step is-${step.state}`, dataset: { state: step.state }, children });
    });
    const doneCount = steps.filter((step) => step.state === "done").length;
    const remaining = planned.slice(Math.min(doneCount, planned.length)).slice(steps.some((step) => step.state === "now") ? 1 : 0, 6);
    for (const text of remaining) {
      rows.push(el("li", { class: "ai-status-live-step is-next", dataset: { state: "next" }, children: [
        el("span", { class: "ai-status-live-step-mark", attrs: { "aria-hidden": "true" }, text: "○" }),
        el("span", { class: "ai-status-live-step-label", text }),
      ] }));
    }
    list.replaceChildren(...rows);
  };

  const refresh = (): void => { paintLine(); renderList(); };
  paintLine();

  return {
    root,
    status(text) {
      if (finished) return;
      fallback = text.replace(/[….]+$/u, "");
      if (!running.size) paintLine();
    },
    event(raw) {
      if (finished) return;
      let event = raw;
      let agent = "root";
      while (event.type === "agent_event") { agent = event.agentId; event = event.event; }
      if (event.type === "tool_start") {
        if (event.name === "todo") {
          const plan = plannedStepsFromTodoArgs(event.args);
          if (plan) { if (plan.op === "init") planned.length = 0; planned.push(...plan.items); refresh(); }
          return;
        }
        if (isQuietTool(event.name)) return;
        const step: LiveStep = { key: `${agent}:${event.id}|${event.name}`, label: toolLabel(event.name), state: "now", mapId: mapIdOf(event.args) };
        running.set(`${agent}:${event.id}`, step);
        steps.push(step);
        refresh();
        return;
      }
      if (event.type === "tool_end") {
        const step = running.get(`${agent}:${event.id}`);
        if (!step) return;
        running.delete(`${agent}:${event.id}`);
        step.state = event.ok ? "done" : "failed";
        lastWrite = event.ok ? step : null;
        refresh();
        return;
      }
      if (event.type === "map_delta" && event.maps.length) {
        const before = maps;
        maps = applyMapDeltas(maps, event.maps);
        const region = followRegionsFromDeltas(event.maps, (id) => maps[id]).at(-1);
        // 순서 계약: tool_end 다음에 그 도구의 map_delta 가 온다(piAgentRuntime). 바로 앞에 끝난 단계에 붙인다.
        if (region && lastWrite && !lastWrite.region) {
          const pad = 2;
          const map = maps[region.mapId]!;
          const x = Math.max(0, region.x - pad), y = Math.max(0, region.y - pad);
          lastWrite.mapId ??= region.mapId;
          lastWrite.region = { x, y, width: Math.min(map.width - x, region.w + pad * 2), height: Math.min(map.height - y, region.h + pad * 2) };
          lastWrite.before = before[region.mapId] ?? { ...map, lowerTiles: map.lowerTiles.map(() => 0), upperTiles: map.upperTiles.map(() => 0), events: [] };
          lastWrite.after = map;
          renderList();
        }
        lastWrite = null;
        return;
      }
      if (event.type === "done" && raw.type === "done") {
        project = raw.project;
      }
    },
    finish() {
      if (finished) return;
      finished = true;
      for (const step of running.values()) if (step.state === "now") step.state = "done";
      running.clear();
      root.classList.add("is-finished");
      refresh();
    },
  };
}
