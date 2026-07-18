import { newCommand } from "@/editor/eventActions";
import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
import { isContainerInsideCommand, moveCommandBetweenLists, resolveRootCommandBranchList } from "@/editor/eventCommandPaths";
import type { Command } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { renderCommandBody } from "./commandBody";
import { renderCommandPreview } from "./commandPreview";
import { commandLabel } from "./commandPicker";
import { openEventSubdialog } from "./subdialog";
import type { CommandListActions } from "./types";

type EventCommandEditDialogRequest = {
  readonly title?: string;
  readonly initial: Command;
  readonly onApply: (command: Command) => void;
  // 기존 명령 편집이면 종류 select 를 잠근다(분기 유실 방지). 새 명령 추가는 false.
  readonly lockKind?: boolean;
  // [중간-3] 이 명령 시점의 활성 얼굴(직전 changeFace). 문장 표시 프리뷰에 반영.
  readonly previewFace?: { readonly resourceId: string; readonly faceIndex: number };
};

export function openEventCommandEditDialog(request: EventCommandEditDialogRequest): void {
  let stagedCommand = structuredClone(request.initial);
  openEventSubdialog({
    title: request.title ?? commandEditTitle(stagedCommand),
    testId: "event-command-edit-dialog",
    width: "wide",
    render: (body, close) => {
      const editor = el("div", {
        class: "event-command-edit-dialog",
        dataset: { testid: "event-command-edit-form" },
      });
      const formHost = el("div", { class: "event-command-edit-body" });
      const previewHost = el("div", {
        class: "event-command-preview-panel",
        dataset: { testid: "event-command-preview" },
      });
      const renderPreview = () => {
        clearChildren(previewHost);
        previewHost.append(renderCommandPreview(stagedCommand, { face: request.previewFace }));
      };
      const renderEditor = () => {
        clearChildren(formHost);
        formHost.append(renderCommandBody({ path: [], actions, lockKind: request.lockKind ?? false }, stagedCommand));
        renderPreview();
      };
      const actions: CommandListActions = {
        addCommand: (containerPath, command) => {
          const list = commandContainer(stagedCommand, containerPath);
          if (!list) return;
          list.push(structuredClone(command));
          renderEditor();
        },
        insertCommand: (path, command) => {
          const containerPath = path.slice(0, -1);
          const insertIndex = path[path.length - 1] ?? 0;
          const list = commandContainer(stagedCommand, containerPath);
          if (!list) return;
          list.splice(insertIndex, 0, structuredClone(command));
          renderEditor();
        },
        replaceCommand: (path, command) => {
          if (path.length === 0) {
            // 같은 종류의 단순 필드 편집이면 폼을 재빌드하지 않고 프리뷰만 갱신(입력 포커스 보존).
            // 상점 아이템 목록/분기 토글처럼 폼 DOM 구조가 바뀌는 경우는 재빌드한다.
            const prev = stagedCommand;
            stagedCommand = structuredClone(command);
            if (shouldRerenderCommandForm(prev, stagedCommand)) renderEditor();
            else renderPreview();
            return;
          }
          const containerPath = path.slice(0, -1);
          const replaceIndex = path[path.length - 1];
          if (replaceIndex === undefined) return;
          const list = commandContainer(stagedCommand, containerPath);
          if (!list) return;
          const prev = list[replaceIndex];
          list[replaceIndex] = structuredClone(command);
          if (!prev || shouldRerenderCommandForm(prev, list[replaceIndex]!)) renderEditor();
          else renderPreview();
        },
        deleteCommand: (path) => {
          const containerPath = path.slice(0, -1);
          const deleteIndex = path[path.length - 1];
          if (deleteIndex === undefined) return;
          const list = commandContainer(stagedCommand, containerPath);
          if (!list) return;
          list.splice(deleteIndex, 1);
          renderEditor();
        },
        moveCommand: (path, dir) => {
          const containerPath = path.slice(0, -1);
          const fromIndex = path[path.length - 1];
          if (fromIndex === undefined) return;
          const list = commandContainer(stagedCommand, containerPath);
          if (!list) return;
          const toIndex = fromIndex + dir;
          if (toIndex < 0 || toIndex >= list.length) return;
          const moving = list[fromIndex];
          if (!moving) return;
          list.splice(fromIndex, 1);
          list.splice(toIndex, 0, moving);
          renderEditor();
        },
        moveCommandTo: (sourcePath, toIndex) => {
          const containerPath = sourcePath.slice(0, -1);
          const fromIndex = sourcePath[sourcePath.length - 1];
          if (fromIndex === undefined) return;
          const list = commandContainer(stagedCommand, containerPath);
          const moving = list?.[fromIndex];
          if (!list || !moving || toIndex < 0 || toIndex >= list.length) return;
          list.splice(fromIndex, 1);
          list.splice(toIndex, 0, moving);
          renderEditor();
        },
        // [P2] 스테이징된 루트 명령 안에서의 크로스 컨테이너 이동(선택지 가지 간 등).
        moveCommandAcross: (sourcePath, targetContainerPath, toIndex) => {
          if (isContainerInsideCommand(sourcePath, targetContainerPath)) return;
          const targetList = commandContainer(stagedCommand, targetContainerPath);
          const sourceList = commandContainer(stagedCommand, sourcePath.slice(0, -1));
          const fromIndex = sourcePath[sourcePath.length - 1];
          if (!targetList || !sourceList || fromIndex === undefined) return;
          if (moveCommandBetweenLists(sourceList, fromIndex, targetList, toIndex)) renderEditor();
        },
      };
      const ok = el("button", {
        class: "event-command-edit-action primary",
        text: "확인",
        attrs: { type: "button" },
        dataset: { testid: "event-command-edit-ok" },
        on: {
          click: () => {
            commitPendingControls(editor);
            request.onApply(structuredClone(stagedCommand));
            close();
          },
        },
      });
      const cancel = el("button", {
        class: "event-command-edit-action",
        text: "취소",
        attrs: { type: "button" },
        dataset: { testid: "event-command-edit-cancel" },
        on: { click: close },
      });

      const footerChildren: HTMLElement[] = [];
      if (stagedCommand.kind === "shop") {
        footerChildren.push(createShopPreviewFooterToggle(editor));
      }
      footerChildren.push(ok, cancel);

      editor.append(
        el("div", {
          class: "event-command-edit-columns",
          children: [formHost, previewHost],
        }),
        el("div", {
          class: "event-command-edit-actions",
          children: footerChildren,
        }),
      );
      body.append(editor);
      renderEditor();
      if (stagedCommand.kind === "shop") {
        queueMicrotask(() => setShopPreviewCollapsed(editor, true));
      }
    },
  });
}

