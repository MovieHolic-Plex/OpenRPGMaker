import { createHash } from 'node:crypto';
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { initLocalProjectStore, openLocalProjectStore } from '../../../../electron/local-store/store';
import type { LocalStoreSaveResult } from '../../../../electron/local-store/store';
import { readSharedContentLibrary, sharedContentFile } from '../../../../scripts/lib/sharedContentSqlite';
import { deserialize, serialize } from '../../../project/io/serialize';
import { canonicalJsonOf } from '../../../project/persistence/core/canonicalJson';
import { dataUrlExtension, dataUrlMime, decodeDataUrlBytes } from '../../../project/persistence/core/dataUrl';
import { ensureSharedContent, installSharedContent, sharedContentSnapshot } from '../../../project/sharedContent';
import type { Project, UploadedAsset } from '../../../project/types';

export interface NativeSpaceProjectInput {
  readonly project: Project;
  readonly projectDir: string;
  readonly evidenceDir: string;
  readonly libraryId: string;
  /** Current approved fingerprints supplied by the supervising caller. */
  readonly selections: Record<string, string>;
}

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (canonicalJsonOf(actual) !== canonicalJsonOf(expected)) throw new Error(`${label} differs`);
}

function assertEmptyDestination(projectDir: string): void {
  if (!existsSync(projectDir)) return;
  const entry = lstatSync(projectDir);
  if (entry.isSymbolicLink() || !entry.isDirectory()) throw new Error('Destination must be a real directory');
  if (existsSync(join(projectDir, 'project.sqlite')) || readdirSync(projectDir).length !== 0) {
    throw new Error('Native installation requires a new or empty destination; existing projects are never opened');
  }
}

function assetMetadata(asset: UploadedAsset) {
  const { dataUrl: _inline, ref: _ref, ...metadata } = asset;
  return metadata;
}

