import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { listLimitSchema } from "../shared/schemas";
import { OPRN_CHANNELS } from "../shared/channels";
import { createStoreHandlers, parseOrThrow, STORE_CHANNELS } from "./dispatch";
import type { SessionRegistry } from "./sessions";

export function registerIpcHandlers(sessions: SessionRegistry): void {
  const handlers = createStoreHandlers(sessions);
  for (const channel of STORE_CHANNELS) {
    const handler = handlers[channel];
    if (!handler) throw new Error(`${channel}: 핸들러가 없습니다`);
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, payload: unknown) => handler(event.sender.id, payload));
  }

  // 동기 호출은 여기 한 곳뿐이다 — AI 도구 list_project_commits 가 동기 XHR 을 쓴다(설계 5절).
  ipcMain.on(OPRN_CHANNELS.commitsListSync, (event, payload: unknown) => {
    try {
      const input = parseOrThrow(listLimitSchema, payload, OPRN_CHANNELS.commitsListSync);
      event.returnValue = sessions.require(event.sender.id).store.listCommits(input.limit);
    } catch (error) {
      event.returnValue = [];
      void error;
    }
  });
}
