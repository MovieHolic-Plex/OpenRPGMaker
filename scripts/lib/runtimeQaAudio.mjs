/**
 * Test-harness observation only. Never replaces Audio, play(), or engine methods.
 * Resolves on native playback-start evidence, media failure, or a bounded timeout.
 */
export async function runAudioAction(page, op) {
  await page.evaluate((request) => {
    let complete;
    let settled = false;
    const result = new Promise((resolve) => { complete = resolve; });
    const evidence = {
      action: request.action,
      resourceId: request.resourceId,
      sourcePath: request.sourcePath,
      loop: request.loop,
      error: null,
      playing: null,
      snapshot: null,
    };
    const matchingAudio = (event) => {
      const audio = event.target;
      if (!(audio instanceof HTMLAudioElement)) return null;
      if (audio.dataset.oprnAudio !== "1") return null;
      const source = new URL(audio.currentSrc || audio.src, location.href);
      if (source.origin !== location.origin || source.pathname !== request.sourcePath) return null;
      return audio;
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      document.removeEventListener("playing", onPlaying, true);
      document.removeEventListener("error", onError, true);
      evidence.error = error;
      complete(evidence);
    };
    const onPlaying = (event) => {
      const audio = matchingAudio(event);
      if (audio === null || !event.isTrusted) return;
      evidence.playing = {
        trusted: event.isTrusted,
        sourcePath: new URL(audio.currentSrc || audio.src, location.href).pathname,
        paused: audio.paused,
        ended: audio.ended,
        readyState: audio.readyState,
        currentTime: audio.currentTime,
        loop: audio.loop,
        volume: audio.volume,
        muted: audio.muted,
        playbackRate: audio.playbackRate,
      };
      if (audio.error !== null) {
        finish(`media-error:${audio.error.code}`);
        return;
      }
      if (audio.paused || audio.ended || audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        finish("invalid-playing-state");
        return;
      }
      if (audio.loop !== request.loop || audio.muted) {
        finish("unexpected-playback-options");
        return;
      }
      if (!Array.isArray(window.__oprnAudioObserved)
          || !window.__oprnAudioObserved.includes(request.resourceId)) {
        finish("missing-engine-request");
        return;
      }
      if (typeof window.__oprnAudioState !== "function") {
        finish("missing-engine-snapshot");
        return;
      }
      evidence.snapshot = window.__oprnAudioState();
      finish(null);
    };
    const onError = (event) => {
      const audio = matchingAudio(event);
      if (audio !== null) finish(`media-error:${audio.error?.code ?? "unknown"}`);
    };
    const timer = setTimeout(() => finish("playing-timeout"), request.timeoutMs ?? 30000);
    document.addEventListener("playing", onPlaying, true);
    document.addEventListener("error", onError, true);
    window.__runtimeQaAudioWait = {
      result,
      cancel: () => finish("cancelled"),
    };
  }, op);

  try {
    switch (op.action) {
      case "start":
        // Real title-menu input also reaches the engine's existing unlock listener.
        await page.keyboard.press("Enter");
        break;
      case "interact":
        // Existing harness input hook, not an audio call or editor play mode.
        await page.evaluate(() => window.__oprnInput.action());
        break;
      default:
        throw new TypeError(`Unknown audio action: ${op.action}`);
    }
    return await page.evaluate(() => window.__runtimeQaAudioWait.result);
  } finally {
    await page.evaluate(() => {
      window.__runtimeQaAudioWait.cancel();
      delete window.__runtimeQaAudioWait;
    });
  }
}
