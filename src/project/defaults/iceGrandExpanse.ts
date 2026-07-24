import { appendToTree, removeFromTree } from "@/editor/mapTreeActions";
import { ICE_GRAND_ADVENTURE_MAP_ID } from "@/project/defaults/iceGrandAdventure";
import { ICE_GRAND_EXPANSE_BOSS_EVENT, ICE_GRAND_EXPANSE_GUARDS } from "@/project/defaults/iceGrandExpanseBoss";
import { ICE_GRAND_EXPANSE_CHECKPOINTS, ICE_GRAND_EXPANSE_SUMMIT_CHECKPOINT_SWITCH } from "@/project/defaults/iceGrandExpanseCheckpoints";
import { buildIceGrandExpanseGameplay } from "@/project/defaults/iceGrandExpanseEvents";
import { ICE_GRAND_EXPANSE_FIELD_SPAWNS } from "@/project/defaults/iceGrandExpanseFieldSpawns";
import { buildIceGrandExpanseMap } from "@/project/defaults/iceGrandExpanseMap";
import { ICE_GRAND_EXPANSE_MAP_ID } from "@/project/defaults/iceGrandExpansePlan";
import {
  ICE_GRAND_EXPANSE_GATE,
  ICE_GRAND_EXPANSE_SEALS,
  ICE_GRAND_EXPANSE_SEAL_SWITCHES,
  ICE_GRAND_EXPANSE_SHORTCUT_EVENTS,
} from "@/project/defaults/iceGrandExpanseSeals";
import { ICE_GRAND_EXPANSE_REWARDS } from "@/project/defaults/iceGrandExpanseGameplay/rewardEvents";
import { ICE_GRAND_EXPANSE_REGION_EVENTS } from "@/project/defaults/iceGrandExpanseGameplay/regionEvents";
import { ICE_DIAGONAL_CANONICAL_SOURCE } from "@/project/defaults/iceDiagonalTerrain";
import type { GameMap, MapTreeNode, Project } from "@/project/types";
import { sha256HexText } from "@/util/sha256";

export const ICE_GRAND_EXPANSE_CANONICAL_MAP_HASH = "fad0164907b285480155dccb3b05e2a1804226c914070a048624771d0bf5676c";

export const ICE_GRAND_EXPANSE_OWNED_EVENT_IDS = [
  ...ICE_GRAND_EXPANSE_REGION_EVENTS.map(({ id }) => id),
  ...ICE_GRAND_EXPANSE_CHECKPOINTS.map(({ id }) => id),
  ...ICE_GRAND_EXPANSE_SEALS.map(({ id }) => id),
  ICE_GRAND_EXPANSE_GATE.id,
  ...ICE_GRAND_EXPANSE_SHORTCUT_EVENTS.map(({ id }) => id),
  ...ICE_GRAND_EXPANSE_REWARDS.map(({ id }) => id),
  ...ICE_GRAND_EXPANSE_GUARDS.map(({ id }) => id),
  ICE_GRAND_EXPANSE_BOSS_EVENT.id,
] as const;

export const ICE_GRAND_EXPANSE_OWNED_SWITCH_IDS = [
  ICE_GRAND_EXPANSE_SEAL_SWITCHES.west,
  ICE_GRAND_EXPANSE_SEAL_SWITCHES.east,
  ICE_GRAND_EXPANSE_SEAL_SWITCHES.gate,
  ICE_GRAND_EXPANSE_BOSS_EVENT.clearSwitchId,
  ...ICE_GRAND_EXPANSE_GUARDS.map(({ clearSwitchId }) => clearSwitchId),
  ICE_GRAND_EXPANSE_SUMMIT_CHECKPOINT_SWITCH,
] as const;

