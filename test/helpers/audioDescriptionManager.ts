import { vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { resetModalStackForTest } from "@/editor/ui/modalStack";

export function control<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control: ${id}`);
  return node;
}

export function chooseKind(kind: "music" | "sound"): void {
  const index = kind === "music" ? 9 : 12;
  const button = control("resource-category-list").querySelectorAll("button")[index];
  if (!button) throw new Error(`Missing category: ${kind}`);
  button.click();
}

export function row(id: string): HTMLButtonElement {
  const node = [...document.querySelectorAll<HTMLButtonElement>('[data-testid="audio-resource-row"]')]
    .find(candidate => candidate.dataset.resourceId === id);
  if (!node) throw new Error(`Missing audio row: ${id}`);
  return node;
}

export function writeDraft(value: string): HTMLTextAreaElement {
  const input = control<HTMLTextAreaElement>("audio-description-input");
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input;
}

export function setupAudioManager(): void {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
  const project = createBlankProject();
  for (const [id, kind] of [
    ["audio-a", "music"], ["audio-b", "music"], ["audio-se", "sound"],
  ] as const) {
    project.assets.uploaded[id] = {
      id, kind, name: id, dataUrl: "data:audio/ogg;base64,T2dnUw==", meta: {},
    };
    project.resourceProfiles.push({ kind, name: id, assetId: id });
  }
  store.replaceProject(project);
  resetMapEditHistory();
  openResourceModal();
}

export function cleanupAudioManager(): void {
  store.replaceProject(createBlankProject());
  vi.restoreAllMocks();
  resetModalStackForTest();
  document.body.replaceChildren();
  resetMapEditHistory();
}

export function chooseFile(file: File): void {
  const input = control<HTMLInputElement>("resource-file-input");
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Observe the real FileReader completion before initiating the UI import. */
export async function readFileThroughManager(file: File): Promise<void> {
  const original = FileReader.prototype.readAsDataURL;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let complete: () => void = () => {};
  const loaded = new Promise<void>((resolve, reject) => {
    complete = resolve;
    timeout = setTimeout(() => reject(new Error("FileReader did not finish")), 5000);
  });
  const reader = vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (
    this: FileReader, blob: Blob,
  ) {
    this.addEventListener("loadend", complete, { once: true });
    original.call(this, blob);
  });
  try {
    chooseFile(file);
    await loaded;
  } finally {
    clearTimeout(timeout);
    reader.mockRestore();
  }
}
