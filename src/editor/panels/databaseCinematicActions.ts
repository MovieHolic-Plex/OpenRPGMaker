import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  emptySequence,
  readCinematicSequence,
  requireCinematicSequence,
  sameRecord,
  sceneWithKind,
  writeSequence,
  type CinematicTarget,
} from "@/editor/panels/databaseCinematicActionModel";
import { createDatabaseCinematicMediaActions } from "@/editor/panels/databaseCinematicMediaActions";
import {
  CINEMATIC_DURATION_MAX_MS,
  CINEMATIC_SCENE_LIMIT,
  type CinematicMotion,
  type CinematicScene,
  type CinematicSequence,
  type GameOverSettings,
} from "@/project/cinematicSettings";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { genId } from "@/util/id";

export { readCinematicSequence } from "@/editor/panels/databaseCinematicActionModel";
export type { CinematicTarget } from "@/editor/panels/databaseCinematicActionModel";
export type {
  CinematicMediaSlot,
  CinematicMediaTicket,
} from "@/editor/panels/databaseCinematicMediaActions";

type GameOverTextField = "title" | "message" | "retryLabel" | "titleLabel";

/**
 * One lifetime per mounted authoring view.
 *
 * The view must dispose this controller before its DOM is rebuilt, hidden,
 * detached, cached or closed. A cached cinematic view must be evicted rather
 * than reactivated with old callbacks. isActive is an additional synchronous
 * guard; it must check both the current tab and the owning view's attachment.
 */
export function createDatabaseCinematicActions(options: {
  readonly target: CinematicTarget;
  readonly isActive: () => boolean;
}) {
  const { target } = options;
  const lifetime = new AbortController();
  const sessionId = genId("cinematic-edit");
  const title = target === "opening" ? "오프닝" : "게임 오버";
  let observedProject = store.getCurrent();
  let writing = false;
  let editRun = 0;
  let unsubscribe: () => void = () => undefined;

  const dispose = (): void => {
    if (lifetime.signal.aborted) return;
    lifetime.abort();
    unsubscribe();
  };

  // store.update clones the project too. Do not confuse our own labelled
  // updates with replacement/undo/import, whose scope is project.
  unsubscribe = store.subscribe((project, change) => {
    // A parent may mount this view while the store's live listener Set emits.
    const replaced = project !== observedProject;
    observedProject = project;
    if (replaced && !writing && (change.scope === "project" || change.projectSwitch)) dispose();
  });

  const active = (): boolean => !lifetime.signal.aborted && options.isActive();
  const read = (): CinematicSequence | undefined =>
    readCinematicSequence(store.getCurrent(), target);

  const commit = (
    label: string,
    mutate: (project: Project) => void,
    coalesce?: string,
  ): boolean => {
    if (!active()) return false;
    const fullLabel = `${title}: ${label}`;
    if (coalesce) {
      recordCoalescedSnapshot(
        `${sessionId}:${editRun}:${coalesce}`,
        fullLabel,
        null,
      );
    } else {
      editRun += 1;
      recordProjectSnapshot(fullLabel, null);
    }
    writing = true;
    try {
      store.update(mutate, { scope: "system", label: fullLabel });
    } finally {
      writing = false;
    }
    return true;
  };

  const replaceScene = (
    id: string,
    label: string,
    transform: (scene: CinematicScene) => CinematicScene,
    coalesce?: string,
  ): boolean => {
    if (!active()) return false;
    const current = read();
    const index = current?.scenes.findIndex(scene => scene.id === id) ?? -1;
    if (!current || index < 0) return false;
    const next = transform(current.scenes[index]);
    if (sameRecord(current.scenes[index], next)) return false;
    return commit(label, project => {
      const sequence = requireCinematicSequence(project, target);
      sequence.scenes[index] = next;
    }, coalesce);
  };

  const media = createDatabaseCinematicMediaActions({
    target,
    signal: lifetime.signal,
    isActive: active,
    commit,
  });

  return {
    signal: lifetime.signal,
    dispose,
    read,
    isActive: active,
    captureMedia: media.captureMedia,

    /** Call on selection changes and field blur to end a typing undo group. */
    endTyping(): void {
      editRun += 1;
    },

    setFlag(field: "enabled" | "skippable", value: boolean): boolean {
      const current = read() ?? emptySequence();
      if (current[field] === value) return false;
      return commit(field === "enabled" ? "사용 설정" : "건너뛰기 설정", project => {
        const sequence = readCinematicSequence(project, target) ?? emptySequence();
        sequence[field] = value;
        writeSequence(project, target, sequence);
      });
    },

    addScene(): string | undefined {
      if (!active() || (read()?.scenes.length ?? 0) >= CINEMATIC_SCENE_LIMIT) return undefined;
      const id = genId("cinematic-scene");
      const added = commit("장면 추가", project => {
        const sequence = readCinematicSequence(project, target) ?? emptySequence();
        sequence.scenes.push({ id, kind: "text", narration: "", durationMs: 0 });
        writeSequence(project, target, sequence);
      });
      return added ? id : undefined;
    },

    deleteScene(id: string): boolean {
      const index = read()?.scenes.findIndex(scene => scene.id === id) ?? -1;
      if (index < 0) return false;
      return commit("장면 삭제", project => {
        requireCinematicSequence(project, target).scenes.splice(index, 1);
      });
    },

    moveScene(id: string, direction: -1 | 1): boolean {
      const sequence = read();
      const index = sequence?.scenes.findIndex(scene => scene.id === id) ?? -1;
      if (!sequence || index < 0 || index + direction < 0
        || index + direction >= sequence.scenes.length) return false;
      return commit(direction === -1 ? "장면 위로" : "장면 아래로", project => {
        const scenes = requireCinematicSequence(project, target).scenes;
        const [scene] = scenes.splice(index, 1);
        scenes.splice(index + direction, 0, scene);
      });
    },

    setNarration(id: string, narration: string): boolean {
      return replaceScene(id, "내레이션 편집", scene => ({ ...scene, narration }), `${id}:narration`);
    },

    setDuration(id: string, milliseconds: number): boolean {
      if (!Number.isFinite(milliseconds)) return false;
      const durationMs = Math.min(CINEMATIC_DURATION_MAX_MS, Math.max(0, Math.round(milliseconds)));
      return replaceScene(id, "장면 시간", scene => ({ ...scene, durationMs }), `${id}:duration`);
    },

    setMotion(id: string, motion: CinematicMotion): boolean {
      return replaceScene(id, "이미지 움직임", scene =>
        scene.kind === "image" ? { ...scene, motion } : scene);
    },

    /** Image/video intents stay in the view until a resource is ready. */
    convertToText(id: string): boolean {
      return replaceScene(id, "텍스트 장면으로 변경", scene => sceneWithKind(scene, "text", ""));
    },

    setGameOverText(field: GameOverTextField, value: string): boolean {
      if (target !== "gameOver") return false;
      const settings = store.getCurrent().system.gameOver;
      // Missing action labels use the player's canonical defaults. Do not
      // store empty labels or duplicate those defaults in another module.
      const next = (field === "retryLabel" || field === "titleLabel") && !value.trim()
        ? undefined : value;
      if (settings?.[field] === next) return false;
      return commit("종료 메뉴 편집", project => {
        const gameOver: GameOverSettings = project.system.gameOver ??= {};
        if (next === undefined) delete gameOver[field];
        else gameOver[field] = next;
      }, `gameOver:${field}`);
    },

    selectMedia: media.selectMedia,
    uploadMedia: media.uploadMedia,
  };
}

export type DatabaseCinematicActions = ReturnType<typeof createDatabaseCinematicActions>;
