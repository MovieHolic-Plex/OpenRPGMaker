import type { DatabaseCinematicActions } from "@/editor/panels/databaseCinematicActions";
import {
  cinematicButton as button,
  cinematicNote as note,
  CINEMATIC_KIND_NAMES,
} from "@/editor/panels/databaseCinematicControls";
import type { CinematicMediaField } from "@/editor/panels/databaseCinematicMediaFields";
import { field } from "@/editor/panels/databaseControls";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import {
  CINEMATIC_DURATION_MAX_MS,
  type CinematicScene,
  type GameOverSettings,
} from "@/project/cinematicSettings";
import { el } from "@/util/dom";

const MOTIONS = [
  { id: "none", name: "없음" },
  { id: "fade", name: "페이드" },
  { id: "pan", name: "이동" },
  { id: "zoom", name: "확대" },
] as const;

type FormContext = {
  readonly actions: DatabaseCinematicActions;
  /** Captures the revision at construction, not a mutable current revision. */
  readonly usable: () => boolean;
  readonly mediaField: CinematicMediaField;
};

export function cinematicSceneForm(options: FormContext & {
  readonly scene: CinematicScene;
  readonly scenes: readonly CinematicScene[];
  readonly pendingKind: "image" | "video" | undefined;
  readonly setPendingKind: (kind: "image" | "video" | undefined) => void;
  readonly setSelectedId: (id: string) => void;
  readonly redraw: () => void;
  readonly renderList: () => void;
}): HTMLElement {
  const {
    actions, usable, mediaField, scene, scenes, pendingKind,
    setPendingKind, setSelectedId, redraw, renderList,
  } = options;
  const index = scenes.findIndex(entry => entry.id === scene.id);
  const kind = pendingKind ?? scene.kind;
  const kindInput = el("select", {
    dataset: { testid: "db-cinematic-kind" },
    children: Object.entries(CINEMATIC_KIND_NAMES).map(([value, name]) =>
      el("option", { attrs: { value }, text: name })),
  });
  kindInput.value = kind;
  kindInput.addEventListener("change", () => {
    if (!usable()) return;
    const next = kindInput.value;
    if (next !== "text" && next !== "image" && next !== "video") return;
    if (next === "text") {
      setPendingKind(undefined);
      actions.convertToText(scene.id);
    } else {
      setPendingKind(next === scene.kind ? undefined : next);
    }
    redraw();
  });

  const narration = el("textarea", {
    attrs: { rows: "5" },
    value: scene.narration,
    dataset: { testid: "db-cinematic-narration" },
  });
  narration.addEventListener("input", () => {
    if (!usable()) return;
    actions.setNarration(scene.id, narration.value);
    // Update the list excerpt only; retain the input, selection and IME.
    renderList();
  });
  narration.addEventListener("blur", () => actions.endTyping());

  const duration = el("input", {
    attrs: { type: "number", min: "0", max: String(CINEMATIC_DURATION_MAX_MS), step: "1" },
    value: scene.durationMs,
    dataset: { testid: "db-cinematic-duration" },
  });
  const commitDuration = (): void => {
    if (usable() && duration.value !== "") actions.setDuration(scene.id, Number(duration.value));
  };
  duration.addEventListener("input", commitDuration);
  duration.addEventListener("change", () => {
    if (!usable()) return;
    commitDuration();
    const saved = actions.read()?.scenes.find(entry => entry.id === scene.id);
    if (saved) duration.value = String(saved.durationMs);
  });
  duration.addEventListener("blur", () => actions.endTyping());

  const up = button("up", "위로", () => {
    if (usable() && actions.moveScene(scene.id, -1)) redraw();
  });
  const down = button("down", "아래로", () => {
    if (usable() && actions.moveScene(scene.id, 1)) redraw();
  });
  up.disabled = index === 0;
  down.disabled = index === scenes.length - 1;
  const remove = button("delete", "장면 삭제", () => {
    if (!usable() || !actions.deleteScene(scene.id)) return;
    setSelectedId(actions.read()?.scenes[Math.min(index, scenes.length - 2)]?.id ?? "");
    setPendingKind(undefined);
    redraw();
  });
  const children: HTMLElement[] = [
    el("div", { class: "db-cinematic-scene-toolbar", children: [up, down, remove] }),
    field("장면 종류", kindInput),
  ];
  if (kind !== "text") {
    children.push(mediaField(
      "resource",
      kind === "image" ? "이미지" : "동영상",
      { kind, sceneId: scene.id },
      scene.kind === kind ? scene.resourceId : undefined,
    ));
    if (pendingKind) children.push(note("미디어를 선택하거나 가져온 뒤 장면 종류가 변경됩니다."));
  }
  children.push(
    field("내레이션", narration),
    mediaField("voice", "내레이션 음성", { kind: "voice", sceneId: scene.id }, scene.narrationAudioResourceId),
    field("장면 시간 (ms)", duration),
    note(`0은 텍스트·이미지에서 수동 진행, 동영상에서 재생 종료까지 대기합니다. 최대 ${CINEMATIC_DURATION_MAX_MS}ms입니다.`),
  );
  if (kind === "image" && scene.kind === "image") {
    const motion = el("select", {
      dataset: { testid: "db-cinematic-motion" },
      children: MOTIONS.map(option => el("option", { attrs: { value: option.id }, text: option.name })),
    });
    motion.value = scene.motion;
    motion.addEventListener("change", () => {
      const option = MOTIONS.find(entry => entry.id === motion.value);
      if (usable() && option) actions.setMotion(scene.id, option.id);
    });
    children.push(field("이미지 움직임", motion));
  }
  return sectionCard({ title: `장면 ${index + 1}`, children });
}

export function cinematicGameOverForm(options: FormContext & {
  readonly settings: GameOverSettings | undefined;
}): HTMLElement {
  const { actions, usable, mediaField, settings } = options;
  const definitions = [
    { key: "title", label: "제목", placeholder: "게임 오버" },
    { key: "message", label: "기본 메시지", placeholder: "기본 종료 메시지" },
    { key: "retryLabel", label: "다시 시도 버튼", placeholder: "다시 시도" },
    { key: "titleLabel", label: "타이틀 버튼", placeholder: "타이틀로" },
  ] as const;
  const fields = definitions.map(definition => {
    const input = definition.key === "message"
      ? el("textarea", { attrs: { rows: "3" } })
      : el("input", { attrs: { type: "text" } });
    input.value = settings?.[definition.key] ?? "";
    input.placeholder = definition.placeholder;
    input.dataset.testid = `db-cinematic-game-over-${definition.key}`;
    input.addEventListener("input", () => {
      if (usable()) actions.setGameOverText(definition.key, input.value);
    });
    input.addEventListener("blur", () => actions.endTyping());
    return field(definition.label, input);
  });
  return sectionCard({
    title: "종료 메뉴",
    hint: "시퀀스를 사용하지 않아도 종료 메뉴는 표시됩니다.",
    children: [
      ...fields,
      note("버튼 문구를 비우면 기본 문구를 사용합니다. 이벤트의 종료 메시지가 있으면 기본 메시지보다 우선합니다."),
      mediaField("background", "종료 메뉴 배경", { kind: "background" }, settings?.backgroundResourceId),
    ],
  });
}
