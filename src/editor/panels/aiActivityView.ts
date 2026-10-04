import { activityEntryIndex, majorActivityKinds as majorKinds } from "./aiActivityIndex";
import { createActivityMedia } from "./aiActivityMedia";
import { el } from "@/util/dom";
import { ACTIVITY_APPLIED_SUMMARY, ACTIVITY_APPLYING_SUMMARY, activityText, type ActivityEntry, type ActivityTrace } from "@/ai/activityTrace";
import { activityArchiveFailed, readActivityArchive, retainActivityTrace } from "@/ai/activityTraceArchive";
import { bindActivityLevel, createActivityLevelControl, getActivityLevel } from "./aiActivityPreference";
import { toolBriefLabel, toolGroup, toolLabel } from "./aiToolLabels";

export interface ActivityView { root: HTMLElement; update(trace: ActivityTrace | undefined, actor?: string): void }
const clock = (ms: number): string => `${Math.floor(Math.max(0, ms) / 60000).toString().padStart(2, "0")}:${Math.floor(Math.max(0, ms) / 1000 % 60).toString().padStart(2, "0")}`;
const label = (entry: ActivityEntry): string => entry.kind === "tool" ? toolLabel(entry.name) : entry.summary;
const actorLabel = (trace: ActivityTrace, actor: string): string => trace.actors[actor] ?? (actor === "system" ? "실행" : actor === "agent" ? "조수" : actor);
/**
 * 「간단히 보기」(기본값)의 한 줄. 자세히·전체 기록은 `label` 을 그대로 쓴다.
 *
 * 2026-09-23 실측(첫 사용자 한 문장 → 16분 실행): 기본 표시에 `Ultrabrain · 계획`·`consult writer · 실행 중`·
 * `시공 · 8.7초`·`모델 응답 대기 · 6번째 단계`·`스위치 번호 바꾸기 · 실패` 가 떴다. 간단히 보기는
 * 무엇을 하고 있는지만 말한다 — 영문 이름·단계 번호·소요 시간은 자세히 보기로 넘긴다.
 * 도구 실패는 조수가 이어서 다른 방법을 찾는 게 보통이라 여기서는 「실패」 로 적지 않는다(아래 필터 참고).
 */
function briefEntryText(entry: ActivityEntry): string {
  const role = (entry.output as { role?: string } | undefined)?.role;
  const planner = entry.actor.startsWith("ultrabrain-plan");
  switch (entry.kind) {
    case "tool":
      if (entry.status === "error") return "다른 방법을 찾는 중";
      if (entry.status === "running" && entry.summary === ACTIVITY_APPLYING_SUMMARY) return `${toolBriefLabel(entry.name, false)} · 맵에 반영 중`;
      if (entry.summary === ACTIVITY_APPLIED_SUMMARY) return `${toolBriefLabel(entry.name, false)} · 맵에 반영됨`;
      return toolBriefLabel(entry.name, entry.status === "running");
    case "assistant": {
      // 조수가 작업 사이에 한 말(「강과 다리가 있는 마을을 만들겠습니다」). 예전 간단히 보기는 이 말을 숨겨
      // 사용자에게 「생각하는 중…」만 보였다. 생각(추론) 내용이 아니라 모델이 사용자에게 한 말이다.
      const text = (entry.output as { text?: string } | undefined)?.text?.replace(/\s+/gu, " ").trim() ?? "";
      return text ? `“${activityText(text, 160)}”` : activityText(entry.summary, 140);
    }
    case "agent_spawn":
      return planner || role === "orchestrator" ? "계획 세우는 중" : role === "reviewer" ? "잘 어울리는지 확인하는 중" : "작업 시작";
    case "agent_done":
      return entry.status === "error" ? "작업 실패" : planner ? "계획 완료" : "맡은 작업 완료";
    case "review":
      return entry.status === "ok" ? "확인 완료" : "더 다듬을 곳 발견";
    default:
      return activityText(entry.summary, 140);
  }
}
/** 간단히 보기에서 담당 이름 — 기본 담당(계획 모델·시공)은 개발 용어라 적지 않는다. 팀원 이름만 남긴다. */
const briefActorLabel = (trace: ActivityTrace, actor: string): string => {
  const name = actorLabel(trace, actor);
  return /ultrabrain|^(?:시공|조수|실행)$/iu.test(name) ? "" : name;
};
/** 그림 설명에 도구 결과 원문(`items 1건 / 1건`)이 섞이면 간단히 보기에서는 뺀다. */
const briefCaption = (summary: string): string => (/[A-Za-z_]{3,}/u.test(summary.replace(/\(map_[\w-]+\)/gu, "")) ? "" : summary);
/**
 * 간단히 보기에서 행에 붙이는 그림 — 바꾼 모습(변경 전·초안·실패 시점)만, 마지막 한 쌍까지.
 *
 * 2026-09-23 도그푸딩: 생성 첫머리 「프로젝트 살펴보기」가 조회로 읽은 캐릭터 얼굴 6장을 큰 카드로
 * 대화에 쌓아, 조수 창이 초상화 앨범이 됐다. 조회(「확인한 모습」)는 바뀐 것이 아니므로 간단히
 * 보기에서 그리지 않는다. 자세히·전체 기록은 그대로 전부 보여 준다.
 */
