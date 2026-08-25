import {
  listDatabaseResourceOptions,
  openDatabaseResourcePickerDialog,
} from "@/editor/panels/databaseResourcePickerDialog";
import { getAudioEngine, playAudioCommand, stopAudioCommand } from "@/player/audio";
import { resolveAudioSource } from "@/player/audio/audioResources";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { el } from "@/util/dom";
import { databasePicker } from "./conditionForm";
import { innBody, shopBody } from "./commandBodyCommerce";
import {
  battleProcessingBody,
  changeActorHpBody,
  changeActorMpBody,
  changeEquipmentBody,
  changeExpBody,
  changeGoldBody,
  changeItemBody,
  craftRecipeBody,
  applyItemUpgradeBody,
  equipToolBody,
  openChestBody,
  changeLevelBody,
  changePartyBody,
  enterHeroNameBody,
  evolveMonsterBody,
  giveMonsterBody,
  moveMonsterBody,
  promoteActorBody,
  recoverAllBody,
} from "./commandBodyDatabase";
import {
  actorPicker,
  facesetIconOf,
  previewStrip,
  recordIconElement,
  searchableRecordBrowser,
  segmentedSelect,
  type SegmentOption,
} from "./recordPicker";
import { isPassable } from "@/project/collision";
import { moveEventBody } from "./commandBodyRoute";
import {
  addLightBody,
  changeTileBody,
  erasePictureBody,
  removeLightBody,
  setLightingBody,
  setWeatherBody,
  showAnimationBody,
  showPictureBody,
} from "./commandBodyPage3Native";
import { renderTransferPicker, transferDirectionLabel, transferFadeLabel } from "./transferPlayerDialog";
import {
  CHARSET_CHARACTER_COUNT,
  CHARSET_FRAME_COUNT,
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  charsetFrameIndex,
  charsetFrameSource,
  decodeCharsetFrameIndex,
  type CharsetDirection,
} from "@/assets/easyrpgRtp";
import { projectCharsetAssets, type CharsetPickerAsset } from "@/assets/charsetCatalog";
import { applyTransparentColorKeyBackground } from "@/assets/transparentColorKeyBackground";
import {
  renderDirectionRadioGroup,
  renderGraphicResourceList,
  renderPatternRadioGroup,
  setActiveGraphicResource,
  setClass,
} from "./npcGraphicPickerControls";
import { HOUSE_DOOR_CHARSET_TEXTURE } from "@/editor/houseInteriors";
import type { Command, EventPageGraphic, GameEvent, GameMap, Project } from "@/project/types";
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
    case "advanceCropGrowth":
      return advanceCropGrowthBody(context, cmd);
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
      return optionalTextCommandBody(context, cmd, "checkpoint-save-editor", "이름", "event-command-checkpoint-label", "label");
    case "runControl":
      return runControlBody(context, cmd);
    case "killPlayer":
      return optionalTextCommandBody(context, cmd, "kill-player-editor", "패배 메시지", "event-command-kill-player-message", "message");
    case "triggerEnding":
      return triggerEndingBody(context, cmd);
    case "addFollower":
      return addFollowerBody(context, cmd);
    case "removeFollower":
      return removeFollowerBody(context, cmd);
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
    case "craftRecipe":
      return craftRecipeBody(context, cmd);
    case "applyItemUpgrade":
      return applyItemUpgradeBody(context, cmd);
    case "equipTool":
      return equipToolBody(context, cmd);
    case "openChest":
      return openChestBody(context, cmd);
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

function runControlBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "runControl" }>
): HTMLElement {
  const wrap = el("div", {
    class: "rich-command-form",
    dataset: { testid: "event-command-run-control" },
  });
  const action = simpleSelect([
    ["start", "탐험 시작"],
    ["advance", "다음 층"],
    ["end", "탐험 종료"],
    ["setFlag", "탐험 기억"],
    ["resetRoom", "방 초기화"],
  ], cmd.action, "event-command-run-action");
  action.addEventListener("change", () => {
    const next = action.value;
    if (next === "advance") context.actions.replaceCommand(context.path, { kind: "runControl", action: "advance", amount: 1 });
    else if (next === "end") context.actions.replaceCommand(context.path, { kind: "runControl", action: "end", result: "completed" });
    else if (next === "setFlag") context.actions.replaceCommand(context.path, { kind: "runControl", action: "setFlag", flag: "flag1", value: true });
    else if (next === "resetRoom") context.actions.replaceCommand(context.path, { kind: "runControl", action: "resetRoom" });
    else context.actions.replaceCommand(context.path, { kind: "runControl", action: "start" });
  });
  wrap.append(inlineField("동작", action));

  switch (cmd.action) {
    case "start": {
      const seed = numberInput(cmd.seed ?? 0, "시드", "event-command-run-seed");
      const autoSeed = el("input", {
        attrs: { type: "checkbox" },
        dataset: { testid: "event-command-run-seed-auto" },
      }) as HTMLInputElement;
      autoSeed.checked = cmd.seed === undefined;
      seed.disabled = autoSeed.checked;
      const runId = textInput(cmd.runId ?? "", "자동 생성", "event-command-run-id");
      const floor = numberInput(cmd.startFloor ?? 1, "시작 층", "event-command-run-start-floor");
      floor.min = "1";
      floor.max = "9999";
      const apply = (): void => context.actions.replaceCommand(context.path, {
        kind: "runControl",
        action: "start",
        ...(!autoSeed.checked ? { seed: Math.trunc(Number(seed.value) || 0) } : {}),
        ...(runId.value.trim() ? { runId: runId.value.trim() } : {}),
        startFloor: Math.max(1, Math.min(9_999, Math.trunc(Number(floor.value) || 1))),
      });
      autoSeed.addEventListener("change", () => { seed.disabled = autoSeed.checked; apply(); });
      seed.addEventListener("change", apply);
      runId.addEventListener("change", apply);
      floor.addEventListener("change", apply);
      wrap.append(inlineField("자동 난수", autoSeed), inlineField("난수 씨앗", seed), inlineField("탐험 이름", runId), inlineField("시작 층", floor));
      break;
    }
    case "advance": {
      const amount = numberInput(cmd.amount ?? 1, "증가 층", "event-command-run-advance-amount");
      amount.min = "1";
      amount.addEventListener("change", () => context.actions.replaceCommand(context.path, {
        kind: "runControl",
        action: "advance",
        amount: Math.max(1, Math.trunc(Number(amount.value) || 1)),
      }));
      wrap.append(inlineField("증가", amount));
      break;
    }
    case "end": {
      const result = simpleSelect([
        ["completed", "완료"],
        ["failed", "실패"],
        ["abandoned", "포기"],
      ], cmd.result, "event-command-run-result");
      result.addEventListener("change", () => context.actions.replaceCommand(context.path, {
        kind: "runControl",
        action: "end",
        result: result.value === "failed" ? "failed" : result.value === "abandoned" ? "abandoned" : "completed",
      }));
      wrap.append(inlineField("결과", result));
      break;
    }
    case "setFlag": {
      let currentFlag = cmd.flag;
      let currentValue = cmd.value;
      const flag = textInput(currentFlag, "플래그 이름", "event-command-run-flag");
      const value = simpleSelect([["true", "켜기"], ["false", "끄기"]], String(currentValue), "event-command-run-flag-value");
      const apply = (): void => context.actions.replaceCommand(context.path, {
        kind: "runControl",
        action: "setFlag",
        flag: currentFlag,
        value: currentValue,
      });
      flag.addEventListener("change", () => { currentFlag = flag.value.trim(); apply(); });
      value.addEventListener("change", () => { currentValue = value.value === "true"; apply(); });
      wrap.append(inlineField("플래그", flag), inlineField("값", value));
      break;
    }
    case "resetRoom": {
      const roomId = textInput(cmd.roomId ?? "", "비우면 현재 방", "event-command-run-room-id");
      roomId.addEventListener("change", () => context.actions.replaceCommand(context.path, {
        kind: "runControl",
        action: "resetRoom",
        ...(roomId.value.trim() ? { roomId: roomId.value.trim() } : {}),
      }));
      wrap.append(inlineField("방 ID", roomId));
      break;
    }
  }
  return wrap;
}

