import { describe, expect, it, afterEach, vi } from "vitest";
import { Readable } from "node:stream";
import { piRequestBody } from "../src/ai/piAgent/requestBody";
import { readRequestJson } from "../scripts/lib/companionHttpUtil.mjs";
import { claimAssignment, createTeamAssignmentLedger, recordTeamReview, runningAssignments, settleAssignment, teamAssignmentBudget, type TeamAssignmentLedger } from "@/ai/piAgent/teamAssignments";
import { isolateTimers } from "./mergedTeardown";
import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import { resetHeavyWireForTests } from "@/ai/piAgent/heavyWire";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { createBlankProject } from "@/project/defaults";

describe("piAgent", () => {
  isolateTimers();
  describe("piAgentRequestBody", () => {
    isolateTimers();
    async function decode(value: unknown) {
      const wire = await piRequestBody(value);
      const request = Object.assign(Readable.from([Buffer.from(wire.body as ArrayBuffer)]), {
        method: "POST", headers: { "content-encoding": new Headers(wire.headers).get("Content-Encoding") ?? "identity" },
      });
      return { wire, value: await readRequestJson(request) };
    }
    describe("Pi project request transport", () => {
      it("preserves embedded references and checkpoint fields through gzip", async () => {
        const project = { tilesets: { pack: { image: "data:image/png;base64," + "a".repeat(1024 * 1024) } } };
        for (const payload of [{ project, task: "author" }, { project, checkpointId: "step1", ok: true }]) {
          const result = await decode(payload);
          expect(new Headers(result.wire.headers).get("Content-Encoding")).toBe("gzip");
          expect(result.value).toEqual(payload);
        }
      });

      it("keeps small requests compatible and honors cancellation", async () => {
        const small = await piRequestBody({ checkpointId: "1", ok: false });
        expect(typeof small.body).toBe("string");
        expect(new Headers(small.headers).has("Content-Encoding")).toBe(false);
        const controller = new AbortController();
        controller.abort();
        await expect(piRequestBody({}, controller.signal)).rejects.toThrow();
      });

      it("rejects damaged gzip instead of silently replacing the project", async () => {
        const request = Object.assign(Readable.from([Buffer.from("not gzip")]), {
          method: "POST", headers: { "content-encoding": "gzip" },
        });
        await expect(readRequestJson(request)).rejects.toThrow();
      });

      // 2026-09-28 실측: 새 빈 프로젝트 첫 Pi 요청이 gzip 69MB 였고 옛 64MiB 상한이 매번 끊었다.
      it("accepts a compressed body above the old 64MiB cap", async () => {
        const chunk = Buffer.alloc(1024 * 1024, 0x20);
        const chunks = Array.from({ length: 70 }, () => chunk);
        const request = Object.assign(Readable.from([...chunks, Buffer.from("{}")]), { method: "POST", headers: {} });
        await expect(readRequestJson(request)).resolves.toEqual({});
      });
    });
  });
  describe("piAgentTeamAssignments", () => {
    isolateTimers();
    function ledgerFor(builderCount: number): TeamAssignmentLedger {
      return createTeamAssignmentLedger(teamAssignmentBudget(builderCount));
    }
    /** 성공을 전제로 배정하고 원장을 잇는다. 실패하면 테스트를 세운다. */
    function claim(ledger: TeamAssignmentLedger, mapId: string, agentId: string, memberId: string): TeamAssignmentLedger {
      const result = claimAssignment(ledger, { mapId, agentId, memberId });
      if (!result.ok) throw new Error(`배정이 거절됐다: ${result.reason}`);
      return result.ledger;
    }
    describe("팀 배정 원장 — 업무/수정 예산 분리", () => {
      // 깨질 것: 첫 배정을 수정으로 분류하면(구 fixRounds) phase 가 "fix" 가 되고 수정 예산이 깎인다.
      it("첫 배정은 업무이고 수정 예산을 건드리지 않는다", () => {
        const result = claimAssignment(ledgerFor(1), { mapId: "map_a", agentId: "builder-1", memberId: "builder" });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.assignment.phase).toBe("work");
        expect(result.assignment.fixOf).toBeNull();
      });

      // 깨질 것: 예산을 하나로 합치면(구 MAX_FIX_ROUNDS_PER_MAP=2, 총 3회) 세 팀원이 한 번씩만 맡아도
      // 검수 지적을 고칠 배정이 남지 않는다 — 사용자가 정원사를 켰을 때 실제로 밟는 경로.
      it("시공 팀원 셋이 한 맵을 한 번씩 맡아도 수정 두 번이 남는다", () => {
        let ledger = ledgerFor(3);
        for (const [index, member] of ["builder", "decorator", "gardener"].entries()) {
          const agentId = `builder-${index + 1}`;
          ledger = claim(ledger, "map_a", agentId, member);
          ledger = settleAssignment(ledger, agentId, true);
        }
        expect(ledger.assignments.every((assignment) => assignment.phase === "work")).toBe(true);

        for (const round of [1, 2]) {
          ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: `reviewer-${round}`, ok: false });
          const fix = claimAssignment(ledger, { mapId: "map_a", agentId: `fix-${round}`, memberId: "builder" });
          expect(fix.ok).toBe(true);
          if (!fix.ok) return;
          expect(fix.assignment.phase).toBe("fix");
          ledger = settleAssignment(fix.ledger, `fix-${round}`, true);
        }
      });

      // 깨질 것: 수정 배정이 원인이 된 검수를 가리키지 않으면 보드가 재배정을 원 작업에 이을 수 없다.
      it("검수 지적 뒤의 배정만 수정으로 분류되고 그 검수 행을 가리킨다", () => {
        let ledger = claim(ledgerFor(1), "map_a", "builder-1", "builder");
        ledger = settleAssignment(ledger, "builder-1", true);
        ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: "reviewer-1", ok: false });

        const result = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "builder" });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.assignment.phase).toBe("fix");
        expect(result.assignment.fixOf).toBe("reviewer-1");
      });

      // 깨질 것: 검수 통과에도 지적을 기록하면 멀쩡한 다음 업무가 수정으로 분류돼 예산을 깎는다.
      it("검수가 통과하면 다음 배정은 업무로 남는다", () => {
        let ledger = claim(ledgerFor(2), "map_a", "builder-1", "builder");
        ledger = settleAssignment(ledger, "builder-1", true);
        ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: "reviewer-1", ok: true });

        const result = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "decorator" });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.assignment.phase).toBe("work");
        expect(result.assignment.fixOf).toBeNull();
      });

      // 깨질 것: 배정할 때 지적을 지우지 않으면, 한 번 지적이 난 맵의 이후 배정이 전부 수정으로
      // 분류돼 수정 예산만 갉아먹는다(수정을 이미 보냈는데도).
      it("수정을 한 번 보내면 그 지적은 소진되고 다음 배정은 다시 업무다", () => {
        let ledger = ledgerFor(2);
        ledger = settleAssignment(claim(ledger, "map_a", "builder-1", "builder"), "builder-1", true);
        ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: "reviewer-1", ok: false });
        ledger = settleAssignment(claim(ledger, "map_a", "fix-1", "builder"), "fix-1", true);

        const next = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "decorator" });
        expect(next.ok).toBe(true);
        if (!next.ok) return;
        expect(next.assignment.phase).toBe("work");
        expect(next.assignment.fixOf).toBeNull();
      });

      // 깨질 것: 통과한 검수가 앞선 지적을 지우지 않으면, 고쳐서 통과했는데도 다음 배정이 수정으로
      // 분류돼 예산이 깎인다.
      it("지적 뒤 재검수가 통과하면 남은 지적이 지워진다", () => {
        let ledger = ledgerFor(2);
        ledger = settleAssignment(claim(ledger, "map_a", "builder-1", "builder"), "builder-1", true);
        ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: "reviewer-1", ok: false });
        ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: "reviewer-2", ok: true });

        const next = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "decorator" });
        expect(next.ok).toBe(true);
        if (!next.ok) return;
        expect(next.assignment.phase).toBe("work");
      });

      // 깨질 것: 수정 상한을 지우면 검수 지적 → 수정 → 재지적이 무한히 돈다.
      it("수정 예산을 다 쓰면 더 배정하지 않는다", () => {
        let ledger = ledgerFor(1);
        ledger = settleAssignment(claim(ledger, "map_a", "builder-1", "builder"), "builder-1", true);
        for (const round of [1, 2]) {
          ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: `reviewer-${round}`, ok: false });
          ledger = settleAssignment(claim(ledger, "map_a", `fix-${round}`, "builder"), `fix-${round}`, true);
        }
        ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: "reviewer-3", ok: false });

        const denied = claimAssignment(ledger, { mapId: "map_a", agentId: "fix-3", memberId: "builder" });
        expect(denied.ok).toBe(false);
        if (denied.ok) return;
        expect(denied.reason).toContain("map_a");
      });

      // 깨질 것: 업무 상한을 지우면 팀장이 같은 맵에 배정을 무한히 쌓을 수 있다.
      it("업무 예산을 다 쓰면 더 배정하지 않는다", () => {
        let ledger = ledgerFor(1);
        const budget = ledger.budget.work;
        for (let index = 0; index < budget; index += 1) {
          const agentId = `builder-${index + 1}`;
          ledger = settleAssignment(claim(ledger, "map_a", agentId, "builder"), agentId, true);
        }
        const denied = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-over", memberId: "builder" });
        expect(denied.ok).toBe(false);
      });
    });
    describe("팀 배정 원장 — 맵 in-flight 락", () => {
      // 깨질 것: 락을 지우면 같은 턴의 두 배정이 같은 스냅샷에서 출발해 나중 결과가 앞 결과를 통째로 덮는다.
      it("진행 중인 맵에 두 번째 배정은 거절한다", () => {
        const ledger = claim(ledgerFor(3), "map_a", "builder-1", "builder");
        const denied = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "decorator" });
        expect(denied.ok).toBe(false);
        if (denied.ok) return;
        expect(denied.reason).toContain("map_a");
        expect(denied.reason).toContain("builder-1");
      });

      it("다른 맵은 동시에 배정된다", () => {
        let ledger = claim(ledgerFor(2), "map_a", "builder-1", "builder");
        ledger = claim(ledger, "map_b", "builder-2", "builder");
        expect(runningAssignments(ledger).map((assignment) => assignment.mapId)).toEqual(["map_a", "map_b"]);
      });

      // 깨질 것: 완료 시 락을 안 풀면 시공 → 장식 파이프라인의 두 번째 배정이 영영 막힌다.
      it("앞 배정이 끝나면 같은 맵을 다시 배정할 수 있다", () => {
        let ledger = claim(ledgerFor(3), "map_a", "builder-1", "builder");
        ledger = settleAssignment(ledger, "builder-1", true);
        expect(runningAssignments(ledger)).toEqual([]);

        const next = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "decorator" });
        expect(next.ok).toBe(true);
      });

      // 깨질 것: 실패한 배정이 running 으로 남으면 그 맵은 두 번 다시 못 쓴다.
      it("실패한 배정도 락을 푼다", () => {
        let ledger = claim(ledgerFor(3), "map_a", "builder-1", "builder");
        ledger = settleAssignment(ledger, "builder-1", false);
        expect(ledger.assignments[0]?.state).toBe("failed");
        expect(claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "builder" }).ok).toBe(true);
      });
    });
  });
});

