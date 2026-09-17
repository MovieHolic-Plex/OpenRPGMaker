import { inspectProjectSuggestions, selectProjectSuggestions, type ProjectSuggestion } from "@/ai/projectSuggestions";
import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import { loadAiConfig } from "@/ai/llmClient";
import { modelForRole } from "@/ai/modelRoles";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { deckIcon } from "./aiDeckIcons";

export interface SuggestionSnapshot { project: Project; projectId: string; mapId: string; active: boolean }
export function createProjectSuggestions(options: {
  snapshot: () => SuggestionSnapshot;
  request: (suggestion: ProjectSuggestion) => void;
  locate: (suggestion: ProjectSuggestion) => void;
  analyze?: (snapshot: SuggestionSnapshot, candidates: ProjectSuggestion[], signal: AbortSignal, status: (text: string) => void) => Promise<string>;
  intervalMs?: number;
  cooldownMs?: number;
}) {
  const status = el("p", { attrs: { role: "status", "aria-live": "polite" }, text: "현재 맵과 DB를 살펴볼게요." });
  const cards = el("div", { class: "ai-chat-suggestion-list" });
  const pause = el("button", { text: "잠시 멈추기", attrs: { type: "button" } });
  const details = el("details", { children: [el("summary", { text: "살펴본 내용" })] });
  const records = el("p");
  details.append(records);
  const root = el("section", { class: "ai-chat-sidebar-welcome ai-chat-suggestions", dataset: { testid: "ai-project-suggestions" },
    children: [el("div", { class: "ai-chat-suggestion-heading", children: [deckIcon("spark"), el("strong", { text: "프로젝트 살펴보기" })] }), status, cards, details, pause] });
  let disposed = false, paused = false, key = "", generation = 0, nextRun = 0;
  let pending: AbortController | null = null;
  const dismissed = new Map<string, string>();
  const analyze = options.analyze ?? (async (snapshot, candidates, signal, progress) => {
    const model = modelForRole(loadAiConfig(), "deep");
    let answer = "";
    await runPiAgentViaCompanion({
      mode: "single", provider: model.provider, model: model.model, project: snapshot.project,
      currentMapId: snapshot.mapId, mapIds: [snapshot.mapId], readOnly: true, toolDomains: ["core", "map", "event", "database"],
      maxTurns: 4, timeoutMs: 45000, thinkingLevel: "low",
      task: `프로젝트를 읽기 전용으로 살펴보고 지금 맵에 도움이 되는 제안 후보를 최대 3개 골라라.
조회 도구로 맵·이벤트·DB 근거와 의도를 확인하라. 비어 있는 값이 의도적일 수 있으므로 수정이 필수라고 단정하지 마라.
후보에 없는 제안은 만들지 말고, 적절하지 않으면 빈 배열을 반환하라.
최종 답변은 선택한 후보 id의 JSON 배열만 출력하라.
후보: ${JSON.stringify(candidates.map(({ id, title, evidence }) => ({ id, title, evidence })))}`,
    }, { signal, onEvent: event => {
      if (event.type === "assistant") answer = event.text;
      if (event.type === "tool_start") progress("맵과 DB의 연결을 확인하고 있어요.");
      if (event.type === "error") throw new Error(event.message);
    } });
    return answer;
  });
  const identity = (s: SuggestionSnapshot, c: ProjectSuggestion) => s.projectId + ":" + s.mapId + ":" + c.id;
  const render = (snapshot: SuggestionSnapshot, items: ProjectSuggestion[]) => {
    cards.replaceChildren(...items.filter(c => dismissed.get(identity(snapshot, c)) !== c.fingerprint).slice(0, 3).map(c => {
      const card = el("article", { class: "ai-chat-suggestion-card", dataset: { testid: "ai-project-suggestion" } });
      const button = (label: string, action: () => void) => el("button", { text: label, attrs: { type: "button" }, on: { click: action } });
      const current = () => {
        const now = options.snapshot();
        return now.projectId === snapshot.projectId && now.mapId === c.mapId
          && inspectProjectSuggestions(now.project, now.mapId).some(n => n.id === c.id && n.fingerprint === c.fingerprint);
      };
      card.append(el("strong", { text: c.title }), el("p", { text: c.evidence }),
        el("div", { class: "ai-chat-suggestion-actions", children: [
          button("위치 보기", () => { if (current()) options.locate(c); }),
          button("AI와 이어가기", () => { if (current()) options.request(c); }),
          button("넘기기", () => { dismissed.set(identity(snapshot, c), c.fingerprint); card.remove(); if (!cards.childElementCount) status.textContent = "새로 확인할 내용이 생기면 알려드릴게요."; }),
        ] }));
      return card;
    }));
  };
  const tick = () => {
    if (disposed) return;
    const snapshot = options.snapshot();
    if (!snapshot.active || paused) { if (pending) { generation++; pending.abort(); pending = null; key = ""; } return; }
    const candidates = inspectProjectSuggestions(snapshot.project, snapshot.mapId);
    const nextKey = JSON.stringify([snapshot.projectId, snapshot.mapId, candidates.map(c => [c.id, c.fingerprint])]);
    if (nextKey === key) return;
    if (pending) { generation++; pending.abort(); pending = null; }
    cards.replaceChildren();
    records.textContent = `「${snapshot.project.maps[snapshot.mapId]?.name ?? "현재 맵"}」의 이벤트·이동 목적지·적 만나기와 DB의 물건·적 그룹을 확인했어요.`;
    const remaining = candidates.filter(c => dismissed.get(identity(snapshot, c)) !== c.fingerprint);
    if (!remaining.length) { key = nextKey; status.textContent = "지금 확인한 범위에서는 새로 제안할 내용이 없어요."; return; }
    if (Date.now() < nextRun) { status.textContent = "바뀐 내용을 잠시 후 다시 살펴볼게요."; return; }
    key = nextKey;
    nextRun = Date.now() + (options.cooldownMs ?? 60000);
    status.textContent = "이 맵의 이벤트와 DB를 살펴보고 있어요.";
    const owner = ++generation;
    const controller = new AbortController();
    pending = controller;
    const owns = () => !disposed && owner === generation && !controller.signal.aborted && options.snapshot().active
      && (() => { const now = options.snapshot(); return nextKey === JSON.stringify([now.projectId, now.mapId, inspectProjectSuggestions(now.project, now.mapId).map(c => [c.id, c.fingerprint])]); })();
    void analyze(snapshot, remaining, controller.signal, text => { if (owns()) status.textContent = text; })
      .then(answer => {
        if (!owns()) return;
        const selected = selectProjectSuggestions(answer, remaining);
        render(snapshot, selected);
        status.textContent = selected.length ? "살펴보니 이런 작업을 이어갈 수 있어요." : "지금은 추가로 권할 작업이 없어요.";
      }).catch(() => {
        if (!owns()) return;
        render(snapshot, remaining);
        status.textContent = "AI 연결을 확인하지 못했어요. 기본 확인 결과만 보여드릴게요.";
      }).finally(() => { if (pending === controller) { if (!owns()) key = ""; pending = null; } });
  };
  pause.addEventListener("click", () => {
    paused = !paused;
    if (paused) { generation++; pending?.abort(); pending = null; key = ""; status.textContent = "자동 탐색을 잠시 멈췄어요."; }
    pause.textContent = paused ? "다시 살펴보기" : "잠시 멈추기";
    if (!paused) tick();
  });
  const timer = setInterval(tick, options.intervalMs ?? 1500);
  return { root, refresh: tick, dispose() { disposed = true; generation++; pending?.abort(); clearInterval(timer); } };
}
