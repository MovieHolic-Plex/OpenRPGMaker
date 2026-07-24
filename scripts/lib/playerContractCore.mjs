import { createHash } from "node:crypto";
import path from "node:path";
import { unicodeCaseFoldKey } from "../../src/project/unicodeCaseFold.js";

export const PLAYER_ARTIFACT_CONTRACT = Object.freeze({
  sentinel: "rpg-zzu/player-sdk-manifest",
  contractVersion: 2,
  schemaVersion: 4,
  manifestFile: "sdk-manifest.json",
});

export class PlayerArtifactContractError extends Error {
  name = "PlayerArtifactContractError";

  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const compareContractPaths = (left, right) => left < right ? -1 : left > right ? 1 : 0;
export const sha256Value = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const playerPathCollisionKey = unicodeCaseFoldKey;
export const contractFail = (code, message) => { throw new PlayerArtifactContractError(code, message); };

export function normalizeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    contractFail("invalid-path", "artifact path must be a non-empty string");
  }
  const slashPath = value.replaceAll("\\", "/");
  if (slashPath.includes("://") || /%(?:2e|2f|5c)/iu.test(slashPath)) {
    contractFail("invalid-path", "artifact path must not contain encoded traversal or a URL scheme");
  }
  const normalized = path.posix.normalize(slashPath);
  if (
    normalized === "."
    || normalized === ".."
    || normalized.startsWith("../")
    || normalized.startsWith("/")
    || /^[A-Za-z]:\//u.test(normalized)
  ) {
    contractFail("invalid-path", "artifact path must remain relative");
  }
  return normalized;
}

export function assertUniquePlayerPaths(paths, label = "paths") {
  const seen = new Set();
  for (const filePath of paths) {
    const key = playerPathCollisionKey(filePath);
    if (seen.has(key)) contractFail("duplicate-path", `${label} contains colliding paths`);
    seen.add(key);
  }
}

export function validateFileRecords(value, label, options = {}) {
  if (!Array.isArray(value) || (!options.allowEmpty && value.length === 0)) {
    contractFail("malformed-manifest", `${label} must be a non-empty array`);
  }
  const records = value.map((entry) => {
    if (!entry || typeof entry !== "object") contractFail("malformed-manifest", `${label} contains an invalid entry`);
    const relativePath = normalizeRelativePath(entry.path);
    if (
      entry.path !== relativePath
      || !Number.isInteger(entry.bytes)
      || entry.bytes < 0
      || !/^[a-f0-9]{64}$/u.test(entry.sha256)
    ) {
      contractFail("malformed-manifest", `${label} contains invalid metadata`);
    }
    return Object.freeze({ path: relativePath, bytes: entry.bytes, sha256: entry.sha256 });
  });
  const sorted = [...records].sort((left, right) => compareContractPaths(left.path, right.path));
  assertUniquePlayerPaths(sorted.map((entry) => entry.path), label);
  if (options.requireSorted && records.some((entry, index) => entry.path !== sorted[index].path)) {
    contractFail("unsorted-manifest", `${label} must be sorted by path`);
  }
  return Object.freeze(sorted);
}

export function digestFileRecords(records) {
  const canonical = validateFileRecords(records, "file records", { allowEmpty: true });
  return sha256Value(JSON.stringify(canonical.map((entry) => [entry.path, entry.bytes, entry.sha256])));
}
