import { ipcMain } from "electron";
import { OPRN_CHANNELS } from "../shared/channels";
import { listLimitSchema } from "../shared/schemas";
import { createStoreHandlers } from "./dispatch";
import type { SessionRegistry } from "./sessions";
import { noteMainActivity, preloadProjectCoreWhenIdle } from "./projectCorePreload";

/** 편집기가 프로젝트를 읽었다 — 첫 저장 전에 한가할 때 프로젝트 코어를 미리 읽어 둔다(projectCorePreload.ts). */
const PROJECT_LOAD_CHANNELS: ReadonlySet<string> = new Set([OPRN_CHANNELS.projectLoad, OPRN_CHANNELS.projectLoadFolded]);

/** IPC and HTTP execute the same project service, including conflict checks. */
/** 저장 채널 — 성공하면 onSaved 를 부른다(마지막 편집 화면 찍기, lastView.ts). */
const SAVE_CHANNELS: ReadonlySet<string> = new Set([OPRN_CHANNELS.projectSave, OPRN_CHANNELS.projectSaveMapPatch]);

export function registerIpcHandlers(sessions: SessionRegistry, onSaved?: (webContentsId: number) => void): void {
  const handlers = createStoreHandlers(sessions);
  // OPRN_IPC_TIMING=1 이면 채널마다 처리 시간을 stderr 에 남긴다(시작 속도 측정기 scripts/perf/startup-bench.mjs 가 읽는다).
  const timing = process.env.OPRN_IPC_TIMING === "1";
  for (const [channel, handler] of Object.entries(handlers)) {
    const loadsProject = PROJECT_LOAD_CHANNELS.has(channel);
    const saves = onSaved !== undefined && SAVE_CHANNELS.has(channel);
    const run = (senderId: number, payload: unknown): unknown => {
      noteMainActivity();
      if (loadsProject) preloadProjectCoreWhenIdle();
      const result = handler(senderId, payload);
      if (saves) void Promise.resolve(result).then(() => onSaved?.(senderId), () => {});
      return result;
    };
    ipcMain.handle(channel, timing
      ? async (event, payload: unknown) => {
        const started = performance.now();
        try { return await run(event.sender.id, payload); }
        finally { process.stderr.write(`[ipc-timing] ${channel} ${Math.round(performance.now() - started)}ms at ${Math.round(started)}\n`); }
      }
      : (event, payload: unknown) => run(event.sender.id, payload));
  }
  ipcMain.on(OPRN_CHANNELS.commitsListSync, (event, payload: unknown) => {
    try { event.returnValue = sessions.require(event.sender.id).store.listCommits(listLimitSchema.parse(payload).limit); }
    catch { event.returnValue = []; }
  });
}
