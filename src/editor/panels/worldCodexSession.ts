import { store } from "@/project/store";
import { createWorldPanelState, currentWorld, getPersistedCodexView, hasWorldDraftChanges, saveDraft, type WorldPanelState } from "./worldManager";

/** The database container owns drafts, including when its tab DOM is detached or rebuilt. */
export class WorldCodexSession {
  readonly state: WorldPanelState;
  private readonly projectIdentity = JSON.stringify(store.getProjectIdentity());
  private readonly listeners = new Set<() => void>();

  constructor() {
    const view = getPersistedCodexView();
    this.state = createWorldPanelState({ initialTab: view.tab, initialEntityId: view.selectedId ?? undefined });
    this.state.onDraftChange = () => { for (const listener of this.listeners) listener(); };
  }

  isDirty(): boolean { return hasWorldDraftChanges(this.state); }

  commit(): boolean {
    if (JSON.stringify(store.getProjectIdentity()) !== this.projectIdentity) {
      this.state.editError = "프로젝트가 바뀌었습니다. 자료집을 다시 여세요.";
      return false;
    }
    if (!this.isDirty()) return true;
    saveDraft(this.state, currentWorld(store.getCurrent()));
    this.state.onDraftChange?.();
    return this.state.editDraft === null;
  }

  discard(): void {
    this.state.editDraft = null;
    this.state.editError = "";
    this.state.onDraftChange?.();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

const sessions = new WeakMap<HTMLElement, WorldCodexSession>();
export function worldCodexSessionFor(container: HTMLElement): WorldCodexSession {
  let session = sessions.get(container);
  if (!session) { session = new WorldCodexSession(); sessions.set(container, session); }
  return session;
}
