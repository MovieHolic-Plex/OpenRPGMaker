import { store } from "@/project/store";

export const SPATIAL_SHELL_TABS = ["tiles", "objects", "spaces", "places", "regions", "worlds"] as const;
export type SpatialShellTab = (typeof SPATIAL_SHELL_TABS)[number];
export type SpatialAuthoringMode = "design" | "instances";
export type SpatialSourceFilter = "all" | "defaults" | "own";
export type SpatialLegacyOrigin = "tilesetSpaces" | "villages" | "worldGen";
export type SpatialPlaceKindFilter = "facility" | "settlement" | "natural";
export type SpatialCamera = { readonly x: number; readonly y: number; readonly zoom: number };

export type SpatialBreadcrumb = {
  readonly tab: SpatialShellTab;
  readonly mode: SpatialAuthoringMode;
  readonly designId: string | null;
  readonly occurrenceId: string | null;
  readonly camera: SpatialCamera;
};

type SpatialTabSlice = {
  readonly mode: SpatialAuthoringMode;
  readonly source: SpatialSourceFilter;
  readonly designId: string | null;
  readonly occurrenceId: string | null;
  readonly camera: SpatialCamera;
};

export type SpatialAuthoringSession = SpatialTabSlice & {
  readonly tab: SpatialShellTab;
  readonly breadcrumb: readonly SpatialBreadcrumb[];
  readonly legacyOrigin: SpatialLegacyOrigin | null;
  readonly placeKindFilter: SpatialPlaceKindFilter | null;
  readonly inspectorOpen: boolean;
};

const DEFAULT_CAMERA: SpatialCamera = { x: 0, y: 0, zoom: 1 };

function defaultSlice(): SpatialTabSlice {
  return { mode: "design", source: "all", designId: null, occurrenceId: null, camera: DEFAULT_CAMERA };
}

type StoredSession = {
  readonly tab: SpatialShellTab;
  readonly slices: Readonly<Record<SpatialShellTab, SpatialTabSlice>>;
  readonly breadcrumb: readonly SpatialBreadcrumb[];
  readonly legacyOrigin: SpatialLegacyOrigin | null;
  readonly placeKindFilter: SpatialPlaceKindFilter | null;
  readonly inspectorOpen: boolean;
};

function defaultStored(tab: SpatialShellTab = "places"): StoredSession {
  return {
    tab,
    slices: {
      tiles: defaultSlice(),
      objects: defaultSlice(),
      spaces: defaultSlice(),
      places: defaultSlice(),
      regions: defaultSlice(),
      worlds: defaultSlice(),
    },
    breadcrumb: [],
    legacyOrigin: null,
    placeKindFilter: null,
    inspectorOpen: false,
  };
}

function view(stored: StoredSession): SpatialAuthoringSession {
  return {
    tab: stored.tab,
    ...stored.slices[stored.tab],
    breadcrumb: stored.breadcrumb,
    legacyOrigin: stored.legacyOrigin,
    placeKindFilter: stored.placeKindFilter,
    inspectorOpen: stored.inspectorOpen,
  };
}

const sessionsByProject = new Map<string, StoredSession>();

export function spatialProjectKey(): string {
  const identity = store.getProjectIdentity();
  return `${identity.kind}:${identity.id}`;
}

function stored(): StoredSession {
  const key = spatialProjectKey();
  const attached = sessionsByProject.get(key);
  if (attached) return attached;
  const created = defaultStored();
  sessionsByProject.set(key, created);
  return created;
}

export function spatialSession(): SpatialAuthoringSession {
  return view(stored());
}

export function resetSpatialAuthoringSessions(): void {
  sessionsByProject.clear();
}

function write(next: StoredSession): SpatialAuthoringSession {
  sessionsByProject.set(spatialProjectKey(), next);
  return view(next);
}

