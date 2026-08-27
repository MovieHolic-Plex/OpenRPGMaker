import { newCommand } from "@/editor/eventActions";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { isContainerInsideCommand, moveCommandBetweenLists, resolveRootCommandBranchList } from "@/editor/eventCommandPaths";
import type { Command } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { renderCommandBody } from "./commandBody";
import { renderCommandPreview } from "./commandPreview";
import { createPreviewSimState, type PreviewSimState } from "./previewSimulation";
import { commandLabel } from "./commandPicker";
import { openEventSubdialog } from "./subdialog";
import type { CommandListActions } from "./types";

type EventCommandEditDialogRequest = {
  readonly title?: string;
  readonly initial: Command;
  readonly onApply: (command: Command) => void;
  // 명령 추가/편집 모두 종류 select 를 잠근다(분기 유실·내부 kind 노출 방지).
  readonly lockKind?: boolean;
  // [중간-3] 이 명령 시점의 활성 얼굴(직전 changeFace). 문장 표시 프리뷰에 반영.
  readonly previewFace?: { readonly resourceId: string; readonly faceIndex: number };
};

/** 상점은 진열·재고·옵션이 한 화면에 다 들어야 하는 특수 케이스 — 전체화면으로 연다. */
export function commandDialogWidth(command: Command): "narrow" | "wide" | "full" {
  return command.kind === "shop" ? "full" : "wide";
}

