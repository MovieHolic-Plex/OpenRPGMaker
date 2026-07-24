import { el } from "@/util/dom";
import { store } from "@/project/store";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { DEFAULT_BATTLE_FIELD_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import { parseDialogueText } from "@/player/dialogue";
import type { DialogueTextControl } from "@/player/dialoguePagination";
import { renderFacesetCrop } from "./facesetPreview";
import { drawTransferFallback, drawTransferMapPreview } from "./transferMapPreview";
import { facesetIconOf, initialBadge, recordIconElement } from "./recordPicker";
import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
import { commandLabel } from "./commandPicker";
import { commandSummaryParts, isSummaryIconPart } from "./commandSummary";
import { formatVariableFormula } from "./commandBodyVariable";
import { previewAudio } from "./previewAudio";
import { previewForkFlow } from "./previewForkFlow";
import { previewMoveRoute } from "./previewMoveRoute";
import { previewPicture } from "./previewPicture";
import { graphicForPatternPreview } from "./commandBodyAdvanced";
import { renderEventGraphicPreview } from "./eventGraphicPreview";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Command } from "@/project/types";
import type { PreviewSimState } from "./previewSimulation";
import { getSimSwitch, getSimVariable, getSimItem } from "./previewSimulation";

const PREVIEW_FACE_SIZE = 96;

export type CommandPreviewContext = {
  readonly face?: { readonly resourceId: string; readonly faceIndex: number };
  readonly simState?: PreviewSimState;
  readonly hostEventId?: string;
  readonly forkTaken?: "then" | "else";
  readonly skipped?: boolean;
};

// 명령 편집 모달 우측 "이미지 리치" 프리뷰 패널. staged command 를 받아 종류별 시각화를
// 렌더한다. 전용 렌더러가 없으면 요약 카드로 폴백한다(패널이 비어 보이지 않게).
export function renderCommandPreview(cmd: Command, context?: CommandPreviewContext): HTMLElement {
  const panel = el("div", {
    class: "event-command-preview",
    dataset: { testid: "event-command-preview-body", previewKind: cmd.kind },
  });
  if (context?.skipped) panel.classList.add("ecp-skipped");
  panel.append(el("div", { class: "ecp-caption", text: commandPreviewCaption(cmd) }));
  panel.append(renderVisual(cmd, context));
  return panel;
}

function commandPreviewCaption(cmd: Command): string {
  if (cmd.kind === "m2Command") {
    return m2CommandById(cmd.commandId)?.label ?? cmd.commandId;
  }
  return commandLabel(cmd.kind);
}

function renderVisual(cmd: Command, context?: CommandPreviewContext): HTMLElement {
  const handler = visualPreviewHandlers[cmd.kind] as VisualPreviewHandler<Command> | undefined;
  return handler ? handler(cmd, context) : summaryCard(cmd, context);
}

type VisualPreviewHandler<T extends Command> = (cmd: T, context?: CommandPreviewContext) => HTMLElement;
type VisualPreviewHandlers = {
  readonly [K in Command["kind"]]?: VisualPreviewHandler<Extract<Command, { kind: K }>>;
};

const visualPreviewHandlers: VisualPreviewHandlers = {
  text: (cmd, context) => messageWindowMock(cmd.speaker, cmd.body, false, context?.face),
  changeFace: faceStage,
  displayTextSettings: settingsMessageMock,
  choices: choicesMock,
  inputNumber: inputNumberStage,
  transfer: transferStage,
  moveEvent: previewMoveRoute,
  setEventGraphicPattern: patternStage,
  fork: (cmd, ctx) => previewForkFlow(cmd, ctx),
  showPicture: previewPicture,
  playAudio: previewAudio,
  stopAudio: previewAudio,
  changeItem: (cmd, ctx) => itemStage(cmd, ctx),
  shop: shopStage,
  inn: innStage,
  changeParty: (cmd, ctx) => actorStage(cmd.actorId, cmd.action === "add" ? "파티에 추가" : "파티에서 제외", ctx),
  addFollower: (cmd) => screenMock(cmd.name || cmd.actorId || "FOLLOWER", "title"),
  removeFollower: (cmd) => screenMock(cmd.all === true ? "FOLLOWERS OFF" : "FOLLOWER OFF", "title"),
  setLighting: lightingStage,
  addLight: lightSourceStage,
  removeLight: removeLightStage,
  setWeather: weatherStage,
  showAnimation: animationStage,
  erasePicture: erasePictureStage,
  changeTile: changeTileStage,
  inputWait: inputWaitStage,
  changeGold: (cmd, ctx) => goldStage(cmd, ctx),
  changeExp: (cmd, ctx) => expStage(cmd, ctx),
  learnSkill: skillStage,
  battleProcessing: battleStage,
  setSwitch: (cmd, ctx) => lampStage(switchName(cmd.switchId), resolveSwitchDisplay(cmd, ctx), ctx?.simState ? getSimSwitch(ctx.simState, cmd.switchId) : undefined),
  setVariable: variableStage,
  setSelfSwitch: (cmd) => lampStage(`셀프 스위치 ${cmd.key}`, cmd.value),
  setFlag: (cmd, ctx) => lampStage(cmd.flag || "플래그", cmd.value, ctx?.simState ? getSimSwitch(ctx.simState, cmd.flag) : undefined),
  checkpointSave: (cmd) => screenMock(cmd.label ? `체크포인트: ${cmd.label}` : "체크포인트 저장", "title"),
  killPlayer: () => screenMock("GAME OVER", "gameover"),
  triggerEnding: (cmd) => screenMock(cmd.endingId || "ENDING", "ending"),
  gameOver: () => screenMock("GAME OVER", "gameover"),
  returnToTitle: () => screenMock("타이틀 화면", "title"),
  ending: (cmd) => screenMock(cmd.title || "THE END", "ending"),
  wait: waitStage,
};

function messageWindowMock(
  speaker: string | undefined,
  body: string,
  faceRight: boolean,
  face?: CommandPreviewContext["face"]
): HTMLElement {
  const stage = el("div", { class: "ecp-stage" });
  // System.png 전체 시트를 border-image fill 로 쓰면 팔레트/숫자 스트립이 창을 덮는다.
  // 메시지 프리뷰는 windowskin-rm2003 CSS 목업만 사용한다 (상점 프리뷰와 동일 정책).
  const faceClass = face ? " with-face" : "";
  const sideClass = faceRight ? " face-right" : "";
  const speakerName = speaker?.trim() ?? "";
  const win = el("div", {
    class: "ecp-message-window" + sideClass + faceClass + (speakerName ? " has-speaker" : ""),
    dataset: { testid: "ecp-message-window" },
  });
  // [중간-3] 직전 changeFace 상태가 있으면 화자 얼굴을 프리뷰에 반영.
  // Crop only — no editor resource-id chrome inside the play mock.
  if (face) {
    win.append(
      renderFacesetCrop({
        resourceId: face.resourceId,
        faceIndex: face.faceIndex,
        displaySize: PREVIEW_FACE_SIZE,
      })
    );
  }
  const textCol = el("div", { class: "ecp-message-text" });
  textCol.append(renderPreviewDialogueBody(body));
  win.append(textCol);
  // 화자 네임플레이트는 창 밖(상단 가장자리)에 올려 본문과 시각적으로 분리한다.
  if (speakerName) {
    win.append(
      el("div", {
        class: "ecp-message-speaker ecp-message-speaker-nameplate",
        text: speakerName,
        dataset: { testid: "ecp-message-speaker" },
      })
    );
  }
  stage.append(win);
  return stage;
}

