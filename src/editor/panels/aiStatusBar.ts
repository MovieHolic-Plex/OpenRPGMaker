// editor/panels/aiStatusBar.ts
// 지도 아래 상태 줄 — 「지금 AI 가 뭘 하고 있나」의 유일한 정답.
//
// 누가·무엇을·몇 단계째인지만 한 줄. 칩을 누르면 지도 위에서 바로 팝오버가 열린다(패널로 시선이 옮겨 가지 않는다).
// 사람이 움직여야 하는 상태(내 차례·실패)가 되면 줄 전체가 앰버/빨강으로 바뀐다.
// 원천은 aiPresence 하나뿐이다 — 이 파일은 관측을 새로 만들지 않는다.
//
// DOM 계약: `ai-status-bar`(루트, data-attention=review|failed|none) · `ai-status-chip`(data-state, data-tone) ·
// `ai-status-pop` · `ai-status-log` · `ai-status-stop`.

import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { selectEditorMap } from "@/editor/mapSelection";
import { el } from "@/util/dom";
import { editorState } from "@/editor/editorState";
import { isActive, needsUser, PRESENCE_LABEL, stopAllPresences, stopPresence, subscribeAiPresence, type Presence } from "./aiPresence";

/** 끝난 일(적용됨)은 이 시간 뒤에 줄에서 물러난다. 실패·검토 대기는 사람이 처리할 때까지 남는다. */
const SETTLED_HIDE_MS = 6000;
/** 줄에 직접 놓는 칩 수. 넘치면 「+N」 로 접고 눌러서 맵별 목록으로 본다. */
const MAX_CHIPS = 4;
const ALL = "__all__";

