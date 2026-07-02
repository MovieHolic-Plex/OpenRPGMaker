import { deserialize, serialize } from "./io";
import type { Project } from "./types";

const DEV_PROJECT_STORAGE_PREFIX = "rpg-zzu:dev-project:";

const DEV_PROJECT_PARAMS = [
  "dbExtractedHouseTemplate",
  "devProject",
  "freshProject",
  "houseTemplateGallery",
  "logCabinShowcase",
  "retroHouseShowcase",
  "shopShowcase",
  "smallHouseVariant",
  "townArchitectureCity",
  "townArchitectureTest",
  "townCityShowcase",
  "townHouseShowcase",
] as const;

export function loadDevProjectOverride(): Project | null {
  if (isFreshProjectLocation()) return null;
  const key = devProjectStorageKey();
  return loadStoredProject(key);
}

export function saveDevProjectOverride(project: Project): void {
  if (isFreshProjectLocation()) return;
  const key = devProjectStorageKey();
  if (!key) return;
  window.localStorage.setItem(key, serialize(project));
}

function loadStoredProject(key: string | null): Project | null {
  if (!key) return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  return deserialize(raw);
}

function devProjectStorageKey(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("devProject") && !params.has("freshProject")) return null;
  const stableParams = new URLSearchParams();
  for (const name of DEV_PROJECT_PARAMS) {
    const value = params.get(name);
    if (value !== null) stableParams.set(name, value);
  }
  return `${DEV_PROJECT_STORAGE_PREFIX}${window.location.hostname}${window.location.pathname}?${stableParams.toString()}`;
}

function isFreshProjectLocation(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("freshProject");
}
