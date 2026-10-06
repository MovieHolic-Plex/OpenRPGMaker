import { findCharsetAsset } from '../../../assets/charsetCatalog';
import { createBlankProject } from '../../../project/defaults/blankProject';
import { deserialize, serialize } from '../../../project/io/serialize';
import { canonicalJsonOf } from '../../../project/persistence/core/canonicalJson';
import type { SharedContentLibrary } from '../../../project/sharedContentSchema';
import type { AssetRef, GameMap, Project, SwitchDef } from '../../../project/types';

export interface NativeSceneProjectInput {
  readonly title: string;
  readonly library: SharedContentLibrary;
  readonly maps: GameMap[];
  readonly startMapId: string;
  readonly startPos: { x: number; y: number };
  readonly switches?: SwitchDef[];
  /** Walking CharSet resource (slot zero); action sprites belong to events. */
  readonly playerSprite?: AssetRef;
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (canonicalJsonOf(actual) !== canonicalJsonOf(expected)) throw new Error(`${label} changed during normalization`);
}

function inBounds(map: GameMap, x: number, y: number): boolean {
  return Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function validateMap(map: GameMap, library: SharedContentLibrary): void {
  const tileset = library.tilesets[map.tilesetId];
  if (!tileset || !Object.hasOwn(library.tilesets, map.tilesetId) || tileset.id !== map.tilesetId) {
    throw new Error(`Map tileset must belong to the native library: ${map.id}`);
  }
  if (!Number.isSafeInteger(map.width) || !Number.isSafeInteger(map.height) || map.width < 1 || map.height < 1
    || !Number.isSafeInteger(map.width * map.height) || map.tileSize !== tileset.tileSize
    || !Number.isSafeInteger(tileset.count) || tileset.count < 1) throw new Error(`Invalid map/tileset geometry: ${map.id}`);
  const cells = map.width * map.height;
  for (const key of ['lowerTiles', 'upperTiles', 'lowerOverlayTiles', 'upperOverlayTiles'] as const) {
    const layer = map[key];
    if (layer === undefined && key !== 'lowerTiles' && key !== 'upperTiles') continue;
    if (!Array.isArray(layer) || layer.length !== cells) throw new Error(`Invalid ${map.id}.${key} length`);
    for (let index = 0; index < layer.length; index++) {
      const tile = layer[index];
      if (typeof tile !== 'number' || !Number.isSafeInteger(tile) || tile < -1 || tile >= tileset.count) {
        throw new Error(`Invalid ${map.id}.${key}[${index}] tile: ${tile}`);
      }
    }
  }
  if (map.shadowBits !== undefined) {
    if (!Array.isArray(map.shadowBits) || map.shadowBits.length !== cells) throw new Error(`Invalid ${map.id}.shadowBits length`);
    for (let index = 0; index < cells; index++) {
      const bits = map.shadowBits[index];
      if (typeof bits !== 'number' || !Number.isSafeInteger(bits) || bits < 0 || bits > 15) throw new Error(`Invalid ${map.id}.shadowBits[${index}]`);
    }
  }
  // These fields survive old schema loads but their pixels no longer render.
  if (Object.keys(map.lowerTileStacks ?? {}).length || Object.keys(map.upperTileStacks ?? {}).length) {
    throw new Error(`Retired tile stacks are not supported in native scenes: ${map.id}`);
  }
  if (!Array.isArray(map.events)) throw new Error(`Map events must be an array: ${map.id}`);
  const ids = new Set<string>();
  for (const event of map.events) {
    if (typeof event.id !== 'string' || !event.id.trim() || ids.has(event.id)) throw new Error(`Blank/duplicate event ID: ${map.id}`);
    ids.add(event.id);
    if (!inBounds(map, event.x, event.y)) throw new Error(`Event lies outside its map: ${map.id}/${event.id}`);
  }
}

/** Assemble a current-schema packet without I/O, catalog installation, publication, or saving. */
export function createNativeSceneProject(input: NativeSceneProjectInput): Project {
  if (input.library.version !== 1 || input.library.projectDefaults !== true) throw new Error('Native library must be version 1 and projectDefaults');
  if (typeof input.title !== 'string' || !input.title.trim()) throw new Error('A native scene title is required');
  if (!Array.isArray(input.maps) || !input.maps.length) throw new Error('At least one native map is required');
  const library = structuredClone(input.library), maps = structuredClone(input.maps);
  const mapIds = new Set<string>();
  for (const map of maps) {
    if (typeof map.id !== 'string' || !map.id.trim() || mapIds.has(map.id)) throw new Error('Native map IDs must be nonblank and unique');
    mapIds.add(map.id);
    validateMap(map, library);
  }
  const startMap = maps.find(map => map.id === input.startMapId);
  if (!startMap || !inBounds(startMap, input.startPos.x, input.startPos.y)) throw new Error('Native start map/position is invalid');

  const project = createBlankProject();
  // createBlankProject may see a process catalog: keep only its actual built-in sprite definitions.
  const builtinSprites = Object.fromEntries(Object.entries(project.assets.sprites)
    .filter(([, sprite]) => sprite.image.type === 'bundled'));
  const previousUploadIds = new Set(Object.keys(project.assets.uploaded));
  project.assets = { uploaded: structuredClone(library.assets), sprites: { ...builtinSprites, ...structuredClone(library.sprites ?? {}) } };
  project.resourceProfiles = project.resourceProfiles.filter(profile => profile.assetId === undefined || !previousUploadIds.has(profile.assetId));
  project.charsetLabels = (project.charsetLabels ?? []).filter(label => !previousUploadIds.has(label.textureKey));
  for (const [id, asset] of Object.entries(project.assets.uploaded)) {
    if (asset.id !== id) throw new Error(`Library asset ID mismatch: ${id}`);
  }
  for (const [id, sprite] of Object.entries(library.sprites ?? {})) {
    if (sprite.id !== id || (sprite.image.type === 'uploaded' && !Object.hasOwn(library.assets, sprite.image.id))) {
      throw new Error(`Library sprite is not owned by its image library: ${id}`);
    }
  }
  project.meta.title = input.title;
  project.tilesets = structuredClone(library.tilesets);
  project.maps = Object.fromEntries(maps.map(map => [map.id, map]));
  project.mapTree = { mapId: input.startMapId, children: maps.filter(map => map.id !== input.startMapId)
    .map(map => ({ mapId: map.id, children: [] })) };
  project.startMapId = input.startMapId;
  project.startPos = structuredClone(input.startPos);
  project.mapConnections = [];
  delete project.system.opening;

  const switchIds = new Set<string>();
  for (const def of input.switches ?? []) {
    if (typeof def.id !== 'string' || !def.id.trim() || typeof def.name !== 'string' || switchIds.has(def.id)) {
      throw new Error('Native switch IDs must be nonblank and unique with string names');
    }
    switchIds.add(def.id);
    const index = project.switches.findIndex(existing => existing.id === def.id);
    if (index < 0) project.switches.push(structuredClone(def));
    else project.switches[index] = structuredClone(def);
    project.session.switches[def.id] = false;
  }
  if (input.playerSprite) {
    const ref = input.playerSprite;
    const sprite = project.assets.sprites[ref.id];
    const resourceId = sprite?.image.id ?? ref.id;
    const uploaded = project.assets.uploaded[resourceId];
    const isUploaded = ref.type === 'uploaded' && (!sprite || sprite.image.type === 'uploaded') && uploaded?.kind === 'charset';
    const isBundled = ref.type === 'bundled' && (!sprite || sprite.image.type === 'bundled') && !!findCharsetAsset(resourceId);
    if (!isUploaded && !isBundled) throw new Error('Native playerSprite must resolve to a library or built-in walking CharSet');
    const actor = project.database.actors.find(row => row.id === project.system.startActorIds[0]);
    if (!actor) throw new Error('Baseline player actor is missing');
    actor.characterResourceId = resourceId;
    // The actor model's canonical representation omits slot zero on load.
    // Author that representation so a harmless normalization is not a mismatch.
    delete actor.characterIndex;
    delete actor.appearanceId;
  }
  const normalized = deserialize(serialize(project));
  assertEqual(normalized.maps, project.maps, 'Native maps/events');
  assertEqual(normalized.assets.sprites, project.assets.sprites, 'Native SpriteDef geometry/anchors');
  assertEqual(normalized.assets.uploaded, project.assets.uploaded, 'Native image assets');
  assertEqual(normalized.mapTree, project.mapTree, 'Native map tree');
  assertEqual(normalized.startPos, project.startPos, 'Native start position');
  assertEqual(normalized.switches, project.switches, 'Native switch definitions');
  if (input.playerSprite) {
    const actorId = project.system.startActorIds[0];
    const graphic = (value: Project) => {
      const actor = value.database.actors.find(row => row.id === actorId);
      return { resourceId: actor?.characterResourceId, characterIndex: actor?.characterIndex, appearanceId: actor?.appearanceId };
    };
    assertEqual(graphic(normalized), graphic(project), 'Native player graphic');
  }
  if (normalized.startMapId !== project.startMapId || normalized.system.opening !== undefined) throw new Error('Native startup changed during normalization');
  return normalized;
}
