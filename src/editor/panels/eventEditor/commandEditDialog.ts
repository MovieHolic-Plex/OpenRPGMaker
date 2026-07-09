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
            // 같은 종류의 필드 편집이면 폼을 재빌드하지 않고 프리뷰만 갱신(입력 포커스 보존).
            const structural = stagedCommand.kind !== command.kind;
            stagedCommand = structuredClone(command);
            if (structural) renderEditor();
            else renderPreview();
            return;
          }
          const containerPath = path.slice(0, -1);
          const replaceIndex = path[path.length - 1];
          if (replaceIndex === undefined) return;
          const list = commandContainer(stagedCommand, containerPath);
          if (!list) return;
          const structural = list[replaceIndex]?.kind !== command.kind;
          list[replaceIndex] = structuredClone(command);
          if (structural) renderEditor();
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

      editor.append(
        el("div", {
          class: "event-command-edit-columns",
          children: [formHost, previewHost],
        }),
        el("div", {
          class: "event-command-edit-actions",
          children: [ok, cancel],
        })
      );
      body.append(editor);
      renderEditor();
    },
  });
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
