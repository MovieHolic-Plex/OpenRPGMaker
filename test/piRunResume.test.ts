import { describe, expect, it } from "vitest";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { appliedByInterruptedRun, appliedCallKey, inFlightMarkerText, PI_RUN_IN_FLIGHT, readResumeMemory, RESUME_MAX_APPLIED, resumeTaskText, withAppliedCall, type PiRunJournal } from "@/ai/piAgent/runResume";
import { interruptedPiRun } from "@/editor/panels/aiPiRunInterrupted";
import { CONTINUE_WORDS } from "@/ai/v2/request/readers";
import { createV2Turn } from "@/ai/v2/turn/turn";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import type { Project } from "@/project/types";

const SLOW = 60_000;
const journal: PiRunJournal = { key: "run-a", task: "작은 호러 게임을 만들어 줘", mode: "single", startedAt: 1 };

function v2Run(project: Project, resume: { key: string; from?: string }, task = "작은 호러 게임을 만들어 줘") {
  const request = { task, provider: "local-cli:claude", mapIds: [], project, currentMapId: project.startMapId, resume } as never;
  const events: { name?: string }[] = [];
  const turn = createV2Turn(request, { onEvent: (e) => events.push(e as { name?: string }) }, { captureVqaShots: async () => ({ shots: [], failed: [] }) });
  const env = { ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request, emit: (e: { name?: string }) => events.push(e), record: () => {},
    checkpoint: async () => {}, sideChat: async () => "{}" } as unknown as PiAssistantV2Env;
  return { hooks: turn.hooks, env, events };
}

describe("Pi 실행 이어 하기 기록(runResume)", () => {
  it("멱등 키는 인자 키 순서와 todoId 에 상관없이 같고, 인자가 다르면 다르다", () => {
    expect(appliedCallKey("paint_rect", { x: 1, y: 2, todoId: "t1" })).toBe(appliedCallKey("paint_rect", { y: 2, x: 1 }));
    expect(appliedCallKey("paint_rect", { x: 1, y: 2 })).not.toBe(appliedCallKey("paint_rect", { x: 1, y: 3 }));
    expect(appliedCallKey("paint_rect", { x: 1 })).not.toBe(appliedCallKey("fill_rect", { x: 1 }));
  });

  it("적용 호출은 같은 키를 두 번 넣지 않고, 상한을 넘으면 오래된 것부터 버리며 버린 수를 센다", () => {
    let memory = { key: "k", task: "t", applied: [] as { k: string; tool: string; at: number }[] };
    memory = withAppliedCall(memory, { k: "a", tool: "x", at: 1 }) as typeof memory;
    expect(withAppliedCall(memory, { k: "a", tool: "x", at: 2 })).toBe(memory);
    for (let i = 0; i < RESUME_MAX_APPLIED + 4; i++) memory = withAppliedCall(memory, { k: `k${i}`, tool: "x", at: i }) as typeof memory;
    expect(memory.applied).toHaveLength(RESUME_MAX_APPLIED);
    expect(memory.applied[0]!.k).toBe("k4");
    expect((memory as { dropped?: number }).dropped).toBe(5);
  });

  it("표지에 붙인 기록을 되읽고, 옛 표지(기록 없음)와 표지가 아닌 글을 가른다", () => {
    const entries = [{ kind: "user" as const, text: "작은 호러 게임을 만들어 줘" }, { kind: "status" as const, text: inFlightMarkerText(journal) }];
    expect(interruptedPiRun(entries)).toEqual({ request: "작은 호러 게임을 만들어 줘", journal });
    expect(interruptedPiRun([entries[0]!, { kind: "status", text: PI_RUN_IN_FLIGHT }])).toEqual({ request: "작은 호러 게임을 만들어 줘", journal: null });
    expect(interruptedPiRun([entries[0]!, { kind: "status", text: `${PI_RUN_IN_FLIGHT} {깨짐` }])?.journal).toBeNull();
    expect(interruptedPiRun([entries[0]!, { kind: "status", text: "run-recap {}" }])).toBeNull();
  });

  it("다시 켰을 때 적용 수는 같은 실행의 기억일 때만 센다", () => {
    const memory = { key: "run-a", task: journal.task, applied: [{ k: "a", tool: "x", at: 1 }] };
    expect(appliedByInterruptedRun(journal, memory)).toBe(1);
    expect(appliedByInterruptedRun(journal, { ...memory, key: "older-run" })).toBe(0);
    expect(appliedByInterruptedRun(journal, undefined)).toBe(0);
  });

  it("이어 하기 요청 글은 v2 의 «계속» 판정을 켠다(할 일 목록을 되살리는 길)", () => {
    expect(CONTINUE_WORDS.test(resumeTaskText(journal, 3))).toBe(true);
    expect(CONTINUE_WORDS.test(resumeTaskText(journal, 0))).toBe(true);
  });

  it("v2 턴: 체크포인트마다 적용 호출 키를 프로젝트에 싣고, 이어 하기 실행은 그 호출을 한 번만 건너뛴다", () => {
    const first = v2Run(createBlankProject(), { key: "run-a" });
    first.hooks.beforeCheckpoint!(first.env, { name: "paint_rect", args: { x: 1, todoId: "t1" } });
    first.hooks.beforeCheckpoint!(first.env, { name: "todo", args: { op: "done" } });
    const saved = readResumeMemory(first.env.ctx.project.assistantTodo);
    expect(saved?.key).toBe("run-a");
    expect(saved?.applied.map((c) => c.tool)).toEqual(["paint_rect"]);

    const resumed = v2Run(first.env.ctx.project, { key: "run-b", from: "run-a" }, resumeTaskText(journal, 1));
    expect(resumed.events.some((e) => e.name === "v2.resume.restore")).toBe(true);
    expect(resumed.hooks.skipAppliedCall!(resumed.env, "paint_rect", { x: 2 })).toBeUndefined();
    expect(resumed.hooks.skipAppliedCall!(resumed.env, "paint_rect", { x: 1 })).toMatch(/Already applied/u);
    expect(resumed.hooks.skipAppliedCall!(resumed.env, "paint_rect", { x: 1 })).toBeUndefined();
    resumed.hooks.beforeCheckpoint!(resumed.env, { name: "upsert_event", args: { id: "ev1" } });
    const carried = readResumeMemory(resumed.env.ctx.project.assistantTodo);
    expect(carried?.key).toBe("run-b");
    expect(carried?.applied.map((c) => c.tool)).toEqual(["paint_rect", "upsert_event"]);

    const unrelated = v2Run(first.env.ctx.project, { key: "run-c", from: "someone-else" });
    expect(unrelated.hooks.skipAppliedCall!(unrelated.env, "paint_rect", { x: 1 })).toBeUndefined();
  }, SLOW);
});
