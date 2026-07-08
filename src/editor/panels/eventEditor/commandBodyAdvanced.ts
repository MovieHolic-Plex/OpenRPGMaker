import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { el } from "@/util/dom";
import { selectWithOptions } from "./dom";
import { innBody, shopBody } from "./commandBodyCommerce";
import {
  actorSubtitle,
  battleProcessingBody,
  changeActorHpBody,
  changeActorMpBody,
  changeEquipmentBody,
  changeExpBody,
  changeGoldBody,
  changeItemBody,
  changeLevelBody,
  changePartyBody,
  enterHeroNameBody,
  evolveMonsterBody,
  giveMonsterBody,
  moveMonsterBody,
  promoteActorBody,
  recoverAllBody,
} from "./commandBodyDatabase";
import { facesetIconOf, recordPickerWithPreview } from "./recordPicker";
import { isPassable } from "@/project/collision";
import { moveEventBody } from "./commandBodyRoute";
import { changeTileBody } from "./commandBodyTile";
import { BOOLEAN_OPTIONS } from "./options";
import { openTransferPlayerDialog, transferDirectionLabel, transferFadeLabel } from "./transferPlayerDialog";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";

export function renderAdvancedCommandBody(
  context: CommandEditContext,
  cmd: Command
): HTMLElement | undefined {
  switch (cmd.kind) {
    case "transfer":
      return transferBody(context, cmd);
    case "wait":
      return waitBody(context, cmd);
    case "advanceTime":
      return advanceTimeBody(context, cmd);
    case "setTime":
      return setTimeBody(context, cmd);
    case "sleepUntilMorning":
      return terminalHint("sleep-until-morning-editor", "페이드 아웃 후 하루 종료 훅을 실행하고 다음날 아침으로 이동합니다.");
    case "moveEvent":
      return moveEventBody(context, cmd);
    case "setEventGraphicPattern":
      return setEventGraphicPatternBody(context, cmd);
    case "changeTile":
      return changeTileBody(context, cmd);
    case "callCommonEvent":
      return callCommonEventBody(context, cmd);
    case "callMapEvent":
      return callMapEventBody(context, cmd);
    case "battleProcessing":
      return battleProcessingBody(context, cmd);
    case "learnSkill":
      return learnSkillBody(context, cmd);
    case "changeExp":
      return changeExpBody(context, cmd);
    case "changeLevel":
      return changeLevelBody(context, cmd);
    case "promoteActor":
      return promoteActorBody(context, cmd);
    case "changeEquipment":
      return changeEquipmentBody(context, cmd);
    case "changeActorHp":
      return changeActorHpBody(context, cmd);
    case "changeActorMp":
      return changeActorMpBody(context, cmd);
    case "recoverAll":
      return recoverAllBody(context, cmd);
    case "enterHeroName":
      return enterHeroNameBody(context, cmd);
    case "shop":
      return shopBody(context, cmd);
    case "inn":
      return innBody(context, cmd);
    case "checkpointSave":
      return terminalHint("checkpoint-save-editor", "현재 런타임 세션을 세션 한정 체크포인트로 저장합니다.");
    case "killPlayer":
      return terminalHint("kill-player-editor", "파티를 전멸시키고 게임 오버 화면을 엽니다.");
    case "triggerEnding":
      return terminalHint("trigger-ending-editor", "지정 엔딩 또는 조건을 만족하는 최우선 엔딩을 실행합니다.");
    case "addFollower":
      return terminalHint("add-follower-editor", "동행 NPC를 세션에 추가합니다. actorId 또는 graphic을 사용합니다.");
    case "removeFollower":
      return terminalHint("remove-follower-editor", "동행 NPC를 이름으로 제거하거나 all=true로 모두 제거합니다.");
    case "setLighting":
      return setLightingBody(context, cmd);
    case "addLight":
      return addLightBody(context, cmd);
    case "removeLight":
      return removeLightBody(context, cmd);
    case "setWeather":
      return setWeatherBody(context, cmd);
    case "showAnimation":
      return showAnimationBody(context, cmd);
    case "changeGold":
      return changeGoldBody(context, cmd);
    case "changeItem":
      return changeItemBody(context, cmd);
    case "changeParty":
      return changePartyBody(context, cmd);
    case "giveMonster":
      return giveMonsterBody(context, cmd);
    case "moveMonster":
      return moveMonsterBody(context, cmd);
    case "evolveMonster":
      return evolveMonsterBody(context, cmd);
    case "showPicture":
      return showPictureBody(context, cmd);
    case "erasePicture":
      return erasePictureBody(context, cmd);
    case "playAudio":
      return playAudioBody(context, cmd);
    case "stopAudio":
      return terminalHint("stop-audio-editor", "설정 없음. 현재 재생 중인 오디오를 정지합니다.");
    case "gameOver":
      return terminalHint("game-over-editor", "설정 없음. 게임 오버 화면을 엽니다.");
    case "ending":
      return endingBody(context, cmd);
    case "returnToTitle":
      return terminalHint("return-to-title-editor", "설정 없음. 타이틀 화면으로 돌아갑니다.");
    default:
      return undefined;
  }
}

