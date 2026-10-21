import { describe, expect, it } from "vitest";
import type { WorkshopRound, WorkshopRun } from "@/harnesses/_core/workshop/types";
import {
  blockedRun, countdownText, isAccountPause, jobEtaMs, jobProgress, jobState, networkBackoffMs, pauseFor, pauseLine,
  rateBackoffMs, resetsInMs, retryText, type WorkshopJob,
} from "@/editor/workshop/queue/jobModel";
import { runErrorKind } from "@/harnesses/_core/workshop/engine";

const run = (status: WorkshopRun["status"], extra: Partial<WorkshopRun> = {}): WorkshopRun => ({
  letter: "A", direction: "", status, attempt: status === "drawing" ? 1 : 0, attempts: [], grid: null, note: "", topRows: null, verdict: null,
  error: null, errorKind: null, calls: 0, redrawNote: "", startedAt: null, finishedAt: null, ...extra,
} as WorkshopRun);

const round = (runs: WorkshopRun[]): WorkshopRound => ({ id: "r1", itemKey: "new:x", runs } as unknown as WorkshopRound);

const job = (extra: Partial<WorkshopJob> = {}): WorkshopJob => ({
  id: "j1", projectKey: "p", generator: "object-gen", source: "workshop", title: "x", createdAt: 0, harnessId: "map-objects", itemKey: "new:x",
  roundId: "r1", startedAt: 0, finishedAt: null, pause: null, cancelled: false, installWait: null, installed: null, error: null, calls: 0, timeline: [], ...extra,
});

describe("workshop job model", () => {
  it("reads the visible state from the round", () => {
    expect(jobState(job({ roundId: null }), null)).toBe("queued");
    expect(jobState(job(), round([run("drawing"), run("queued")]))).toBe("drawing");
    // 참고 그림 단계: 장은 그리는 중이지만 첫 시도 전, reference 없음
    expect(jobState(job(), round([run("drawing", { attempt: 0 }), run("drawing", { attempt: 0 })]))).toBe("reference");
    expect(jobState(job(), { ...round([run("drawing", { attempt: 0 })]), reference: { status: "ok", tries: 1 } } as never)).toBe("drawing");
    expect(jobState(job(), round([run("reviewing"), run("done")]))).toBe("review");
    expect(jobState(job(), round([run("done", { grid: { width: 1, height: 1, cells: [0] } as never }), run("failed")]))).toBe("ready");
    expect(jobState(job(), round([run("failed"), run("failed")]))).toBe("failed");
    expect(jobState(job({ pause: { kind: "quota", reason: "계정 사용 한도", until: 1, at: 0 } }), round([run("failed")]))).toBe("paused");
    expect(jobState(job({ cancelled: true }), null)).toBe("cancelled");
    expect(jobState(job({ generator: "char-gen", pack: { folder: "f", manifest: {} } }), null)).toBe("ready");
  });

  it("estimates progress and time left", () => {
    const r = round([run("done"), run("reviewing"), run("drawing")]);
    expect(jobProgress(job(), r)).toBeGreaterThan(0.5);
    expect(jobEtaMs(job({ startedAt: 0 }), r, { now: 60_000, averageMs: 120_000, queuePosition: 0, limit: 10 })).toBeGreaterThan(0);
    expect(jobEtaMs(job({ roundId: null, startedAt: null }), null, { now: 0, averageMs: 120_000, queuePosition: 12, limit: 10 })).toBe(240_000);
  });

  it("classifies blocked runs, including network drops", () => {
    expect(blockedRun(run("failed", { errorKind: "quota" }))).toBe("quota");
    expect(blockedRun(run("failed", { error: "네트워크 오류: LLM 엔드포인트에 연결할 수 없습니다(/v1). Failed to fetch" }))).toBe("network");
    expect(blockedRun(run("failed", { error: "JSON 을 읽지 못했다" }))).toBeNull();
    expect(blockedRun(run("done"))).toBeNull();
    expect(isAccountPause("network")).toBe(false);
    expect(isAccountPause("quota")).toBe(true);
  });

  it("maps provider errors to kinds", () => {
    expect(runErrorKind(Object.assign(new Error("Individual quota reached (RESOURCE_EXHAUSTED). Resets in 0h2m"), { status: 429 }))).toBe("quota");
    expect(runErrorKind(Object.assign(new Error("expired"), { status: 401 }))).toBe("auth");
    expect(runErrorKind(new Error("boom"))).toBeNull();
  });

  it("reads reset hints in both provider and engine wording", () => {
    expect(resetsInMs("Resets in 61h28m")).toBe((61 * 60 + 28) * 60_000);
    expect(resetsInMs("계정 사용 한도 소진 · 약 2분 뒤 풀림")).toBe(120_000);
    expect(resetsInMs("계정 사용 한도 소진 · 약 3시간 뒤 풀림")).toBe(3 * 3_600_000);
    expect(resetsInMs("nothing")).toBeNull();
  });

  it("backs off and words pauses", () => {
    expect(rateBackoffMs(1)).toBe(120_000);
    expect(rateBackoffMs(10)).toBe(30 * 60_000);
    expect(networkBackoffMs(1)).toBe(20_000);
    expect(networkBackoffMs(10)).toBe(5 * 60_000);
    expect(pauseFor("quota", "Resets in 0h2m", 0, 1).until).toBe(120_000);
    expect(pauseFor("auth", "", 0, 1).until).toBeNull();
    expect(pauseLine(pauseFor("network", "", 0, 1), 0)).toBe("연결이 끊김 · 20초 뒤 다시 시도");
    expect(retryText(749_000)).toBe("12분 29초 뒤 다시 시도");
    expect(retryText(3 * 3_600_000 + 5 * 60_000)).toBe("3시간 5분 뒤 다시 시도");
    expect(retryText(0)).toBe("곧 다시 시도");
    expect(countdownText(3_725_000)).toBe("1:02:05");
  });
});
