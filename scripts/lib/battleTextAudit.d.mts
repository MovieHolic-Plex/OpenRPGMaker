export interface InkBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface ScrollPortBox extends InkBox {
  readonly axisX: boolean;
  readonly axisY: boolean;
}

export interface InkVerdict {
  readonly clippedRatio: number;
  readonly slicedRatio: number;
  readonly scrollReachable: boolean;
}

export declare const MIN_INK_HEIGHT_PX: number;
export declare const MAX_CLIPPED_AREA_RATIO: number;
export declare const MIN_EFFECTIVE_ALPHA: number;

export declare function classifyInkGeometry(
  ink: InkBox,
  hardClip: InkBox | null,
  port: ScrollPortBox | null,
  tolerance?: number,
): InkVerdict;

export declare function auditBattleText(options: {
  readonly minInkHeight: number;
  readonly maxClippedAreaRatio: number;
  readonly minAlpha: number;
}): { readonly mounted: boolean; readonly nodes: readonly unknown[] };

export declare function summarizeAudit(runs: readonly unknown[]): {
  readonly total: number;
  readonly byReason: Record<string, number>;
  readonly failures: readonly Record<string, unknown>[];
  readonly pass: boolean;
};

export declare function renderAuditSummary(report: Record<string, unknown>): string;