function simpleSelect(
  options: readonly (readonly [string, string])[],
  value: string,
  testId: string
): HTMLSelectElement {
  const select = el("select", { dataset: { testid: testId } }) as HTMLSelectElement;
  for (const [optionValue, label] of options) {
    select.append(el("option", { text: label, attrs: { value: optionValue } }));
  }
  select.value = value;
  return select;
}

function inlineField(label: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "inline-field", children: [el("span", { text: label }), control] });
}

function optionalTextCommandBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "checkpointSave" | "killPlayer" }>,
  testId: string,
  label: string,
  inputTestId: string,
  key: "label" | "message"
): HTMLElement {
  const input = el("input", {
    attrs: { type: "text" },
    value: cmd.kind === "checkpointSave" ? (cmd.label ?? "") : (cmd.message ?? ""),
    dataset: { testid: inputTestId },
  }) as HTMLInputElement;
  input.addEventListener("change", () => {
    const value = input.value.trim();
    context.actions.replaceCommand(context.path, {
      kind: cmd.kind,
      ...(value ? { [key]: value } : {}),
    } as Extract<Command, { kind: "checkpointSave" | "killPlayer" }>);
  });
  return el("div", {
    class: "terminal-command-editor",
    dataset: { testid: testId },
    children: [el("label", { class: "inline-field", children: [el("span", { text: label }), input] })],
  });
}

function triggerEndingBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "triggerEnding" }>
): HTMLElement {
  const select = el("select", {
    dataset: { testid: "event-command-trigger-ending-id" },
  }) as HTMLSelectElement;
  select.append(el("option", { text: "조건에 맞는 엔딩 자동 선택", attrs: { value: "" } }));
  for (const ending of store.getCurrent().endings ?? []) {
    select.append(el("option", { text: ending.name, attrs: { value: ending.id } }));
  }
  select.value = cmd.endingId ?? "";
  select.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      kind: "triggerEnding",
      ...(select.value ? { endingId: select.value } : {}),
    });
  });
  return el("div", {
    class: "terminal-command-editor",
    dataset: { testid: "trigger-ending-editor" },
    children: [el("label", { class: "inline-field", children: [el("span", { text: "엔딩" }), select] })],
  });
}

function addFollowerBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "addFollower" }>
): HTMLElement {
  const actor = el("select", { dataset: { testid: "event-command-add-follower-actor-id" } }) as HTMLSelectElement;
  actor.append(el("option", { text: "이름만 적기", attrs: { value: "" } }));
  for (const record of store.getCurrent().database.actors) {
    actor.append(el("option", { text: record.name, attrs: { value: record.id } }));
  }
  actor.value = cmd.actorId ?? "";
  const name = el("input", {
    attrs: { type: "text" },
    value: cmd.name ?? "",
    dataset: { testid: "event-command-add-follower-name" },
  }) as HTMLInputElement;
  const useGraphic = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "event-command-add-follower-use-graphic" },
  }) as HTMLInputElement;
  useGraphic.checked = Boolean(cmd.graphic);
  const graphicType = el("select", { dataset: { testid: "event-command-add-follower-graphic-type" } }) as HTMLSelectElement;
  graphicType.append(
    el("option", { text: "기본 모습", attrs: { value: "bundled" } }),
    el("option", { text: "올린 그림", attrs: { value: "uploaded" } })
  );
  graphicType.value = cmd.graphic?.sprite?.type ?? "bundled";
  const graphicId = el("input", {
    attrs: { type: "text" },
    value: cmd.graphic?.sprite?.id ?? "",
    dataset: { testid: "event-command-add-follower-graphic-id" },
  }) as HTMLInputElement;
  const direction = el("select", { dataset: { testid: "event-command-add-follower-graphic-direction" } }) as HTMLSelectElement;
  const directionLabels = { down: "아래", left: "왼쪽", right: "오른쪽", up: "위" } as const;
  for (const option of ["down", "left", "right", "up"] as const) {
    direction.append(el("option", { text: directionLabels[option], attrs: { value: option } }));
  }
  direction.value = cmd.graphic?.direction ?? "down";
  const pattern = el("input", {
    attrs: { type: "number", min: "0", max: "3", step: "1" },
    value: String(cmd.graphic?.pattern ?? 1),
    dataset: { testid: "event-command-add-follower-graphic-pattern" },
  }) as HTMLInputElement;
  const transparent = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "event-command-add-follower-graphic-transparent" },
  }) as HTMLInputElement;
  transparent.checked = cmd.graphic?.transparent ?? false;

  const commit = () => {
    const actorId = actor.value.trim();
    const followerName = name.value.trim();
    const graphicEnabled = useGraphic.checked || Boolean(cmd.graphic);
    const selectedDirection = (["down", "left", "right", "up"] as const).find((value) => value === direction.value)
      ?? cmd.graphic?.direction
      ?? "down";
    context.actions.replaceCommand(context.path, {
      kind: "addFollower",
      ...(actorId ? { actorId } : {}),
      ...(followerName ? { name: followerName } : {}),
      ...(graphicEnabled ? {
        graphic: {
          ...(graphicId.value.trim() ? { sprite: { type: graphicType.value === "uploaded" ? "uploaded" : "bundled", id: graphicId.value.trim() } } : {}),
          direction: selectedDirection,
          pattern: Math.max(0, Math.trunc(Number(pattern.value) || 0)),
          transparent: transparent.checked,
        },
      } : {}),
    });
  };
  for (const control of [actor, name, useGraphic, graphicType, graphicId, direction, pattern, transparent]) {
    control.addEventListener("change", commit);
  }
  const graphicFields = el("div", {
    class: "rich-form-stack",
    children: [
      inlineField("모습 종류", graphicType),
      inlineField("모습", graphicId),
      inlineField("방향", direction),
      inlineField("모습 칸", pattern),
      inlineField("투명", transparent),
    ],
  });
  const syncGraphic = (): void => {
    graphicFields.style.display = useGraphic.checked ? "" : "none";
  };
  useGraphic.addEventListener("change", syncGraphic);
  syncGraphic();
  return el("div", {
    class: "rich-command-form cream-command-form",
    dataset: { testid: "add-follower-editor" },
    children: [
      inlineField("누구", actor),
      inlineField("이름", name),
      inlineField("모습 직접 정하기", useGraphic),
      graphicFields,
    ],
  });
}

function removeFollowerBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "removeFollower" }>
): HTMLElement {
  const mode = el("select", { dataset: { testid: "event-command-remove-follower-mode" } }) as HTMLSelectElement;
  mode.append(
    el("option", { text: "이름으로 제거", attrs: { value: "name" } }),
    el("option", { text: "모두 제거", attrs: { value: "all" } })
  );
  mode.value = cmd.all ? "all" : "name";
  const name = el("input", {
    attrs: { type: "text" },
    value: cmd.name ?? "",
    dataset: { testid: "event-command-remove-follower-name" },
  }) as HTMLInputElement;
  const commit = () => {
    const followerName = name.value.trim();
    context.actions.replaceCommand(context.path,
      mode.value === "all" || !followerName
        ? { kind: "removeFollower", all: true }
        : { kind: "removeFollower", name: followerName }
    );
  };
  mode.addEventListener("change", commit);
  name.addEventListener("change", commit);
  return el("div", {
    class: "rich-command-form cream-command-form",
    dataset: { testid: "remove-follower-editor" },
    children: [inlineField("어떻게", mode), inlineField("이름", name)],
  });
}

function transferBody(context: CommandEditContext, cmd: Extract<Command, { kind: "transfer" }>): HTMLElement {
  const project = store.getCurrent();
  // Seed empty mapId with current editor map / start map so the picker is usable immediately.
  const seededMapId =
    (cmd.mapId && project.maps[cmd.mapId] && cmd.mapId) ||
    editorState.get().currentMapId ||
    project.startMapId ||
    Object.keys(project.maps)[0] ||
    "";
  const seeded: Extract<Command, { kind: "transfer" }> = {
    ...cmd,
    mapId: seededMapId,
  };
  if (!cmd.mapId && seededMapId) {
    // Persist seed once so summary/preview do not stay on "(map)".
    Promise.resolve().then(() => {
      context.actions.replaceCommand(context.path, seeded);
    });
  }

  const map = seeded.mapId ? project.maps[seeded.mapId] : undefined;
  const passable = map ? isPassable(project, map, seeded.x, seeded.y) : undefined;
  const host = el("div", {
    class: "transfer-command-editor transfer-command-editor-inline",
    dataset: { testid: "event-transfer-player-dialog" },
  });
  const summary = el("div", {
    class: "transfer-command-summary-row",
    children: [
      el("span", {
        class: "transfer-command-summary",
        text: `${map?.name ?? (seeded.mapId || "(맵)")} (${seeded.x}, ${seeded.y}) / ${transferDirectionLabel(seeded.direction)} / 페이드: ${transferFadeLabel(seeded.fade)}`,
        dataset: { testid: "transfer-command-summary" },
      }),
      ...(passable === undefined
        ? []
        : [
            el("span", {
              class: `rich-badge ${passable ? "passable" : "blocked"}`,
              text: passable ? "통행 가능" : "통행 불가 타일!",
              dataset: { testid: "transfer-passability-badge", passable: String(passable) },
            }),
          ]),
    ],
  });
  const pickerHost = el("div", {
    class: "transfer-command-inline-picker",
    dataset: { testid: "transfer-player-open" },
  });
  // Compatibility: tests click transfer-player-open; keep the testid on the inline host.
  renderTransferPicker(
    pickerHost,
    {
      command: seeded,
      hideFooter: true,
      liveApply: true,
      onApply: (command) => context.actions.replaceCommand(context.path, command),
    },
    () => undefined
  );
  host.append(summary, pickerHost);
  return host;
}

