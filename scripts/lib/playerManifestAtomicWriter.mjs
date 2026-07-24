import { randomUUID } from "node:crypto";
import { open, rename, rm as nativeRemove } from "node:fs/promises";
import path from "node:path";
import { PlayerArtifactContractError } from "./playerContractCore.mjs";

const ATOMIC_FAILURE_CODE = "atomic-write-failed";
const ATOMIC_FAILURE_MESSAGE = "player manifest atomic replacement failed";

export async function replaceManifestAtomically({ manifestPath, manifest, atomicFileOps = {} }) {
  const serialize = atomicFileOps.serialize ?? ((value) => `${JSON.stringify(value, null, 2)}\n`);
  const openFile = atomicFileOps.open ?? open;
  const renameFile = atomicFileOps.rename ?? rename;
  const removeFile = atomicFileOps.remove ?? nativeRemove;
  const tempPath = path.join(
    path.dirname(manifestPath),
    `.${path.basename(manifestPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;
  let tempExists = false;
  try {
    const payload = serialize(manifest);
    if (typeof payload !== "string") throw new TypeError("atomic serializer returned non-text");
    handle = await openFile(tempPath, "wx", 0o600);
    tempExists = true;
    await handle.writeFile(payload, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await renameFile(tempPath, manifestPath);
    tempExists = false;
  } catch {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch {
        // Best-effort cleanup; the outward failure remains typed and value-free.
      }
    }
    if (tempExists) {
      try {
        await removeFile(tempPath, { force: true });
      } catch {
        try {
          await nativeRemove(tempPath, { force: true });
        } catch {
          // Best effort only; neither cleanup failure is exposed.
        }
      }
    }
    throw new PlayerArtifactContractError(ATOMIC_FAILURE_CODE, ATOMIC_FAILURE_MESSAGE);
  }
}
