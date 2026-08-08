import { el } from "@/util/dom";
import { buildFollowerPresets, followerPresetToCommands } from "@/editor/followerPresets";
import type { Command } from "@/project/types";

export type FollowerPresetInsertHost = {
  insertCommandsAt: (index: number, commands: readonly Command[]) => void;
  commandCount: () => number;
};

export function renderFollowerPresetBar(host: FollowerPresetInsertHost): HTMLElement {
  const bar = el("div", {
    class: "event-editor-follower-preset-bar",
    dataset: { testid: "follower-preset-bar" },
  });
  const label = el("div", {
    class: "event-editor-follower-preset-label",
    text: "따라오기 프리셋",
  });
  const chips = el("div", { class: "event-editor-follower-preset-chips" });
  const presets = buildFollowerPresets();
  for (const p of presets) {
    const btn = el("button", {
      class: `btn btn-sm follower-preset-chip follower-preset-chip--${p.kind}`,
      text: p.label,
      attrs: { title: `${p.description} — ${p.hint}` },
      dataset: { testid: `follower-preset-${p.id.replace(/[^a-z0-9-]/gi, "-")}` },
      on: {
        click: () => {
          const cmds = followerPresetToCommands(p);
          const at = host.commandCount();
          host.insertCommandsAt(at, cmds);
        },
      },
    });
    chips.append(btn);
  }
  const note = el("div", {
    class: "empty-hint follower-preset-note",
    text: "원하는 펫/동행자를 누르면 이벤트 끝에 커맨드가 추가됩니다. 몬스터는 파티 편입 후 자동 줄서기 됩니다.",
  });
  bar.append(label, chips, note);
  return bar;
}
