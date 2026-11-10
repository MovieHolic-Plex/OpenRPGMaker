import { describe, expect, it } from "vitest";
import { parseVqaReply, vqaDefectLine, type VqaShot } from "@/ai/v2/vqa";

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

});
