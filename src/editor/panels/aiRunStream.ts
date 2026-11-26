// editor/panels/aiRunStream.ts
// 조수 작업 스트림 카드(목업 v4, 오너 승인 2026-11-24). 입력창 바로 위, 옛 한 줄 상태(aiLiveStatus)를 머리줄로 품는다.
// 상태는 aiRunTimeline 이 이벤트에서 만들고, 여기서는 그리기만 한다. 그리기는 한 프레임에 한 번으로 묶는다.
// 일꾼 미리보기는 맵 목록과 같은 내용 해시 썸네일 캐시(mapThumbnail → 공용 thumbCache 로 옮겨 갈 자리)를 쓴다.
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { labelRunningForm } from "@/editor/aiActivityNarration";
import { el } from "@/util/dom";
import type { AiLiveStatus } from "./aiLiveStatus";
import { createRunTimeline, type TimelineLane, type TimelineRow, type TimelineSnapshot } from "./aiRunTimeline";
import { createMapThumbnail } from "./mapThumbnail";

export const RUN_STREAM_HUES = ["#1F6FC5", "#18764F", "#8E44AD", "#C26A00", "#5F5E5B", "#B5302E"] as const;
const LANE_ROW_LIMIT = 12;
const TIME_ROW_LIMIT = 30;
const PREVIEW_LIMIT = 4;
const PREVIEW_W = 120;
const PREVIEW_H = 84;

export interface AiRunStream {
  readonly root: HTMLElement;
  event(event: PiAgentEvent): void;
  status(text: string): void;
  finish(ok: boolean): void;
  snapshot(): TimelineSnapshot;
}

export interface AiRunStreamOptions {
  readonly live: AiLiveStatus;
  readonly team?: boolean;
  /** 이 턴이 빈 프로젝트의 첫 MVP 생성이다 — 끝 화면이 «MVP까지 만들었어요» 다. */
  readonly firstMvp?: boolean;
  /** 첫 MVP 끝 카드의 «초안 한 장 보기» 링크. */
  readonly onDraftView?: () => void;
  readonly mapName?: (mapId: string) => string | undefined;
  readonly onPreview?: (mapId: string) => void;
  /** 한 번 그리는 데 든 시간(ms) — 프레임 예산 계측용. */
  readonly onPaint?: (ms: number) => void;
  readonly now?: () => number;
}

export function formatSeconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const hue = (lane: TimelineLane | undefined): string => RUN_STREAM_HUES[(lane?.hue ?? 0) % RUN_STREAM_HUES.length]!;
const withLane = <T extends HTMLElement>(node: T, lane: TimelineLane | undefined): T => { node.style.setProperty("--lane", hue(lane)); return node; };

