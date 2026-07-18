import { clearChildren, el } from "@/util/dom";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import {
  CHOICE_CANCEL_BRANCH_INDEX,
  FORK_ELSE_BRANCH_INDEX,
  FORK_THEN_BRANCH_INDEX,
  PROMOTE_FAILURE_BRANCH_INDEX,
  PROMOTE_SUCCESS_BRANCH_INDEX,
  SHOP_TRANSACTION_BRANCH_INDEX,
} from "@/editor/eventCommandPaths";
import { openEventCommandEditDialog } from "./commandEditDialog";
import { handleCommandShortcut, openCommandContextMenu } from "./commandListContextMenu";
import { attachItemDropHandlers, enableItemDrag, ensureListDropHandlers } from "./commandListDragDrop";
import { commandCategoryVisual } from "./commandCategoryIcons";
import { commandSummaryParts, isSummaryIconPart, isSummaryVisualPart, type CommandSummaryVisual } from "./commandSummary";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  charsetFrameSource,
} from "@/assets/easyrpgRtp";
import { applyTransparentColorKeyBackground } from "@/assets/transparentColorKeyBackground";
import { drawTransferFallback, drawTransferMapPreview } from "./transferMapPreview";
import { commandRuntimeSupport, type CommandRuntimeSupport } from "@/editor/eventCommands/runtimeSupport";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "./types";
import { renderRuntimeSupportBadge } from "./commandRuntimeBadge";

// 이벤트 명령 리스트 렌더링. RM2K3 처럼 트리 들여쓰기 + 드래그 재정렬 + 위/아래/삭제 버튼.
// 드래그: 같은 컨테이너 재정렬 + (호스트가 moveCommandAcross 를 지원하면) 가지 안팎
// 크로스 컨테이너 이동. 자기 분기 안으로의 드롭은 invalid 표시와 함께 거부된다. [P2]

// [P1] 문장 표시 줄에 "직전 얼굴 그래픽 변경" 상태를 16px 크롭으로 부가하기 위한
// 스크립트 순서 기반 얼굴 상태. 렌더 패스(문서 순서 = 실행 순서 근사) 동안 스레딩된다.
type ActiveFace = { readonly resourceId: string; readonly faceIndex: number };
type FaceState = { current: ActiveFace | undefined };

export function renderCommandList(
  host: HTMLElement,
  commands: Command[],
  containerPath: number[],
  actions: CommandListActions,
  options: { readonly runtimeSupport?: (command: Command) => CommandRuntimeSupport } = {}
): void {
  clearChildren(host);
  host.dataset.containerPath = JSON.stringify(containerPath);
  if (commands.length === 0) {
    host.append(el("div", { class: "empty-hint", text: "(명령 없음)" }));
    return;
  }
  // 빈 리스트 드롭을 host 단위에서 잡기 위해 DnD 리스너를 보장한다.
  ensureListDropHandlers(host, actions);
  const faceState: FaceState = { current: undefined };
  commands.forEach((cmd, index) => {
    const path = [...containerPath, index];
    renderCommandTree(host, cmd, path, containerPath, actions, 0, faceState, options);
  });
}

function renderCommandTree(
  host: HTMLElement,
  cmd: Command,
  path: number[],
  containerPath: number[],
  actions: CommandListActions,
  depth: number,
  faceState: FaceState,
  options: { readonly runtimeSupport?: (command: Command) => CommandRuntimeSupport }
): void {
  host.append(renderCommandItem(cmd, path, containerPath, actions, depth, faceState, options));
  if (cmd.kind === "changeFace") {
    faceState.current = cmd.resourceId ? { resourceId: cmd.resourceId, faceIndex: cmd.faceIndex } : undefined;
  }
  appendCommandChildren(host, cmd, path, containerPath, actions, depth, faceState, options);
}

