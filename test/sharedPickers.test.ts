/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  charsetFrameSource,
} from "@/assets/easyrpgRtp";
import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { createBlankProject } from "@/project/defaults";
import { charsetIconOf, facesetIconOf } from "@/editor/panels/eventEditor/recordPicker";
import { actorPicker, itemPicker, mapPicker, mapSelectElement } from "@/editor/panels/eventEditor/sharedPickers";

describe("sharedPickers", () => {
  it("mapPicker exposes select testid and map size subtitle", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    expect(map).toBeTruthy();

    const picker = mapPicker({
      project,
      selectedId: mapId,
      testid: "change-tile-map-select",
    });

    expect(picker.select.dataset.testid).toBe("change-tile-map-select");
    expect(picker.select.value).toBe(mapId);
    expect(picker.root.querySelector(".record-picker-card-name")?.textContent).toContain(map!.name);
    expect(picker.root.querySelector(".record-picker-card-subtitle")?.textContent).toBe(
      `${map!.width}×${map!.height}`,
    );
  });

  it("mapSelectElement lists all maps and keeps empty option when allowed", () => {
    const project = createBlankProject();
    const select = mapSelectElement({
      project,
      selectedId: "",
      testid: "event-page-living-target-map",
      allowEmpty: true,
    });
    expect(select.dataset.testid).toBe("event-page-living-target-map");
    expect(select.options.length).toBe(Object.keys(project.maps).length + 1);
  });

  it("actorPicker and itemPicker reuse record cards with icons/subtitles", () => {
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const item = project.database.items[0];
    expect(actor).toBeTruthy();
    expect(item).toBeTruthy();

    const actorHandle = actorPicker({
      project,
      selectedId: actor!.id,
      testid: "change-party-actor-select",
    });
    expect(actorHandle.select.dataset.testid).toBe("change-party-actor-select");
    expect(actorHandle.root.querySelector(".record-picker-card-name")?.textContent).toBe(actor!.name);

    const itemHandle = itemPicker({
      project,
      selectedId: item!.id,
      testid: "change-item-select",
      subtitleOf: () => "시작 보유 ×0",
    });
    expect(itemHandle.select.dataset.testid).toBe("change-item-select");
    expect(itemHandle.root.querySelector(".record-picker-card-subtitle")?.textContent).toBe("시작 보유 ×0");
  });

  it("facesetIconOf crops one face cell by faceIndex, never the whole sheet", () => {
    const project = createBlankProject();
    const faceIndex = 5;
    const icon = facesetIconOf(project, "easyrpg-faceset-actor1", faceIndex);
    expect(icon).not.toBeNull();
    if (icon?.kind !== "sheet") throw new Error("expected sheet crop");
    expect(icon.index).toBe(faceIndex);
    expect(icon.columns).toBe(RESOURCE_SLICING.faceset.columns);
    expect(icon.cellWidth).toBe(RESOURCE_SLICING.faceset.cellWidth);

    // actorPicker must pass actor.faceIndex into the crop
    const actor = project.database.actors[0]!;
    actor.faceResourceId = "easyrpg-faceset-actor1";
    actor.faceIndex = faceIndex;
    const picker = actorPicker({ project, selectedId: actor.id, testid: "actor-face-crop" });
    const crop = picker.root.querySelector(".rich-record-icon-crop") as HTMLElement | null;
    expect(crop).toBeTruthy();
    const scale = 24 / RESOURCE_SLICING.faceset.cellWidth;
    const col = faceIndex % RESOURCE_SLICING.faceset.columns;
    const row = Math.floor(faceIndex / RESOURCE_SLICING.faceset.columns);
    expect(crop!.style.backgroundPosition).toBe(
      `-${col * RESOURCE_SLICING.faceset.cellWidth * scale}px -${row * RESOURCE_SLICING.faceset.cellHeight * scale}px`,
    );
    expect(crop!.style.backgroundSize).toBe(
      `${RESOURCE_SLICING.faceset.sheetWidth * scale}px ${RESOURCE_SLICING.faceset.sheetHeight * scale}px`,
    );
  });

  it("charsetIconOf crops one character slot idle-front frame from multi-object sheets", () => {
    const project = createBlankProject();
    const characterIndex = 4;
    const icon = charsetIconOf(project, "easyrpg-charset-object1", characterIndex);
    expect(icon).not.toBeNull();
    if (icon?.kind !== "sheetRect") throw new Error("expected sheetRect crop");
    const source = charsetFrameSource({ characterIndex, direction: "down", pattern: 1 });
    expect(icon.x).toBe(source.x);
    expect(icon.y).toBe(source.y);
    expect(icon.cellWidth).toBe(CHARSET_FRAME_WIDTH);
    expect(icon.cellHeight).toBe(CHARSET_FRAME_HEIGHT);
    expect(icon.sheetWidth).toBe(CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH);
    expect(icon.sheetHeight).toBe(CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT);
  });
});