function waitBody(context: CommandEditContext, cmd: Extract<Command, { kind: "wait" }>): HTMLElement {
  let currentMs = Math.max(0, Math.trunc(cmd.ms) || 0);
  let currentVariableId = cmd.variableId?.trim() ?? "";
  let currentMode: "time" | "variable" = currentVariableId ? "variable" : "time";

  const wrap = el("div", {
    class: "event-command-wait-body",
    dataset: { testid: "event-command-wait-body" },
  });

  const apply = () => {
    if (currentMode === "variable") {
      context.actions.replaceCommand(context.path, {
        kind: "wait",
        ms: currentMs,
        ...(currentVariableId ? { variableId: currentVariableId } : {}),
      });
      return;
    }
    context.actions.replaceCommand(context.path, {
      kind: "wait",
      ms: currentMs,
    });
  };

  const modeGroup = `event-wait-mode-${context.path.join("-") || "root"}`;
  const timeRadio = el("input", {
    attrs: { type: "radio", name: modeGroup, value: "time" },
    dataset: { testid: "event-wait-mode-time" },
  }) as HTMLInputElement;
  const variableRadio = el("input", {
    attrs: { type: "radio", name: modeGroup, value: "variable" },
    dataset: { testid: "event-wait-mode-variable" },
  }) as HTMLInputElement;
  timeRadio.checked = currentMode === "time";
  variableRadio.checked = currentMode === "variable";

  const seconds = el("input", {
    attrs: {
      type: "number",
      min: "0",
      step: "0.1",
      title: "대기 시간(초)",
    },
    value: (currentMs / 1000).toFixed(currentMs % 1000 === 0 ? 0 : 1),
    dataset: { testid: "event-wait-seconds" },
  }) as HTMLInputElement;

  const msHint = el("span", {
    class: "event-command-wait-ms-hint",
    dataset: { testid: "event-wait-ms-hint" },
    text: `${(currentMs / 1000).toFixed(currentMs % 100 === 0 ? (currentMs % 1000 === 0 ? 0 : 1) : 2)}초`,
  });

  const syncSecondsFromMs = () => {
    seconds.value = (currentMs / 1000).toFixed(currentMs % 1000 === 0 ? 0 : currentMs % 100 === 0 ? 1 : 2);
    msHint.textContent = `${(currentMs / 1000).toFixed(currentMs % 100 === 0 ? (currentMs % 1000 === 0 ? 0 : 1) : 2)}초`;
  };

  const setMsFromSeconds = () => {
    const sec = Number(seconds.value);
    currentMs = Number.isFinite(sec) ? Math.max(0, Math.round(sec * 1000)) : 0;
    msHint.textContent = `${(currentMs / 1000).toFixed(currentMs % 100 === 0 ? (currentMs % 1000 === 0 ? 0 : 1) : 2)}초`;
    apply();
  };
  seconds.addEventListener("change", setMsFromSeconds);
  seconds.addEventListener("input", setMsFromSeconds);

  const presets = el("div", {
    class: "event-command-wait-presets",
    dataset: { testid: "event-wait-presets" },
  });
  for (const preset of [
    { label: "0.1초", ms: 100 },
    { label: "0.5초", ms: 500 },
    { label: "1초", ms: 1000 },
    { label: "2초", ms: 2000 },
  ] as const) {
    presets.append(
      el("button", {
        class: "btn small event-command-wait-preset",
        text: preset.label,
        attrs: { type: "button" },
        dataset: { testid: `event-wait-preset-${preset.ms}` },
        on: {
          click: () => {
            currentMode = "time";
            timeRadio.checked = true;
            variableRadio.checked = false;
            currentMs = preset.ms;
            syncSecondsFromMs();
            renderModePanels();
            apply();
          },
        },
      })
    );
  }

  const variablePicker = databasePicker(
    "variable",
    currentVariableId,
    (variableId) => {
      currentVariableId = variableId;
      apply();
    },
    "event-wait-variable"
  );

  const timePanel = el("div", {
    class: "event-command-wait-time-panel",
    dataset: { testid: "event-wait-time-panel" },
    children: [
      el("label", {
        class: "inline-field",
        children: [el("span", { text: "시간(초)" }), seconds],
      }),
      msHint,
      presets,
    ],
  });

  const variablePanel = el("div", {
    class: "event-command-wait-variable-panel",
    dataset: { testid: "event-wait-variable-panel" },
    children: [
      el("label", {
        class: "inline-field",
        children: [el("span", { text: "변수" }), variablePicker],
      }),
      el("p", {
        class: "event-command-choices-hint",
        text: "변수 값만큼 초 단위로 기다립니다.",
      }),
    ],
  });

  const renderModePanels = () => {
    timePanel.hidden = currentMode !== "time";
    variablePanel.hidden = currentMode !== "variable";
  };

  const setMode = (next: "time" | "variable") => {
    currentMode = next;
    timeRadio.checked = next === "time";
    variableRadio.checked = next === "variable";
    renderModePanels();
    apply();
  };
  timeRadio.addEventListener("change", () => {
    if (timeRadio.checked) setMode("time");
  });
  variableRadio.addEventListener("change", () => {
    if (variableRadio.checked) setMode("variable");
  });

  wrap.append(
    el("fieldset", {
      class: "event-oprn-fieldset event-command-wait-mode",
      children: [
        el("legend", { text: "대기 방식" }),
        el("label", {
          class: "event-command-cancel-row",
          children: [timeRadio, el("span", { text: "시간" })],
        }),
        el("label", {
          class: "event-command-cancel-row",
          children: [variableRadio, el("span", { text: "변수 값" })],
        }),
      ],
    }),
    timePanel,
    variablePanel
  );
  renderModePanels();
  return wrap;
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
  return el("span", {
    class: "rich-command-form cream-command-form",
    children: [
      el("span", {
        class: "rich-form-row",
        children: [
          el("label", { class: "inline-field", children: [el("span", { text: "일" }), days] }),
          el("label", { class: "inline-field", children: [el("span", { text: "시간" }), hours] }),
          el("label", { class: "inline-field", children: [el("span", { text: "분" }), minutes] }),
        ],
      }),
    ],
  });
}

function advanceCropGrowthBody(context: CommandEditContext, cmd: Extract<Command, { kind: "advanceCropGrowth" }>): HTMLElement {
  const days = numberInput(cmd.days ?? 1, "일", "advance-crop-growth-days-input");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "advanceCropGrowth",
      days: Math.max(0, parseInt(days.value, 10) || 0),
    });
  };
  days.addEventListener("change", apply);
  days.addEventListener("input", apply);
  return el("span", {
    class: "rich-command-form cream-command-form",
    children: [
      el("span", { class: "rich-form-row", children: [el("label", { class: "inline-field", children: [el("span", { text: "일" }), days] })] }),
    ],
  });
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
  return el("span", {
    class: "rich-command-form cream-command-form",
    children: [
      el("span", {
        class: "rich-form-row",
        children: [
          el("label", { class: "inline-field", children: [el("span", { text: "시" }), hour] }),
          el("label", { class: "inline-field", children: [el("span", { text: "분" }), minute] }),
        ],
      }),
    ],
  });
}

function setEventGraphicPatternBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "setEventGraphicPattern" }>
): HTMLElement {
  // Named event + charset sheet. Stored value remains the absolute charset frame.
  const SLOT_SCALE = 2;
  const PROBE_SCALE = 2;

  const wrap = el("div", {
    class: "event-command-frame-editor event-graphic-rm-picker cream-command-form",
    dataset: { testid: "event-command-frame-editor" },
  });

  const eventSel = mapEventSelect(cmd.eventId, "set-event-graphic-pattern-event-input");
  const pattern = numberInput(cmd.pattern, "프레임 인덱스", "set-event-graphic-pattern-frame-input");
  pattern.setAttribute("min", "0");
  pattern.setAttribute("max", String(CHARSET_FRAME_COUNT - 1));
  pattern.setAttribute("step", "1");
  pattern.classList.add("event-command-frame-absolute-input");
  pattern.hidden = true;

  const decoded0 = decodeCharsetFrameIndex(cmd.pattern);
  let characterIndex = decoded0.characterIndex;
  let direction: CharsetDirection = decoded0.direction;
  let walkPattern = decoded0.pattern;
  const charsetAssets = projectCharsetAssets(store.getCurrent());
  let asset = resolveAssetForEvent(eventSel.value.trim(), charsetAssets) ?? firstCharsetAsset(charsetAssets);

  const slotButtons: HTMLButtonElement[] = [];
  const slotGrid = document.createElement("div");
  slotGrid.className = "npc-character-grid event-graphic-preview-panel";
  slotGrid.dataset.testid = "event-command-frame-character-grid";
  for (let index = 0; index < CHARSET_CHARACTER_COUNT; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "npc-character-cell";
    button.dataset.testid = `event-command-frame-slot-${index}`;
    button.dataset.slot = String(index);
    button.title = `캐릭터 ${index + 1}`;
    button.addEventListener("click", () => {
      characterIndex = index;
      apply();
    });
    slotButtons.push(button);
    slotGrid.append(button);
  }

  const frameProbe = document.createElement("div");
  frameProbe.className = "npc-frame-preview event-graphic-frame-probe";
  frameProbe.dataset.testid = "event-command-frame-probe";

  const walkPreview = document.createElement("div");
  walkPreview.className = "npc-walk-preview";
  walkPreview.dataset.testid = "event-command-frame-walk-preview";
  walkPreview.title = "걷기 애니메이션 미리보기";

  const probeStack = document.createElement("div");
  probeStack.className = "event-graphic-probe-stack";
  probeStack.append(frameProbe, walkPreview);

  const directionGroup = renderDirectionRadioGroup(direction, (next) => {
    direction = next;
    apply();
  });
  directionGroup.root.dataset.testid = "event-command-frame-direction-group";

  const patternGroup = renderPatternRadioGroup(walkPattern, (next) => {
    walkPattern = next;
    apply();
  });
  patternGroup.root.dataset.testid = "event-command-frame-pattern-group";

  // Keep walk-chip testids for door open sequence / legacy tests.
  const doorSeqHost = el("div", {
    class: "event-command-frame-door-seq",
    dataset: { testid: "event-command-frame-door-seq" },
  });

  const optionArea = document.createElement("div");
  optionArea.className = "event-graphic-option-area";
  optionArea.append(directionGroup.root, patternGroup.root);

  const resourceList = renderGraphicResourceList(charsetAssets, (nextAsset) => {
    asset = nextAsset;
    apply();
  });

  const rightPane = document.createElement("div");
  rightPane.className = "event-graphic-right-pane";
  rightPane.append(slotGrid, optionArea, probeStack);

  const pickerFrame = document.createElement("div");
  pickerFrame.className = "event-graphic-picker-frame";
  pickerFrame.append(resourceList.root, rightPane);

  const absoluteFrame = (): number =>
    charsetFrameIndex({ characterIndex, direction, pattern: walkPattern });

  const apply = () => {
    const frame = absoluteFrame();
    pattern.value = String(frame);
    context.actions.replaceCommand(context.path, {
      kind: "setEventGraphicPattern",
      eventId: eventSel.value.trim(),
      pattern: frame,
    });
    refresh();
  };

  const paintDoorSeq = () => {
    doorSeqHost.replaceChildren(
      el("div", {
        class: "event-command-frame-field-label",
        text: "문 열림 프리셋 (Object1: 아래 → 오른쪽 → 위)",
      })
    );
    const steps: readonly { readonly dir: CharsetDirection; readonly label: string; readonly step: 0 | 1 | 2 }[] = [
      { dir: "down", label: "1 아래", step: 0 },
      { dir: "right", label: "2 오른쪽", step: 1 },
      { dir: "up", label: "3 위", step: 2 },
    ];
    const row = el("div", { class: "event-command-frame-door-seq-row" });
    for (const entry of steps) {
      const active = direction === entry.dir && walkPattern === 0;
      row.append(
        el("button", {
          class: active
            ? "btn small event-command-frame-door-step active"
            : "btn small event-command-frame-door-step",
          text: entry.label,
          attrs: {
            type: "button",
            title: entry.label,
          },
          dataset: {
            testid: "event-command-frame-door-step-" + String(entry.step),
            frame: String(charsetFrameIndex({ characterIndex, direction: entry.dir, pattern: 0 })),
          },
          on: {
            click: () => {
              direction = entry.dir;
              walkPattern = 0;
              apply();
            },
          },
        })
      );
    }
    doorSeqHost.append(row);
  };

  const refresh = () => {
    const frame = absoluteFrame();
    pattern.value = String(frame);
    setActiveGraphicResource(resourceList.buttons, asset.textureKey);
    directionGroup.setValue(direction);
    patternGroup.setValue(walkPattern);
    applyCharsetChipStyle(frameProbe, asset, characterIndex, direction, walkPattern, PROBE_SCALE);
    applyWalkProbeStyle(walkPreview, asset, characterIndex, direction, PROBE_SCALE);
    for (const button of slotButtons) {
      const slot = Number(button.dataset.slot ?? "-1");
      setClass(button, "active", slot === characterIndex);
      applyCharsetChipStyle(button, asset, slot, direction, walkPattern, SLOT_SCALE);
    }
    paintDoorSeq();
  };

  eventSel.addEventListener("change", () => {
    const next = resolveAssetForEvent(eventSel.value.trim(), charsetAssets);
    if (next) asset = next;
    const targetGraphic = authoredGraphicForEvent(eventSel.value.trim());
    if (typeof targetGraphic?.pattern === "number") {
      const decoded = decodeCharsetFrameIndex(targetGraphic.pattern);
      characterIndex = decoded.characterIndex;
      // Keep current direction/pattern for authoring open frames; only lock slot/file.
    }
    apply();
  });

  wrap.append(
    el("div", {
      class: "event-command-frame-target-row",
      children: [
        el("label", { class: "event-command-frame-field-label", text: "대상 이벤트" }),
        eventSel,
      ],
    }),
    pickerFrame,
    doorSeqHost,
    pattern
  );
  refresh();
  return wrap;
}

function firstCharsetAsset(assets: readonly CharsetPickerAsset[]): CharsetPickerAsset {
  const first = assets[0];
  if (!first) throw new Error("EasyRPG 캐릭터 그림 목록이 비어 있습니다");
  return first;
}