describe("piAgentBackgroundCheckpoint", () => {
  isolateTimers();
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetHeavyWireForTests();
  });
  // Heavy under CI load (15s default is too tight): applies full-project checkpoints.
  describe("Pi checkpoints while background rendering and timers are stalled", { timeout: 120_000 }, () => {
    it("applies two checkpoints and sends both ACKs without a frame or timer tick", async () => {
      vi.useFakeTimers();
      const doc = Object.assign(new EventTarget(), {
        visibilityState: "hidden", hasFocus: () => false, defaultView: new EventTarget(),
      });
      vi.stubGlobal("document", doc);
      const raf = vi.fn(() => 1);
      vi.stubGlobal("requestAnimationFrame", raf);
      const project = createEmptyToolProject();
      // Force the gzip path, including its cooperative yields, for requests and ACKs.
      project.meta.title = "background fixture ".repeat(60_000);
      let clock = 0;
      vi.spyOn(performance, "now").mockImplementation(() => (clock += 20));
      const acks: string[] = [];
      let stream: ReadableStreamDefaultController<Uint8Array>;
      const emit = (event: unknown) => stream.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
      const checkpoint = (id: string) => emit({ type: "checkpoint", checkpointId: id, toolName: "rename_map", label: id, project });
      const fetchImpl: typeof fetch = async (input, init) => {
        if (String(input).includes("/checkpoint")) {
          const response = new Response(init?.body as BodyInit);
          const body = new Headers(init?.headers).get("content-encoding") === "gzip"
            ? await new Response(response.body!.pipeThrough(new DecompressionStream("gzip"))).json()
            : await response.json();
          expect(body.ok).toBe(true);
          acks.push(body.checkpointId);
          if (acks.length === 1) checkpoint("second");
          else {
            emit({ type: "done", project, changedKeys: [], stats: { ms: 1, turns: 2, toolCalls: 2, toolErrors: 0 } });
            stream.close();
          }
          return new Response("{}");
        }
        return new Response(new ReadableStream({ start(controller) {
          stream = controller;
          checkpoint("first");
        } }));
      };
      const applied: string[] = [];
      await runPiAgentViaCompanion({ provider: "google-antigravity", task: "background", mapIds: [], project }, {
        fetchImpl, onCheckpoint: async event => { applied.push(event.checkpointId); return project; },
      });
      expect(applied).toEqual(["first", "second"]);
      expect(acks).toEqual(applied);
      expect(raf).not.toHaveBeenCalled();
    });
  });
});

