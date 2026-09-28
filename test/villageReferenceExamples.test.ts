// 2026-09-28 사용자 지적: 「마을도 미리 만든 프리셋을 거의 참고 안 한다」. 빈 새 프로젝트에서 마을 설계서는 0개이고
// 완성 마을 사례 약 70곳이 Pi 프롬프트·의도 노트·author_village 결과 어디에도 없었다. 여기서 세 통로를 고정한다.
import { describe, expect, it } from "vitest";
import { villageReferenceExamples, villageReferenceImages, formatVillageReferenceNote } from "@/ai/villageReferenceExamples";
import { buildPiIntentNote } from "@/ai/piAgent/executionRoute";
import { resolveVillageContract } from "@/ai/piAgent/villageContract";
import { emptyIntentDeclaration, type IntentDeclaration } from "@/ai/intentDeclaration";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

const villageIntent = (summary: string): IntentDeclaration => ({
  ...emptyIntentDeclaration(), mode: "create", space: "outdoor", tools: ["author_village"], summary, source: "llm",
});

describe("village reference examples", () => {
  it("picks the settlement that matches the request words", () => {
    const project = createBlankProject();
    expect(villageReferenceExamples(project, "바닷가 어촌 마을 하나")[0]?.id).toBe("reed-bay-village-71x52");
    expect(villageReferenceExamples(project, "절벽 위 폭포 마을")[0]?.id).toBe("twin-falls-river-village-62x65");
    expect(villageReferenceExamples(project, "숲마을 만들어줘")[0]?.id).toBe("river-forest-village-78x44");
    expect(villageReferenceExamples(project, "호숫가 마을")[0]?.id).toBe("lake-village-60x60");
    // 기후 사례는 기후를 말할 때만 앞에 온다.
    expect(villageReferenceExamples(project, "숲마을 만들어줘").some(example => example.id.startsWith("climate-"))).toBe(false);
  });

  it("puts a [참고 마을] block in the Pi intent note", () => {
    const project = createBlankProject();
    const note = buildPiIntentNote({ project, intent: villageIntent("바닷가 어촌"), requestText: "바닷가 어촌 마을 하나",
      targetMap: { id: project.startMapId, width: 20, height: 15, lived: false }, selection: null }) ?? "";
    expect(note).toContain("[참고 마을]");
    expect(note).toContain("갈대물굽이 포구");
    expect(formatVillageReferenceNote([])).toBeNull();
  });

  it("takes the unstated house count, size and a buildable layout from the closest reference", () => {
    const project = createBlankProject();
    const contract = resolveVillageContract(project, villageIntent("바닷가 어촌"), project.startMapId, null, "바닷가 어촌 마을 하나")!;
    expect(contract.houseCount).toBe(8);
    expect(contract.referenceId).toBe("reed-bay-village-71x52");
    expect(contract.args.theme).toBe("바닷가 포구 어촌 선착장");
    expect((contract.args.target as { minSize?: unknown }).minSize).toEqual({ width: 71, height: 52 });
    const cliff = resolveVillageContract(createBlankProject(), villageIntent("절벽"), project.startMapId, null, "층층 절벽 마을")!;
    expect(cliff.args).toMatchObject({ morphology: "cluster", relief: "hills", seed: 7 });
    // 폭포·강을 말하면 물이 먼저다.
    const falls = resolveVillageContract(createBlankProject(), villageIntent("폭포"), project.startMapId, null, "절벽 위 폭포 마을")!;
    expect(falls.args.morphology).toBe("river");
    const stated = resolveVillageContract(project, { ...villageIntent("x"), construction: { houseCount: 3 } }, project.startMapId, null, "바닷가 어촌 마을 하나")!;
    expect(stated.houseCount).toBe(3);
    // 사용자가 배치를 말하면 사례 배치를 덮어쓰지 않는다.
    const told = resolveVillageContract(project, { ...villageIntent("x"), construction: { morphology: "street" } }, project.startMapId, null, "바닷가 어촌 마을 하나")!;
    expect(told.args.morphology).toBe("street");
    expect(told.args.theme).toBeUndefined();
  });

  it("author_village returns the chosen reference and a small model image, and the build still succeeds", async () => {
    const project = createBlankProject();
    const contract = resolveVillageContract(project, villageIntent("바닷가 어촌"), project.startMapId, null, "바닷가 어촌 마을 하나")!;
    const ctx = { project };
    const result = runTool(ctx, "author_village", { ...contract.args, referenceId: contract.referenceId, interior: false, forestDensity: "normal" });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps[project.startMapId]).toMatchObject({ width: 71, height: 52 });
    expect(result.summary).toContain("갈대물굽이 포구");
    const data = result.data as { referenceVillages?: { id: string }[] };
    expect(data.referenceVillages?.[0]?.id).toBe("reed-bay-village-71x52");
    const images = await villageReferenceImages(data);
    expect(images).toHaveLength(1);
    // 모델 입력은 원본(0.4MB+)이 아니라 축소본이다.
    expect(images[0]!.dataUrl.length).toBeLessThan(200_000);
  });
});
