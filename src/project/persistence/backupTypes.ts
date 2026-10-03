export type ProjectBackupEntry = {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly revision: number;
  readonly assetCount: number;
};

export type RestoredProject = {
  readonly projectDir: string;
  readonly projectId: string;
  readonly sha256: string;
  readonly title: string;
};
