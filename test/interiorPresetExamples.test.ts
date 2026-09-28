// 2026-09-28 사용자 지적: 「AI 가 실내를 놓을 때 버드나무 여관 같은 미리 만든 프리셋을 전혀 참고하지 않는다」.
// get_concept_facility 가 검토된 실내 프리셋의 층별 크기·출입구·가구를 돌려주고, 첫 예시의 층 그림을 붙이는지 본다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { interiorPresetContext, interiorPresetImages, type InteriorPresetExample } from "@/editor/tools/interiorPresetExamples";
import { createBlankProject } from "@/project/defaults";

const WILLOW_INN = "reviewed:shared_authored-map_homes_inn_4_20260921";

describe("interior preset examples", () => {
  it("an inn request brings the willow inn with all three floors and their furniture", () => {
    const result = runTool({ project: createBlankProject() }, "get_concept_facility", { query: "여관" }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("버드나무 여관");
    const examples = (result.data as { presetExamples?: InteriorPresetExample[] }).presetExamples ?? [];
    const willow = examples.find(example => example.id === WILLOW_INN);
    expect(willow?.floors.map(floor => [floor.width, floor.height])).toEqual([[18, 13], [19, 14], [19, 14]]);
    expect(willow?.floors[0]?.objects).toContain("바 카운터");
    expect(willow?.floors[0]?.exits.some(exit => exit.startsWith("2층으로 올라가기"))).toBe(true);
  });

  it("presets come before the long template so a truncated tool result still carries them", () => {
    const result = runTool({ project: createBlankProject() }, "get_concept_facility", { query: "여관" }, { dryRun: false });
    expect(JSON.stringify(result.data).indexOf("presetExamples")).toBeLessThan(200);
  });

  it("matches by purpose tag and by facility name, and lists the catalog when nothing fits", () => {
    expect(interiorPresetContext("민가").presetExamples?.every(example => ["주거", "주택"].includes(example.purpose ?? ""))).toBe(true);
    expect(interiorPresetContext("대장간").presetExamples?.[0]?.name).toBe("철물 대장간");
    const none = interiorPresetContext("등대");
    expect(none.presetExamples).toBeUndefined();
    expect(none.presetCatalog).toContain("버드나무 여관");
  });

  it("attaches the shipped floor images of the first example", async () => {
    const images = await interiorPresetImages(interiorPresetContext("버드나무 여관"));
    expect(images).toHaveLength(3);
    expect(images[0]?.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(images[0]?.label).toContain("1층");
  });
});
