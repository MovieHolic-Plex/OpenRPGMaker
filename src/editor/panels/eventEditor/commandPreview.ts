import { el } from "@/util/dom";
import { store } from "@/project/store";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { renderFacesetCrop } from "./facesetPreview";
import { drawTransferFallback, drawTransferMapPreview } from "./transferMapPreview";
import { facesetIconOf, initialBadge, recordIconElement } from "./recordPicker";
import { commandLabel } from "./commandPicker";
import { commandSummaryParts, isSummaryIconPart } from "./commandSummary";
import { previewAudio } from "./previewAudio";
import { previewForkFlow } from "./previewForkFlow";
import { previewMoveRoute } from "./previewMoveRoute";
import { previewPicture } from "./previewPicture";
import type { Command } from "@/project/types";

/** In-game face size inside the message-window mock (48×48 source, scaled for readability). */
const PREVIEW_FACE_SIZE = 96;

// [중간-3] 프리뷰 문맥: 직전 changeFace 상태 등 리스트 문맥을 프리뷰에 전달.
export type CommandPreviewContext = {
  readonly face?: { readonly resourceId: string; readonly faceIndex: number };
};

// 명령 편집 모달 우측 "이미지 리치" 프리뷰 패널. staged command 를 받아 종류별 시각화를
// 렌더한다. 전용 렌더러가 없으면 요약 카드로 폴백한다(패널이 비어 보이지 않게).
export function renderCommandPreview(cmd: Command, context?: CommandPreviewContext): HTMLElement {
  const panel = el("div", {
    class: "event-command-preview",
    dataset: { testid: "event-command-preview-body", previewKind: cmd.kind },
  });
  panel.append(el("div", { class: "ecp-caption", text: commandLabel(cmd.kind) }));
  panel.append(renderVisual(cmd, context));
  return panel;
}