export function createAiRunStream(options: AiRunStreamOptions): AiRunStream {
  const now = options.now ?? (() => Date.now());
  const timeline = createRunTimeline({ now, team: options.team === true, ...(options.mapName ? { mapName: options.mapName } : {}) });
  let view: "lanes" | "time" = "lanes";
  let scheduled = false;
  let ticker: ReturnType<typeof setInterval> | null = null;
  const previewVersion = new Map<string, number>();
  const previewNodes = new Map<string, { readonly version: number; readonly node: HTMLElement }>();

  const clock = el("span", { class: "ai-run-stream-clock", dataset: { testid: "ai-run-stream-clock" } });
  const title = el("span", { class: "ai-run-stream-title" });
  const seg = (id: "lanes" | "time", text: string) => el("button", {
    class: "ai-run-stream-seg-btn", text, attrs: { type: "button", "aria-pressed": String(view === id) }, dataset: { view: id },
    on: { click: () => { view = id; paint(); } },
  });
  const segLanes = seg("lanes", "조수별");
  const segTime = seg("time", "시간순");
  const segRow = el("div", { class: "ai-run-stream-seg", attrs: { role: "group", "aria-label": "보기" }, children: [segLanes, segTime] });
  const head = el("div", { class: "ai-run-stream-head", children: [title, segRow, clock] });
  const todos = el("ol", { class: "ai-run-stream-todos", dataset: { testid: "ai-run-stream-todos" } });
  const previews = el("div", { class: "ai-run-stream-previews", dataset: { testid: "ai-run-stream-previews" } });
  const body = el("div", { class: "ai-run-stream-body", dataset: { testid: "ai-run-stream-body" } });
  const end = el("div", { class: "ai-run-stream-end", dataset: { testid: "ai-run-stream-end" } });
  end.hidden = true;
  const root = el("section", {
    class: "ai-run-stream", attrs: { "aria-label": "조수 작업" }, dataset: { testid: "ai-run-stream" },
    children: [options.live.root, end, head, todos, previews, body],
  });

  const rowElement = (row: TimelineRow, lanesById: ReadonlyMap<string, TimelineLane>, showWho: boolean): HTMLElement => {
    const at = now();
    const mark = row.state === "running" ? "●" : row.state === "failed" ? "!" : "✓";
    const lane = lanesById.get(row.laneId);
    const label = row.kind === "tool" && row.state === "running" ? labelRunningForm(row.label) : row.label;
    const name = el("span", { class: "ai-run-row-name", children: [
      ...(showWho && lane ? [el("span", { class: "ai-run-row-who", text: lane.title })] : []),
      el("span", { text: label }),
      ...(row.name ? [el("span", { class: "ai-run-row-raw", text: row.name })] : []),
    ] });
    const ms = row.kind === "tool" ? el("span", { class: "ai-run-row-ms", text: formatSeconds(row.durationMs ?? at - row.startedAt) }) : el("span");
    const result = [row.result, row.changedCells ? `바뀐 칸 ${row.changedCells.toLocaleString("ko-KR")}` : "", row.realMs !== undefined ? `실제 시공 ${formatSeconds(row.realMs)}` : ""].filter(Boolean).join(" · ");
    return withLane(el("li", {
      class: `ai-run-row is-${row.state} is-${row.kind}`, dataset: { state: row.state, ...(row.name ? { tool: row.name } : {}) },
      children: [
        el("span", { class: "ai-run-row-bar", attrs: { "aria-hidden": "true" } }),
        el("span", { class: "ai-run-row-mark", attrs: { "aria-hidden": "true" }, text: mark }),
        name, ms,
        ...(row.args ? [el("span", { class: "ai-run-row-args", text: row.args })] : []),
        ...(result ? [el("span", { class: "ai-run-row-result", text: result })] : []),
      ],
    }), lane);
  };

  /** 읽기 도구는 한 줄로 묶는다 — 줄이 수백 개가 되면 무엇을 지었는지가 묻힌다. */
  const visibleRows = (rows: readonly TimelineRow[], limit: number): { rows: TimelineRow[]; hidden: number; reads: number } => {
    const loud = rows.filter((row) => !row.quiet || row.state === "running");
    const reads = rows.length - loud.length;
    return { rows: loud.slice(-limit), hidden: Math.max(0, loud.length - limit), reads };
  };

  const laneBlock = (lane: TimelineLane, rows: readonly TimelineRow[], lanesById: ReadonlyMap<string, TimelineLane>): HTMLElement => {
    const own = visibleRows(rows.filter((row) => row.laneId === lane.id), LANE_ROW_LIMIT);
    const state = lane.state === "running" ? "작업 중" : lane.state === "done" ? "끝" : "실패";
    return withLane(el("div", {
      class: `ai-run-lane is-${lane.state}`, dataset: { testid: "ai-run-lane", lane: lane.id, role: lane.role },
      children: [
        el("div", { class: "ai-run-lane-head", children: [
          el("b", { text: lane.title }),
          ...(lane.mapName ? [el("span", { class: "ai-run-lane-map", text: lane.mapName })] : []),
          el("span", { class: "ai-run-lane-raw", text: lane.rawName }),
          el("span", { class: "ai-run-lane-state", text: state }),
        ] }),
        ...(own.hidden || own.reads ? [el("p", { class: "ai-run-lane-more", text: [own.hidden ? `앞의 ${own.hidden}개` : "", own.reads ? `살펴보기 ${own.reads}번` : ""].filter(Boolean).join(" · ") })] : []),
        el("ul", { class: "ai-run-rows", children: own.rows.map((row) => rowElement(row, lanesById, false)) }),
        ...(lane.text.trim() ? [el("p", { class: "ai-run-lane-said", dataset: { testid: "ai-run-lane-said" }, text: lane.text.trim() })] : []),
      ],
    }), lane);
  };

  const previewTargets = (snap: TimelineSnapshot): { mapId: string; lane: TimelineLane | undefined; row: TimelineRow | undefined }[] => {
    const lanesById = new Map(snap.lanes.map((lane) => [lane.id, lane]));
    const seen = new Map<string, { mapId: string; lane: TimelineLane | undefined; row: TimelineRow | undefined }>();
    for (const row of snap.rows) {
      if (!row.mapId || !(row.changedCells ?? 0)) continue;
      seen.delete(row.mapId);
      seen.set(row.mapId, { mapId: row.mapId, lane: lanesById.get(row.laneId), row });
    }
    for (const lane of snap.lanes) if (lane.mapId && !seen.has(lane.mapId)) seen.set(lane.mapId, { mapId: lane.mapId, lane, row: undefined });
    return [...seen.values()].slice(-PREVIEW_LIMIT);
  };

  const paintPreviews = (snap: TimelineSnapshot): void => {
    const targets = previewTargets(snap);
    previews.hidden = targets.length === 0;
    const at = now();
    const cards = targets.map(({ mapId, lane, row }) => {
      const version = previewVersion.get(mapId) ?? 0;
      let cached = previewNodes.get(mapId);
      if (!cached || cached.version !== version) {
        cached = { version, node: createMapThumbnail(mapId, { width: PREVIEW_W, height: PREVIEW_H, className: "ai-run-preview-canvas", testId: `ai-run-preview-${mapId}` }) };
        previewNodes.set(mapId, cached);
      }
      const running = row?.state === "running" || lane?.state === "running";
      const line = row ? `${row.state === "running" ? labelRunningForm(row.label) : `${row.state === "failed" ? "!" : "✓"} ${row.label}`} ${formatSeconds(row.durationMs ?? at - row.startedAt)}` : "";
      return withLane(el("button", {
        class: `ai-run-preview${running ? " is-running" : ""}`, attrs: { type: "button", title: "누르면 이 맵을 열어요" },
        dataset: { testid: "ai-run-preview", mapId },
        on: { click: () => options.onPreview?.(mapId) },
        children: [cached.node, el("span", { class: "ai-run-preview-who", text: [lane?.title, lane?.mapName ?? options.mapName?.(mapId)].filter(Boolean).join(" · ") }), el("span", { class: "ai-run-preview-tool", text: line })],
      }), lane);
    });
    const working = snap.lanes.filter((l) => l.state === "running" && l.role !== "orchestrator").length;
    previews.replaceChildren(el("p", { class: "ai-run-previews-head", text: working ? `일꾼 미리보기 · ${working} 작업 중` : "일꾼 미리보기" }), ...cards);
  };

  const paintTodos = (snap: TimelineSnapshot): void => {
    todos.hidden = snap.todos.length === 0;
    const marks = { open: "○", now: "●", done: "✓", dropped: "–", blocked: "!" } as const;
    todos.replaceChildren(...snap.todos.map((todo) => el("li", { class: `ai-run-todo is-${todo.state}`, dataset: { state: todo.state }, children: [
      el("span", { class: "ai-run-todo-mark", attrs: { "aria-hidden": "true" }, text: marks[todo.state] }), el("span", { text: todo.text }),
    ] })));
  };

  const paintEnd = (snap: TimelineSnapshot): void => {
    end.hidden = !snap.outcome || snap.finishedAt === null;
    if (end.hidden || !snap.outcome) return;
    const spent = formatClock((snap.finishedAt ?? now()) - snap.startedAt);
    const head = !snap.outcome.ok ? (snap.outcome.stoppedEarly ? `도중에 멈췄어요 · ${snap.outcome.stoppedEarly}` : "끝내지 못했어요")
      : options.firstMvp ? "MVP까지 만들었어요" : "끝났어요";
    end.classList.toggle("is-failed", !snap.outcome.ok);
    const draftLink = snap.outcome.ok && options.firstMvp && options.onDraftView
      ? [el("button", { class: "ai-run-stream-draft-link", text: "초안 한 장 보기", attrs: { type: "button" }, dataset: { testid: "ai-run-stream-draft-link" }, on: { click: () => options.onDraftView?.() } })]
      : [];
    end.replaceChildren(el("strong", { text: head }), el("span", { text: `맵 ${snap.outcome.changedMaps}장 바뀜 · 도구 ${snap.outcome.tools}번 · ${spent}` }), ...draftLink);
  };

  const paint = (): void => {
    scheduled = false;
    const paintStart = typeof performance !== "undefined" ? performance.now() : 0;
    const snap = timeline.snapshot();
    const lanesById = new Map(snap.lanes.map((lane) => [lane.id, lane]));
    title.textContent = snap.team ? `팀 실행 · 조수 ${snap.lanes.length}` : "조수 실행";
    clock.textContent = formatClock((snap.finishedAt ?? now()) - snap.startedAt);
    segLanes.setAttribute("aria-pressed", String(view === "lanes"));
    segTime.setAttribute("aria-pressed", String(view === "time"));
    segRow.hidden = snap.lanes.length < 2;
    paintTodos(snap);
    paintPreviews(snap);
    if (view === "lanes" || snap.lanes.length < 2) body.replaceChildren(...snap.lanes.map((lane) => laneBlock(lane, snap.rows, lanesById)));
    else {
      const all = visibleRows(snap.rows, TIME_ROW_LIMIT);
      body.replaceChildren(el("ul", { class: "ai-run-rows is-timeline", children: all.rows.map((row) => rowElement(row, lanesById, true)) }));
    }
    paintEnd(snap);
    root.dataset.state = snap.finishedAt === null ? "running" : snap.outcome?.ok ? "done" : "failed";
    if (options.onPaint && typeof performance !== "undefined") options.onPaint(performance.now() - paintStart);
  };

  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(paint);
    else setTimeout(paint, 16);
  };

  const ensureTicker = (): void => {
    if (ticker || typeof setInterval !== "function") return;
    ticker = setInterval(() => { if (timeline.snapshot().finishedAt === null) schedule(); }, 1000);
  };

  paint();
  return {
    root,
    event(event) {
      options.live.event(event);
      let inner = event;
      while (inner.type === "agent_event") inner = inner.event;
      if (inner.type === "map_delta") for (const delta of inner.maps) previewVersion.set(delta.mapId, (previewVersion.get(delta.mapId) ?? 0) + 1);
      if (inner.type === "heartbeat") return;
      timeline.apply(event);
      ensureTicker();
      schedule();
    },
    status(text) { options.live.status(text); },
    finish(ok) {
      options.live.finish();
      timeline.finish(ok);
      if (ticker) { clearInterval(ticker); ticker = null; }
      // 패널이 이미 내려갔으면(문서가 없음 — 시험 해체·창 닫힘 뒤 늦게 끝난 실행) 그릴 곳이 없다.
      if (typeof document === "undefined") return;
      paint();
      root.scrollTop = 0;
    },
    snapshot: () => timeline.snapshot(),
  };
}
