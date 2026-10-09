import type { Project, UploadedAsset } from "@/project/types";

export type WebExportAsset =
  | {
      readonly kind: "public";
      /** A public path, or a configured catalog CDN URL fetched into zipPath. */
      readonly sourcePath: string;
      readonly zipPath: string;
      readonly resourceId?: string;
    }
  | {
      readonly kind: "uploaded";
      readonly asset: UploadedAsset;
      readonly zipPath: string;
    };

export interface WebExportSummary {
  readonly mapCount: number;
  readonly assetCount: number;
  readonly uploadedAssetCount: number;
  readonly publicAssetCount: number;
  readonly estimatedSizeBytes: number;
  readonly projectJsonBytes: number;
}

export interface PreparedWebExport {
  readonly project: Project;
  readonly projectJson: string;
  readonly assets: readonly WebExportAsset[];
  readonly summary: WebExportSummary;
}

export interface WebExportPackageResult {
  readonly blob: Blob;
  readonly summary: WebExportSummary & {
    readonly playerBundleFileCount: number;
    readonly zipEntryCount: number;
  };
}
