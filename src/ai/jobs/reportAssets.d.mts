import type { BlobRef } from "./contracts";
export function parseReportAssets(value: unknown, check?: (condition: boolean, message: string) => void): Record<string, BlobRef>;