function renderCommandItem(
  cmd: Command,
  path: number[],
  containerPath: number[],
  actions: CommandListActions,
  depth: number,
  faceState: FaceState,
  options: { readonly runtimeSupport?: (command: Command) => CommandRuntimeSupport }
): HTMLElement {
  // [중간-1] 카테고리 색 레일 + kind 아이콘용 시각 정보 (CSS 는 data-command-category 로 매칭).
  const categoryVisual = commandCategoryVisual(cmd);
  const item = el("div", {
    class: "cmd-item",
    // cmdDepth 는 CSS 어트리뷰트 셀렉터/디버깅용으로 들여쓰기 깊이를 함께 노출한다.
    dataset: {
      testid: `event-command-${cmd.kind}`,
      cmdPath: JSON.stringify(path),
      commandKind: cmd.kind,
      cmdDepth: String(depth),
      commandCategory: categoryVisual.key,
    },
  });
  item.dataset.renderKindString = String(cmd.kind);
  // 드래그는 핸들에서 시작하고 항목 전체를 드래그한다.
  item.draggable = false;
  const head = el("div", {
    class: "cmd-head",
    attrs: { role: "button", tabindex: "0", title: "더블클릭해서 명령 편집" },
  });
  head.style.setProperty("--cmd-depth", String(depth));
  const handle = el("span", {
    class: "cmd-drag-handle",
    dataset: { testid: "event-command-drag-handle" },
    attrs: { title: "드래그로 순서 변경", "aria-hidden": "true" },
    text: "::",
  });
  // 핸들에서 누르면 항목을 드래그 가능하게 만든다.
  enableItemDrag(handle, item, path);
  const supportBadge = renderRuntimeSupportBadge((options.runtimeSupport ?? commandRuntimeSupport)(cmd), `command-runtime-badge-list-${path.join("-")}`);
  // 문장 표시 줄: 직전 changeFace 상태를 화자 얼굴 16px 크롭으로 부가.
  const activeFaceForItem = faceState.current;
  const speakerFace =
    cmd.kind === "text" && activeFaceForItem
      ? renderSummaryVisual({ type: "faceCrop", resourceId: activeFaceForItem.resourceId, faceIndex: activeFaceForItem.faceIndex })
      : null;
  if (speakerFace) speakerFace.dataset.testid = "cmd-speaker-face";
  head.append(
    handle,
    // RM2003 정본: 명령 줄 프리픽스는 ◆ 하나만. 카테고리 글리프(◇ 등)를 옆에 붙이면
    // 스위치/조건 줄이 "◆ ◇" 이중 마름모로 보인다. 카테고리 구분은 좌측 색 레일만 쓴다.
    el("span", { class: "cmd-prefix", text: "◆" }),
    ...(speakerFace ? [speakerFace] : []),
    renderCommandSummary(cmd),
    ...(supportBadge ? [supportBadge] : []),
    commandActions(path, actions),
  );
  const openEditor = () => openCommandEditModal(cmd, path, actions, activeFaceForItem);
  head.addEventListener("click", () => selectCommandLine(item));
  head.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    selectCommandLine(item);
    openCommandContextMenu({ x: event.clientX, y: event.clientY, item, command: cmd, path, actions, openEditor });
  });
  head.addEventListener("dblclick", (event) => {
    // 버튼(↑↓x)·드래그 핸들 더블클릭은 편집 모달을 열지 않는다(각자 동작을 유지한다).
    if (event.target instanceof Element && event.target.closest(".cmd-actions, .cmd-drag-handle")) return;
    selectCommandLine(item);
    openEditor();
  });
  head.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    selectCommandLine(item);
    handleCommandShortcut(event, { x: 0, y: 0, item, command: cmd, path, actions, openEditor });
  });
  item.append(head);
  ensureTerminalRowHint(item, cmd);
  // 항목 자체를 드롭 타겟으로 만들어 위/아래 삽입 위치를 결정한다.
  attachItemDropHandlers(item, path, containerPath, actions);
  return item;
}

function renderCommandSummary(cmd: Command): HTMLElement {
  const summary = el("span", { class: "cmd-kind" });
  for (const part of commandSummaryParts(cmd)) {
    // 아이콘 토큰은 텍스트 대신 16px 이미지로 렌더. URL 을 못 찾으면 조용히 생략한다.
    if (isSummaryIconPart(part)) {
      const icon = renderSummaryIcon(part.resourceId);
      if (icon) summary.append(icon);
      continue;
    }
    // [P1] 썸네일 토큰(얼굴 크롭/스프라이트/맵)도 16px 상한으로 렌더.
    if (isSummaryVisualPart(part)) {
      const visual = renderSummaryVisual(part.visual);
      if (visual) summary.append(visual);
      continue;
    }
    summary.append(el("span", { class: `cmd-summary-token ${part.tone}`, text: part.text }));
  }
  return summary;
}

