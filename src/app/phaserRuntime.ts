import type Phaser from "phaser";

declare global {
  interface Window {
    Phaser?: typeof Phaser;
  }
}

const PHASER_SCRIPT_SRC = new URL("../../node_modules/phaser/dist/phaser.min.js", import.meta.url).href;

let loadPromise: Promise<typeof Phaser> | null = null;

function loadPhaserOnce(): Promise<typeof Phaser> {
  if (window.Phaser) return Promise.resolve(window.Phaser);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PHASER_SCRIPT_SRC;
    script.async = true;
    const fail = (error: Error): void => {
      loadPromise = null;
      script.remove();
      reject(error);
    };
    script.onload = () => {
      if (window.Phaser) {
        resolve(window.Phaser);
        return;
      }
      fail(new Error("Phaser script loaded without exposing window.Phaser"));
    };
    script.onerror = () => fail(new Error(`Failed to load ${PHASER_SCRIPT_SRC}`));
    document.head.append(script);
  });
  return loadPromise;
}

export async function ensurePhaser(): Promise<typeof Phaser> {
  if (window.Phaser) return Promise.resolve(window.Phaser);
  try {
    return await loadPhaserOnce();
  } catch (first) {
    // 첫 <script> 가 거절된 Promise 를 붙잡고 있으면 「다시 시도」가 영원히 같은
    // 거부를 되풀이한다. 손잡이는 fail() 이 이미 비웠으므로 여기서 한 번 더 받는다.
    try {
      return await loadPhaserOnce();
    } catch {
      throw first;
    }
  }
}

export function getLoadedPhaser(): typeof Phaser {
  const phaser = window.Phaser;
  if (!phaser) {
    throw new Error("Phaser runtime has not been loaded");
  }
  return phaser;
}

export function _resetPhaserRuntimeForTest(): void {
  loadPromise = null;
}
