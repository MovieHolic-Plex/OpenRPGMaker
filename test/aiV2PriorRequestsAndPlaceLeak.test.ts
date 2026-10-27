import { describe, expect, it } from "vitest";
import { priorRequestsNote } from "@/ai/v2/priorRequests";
import { defaultPlaceLeaks, wantsWholeGame } from "@/ai/v2/shipChecks";
import { createBlankProject } from "@/project/defaults";

describe("J70 prior requests note", () => {
  it("returns null on the first turn", () => {
    expect(priorRequestsNote([], "밤의 학교 공포 게임")).toBeNull();
  });
  it("carries the earlier request into a follow-up turn", () => {
    const note = priorRequestsNote([{ kind: "user", text: "밤의 학교에 갇히는 공포 게임" }, { kind: "assistant", text: "만들었다" }], "처음에 부탁한 대로 끝까지 만들어 줘");
    expect(note).toContain("1. 밤의 학교에 갇히는 공포 게임");
    expect(note).not.toContain("처음에 부탁한 대로 끝까지");
  });
  it("does not turn a small edit into a whole-game request by itself", () => {
    const note = priorRequestsNote([{ kind: "user", text: "문 색을 바꿔 줘" }], "창문도")!;
    expect(wantsWholeGame(`창문도${note}`)).toBe(false);
  });
  it("keeps the first request when there are many", () => {
    const entries = Array.from({ length: 8 }, (_, i) => ({ kind: "user" as const, text: `요청 ${i}` }));
    const note = priorRequestsNote(entries, "이번")!;
    expect(note).toContain("1. 요청 0");
    expect(note).toContain("요청 7");
    expect(note).not.toContain("요청 3");
  });
});

describe("J70 default place leak", () => {
  it("flags a title built from the default chipset name the request never used", () => {
    const p = createBlankProject();
    (p.system as unknown as { titleScreen: { title: string } }).titleScreen = { ...(p.system as unknown as { titleScreen: object }).titleScreen, title: "버들항의 모험" };
    expect(defaultPlaceLeaks(p, "밤의 학교 공포 게임").map((b) => b.id)).toEqual(["default-place-leak"]);
    expect(defaultPlaceLeaks(p, "버들항에서 벌어지는 모험")).toEqual([]);
  });
});
