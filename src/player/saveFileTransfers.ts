import { importSelectedSaveFileCopy, listSaveSlots, readAutosave, readSaveSlot, saveSlotKey, type SaveSlotIndex } from "./saveSlots";
import { downloadBlob } from "../util/downloadBlob";
import { el } from "../util/dom";
import type { Project } from "../project/types";

/** No foreign storage reads: the player exports at the source and selects that file at the destination. */
export function appendSaveFileTransfers(host: HTMLElement, options: {
  readonly project: Project;
  readonly storage: Storage;
  readonly onLoadSlot: (slot: SaveSlotIndex) => void;
}): void {
  if (!options.project.meta.publication) return;
  for (const slot of [1, 2, 3, "auto"] as const) {
    const read = () => slot === "auto" ? readAutosave(options.storage) : readSaveSlot(options.storage, slot);
    if (read().kind !== "present") continue;
    host.append(el("button", {
      class: "oprn-load-slot system-shell-button",
      text: `${slot === "auto" ? "자동" : slot + "번"} 저장 파일 내보내기`,
      dataset: { testid: `save-slot-export-${slot}` },
      on: { click: () => {
        const source = read();
        if (source.kind === "present") downloadBlob(new Blob([JSON.stringify(source.snapshot)], { type: "application/json" }), `save-${slot}.json`);
      } },
    }));
  }
  const destination = listSaveSlots(options.storage).find(slot => slot.kind === "empty")?.slot;
  if (!destination) return;
  const target = saveSlotKey(destination);
  const status = el("div", { class: "oprn-load-message", attrs: { role: "status" } });
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json,application/json"; input.hidden = true;
  input.dataset.testid = "save-file-selection";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    void (async () => {
      try {
        if (file.size > 8 * 1024 * 1024) throw new Error("저장 파일이 너무 큽니다");
        const text = await file.text();
        if (!host.isConnected || target !== saveSlotKey(destination)) return;
        importSelectedSaveFileCopy({ ...options, text, slot: destination });
        options.onLoadSlot(destination);
      } catch (error) {
        status.textContent = `저장을 복사할 수 없습니다: ${error instanceof Error ? error.message : String(error)}`;
      }
    })();
  });
  host.append(input, el("button", {
    class: "oprn-load-slot system-shell-button",
    text: `다른 게시물에서 내보낸 저장 파일 선택 → ${destination}번 복사 후 불러오기`,
    dataset: { testid: "save-slot-select-file" },
    on: { click: () => input.click() },
  }), status);
}
