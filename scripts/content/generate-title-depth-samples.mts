// 오프닝 표본 키아트의 깊이 지도(흰색=가까움). 편집기 버튼과 같은 프롬프트(buildTitleDepthPrompt)를
// 같은 동반 앱 이미지 경로에 키아트를 참조 그림으로 붙여 보낸다. 결과는 QA·증거용 로컬 파일이다.
//   node node_modules/vite-node/vite-node.mjs --script scripts/content/generate-title-depth-samples.mts [presetId...]
// 정규화(명도 한 채널·대비 늘리기·키아트 크기 맞춤)는 편집기에선 캔버스가, 여기선 ImageMagick 이 한다.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildTitleDepthPrompt } from "../../src/editor/titleDepthGeneration";
// @ts-expect-error — .mjs 동반 앱 라이브러리
import { createOhMyPiAdapters, stopOhMyPiWorker } from "../lib/ohMyPiPiAi.mjs";
// @ts-expect-error — .mjs 동반 앱 라이브러리
import { handleCompanionRequest } from "../lib/ohMyPiHttp.mjs";

const OUT = "verify-shots/title-opening/art";
const wanted = process.argv.slice(2).filter(arg => !arg.startsWith("--"));
const ids = wanted.length > 0 ? wanted : ["forestMorning", "moonlitCastle", "snowyVillage", "mistyRuins"];
const adapters = await createOhMyPiAdapters();
try {
  for (const id of ids) {
    const art = [`${OUT}/${id}.jpg`, `${OUT}/${id}.png`, `${OUT}/${id}.webp`].find(existsSync);
    if (!art) { console.error(`[title-depth] ${id}: 그림 없음`); continue; }
    const mimeType = art.endsWith(".png") ? "image/png" : art.endsWith(".webp") ? "image/webp" : "image/jpeg";
    const started = Date.now();
    const result = await handleCompanionRequest(
      {
        method: "POST",
        url: "/v1/images/generations",
        headers: { "x-oprn-provider": "google-antigravity" },
        body: { prompt: buildTitleDepthPrompt(), referenceImages: [{ mimeType, data: (await readFile(art)).toString("base64") }] },
      },
      adapters,
    );
    if (result.status !== 200) { console.error(`[title-depth] ${id}: HTTP ${result.status} ${JSON.stringify(result.body).slice(0, 300)}`); continue; }
    const { dataUrl } = result.body.image;
    const raw = `${OUT}/${id}.depth-raw.png`;
    await writeFile(raw, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
    const size = execFileSync("identify", ["-format", "%wx%h", art]).toString().trim();
    const [w, h] = size.split("x").map(Number) as [number, number];
    const scale = Math.min(1, 512 / Math.max(w, h));
    execFileSync("convert", [raw, "-resize", `${Math.round(w * scale)}x${Math.round(h * scale)}!`, "-colorspace", "Gray", "-contrast-stretch", "1%x1%", `${OUT}/${id}.depth.png`]);
    console.log(`[title-depth] ${id} → ${OUT}/${id}.depth.png (${Math.round((Date.now() - started) / 1000)}s)`);
  }
} finally {
  await stopOhMyPiWorker();
}