function transferBody(context: CommandEditContext, cmd: Extract<Command, { kind: "transfer" }>): HTMLElement {
  const project = store.getCurrent();
  const map = cmd.mapId ? project.maps[cmd.mapId] : undefined;
  const mapName = cmd.mapId ? map?.name ?? cmd.mapId : "(map)";
  // 대상 좌표 통행성 즉석 검사 배지 — 통행 불가 타일로 이동시키는 실수를 편집 시점에 잡는다.
  const passable = map ? isPassable(project, map, cmd.x, cmd.y) : undefined;
  const passabilityBadge =
    passable === undefined
      ? []
      : [
          el("span", {
            class: `rich-badge ${passable ? "passable" : "blocked"}`,
            text: passable ? "통행 가능" : "통행 불가 타일!",
            dataset: { testid: "transfer-passability-badge", passable: String(passable) },
          }),
        ];
  return el("div", {
    class: "transfer-command-editor",
    children: [
      el("span", {
        class: "transfer-command-summary",
        text: `${mapName} (${cmd.x}, ${cmd.y}) / ${transferDirectionLabel(cmd.direction)} / 페이드: ${transferFadeLabel(cmd.fade)}`,
        dataset: { testid: "transfer-command-summary" },
      }),
      ...passabilityBadge,
      el("button", {
        class: "btn small",
        text: "장소 이동...",
        dataset: { testid: "transfer-player-open" },
        attrs: { type: "button" },
        on: {
          click: () => openTransferPlayerDialog({
            command: cmd,
            onApply: (command) => context.actions.replaceCommand(context.path, command),
          }),
        },
      }),
    ],
  });
}

function waitBody(context: CommandEditContext, cmd: Extract<Command, { kind: "wait" }>): HTMLElement {
  const ms = el("input", {
    attrs: { type: "number", min: "0", title: "대기 시간(ms)" },
    value: String(cmd.ms),
  }) as HTMLInputElement;
  ms.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      kind: "wait",
      ms: parseInt(ms.value, 10) || 0,
    });
  });
  return ms;
}

function advanceTimeBody(context: CommandEditContext, cmd: Extract<Command, { kind: "advanceTime" }>): HTMLElement {
  const days = numberInput(cmd.days ?? 0, "일", "advance-time-days-input");
  const hours = numberInput(cmd.hours ?? 0, "시간", "advance-time-hours-input");
  const minutes = numberInput(cmd.minutes ?? 0, "분", "advance-time-minutes-input");
  const apply = () => {
    const nextDays = Math.max(0, parseInt(days.value, 10) || 0);
    const nextHours = Math.max(0, parseInt(hours.value, 10) || 0);
    const nextMinutes = Math.max(0, parseInt(minutes.value, 10) || 0);
    context.actions.replaceCommand(context.path, {
      kind: "advanceTime",
      ...(nextDays > 0 ? { days: nextDays } : {}),
      ...(nextHours > 0 ? { hours: nextHours } : {}),
      ...(nextMinutes > 0 ? { minutes: nextMinutes } : {}),
    });
  };
  for (const control of [days, hours, minutes]) {
    control.addEventListener("change", apply);
    control.addEventListener("input", apply);
  }
  return el("span", { class: "rich-command-form", children: [el("span", { class: "rich-form-row", children: [days, hours, minutes] })] });
}

function setTimeBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setTime" }>): HTMLElement {
  const hour = numberInput(cmd.hour, "시", "set-time-hour-input");
  hour.setAttribute("min", "0");
  hour.setAttribute("max", "48");
  const minute = numberInput(cmd.minute ?? 0, "분", "set-time-minute-input");
  minute.setAttribute("min", "0");
  minute.setAttribute("max", "59");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "setTime",
      hour: Math.max(0, parseInt(hour.value, 10) || 0),
      minute: Math.max(0, Math.min(59, parseInt(minute.value, 10) || 0)),
    });
  };
  for (const control of [hour, minute]) {
    control.addEventListener("change", apply);
    control.addEventListener("input", apply);
  }
  return el("span", { class: "rich-command-form", children: [el("span", { class: "rich-form-row", children: [hour, minute] })] });
}

function setEventGraphicPatternBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "setEventGraphicPattern" }>
): HTMLElement {
  const eventId = textInput(cmd.eventId, "이벤트 ID(빈 값=이 이벤트)", "set-event-graphic-pattern-event-input");
  const pattern = numberInput(cmd.pattern, "프레임 인덱스", "set-event-graphic-pattern-frame-input");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "setEventGraphicPattern",
      eventId: eventId.value.trim(),
      pattern: parseInt(pattern.value, 10) || 0,
    });
  };
  eventId.addEventListener("change", apply);
  eventId.addEventListener("input", apply);
  pattern.addEventListener("change", apply);
  pattern.addEventListener("input", apply);
  const wrap = el("span", { class: "rich-command-form" });
  wrap.append(el("span", { class: "rich-form-row", children: [eventId, pattern] }));
  return wrap;
}

function callCommonEventBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "callCommonEvent" }>
): HTMLElement {
  const project = store.getCurrent();
  const ceSel = el("select") as HTMLSelectElement;
  ceSel.append(el("option", { text: "(선택)", attrs: { value: "" } }));
  for (const ce of project.commonEvents) {
    ceSel.append(el("option", { text: ce.name, attrs: { value: ce.id } }));
  }
  ceSel.value = cmd.commonEventId;
  ceSel.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      kind: "callCommonEvent",
      commonEventId: ceSel.value,
    });
  });
  return ceSel;
}

function callMapEventBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "callMapEvent" }>
): HTMLElement {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId;
  const map = mapId ? project.maps[mapId] : undefined;
  const sel = el("select", { dataset: { testid: "event-command-call-map-event-select" } }) as HTMLSelectElement;
  sel.append(el("option", { text: "(이벤트 선택)", attrs: { value: "" } }));
  for (const event of map?.events ?? []) {
    sel.append(el("option", { text: `${event.id} (${event.x}, ${event.y})`, attrs: { value: event.id } }));
  }
  sel.value = cmd.eventId;
  sel.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, { kind: "callMapEvent", eventId: sel.value });
  });
  return sel;
}

function learnSkillBody(context: CommandEditContext, cmd: Extract<Command, { kind: "learnSkill" }>): HTMLElement {
  const project = store.getCurrent();
  // 액터/스킬 픽커: 얼굴(또는 이니셜) + 직업 부제, 스킬은 MP/위력 부제.
  const actor = recordPickerWithPreview({
    records: project.database.actors,
    selectedId: cmd.actorId,
    placeholder: "주인공 선택",
    testid: "learn-skill-actor-select",
    iconOf: (record) => facesetIconOf(project, record.faceResourceId),
    subtitleOf: (record) => actorSubtitle(project, record),
  });
  const skill = recordPickerWithPreview({
    records: project.database.skills,
    selectedId: cmd.skillId,
    placeholder: "특수기 선택",
    testid: "learn-skill-skill-select",
    subtitleOf: (record) => `MP ${record.mpCost.flat} · 위력 ${record.power}`,
  });
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "learnSkill",
      actorId: actor.select.value,
      skillId: skill.select.value,
    });
  };
  actor.select.addEventListener("change", apply);
  skill.select.addEventListener("change", apply);
  const wrap = el("span", { class: "rich-command-form" });
  wrap.append(
    el("span", { class: "rich-form-row", children: [actor.root] }),
    el("span", { class: "rich-form-row", children: [skill.root] })
  );
  return wrap;
}

