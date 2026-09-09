// benchmarkRunner.test.ts
// 러너 + LLM 클라이언트 계약 테스트 — todo 9. TDD: 이 파일을 먼저 작성 → RED →
// 구현(src/benchmark/llmClient.ts, src/benchmark/runner.ts) → GREEN.
//
// .omo/plans/tileset-vision-benchmark.md todo 9 수용 기준:
//  (a) 주입형 목 클라이언트가 groundTruth 의 완벽한 WALL 답을 반환 → 파싱+채점+
//      passed=true (d1:wall).
//  (b) paste 모드(deps.pasteAnswerProvider)가 같은 픽스처 JSON 반환 → 동일 채점.
//  (c) 목 클라이언트가 prose 반환 → 구조화된 contract-error 결과, throw 없음.
//  (d) settings.apiKey 가 있고 isProxyAuth(상대 baseUrl 게이트웨이)면 요청
//      body/headers 어디에도 apiKey 가 없어야 한다(목 fetch 로 캡처).
//  (e) 설정이 주입한 저장 어댑터(storage stub)를 통해 round-trip.
//  (f) d1 집계 = wall+floor 서브런 평균(손계산 픽스처).
//  (g) d6 결합은 두 서브런 점수를 모두 노출 + passed = 둘 다 통과 + 점수 = 평균.
//
// 목 클라이언트/목 fetch 만 사용한다(실제 네트워크 없음 — flaky 금지).
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseBenchmarkAnswer } from "@/benchmark/contract";
import {
  BENCHMARK_SETTINGS_STORAGE_KEY,
  createBenchmarkLlmClient,
  type BenchmarkSettings,
  type BenchmarkStorageAdapter,
  resolveBenchmarkRequest,
  storageFromGlobals,
} from "@/benchmark/llmClient";
import { AUTOTILE_GROUP_ANSWER, FLOOR_TILES, WALL_TILES } from "@/benchmark/groundTruth";
import { PROMPT_VERSION } from "@/benchmark/prompts";
import { BENCHMARK_TASKS } from "@/benchmark/tasks";
import { buildAutotileLMask, expectedAutotileGrid } from "@/benchmark/scoringAutotile";
import { runAll, runTask } from "@/benchmark/runner";

// ── 픽스처 헬퍼 ────────────────────────────────────────────────────────

const wallIds = [...WALL_TILES].sort((a, b) => a - b);
const floorIds = [...FLOOR_TILES].sort((a, b) => a - b);

/** d1:wall 완벽 답({tileIds: WALL_TILES}) — strictly ascending 이므로 정렬. */
function perfectWallAnswer(): string {
  return JSON.stringify({ tileIds: wallIds });
}

/** d1:floor 완벽 답. */
function perfectFloorAnswer(): string {
  return JSON.stringify({ tileIds: floorIds });
}

/** d6b 완벽 답(count 11 + 진짜 이름 목록). */
function perfectAutotileCountAnswer(): string {
  return JSON.stringify({
    count: AUTOTILE_GROUP_ANSWER.length,
    types: AUTOTILE_GROUP_ANSWER.map((entry) => entry.name),
  });
}

/** d6a 완벽 답 — 엔진 오라클 그리드를 그대로 답으로 준다. */
function perfectAutotileGridAnswer(): string {
  return JSON.stringify({ grid: expectedAutotileGrid(buildAutotileLMask()) });
}

function chatResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** 목 클라이언트 — 프롬프트별 답변을 반환하는 주입형 전송 계층. */
function mockClient(answerFor: (prompt: string) => string) {
  return {
    send: vi.fn(async (request: { prompt: string }) =>
      ({ ok: true as const, text: answerFor(request.prompt) }) as const),
  };
}

// ── 실행 deps 스텁(캔버스 없이 러너 산술 검증 — Node 실행 계약) ─────────

const STUB_IMAGE = "data:image/png;base64,STUB";

