import { jsonEqual } from "@/util/structuralJson";
import { clearChildren, el } from "@/util/dom";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { branchEmptyActionLabel, eventCommandBranches } from "@/editor/eventCommandBranches";
import { openEventCommandEditDialog } from "./commandEditDialog";
import { handleCommandShortcut, openCommandContextMenu } from "./commandListContextMenu";
import { readEventCommandsClipboard } from "./commandClipboard";
import { attachItemDropHandlers, enableItemDrag, ensureListDropHandlers } from "./commandListDragDrop";
import { commandCategoryVisual, renderCategoryIcon } from "./commandCategoryIcons";
import { renderEditorIcon } from "./editorIcons";
import { brokenCommandDigest } from "./storyboardView";
import { commandSummaryParts, isSummaryIconPart, isSummaryVisualPart, type CommandSummaryVisual } from "./commandSummary";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import {
  CHARSET_FRAME_HEIGHT,
} from "@/assets/easyrpgRtp";
import { applyCharsetFrameCrop } from "@/assets/charsetFrameCrop";
import { beginCommandSelectionScope, invalidateCommandSelectionRows, isCommandActionKey, notifyCommandSelectionChanged, isCommandSelected, sameInspectorPath, selectedCommandPath, setCommandSelectionSurface, showCommandInspector } from "./commandInspector";
import { drawTransferFallback, drawTransferMapPreview } from "./transferMapPreview";
import { commandRuntimeSupportDescriptor, type M2RuntimeContext } from "@/project/eventCommands/runtimeSupport";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "./types";
import { renderRuntimeSupportBadge } from "./commandRuntimeBadge";
import type { EventDraftIssue } from "@/editor/eventDraftValidator";

type CommandListRenderOptions = {
  readonly selectionScope?: string | HTMLElement;
  readonly rootCommands?: readonly Command[];
  readonly issues?: readonly EventDraftIssue[];
  readonly deferMount?: boolean;
  readonly reuseImmutableRows?: boolean;
  readonly onMount?: () => void;
  readonly issuesByPath?: ReadonlyMap<string, readonly EventDraftIssue[]>;
  /** 목록 설명과 "삽입..." 피커가 공유하는 실행 맥락. 없으면 맥락 미지정 안내. */
  readonly pickerContext?: M2RuntimeContext;
  /** 빈 분기 버튼이 이 컨테이너에 명령을 추가하는 피커를 연다. */
  readonly openCommandPicker?: (containerPath: readonly number[]) => void;
};

// 이벤트 명령 리스트 렌더링. RM2K3 처럼 트리 들여쓰기 + 드래그 재정렬 + 위/아래/삭제 버튼.
// 드래그: 같은 컨테이너 재정렬 + (호스트가 moveCommandAcross 를 지원하면) 가지 안팎
// 크로스 컨테이너 이동. 자기 분기 안으로의 드롭은 invalid 표시와 함께 거부된다. [P2]

// [P1] 문장 표시 줄에 "직전 얼굴 그래픽 변경" 상태를 16px 크롭으로 부가하기 위한
// 스크립트 순서 기반 얼굴 상태. 렌더 패스(문서 순서 = 실행 순서 근사) 동안 스레딩된다.
import type { ActiveFace } from "./previewSimulation";
type FaceState = { current: ActiveFace | undefined };

type CachedCommandRow = {
  readonly command: Command;
  readonly row: HTMLElement;
  readonly face: ActiveFace | undefined;
  readonly issues: readonly EventDraftIssue[];
  readonly options: CommandListRenderOptions;
};
type CommandRowCache = {
  readonly actions: CommandListActions;
  readonly rows: Map<string, CachedCommandRow>;
  readonly used: Set<string>;
  anchor?: HTMLElement;
  cancel?: () => void;
  finish?: () => void;
  resume?: () => void;
  cursor?: Node | null;
  reconcile?: boolean;
};
const commandRowCaches = new WeakMap<HTMLElement, CommandRowCache>();

