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
    case "enterHeroName":
      return enterHeroNameBody(context, cmd);
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
