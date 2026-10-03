import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Real Chromium frames with their actual elapsed intervals; no reconstructed UI. */
export async function startEditorScreencast(page, outputDir, filename = "operation.gif", options = {}) {
  mkdirSync(".vite-cache", { recursive: true }); mkdirSync(outputDir, { recursive: true });
  const framesDir = mkdtempSync(resolve(".vite-cache/editor-film-")), frames = [], phases = [];
  const viewport = page.viewportSize(); let skippedCaptureFrames = 0;
  const area = await page.locator(options.selector ?? ".canvas-area").boundingBox();
  const crop = { x: Math.round(area.x), y: Math.round(area.y + (options.cropTop ?? 96)), width: Math.floor(area.width), height: Math.floor(area.height - (options.cropTop ?? 96)) };
  await page.evaluate(crop => {
    const caption = document.createElement("div"); caption.id = "editor-film-caption";
    Object.assign(caption.style, { position: "fixed", left: `${crop.x + 16}px`, top: `${crop.y + crop.height - 52}px`, zIndex: "2147483647", background: "#1c242e", color: "#ffffff", padding: "9px 12px", borderRadius: "8px", font: "600 17px system-ui", pointerEvents: "none" }); document.body.append(caption);
    const cursor = document.createElement("div"); Object.assign(cursor.style, { position: "fixed", width: "16px", height: "16px", border: "2px solid #ffffff", boxShadow: "0 0 0 2px #253956", borderRadius: "50%", transform: "translate(-50%, -50%)", zIndex: "2147483647", pointerEvents: "none" }); document.body.append(cursor);
    document.addEventListener("pointermove", e => { cursor.style.left = `${e.clientX}px`; cursor.style.top = `${e.clientY}px`; }); document.addEventListener("pointerdown", () => { cursor.style.background = "#58cc8b"; }); document.addEventListener("pointerup", () => { cursor.style.background = "transparent"; });
  }, crop);
  const session = await page.context().newCDPSession(page), start = Date.now();
  session.on("Page.screencastFrame", event => {
    session.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
    const bytes = Buffer.from(event.data, "base64");
    // Element screenshots temporarily send clipped compositor frames. Keep only the
    // actual viewport frames; their elapsed timestamps preserve the recording pace.
    let dimensions;
    for (let p = 2; p + 8 < bytes.length;) {
      if (bytes[p] !== 0xff) break;
      const marker = bytes[p + 1], length = bytes.readUInt16BE(p + 2);
      if ([0xc0, 0xc1, 0xc2].includes(marker)) { dimensions = { height: bytes.readUInt16BE(p + 5), width: bytes.readUInt16BE(p + 7) }; break; }
      if (length < 2) break;
      p += length + 2;
    }
    if (!dimensions || dimensions.width !== viewport.width || dimensions.height !== viewport.height) { skippedCaptureFrames++; return; }
    const path = resolve(framesDir, `${String(frames.length).padStart(5, "0")}.jpg`); writeFileSync(path, bytes); frames.push({ path, time: Date.now() });
  });
  await session.send("Page.startScreencast", { format: "jpeg", quality: 95, maxWidth: 1440, maxHeight: 960, everyNthFrame: 1 });
  return {
    async caption(text) { phases.push({ seconds: (Date.now() - start) / 1000, text }); console.log(text); await page.locator("#editor-film-caption").evaluate((node, text) => { node.textContent = text; }, text); await page.waitForTimeout(700); },
    async stop() {
      await page.waitForTimeout(300); await session.send("Page.stopScreencast");
      if (frames.length < 10) throw new Error("No usable recording frames");
      const concat = frames.map((f, i) => `file '${f.path}'\nduration ${i + 1 < frames.length ? Math.max(.01, (frames[i + 1].time - f.time) / 1000) : 1}`).join("\n") + `\nfile '${frames.at(-1).path}'\n`, list = resolve(framesDir, "frames.ffconcat"); writeFileSync(list, concat);
      if (filename.endsWith(".mp4")) {
        const filter = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},setpts=${1/(options.speed ?? 2)}*PTS,fps=20,pad=ceil(iw/2)*2:ceil(ih/2)*2`;
        execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-threads", "2", "-f", "concat", "-safe", "0", "-i", list, "-vf", filter, "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", resolve(outputDir, filename)], { stdio: "inherit" });
      } else {
        const filter = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},fps=10,split[v][p];[p]palettegen=max_colors=192:stats_mode=diff[pal];[v][pal]paletteuse=dither=sierra2_4a`;
        execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-threads", "2", "-f", "concat", "-safe", "0", "-i", list, "-filter_complex_threads", "2", "-filter_complex", filter, "-loop", "0", resolve(outputDir, filename)], { stdio: "inherit" });
      }
      return { frames: frames.length, skippedCaptureFrames, crop, phases, gif: filename };
    }
  };
}
