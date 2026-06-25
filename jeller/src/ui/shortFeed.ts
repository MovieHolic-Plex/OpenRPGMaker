// 숏 피드 — MCGA의 메인 경험. 4단계 라이프사이클.
// ① 브리핑(왕/상황) → ② 선택(행동 카드) → ③ 결과(즉시) → ④ 판결(STEP 3까지 정적).
// STEP 3에서 왕 판결 + 대사가 연결됨. 지금은 "왕의 판결을 기다린다" 정적.

import type { ActionKind, ActionSubmissionResult, ShortData, Subject } from "@/types";
import { fetchShort, submitAction } from "@/api/game";
import { escapeXml as escapeHtml } from "@/render/escape";

type Stage = "loading" | "briefing" | "result" | "done";

interface FeedState {
  stage: Stage;
  short: ShortData | null;
  result: ActionSubmissionResult | null;
  error: string | null;
}

export function bootShortFeed(container: HTMLElement, subject: Subject): () => void {
  const state: FeedState = { stage: "loading", short: null, result: null, error: null };

  async function loadNext() {
    state.stage = "loading";
    state.short = null;
    state.result = null;
    state.error = null;
    render(container, state, subject, { loadNext, choose });
    try {
      const { short } = await fetchShort(subject.id);
      state.short = short;
      state.stage = short ? "briefing" : "done";
    } catch (e) {
      state.error = String(e);
      state.stage = "done";
    }
    render(container, state, subject, { loadNext, choose });
  }

  async function choose(kind: ActionKind) {
    if (!state.short) return;
    state.stage = "loading";
    render(container, state, subject, { loadNext, choose });
    try {
      const result = await submitAction(state.short.short_id, kind);
      state.result = result;
      state.stage = "result";
    } catch (e) {
      state.error = String(e);
      state.stage = "briefing"; // 다시 시도 가능하게
    }
    render(container, state, subject, { loadNext, choose });
  }

  render(container, state, subject, { loadNext, choose });
  loadNext();

  return () => {
    /* 정리할 타이머 없음 — 이벤트는 render 때마다 재바인딩 */
  };
}

interface Handlers {
  loadNext: () => void;
  choose: (kind: ActionKind) => void;
}

function render(
  container: HTMLElement,
  state: FeedState,
  subject: Subject,
  handlers: Handlers
): void {
  const officeLabel = subject.office === "interior" ? "영의정(내정)" : "병조판서(군사)";
  const fame = subject.fame ?? 0;

  let body = "";

  if (state.stage === "loading") {
    body = `<div class="short-loading">조회를 기다리는 중…</div>`;
  } else if (state.stage === "done" && !state.short) {
    body = `
      <div class="short-empty">
        <p>현재 처리할 사건이 없습니다.</p>
        <p class="hint">세계 틱(5분)이 돌면 새 사건이 생깁니다.</p>
        <button id="short-retry" class="btn">다시 조회</button>
      </div>`;
  } else if (state.stage === "briefing" && state.short) {
    const s = state.short;
    const terr = s.territory
      ? `<div class="briefing-territory">
          📍 ${escapeHtml(s.territory.name)} ·
          병력 ${s.territory.troops} · 곡물 ${s.territory.grain} · 인구 ${s.territory.population}
        </div>`
      : "";
    const options = s.options
      .map(
        (o) =>
          `<button class="action-card" data-action="${o.kind}">
            <span class="action-label">${escapeHtml(o.label)}</span>
            <span class="action-hint">${escapeHtml(o.hint)}</span>
          </button>`
      )
      .join("");
    body = `
      <div class="briefing">
        <div class="briefing-tag">${typeLabel(s.type)}</div>
        <p class="briefing-text">${escapeHtml(s.briefing)}</p>
        ${terr}
      </div>
      <div class="options">${options}</div>`;
  } else if (state.stage === "result" && state.result) {
    const r = state.result.result;
    const verdictLine = state.result.verdict
      ? `<div class="verdict verdict-${state.result.verdict.kind}">
          👑 ${escapeHtml(state.result.verdict.king_line)}
        </div>`
      : `<div class="verdict verdict-pending">👑 왕의 판결을 기다린다… (STEP 3에서 왕 대사 연결)</div>`;
    body = `
      <div class="result">
        <div class="result-summary">${escapeHtml(r.summary)}</div>
        <div class="result-fame">공명 ${r.fame_delta >= 0 ? "+" : ""}${r.fame_delta} → ${r.new_fame}</div>
      </div>
      ${verdictLine}
      <button id="short-next" class="btn btn-primary">다음 조회</button>`;
  }

  if (state.error) {
    body += `<div class="short-error">오류: ${escapeHtml(state.error)}</div>`;
  }

  container.innerHTML = `
    <div class="short-feed">
      <div class="short-header">
        <span class="office">${escapeHtml(subject.nickname)} · ${officeLabel}</span>
        <span class="fame">공명 ${fame}</span>
      </div>
      ${body}
    </div>
  `;

  // 이벤트 바인딩
  container.querySelectorAll<HTMLButtonElement>(".action-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action as ActionKind;
      if (action) handlers.choose(action);
    });
  });
  const retry = container.querySelector<HTMLButtonElement>("#short-retry");
  retry?.addEventListener("click", handlers.loadNext);
  const next = container.querySelector<HTMLButtonElement>("#short-next");
  next?.addEventListener("click", handlers.loadNext);
}

function typeLabel(type: string): string {
  switch (type) {
    case "war_report": return "⚔️ 전쟁 보고";
    case "tax_proposal": return "🏛️ 세정 건의";
    case "invasion": return "⚔️ 침공 경보";
    case "royal_decree": return "📜 왕의 명";
    default: return type;
  }
}
