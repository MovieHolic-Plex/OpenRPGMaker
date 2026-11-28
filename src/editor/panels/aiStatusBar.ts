// editor/panels/aiStatusBar.ts
// 지도 아래 상태 줄 — 「지금 AI 가 뭘 하고 있나」의 유일한 정답.
//
// 누가·무엇을·몇 단계째인지만 한 줄. 칩을 누르면 지도 위에서 바로 팝오버가 열린다(패널로 시선이 옮겨 가지 않는다).
// 사람이 움직여야 하는 상태(내 차례·실패)가 되면 줄 전체가 앰버/빨강으로 바뀐다.
// 원천은 aiPresence 하나뿐이다 — 이 파일은 관측을 새로 만들지 않는다.
//
// DOM 계약: `ai-status-bar`(루트, data-attention=review|failed|none) · `ai-status-chip`(data-state, data-tone) ·
// `ai-status-pop` · `ai-status-log` · `ai-status-stop` · `ai-status-summary`(작업 목록 입구).
//
// 「작업 목록」(2026-10-16): 맵별 전체 보기(renderAll)는 작업 목록(aiJobListView)으로 옮겼다 — 요약 버튼과 「+N」 칩이 같은 목록을 연다.
// 렉 방지: 조수 이벤트마다(초당 수십 번) DOM 을 고치지 않는다. 구독자는 「바뀌었다」만 표시하고 그리기는 프레임당 한 번(createFrameBatch)이며,
// 레이아웃 읽기(칩 폭 예산·앉히기)는 그 프레임의 쓰기보다 먼저 한다 — 이벤트 처리 중 동기 읽기는 없다.

import { el } from "@/util/dom";
import { createFrameBatch } from "@/util/frameBatch";
import { editorState } from "@/editor/editorState";
import { peekStampOrderQueue, subscribeStampOrders } from "@/editor/stampOrderQueue";
import { AI_STUDIO_CHANGE_EVENT } from "@/editor/aiStudioMode";
import { currentJobSummary, subscribeJobSummary } from "./aiJobList";
import { markJobListEntry, syncJobListEntry, toggleAiJobList } from "./aiJobListView";
import { conversationCardCovers, isActive, needsUser, PRESENCE_LABEL, stopAllPresences, subscribeAiPresence, summarizeJobs, urgencyRank, type JobSummary, type Presence } from "./aiPresence";
import { closePresencePopoverBySource, openPresencePopoverId, repositionPresencePopover, subscribePresencePopover, togglePresencePopover } from "./aiPresencePopover";
import { formatElapsed } from "./aiStatusMemberCard";

/** 끝난 일(적용됨)은 이 시간 뒤에 줄에서 물러난다. 실패·검토 대기는 사람이 처리할 때까지 남는다. */
const SETTLED_HIDE_MS = 6000;
/** 줄에 직접 놓는 칩 수. 넘치면 「+N」 로 접고 눌러서 맵별 목록으로 본다. */
const MAX_CHIPS = 4;

