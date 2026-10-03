import { retimeOpeningAnimatic } from "@/project/openingAnimatic";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
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
import { createDatabaseCinematicMediaActions } from "@/editor/panels/databaseCinematicMediaActions";
import {
  CINEMATIC_DURATION_MAX_MS,
  gameOverOutcome,
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

    /**
     * 시퀀스 전체를 한 번의 되돌리기 단위로 갈아 끼운다(프리셋 적용).
     * 장면을 하나씩 밀어 넣으면 되돌리기가 장면 수만큼 쌓여 «한 번 눌러 되돌리기»가 깨진다.
     */
    applySequence(sequence: CinematicSequence, label = "프리셋 적용"): boolean {
      if (!active()) return false;
      if (sequence.scenes.length > CINEMATIC_SCENE_LIMIT) return false;
      return commit(label, project => {
        writeSequence(project, target, structuredClone(sequence));
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
      try { return replaceScene(id, "장면 시간", scene => scene.kind === "animatic" ? { ...scene, durationMs, composition: retimeOpeningAnimatic(scene.composition, scene.durationMs, durationMs) } : { ...scene, durationMs }, `${id}:duration`); }
      catch { return false; }
    },

    setMotion(id: string, motion: CinematicMotion): boolean {
      return replaceScene(id, "이미지 움직임", scene =>
        scene.kind === "image" ? { ...scene, motion } : scene);
    },

    /** Image/video intents stay in the view until a resource is ready. */
    convertToText(id: string): boolean {
      return replaceScene(id, "텍스트 장면으로 변경", scene => sceneWithKind(scene, "text", ""));
    },

    setDefeatPresentation(value: import("@/project/cinematicSettings").DefeatPresentation): boolean {
      if (target === "opening") return false;
      return commit("패배 연출 변경", project => { const settings = requireGameOverSettings(project, target); settings.outcome ??= gameOverOutcome(settings); settings.presentation = value; });
    },

    setOutcome(value: import("@/project/cinematicSettings").GameOverOutcome): boolean {
      if (target === "opening") return false;
      return commit("종료 후 처리 변경", project => { requireGameOverSettings(project, target).outcome = value; });
    },
    setTiming(key: keyof import("@/project/cinematicSettings").GameOverTiming, value: number | undefined): boolean {
      if (target === "opening" || (value !== undefined && (!Number.isSafeInteger(value) || value < 0 || value > 120000))) return false;
      return commit("게임 오버 시간 변경", project => {
        const timing = requireGameOverSettings(project, target).timing ??= {};
        if (value === undefined) delete timing[key]; else timing[key] = value;
      }, `timing:${key}`);
    },
    setRecovery(value: import("@/project/cinematicSettings").RecoveryDestination | undefined): boolean {
      if (target === "opening") return false;
      return commit("패배 귀환 지점 변경", project => {
        const settings = requireGameOverSettings(project, target);
        if (value) settings.recovery = value;
        else delete settings.recovery;
      });
    },

    setGameOverText(field: GameOverTextField, value: string): boolean {
      if (target === "opening") return false;
      const settings = readGameOverSettings(store.getCurrent(), target);
      // Missing action labels use the player's canonical defaults. Do not
      // store empty labels or duplicate those defaults in another module.
      const next = (field === "retryLabel" || field === "titleLabel") && !value.trim()
        ? undefined : value;
      if (settings?.[field] === next) return false;
      return commit("종료 메뉴 편집", project => {
        const gameOver: GameOverSettings = requireGameOverSettings(project, target);
        if (next === undefined) delete gameOver[field];
        else gameOver[field] = next;
      }, `gameOver:${field}`);
    },

    selectMedia: media.selectMedia,
    uploadMedia: media.uploadMedia,
  };
}

export type DatabaseCinematicActions = ReturnType<typeof createDatabaseCinematicActions>;
