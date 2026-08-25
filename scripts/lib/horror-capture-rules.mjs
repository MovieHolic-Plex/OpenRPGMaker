// scripts/lib/horror-capture-rules.mjs
// Pure decision helpers for the horror browser QA capture.
//
// Contract guarantees that cannot live inside the browser/orchestration layer (they need to be
// unit-tested): server ownership (never reuse an occupied/foreign port), live-session start
// binding, and content-digest binding. The capture script calls these; the focused regression test
// (test/horrorCaptureRules.test.ts) exercises the same code.

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Decide whether a port may be used.
 * - already-listening (this app OR foreign) → REJECT. The browser QA must NEVER reuse an
 *   already-listening arbitrary Vite server; every capture owns a freshly verified-free port and an
 *   exact spawned process from this worktree. An explicitly occupied port is a hard failure.
 * - free → spawn our own process.
 *
 * @param {{ kind: "already-listening" | "free"; servesThisApp?: boolean }} probe
 * @returns {{ action: "spawn" }}
 */
export function planServerOwnership(probe) {
  if (probe.kind === "already-listening") {
    assert(
      probe.servesThisApp === false && false,
      `브라우저 QA는 이미 점유된(:${"포트"}) 서버를 재사용하지 않습니다 — 이 워크트리에서 방금 검증된 빈 포트에 전용 dev 서버를 띄워야 합니다 (occupied/reuse 금지).`,
    );
  }
  return { action: "spawn" };
}

/**
 * Bind the live session's exact start map/position to the expected authored start.
 * A mismatch — either mapId or x/y — must fail the browser capture.
 */
export function assertExpectedStart(observed, expected) {
  assert(
    observed.currentMapId === expected.mapId
      && observed.x === expected.x
      && observed.y === expected.y,
    `시작 지점 불일치: 라이브 세션 startMapId=${observed.currentMapId} (좌표 ${observed.x},${observed.y})에 스폰됐지만 ` +
    `기대값 startMapId=${expected.mapId} (${expected.x},${expected.y})입니다.`,
  );
}

/**
 * Bind the in-browser project state to the Node-side content digest. Derived independently on
 * both sides from actual project data; a mismatch fails the capture.
 */
export function assertObservedDigest(observedDigest, expectedDigest) {
  assert(
    observedDigest === expectedDigest,
    `프로젝트 콘텐츠 다이제스트 불일치: 브라우저(${observedDigest}) !== Node(${expectedDigest}). ` +
    `같은 projectId여도 내용이 다르면 브라우저 QA는 통과할 수 없습니다.`,
  );
}

/**
 * Derive the required start-map BGM from the authored project (the start map's custom BGM is a
 * hard requirement — if it cannot resolve, load, and reach the playback engine, the capture fails).
 *
 * @param {{ startMap: { bgm?: { mode?: string; resourceId?: string } }, resolveUrl: (resourceId: string) => string | null }} input
 * @returns {{ resourceId: string; url: string }}
 */
export function deriveRequiredStartBgm({ startMap, resolveUrl }) {
  const bgm = startMap?.bgm;
  if (!bgm || bgm.mode !== "custom" || !bgm.resourceId) {
    throw new Error(`시작 맵에 커스텀 BGM이 지정되지 않았습니다 — 필수 BGM을 관찰할 수 없습니다.`);
  }
  const url = resolveUrl(bgm.resourceId);
  if (url === null || url.length === 0) {
    throw new Error(`필수 BGM ${bgm.resourceId} 을(를) 재생 URL로 해석할 수 없습니다 (resolve 실패).`);
  }
  return { resourceId: bgm.resourceId, url };
}

/**
 * Assert the required BGM was requested (resource load) AND reached the playback engine.
 *
 * @param {{ resourceId: string; url: string }} required
 * @param {{ requestedUrls: readonly string[]; played: readonly string[] }} observed
 */
export function wasRequiredBgmRequested(requiredUrl, requestedUrls) {
  const expectedIsAppRelative = requiredUrl.startsWith("/");
  return requestedUrls.some((url) => {
    if (url === requiredUrl) return true;
    if (!expectedIsAppRelative) return false;
    try {
      const absolute = new URL(url);
      return `${absolute.pathname}${absolute.search}` === requiredUrl;
    } catch {
      return false;
    }
  });
}

export function assertRequiredBgmObserved(required, observed) {
  const loaded = wasRequiredBgmRequested(required.url, observed.requestedUrls);
  assert(loaded, `필수 BGM ${required.resourceId} 이(가) 브라우저에서 로드되지 않았습니다 (${required.url}).`);
  const played = observed.played.some((resourceId) => resourceId === required.resourceId);
  assert(played, `필수 BGM ${required.resourceId} 이(가) 재생 엔진에 도달하지 않았습니다 (broken required BGM).`);
}

/** Contract screenshot names: browser-title.png = title before play, browser-play-start.png = after play. */
export function browserScreenshotNames() {
  return { title: "browser-title.png", playStart: "browser-play-start.png" };
}

/** The title screenshot must be captured before the play-start screenshot. */
export function assertScreenshotOrder({ titleAtMs, playStartAtMs }) {
  assert(titleAtMs <= playStartAtMs, `타이틀 스크린샷(${titleAtMs}ms)이 재생 시작 스크린샷(${playStartAtMs}ms) 이후에 찍혔습니다 — browser-title.png는 재생 전이어야 합니다.`);
}
