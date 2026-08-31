// test/preferenceDistiller.test.ts
// 증류 계약. 이 단계는 fire-and-forget 경로에서 불리므로 **어떤 실패도 throw 하지 않아야** 한다.
// 파싱 실패가 조용히 무변경으로 끝나는지, 고정 항목이 drop 을 면제받는지, 연속 실패가 큐를
// 막지 않는지가 핵심이다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";
import {
  buildDistillUserPayload,
  DISTILL_SYSTEM_PROMPT,
  distillPreferences,
  formatCountersForDistill,
  formatPendingForDistill,
  parseDistillResponse,
} from "@/ai/preferenceDistiller";
import { loadPreferenceFacts, savePreferenceFacts, type PreferenceFact } from "@/ai/preferenceMemory";
import {
  DISTILL_FAILURE_LIMIT,
  loadPreferenceSignals,
  savePreferenceSignals,
  UNDO_WEIGHT,
  type PendingPreferenceSignal,
  type PreferenceSignalState,
} from "@/ai/preferenceSignals";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

const CONFIG: AiConfig = {
  authMode: "chatgpt",
  baseUrl: "https://example.invalid/v1",
  model: "test-model",
  apiKey: "",
  maxToolCalls: 8,
  maxTokens: 4096,
};

function undoSignal(index: number): PendingPreferenceSignal {
  return { at: index, kind: "undo", instruction: `마을을 크게 만들어 줘 ${index}`, toolNames: ["author_house"], weight: UNDO_WEIGHT };
}

function statedSignal(): PendingPreferenceSignal {
  return { at: 1, kind: "stated", instruction: "항상 마을은 작게 만들어 줘", note: "항상 마을은 작게 만들어 줘", toolNames: [], weight: 0 };
}

function seedSignals(pending: readonly PendingPreferenceSignal[], extra: Partial<PreferenceSignalState> = {}): void {
  savePreferenceSignals({
    counters: { "tool:author_house": { pos: 1, neg: 6, at: 10 }, "scale:large": { pos: 0, neg: 6, at: 10 } },
    pending: [...pending],
    lastTurn: null,
    distillFailures: 0,
    ...extra,
  });
}