// [P1] 인라인 썸네일 렌더러. 실패(리소스 미해석, canvas 미지원)하면 null 로 조용히 생략.
function renderSummaryVisual(visual: CommandSummaryVisual): HTMLElement | null {
  if (visual.type === "faceCrop") return renderFaceCrop16(visual.resourceId, visual.faceIndex);
  if (visual.type === "charsetSprite") return renderCharsetSprite16(visual.spriteId);
  return renderMapThumb16(visual.mapId);
}

// 페이스셋 한 칸을 16x16 으로 크롭.
function renderFaceCrop16(resourceId: string, faceIndex: number): HTMLElement | null {
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  if (!url) return null;
  const slicing = RESOURCE_SLICING.faceset;
  const scale = 16 / slicing.cellWidth;
  const col = Math.max(0, faceIndex) % slicing.columns;
  const row = Math.floor(Math.max(0, faceIndex) / slicing.columns);
  const crop = el("span", { class: "cmd-thumb cmd-thumb-face", attrs: { "aria-hidden": "true" } });
  crop.style.setProperty("background-image", `url("${url}")`);
  crop.style.setProperty("background-size", `${slicing.sheetWidth * scale}px ${slicing.sheetHeight * scale}px`);
  crop.style.setProperty("background-position", `-${col * slicing.cellWidth * scale}px -${row * slicing.cellHeight * scale}px`);
  return crop;
}

// 캐릭터칩 대표 프레임(캐릭터 0, 아래, 가운데)을 높이 16px 로 크롭.
function renderCharsetSprite16(spriteId: string): HTMLElement | null {
  const asset = CHARSET_ASSETS.find((entry) => entry.textureKey === spriteId);
  if (!asset) return null;
  const scale = 16 / CHARSET_FRAME_HEIGHT;
  const source = charsetFrameSource({ characterIndex: 0, direction: "down", pattern: 1 });
  const crop = el("span", { class: "cmd-thumb cmd-thumb-sprite", attrs: { "aria-hidden": "true" } });
  crop.style.setProperty("width", `${Math.round(CHARSET_FRAME_WIDTH * scale)}px`);
  crop.style.setProperty("height", "16px");
  applyTransparentColorKeyBackground(crop, asset.path);
  crop.style.setProperty(
    "background-size",
    `${CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH * scale}px ${CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT * scale}px`
  );
  crop.style.setProperty("background-position", `-${source.x * scale}px -${source.y * scale}px`);
  return crop;
}

// 목적지 맵 24x16 미니 썸네일 (실브라우저에서만 그린다 — fakeDom 은 null 폴백).
function renderMapThumb16(mapId: string): HTMLElement | null {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map) return null;
  const probe = document.createElement("canvas");
  if (typeof probe.getContext !== "function") return null;
  const wrap = el("span", { class: "cmd-thumb cmd-thumb-map", attrs: { "aria-hidden": "true" }, dataset: { mapId } });
  const canvas = probe;
  canvas.className = "cmd-thumb-map-canvas";
  const zoom = 16 / Math.max(1, map.height * map.tileSize);
  wrap.append(canvas);
  drawTransferMapPreview({
    canvas,
    project,
    mapId,
    selection: { x: -1, y: -1, zoom },
    isCurrent: () => canvas.isConnected,
  }).catch(() => {
    try {
      drawTransferFallback({ canvas, map, selection: { x: -1, y: -1, zoom } });
    } catch {
      /* canvas 미지원 — 생략 */
    }
  });
  return wrap;
}

// 아이템/장비 아이콘 리소스 id → <img>. cc0 아이콘·생성 에셋·업로드 에셋 모두 해석한다.
function renderSummaryIcon(resourceId: string): HTMLElement | null {
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  if (!url) return null;
  return el("img", {
    class: "cmd-summary-icon",
    attrs: { src: url, alt: "", width: "16", height: "16", draggable: "false", "aria-hidden": "true" },
  });
}

