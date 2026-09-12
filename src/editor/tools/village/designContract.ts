import type { Project } from "@/project/types";
import type { VillageLayoutPresetRecord } from "@/project/types/village";
import { villageDesignIssue } from "@/project/villageDesign";
import { resolveWorldGenRules, type ResolvedWorldGenRules } from "@/project/worldGenRules";
import { ToolError } from "../types";
import { inferRequirementsFromQuery, type VillageRequirements, type LandmarkKind } from "../villageRequirements";
import { presetOverrides, villageTemplateCatalog } from "./authoringData";
import type { HouseTemplate } from "./constants";

export function selectedVillagePreset(project: Project, args: Record<string, unknown>): VillageLayoutPresetRecord | undefined {
  const id = typeof args.presetId === "string" && args.presetId.trim() ? args.presetId.trim() : project.defaultVillagePresetId;
  if (!id) return undefined;
  const preset = project.villagePresets?.find(p => p.id === id);
  if (!preset && (project.defaultVillagePresetId || project.villagePresets?.some(p => p.design))) throw new ToolError("요청한 마을 설계서가 없습니다. 데이터베이스 → 마을에서 다시 선택하세요.", { code: "village-design-missing" });
  if (preset?.design) {
    const issue = villageDesignIssue(preset.design);
    if (issue) throw new ToolError(issue, { code: "village-design-invalid" });
  }
  return preset;
}

function conflict(preset: VillageLayoutPresetRecord, field: string, expected: unknown, received: unknown): never {
  throw new ToolError(`마을 설계서 「${preset.name}」의 ${field} 설정과 요청이 다릅니다. 설계서: ${JSON.stringify(expected)}, 요청: ${JSON.stringify(received)}. 설계서를 유지해 다시 요청하거나 데이터베이스 → 마을에서 변경안을 확정하세요.`, { code: "village-design-conflict" });
}

/** 파사드 파싱·맵 생성보다 먼저 실행한다. 고정 충돌은 원본이나 초안을 바꾸지 않는다. */
export function resolveVillageDesignInput(project: Project, input: Record<string, unknown>, facade = false): Record<string, unknown> {
  const preset = selectedVillagePreset(project, input);
  if (!preset?.design) return input;
  const design = preset.design;
  const args: Record<string, unknown> = { ...input, presetId: preset.id };
  const values = presetOverrides(preset);
  for (const key of ["kitMix", "pathStyle", "roadWidth", "roadNaturalness", "settlementLayout", "groundTheme", "yardStyle", "plazaStyle", "plazaLayout", "edgeTrees", "npcCount"] as const) {
    if (preset[key] !== undefined && values[key] === undefined) throw new ToolError(`설계서 「${preset.name}」의 ${key} 값이 올바르지 않습니다. 데이터베이스에서 다시 선택하세요.`, { code: "village-design-invalid" });
  }
  const apply = (key: string, value: unknown, fixed: boolean): void => {
    if (value === undefined) return;
    if (fixed && args[key] !== undefined && JSON.stringify(args[key]) !== JSON.stringify(value)) conflict(preset, key, value, args[key]);
    if (fixed || args[key] === undefined) args[key] = value;
  };
  const count = input.houses ?? input.houseCount ?? preset.houseCount ?? design.houseCount.min;
  const range = design.houseCount;
  if (range.mode !== "free" && (typeof count !== "number" || !Number.isInteger(count) || count < range.min || count > range.max)) {
    conflict(preset, "집 수", range.mode === "fixed" ? range.min : `${range.min}~${range.max}`, count);
  }
  if (facade) args.houseCount = count;
  else { args.houses = count; args.houseCount = count; }
  for (const key of ["groundTheme", "settlementLayout", "pathStyle", "roadWidth", "roadNaturalness", "plazaStyle", "plazaLayout", "yardStyle", "edgeTrees"] as const) {
    // 파사드가 받지 않는 값은 시공기에서 같은 계약으로 적용한다.
    if (!facade || key === "groundTheme" || key === "settlementLayout") apply(key, values[key], design.policies.layout === "fixed");
  }
  if (!facade && !design.objectVillage) apply("kitMix", values.kitMix, design.policies.appearance === "fixed");
  if (design.policies.appearance === "fixed" && !design.objectVillage) designTemplateCatalog(project, preset, villageTemplateCatalog(project, preset.templateIds).templates);
  if (design.objectVillage) {
    const o = design.objectVillage;
    apply("composition", o.composition, design.policies.layout === "fixed");
    apply("houseClustering", o.clustering, design.policies.layout === "fixed");
    apply("houseObjectIds", o.objectIds, design.policies.appearance === "fixed");
    apply("multiStoreyCount", o.multiStoreyCount, design.policies.appearance === "fixed");
    if (design.policies.appearance === "fixed" && Array.isArray(args.housePlans)) {
      for (const plan of args.housePlans) if (plan?.objectId && !o.objectIds.includes(plan.objectId)) conflict(preset, "허용 건물", o.objectIds, plan.objectId);
    }
  }
  apply("npcCount", values.npcCount, design.policies.residents === "fixed");
  apply("interior", design.interior, design.policies.interior === "fixed");
  if (design.policies.interior === "fixed" && design.interior && input.doorEvent === false) conflict(preset, "실내 출입", "문 연결", false);
  if (design.policies.nature === "fixed") {
    const forest = design.nature.forest;
    if (forest === "none") {
      if (args.forestDensity !== undefined) conflict(preset, "숲", "없음", args.forestDensity);
    } else apply("forestDensity", forest, true);
    if (input.skipTerrainPass === true) conflict(preset, "자연 시공", "설계서 적용", "생략");
  }
  if (design.policies.appearance === "fixed" && !design.objectVillage && Array.isArray(args.housePlans)) {
    const allowed = designTemplateCatalog(project, preset, villageTemplateCatalog(project, preset.templateIds).templates);
    const ids = new Set(allowed.map(t => t.id));
    for (const raw of args.housePlans) {
      if (!raw || typeof raw !== "object") continue;
      const plan = raw as Record<string, unknown>;
      if (values.kitMix && values.kitMix !== "mixed" && plan.kitId !== undefined && plan.kitId !== values.kitMix) conflict(preset, "집 재료", values.kitMix, plan.kitId);
      if (typeof plan.templateId === "string" && !ids.has(plan.templateId)) conflict(preset, "허용 집 형태", [...ids], plan.templateId);
    }
  }
  return args;
}