/** Persist already authored native content; this does not approve, publish, or play it. */
export async function saveNativeSpaceProject(input: NativeSpaceProjectInput) {
  const projectDir = resolve(input.projectDir), evidenceDir = resolve(input.evidenceDir);
  const selections = structuredClone(input.selections);
  if (!Object.keys(selections).length || Object.entries(selections).some(([id, value]) =>
    !id.trim() || typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value))) {
    throw new Error('At least one current 64-hex approved selection fingerprint is required');
  }
  if (!/^[\w.-]{1,100}$/.test(input.libraryId)) throw new Error('Invalid shared library ID');
  assertEmptyDestination(projectDir);
  const proofFile = join(evidenceDir, 'canonical-proof.json');
  if (existsSync(proofFile)) throw new Error('Evidence already has a canonical proof; use a fresh evidence directory');
  // The shared reader may initialize an absent database. This adapter only reads an existing catalog.
  if (!existsSync(sharedContentFile())) throw new Error('Publish the approved shared library before installation');
  const published = readSharedContentLibrary(input.libraryId);
  if (published?.library.projectDefaults !== true) throw new Error('An existing projectDefaults shared library is required');
  const library = published.library;
  const project = structuredClone(input.project);
  const authoredMaps = structuredClone(project.maps);
  const authoredSprites = structuredClone(project.assets.sprites);
  if (!Object.keys(authoredMaps).length) throw new Error('At least one authored map is required');
  for (const [id, map] of Object.entries(authoredMaps)) {
    if (map.id !== id || !Object.hasOwn(library.tilesets, map.tilesetId)) {
      throw new Error(`Authored map must use this library's tileset: ${id}`);
    }
  }
  const images = new Map<string, { asset: UploadedAsset; bytes: Uint8Array; mime: string; extension: string }>();
  for (const [id, asset] of Object.entries(library.assets)) {
    if (!id.startsWith('shared_') || asset.id !== id) throw new Error(`Invalid shared asset ownership: ${id}`);
    const mime = dataUrlMime(asset.dataUrl ?? '');
    if (!mime?.startsWith('image/') || !asset.dataUrl) throw new Error(`Library image bytes are required: ${id}`);
    const bytes = decodeDataUrlBytes(asset.dataUrl);
    if (!bytes.length || (asset.ref && asset.ref.sha256 !== hash(bytes))) throw new Error(`Invalid library bytes: ${id}`);
    images.set(id, { asset, bytes, mime, extension: dataUrlExtension(asset.dataUrl, mime) });
  }
  if (!images.size) throw new Error('The shared library has no native image assets');
  for (const [id, asset] of Object.entries(project.assets.uploaded)) {
    const source = images.get(id);
    if (!source || asset.id !== id) throw new Error(`Uploaded asset is not owned by this library: ${id}`);
    assertEqual(assetMetadata(asset), assetMetadata(source.asset), `Supplied asset metadata ${id}`);
    if (asset.dataUrl && hash(decodeDataUrlBytes(asset.dataUrl)) !== hash(source.bytes)) {
      throw new Error(`Supplied image differs from its published source: ${id}`);
    }
    if (asset.ref && asset.ref.sha256 !== hash(source.bytes)) throw new Error(`Supplied asset ref differs: ${id}`);
  }

  const previousCatalog = sharedContentSnapshot();
  let reservation: string | undefined;
  try {
    await installSharedContent({ revision: published.revision, libraries: { [input.libraryId]: library } });
    ensureSharedContent(project);
    assertEqual(project.maps, authoredMaps, 'Shared projection changed authored maps/events');
    for (const [id, sprite] of Object.entries(authoredSprites)) {
      assertEqual(project.assets.sprites[id], sprite, `Shared projection changed supplied sprite ${id}`);
    }
    for (const [id, sprite] of Object.entries(library.sprites ?? {})) {
      assertEqual(project.assets.sprites[id], sprite, `Shared sprite projection ${id}`);
    }
    for (const map of Object.values(project.maps)) {
      assertEqual(project.tilesets[map.tilesetId], library.tilesets[map.tilesetId], `Map tileset projection ${map.tilesetId}`);
    }
    // Reject normalization that would rewrite authored content before creating a destination.
    const validated = deserialize(serialize(project));
    assertEqual(validated.maps, authoredMaps, 'Serialized maps/events');
    assertEqual(validated.assets.sprites, project.assets.sprites, 'Serialized sprite definitions');
    const sprites = structuredClone(project.assets.sprites);

    assertEmptyDestination(projectDir);
    mkdirSync(projectDir, { recursive: true });
    assertEmptyDestination(projectDir);
    const lockFile = join(projectDir, '.native-space-install.lock');
    closeSync(openSync(lockFile, 'wx'));
    reservation = lockFile;
    if (readdirSync(projectDir).some(file => file !== '.native-space-install.lock')) {
      throw new Error('Destination changed while installation was being prepared');
    }
    const store = await initLocalProjectStore({ projectDir });
    const projectId = store.projectId;
    let saved: Extract<LocalStoreSaveResult, { kind: 'saved' }>;
    try {
      for (const [id, image] of images) {
        const asset = project.assets.uploaded[id];
        if (!asset) throw new Error(`Shared asset was not projected: ${id}`);
        const ref = await store.putAsset(image.bytes, {
          mime: image.mime, extension: image.extension, originalName: asset.name, kind: asset.kind,
        });
        delete asset.dataUrl;
        asset.ref = ref;
      }
      const prepared = deserialize(serialize(project));
      assertEqual(prepared.maps, authoredMaps, 'Prepared maps/events');
      assertEqual(prepared.assets.sprites, sprites, 'Prepared sprite definitions');
      const result = await store.saveProject(project);
      if (result.kind !== 'saved') throw new Error(`Canonical save failed: ${result.kind}`);
      saved = result;
    } finally { store.close(); }

    const reopened = await openLocalProjectStore({ projectDir });
    try {
      const snapshot = reopened.loadSnapshot();
      if (!snapshot || reopened.projectId !== projectId || snapshot.sha256 !== saved.sha256
        || snapshot.revision !== saved.revision) throw new Error('Canonical reload identity/hash mismatch');
      assertEqual(snapshot.project.maps, authoredMaps, 'Reloaded maps/events');
      assertEqual(snapshot.project.assets.sprites, sprites, 'Reloaded sprite definitions');
      assertEqual(snapshot.project.assets.uploaded, project.assets.uploaded, 'Reloaded asset metadata/refs');
      for (const [id, image] of images) {
        const ref = snapshot.project.assets.uploaded[id]?.ref;
        if (!ref || ref.sha256 !== hash(image.bytes)) throw new Error(`Reloaded image ref differs: ${id}`);
        const actual = await reopened.assetBytes(ref.sha256);
        if (!Buffer.from(actual).equals(Buffer.from(image.bytes))) throw new Error(`Reloaded image bytes differ: ${id}`);
      }
      // A publication may advance while we save. Never issue a proof for a stale revision.
      if (readSharedContentLibrary(input.libraryId)?.revision !== published.revision) {
        throw new Error('Shared library changed during installation; no proof was issued');
      }
      const proof = {
        projectId, projectDir, maps: Object.values(snapshot.project.maps).map(map => ({
          id: map.id, name: map.name, width: map.width, height: map.height, tilesetId: map.tilesetId,
          events: map.events.length,
        })), revision: snapshot.revision, sha256: snapshot.sha256,
        selections, libraryId: input.libraryId, libraryRevision: published.revision,
        canonicalReload: true, publicRegistered: true, runtimePassed: false,
      };
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(proofFile, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
      return proof;
    } finally { reopened.close(); }
  } finally {
    try { if (reservation) unlinkSync(reservation); }
    finally { await installSharedContent(previousCatalog); }
  }
}
