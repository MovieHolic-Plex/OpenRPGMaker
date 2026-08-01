import { nativeManifestEntry } from "../specTypes";

export const SYSTEM_SPECS = {
  killPlayer: nativeManifestEntry("system", { kind: "killPlayer", message: "Contract defeat" }),
  triggerEnding: nativeManifestEntry("system", { kind: "triggerEnding" }),
  gameOver: nativeManifestEntry("system", { kind: "gameOver" }),
  ending: nativeManifestEntry("system", {
    kind: "ending",
    title: "Contract ending",
    message: "Contract complete",
  }),
  returnToTitle: nativeManifestEntry("system", { kind: "returnToTitle" }),
  openSaveMenu: nativeManifestEntry("system", { kind: "openSaveMenu" }),
  m2Command: nativeManifestEntry("system", {
    kind: "m2Command",
    commandId: "m2-002-display-text-settings",
    fields: {},
  }),
} as const;
