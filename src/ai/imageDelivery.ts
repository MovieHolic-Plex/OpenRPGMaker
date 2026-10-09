/** Positions in this completion's actual request, acknowledged only after provider success. */
export interface ImageDelivery {
  readonly messageIndex: number;
  readonly partIndex: number;
}

export function parseImageDelivery(value: unknown): readonly ImageDelivery[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: ImageDelivery[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object" || !("messageIndex" in entry) || !("partIndex" in entry)
      || typeof entry.messageIndex !== "number" || typeof entry.partIndex !== "number"
      || !Number.isSafeInteger(entry.messageIndex) || entry.messageIndex < 0
      || !Number.isSafeInteger(entry.partIndex) || entry.partIndex < 0) return undefined;
    result.push({ messageIndex: entry.messageIndex, partIndex: entry.partIndex });
  }
  return result;
}
