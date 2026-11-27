import { contextBridge, ipcRenderer } from "electron";

export const PLAYER_IPC_CHANNELS = Object.freeze({
  writeSaveFile: "oprn-player:write-save",
  readSaveFile: "oprn-player:read-save",
  listSaveFiles: "oprn-player:list-saves",
  toggleFullscreen: "oprn-player:toggle-fullscreen",
  captureScreenshot: "oprn-player:capture-screenshot",
  quit: "oprn-player:quit",
});

const desktopPlayerBridge = Object.freeze({
  writeSaveFile: (relativePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke(PLAYER_IPC_CHANNELS.writeSaveFile, relativePath, content),
  readSaveFile: (relativePath: string): Promise<string | null> =>
    ipcRenderer.invoke(PLAYER_IPC_CHANNELS.readSaveFile, relativePath),
  listSaveFiles: (): Promise<readonly string[]> =>
    ipcRenderer.invoke(PLAYER_IPC_CHANNELS.listSaveFiles),
  toggleFullscreen: (): Promise<boolean> =>
    ipcRenderer.invoke(PLAYER_IPC_CHANNELS.toggleFullscreen),
  captureScreenshot: (): Promise<string | null> =>
    ipcRenderer.invoke(PLAYER_IPC_CHANNELS.captureScreenshot),
  quit: (): Promise<void> =>
    ipcRenderer.invoke(PLAYER_IPC_CHANNELS.quit),
});

contextBridge.exposeInMainWorld("__oprnDesktopPlayer", desktopPlayerBridge);
