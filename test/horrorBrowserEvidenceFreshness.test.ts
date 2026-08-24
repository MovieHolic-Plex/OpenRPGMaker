import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  HORROR_MYSTERY_PROJECT_ID,
} from "../src/project/examples/horrorMysteryPrototype";
import {
  readHorrorBrowserEvidence,
  CAPTURE_HORROR_BROWSER_EVIDENCE_NAME,
} from "../scripts/lib/horror-browser-evidence.mjs";

/**
 * The break: `qa:horror` (Slice A target) used to read a pre-existing
 * browser-qa.json that a human maintained by hand. A stale manual JSON could satisfy
 * QA with zero browser, because nothing enforced freshness or provenance.
 *
 * This test names that break: aging a copy of the evidence beyond the freshness
 * window must be rejected — it must not silently satisfy QA. Provenance (capturedBy)
 * is the second half: a forged/stale file must carry the automated capture signature.
 */
describe("horror browser evidence freshness & provenance", () => {
  function writeStaleEvidence(extra: Record<string, unknown>, copiedAt: string): string {
    const dir = mkdtempSync(join(tmpdir(), "hbv-"));
    const file = join(dir, "browser-qa.json");
    writeFileSync(file, JSON.stringify({
      projectId: HORROR_MYSTERY_PROJECT_ID,
      observedAt: copiedAt,
      route: `/?project=${HORROR_MYSTERY_PROJECT_ID}`,
      title: { resourceId: "oprn-title-horror", imageLoaded: true },
      desktopTouchPadVisible: false,
      mapStart: { mapId: "map_gallery_17x17", x: 13, y: 13, passable: true },
      consoleErrorCount: 0,
      ...extra,
    }), "utf8");
    return file;
  }

  const now = new Date("2026-08-24T12:00:00.000Z").getTime();
  const maxStalenessMs = 5 * 60 * 1000;

  it("REJECTS evidence observed beyond the freshness window (stale)", () => {
    const stale = writeStaleEvidence(
      { capturedBy: CAPTURE_HORROR_BROWSER_EVIDENCE_NAME },
      new Date(now - 10 * 60 * 1000).toISOString(),
    );
    expect(() =>
      readHorrorBrowserEvidence(stale, { targetProjectId: HORROR_MYSTERY_PROJECT_ID, maxStalenessMs, now, captureName: CAPTURE_HORROR_BROWSER_EVIDENCE_NAME }),
    ).toThrow(/만료|fresh|expired/i);
    rmSync(dirname(stale), { recursive: true, force: true });
  });

  it("REJECTS evidence observed materially in the future (clock-skew bound)", () => {
    const future = writeStaleEvidence(
      { capturedBy: CAPTURE_HORROR_BROWSER_EVIDENCE_NAME },
      new Date(now + 2 * 60 * 1000).toISOString(),
    );
    expect(() =>
      readHorrorBrowserEvidence(future, { targetProjectId: HORROR_MYSTERY_PROJECT_ID, maxStalenessMs, now, captureName: CAPTURE_HORROR_BROWSER_EVIDENCE_NAME }),
    ).toThrow(/미래|만료|fresh|expired/i);
    rmSync(dirname(future), { recursive: true, force: true });
  });

  it("REJECTS evidence that lacks the automated-capture provenance", () => {
    const manual = writeStaleEvidence({ capturedBy: "human-edited" }, new Date(now - 1000).toISOString());
    expect(() =>
      readHorrorBrowserEvidence(manual, { targetProjectId: HORROR_MYSTERY_PROJECT_ID, maxStalenessMs, now, captureName: CAPTURE_HORROR_BROWSER_EVIDENCE_NAME }),
    ).toThrow(/capturedBy|capture/i);
    rmSync(dirname(manual), { recursive: true, force: true });
  });

  it("ACCEPTS fresh evidence produced by the automated capture", () => {
    const fresh = writeStaleEvidence(
      { capturedBy: CAPTURE_HORROR_BROWSER_EVIDENCE_NAME },
      new Date(now - 1000).toISOString(),
    );
    const evidence = readHorrorBrowserEvidence(fresh, {
      targetProjectId: HORROR_MYSTERY_PROJECT_ID,
      maxStalenessMs,
      now,
      captureName: CAPTURE_HORROR_BROWSER_EVIDENCE_NAME,
    });
    expect(evidence.projectId).toBe(HORROR_MYSTERY_PROJECT_ID);
    rmSync(dirname(fresh), { recursive: true, force: true });
  });
});
