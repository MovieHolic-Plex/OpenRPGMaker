import { vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { RESOURCE_MANAGER_CATEGORIES } from "@/editor/panels/resourceManager";
import { resetModalStackForTest } from "@/editor/ui/modalStack";

export function control<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control: ${id}`);
  return node;
}

export function chooseKind(kind: "music" | "sound"): void {
  // 위치가 아니라 이름으로 고른다 — 얼굴 그래픽 아래 「표정 관리」 줄이 끼면서 번호가 한 칸씩 밀렸다.
  const label = RESOURCE_MANAGER_CATEGORIES.find(category => category.kind === kind)?.label;
  const button = [...control("resource-category-list").querySelectorAll("button")]
    .find(candidate => candidate.getAttribute("aria-label") === label);
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

// happy-dom 에는 레이아웃이 없어 음원 목록(가상 스크롤, rm-audio-rows)이 높이 0 으로 보고 앞 80줄만 그린다.
// 목록 전체를 다루는 이 시험들에는 긴 화면을 준다 — 그 목록 상자에만.
let restoreRowsHeight: (() => void) | null = null;
function giveAudioRowsAViewport(): void {
  const proto = HTMLElement.prototype;
  const own = Object.getOwnPropertyDescriptor(proto, "clientHeight");
  const inherited = own ?? Object.getOwnPropertyDescriptor(Element.prototype, "clientHeight");
  Object.defineProperty(proto, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      if (this.classList?.contains("rm-audio-rows")) return 100_000;
      return inherited?.get ? inherited.get.call(this) : 0;
    },
  });
  restoreRowsHeight = () => {
    if (own) Object.defineProperty(proto, "clientHeight", own);
    else Reflect.deleteProperty(proto, "clientHeight");
  };
}

export function setupAudioManager(): void {
  giveAudioRowsAViewport();
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
  restoreRowsHeight?.();
  restoreRowsHeight = null;
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

/** Await the real load handler, including its asynchronous durable-import work. */
export async function readFileThroughManager(file: File): Promise<void> {
  const original = FileReader.prototype.readAsDataURL;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let complete: () => void = () => {};
  let failed: (error: unknown) => void = () => {};
  const loaded = new Promise<void>((resolve, reject) => {
    complete = resolve;
    failed = reject;
    timeout = setTimeout(() => reject(new Error("File import did not finish")), 10000);
  });
  const reader = vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (
    this: FileReader, blob: Blob,
  ) {
    const onload = this.onload;
    this.onload = event => {
      const work = onload?.call(this, event);
      void Promise.resolve(work).then(complete, failed);
    };
    this.addEventListener("error", () => failed(this.error ?? new Error("FileReader failed")), { once: true });
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
