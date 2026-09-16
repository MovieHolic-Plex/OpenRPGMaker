export class LocalStoreError extends Error {
  readonly name = "LocalStoreError";

  constructor(readonly code: LocalStoreFault, message: string) {
    super(message);
  }
}

export type LocalStoreFault =
  | "not-a-store"
  | "format"
  | "cas"
  | "backup-path"
  | "row"
  | "asset"
  | "usage";
