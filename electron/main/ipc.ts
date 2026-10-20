import { ipcMain } from "electron";
import { OPRN_CHANNELS } from "../shared/channels";
import { listLimitSchema } from "../shared/schemas";
import { createStoreHandlers } from "./dispatch";
import type { SessionRegistry } from "./sessions";

/** IPC and HTTP execute the same project service, including conflict checks. */
export function registerIpcHandlers(sessions: SessionRegistry): void {
  const handlers = createStoreHandlers(sessions);
  // OPRN_IPC_TIMING=1 이면 채널마다 처리 시간을 stderr 에 남긴다(시작 속도 측정기 scripts/perf/startup-bench.mjs 가 읽는다).
  const timing = process.env.OPRN_IPC_TIMING === "1";
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, timing
      ? async (event, payload: unknown) => {
        const started = performance.now();
        try { return await handler(event.sender.id, payload); }
        finally { process.stderr.write(`[ipc-timing] ${channel} ${Math.round(performance.now() - started)}ms at ${Math.round(started)}\n`); }
      }
      : (event, payload: unknown) => handler(event.sender.id, payload));
  }
  ipcMain.on(OPRN_CHANNELS.commitsListSync, (event, payload: unknown) => {
    try { event.returnValue = sessions.require(event.sender.id).store.listCommits(listLimitSchema.parse(payload).limit); }
    catch { event.returnValue = []; }
  });
}
