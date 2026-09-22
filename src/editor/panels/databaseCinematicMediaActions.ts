import { prepareCinematicUpload } from "@/editor/cinematicMediaImport";
import {
  emptySequence,
  readGameOverSettings,
  requireGameOverSettings,
  readCinematicSequence,
  requireCinematicSequence,
  sameRecord,
  sceneWithKind,
  writeSequence,
  type CinematicTarget,
} from "@/editor/panels/databaseCinematicActionModel";
import { listDatabaseResourceOptions } from "@/editor/panels/databaseResourcePickerDialog";
import type { CinematicScene } from "@/project/cinematicSettings";
import { store } from "@/project/store";
import type { Project, UploadedAsset } from "@/project/types";

export type CinematicMediaSlot =
  | { readonly kind: "image" | "video"; readonly sceneId: string }
  | { readonly kind: "voice"; readonly sceneId: string }
  /** 시퀀스 전체 배경음악 — 장면이 아직 없어도 설정할 수 있다. */
  | { readonly kind: "music" }
  | { readonly kind: "background" }
  | { readonly kind: "terminalMusic" };

/**
 * Capture at picker opening or upload initiation, not at form construction.
 * Project identity is intentionally conservative: any intervening edit makes
 * an outstanding media choice stale instead of overwriting newer work.
 */
export type CinematicMediaTicket = {
  readonly project: Project;
  readonly slot: CinematicMediaSlot;
  readonly signal: AbortSignal;
};

type MediaDestination =
  | { readonly kind: "background" }
  | { readonly kind: "terminalMusic" }
  | { readonly kind: "music" }
  | {
    readonly kind: "scene";
    readonly slot: Exclude<CinematicMediaSlot, { readonly kind: "background" } | { readonly kind: "terminalMusic" } | { readonly kind: "music" }>;
    readonly scene: CinematicScene;
  };

export function createDatabaseCinematicMediaActions(options: {
  readonly target: CinematicTarget;
  readonly signal: AbortSignal;
  readonly isActive: () => boolean;
  readonly commit: (label: string, mutate: (project: Project) => void) => boolean;
}) {
  const { target, signal: lifetimeSignal, isActive: active, commit } = options;

  const resolveTicket = (ticket: CinematicMediaTicket): MediaDestination | undefined => {
    if (!active() || ticket.signal !== lifetimeSignal
      || ticket.signal.aborted || ticket.project !== store.getCurrent()) return undefined;
    const slot = ticket.slot;
    if (slot.kind === "background" || slot.kind === "terminalMusic") {
      return target !== "opening" ? { kind: slot.kind } : undefined;
    }
    if (slot.kind === "music") return { kind: "music" };
    const scene = readCinematicSequence(store.getCurrent(), target)?.scenes
      .find(entry => entry.id === slot.sceneId);
    return scene ? { kind: "scene", slot, scene } : undefined;
  };

  const captureMedia = (slot: CinematicMediaSlot): CinematicMediaTicket => ({
    project: store.getCurrent(),
    slot: { ...slot },
    signal: lifetimeSignal,
  });

  const applyMedia = (
    ticket: CinematicMediaTicket,
    rawId: string,
    asset?: UploadedAsset,
  ): boolean => {
    const destination = resolveTicket(ticket);
    if (!destination) return false;
    const resourceId = rawId.trim();
    const slot = ticket.slot;
    const required = slot.kind === "image" || slot.kind === "video";
    if (required && !resourceId) return false;
    const pickerKind = slot.kind === "video" ? "movie"
      : slot.kind === "voice" ? "sound"
        : (slot.kind === "music" || slot.kind === "terminalMusic") ? "music" : "still";
    if (resourceId && !asset && !listDatabaseResourceOptions(pickerKind, ticket.project)
      .some(option => option.id === resourceId)) return false;

    let applyReference: (project: Project) => void;
    if (destination.kind === "scene") {
      const { slot, scene } = destination;
      let nextScene: CinematicScene;
      if (slot.kind === "voice") {
        const { narrationAudioResourceId: _previous, ...rest } = scene;
        nextScene = resourceId ? { ...rest, narrationAudioResourceId: resourceId } : rest;
      } else {
        nextScene = sceneWithKind(scene, slot.kind, resourceId);
      }
      if (!asset && sameRecord(scene, nextScene)) return false;
      applyReference = project => {
        const scenes = requireCinematicSequence(project, target).scenes;
        const index = scenes.findIndex(scene => scene.id === slot.sceneId);
        scenes[index] = nextScene;
      };
    } else if (destination.kind === "music") {
      if (!asset && (readCinematicSequence(store.getCurrent(), target)?.musicResourceId ?? "") === resourceId) {
        return false;
      }
      applyReference = project => {
        if (!readCinematicSequence(project, target)) writeSequence(project, target, emptySequence());
        const sequence = requireCinematicSequence(project, target);
        if (resourceId) sequence.musicResourceId = resourceId;
        else delete sequence.musicResourceId;
      };
    } else {
      const field = destination.kind === "terminalMusic" ? "musicResourceId" : "backgroundResourceId";
      if (!asset
        && (readGameOverSettings(store.getCurrent(), target)?.[field] ?? "") === resourceId) {
        return false;
      }
      applyReference = project => {
        const settings = requireGameOverSettings(project, target);
        if (resourceId) settings[field] = resourceId;
        else delete settings[field];
      };
    }

    return commit(asset ? "미디어 가져오기" : "미디어 선택", project => {
      // Asset, profile and the consuming reference share one snapshot/update.
      if (asset) {
        project.assets.uploaded[asset.id] = asset;
        project.resourceProfiles.push({
          kind: pickerKind === "still" ? "picture" : pickerKind,
          name: asset.name,
          assetId: asset.id,
        });
      }
      applyReference(project);
    });
  };

  return {
    captureMedia,

    selectMedia(ticket: CinematicMediaTicket, resourceId: string): boolean {
      return applyMedia(ticket, resourceId);
    },

    /**
     * Preparation failures and AbortError propagate to the view's status UI.
     * false means a successfully prepared result became stale; no writes occur.
     * The caller can cancel a single upload without disposing the entire tab.
     */
    async uploadMedia(
      ticket: CinematicMediaTicket,
      file: File,
      signal?: AbortSignal,
    ): Promise<boolean> {
      if (!resolveTicket(ticket)) return false;
      const preparation = new AbortController();
      const abort = (): void => preparation.abort();
      lifetimeSignal.addEventListener("abort", abort, { once: true });
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) preparation.abort();
      // Abort promptly on any competing edit, including scene deletion.
      const stopWatching = store.subscribe(project => {
        if (project !== ticket.project) preparation.abort();
      });
      try {
        const kind = ticket.slot.kind === "video" ? "video"
          : ticket.slot.kind === "voice" || ticket.slot.kind === "music" || ticket.slot.kind === "terminalMusic" ? "audio" : "image";
        const asset = await prepareCinematicUpload(file, kind, preparation.signal);
        preparation.signal.throwIfAborted();
        if (!resolveTicket(ticket)) return false;
        return applyMedia(ticket, asset.id, asset);
      } finally {
        stopWatching();
        lifetimeSignal.removeEventListener("abort", abort);
        signal?.removeEventListener("abort", abort);
      }
    },
  };
}
