import { store } from "@/project/store";
import type { Command, FieldSpawnDef } from "@/project/types";
import { el } from "@/util/dom";
import { recordPickerWithPreview } from "./recordPicker";
import type { CommandEditContext } from "./types";

/** Only the fields checked by event draft validation; other spawn authoring data stays intact. */
export function fieldSpawnBody(context: CommandEditContext, command: Extract<Command, { kind: "spawnFieldEnemy" }>): HTMLElement {
  let draft = command;
  const update = (edit: (spawn: FieldSpawnDef) => FieldSpawnDef): void => {
    const latest = context.getCurrentCommand?.();
    const current = latest?.kind === "spawnFieldEnemy" ? latest : draft;
    const spawn = edit(current.spawn);
    if (spawn === current.spawn) return;
    draft = { ...current, spawn };
    context.actions.replaceCommand(context.path, draft);
  };
  const project = store.getCurrent();
  const row = (label: string, control: HTMLElement) => el("label", {
    class: "inline-field", children: [el("span", { text: label }), control],
  });
  const troop = recordPickerWithPreview({ records: project.database.troops, selectedId: command.spawn.troopId,
    placeholder: "적 그룹 선택", testid: "event-command-spawn-troop",
    onChange: troopId => update(spawn => ({ ...spawn, troopId })),
  });
  const killSwitch = recordPickerWithPreview({ records: project.switches, selectedId: command.spawn.onKillSwitchId ?? "",
    placeholder: "사용 안 함", testid: "event-command-spawn-switch",
    onChange: id => update(spawn => {
      const { onKillSwitchId: _previous, ...rest } = spawn;
      return id ? { ...rest, onKillSwitchId: id } : rest;
    }),
  });
  const graphic = el("input", { attrs: { type: "text", placeholder: "비우면 기본 그래픽" },
    value: command.spawn.graphic?.sprite?.id ?? "", dataset: { testid: "event-command-spawn-graphic" },
  });
  graphic.addEventListener("change", () => update(spawn => {
    const id = graphic.value.trim();
    if (id === (spawn.graphic?.sprite?.id ?? "")) return spawn;
    const { sprite: _previous, ...presentation } = spawn.graphic ?? {};
    return { ...spawn, graphic: id ? { ...presentation, sprite: {
      type: project.assets.uploaded[id] ? "uploaded" : "bundled", id,
    } } : presentation };
  }));
  const wrap = el("div", { class: "rich-command-form cream-command-form", dataset: { testid: "event-command-spawn-form" },
    children: [row("적 그룹", troop.root), row("처치 스위치 (선택)", killSwitch.root), row("그래픽 리소스 ID (선택)", graphic)],
  });
  for (const [key, label] of [["x", "영역 X"], ["y", "영역 Y"], ["w", "영역 너비"], ["h", "영역 높이"]] as const) {
    const input = el("input", { attrs: { type: "number", step: "1", required: "" }, value: command.spawn.area[key],
      dataset: { testid: `event-command-spawn-area-${key}` },
    });
    input.addEventListener("change", () => {
      const value = input.valueAsNumber;
      if (!Number.isInteger(value)) { input.reportValidity(); return; }
      update(spawn => ({ ...spawn, area: { ...spawn.area, [key]: value } }));
    });
    wrap.append(row(label, input));
  }
  return wrap;
}
