import { el } from "@/util/dom";
import { store } from "@/project/store";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { applySystemGraphic } from "@/player/systemGraphics";
import { renderFacesetPreview } from "./facesetPreview";
import { drawTransferFallback, drawTransferMapPreview } from "./transferMapPreview";
import { facesetIconOf, initialBadge, recordIconElement } from "./recordPicker";
import { commandLabel } from "./commandPicker";
import { commandSummaryParts, isSummaryIconPart } from "./commandSummary";
import { previewAudio } from "./previewAudio";
import { previewForkFlow } from "./previewForkFlow";
import { previewMoveRoute } from "./previewMoveRoute";
import { previewPicture } from "./previewPicture";
import type { Command } from "@/project/types";

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
  switch (cmd.kind) {
    case "text":
      return messageWindowMock(cmd.speaker, cmd.body, false, context?.face);
    case "changeFace":
      return faceStage(cmd);
    case "displayTextSettings":
      return settingsMessageMock(cmd);
    case "choices":
      return choicesMock(cmd);
    case "transfer":
      return transferStage(cmd);
    case "moveEvent":
      return previewMoveRoute(cmd);
    case "fork":
      return previewForkFlow(cmd);
    case "showPicture":
      return previewPicture(cmd);
    case "playAudio":
    case "stopAudio":
      return previewAudio(cmd);
    case "changeItem":
      return itemStage(cmd);
    case "shop":
      return shopStage(cmd);
    case "changeParty":
      return actorStage(cmd.actorId, cmd.action === "add" ? "파티에 추가" : "파티에서 제외");
    case "changeGold":
      return goldStage(cmd);
    case "battleProcessing":
      return battleStage(cmd);
    case "setSwitch":
      return lampStage(switchName(cmd.switchId), cmd.value);
    case "setSelfSwitch":
      return lampStage(`셀프 스위치 ${cmd.key}`, cmd.value);
    case "setFlag":
      return lampStage(cmd.flag || "플래그", cmd.value);
    case "gameOver":
      return screenMock("GAME OVER", "gameover");
    case "returnToTitle":
      return screenMock("타이틀 화면", "title");
    case "ending":
      return screenMock(cmd.title || "THE END", "ending");
    default:
      return summaryCard(cmd);
  }
}

function messageWindowMock(
  speaker: string | undefined,
  body: string,
  faceRight: boolean,
  face?: CommandPreviewContext["face"]
): HTMLElement {
  const stage = el("div", { class: "ecp-stage" });
  const win = el("div", {
    class: `ecp-message-window${faceRight ? " face-right" : ""}${face ? " with-face" : ""}`,
    dataset: { testid: "ecp-message-window" },
  });
  applySystemGraphic(win);
  // [중간-3] 직전 changeFace 상태가 있으면 화자 얼굴을 프리뷰에 반영.
  if (face) {
    win.append(
      renderFacesetPreview({
        resourceId: face.resourceId,
        faceIndex: face.faceIndex,
        position: "left",
        flipHorizontally: false,
      })
    );
  }
  if (speaker) win.append(el("div", { class: "ecp-message-speaker", text: speaker }));
  win.append(el("div", { class: "ecp-message-body", text: body || "..." }));
  stage.append(win);
  return stage;
}

function faceStage(cmd: Extract<Command, { kind: "changeFace" }>): HTMLElement {
  const stage = el("div", { class: "ecp-stage" });
  const win = el("div", { class: `ecp-message-window with-face${cmd.position === "right" ? " face-right" : ""}` });
  applySystemGraphic(win);
  win.append(
    renderFacesetPreview({
      resourceId: cmd.resourceId,
      faceIndex: cmd.faceIndex,
      position: cmd.position,
      flipHorizontally: cmd.flipHorizontally,
    }),
    el("div", { class: "ecp-message-body muted", text: cmd.position === "right" ? "얼굴이 오른쪽에 표시됩니다" : "얼굴이 왼쪽에 표시됩니다" })
  );
  stage.append(win);
  return stage;
}

function settingsMessageMock(cmd: Extract<Command, { kind: "displayTextSettings" }>): HTMLElement {
  const stage = el("div", { class: `ecp-stage pos-${cmd.position}` });
  const transparent = cmd.format === "transparent";
  const win = el("div", { class: `ecp-message-window${transparent ? " transparent" : ""}` });
  if (!transparent) applySystemGraphic(win);
  win.append(el("div", { class: "ecp-message-body muted", text: `${transparent ? "투명" : "일반"} 창 · ${positionLabel(cmd.position)}` }));
  stage.append(win);
  return stage;
}

function choicesMock(cmd: Extract<Command, { kind: "choices" }>): HTMLElement {
  const stage = el("div", { class: "ecp-stage" });
  const win = el("div", { class: "ecp-message-window" });
  applySystemGraphic(win);
  if (cmd.prompt) win.append(el("div", { class: "ecp-message-body", text: cmd.prompt }));
  const list = el("div", { class: "ecp-choice-list" });
  cmd.options.forEach((option, index) => list.append(el("div", { class: "ecp-choice", text: `▶ ${option.text || `선택지 ${index + 1}`}` })));
  if (cmd.options.length === 0) list.append(el("div", { class: "ecp-choice empty", text: "선택지 없음" }));
  win.append(list);
  stage.append(win);
  return stage;
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
  const win = el("div", { class: "ecp-shop-window" });
  applySystemGraphic(win);
  win.append(el("div", { class: "ecp-shop-title", text: `상점 · ${cmd.itemIds.length}개 상품` }));
  const grid = el("div", { class: "ecp-item-grid" });
  for (const id of cmd.itemIds.slice(0, 12)) {
    const record = project.database.items.find((item) => item.id === id);
    grid.append(el("div", { class: "ecp-item-cell", attrs: { title: record?.name ?? id }, children: [heroIcon(record?.iconResourceId ?? record?.imageResourceId, record?.name ?? id, 24)] }));
  }
  if (cmd.itemIds.length === 0) grid.append(el("div", { class: "ecp-item-cell empty", text: "상품 없음" }));
  win.append(grid);
  const stage = el("div", { class: "ecp-stage" });
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
