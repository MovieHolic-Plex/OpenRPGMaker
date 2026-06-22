import { describeChipsetTile, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { el } from "@/util/dom";

export function renderTileMappingInspector(selectedTile: number): HTMLElement {
  const tile = describeChipsetTile(selectedTile);
  const root = el("div", {
    class: "tile-mapping-inspector",
    dataset: { testid: "tile-mapping-inspector" },
  });
  root.append(el("div", { class: "tile-mapping-title", text: `#${tileDisplayLabelForIndex(tile.index)}` }));
  root.append(el("div", { class: "tile-mapping-meta", text: `키: ${tile.key}` }));
  root.append(el("div", { class: "tile-mapping-meta", text: `AI 라벨: ${tile.aiLabel}` }));
  root.append(el("div", { class: "tile-mapping-meta", text: `열 ${tile.column}, 행 ${tile.row}` }));
  root.append(
    el("div", {
      class: "tile-mapping-meta",
      text: `${layerLabel(tile.layer)} / ${passageLabel(tile.passage)} / 지형 ${tile.terrainTag} / ${repeatRoleLabel(tile.repeatRole)} / ${usageLabel(tile.usage)}`,
    })
  );
  root.append(el("div", { class: "tile-mapping-meta", text: `태그(AI): ${tile.tags.join(", ")}` }));
  root.append(el("div", { class: "tile-mapping-meta", text: tile.confirmed ? "매핑 확정" : "매핑 미확정" }));
  return root;
}

function layerLabel(layer: "lower" | "upper"): string {
  return layer === "lower" ? "하층" : "상층";
}

function passageLabel(passage: "passable" | "solid"): string {
  return passage === "passable" ? "통행 가능" : "통행 불가";
}

function repeatRoleLabel(role: "body" | "variant" | "detail" | "edge" | "object" | "single"): string {
  const labels = {
    body: "중심",
    variant: "변형",
    detail: "장식",
    edge: "외곽",
    object: "오브젝트",
    single: "단일",
  } as const;
  return labels[role];
}

function usageLabel(usage: "terrain" | "path" | "edge" | "detail" | "structure" | "decoration" | "empty" | "unknown"): string {
  const labels = {
    terrain: "지형",
    path: "길",
    edge: "외곽",
    detail: "디테일",
    structure: "구조물",
    decoration: "장식",
    empty: "빈칸",
    unknown: "미분류",
  } as const;
  return labels[usage];
}
