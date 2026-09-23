import { el } from "@/util/dom";

const LIST_ROOTS = ["/assets/reviewed-places/", "/assets/region-references/"] as const;

/** 목록이 쓰는 축소본. 원본 경로는 상세를 열었을 때 그대로 쓴다. */
export function catalogListImageUrl(src: string): string {
  for (const root of LIST_ROOTS) {
    if (!src.startsWith(root)) continue;
    return `/assets/catalog-thumbs${root.slice("/assets".length)}${src.slice(root.length)}`;
  }
  return src;
}

/** 카드·목록용 그림. 축소본이 없으면 원본으로 한 번만 넘어간다. */
export function catalogListImage(src: string, className: string): HTMLImageElement {
  const img = el("img", {
    class: className,
    attrs: {
      src: catalogListImageUrl(src),
      alt: "",
      draggable: "false",
      decoding: "async",
      loading: "lazy",
    },
  });
  img.addEventListener("error", () => {
    if (img.dataset.usedFull === "1") return;
    img.dataset.usedFull = "1";
    img.src = src;
  });
  return img;
}
