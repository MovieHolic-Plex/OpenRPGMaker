// report_task 없이 끝난 팀원 — 이미 반영된 변경을 팀장에게 밝힌다(2026-10-05: 재배정이 세계관을 덮어쓰고 맵을 한 벌 더 만들었다).
import { describe, expect, it } from "vitest";
import { missingReportSummary } from "../scripts/lib/piTeamRuntime";
import { changedProjectKeys } from "@/ai/piAgent/protocol";
import { createBlankProject } from "@/project/defaults";

describe("보고 없이 끝난 팀원 요약", () => {
  it("새 맵·고친 맵·바뀐 데이터와 팀원의 마지막 말을 전한다", () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    const first = Object.keys(after.maps)[0]!;
    after.maps.map_town = { ...structuredClone(after.maps[first]!), id: "map_town", name: "마을" };
    after.maps[first]!.name = "시작 바뀜";
    (after as unknown as { worldCanon: unknown }).worldCanon = { title: "아르테리아" };
    const summary = missingReportSummary(before, after, changedProjectKeys(before, after), "동굴은 칩셋 변경 확인이 필요합니다.");
    expect(summary).toContain("새 맵 마을(map_town)");
    expect(summary).toContain(`고친 맵 시작 바뀜(${first})`);
    expect(summary).toContain("worldCanon");
    expect(summary).not.toContain("maps.");
    expect(summary).toContain("다시 맡기지 말고");
    expect(summary).toContain("칩셋 변경 확인");
  });

  it("반영된 변경이 없으면 그렇게 말한다", () => {
    const project = createBlankProject();
    expect(missingReportSummary(project, project, [], undefined)).toBe("report_task 없이 끝나 완료로 치지 않았다. 프로젝트에 반영된 변경은 없다.");
  });
});