function showPictureBody(context: CommandEditContext, cmd: Extract<Command, { kind: "showPicture" }>): HTMLElement {
  const pictureId = textInput(cmd.pictureId, "그림 번호", "show-picture-id-input");
  const resourceId = textInput(cmd.resourceId, "그림 리소스 ID", "show-picture-resource-input");
  const x = numberInput(cmd.x, "X 좌표", "show-picture-x-input");
  const y = numberInput(cmd.y, "Y 좌표", "show-picture-y-input");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "showPicture",
      pictureId: pictureId.value.trim() || "pic1",
      resourceId: resourceId.value.trim(),
      x: parseInt(x.value, 10) || 0,
      y: parseInt(y.value, 10) || 0,
    });
  };
  for (const control of [pictureId, resourceId, x, y]) control.addEventListener("change", apply);
  const wrap = el("span", {});
  wrap.append(pictureId, resourceId, x, y);
  return wrap;
}

function erasePictureBody(context: CommandEditContext, cmd: Extract<Command, { kind: "erasePicture" }>): HTMLElement {
  const pictureId = textInput(cmd.pictureId, "그림 번호", "erase-picture-id-input");
  pictureId.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      kind: "erasePicture",
      pictureId: pictureId.value.trim() || "pic1",
    });
  });
  return pictureId;
}

function playAudioBody(context: CommandEditContext, cmd: Extract<Command, { kind: "playAudio" }>): HTMLElement {
  const resourceId = textInput(cmd.resourceId, "오디오 리소스 ID", "play-audio-resource-input");
  const loop = selectWithOptions(BOOLEAN_OPTIONS, String(cmd.loop), "play-audio-loop-select");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "playAudio",
      resourceId: resourceId.value.trim(),
      loop: loop.value === "true",
    });
  };
  resourceId.addEventListener("change", apply);
  loop.addEventListener("change", apply);
  const wrap = el("span", {});
  wrap.append(resourceId, loop);
  return wrap;
}

function setLightingBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setLighting" }>): HTMLElement {
  const ambient = numberInput(cmd.ambient, "암전 정도(0~1)", "set-lighting-ambient-input");
  ambient.setAttribute("step", "0.05");
  ambient.setAttribute("min", "0");
  ambient.setAttribute("max", "1");
  const color = textInput(cmd.color ?? "#000000", "마스크 색상", "set-lighting-color-input");
  const transitionMs = numberInput(cmd.transitionMs ?? 0, "전환 시간(ms)", "set-lighting-transition-input");
  transitionMs.setAttribute("min", "0");
  const apply = () => {
    const nextTransition = Math.max(0, parseInt(transitionMs.value, 10) || 0);
    context.actions.replaceCommand(context.path, {
      kind: "setLighting",
      ambient: clamp01(parseFloat(ambient.value)),
      color: color.value.trim() || undefined,
      ...(nextTransition > 0 ? { transitionMs: nextTransition } : {}),
    });
  };
  for (const control of [ambient, color, transitionMs]) {
    control.addEventListener("change", apply);
    control.addEventListener("input", apply);
  }
  return el("span", { class: "rich-command-form", children: [el("span", { class: "rich-form-row", children: [ambient, color, transitionMs] })] });
}

