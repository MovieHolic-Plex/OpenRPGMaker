// editor/tools/village/morphologyTypes.ts
// 취락 형태 유형 enum — 계약(construction/contracts)·툴 스키마·계획기가 같은 리터럴을 본다. import 없음.

export const VILLAGE_MORPHOLOGIES = ["street", "green", "round", "cluster"] as const;
export type VillageMorphology = (typeof VILLAGE_MORPHOLOGIES)[number];

export const MORPHOLOGY_LABEL: Readonly<Record<VillageMorphology, string>> = {
  street: "가로촌(Straßendorf)",
  green: "광장촌(Angerdorf)",
  round: "환촌(Rundling)",
  cluster: "괴촌(Haufendorf)",
};

export function isVillageMorphology(value: unknown): value is VillageMorphology {
  return typeof value === "string" && (VILLAGE_MORPHOLOGIES as readonly string[]).includes(value);
}
