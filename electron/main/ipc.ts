import { ipcMain } from "electron";
import { OPRN_CHANNELS } from "../shared/channels";
import { listLimitSchema } from "../shared/schemas";
import { createStoreHandlers } from "./dispatch";
import type { SessionRegistry } from "./sessions";

/** IPC and HTTP execute the same project service, including conflict checks. */
export function registerIpcHandlers(sessions: SessionRegistry): void {
  const handlers = createStoreHandlers(sessions);
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, payload: unknown) => handler(event.sender.id, payload));
  }
  ipcMain.on(OPRN_CHANNELS.commitsListSync, (event, payload: unknown) => {
    try { event.returnValue = sessions.require(event.sender.id).store.listCommits(listLimitSchema.parse(payload).limit); }
    catch { event.returnValue = []; }
  });
}
