// 맵별 실행 카드 — 다른 맵에서 같이 도는(또는 같은 맵에서 차례를 기다리는) 조수 실행 하나를 보여 준다(2026-10-03). 메인 대화(로그)에는 들어가지 않고 aiSideThreads 트레이에 올라간다(2026-10-08).
//
// 앞에서 도는 실행은 패널의 상태줄·작업 카드·캔버스 카드를 쓴다. 그 자리는 하나뿐이라, 같이 도는 실행은 각자 이 카드에
// 맵 이름·상태·최근 단계·조수 말·중단 단추를 갖는다. 실행 본문은 aiChatPanel 이 aiMapRunQueue 로 돌린다.

import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import type { MapRunTicket } from "@/editor/aiMapRunQueue";
import { narrateAiActivity } from "@/editor/aiActivityNarration";
import { el } from "@/util/dom";

/** 최근 단계 줄 수. */
const STEP_LIMIT = 5;

export interface MapRunCard {
  readonly root: HTMLElement;
  /** 대기열 표가 바뀌었을 때(차례·앞에 선 수). */
  ticket(ticket: MapRunTicket): void;
  setStatus(text: string): void;
  event(event: PiAgentEvent): void;
  say(role: "system" | "assistant", text: string): void;
  note(text: string): void;
  /** 작업 과정(팀 보드 등)은 접은 칸에. */
  attach(element: HTMLElement): void;
  /** 사람이 골라야 하는 카드(검토)는 펼친 자리에. */
  attachPrompt(element: HTMLElement): void;
  finish(outcome: { readonly ok: boolean; readonly message?: string }): void;
}

export function createMapRunCard(input: { readonly mapName: string; readonly label: string; readonly onCancel: () => void }): MapRunCard {
  const status = el("span", { class: "ai-map-run-status", text: "대기" });
  const stop = el("button", { class: "ai-map-run-stop", text: "중단", attrs: { type: "button" } });
  stop.addEventListener("click", () => input.onCancel());
  const header = el("header", { class: "ai-map-run-head" });
  header.append(el("span", { class: "ai-map-run-map", text: input.mapName }), status, stop);
  const label = el("p", { class: "ai-map-run-label", text: input.label });
  const steps = el("ol", { class: "ai-map-run-steps" });
  const messages = el("div", { class: "ai-map-run-messages" });
  const process = el("details", { class: "ai-map-run-process" });
  process.append(el("summary", { text: "작업 과정" }));
  process.hidden = true;
  const root = el("section", { class: "ai-map-run-card", dataset: { testid: "ai-map-run-card", state: "waiting" } });
  root.setAttribute("aria-live", "polite");
  root.append(header, label, steps, messages, process);

  const step = (text: string, kind: "run" | "ok" | "fail" | "say" = "run"): void => {
    const last = steps.lastElementChild as HTMLElement | null;
    // 같은 도구의 시작 → 끝은 한 줄로 바꿔 쓴다.
    if (last && last.dataset.kind === "run" && kind !== "say") last.remove();
    steps.append(el("li", { text, dataset: { kind } }));
    while (steps.children.length > STEP_LIMIT) steps.firstElementChild?.remove();
  };

  return {
    root,
    ticket(ticket) {
      root.dataset.state = ticket.status;
      if (ticket.status === "waiting") {
        status.textContent = ticket.wait === "capacity" ? "대기 · 동시 실행 자리"
          : ticket.wait === "exclusive" ? "대기 · 전체 작업 끝나면"
          : `대기 · 이 맵 앞에 ${ticket.ahead}개`;
      } else if (ticket.status === "running" && status.textContent?.startsWith("대기")) status.textContent = "시작";
      stop.hidden = ticket.status !== "waiting" && ticket.status !== "running";
      stop.textContent = ticket.status === "waiting" ? "빼기" : "중단";
    },
    setStatus(text) {
      if (root.dataset.state === "running" || root.dataset.state === "waiting") status.textContent = text;
    },
    event(raw) {
      let event = raw;
      while (event.type === "agent_event") event = event.event;
      if (event.type === "tool_start") step(narrateAiActivity({ toolName: event.name, done: false }).action);
      else if (event.type === "tool_end") step(narrateAiActivity({ toolName: event.name, done: true, ok: event.ok }).action, event.ok ? "ok" : "fail");
      else if (event.type === "checkpoint") status.textContent = "맵에 반영하는 중";
      else if (event.type === "execution_status" && event.name === "checkpoint.apply") status.textContent = event.ok === false ? "반영 실패" : "맵에 반영함";
      else if (event.type === "assistant") {
        const said = event.text.replace(/\s+/gu, " ").trim();
        if (said) step(`“${said.length > 120 ? `${said.slice(0, 120)}…` : said}”`, "say");
      }
    },
    say(role, text) {
      messages.append(el("p", { class: `ai-map-run-say is-${role}`, text }));
    },
    note(text) {
      process.hidden = false;
      process.append(el("p", { class: "ai-map-run-note", text }));
    },
    attach(element) {
      process.hidden = false;
      process.append(element);
    },
    attachPrompt(element) {
      root.dataset.review = "1";
      messages.append(element);
    },
    finish(outcome) {
      root.dataset.state = outcome.ok ? "done" : "failed";
      status.textContent = outcome.message ?? (outcome.ok ? "끝남" : "실패");
      stop.hidden = true;
    },
  };
}
