import type { SpatialAuthoringPreview, SpatialAuthoringResult } from "@/editor/spatial/authoringTypes";
import { assertNever } from "@/project/spatial/domain";
import { el } from "@/util/dom";
import { spatialProjectKey, type SpatialAuthoringSession } from "./spatialAuthoringSession";
import { visibleAuthoringProject } from "./spatialAuthoringAccess";
import {
  previewSpatialSourceBuild,
  resolveSpatialBuildSource,
  spatialBuildProposal,
  type SpatialSourceBuildInput,
} from "./spatialBuildActions";
import type { SpatialGalleryCard } from "./spatialCatalog";
import { objectChromeState } from "./spatialObjectChromeState";
import { placeChromeState } from "./spatialPlaceChromeState";
import { spaceChromeState } from "./spatialSpaceChromeState";
import { freshSpatialId } from "./spatialSpaceDraft";
import type { SpatialDomainChrome } from "./spatialTilesTab";

export const DEFAULT_SPATIAL_BUILD_SEED = 7;
export const BUILD_SEED_INTEGER_REQUIRED = "build-seed-integer-required";
export const BUILD_MAP_SELECTION_ENTRY_REQUIRED = "build-map-selection-entry-required";

let boundProjectKey: string | null = null;

export function bindSpatialBuildInputs(): void {
  const key = spatialProjectKey();
  if (boundProjectKey === key) return;
  boundProjectKey = key;
  objectChromeState.buildSeed = DEFAULT_SPATIAL_BUILD_SEED;
  objectChromeState.buildSeedText = null;
  objectChromeState.buildMapId = null;
  objectChromeState.buildRectX = null;
  objectChromeState.buildRectY = null;
  objectChromeState.buildRectWidth = null;
  objectChromeState.buildRectHeight = null;
  objectChromeState.buildEntryX = null;
  objectChromeState.buildEntryY = null;
  spaceChromeState.buildSeed = DEFAULT_SPATIAL_BUILD_SEED;
  spaceChromeState.buildSeedText = null;
  placeChromeState.buildSeed = DEFAULT_SPATIAL_BUILD_SEED;
  placeChromeState.buildSeedText = null;
}

export function parseSpatialBuildSeed(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "" || !/^-?\d+$/.test(trimmed)) return null;
  const seed = Number(trimmed);
  return Number.isSafeInteger(seed) ? seed : null;
}

export function objectBuildDestinationError(
  destination: Extract<SpatialSourceBuildInput["destination"], { kind: "map" }>,
): string | null {
  const { currentMapId, selection, entry } = destination;
  if (!currentMapId || !selection || !entry || selection.mapId !== currentMapId) {
    return BUILD_MAP_SELECTION_ENTRY_REQUIRED;
  }
  const values = [selection.x, selection.y, selection.width, selection.height, entry.x, entry.y];
  if (!values.every((value) => Number.isSafeInteger(value))) return BUILD_MAP_SELECTION_ENTRY_REQUIRED;
  if (selection.x < 0 || selection.y < 0 || entry.x < 0 || entry.y < 0) return BUILD_MAP_SELECTION_ENTRY_REQUIRED;
  if (selection.width < 1 || selection.height < 1) return BUILD_MAP_SELECTION_ENTRY_REQUIRED;
  return null;
}

function objectBuildDestinationComplete(): boolean {
  return objectChromeState.buildMapId !== null
    && objectChromeState.buildRectX !== null
    && objectChromeState.buildRectY !== null
    && objectChromeState.buildRectWidth !== null
    && objectChromeState.buildRectHeight !== null
    && objectChromeState.buildEntryX !== null
    && objectChromeState.buildEntryY !== null;
}

export function syncSpatialBuildEnabled(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-testid=spatial-build]");
  if (!button) return;
  if (button.dataset.buildEligible !== "1") {
    button.disabled = true;
    return;
  }
  const map = document.querySelector("[data-testid=spatial-build-map]");
  if (map) {
    button.disabled = objectChromeState.buildSeed === null || !objectBuildDestinationComplete();
    return;
  }
  const seed = document.querySelector<HTMLInputElement>("[data-testid=spatial-build-seed]");
  button.disabled = parseSpatialBuildSeed(seed?.value ?? "") === null;
}

