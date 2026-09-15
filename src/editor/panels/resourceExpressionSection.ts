import { FACE_EXPRESSION_SETS } from "@/assets/faceExpressionSets";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { ResourceProfile } from "@/project/types";
import { el } from "@/util/dom";

export function renderExpressionSection(onSelect: (profile: ResourceProfile) => void): HTMLElement {
  const section = el("section", { class: "rm-expression-section", dataset: { testid: "resource-expression-section" } });
  section.append(el("h3", { text: "표정 관리" }), el("p", { class: "rm-expression-description", text: "캐릭터를 고르고 표정을 눌러 미리보세요." }));
  const chooser = el("select", { class: "rm-expression-character", attrs: { "aria-label": "표정 캐릭터" } }) as HTMLSelectElement;
  for (const set of FACE_EXPRESSION_SETS) chooser.append(el("option", { text: `${set.name} · ${set.faces.length}종`, attrs: { value: set.id } }));
  const group = el("div", { class: "rm-expression-group" });
  section.append(chooser, group);
  const render = () => {
    group.replaceChildren();
    const set = FACE_EXPRESSION_SETS.find(set => set.id === chooser.value) ?? FACE_EXPRESSION_SETS[0];
    group.append(el("div", { class: "rm-expression-summary", text: `${set.name} · 공용 표정 ${set.faces.length}종` }));
    const grid = el("div", { class: "rm-expression-grid", attrs: { "aria-label": `${set.name} 표정` } });
    group.append(grid);
    const buttons: HTMLButtonElement[] = [];
    for (const face of set.faces) {
      const label = face.name.split(" · ").slice(1).join(" · ");
      const button = el("button", {
        class: "rm-expression-card",
        attrs: { type: "button", "aria-label": face.name, "aria-pressed": "false" },
        dataset: { testid: `resource-expression-${face.id}` },
        children: [el("img", { attrs: { src: resolveAssetResourceUrl(face.id) ?? `/${face.path}`, alt: "", width: "48", height: "48" } }), el("span", { text: label })],
      }) as HTMLButtonElement;
      button.addEventListener("click", () => {
        for (const other of buttons) other.setAttribute("aria-pressed", String(other === button));
        onSelect({ kind: "faceset", assetId: face.id, name: face.name, imageWidth: 48, imageHeight: 48 });
      });
      buttons.push(button);
      grid.append(button);
    }
    buttons[0]?.click();
  };
  chooser.addEventListener("change", render);
  render();
  return section;
}
