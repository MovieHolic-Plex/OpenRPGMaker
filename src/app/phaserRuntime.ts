import type Phaser from "phaser";

declare global {
  interface Window {
    Phaser?: typeof Phaser;
  }
}

const PHASER_SCRIPT_SRC = new URL("../../node_modules/phaser/dist/phaser.min.js", import.meta.url).href;

let loadPromise: Promise<typeof Phaser> | null = null;

export function ensurePhaser(): Promise<typeof Phaser> {
  if (window.Phaser) return Promise.resolve(window.Phaser);
  loadPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PHASER_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Phaser) {
        resolve(window.Phaser);
        return;
      }
      reject(new Error("Phaser script loaded without exposing window.Phaser"));
    };
    script.onerror = () => reject(new Error(`Failed to load ${PHASER_SCRIPT_SRC}`));
    document.head.append(script);
  });
  return loadPromise;
}

export function getLoadedPhaser(): typeof Phaser {
  const phaser = window.Phaser;
  if (!phaser) {
    throw new Error("Phaser runtime has not been loaded");
  }
  return phaser;
}