function addLightBody(context: CommandEditContext, cmd: Extract<Command, { kind: "addLight" }>): HTMLElement {
  const id = textInput(cmd.source.id, "광원 ID", "add-light-id-input");
  const anchorKind = selectWithOptions(
    [
      { value: "player", label: "플레이어" },
      { value: "event", label: "이벤트" },
      { value: "position", label: "좌표" },
    ],
    lightAnchorKind(cmd.source.at),
    "add-light-anchor-kind-select"
  );
  const eventId = textInput(cmd.source.at !== "player" && "eventId" in cmd.source.at ? cmd.source.at.eventId : "", "이벤트 ID", "add-light-event-id-input");
  const x = numberInput(cmd.source.at !== "player" && "x" in cmd.source.at ? cmd.source.at.x : 0, "X", "add-light-x-input");
  const y = numberInput(cmd.source.at !== "player" && "y" in cmd.source.at ? cmd.source.at.y : 0, "Y", "add-light-y-input");
  const radius = numberInput(cmd.source.radius, "반경(타일)", "add-light-radius-input");
  radius.setAttribute("min", "0");
  const intensity = numberInput(cmd.source.intensity ?? 1, "세기(0~1)", "add-light-intensity-input");
  intensity.setAttribute("step", "0.05");
  intensity.setAttribute("min", "0");
  intensity.setAttribute("max", "1");
  const color = textInput(cmd.source.color ?? "", "광원 색상", "add-light-color-input");
  const flicker = selectWithOptions(BOOLEAN_OPTIONS, String(cmd.source.flicker === true), "add-light-flicker-select");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "addLight",
      source: {
        id: id.value.trim() || "light_1",
        at: lightAnchorFromControls(anchorKind.value, eventId.value, x.value, y.value),
        radius: Math.max(0, parseFloat(radius.value) || 0),
        intensity: clamp01(parseFloat(intensity.value)),
        ...(color.value.trim() ? { color: color.value.trim() } : {}),
        ...(flicker.value === "true" ? { flicker: true } : {}),
      },
    });
  };
  for (const control of [id, anchorKind, eventId, x, y, radius, intensity, color, flicker]) {
    control.addEventListener("change", apply);
    control.addEventListener("input", apply);
  }
  const wrap = el("span", { class: "rich-command-form" });
  wrap.append(
    el("span", { class: "rich-form-row", children: [id, anchorKind, eventId] }),
    el("span", { class: "rich-form-row", children: [x, y, radius, intensity] }),
    el("span", { class: "rich-form-row", children: [color, flicker] })
  );
  return wrap;
}

function removeLightBody(context: CommandEditContext, cmd: Extract<Command, { kind: "removeLight" }>): HTMLElement {
  const all = selectWithOptions(BOOLEAN_OPTIONS, String(cmd.all === true), "remove-light-all-select");
  const id = textInput(cmd.id ?? "", "광원 ID", "remove-light-id-input");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "removeLight",
      ...(all.value === "true" ? { all: true } : { id: id.value.trim() }),
    });
  };
  all.addEventListener("change", apply);
  id.addEventListener("change", apply);
  id.addEventListener("input", apply);
  return el("span", { class: "rich-command-form", children: [el("span", { class: "rich-form-row", children: [all, id] })] });
}

function setWeatherBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setWeather" }>): HTMLElement {
  const kind = selectWithOptions(
    [
      { value: "none", label: "없음" },
      { value: "rain", label: "비" },
      { value: "storm", label: "폭풍" },
      { value: "snow", label: "눈" },
      { value: "fog", label: "안개" },
    ],
    cmd.weather,
    "set-weather-kind-select"
  );
  const intensity = numberInput(cmd.intensity ?? 0.5, "강도(0~1)", "set-weather-intensity-input");
  intensity.setAttribute("step", "0.05");
  intensity.setAttribute("min", "0");
  intensity.setAttribute("max", "1");
  const transitionMs = numberInput(cmd.transitionMs ?? 0, "전환 시간(ms)", "set-weather-transition-input");
  transitionMs.setAttribute("min", "0");
  const apply = () => {
    const nextTransition = Math.max(0, parseInt(transitionMs.value, 10) || 0);
    context.actions.replaceCommand(context.path, {
      kind: "setWeather",
      weather: kind.value as Extract<Command, { kind: "setWeather" }>["weather"],
      intensity: clamp01(parseFloat(intensity.value)),
      ...(nextTransition > 0 ? { transitionMs: nextTransition } : {}),
    });
  };
  for (const control of [kind, intensity, transitionMs]) {
    control.addEventListener("change", apply);
    control.addEventListener("input", apply);
  }
  return el("span", { class: "rich-command-form", children: [el("span", { class: "rich-form-row", children: [kind, intensity, transitionMs] })] });
}

