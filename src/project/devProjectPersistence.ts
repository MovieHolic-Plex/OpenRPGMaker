import { deserialize, serialize } from "./io";
import type { Project } from "./types";

const DEV_PROJECT_STORAGE_PREFIX = "rpg-zzu:dev-project:";

const DEV_PROJECT_PARAMS = [
  "blankProject",
  "dbExtractedHouseTemplate",
  "defaultAdventure",
  "defaultAdventureVisual",
  "devProject",
  "freshProject",
  "houseTemplateGallery",
  "logCabinShowcase",
  "retroHouseShowcase",
  "sampleAdventure",
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

// 현재 위치의 로컬 사본(dev override)이 존재하는가 — 부팅 실패 화면의 "로컬 사본 폐기" 노출 판단.
export function hasDevProjectOverride(): boolean {
  if (isFreshProjectLocation()) return false;
  const key = devProjectStorageKey();
  return key !== null && window.localStorage.getItem(key) !== null;
}

// 로컬 사본 폐기(도그푸딩 결함 ② 복구 액션): 손상된 dev override를 지워 새로 시작할 수 있게 한다.
export function discardDevProjectOverride(): void {
  if (typeof window === "undefined") return;
  const key = devProjectStorageKey();
  if (key) window.localStorage.removeItem(key);
}

// 반환값: 실제로 기록했는가 — fresh/blank 위치(저장 스킵 모드)에서는 false.
// store가 미저장 변경 추적(결함 ⑧)에 사용한다.
export function saveDevProjectOverride(project: Project): boolean {
  if (isFreshProjectLocation()) return false;
  const key = devProjectStorageKey();
  if (!key) return false;
  window.localStorage.setItem(key, serialize(project));
  return true;
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
  const params = new URLSearchParams(window.location.search);
  return params.has("freshProject") || params.has("blankProject");
}
