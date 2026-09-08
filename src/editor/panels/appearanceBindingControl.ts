import { store } from "@/project/store";
import { el } from "@/util/dom";
import { field } from "./databaseControls";

export function appearanceBindingControl(
  appearanceId: string | undefined,
  testid: string,
  onChange: (appearanceId: string | undefined) => void,
): HTMLElement {
  const select = el("select", {
    dataset: { testid },
    children: [
      el("option", { attrs: { value: "" }, text: "연결 안 함 · 직접 지정한 그림" }),
      ...(store.getCurrent().database.characterAppearances ?? []).map((record) =>
        el("option", { attrs: { value: record.id }, text: record.name || record.id })),
    ],
  });
  select.value = appearanceId ?? "";
  select.addEventListener("change", () => onChange(select.value || undefined));
  return field("공유 캐릭터 외형", select);
}