export function briefActivityVisuals(visuals: ActivityEntry["visuals"]): NonNullable<ActivityEntry["visuals"]> {
  return (visuals ?? []).filter(visual => visual.phase !== "read").slice(-2);
}
const searchText = new WeakMap<ActivityEntry, string>();
function boundedSearchText(value: unknown, depth = 0): string {
  if (value == null || typeof value === "number" || typeof value === "boolean") return String(value ?? "");
  if (typeof value === "string") return value.length > 180 ? value.slice(0, 180) : value;
  if (depth >= 2) return "";
  if (Array.isArray(value)) {
    if (value.length > 24) return `[${value.length}]`;
    return value.map((item) => boundedSearchText(item, depth + 1)).join(" ");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > 24) return `{${entries.length}}`;
    return entries.map(([key, item]) => `${key} ${boundedSearchText(item, depth + 1)}`).join(" ");
  }
  return "";
}
function entrySearchText(entry: ActivityEntry): string {
  const cached = searchText.get(entry);
  if (cached !== undefined) return cached;
  const text = `${entry.name}\n${entry.summary}\n${boundedSearchText(entry.input)}\n${boundedSearchText(entry.output)}`.toLowerCase();
  searchText.set(entry, text);
  return text;
}

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
  const columns = el("div", { class: "ai-activity-log-columns", attrs: { "aria-hidden": "true" }, children: ["시간", "담당", "작업", "상태", "소요"].map(text => el("span", { text })) });
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
  root.append(meta, controls, more, columns, list, notice);
  let lastRowsSignature = "";
  let lastRender: { trace: ActivityTrace; actor?: string; level: string; shown: number; severity: string; selectedActor: string; query: string; failed: boolean; length: number } | undefined;
  function render(): void {
    const level = getActivityLevel();
    root.dataset.level = level;
    root.hidden = level === "none" || !trace;
    if (!trace || level === "none") return;
    const current = trace;
    const failed = activityArchiveFailed(current.id);
    if (lastRender && lastRender.trace === current && lastRender.length === current.entries.length
      && lastRender.actor === actor && lastRender.level === level && lastRender.shown === shown
      && lastRender.severity === severity && lastRender.selectedActor === selectedActor
      && lastRender.query === query && lastRender.failed === failed) return;
    lastRender = { trace: current, actor, level, shown, severity, selectedActor, query, failed, length: current.entries.length };
    const index = activityEntryIndex(current);
    const actors = [...index.byActor.keys()];
    const nextActorSignature = JSON.stringify(actors.map(id => [id, actorLabel(current, id)]));
    if (nextActorSignature !== actorSignature) {
      actorSignature = nextActorSignature;
      actorFilter.replaceChildren(el("option", { attrs: { value: "" }, text: "전체 담당자" }), ...actors.map(id => el("option", { attrs: { value: id }, text: actorLabel(current, id) })));
      if (!actors.includes(selectedActor)) selectedActor = "";
      actorFilter.value = selectedActor;
    }
    actorFilter.hidden = Boolean(actor) || actors.length < 2;
    meta.hidden = level !== "trace"; controls.hidden = level !== "trace"; columns.hidden = level !== "trace";
    root.dataset.member = String(Boolean(actor));
    const metaText = `실행 기록 · ${current.entries.length}건 · ${current.phase}`;
    if (meta.textContent !== metaText) meta.textContent = metaText;
    const source = actor ? index.byActor.get(actor) ?? [] : current.entries;
    const candidates = options.historical ? source.map(entry => entry.status === "running"
      ? { ...entry, status: "info" as const, summary: `${entry.summary} · 종료 응답 미수집` } : entry) : source;
    let rows: readonly ActivityEntry[] = candidates;
    if (level === "brief") {
      const latestPhase = index.phases.get(actor);
      const latestSave = index.saves.get(actor);
      // 체크포인트 반영 성공은 쓰기마다 한 줄씩 쌓이는 배관 소식이다 — 실패만 남긴다.
      // 도구 실패 뒤에 기록이 더 이어졌으면 조수가 회복한 것이다 — 간단히 보기에서는 지운다.
      // 실행 자체가 실패로 끝나면 마지막 run.phase 「실패」 줄이 그 사실을 말한다. 자세히 보기는 그대로 둔다.
      const latestEntry = candidates.at(-1)?.id;
      // Fold adjacent successes once; retain only the brief display window.
      const active: ActivityEntry[] = [];
      const completed: ActivityEntry[] = [];
      let activeCount = 0;
      let illustrated: ActivityEntry | undefined;
      let plain: ActivityEntry | undefined;
      const collect = (entry: ActivityEntry): void => {
        if (entry.status === "running") {
          activeCount++;
          active.push(entry);
          if (active.length > 3) active.shift();
        } else {
          completed.push(entry);
          if (completed.length > 4) completed.shift();
          if (!entry.visuals?.length) plain = entry;
          if (entry.visuals?.some(v => v.phase !== "read") && (entry.kind !== "tool" || toolGroup(entry.name) !== "inspect")) illustrated = entry;
        }
      };
      let previous: ActivityEntry | undefined;
      let count = 1;
      const flush = (): void => {
        if (previous) collect(count > 1 ? { ...previous, summary: `${count}건 확인·처리` } : previous);
      };
      // 조수가 한 말은 마지막 한 마디만 남긴다 — 말이 쌓이면 작업 줄이 밀려난다.
      let latestSay: string | undefined;
      let sayEntry: ActivityEntry | undefined;
      for (let i = candidates.length - 1; i >= 0; i--) {
        const entry = candidates[i]!;
        if (entry.kind === "assistant" && (entry.output as { text?: string } | undefined)?.text?.trim()) { latestSay = entry.id; break; }
      }
      for (const entry of candidates) {
        if (entry.kind === "assistant" && entry.id === latestSay) { flush(); previous = undefined; count = 1; sayEntry = entry; continue; }
        if (!majorKinds.has(entry.kind) || (entry.name === "run.phase" && entry.id !== latestPhase)
          || (entry.name.startsWith("save.") && entry.id !== latestSave)
          || (entry.name === "checkpoint.apply" && entry.status !== "error")
          || (entry.kind === "tool" && entry.status === "error" && entry.id !== latestEntry)) continue;
        if (previous && entry.kind === "tool" && entry.status === "ok" && previous.status === "ok"
          && previous.name === entry.name && previous.actor === entry.actor && previous.visuals?.at(-1)?.target === entry.visuals?.at(-1)?.target) count++;
        else { flush(); count = 1; }
        previous = entry;
      }
      flush();
      rows = illustrated ? [illustrated, ...(plain ? [plain] : []), ...active].sort((a, b) => a.at - b.at)
        : [...completed.slice(-Math.max(1, 4 - activeCount)), ...active];
      if (sayEntry) rows = [...rows, sayEntry].sort((a, b) => a.at - b.at);
    } else {
      // Collect the visible window plus one row for the "more" button.
      const recent: ActivityEntry[] = [];
      for (let i = candidates.length - 1; i >= 0 && recent.length <= shown; i--) {
        const entry = candidates[i]!;
        if (level === "detail" ? !majorKinds.has(entry.kind)
          : ((!actor && selectedActor && entry.actor !== selectedActor)
            || (severity !== "all" && (severity === "tool" ? entry.kind !== "tool" : entry.status !== "error"))
            || (query && !entrySearchText(entry).includes(query)))) continue;
        recent.push(entry);
      }
      rows = recent.reverse();
    }
    const soloActor = actor ? true : actors.filter(id => id !== "system").length <= 1;
    const total = rows.length;
    if (level !== "brief") rows = rows.slice(-shown);
    more.hidden = level === "brief" || total <= shown;
    const rowSignature = (entry: ActivityEntry): string => JSON.stringify([level, soloActor, entry.status, entry.endedAt, entry.summary, entry.at, entry.durationMs, entry.name, actorLabel(current, entry.actor), entry.visuals?.map(v => v.id)]);
    const rowsSignature = JSON.stringify([current.id, current.startedAt, rows.length ? rows.map(entry => [entry.id, rowSignature(entry)]) : [current.phase, query, severity]]);
    if (rowsSignature !== lastRowsSignature) {
      lastRowsSignature = rowsSignature;
      const existing = new Map(Array.from(list.children).map(node => [(node as HTMLElement).dataset.entryId, node as HTMLElement]));
      const keep = new Set<HTMLElement>();
      let previousRow: HTMLElement | null = null;
      for (const entry of rows) {
        const signature = rowSignature(entry);
        let row = existing.get(entry.id);
        if (!row || row.dataset.signature !== signature) {
          // 간단히 보기의 도구 실패는 「다른 방법을 찾는 중」 으로 적는다 — 빨간 느낌표를 달지 않는다.
          const shownStatus = level === "brief" && entry.kind === "tool" && entry.status === "error" ? "info" : entry.status;
          const mark = shownStatus === "running" ? "◌" : shownStatus === "ok" ? "✓" : shownStatus === "error" ? "!" : "·";
          const text = level === "trace" ? `${entry.name} · ${entry.summary}` : level === "brief" ? briefEntryText(entry) : `${activityText(label(entry), 1000)}${entry.kind === "tool" ? ` · ${entry.status === "running" ? "실행 중" : entry.status === "error" ? "실패" : entry.status === "info" ? "종료 응답 없음" : /^\d+건/.test(entry.summary) ? entry.summary : "완료"}` : ""}`;
          const heading = el("div", { class: "ai-activity-entry-title", children: [el("span", { class: "ai-activity-mark", text: mark, attrs: { "aria-hidden": "true" } }), el("span", { text })] });
          // 담당이 하나뿐이면 행마다 같은 이름(「시공」)을 되풀이하지 않는다. 0.1초 미만은 시간을 적지 않는다(「0.00초」).
          // 간단히 보기는 소요 시간(「시공 · 8.7초」)을 적지 않는다 — 머리 줄의 시계가 이미 간다.
          const who = level === "brief" ? (soloActor ? "" : briefActorLabel(current, entry.actor)) : actorLabel(current, entry.actor);
          const took = entry.durationMs === undefined || level === "brief" ? "" : `${(entry.durationMs / 1000).toFixed(2)}초`;
          const detail = [who, took].filter(Boolean).join(" · ");
          let next: HTMLElement;
          if (level === "brief") next = el("div", { children: detail ? [heading, el("small", { text: detail })] : [heading] });
          else {
            const summary = el("summary", { children: [heading, el("small", { text: `${clock(entry.at - current.startedAt)} · ${detail}` })] });
            if (level === "trace") {
              summary.classList.add("ai-activity-log-row");
              const status = { running: "진행 중", ok: "완료", error: "실패", info: "기록" }[entry.status];
              summary.replaceChildren(
                el("time", { class: "ai-activity-log-time", text: clock(entry.at - current.startedAt) }),
                el("span", { class: "ai-activity-log-actor", text: actorLabel(current, entry.actor) }),
                el("span", { class: "ai-activity-log-task", children: [el("strong", { text: label(entry) }), el("small", { text: entry.kind === "tool" ? `${entry.name} · ${entry.summary}` : entry.name })] }),
                el("span", { class: "ai-activity-log-status", text: status }),
                el("span", { class: "ai-activity-log-duration", text: entry.durationMs === undefined ? "—" : `${(entry.durationMs / 1000).toFixed(2)}초` }),
              );
            }
            const body = el("div", { class: "ai-activity-payload" });
            let filled = false;
            const fillPayload = () => {
              if (filled) return;
              filled = true;
              if (level === "detail") {
                const output = entry.output as { text?: string; task?: string; summary?: string } | undefined;
                body.append(el("p", { text: (output?.text ?? output?.task ?? output?.summary ?? entry.summary) || "결과 설명 없음" }));
              } else {
                for (const [caption, value] of [["입력", entry.input], ["결과 / 상태", entry.output]] as const) if (value !== undefined) body.append(el("strong", { text: caption }), el("pre", { text: JSON.stringify(value, null, 2) }));
                if (!body.childElementCount) body.append(el("p", { text: "추가 데이터 없음" }));
                body.append(el("p", { class: "ai-activity-receipt-meta", text: `${detail} · ${new Date(entry.at).toLocaleString()} · ${entry.name}\n실행 ID ${current.id}` }));
              }
            };
            const details = el("details", { children: [summary, body] }) as HTMLDetailsElement;
            details.open = opened.has(entry.id);
            if (details.open) fillPayload();
            details.addEventListener("toggle", () => { if (!details.isConnected) return; if (details.open) { opened.add(entry.id); fillPayload(); } else opened.delete(entry.id); });
            next = details;
          }
          const shownVisuals = level === "brief" ? briefActivityVisuals(entry.visuals) : entry.visuals ?? [];
          if (shownVisuals.length) {
            const media = createActivityMedia(shownVisuals, level === "brief" ? briefCaption(entry.summary) : entry.summary);
            // Visuals stay visible in detail/trace; raw receipts remain separately expandable.
            if (next instanceof HTMLDetailsElement) {
              const wrapper = el("div", { children: [next, media] });
              next = wrapper;
            } else next.append(media);
          }
          next.className = `ai-activity-entry is-${shownStatus}`;
          next.dataset.entryId = entry.id; next.dataset.signature = signature;
          if (row) row.replaceWith(next);
          row = next;
        }
        keep.add(row);
        // append only new rows; stable DOM preserves selection, focus and scroll during updates.
        const position: ChildNode | null = previousRow ? previousRow.nextSibling ?? null : list.firstChild;
        if (row !== position) list.insertBefore(row, position);
        previousRow = row;
      }
      for (const node of Array.from(list.children)) if (!keep.has(node as HTMLElement)) node.remove();
      if (!rows.length) list.replaceChildren(el("p", { class: "ai-activity-meta", text: query || severity !== "all" ? "일치하는 기록이 없어요." : `${current.phase} · 다음 실행 신호를 기다리고 있어요.` }));
    }
    const recent = candidates[candidates.length - 1];
    const warnings = [options.historical ? `이전 실행 기록 · 마지막 기록 상태: ${current.phase}` : "", current.dropped ? `보존 상한으로 이전 ${current.dropped}건이 제외됐어요.` : "", activityArchiveFailed(current.id) ? "기기에 기록을 저장하지 못했어요. 현재 화면에서 내려받을 수 있어요." : ""];
    if (level === "brief" && recent && ["turn", "delta", "heartbeat"].includes(recent.kind) && !["완료", "적용됨", "검토 대기", "실패", "중단", "버림"].includes(current.phase)) warnings.unshift("생각하는 중…");
    const warningText = warnings.filter(Boolean).join(" ");
    if (notice.textContent !== warningText) notice.textContent = warningText;
    notice.hidden = !warningText;
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
