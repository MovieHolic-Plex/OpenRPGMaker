import { el } from "@/util/dom";
import { activityText, type ActivityEntry, type ActivityTrace } from "@/ai/activityTrace";
import { activityArchiveFailed, readActivityArchive, retainActivityTrace } from "@/ai/activityTraceArchive";
import { bindActivityLevel, createActivityLevelControl, getActivityLevel } from "./aiActivityPreference";
import { toolLabel } from "./aiToolLabels";

export interface ActivityView { root: HTMLElement; update(trace: ActivityTrace | undefined, actor?: string): void }
const clock = (ms: number): string => `${Math.floor(Math.max(0, ms) / 60000).toString().padStart(2, "0")}:${Math.floor(Math.max(0, ms) / 1000 % 60).toString().padStart(2, "0")}`;
const label = (entry: ActivityEntry): string => entry.kind === "tool" ? toolLabel(entry.name) : entry.summary;
const actorLabel = (trace: ActivityTrace, actor: string): string => trace.actors[actor] ?? (actor === "system" ? "실행" : actor === "agent" ? "조수" : actor);

export function createActivityView(options: { archive?: boolean; historical?: boolean } = {}): ActivityView {
  let trace: ActivityTrace | undefined;
  let actor: string | undefined;
  let shown = 50;
  let severity = "all";
  let selectedActor = "";
  let actorSignature = "";
  let query = "";
  const opened = new Set<string>();
  const root = el("section", { class: "ai-activity-view", dataset: { testid: "ai-activity-view" }, attrs: { "aria-label": "작업 과정" } });
  const meta = el("p", { class: "ai-activity-meta" });
  const filter = el("select", { attrs: { "aria-label": "실행 기록 종류" }, children: [el("option", { attrs: { value: "all" }, text: "전체 기록" }), el("option", { attrs: { value: "tool" }, text: "도구 실행" }), el("option", { attrs: { value: "error" }, text: "오류·검수 지적" })] }) as HTMLSelectElement;
  const actorFilter = el("select", { attrs: { "aria-label": "실행 담당자" } }) as HTMLSelectElement;
  const latest = el("button", { text: "최신으로", attrs: { type: "button" }, on: { click: () => { list.lastElementChild?.scrollIntoView({ block: "nearest" }); } } });
  const search = el("input", { attrs: { type: "search", placeholder: "도구·결과·입력 검색", "aria-label": "실행 기록 검색" } }) as HTMLInputElement;
  const list = el("div", { class: "ai-activity-entries" });
  const notice = el("p", { class: "ai-activity-meta", attrs: { role: "status" } });
  const more = el("button", { text: "이전 기록 50건 더 보기", attrs: { type: "button" }, on: { click: () => { shown += 50; render(); } } });
  const exportButton = el("button", { text: "기록 내려받기", attrs: { type: "button" }, on: { click: () => {
    if (!trace) return;
    const exported = actor ? { ...trace, entries: trace.entries.filter(e => e.actor === actor) } : trace;
    const url = URL.createObjectURL(new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" }));
    const anchor = el("a", { attrs: { href: url, download: `${trace.id}.json` } }) as HTMLAnchorElement;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } } });
  const controls = el("div", { class: "ai-activity-filters", children: [search, filter, actorFilter, latest, exportButton] });
  root.append(meta, controls, more, list, notice);
  function render(): void {
    const level = getActivityLevel();
    root.dataset.level = level;
    root.hidden = level === "none" || !trace;
    if (!trace || level === "none") return;
    const current = trace;
    const actors = [...new Set(current.entries.map(e => e.actor))];
    const nextActorSignature = JSON.stringify(actors.map(id => [id, actorLabel(current, id)]));
    if (nextActorSignature !== actorSignature) {
      actorSignature = nextActorSignature;
      actorFilter.replaceChildren(el("option", { attrs: { value: "" }, text: "전체 담당자" }), ...actors.map(id => el("option", { attrs: { value: id }, text: actorLabel(current, id) })));
      if (!actors.includes(selectedActor)) selectedActor = "";
      actorFilter.value = selectedActor;
    }
    actorFilter.hidden = Boolean(actor) || actors.length < 2;
    meta.hidden = level !== "trace"; controls.hidden = level !== "trace";
    meta.textContent = `${current.id} · ${new Date(current.startedAt).toLocaleString()} · ${current.phase}`;
    const candidates = current.entries.filter(e => !actor || e.actor === actor).map(entry => options.historical && entry.status === "running"
      ? { ...entry, status: "info" as const, summary: `${entry.summary} · 종료 응답 미수집` } : entry);
    let rows = level === "trace" ? candidates : candidates.filter(e => ["tool", "agent_spawn", "agent_done", "review", "status", "error"].includes(e.kind));
    if (level === "brief") {
      const latestPhase = rows.filter(e => e.name === "run.phase").at(-1)?.id;
      const latestSave = rows.filter(e => e.name.startsWith("save.")).at(-1)?.id;
      rows = rows.filter(e => (e.name !== "run.phase" || e.id === latestPhase) && (!e.name.startsWith("save.") || e.id === latestSave));
      // Merge adjacent successful repetitions; keep failures and active calls individually visible.
      const grouped: ActivityEntry[] = [];
      const counts = new Map<string, number>();
      for (const entry of rows) {
        const previous = grouped[grouped.length - 1];
        if (previous && entry.kind === "tool" && entry.status === "ok" && previous.status === "ok" && previous.name === entry.name && previous.actor === entry.actor) {
          const count = (counts.get(previous.id) ?? 1) + 1;
          grouped[grouped.length - 1] = { ...entry, summary: `${count}건 확인·처리` }; counts.set(entry.id, count);
        } else grouped.push(entry);
      }
      const active = grouped.filter(e => e.status === "running");
      rows = [...grouped.filter(e => e.status !== "running").slice(-Math.max(1, 4 - active.length)), ...active.slice(-3)];
    } else if (level === "trace") rows = rows.filter(e => (!selectedActor || actor || e.actor === selectedActor) && (severity === "all" || (severity === "tool" ? e.kind === "tool" : e.status === "error")) && (!query || JSON.stringify(e).toLowerCase().includes(query)));
    const total = rows.length;
    if (level !== "brief") rows = rows.slice(-shown);
    more.hidden = level === "brief" || total <= shown;
    const existing = new Map(Array.from(list.children).map(node => [(node as HTMLElement).dataset.entryId, node as HTMLElement]));
    const keep = new Set<HTMLElement>();
    let previousRow: HTMLElement | null = null;
    for (const entry of rows) {
      const signature = `${level}:${entry.status}:${entry.endedAt}:${entry.summary}:${entry.at}`;
      let row = existing.get(entry.id);
      if (!row || row.dataset.signature !== signature) {
        const mark = entry.status === "running" ? "◌" : entry.status === "ok" ? "✓" : entry.status === "error" ? "!" : "·";
        const text = level === "trace" ? `${entry.name} · ${entry.summary}` : `${entry.kind === "agent_done" && level === "brief" ? (entry.status === "error" ? "작업 실패" : "맡은 작업 완료") : activityText(label(entry), level === "brief" ? 140 : 1000)}${entry.kind === "tool" ? ` · ${entry.status === "running" ? "실행 중" : entry.status === "error" ? "실패" : entry.status === "info" ? "종료 응답 없음" : /^\d+건/.test(entry.summary) ? entry.summary : "완료"}` : ""}`;
        const heading = el("div", { class: "ai-activity-entry-title", children: [el("span", { class: "ai-activity-mark", text: mark, attrs: { "aria-hidden": "true" } }), el("span", { text })] });
        const detail = `${actorLabel(current, entry.actor)}${entry.durationMs === undefined ? "" : ` · ${(entry.durationMs / 1000).toFixed(2)}초`}`;
        let next: HTMLElement;
        if (level === "brief") next = el("div", { children: [heading, el("small", { text: detail })] });
        else {
          const summary = el("summary", { children: [heading, el("small", { text: `${clock(entry.at - current.startedAt)} · ${detail}` })] });
          const body = el("div", { class: "ai-activity-payload" });
          const fillPayload = () => {
            if (body.childElementCount) return;
            if (level === "detail") {
              const output = entry.output as { text?: string; task?: string; summary?: string } | undefined;
              body.append(el("p", { text: (output?.text ?? output?.task ?? output?.summary ?? entry.summary) || "결과 설명 없음" }));
            } else {
              for (const [caption, value] of [["입력", entry.input], ["결과 / 상태", entry.output]] as const) if (value !== undefined) body.append(el("strong", { text: caption }), el("pre", { text: JSON.stringify(value, null, 2) }));
              if (!body.childElementCount) body.append(el("p", { text: "추가 데이터 없음" }));
            }
          };
          const details = el("details", { children: [summary, body] }) as HTMLDetailsElement;
          details.open = opened.has(entry.id);
          if (details.open) fillPayload();
          details.addEventListener("toggle", () => { if (!details.isConnected) return; if (details.open) { opened.add(entry.id); fillPayload(); } else opened.delete(entry.id); });
          next = details;
        }
        next.className = `ai-activity-entry is-${entry.status}`;
        next.dataset.entryId = entry.id; next.dataset.signature = signature;
        if (row) row.replaceWith(next);
        row = next;
      }
      keep.add(row);
      // append only new rows; stable DOM preserves selection, focus and scroll during updates.
      const position: ChildNode | null = previousRow ? previousRow.nextSibling : list.firstChild;
      if (row !== position) list.insertBefore(row, position);
      previousRow = row;
    }
    for (const node of Array.from(list.children)) if (!keep.has(node as HTMLElement)) node.remove();
    if (!rows.length) list.replaceChildren(el("p", { class: "ai-activity-meta", text: query || severity !== "all" ? "일치하는 기록이 없어요." : `${current.phase} · 다음 실행 신호를 기다리고 있어요.` }));
    const recent = candidates[candidates.length - 1];
    const warnings = [options.historical ? `이전 실행 기록 · 마지막 기록 상태: ${current.phase}` : "", current.dropped ? `보존 상한으로 이전 ${current.dropped}건이 제외됐어요.` : "", activityArchiveFailed(current.id) ? "기기에 기록을 저장하지 못했어요. 현재 화면에서 내려받을 수 있어요." : ""];
    if (level === "brief" && recent && ["turn", "delta", "heartbeat"].includes(recent.kind) && !["완료", "적용됨", "검토 대기", "실패", "중단", "버림"].includes(current.phase)) warnings.unshift(recent.summary);
    notice.textContent = warnings.filter(Boolean).join(" "); notice.hidden = !notice.textContent;
  }
  search.addEventListener("input", () => { query = search.value.toLowerCase(); render(); });
  actorFilter.addEventListener("change", () => { selectedActor = actorFilter.value; render(); });
  filter.addEventListener("change", () => { severity = filter.value; render(); });
  bindActivityLevel(root, render);
  return { root, update(next, memberActor) {
    if (trace?.id !== next?.id || actor !== memberActor) { shown = 50; opened.clear(); }
    trace = next; actor = memberActor;
    if (trace?.entries.length && options.archive !== false) retainActivityTrace(trace);
    render();
  } };
}

export function createActivityToolbar(getProjectId: () => string): HTMLElement {
  const historyBody = el("div", { class: "ai-activity-history-body" });
  const history = el("details", { class: "ai-activity-history", children: [el("summary", { text: "실행 기록" }), historyBody] }) as HTMLDetailsElement;
  const root = el("div", { class: "ai-activity-toolbar", children: [createActivityLevelControl(), history] });
  let generation = 0;
  root.addEventListener("ai-project-switch", () => { generation++; history.open = false; historyBody.replaceChildren(); });
  history.addEventListener("toggle", () => {
    if (!history.open) { generation++; return; }
    const token = ++generation;
    const projectId = getProjectId();
    historyBody.replaceChildren(el("p", { text: "기록을 불러오는 중…" }));
    void readActivityArchive(projectId).then(traces => {
      if (token !== generation || projectId !== getProjectId()) return;
      const view = createActivityView({ archive: false, historical: true });
      historyBody.replaceChildren(el("p", { class: "ai-activity-meta", text: "이 기기에서 최근 7일 · 최대 20개 실행을 보관해요. 수집 전 기록은 복원하지 않아요." }));
      if (!traces.length) historyBody.append(el("p", { text: "아직 보관된 실행 기록이 없어요." }));
      for (const trace of traces) historyBody.append(el("button", { attrs: { type: "button" }, text: `${new Date(trace.startedAt).toLocaleString()} · ${trace.title.slice(0, 70)} · ${trace.phase}`, on: { click: () => { view.update(trace); } } }));
      historyBody.append(view.root);
    }, () => { if (token === generation) historyBody.replaceChildren(el("p", { text: "이 기기의 실행 기록을 읽을 수 없어요." })); });
  });
  return root;
}
