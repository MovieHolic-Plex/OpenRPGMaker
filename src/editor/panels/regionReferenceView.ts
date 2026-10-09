import { catalogListImage } from "@/editor/panels/catalogListImage";
import { el } from "@/util/dom";
import { regionReference } from "@/project/regionReferences";
import { spatialReferenceDocuments } from './spatialReferenceDocuments';
import type { TilesetReferenceCategory } from '@/project/tilesetReferences';

export function regionReferenceImage(id: string, thumbnail = false): HTMLElement {
  const entry = regionReference(id);
  if (!entry) return el("div", { text: "지역 사례를 찾을 수 없습니다." });
  const img = thumbnail
    ? catalogListImage(entry.preview, "spatial-card-image")
    : el("img", { attrs: { src: entry.preview, alt: entry.name, draggable: "false" } });
  if (thumbnail) img.alt = entry.name;
  img.style.width = "100%"; img.style.height = "100%"; img.style.objectFit = "contain";
  if (!thumbnail) { img.style.maxWidth = "100%"; img.style.maxHeight = "100%"; img.style.objectFit = "contain"; img.style.imageRendering = "pixelated"; }
  const frame = el("div", { dataset: { testid: thumbnail ? "region-reference-thumbnail" : "region-reference-preview" }, children: [img] });
  frame.style.width = "100%"; frame.style.height = "100%"; frame.style.minHeight = "0";
  return frame;
}

export function regionReferenceInspector(id: string): HTMLElement {
  const entry = regionReference(id);
  if (!entry) return el("div");
  // 먼저 할 수 있는 일(내려받기·크게 보기)을 보이고, 제작 규칙 메모는 접는다 —
  // 「성벽 수직 벽면 3칸…」 같은 생성 노트가 상세 칸 정면을 차지해 초보에게 읽을 거리만 늘렸다.
  const rules = document.createElement("details");
  rules.className = "region-reference-rules";
  rules.append(
    el("summary", { text: `만든 규칙 ${entry.rules.length}개` }),
    el("ul", { children: entry.rules.map(text => el("li", { text })) }),
    el("p", { text: entry.limitations }),
    el("p", { text: `AI 조회: read_region_reference · ${entry.id}` }),
  );
  return el("div", { dataset: { testid: "region-reference-inspector" }, children: [
    el("h3", { text: entry.name }), el("p", { text: `${entry.kind === "completed-place" ? "완성 장소 예시" : "완성 맵 예시"} · ${entry.width}×${entry.height} · 읽기 전용` }),
    ...("projectDownload" in entry ? [el("p", { children: [el("a", {
      text: `${entry.kind === "completed-place" ? "장소" : "지역"} 맵 파일 내려받기 · 칩셋 포함`,
      attrs: { href: entry.projectDownload, download: `${entry.name}.oprn.json` },
      dataset: { testid: "region-reference-download" },
    })] })] : []),
    el("a", { text: "원본 이미지 크게 보기", attrs: { href: entry.preview, target: "_blank", rel: "noopener" } }),
    rules,
    ...spatialReferenceDocuments('referenceDocuments' in entry ? entry.referenceDocuments as TilesetReferenceCategory[] : undefined),
  ] });
}
