declare const data: {
  readonly entries: readonly {
    readonly kind: string;
    readonly id: string;
    readonly status?: unknown;
    readonly result?: {
      readonly audio_available?: unknown;
      readonly description?: unknown;
    } | null;
  }[];
  readonly [key: string]: unknown;
};
export default data;
