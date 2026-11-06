// 에이전트 모드(실험) 패널. 사용자 PC 의 코딩 에이전트(ACP)를 고르고, 말·단계 카드·계획·승인·중지·턴 되돌리기를 보인다.
// 메인 프로세스 쪽은 electron/main/agentHost.ts, 도구 실행은 ./agentModeTools.ts.
import "@/styles/editor/agent-mode.css";
import { el } from "@/util/dom";
import { undoMapEdit } from "@/editor/mapEditHistory";
import type { OprnAgentBridge } from "@/project/persistence/electronRepository";
import { getTool } from "@/editor/tools/toolRegistry";
import { callAgentModeTool, listAgentModeTools, newAgentTurn, type AgentTurn } from "./agentModeTools";

type Availability = { id: string; label: string; cliFound: boolean; adapterFound: boolean; ready: boolean; installHint: string; loginHint: string };
type AgentEvent = { seq: number; type: string; [key: string]: unknown };
type ToolCard = { root: HTMLElement; status: HTMLElement; title: HTMLElement; detail: HTMLElement };

const TOOL_LABELS: Readonly<Record<string, string>> = {
  oprn_tools: "도구 찾기",
  oprn_schema: "도구 설명 읽기",
  oprn_call: "도구 실행",
  get_project_summary: "프로젝트 훑어보기",
  get_map_region: "맵 영역 읽기",
  show_map_region: "맵 그림 보기",
  paint_tiles: "타일 칠하기",
  stamp_object: "기물 찍기",
  place_props: "소품 흩뿌리기",
  place_door: "문 놓기",
  place_chest: "보물상자 놓기",
  find_events: "이벤트 찾기",
  get_event: "이벤트 읽기",
  create_map: "새 맵 만들기",
  check_reachability: "길 막힘 검사",
};

const STATUS_TEXT: Readonly<Record<string, string>> = { pending: "대기", in_progress: "진행 중", completed: "완료", failed: "실패" };
const OPTION_TEXT: Readonly<Record<string, string>> = { allow_once: "한 번 허용", allow_always: "항상 허용", reject_once: "거절", reject_always: "항상 거절" };

