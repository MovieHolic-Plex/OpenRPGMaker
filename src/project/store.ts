import { createBlankProject } from "./defaults";
import { ensureBundledResourceProfiles, ensureBundledTilesets } from "./defaults/defaultAssets";
import { ensureDefaultDatabaseIconResources } from "./defaults/defaultDatabaseIconResources";
import { createDevShowcaseProjectForLocation } from "./devShowcaseProjects";
import {
  loadProjectFromSupabase,
  saveProjectToSupabase,
} from "./supabaseProjectSync";
import { projectWithoutEventDrafts } from "./eventDrafts";
import { cacheSupabaseRootResources } from "@/assets/supabaseResourceCache";
import type { Project } from "./types";

type Listener = (project: Project) => void;

class ProjectStore {
  private current: Project;
  private listeners = new Set<Listener>();
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly autoSaveDelayMs = 1000;
  private loaded = false;
  private remotePersistenceEnabled = true;

  constructor() {
    this.current = createBlankProject();
  }

  async load(): Promise<Project> {
    try {
      const devShowcaseProject = createDevShowcaseProjectForLocation();
      if (devShowcaseProject) {
        this.current = devShowcaseProject;
        this.remotePersistenceEnabled = false;
      } else {
        const project = await loadProjectFromSupabase();
        if (!project) throw new Error("Supabase canonical project was not found or Supabase env is not configured");
        this.current = project;
        this.remotePersistenceEnabled = true;
      }
      const changed = [
        ensureBundledTilesets(this.current),
        ensureBundledResourceProfiles(this.current),
        ensureDefaultDatabaseIconResources(this.current),
      ].some(Boolean);
      if (changed && this.remotePersistenceEnabled) await this.persistCurrent();
      this.refreshSupabaseResourceCache();
    } catch (error) {
      this.remotePersistenceEnabled = false;
      console.error("[store] Supabase canonical project load failed:", error);
      throw error;
    }
    this.loaded = true;
    this.emit();
    return this.current;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getCurrent(): Project {
    return this.current;
  }

  replace(project: Project): void {
    this.current = project;
    this.emit();
    this.scheduleAutoSave();
  }

  update(mutator: (draft: Project) => void): void {
    const draft: Project = structuredClone(this.current);
    mutator(draft);
    this.current = draft;
    this.emit();
    this.scheduleAutoSave();
  }

  async flush(): Promise<void> {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    await this.persistCurrent();
  }

  async clearAll(): Promise<void> {
    this.current = createBlankProject();
    this.emit();
    this.scheduleAutoSave();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.current);
  }

  private scheduleAutoSave(): void {
    if (!this.remotePersistenceEnabled) return;
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      void this.persistCurrent().catch((error) => {
        console.error("[store] Supabase auto-save failed:", error);
      });
    }, this.autoSaveDelayMs);
  }

  private async persistCurrent(): Promise<void> {
    if (!this.remotePersistenceEnabled) return;
    await saveProjectToSupabase(projectWithoutEventDrafts(this.current));
    this.refreshSupabaseResourceCache();
  }

  private refreshSupabaseResourceCache(): void {
    if (!this.remotePersistenceEnabled) return;
    void cacheSupabaseRootResources(this.current).catch((error) => {
      console.error("[store] Supabase resource cache refresh failed:", error);
    });
  }
}

export const store = new ProjectStore();