function ensureTerminalRowHint(item: HTMLElement, cmd: Command): void {
  const hint = terminalEditorHint(cmd);
  if (!hint) return;
  if (item.querySelector(`[data-testid="${hint.testId}"]`)) return;
  item.append(el("span", {
    class: "terminal-command-editor empty-hint",
    text: hint.text,
    dataset: { testid: hint.testId },
  }));
}

function terminalEditorHint(cmd: Command): { readonly testId: string; readonly text: string } | undefined {
  const kind = String(cmd.kind);
  if (kind.includes("stopAudio")) return { testId: "stop-audio-editor", text: "설정 없음. 현재 재생 중인 오디오를 정지합니다." };
  if (kind.includes("checkpointSave")) return { testId: "checkpoint-save-editor", text: "현재 런타임 세션을 체크포인트로 저장합니다." };
  if (kind.includes("killPlayer")) return { testId: "kill-player-editor", text: "파티를 전멸시키고 게임 오버 화면을 엽니다." };
  if (kind.includes("triggerEnding")) return { testId: "trigger-ending-editor", text: "엔딩 레지스트리에서 실행할 엔딩을 고릅니다." };
  if (kind.includes("gameOver")) return { testId: "game-over-editor", text: "설정 없음. 게임 오버 화면을 엽니다." };
  if (kind.includes("returnToTitle")) return { testId: "return-to-title-editor", text: "설정 없음. 타이틀 화면으로 돌아갑니다." };
  return undefined;
}

function appendCommandChildren(
  host: HTMLElement,
  cmd: Command,
  path: number[],
  containerPath: number[],
  actions: CommandListActions,
  depth: number,
  faceState: FaceState,
  options: { readonly runtimeSupport?: (command: Command) => CommandRuntimeSupport }
): void {
  if (cmd.kind === "choices") {
    const optionCount = cmd.options.length;
    cmd.options.forEach((option, optionIndex) => {
      const isLastOption =
        optionIndex === optionCount - 1
        && cmd.cancelBehavior !== "branch";
      const branchGlyph = isLastOption ? "└" : "├";
      host.append(
        renderMarkerLine(
          `${branchGlyph} ${option.text || `선택지 ${optionIndex + 1}`}`,
          depth,
          "choices",
        ),
      );
      option.branch.forEach((child, childIndex) => {
        renderCommandTree(host, child, [...path, optionIndex, childIndex], containerPath, actions, depth + 1, faceState, options);
      });
    });
    if (cmd.cancelBehavior === "branch") {
      host.append(renderMarkerLine("├ 취소할 때", depth, "choices"));
      (cmd.cancelBranch ?? []).forEach((child, childIndex) => {
        renderCommandTree(
          host,
          child,
          [...path, CHOICE_CANCEL_BRANCH_INDEX, childIndex],
          containerPath,
          actions,
          depth + 1,
          faceState,
          options,
        );
      });
    }
    host.append(renderMarkerLine("└ 선택지 종료", depth, "choices"));
    return;
  }
  if (cmd.kind === "fork") {
    host.append(renderMarkerLine("├ 조건이 참일 때", depth, "fork"));
    cmd.then.forEach((child, childIndex) => {
      renderCommandTree(
        host,
        child,
        [...path, FORK_THEN_BRANCH_INDEX, childIndex],
        containerPath,
        actions,
        depth + 1,
        faceState,
        options,
      );
    });
    if (cmd.else) {
      host.append(renderMarkerLine("├ 그 외의 경우", depth, "fork"));
      cmd.else.forEach((child, childIndex) => {
        renderCommandTree(
          host,
            child,
            [...path, FORK_ELSE_BRANCH_INDEX, childIndex],
            containerPath,
            actions,
            depth + 1,
            faceState,
            options
        );
      });
    }
    host.append(renderMarkerLine("└ 분기 종료", depth, "fork"));
    return;
  }
  if (cmd.kind === "shop" && cmd.branchOnTransaction) {
    host.append(renderMarkerLine("├ 플레이어가 구매/판매했을 때", depth, "shop"));
    (cmd.transactionBranch ?? []).forEach((child, childIndex) => {
      renderCommandTree(
        host,
        child,
        [...path, SHOP_TRANSACTION_BRANCH_INDEX, childIndex],
        containerPath,
        actions,
        depth + 1,
        faceState,
        options,
      );
    });
    host.append(renderMarkerLine("└ 상점 분기 종료", depth, "shop"));
  }
  if (cmd.kind === "promoteActor") {
    host.append(renderMarkerLine("├ 승급 성공", depth, "fork"));
    (cmd.successBranch ?? []).forEach((child, childIndex) => {
      renderCommandTree(
        host,
        child,
        [...path, PROMOTE_SUCCESS_BRANCH_INDEX, childIndex],
        containerPath,
        actions,
        depth + 1,
        faceState,
        options,
      );
    });
    host.append(renderMarkerLine("├ 승급 실패", depth, "fork"));
    (cmd.failureBranch ?? []).forEach((child, childIndex) => {
      renderCommandTree(
        host,
        child,
        [...path, PROMOTE_FAILURE_BRANCH_INDEX, childIndex],
        containerPath,
        actions,
        depth + 1,
        faceState,
        options,
      );
    });
    host.append(renderMarkerLine("└ 승급 분기 종료", depth, "fork"));
  }
  if (cmd.kind === "evolveMonster") {
    host.append(renderMarkerLine("├ 진화 성공", depth, "fork"));
    (cmd.successBranch ?? []).forEach((child, childIndex) => {
      renderCommandTree(
        host,
        child,
        [...path, PROMOTE_SUCCESS_BRANCH_INDEX, childIndex],
        containerPath,
        actions,
        depth + 1,
        faceState,
        options,
      );
    });
    host.append(renderMarkerLine("├ 진화 실패", depth, "fork"));
    (cmd.failureBranch ?? []).forEach((child, childIndex) => {
      renderCommandTree(
        host,
        child,
        [...path, PROMOTE_FAILURE_BRANCH_INDEX, childIndex],
        containerPath,
        actions,
        depth + 1,
        faceState,
        options,
      );
    });
    host.append(renderMarkerLine("└ 진화 분기 종료", depth, "fork"));
  }
}