export function renderCommandList(
  host: HTMLElement,
  commands: Command[],
  containerPath: number[],
  actions: CommandListActions,
  options: CommandListRenderOptions = {}
): void {
  beginCommandSelectionScope(options.selectionScope ?? host);
  setCommandSelectionSurface(host);
  const previous = commandRowCaches.get(host);
  const reconcile = options.reuseImmutableRows === true && previous?.actions === actions && !host.hasAttribute("aria-busy");
  previous?.cancel?.();
  const cache: CommandRowCache = options.reuseImmutableRows && previous?.actions === actions ? previous : { actions, rows: new Map(), used: new Set() };
  cache.used.clear();
  cache.anchor = undefined;
  commandRowCaches.set(host, cache);
  cache.reconcile = reconcile;
  cache.cursor = reconcile ? host.firstChild : null;
  if (!reconcile) clearChildren(host);
  host.dataset.containerPath = JSON.stringify(containerPath);
  // The append line remains a clipboard destination even after Select All/Cut.
  // A property handler is replaced on rerender, unlike accumulating listeners.
  host.onkeydown = event => {
    if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "v") return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest(".cmd-item, input, textarea, select, [contenteditable='true']")) return;
    event.preventDefault();
    event.stopPropagation();
    const inserted = readEventCommandsClipboard();
    if (inserted.length === 0) return;
    const path = [...containerPath, commands.length];
    if (actions.insertCommands) actions.insertCommands(path, inserted);
    else inserted.reverse().forEach(command => actions.insertCommand(path, command));
  };
  ensureListDropHandlers(host, actions);
  if (commands.length === 0) {
    clearChildren(host);
    cache.rows.clear();
    host.removeAttribute("aria-busy");
    invalidateCommandSelectionRows();
    notifyCommandSelectionChanged();
    host.append(el("div", { class: "empty-hint", text: "(명령 없음)" }));
    return;
  }
  const issuesByPath = options.issuesByPath ?? indexCommandIssues(options.issues ?? []);
  const faceState: FaceState = { current: undefined };
  const renderOptions = { ...options, rootCommands: options.rootCommands ?? commands, issuesByPath };
  const iterator = (function* (): Generator<void> {
    for (let index = 0; index < commands.length; index += 1) {
      const cmd = commands[index]!;
      const path = [...containerPath, index];
      try { yield* renderCommandTree(host, cmd, path, containerPath, actions, 0, faceState, renderOptions); }
      catch (error) {
        console.error("[event-editor] failed to render command row", path, error);
        appendCommandNode(host, renderBrokenCommandRow(cmd, path, actions));
        yield;
      }
    }
  })();
  const view = host.ownerDocument?.defaultView;
  let frame: number | undefined;
  let cancelled = false;
  let paused = false;
  const complete = (): void => {
    if (cache.reconcile) {
      while (cache.cursor) {
        const node = cache.cursor;
        cache.cursor = node.nextSibling;
        host.removeChild(node);
      }
    }
    cache.anchor?.remove();
    cache.anchor = undefined;
    host.removeAttribute("aria-busy");
    cache.finish = undefined;
    cache.resume = undefined;
    for (const key of cache.rows.keys()) if (!cache.used.has(key)) cache.rows.delete(key);
    invalidateCommandSelectionRows();
    const selected = selectedCommandPath();
    const cached = selected ? cache.rows.get(JSON.stringify(selected)) : undefined;
    if (selected && cached) showCommandInspector({ command: cached.command, path: [...selected], actions, previewFace: cached.face, preserveSelection: true });
    else notifyCommandSelectionChanged();
  };
  cache.cancel = () => {
    cancelled = true;
    if (frame !== undefined) view?.cancelAnimationFrame(frame);
    iterator.return(undefined);
    cache.finish = undefined;
    cache.resume = undefined;
  };
  const mount = (all = false): void => {
    if (cancelled) return;
    const started = performance.now();
    let done = false;
    let count = 0;
    do {
      done = iterator.next().done === true;
      count += 1;
    } while (!done && (all || count < 80 && performance.now() - started < 8));
    if (done) complete();
    else {
      if (!cache.anchor) {
        cache.anchor = el("div", { class: "empty-hint", text: "명령 목록을 불러오는 중…", attrs: { role: "status" }, dataset: { testid: "event-command-list-loading" } });
        host.append(cache.anchor);
        host.setAttribute("aria-busy", "true");
      }
      frame = view!.requestAnimationFrame(() => {
        frame = undefined;
        if (!host.isConnected) { cache.cancel?.(); return; }
        if (host.hidden) { paused = true; return; }
        mount();
      });
    }
    options.onMount?.();
  };
  cache.resume = () => { if (paused && !cancelled) { paused = false; mount(); } };
  cache.finish = () => { if (frame !== undefined) view?.cancelAnimationFrame(frame); mount(true); };
  mount(!options.deferMount || !view?.requestAnimationFrame);
}