export type IceGrandExpanseOwnershipManifest = {
  readonly mapId: typeof ICE_GRAND_EXPANSE_MAP_ID;
  readonly tree: { readonly parentMapId: typeof ICE_DIAGONAL_CANONICAL_SOURCE.mapId; readonly index: number };
  readonly fieldSpawnIds: readonly string[];
  readonly eventIds: readonly string[];
  readonly switchIds: readonly string[];
  readonly databaseRecordIds: readonly string[];
  readonly globalStartIds: readonly string[];
  readonly resourceIds: readonly string[];
  readonly worldGraphIds: readonly string[];
};

export type IceGrandExpanseInstallErrorCode =
  | "CANONICAL_DRIFT"
  | "DERIVED_ID_CONFLICT"
  | "INSTALL_INVARIANT"
  | "UNRELATED_DATA_MUTATION";

export class IceGrandExpanseInstallError extends Error {
  readonly code: IceGrandExpanseInstallErrorCode;

  constructor(code: IceGrandExpanseInstallErrorCode, message: string) {
    super(message);
    this.name = "IceGrandExpanseInstallError";
    this.code = code;
  }
}

export type IceGrandExpanseInstallOptions = { readonly expectedCanonicalMapHash?: string };
export type IceGrandExpanseInstallResult = {
  readonly kind: "installed" | "noop";
  readonly project: Project;
  readonly manifest: IceGrandExpanseOwnershipManifest;
  readonly mapHash: string;
};

export async function hashIceGrandExpanseMap(map: GameMap): Promise<string> {
  return sha256HexText(stableJson(map));
}

export async function installIceGrandExpanse(
  project: Project,
  options: IceGrandExpanseInstallOptions = {},
): Promise<IceGrandExpanseInstallResult> {
  const canonical = project.maps[ICE_DIAGONAL_CANONICAL_SOURCE.mapId];
  const canonicalNodes = findTreeNodes(project.mapTree, ICE_DIAGONAL_CANONICAL_SOURCE.mapId);
  if (canonical === undefined || canonicalNodes.length !== 1) {
    throw new IceGrandExpanseInstallError("CANONICAL_DRIFT", "Canonical ice map or its unique tree node is missing");
  }
  const expectedCanonicalMapHash = options.expectedCanonicalMapHash ?? ICE_GRAND_EXPANSE_CANONICAL_MAP_HASH;
  if (await hashIceGrandExpanseMap(canonical) !== expectedCanonicalMapHash) {
    throw new IceGrandExpanseInstallError("CANONICAL_DRIFT", "Canonical ice map full hash changed");
  }

  const derived = buildIceGrandExpanseGameplay(buildIceGrandExpanseMap({
    tileSize: canonical.tileSize,
    tilesetId: canonical.tilesetId,
  }));
  assertDerivedContent(derived);
  const mapHash = await hashIceGrandExpanseMap(derived);
  const derivedNodes = findTreeNodes(project.mapTree, ICE_GRAND_EXPANSE_MAP_ID);
  const existing = project.maps[ICE_GRAND_EXPANSE_MAP_ID];
  const parent = canonicalNodes[0];
  if (parent === undefined) throw new IceGrandExpanseInstallError("CANONICAL_DRIFT", "Canonical tree node disappeared");
  const treeIndex = expectedTreeIndex(parent, existing !== undefined);
  const manifest = ownershipManifest(treeIndex);

  if (existing !== undefined) {
    const exactNode = parent.children[treeIndex];
    const placementMatches = derivedNodes.length === 1
      && exactNode?.mapId === ICE_GRAND_EXPANSE_MAP_ID
      && exactNode.children.length === 0;
    if (!placementMatches || await hashIceGrandExpanseMap(existing) !== mapHash) {
      throw new IceGrandExpanseInstallError("DERIVED_ID_CONFLICT", "Derived map bytes or tree placement conflict");
    }
    return { kind: "noop", project: structuredClone(project), manifest, mapHash };
  }
  if (derivedNodes.length !== 0) {
    throw new IceGrandExpanseInstallError("DERIVED_ID_CONFLICT", "Derived tree id exists without its map");
  }

  const next = structuredClone(project);
  next.maps[ICE_GRAND_EXPANSE_MAP_ID] = derived;
  appendToTree(next.mapTree, ICE_GRAND_EXPANSE_MAP_ID, ICE_DIAGONAL_CANONICAL_SOURCE.mapId);
  const nextParent = findTreeNodes(next.mapTree, ICE_DIAGONAL_CANONICAL_SOURCE.mapId)[0];
  if (nextParent === undefined) throw new IceGrandExpanseInstallError("INSTALL_INVARIANT", "Canonical tree node disappeared during install");
  const appended = nextParent.children.pop();
  if (appended?.mapId !== ICE_GRAND_EXPANSE_MAP_ID) {
    throw new IceGrandExpanseInstallError("INSTALL_INVARIANT", "Map-tree append did not create the owned node");
  }
  nextParent.children.splice(treeIndex, 0, appended);
  assertIceGrandExpanseOwnedPatch(project, next, manifest);
  return { kind: "installed", project: next, manifest, mapHash };
}

