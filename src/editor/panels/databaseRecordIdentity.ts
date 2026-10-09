import { ordinalLabel } from "@/editor/panels/databaseDisplay";
import { el } from "@/util/dom";

export function recordIdentity(collectionLabel: string, id: string, name: string, index: number): HTMLElement {
  return el("fieldset", {
    class: "oprn-db-fieldset oprn-record-identity",
    children: [
      el("legend", { text: collectionLabel }),
      el("div", {
        class: "db-readonly-row",
        children: [el("span", { text: "번호" }), el("code", { text: index >= 0 ? `${ordinalLabel(index)}:` : "-" })],
      }),
      el("div", {
        class: "db-readonly-row",
        children: [el("span", { text: "ID" }), el("code", { text: id })],
      }),
      el("div", {
        class: "db-readonly-row",
        children: [el("span", { text: "이름" }), el("code", { text: name || "(미등록)" })],
      }),
    ],
  });
}
