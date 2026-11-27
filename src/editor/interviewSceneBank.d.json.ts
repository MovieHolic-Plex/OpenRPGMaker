declare const bank: {
  readonly version: number;
  readonly styleVersion: number;
  readonly catalogSignature: string;
  readonly planned: number;
  readonly scenes: Record<string, { url: string; sha256: string; promptSha256: string }>;
};
export default bank;
