import { describe, expect, it } from "vitest";
import { parseVqaReply, vqaDefectLine, vqaFixRetry, vqaFollowUp, type VqaRound, type VqaShot } from "@/ai/v2/vqa";

const shots: VqaShot[] = [
  { where: "타이틀 화면 배경", kind: "title", ref: "res_title", image: "data:," },
  { where: "맵 «저택 1층» (시작 맵)", kind: "map", ref: "map_hall", image: "data:," },
];

describe("VQA fix turns (J68)", () => {
  it("keeps the shot target on each defect so the fix list names the mapId", () => {
    const { defects } = parseVqaReply('{"defects":[{"image":2,"where":"왼쪽 위","what":"벽 안에 사람이 서 있다","severity":"blocker"}]}', shots);
    expect(defects[0]?.target).toEqual({ kind: "map", ref: "map_hall" });
    expect(vqaDefectLine(defects[0]!, 0)).toContain("mapId: map_hall");
  });

  it("the retry instruction says a report rewrite is not a fix and lists every defect", () => {
    const round: VqaRound = { round: 1, shots: [], ms: 0, reviewer: "x", defects: [
      { where: "맵 «저택 1층»", what: "벽 안에 사람", severity: "blocker", target: { kind: "map", ref: "map_hall" } },
      { where: "타이틀 화면 배경", what: "기본 그림", severity: "polish", target: { kind: "title", ref: "res_title" } },
    ] };
    const text = vqaFixRetry(round);
    expect(text).toContain("도구를 하나도 부르지 않고");
    expect(text).toContain("mapId: map_hall");
    expect(text).toContain("set_title_screen");
    expect(vqaFollowUp(round)).toContain("보고만 다시 쓰는 것은 고치기가 아니다");
  });
});