export function discloseSpatialBuildInput(): string {
  const pending = spatialBuildProposal();
  if (!pending) return "";
  const { input } = pending;
  const dest = input.destination;
  if (dest.kind === "new-maps") {
    return `${input.seed} ${input.source.kind === "space" ? "place" : input.source.kind} ${input.source.id} new-maps`;
  }
  const rect = dest.selection;
  const entry = dest.entry;
  const rectText = rect ? `${rect.x},${rect.y} ${rect.width}x${rect.height}` : "";
  const entryText = entry ? `${entry.x},${entry.y}` : "";
  return `${input.seed} ${input.source.kind === "space" ? "place" : input.source.kind} ${input.source.id} ${dest.currentMapId ?? ""} ${rectText} ${entryText}`.trim();
}

export function spatialBuildInputDataset(): Record<string, string> {
  const pending = spatialBuildProposal();
  if (!pending) return { testid: "spatial-build-input" };
  const { input } = pending;
  const dest = input.destination;
  const dataset: Record<string, string> = {
    testid: "spatial-build-input",
    seed: String(input.seed),
    sourceKind: input.source.kind,
    sourceId: input.source.id,
    destKind: dest.kind,
    rootId: input.rootId,
  };
  if (dest.kind === "map") {
    dataset.mapId = dest.currentMapId ?? "";
    if (dest.selection) {
      dataset.rectX = String(dest.selection.x);
      dataset.rectY = String(dest.selection.y);
      dataset.rectWidth = String(dest.selection.width);
      dataset.rectHeight = String(dest.selection.height);
    }
    if (dest.entry) {
      dataset.entryX = String(dest.entry.x);
      dataset.entryY = String(dest.entry.y);
    }
  }
  return dataset;
}

export function spatialBuildDisabledReason(card: SpatialGalleryCard | undefined): string | null {
  const resolved = resolveSpatialBuildSource(card);
  return resolved.kind === "error" ? resolved.error.message : null;
}

export function runSpatialSourceBuild(
  card: SpatialGalleryCard | undefined,
  seed: number,
  destination: SpatialSourceBuildInput["destination"],
): SpatialAuthoringResult<SpatialAuthoringPreview> {
  const resolved = resolveSpatialBuildSource(card);
  if (resolved.kind === "error") return resolved;
  const source = resolved.value;
  const pending = spatialBuildProposal();
  const same = pending !== null
    && JSON.stringify(pending.input.source) === JSON.stringify(source)
    && pending.input.seed === seed
    && JSON.stringify(pending.input.destination) === JSON.stringify(destination);
  const rootId = same && pending ? pending.input.rootId : freshSpatialId(visibleAuthoringProject(), "occ");
  switch (source.kind) {
    case "object":
      if (destination.kind !== "map") {
        return { kind: "error", error: { code: "invalid", message: "build-map-selection-entry-required" } };
      }
      return previewSpatialSourceBuild({
        source: { kind: source.kind, id: source.id }, rootId, seed, destination,
      });
    case "space":
    case "place":
      if (destination.kind !== "new-maps") {
        return { kind: "error", error: { code: "unsupported", message: "manual-build-kind-unsupported" } };
      }
      return previewSpatialSourceBuild({
        source: { kind: source.kind, id: source.id }, rootId, seed, destination,
      });
    default:
      return assertNever(source.kind);
  }
}

export function renderSpatialBuildChrome(
  tab: SpatialAuthoringSession["tab"],
  chrome: SpatialDomainChrome | undefined,
): HTMLElement[] {
  bindSpatialBuildInputs();
  if (tab !== "objects" && tab !== "spaces" && tab !== "places") return [];
  const seed = el("input", {
    class: "spatial-build-seed",
    attrs: {
      type: "number", step: "1", "aria-label": "시공 시드",
      title: "시공 난수 씨앗 — 같은 시드는 항상 같은 결과를 냅니다 (기본값 7)",
    },
    value: chrome?.buildSeedText ?? (chrome?.buildSeed === null ? "" : String(chrome?.buildSeed ?? DEFAULT_SPATIAL_BUILD_SEED)),
    dataset: { testid: "spatial-build-seed" },
  });
  const onSeed = chrome?.onBuildSeed;
  if (onSeed) {
    seed.addEventListener("input", () => { onSeed(seed.value); syncSpatialBuildEnabled(); });
    seed.addEventListener("change", () => { onSeed(seed.value); syncSpatialBuildEnabled(); });
  }
  const seedOk = chrome?.buildSeed !== null && chrome?.buildSeed !== undefined;
  const destOk = tab !== "objects" || objectBuildDestinationComplete();
  const enabled = Boolean(chrome?.build) && seedOk && destOk;
  return [
    el("button", {
      class: "spatial-action",
      text: "시공",
      attrs: { type: "button", title: "선택한 설계를 실제 맵으로 생성합니다", ...(enabled ? {} : { disabled: "" }) },
      dataset: { testid: "spatial-build", buildEligible: chrome?.build ? "1" : "0" },
      on: chrome?.build ? { click: chrome.build } : undefined,
    }),
    el("label", {
      class: "spatial-build-seed-field",
      children: [el("span", { text: "시드", attrs: { title: "시공 난수 씨앗 — 같은 시드는 같은 결과" } }), seed],
    }),
  ];
}