/** Resolve RM control codes the same way play-mode dialogue does (editor preview). */
function renderPreviewDialogueBody(body: string): HTMLElement {
  const project = store.getCurrent();
  const variableDefaults: Record<string, number> = {};
  for (const entry of project.variables ?? []) {
    variableDefaults[entry.id] = 0;
  }
  for (let i = 1; i <= 20; i += 1) {
    const id = "var_" + String(i).padStart(4, "0");
    if (variableDefaults[id] === undefined) variableDefaults[id] = 0;
  }
  const segments = parseDialogueText(body || "...", {
    session: { variables: variableDefaults, actorNames: {} },
    project,
  });
  const bodyEl = el("div", {
    class: "ecp-message-body",
    dataset: { testid: "ecp-message-body" },
  });
  let wrote = false;
  for (const segment of segments) {
    for (const control of segment.controlsBefore ?? []) {
      bodyEl.append(renderPreviewControlBadge(control));
      wrote = true;
    }
    if (!segment.text) continue;
    wrote = true;
    if (segment.colorIndex === 0) {
      bodyEl.append(document.createTextNode(segment.text));
      continue;
    }
    bodyEl.append(
      el("span", {
        class: "dialogue-color dialogue-color-" + String(segment.colorIndex),
        text: segment.text,
      })
    );
  }
  if (!wrote) {
    bodyEl.append(document.createTextNode(body.trim() ? "" : "..."));
  }
  return bodyEl;
}

/** Render each zero-width control exactly where it occurs in the authored sentence. */
function renderPreviewControlBadge(control: DialogueTextControl): HTMLElement {
  let key: string;
  let label: string;
  let glyph = "";
  switch (control.kind) {
    case "pause":
      key = "pause";
      label = "키 입력 대기";
      glyph = "!";
      break;
    case "wait":
      key = control.ms === 250 ? "wait-quarter" : control.ms === 1000 ? "wait-second" : `wait-${control.ms}`;
      label = control.ms === 250 ? "1/4초 지연" : control.ms === 1000 ? "1초 지연" : `${control.ms}ms 지연`;
      glyph = control.ms === 250 ? "." : control.ms === 1000 ? "|" : "";
      break;
    case "gold":
      key = "gold";
      label = "소지금 창 · 0 G";
      glyph = "$";
      break;
    case "fastOn":
      key = "fast-on";
      label = "즉시 표시 시작";
      glyph = ">";
      break;
    case "fastOff":
      key = "fast-off";
      label = "즉시 표시 끝";
      glyph = "<";
      break;
    case "autoClose":
      key = "skip-wait";
      label = "입력 대기 없이 닫기";
      glyph = "^";
      break;
    case "halfSpace":
      key = "space";
      label = "반각 공백";
      glyph = "_";
      break;
    case "speed":
      key = "speed";
      label = `표시 속도 ${control.value}`;
      glyph = "s";
      break;
  }
  return el("span", {
    class: "ecp-message-control-badge ecp-message-inline-control",
    text: glyph ? `${label} ${glyph}` : label,
    dataset: { testid: "ecp-message-control-" + key, controlKind: control.kind },
    attrs: { title: glyph ? `\\${glyph}` : label },
  });
}


