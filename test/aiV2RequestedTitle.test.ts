import { describe, expect, it } from "vitest";
import { requestedTitle, titleMismatch } from "@/ai/v2/shipChecks";
import { createBlankProject } from "@/project/defaults";

describe("J71/J73 requested title", () => {
  it("reads a bracketed title from the request", () => {
    expect(requestedTitle("짧은 공포 탐험 게임. 제목은 「검은 장미 저택」. 주인공…")).toBe("검은 장미 저택");
    expect(requestedTitle("타이틀: 『별의 끝』")).toBe("별의 끝");
    expect(requestedTitle("밤의 학교 공포 게임을 만들어 줘")).toBeUndefined();
  });
  it("blocks a different title and passes the requested one", () => {
    const p = createBlankProject();
    const sys = p.system as unknown as { titleScreen: Record<string, unknown> };
    sys.titleScreen = { ...sys.titleScreen, title: "검은 장미의 비밀" };
    expect(titleMismatch(p, "제목은 「검은 장미 저택」").map((b) => b.id)).toEqual(["title-not-requested"]);
    sys.titleScreen = { ...sys.titleScreen, title: "검은 장미  저택" };
    expect(titleMismatch(p, "제목은 「검은 장미 저택」")).toEqual([]);
  });
});
