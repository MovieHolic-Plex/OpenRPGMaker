import { el } from "@/util/dom";
import { buildFollowerPresets, followerPresetToCommands } from "@/editor/followerPresets";
import { store } from "@/project/store";
import type { ActorRecord, Command } from "@/project/types";
import { companionPortraitElement } from "./companionRoster";

const TESTID_SAFE = /[^a-z0-9-]/gi;

export type FollowerPresetInsertHost = {
  insertCommandsAt: (index: number, commands: readonly Command[]) => void;
  commandCount: () => number;
};

export function renderFollowerPresetBar(host: FollowerPresetInsertHost): HTMLElement {
  // 기본 접힘(<details> open 없음) — 커맨드 툴바 밀도를 낮춘다.
  const bar = el("details", {
    class: "event-editor-follower-preset-bar",
    dataset: { testid: "follower-preset-bar" },
  });
  const summary = el("summary", {
    class: "event-editor-follower-preset-summary",
    text: "따라오기 프리셋",
  });
  const chips = el("div", { class: "event-editor-follower-preset-chips" });
  const project = store.getCurrent();
  const actorsById = new Map<string, ActorRecord>(project.database.actors.map((actor) => [actor.id, actor]));
  const presets = buildFollowerPresets();
  for (const p of presets) {
    const actor = p.kind === "actor" ? actorsById.get(p.refId) : undefined;
    const children: HTMLElement[] = [];
    if (actor) {
      children.push(
        companionPortraitElement(project, actor, { sizePx: 20, testidPrefix: "follower-preset-thumb" }),
      );
    }
    const btn = el("button", {
      class: `btn btn-sm follower-preset-chip follower-preset-chip--${p.kind}`,
      text: p.label,
      attrs: { title: `${p.description} — ${p.hint}` },
      dataset: { testid: `follower-preset-chip-${p.id.replace(TESTID_SAFE, "-")}` },
      children,
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
    text: "원하는 펫/동행자를 누르면 이벤트 끝에 커맨드가 추가됩니다.",
  });
  bar.append(summary, chips, note);
  return bar;
}