export function openEventCommandEditDialog(request: EventCommandEditDialogRequest): void {
  let stagedCommand = structuredClone(request.initial);
  openEventSubdialog({
    title: request.title ?? commandEditTitle(stagedCommand),
    testId: "event-command-edit-dialog",
    width: commandDialogWidth(stagedCommand),
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
      const previewSimState: PreviewSimState = createPreviewSimState();
      const renderPreview = () => {
        clearChildren(previewHost);
        // 새 애니메이션 표시면은 편집 본문이 재생기를 직접 갖는다. 여기서 한 번 더 그리면
        // 같은 연출이 한 모달에 둘 생긴다 — 표시면은 하나만 둔다.
        const ownsPreview = stagedCommand.kind === "showAnimation";
        previewHost.hidden = ownsPreview;
        if (ownsPreview) return;
        previewHost.append(renderCommandPreview(stagedCommand, { face: request.previewFace, simState: previewSimState }));
      };
      const renderEditor = () => {
        clearChildren(formHost);
        formHost.append(renderCommandBody({
          path: [],
          actions,
          lockKind: request.lockKind ?? true,
          previewFace: request.previewFace,
          getCurrentCommand: () => stagedCommand,
        }, stagedCommand));
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

      const footer: HTMLElement[] = [];
      if (stagedCommand.kind === "shop") {
        footer.push(createShopPreviewFooterToggle(editor));
      }
      footer.push(ok, cancel);

      editor.append(
        el("div", {
          class: "event-command-edit-columns",
          children: [formHost, previewHost],
        }),
        el("div", {
          class: "event-command-edit-actions",
          children: footer,
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

function commandContainer(rootCommand: Command, containerPath: readonly number[]): Command[] | null {
  return resolveRootCommandBranchList(rootCommand, containerPath, { missingBranches: "create" });
}

export function openNewEventCommandDialog(command: Command, onApply: (command: Command) => void): void {
  openEventCommandEditDialog({
    initial: command,
    title: commandEditTitle(command),
    lockKind: true,
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
  if (prev.kind === "inn" && next.kind === "inn") {
    return Boolean(prev.branchOnNotEnoughGold) !== Boolean(next.branchOnNotEnoughGold);
  }
  if (prev.kind === "battleProcessing" && next.kind === "battleProcessing") {
    return (
      Boolean(prev.branchOnResult) !== Boolean(next.branchOnResult)
      || (prev.troopSource ?? "fixed") !== (next.troopSource ?? "fixed")
    );
  }
  if (prev.kind === "choices" && next.kind === "choices") {
    return (
      (prev.cancelBehavior ?? "choice2") !== (next.cancelBehavior ?? "choice2") ||
      prev.options.length !== next.options.length
    );
  }
  if (prev.kind === "wait" && next.kind === "wait") {
    return Boolean(prev.variableId?.trim()) !== Boolean(next.variableId?.trim());
  }
  if (prev.kind === "inputNumber" && next.kind === "inputNumber") {
    // 자릿수 칩 active / 키패드 토글 등 폼 구조 동기화.
    return prev.digits !== next.digits || Boolean(prev.showPad) !== Boolean(next.showPad);
  }
  if (prev.kind === "runControl" && next.kind === "runControl") {
    return prev.action !== next.action;
  }
  if (prev.kind === "fork" && next.kind === "fork") {
    return (
      prev.condition.kind !== next.condition.kind ||
      (prev.condition.kind === "run" && next.condition.kind === "run" && prev.condition.query !== next.condition.query) ||
      Boolean(prev.else) !== Boolean(next.else) ||
      prev.then.length !== next.then.length ||
      (prev.else?.length ?? 0) !== (next.else?.length ?? 0)
    );
  }
  if (prev.kind === "loop" && next.kind === "loop") {
    return prev.body.length !== next.body.length;
  }
  if (prev.kind === "setSwitch" && next.kind === "setSwitch") {
    // 값 종류(상수/전환/변수)가 바뀌면 변수 피커 노출이 달라지므로 폼을 다시 그린다.
    const prevKind = typeof prev.value === "object" && prev.value !== null
      ? "variable"
      : prev.value === "toggle"
        ? "toggle"
        : "literal";
    const nextKind = typeof next.value === "object" && next.value !== null
      ? "variable"
      : next.value === "toggle"
        ? "toggle"
        : "literal";
    return prevKind !== nextKind;
  }
  if (prev.kind === "setVariable" && next.kind === "setVariable") {
    // 값 소스(숫자/변수) 또는 연산이 바뀌면 폼/미리보기 구조를 다시 맞춘다.
    const prevSource = typeof prev.value === "number" ? "number" : "variable";
    const nextSource = typeof next.value === "number" ? "number" : "variable";
    return prevSource !== nextSource || prev.op !== next.op;
  }
  if (prev.kind === "changeGold" && next.kind === "changeGold") {
    const prevSource = typeof prev.amount === "number" ? "number" : "variable";
    const nextSource = typeof next.amount === "number" ? "number" : "variable";
    return prevSource !== nextSource || prev.op !== next.op;
  }
  if (prev.kind === "changeExp" && next.kind === "changeExp") {
    const prevSource = typeof prev.amount === "number" ? "number" : "variable";
    const nextSource = typeof next.amount === "number" ? "number" : "variable";
    const prevTarget = !prev.actorId || prev.actorId === "party" || prev.actorId === "all" ? "party" : "actor";
    const nextTarget = !next.actorId || next.actorId === "party" || next.actorId === "all" ? "party" : "actor";
    return prevSource !== nextSource || prev.op !== next.op || prevTarget !== nextTarget;
  }
  if (prev.kind === "learnSkill" && next.kind === "learnSkill") {
    const prevAction = prev.action === "forget" ? "forget" : "learn";
    const nextAction = next.action === "forget" ? "forget" : "learn";
    const prevTarget = !prev.actorId || prev.actorId === "party" || prev.actorId === "all" ? "party" : "actor";
    const nextTarget = !next.actorId || next.actorId === "party" || next.actorId === "all" ? "party" : "actor";
    return prevAction !== nextAction || prevTarget !== nextTarget || prev.skillId !== next.skillId;
  }
  if (prev.kind === "changeItem" && next.kind === "changeItem") {
    const prevSource = typeof prev.amount === "number" ? "number" : "variable";
    const nextSource = typeof next.amount === "number" ? "number" : "variable";
    return prevSource !== nextSource || prev.op !== next.op || prev.itemId !== next.itemId;
  }
  return false;
}