function resolveAssetForEvent(eventId: string, assets: readonly CharsetPickerAsset[]): CharsetPickerAsset | undefined {
  const graphic = authoredGraphicForEvent(eventId);
  const id = graphic?.sprite?.id;
  const findByKey = (key: string) => assets.find((a) => a.textureKey === key);
  if (!id) return findByKey(HOUSE_DOOR_CHARSET_TEXTURE) ?? firstCharsetAsset(assets);
  return findByKey(id) ?? findByKey(HOUSE_DOOR_CHARSET_TEXTURE) ?? firstCharsetAsset(assets);
}

function authoredGraphicForEvent(eventId: string): EventPageGraphic | undefined {
  const target = resolvePatternTargetEvent(eventId);
  const pages = target?.event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const graphic = pages[index]?.graphic;
    if (graphic?.sprite?.id && graphic.transparent !== true) return graphic;
  }
  for (const page of pages) {
    if (page.graphic?.sprite?.id) return page.graphic;
  }
  return undefined;
}

function applyCharsetChipStyle(
  target: HTMLElement,
  asset: CharsetPickerAsset,
  characterIndex: number,
  direction: CharsetDirection,
  walkPattern: number,
  scale: number
): void {
  const selection = { characterIndex, direction, pattern: walkPattern };
  const source = charsetFrameSource(selection);
  target.dataset.slot = String(characterIndex);
  target.dataset.direction = direction;
  target.dataset.pattern = String(walkPattern);
  target.style.width = `${CHARSET_FRAME_WIDTH * scale}px`;
  target.style.height = `${CHARSET_FRAME_HEIGHT * scale}px`;
  applyTransparentColorKeyBackground(target, asset.path);
  target.style.backgroundSize = `${CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH * scale}px ${
    CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT * scale
  }px`;
  target.style.backgroundPosition = `-${source.x * scale}px -${source.y * scale}px`;
}

function applyWalkProbeStyle(
  target: HTMLElement,
  asset: CharsetPickerAsset,
  characterIndex: number,
  direction: CharsetDirection,
  scale: number
): void {
  applyCharsetChipStyle(target, asset, characterIndex, direction, 1, scale);
  for (const pattern of [0, 1, 2] as const) {
    const source = charsetFrameSource({ characterIndex, direction, pattern });
    target.style.setProperty(`--npc-walk-frame-${pattern}`, `-${source.x * scale}px -${source.y * scale}px`);
  }
}



function mapEventSelect(currentId: string, testId: string): HTMLSelectElement {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId;
  const map = mapId ? project.maps[mapId] : undefined;
  const sel = el("select", {
    dataset: { testid: testId },
    class: "event-command-frame-event-select",
  }) as HTMLSelectElement;
  const known = new Set<string>([""]);
  sel.append(el("option", { text: "(이 이벤트)", attrs: { value: "" } }));
  for (const event of map?.events ?? []) {
    known.add(event.id);
    sel.append(el("option", { text: event.id, attrs: { value: event.id } }));
  }
  // Keep free-typed / foreign-map ids visible even if not on the current map list.
  if (currentId && !known.has(currentId)) {
    sel.append(el("option", { text: `${currentId} (다른 맵/미등록)`, attrs: { value: currentId } }));
  }
  sel.value = currentId;
  return sel;
}

function resolvePatternTargetEvent(
  eventId: string
): { readonly map: GameMap; readonly event: GameEvent } | null {
  const project = store.getCurrent();
  const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
  const mapId = modal?.dataset.mapId ?? editorState.get().currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  if (!map) return null;
  const targetId =
    eventId || modal?.dataset.eventId || editorState.get().selectedEventId || "";
  if (!targetId) return null;
  const event = map.events.find((entry) => entry.id === targetId);
  if (!event) return null;
  return { map, event };
}

/** Resolve the charset graphic the runtime frame change will paint on. */
export function graphicForPatternPreview(eventId: string, pattern: number): EventPageGraphic {
  const target = resolvePatternTargetEvent(eventId);
  const pages = target?.event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const graphic = pages[index]?.graphic;
    if (graphic?.sprite?.id && graphic.transparent !== true) {
      return { ...graphic, pattern };
    }
  }
  for (const page of pages) {
    const graphic = page.graphic;
    if (graphic?.sprite?.id) return { ...graphic, pattern };
  }
  // Door/object open sequences commonly use Object1 when context is missing (tests / free ids).
  return {
    sprite: { type: "bundled", id: HOUSE_DOOR_CHARSET_TEXTURE },
    pattern,
  };
}


function callCommonEventBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "callCommonEvent" }>
): HTMLElement {
  const project = store.getCurrent();
  const ceSel = el("select", { dataset: { testid: "event-command-call-common-event-select" } }) as HTMLSelectElement;
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
    sel.append(el("option", { text: event.id, attrs: { value: event.id } }));
  }
  sel.value = cmd.eventId;
  sel.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, { kind: "callMapEvent", eventId: sel.value });
  });
  return sel;
}