/** 기존 레이어 세션은 자연 설정을 별도로 시공한다. 설계서를 부분 적용하지 않는다. */
export function assertLegacyVillageSession(project: Project, args: Record<string, unknown>): void {
  if (selectedVillagePreset(project, args)?.design) throw new ToolError("마을 설계서는 author_village로 시공하세요. 기존 레이어별 세션은 설계서 계약을 지원하지 않으므로 시작하지 않았습니다.", { code: "village-design-use-author" });
}

/** 형태에 고정된 킷(삼각 지붕·옥상)도 마을의 고정 재료를 우회하지 못한다. */
export function designTemplateCatalog(project: Project, preset: VillageLayoutPresetRecord | undefined, templates: readonly HouseTemplate[]): readonly HouseTemplate[] {
  const design = preset?.design;
  if (!design || design.objectVillage || design.policies.appearance !== "fixed") return templates;
  if (preset.templateIds?.length && !preset.templateIds.some(id => templates.some(t => t.id === id))) {
    throw new ToolError("설계서의 집 형태를 찾을 수 없습니다. 허용 형태를 다시 선택하세요.", { code: "village-design-templates" });
  }
  const chosen = templates.filter(t => design.stories.includes(t.stories ?? 1)
    && (!preset.kitMix || preset.kitMix === "mixed" || !t.kitId || t.kitId === preset.kitMix)
    && (!preset.templateIds?.length || preset.templateIds.includes(t.id)));
  if (chosen.length === 0) throw new ToolError(`「${preset.name}」의 재료·층수·집 형태가 서로 맞지 않습니다. 데이터베이스에서 함께 사용할 수 있는 형태를 선택하세요.`, { code: "village-design-templates" });
  void project;
  return chosen;
}

export function villageDesignWorldRules(project: Project, preset: VillageLayoutPresetRecord | undefined): ResolvedWorldGenRules {
  const d = preset?.design;
  if (!d || d.policies.nature !== "fixed") return resolveWorldGenRules(project.system.worldGen);
  const base = resolveWorldGenRules(project.system.worldGen);
  return resolveWorldGenRules({
    ...project.system.worldGen,
    water: { ...base.water, side: d.nature.waterSide, riverBandRatio: d.nature.riverWidthRatio, riverBandMin: 1, riverBandMax: 64, lakeRatioAlone: d.nature.lakeSizeRatio, lakeRatioWithRiver: d.nature.lakeSizeRatio },
    forest: { ...base.forest, side: d.nature.forestSide, depthRatio: d.nature.forestDepthRatio },
  });
}

export function villageDesignRequirements(project: Project, preset: VillageLayoutPresetRecord | undefined, inferred: VillageRequirements | undefined): VillageRequirements | undefined {
  const d = preset?.design;
  if (!d || d.policies.nature !== "fixed") return inferred;
  const landmarks: LandmarkKind[] = [];
  if (d.nature.water === "river" || d.nature.water === "river-lake") landmarks.push("river");
  if (d.nature.water === "lake" || d.nature.water === "river-lake") landmarks.push("lake");
  if (d.nature.forest !== "none") landmarks.push("forest");
  // 시장·농장 요구는 남기고 물과 숲만 설계서의 명시값으로 바꾼다.
  for (const kind of inferred?.landmarks ?? []) if (kind === "market" || kind === "farm") landmarks.push(kind);
  const base = inferRequirementsFromQuery("", villageDesignWorldRules(project, preset));
  return { ...base, query: preset?.name ?? "마을 설계서", landmarks, mustExist: [...landmarks], riverSide: d.nature.waterSide, forestSide: d.nature.forestSide,
    ...(d.nature.forest === "none" ? {} : { forestDensity: d.nature.forest }) };
}