// 브라우저 Pi 클라이언트 — 끊긴 스트림 이어 받기 · 무거운 키 해시 전송 (2026-09-27).
// 실측: 40분짜리 팀 첫 생성이 연결 한 번 끊김(Firefox 「Error in input stream」)에 「실패」로 끝났고, 요청 몸통이 151MB 였다.
describe("piAgentClientResume", () => {
  isolateTimers();
  const enc = new TextEncoder();
  const line = (value: unknown) => enc.encode(JSON.stringify(value) + "\n");
  const project = createBlankProject();
  const done = { type: "done", project, stats: { ms: 1, turns: 2, toolCalls: 0, toolErrors: 0 }, changedKeys: [] };
  async function bodyOf(init?: RequestInit): Promise<Record<string, unknown>> {
    if (typeof init?.body === "string") return JSON.parse(init.body) as Record<string, unknown>;
    const raw = new Response(init?.body as BodyInit).body!.pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(raw).text()) as Record<string, unknown>;
  }
  afterEach(() => resetHeavyWireForTests());
  describe("Pi 클라이언트 이어 받기", () => {
    it("실시간 리더가 조용히 멈춰도 같은 실행 기록의 완료된 음원 결과를 이어 받는다", async () => {
      const methods: string[] = [];
      const authored = createBlankProject();
      authored.assets.uploaded['original_se_saved'] = { id: 'original_se_saved', kind: 'sound', name: 'Key', dataUrl: 'data:audio/wav;base64,UklGRg==', meta: {} };
      const fetchImpl = (async (_url: string, init?: RequestInit) => {
        methods.push(init?.method ?? 'GET');
        if (init?.method === 'POST') return new Response(new ReadableStream({ start(c) {
          c.enqueue(line({ seq: 0, type: 'turn', index: 1 }));
          // Host keeps the result; the connected reader receives no further bytes.
        } }), { headers: { 'X-Oprn-Run-Id': String((await bodyOf(init)).runId) } });
        expect(String(_url)).toContain('after=1');
        return new Response(new ReadableStream({ start(c) { c.enqueue(line({ seq: 1, ...done, project: authored, changedKeys: ['assets'] })); c.close(); } }));
      }) as unknown as typeof fetch;
      const result = await runPiAgentViaCompanion({ provider: 'google-antigravity', task: 'original soundtrack', mapIds: [], project }, {
        fetchImpl, staleMs: 20, resumeDelayMs: 1,
      });
      expect(methods).toEqual(['POST', 'GET']);
      expect(result.project.assets.uploaded.original_se_saved).toEqual(authored.assets.uploaded.original_se_saved);
    });
    it("페이지가 멈췄다 풀릴 때 밀린 워치독이 먼저 울려도 대기 중인 줄을 듣고 끊지 않는다", async () => {
      // 실측(2026-10-05 연애 팀 첫 생성): 편집기가 86초 멈춘 사이 워커는 줄을 계속 썼는데, 풀린 순간 워치독이 먼저 돌아
      // 「워커에서 80초 동안 신호가 없어」로 끝났다.
      const methods: string[] = [];
      const fetchImpl = (async (_url: string, init?: RequestInit) => {
        methods.push(init?.method ?? "GET");
        if ((init?.method ?? "GET") === "GET") return new Response(JSON.stringify({ error: "gone" }), { status: 404 });
        const runId = String((await bodyOf(init)).runId);
        return new Response(new ReadableStream({ start(c) {
          c.enqueue(line({ type: "turn", index: 1 }));
          let beats = 0;
          const beat = setInterval(() => {
            c.enqueue(line({ type: "heartbeat", at: Date.now() }));
            if (++beats < 4) return;
            clearInterval(beat);
            setTimeout(() => {
              const until = Date.now() + 600;
              while (Date.now() < until) { /* 페이지 주 스레드가 멈춘다 */ }
              setTimeout(() => {
                c.enqueue(line({ type: "turn", index: 2 }));
                setTimeout(() => { c.enqueue(line(done)); c.close(); }, 20);
              }, 0);
            }, 30);
          }, 30);
        } }), { headers: { "X-Oprn-Run-Id": runId } });
      }) as unknown as typeof fetch;
      const turns: number[] = [];
      const result = await runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, {
        fetchImpl, staleMs: 150, resumeDelayMs: 1, onEvent: (event) => { if (event.type === "turn") turns.push(event.index); },
      });
      expect(result.type).toBe("done");
      expect(turns).toEqual([1, 2]);
      expect(methods).toEqual(["POST"]);
    });
    it("도중에 끊기면 마지막 번호 다음부터 이어 받고, 겹친 줄은 한 번만 처리한다", async () => {
      const calls: string[] = [];
      let runId = "";
      const fetchImpl = (async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url.replace(/^.*\/v1/, "/v1")}`);
        if (init?.method === "POST") {
          runId = String((await bodyOf(init)).runId);
          return new Response(new ReadableStream({ start(c) {
            c.enqueue(line({ seq: 0, type: "turn", index: 1 }));
            c.enqueue(line({ seq: 1, type: "turn", index: 2 }));
            setTimeout(() => c.error(new TypeError("Error in input stream")), 5);
          } }), { headers: { "X-Oprn-Run-Id": runId } });
        }
        return new Response(new ReadableStream({ start(c) {
          c.enqueue(line({ seq: 1, type: "turn", index: 2 }));
          c.enqueue(line({ seq: 2, ...done }));
          c.close();
        } }), { headers: { "X-Oprn-Run-Id": runId } });
      }) as unknown as typeof fetch;
      const turns: number[] = [];
      const result = await runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, {
        fetchImpl, resumeDelayMs: 1, onEvent: (event) => { if (event.type === "turn") turns.push(event.index); },
      });
      expect(result.type).toBe("done");
      expect(turns).toEqual([1, 2]);
      expect(calls[1]).toContain(`runId=${runId}`);
      expect(calls[1]).toContain("after=2");
      // 읽는 이 번호: POST 와 이어 받기에 같은 값을 싣는다 — 호스트가 같은 번호의 앞 스트림을 끝낸다(scripts/lib/piRunRelay.mjs tail).
      const readerOf = (call: string) => new URLSearchParams(call.slice(call.indexOf("?") + 1)).get("reader");
      expect(readerOf(calls[0]!)).toMatch(/^[A-Za-z0-9-]{8,64}$/);
      expect(readerOf(calls[1]!)).toBe(readerOf(calls[0]!));
    });

    it("실행 기록을 모르는 호스트면 끊겼을 때 이어 받지 않고 오류로 끝낸다", async () => {
      let posts = 0;
      const fetchImpl = (async (_url: string, init?: RequestInit) => {
        posts += init?.method === "POST" ? 1 : 0;
        return new Response(new ReadableStream({ start(c) { c.enqueue(line({ type: "turn", index: 1 })); setTimeout(() => c.error(new TypeError("network")), 5); } }));
      }) as unknown as typeof fetch;
      await expect(runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, { fetchImpl, resumeDelayMs: 1 }))
        .rejects.toThrow(/연결이 끊겼고/);
    });

    it("done 없이 error 줄로 깨끗이 닫히면 이어 받지 않고 그 오류로 끝낸다", async () => {
      const methods: string[] = [];
      const fetchImpl = (async (_url: string, init?: RequestInit) => {
        methods.push(init?.method ?? "GET");
        const runId = String((await bodyOf(init)).runId);
        return new Response(new ReadableStream({ start(c) {
          c.enqueue(line({ seq: 0, type: "error", message: "OAuth token expired before request" }));
          c.close();
        } }), { headers: { "X-Oprn-Run-Id": runId } });
      }) as unknown as typeof fetch;
      await expect(runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, { fetchImpl, resumeDelayMs: 1 }))
        .rejects.toThrow(/OAuth token expired/);
      expect(methods).toEqual(["POST"]);
    });

    it("사용자 중단은 호스트에 cancel 을 보낸다", async () => {
      const controller = new AbortController();
      const calls: string[] = [];
      let runId = "";
      const fetchImpl = (async (url: string, init?: RequestInit) => {
        calls.push(url.replace(/^.*\/v1/, "/v1").split("?")[0]!);
        if (url.includes("/agent/cancel")) return new Response("{}");
        runId = String((await bodyOf(init)).runId);
        return new Response(new ReadableStream({ start(c) {
          c.enqueue(line({ seq: 0, type: "turn", index: 1 }));
          init?.signal?.addEventListener("abort", () => c.error(Object.assign(new Error("aborted"), { name: "AbortError" })));
          setTimeout(() => controller.abort(), 5);
        } }), { headers: { "X-Oprn-Run-Id": runId } });
      }) as unknown as typeof fetch;
      await expect(runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, { fetchImpl, signal: controller.signal, resumeDelayMs: 1 }))
        .rejects.toMatchObject({ name: "AbortError" });
      expect(calls).toContain("/v1/agent/cancel");
    });
  });
  describe("무거운 키 해시 전송", () => {
    it("타일셋·DB 는 해시로 보내고, 첫 시도부터 내용 없이 해시만 보낸다 — 호스트가 모를 때만 409 로 받아 싣는다", async () => {
      // 호스트 캐시는 탭·새로고침보다 오래 산다(2026-10-04 실측): 새로고침 뒤 첫 턴마다 이미 가진 150MB 를 다시 올렸다.
      const bodies: Record<string, unknown>[] = [];
      const known = new Set<string>();
      const fetchImpl = (async (_url: string, init?: RequestInit) => {
        const body = await bodyOf(init);
        bodies.push(body);
        for (const hash of Object.keys((body.heavyBlobs ?? {}) as Record<string, string>)) known.add(hash);
        const missing = Object.values((body.heavy ?? {}) as Record<string, string>).filter((hash) => !known.has(hash));
        if (missing.length) return new Response(JSON.stringify({ error: "heavy-missing", missing }), { status: 409 });
        return new Response(new ReadableStream({ start(c) { c.enqueue(line({ seq: 0, ...done })); c.close(); } }), { headers: { "X-Oprn-Run-Id": String(body.runId) } });
      }) as unknown as typeof fetch;
      await runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, { fetchImpl });
      await runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, { fetchImpl });
      const [first, filled, second] = bodies as { heavy?: Record<string, string>; heavyBlobs?: Record<string, string>; project: { tilesets: object } }[];
      expect(bodies).toHaveLength(3);
      expect(Object.keys(first!.heavy ?? {})).toEqual(expect.arrayContaining(["tilesets"]));
      expect(Object.keys(first!.project.tilesets)).toHaveLength(0);
      expect(first!.heavyBlobs).toBeUndefined();
      expect(Object.keys(filled!.heavyBlobs ?? {}).sort()).toEqual(Object.values(first!.heavy ?? {}).sort());
      expect(second!.heavy).toEqual(first!.heavy);
      expect(second!.heavyBlobs).toBeUndefined();
    });

    it("호스트가 해시를 잃었다고 하면(409) 그 내용만 실어 다시 보낸다", async () => {
      const bodies: Record<string, unknown>[] = [];
      const fetchImpl = (async (_url: string, init?: RequestInit) => {
        const body = await bodyOf(init);
        bodies.push(body);
        const heavy = body.heavy as Record<string, string>;
        if (bodies.length === 2) return new Response(JSON.stringify({ error: "heavy-missing", missing: [heavy.tilesets] }), { status: 409 });
        return new Response(new ReadableStream({ start(c) { c.enqueue(line({ seq: 0, ...done })); c.close(); } }), { headers: { "X-Oprn-Run-Id": String(body.runId) } });
      }) as unknown as typeof fetch;
      await runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, { fetchImpl });
      await runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, { fetchImpl });
      const retried = bodies[2] as { heavy: Record<string, string>; heavyBlobs?: Record<string, string> };
      expect(Object.keys(retried.heavyBlobs ?? {})).toEqual([retried.heavy.tilesets]);
    });
  });
});