/** Validation navigation must be able to reach a row beyond the mounted prefix. */
export function finishCommandListMount(host: HTMLElement): void { commandRowCaches.get(host)?.finish?.(); }
export function resumeCommandListMount(host: HTMLElement): void { commandRowCaches.get(host)?.resume?.(); }

function appendCommandNode(host: HTMLElement, node: HTMLElement): void {
  const cache = commandRowCaches.get(host)!;
  if (cache.reconcile) {
    const cursor = cache.cursor;
    if (cursor && node === cursor) { cache.cursor = cursor.nextSibling; return; }
    // Same-path replacements leave unaffected siblings mounted and focused.
    if (cursor instanceof HTMLElement && (
      node.dataset.cmdPath && cursor.dataset.cmdPath === node.dataset.cmdPath
      || node.dataset.containerPath && cursor.dataset.containerPath === node.dataset.containerPath && cursor.dataset.testid === node.dataset.testid
    )) {
      cache.cursor = cursor.nextSibling;
      host.replaceChild(node, cursor);
    } else host.insertBefore(node, cursor ?? null);
  } else if (cache.anchor) host.insertBefore(node, cache.anchor);
  else host.append(node);
}

function* renderCommandTree(
  host: HTMLElement,
  cmd: Command,
  path: number[],
  containerPath: number[],
  actions: CommandListActions,
  depth: number,
  faceState: FaceState,
  options: CommandListRenderOptions
): Generator<void> {
  const key = JSON.stringify(path);
  const cache = commandRowCaches.get(host)!;
  cache.used.add(key);
  const cached = cache.rows.get(key);
  const issues = options.issuesByPath?.get(key) ?? [];
  if (cached && cached.command === cmd && cached.options.pickerContext === options.pickerContext && jsonEqual(cached.face, faceState.current) && jsonEqual(cached.issues, issues)) {
    // Event handlers read this render-options object; refresh its root command tree
    // so Copy/Select All never retain the tree from before an immutable reorder.
    Object.assign(cached.options, options);
    appendCommandNode(host, cached.row);
  } else {
    const rowOptions = { ...options };
    const row = renderCommandItem(cmd, path, containerPath, actions, depth, faceState, rowOptions);
    cache.rows.set(key, { command: cmd, row, face: faceState.current, issues, options: rowOptions });
    appendCommandNode(host, row);
  }
  yield;
  if (cmd.kind === "changeFace") {
    faceState.current = cmd.resourceId ? {
      resourceId: cmd.resourceId,
      position: cmd.position,
      flipHorizontally: cmd.flipHorizontally,
    } : undefined;
  }
  yield* appendCommandChildren(host, cmd, path, containerPath, actions, depth, faceState, options);
}