function clock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}초` : `${Math.floor(seconds / 60)}분 ${String(seconds % 60).padStart(2, "0")}초`;
}

export function mountAiStatusBar(): () => void {
  let presences: readonly Presence[] = [];
  let openId: string | null = null;
  let settledSince: number | null = null;
  let hiddenBySettle = false;

  const chips = el("div", { class: "ai-status-chips", dataset: { testid: "ai-status-chips" } });
  const elapsed = el("span", { class: "ai-status-elapsed", dataset: { testid: "ai-status-elapsed" } });
  const log = el("button", {
    class: "ai-status-btn", text: "작업 기록", attrs: { type: "button", title: "실행 기록·로그 내려받기를 엽니다" },
    dataset: { testid: "ai-status-log" },
    on: { click: () => openLogs() },
  });
  const stop = el("button", {
    class: "ai-status-btn is-stop", text: "■ 멈춤", attrs: { type: "button", title: "지금 도는 AI 작업을 모두 멈춥니다" },
    dataset: { testid: "ai-status-stop" },
    on: { click: () => { stopAllPresences(); } },
  });
  const pop = el("div", { class: "ai-status-pop", dataset: { testid: "ai-status-pop" }, attrs: { role: "dialog", "aria-label": "AI 작업 상세", hidden: "" } });
  const root = el("aside", {
    class: "ai-status-bar", attrs: { role: "status", "aria-live": "polite", "aria-label": "AI 작업 상태", hidden: "" },
    dataset: { testid: "ai-status-bar", attention: "none" },
    children: [chips, el("span", { class: "ai-status-spacer" }), elapsed, log, stop],
  });
  document.body.append(root, pop);

  /** 캔버스 아래쪽 가운데에 앉히되, 지도 위로 펼쳐진 AI 창은 피한다. */
  const place = (): void => {
    const canvas = document.querySelector<HTMLElement>('[data-testid="edit-canvas"]');
    const rect = canvas?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const dock = document.querySelector<HTMLElement>(".ai-right-dock .ai-chat-panel:not(.is-collapsed)");
    const dockLeft = dock ? dock.getBoundingClientRect().left : Infinity;
    const right = Math.min(rect.right, dockLeft);
    const left = rect.left + 16;
    root.style.left = `${Math.round(left)}px`;
    root.style.width = `${Math.max(280, Math.round(right - left - 16))}px`;
    root.style.bottom = `${Math.max(8, Math.round(window.innerHeight - rect.bottom + 16))}px`;
    if (!pop.hidden) placePop();
  };

  const placePop = (): void => {
    const chip = openId === ALL ? chips.querySelector<HTMLElement>(".is-more") : chips.querySelector<HTMLElement>(`[data-presence-id="${CSS.escape(openId ?? "")}"]`);
    if (!chip) { closePop(); return; }
    const chipRect = chip.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.round(chipRect.left))}px`;
    pop.style.bottom = `${Math.round(window.innerHeight - root.getBoundingClientRect().top + 10)}px`;
  };

  function closePop(): void {
    openId = null;
    pop.hidden = true;
    for (const chip of chips.querySelectorAll(".ai-status-chip")) chip.setAttribute("aria-expanded", "false");
  }

  function openLogs(): void {
    // 로그·내려받기는 오른쪽 AI 창이 이미 갖고 있다 — 입구만 여기로 모은다.
    document.querySelector<HTMLElement>(".ai-collapsed-restore")?.click();
    document.querySelector<HTMLElement>(".ai-workspace-log-trigger")?.click();
  }

  function locate(presence: Presence): void {
    if (!presence.mapId) return;
    if (presence.region) focusEditorRegion({ mapId: presence.mapId, x: presence.region.x, y: presence.region.y, w: presence.region.width, h: presence.region.height }, { highlight: true });
    else selectEditorMap(presence.mapId, { checkoutForEditing: false });
  }

  function renderPop(presence: Presence): void {
    const rows = presence.recent.length
      ? presence.recent.map(entry => el("li", { class: entry.failed ? "is-failed" : "", text: `${entry.failed ? "✗" : entry.running ? "…" : "✓"} ${entry.label}` }))
      : [el("li", { class: "is-empty", text: "아직 끝낸 단계가 없어요" })];
    pop.replaceChildren(
      el("header", { children: [
        el("span", { class: "ai-status-dot", dataset: { tone: String(presence.tone), state: presence.state } }),
        el("strong", { text: presence.name }),
        el("span", { class: "ai-status-tag", dataset: { state: presence.state }, text: PRESENCE_LABEL[presence.state] }),
      ] }),
      ...(presence.mapName ? [el("p", { class: "ai-status-pop-map", text: presence.mapName })] : []),
      ...(presence.task ? [el("p", { class: "ai-status-pop-task", text: presence.task, attrs: { translate: "no" } })] : []),
      el("p", { class: "ai-status-pop-now", children: [el("b", { text: "지금 " }), presence.action] }),
      el("ul", { class: "ai-status-pop-recent", children: rows }),
      el("div", { class: "ai-status-pop-actions", children: [
        ...(presence.source === "chat" ? [el("button", { class: "ai-status-btn", text: "조수 상세", attrs: { type: "button" }, dataset: { testid: "ai-status-detail" }, on: { click: () => { closePop(); window.dispatchEvent(new Event("oprn:ai-open-team")); } } })] : []),
        ...(presence.mapId ? [el("button", { class: "ai-status-btn", text: presence.mapId && presence.mapId !== editorState.get().currentMapId ? "그 맵으로 이동" : "지도로 이동", attrs: { type: "button" }, dataset: { testid: "ai-status-locate" }, on: { click: () => locate(presence) } })] : []),
        ...(isActive(presence) ? [el("button", { class: "ai-status-btn is-stop", text: "멈춤", attrs: { type: "button" }, on: { click: () => { stopPresence(presence); closePop(); } } })] : []),
      ] }),
    );
  }

  function openFor(id: string): void {
    if (openId === id) { closePop(); return; }
    openId = id;
    if (id === ALL) renderAll(); else { const p = presences.find(item => item.id === id); if (p) renderPop(p); }
    pop.hidden = false;
    placePop();
    for (const chip of chips.querySelectorAll<HTMLElement>(".ai-status-chip")) chip.setAttribute("aria-expanded", String((chip.dataset.presenceId ?? (chip.classList.contains("is-more") ? ALL : "")) === id));
  }

  /** 맵별로 묶은 전체 목록 — 여러 맵에서 여러 조수가 돌 때의 「한 번에 보기」. */
  function renderAll(): void {
    const groups = new Map<string, Presence[]>();
    for (const presence of presences) {
      const key = presence.mapName ?? "프로젝트 전체";
      groups.set(key, [...(groups.get(key) ?? []), presence]);
    }
    const here = editorState.get().currentMapId;
    // 사람이 움직여야 하는 맵 → 지금 보는 맵 → 나머지 순. 급한 것이 스크롤 밖으로 밀리지 않게.
    const rank = (items: Presence[]): number => items.some(needsUser) ? 0 : items[0]?.mapId === here ? 1 : 2;
    const ordered = [...groups].sort((x, y) => rank(x[1]) - rank(y[1]));
    pop.replaceChildren(
      el("header", { children: [el("strong", { text: `AI 작업 ${presences.length}개` }), el("span", { class: "ai-status-tag", text: `${groups.size}곳` })] }),
      ...ordered.map(([name, items]) => el("section", { class: "ai-status-group", children: [
        el("h5", { children: [el("span", { text: name }), ...(items[0]?.mapId && items[0].mapId === here ? [el("em", { text: " · 지금 보는 맵" })] : [])] }),
        ...items.map(item => el("button", { class: "ai-status-row", attrs: { type: "button" }, dataset: { state: item.state, presenceId: item.id }, children: [
          el("span", { class: "ai-status-dot", dataset: { tone: String(item.tone), state: item.state } }),
          el("b", { text: item.name }),
          el("span", { class: "ai-status-action", text: item.action }),
          el("span", { class: "ai-status-tag", dataset: { state: item.state }, text: PRESENCE_LABEL[item.state] }),
        ], on: { click: () => { openId = null; openFor(item.id); } } })),
      ] })),
    );
  }

  const stepText = (presence: Presence): string => presence.steps > 0 && presence.state === "working" ? ` · ${presence.steps}단계` : "";

  function render(): void {
    const visible = presences.length > 0 && !hiddenBySettle;
    root.hidden = !visible;
    if (!visible) { closePop(); return; }
    const attention = presences.some(p => p.state === "failed") ? "failed" : presences.some(p => p.state === "review") ? "review" : "none";
    root.dataset.attention = attention;
    const ordered = [...presences].sort((a, b) => Number(needsUser(b)) - Number(needsUser(a)));
    const shown = ordered.length > MAX_CHIPS ? ordered.slice(0, MAX_CHIPS - 1) : ordered;
    const rest = ordered.slice(shown.length);
    const here = editorState.get().currentMapId;
    const mapsInvolved = new Set(presences.map(p => p.mapId ?? "")).size;
    chips.replaceChildren(...shown.map(presence => el("button", {
      class: "ai-status-chip",
      attrs: { type: "button", "aria-expanded": String(openId === presence.id), title: `${presence.name} · ${PRESENCE_LABEL[presence.state]}` },
      dataset: { testid: "ai-status-chip", presenceId: presence.id, state: presence.state, tone: String(presence.tone), source: presence.source, elsewhere: String(Boolean(presence.mapId && here && presence.mapId !== here)) },
      children: [
        el("span", { class: `ai-status-dot${isActive(presence) ? " is-pulse" : ""}`, dataset: { tone: String(presence.tone), state: presence.state } }),
        ...(mapsInvolved > 1 && presence.mapName ? [el("span", { class: "ai-status-map", text: presence.mapName })] : []),
        el("b", { text: presence.name }),
        el("span", { class: "ai-status-action", text: `${presence.action}${stepText(presence)}` }),
      ],
      on: { click: () => openFor(presence.id) },
    })), ...(rest.length ? [el("button", {
      class: "ai-status-chip is-more", attrs: { type: "button", "aria-expanded": String(openId === ALL), title: "나머지 작업 모두 보기" },
      dataset: { testid: "ai-status-more", attention: String(rest.some(needsUser)) },
      children: [el("b", { text: `+${rest.length}` }), el("span", { class: "ai-status-action", text: rest.some(needsUser) ? "확인 필요" : "더 보기" })],
      on: { click: () => openFor(ALL) },
    })] : []));
    stop.hidden = !presences.some(isActive);
    if (openId === ALL) renderAll();
    else if (openId) {
      const open = presences.find(p => p.id === openId);
      if (open) renderPop(open); else closePop();
    }
    place();
    tick();
  }

  function tick(): void {
    const starts = presences.filter(isActive).map(p => p.startedAt).filter((v): v is number => v !== undefined);
    elapsed.textContent = starts.length ? clock(Date.now() - Math.min(...starts)) : "";
    if (settledSince !== null && !hiddenBySettle && Date.now() - settledSince >= SETTLED_HIDE_MS) {
      hiddenBySettle = true;
      render();
    }
  }

  const off = subscribeAiPresence(next => {
    presences = next;
    const settled = next.length > 0 && next.every(p => p.state === "applied");
    if (settled) { if (settledSince === null) settledSince = Date.now(); }
    else { settledSince = null; hiddenBySettle = false; }
    render();
  });
  const timer = window.setInterval(tick, 1000);
  const onResize = (): void => place();
  const onDocPointer = (event: PointerEvent): void => {
    if (pop.hidden) return;
    const target = event.target as Node | null;
    if (target && (pop.contains(target) || chips.contains(target))) return;
    closePop();
  };
  const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape" && !pop.hidden) { closePop(); } };
  window.addEventListener("resize", onResize);
  document.addEventListener("pointerdown", onDocPointer, true);
  document.addEventListener("keydown", onKey);
  // 도크가 접히고 펼쳐지거나 레이아웃이 바뀌어도 줄이 AI 창을 가리지 않게 다시 앉힌다.
  const canvas = document.querySelector<HTMLElement>('[data-testid="edit-canvas"]');
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => place()) : null;
  if (canvas) observer?.observe(canvas);
  window.addEventListener("oprn:ai-panel-collapse", onResize);

  return () => {
    off();
    window.clearInterval(timer);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("oprn:ai-panel-collapse", onResize);
    document.removeEventListener("pointerdown", onDocPointer, true);
    document.removeEventListener("keydown", onKey);
    observer?.disconnect();
    root.remove();
    pop.remove();
  };
}