function faceStage(cmd: Extract<Command, { kind: "changeFace" }>): HTMLElement {
  // Play mock: face graphic as it will appear next to dialogue — not the editor label card.
  const mode = /(-full|fullbody|-body)/i.test(cmd.resourceId)
    ? "full"
    : /(-bust|-portrait|generated-face-)/i.test(cmd.resourceId)
      ? "bust"
      : "chip";
  const whole = mode !== "chip";
  const side = cmd.position === "right" ? "right" : "left";
  const stage = el("div", {
    class: `ecp-stage ecp-face-stage${whole ? " ecp-face-stage-bust" : ""} ecp-face-pos-${side}`,
  });
  const win = el("div", {
    class: [
      "ecp-message-window",
      "with-face",
      "ecp-face-message",
      side === "right" ? "face-right" : "face-left",
      whole ? "with-bust" : "",
      whole ? `with-${mode}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    dataset: { testid: "ecp-message-window" },
  });
  if (whole) {
    const portrait = renderFacesetCrop({
      resourceId: cmd.resourceId,
      faceIndex: cmd.faceIndex,
      flipHorizontally: cmd.flipHorizontally,
      displaySize: mode === "full" ? 160 : 140,
      position: side,
    });
    portrait.classList.add(`ecp-portrait-${side}`);
    stage.append(portrait);
    win.append(
      el("div", {
        class: "ecp-message-text",
        children: [
          el("div", {
            class: "ecp-message-body",
            text: mode === "full" ? "대사 창 위에\n전신이 표시됩니다." : "대사 창 위에\n흉상이 표시됩니다.",
          }),
        ],
      })
    );
  } else {
    win.append(
      renderFacesetCrop({
        resourceId: cmd.resourceId,
        faceIndex: cmd.faceIndex,
        flipHorizontally: cmd.flipHorizontally,
        displaySize: PREVIEW_FACE_SIZE,
        position: side,
      }),
      el("div", {
        class: "ecp-message-text",
        children: [
          el("div", {
            class: "ecp-message-body",
            text: "대사 창에\n이 얼굴이 표시됩니다.",
          }),
        ],
      })
    );
  }
  stage.append(win);
  const sideLabel = side === "right" ? "오른쪽" : "왼쪽";
  const faceNo = Math.max(0, Math.trunc(cmd.faceIndex)) + 1;
  stage.append(
    el("div", {
      class: "ecp-face-caption",
      text: whole
        ? `${sideLabel} · ${mode === "full" ? "전신" : "흉상"}${cmd.flipHorizontally ? " · 좌우 반전" : ""}`
        : `${sideLabel} · 얼굴 ${faceNo}${cmd.flipHorizontally ? " · 좌우 반전" : ""}`,
      dataset: { testid: "ecp-face-caption" },
    })
  );
  return stage;
}

function patternStage(cmd: Extract<Command, { kind: "setEventGraphicPattern" }>): HTMLElement {
  const stage = el("div", {
    class: "ecp-stage ecp-pattern-stage",
    dataset: { testid: "ecp-pattern-stage" },
  });
  const graphic = graphicForPatternPreview(cmd.eventId, cmd.pattern);
  const sprite = renderEventGraphicPreview(graphic);
  sprite.classList.add("ecp-pattern-sprite");
  sprite.dataset.testid = "ecp-pattern-sprite";
  const decoded = decodeCharsetFrameIndex(cmd.pattern);
  const targetLabel = cmd.eventId?.trim() || "이 이벤트";
  const patternName = ["왼쪽", "가운데", "오른쪽"][decoded.pattern] ?? String(decoded.pattern);
  stage.append(
    el("div", {
      class: "ecp-pattern-stage-inner",
      children: [
        sprite,
        el("div", {
          class: "ecp-pattern-caption",
          dataset: { testid: "ecp-pattern-caption" },
          children: [
            el("div", { class: "ecp-pattern-caption-title", text: targetLabel }),
            el("div", {
              class: "ecp-pattern-caption-meta",
              text: `방향 ${patternDirectionLabel(decoded.direction)} · 패턴 ${patternName}`,
            }),
          ],
        }),
      ],
    })
  );
  return stage;
}

function patternDirectionLabel(direction: "up" | "right" | "down" | "left"): string {
  switch (direction) {
    case "up":
      return "위";
    case "right":
      return "오른쪽";
    case "down":
      return "아래";
    case "left":
      return "왼쪽";
  }
}

function settingsMessageMock(cmd: Extract<Command, { kind: "displayTextSettings" }>): HTMLElement {
  const transparent = cmd.format === "transparent";
  const stage = el("div", {
    class: `ecp-stage pos-${cmd.position}`,
    dataset: { testid: "ecp-settings-stage" },
  });
  // 플레이어 위치를 무대 중앙에 두고, 가림 방지 시 창이 플레이어를 피한 느낌을 준다.
  stage.append(el("div", { class: "ecp-player-pawn", attrs: { title: "플레이어" }, text: "★" }));
  const win = el("div", {
    class: `ecp-message-window${transparent ? " transparent" : ""} has-speaker`,
    dataset: { testid: "ecp-message-window" },
  });
  win.append(
    el("div", {
      class: "ecp-message-body",
      text: transparent
        ? "투명 창으로 표시됩니다.\n배경 없이 글자만 보입니다."
        : "일반 창으로 표시됩니다.\n이후 문장 표시에 적용됩니다.",
    }),
    el("div", {
      class: "ecp-message-speaker ecp-message-speaker-nameplate",
      text: "미리보기",
      dataset: { testid: "ecp-message-speaker" },
    })
  );
  stage.append(win);

  const badges = el("div", { class: "ecp-settings-badges", dataset: { testid: "ecp-settings-badges" } });
  badges.append(el("span", { class: "ecp-move-badge", text: transparent ? "투명" : "일반" }));
  badges.append(el("span", { class: "ecp-move-badge", text: positionLabel(cmd.position) }));
  badges.append(
    el("span", {
      class: `ecp-move-badge${cmd.preventObscuringPlayer ? "" : " off"}`,
      text: cmd.preventObscuringPlayer ? "가림 방지 ON" : "가림 방지 OFF",
    })
  );
  badges.append(
    el("span", {
      class: `ecp-move-badge${cmd.allowEventMovementDuringWait ? "" : " off"}`,
      text: cmd.allowEventMovementDuringWait ? "이벤트 이동 허용" : "이벤트 이동 정지",
    })
  );

  const wrap = el("div", { class: "ecp-settings-preview" });
  wrap.append(stage, badges);
  return wrap;
}

function choicesMock(cmd: Extract<Command, { kind: "choices" }>): HTMLElement {
  const stage = el("div", { class: "ecp-stage" });
  const win = el("div", { class: "ecp-message-window ecp-choice-window" });
  const prompt = cmd.prompt?.trim();
  if (prompt) win.append(el("div", { class: "ecp-message-body", text: prompt }));
  const list = el("div", { class: "ecp-choice-list" });
  const options = cmd.options.filter((option) => option.text.trim().length > 0);
  options.forEach((option, index) =>
    list.append(el("div", { class: "ecp-choice", text: `▶ ${option.text.trim() || `선택지 ${index + 1}`}` }))
  );
  if (options.length === 0) list.append(el("div", { class: "ecp-choice empty", text: "선택지 없음" }));
  win.append(list);
  if (cmd.cancelBehavior && cmd.cancelBehavior !== "disallow") {
    stage.append(
      win,
      el("div", {
        class: "ecp-face-caption",
        text: `취소 → ${choiceCancelCaption(cmd.cancelBehavior)}`,
      })
    );
    return stage;
  }
  stage.append(win);
  return stage;
}

function choiceCancelCaption(behavior: NonNullable<Extract<Command, { kind: "choices" }>["cancelBehavior"]>): string {
  if (behavior === "branch") return "취소 분기";
  return `선택지 ${behavior.slice("choice".length)}`;
}

/** 숫자 입력 — System.png fill 금지. 플레이 시작 시 빈 슬롯 + 커서 상태를 보여 준다. */
function inputNumberStage(cmd: Extract<Command, { kind: "inputNumber" }>): HTMLElement {
  const digits = Math.max(1, Math.min(6, Math.trunc(cmd.digits) || 1));
  const title = cmd.prompt?.trim() || "숫자 입력";
  const stage = el("div", { class: "ecp-stage ecp-number-stage" });
  const win = el("div", {
    class: "ecp-number-window ecp-number-window-clean",
    dataset: { testid: "ecp-number-window" },
  });
  win.append(el("div", { class: "ecp-number-title", text: title }));

  const slots = el("div", {
    class: "ecp-number-slots",
    dataset: { testid: "ecp-number-slots" },
  });
  // Honest idle preview: empty slots with cursor on the first digit.
  for (let i = 0; i < digits; i += 1) {
    slots.append(
      el("div", {
        class: `ecp-number-slot empty${i === 0 ? " cursor" : ""}`,
        text: "",
        attrs: { "aria-hidden": "true" },
      })
    );
  }
  win.append(slots);

  if (cmd.showPad) {
    const pad = el("div", { class: "ecp-number-pad", dataset: { testid: "ecp-number-pad" } });
    for (const key of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "OK"] as const) {
      pad.append(
        el("div", {
          class: `ecp-number-pad-key${key === "OK" ? " ok" : ""}${key === "←" ? " back" : ""}`,
          text: key,
        })
      );
    }
    win.append(pad);
  } else {
    win.append(
      el("div", {
        class: "ecp-number-ok-mock",
        text: "OK",
        dataset: { testid: "ecp-number-ok-mock" },
      })
    );
  }

  win.append(
    el("div", {
      class: "ecp-number-meta",
      dataset: { testid: "ecp-number-meta" },
      text: `${digits}자리 · 변수 ${variablePreviewName(cmd.variableId)} · 대기 중`,
    })
  );
  stage.append(win);
  return stage;
}

function variablePreviewName(variableId: string): string {
  if (!variableId) return "(미선택)";
  const project = store.getCurrent();
  const index = project.variables.findIndex((entry) => entry.id === variableId);
  if (index < 0) return variableId;
  const name = project.variables[index]?.name?.trim();
  return name ? `${String(index + 1).padStart(4, "0")}: ${name}` : String(index + 1).padStart(4, "0");
}

function transferStage(cmd: Extract<Command, { kind: "transfer" }>): HTMLElement {
  const stage = el("div", { class: "ecp-stage ecp-map-stage" });
  const project = store.getCurrent();
  const map = project.maps[cmd.mapId];
  if (!map) {
    stage.append(missingCard("맵을 찾을 수 없습니다"));
    return stage;
  }
  const canvas = document.createElement("canvas");
  canvas.className = "ecp-map-canvas";
  canvas.dataset.testid = "ecp-transfer-canvas";
  stage.append(canvas);
  const selection = { x: cmd.x, y: cmd.y, zoom: fitZoom(map.width * map.tileSize) };
  // Canvas 2D 를 지원하는 환경(실제 브라우저)에서만 그린다. 노드/fakeDom 은 캡션만 표시.
  // 비동기 그리기: 이 canvas 가 아직 DOM 에 붙어 있을 때만 반영(stale draw 방지).
  if (typeof canvas.getContext === "function") {
    drawTransferMapPreview({ canvas, project, mapId: cmd.mapId, selection, isCurrent: () => canvas.isConnected }).catch(() => {
      try {
        drawTransferFallback({ canvas, map, selection });
      } catch {
        /* 캔버스 미지원 환경 — 무시 */
      }
    });
  }
  stage.append(el("div", { class: "ecp-map-caption", text: `${map.name || cmd.mapId} (${cmd.x}, ${cmd.y})` }));
  return stage;
}

function itemStage(cmd: Extract<Command, { kind: "changeItem" }>, context?: CommandPreviewContext): HTMLElement {
  const project = store.getCurrent();
  const record = project.database.items.find((item) => item.id === cmd.itemId);
  const stage = el("div", { class: "ecp-icon-stage" });
  stage.append(el("div", { class: "ecp-hero-icon", children: [heroIcon(record?.iconResourceId ?? record?.imageResourceId, record?.name ?? cmd.itemId, 48)] }));
  stage.append(el("div", { class: "ecp-icon-name", text: record?.name ?? (cmd.itemId || "(아이템 선택)") }));
  const amountText = typeof cmd.amount === "number"
    ? String(cmd.amount) + "개"
    : ("변수 " + (cmd.amount.id || "?"));
  stage.append(el("div", { class: "ecp-op-strip", text: cmd.op + " " + amountText }));
  if (context?.simState) {
    const curCount = getSimItem(context.simState, cmd.itemId);
    stage.append(el("div", { class: "ecp-current-state", text: `현재 보유: ${curCount}개` }));
  }
  return stage;
}


function innStage(cmd: Extract<Command, { kind: "inn" }>): HTMLElement {
  const price = Math.max(0, Math.trunc(cmd.price) || 0);
  const recoverMp = cmd.recoverMp !== false;
  const stage = el("div", { class: "ecp-stage ecp-inn-stage", dataset: { testid: "ecp-inn-stage" } });
  const win = el("div", { class: "ecp-inn-window", dataset: { testid: "ecp-inn-window" } });
  const note = cmd.note?.trim() || "어서 오세요. 편히 쉬어가시겠어요?";
  const question =
    cmd.question?.trim() ||
    (price <= 0
      ? "하룻밤 묵으시겠습니까? (무료)"
      : `하룻밤 묵는 데 ${price.toLocaleString("ko-KR")} G 입니다. 묵으시겠습니까?`);
  const recoverLabel = recoverMp ? "전원 회복" : "HP만 회복";
  const chips: string[] = [
    price <= 0 ? `무료 숙박 · ${recoverLabel}` : `${price.toLocaleString("ko-KR")} G · ${recoverLabel}`,
  ];
  if (cmd.advanceToMorning) chips.push("아침 이동");
  if (cmd.branchOnNotEnoughGold) chips.push("부족 분기");
  win.append(
    el("div", { class: "ecp-inn-title", text: "여관" }),
    el("div", { class: "ecp-inn-note", text: note }),
    el("div", { class: "ecp-inn-question", text: question }),
    el("div", {
      class: "ecp-inn-actions",
      children: [
        el("span", { class: "ecp-inn-choice selected", text: "예" }),
        el("span", { class: "ecp-inn-choice", text: "아니오" }),
      ],
    }),
    el("div", {
      class: "ecp-inn-price-chip",
      text: chips.join(" · "),
    })
  );
  stage.append(win);
  return stage;
}

function shopStage(cmd: Extract<Command, { kind: "shop" }>): HTMLElement {
  const project = store.getCurrent();
  // System.png border-image fill 을 쓰면 하단 팔레트 스트립(0123456789)이
  // 미리보기 전체를 덮어 "배경이 깨진" 것처럼 보인다. 상점 프리뷰는 솔리드 창으로 둔다.
  const win = el("div", { class: "ecp-shop-window ecp-shop-window-clean", dataset: { testid: "ecp-shop-window" } });
  const shopType =
    cmd.shopType === "buyOnly" ? "구매 전용" : cmd.shopType === "sellOnly" ? "판매 전용" : "구매/판매";
  const message =
    cmd.messageType === "business"
      ? "무엇이 필요하신가요?"
      : cmd.messageType === "direct"
        ? "아이템을 선택하세요"
        : "어서 오세요";
  const merchantGold = typeof cmd.merchantGold === "number" && Number.isFinite(cmd.merchantGold)
    ? Math.max(0, Math.floor(cmd.merchantGold))
    : 100;
  win.append(
    el("div", {
      class: "ecp-shop-title",
      text: `상점 · ${cmd.itemIds.length}개 · ${shopType}`,
    }),
    el("div", { class: "ecp-shop-message", text: message }),
    el("div", {
      class: "ecp-shop-merchant-gold",
      dataset: { testid: "ecp-shop-merchant-gold" },
      text: `상인 소지금 ${merchantGold.toLocaleString("ko-KR")} G`,
    })
  );
  if (cmd.itemIds.length === 0) {
    win.append(
      el("div", {
        class: "ecp-shop-empty-warn",
        dataset: { testid: "ecp-shop-empty-warn" },
        text: "상품 없음 — 판매 목록을 추가하세요",
      })
    );
  }
  const list = el("div", { class: "ecp-shop-item-list" });
  for (const id of cmd.itemIds.slice(0, 8)) {
    const record = project.database.items.find((item) => item.id === id);
    const name = record?.name ?? id;
    const price = record ? `${record.price.toLocaleString("ko-KR")} G` : "—";
    list.append(
      el("div", {
        class: "ecp-shop-item-row",
        attrs: { title: record?.description?.trim() || name },
        children: [
          el("div", {
            class: "ecp-shop-item-icon",
            children: [heroIcon(record?.iconResourceId ?? record?.imageResourceId, name, 22)],
          }),
          el("span", { class: "ecp-shop-item-name", text: name }),
          el("span", { class: "ecp-shop-item-price", text: price }),
        ],
      })
    );
  }
  if (cmd.itemIds.length === 0) {
    list.append(el("div", { class: "ecp-shop-item-empty", text: "상품 없음" }));
  } else if (cmd.itemIds.length > 8) {
    list.append(el("div", { class: "ecp-shop-item-more", text: `외 ${cmd.itemIds.length - 8}개…` }));
  }
  win.append(list);
  if (cmd.branchOnTransaction) {
    win.append(el("div", { class: "ecp-shop-branch-note", text: "거래 후 분기 있음" }));
  }
  const stage = el("div", { class: "ecp-stage ecp-shop-stage" });
  stage.append(win);
  return stage;
}

function actorStage(actorId: string, caption: string, context?: CommandPreviewContext): HTMLElement {
  const project = store.getCurrent();
  const record = project.database.actors.find((actor) => actor.id === actorId);
  const stage = el("div", { class: "ecp-icon-stage" });
  stage.append(el("div", { class: "ecp-hero-icon", children: [recordIconElement(facesetIconOf(project, record?.faceResourceId, record?.faceIndex ?? 0), record?.name ?? actorId)] }));
  stage.append(el("div", { class: "ecp-icon-name", text: record?.name ?? (actorId || "(주인공 선택)") }));
  stage.append(el("div", { class: "ecp-op-strip", text: caption }));
  if (context?.simState) {
    const inParty = context.simState.partyActorIds.includes(actorId);
    stage.append(el("div", { class: "ecp-current-state", text: inParty ? "현재 파티에 있음" : "현재 파티에 없음" }));
  }
  return stage;
}

function goldStage(cmd: Extract<Command, { kind: "changeGold" }>, context?: CommandPreviewContext): HTMLElement {
  const stage = el("div", { class: "ecp-icon-stage" });
  stage.append(el("div", { class: "ecp-gold-badge", text: "G" }));
  const amountText = typeof cmd.amount === "number"
    ? String(cmd.amount)
    : ("변수 " + (cmd.amount.id || "?"));
  stage.append(el("div", { class: "ecp-op-strip", text: "소지금 " + cmd.op + " " + amountText }));
  if (context?.simState) {
    stage.append(el("div", { class: "ecp-current-state", text: `현재 소지금: ${context.simState.gold} G` }));
  }
  return stage;
}

function expStage(cmd: Extract<Command, { kind: "changeExp" }>, context?: CommandPreviewContext): HTMLElement {
  const project = store.getCurrent();
  const stage = el("div", { class: "ecp-icon-stage" });
  const targetLabel = !cmd.actorId || cmd.actorId === "party" || cmd.actorId === "all"
    ? "파티 전체"
    : (project.database.actors.find((actor) => actor.id === cmd.actorId)?.name ?? cmd.actorId);
  const amountText = typeof cmd.amount === "number"
    ? String(cmd.amount)
    : ("변수 " + (cmd.amount.id || "?"));
  stage.append(el("div", { class: "ecp-exp-badge", text: "EXP" }));
  stage.append(el("div", { class: "ecp-icon-name", text: targetLabel }));
  stage.append(el("div", { class: "ecp-op-strip", text: "경험치 " + cmd.op + " " + amountText }));
  if (context?.simState && cmd.actorId && cmd.actorId !== "party" && cmd.actorId !== "all") {
    const curExp = context.simState.variables[cmd.actorId + "_exp"] ?? 0;
    stage.append(el("div", { class: "ecp-current-state", text: `현재 경험치: ${curExp}` }));
  }
  return stage;
}

function skillStage(cmd: Extract<Command, { kind: "learnSkill" }>): HTMLElement {
  const project = store.getCurrent();
  const stage = el("div", { class: "ecp-icon-stage" });
  const targetLabel = !cmd.actorId || cmd.actorId === "party" || cmd.actorId === "all"
    ? "파티 전체"
    : (project.database.actors.find((actor) => actor.id === cmd.actorId)?.name ?? (cmd.actorId || "(주인공 선택)"));
  const skillName = project.database.skills.find((skill) => skill.id === cmd.skillId)?.name ?? (cmd.skillId || "(특수기 선택)");
  const verb = cmd.action === "forget" ? "망각" : "습득";
  stage.append(el("div", { class: "ecp-skill-badge", text: "SK" }));
  stage.append(el("div", { class: "ecp-icon-name", text: targetLabel }));
  stage.append(el("div", { class: "ecp-op-strip", text: `${verb} ${skillName}` }));
  return stage;
}

function battleStage(cmd: Extract<Command, { kind: "battleProcessing" }>): HTMLElement {
  const project = store.getCurrent();
  const troop = cmd.troopSource === "variable"
    ? undefined
    : project.database.troops.find((entry) => entry.id === cmd.troopId);
  const stage = el("div", {
    class: "ecp-icon-stage ecp-battle-stage",
    dataset: { testid: "ecp-battle-stage" },
  });

  // 전투 배경 + 적 스프라이트 미니 전장 — 검 아이콘만 보이던 빈 프리뷰 대체.
  const field = el("div", { class: "ecp-battle-field", dataset: { testid: "ecp-battle-field" } });
  // System2 is gauge chrome — never a battle field. Match resolveBattleBackdrop fallback.
  const backdropId = troop?.previewBackgroundResourceId ?? DEFAULT_BATTLE_FIELD_BACKGROUND_ID;
  const backdropUrl = resolveAssetResourceUrl(backdropId, { project });
  if (backdropUrl) {
    field.style.backgroundImage = `linear-gradient(180deg, rgba(8,12,24,0.15), rgba(8,12,24,0.45)), url("${backdropUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
    field.style.backgroundSize = "cover";
    field.style.backgroundPosition = "center";
  }

  const enemyIds =
    troop?.members && troop.members.length > 0
      ? troop.members.map((member) => member.enemyId)
      : (troop?.enemyIds ?? []);
  const row = el("div", { class: "ecp-battle-enemies" });
  const shown = enemyIds.slice(0, 4);
  if (cmd.troopSource === "variable") {
    row.append(el("div", {
      class: "ecp-battle-enemy-fallback",
      text: "VAR",
      attrs: { title: `변수 ${cmd.troopVariableId || "?"}` },
    }));
  } else if (shown.length === 0) {
    row.append(el("div", { class: "ecp-battle-badge", text: "⚔" }));
  } else {
    for (const enemyId of shown) {
      const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
      const url = resolveAssetResourceUrl(enemy?.monsterResourceId, { project });
      if (url) {
        row.append(
          el("img", {
            class: "ecp-battle-enemy",
            attrs: {
              src: url,
              alt: enemy?.name ?? enemyId,
              title: enemy?.name ?? enemyId,
              draggable: "false",
            },
          }),
        );
      } else {
        row.append(el("div", { class: "ecp-battle-enemy-fallback", text: (enemy?.name ?? "?").slice(0, 2) }));
      }
    }
    if (enemyIds.length > 4) {
      row.append(el("div", { class: "ecp-battle-enemy-fallback", text: `+${enemyIds.length - 4}` }));
    }
  }
  field.append(row);
  stage.append(field);

  const title = cmd.troopSource === "variable"
    ? `변수 ${cmd.troopVariableId || "?"}`
    : (troop?.name ?? (cmd.troopId || "(적 그룹 선택)"));
  stage.append(el("div", { class: "ecp-icon-name", text: title }));

  const rewards = battleRewardSummary(project, enemyIds);
  if (rewards) {
    stage.append(el("div", {
      class: "ecp-battle-rewards",
      dataset: { testid: "ecp-battle-rewards" },
      text: rewards,
    }));
  }

  const badges = el("div", { class: "ecp-move-badges" });
  badges.append(el("span", { class: "ecp-move-badge", text: cmd.canEscape ? "도망 가능" : "도망 불가" }));
  badges.append(el("span", { class: "ecp-move-badge", text: cmd.canLose ? "패배 허용" : "패배=게임오버" }));
  if (cmd.battleFlow) {
    badges.append(el("span", {
      class: "ecp-move-badge",
      text: cmd.battleFlow === "strict" ? "엄격 턴제" : "게이지",
    }));
  }
  if (cmd.branchOnResult) {
    badges.append(el("span", { class: "ecp-move-badge", text: "결과 분기" }));
  }
  if (shown.length > 0 && cmd.troopSource !== "variable") {
    const names = shown
      .map((id) => project.database.enemies.find((e) => e.id === id)?.name ?? id)
      .slice(0, 3)
      .join(" · ");
    badges.append(el("span", { class: "ecp-move-badge", text: names }));
  }
  stage.append(badges);

  if (!cmd.troopId && cmd.troopSource !== "variable") {
    stage.append(el("div", {
      class: "ecp-battle-empty-warn",
      dataset: { testid: "ecp-battle-empty-warn" },
      text: "적 그룹 필요",
    }));
  } else {
    stage.append(el("div", {
      class: "ecp-battle-result-note",
      text: "확인 시 전투 시작 → battleResult 저장",
    }));
  }
  return stage;
}

function battleRewardSummary(
  project: ReturnType<typeof store.getCurrent>,
  enemyIds: readonly string[]
): string {
  let exp = 0;
  let gold = 0;
  const drops: string[] = [];
  for (const enemyId of enemyIds) {
    const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
    if (!enemy) continue;
    exp += enemy.rewards.exp ?? 0;
    gold += enemy.rewards.gold ?? 0;
    if (enemy.rewards.dropItemId) {
      const item = project.database.items.find((entry) => entry.id === enemy.rewards.dropItemId);
      const label = item?.name ?? enemy.rewards.dropItemId;
      if (!drops.includes(label)) drops.push(label);
    }
  }
  const parts: string[] = [];
  if (exp > 0) parts.push(`EXP ${exp}`);
  if (gold > 0) parts.push(`Gold ${gold}`);
  if (drops.length > 0) parts.push(`드롭 ${drops.slice(0, 2).join(" · ")}`);
  return parts.join(" · ");
}

function lampStage(name: string, value: boolean, currentValue?: boolean): HTMLElement {
  const stage = el("div", { class: "ecp-icon-stage" });
  stage.append(el("div", { class: `ecp-lamp ${value ? "on" : "off"}`, text: value ? "ON" : "OFF" }));
  stage.append(el("div", { class: "ecp-icon-name", text: name }));
  if (currentValue !== undefined) {
    stage.append(el("div", { class: "ecp-current-state", text: `현재: ${currentValue ? "ON" : "OFF"}` }));
  }
  return stage;
}

function variableStage(cmd: Extract<Command, { kind: "setVariable" }>, context?: CommandPreviewContext): HTMLElement {
  const stage = el("div", { class: "ecp-stage ecp-variable-stage" });
  const card = el("div", {
    class: "ecp-variable-card",
    dataset: { testid: "ecp-variable-card" },
  });
  card.append(el("div", { class: "ecp-variable-title", text: "변수 조작" }));
  card.append(
    el("div", {
      class: "ecp-variable-formula",
      dataset: { testid: "ecp-variable-formula" },
      text: formatVariableFormula(cmd),
    })
  );
  const sourceLabel = typeof cmd.value === "number" ? "숫자" : "변수";
  const metaParts = [`값 소스: ${sourceLabel} · 정수 연산`];
  if (context?.simState) {
    const curVal = getSimVariable(context.simState, cmd.variableId);
    metaParts.unshift(`현재 값: ${curVal}`);
  }
  card.append(
    el("div", {
      class: "ecp-variable-meta",
      dataset: { testid: "ecp-variable-meta" },
      text: metaParts.join(" · "),
    })
  );
  stage.append(card);
  return stage;
}

function resolveSwitchDisplay(cmd: Extract<Command, { kind: "setSwitch" }>, context?: CommandPreviewContext): boolean {
  if (cmd.value === "toggle") {
    if (context?.simState) return !getSimSwitch(context.simState, cmd.switchId);
    return false;
  }
  if (typeof cmd.value === "object" && cmd.value !== null && cmd.value.kind === "var") {
    if (context?.simState) return getSimVariable(context.simState, cmd.value.id) !== 0;
    return false;
  }
  return cmd.value as boolean;
}

function screenMock(text: string, variant: "gameover" | "title" | "ending"): HTMLElement {
  const stage = el("div", { class: "ecp-stage" });
  stage.append(el("div", { class: `ecp-result-screen ${variant}`, text }));
  return stage;
}

function summaryCard(cmd: Command, context?: CommandPreviewContext): HTMLElement {
  const card = el("div", { class: "ecp-summary-card ecp-runtime-effect-card", dataset: { testid: "ecp-runtime-effect" } });
  card.append(el("div", { class: "ecp-runtime-effect-title", text: "런타임 효과" }));
  const line = el("div", { class: "ecp-summary-line" });
  for (const part of commandSummaryParts(cmd)) {
    if (isSummaryIconPart(part)) {
      const url = resolveIconUrl(part.resourceId);
      if (url) line.append(el("img", { class: "ecp-summary-icon", attrs: { src: url, alt: "", width: "16", height: "16" } }));
      continue;
    }
    line.append(el("span", { class: `ecp-token ${part.tone}`, text: part.text }));
  }
  card.append(line);
  if (context?.simState) {
    const effectDesc = describeRuntimeEffect(cmd, context.simState, context.hostEventId);
    if (effectDesc) {
      card.append(el("div", { class: "ecp-runtime-effect-detail", text: effectDesc }));
    }
  }
  if (context?.skipped) {
    card.classList.add("ecp-skipped");
    card.append(el("div", { class: "ecp-skipped-badge", text: "실행되지 않는 분기" }));
  }
  return card;
}

function heroIcon(resourceId: string | undefined, name: string, size: number): HTMLElement {
  const url = resolveIconUrl(resourceId);
  if (url) return el("img", { class: "ecp-hero-img", attrs: { src: url, alt: "", width: String(size), height: String(size), draggable: "false" } });
  return initialBadge(name);
}

function resolveIconUrl(resourceId: string | undefined): string | null {
  return resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
}

function missingCard(text: string): HTMLElement {
  return el("div", { class: "ecp-missing-card", text });
}

function positionLabel(position: "top" | "center" | "bottom"): string {
  switch (position) {
    case "top":
      return "상단";
    case "center":
      return "중앙";
    case "bottom":
      return "하단";
  }
}

function fitZoom(pxWidth: number): number {
  if (pxWidth <= 0) return 1;
  return Math.max(0.15, Math.min(2, 260 / pxWidth));
}

function waitStage(cmd: Extract<Command, { kind: "wait" }>): HTMLElement {
  const stage = el("div", { class: "ecp-stage ecp-wait-stage", dataset: { testid: "ecp-wait-stage" } });
  if (cmd.variableId?.trim()) {
    stage.append(
      el("div", {
        class: "ecp-wait-card",
        text: `변수 ${variablePreviewName(cmd.variableId)} 값(ms)`,
      })
    );
    return stage;
  }
  const seconds = (Math.max(0, cmd.ms) / 1000).toFixed(cmd.ms % 1000 === 0 ? 0 : 1);
  stage.append(el("div", { class: "ecp-wait-card", text: `${seconds}초` }));
  stage.append(el("div", { class: "ecp-wait-sub", text: `${Math.max(0, cmd.ms)} ms` }));
  return stage;
}

function switchName(id: string): string {
  const project = store.getCurrent();
  const index = project.switches.findIndex((entry) => entry.id === id);
  if (index >= 0) return project.switches[index]?.name || `스위치 ${index + 1}`;
  return id || "스위치";
}

function lightingStage(cmd: Extract<Command, { kind: "setLighting" }>): HTMLElement {
  const ambient = Math.max(0, Math.min(1, Number(cmd.ambient) || 0));
  const pct = Math.round(ambient * 100);
  const stage = el("div", {
    class: "ecp-stage ecp-lighting-stage",
    dataset: { testid: "ecp-lighting-stage" },
  });
  const screen = el("div", { class: "ecp-fx-screen ecp-lighting-screen" });
  const overlay = el("div", { class: "ecp-lighting-overlay" });
  // ambient 0 = fully dark overlay, ambient 1 = no darkening
  overlay.style.opacity = String(1 - ambient);
  if (cmd.color) overlay.style.background = cmd.color;
  screen.append(overlay);
  screen.append(el("div", { class: "ecp-fx-label", text: `AMB ${pct}%` }));
  stage.append(screen);
  const meta: string[] = [`주변광 ${pct}%`];
  if (cmd.transitionMs) meta.push(`${cmd.transitionMs}ms`);
  stage.append(el("div", { class: "ecp-fx-caption", text: meta.join(" · ") }));
  return stage;
}

function lightSourceStage(cmd: Extract<Command, { kind: "addLight" }>): HTMLElement {
  const stage = el("div", {
    class: "ecp-stage ecp-light-source-stage",
    dataset: { testid: "ecp-light-source-stage" },
  });
  const screen = el("div", { class: "ecp-fx-screen ecp-light-source-screen" });
  const glow = el("div", { class: "ecp-light-glow" });
  const radius = Math.max(1, Number(cmd.source.radius) || 4);
  const intensity = Math.max(0.2, Math.min(1, Number(cmd.source.intensity ?? 1)));
  glow.style.width = `${Math.min(80, 18 + radius * 8)}%`;
  glow.style.height = glow.style.width;
  glow.style.opacity = String(0.35 + intensity * 0.55);
  if (cmd.source.color) {
    glow.style.background = `radial-gradient(circle, ${cmd.source.color} 0%, transparent 70%)`;
  }
  screen.append(glow);
  screen.append(el("div", { class: "ecp-fx-label", text: cmd.source.id || "LIGHT" }));
  stage.append(screen);
  stage.append(
    el("div", {
      class: "ecp-fx-caption",
      text: `${lightAnchorPreview(cmd.source.at)} · r${radius}`,
    })
  );
  return stage;
}

function removeLightStage(cmd: Extract<Command, { kind: "removeLight" }>): HTMLElement {
  const stage = el("div", {
    class: "ecp-stage ecp-light-source-stage ecp-light-source-off",
    dataset: { testid: "ecp-remove-light-stage" },
  });
  const screen = el("div", { class: "ecp-fx-screen ecp-light-source-screen" });
  screen.append(el("div", { class: "ecp-light-glow off" }));
  screen.append(
    el("div", {
      class: "ecp-fx-label",
      text: cmd.all === true ? "LIGHTS OFF" : "LIGHT OFF",
    })
  );
  stage.append(screen);
  stage.append(
    el("div", {
      class: "ecp-fx-caption",
      text: cmd.all === true ? "모든 광원 제거" : cmd.id || "id 없음",
    })
  );
  return stage;
}

function weatherStage(cmd: Extract<Command, { kind: "setWeather" }>): HTMLElement {
  const kind = cmd.weather || "none";
  const intensity = Math.max(0, Math.min(1, Number(cmd.intensity ?? 0.5)));
  const stage = el("div", {
    class: `ecp-stage ecp-weather-stage ecp-weather-${kind}`,
    dataset: { testid: "ecp-weather-stage", weather: kind },
  });
  const screen = el("div", { class: "ecp-fx-screen ecp-weather-screen" });
  const particles = el("div", {
    class: `ecp-weather-particles ecp-weather-particles-${kind}`,
    attrs: { "aria-hidden": "true" },
  });
  const count = kind === "none" ? 0 : Math.max(4, Math.round(6 + intensity * 14));
  for (let i = 0; i < count; i += 1) {
    const drop = el("span", { class: "ecp-weather-drop" });
    drop.style.left = `${(i * 37 + 11) % 100}%`;
    drop.style.top = `${(i * 53 + 7) % 100}%`;
    drop.style.animationDelay = `${(i % 8) * 0.12}s`;
    particles.append(drop);
  }
  screen.append(particles);
  screen.append(el("div", { class: "ecp-fx-label", text: weatherPreviewLabel(kind) }));
  stage.append(screen);
  const meta: string[] = [weatherPreviewLabel(kind), `강도 ${Math.round(intensity * 100)}%`];
  if (cmd.transitionMs) meta.push(`${cmd.transitionMs}ms`);
  stage.append(el("div", { class: "ecp-fx-caption", text: meta.join(" · ") }));
  return stage;
}

function animationStage(cmd: Extract<Command, { kind: "showAnimation" }>): HTMLElement {
  const stage = el("div", {
    class: "ecp-stage ecp-animation-stage",
    dataset: { testid: "ecp-animation-stage" },
  });
  const screen = el("div", { class: "ecp-fx-screen ecp-animation-screen" });
  screen.append(el("div", { class: "ecp-anim-ring", attrs: { "aria-hidden": "true" } }));
  screen.append(el("div", { class: "ecp-anim-ring ecp-anim-ring-inner", attrs: { "aria-hidden": "true" } }));
  screen.append(el("div", { class: "ecp-fx-label", text: cmd.animationId || "ANIM" }));
  stage.append(screen);
  const meta = [animationTargetPreview(cmd.target)];
  if (cmd.wait) meta.push("대기");
  stage.append(el("div", { class: "ecp-fx-caption", text: meta.join(" · ") }));
  return stage;
}

function erasePictureStage(cmd: Extract<Command, { kind: "erasePicture" }>): HTMLElement {
  const root = el("div", {
    class: "ecp-picture ecp-picture-erase",
    dataset: { testid: "ecp-erase-picture-preview" },
  });
  const screen = el("div", { class: "ecp-picture-screen" });
  const marker = el("div", { class: "ecp-picture-marker missing ecp-picture-erase-marker" });
  marker.append(el("span", { class: "ecp-picture-missing-label", text: `✕ #${cmd.pictureId}` }));
  screen.append(marker);
  root.append(screen);
  root.append(el("div", { class: "ecp-picture-caption", text: `그림 ${cmd.pictureId} 삭제` }));
  return root;
}

function changeTileStage(cmd: Extract<Command, { kind: "changeTile" }>): HTMLElement {
  const stage = el("div", {
    class: "ecp-stage ecp-tile-stage",
    dataset: { testid: "ecp-tile-stage" },
  });
  const card = el("div", { class: "ecp-tile-card" });
  card.append(el("div", { class: "ecp-tile-swatch", text: String(cmd.tile) }));
  card.append(
    el("div", {
      class: "ecp-tile-meta",
      text: `${cmd.layer === "upper" ? "상위" : "하위"} · (${cmd.x}, ${cmd.y})`,
    })
  );
  stage.append(card);
  stage.append(el("div", { class: "ecp-fx-caption", text: cmd.mapId || "(맵)" }));
  return stage;
}

function inputWaitStage(cmd: Extract<Command, { kind: "inputWait" }>): HTMLElement {
  const stage = el("div", {
    class: "ecp-stage ecp-input-wait-stage",
    dataset: { testid: "ecp-input-wait-stage" },
  });
  stage.append(el("div", { class: "ecp-input-wait-key", text: "⌨" }));
  stage.append(el("div", { class: "ecp-fx-label", text: "키 입력 대기" }));
  stage.append(
    el("div", {
      class: "ecp-fx-caption",
      text: cmd.variableId?.trim()
        ? `변수 ${variablePreviewName(cmd.variableId)}`
        : "키 코드 저장 안 함",
    })
  );
  return stage;
}

function lightAnchorPreview(anchor: Extract<Command, { kind: "addLight" }>["source"]["at"]): string {
  if (anchor === "player") return "플레이어";
  if ("eventId" in anchor) return `이벤트 ${anchor.eventId || "현재"}`;
  return `(${anchor.x}, ${anchor.y})`;
}

function animationTargetPreview(target: Extract<Command, { kind: "showAnimation" }>["target"]): string {
  if (target === "player") return "플레이어";
  if ("eventId" in target) return `이벤트 ${target.eventId || "현재"}`;
  return `(${target.x}, ${target.y})`;
}

function weatherPreviewLabel(kind: Extract<Command, { kind: "setWeather" }>["weather"]): string {
  switch (kind) {
    case "none":
      return "맑음";
    case "rain":
      return "비";
    case "storm":
      return "폭풍";
    case "snow":
      return "눈";
    case "fog":
      return "안개";
    default:
      return String(kind);
  }
}

function describeRuntimeEffect(cmd: Command, simState: PreviewSimState, _hostEventId?: string): string | null {
  switch (cmd.kind) {
    case "changeLevel": {
      const curLevel = simState.variables[cmd.actorId + "_level"] ?? 0;
      return `레벨 ${cmd.op} ${cmd.amount} (현재: ${curLevel})`;
    }
    case "changeActorHp":
      return `HP ${cmd.op} ${cmd.amount}`;
    case "changeActorMp":
      return `MP ${cmd.op} ${cmd.amount}`;
    case "recoverAll":
      return cmd.actorId ? `${cmd.actorId} 전원 회복` : "전원 회복";
    case "changeEquipment":
      return `${cmd.actorId} 장비 변경: ${cmd.slot} = ${cmd.equipmentId}`;
    case "enterHeroName":
      return `${cmd.actorId} 이름 입력`;
    case "transfer":
      return `맵 이동 → (${cmd.x}, ${cmd.y})`;
    case "callCommonEvent":
      return `공통 이벤트 ${cmd.commonEventId} 호출`;
    case "callMapEvent":
      return `맵 이벤트 ${cmd.eventId} 호출`;
    case "setLighting":
      return `주변광 ${Math.round(cmd.ambient * 100)}%`;
    case "setWeather":
      return `날씨: ${weatherPreviewLabel(cmd.weather)}`;
    case "timer":
      return cmd.action === "set" ? `타이머 ${cmd.seconds}초 설정` : `타이머 ${cmd.action}`;
    case "changeFriendship":
      return `호감도 ${cmd.delta >= 0 ? "+" : ""}${cmd.delta}`;
    case "checkpointSave":
      return cmd.label ? `체크포인트 저장: ${cmd.label}` : "체크포인트 저장";
    case "setEventGraphicPattern":
      return `이벤트 그래픽 변경`;
    case "changeTile":
      return `타일 변경: ${cmd.layer} (${cmd.x},${cmd.y}) = ${cmd.tile}`;
    case "spawnFieldEnemy":
      return "필드 몬스터 생성";
    case "despawnFieldEnemy":
      return `필드 몬스터 제거: ${cmd.spawnId}`;
    case "killPlayer":
      return "주인공 사망";
    case "gameOver":
      return "게임 오버";
    case "returnToTitle":
      return "타이틀로 돌아가기";
    case "ending":
      return `엔딩: ${cmd.title}`;
    case "label":
      return `라벨: ${cmd.name}`;
    case "gotoLabel":
      return `라벨로 이동: ${cmd.name}`;
    case "breakLoop":
      return "반복 중단";
    case "advanceTime":
      return `시간 경과: ${cmd.minutes ?? 0}분 ${cmd.hours ?? 0}시간`;
    case "setTime":
      return `시간 설정: ${cmd.hour}:${String(cmd.minute ?? 0).padStart(2, "0")}`;
    case "sleepUntilMorning":
      return "아침까지 수면";
    case "cutsceneControl":
      return cmd.mode === "begin" ? "연출 시작" : "연출 종료";
    case "equipTool":
      return cmd.itemId ? `도구 장착: ${cmd.itemId}` : "도구 해제";
    default:
      return null;
  }
}
