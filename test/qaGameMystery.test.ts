import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import { runGameCheck } from "@/qa/gameCheck";
import type { Project } from "@/project/types";

const BRIEF = "추리 게임. 저택 독살 사건, 용의자 둘, 틀린 사람을 지목하면 배드 엔딩.";

function mysteryProject(): Project {
  const ctx = { project: createBlankProject() };
  const mapId = ctx.project.startMapId;
  const result = runTool(ctx, "author_mystery_case", {
    caseId: "qa", title: "저택 독살 사건", victim: { name: "바론" }, culprit: "butler",
    suspects: [
      { id: "butler", name: "집사 토마스", at: { mapId, x: 3, y: 3 }, alibi: ["부엌에 있었습니다."], motive: ["퇴직금 문제."],
        lie: { claim: "찻잔엔 손도 안 댔습니다.", contradictedBy: "teacup", truth: ["…제가 차를 올렸습니다."] } },
      { id: "elena", name: "약초상 엘레나", at: { mapId, x: 7, y: 3 }, alibi: ["약방에 있었어요."], motive: ["임대료."] },
    ],
    clues: [
      { id: "teacup", name: "독이 남은 찻잔", at: { mapId, x: 3, y: 10 }, description: "집사의 은쟁반 위 찻잔에 쓴 가루.", implicates: ["butler"], obtainedBy: "examine" },
      { id: "receipt", name: "약방 영수증", at: { mapId, x: 8, y: 12 }, description: "사건 시각 엘레나가 약방에서 발행한 영수증.", excludes: ["elena"], obtainedBy: "examine" },
    ],
    accuser: { name: "경비대장 로버트", at: { mapId, x: 14, y: 5 } },
    endings: { solved: { name: "사건 해결", lines: ["집사를 체포하겠네."] }, wrong: { name: "미궁", lines: ["엉뚱한 사람을 잡았군…"] } },
  });
  expect(result.ok, JSON.stringify(result)).toBe(true);
  return deserialize(serialize(ctx.project));
}

describe("qa gameCheck — 추리 장르", () => {
  it("author_mystery_case 사건은 정답·오답 엔딩 둘 다 자동 플레이로 닿고 추리 경고가 없다", () => {
    const report = runGameCheck(mysteryProject(), { briefText: BRIEF, autoPlayBudgetMs: 30_000 });
    const runs = report.autoPlay?.runs ?? [];
    expect(report.autoPlay?.skipped).toBeUndefined();
    expect(runs.map((run) => [run.label.startsWith("다른 엔딩") ? "다른 엔딩" : run.label, run.ok])).toEqual([["기본 경로", true], ["다른 엔딩", true]]);
    expect(new Set(runs.map((run) => run.endingReached)).size).toBe(2);
    expect(report.findings.filter((f) => f.code.startsWith("mystery-"))).toEqual([]);
  });

  it("증거 없이 말만 걸면 닿는 엔딩을 짚는다", () => {
    const project = mysteryProject();
    project.maps[project.startMapId].events.push({
      id: "ev_shortcut", name: "수상한 노인", x: 12, y: 12, trigger: { kind: "action" }, commands: [],
      pages: [{ id: "p1", conditions: [], trigger: { kind: "action" }, priority: "same", graphic: {}, commands: [{ kind: "triggerEnding", endingId: project.endings?.[0]?.id ?? "ending_x" }] }],
    } as never);
    const report = runGameCheck(project, { briefText: BRIEF, skipAutoPlay: true });
    const finding = report.findings.find((f) => f.code === "mystery-ending-unconditioned");
    expect(finding?.where?.eventId).toBe("ev_shortcut");
  });

  it("추리가 아닌 기획에는 아무것도 내지 않는다", () => {
    const report = runGameCheck(createBlankProject(), { briefText: "눈 내리는 마을 모험", skipAutoPlay: true });
    expect(report.findings.filter((f) => f.code.startsWith("mystery-"))).toEqual([]);
  });
});
