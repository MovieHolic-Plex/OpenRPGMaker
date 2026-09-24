import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { openTeamDirectory, type TeamDirectory, type TeamMember } from "../local-store/team";
import { join } from "node:path";
import { initLocalProjectStore, type LocalProjectStore } from "../local-store/store";

/** 창 하나·탭 하나를 가리키는 키. Electron 은 webContents.id, HTTP는 로그인 세션·브라우저 탭별 키를 쓴다. */
export type SessionKey = string | number;

export type ProjectSession = {
  readonly projectDir: string;
  readonly store: LocalProjectStore;
  readonly team: TeamDirectory;
  readonly locks: Map<string, { session: SessionKey; memberId: string; ownerLabel: string; expiresAt: number }>;
};

/**
 * 문서에 남아 있는 base64 미디어를 폴더의 sha256 파일로 꺼낸다(설계 6절). 스토어가 아니라
 * 여기서 부르는 이유: 스토어의 open 은 `oprn-store info` 같은 읽기 전용 도구도 타므로,
 * 여는 순간 쓰는 행동은 창을 여는 이 경로에만 둔다. 실패해도 여는 것을 막지 않는다.
 */
function uploadedAssetsHaveInlineDataUrl(serialized: string): boolean {
  // Tileset reference images also use "dataUrl". Those are not uploaded assets, and treating
  // them as inline media made every new-project open deserialize the whole document.
  const uploaded = serialized.indexOf('"uploaded":');
  if (uploaded < 0) return false;
  const tilesets = serialized.indexOf('"tilesets":', uploaded);
  const slice = tilesets > uploaded ? serialized.slice(uploaded, tilesets) : serialized.slice(uploaded);
  return slice.includes('"dataUrl"');
}

async function separateInlineMediaOnOpen(store: LocalProjectStore): Promise<void> {
  // Normal hosted projects already store uploaded media as file refs. Avoid deserializing the
  // entire project just to discover that there is no inline data URL to migrate. This check is
  // intentionally lexical: a false positive only does the old repair work, while the common
  // project load avoids a second full deserialize before the renderer asks for the same
  // snapshot through project.load().
  const serialized = store.exportSerialized();
  if (!serialized || !uploadedAssetsHaveInlineDataUrl(serialized)) return;
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
  const borrowedTeams = new WeakSet<ProjectSession>();
  const byConsumer = new Map<SessionKey, ProjectSession>();
  const identities = new Map<SessionKey, string>();
  const opening = new Map<string, Promise<ProjectSession>>();
  const byProjectDir = new Map<string, ProjectSession>();

  return {
    async open(key: SessionKey, projectDir: string, sharedTeam?: TeamDirectory): Promise<ProjectSession> {
      projectDir = resolve(projectDir);
      if (existsSync(projectDir)) projectDir = realpathSync(projectDir);
      let pending = opening.get(projectDir);
      if (!pending) {
        pending = (async () => {
          const found = byProjectDir.get(projectDir);
          if (found) return found;
          const store = await initLocalProjectStore({ projectDir });
          await separateInlineMediaOnOpen(store);
          let team: TeamDirectory;
          try { team = sharedTeam ?? openTeamDirectory(projectDir); } catch (error) { store.close(); throw error; }
          const session = { projectDir, store, team, locks: new Map() };
          if (sharedTeam) borrowedTeams.add(session);
          byProjectDir.set(projectDir, session);
          return session;
        })();
        opening.set(projectDir, pending);
      }
      let existing: ProjectSession;
      try { existing = await pending; } catch (error) { opening.delete(projectDir); throw error; }
      if (byConsumer.has(key) && byConsumer.get(key) !== existing) this.close(key);
      byConsumer.set(key, existing);
      return existing;
    },
    setMember(key: SessionKey, memberId: string): void { identities.set(key, memberId); },
    member(key: SessionKey): TeamMember {
      const session = byConsumer.get(key);
      if (!session) throw new Error("no project session");
      const member = session.team.member(identities.get(key) ?? session.team.owner().id);
      if (!member) throw new Error("팀 접근 권한이 취소되었습니다");
      return member;
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
      identities.delete(key);
      for (const [resource, lease] of session.locks) if (lease.session === key) session.locks.delete(resource);
      const stillUsed = [...byConsumer.values()].some((entry) => entry === session);
      if (stillUsed) return;
      byProjectDir.delete(session.projectDir);
      opening.delete(session.projectDir);
      if (!borrowedTeams.has(session)) session.team.close();
      session.store.close();
    },
    directoryExists(projectDir: string): boolean {
      return existsSync(join(projectDir, "project.sqlite"));
    },
    findByProjectId(projectId: string): ProjectSession | null {
      for (const session of byProjectDir.values()) if (session.store.projectId === projectId) return session;
      return null;
    },
    firstProjectDir(): string | null {
      for (const session of byProjectDir.values()) return session.projectDir;
      return null;
    },
  };
}

export type SessionRegistry = ReturnType<typeof createProjectSessionRegistry>;