function showAnimationBody(context: CommandEditContext, cmd: Extract<Command, { kind: "showAnimation" }>): HTMLElement {
  const project = store.getCurrent();
  const targetKind = selectWithOptions(
    [
      { value: "player", label: "플레이어" },
      { value: "event", label: "이벤트" },
      { value: "position", label: "좌표" },
    ],
    showAnimationTargetKind(cmd.target),
    "show-animation-target-kind-select"
  );
  const eventId = textInput(cmd.target !== "player" && "eventId" in cmd.target ? cmd.target.eventId : "", "이벤트 ID", "show-animation-event-id-input");
  const x = numberInput(cmd.target !== "player" && "x" in cmd.target ? cmd.target.x : 0, "X", "show-animation-x-input");
  const y = numberInput(cmd.target !== "player" && "y" in cmd.target ? cmd.target.y : 0, "Y", "show-animation-y-input");
  const wait = selectWithOptions(BOOLEAN_OPTIONS, String(cmd.wait === true), "show-animation-wait-select");
  const animation = recordPickerWithPreview({
    records: project.database.battleAnimations,
    selectedId: cmd.animationId,
    placeholder: "전투 애니메이션",
    testid: "show-animation-animationId-select",
    subtitleOf: (record) => record.resourceId ?? null,
  });
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "showAnimation",
      target: showAnimationTargetFromControls(targetKind.value, eventId.value, x.value, y.value),
      animationId: animation.select.value || project.database.battleAnimations[0]?.id || "",
      ...(wait.value === "true" ? { wait: true } : {}),
    });
  };
  for (const control of [targetKind, eventId, x, y, wait, animation.select]) {
    control.addEventListener("change", apply);
    control.addEventListener("input", apply);
  }
  const wrap = el("span", { class: "rich-command-form" });
  wrap.append(
    el("span", { class: "rich-form-row", children: [targetKind, eventId, x, y, wait] }),
    el("span", { class: "rich-form-row", children: [animation.root] })
  );
  return wrap;
}

function endingBody(context: CommandEditContext, cmd: Extract<Command, { kind: "ending" }>): HTMLElement {
  const title = textInput(cmd.title, "엔딩 제목", "ending-title-input");
  const message = el("textarea", {
    attrs: { placeholder: "엔딩 메시지" },
    dataset: { testid: "ending-message-input" },
  }) as HTMLTextAreaElement;
  message.value = cmd.message;
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "ending",
      title: title.value.trim() || "The End",
      message: message.value,
    });
  };
  title.addEventListener("change", apply);
  title.addEventListener("input", apply);
  message.addEventListener("change", apply);
  message.addEventListener("input", apply);
  const wrap = el("span", {});
  wrap.append(title, message);
  return wrap;
}

function terminalHint(testId: string, text: string): HTMLElement {
  return el("span", {
    class: "terminal-command-editor empty-hint",
    text,
    dataset: { testid: testId },
  });
}

export function mapSelect(currentId: string, testId?: string): HTMLSelectElement {
  const project = store.getCurrent();
  const mapSel = el("select", {
    dataset: testId ? { testid: testId } : undefined,
  }) as HTMLSelectElement;
  mapSel.append(el("option", { text: "(맵 선택)", attrs: { value: "" } }));
  for (const id of Object.keys(project.maps)) {
    mapSel.append(el("option", { text: project.maps[id].name || id, attrs: { value: id } }));
  }
  mapSel.value = currentId;
  return mapSel;
}

function textInput(value: string, placeholder: string, testId: string): HTMLInputElement {
  return el("input", {
    attrs: { type: "text", placeholder },
    value,
    dataset: { testid: testId },
  }) as HTMLInputElement;
}

export function numberInput(value: number, title: string, testId: string): HTMLInputElement {
  return el("input", {
    attrs: { type: "number", title },
    value: String(value),
    dataset: { testid: testId },
  }) as HTMLInputElement;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function lightAnchorKind(anchor: Extract<Command, { kind: "addLight" }>["source"]["at"]): "player" | "event" | "position" {
  if (anchor === "player") return "player";
  if ("eventId" in anchor) return "event";
  return "position";
}

function lightAnchorFromControls(kind: string, eventId: string, xValue: string, yValue: string): Extract<Command, { kind: "addLight" }>["source"]["at"] {
  if (kind === "player") return "player";
  if (kind === "event") return { eventId: eventId.trim() };
  return { x: parseInt(xValue, 10) || 0, y: parseInt(yValue, 10) || 0 };
}

function showAnimationTargetKind(target: Extract<Command, { kind: "showAnimation" }>["target"]): "player" | "event" | "position" {
  if (target === "player") return "player";
  if ("eventId" in target) return "event";
  return "position";
}

function showAnimationTargetFromControls(
  kind: string,
  eventId: string,
  xValue: string,
  yValue: string
): Extract<Command, { kind: "showAnimation" }>["target"] {
  if (kind === "player") return "player";
  if (kind === "event") return { eventId: eventId.trim() };
  return { x: parseInt(xValue, 10) || 0, y: parseInt(yValue, 10) || 0 };
}
