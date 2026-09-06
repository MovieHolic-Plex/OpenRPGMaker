import * as nativeFs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { AiJobsRepositoryError, canonicalJson, requireValue, sha256, validateRef } from './validation.mjs';

/** Local filesystem only. A short exclusive guard serializes acquisition/reclamation.
 * Confirmed-dead local owners are recoverable; ambiguous owners/abandoned guards fail closed. */
export async function openStorage({ directory, fileOps = {} }) {
  const fs = { ...nativeFs, ...fileOps };
  requireValue(typeof directory === 'string' && directory.length > 0, 'Storage directory required');
  const root = resolve(directory);
  requireValue(!root.split(sep).some(p => p === 'public' || p === 'dist'), 'Storage must be outside public/dist');
  async function syncDirectory(path) {
    const handle = await fs.open(path, 'r');
    try { await handle.sync(); } finally { await handle.close(); }
  }
  async function mkdir(path) {
    const firstCreated = await fs.mkdir(path, { recursive: true, mode: 0o700 });
    if (firstCreated) {
      let current = path;
      while (true) {
        await syncDirectory(dirname(current));
        if (current === firstCreated) break;
        current = dirname(current);
      }
    }
  }
  await mkdir(root);
  requireValue(!(await fs.realpath(root)).split(sep).some(p => p === 'public' || p === 'dist'), 'Storage resolves inside public/dist');
  const lock = join(root, 'writer.lock');
  const guard = join(root, 'writer.guard');
  let ownsLock = false;
  const locked = (cause) => new AiJobsRepositoryError('WRITER_LOCKED', 'Writer is active or ownership is uncertain; never remove locks while service instances are running', { cause });
  async function close() { await fs.rm(lock, { recursive: true }); await syncDirectory(root); }
  async function atomic(path, bytes) {
    const temp = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    let renamed = false;
    try {
      const handle = await fs.open(temp, 'wx', 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
      await fs.rename(temp, path);
      renamed = true;
      await syncDirectory(dirname(path));
    } catch (cause) {
      throw new AiJobsRepositoryError(renamed ? 'DURABILITY_UNKNOWN' : 'PERSISTENCE_FAILED', renamed ? 'Rename completed but directory sync failed; close and reopen before any further work' : 'Durable write failed before replacement', { cause });
    } finally { if (!renamed) await fs.rm(temp, { force: true }); }
  }
  try {
    try { await fs.mkdir(guard, { mode: 0o700 }); }
    catch (cause) { if (cause.code === 'EEXIST') throw locked(cause); throw cause; }
    try {
      try { await fs.mkdir(lock, { mode: 0o700 }); }
      catch (cause) {
        if (cause.code !== 'EEXIST') throw cause;
        let owner;
        try { owner = JSON.parse(await fs.readFile(join(lock, 'owner.json'), 'utf8')); }
        catch (error) { throw locked(error); }
        if (owner?.hostname !== hostname() || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || typeof owner.token !== 'string' || !owner.token) throw locked(cause);
        let dead = false;
        try { process.kill(owner.pid, 0); }
        catch (error) { if (error.code === 'ESRCH') dead = true; else throw locked(error); }
        if (!dead) throw locked(cause); // PID reuse conservatively counts as a live owner.
        // Every new owner holds guard, so no contender can replace this dead owner's
        // lock between our liveness check and removal. No check-then-unlink race.
        await fs.rm(lock, { recursive: true });
        await fs.mkdir(lock, { mode: 0o700 });
      }
      ownsLock = true;
      await atomic(join(lock, 'owner.json'), Buffer.from(JSON.stringify({ pid: process.pid, hostname: hostname(), token: randomUUID() })));
      await syncDirectory(root);
    } finally { await fs.rm(guard, { recursive: true }); await syncDirectory(root); }
    const entries = await fs.readdir(root);
    const fresh = entries.every(name => name === 'writer.lock');
    await mkdir(join(root, 'blobs'));
    async function read(ref) {
      validateRef(ref);
      let bytes;
      try { bytes = await fs.readFile(join(root, 'blobs', ref.sha256)); }
      catch (cause) { throw new AiJobsRepositoryError('CORRUPT_STORAGE', 'Referenced blob cannot be read', { cause }); }
      if (bytes.length !== ref.byteLength || sha256(bytes) !== ref.sha256) throw new AiJobsRepositoryError('CORRUPT_STORAGE', 'Blob hash/length mismatch');
      return bytes;
    }
    async function readJson(ref) {
      requireValue(ref.mediaType === 'application/json', 'JSON blob media type required');
      const bytes = await read(ref);
      try { return JSON.parse(bytes.toString('utf8')); }
      catch (cause) { throw new AiJobsRepositoryError('CORRUPT_STORAGE', 'Malformed JSON blob', { cause }); }
    }
    return {
      close, read, readJson,
      async put(bytes, mediaType) {
        const ref = { sha256: sha256(bytes), byteLength: bytes.length, mediaType };
        validateRef(ref);
        const path = join(root, 'blobs', ref.sha256);
        try { await fs.access(path); }
        catch (error) {
          if (error.code !== 'ENOENT') throw error;
          await atomic(path, bytes);
          return ref;
        }
        await read(ref);
        // An earlier failed transaction may have left this blob before directory sync.
        const handle = await fs.open(path, 'r');
        try { await handle.sync(); } finally { await handle.close(); }
        await syncDirectory(dirname(path));
        return ref;
      },
      async load() {
        let bytes;
        try { bytes = await fs.readFile(join(root, 'metadata.json'), 'utf8'); }
        catch (cause) {
          if (cause.code === 'ENOENT' && fresh) return null;
          throw new AiJobsRepositoryError('CORRUPT_STORAGE', 'Metadata missing or unreadable; no automatic reset', { cause });
        }
        try {
          const envelope = JSON.parse(bytes);
          requireValue(Object.keys(envelope).sort().join(',') === 'sha256,snapshot,version' && envelope.version === 1 && sha256(canonicalJson(envelope.snapshot)) === envelope.sha256, 'Metadata checksum/version mismatch');
          return envelope.snapshot;
        } catch (cause) { throw new AiJobsRepositoryError('CORRUPT_STORAGE', 'Malformed metadata; preserve files for recovery', { cause }); }
      },
      async save(snapshot) {
        const envelope = { version: 1, sha256: sha256(canonicalJson(snapshot)), snapshot };
        await atomic(join(root, 'metadata.json'), Buffer.from(canonicalJson(envelope)));
      },
    };
  } catch (error) {
    if (ownsLock) {
      try { await close(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Storage initialization and lock cleanup failed'); }
    }
    throw error;
  }
}
