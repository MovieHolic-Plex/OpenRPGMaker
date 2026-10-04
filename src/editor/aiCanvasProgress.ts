import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { narrateAiActivity } from "./aiActivityNarration";
import { isAiLiveCanvasEnabled, subscribeAiLiveCanvas } from "./aiLiveCanvas";
import { defaultYieldToUi } from "@/ai/yieldToUi";

export interface AiCanvasProgress {
  status(text: string): void;
  event(event: PiAgentEvent): void;
  paint(): Promise<void>;
  finish(): void;
}

let activeOwner: symbol | null = null;
let retire: (() => void) | null = null;

/** UI-only feedback. Never invent tiles, tool success or persisted changes. */
export function startAiCanvasProgress(instruction: string): AiCanvasProgress {
  retire?.();
  const owner = Symbol("canvas-progress");
  activeOwner = owner;
  const root = document.createElement("aside");
  root.className = "ai-canvas-progress";
  root.dataset.testid = "ai-canvas-progress";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  const heading = document.createElement("strong");
  heading.textContent = "AI 작업";
  const request = document.createElement("p");
  request.className = "ai-canvas-progress-request";
  request.textContent = instruction.replace(/\s+/gu, " ").trim().slice(0, 140);
  const stage = document.createElement("p");
  stage.className = "ai-canvas-progress-stage";
  stage.textContent = "요청을 읽고 있어요";
  root.append(heading, request, stage);
  const host = document.querySelector(".phaser-container");
  host?.append(root);
  const visibility = () => { root.hidden = !isAiLiveCanvasEnabled(); };
  visibility();
  const unsubscribe = subscribeAiLiveCanvas(visibility);
  let finished = false;
  const owns = () => !finished && activeOwner === owner;
  const finish = () => {
    if (finished) return;
    finished = true;
    unsubscribe();
    root.remove();
    if (activeOwner === owner) { activeOwner = null; retire = null; }
  };
  retire = finish;
  return {
    status(text) { if (owns()) stage.textContent = text; },
    event(raw) {
      if (!owns()) return;
      let event = raw;
      while (event.type === "agent_event") event = event.event;
      if (event.type === "checkpoint") {
        stage.textContent = `${narrateAiActivity({ toolName: event.toolName, done: true, ok: true }).action} · 맵에 반영하는 중`;
        return;
      }
      if (event.type === "execution_status" && event.name === "checkpoint.apply") {
        stage.textContent = event.ok === false ? "맵에 반영하지 못했어요" : "맵에 반영했어요";
        return;
      }
      if (event.type === "assistant") {
        // 조수가 작업 사이에 사용자에게 한 말 — 다음 도구가 시작되면 그 문구로 바뀐다.
        const said = event.text.replace(/\s+/gu, " ").trim();
        if (said) stage.textContent = said.length > 90 ? `${said.slice(0, 90)}…` : said;
        return;
      }
      if (event.type !== "tool_start" && event.type !== "tool_end") return;
      stage.textContent = narrateAiActivity({ toolName: event.name,
        done: event.type === "tool_end", ok: event.type === "tool_end" ? event.ok : undefined }).action;
    },
    async paint() {
      // Paint the acknowledgement before intent classification / large base capture.
      // Hidden tabs must still be able to continue the request.
      await defaultYieldToUi();
    },
    finish,
  };
}
