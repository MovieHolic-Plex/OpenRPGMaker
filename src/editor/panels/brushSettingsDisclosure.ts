// src/editor/panels/brushSettingsDisclosure.ts
/**
 * 왼쪽 열 「타일」 섹션의 접힌 「붓 설정」(도구 줄·크기·모양·이웃 연결·구조 보조·선택 타일·붓 보조).
 * 팔레트(tilePalette)와 검사 메뉴(tileToolbarMenus)가 함께 쓴다 — 검사 메뉴는 도구 줄 안에 뜨므로 열기 전에 펴야 보인다.
 * 서로를 import 하면 순환이 생겨 상태를 여기에 둔다.
 */
const STORAGE_KEY = "oprn:brush-settings-open";

let open = read();

function read(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isBrushSettingsOpen(): boolean {
  return open;
}

/** 제자리에서 펴고 접는다 — 팔레트를 다시 짓지 않는다. */
export function setBrushSettingsOpen(next: boolean): void {
  open = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch { /* restricted storage */ }
  if (typeof document === "undefined") return;
  for (const body of document.querySelectorAll<HTMLElement>('[data-testid="palette-brush-settings"]')) body.hidden = !next;
  for (const toggle of document.querySelectorAll<HTMLElement>('[data-testid="palette-brush-settings-toggle"]')) toggle.setAttribute("aria-expanded", String(next));
}

export function resetBrushSettingsForTests(): void {
  open = false;
}
