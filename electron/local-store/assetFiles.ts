import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { LocalStoreError } from "./errors";

export function assetFileName(sha256: string, extension: string): string {
  if (!/^[a-f0-9]{64}$/.test(sha256) || !/^[a-zA-Z0-9]{1,12}$/.test(extension)) {
    throw new LocalStoreError("asset", "소재 파일 정보가 올바르지 않습니다.");
  }
  return `${sha256}.${extension}`;
}

export function assetHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function readVerifiedAsset(assetsDir: string, sha256: string, extension: string, expectedBytes: number): Uint8Array {
  const path = join(assetsDir, assetFileName(sha256, extension));
  if (!lstatSync(path).isFile()) throw new LocalStoreError("asset", "소재 경로가 일반 파일이 아닙니다.");
  const bytes = readFileSync(path);
  if (bytes.byteLength !== expectedBytes || assetHash(bytes) !== sha256) {
    throw new LocalStoreError("asset", `소재 파일이 손상되었습니다: ${sha256}. 정상 백업에서 복구하거나 원본 소재를 다시 가져오세요.`);
  }
  return bytes;
}

/** Commit bytes before registering their DB reference. An interrupted temporary file is never served. */
export function writeAssetFile(path: string, bytes: Uint8Array, sha256: string): void {
  if (existsSync(path)) {
    if (!lstatSync(path).isFile()) throw new LocalStoreError("asset", "소재 경로가 일반 파일이 아닙니다.");
    const existing = readFileSync(path);
    if (existing.byteLength === bytes.byteLength && assetHash(existing) === sha256) return;
  }
  const pending = `${path}.${randomUUID()}.pending`;
  let fd: number | undefined;
  try {
    fd = openSync(pending, "wx", 0o600);
    writeFileSync(fd, bytes);
    fsyncSync(fd);
    closeSync(fd); fd = undefined;
    renameSync(pending, path);
    // Windows does not support opening directories for fsync. File fsync and rename still apply.
    if (process.platform !== "win32") {
      const directory = openSync(dirname(path), "r");
      try { fsyncSync(directory); } finally { closeSync(directory); }
    }
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(pending)) unlinkSync(pending);
  }
}
