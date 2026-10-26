export type WebExportContractErrorCode =
  | "manifest-unavailable"
  | "manifest-malformed"
  | "manifest-contract-mismatch"
  | "manifest-incomplete"
  | "manifest-path-collision"
  | "bundle-unavailable"
  | "bundle-integrity-mismatch"
  | "runtime-asset-unavailable"
  | "runtime-asset-integrity-mismatch"
  | "zip-path-collision";

const ERROR_MESSAGES: Readonly<Record<WebExportContractErrorCode, string>> = Object.freeze({
  "manifest-unavailable": "The player deployment manifest is unavailable. Rebuild and redeploy the player.",
  "manifest-malformed": "The player deployment manifest is malformed. Rebuild and redeploy the player.",
  "manifest-contract-mismatch": "The player deployment manifest does not match the current contract.",
  "manifest-incomplete": "The player deployment manifest does not contain the complete player closure.",
  "manifest-path-collision": "The player deployment manifest contains colliding paths.",
  "bundle-unavailable": "A declared player bundle file is unavailable. Rebuild and redeploy the player.",
  "bundle-integrity-mismatch": "A declared player bundle file failed integrity verification.",
  "runtime-asset-unavailable": "A declared player runtime asset is unavailable. Redeploy the runtime assets.",
  "runtime-asset-integrity-mismatch": "A declared player runtime asset failed integrity verification.",
  "zip-path-collision": "The web export contains colliding ZIP paths.",
});

export class WebExportContractError extends Error {
  readonly code: WebExportContractErrorCode;
  /** Export-relative paths safe to show. Empty when the caller had nothing that passed the path check. */
  readonly paths: readonly string[];

  constructor(code: WebExportContractErrorCode, path?: string | readonly string[]) {
    const paths = shownExportPaths(path);
    const detail = paths.length === 0 ? "" : ` (${paths.join(", ")})`;
    super(`${ERROR_MESSAGES[code]}${detail}`);
    this.name = "WebExportContractError";
    this.code = code;
    this.paths = paths;
  }
}

export function contractFailure(code: WebExportContractErrorCode, path?: string | readonly string[]): never {
  throw new WebExportContractError(code, path);
}

const MAX_SHOWN_PATHS = 4;
const MAX_SHOWN_PATH_LENGTH = 300;

/**
 * A contract path may be shown on an export failure. Host paths, URLs, and thrown
 * messages may not — the toast is the only place a failed export explains itself.
 * The checks match `contractPath` in playerDeploymentPaths.ts, plus whitespace,
 * so a sentence cannot sneak through.
 */
function shownExportPaths(path: string | readonly string[] | undefined): readonly string[] {
  if (path === undefined) return Object.freeze([]);
  const values = typeof path === "string" ? [path] : path;
  const shown: string[] = [];
  for (const value of values) {
    if (shown.length === MAX_SHOWN_PATHS) break;
    const safe = shownExportPath(value);
    if (safe !== undefined && !shown.includes(safe)) shown.push(safe);
  }
  return Object.freeze(shown);
}

function shownExportPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (
    value.length === 0
    || value.length > MAX_SHOWN_PATH_LENGTH
    || value.includes("\0")
    || value.includes("\\")
    || value.includes("://")
    || /\s/u.test(value)
    || /%(?:2e|2f|5c)/iu.test(value)
    || value.startsWith("/")
    || /^[A-Za-z]:\//u.test(value)
  ) return undefined;
  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) return undefined;
  return value;
}