export function patchSpatialSession(patch: Partial<SpatialAuthoringSession>): SpatialAuthoringSession {
  const current = stored();
  const tab = patch.tab ?? current.tab;
  const slice = { ...current.slices[tab] };
  if (patch.mode !== undefined) slice.mode = patch.mode;
  if (patch.source !== undefined) slice.source = patch.source;
  if (patch.designId !== undefined) slice.designId = patch.designId;
  if (patch.occurrenceId !== undefined) slice.occurrenceId = patch.occurrenceId;
  if (patch.camera !== undefined) slice.camera = patch.camera;
  return write({
    tab,
    slices: { ...current.slices, [tab]: slice },
    breadcrumb: patch.breadcrumb ?? current.breadcrumb,
    legacyOrigin: patch.legacyOrigin === undefined ? current.legacyOrigin : patch.legacyOrigin,
    placeKindFilter: patch.placeKindFilter === undefined ? current.placeKindFilter : patch.placeKindFilter,
    inspectorOpen: patch.inspectorOpen === undefined ? current.inspectorOpen : patch.inspectorOpen,
  });
}

export function setSpatialTab(tab: SpatialShellTab): SpatialAuthoringSession {
  const current = stored();
  if (current.tab === tab && current.legacyOrigin === null && current.placeKindFilter === null) {
    return view(current);
  }
  return write({
    ...current,
    tab,
    legacyOrigin: null,
    placeKindFilter: null,
    breadcrumb: current.tab === tab ? current.breadcrumb : [],
  });
}

export function rememberLegacySpatialRoute(origin: SpatialLegacyOrigin | null): SpatialAuthoringSession {
  if (origin === "villages") {
    return patchSpatialSession({
      tab: "places",
      mode: "design",
      legacyOrigin: origin,
      placeKindFilter: "settlement",
    });
  }
  if (origin === "tilesetSpaces") {
    return patchSpatialSession({ tab: "spaces", mode: "design", legacyOrigin: origin, placeKindFilter: null });
  }
  if (origin === "worldGen") {
    return patchSpatialSession({ tab: "regions", mode: "design", legacyOrigin: origin, placeKindFilter: null });
  }
  return patchSpatialSession({ legacyOrigin: null, placeKindFilter: null });
}

export function selectSpatialDesign(designId: string | null): SpatialAuthoringSession {
  return patchSpatialSession({ designId, occurrenceId: null });
}

export function selectSpatialOccurrence(occurrenceId: string | null): SpatialAuthoringSession {
  return patchSpatialSession({ occurrenceId, mode: "instances" });
}

type SpatialTabReveal = (tab: SpatialShellTab) => void;
let tabReveal: SpatialTabReveal | null = null;

export function onSpatialTabReveal(listener: SpatialTabReveal | null): void {
  tabReveal = listener;
}

/** Change destination without clearing breadcrumb. Database rail clicks still use setSpatialTab. */
export function openSpatialDestination(tab: SpatialShellTab, designId: string | null): SpatialAuthoringSession {
  const next = patchSpatialSession({
    tab,
    designId,
    occurrenceId: null,
    camera: DEFAULT_CAMERA,
  });
  tabReveal?.(tab);
  return next;
}

/** Placed drill keeps the actual occurrence; never null occurrenceId like library open. */
export function openPlacedSpatialDestination(destination: {
  readonly tab: SpatialShellTab;
  readonly mode: "instances";
  readonly occurrenceId: string;
}): SpatialAuthoringSession {
  const next = patchSpatialSession({
    tab: destination.tab,
    mode: destination.mode,
    occurrenceId: destination.occurrenceId,
    designId: null,
  });
  tabReveal?.(destination.tab);
  return next;
}

export function setSpatialCamera(camera: SpatialCamera): SpatialAuthoringSession {
  return patchSpatialSession({ camera });
}

export function pushSpatialBreadcrumb(): SpatialAuthoringSession {
  const current = spatialSession();
  const crumb: SpatialBreadcrumb = {
    tab: current.tab,
    mode: current.mode,
    designId: current.designId,
    occurrenceId: current.occurrenceId,
    camera: current.camera,
  };
  return patchSpatialSession({ breadcrumb: [...current.breadcrumb, crumb] });
}

export function popSpatialBreadcrumb(): SpatialAuthoringSession {
  const current = spatialSession();
  const previous = current.breadcrumb[current.breadcrumb.length - 1];
  if (!previous) return current;
  const next = patchSpatialSession({
    tab: previous.tab,
    mode: previous.mode,
    designId: previous.designId,
    occurrenceId: previous.occurrenceId,
    camera: previous.camera,
    breadcrumb: current.breadcrumb.slice(0, -1),
  });
  tabReveal?.(previous.tab);
  return next;
}
