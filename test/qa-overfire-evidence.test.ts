// QA over-fire evidence capture (temporary). Writes facade lines to tmp file.
import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildRegionTaskMessage } from "@/editor/regionTask/runRegionTask";

function msgFor(instruction: string): string {
  return buildRegionTaskMessage(instruction, "맵", "m1", { x: 0, y: 1, width: 7, height: 8 });
}

function facadeLines(msg: string): string {
  return msg.split("\n").filter((l) =>
    /author_house|author_village|build_wall|kind:"|야외 집|집 요청|실내|구조물/.test(l),
  ).join("\n");
}

const cases = [
  "탑 건물 지어줘",
  "성벽 건물 지어",
  "대장간 건물",
  "마을 지어",
  "집 5채 지어",
  "실내 집 만들어",
];

describe("QA over-fire evidence", () => {
  it("captures facade lines", () => {
    const out = cases.map((c) => {
      const msg = msgFor(c);
      const overFire = msg.includes('author_house { kind:"single"');
      return `=== ${c} === (author_house single facade present: ${overFire})\n${facadeLines(msg)}\n`;
    }).join("\n");
    writeFileSync("tmp/qa-overfire-evidence.txt", out, "utf-8");
  });
});
