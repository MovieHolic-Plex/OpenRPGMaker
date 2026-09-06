import assert from "node:assert/strict";

// Subscribe before triggering the real keyboard action. No fixed sleeps or polling.
export async function cinematicQaOp(page, op) {
  if (op.action === "reject-autoplay") {
    await page.evaluate(() => {
      const original = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (this.closest(".cinematic-sequence")) {
          HTMLMediaElement.prototype.play = original;
          return Promise.reject(new DOMException("QA autoplay rejection", "NotAllowedError"));
        }
        return original.call(this);
      };
    });
    return;
  }
  if (op.action === "geometry") {
    const result = await page.evaluate(async () => {
      const stage = document.querySelector(".play-stage");
      if (!stage) throw new Error("Stage missing");
      const images = [...stage.querySelectorAll(".cinematic-image,.cinematic-background")];
      await Promise.all(images.map(image => image.decode()));
      const frame = stage.getBoundingClientRect();
      const nodes = [...stage.querySelectorAll(".cinematic-narration,.cinematic-hint,.cinematic-status,.game-over-panel")]
        .filter(node => node.textContent && getComputedStyle(node).display !== "none");
      return { images: images.map(image => ({ width: image.naturalWidth, height: image.naturalHeight })),
        nodes: nodes.map(node => {
          const rect = node.getBoundingClientRect();
          return { className: node.className, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
            inside: rect.left >= frame.left - 1 && rect.right <= frame.right + 1 && rect.top >= frame.top - 1 && rect.bottom <= frame.bottom + 1 };
        }) };
    });
    assert.ok(result.nodes.length > 0); assert.ok(result.nodes.every(node => node.inside));
    assert.ok(result.images.every(image => image.width > 0 && image.height > 0));
    console.log("Cinematic geometry:", JSON.stringify(result));
    return;
  }
  if (op.action === "key") {
    await page.evaluate(({ selector, absent }) => {
      window.__cinematicQaTransition = new Promise((resolve, reject) => {
        const matches = () => absent ? !document.querySelector(selector) : Boolean(document.querySelector(selector));
        const observer = new MutationObserver(() => { if (matches()) finish(); });
        const timeout = setTimeout(() => { observer.disconnect(); reject(new Error(`Transition missing: ${selector}`)); }, 120000);
        const finish = () => { clearTimeout(timeout); observer.disconnect(); resolve(); };
        observer.observe(document, { childList: true, subtree: true, attributes: true, characterData: true });
        if (matches()) finish();
      });
    }, op);
    await page.keyboard.press(op.key);
    await page.evaluate(() => window.__cinematicQaTransition);
    return;
  }
  if (op.action === "input") {
    const result = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="cinematic-sequence"]');
      if (!root) throw new Error("Cinematic missing");
      const id = root.dataset.sceneId;
      let escaped = 0;
      const listener = () => { escaped += 1; };
      document.addEventListener("keydown", listener);
      const consumed = [];
      for (const key of ["Enter", "z", " ", "Escape", "ArrowDown", "1", "Tab"]) {
        const event = new KeyboardEvent("keydown", { key, repeat: true, bubbles: true, cancelable: true });
        root.dispatchEvent(event); consumed.push(event.defaultPrevented);
      }
      document.removeEventListener("keydown", listener);
      const pointer = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
      root.dispatchEvent(pointer);
      return { escaped, consumed, pointerBlocked: pointer.defaultPrevented, unchanged: root.dataset.sceneId === id,
        editor: Boolean(document.querySelector(".editor-layout")), canvas: Boolean(document.querySelector("canvas")) };
    });
    assert.equal(result.escaped, 0); assert.ok(result.consumed.every(Boolean));
    assert.equal(result.pointerBlocked, true); assert.equal(result.unchanged, true); assert.equal(result.editor, false);
    if (op.beforeMap) assert.equal(result.canvas, false);
    console.log("Cinematic input:", JSON.stringify(result));
    return;
  }
  if (op.action === "reduced-motion") {
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await page.locator(".cinematic-image").evaluate(node => getComputedStyle(node).animationName), "none");
    return;
  }
  if (op.action === "video-end") {
    await page.evaluate(async () => {
      const video = document.querySelector(".cinematic-video");
      if (!(video instanceof HTMLVideoElement)) throw new Error("Video missing");
      await video.play();
      let ended = false;
      const onEnded = () => { ended = true; };
      video.addEventListener("ended", onEnded, { once: true });
      const booted = new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
          if (document.querySelector('[data-testid="runtime-state-json"]')) finish();
        });
        const timeout = setTimeout(() => { observer.disconnect(); reject(new Error("No map after native video completion")); }, 120000);
        const finish = () => { clearTimeout(timeout); observer.disconnect(); resolve(); };
        observer.observe(document, { subtree: true, childList: true });
      });
      video.currentTime = video.duration - 0.1;
      await booted;
      video.removeEventListener("ended", onEnded);
      if (!ended || video.hasAttribute("src") || !video.paused) throw new Error("Native ending or cleanup failed");
    });
    console.log("Cinematic native ended: map booted, media paused and source released");
    return;
  }
  if (op.action === "video-error") {
    // Fault injection at the native media boundary, after proving real decoding/playback.
    await page.evaluate(async () => {
      const video = document.querySelector(".cinematic-video");
      if (!(video instanceof HTMLVideoElement)) throw new Error("Video missing");
      if (video.readyState < 2) await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { cleanup(); reject(new Error("Video did not decode")); }, 10000);
        const cleanup = () => { clearTimeout(timeout); video.removeEventListener("loadeddata", loaded); video.removeEventListener("error", failed); };
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error("Video decode failed")); };
        video.addEventListener("loadeddata", loaded, { once: true }); video.addEventListener("error", failed, { once: true });
      });
      await video.play();
      video.dispatchEvent(new Event("error"));
      if (video.getAttribute("src") !== null || !video.paused) throw new Error("Failed video was not released");
      const root = document.querySelector('[data-testid="cinematic-sequence"]');
      if (root?.dataset.mediaState !== "error") throw new Error("No continuation state after video failure");
    });
    return;
  }
  if (op.action === "detach") {
    const result = await page.evaluate(async () => {
      const host = document.querySelector(".play-stage");
      const video = host?.querySelector("video");
      if (!host || !video) throw new Error("Lifecycle fixture missing");
      const released = new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => { if (!video.hasAttribute("src")) finish(); });
        const timeout = setTimeout(() => { observer.disconnect(); reject(new Error("Detached video retained source")); }, 10000);
        const finish = () => { clearTimeout(timeout); observer.disconnect(); resolve(); };
        observer.observe(video, { attributes: true });
      });
      host.remove(); await released;
      return { paused: video.paused, source: video.getAttribute("src") };
    });
    assert.equal(result.paused, true); assert.equal(result.source, null);
    console.log("Cinematic host teardown:", JSON.stringify(result));
    return;
  }
  throw new Error(`Unknown cinematic QA action: ${op.action}`);
}