export function mountAiStatusBar(): () => void {
  let presences: readonly Presence[] = [];
  let jobs: JobSummary = currentJobSummary();
  let openBarId: string | null = null;
  let settledSince: number | null = null;
  let hiddenBySettle = false;
  let lastChipSignature = "";
  let lastSummarySig = "";
  let lastStampSig = "";
  /** 줄 폭에서 나온 칩 수 상한. 폭은 앉히기(프레임 시작)에서만 읽고 여기 캐시한다 — 이벤트 처리 중 레이아웃을 읽지 않는다. */
  let budgetCache = MAX_CHIPS;

  // 「작업 N개 · 확인 K · 실패 F」 — 일이 둘 이상이면 줄 맨 앞에서 개수와 가장 급한 상태를 말한다(칩이 +N 으로 접혀도 총수가 보인다). 누르면 작업 목록이 열린다.
  const summary = el("button", {
    class: "ai-status-summary", attrs: { type: "button", hidden: "", title: "모든 AI 작업을 한 목록으로 봅니다" },
    dataset: { testid: "ai-status-summary" }, on: { click: () => toggleAiJobList(summary) },
  });
  markJobListEntry(summary);
  const offSummaryEntry = syncJobListEntry(summary);
  const chips = el("div", { class: "ai-status-chips", dataset: { testid: "ai-status-chips" } });
  // 바로 깔기 주문(드래그 → Enter)은 aiPresence 와 별개 파이프라인(stampOrderQueue)이다 — 개수만 여기서 함께 말한다.
  const stampChip = el("span", { class: "ai-status-stamp", dataset: { testid: "ai-status-stamp" }, attrs: { hidden: "", title: "바로 깔기 주문 — 지도 위 번호 상자에서 위치를 볼 수 있어요" } });
  const elapsed = el("span", { class: "ai-status-elapsed", dataset: { testid: "ai-status-elapsed" } });
  const log = el("button", {
    class: "ai-status-btn", text: "작업 기록", attrs: { type: "button", title: "실행 기록·로그 내려받기를 엽니다" },
    dataset: { testid: "ai-status-log" },
    on: { click: () => openLogs() },
  });
  const stop = el("button", {
    class: "ai-status-btn is-stop", text: "■ 멈춤", attrs: { type: "button", title: "지금 도는 AI 작업을 모두 멈춥니다" },
    dataset: { testid: "ai-status-stop" },
    on: { click: () => { stopAllPresences(); peekStampOrderQueue()?.cancelAll(); } },
  });
  const root = el("aside", {
    class: "ai-status-bar", attrs: { role: "status", "aria-live": "polite", "aria-label": "AI 작업 상태", hidden: "" },
    dataset: { testid: "ai-status-bar", attention: "none" },
    children: [summary, chips, stampChip, el("span", { class: "ai-status-spacer" }), elapsed, log, stop],
  });
  document.body.append(root);

  /** 칩 한 개 약 150px, 요약·시간·「작업 기록」·「멈춤」 약 300px. 폭이 좁으면 +N 으로 접는다(칩이 잘려 읽히지 않는 것보다 낫다). */
  const budgetFor = (width: number): number => Math.max(1, Math.min(MAX_CHIPS, Math.floor((width - 300) / 150)));

  /**
   * 앉히기·폭 읽기는 프레임 시작에 한 번으로 모은다(render 도 같은 묶음).
   *
   * 왜(2026-10-15 실측, 조수 스트림 24초): 조수 이벤트마다(83번) render() 직후 동기로 캔버스·도크 `getBoundingClientRect` 를 읽었다.
   * 방금 바꾼 DOM 위의 읽기라 매번 강제 레이아웃(평균 11ms, 합 0.96s). 2026-10-16 의 칩 폭 예산(chipBudget)이 같은 읽기를 render 안에 다시 넣었다
   * (합성 스트림 N=10 · 이벤트 150건에서 이벤트당 약 60ms) — 지금은 읽기가 이 프레임 묶음 한 곳뿐이다.
   */
  const frame = createFrameBatch(() => {
    const box = barBox();
    // 읽기를 먼저 끝낸 뒤에 쓴다.
    if (box) {
      const nextBudget = budgetFor(box.width);
      if (nextBudget !== budgetCache) budgetCache = nextBudget;
    }
    renderNow(box);
  });
  const render = (): void => frame.schedule();
  /** 줄이 쓸 수 있는 폭 — 캔버스 아래쪽 가운데, 지도 위로 펼쳐진 AI 창은 피한다. 칩 개수도 이 폭으로 정한다. */
  const barBox = (): { left: number; width: number; rect: DOMRect } | null => {
    const canvas = document.querySelector<HTMLElement>('[data-testid="edit-canvas"]');
    const rect = canvas?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const dock = document.querySelector<HTMLElement>(".ai-right-dock .ai-chat-panel:not(.is-collapsed)");
    const dockLeft = dock ? dock.getBoundingClientRect().left : Infinity;
    const right = Math.min(rect.right, dockLeft);
    const left = rect.left + 16;
    return { left, width: Math.max(280, Math.round(right - left - 16)), rect };
  };
  const placeNow = (box: { left: number; width: number; rect: DOMRect } | null): void => {
    if (!box) return;
    const { rect } = box;
    root.style.left = `${Math.round(box.left)}px`;
    root.style.width = `${box.width}px`;
    root.style.bottom = `${Math.max(8, Math.round(window.innerHeight - rect.bottom + 16))}px`;
    if (openBarId) repositionPresencePopover();
  };

  function openLogs(): void {
    // 로그·내려받기는 오른쪽 AI 창이 이미 갖고 있다 — 입구만 여기로 모은다.
    document.querySelector<HTMLElement>(".ai-collapsed-restore")?.click();
    document.querySelector<HTMLElement>(".ai-workspace-log-trigger")?.click();
  }

  function openFor(id: string, chip: HTMLElement): void {
    togglePresencePopover(id, chip, { source: "bar", placement: "above", barEl: root });
  }

  const stepText = (presence: Presence): string => presence.steps > 0 && presence.state === "working" ? ` · ${presence.steps}단계` : "";

  const teamWingCovers = (): boolean => {
    const wing = document.querySelector<HTMLElement>('[data-testid="ai-team-wing"][data-active="true"]');
    if (!wing) return false;
    return presences.length > 0 && presences.every((p) => p.source === "chat");
  };

  /** 하단 상태 줄 표시 스위치 — #5328(우측 팀 날개) + 2026-11-28(지도 위 시공 배지 팝오버)로 비활성화. */
  const bottomBarEnabled = false;

  function renderNow(box: { left: number; width: number; rect: DOMRect } | null): void {
    const stamp = peekStampOrderQueue()?.summary() ?? { waiting: 0, running: 0, total: 0 };
    const live = summarizeJobs(presences);
    // 바로 깔기 주문·이벤트 AI 작업은 aiPresence 밖의 줄기다 — 작업 목록이 함께 센다(jobs.total).
    const others = Math.max(0, jobs.total - live.total);
    const coveredByRightDock = (conversationCardCovers(presences) || teamWingCovers()) && others === 0;
    const visible = bottomBarEnabled && ((presences.length > 0 && !hiddenBySettle) || others > 0) && !coveredByRightDock;
    if (root.hidden === visible) root.hidden = !visible;
    if (!visible) { closePresencePopoverBySource("bar"); return; }
    // 급한 순: 내 확인 필요(앰버) > 실패(빨강). 둘 다 있으면 앰버 — 사람이 먼저 눌러야 일이 이어지는 쪽이다.
    const attention = jobs.review > 0 ? "review" : jobs.failed > 0 ? "failed" : "none";
    if (root.dataset.attention !== attention) root.dataset.attention = attention;
    // 급한 순: 내 확인 > 실패 > 진행. 칩이 넘쳐 「+N」 로 접혀도 가장 급한 것은 앞 칸에 남는다.
    const ordered = [...presences].sort((a, b) => urgencyRank(a) - urgencyRank(b));
    // 조각마다 따로 쓴다 — 화면 번역이 「작업 {0}개」·「확인 필요 {0}」·「실패 {0}」 낱개 항목으로 맞춘다.
    const showSummary = jobs.total >= 2 || others > 0;
    const summarySig = showSummary ? `${jobs.total}|${jobs.review}|${jobs.failed}|${jobs.top}` : "";
    if (summarySig !== lastSummarySig) {
      lastSummarySig = summarySig;
      const pieces: string[] = [`작업 ${jobs.total}개`];
      if (jobs.review > 0) pieces.push(`확인 필요 ${jobs.review}`);
      if (jobs.failed > 0) pieces.push(`실패 ${jobs.failed}`);
      summary.hidden = !showSummary;
      summary.replaceChildren(...(showSummary ? pieces.flatMap((text, i) => [...(i ? [el("i", { text: " · ", attrs: { "aria-hidden": "true" } })] : []), el("span", { text })]) : []));
      summary.dataset.top = jobs.top ?? "";
    }
    const stampSig = `${stamp.running}|${stamp.waiting}`;
    if (stampSig !== lastStampSig) {
      lastStampSig = stampSig;
      stampChip.hidden = stamp.total === 0;
      stampChip.replaceChildren(...(stamp.total === 0 ? [] : [
        el("span", { text: `바로 깔기 ${stamp.running}개 진행` }),
        ...(stamp.waiting > 0 ? [el("i", { text: " · ", attrs: { "aria-hidden": "true" } }), el("span", { text: `${stamp.waiting}개 대기` })] : []),
      ]));
    }
    const budget = budgetCache;
    const shown = ordered.length > budget ? ordered.slice(0, Math.max(1, budget - 1)) : ordered;
    const rest = ordered.slice(shown.length);
    const here = editorState.get().currentMapId;
    const mapsInvolved = new Set(presences.map(p => p.mapId ?? "")).size;
    // 보이는 칩의 내용이 그대로면 칩을 다시 만들지 않는다 — 조수 이벤트(델타·도구 신호)마다 같은 칩을 지우고 만들던 것을 거른다.
    const chipSignature = JSON.stringify([openBarId, here, mapsInvolved, budget, shown.map(p => [p.id, p.state, p.no, p.tone, p.source, p.action, p.steps, p.name, p.mapId, p.mapName]), rest.length, rest.some(needsUser)]);
    if (chipSignature !== lastChipSignature) {
      lastChipSignature = chipSignature;
      chips.replaceChildren(...shown.map(presence => el("button", {
        class: "ai-status-chip",
        attrs: { type: "button", "aria-expanded": String(openBarId === presence.id), title: `${presence.name} · ${PRESENCE_LABEL[presence.state]}` },
        dataset: { testid: "ai-status-chip", presenceId: presence.id, state: presence.state, tone: String(presence.tone), source: presence.source, elsewhere: String(Boolean(presence.mapId && here && presence.mapId !== here)) },
        children: [
          el("span", { class: `ai-status-dot${isActive(presence) ? " is-pulse" : ""}`, dataset: { tone: String(presence.tone), state: presence.state } }),
          el("span", { class: "ai-status-no", text: `#${presence.no}`, attrs: { translate: "no" } }),
          ...(mapsInvolved > 1 && presence.mapName ? [el("span", { class: "ai-status-map", text: presence.mapName })] : []),
          el("b", { text: presence.name }),
          el("span", { class: "ai-status-action", text: `${presence.action}${stepText(presence)}` }),
        ],
        on: { click: (event) => openFor(presence.id, event.currentTarget as HTMLElement) },
      })), ...(rest.length ? [el("button", {
        class: "ai-status-chip is-more", attrs: { type: "button", title: "나머지 작업 모두 보기", "aria-haspopup": "dialog" },
        dataset: { testid: "ai-status-more", attention: String(rest.some(needsUser)), aiJobEntry: "1" },
        children: [el("b", { text: `+${rest.length}` }), el("span", { class: "ai-status-action", text: rest.some(needsUser) ? "확인 필요" : "더 보기" })],
        on: { click: (event) => toggleAiJobList(event.currentTarget as HTMLElement) },
      })] : []));
    }
    stop.hidden = !presences.some(isActive) && stamp.total === 0;
    placeNow(box);
    tick();
  }

  function tick(): void {
    const starts = presences.filter(isActive).map(p => p.startedAt).filter((v): v is number => v !== undefined);
    const text = starts.length ? formatElapsed(Date.now() - Math.min(...starts)) : "";
    if (elapsed.textContent !== text) elapsed.textContent = text;
    if (settledSince !== null && !hiddenBySettle && Date.now() - settledSince >= SETTLED_HIDE_MS) {
      hiddenBySettle = true;
      render();
    }
  }

  const offPopover = subscribePresencePopover(({ id, source }) => {
    openBarId = source === "bar" ? id : null;
    for (const chip of chips.querySelectorAll<HTMLElement>(".ai-status-chip")) {
      const expanded = String((chip.dataset.presenceId ?? "") === (openBarId ?? ""));
      if (chip.getAttribute("aria-expanded") !== expanded) chip.setAttribute("aria-expanded", expanded);
    }
    if (openBarId && openPresencePopoverId() === openBarId) repositionPresencePopover();
  });
  const off = subscribeAiPresence(next => {
    presences = next;
    const settled = next.length > 0 && next.every(p => p.state === "applied");
    if (settled) { if (settledSince === null) settledSince = Date.now(); }
    else { settledSince = null; hiddenBySettle = false; }
    render();
  });
  const offJobs = subscribeJobSummary(next => { jobs = next; render(); });
  const offStamp = subscribeStampOrders(() => render());
  const timer = window.setInterval(tick, 1000);
  const onResize = (): void => render(); // 폭이 바뀌면 칩 개수도 다시 정한다(프레임 묶음이 읽고 앉힌다).
  // 도크를 접고 펼치거나 스튜디오가 열리고 닫히면 「대화 카드가 보이나」가 바뀐다 — 줄을 다시 판단한다.
  const onVisibilityContext = (): void => render();
  window.addEventListener("resize", onResize);
  // 도크가 접히고 펼쳐지거나 레이아웃이 바뀌어도 줄이 AI 창을 가리지 않게 다시 앉힌다.
  const canvas = document.querySelector<HTMLElement>('[data-testid="edit-canvas"]');
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => render()) : null;
  if (canvas) observer?.observe(canvas);
  window.addEventListener("oprn:ai-panel-collapse", onResize);
  window.addEventListener("oprn:ai-panel-collapse", onVisibilityContext);
  window.addEventListener("oprn:ai-team-wing-state", onVisibilityContext);
  window.addEventListener(AI_STUDIO_CHANGE_EVENT, onVisibilityContext);

  return () => {
    off();
    offPopover();
    offJobs();
    offStamp();
    offSummaryEntry();
    closePresencePopoverBySource("bar");
    frame.cancel();
    window.clearInterval(timer);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("oprn:ai-panel-collapse", onResize);
    window.removeEventListener("oprn:ai-panel-collapse", onVisibilityContext);
    window.removeEventListener("oprn:ai-team-wing-state", onVisibilityContext);
    window.removeEventListener(AI_STUDIO_CHANGE_EVENT, onVisibilityContext);
    observer?.disconnect();
    root.remove();
  };
}