function toolNameOf(title: string): string {
  return title.replace(/^mcp__oprn__/u, "").replace(/^oprn\//u, "").replace(/^oprn_(?!tools$|schema$|call$)/u, "");
}

function readableTool(title: string, rawInput: unknown): string {
  const name = toolNameOf(title);
  const input = rawInput && typeof rawInput === "object" ? rawInput as Record<string, unknown> : {};
  if (name === "oprn_call" && typeof input.name === "string") return TOOL_LABELS[input.name] ? `${TOOL_LABELS[input.name]} (${input.name})` : `도구 실행 · ${input.name}`;
  if (name === "oprn_tools" && typeof input.query === "string") return `도구 찾기 「${input.query}」`;
  if (name === "oprn_schema" && typeof input.name === "string") return `도구 설명 읽기 · ${input.name}`;
  return TOOL_LABELS[name] ? `${TOOL_LABELS[name]} (${name})` : name;
}

/** 읽기만 하는 호출은 묻지 않는다 — 승인은 맵을 바꾸는 호출에만 뜬다. */
function isReadOnlyCall(title: string, rawInput: unknown): boolean {
  const name = toolNameOf(title);
  if (name === "oprn_tools" || name === "oprn_schema") return true;
  const input = rawInput && typeof rawInput === "object" ? rawInput as Record<string, unknown> : {};
  const target = name === "oprn_call" && typeof input.name === "string" ? input.name : name;
  return getTool(target)?.mode === "read";
}

function outputText(update: Record<string, unknown>): string {
  const raw = update.rawOutput;
  const parts = Array.isArray(raw) ? raw : Array.isArray(update.content) ? update.content : [];
  for (const part of parts) {
    const item = part as { text?: unknown; content?: { text?: unknown } };
    const text = typeof item.text === "string" ? item.text : typeof item.content?.text === "string" ? item.content.text : null;
    const line = text?.split("\n").map((value) => value.trim()).find((value) => value && !value.startsWith("```"));
    if (line) return line.slice(0, 200);
  }
  if (raw && typeof raw === "object" && typeof (raw as { output?: unknown }).output === "string") return String((raw as { output: string }).output).split("\n")[0]!.slice(0, 200);
  return typeof raw === "string" ? raw.slice(0, 200) : "";
}

export function renderAgentModePanel(bridge: OprnAgentBridge): { root: HTMLElement; dispose: () => void } {
  let disposed = false;
  let after = 0;
  let turn: AgentTurn | null = null;
  let busy = false;
  let connected = false;
  let currentText: HTMLElement | null = null;
  let currentMessageId: string | null = null;
  let toolQueue: Promise<void> = Promise.resolve();
  const cards = new Map<string, ToolCard>();

  const agentSelect = el("select", { class: "agent-mode-select", dataset: { testid: "agent-mode-select" } }) as HTMLSelectElement;
  const availability = el("div", { class: "agent-mode-availability", dataset: { testid: "agent-mode-availability" } });
  const statusLine = el("div", { class: "agent-mode-status", dataset: { testid: "agent-mode-status" }, text: "에이전트를 고르고 연결하세요." });
  const connectButton = el("button", { class: "agent-mode-btn primary", text: "연결", attrs: { type: "button" }, dataset: { testid: "agent-mode-connect" } }) as HTMLButtonElement;
  const plan = el("ol", { class: "agent-mode-plan", attrs: { hidden: "" }, dataset: { testid: "agent-mode-plan" } });
  const log = el("div", { class: "agent-mode-log", attrs: { "aria-live": "polite" }, dataset: { testid: "agent-mode-log" } });
  const permissions = el("div", { class: "agent-mode-permissions", dataset: { testid: "agent-mode-permissions" } });
  const input = el("textarea", { class: "agent-mode-input", attrs: { rows: "3", placeholder: "예: 지금 맵 가운데에 3×3 연못을 파고 둘레에 꽃을 심어 줘" }, dataset: { testid: "agent-mode-input" } }) as HTMLTextAreaElement;
  const sendButton = el("button", { class: "agent-mode-btn primary", text: "보내기", attrs: { type: "button" }, dataset: { testid: "agent-mode-send" } }) as HTMLButtonElement;
  const stopButton = el("button", { class: "agent-mode-btn danger", text: "■ 중지", attrs: { type: "button" }, dataset: { testid: "agent-mode-stop" } }) as HTMLButtonElement;
  const undoButton = el("button", { class: "agent-mode-btn", text: "↶ 이번 턴 되돌리기", attrs: { type: "button", title: "에이전트가 이번 턴에 바꾼 것 전부를 한 번에 되돌립니다" }, dataset: { testid: "agent-mode-undo" } }) as HTMLButtonElement;

  const scroll = (): void => { log.scrollTop = log.scrollHeight; };
  const refreshButtons = (): void => {
    sendButton.disabled = !connected || busy || !input.value.trim();
    stopButton.disabled = !busy;
    undoButton.disabled = busy || !(turn?.recorded);
    connectButton.textContent = connected ? "다시 연결" : "연결";
  };
  const bubble = (kind: "user" | "agent" | "system", text: string): HTMLElement => {
    const node = el("div", { class: `agent-mode-bubble is-${kind}`, text });
    log.append(node);
    scroll();
    return node;
  };

  const renderAvailability = (agents: readonly Availability[]): void => {
    agentSelect.replaceChildren(...agents.map((agent) => el("option", {
      attrs: { value: agent.id, ...(agent.ready ? {} : { disabled: "" }) },
      text: `${agent.label}${agent.ready ? "" : " — 설치 필요"}`,
    })));
    const firstReady = agents.find((agent) => agent.ready);
    if (firstReady) agentSelect.value = firstReady.id;
    availability.replaceChildren(...agents.map((agent) => el("div", {
      class: `agent-mode-avail ${agent.ready ? "is-ready" : "is-missing"}`,
      dataset: { agent: agent.id },
      children: [
        el("strong", { text: `${agent.ready ? "●" : "○"} ${agent.label}` }),
        el("span", { text: agent.ready ? " 사용 가능" : !agent.cliFound ? " 없음" : " ACP 어댑터 없음" }),
        ...(agent.ready ? [] : [el("code", { text: agent.installHint })]),
        el("small", { text: agent.loginHint }),
      ],
    })));
  };

  const card = (id: string, title: string): ToolCard => {
    const existing = cards.get(id);
    if (existing) return existing;
    const status = el("span", { class: "agent-mode-card-status", text: "대기" });
    const titleNode = el("span", { class: "agent-mode-card-title", text: title });
    const detail = el("div", { class: "agent-mode-card-detail" });
    const root = el("div", { class: "agent-mode-card is-pending", dataset: { testid: "agent-mode-card", toolCallId: id }, children: [el("div", { class: "agent-mode-card-head", children: [titleNode, status] }), detail] });
    log.append(root);
    currentText = null;
    scroll();
    const created = { root, status, title: titleNode, detail };
    cards.set(id, created);
    return created;
  };

  const onUpdate = (update: Record<string, unknown>): void => {
    const kind = update.sessionUpdate;
    if (kind === "agent_message_chunk") {
      const text = (update.content as { text?: string } | undefined)?.text ?? "";
      const messageId = typeof update.messageId === "string" ? update.messageId : null;
      if (!currentText || (messageId && messageId !== currentMessageId)) {
        if (!text) return;
        currentText = bubble("agent", "");
        currentMessageId = messageId;
      }
      currentText.textContent += text;
      scroll();
      return;
    }
    if (kind === "plan") {
      const entries = Array.isArray(update.entries) ? update.entries as { content?: string; status?: string }[] : [];
      plan.hidden = entries.length === 0;
      plan.replaceChildren(...entries.map((entry) => el("li", {
        class: `is-${entry.status ?? "pending"}`,
        text: `${entry.status === "completed" ? "☑" : entry.status === "in_progress" ? "◐" : "☐"} ${entry.content ?? ""}`,
      })));
      return;
    }
    if (kind === "tool_call" || kind === "tool_call_update") {
      const id = String(update.toolCallId ?? "");
      if (!id) return;
      const target = card(id, readableTool(String(update.title ?? ""), update.rawInput));
      if (update.title) target.title.textContent = readableTool(String(update.title), update.rawInput);
      const status = typeof update.status === "string" ? update.status : null;
      if (status) {
        target.status.textContent = STATUS_TEXT[status] ?? status;
        target.root.className = `agent-mode-card is-${status}`;
      }
      const output = outputText(update);
      if (output) target.detail.textContent = output;
    }
  };

  const onPermission = (event: AgentEvent): void => {
    const toolCall = (event.toolCall ?? {}) as Record<string, unknown>;
    const options = (event.options ?? []) as { optionId: string; name: string; kind: string }[];
    const allowOnce = options.find((option) => option.kind === "allow_once");
    if (allowOnce && isReadOnlyCall(String(toolCall.title ?? ""), toolCall.rawInput)) {
      void bridge.permission({ requestId: String(event.requestId), optionId: allowOnce.optionId });
      return;
    }
    const bar = el("div", { class: "agent-mode-permission", dataset: { testid: "agent-mode-permission" } });
    const answer = (optionId: string | null, label: string): void => {
      void bridge.permission({ requestId: String(event.requestId), optionId });
      bar.remove();
      bubble("system", `승인: ${readableTool(String(toolCall.title ?? ""), toolCall.rawInput)} → ${label}`);
    };
    bar.append(
      el("div", { class: "agent-mode-permission-title", text: `⚠ 승인 필요: ${readableTool(String(toolCall.title ?? ""), toolCall.rawInput)}` }),
      el("div", { class: "agent-mode-permission-actions", children: options.map((option) => el("button", {
        class: `agent-mode-btn ${option.kind.startsWith("allow") ? "primary" : "danger"}`,
        text: OPTION_TEXT[option.kind] ?? option.name,
        attrs: { type: "button" },
        dataset: { testid: `agent-mode-permission-${option.kind}` },
        on: { click: () => answer(option.optionId, OPTION_TEXT[option.kind] ?? option.name) },
      })) }),
    );
    permissions.append(bar);
  };

  const onToolRequest = (event: AgentEvent): void => {
    const requestId = String(event.requestId);
    toolQueue = toolQueue.then(async () => {
      let result: unknown;
      try {
        result = event.kind === "list"
          ? listAgentModeTools()
          : await callAgentModeTool(String(event.name ?? ""), event.args, turn);
      } catch (error) {
        result = { text: error instanceof Error ? error.message : String(error), isError: true };
      }
      if (turn?.recorded) refreshButtons();
      await bridge.toolResult({ requestId, result });
    });
  };

  const handle = (event: AgentEvent): void => {
    switch (event.type) {
      case "update": onUpdate(event.update as Record<string, unknown>); break;
      case "permission": onPermission(event); break;
      case "tool-request": onToolRequest(event); break;
      case "turn-start": busy = true; turn = newAgentTurn(String(event.prompt ?? "")); cards.clear(); break;
      case "turn-end": {
        busy = false;
        currentText = null;
        const reason = String(event.stopReason ?? "");
        for (const open of cards.values()) {
          if (!/is-(pending|in_progress)/u.test(open.root.className)) continue;
          open.root.className = "agent-mode-card is-failed";
          open.status.textContent = reason === "cancelled" ? "중지됨" : "끝나지 않음";
        }
        if (reason === "cancelled") bubble("system", "중지했습니다.");
        else if (reason === "error") bubble("system", `오류: ${String(event.error ?? "")}`);
        permissions.replaceChildren();
        break;
      }
      case "status": {
        const state = String(event.state ?? "");
        if (state === "ready") { connected = true; statusLine.textContent = `${String(event.detail ?? "")} 연결됨`; }
        else if (state === "starting") statusLine.textContent = `${String(event.detail ?? "")} 시작하는 중…`;
        else if (state === "busy") statusLine.textContent = "작업 중…";
        else if (state === "idle") statusLine.textContent = "대기 중";
        else if (state === "stopped" || state === "error") {
          connected = false;
          busy = false;
          statusLine.textContent = String(event.detail ?? (state === "error" ? "오류" : "연결 끊김"));
        }
        break;
      }
      default: break;
    }
    refreshButtons();
  };

  const pollLoop = async (): Promise<void> => {
    while (!disposed) {
      try {
        const result = await bridge.poll({ after, waitMs: 20_000 }) as { events: AgentEvent[]; seq: number };
        if (disposed) return;
        for (const event of result.events) {
          after = Math.max(after, event.seq);
          handle(event);
        }
        if (result.seq < after) after = result.seq;
      } catch (error) {
        statusLine.textContent = `에이전트 호스트와 연결이 끊겼습니다: ${error instanceof Error ? error.message : String(error)}`;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  };

  connectButton.addEventListener("click", () => {
    connectButton.disabled = true;
    statusLine.textContent = "시작하는 중…";
    void bridge.start({ agent: agentSelect.value }).then(
      () => { connected = true; },
      (error: unknown) => { statusLine.textContent = error instanceof Error ? error.message : String(error); },
    ).finally(() => { connectButton.disabled = false; refreshButtons(); });
  });
  const send = (): void => {
    const text = input.value.trim();
    if (!text || !connected || busy) return;
    bubble("user", text);
    input.value = "";
    busy = true;
    refreshButtons();
    void bridge.prompt({ text }).catch((error: unknown) => { busy = false; bubble("system", error instanceof Error ? error.message : String(error)); refreshButtons(); });
  };
  sendButton.addEventListener("click", send);
  input.addEventListener("input", refreshButtons);
  input.addEventListener("keydown", (event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); send(); } });
  stopButton.addEventListener("click", () => { void bridge.cancel(); statusLine.textContent = "중지하는 중…"; });
  undoButton.addEventListener("click", () => {
    if (!turn?.recorded) return;
    if (undoMapEdit()) { bubble("system", `되돌렸습니다: ${turn.label}`); turn.recorded = false; }
    refreshButtons();
  });

  const root = el("section", {
    class: "agent-mode-panel",
    attrs: { "aria-label": "에이전트 모드 (실험)" },
    dataset: { testid: "agent-mode-panel" },
    children: [
      el("div", { class: "agent-mode-top", children: [
        el("div", { class: "agent-mode-row", children: [agentSelect, connectButton] }),
        statusLine,
        el("details", { class: "agent-mode-avail-wrap", children: [el("summary", { text: "이 PC 의 에이전트" }), availability] }),
      ] }),
      plan,
      log,
      permissions,
      el("div", { class: "agent-mode-composer", children: [input, el("div", { class: "agent-mode-row", children: [sendButton, stopButton, undoButton] })] }),
    ],
  });

  void bridge.detect().then((value) => {
    const detected = value as { agents: Availability[]; state: { running: boolean; busy: boolean; seq: number } };
    renderAvailability(detected.agents);
    if (detected.state.running) { connected = true; statusLine.textContent = "연결됨"; }
    after = 0;
    void pollLoop();
    refreshButtons();
  }, (error: unknown) => { statusLine.textContent = `에이전트를 찾지 못했습니다: ${error instanceof Error ? error.message : String(error)}`; });
  refreshButtons();
  return { root, dispose: () => { disposed = true; } };
}
