import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { el } from "@/util/dom";
import { selectWithOptions } from "./dom";
import { innBody, shopBody } from "./commandBodyCommerce";
import {
  battleProcessingBody,
  changeActorHpBody,
  changeActorMpBody,
  changeEquipmentBody,
  changeExpBody,
  changeGoldBody,
  changeItemBody,
  changeLevelBody,
  changePartyBody,
  recoverAllBody,
} from "./commandBodyDatabase";
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
    case "moveEvent":
      return moveEventBody(context, cmd);
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
    case "changeEquipment":
      return changeEquipmentBody(context, cmd);
    case "changeActorHp":
      return changeActorHpBody(context, cmd);
    case "changeActorMp":
      return changeActorMpBody(context, cmd);
    case "recoverAll":
      return recoverAllBody(context, cmd);
    case "shop":
      return shopBody(context, cmd);
    case "inn":
      return innBody(context, cmd);
    case "changeGold":
      return changeGoldBody(context, cmd);
    case "changeItem":
      return changeItemBody(context, cmd);
    case "changeParty":
      return changePartyBody(context, cmd);
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
  const mapName = cmd.mapId ? project.maps[cmd.mapId]?.name ?? cmd.mapId : "(map)";
  return el("div", {
    class: "transfer-command-editor",
    children: [
      el("span", {
        class: "transfer-command-summary",
        text: `${mapName} (${cmd.x}, ${cmd.y}) / ${transferDirectionLabel(cmd.direction)} / 페이드: ${transferFadeLabel(cmd.fade)}`,
        dataset: { testid: "transfer-command-summary" },
      }),
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
  const actor = recordSelect(project.database.actors, cmd.actorId, "주인공 선택", "learn-skill-actor-select");
  const skill = recordSelect(project.database.skills, cmd.skillId, "특수기 선택", "learn-skill-skill-select");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "learnSkill",
      actorId: actor.value,
      skillId: skill.value,
    });
  };
  actor.addEventListener("change", apply);
  skill.addEventListener("change", apply);
  const wrap = el("span", {});
  wrap.append(actor, skill);
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

function recordSelect(
  records: readonly { readonly id: string; readonly name: string }[],
  currentId: string,
  placeholder: string,
  testId: string
): HTMLSelectElement {
  const select = el("select", { dataset: { testid: testId } }) as HTMLSelectElement;
  select.append(el("option", { text: `(${placeholder})`, attrs: { value: "" } }));
  for (const [index, record] of records.entries()) {
    select.append(el("option", { text: `${String(index + 1).padStart(4, "0")}: ${record.name}`, attrs: { value: record.id } }));
  }
  select.value = currentId;
  return select;
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