export function stripOwnedArtifacts(
  project: Project,
  manifest: IceGrandExpanseOwnershipManifest,
): Project {
  const stripped = structuredClone(project);
  delete stripped.maps[manifest.mapId];
  removeFromTree(stripped.mapTree, manifest.mapId);
  return stripped;
}

export function assertIceGrandExpanseOwnedPatch(
  base: Project,
  installed: Project,
  manifest: IceGrandExpanseOwnershipManifest,
): void {
  if (stableJson(stripOwnedArtifacts(installed, manifest)) !== stableJson(base)) {
    throw new IceGrandExpanseInstallError("UNRELATED_DATA_MUTATION", "Install changed data outside the ownership manifest");
  }
}

function ownershipManifest(index: number): IceGrandExpanseOwnershipManifest {
  return {
    mapId: ICE_GRAND_EXPANSE_MAP_ID,
    tree: { parentMapId: ICE_DIAGONAL_CANONICAL_SOURCE.mapId, index },
    fieldSpawnIds: ICE_GRAND_EXPANSE_FIELD_SPAWNS.map(({ id }) => id),
    eventIds: [...ICE_GRAND_EXPANSE_OWNED_EVENT_IDS],
    switchIds: [...ICE_GRAND_EXPANSE_OWNED_SWITCH_IDS],
    databaseRecordIds: [], globalStartIds: [], resourceIds: [], worldGraphIds: [],
  };
}

function expectedTreeIndex(parent: MapTreeNode, derivedPresent: boolean): number {
  const children = derivedPresent
    ? parent.children.filter(({ mapId }) => mapId !== ICE_GRAND_EXPANSE_MAP_ID)
    : parent.children;
  const adventures = children.flatMap(({ mapId }, index) => mapId === ICE_GRAND_ADVENTURE_MAP_ID ? [index] : []);
  if (adventures.length > 1) throw new IceGrandExpanseInstallError("CANONICAL_DRIFT", "Adventure tree node is duplicated");
  return adventures[0] === undefined ? children.length : adventures[0] + 1;
}

function findTreeNodes(root: MapTreeNode, mapId: string): MapTreeNode[] {
  const matches = root.mapId === mapId ? [root] : [];
  return root.children.reduce<MapTreeNode[]>((all, child) => [...all, ...findTreeNodes(child, mapId)], matches);
}

function assertDerivedContent(map: GameMap): void {
  const events = map.events.map(({ id }) => id);
  const spawns = map.fieldSpawns?.map(({ id }) => id) ?? [];
  if (stableJson(events) !== stableJson(ICE_GRAND_EXPANSE_OWNED_EVENT_IDS)
    || stableJson(spawns) !== stableJson(ICE_GRAND_EXPANSE_FIELD_SPAWNS.map(({ id }) => id))) {
    throw new IceGrandExpanseInstallError("INSTALL_INVARIANT", "Generated content differs from the frozen ownership manifest");
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(",")}}`;
}