function renderCommandItem(
  cmd: Command,
  path: number[],
  _containerPath: number[],
  actions: CommandListActions,
  depth: number,
  faceState: FaceState,
  options: CommandListRenderOptions
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
  if (cmd.kind === "m2Command" && (cmd.commandId === "m2-088-comment" || cmd.commandId.endsWith("-comment"))) {
    item.dataset.commentColor = String(cmd.fields.color ?? "green");
    item.classList.add("cmd-item-comment");
  }
  item.dataset.renderKindString = String(cmd.kind);
  // 드래그는 핸들에서 시작하고 항목 전체를 드래그한다.
  item.draggable = false;
  const head = el("div", {
    class: "cmd-head",
    // 상호작용을 그대로 적는다: 한 번 = 오른쪽 "선택한 명령" 칼럼에 싣기, 두 번 = 편집 창.
    attrs: {
      role: "button",
      tabindex: "0",
      title: "한 번 클릭하면 선택, 두 번 클릭하면 편집",
      "aria-keyshortcuts": "Enter Space",
    },
  });
  // 깊이는 item·head 양쪽에 심는다. CSS 커스텀 속성은 아래로만 상속되므로
  // head 에만 심으면 부모(.cmd-item)에서 읽는 블록 들여쓰기가 항상 폴백 0 이 된다
  // (blocks.css 의 margin-left: calc(var(--cmd-depth) * var(--blk-indent)) 가 통째로 죽었었다).
  item.style.setProperty("--cmd-depth", String(depth));
  head.style.setProperty("--cmd-depth", String(depth));
  const handle = el("span", {
    class: "cmd-drag-handle",
    dataset: { testid: "event-command-drag-handle" },
    // This is a pointer drag affordance only. It has no keyboard operation, so
    // do not expose a dead focus target to keyboard or screen-reader users.
    attrs: { title: "드래그로 순서 변경" },
    children: [renderEditorIcon("drag")],
  });
  // 핸들에서 누르면 항목을 드래그 가능하게 만든다.
  enableItemDrag(handle, item, path, actions);
  const supportBadge = renderRuntimeSupportBadge(commandRuntimeSupportDescriptor(cmd, options.pickerContext), `command-runtime-badge-list-${path.join("-")}`);
  const issueBadge = renderCommandIssueBadge(path, options.issuesByPath?.get(JSON.stringify(path)) ?? []);
  // 문장 표시 줄: 직전 changeFace 상태를 화자 얼굴 16px 크롭으로 부가.
  const activeFaceForItem = faceState.current;
  const speakerFace =
    cmd.kind === "text" && activeFaceForItem
      ? renderSummaryVisual({ type: "faceCrop", resourceId: activeFaceForItem.resourceId })
      : null;
  if (speakerFace) speakerFace.dataset.testid = "cmd-speaker-face";
  const step = commandStepLabel(path);
  const summary = el("span", {
    class: "cmd-summary",
    children: [...(speakerFace ? [speakerFace] : []), renderCommandSummary(cmd)],
  });
  head.append(
    handle,
    el("span", {
      class: "cmd-step",
      text: step,
      attrs: { "aria-hidden": "true" },
      dataset: { testid: `event-command-step-${path.join("-")}` },
    }),
    el("span", { class: "cmd-prefix", attrs: { "aria-hidden": "true" } }),
    el("span", {
      class: "cmd-cat-icon",
      attrs: { "aria-hidden": "true", title: `${categoryVisual.label} 명령` },
      dataset: { category: categoryVisual.key, glyph: categoryVisual.glyph, label: categoryVisual.label },
      children: [renderCategoryIcon(categoryVisual)],
    }),
    summary,
    ...(supportBadge ? [supportBadge] : []),
    ...(issueBadge ? [issueBadge] : []),
  );
  const openEditor = () => openCommandEditModal(cmd, path, actions, activeFaceForItem);
  // 한 번 클릭은 선택뿐이다 — 오른쪽 인스펙터 칼럼을 채우고 툴바 이동/복사의 대상을 정한다.
  // 편집 창은 더블클릭·Enter/Space·우클릭 "편집" 이 연다.
  head.addEventListener("click", () => {
    showCommandInspector({ command: cmd, path, actions, previewFace: activeFaceForItem });
  });
  // 재렌더 뒤에도 선택과 인스펙터가 유지되도록 복원한다.
  if (sameInspectorPath(path, selectedCommandPath())) {
    item.classList.add("selected");
  }
  if (isCommandSelected(path)) item.classList.add("selected");
  head.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (!isCommandSelected(path)) showCommandInspector({ command: cmd, path, actions, previewFace: activeFaceForItem });
    openCommandContextMenu({ x: event.clientX, y: event.clientY, item, command: cmd, path, actions, openEditor, pickerContext: options.pickerContext, commands: options.rootCommands });
  });
  head.addEventListener("dblclick", (event) => {
    // fakeDom 에는 Element 전역이 없다 — closest 덕타이핑으로 같은 계약을 지킨다.
    const target = event.target as { closest?: (selector: string) => unknown } | null;
    if (target?.closest?.(".cmd-actions, .cmd-drag-handle")) return;
    event.preventDefault();
    event.stopPropagation();
    openEditor();
  });
  head.addEventListener("keydown", (event) => {
    // fakeDom 에는 KeyboardEvent 생성자가 없을 수 있다 — duck-type 으로 키 이벤트를 받는다.
    if (!isKeyboardLike(event) || !isCommandActionKey(event)) return;
    if (!isCommandSelected(path)) showCommandInspector({ command: cmd, path, actions, previewFace: activeFaceForItem });
    handleCommandShortcut(event as KeyboardEvent, { x: 0, y: 0, item, command: cmd, path, actions, openEditor, pickerContext: options.pickerContext, commands: options.rootCommands });
  });
  item.append(head, commandActions(path, actions));
  ensureTerminalRowHint(item, cmd);
  // 항목 자체를 드롭 타겟으로 만들어 위/아래 삽입 위치를 결정한다.
  // 중첩 행은 항상 자기 실제 부모 컨테이너를 사용해야 같은 분기 재정렬/분기 간 이동이 작동한다.
  attachItemDropHandlers(item, path, path.slice(0, -1), actions);
  return item;
}