// 분기 마커 라인 (": 조건이 참일 때" 등). kind 별 클래스로 fork/choices/shop 마커를 톤으로 구분한다.
function renderMarkerLine(text: string, depth: number, kind: "fork" | "choices" | "shop"): HTMLElement {
  const line = el("div", { class: `cmd-line-marker cmd-marker-${kind}`, text, dataset: { cmdDepth: String(depth) } });
  line.style.setProperty("--cmd-depth", String(depth));
  return line;
}

function selectCommandLine(item: HTMLElement): void {
  item.parentElement?.querySelectorAll(".cmd-item.selected").forEach((node) => node.classList.remove("selected"));
  item.classList.add("selected");
}

// 더블클릭/Enter·Space·우클릭"편집" 모두 이 모달로 진입한다(인라인 collapse 폐지).
// 기존 명령 편집이므로 lockKind:true — 종류 변경으로 인한 분기 유실을 막는다.
// previewFace: 이 줄 시점의 활성 얼굴(직전 changeFace) — 문장 프리뷰에 반영된다(중간-3).
function openCommandEditModal(cmd: Command, path: number[], actions: CommandListActions, previewFace?: ActiveFace): void {
  openEventCommandEditDialog({
    initial: cmd,
    lockKind: true,
    previewFace,
    onApply: (edited) => actions.replaceCommand(path, edited),
  });
}

function commandActions(path: number[], actions: CommandListActions): HTMLElement {
  const wrap = el("div", { class: "cmd-actions" });
  wrap.append(
    el("button", {
      text: "↑",
      attrs: { title: "위로", type: "button" },
      on: { click: () => actions.moveCommand(path, -1) },
    }),
    el("button", {
      text: "↓",
      attrs: { title: "아래로", type: "button" },
      on: { click: () => actions.moveCommand(path, 1) },
    }),
    el("button", {
      text: "x",
      attrs: { title: "삭제", type: "button" },
      on: { click: () => actions.deleteCommand(path) },
    })
  );
  return wrap;
}
