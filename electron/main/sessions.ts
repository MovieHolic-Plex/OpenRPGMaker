import { existsSync } from "node:fs";
import { join } from "node:path";
import { initLocalProjectStore, type LocalProjectStore } from "../local-store/store";

/** 창 하나·탭 하나를 가리키는 키. Electron 은 webContents.id, 로컬 서버는 고정 문자열을 쓴다. */
export type SessionKey = string | number;

export type ProjectSession = {
  readonly projectDir: string;
  readonly store: LocalProjectStore;
};

/**
 * 문서에 남아 있는 base64 미디어를 폴더의 sha256 파일로 꺼낸다(설계 6절). 스토어가 아니라
 * 여기서 부르는 이유: 스토어의 open 은 `oprn-store info` 같은 읽기 전용 도구도 타므로,
 * 여는 순간 쓰는 행동은 창을 여는 이 경로에만 둔다. 실패해도 여는 것을 막지 않는다.
 */
async function separateInlineMediaOnOpen(store: LocalProjectStore): Promise<void> {
  const snapshot = store.loadSnapshot();
  if (!snapshot) return;
  try {
    const result = await store.separateInlineMedia(snapshot.project);
    if (result.changed) {
      console.info(`[oprn] 미디어 분리: 자산 ${result.migratedAssetIds.length}건을 파일로 옮겼습니다(리비전 ${result.revision}).`);
    }
  } catch (error) {
    console.error("[oprn] 미디어 분리에 실패했습니다(문서는 base64 그대로 열립니다):", error);
  }
}

export function createProjectSessionRegistry() {
  const byConsumer = new Map<SessionKey, ProjectSession>();
  const byProjectDir = new Map<string, ProjectSession>();

  return {
    async open(key: SessionKey, projectDir: string): Promise<ProjectSession> {
      const existing = byProjectDir.get(projectDir)
        ?? { projectDir, store: await initLocalProjectStore({ projectDir }) };
      byProjectDir.set(projectDir, existing);
      byConsumer.set(key, existing);
      await separateInlineMediaOnOpen(existing.store);
      return existing;
    },
    get(key: SessionKey): ProjectSession | null {
      return byConsumer.get(key) ?? null;
    },
    require(key: SessionKey): ProjectSession {
      const session = byConsumer.get(key);
      if (!session) throw new Error("no project folder is open in this window");
      return session;
    },
    close(key: SessionKey): void {
      const session = byConsumer.get(key);
      if (!session) return;
      byConsumer.delete(key);
      const stillUsed = [...byConsumer.values()].some((entry) => entry === session);
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

export type SessionRegistry = ReturnType<typeof createProjectSessionRegistry>;
