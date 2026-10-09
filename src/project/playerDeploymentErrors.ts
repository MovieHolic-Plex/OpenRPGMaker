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

  constructor(code: WebExportContractErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "WebExportContractError";
    this.code = code;
  }
}

export function contractFailure(code: WebExportContractErrorCode): never {
  throw new WebExportContractError(code);
}