export function renderSpatialBuildPanel(
  tab: SpatialAuthoringSession["tab"],
): HTMLElement | null {
  bindSpatialBuildInputs();
  if (tab !== "objects" && tab !== "spaces" && tab !== "places") return null;
  const summary = discloseSpatialBuildInput();
  const children: HTMLElement[] = [
    el("div", {
      class: "spatial-build-disclosure",
      text: summary,
      attrs: summary ? {} : { hidden: "" },
      dataset: spatialBuildInputDataset(),
    }),
  ];
  if (tab === "objects") children.push(renderObjectBuildFields());
  return el("div", { class: "spatial-build-panel", children });
}

export function renderObjectBuildFields(): HTMLElement {
  bindSpatialBuildInputs();
  const numberField = (label: string, testid: string, value: number | null, assign: (next: number | null) => void): HTMLElement => {
    const input = el("input", {
      attrs: { type: "number", step: "1" },
      value: value === null ? "" : String(value),
      dataset: { testid },
    });
    input.addEventListener("input", () => { assign(optionalInt(input.value)); syncSpatialBuildEnabled(); });
    input.addEventListener("change", () => { assign(optionalInt(input.value)); syncSpatialBuildEnabled(); });
    return el("label", { class: "spatial-object-field", children: [el("span", { text: label }), input] });
  };
  const map = el("input", {
    attrs: { type: "text" },
    value: objectChromeState.buildMapId ?? "",
    dataset: { testid: "spatial-build-map" },
  });
  const assignMap = (): void => {
    objectChromeState.buildMapId = map.value.length === 0 ? null : map.value;
  };
  map.addEventListener("input", () => { assignMap(); syncSpatialBuildEnabled(); });
  map.addEventListener("change", () => {
    const next = map.value.trim();
    objectChromeState.buildMapId = next.length === 0 ? null : next;
    syncSpatialBuildEnabled();
  });
  // 오브젝트 시공 대상은 선택 전까지 빈 폼으로 자리만 먹는다 — details로 접어 둔다.
  const details = document.createElement("details");
  details.className = "spatial-object-build";
  details.dataset.testid = "spatial-build-target";
  const summary = document.createElement("summary");
  summary.textContent = "시공 대상 — 어느 맵의 어느 영역에 지을지";
  details.append(
    summary,
    el("label", { class: "spatial-object-field", children: [el("span", { text: "맵" }), map] }),
    numberField("X", "spatial-build-rect-x", objectChromeState.buildRectX, (next) => { objectChromeState.buildRectX = next; }),
    numberField("Y", "spatial-build-rect-y", objectChromeState.buildRectY, (next) => { objectChromeState.buildRectY = next; }),
    numberField("너비", "spatial-build-rect-width", objectChromeState.buildRectWidth, (next) => { objectChromeState.buildRectWidth = next; }),
    numberField("높이", "spatial-build-rect-height", objectChromeState.buildRectHeight, (next) => { objectChromeState.buildRectHeight = next; }),
    el("div", {
      class: "spatial-object-entry",
      dataset: { testid: "spatial-build-entry" },
      children: [
        numberField("진입 X", "spatial-build-entry-x", objectChromeState.buildEntryX, (next) => { objectChromeState.buildEntryX = next; }),
        numberField("진입 Y", "spatial-build-entry-y", objectChromeState.buildEntryY, (next) => { objectChromeState.buildEntryY = next; }),
      ],
    }),
  );
  return details;
}


function optionalInt(value: string): number | null {
  if (!/^-?\d+$/.test(value)) return null;
  return Number.parseInt(value, 10);
}
