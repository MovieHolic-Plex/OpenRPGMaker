/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDatabaseCommandListEditor } from "@/editor/panels/databaseCommandListAdapter";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { clearCommandInspector, selectedCommandPath, setCommandInspectorHost } from "@/editor/panels/eventEditor/commandInspector";
import { copyEventCommandsToClipboard } from "@/editor/panels/eventEditor/commandClipboard";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";

beforeEach(() => { store.replaceProject(createBlankProject()); resetMapEditHistory(); setCommandInspectorHost(undefined); clearCommandInspector(); });
afterEach(() => { clearCommandInspector(); document.body.replaceChildren(); resetMapEditHistory(); });

describe.each(["common", "troop"] as const)("%s command host", pickerContext => {
  it("deletes Select All as one host transaction with its existing global history", () => {
    let commands: Command[] = [{ kind: "text", body: "one" }, { kind: "loop", body: [{ kind: "text", body: "nested" }] }];
    let replacements = 0;
    const host = document.createElement("div");
    document.body.append(host);
    renderDatabaseCommandListEditor(host, { commands, pickerContext, replaceCommands: next => { commands = next; replacements++; } });
    const head = host.querySelector<HTMLElement>(".cmd-head")!;
    head.click();
    head.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true }));
    head.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect(commands).toEqual([]);
    expect(replacements).toBe(1);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(selectedCommandPath()).toBeUndefined();
  });
  it("pastes a nested clipboard batch once with independent clones", () => {
    const copied: Command[] = [{ kind: "loop", body: [{ kind: "text", body: "nested" }] }, { kind: "text", body: "tail" }];
    copyEventCommandsToClipboard(copied);
    let commands: Command[] = [{ kind: "text", body: "existing" }];
    let replacements = 0;
    const host = document.createElement("div");
    document.body.append(host);
    renderDatabaseCommandListEditor(host, { commands, pickerContext, replaceCommands: next => { commands = next; replacements++; } });
    host.querySelector<HTMLElement>(".cmd-head")!.dispatchEvent(new KeyboardEvent("keydown", { key: "v", ctrlKey: true, bubbles: true }));
    // 붙여넣기는 행 **바로 아래** — 「+ 명령」과 같은 자리 규칙(2026-09-18).
    expect(commands).toEqual([{ kind: "text", body: "existing" }, ...copied]);
    expect(commands[0]).not.toBe(copied[0]);
    expect(replacements).toBe(1);
  });
});
