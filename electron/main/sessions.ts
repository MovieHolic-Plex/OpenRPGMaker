import { existsSync } from "node:fs";
import { join } from "node:path";
import { initLocalProjectStore, type LocalProjectStore } from "../local-store/store";

export type ProjectSession = {
  readonly projectDir: string;
  readonly store: LocalProjectStore;
};

export function createWindowSessionRegistry() {
  const byWebContents = new Map<number, ProjectSession>();
  const byProjectDir = new Map<string, ProjectSession>();

  return {
    async open(webContentsId: number, projectDir: string): Promise<ProjectSession> {
      const existing = byProjectDir.get(projectDir)
        ?? { projectDir, store: await initLocalProjectStore({ projectDir }) };
      byProjectDir.set(projectDir, existing);
      byWebContents.set(webContentsId, existing);
      return existing;
    },
    get(webContentsId: number): ProjectSession | null {
      return byWebContents.get(webContentsId) ?? null;
    },
    require(webContentsId: number): ProjectSession {
      const session = byWebContents.get(webContentsId);
      if (!session) throw new Error("no project folder is open in this window");
      return session;
    },
    close(webContentsId: number): void {
      const session = byWebContents.get(webContentsId);
      if (!session) return;
      byWebContents.delete(webContentsId);
      const stillUsed = [...byWebContents.values()].some((entry) => entry === session);
      if (stillUsed) return;
      byProjectDir.delete(session.projectDir);
      session.store.close();
    },
    directoryExists(projectDir: string): boolean {
      return existsSync(join(projectDir, "project.sqlite"));
    },
    findByProjectId(projectId: string): ProjectSession | null {
      for (const session of byProjectDir.values()) if (session.store.projectId === projectId) return session;
      return null;
    },
  };
}

export type SessionRegistry = ReturnType<typeof createWindowSessionRegistry>;
