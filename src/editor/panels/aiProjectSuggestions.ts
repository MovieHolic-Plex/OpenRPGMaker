import { inspectProjectSuggestions, selectProjectSuggestions, type ProjectSuggestion } from "@/ai/projectSuggestions";
import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import { loadAiConfig } from "@/ai/llmClient";
import { modelForRole } from "@/ai/modelRoles";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { deckIcon } from "./aiDeckIcons";

export interface SuggestionSnapshot {
  project: Project; projectId: string; mapId: string; active: boolean;
  /** 프로젝트 내용 버전(store.getVersionToken). 있으면 같은 버전·맵의 로컬 탐지를 다시 하지 않는다. */
  version?: string;
}
export function createProjectSuggestions(options: {
  snapshot: () => SuggestionSnapshot;
  request: (suggestion: ProjectSuggestion) => void;
  locate: (suggestion: ProjectSuggestion) => void;
  analyze?: (snapshot: SuggestionSnapshot, candidates: ProjectSuggestion[], signal: AbortSignal, status: (text: string) => void) => Promise<string>;
  /**
   * 지금 화면에 보이는 카드 수. 오른쪽 아래 느낌표 버튼의 배지가 이 값을 쓴다 —
   * 「살펴볼 것이 있다」를 버튼 하나로 알리려면 카드 수를 아는 곳이 한 군데여야 한다.
   */
  onCountChange?: (count: number) => void;
  intervalMs?: number;
  cooldownMs?: number;
}) {
  const status = el("p", { attrs: { role: "status", "aria-live": "polite" }, text: "현재 맵과 DB를 살펴볼게요." });
  const cards = el("div", { class: "ai-chat-suggestion-list" });
  const pause = el("button", { text: "잠시 멈추기", attrs: { type: "button" } });
  const details = el("details", { children: [el("summary", { text: "살펴본 내용" })] });
  const records = el("p");
  details.append(records);
  const root = el("section", { class: "ai-chat-suggestions", dataset: { testid: "ai-project-suggestions" },
    children: [el("div", { class: "ai-chat-suggestion-heading", children: [deckIcon("spark"), el("strong", { text: "프로젝트 살펴보기" })] }), status, cards, details, pause] });
  let disposed = false, paused = false, key = "", generation = 0, nextRun = 0;
  /**
   * 로컬 탐지 결과를 **마지막으로 그린** 키. key 와 분리하는 이유:
   * key 는 「이 내용은 다 처리했다」(모델 호출까지 끝났거나 권할 것이 없다)이고,
   * renderKey 는 「이 내용은 화면에 깔았다」다. 하나로 합치면 둘 중 하나가 반드시 틀린다 —
   * 합쳐서 쿨다운보다 먼저 찍으면 모델 호출이 영영 안 일어나고(실측: 재시도 계약이
   * analyze 1회로 멈췄다), 합쳐서 나중에 찍으면 매 틱마다 카드를 다시 그린다.
   */
  let renderKey = "";
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
  // 로컬 탐지는 (프로젝트 내용 버전, 맵) 의 순수 함수다 — 버전이 같으면 1.5초 틱마다 모든 맵의 이벤트와
  // DB 를 다시 훑지 않는다(2026-09-26 실측: 유휴 5초에 13ms). 버전이 없는 호출자는 매번 탐지한다.
  let inspected: { project: Project; version: string; mapId: string; result: ProjectSuggestion[] } | null = null;
  const inspect = (snapshot: SuggestionSnapshot): ProjectSuggestion[] => {
    const { project, mapId, version } = snapshot;
    if (version === undefined) return inspectProjectSuggestions(project, mapId);
    if (inspected?.project !== project || inspected.version !== version || inspected.mapId !== mapId) {
      inspected = { project, version, mapId, result: inspectProjectSuggestions(project, mapId) };
    }
    return inspected.result;
  };
  /** 배지에 보이는 카드 수를 알린다 — 「넘기기」로 줄어드는 것도 즉시 반영돼야 한다. */
  const reportCount = (): void => {
    options.onCountChange?.(cards.childElementCount);
  };
  const render = (snapshot: SuggestionSnapshot, items: ProjectSuggestion[]) => {
    cards.replaceChildren(...items.filter(c => dismissed.get(identity(snapshot, c)) !== c.fingerprint).slice(0, 3).map(c => {
      // 카드가 어느 후보인지 DOM 에 남긴다 — 「넘긴 카드는 안 돌아오고 관련 사실이 바뀌면
      // 돌아온다」를 카드 단위로 검증할 수 있는 유일한 창구다(순서·개수로는 못 잡는다).
      const card = el("article", { class: "ai-chat-suggestion-card", dataset: { testid: "ai-project-suggestion", suggestionId: c.id } });
      const button = (label: string, action: () => void) => el("button", { text: label, attrs: { type: "button" }, on: { click: action } });
      const current = () => {
        const now = options.snapshot();
        return now.projectId === snapshot.projectId && now.mapId === c.mapId
          && inspect(now).some(n => n.id === c.id && n.fingerprint === c.fingerprint);
      };
      card.append(el("strong", { text: c.title }), el("p", { text: c.evidence }),
        el("div", { class: "ai-chat-suggestion-actions", children: [
          // 지도 위의 한 점을 가리키는 제안에만 「위치 보기」가 있다. 맵 전체에 대한 제안
          // (나가는 길 없음·DB 미사용 등)에 이 버튼을 달면 (0,0) 으로 카메라를 옮겨
          // 「가리켰다」고 거짓말한다 — 좌표가 없는 제안은 버튼도 없다.
          ...(c.x === undefined || c.y === undefined ? [] : [button("위치 보기", () => { if (current()) options.locate(c); })]),
          button("AI와 이어가기", () => { if (current()) options.request(c); }),
          button("넘기기", () => { dismissed.set(identity(snapshot, c), c.fingerprint); card.remove(); reportCount(); if (!cards.childElementCount) status.textContent = "새로 확인할 내용이 생기면 알려드릴게요."; }),
        ] }));
      return card;
    }));
  };
  const tick = () => {
    if (disposed) return;
    const snapshot = options.snapshot();
    if (paused) { if (pending) { generation++; pending.abort(); pending = null; } key = ""; renderKey = ""; return; }
    const candidates = inspect(snapshot);
    const nextKey = JSON.stringify([snapshot.projectId, snapshot.mapId, candidates.map(c => [c.id, c.fingerprint])]);
    const remaining = candidates.filter(c => dismissed.get(identity(snapshot, c)) !== c.fingerprint);
    // 로컬 탐지·렌더·배지는 팝오버가 **닫혀 있어도** 돈다.
    //
    // 왜 (2026-09-21 실측): 닫힌 동안 탐지를 멈추면 배지가 빈 채로 남는다. 그러면 사용자는
    // 느낌표를 눌러 보기 전까지 「살펴볼 것이 있는지」를 알 수 없고, 그 알림이 이 버튼의
    // 존재 이유다. 비싼 것은 모델 호출 하나뿐이고 로컬 탐지는 실측 16ms(프로젝트 27개 전부)
    // 이므로 1.5초 주기에서 무시할 만하다 — 그래서 **모델만** 열려 있을 때 부른다.
    if (nextKey !== renderKey) {
      renderKey = nextKey;
      records.textContent = `「${snapshot.project.maps[snapshot.mapId]?.name ?? "현재 맵"}」의 이벤트·이동 목적지·적 만나기와 DB의 물건·적 그룹을 확인했어요.`;
      cards.replaceChildren();
      if (remaining.length) render(snapshot, remaining);
      else status.textContent = "지금 확인한 범위에서는 새로 제안할 내용이 없어요.";
      reportCount();
    }
    if (nextKey === key) return;
    // 모델 호출만 팝오버가 열려 있을 때 한다 — 닫힌 표면을 위해 원격 턴을 돌리지 않는다.
    if (!snapshot.active) { if (pending) { generation++; pending.abort(); pending = null; } key = ""; return; }
    if (!remaining.length) { key = nextKey; return; }
    if (pending) { generation++; pending.abort(); pending = null; }
    // 쿨다운은 **모델 호출만** 늦춘다. 로컬 탐지 결과는 즉시 보여준다.
    //
    // 왜 (2026-09-20 실측): 예전에는 쿨다운이 걸리면 카드가 0장인 채로 「바뀐 내용을 잠시 후
    // 다시 살펴볼게요」만 떴다. 탐지기가 후보를 거의 못 내던 시절에는 차이가 없었지만, 규칙이
    // 늘어난 지금은 다르다 — 맵을 옮기거나 문을 고치면 **바로 보여줄 카드가 있는데도** 최대
    // 60초 동안 화면이 비어 「고쳤는데 아무 일도 안 일어난다」로 읽혔다. 모델은 이 카드들을
    // 더 좁혀 줄 뿐이므로, 기다리게 하는 대신 로컬 결과를 먼저 깔고 답이 오면 대체한다.
    //
    // 쿨다운이 풀릴 때까지는 key 를 **찍지 않는다** — 찍으면 다음 틱이 「이미 처리했다」로
    // 넘어가 모델 호출이 영영 일어나지 않는다(실측: 재시도 계약이 analyze 1회로 멈췄다).
    if (Date.now() < nextRun) {
      status.textContent = "살펴보니 이런 작업을 이어갈 수 있어요.";
      return;
    }
    key = nextKey;
    nextRun = Date.now() + (options.cooldownMs ?? 60000);
    status.textContent = "이 맵의 이벤트와 DB를 살펴보고 있어요.";
    const owner = ++generation;
    const controller = new AbortController();
    pending = controller;
    const owns = () => !disposed && owner === generation && !controller.signal.aborted && options.snapshot().active
      && (() => { const now = options.snapshot(); return nextKey === JSON.stringify([now.projectId, now.mapId, inspect(now).map(c => [c.id, c.fingerprint])]); })();
    void analyze(snapshot, remaining, controller.signal, text => { if (owns()) status.textContent = text; })
      .then(answer => {
        if (!owns()) return;
        const selected = selectProjectSuggestions(answer, remaining);
        render(snapshot, selected);
        reportCount();
        status.textContent = selected.length ? "살펴보니 이런 작업을 이어갈 수 있어요." : "지금은 추가로 권할 작업이 없어요.";
      }).catch(() => {
        if (!owns()) return;
        render(snapshot, remaining);
        reportCount();
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
  return { root, refresh: tick, dispose() { disposed = true; generation++; pending?.abort(); clearInterval(timer); cards.replaceChildren(); reportCount(); } };
}
