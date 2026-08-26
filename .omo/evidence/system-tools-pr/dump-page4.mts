/**
 * 검증용 덤프 스크립트 (증거 폴더 전용). 탭 4 그리드 항목의 라벨/그룹과
 * 카탈로그 기준 페이지 4 잔류 그룹을 그대로 찍는다. 제품 코드는 건드리지 않는다.
 *   npx vite-node .omo/evidence/system-tools-pr/dump-page4.mts
 */
import { writeFileSync } from "node:fs";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { MODERN_COMMAND_ROWS, PDF_COMMAND_ROWS } from "@/project/eventCommands/m2CatalogData";
import { pickerPageForM2Command, pickerGroupForM2Command } from "@/project/eventCommands/m2PickerLayout";
import { eventCommandPickerTabEntries, eventCommandPickerSearchEntries } from "@/editor/panels/eventEditor/commandPicker";

const SYSTEM_TOOL_GROUPS = ["시스템/고급", "모던 명령"] as const;
const LEFTOVER_GROUPS = ["대화/입력", "조건/흐름", "전투 전용", "화면/연출", "맵/이동", "소리", "배우/전투", "보상/상점"] as const;

const tab4 = eventCommandPickerTabEntries(4).map((entry) => ({
  commandId: entry.commandId,
  label: entry.label,
  group: entry.group,
  selectable: entry.selectable,
}));

const catalogPage4 = M2_COMMAND_CATALOG.filter((entry) => entry.pickerPage === 4).map((entry) => ({
  id: entry.id,
  label: entry.label,
  title: entry.title,
  group: entry.pickerGroup,
}));

const rows = [...PDF_COMMAND_ROWS, ...MODERN_COMMAND_ROWS];
const rowPage4 = rows
  .filter((row) => pickerPageForM2Command(row) === 4)
  .map((row) => ({ index: row.index, title: row.title, group: pickerGroupForM2Command(row) }));

const leftoverByGroup: Record<string, string[]> = {};
for (const group of LEFTOVER_GROUPS) {
  leftoverByGroup[group] = catalogPage4.filter((entry) => entry.group === group).map((entry) => entry.id);
}

const pagesOf = (title: string) => {
  const row = rows.find((entry) => entry.title === title);
  return row ? pickerPageForM2Command(row) : null;
};

const dump = {
  generatedAt: new Date().toISOString(),
  source: "npx vite-node .omo/evidence/system-tools-pr/dump-page4.mts",
  tab4Grid: {
    count: tab4.length,
    groups: [...new Set(tab4.map((entry) => entry.group))].sort(),
    nonSystemToolGroups: [...new Set(tab4.map((entry) => entry.group))].filter(
      (group) => !SYSTEM_TOOL_GROUPS.includes(group as (typeof SYSTEM_TOOL_GROUPS)[number])
    ),
    informationalRows: tab4.filter((entry) => !entry.selectable).map((entry) => entry.commandId),
    entries: tab4,
  },
  catalogPage4: { count: catalogPage4.length, entries: catalogPage4 },
  pdfAndModernRowsOnPage4: { count: rowPage4.length, rows: rowPage4 },
  leftoverGroupsOnPage4: leftoverByGroup,
  movedOffPage4: {
    Label: pagesOf("Label"),
    Loop: pagesOf("Loop"),
    "Control Timer": pagesOf("Control Timer"),
    "End Event Processing": pagesOf("End Event Processing"),
    "Name Input Processing": pagesOf("Name Input Processing"),
    "Camera Control": pagesOf("Camera Control"),
    "Screen Effect": pagesOf("Screen Effect"),
    "Cutscene Control": pagesOf("Cutscene Control"),
    "Play Movie": pagesOf("Play Movie"),
    "Advanced Dialogue": pagesOf("Advanced Dialogue"),
  },
  searchOnlyInformational: eventCommandPickerSearchEntries()
    .filter((entry) => !entry.selectable)
    .map((entry) => ({ commandId: entry.commandId, page: entry.page, alternateRoute: entry.alternateRoute ?? null })),
};

const out = new URL("./page4.json", import.meta.url);
writeFileSync(out, `${JSON.stringify(dump, null, 2)}\n`, "utf8");
console.log(`tab4Grid.count=${dump.tab4Grid.count} groups=${JSON.stringify(dump.tab4Grid.groups)}`);
console.log(`nonSystemToolGroups=${JSON.stringify(dump.tab4Grid.nonSystemToolGroups)} informational=${JSON.stringify(dump.tab4Grid.informationalRows)}`);
console.log(`leftoverGroupsOnPage4=${JSON.stringify(dump.leftoverGroupsOnPage4)}`);
console.log(`wrote ${out.pathname}`);
