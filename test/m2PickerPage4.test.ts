import { describe, expect, it } from "vitest";
import { M2_COMMAND_CATALOG, type M2CommandCatalogEntry } from "@/project/eventCommands/m2Catalog";
import { MODERN_COMMAND_ROWS, PDF_COMMAND_ROWS } from "@/project/eventCommands/m2CatalogData";
import { pickerPageForM2Command } from "@/project/eventCommands/m2PickerLayout";
import { commandPresentationDescriptor } from "@/editor/eventCommands/commandPresentation";

/**
 * 탭 4(시스템 · 도구)는 시스템/도구 명령만 담는다. 대화·흐름·전투 전용·화면 연출 그룹이
 * 남아 있으면 IA 쓰레기통이다. 정보 행(선택 불가)은 탭 그리드에서 빠지고 검색에만 나온다.
 */
const SYSTEM_TOOL_GROUPS: readonly string[] = ["시스템/고급", "모던 명령"];

function normalizedLabel(label: string): string {
  return label.replace(/(\.\.\.|…)$/u, "").trim();
}

function page4CatalogEntries(): readonly M2CommandCatalogEntry[] {
  return M2_COMMAND_CATALOG.filter((entry) => entry.pickerPage === 4);
}

async function pickerModule() {
  return import("@/editor/panels/eventEditor/commandPicker");
}

describe("picker page 4 is system/tools only", () => {
  it("leaves no dialogue, flow, battle-only, or presentation group on page 4", () => {
    const leftovers = page4CatalogEntries()
      .filter((entry) => !SYSTEM_TOOL_GROUPS.includes(entry.pickerGroup))
      .map((entry) => `${entry.id}:${entry.pickerGroup}`);

    expect(leftovers).toEqual([]);
  });

  it("routes labels, loops, timers, and end-event to the page 1 flow tab", () => {
    for (const title of [
      "Label",
      "Jump to Label",
      "Loop",
      "Break Loop",
      "End Event Processing",
      "Control Timer",
      "Name Input Processing",
      "Wait Until",
      "Weighted Branch",
    ]) {
      expect(pageOf(title)).toBe(1);
    }
  });

  it("routes battle-only rows 98-108 to the page 2 battle tab", () => {
    for (const row of PDF_COMMAND_ROWS.filter((entry) => entry.index >= 98 && entry.index <= 108)) {
      expect(pickerPageForM2Command(row)).toBe(2);
    }
  });

  it("routes camera, screen effect, cutscene, and movie to the page 3 presentation tab", () => {
    for (const title of ["Camera Control", "Screen Effect", "Cutscene Control", "Play Movie", "Change Screen Transition"]) {
      expect(pageOf(title)).toBe(3);
    }
  });

  it("keeps save, menu, system media, shutdown, tooling, and teleport flags on page 4", () => {
    for (const title of [
      "Open Save Menu",
      "Change Save Access",
      "Open Load Menu",
      "Open Menu Screen",
      "Change Menu Access",
      "Change System BGM",
      "Change System SE",
      "Change System Graphic",
      "Game Over",
      "Return to Title Screen",
      "Exit Game",
      "UI Command",
      "Debug Log",
      "Evaluate Expression",
      "Data Query",
      "Checkpoint Save",
      "Set Teleportation Point",
      "Teleportation On/Off",
      "Change Escape Access",
    ]) {
      expect(pageOf(title)).toBe(4);
    }
  });

  it("refuses to default unclassified rows onto page 4", () => {
    expect(() =>
      pickerPageForM2Command({
        index: 96_001,
        title: "Totally Unclassified Command",
        pdfTitle: "[Totally Unclassified Command]",
        pdfFile: "none",
        sourcePages: "none",
      })
    ).toThrow(/Totally Unclassified Command/u);
  });

  it("derives system, compatibility, and time family pages without a system dumping ground", () => {
    expect(commandPresentationDescriptor("gameOver").page).toBe(4);
    expect(commandPresentationDescriptor("setFlag").page).toBe(4);
    expect(commandPresentationDescriptor("timer").page).toBe(1);
    expect(commandPresentationDescriptor("setTime").page).toBe(1);
  });
});

describe("picker tab grid hides informational rows", () => {
  it("shows only selectable commands on every tab grid", async () => {
    const { eventCommandPickerTabEntries } = await pickerModule();

    for (const page of [1, 2, 3, 4] as const) {
      const informational = eventCommandPickerTabEntries(page)
        .filter((entry) => !entry.selectable)
        .map((entry) => entry.commandId);
      expect(informational).toEqual([]);
      expect(eventCommandPickerTabEntries(page).length).toBeGreaterThan(0);
    }
  });

  it("keeps informational rows searchable with an alternate-route hint", async () => {
    const { eventCommandPickerSearchEntries } = await pickerModule();
    const checkpointInfo = eventCommandPickerSearchEntries().find((entry) => entry.commandId === "checkpointSave");

    expect(checkpointInfo).toBeDefined();
    expect(checkpointInfo?.selectable).toBe(false);
    expect(checkpointInfo?.alternateRoute).toBeTruthy();
  });

  it("shows the checkpoint and ending labels at most once on the page 4 grid", async () => {
    const { eventCommandPickerTabEntries } = await pickerModule();
    const labels = eventCommandPickerTabEntries(4).map((entry) => normalizedLabel(entry.label));

    expect(labels.filter((label) => label === "체크포인트 저장")).toHaveLength(1);
    expect(labels.filter((label) => label === "엔딩")).toHaveLength(1);
    expect(labels.filter((label) => label.includes("체크포인트"))).toHaveLength(1);
  });

  it("groups the page 4 grid under system and tooling headings only", async () => {
    const { eventCommandPickerTabEntries } = await pickerModule();
    const groups = [...new Set(eventCommandPickerTabEntries(4).map((entry) => entry.group))].sort();

    expect(groups.filter((group) => !SYSTEM_TOOL_GROUPS.includes(group))).toEqual([]);
  });
});

function pageOf(title: string): number {
  const row = [...PDF_COMMAND_ROWS, ...MODERN_COMMAND_ROWS].find((entry) => entry.title === title);
  if (!row) throw new Error(`Missing catalog row: ${title}`);
  return pickerPageForM2Command(row);
}
