import { importSaveCopy, listSaveSlots, type SaveSlotIndex } from "./saveSlots";
import { publicationSaveKey } from "./savePublication";
import { el } from "../util/dom";
import type { Project } from "../project/types";

/** Only author-accepted lineage keys in this listing's scope; no storage enumeration. */
export function appendPredecessorSaveImports(host: HTMLElement, options: {
  readonly project: Project;
  readonly storage: Storage;
  readonly onLoadSlot: (slot: SaveSlotIndex) => void;
}): void {
  const publication = options.project.meta.publication;
  if (!publication) return;
  const destination = listSaveSlots(options.storage).find(slot => slot.kind === "empty")?.slot;
  if (!destination) return;
  const status = el("div", { class: "oprn-load-message", attrs: { role: "status" } });
  for (const lineage of publication.acceptedSaveCompatibilityIds) {
    for (const slot of [1, 2, 3, "auto"] as const) {
      const sourceKey = publicationSaveKey(slot, { ...publication, saveCompatibilityId: lineage });
      if (!sourceKey || options.storage.getItem(sourceKey) === null) continue;
      host.append(el("button", {
        class: "oprn-load-slot system-shell-button",
        text: `이전 저장 ${lineage.slice(0, 8)} · ${slot === "auto" ? "자동" : slot}번 → ${destination}번 복사 후 불러오기`,
        dataset: { testid: `save-slot-import-${lineage}-${slot}` },
        on: { click: () => {
          try {
            importSaveCopy({ project: options.project, storage: options.storage, sourceKey, slot: destination });
            options.onLoadSlot(destination);
          } catch (error) {
            status.textContent = `저장을 복사할 수 없습니다: ${error instanceof Error ? error.message : String(error)}`;
          }
        } },
      }));
    }
  }
  host.append(status);
}
