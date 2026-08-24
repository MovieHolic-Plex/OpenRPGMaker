// horror-browser-evidence.mjs
// Shared, pure contract for reading the automated horror browser evidence produced by
// scripts/capture-horror-browser-evidence.mts.
//
// Used by both the QA evaluator (scripts/qa-horror-mystery-prototype.mts) and the
// focused regression test (test/horrorBrowserEvidenceFreshness.test.ts). Kept in .mjs
// so the Node/tsx process contract stays executable and greppable without a TS build.
//
// Two guards close the "stale/manual JSON can satisfy QA without a browser" break:
//   1. provenance  – the file must be stamped with the automated capture's name
//   2. freshness   – observedAt must be inside maxStalenessMs, else QA must re-capture
import fs from "node:fs";

export const CAPTURE_HORROR_BROWSER_EVIDENCE_NAME = "capture-horror-browser-evidence";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Human-owned, stable shape (mirrors HorrorBrowserEvidence in src/testing/horrorExperienceQa.ts). */
export const HORROR_BROWSER_EVIDENCE_FIELDS = [
  "projectId",
  "observedAt",
  "route",
  "title",
  "desktopTouchPadVisible",
  "mapStart",
  "consoleErrorCount",
];

export function validateHorrorBrowserEvidenceShape(parsed) {
  assert(typeof parsed === "object" && parsed !== null, "browser-qa.json은 객체여야 합니다.");
  assert(typeof parsed.projectId === "string" && parsed.projectId.length > 0, "browser-qa projectId가 없습니다.");
  assert(typeof parsed.observedAt === "string" && Number.isFinite(Date.parse(parsed.observedAt)), "browser-qa observedAt이 유효하지 않습니다.");
  assert(typeof parsed.route === "string" && parsed.route.length > 0, "browser-qa route가 없습니다.");
  assert(typeof parsed.title === "object" && parsed.title !== null, "browser-qa title 관찰이 없습니다.");
  assert(typeof parsed.title.resourceId === "string", "browser-qa title.resourceId가 없습니다.");
  assert(typeof parsed.title.imageLoaded === "boolean", "browser-qa title.imageLoaded가 없습니다.");
  assert(typeof parsed.desktopTouchPadVisible === "boolean", "browser-qa touch pad 관찰이 없습니다.");
  assert(typeof parsed.mapStart === "object" && parsed.mapStart !== null, "browser-qa mapStart 관찰이 없습니다.");
  assert(typeof parsed.mapStart.mapId === "string", "browser-qa mapStart.mapId가 없습니다.");
  assert(typeof parsed.mapStart.x === "number", "browser-qa mapStart.x가 없습니다.");
  assert(typeof parsed.mapStart.y === "number", "browser-qa mapStart.y가 없습니다.");
  assert(typeof parsed.mapStart.passable === "boolean", "browser-qa mapStart.passable이 없습니다.");
  assert(typeof parsed.consoleErrorCount === "number", "browser-qa console error 수가 없습니다.");
  return parsed;
}

/**
 * Reads and validates browser evidence with provenance + freshness guards.
 *
 * @param {string} filePath
 * @param {{ targetProjectId: string, maxStalenessMs?: number, now?: number, captureName?: string }} opts
 * @returns structured clone of the evidence (no credentials; safe for output)
 */
export function readHorrorBrowserEvidence(filePath, opts) {
  const {
    targetProjectId,
    maxStalenessMs = 5 * 60 * 1000,
    now = Date.now(),
    captureName = CAPTURE_HORROR_BROWSER_EVIDENCE_NAME,
  } = opts ?? {};
  assert(fs.existsSync(filePath), `브라우저 QA 증거가 없습니다: ${filePath}`);
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const evidence = validateHorrorBrowserEvidenceShape(parsed);
  assert(evidence.projectId === targetProjectId, "브라우저 QA의 projectId가 대상 프로젝트와 다릅니다.");
  assert(evidence.route.includes(targetProjectId), "브라우저 QA route가 대상 프로젝트를 가리키지 않습니다.");

  const capturedBy = typeof evidence.capturedBy === "string" ? evidence.capturedBy : null;
  assert(
    capturedBy === captureName,
    `브라우저 QA가 자동 캡처(${captureName}) 산출물이 아닙니다 (capturedBy=${capturedBy ?? "missing"}). 브라우저를 통해 자동 재생성한 증거를 사용하세요.`,
  );

  const observedMs = Date.parse(evidence.observedAt);
  const ageMs = now - observedMs;
  // Allow only 30s of clock skew ahead — anything materially in the future is forged/bogus.
  const MAX_FUTURE_SKEW_MS = 30_000;
  assert(
    observedMs > 0 && ageMs <= maxStalenessMs && ageMs >= -MAX_FUTURE_SKEW_MS,
    `브라우저 QA 증거가 만료 또는 미래 시각입니다 (age=${Math.floor(ageMs / 1000)}s, 최대 ${Math.floor(maxStalenessMs / 1000)}s, 허용 미래 편차 ${MAX_FUTURE_SKEW_MS / 1000}s). 캡처를 다시 실행하세요.`,
  );

  // Return a defensively cloned, credential-free slice (never leak anything unexpected).
  return {
    projectId: evidence.projectId,
    observedAt: evidence.observedAt,
    route: evidence.route,
    capturedBy: evidence.capturedBy,
    title: { resourceId: evidence.title.resourceId, imageLoaded: evidence.title.imageLoaded },
    desktopTouchPadVisible: evidence.desktopTouchPadVisible,
    mapStart: {
      mapId: evidence.mapStart.mapId,
      x: evidence.mapStart.x,
      y: evidence.mapStart.y,
      passable: evidence.mapStart.passable,
    },
    consoleErrorCount: evidence.consoleErrorCount,
  };
}

/** Path the automated capture always writes (and QA evaluates). */
export function browserEvidenceOutputPath() {
  return "output/evidence/horror-mystery-prototype/browser-qa.json";
}
