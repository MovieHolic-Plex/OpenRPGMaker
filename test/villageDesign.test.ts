import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { asVillageDesign } from "@/project/villageDesign";
import { serialize, deserialize } from "@/project/io";
import { resolveVillageDesignInput, villageDesignRequirements, villageDesignWorldRules } from "@/editor/tools/village/designContract";
import { buildVillageDomain } from "@/editor/tools/village/builder";
import { buildPresetPreview, PRESET_PREVIEW_SIZE } from "@/editor/panels/villagePresetPreview";
import { createAuthorVillageTool } from "@/editor/tools/authorVillageToolDef";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { countWaterCells, countTreeCells } from "@/editor/tools/villageEvaluate";
import { VILLAGE_SESSION_TOOLS } from "@/editor/tools/villageSession";

function fixture() {
  const project = createBlankProject();
  const preset = asVillageDesign({ id: "design-test", name: "계약 검증", houseCount: 4, kitMix: "amber-wood", edgeTrees: "none" });
  preset.design!.interior = false;
  preset.design!.stories = [1];
  project.villagePresets = [preset];
  project.defaultVillagePresetId = preset.id;
  return { project, preset };
}

describe("마을 설계서 — DB 계약", () => {
  it("기존 프리셋은 명시적 전환 전까지 인자를 덮지 않는다", () => {
    const { project } = fixture();
    delete project.defaultVillagePresetId;
    project.villagePresets = [{ id: "legacy", name: "기존", houseCount: 8 }];
    const args = { presetId: "legacy", houseCount: 2 };
    expect(resolveVillageDesignInput(project, args, true)).toEqual(args);
  });
  it("기본 설계서를 선택해 생략한 필드를 채우고 범위 밖 요청은 시공 전에 거부한다", () => {
    const { project, preset } = fixture();
    expect(resolveVillageDesignInput(project, {}, true)).toMatchObject({ presetId: preset.id, houseCount: 4, interior: false });
    expect(() => resolveVillageDesignInput(project, { houseCount: 5 }, true)).toThrow(/집 수/);
    preset.design!.houseCount = { mode: "range", min: 3, max: 6 };
    expect(resolveVillageDesignInput(project, { houseCount: 5 }, true).houseCount).toBe(5);
    expect(() => resolveVillageDesignInput(project, { houseCount: 7 }, true)).toThrow(/집 수/);
  });
  it("집별 인자와 형태의 고정 재료도 설계서 외형을 우회할 수 없다", () => {
    const { project } = fixture();
    const before = serialize(project);
    expect(() => resolveVillageDesignInput(project, { housePlans: [{ kitId: "blue-stone" }] }, true)).toThrow(/집 재료/);
    expect(() => resolveVillageDesignInput(project, { kitMix: "blue-stone" })).toThrow(/kitMix/);
    expect(serialize(project)).toBe(before);
  });
  it("공유 생성 규칙을 바꾸지 않고 물·숲의 명시 설정을 적용한다", () => {
    const { project, preset } = fixture();
    const before = JSON.stringify(project.system);
    preset.design!.nature = { ...preset.design!.nature, water: "river", waterSide: "east", forest: "dense", forestSide: "west", riverWidthRatio: 0.22 };
    expect(villageDesignWorldRules(project, preset).water.riverBandRatio).toBe(0.22);
    expect(villageDesignRequirements(project, preset, undefined)).toMatchObject({ landmarks: ["river", "forest"], riverSide: "east", forestSide: "west", forestDensity: "dense" });
    expect(JSON.stringify(project.system)).toBe(before);
  });
  it("프롬프트 예산이 작아도 기본 설계서와 충돌 규칙은 남는다", () => {
    const { project } = fixture();
    const prompt = buildSystemPrompt(project, { budgetChars: 100 });
    expect(prompt).toContain("design-test");
    expect(prompt).toContain("village-design-conflict");
  });
  it("설계서와 기본 참조는 저장·재로드를 통과하며 잘못된 범위는 거부된다", () => {
    const { project, preset } = fixture();
    const loaded = deserialize(serialize(project));
    expect(loaded.villagePresets).toEqual(project.villagePresets);
    expect(loaded.defaultVillagePresetId).toBe(preset.id);
    preset.design!.houseCount = { mode: "range", min: 9, max: 3 };
    expect(() => deserialize(serialize(project))).toThrow(/최소|범위/);
  });
  it("실제 시공의 모든 집이 고정한 재료·층수를 따른다", () => {
    const { project, preset } = fixture();
    const result = buildVillageDomain(project, { width: 50, height: 50, seed: 7 });
    const data = result.data as { mapId: string; houses: { kitId: string; templateId: string }[]; housesBuilt: number };
    expect(data.housesBuilt).toBe(4);
    expect(data.houses.every(h => h.kitId === "amber-wood")).toBe(true);
    expect(project.maps[data.mapId]!.villageDesignSource?.preset).toEqual(preset);
    const loaded = deserialize(serialize(project));
    expect(loaded.maps[data.mapId]!.villageDesignSource?.preset.design?.revision).toBe(1);
  }, 30000);
  it("미리보기와 같은 시드·크기의 실제 시공은 동일한 타일을 만든다", () => {
    const { project, preset } = fixture();
    const before = serialize(project);
    const preview = buildPresetPreview(project, preset.id, 7);
    expect(preview.ok, preview.ok ? "" : preview.reason).toBe(true);
    expect(serialize(project)).toBe(before);
    if (!preview.ok) return;
    const built = buildVillageDomain(project, { width: PRESET_PREVIEW_SIZE, height: PRESET_PREVIEW_SIZE, presetId: preset.id, seed: 7 });
    const map = project.maps[(built.data as { mapId: string }).mapId]!;
    expect(map.lowerTiles).toEqual(preview.map.lowerTiles);
    expect(map.upperTiles).toEqual(preview.map.upperTiles);
  }, 30000);
  it("파사드의 고정값 충돌은 새 맵 생성 전에 끝난다", () => {
    const { project } = fixture();
    const before = serialize(project);
    expect(() => createAuthorVillageTool().run(project, { target: { kind: "new", mapId: "not-created", name: "검증", width: 50, height: 50 }, houseCount: 8, countPolicy: "exact" })).toThrow(/집 수/);
    expect(serialize(project)).toBe(before);
  });
  it("설계서의 물과 숲이 실제 타일에 생긴다", () => {
    const { project, preset } = fixture();
    preset.design!.nature.water = "river";
    preset.design!.nature.forest = "dense";
    const built = buildVillageDomain(project, { width: 60, height: 60, seed: 7 });
    const map = project.maps[(built.data as { mapId: string }).mapId]!;
    expect(countWaterCells(map)).toBeGreaterThanOrEqual(30);
    expect(countTreeCells(map)).toBeGreaterThanOrEqual(15);
  }, 30000);
  it("기존 맵을 재시공할 때도 설계서 기록과 범위 검사가 함께 동작한다", () => {
    const { project } = fixture();
    const first = buildVillageDomain(project, { width: 50, height: 50, seed: 7 });
    const mapId = (first.data as { mapId: string }).mapId;
    project.villagePresets![0]!.design!.revision = 2;
    expect(() => createAuthorVillageTool().run(project, { target: { kind: "existing", mapId }, fullMap: true, countPolicy: "exact", seed: 7 })).not.toThrow();
    expect(project.maps[mapId]!.villageDesignSource?.preset.design?.revision).toBe(2);
  }, 30000);
  it("기존 레이어 세션은 설계서를 부분 적용하기 전에 안내하고 중단한다", () => {
    const { project } = fixture();
    const before = serialize(project);
    const tool = VILLAGE_SESSION_TOOLS.find(t => t.name === "start_village_session")!;
    expect(() => tool.run(project, { theme: "강촌", width: 50, height: 50 })).toThrow(/author_village/);
    expect(serialize(project)).toBe(before);
  });
});
