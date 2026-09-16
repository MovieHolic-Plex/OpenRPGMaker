import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { createStoreHandlers, STORE_CHANNELS } from "./dispatch";
import type { SessionRegistry } from "./sessions";

export function registerIpcHandlers(sessions: SessionRegistry): void {
  const handlers = createStoreHandlers(sessions);
  for (const channel of STORE_CHANNELS) {
    const handler = handlers[channel];
    if (!handler) throw new Error(`${channel}: 핸들러가 없습니다`);
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, payload: unknown) => handler(event.sender.id, payload));
  }
}