function chatReturning(content: string): (config: AiConfig, req: ChatRequest) => Promise<ChatResult> {
  return () => Promise.resolve({ message: { role: "assistant", content } } as ChatResult);
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: createMemoryStorage(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("시스템 프롬프트", () => {
  it("JSON 전용과 형식·상한을 명시한다", () => {
    expect(DISTILL_SYSTEM_PROMPT).toContain("JSON 객체 하나");
    expect(DISTILL_SYSTEM_PROMPT).toContain("\"upsert\"");
    expect(DISTILL_SYSTEM_PROMPT).toContain("\"drop\"");
    expect(DISTILL_SYSTEM_PROMPT).toContain("최대 3건");
    // 통계 문장이 성향으로 새어 나가면 프롬프트가 숫자만 늘고 행동이 안 바뀐다.
    expect(DISTILL_SYSTEM_PROMPT).toContain("툴 이름·횟수는 text 에 넣지 않습니다");
  });
});

describe("입력 조립", () => {
  it("집계는 부정 우세 순으로 보여 준다", () => {
    const state: PreferenceSignalState = {
      counters: {
        "tool:a": { pos: 5, neg: 0, at: 1 },
        "tool:b": { pos: 0, neg: 7, at: 2 },
        "tool:zero": { pos: 0, neg: 0, at: 3 },
      },
      pending: [],
      lastTurn: null,
      distillFailures: 0,
    };
    const formatted = formatCountersForDistill(state);
    expect(formatted.indexOf("tool:b")).toBeLessThan(formatted.indexOf("tool:a"));
    // 아무 신호도 없는 축은 토큰만 먹는다.
    expect(formatted).not.toContain("tool:zero");
  });

  it("집계가 없으면 없다고 말한다", () => {
    expect(formatCountersForDistill({ counters: {}, pending: [], lastTurn: null, distillFailures: 0 })).toBe("(집계 없음)");
  });

  it("신호 원문에 종류 라벨과 반응이 함께 실린다", () => {
    const formatted = formatPendingForDistill({
      counters: {},
      pending: [statedSignal(), { at: 2, kind: "correction", instruction: "크게 만들어 줘", note: "아니 너무 크다", toolNames: [], weight: -2 }],
      lastTurn: null,
      distillFailures: 0,
    });
    expect(formatted).toContain("[사용자 선언]");
    expect(formatted).toContain("[정정]");
    expect(formatted).toContain("반응: 아니 너무 크다");
  });

  it("이미 기억된 성향을 id 와 함께 넘긴다 — 그래야 모델이 drop 대상을 지목할 수 있다", () => {
    savePreferenceFacts([
      {
        id: "pref-1",
        text: "마을은 크게 만든다",
        scope: "global",
        strength: "medium",
        evidence: 2,
        source: "observed",
        updatedAt: 1,
      },
      {
        id: "pref-other",
        text: "남의 프로젝트 사실",
        scope: "project",
        projectScopeKey: "local:B::m1",
        strength: "weak",
        evidence: 1,
        source: "observed",
        updatedAt: 1,
      },
    ]);
    const payload = buildDistillUserPayload(
      { counters: {}, pending: [undoSignal(1)], lastTurn: null, distillFailures: 0 },
      "local:A::m1",
    );
    expect(payload).toContain("pref-1");
    expect(payload).not.toContain("pref-other");
  });
});

describe("응답 파싱", () => {
  it("맨 JSON 을 읽는다", () => {
    const parsed = parseDistillResponse('{"upsert":[{"text":"작게","scope":"global","strength":"strong"}],"drop":["x"]}');
    expect(parsed).toEqual({ upsert: [{ text: "작게", scope: "global", strength: "strong" }], drop: ["x"] });
  });

  it("코드펜스가 섞여도 건져낸다", () => {
    const parsed = parseDistillResponse("설명\n```json\n{\"upsert\":[],\"drop\":[]}\n```\n끝");
    expect(parsed).toEqual({ upsert: [], drop: [] });
  });

  it("upsert 는 3건으로 자른다", () => {
    const many = JSON.stringify({
      upsert: Array.from({ length: 6 }, (_, index) => ({ text: `성향 ${index}`, scope: "global", strength: "weak" })),
    });
    expect(parseDistillResponse(many)?.upsert).toHaveLength(3);
  });

  it("모양이 어긋난 항목과 값은 걸러지거나 안전한 기본으로 떨어진다", () => {
    const parsed = parseDistillResponse(
      JSON.stringify({ upsert: [{ text: "  " }, null, { text: "좋음", scope: "nope", strength: "nope" }], drop: ["ok", 5, ""] }),
    );
    expect(parsed?.upsert).toEqual([{ text: "좋음", scope: "global", strength: "weak" }]);
    expect(parsed?.drop).toEqual(["ok"]);
  });

  it("JSON 이 아니면 null", () => {
    expect(parseDistillResponse("성향을 정리했습니다.")).toBeNull();
    expect(parseDistillResponse("{깨진")).toBeNull();
    expect(parseDistillResponse("")).toBeNull();
  });
});

describe("증류 실행", () => {
  it("신호가 없으면 모델을 부르지 않는다", async () => {
    const chat = vi.fn(chatReturning("{}"));
    const result = await distillPreferences({ chat, config: CONFIG });
    expect(result).toEqual({ ok: false, upserted: 0, dropped: 0, skipped: "no-signals" });
    expect(chat).not.toHaveBeenCalled();
  });

  it("트리거 조건 미달이면 건너뛴다", async () => {
    seedSignals([undoSignal(1), undoSignal(2)]);
    const chat = vi.fn(chatReturning("{}"));
    const result = await distillPreferences({ chat, config: CONFIG });
    expect(result.skipped).toBe("not-due");
    expect(chat).not.toHaveBeenCalled();
  });

  it("force 는 조건을 무시한다", async () => {
    seedSignals([undoSignal(1)]);
    const chat = vi.fn(chatReturning('{"upsert":[],"drop":[]}'));
    const result = await distillPreferences({ chat, config: CONFIG, force: true });
    expect(result.ok).toBe(true);
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("명시 선언 1건이면 즉시 돌고 성향을 저장한다", async () => {
    seedSignals([statedSignal()]);
    const chat = vi.fn(chatReturning('{"upsert":[{"text":"마을은 집 4채 이하로 작게 유지한다","scope":"global","strength":"strong"}],"drop":[]}'));
    const result = await distillPreferences({ chat, config: CONFIG });
    expect(result).toEqual({ ok: true, upserted: 1, dropped: 0 });
    const facts = loadPreferenceFacts();
    expect(facts).toHaveLength(1);
    expect(facts[0].text).toBe("마을은 집 4채 이하로 작게 유지한다");
    expect(facts[0].strength).toBe("strong");
    // 소비한 신호는 비워져 같은 신호로 두 번 증류하지 않는다.
    expect(loadPreferenceSignals().pending).toEqual([]);
  });

  it("JSON 전용 요청 형식으로 부른다", async () => {
    seedSignals([statedSignal()]);
    const chat = vi.fn(chatReturning('{"upsert":[],"drop":[]}'));
    await distillPreferences({ chat, config: CONFIG });
    const [config, request] = chat.mock.calls[0];
    expect(config).toBe(CONFIG);
    expect(request.response_format).toEqual({ type: "json_object" });
    expect(request.messages[0]).toEqual({ role: "system", content: DISTILL_SYSTEM_PROMPT });
    expect(request.messages[1].role).toBe("user");
  });

  it("고정된 성향은 drop 에서 무시된다", async () => {
    const pinned: PreferenceFact = {
      id: "pinned-1",
      text: "사용자가 고정한 성향",
      scope: "global",
      strength: "strong",
      evidence: 3,
      source: "manual",
      updatedAt: 1,
      pinned: true,
    };
    const loose: PreferenceFact = { ...pinned, id: "loose-1", text: "관측 성향", source: "observed", pinned: false };
    savePreferenceFacts([pinned, loose]);
    seedSignals([statedSignal()]);
    const chat = chatReturning('{"upsert":[],"drop":["pinned-1","loose-1"]}');
    const result = await distillPreferences({ chat, config: CONFIG });
    expect(result.dropped).toBe(1);
    expect(loadPreferenceFacts().map((fact) => fact.id)).toEqual(["pinned-1"]);
  });

  it("프로젝트 스코프인데 조회 키를 모르면 전역으로 내린다", async () => {
    seedSignals([statedSignal()]);
    const chat = chatReturning('{"upsert":[{"text":"이 게임은 호러다","scope":"project","strength":"strong"}],"drop":[]}');
    await distillPreferences({ chat, config: CONFIG });
    const facts = loadPreferenceFacts();
    expect(facts).toHaveLength(1);
    expect(facts[0].scope).toBe("global");
  });

  it("조회 키가 있으면 프로젝트 성향으로 저장한다", async () => {
    seedSignals([statedSignal()]);
    const chat = chatReturning('{"upsert":[{"text":"이 게임은 호러다","scope":"project","strength":"strong"}],"drop":[]}');
    await distillPreferences({ chat, config: CONFIG, projectScopeKey: "local:A::m1" });
    const facts = loadPreferenceFacts();
    expect(facts[0].scope).toBe("project");
    expect(facts[0].projectScopeKey).toBe("local:A::m1");
  });

  it("파싱 실패는 던지지 않고 무변경으로 끝난다", async () => {
    seedSignals([statedSignal()]);
    const chat = chatReturning("성향을 정리했습니다.");
    const result = await distillPreferences({ chat, config: CONFIG });
    expect(result).toEqual({ ok: false, upserted: 0, dropped: 0 });
    expect(loadPreferenceFacts()).toEqual([]);
    // 신호는 남는다 — 다음 턴에 다시 시도한다.
    expect(loadPreferenceSignals().pending).toHaveLength(1);
    expect(loadPreferenceSignals().distillFailures).toBe(1);
  });

  it("전송 실패도 던지지 않는다", async () => {
    seedSignals([statedSignal()]);
    const chat = () => Promise.reject(new Error("network down"));
    await expect(distillPreferences({ chat, config: CONFIG })).resolves.toEqual({ ok: false, upserted: 0, dropped: 0 });
    expect(loadPreferenceSignals().distillFailures).toBe(1);
  });

  it("연속 실패가 상한에 닿으면 pending 을 잘라 큐를 뚫는다", async () => {
    seedSignals([statedSignal(), undoSignal(1), undoSignal(2), undoSignal(3)]);
    const chat = chatReturning("JSON 아님");
    for (let attempt = 0; attempt < DISTILL_FAILURE_LIMIT; attempt += 1) {
      await distillPreferences({ chat, config: CONFIG });
    }
    const loaded = loadPreferenceSignals();
    expect(loaded.pending).toHaveLength(2);
    expect(loaded.distillFailures).toBe(0);
  });

  it("빈 결과도 성공이다 — \"만들 것 없음\"이 정상 판단이므로 신호를 비운다", async () => {
    seedSignals([statedSignal()]);
    const chat = chatReturning('{"upsert":[],"drop":[]}');
    const result = await distillPreferences({ chat, config: CONFIG });
    expect(result).toEqual({ ok: true, upserted: 0, dropped: 0 });
    expect(loadPreferenceSignals().pending).toEqual([]);
  });

  it("멀티모달 응답(비문자열 content)은 파싱 실패로 처리된다", async () => {
    seedSignals([statedSignal()]);
    const chat = () =>
      Promise.resolve({ message: { role: "assistant", content: [{ type: "text", text: "{}" }] } } as unknown as ChatResult);
    const result = await distillPreferences({ chat, config: CONFIG });
    expect(result.ok).toBe(false);
  });
});
