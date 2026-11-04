// 완성 뒤 윤문 고리 + 뜻 보존 관문: 진짜 Agent 루프·레지스트리, 대본을 따르는 가짜 모델(네트워크 없음).
// 모델이 윤문 차례에 나쁜 편집(숫자를 바꿈) 하나와 좋은 편집(줄표만 뺌) 하나를 내면, 나쁜 것은 쓰이지 않고
// 모델은 도구 결과에서 거절 이유를 받으며, 보고에 닻별 거절 수가 남아야 한다.
import { describe, expect, it } from "bun:test";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { runPiAgent } from "../scripts/lib/piAgentRuntime.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { collectDialogueLines } from "../src/editor/dialogue/dialogueIndex.ts";
import type { PiAgentEvent } from "../src/ai/piAgent/protocol.ts";

const BAD = "늑대 세 마리를 잡아 와라 — 서둘러.";
const GOOD = "북쪽 다리를 건너라 — 해가 지기 전에.";
const FILLER = ["어서 오게.", "바람이 차구나.", "오늘은 장이 섰지.", "배가 들어왔어.", "등불을 켜 두게.", "길이 미끄럽네.", "생선이 싱싱해.", "종이 울렸다.", "잘 자게.", "또 오게나."];

type Call = { name: string; arguments: Record<string, unknown> };
const text = (content: unknown) => typeof content === "string" ? content
  : Array.isArray(content) ? content.map((part: { text?: string }) => part.text ?? "").join("") : "";

describe("완성 뒤 윤문 고리의 뜻 보존 관문", () => {
  it("숫자를 바꾼 편집은 거절하고 이유를 모델에 주며, 말투만 고친 편집은 쓴다", async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    let calls = 0, polishStep = 0, sawGuardNote = false;
    const streamFn = (_model: unknown, context: { messages: { role: string; content: unknown }[] }) => {
      calls++;
      const polishPrompt = context.messages.map((message) => text(message.content)).find((body) => body.startsWith("[완성 뒤 대사 윤문"));
      if (context.messages.some((message) => text(message.content).includes("뜻 보존 관문이"))) sawGuardNote = true;
      let call: Call | undefined;
      if (calls === 1) {
        call = { name: "upsert_event", arguments: { mapId, event: { id: "ev_hunter", name: "사냥꾼", x: 2, y: 2, commands: [], pages: [{
          trigger: { kind: "action" }, graphic: { transparent: true },
          commands: [BAD, GOOD, ...FILLER].map((body) => ({ kind: "text", speaker: "사냥꾼", body })),
        }] } } };
      } else if (polishPrompt) {
        polishStep++;
        const rows = [...polishPrompt.matchAll(/- id:(\S+) hash:(\S+)[^\n]*\n  글: ("[^\n]*")/gu)].map((m) => ({ id: m[1]!, hash: m[2]!, body: JSON.parse(m[3]!) as string }));
        const pick = (body: string) => { const row = rows.find((entry) => entry.body === body)!; return { id: row.id, hash: row.hash }; };
        if (polishStep === 1) call = { name: "read_assistant_skill", arguments: { id: "dialogue-polish" } };
        else if (polishStep === 2) call = { name: "get_dialogue_context", arguments: { id: rows[0]!.id } };
        else if (polishStep === 3) call = { name: "rewrite_dialogue", arguments: { mode: "apply", edits: [
          { ...pick(BAD), text: "늑대 네 마리를 잡아 와라. 서둘러." },
          { ...pick(GOOD), text: "북쪽 다리를 건너라. 해가 지기 전에." },
        ] } };
      }
      const stream = createAssistantMessageEventStream();
      queueMicrotask(() => {
        const message = {
          role: "assistant", api: "gemini", provider: "google-antigravity", model: "scripted",
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 }, timestamp: Date.now(),
          content: call ? [{ type: "toolCall", id: `c${calls}`, ...call }] : [{ type: "text", text: "보고" }],
          stopReason: call ? "toolUse" : "stop",
        };
        stream.push({ type: "start", partial: message } as never);
        if (call) stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: message.content[0], partial: message } as never);
        stream.push({ type: "done", reason: message.stopReason, message } as never);
      });
      return stream;
    };
    const events: PiAgentEvent[] = [];
    const done = await runPiAgent({
      provider: "google-antigravity", task: "항구 사냥꾼 대사를 열두 줄 써 줘", mapIds: [mapId], project,
      applyMode: "default", initialToolNames: ["upsert_event"], maxTurns: 20,
    }, { streamFn: streamFn as never, onEvent: (event) => events.push(event) });

    const guard = done.dialoguePolish?.meaningGuard;
    expect(done.dialoguePolish?.ran, JSON.stringify(done.dialoguePolish)).toBe(true);
    expect(polishStep).toBeGreaterThanOrEqual(3);
    expect(guard?.rejected).toBe(1);
    expect(guard?.passed).toBe(1);
    expect(guard?.byKind.number).toBe(1);
    expect(guard?.examples[0]?.before).toBe(BAD);
    expect(sawGuardNote).toBe(true);
    const texts = collectDialogueLines(done.project).filter((line) => line.speaker === "사냥꾼").map((line) => line.text);
    expect(texts).toContain(BAD);
    expect(texts).toContain("북쪽 다리를 건너라. 해가 지기 전에.");
    expect(events.some((event) => event.type === "execution_status" && event.name === "dialogue_polish.meaning_guard")).toBe(true);
  }, 120_000);
});
