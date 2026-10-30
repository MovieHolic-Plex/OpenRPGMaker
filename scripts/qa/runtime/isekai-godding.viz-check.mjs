// claude-viz 페이지의 맨 위 영상이 실제로 재생되는지 본다: 15초 지점으로 옮겨 재생 → currentTime 이 늘고 소리 트랙이 있는지, 스크린샷.
//   node scripts/qa/runtime/isekai-godding.viz-check.mjs [url] [out.png]
import { chromium } from "@playwright/test";
const url = process.argv[2] ?? "http://mdc-server:18301/isekai-godding.html";
const out = process.argv[3] ?? "/tmp/ig-viz-check.png";
const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto(url, { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async () => {
  const v = document.querySelector("video");
  v.muted = true;
  await new Promise((ok) => (v.readyState >= 1 ? ok() : v.addEventListener("loadedmetadata", ok, { once: true })));
  v.currentTime = 70;
  await new Promise((ok) => v.addEventListener("seeked", ok, { once: true }));
  const t0 = v.currentTime;
  await v.play();
  await new Promise((ok) => setTimeout(ok, 3000));
  v.pause();
  return { src: v.currentSrc, duration: v.duration, t0, t1: v.currentTime, width: v.videoWidth, audio: v.mozHasAudio ?? (v.webkitAudioDecodedByteCount ?? -1) };
});
await page.screenshot({ path: out });
console.log(JSON.stringify(r));
await browser.close();
