import { describe, expect, it } from "vitest";
import { buildPaletteEntries, movePaletteIndex } from "@/editor/panels/commandPalette";
import type { EditorCommand } from "@/editor/commandRegistry";

function cmd(id: string, label: string): EditorCommand {
  return { id, label, category: "도구", keywords: [label], run: () => {} };
}

describe("buildPaletteEntries", () => {
  it("명령 → 맵 순으로 합치고 종류별 상한을 지킨다", () => {
    const commands = Array.from({ length: 10 }, (_, i) => cmd(`c${i}`, `명령${i}`));
    const maps = Array.from({ length: 10 }, (_, i) => cmd(`m${i}`, `맵${i}`));
    const entries = buildPaletteEntries("", { commands, maps });
    expect(entries.filter((e) => e.kind === "command")).toHaveLength(6);
    expect(entries.filter((e) => e.kind === "map")).toHaveLength(4);
    expect(entries[0]!.kind).toBe("command");
  });

  it("질의가 명령과 맵을 함께 거른다", () => {
    const entries = buildPaletteEntries("맵3", {
      commands: [cmd("c1", "명령1")],
      maps: [cmd("m3", "맵3"), cmd("m4", "맵4")],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe("m3");
  });
});

describe("movePaletteIndex", () => {
  it("순환 이동한다", () => {
    expect(movePaletteIndex(3, 0, 1)).toBe(1);
    expect(movePaletteIndex(3, 2, 1)).toBe(0);
    expect(movePaletteIndex(3, 0, -1)).toBe(2);
    expect(movePaletteIndex(0, 0, 1)).toBe(0);
  });
});
