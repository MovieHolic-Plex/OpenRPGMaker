import { isContainerInsideCommand, moveCommandBetweenLists, resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { openNewEventCommandDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { openEventCommandPicker } from "@/editor/panels/eventEditor/commandPicker";
import type { CommandRuntimeSupport } from "@/project/eventCommands/runtimeSupport";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import type { CommandListActions } from "./eventEditor/types";

export type DatabaseCommandArrayAdapter = {
  readonly commands: Command[];
  readonly replaceCommands: (commands: Command[]) => void;
  readonly rerender?: () => void;
  readonly runtimeSupport?: (command: Command) => CommandRuntimeSupport;
};

export function createDatabaseCommandListActions(adapter: DatabaseCommandArrayAdapter): CommandListActions {
  // coalesceKey 가 주어지면(예: 명령 본문 필드 편집) 커밋 단위로 스냅샷을 병합하고,
  // 없으면(추가/삭제/재정렬 등 이산 편집) 매번 스냅샷을 남긴다. DB 호스트 명령 리스트
  // (공용 이벤트/전투 이벤트)는 draft 가 아닌 실제 store 를 바로 바꾸므로 undo 대상이다.
  const edit = (mutate: (commands: Command[]) => void, options: { rerender?: boolean; coalesceKey?: string } = {}): void => {
    const { rerender = true, coalesceKey } = options;
    if (coalesceKey !== undefined) recordCoalescedSnapshot(`db-command:${coalesceKey}`);
    else recordProjectSnapshot();
    const next = structuredClone(adapter.commands);
    mutate(next);
    adapter.replaceCommands(next);
    if (rerender) adapter.rerender?.();
  };
  const commandList = (commands: Command[], containerPath: readonly number[]): Command[] | null =>
    resolveCommandListAtPath(commands, containerPath, { missingBranches: "create" });
  return {
    addCommand: (containerPath, command) => edit((commands) => {
      commandList(commands, containerPath)?.push(structuredClone(command));
    }),
    insertCommand: (path, command) => edit((commands) => {
      const index = path[path.length - 1];
      const list = commandList(commands, path.slice(0, -1));
      if (!list || index === undefined) return;
      list.splice(Math.max(0, Math.min(list.length, index)), 0, structuredClone(command));
    }),
    replaceCommand: (path, command) => edit((commands) => {
      const index = path[path.length - 1];
      const list = commandList(commands, path.slice(0, -1));
      if (!list || index === undefined) return;
      list[index] = structuredClone(command);
    }, { rerender: false, coalesceKey: path.join(",") }),
    deleteCommand: (path) => edit((commands) => {
      const index = path[path.length - 1];
      const list = commandList(commands, path.slice(0, -1));
      if (!list || index === undefined) return;
      list.splice(index, 1);
    }),
    moveCommand: (path, dir) => edit((commands) => {
      const fromIndex = path[path.length - 1];
      const list = commandList(commands, path.slice(0, -1));
      if (!list || fromIndex === undefined) return;
      const toIndex = fromIndex + dir;
      const moving = list[fromIndex];
      if (!moving || toIndex < 0 || toIndex >= list.length) return;
      list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moving);
    }),
    moveCommandTo: (sourcePath, toIndex) => edit((commands) => {
      const fromIndex = sourcePath[sourcePath.length - 1];
      const list = commandList(commands, sourcePath.slice(0, -1));
      if (!list || fromIndex === undefined) return;
      const clamped = Math.max(0, Math.min(list.length - 1, toIndex));
      const moving = list[fromIndex];
      if (!moving || clamped === fromIndex) return;
      list.splice(fromIndex, 1);
      list.splice(clamped, 0, moving);
    }),
    // [P2] 크로스 컨테이너 이동 (공용/전투 이벤트 명령 리스트).
    moveCommandAcross: (sourcePath, targetContainerPath, toIndex) => {
      if (isContainerInsideCommand(sourcePath, targetContainerPath)) return;
      edit((commands) => {
        const targetList = commandList(commands, targetContainerPath);
        const sourceList = commandList(commands, sourcePath.slice(0, -1));
        const fromIndex = sourcePath[sourcePath.length - 1];
        if (!targetList || !sourceList || fromIndex === undefined) return;
        moveCommandBetweenLists(sourceList, fromIndex, targetList, toIndex);
      });
    },
  };
}

export function renderDatabaseCommandListEditor(host: HTMLElement, adapter: DatabaseCommandArrayAdapter): void {
  const actions = createDatabaseCommandListActions(adapter);
  renderCommandList(host, adapter.commands, [], actions, { runtimeSupport: adapter.runtimeSupport });
  if (host.firstElementChild?.classList.contains("empty-hint")) host.firstElementChild.remove();
  host.append(renderEmptyCommandLine(actions));
  host.addEventListener("dblclick", (event) => {
    if (event.target !== host) return;
    host.querySelector<HTMLElement>('[data-testid="event-command-empty-line"]')?.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, cancelable: true })
    );
  });
}

function renderEmptyCommandLine(actions: CommandListActions): HTMLElement {
  const openPicker = () => {
    if (document.querySelector('[data-testid="event-command-picker"]')) return;
    openEventCommandPicker({
      title: "공통 이벤트 명령",
      onSelect: (command, closePicker) => {
        openNewEventCommandDialog(command, (editedCommand) => {
          actions.addCommand([], editedCommand);
          closePicker();
        });
        return { closePicker: false };
      },
    });
  };
  return el("button", {
    class: "cmd-empty-line",
    text: "◆",
    attrs: { type: "button", title: "더블클릭해서 공통 이벤트 명령을 추가" },
    dataset: { testid: "event-command-empty-line" },
    on: {
      dblclick: openPicker,
      keydown: (event) => {
        if (event instanceof KeyboardEvent && event.key === "Enter") {
          event.preventDefault();
          openPicker();
        }
      },
    },
  });
}