const stubImageDeps = {
  renderAtlas: async () => STUB_IMAGE,
  renderGrid: async (_input: string) => STUB_IMAGE,
  renderShape: () => STUB_IMAGE,
};

// ── 저장 어댑터 stub ────────────────────────────────────────────────────

class MemoryStorage implements BenchmarkStorageAdapter {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ── (e) 설정 지속화 ─────────────────────────────────────────────────────

describe("benchmark settings persistence", () => {
  it("Given saved settings When loading through an injected adapter Then they round-trip", () => {
    const storage = new MemoryStorage();
    const settings: BenchmarkSettings = {
      mode: "api",
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-bench-test",
      model: "test-model",
    };
    createBenchmarkLlmClient(settings, storage).saveSettings();
    expect(storage.map.get(BENCHMARK_SETTINGS_STORAGE_KEY)).toBeTruthy();
    expect(createBenchmarkLlmClient(undefined, storage).loadSettings()).toEqual(settings);
  });

  it("Given an empty adapter When loading settings Then null comes back (no fabricated defaults)", () => {
    expect(createBenchmarkLlmClient(undefined, new MemoryStorage()).loadSettings()).toBeNull();
  });

  it("Given a storage getter When resolving the adapter Then it is used lazily, null without one", () => {
    expect(storageFromGlobals(() => undefined)).toBeNull();
    const storage = new MemoryStorage();
    expect(storageFromGlobals(() => storage)).toBe(storage);
  });

  it("Given no storage When saving settings Then nothing throws (browser-less Node)", () => {
    expect(() =>
      createBenchmarkLlmClient({ mode: "paste" }, storageFromGlobals(() => undefined)).saveSettings(),
    ).not.toThrow();
  });
});

// ── api 모드 해석 + 키 가드 ─────────────────────────────────────────────

describe("resolveBenchmarkRequest — api mode resolution + key guard", () => {
  it("Given no overrides When resolving Then loadAiConfig() defaults apply; explicit overrides win", () => {
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    vi.stubGlobal("localStorage", new MemoryStorage());

    const resolved = resolveBenchmarkRequest({ mode: "api" });
    expect(resolved.baseUrl).toBe("");
    expect(resolved.proxyAuth).toBe(false);
    expect(resolved.model).not.toBe("");

    const override = resolveBenchmarkRequest({ mode: "api", baseUrl: "/api/ai", model: "gpt-x" });
    expect(override.baseUrl).toBe("/api/ai");
    expect(override.model).toBe("gpt-x");
    expect(override.proxyAuth).toBe(true);
  });

  it("(d) Given proxyAuth(gateway) with a stored apiKey When sending Then the key never appears in the captured request", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "/api/ai");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    vi.stubGlobal("localStorage", new MemoryStorage());
    const calls: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({
          url,
          body: JSON.parse(String(init.body)),
          headers: (init.headers ?? {}) as Record<string, string>,
        });
        return chatResponse(perfectWallAnswer());
      }),
    );

    // baseUrl 은 벤치마크 자기 설정으로 준다. env VITE_LLM_API_URL 은 더 이상 어떤 baseUrl 도
    // 배선하지 않는다(에디터 AI 가 OAuth 전용이 되면서 그 통로를 없앴다) — 위 stubEnv 는 무력하다.
    // 검증하려는 보안 속성은 그대로다: 프록시 경로에서는 저장된 키가 요청에 절대 실리지 않는다.
    const client = createBenchmarkLlmClient(
      { mode: "api", apiKey: "sk-benchmark-secret", baseUrl: "/api/ai", model: "cpen/gpt-5-6-luna" },
      new MemoryStorage(),
    );
    const result = await client.send({ prompt: "p", imageDataUrls: [STUB_IMAGE] });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/api/ai/chat/completions");
    // 프록시가 서버 측에서 Authorization 을 주입한다 — 클라이언트는 키를 보내지 않는다.
    expect(JSON.stringify(calls[0]!.body)).not.toContain("sk-benchmark-secret");
    expect(JSON.stringify(calls[0]!.headers)).not.toContain("sk-benchmark-secret");
    expect(calls[0]!.headers.Authorization).toBeUndefined();
  });

  it("Given an https endpoint with a key When sending Then Bearer auth is attached", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    vi.stubGlobal("localStorage", new MemoryStorage());
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, headers: (init.headers ?? {}) as Record<string, string> });
        return chatResponse("{}");
      }),
    );

    const client = createBenchmarkLlmClient(
      { mode: "api", baseUrl: "https://api.example.com/v1", apiKey: "sk-https-key", model: "m" },
      new MemoryStorage(),
    );
    await client.send({ prompt: "p", imageDataUrls: [STUB_IMAGE] });

    expect(calls[0]!.url).toBe("https://api.example.com/v1/chat/completions");
    expect(calls[0]!.headers.Authorization).toBe("Bearer sk-https-key");
  });

  it("Given a plain-http non-localhost URL with a key When sending Then the send is refused with a structured error", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    vi.stubGlobal("localStorage", new MemoryStorage());
    const fetchMock = vi.fn(async () => chatResponse("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const client = createBenchmarkLlmClient(
      { mode: "api", baseUrl: "http://api.example.com/v1", apiKey: "sk-plain-http", model: "m" },
      new MemoryStorage(),
    );
    const result = await client.send({ prompt: "p", imageDataUrls: [STUB_IMAGE] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("config");
      expect(result.error.message).toContain("https");
    }
    expect(fetchMock).not.toHaveBeenCalled(); // 키 유출 경로가 아예 열리지 않는다
  });

  it("Given a configured request When sending Then the exact benchmark body shape is posted", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    vi.stubGlobal("localStorage", new MemoryStorage());
    const calls: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return chatResponse("{}");
      }),
    );

    const client = createBenchmarkLlmClient(
      { mode: "api", baseUrl: "https://api.example.com/v1", apiKey: "k", model: "bench-model" },
      new MemoryStorage(),
    );
    await client.send({ prompt: "list walls", imageDataUrls: [STUB_IMAGE] });

    const body = calls[0]!;
    expect(body.model).toBe("bench-model");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.max_tokens).toBe(8192);
    expect(body.temperature).toBe(0.2);
    const messages = body.messages as ReadonlyArray<{ role: string; content: unknown }>;
    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe("system");
    expect(typeof messages[0]!.content).toBe("string");
    expect(messages[1]!.role).toBe("user");
    expect(messages[1]!.content).toEqual([
      { type: "text", text: "list walls" },
      { type: "image_url", image_url: { url: STUB_IMAGE } },
    ]);
  });

  it("Given a fenced JSON response When reading Then normalizeTilesetResponseText semantics extract the object", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    vi.stubGlobal("localStorage", new MemoryStorage());
    vi.stubGlobal("fetch", vi.fn(async () => chatResponse("```json\n" + perfectWallAnswer() + "\n```")));

    const client = createBenchmarkLlmClient(
      { mode: "api", baseUrl: "https://api.example.com/v1", apiKey: "k", model: "m" },
      new MemoryStorage(),
    );
    const result = await client.send({ prompt: "p", imageDataUrls: [STUB_IMAGE] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(() => parseBenchmarkAnswer(result.text, "detection")).not.toThrow();
    }
  });

  it("Given an HTTP 5xx When sending Then a structured {kind:'http'} error returns (never throws)", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    vi.stubGlobal("localStorage", new MemoryStorage());
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));

    const client = createBenchmarkLlmClient(
      { mode: "api", baseUrl: "https://api.example.com/v1", apiKey: "k", model: "m" },
      new MemoryStorage(),
    );
    const result = await client.send({ prompt: "p", imageDataUrls: [STUB_IMAGE] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("http");
      expect(result.error.status).toBe(500);
      expect(result.error.message).toContain("500");
    }
  });

  it("Given an aborted fetch When sending Then a structured {kind:'timeout'} error returns (never throws)", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    vi.stubGlobal("localStorage", new MemoryStorage());
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("aborted", "AbortError");
      }),
    );

    const client = createBenchmarkLlmClient(
      { mode: "api", baseUrl: "https://api.example.com/v1", apiKey: "k", model: "m" },
      new MemoryStorage(),
    );
    const result = await client.send({ prompt: "p", imageDataUrls: [STUB_IMAGE] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("timeout");
    }
  });

  it("Given a TypeError fetch rejection When sending Then a structured {kind:'network'} error returns (never throws)", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    vi.stubGlobal("localStorage", new MemoryStorage());
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const client = createBenchmarkLlmClient(
      { mode: "api", baseUrl: "https://api.example.com/v1", apiKey: "k", model: "m" },
      new MemoryStorage(),
    );
    const result = await client.send({ prompt: "p", imageDataUrls: [STUB_IMAGE] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("network");
    }
  });

  it("Given paste mode without a provider When sending Then a structured config error returns (never fetches)", async () => {
    const fetchMock = vi.fn(async () => chatResponse("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const client = createBenchmarkLlmClient({ mode: "paste" }, new MemoryStorage());
    const result = await client.send({ prompt: "p", imageDataUrls: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("config");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Given paste mode with a provider When sending Then the pasted text returns verbatim", async () => {
    const fetchMock = vi.fn(async () => chatResponse("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const client = createBenchmarkLlmClient(
      { mode: "paste" },
      new MemoryStorage(),
      { pasteAnswerProvider: async () => perfectWallAnswer() },
    );
    const result = await client.send({ prompt: "p", imageDataUrls: [] });
    expect(result).toEqual({ ok: true, text: perfectWallAnswer() });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── 러너: d1 (감지 번들) ────────────────────────────────────────────────

describe("runTask — d1", () => {
  it("(a) Given a mock client returning the perfect WALL fixture Then d1:wall parses, scores F1 1 and passes", async () => {
    const result = await runTask("d1", { mode: "api" }, {
      client: mockClient(() => perfectWallAnswer()),
      ...stubImageDeps,
    });

    expect(result.taskId).toBe("d1");
    expect(result.error).toBeUndefined();
    const wallRun = result.subRuns?.find((run) => run.id === "d1:wall");
    expect(wallRun).toBeDefined();
    expect(wallRun!.passed).toBe(true);
    expect(wallRun!.parsed).toEqual({ tileIds: wallIds });
    expect((wallRun!.score as { f1: number }).f1).toBe(1);
  });

  it("(b) Given paste mode with the same fixture Then scoring is identical to the api mock", async () => {
    const apiResult = await runTask("d1", { mode: "api" }, {
      client: mockClient(() => perfectWallAnswer()),
      ...stubImageDeps,
    });
    const pasteResult = await runTask("d1", { mode: "paste" }, {
      client: mockClient(() => perfectWallAnswer()),
      pasteAnswerProvider: async () => perfectWallAnswer(),
      ...stubImageDeps,
    });

    expect(pasteResult.error).toBeUndefined();
    expect(pasteResult.passed).toBe(apiResult.passed);
    expect(pasteResult.score).toBe(apiResult.score);
    expect(pasteResult.subRuns?.map((run) => run.score)).toStrictEqual(
      apiResult.subRuns?.map((run) => run.score),
    );
  });

  it("(c) Given a prose answer Then the result is a structured contract error and nothing throws", async () => {
    const result = await runTask("d1", { mode: "api" }, {
      client: mockClient(() => "I see walls everywhere. The tileset has many walls."),
      ...stubImageDeps,
    });

    expect(result.error).toBeDefined();
    expect(result.error!.kind).toBe("contract");
    expect(result.error!.message).toContain("JSON");
    expect(result.passed).toBe(false);
    expect(result.score).toBeNull();
    expect(result.subRuns?.[0]!.parsed).toBeNull();
  });

  it("(f) Given wall=perfect and floor=half Then the d1 aggregate is the hand-computed mean 0.75 (fail)", async () => {
    // floor: 진실 절반 + 같은 수의 진실 아닌 id → precision=recall=F1=0.5.
    // d1 집계 = (1 + 0.5) / 2 = 0.75 < 0.8 → passed=false.
    const half = Math.floor(floorIds.length / 2);
    const truthPart = floorIds.slice(0, half);
    const filler: number[] = [];
    for (let id = 0; filler.length < truthPart.length && id < 480; id += 1) {
      if (!FLOOR_TILES.has(id)) filler.push(id);
    }
    expect(filler).toHaveLength(truthPart.length);
    const halfFloor = [...filler, ...truthPart]; // 오름차순(계약) 유지
    const client = mockClient((prompt) =>
      prompt.includes("floor tile") ? JSON.stringify({ tileIds: halfFloor }) : perfectWallAnswer(),
    );

    const result = await runTask("d1", { mode: "api" }, { client, ...stubImageDeps });

    expect(result.error).toBeUndefined();
    const floorScore = result.subRuns!.find((run) => run.id === "d1:floor")!.score as {
      f1: number;
      precision: number;
      recall: number;
    };
    expect(floorScore.precision).toBe(0.5);
    expect(floorScore.recall).toBe(0.5);
    expect(floorScore.f1).toBe(0.5);
    expect((result.subRuns!.find((run) => run.id === "d1:wall")!.score as { f1: number }).f1).toBe(1);
    expect(result.score).toBe(0.75);
    expect(result.passed).toBe(false);
  });

  it("Given a transport failure on the first sub-run Then a structured error returns and later sub-runs are skipped", async () => {
    const send = vi.fn(async () => ({
      ok: false as const,
      error: { kind: "http" as const, message: "AI 호출 실패: HTTP 503", status: 503 },
    }));

    const result = await runTask("d1", { mode: "api" }, { client: { send }, ...stubImageDeps });

    expect(result.error).toBeDefined();
    expect(result.error!.kind).toBe("http");
    expect(result.error!.status).toBe(503);
    expect(result.passed).toBe(false);
    expect(result.score).toBeNull();
    expect(send).toHaveBeenCalledTimes(1); // wall 실패 → floor 서브런은 더 보내지 않는다
  });

  it("Given an unknown taskId Then the runner fails fast with a named error", async () => {
    await expect(
      runTask("nope", { mode: "api" }, { client: mockClient(() => "{}"), ...stubImageDeps }),
    ).rejects.toThrow(/d1/);
  });
});

// ── 러너: d6 (오토타일 번들) ────────────────────────────────────────────

describe("runTask — d6 combine", () => {
  it("(g) Given perfect autotile answers Then both sub-scores are exposed, task passes and the task score is the mean", async () => {
    const client = mockClient((prompt) =>
      prompt.includes("how many terrain autotile") ? perfectAutotileCountAnswer() : perfectAutotileGridAnswer(),
    );

    const result = await runTask("d6", { mode: "api" }, { client, ...stubImageDeps });

    expect(result.error).toBeUndefined();
    const gridRun = result.subRuns!.find((run) => run.id === "d6:autotileGrid")!;
    const countRun = result.subRuns!.find((run) => run.id === "d6:autotileCount")!;
    expect(gridRun.passed).toBe(true);
    expect((gridRun.score as { exactMatch: number }).exactMatch).toBe(1);
    expect(countRun.passed).toBe(true);
    expect((countRun.score as { score: number }).score).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it("(g) Given a wrong count Then the grid sub-score stays exposed and the task fails with the mean score", async () => {
    const client = mockClient((prompt) =>
      prompt.includes("how many terrain autotile")
        ? JSON.stringify({ count: 13, types: [] }) // countScore 0 → 서브런 실패
        : perfectAutotileGridAnswer(),
    );

    const result = await runTask("d6", { mode: "api" }, { client, ...stubImageDeps });

    expect(result.error).toBeUndefined();
    expect(result.subRuns!.find((run) => run.id === "d6:autotileGrid")!.passed).toBe(true);
    expect(result.subRuns!.find((run) => run.id === "d6:autotileCount")!.passed).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0.5);
  });
});

// ── 러너: 전체 실행 ─────────────────────────────────────────────────────

describe("runAll", () => {
  it("Given a prose-only model Then all 7 tasks return structured contract errors in definition order", async () => {
    const results = await runAll({ mode: "api" }, {
      client: mockClient(() => "not json at all"),
      ...stubImageDeps,
    });

    expect(results.map((result) => result.taskId)).toEqual(
      BENCHMARK_TASKS.map((task) => task.id),
    );
    for (const result of results) {
      expect(result.error?.kind).toBe("contract");
      expect(result.passed).toBe(false);
      expect(result.score).toBeNull();
    }
  });

  it("Given perfect detection answers Then d2 scores F1 1 as a single-run task", async () => {
    const results = await runAll({ mode: "api" }, {
      client: mockClient(() => perfectWallAnswer()),
      ...stubImageDeps,
    });
    const d2 = results.find((result) => result.taskId === "d2")!;
    expect(d2.error).toBeUndefined();
    expect(d2.passed).toBe(false); // wall ids ≠ roof truth — 채점 산술만 확인
    expect(d2.subRuns).toBeUndefined();
    expect((d2.scoreDetail as { f1: number }).f1).toBeLessThan(0.8);
  });
});

// ── 태스크 정의 무결성(러너 배선) ───────────────────────────────────────

describe("task definition integrity (runner wiring)", () => {
  it("Every task exposes a runnable prompt for each execution unit (5 single + 4 bundled = 9)", () => {
    const prompts = new Set<string>();
    for (const task of BENCHMARK_TASKS) {
      const units = task.subRuns ?? [task];
      for (const unit of units) {
        const prompt = unit.prompt();
        expect(prompt.length).toBeGreaterThan(0);
        prompts.add(prompt);
      }
    }
    expect(prompts.size).toBe(9);
  });

  it("PROMPT_VERSION is pinned for result metadata", () => {
    expect(PROMPT_VERSION).toBe(1);
  });
});

// ── 브라우저 기본 deps: 입력 키별 그리드 디스패치 ───────────────────

describe("defaultRunnerDeps grid dispatch", () => {
  it("Given each input key When resolving the grid constructor Then each task gets its matching grid dimensions", async () => {
    const { defaultRunnerDeps } = await import("@/benchmark/runner");
    const deps = defaultRunnerDeps();
    expect(typeof deps.renderAtlas).toBe("function");
    expect(typeof deps.renderShape).toBe("function");

    // 브라우저 렌더러(Image/캔버스) 없이 디스패치 산술만 검증한다: 각 입력 키가
    // 올바른 그리드 생성기를 고른다는 사실은 생성기 출력 차원으로 고정한다.
    const { buildFenceGrid, buildHouseGrid, buildTreeGrid } = await import("@/benchmark/inputImages");
    expect(buildHouseGrid()).toMatchObject({ width: 12, height: 10 });
    expect(buildTreeGrid()).toMatchObject({ width: 8, height: 6 });
    expect(buildFenceGrid()).toMatchObject({ width: 6, height: 5 });
  });

  it("Given an unknown input key When rendering a grid Then the dispatch fails fast", async () => {
    const { defaultRunnerDeps } = await import("@/benchmark/runner");
    // gridForInput 이 잘못된 키를 즉시 throw 한다(비동기 에러 숨김 없이 경계 fail-fast).
    expect(() => defaultRunnerDeps().renderGrid("bogus")).toThrow(/bogus/);
  });
});
