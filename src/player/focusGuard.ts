// 내보낸 게임이 다른 페이지(스토어 플레이 화면 등)의 iframe 안에서 돌 때 키보드 초점을 지킨다(2026-10-24).
//
// - 처음 뜰 때와 화면을 누를 때마다 이 창과 게임 캔버스에 초점을 준다(부모 페이지로 키가 새지 않게).
// - 게임 키(방향키·스페이스·페이지 키)의 기본 동작(스크롤)을 막는다. 이벤트는 그대로 흘러 게임이 읽는다.
// - 창이 초점을 잃거나 숨겨지면 누르고 있던 키를 모두 뗀 것으로 친다 — 「손을 뗐는데 캐릭터가 계속 걷는다」를 막는다.
//   모든 입력 경로(Phaser·input.ts·heldKeyTracker)가 같은 keyup 을 받도록 진짜 keyup 이벤트를 다시 보낸다.
import { isTextEntryTarget } from "@/player/keyBindings";

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Spacebar", "PageUp", "PageDown", "Home", "End"]);

interface HeldKey { readonly key: string; readonly code: string; readonly keyCode: number }

let installed = false;

function isActivatable(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("button, a[href], summary, select, [role=button]") !== null;
}

function focusGame(root: HTMLElement): void {
  try { window.focus(); } catch { /* 일부 브라우저는 막는다 */ }
  const active = document.activeElement;
  // 대화 입력칸·버튼 같은 DOM 조작 중이면 초점을 빼앗지 않는다.
  if (active && active !== document.body && active !== document.documentElement && root.contains(active) && !(active instanceof HTMLCanvasElement)) return;
  const canvas = root.querySelector("canvas");
  if (!canvas) return;
  if (!canvas.hasAttribute("tabindex")) canvas.setAttribute("tabindex", "-1");
  canvas.focus({ preventScroll: true });
}

export function installFocusGuard(root: HTMLElement): void {
  if (installed) return;
  installed = true;
  const held = new Map<string, HeldKey>();

  window.addEventListener("keydown", (event) => {
    if (event.isTrusted) held.set(event.code || event.key, { key: event.key, code: event.code, keyCode: event.keyCode });
    if (!SCROLL_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (isTextEntryTarget(event.target)) return;
    // 스페이스는 단추를 누르는 키이기도 하다 — 단추 위에서는 그대로 둔다(방향키 스크롤만 막는다).
    if ((event.key === " " || event.key === "Spacebar") && isActivatable(event.target)) return;
    event.preventDefault();
  }, { capture: true });
  window.addEventListener("keyup", (event) => { held.delete(event.code || event.key); }, { capture: true });

  const releaseAll = (): void => {
    if (held.size === 0) return;
    const keys = [...held.values()];
    held.clear();
    const target = document.activeElement ?? document.body;
    for (const key of keys) {
      target.dispatchEvent(new KeyboardEvent("keyup", { key: key.key, code: key.code, keyCode: key.keyCode, bubbles: true, cancelable: true }));
    }
  };
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") releaseAll(); });
  window.addEventListener("pagehide", releaseAll);

  root.addEventListener("pointerdown", () => focusGame(root), { capture: true });
  // 캔버스는 부팅 뒤에 생긴다 — 생기면 한 번 초점을 준다.
  focusGame(root);
  if (!root.querySelector("canvas")) {
    const observer = new MutationObserver(() => {
      if (!root.querySelector("canvas")) return;
      observer.disconnect();
      focusGame(root);
    });
    observer.observe(root, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 60_000);
  }
}
