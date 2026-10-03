import { createOpeningAnimaticWorkbench } from "./openingAnimaticWorkbench";
import { store } from "@/project/store";
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
  gameOverOutcome,
  type GameOverOutcome,
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
    if (next !== "text" && next !== "image" && next !== "video" && next !== "animatic") return;
    if (next === "animatic") {
      setPendingKind(undefined);
      const sequence = actions.read();
      if (sequence) actions.applySequence({ ...sequence, scenes: sequence.scenes.map(s => s.id === scene.id ? { id: s.id, kind: "animatic", narration: s.narration, durationMs: Math.max(1, s.durationMs || 4000), composition: { width: 1280, height: 720, layers: [] } } : s) }, "애니메틱 샷 만들기");
    } else if (next === "text") {
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
  if (scene.kind !== "animatic") duration.addEventListener("input", commitDuration);
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
  if (kind === "image" || kind === "video") {
    children.push(mediaField(
      "resource",
      kind === "image" ? "이미지" : "동영상",
      { kind, sceneId: scene.id },
      (scene.kind === "image" || scene.kind === "video") && scene.kind === kind ? scene.resourceId : undefined,
    ));
    if (pendingKind) children.push(note("미디어를 선택하거나 가져온 뒤 장면 종류가 변경됩니다."));
  }
  if (scene.kind === 'animatic') children.push(createOpeningAnimaticWorkbench({ project: store.getCurrent(), composition: scene.composition, durationMs: scene.durationMs, usable,
    commit: composition => { const sequence = actions.read(); if (sequence && usable()) { actions.applySequence({ ...sequence, scenes: sequence.scenes.map(s => s.id === scene.id && s.kind === 'animatic' ? { ...s, composition } : s) }, '애니메틱 동작 키'); redraw(); } } }));
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
  readonly redraw: () => void;
}): HTMLElement {
  const { actions, usable, mediaField, settings } = options;
  const presentation = el("select", { dataset: { testid: "db-defeat-presentation" } });
  for (const [value, label] of [["classic", "클래식 · 배경과 제목"], ["horror", "공포 · 암전과 정적"], ["blackout", "암전 · 메시지"]]) {
    presentation.append(el("option", { attrs: { value }, text: label }));
  }
  presentation.value = settings?.presentation ?? "classic";
  presentation.addEventListener("change", () => {
    if (!usable()) return;
    actions.setDefeatPresentation(presentation.value as "classic" | "horror" | "blackout");
    options.redraw();
  });
  const outcome = el("select", { dataset: { testid: "db-defeat-outcome" } });
  for (const [value, label] of [["menu", "재시도 · 타이틀 선택 메뉴"], ["recover", "파티 회복 후 장소로 귀환"], ["title", "메시지 뒤 타이틀로 자동 복귀"]]) outcome.append(el("option", { attrs: { value }, text: label }));
  outcome.value = gameOverOutcome(settings);
  outcome.addEventListener("change", () => {
    if (!usable()) return;
    actions.setOutcome(outcome.value as GameOverOutcome);
    options.redraw();
  });
  const timingFields = ([
    ["fadeOutMs", "암전 시간 (ms)"], ["silenceMs", "암전 뒤 정적 (ms)"],
    ["menuDelayMs", "메뉴 등장 대기 (ms)"], ["messageHoldMs", "자동 진행 메시지 시간 (ms)"],
  ] as const).map(([key, label]) => {
    const input = el("input", { attrs: { type: "number", min: "0", max: "120000", step: "1", placeholder: "연출 기본값" }, dataset: { testid: `db-defeat-${key}` } });
    input.value = settings?.timing?.[key] === undefined ? "" : String(settings.timing[key]);
    input.disabled = (key === "menuDelayMs" && gameOverOutcome(settings) !== "menu") || (key === "messageHoldMs" && gameOverOutcome(settings) === "menu");
    input.addEventListener("change", () => {
      if (!usable()) return;
      actions.setTiming(key, input.value === "" ? undefined : Number(input.value));
      options.redraw();
    });
    return field(label, input);
  });
  const recoveryFields: HTMLElement[] = [];
  if (gameOverOutcome(settings) === "recover") {
    const project = store.getCurrent();
    const mapSelect = el("select", { dataset: { testid: "db-defeat-recovery-map" } });
    mapSelect.append(el("option", { attrs: { value: "" }, text: "체크포인트 위치 · 없으면 시작 위치" }));
    for (const map of Object.values(project.maps)) mapSelect.append(el("option", { attrs: { value: map.id }, text: map.name }));
    mapSelect.value = settings?.recovery?.mapId ?? "";
    const x = el("input", { attrs: { type: "number", min: "0", step: "1", "aria-label": "귀환 X" } });
    const y = el("input", { attrs: { type: "number", min: "0", step: "1", "aria-label": "귀환 Y" } });
    x.value = String(settings?.recovery?.x ?? project.startPos.x);
    y.value = String(settings?.recovery?.y ?? project.startPos.y);
    const status = note("");
    status.setAttribute("role", "status");
    x.disabled = y.disabled = !mapSelect.value;
    const apply = (): void => {
      if (!usable()) return;
      x.disabled = y.disabled = !mapSelect.value;
      status.textContent = "";
      if (!mapSelect.value) { actions.setRecovery(undefined); return; }
      const map = project.maps[mapSelect.value];
      const nextX = Number(x.value), nextY = Number(y.value);
      if (!map || !x.value || !y.value || !Number.isSafeInteger(nextX) || !Number.isSafeInteger(nextY) || nextX < 0 || nextY < 0 || nextX >= map.width || nextY >= map.height) {
        status.textContent = map ? `좌표는 X 0~${map.width - 1}, Y 0~${map.height - 1} 범위의 정수로 입력하세요. 아직 적용되지 않았습니다.` : "귀환할 맵을 선택하세요.";
        return;
      }
      actions.setRecovery({ mapId: mapSelect.value, x: nextX, y: nextY });
    };
    for (const control of [mapSelect, x, y]) control.addEventListener("change", apply);
    recoveryFields.push(field("회복 장소", mapSelect), field("귀환 X", x), field("귀환 Y", y), status, note("진행·아이템·변수를 유지하고 파티를 회복합니다. 체크포인트의 저장 상태를 불러오지 않습니다. 통행 가능한 빈 칸을 지정하세요."));
  }
  const definitions = [
    { key: "title", label: "제목", placeholder: "게임 오버" },
    { key: "message", label: "기본 메시지", placeholder: "기본 종료 메시지" },
    { key: "retryLabel", label: "다시 시도 버튼", placeholder: "체크포인트에서 다시 시작" },
    { key: "titleLabel", label: "타이틀 버튼", placeholder: "타이틀로 돌아가기" },
  ] as const;
  const fields = definitions.map(definition => {
    const input = definition.key === "message"
      ? el("textarea", { attrs: { rows: "3" } })
      : el("input", { attrs: { type: "text" } });
    input.value = settings?.[definition.key] ?? "";
    input.placeholder = definition.placeholder;
    input.disabled = definition.key !== "message" && gameOverOutcome(settings) !== "menu";
    input.dataset.testid = `db-cinematic-game-over-${definition.key}`;
    input.addEventListener("input", () => {
      if (usable()) actions.setGameOverText(definition.key, input.value);
    });
    input.addEventListener("blur", () => actions.endTyping());
    return field(definition.label, input);
  });
  return sectionCard({
    title: "패배 이후의 흐름",
    hint: "화면 분위기와 패배 후 처리를 독립적으로 조합합니다.",
    children: [
      field("화면 연출", presentation),
      field("패배 후 처리", outcome),
      ...recoveryFields,
      ...fields,
      ...timingFields,
      note("시간을 비우면 연출 기본값을 사용합니다. 메뉴 대기는 선택 메뉴에, 메시지 시간은 자동 귀환·타이틀 복귀에 적용됩니다."),
      note("제목·버튼은 선택 메뉴에서 사용합니다. 자동 귀환·복귀는 메시지를 표시합니다. 이벤트의 패배 메시지는 기본 메시지보다 우선합니다."),
      mediaField("background", "종료 화면 배경", { kind: "background" }, settings?.backgroundResourceId),
      mediaField("terminalMusic", "종료 화면 음악", { kind: "terminalMusic" }, settings?.musicResourceId),
    ],
  });
}