/**
 * 실행 순서를 줄에 적는다. 번호는 **자기 컨테이너 안에서** 1 부터 다시 시작하고,
 * 분기 안이라는 범위는 바로 위 분기 헤더 줄(`renderBranchDropLine`)이 말해 준다.
 * 경로의 마지막 칸이 항상 컨테이너 상 형제 인덱스이므로 그것만 생다 — 중간 칸을
 * 이어 붙이면 `choices` 의 `branchIndex` 가 선택지 인덱스(음수 아님)라 실행 순서가
 * 아닌 칸이 번호에 섞인다.
 */
function commandStepLabel(path: readonly number[]): string {
  return String((path[path.length - 1] ?? 0) + 1);
}

function renderCommandIssueBadge(path: readonly number[], issues: readonly EventDraftIssue[]): HTMLElement | null {
  const matches = issues;
  if (matches.length === 0) return null;
  const severity = matches.some((issue) => issue.severity === "error")
    ? "error"
    : matches.some((issue) => issue.severity === "warning")
      ? "warning"
      : "info";
  return el("span", {
    class: `event-command-issue-badge ${severity}`,
    children: [renderEditorIcon(severity === "info" ? "info" : "warning"), el("span", { text: String(matches.length) })],
    attrs: { title: matches.map((issue) => issue.message).join("\n"), "aria-label": `검사 문제 ${matches.length}개` },
    dataset: { testid: `event-command-issue-badge-${path.join("-")}`, severity },
  });
}

/** One pass per validation result, preserving order/severity/title/count. */
export function indexCommandIssues(issues: readonly EventDraftIssue[]): ReadonlyMap<string, readonly EventDraftIssue[]> {
  const index = new Map<string, EventDraftIssue[]>();
  for (const issue of issues) {
    if (!issue.commandPath) continue;
    const key = JSON.stringify(issue.commandPath);
    const matches = index.get(key) ?? [];
    matches.push(issue);
    index.set(key, matches);
  }
  return index;
}

// 표시할 수 없는 명령의 자리 표시 행. 원시값을 펼쳐 보여주고 삭제는 살린다.
function renderBrokenCommandRow(cmd: Command, path: number[], actions: CommandListActions): HTMLElement {
  const info = brokenCommandDigest(cmd);
  const item = el("div", {
    class: "cmd-item is-broken",
    dataset: {
      testid: `event-command-broken-${path.join("-")}`,
      cmdPath: JSON.stringify(path),
      commandKind: String((cmd as { kind?: unknown })?.kind ?? "unknown"),
      commandCategory: info.category,
    },
  });
  const head = el("div", {
    class: "cmd-head",
    attrs: { role: "button", tabindex: "0", title: "이 명령은 표시할 수 없어 원시값으로 보여줍니다" },
  });
  head.append(
    el("span", { class: "cmd-step", text: String((path[path.length - 1] ?? 0) + 1), attrs: { "aria-hidden": "true" } }),
    el("span", { class: "cmd-summary", text: `${info.title}: ${info.detail}` }),
  );
  const del = el("button", {
    class: "cmd-action is-danger",
    text: "삭제",
    attrs: { type: "button", "aria-label": "표시할 수 없는 명령 삭제" },
    dataset: { testid: `event-command-broken-delete-${path.join("-")}` },
    on: { click: () => actions.deleteCommand(path) },
  });
  item.append(head, del);
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
  if (visual.type === "faceCrop") return renderFaceCrop16(visual.resourceId);
  if (visual.type === "charsetSprite") return renderCharsetSprite16(visual.spriteId);
  return renderMapThumb16(visual.mapId);
}

