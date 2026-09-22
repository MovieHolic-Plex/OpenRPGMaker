import {
  createDatabaseCinematicActions,
  type CinematicTarget,
} from "@/editor/panels/databaseCinematicActions";
import {
  cinematicButton as button,
  cinematicNote as note,
  CINEMATIC_KIND_NAMES,
} from "@/editor/panels/databaseCinematicControls";
import { cinematicGameOverForm, cinematicSceneForm } from "@/editor/panels/databaseCinematicForms";
import { createCinematicMediaFields } from "@/editor/panels/databaseCinematicMediaFields";
import { createOpeningPresetGallery } from "@/editor/panels/databaseCinematicPresetGallery";
import { buildOpeningPresetSequence } from "@/editor/openingPresets";
import {
  createDatabaseCinematicPreview,
  type DatabaseCinematicPreview,
} from "@/editor/panels/databaseCinematicPreview";
import { toggleSwitch } from "@/editor/panels/databaseControls";
import {
  detailHero,
  detailPane,
  listPane,
  listRow,
  sectionCard,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { CINEMATIC_SCENE_LIMIT } from "@/project/cinematicSettings";
import { store } from "@/project/store";
import { el } from "@/util/dom";

const disposers = new WeakMap<HTMLElement, () => void>();

/**
 * Dispose before cache detachment, tab changes, modal close or fresh rendering.
 * Includes host itself. Disposed cinematic DOM must never resume from cache.
 */
export function disposeDatabaseCinematicsIn(host: HTMLElement): void {
  disposers.get(host)?.();
  for (const root of host.querySelectorAll<HTMLElement>(".db-cinematic-workspace")) {
    disposers.get(root)?.();
  }
}

/**
 * isActive identifies the current Database tab; attachment and lifetime are
 * checked here. Structural edits redraw sections, while typing retains inputs.
 */
export function renderDatabaseCinematicTab(
  host: HTMLElement,
  target: CinematicTarget,
  isActive: () => boolean,
): () => void {
  disposeDatabaseCinematicsIn(host);
  const sceneForm = el("div", { class: "db-cinematic-scene-form" });
  const menuForm = el("div", { class: "db-cinematic-menu-form" });
  const status = el("p", {
    class: "db-cinematic-status",
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "db-cinematic-status" },
  });
  const previewHost = el("div", {
    class: "db-cinematic-preview-stage",
    dataset: { testid: "db-cinematic-preview-stage" },
  });
  const previewPanel = el("section", {
    class: "db-cinematic-preview",
    attrs: { "aria-label": "장면 시퀀스 미리보기" },
    dataset: { testid: "db-cinematic-preview" },
  });
  previewPanel.hidden = true;
  let preview: DatabaseCinematicPreview | undefined;
  let disposed = false;
  let revision = 0;
  let selectedId = "";
  let pendingKind: "image" | "video" | undefined;
  let list = listPane({ title: "장면", rows: [] });

  const root = workspaceShell({
    list,
    detail: detailPane({
      hero: detailHero({
        title: target === "opening" ? "오프닝" : "게임 오버",
        subtitle: target === "opening"
          ? "새 게임이 시작될 때 보여 줄 장면을 순서대로 구성합니다."
          : "게임 종료 장면과 마지막에 표시할 메뉴를 구성합니다.",
      }),
      body: [sceneForm, menuForm, status, previewPanel],
    }),
    testid: `db-cinematic-${target === "opening" ? "opening" : "game-over"}`,
  });
  root.classList.add("db-cinematic-workspace");
  host.append(root);
  const active = (): boolean => !disposed && root.isConnected && isActive();
  const actions = createDatabaseCinematicActions({ target, isActive: active });
  const media = createCinematicMediaFields({
    actions,
    getRevision: () => revision,
    clearPendingKind: () => { pendingKind = undefined; },
    redraw,
    setStatus,
  });

  function invalidateForm(): void {
    revision += 1;
    media.cancel();
    actions.endTyping();
    preview?.stop();
  }

  function setStatus(message: string): void {
    status.textContent = message;
  }

  const startPreview = button("preview-start", "시퀀스 미리보기", () => {
    if (!actions.isActive()) return;
    media.cancel();
    actions.endTyping();
    // Pointer activation does not focus buttons in every browser.
    startPreview.focus({ preventScroll: true });
    preview ??= createDatabaseCinematicPreview({
      host: previewHost,
      signal: actions.signal,
      isActive: active,
      onPlayingChange: playing => {
        previewPanel.hidden = !playing;
        startPreview.disabled = playing || !actions.read()?.scenes.length;
        if (playing) {
          // Reveal before the shared player captures keyboard input.
          previewPanel.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
        }
      },
    });
    try {
      preview.start(actions.read());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  });
  previewPanel.append(
    el("div", {
      class: "db-cinematic-preview-toolbar",
      children: [
        el("h4", { text: "장면 시퀀스 미리보기" }),
        button("preview-stop", "중지", () => preview?.stop()),
        button("preview-close", "닫기", () => preview?.stop()),
      ],
    }),
    note("Esc로 언제든 중지합니다. 종료 메뉴의 문구와 배경은 실제 게임에서 확인하세요."),
    previewHost,
  );

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    media.cancel();
    preview?.dispose();
    actions.signal.removeEventListener("abort", dispose);
    actions.dispose();
    disposers.delete(root);
  }
  disposers.set(root, dispose);
  actions.signal.addEventListener("abort", dispose, { once: true });

  function renderList(): void {
    const scenes = actions.read()?.scenes ?? [];
    const add = button("add", "장면 추가", () => {
      if (!actions.isActive()) return;
      const id = actions.addScene();
      if (!id) return;
      selectedId = id;
      pendingKind = undefined;
      redraw();
    });
    add.disabled = scenes.length >= CINEMATIC_SCENE_LIMIT;
    const next = listPane({
      title: "장면 순서",
      count: `${scenes.length} / ${CINEMATIC_SCENE_LIMIT}`,
      rows: scenes.map((scene, index) => listRow({
        name: scene.narration.trim().split("\n")[0] || `${CINEMATIC_KIND_NAMES[scene.kind]} 장면`,
        sub: CINEMATIC_KIND_NAMES[scene.kind],
        number: index + 1,
        active: scene.id === selectedId,
        testid: `db-cinematic-scene-${scene.id}`,
        onSelect: () => {
          if (!actions.isActive()) return;
          selectedId = scene.id;
          pendingKind = undefined;
          redraw();
        },
      })),
      empty: note("장면을 추가한 뒤 텍스트, 이미지 또는 동영상을 선택하세요."),
      toolbar: el("div", { class: "db-cinematic-list-toolbar", children: [add] }),
    });
    list.replaceWith(next);
    list = next;
    startPreview.disabled = !scenes.length || preview?.playing === true;
  }

  function redraw(): void {
    // Database constructs its initial tab before attaching the modal body.
    // Building read-only controls is safe; their handlers still require active().
    if (disposed || actions.signal.aborted) return;
    invalidateForm();
    const sequence = actions.read();
    const scenes = sequence?.scenes ?? [];
    if (!scenes.some(scene => scene.id === selectedId)) {
      selectedId = scenes[0]?.id ?? "";
      pendingKind = undefined;
    }
    const ownRevision = revision;
    const usable = (): boolean => actions.isActive() && ownRevision === revision;
    const flags = sectionCard({
      title: "시퀀스 설정",
      children: [
        toggleSwitch("시퀀스 사용", "db-cinematic-enabled", sequence?.enabled ?? false, value => {
          if (usable()) actions.setFlag("enabled", value);
        }),
        toggleSwitch("건너뛰기 허용", "db-cinematic-skippable", sequence?.skippable ?? true, value => {
          if (usable()) actions.setFlag("skippable", value);
        }),
        media.field("music", "배경음악", { kind: "music" }, sequence?.musicResourceId),
        note("사용을 꺼도 장면과 미디어 설정은 유지됩니다. 배경음악은 시퀀스 전체에 반복 재생됩니다."),
        startPreview,
      ],
    });
    // 프리셋은 오프닝 전용이다 — 게임 오버는 종료 메뉴 문구와 엮여 있어 통째로 갈아 끼울 게 아니다.
    const presets = target === "opening" ? createOpeningPresetGallery({
      sceneCount: () => actions.read()?.scenes.length ?? 0,
      setStatus,
      applyPreset: preset => {
        if (!usable()) return false;
        const applied = actions.applySequence(buildOpeningPresetSequence(preset, {
          title: store.getCurrent().meta.title,
        }), `「${preset.name}」 프리셋`);
        if (applied) {
          // 새 장면 id 로 갈렸으니 선택을 첫 장면으로 되돌린다.
          selectedId = "";
          redraw();
        }
        return applied;
      },
    }) : undefined;
    const scene = scenes.find(entry => entry.id === selectedId);
    const formContext = { actions, usable, mediaField: media.field };
    sceneForm.replaceChildren(...(presets ? [presets] : []), flags, scene ? cinematicSceneForm({
      ...formContext,
      scene,
      scenes,
      pendingKind,
      setPendingKind: kind => { pendingKind = kind; },
      setSelectedId: id => { selectedId = id; },
      redraw,
      renderList,
    }) : note("왼쪽에서 장면을 추가하세요."));
    menuForm.replaceChildren();
    if (target === "gameOver") {
      menuForm.append(cinematicGameOverForm({
        ...formContext,
        settings: store.getCurrent().system.gameOver,
        redraw,
      }));
    }
    renderList();
  }

  redraw();
  return dispose;
}
