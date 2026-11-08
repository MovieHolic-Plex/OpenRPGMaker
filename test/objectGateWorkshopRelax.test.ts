import { describe, expect, it } from "vitest";
import { decideObjectGateBoth, decideWorkshopRelaxed, type ObjectGateJudgeAnswer, type ObjectGateStyleAnswer } from "@/harnesses/_core/objectGate";

const view = (reads_as: string, extra: Partial<ObjectGateJudgeAnswer> = {}): ObjectGateJudgeAnswer =>
  ({ reads_as, main_top_rows: 2, front_face_rows: 8, kind_matches: true, side_face_visible: false, all_major_parts_have_top: false, ...extra });
const style = (extra: Partial<ObjectGateStyleAnswer> = {}): ObjectGateStyleAnswer =>
  ({ verdict: "fail", outline: "near_black", texture: "some", density: "slightly_lower", shading_steps: 3, ...extra });

describe("workshop-stage relaxed object gate", () => {
  it("passes a three-quarter statue that the strict gate refers for a thin plinth top and a near-black outline", () => {
    const answers = [view("three_quarter"), view("three_quarter"), view("three_quarter"), view("front_elevation")];
    const styles = [style(), style(), style(), style()];
    expect(decideObjectGateBoth("figure", answers, styles).pass).toBe(false);
    expect(decideWorkshopRelaxed("figure", answers, styles).state).toBe("pass");
  });

  it("still fails a drawing most judges read as a front elevation", () => {
    const answers = [view("front_elevation"), view("front_elevation"), view("front_elevation"), view("three_quarter")];
    expect(decideWorkshopRelaxed("column", answers, [style(), style(), style(), style()]).state).toBe("fail");
  });

  it("still fails a flat blob whose style judges see no texture and much lower density", () => {
    const answers = [view("three_quarter"), view("three_quarter"), view("three_quarter"), view("three_quarter")];
    const blob = style({ texture: "flat", density: "much_lower" });
    expect(decideWorkshopRelaxed("box", answers, [blob, blob, blob, style()]).state).toBe("fail");
  });

  it("refers a split view decision instead of passing it", () => {
    const answers = [view("three_quarter"), view("three_quarter"), view("front_elevation"), view("front_elevation")];
    expect(decideWorkshopRelaxed("other", answers, [style(), style(), style(), style()]).state).toBe("refer");
  });
});
