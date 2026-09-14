import { el } from "@/util/dom";
import { regionReference } from "@/project/regionReferences";

export function regionReferenceImage(id: string, thumbnail = false): HTMLElement {
  const entry = regionReference(id);
  if (!entry) return el("div", { text: "지역 사례를 찾을 수 없습니다." });
  const img = el("img", { class: thumbnail ? "spatial-card-image" : undefined,
    attrs: { src: entry.preview, alt: entry.name, draggable: "false" } });
  img.style.width = "100%"; img.style.height = "100%"; img.style.objectFit = "contain";
  if (!thumbnail) { img.style.maxWidth = "100%"; img.style.maxHeight = "100%"; img.style.objectFit = "contain"; img.style.imageRendering = "pixelated"; }
  const frame = el("div", { dataset: { testid: thumbnail ? "region-reference-thumbnail" : "region-reference-preview" }, children: [img] });
  frame.style.width = "100%"; frame.style.height = "100%"; frame.style.minHeight = "0";
  return frame;
}

export function regionReferenceInspector(id: string): HTMLElement {
  const entry = regionReference(id);
  if (!entry) return el("div");
  return el("div", { dataset: { testid: "region-reference-inspector" }, children: [
    el("h3", { text: entry.name }), el("p", { text: `${entry.kind === "completed-place" ? "완성 장소 사례" : "완성 맵 사례"} · ${entry.width}×${entry.height} · 개정 ${entry.revision}` }),
    el("ul", { children: entry.rules.map(text => el("li", { text })) }),
    el("p", { text: entry.limitations }),
    el("a", { text: "원본 이미지 크게 보기", attrs: { href: entry.preview, target: "_blank", rel: "noopener" } }),
    el("p", { text: `AI 조회: read_region_reference · ${entry.id}` }),
  ] });
}