// 낱장 얼굴 한 장을 16x16 으로 축소한다(시트 크롭 없음).
function renderFaceCrop16(resourceId: string): HTMLElement | null {
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  if (!url) return null;
  const crop = el("span", { class: "cmd-thumb cmd-thumb-face", attrs: { "aria-hidden": "true" } });
  crop.style.setProperty("background-image", `url("${url}")`);
  crop.style.setProperty("background-size", "16px 16px");
  crop.style.setProperty("background-position", "center");
  return crop;
}

// 캐릭터칩 대표 프레임(캐릭터 0, 아래, 가운데)을 높이 16px 로 크롭.
function renderCharsetSprite16(spriteId: string): HTMLElement | null {
  const asset = CHARSET_ASSETS.find((entry) => entry.textureKey === spriteId);
  if (!asset) return null;
  const crop = el("span", { class: "cmd-thumb cmd-thumb-sprite", attrs: { "aria-hidden": "true" } });
  applyCharsetFrameCrop(crop, asset.path, { characterIndex: 0, direction: "down", pattern: 1 }, 16 / CHARSET_FRAME_HEIGHT);
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
  if (kind.includes("checkpointSave")) return { testId: "checkpoint-save-editor", text: "지금 진행을 체크포인트로 저장합니다." };
  if (kind.includes("killPlayer")) return { testId: "kill-player-editor", text: "파티를 전멸시키고 게임 오버 화면을 엽니다." };
  if (kind.includes("triggerEnding")) return { testId: "trigger-ending-editor", text: "엔딩 레지스트리에서 실행할 엔딩을 고릅니다." };
  if (kind.includes("gameOver")) return { testId: "game-over-editor", text: "설정 없음. 게임 오버 화면을 엽니다." };
  if (kind.includes("returnToTitle")) return { testId: "return-to-title-editor", text: "설정 없음. 타이틀 화면으로 돌아갑니다." };
  return undefined;
}

function* appendCommandChildren(
  host: HTMLElement,
  cmd: Command,
  path: number[],
  containerPath: number[],
  actions: CommandListActions,
  depth: number,
  faceState: FaceState,
  options: CommandListRenderOptions
): Generator<void> {
  // 분기 목록·라벨·경로 칸은 `eventCommandBranches` 가 정본이다. 예전에는 여기에 명령
  // 종류별 블록이 일곱 개 늘어서 있었고, 상점 실패 분기는 상수 import 자체가 없어서
  // «주소를 못 매기는» 분기였다 — 런타임은 실행하는데 목록에는 줄이 안 났다.
  for (const branch of eventCommandBranches(cmd)) {
    const branchPath = [...path, branch.branchIndex];
    appendCommandNode(host, renderBranchDropLine(branch.label, depth, branch.tone, branchPath, actions));
    yield;
    if (branch.commands.length === 0) {
      appendCommandNode(host, renderEmptyBranchLine(depth + 1, branch.tone, branchPath, actions, options.openCommandPicker));
      yield;
    }
    for (let childIndex = 0; childIndex < branch.commands.length; childIndex += 1) {
      const child = branch.commands[childIndex]!;
      const childPath = [...path, branch.branchIndex, childIndex];
      try {
        yield* renderCommandTree(
          host,
          child,
          childPath,
          containerPath,
          actions,
          depth + 1,
          faceState,
          options
        );
      } catch (error) {
        console.error("[event-editor] failed to render branch command row", childPath, error);
        appendCommandNode(host, renderBrokenCommandRow(child, childPath, actions));
        yield;
      }
    }
    // 분기에 명령이 있어도 넣을 자리를 남긴다. 예전엔 명령 하나가 들어가면 「여기에 명령 추가」
    // 슬롯이 사라져 두 번째 명령을 넣을 곳이 없었다(2026-09-17 적대적 리뷰 P0-3).
    if (branch.commands.length > 0) {
      appendCommandNode(host, renderBranchAddLine(depth + 1, branch.tone, branchPath, actions, options.openCommandPicker));
      yield;
    }
  }
  // 「선택 끝」「분기 끝」 마커 행은 두지 않는다 — 들여쓰기와 분기 머리 행이 이미 구조를 말하고,
  // 끝 행은 정보 없이 세로 공간만 썼다(2026-09-03 제안서 §6·§8).
}

