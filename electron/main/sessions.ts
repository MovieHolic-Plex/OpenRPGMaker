import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { openTeamDirectory, type TeamDirectory, type TeamMember } from "../local-store/team";
import { join } from "node:path";
import { TEAM_COLLAB_ENABLED } from "../shared/teamCollab";
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

/** `separateInlineMedia` 가 실제로 옮기는 자산(ref 없이 dataUrl 만 든 것)이 있는가. 파싱 실패는 «있다»로 본다(옛 경로로). */
function hasMigratableInlineMedia(folded: string): boolean {
  try {
    const uploaded = (JSON.parse(folded) as { assets?: { uploaded?: Record<string, { ref?: unknown; dataUrl?: unknown }> } }).assets?.uploaded;
    if (!uploaded) return false;
    return Object.values(uploaded).some((asset) => asset && !asset.ref && Boolean(asset.dataUrl));
  } catch {
    return true;
  }
}

export async function separateInlineMediaOnOpen(store: LocalProjectStore): Promise<void> {
  // Normal hosted projects already store uploaded media as file refs. Avoid deserializing the
  // entire project just to discover that there is no inline data URL to migrate. This check is
  // intentionally lexical: a false positive only does the old repair work, while the common
  // project load avoids a second full deserialize before the renderer asks for the same
  // snapshot through project.load().
  // 접힌 행(약 1MB)에서 본다: `"uploaded":` ~ `"tilesets":` 사이는 전부 접히지 않은 채로 행 안에 있다.
  // 펼친 글(~112MB)을 만드는 `exportSerialized()` 는 접히지 않은 옛 행일 때만 쓴다.
  const folded = store.exportFolded();
  const serialized = folded ? folded.folded : store.exportSerialized();
  if (!serialized || !uploadedAssetsHaveInlineDataUrl(serialized)) return;
  // 어휘 검사가 참이어도 옮길 것이 없을 수 있다(ref 와 dataUrl 을 함께 든 자산). 옮기는 조건(`!ref && dataUrl`)을
  // 접힌 행 파싱(수 ms)으로 정확히 확인하고, 옮길 것이 없으면 `loadSnapshot` 전체 파싱(수 초)을 건너뛴다.
  if (folded && !hasMigratableInlineMedia(serialized)) return;
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

/** open 이 스토어를 만드는 동안 이 키가 닫혔다. 세션은 붙지 않았고, 다른 창이 안 쓰면 스토어는 이미 닫혔다. */
export class SessionConsumerClosed extends Error {
  constructor() {
    super("프로젝트를 여는 중에 세션이 닫혔습니다.");
    this.name = "SessionConsumerClosed";
  }
}

export function createProjectSessionRegistry() {
  const borrowedTeams = new WeakSet<ProjectSession>();
  const byConsumer = new Map<SessionKey, ProjectSession>();
  const identities = new Map<SessionKey, string>();
  const opening = new Map<string, Promise<ProjectSession>>();
  const byProjectDir = new Map<string, ProjectSession>();
  // 같은 폴더를 여는 중인 키 수. 하나라도 남아 있으면 그 스토어를 닫지 않는다.
  const openingCount = new Map<string, number>();
  const released = new WeakSet<ProjectSession>();
  // close 는 세대만 올린다. 그 전에 시작한 open 은 세대가 달라지면 죽은 창에 스토어를 붙이지 않는다.
  // 창을 닫은 뒤의 다음 open 은 올라간 세대를 다시 잡으므로, 닫기 한 번이 나중 열기를 막지 않는다.
  const epoch = new Map<SessionKey, number>();

  const epochOf = (key: SessionKey): number => epoch.get(key) ?? 0;

  const track = (projectDir: string): void => {
    openingCount.set(projectDir, (openingCount.get(projectDir) ?? 0) + 1);
  };
  const untrack = (projectDir: string): void => {
    const next = (openingCount.get(projectDir) ?? 1) - 1;
    if (next <= 0) openingCount.delete(projectDir);
    else openingCount.set(projectDir, next);
  };

  const releaseIfUnused = (session: ProjectSession): void => {
    if (released.has(session)) return;
    if ([...byConsumer.values()].some((entry) => entry === session)) return;
    if ((openingCount.get(session.projectDir) ?? 0) > 0) return;
    released.add(session);
    byProjectDir.delete(session.projectDir);
    opening.delete(session.projectDir);
    if (!borrowedTeams.has(session)) session.team.close();
    session.store.close();
  };

  const detach = (key: SessionKey): void => {
    const session = byConsumer.get(key);
    if (!session) return;
    byConsumer.delete(key);
    identities.delete(key);
    for (const [resource, lease] of session.locks) if (lease.session === key) session.locks.delete(resource);
    releaseIfUnused(session);
  };

  return {
    async open(key: SessionKey, projectDir: string, sharedTeam?: TeamDirectory): Promise<ProjectSession> {
      // 스토어를 여는 동안 창이 닫히면 closed 가 sessions.close 를 부르지만, 그때는 아직 세션이 없어
      // 예전에는 그냥 돌아갔다. open 이 끝나면 죽은 webContents 에 SQLite 가 붙어 프로세스 끝까지 잠금이 남았다.
      const stamp = epochOf(key);
      projectDir = resolve(projectDir);
      if (existsSync(projectDir)) projectDir = realpathSync(projectDir);
      track(projectDir);
      let tracked = true;
      const finishTrack = (): void => {
        if (!tracked) return;
        tracked = false;
        untrack(projectDir);
      };
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
      try {
        let existing: ProjectSession;
        try { existing = await pending; } catch (error) {
          // 같은 폴더의 다음 시도가 이미 새 promise 를 넣었으면 그 시도는 지우지 않는다.
          if (opening.get(projectDir) === pending) opening.delete(projectDir);
          throw error;
        }
        // 기다리는 쪽에서 빼낸 뒤에 닫아야, 방금 취소된 이 키가 스토어를 산 채로 두지 않는다.
        finishTrack();
        if (epochOf(key) !== stamp) {
          releaseIfUnused(existing);
          throw new SessionConsumerClosed();
        }
        // 다른 폴더로 바꾸는 것은 창이 닫힌 것이 아니다 — 세대는 올리지 않는다.
        if (byConsumer.has(key) && byConsumer.get(key) !== existing) detach(key);
        if (epochOf(key) !== stamp) {
          releaseIfUnused(existing);
          throw new SessionConsumerClosed();
        }
        byConsumer.set(key, existing);
        return existing;
      } finally {
        finishTrack();
      }
    },
    setMember(key: SessionKey, memberId: string): void { identities.set(key, memberId); },
    member(key: SessionKey): TeamMember {
      const session = byConsumer.get(key);
      if (!session) throw new Error("no project session");
      const member = session.team.member(identities.get(key) ?? session.team.owner().id);
      if (!member) throw new Error("팀 접근 권한이 취소되었습니다");
      // 사람 팀 협업이 꺼져 있으면(2026-10-21) 예전 초대로 남은 「보기 전용」도 편집자로 본다 — 팀 역할이 편집을 막지 않는다.
      if (!TEAM_COLLAB_ENABLED && member.role === "viewer") return { ...member, role: "editor" };
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
      epoch.set(key, epochOf(key) + 1);
      detach(key);
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