function createShopPreviewFooterToggle(editor: HTMLElement): HTMLElement {
  const button = el("button", {
    class: "event-command-edit-action shop-preview-toggle",
    text: "미리보기",
    attrs: { type: "button", "aria-pressed": "false", title: "상점 미리보기 열기/닫기" },
    dataset: { testid: "shop-preview-toggle" },
  }) as HTMLButtonElement;
  button.addEventListener("click", () => {
    const columns = editor.querySelector(".event-command-edit-columns");
    const open = !(columns?.classList.contains("is-shop-preview-open") ?? false);
    setShopPreviewCollapsed(editor, !open);
    button.setAttribute("aria-pressed", open ? "true" : "false");
    button.textContent = open ? "미리보기 닫기" : "미리보기";
  });
  return button;
}

function setShopPreviewCollapsed(from: HTMLElement, collapsed: boolean): void {
  const columns = from.querySelector(".event-command-edit-columns");
  if (!(columns instanceof HTMLElement) || typeof columns.classList?.toggle !== "function") return;
  columns.classList.toggle("is-shop-preview-open", !collapsed);
  columns.classList.toggle("shop-preview-collapsed", collapsed);
}

function commitPendingControls(root: HTMLElement): void {
  const controls = root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    "input, select, textarea"
  );
  for (const control of [...controls]) {
    if (control.dataset.commandKindSelect === "true") continue;
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function commandContainer(rootCommand: Command, containerPath: readonly number[]): Command[] | null {
  return resolveRootCommandBranchList(rootCommand, containerPath, { missingBranches: "create" });
}

export function openNewEventCommandDialog(command: Command, onApply: (command: Command) => void): void {
  openEventCommandEditDialog({
    initial: command,
    title: commandEditTitle(command),
    onApply,
  });
}

export function openNewEventCommandKindDialog(kind: Command["kind"], onApply: (command: Command) => void): void {
  openNewEventCommandDialog(newCommand(kind), onApply);
}

function commandEditTitle(command: Command): string {
  if (command.kind === "m2Command") return m2CommandById(command.commandId)?.label ?? command.commandId;
  return commandLabel(command.kind);
}

/** 종류 변경 또는 폼 DOM 구조가 바뀌는 필드 변경이면 true — 프리뷰-only 갱신으로는 부족. */
export function shouldRerenderCommandForm(prev: Command, next: Command): boolean {
  if (prev.kind !== next.kind) return true;
  if (prev.kind === "shop" && next.kind === "shop") {
    return (
      Boolean(prev.branchOnTransaction) !== Boolean(next.branchOnTransaction) ||
      prev.itemIds.length !== next.itemIds.length ||
      prev.itemIds.some((id, index) => id !== next.itemIds[index])
    );
  }
  if (prev.kind === "choices" && next.kind === "choices") {
    return (
      (prev.cancelBehavior ?? "choice2") !== (next.cancelBehavior ?? "choice2") ||
      prev.options.length !== next.options.length
    );
  }
  if (prev.kind === "inputNumber" && next.kind === "inputNumber") {
    // 자릿수 칩 active / 키패드 토글 등 폼 구조 동기화.
    return prev.digits !== next.digits || Boolean(prev.showPad) !== Boolean(next.showPad);
  }
  return false;
}