// 분기 마커 라인 (": 조건이 참일 때" 등). kind 별 클래스로 fork/choices/shop 마커를 톤으로 구분한다.
function renderMarkerLine(text: string, depth: number, kind: "fork" | "choices" | "shop"): HTMLElement {
  const line = el("div", { class: `cmd-line-marker cmd-marker-${kind}`, text, dataset: { cmdDepth: String(depth) } });
  line.style.setProperty("--cmd-depth", String(depth));
  return line;
}

function renderEmptyBranchLine(
  depth: number,
  kind: "fork" | "choices" | "shop",
  containerPath: readonly number[],
  actions: CommandListActions,
  openCommandPicker: CommandListRenderOptions["openCommandPicker"],
): HTMLElement {
  const line = el("button", {
    class: `cmd-line-marker cmd-marker-${kind} cmd-branch-empty`,
    text: branchEmptyActionLabel,
    attrs: { type: "button", title: "이 분기에 명령을 하나 넣어줍니다" },
    dataset: {
      testid: `event-command-branch-empty-${containerPath.join("-")}`,
      cmdDepth: String(depth),
      containerPath: JSON.stringify(containerPath),
    },
    on: { click: () => openCommandPicker?.(containerPath) },
  });
  line.style.setProperty("--cmd-depth", String(depth));
  ensureListDropHandlers(line, actions);
  return line;
}

/** 명령이 있는 분기의 끝 줄 — 「+ 이 분기에 명령 추가」. 빈 분기 줄과 같은 컨테이너 규칙(끝에 추가). */
function renderBranchAddLine(
  depth: number,
  kind: "fork" | "choices" | "shop",
  containerPath: readonly number[],
  actions: CommandListActions,
  openCommandPicker: CommandListRenderOptions["openCommandPicker"],
): HTMLElement {
  const line = el("button", {
    class: `cmd-line-marker cmd-marker-${kind} cmd-branch-empty cmd-branch-add`,
    text: "+ 이 분기에 명령 추가",
    attrs: { type: "button", title: "이 분기의 마지막에 명령을 하나 넣어줍니다" },
    dataset: {
      testid: `event-command-branch-add-${containerPath.join("-")}`,
      cmdDepth: String(depth),
      containerPath: JSON.stringify(containerPath),
    },
    on: { click: () => openCommandPicker?.(containerPath) },
  });
  line.style.setProperty("--cmd-depth", String(depth));
  ensureListDropHandlers(line, actions);
  return line;
}

function renderBranchDropLine(
  text: string,
  depth: number,
  kind: "fork" | "choices" | "shop",
  containerPath: readonly number[],
  actions: CommandListActions
): HTMLElement {
  const line = renderMarkerLine(text, depth, kind);
  line.classList.add("cmd-branch-drop-zone");
  line.dataset.testid = "event-command-branch-drop-zone";
  line.dataset.containerPath = JSON.stringify(containerPath);
  ensureListDropHandlers(line, actions);
  return line;
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
      children: [renderEditorIcon("arrowUp")],
      attrs: { title: "위로", "aria-label": "위로", type: "button" },
      on: { click: () => actions.moveCommand(path, -1) },
    }),
    el("button", {
      children: [renderEditorIcon("arrowDown")],
      attrs: { title: "아래로", "aria-label": "아래로", type: "button" },
      on: { click: () => actions.moveCommand(path, 1) },
    }),
    el("button", {
      children: [renderEditorIcon("trash")],
      attrs: { title: "삭제", "aria-label": "삭제", type: "button" },
      on: {
        click: (event) => {
          event.stopPropagation();
          actions.deleteCommand(path);
        },
      },
    })
  );
  return wrap;
}
function isKeyboardLike(event: Event): event is KeyboardEvent {
  if (typeof KeyboardEvent !== "undefined" && event instanceof KeyboardEvent) return true;
  return typeof (event as KeyboardEvent).key === "string";
}
