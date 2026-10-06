// 무거운 키 해시 — 미리 하기와 턴 전송이 겹쳐도 전체 글을 한 번만 만든다(2026-10-05 스트레스: 렌더러 힙 3.5GB 크래시).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planHeavyWire, resetHeavyWireForTests, warmHeavyWire } from "@/ai/piAgent/heavyWire";
import type { Project } from "@/project/types";

function bigDatabase(tag: string): Record<string, unknown> {
  return { tag, rows: Array.from({ length: 4000 }, (_, i) => ({ id: i, text: `row-${i}-${"x".repeat(80)}` })) };
}

function projectWith(database: Record<string, unknown>): Project {
  return { database } as unknown as Project;
}

describe("heavyWire 해시 중복 제거", () => {
  let digest: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetHeavyWireForTests();
    digest = vi.spyOn(crypto.subtle, "digest");
  });
  afterEach(() => digest.mockRestore());

  it("미리 하기 도중 턴이 같은 객체를 해시하면 한 번만 만든다", async () => {
    const project = projectWith(bigDatabase("a"));
    const queued: Array<() => void> = [];
    warmHeavyWire(() => project, (run) => queued.push(run));
    while (queued.length) queued.shift()!();
    const plan = await planHeavyWire({ project });
    expect(plan?.body.heavy?.database).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toHaveBeenCalledTimes(1);
  });

  it("내용이 두 판을 오가도 다시 만들지 않는다", async () => {
    const first = await planHeavyWire({ project: projectWith(bigDatabase("a")) });
    const second = await planHeavyWire({ project: projectWith(bigDatabase("b")) });
    const back = await planHeavyWire({ project: projectWith(bigDatabase("a")) });
    expect(back?.body.heavy?.database).toBe(first?.body.heavy?.database);
    expect(second?.body.heavy?.database).not.toBe(first?.body.heavy?.database);
    expect(digest).toHaveBeenCalledTimes(2);
  });
});
