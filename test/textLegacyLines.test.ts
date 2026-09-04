// @vitest-environment happy-dom
// elder_2 회귀: DB에 남은 레거시 text 명령({kind:"text", lines:[...]})이
// 이벤트 편집기 렌더를 터뜨렸다 (Cannot read properties of undefined (reading 'replace')).
import { describe, expect, it } from "vitest";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { renderStoryboard } from "@/editor/panels/eventEditor/storyboardView";
import { rewriteLegacyAdvancedDialogueInProject, textBodyOf } from "@/project/io/rewriteLegacyDialogue";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent } from "@/project/types";

function legacyTextCommand(): Command {
  return {
    kind: "text",
    lines: ["자네 덕분에 마을의 환자들이 안정을 찾았다네. 정말 고맙네!", "경비병에게도 자네의 통행을 허가하도록 일러두었네."],
  } as unknown as Command;
}

describe("legacy text command with lines (elder_2)", () => {
  it("reads the lines content through textBodyOf", () => {
    expect(textBodyOf(legacyTextCommand())).toBe(
      "자네 덕분에 마을의 환자들이 안정을 찾았다네. 정말 고맙네!\n경비병에게도 자네의 통행을 허가하도록 일러두었네.",
    );
    expect(textBodyOf({ kind: "text", body: "허허." } as Command)).toBe("허허.");
  });

  it("normalizes lines to body on load", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("blank project has no start map");
    const event: GameEvent = {
      id: "ev-elder-2",
      x: 10,
      y: 8,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "p0",
          name: "기본_대화",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [legacyTextCommand()],
        },
      ],
    };
    map.events.push(event);
    expect(rewriteLegacyAdvancedDialogueInProject(project)).toBe(true);
    const normalized = event.pages?.[0]?.commands[0];
    expect(normalized?.kind).toBe("text");
    if (normalized?.kind === "text") expect(normalized.body).toContain("자네 덕분에");
  });

  it("summarizes without throwing", () => {
    expect(() => commandSummary(legacyTextCommand())).not.toThrow();
    expect(commandSummary(legacyTextCommand())).toContain("자네 덕분에");
  });

  it("renders a storyboard card without throwing", () => {
    const host = renderStoryboard([legacyTextCommand()]);
    document.body.append(host);
    try {
      const card = host.querySelector(".event-storyboard-card");
      expect(card).not.toBeNull();
      expect(card?.textContent ?? "").toContain("자네 덕분에");
    } finally {
      host.remove();
    }
  });

  it("keeps normal body-shaped text identical", () => {
    const normal: Command = { kind: "text", speaker: "장로", body: "허허, 새로운 여행자로군." };
    expect(commandSummary(normal)).toContain("허허");
  });
});