function renderVisual(cmd: Command, context?: CommandPreviewContext): HTMLElement {
  const handler = visualPreviewHandlers[cmd.kind] as VisualPreviewHandler<Command> | undefined;
  return handler ? handler(cmd, context) : summaryCard(cmd);
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
  fork: previewForkFlow,
  showPicture: previewPicture,
  playAudio: previewAudio,
  stopAudio: previewAudio,
  changeItem: itemStage,
  shop: shopStage,
  changeParty: (cmd) => actorStage(cmd.actorId, cmd.action === "add" ? "파티에 추가" : "파티에서 제외"),
  addFollower: (cmd) => screenMock(cmd.name || cmd.actorId || "FOLLOWER", "title"),
  removeFollower: (cmd) => screenMock(cmd.all === true ? "FOLLOWERS OFF" : "FOLLOWER OFF", "title"),
  setLighting: (cmd) => screenMock(`DARK ${Math.round(cmd.ambient * 100)}%`, "title"),
  addLight: (cmd) => screenMock(cmd.source.id || "LIGHT", "title"),
  removeLight: (cmd) => screenMock(cmd.all === true ? "LIGHTS OFF" : "LIGHT OFF", "title"),
  setWeather: (cmd) => screenMock(cmd.weather.toUpperCase(), "title"),
  showAnimation: (cmd) => screenMock(cmd.animationId || "ANIMATION", "title"),
  changeGold: goldStage,
  battleProcessing: battleStage,
  setSwitch: (cmd) => lampStage(switchName(cmd.switchId), cmd.value),
  setSelfSwitch: (cmd) => lampStage(`셀프 스위치 ${cmd.key}`, cmd.value),
  setFlag: (cmd) => lampStage(cmd.flag || "플래그", cmd.value),
  checkpointSave: () => screenMock("CHECKPOINT", "title"),
  killPlayer: () => screenMock("GAME OVER", "gameover"),
  triggerEnding: (cmd) => screenMock(cmd.endingId || "ENDING", "ending"),
  gameOver: () => screenMock("GAME OVER", "gameover"),
  returnToTitle: () => screenMock("타이틀 화면", "title"),
  ending: (cmd) => screenMock(cmd.title || "THE END", "ending"),
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
  const win = el("div", {
    class: `ecp-message-window${faceRight ? " face-right" : ""}${face ? " with-face" : ""}`,
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
  if (speaker) textCol.append(el("div", { class: "ecp-message-speaker", text: speaker }));
  textCol.append(el("div", { class: "ecp-message-body", text: body || "..." }));
  win.append(textCol);
  stage.append(win);
  return stage;
}

function faceStage(cmd: Extract<Command, { kind: "changeFace" }>): HTMLElement {
  // Play mock: face graphic as it will appear next to dialogue — not the editor label card.
  const stage = el("div", { class: "ecp-stage ecp-face-stage" });
  const win = el("div", {
    class: `ecp-message-window with-face ecp-face-message${cmd.position === "right" ? " face-right" : ""}`,
    dataset: { testid: "ecp-message-window" },
  });
  win.append(
    renderFacesetCrop({
      resourceId: cmd.resourceId,
      faceIndex: cmd.faceIndex,
      flipHorizontally: cmd.flipHorizontally,
      displaySize: PREVIEW_FACE_SIZE,
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
  stage.append(win);
  const side = cmd.position === "right" ? "오른쪽" : "왼쪽";
  const faceNo = Math.max(0, Math.trunc(cmd.faceIndex)) + 1;
  stage.append(
    el("div", {
      class: "ecp-face-caption",
      text: `${side} · 얼굴 ${faceNo}${cmd.flipHorizontally ? " · 좌우 반전" : ""}`,
      dataset: { testid: "ecp-face-caption" },
    })
  );
  return stage;
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
    class: `ecp-message-window${transparent ? " transparent" : ""}`,
    dataset: { testid: "ecp-message-window" },
  });
  win.append(
    el("div", { class: "ecp-message-speaker", text: "미리보기" }),
    el("div", {
      class: "ecp-message-body",
      text: transparent
        ? "투명 창으로 표시됩니다.\n배경 없이 글자만 보입니다."
        : "일반 창으로 표시됩니다.\n이후 문장 표시에 적용됩니다.",
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
  const win = el("div", { class: "ecp-message-window" });
  if (cmd.prompt) win.append(el("div", { class: "ecp-message-body", text: cmd.prompt }));
  const list = el("div", { class: "ecp-choice-list" });
  cmd.options.forEach((option, index) => list.append(el("div", { class: "ecp-choice", text: `▶ ${option.text || `선택지 ${index + 1}`}` })));
  if (cmd.options.length === 0) list.append(el("div", { class: "ecp-choice empty", text: "선택지 없음" }));
  win.append(list);
  stage.append(win);
  return stage;
}

/** 숫자 입력 — System.png fill 팔레트 오염을 피하려고 상점 미리보기와 같이 솔리드 창. */
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
  // 미리보기 샘플: 왼쪽부터 채워진 자릿수 예시 (123… 패턴).
  const sample = "123456".slice(0, digits);
  for (let i = 0; i < digits; i += 1) {
    const ch = sample[i] ?? "0";
    slots.append(
      el("div", {
        class: `ecp-number-slot${i < sample.length ? " filled" : ""}${i === Math.min(sample.length, digits - 1) ? " cursor" : ""}`,
        text: ch,
      })
    );
  }
  win.append(slots);

  if (cmd.showPad) {
    const pad = el("div", { class: "ecp-number-pad", dataset: { testid: "ecp-number-pad" } });
    for (const key of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "OK"] as const) {
      pad.append(el("div", { class: `ecp-number-pad-key${key === "OK" ? " ok" : ""}`, text: key }));
    }
    win.append(pad);
  }

  win.append(
    el("div", {
      class: "ecp-number-meta",
      dataset: { testid: "ecp-number-meta" },
      text: `${digits}자리 · 변수 ${variablePreviewName(cmd.variableId)}`,
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

function itemStage(cmd: Extract<Command, { kind: "changeItem" }>): HTMLElement {
  const project = store.getCurrent();
  const record = project.database.items.find((item) => item.id === cmd.itemId);
  const stage = el("div", { class: "ecp-icon-stage" });
  stage.append(el("div", { class: "ecp-hero-icon", children: [heroIcon(record?.iconResourceId ?? record?.imageResourceId, record?.name ?? cmd.itemId, 48)] }));
  stage.append(el("div", { class: "ecp-icon-name", text: record?.name ?? (cmd.itemId || "(아이템 선택)") }));
  stage.append(el("div", { class: "ecp-op-strip", text: `${cmd.op} ${cmd.amount}개` }));
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

function actorStage(actorId: string, caption: string): HTMLElement {
  const project = store.getCurrent();
  const record = project.database.actors.find((actor) => actor.id === actorId);
  const stage = el("div", { class: "ecp-icon-stage" });
  stage.append(el("div", { class: "ecp-hero-icon", children: [recordIconElement(facesetIconOf(project, record?.faceResourceId), record?.name ?? actorId)] }));
  stage.append(el("div", { class: "ecp-icon-name", text: record?.name ?? (actorId || "(주인공 선택)") }));
  stage.append(el("div", { class: "ecp-op-strip", text: caption }));
  return stage;
}

function goldStage(cmd: Extract<Command, { kind: "changeGold" }>): HTMLElement {
  const stage = el("div", { class: "ecp-icon-stage" });
  stage.append(el("div", { class: "ecp-gold-badge", text: "G" }));
  stage.append(el("div", { class: "ecp-op-strip", text: `소지금 ${cmd.op} ${cmd.amount}` }));
  return stage;
}

function battleStage(cmd: Extract<Command, { kind: "battleProcessing" }>): HTMLElement {
  const project = store.getCurrent();
  const troop = project.database.troops.find((entry) => entry.id === cmd.troopId);
  const stage = el("div", { class: "ecp-icon-stage" });
  stage.append(el("div", { class: "ecp-battle-badge", text: "⚔" }));
  stage.append(el("div", { class: "ecp-icon-name", text: troop?.name ?? (cmd.troopId || "(적 그룹 선택)") }));
  const badges = el("div", { class: "ecp-move-badges" });
  badges.append(el("span", { class: "ecp-move-badge", text: cmd.canEscape ? "도망 가능" : "도망 불가" }));
  if (cmd.canLose) badges.append(el("span", { class: "ecp-move-badge", text: "패배 허용" }));
  stage.append(badges);
  return stage;
}

function lampStage(name: string, value: boolean): HTMLElement {
  const stage = el("div", { class: "ecp-icon-stage" });
  stage.append(el("div", { class: `ecp-lamp ${value ? "on" : "off"}`, text: value ? "ON" : "OFF" }));
  stage.append(el("div", { class: "ecp-icon-name", text: name }));
  return stage;
}

function screenMock(text: string, variant: "gameover" | "title" | "ending"): HTMLElement {
  const stage = el("div", { class: "ecp-stage" });
  stage.append(el("div", { class: `ecp-result-screen ${variant}`, text }));
  return stage;
}

function summaryCard(cmd: Command): HTMLElement {
  const card = el("div", { class: "ecp-summary-card" });
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

function switchName(id: string): string {
  const project = store.getCurrent();
  const index = project.switches.findIndex((entry) => entry.id === id);
  if (index >= 0) return project.switches[index]?.name || `스위치 ${index + 1}`;
  return id || "스위치";
}
