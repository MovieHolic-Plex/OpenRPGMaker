const STORAGE_KEY = "oprn:small-task-preview";

export function readSmallTaskPreviewPreference(): boolean {
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSmallTaskPreviewPreference(enabled: boolean): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // 저장소 접근이 제한되어도 편집은 계속할 수 있다.
  }
}
