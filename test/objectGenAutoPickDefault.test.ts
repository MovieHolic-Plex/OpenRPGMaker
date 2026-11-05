// 2026-11-05 imageplan-follow (lead, owner 「필요한 에셋은 만들게 하고」): the assistant must not stop and wait for a person to pick
// a drawn object. 「알아서 고르기」 is on unless the user switched it off on this device, and a drawing that never passes review
// goes back to the assistant as a «could not draw» follow-up instead of waiting on the card.
import { afterEach, describe, expect, it } from "vitest";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { OBJECT_GEN_AUTO_PICK_KEY, objectGenAutoPick } = await import("@/editor/workshop/assistantObjectGen");
const { outcomeText } = await import("@/editor/panels/aiObjectGenCard");
const { jobState } = await import("@/editor/workshop/queue/jobModel");

const job = (source: "assistant" | "oneclick" | "workshop") => ({
  id: "j", projectKey: "p", generator: "object-gen", source, title: "고목", createdAt: 0, harnessId: "map-objects", itemKey: "new:x",
  roundId: "r1", startedAt: 0, finishedAt: 0, pause: null, cancelled: false, installWait: null, installed: null,
  error: "검수를 통과한 그림이 나오지 않았어요.", calls: 0, timeline: [], autoFailed: source === "assistant",
}) as never;

describe("object-gen auto pick default", () => {
  afterEach(() => store.clear());

  it("is on when nothing is stored and off only when the user turned it off", () => {
    expect(objectGenAutoPick()).toBe(true);
    store.set(OBJECT_GEN_AUTO_PICK_KEY, "1");
    expect(objectGenAutoPick()).toBe(true);
    store.set(OBJECT_GEN_AUTO_PICK_KEY, "0");
    expect(objectGenAutoPick()).toBe(false);
  });

  it("tells the assistant to place an existing object when a drawing failed, without asking to draw again", () => {
    const text = outcomeText([{ failed: "뿌리 뻗은 고목" }], [{ title: "뿌리 뻗은 고목", need: "고목 방" } as never]);
    expect(text).toContain("[공방에서 못 그림]");
    expect(text).toContain("「뿌리 뻗은 고목」");
    expect(text).toContain("generate_missing_object·draw_object 를 다시 부르지 마라");
    expect(text).toContain("검수를 통과한 그림이 나오지 않음");
    expect(outcomeText([{ failed: "고목", reason: "AI 계정 로그인 만료" }], [{ title: "고목", need: "" } as never])).toContain("「고목」(AI 계정 로그인 만료)");
  });

  it("ends an assistant job with no passing drawing as failed instead of waiting for a pick", () => {
    expect(jobState(job("assistant"), null)).toBe("failed");
    expect(jobState(job("oneclick"), null)).toBe("failed");
    // a manual-pick device's install error keeps the job pickable
    expect(jobState({ ...(job("assistant") as object), autoFailed: false } as never, null)).not.toBe("failed");
  });
});