function learnSkillBody(context: CommandEditContext, cmd: Extract<Command, { kind: "learnSkill" }>): HTMLElement {
  const project = store.getCurrent();
  const actors = project.database.actors;
  const skills = project.database.skills;
  const actionValue: "learn" | "forget" = cmd.action === "forget" ? "forget" : "learn";
  const targetMode: "party" | "actor" = !cmd.actorId || cmd.actorId === "party" || cmd.actorId === "all"
    ? "party"
    : "actor";

  const action = segmentedSelect({
    options: LEARN_SKILL_ACTION_SEGMENTS,
    value: actionValue,
    testid: "learn-skill-action-select",
    ariaLabel: "스킬 동작",
  });
  const target = segmentedSelect({
    options: LEARN_SKILL_TARGET_SEGMENTS,
    value: targetMode,
    testid: "learn-skill-target-mode",
    ariaLabel: "스킬 대상",
  });
  const actor = actorPicker({
    project,
    selectedId: targetMode === "actor" ? cmd.actorId : "",
    testid: "learn-skill-actor-select",
  });
  const skill = searchableRecordBrowser({
    records: skills,
    selectedId: cmd.skillId,
    testidPrefix: "learn-skill",
    selectTestId: "learn-skill-skill-select",
    selectedCardAliasTestId: "learn-skill-skill-select-card",
    label: "스킬",
    searchPlaceholder: "스킬 검색",
    emptySelectionLabel: "스킬 선택",
    noneCardLabel: "스킬 선택",
    noneCardMeta: "비우기",
    clearLabel: "해제",
    allowNone: true,
    includeNoneCard: true,
    iconOf: () => null,
    subtitleOf: (record) => skillSubtitle(record),
    searchTextOf: (record) =>
      [record.name, record.id, record.description, skillSubtitle(record)].join(" "),
    onChange: () => {
      apply();
    },
  });
  const preview = previewStrip("learn-skill-preview", "");
  const actorField = skillField("주인공", actor.root);

  const renderPreview = () => {
    const skillId = skill.getSelectedId();
    const skillRecord = skills.find((entry) => entry.id === skillId);
    const actorRecord = actors.find((entry) => entry.id === actor.select.value);
    const who = target.select.value === "party"
      ? "파티"
      : (actorRecord?.name ?? (actor.select.value || "주인공"));
    const verb = action.select.value === "forget" ? "잊기" : "배우기";
    const skillName = skillRecord?.name ?? (skillId || "스킬");
    const detail = skillRecord
      ? `MP ${skillRecord.mpCost.flat} · 위력 ${skillRecord.power}`
      : "";
    preview.root.dataset.action = action.select.value;
    preview.root.dataset.target = target.select.value;
    preview.body.replaceChildren(
      el("span", { class: "rich-skill-badge", text: "SK", attrs: { "aria-hidden": "true" } }),
      ...(actorRecord && target.select.value === "actor"
        ? [recordIconElement(facesetIconOf(project, actorRecord.faceResourceId), actorRecord.name)]
        : []),
      el("span", { text: who }),
      el("span", { class: "rich-preview-arrow", text: "·" }),
      el("span", {
        class: `rich-preview-after ${action.select.value === "forget" ? "loss" : "gain"}`,
        text: `${verb} ${skillName}`,
      }),
      ...(detail ? [el("span", { class: "rich-preview-caption-inline", text: detail })] : []),
    );
  };

  const syncVisibility = () => {
    actorField.hidden = target.select.value === "party";
  };

  const apply = () => {
    renderPreview();
    context.actions.replaceCommand(context.path, {
      kind: "learnSkill",
      actorId: target.select.value === "party" ? "" : actor.select.value,
      skillId: skill.getSelectedId(),
      action: action.select.value === "forget" ? "forget" : "learn",
    });
  };

  action.select.addEventListener("change", apply);
  target.select.addEventListener("change", () => {
    syncVisibility();
    apply();
  });
  actor.select.addEventListener("change", apply);
  skill.select.addEventListener("change", apply);
  syncVisibility();
  renderPreview();

  const wrap = el("div", {
    class: "rich-command-form learn-skill-command-body actor-amount-command-body",
    dataset: { testid: "event-command-learn-skill-form" },
  });
  wrap.append(
    skillField("액션", action.root),
    skillField("대상", target.root),
    actorField,
    skill.root,
    preview.root,
  );
  return wrap;
}

const LEARN_SKILL_ACTION_SEGMENTS = [
  { value: "learn", key: "learn", label: "배우기" },
  { value: "forget", key: "forget", label: "잊기" },
] as const satisfies readonly SegmentOption<"learn" | "forget">[];

const LEARN_SKILL_TARGET_SEGMENTS = [
  { value: "party", key: "party", label: "파티" },
  { value: "actor", key: "actor", label: "주인공" },
] as const satisfies readonly SegmentOption<"party" | "actor">[];

function skillField(label: string, control: HTMLElement): HTMLElement {
  return el("div", {
    class: "party-member-field learn-skill-field",
    children: [
      el("div", { class: "party-member-field-label", text: label }),
      control,
    ],
  });
}

function skillSubtitle(record: { readonly mpCost: { readonly flat: number }; readonly power: number; readonly scope: string; readonly type: string }): string {
  const scopeLabel =
    record.scope === "allEnemies" ? "적 전체"
      : record.scope === "allAllies" ? "아군 전체"
      : record.scope === "enemy" ? "적 1명"
        : record.scope === "ally" ? "아군"
          : "자신";
  const typeLabel = record.type === "normal" ? "" : ` · ${record.type}`;
  return `MP ${record.mpCost.flat} · 위력 ${record.power} · ${scopeLabel}${typeLabel}`;
}

