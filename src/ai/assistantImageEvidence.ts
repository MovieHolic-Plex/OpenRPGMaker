import type { GameMap, Project } from "@/project/types";
import { acceptanceRecord, parseAcceptanceRegion, type AcceptanceRegion } from "./assistantAcceptance";
import { validRegion, visualFingerprint } from "./assistantAcceptanceEvaluation";

export interface AcceptanceImageReceipt {
  readonly mapId: string;
  readonly region: AcceptanceRegion;
  readonly fingerprint: string;
}

/** One session's rendered-image lifetime, shared by acceptance and adventure coverage. */
export class AssistantImageEvidence {
  private readonly captured = new Set<AcceptanceImageReceipt>();
  private readonly delivered = new Set<AcceptanceImageReceipt>();

  clear(): void { this.captured.clear(); this.delivered.clear(); }

  capture(project: Project, data: unknown): AcceptanceImageReceipt | null {
    if (!acceptanceRecord(data) || typeof data.mapId !== "string") return null;
    const map = project.maps[data.mapId], region = parseAcceptanceRegion(data);
    if (!map || !region || !validRegion(map, region)) return null;
    const receipt = { mapId: map.id, region, fingerprint: visualFingerprint(project, map) };
    this.captured.add(receipt);
    return receipt;
  }

  /** Only after successful rendering and insertion into the next model input. */
  deliver(receipts: readonly AcceptanceImageReceipt[]): void {
    for (const receipt of receipts) if (this.captured.has(receipt)) this.delivered.add(receipt);
  }

  /** Read applied-state evidence without retiring captures of an unapplied draft. */
  matching(project: Project): readonly AcceptanceImageReceipt[] {
    return [...this.delivered].filter(receipt => {
      const map = project.maps[receipt.mapId];
      return map && receipt.fingerprint === visualFingerprint(project, map);
    });
  }

  /** Retire evidence only against the current authored content, never an older applied view. */
  current(project: Project): readonly AcceptanceImageReceipt[] {
    for (const receipt of this.captured) {
      const map = project.maps[receipt.mapId];
      if (!map || receipt.fingerprint !== visualFingerprint(project, map)) {
        // Retire pending captures too: show/write/undo in one response cannot revive them.
        this.captured.delete(receipt);
        this.delivered.delete(receipt);
      }
    }
    return [...this.delivered];
  }
}

export function coveredByImages(receipts: readonly AcceptanceImageReceipt[], map: GameMap, region: AcceptanceRegion): boolean {
  if (!validRegion(map, region)) return false;
  const candidates = receipts.filter(receipt => receipt.mapId === map.id);
  // Exact union coverage, not summed rectangle areas (overlap must not count twice).
  for (let y = region.y; y < region.y + region.h; y += 1) {
    const spans = candidates.filter(({ region: r }) => y >= r.y && y < r.y + r.h)
      .map(({ region: r }) => [Math.max(region.x, r.x), Math.min(region.x + region.w, r.x + r.w)])
      .sort(([a], [b]) => a - b);
    let end = region.x;
    for (const [left, right] of spans) {
      if (left > end) break;
      end = Math.max(end, right);
    }
    if (end < region.x + region.w) return false;
  }
  return true;
}
