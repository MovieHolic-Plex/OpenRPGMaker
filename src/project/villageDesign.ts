import type { VillageDesign, VillageLayoutPresetRecord } from "./types/village";

export const VILLAGE_DESIGN_GROUPS = ["appearance", "layout", "nature", "residents", "interior"] as const;
export const VILLAGE_DESIGN_GROUP_LABELS = {
  appearance: "집 외형", layout: "길과 배치", nature: "물과 숲", residents: "주민 수", interior: "실내 연결",
} as const;

/** 사람이 전환 버튼을 누를 때만 호출한다. 로드나 AI 호출은 레코드를 만들지 않는다. */
export function asVillageDesign(preset: VillageLayoutPresetRecord): VillageLayoutPresetRecord {
  if (preset.design) return structuredClone(preset);
  const count = preset.houseCount ?? 6;
  return {
    ...preset,
    houseCount: count,
    kitMix: preset.kitMix ?? "amber-wood",
    pathStyle: preset.pathStyle ?? "sand",
    roadWidth: preset.roadWidth ?? 2,
    roadNaturalness: preset.roadNaturalness ?? 0.6,
    settlementLayout: preset.settlementLayout ?? "clusters",
    groundTheme: preset.groundTheme ?? "grass",
    yardStyle: preset.yardStyle ?? "garden",
    plazaStyle: preset.plazaStyle ?? "garden",
    plazaLayout: preset.plazaLayout ?? "center",
    edgeTrees: preset.edgeTrees ?? "conifer",
    npcCount: preset.npcCount ?? 0,
    design: {
      version: 1, revision: 1,
      policies: { appearance: "fixed", layout: "fixed", nature: "fixed", residents: "fixed", interior: "fixed" },
      houseCount: { mode: "fixed", min: count, max: count },
      stories: [1, 2, 3], interior: true,
      nature: { water: "none", waterSide: "east", forest: "none", forestSide: "west", riverWidthRatio: 0.12, lakeSizeRatio: 0.28, forestDepthRatio: 0.14 },
    },
  };
}

/** 저장 데이터와 직접 호출에서 공유하는 검사. 잘못된 고정값을 자유로 바꾸지 않는다. */
export function villageDesignIssue(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "설계서는 객체여야 합니다.";
  const d = value as Partial<VillageDesign>;
  if (d.version !== 1 || !Number.isInteger(d.revision) || Number(d.revision) < 1) return "설계서 버전이 올바르지 않습니다.";
  if (!d.policies || VILLAGE_DESIGN_GROUPS.some(key => !["fixed", "free"].includes(d.policies?.[key] ?? ""))) return "설계서의 고정·자유 설정이 올바르지 않습니다.";
  const c = d.houseCount;
  if (!c || !["fixed", "range", "free"].includes(c.mode) || !Number.isInteger(c.min) || !Number.isInteger(c.max) || c.min < 1 || c.max > 32 || c.min > c.max) return "집 수 범위는 1~32 안에서 최소 ≤ 최대여야 합니다.";
  if (c.mode === "fixed" && c.min !== c.max) return "고정 집 수의 최소·최대는 같아야 합니다.";
  if (!Array.isArray(d.stories) || d.stories.length === 0 || d.stories.some(n => !(d.objectVillage ? [1, 2, 3, 4] : [1, 2, 3]).includes(n))) return "허용 층수를 하나 이상 선택하세요.";
  if (typeof d.interior !== "boolean") return "실내 연결 설정이 올바르지 않습니다.";
  const o = d.objectVillage;
  if (o !== undefined) {
    if (!o || o.composition !== "compact" || !["balanced", "tight"].includes(o.clustering)) return "저장 건물 배치 설정이 올바르지 않습니다.";
    if (!Array.isArray(o.objectIds) || !o.objectIds.length || o.objectIds.length > 128 || o.objectIds.some(id => typeof id !== "string" || !id.trim()) || new Set(o.objectIds).size !== o.objectIds.length) return "건물 오브젝트 후보는 중복 없는 ID 1~128개여야 합니다.";
    if (!Number.isInteger(o.multiStoreyCount) || o.multiStoreyCount < 0 || o.multiStoreyCount > c.min) return "2층 이상 건물 수는 전체 최소 집 수 이하여야 합니다.";
    if (!o.previewSize || ![o.previewSize.width, o.previewSize.height].every(n => Number.isInteger(n) && n >= 20 && n <= 256)) return "기준 맵 크기는 20~256칸이어야 합니다.";
    if (d.interior) return "저장 건물 외형의 실내 공간은 별도로 연결해야 합니다.";
    if (o.decorations !== undefined && (!Array.isArray(o.decorations) || o.decorations.length > 32
      || o.decorations.some(r => !r || typeof r.spaceId !== "string" || !r.spaceId.trim()
        || !["house", "commons", "market", "shore", "road"].includes(r.zone)
        || !Number.isInteger(r.maxCount) || r.maxCount < 1 || r.maxCount > 32)
      || new Set(o.decorations.map(r => r.spaceId)).size !== o.decorations.length)) return "마을 장식 공간은 중복 없는 ID와 배치 구역, 1~32회 반복 한도가 필요합니다.";
  }
  const n = d.nature;
  if (!n || !["none", "river", "lake", "river-lake"].includes(n.water) || !["none", "sparse", "normal", "dense", "impassable"].includes(n.forest)) return "물과 숲 종류가 올바르지 않습니다.";
  if (![n.waterSide, n.forestSide].every(side => ["north", "south", "east", "west"].includes(side))) return "물과 숲 방향이 올바르지 않습니다.";
  if (![n.riverWidthRatio, n.lakeSizeRatio, n.forestDepthRatio].every(ratio => typeof ratio === "number" && Number.isFinite(ratio) && ratio >= 0.05 && ratio <= 0.45)) return "자연 영역 비율은 5~45%여야 합니다.";
  return undefined;
}