function playAudioBody(context: CommandEditContext, cmd: Extract<Command, { kind: "playAudio" }>): HTMLElement {
  const project = store.getCurrent();
  getAudioEngine().installUnlockListeners();

  let channel: "bgm" | "se" = cmd.loop ? "bgm" : "se";
  let resourceId = cmd.resourceId.trim();

  const wrap = el("div", {
    class: "play-audio-command-body cream-command-form",
    dataset: { testid: "play-audio-command-body" },
  });

  const channelRow = el("div", { class: "play-audio-channel-row", dataset: { testid: "play-audio-channel-row" } });
  const list = el("select", {
    class: "play-audio-resource-select",
    attrs: { "aria-label": "소리" },
    dataset: { testid: "play-audio-resource-select" },
  }) as HTMLSelectElement;
  const search = el("input", {
    class: "play-audio-search",
    attrs: { type: "search", placeholder: "검색 (이름/ID)", autocomplete: "off" },
    dataset: { testid: "play-audio-search" },
  }) as HTMLInputElement;
  const status = el("div", {
    class: "play-audio-status",
    dataset: { testid: "play-audio-status" },
  });
  const resultCount = el("div", {
    class: "play-audio-result-count",
    dataset: { testid: "play-audio-result-count" },
  });
  const meta = el("div", {
    class: "play-audio-meta",
    dataset: { testid: "play-audio-meta" },
  });

  const apply = (): void => {
    context.actions.replaceCommand(context.path, {
      kind: "playAudio",
      resourceId,
      loop: channel === "bgm",
    });
    refreshMeta();
  };

  const refreshMeta = (): void => {
    const url = resolveAudioSource(resourceId, project);
    const playable = isBrowserPlayableAudioUrl(url);
    const label = currentOptionLabel(list) || resourceId || "(선택 없음)";
    meta.replaceChildren(
      el("div", { class: "play-audio-meta-name", text: label }),
      el("div", {
        class: playable ? "play-audio-badge ok" : "play-audio-badge warn",
        text: !resourceId
          ? "곡을 먼저 고르세요"
          : playable
            ? "미리 듣기 가능"
            : url?.toLowerCase().endsWith(".mid")
              ? "이 형식은 미리 들을 수 없습니다"
              : "미리 듣기 불가",
      })
    );
    status.textContent = "대기 중";
  };

  const rebuildChannelButtons = (): void => {
    channelRow.replaceChildren();
    for (const option of [
      { value: "bgm" as const, label: "배경음" },
      { value: "se" as const, label: "효과음" },
    ]) {
      channelRow.append(
        el("button", {
          class: "play-audio-channel-btn" + (channel === option.value ? " active" : ""),
          text: option.label,
          attrs: { type: "button", "aria-pressed": String(channel === option.value) },
          dataset: { testid: `play-audio-channel-${option.value}` },
          on: {
            click: () => {
              channel = option.value;
              // Prefer a sensible default when switching channel with empty/wrong-kind id.
              if (!resourceId || !catalogFor(channel, project).some((entry) => entry.id === resourceId)) {
                resourceId = catalogFor(channel, project)[0]?.id ?? "";
              }
              rebuildChannelButtons();
              refreshChannelCopy();
              fillList();
              apply();
            },
          },
        })
      );
    }
  };

  const fillList = (): void => {
    const query = search.value.trim().toLowerCase();
    const fullCatalog = catalogFor(channel, project);
    const catalog = fullCatalog.filter((entry) => {
      if (!query) return true;
      if (entry.name.toLowerCase().includes(query) || entry.id.toLowerCase().includes(query)) return true;
      return entry.searchTerms?.some((term) => term.toLowerCase().includes(query)) ?? false;
    });
    resultCount.textContent = query
      ? `전체 ${fullCatalog.length}개 중 ${catalog.length}개`
      : `${channel === "bgm" ? "배경음" : "효과음"} ${catalog.length}개`;
    list.replaceChildren();
    list.append(el("option", { text: "(선택 없음)", attrs: { value: "" } }));
    if (resourceId && !catalog.some((entry) => entry.id === resourceId) && !query) {
      list.append(el("option", { text: currentAudioLabel(resourceId, project), attrs: { value: resourceId } }));
    }
    for (const entry of catalog) {
      const mark = entry.playable ? "" : " · MIDI 비재생";
      list.append(
        el("option", {
          text: `${entry.name}${mark}`,
          attrs: { value: entry.id },
        })
      );
    }
    list.value = resourceId;
    if (list.value !== resourceId && resourceId) {
      // keep custom id visible
      list.append(el("option", { text: resourceId, attrs: { value: resourceId } }));
      list.value = resourceId;
    }
  };

  list.addEventListener("change", () => {
    resourceId = list.value.trim();
    apply();
  });
  search.addEventListener("input", () => fillList());

  const playBtn = el("button", {
    class: "btn primary",
    text: "미리 듣기",
    attrs: { type: "button" },
    dataset: { testid: "play-audio-preview" },
    on: {
      click: () => {
        getAudioEngine().unlock();
        if (!resourceId) {
          status.textContent = "리소스를 먼저 선택하세요";
          return;
        }
        const url = resolveAudioSource(resourceId, store.getCurrent());
        if (!isBrowserPlayableAudioUrl(url)) {
          status.textContent = url?.toLowerCase().endsWith(".mid")
            ? "MIDI는 웹에서 재생되지 않습니다. CC0 Field Loop 등 WAV를 고르세요."
            : "이 리소스는 재생할 수 없습니다";
          return;
        }
        stopAudioCommand();
        playAudioCommand({ resourceId, loop: channel === "bgm" }, store.getCurrent());
        status.textContent = `재생 중: ${currentOptionLabel(list) || currentAudioLabel(resourceId, store.getCurrent())}`;
      },
    },
  });
  const stopBtn = el("button", {
    class: "btn",
    text: "정지",
    attrs: { type: "button" },
    dataset: { testid: "play-audio-stop" },
    on: {
      click: () => {
        stopAudioCommand();
        status.textContent = "정지됨";
      },
    },
  });
  const browseBtn = el("button", {
    class: "btn",
    text: "목록에서 고르기…",
    attrs: { type: "button" },
    dataset: { testid: "play-audio-resource-picker" },
    on: {
      click: () => {
        openDatabaseResourcePickerDialog({
          kind: channel === "bgm" ? "music" : "sound",
          title: channel === "bgm" ? "배경음 선택" : "효과음 선택",
          currentId: resourceId,
          onConfirm: (result) => {
            resourceId = result.resourceId.trim();
            fillList();
            apply();
          },
        });
      },
    },
  });

  const refreshChannelCopy = (): void => {
    search.placeholder = channel === "bgm"
      ? "장면·분위기 검색 (예: 마을, 보스, 비)"
      : "장면·행동 검색 (예: 문, 구매, 마법)";
    browseBtn.textContent = channel === "bgm" ? "배경음 목록 열기…" : "효과음 목록 열기…";
  };

  rebuildChannelButtons();
  refreshChannelCopy();
  fillList();
  refreshMeta();

  wrap.append(
    el("div", { class: "play-audio-label", text: "채널" }),
    channelRow,
    el("div", { class: "play-audio-label", text: "곡" }),
    search,
    resultCount,
    list,
    meta,
    el("div", {
      class: "play-audio-actions",
      children: [playBtn, stopBtn, browseBtn],
    }),
    status,
    el("div", {
      class: "empty-hint",
      text: "배경음은 반복되고, 효과음은 한 번만 재생됩니다. 미리 듣기는 브라우저가 재생할 수 있는 소리만 됩니다.",
      dataset: { testid: "play-audio-channel-hint" },
    })
  );
  return wrap;
}

type AudioCatalogEntry = {
  readonly id: string;
  readonly name: string;
  readonly playable: boolean;
  readonly searchTerms?: readonly string[];
};

function catalogFor(channel: "bgm" | "se", project: Project): readonly AudioCatalogEntry[] {
  return listDatabaseResourceOptions(channel === "bgm" ? "music" : "sound", project).map((entry) => ({
    ...entry,
    playable: isBrowserPlayableAudioUrl(resolveAudioSource(entry.id, project)),
  }));
}

function isBrowserPlayableAudioUrl(url: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.endsWith(".wav") || lower.endsWith(".ogg") || lower.endsWith(".mp3") || lower.endsWith(".m4a") || lower.startsWith("data:audio/");
}

function currentOptionLabel(select: HTMLSelectElement): string {
  const option = select.selectedOptions[0];
  return option?.textContent?.trim() ?? "";
}

function currentAudioLabel(resourceId: string, project: Project): string {
  const named = listDatabaseResourceOptions("music", project).find((entry) => entry.id === resourceId)
    ?? listDatabaseResourceOptions("sound", project).find((entry) => entry.id === resourceId);
  if (named?.name.trim()) return named.name;
  const trimmed = resourceId.trim();
  return trimmed ? trimmed.replace(/^(bgm|se|cc0-bgm)-/, "").replace(/_/g, " ") : "(선택 없음)";
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

/** @internal test export */
export function playAudioBodyForTest(
  context: Parameters<typeof playAudioBody>[0],
  cmd: Parameters<typeof playAudioBody>[1]
): HTMLElement {
  return playAudioBody(context, cmd);
}
