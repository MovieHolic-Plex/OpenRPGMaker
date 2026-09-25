// 오프닝 프리셋별 타이틀 키아트 표본. 편집기 버튼과 같은 프롬프트(buildTitleArtPrompt)를
// 같은 동반 앱 이미지 경로(/v1/images/generations)로 보낸다. 결과는 QA·증거용 로컬 파일이다.
//   node node_modules/vite-node/vite-node.mjs --script scripts/content/generate-title-art-samples.mts [--fit|--fit-only] [presetId...]
// --fit      생성 뒤 비전 모델로 효과 좌표를 맞춰 <presetId>.effects.json 을 쓴다(편집기와 같은 fitTitleArtEffects).
// --fit-only 이미 있는 그림에 맞춤만 다시 한다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { DEFAULT_MODEL, type ChatRequest, type ChatResult } from "../../src/ai/llmClient";
import { DEFAULT_OH_MY_PI_PROVIDER } from "../../src/ai/ohMyPiProviders";
import { fitTitleArtEffects } from "../../src/editor/titleArtFitting";
import { buildTitleArtPrompt, prepareTitleArtRequest } from "../../src/editor/tools/titleArtTools";
import { TITLE_OPENING_PRESETS, type TitleOpeningPreset } from "../../src/project/titleEffects";
// @ts-expect-error — .mjs 동반 앱 라이브러리
import { createOhMyPiAdapters, stopOhMyPiWorker } from "../lib/ohMyPiPiAi.mjs";
// @ts-expect-error — .mjs 동반 앱 라이브러리
import { handleCompanionRequest } from "../lib/ohMyPiHttp.mjs";

const OUT = "verify-shots/title-opening/art";
const BRIEFS: Record<string, string> = {
  forestMorning: "두 자루의 검이 큰 나무에 기대 서 있고, 강 건너 성 마을과 안개 낀 산맥이 보이는 숲속 아침",
};

const argv = process.argv.slice(2);
const fitOnly = argv.includes("--fit-only");
const fit = fitOnly || argv.includes("--fit");
const wanted = argv.filter(arg => !arg.startsWith("--"));
const presets = TITLE_OPENING_PRESETS.filter(preset => wanted.length === 0 || wanted.includes(preset.id));
await mkdir(OUT, { recursive: true });
const adapters = await createOhMyPiAdapters();

// 편집기의 chatCompletion 대신 같은 동반 앱의 채팅 경로로 보낸다.
async function companionChat(request: ChatRequest): Promise<ChatResult> {
  const { signal: _signal, ...body } = request;
  const result = await handleCompanionRequest(
    { method: "POST", url: "/v1/chat/completions", headers: { "x-oprn-provider": DEFAULT_OH_MY_PI_PROVIDER }, body: { model: DEFAULT_MODEL, ...body } },
    adapters,
  );
  if (result.status !== 200) throw new Error(`chat HTTP ${result.status} ${JSON.stringify(result.body).slice(0, 300)}`);
  const message = result.body?.choices?.[0]?.message;
  if (!message) throw new Error(`chat: 응답에 message 가 없다 ${JSON.stringify(result.body).slice(0, 300)}`);
  return { message } as ChatResult;
}

async function fitAndWrite(preset: TitleOpeningPreset, dataUrl: string): Promise<void> {
  const started = Date.now();
  let raw = "";
  const fitted = await fitTitleArtEffects(preset, dataUrl, {
    chat: async request => {
      const result = await companionChat(request);
      raw = typeof result.message.content === "string" ? result.message.content : JSON.stringify(result.message.content);
      return result;
    },
  });
  await writeFile(`${OUT}/${preset.id}.effects.json`, `${JSON.stringify({ fitted: fitted.fitted, effects: fitted.effects, raw }, null, 2)}\n`);
  console.log(`[title-art] ${preset.id} fit: ${fitted.fitted.length} effect(s) [${fitted.fitted.join(",")}] (${Math.round((Date.now() - started) / 1000)}s)`);
}

try {
  for (const preset of presets) {
    if (fitOnly) {
      const file = [`${OUT}/${preset.id}.jpg`, `${OUT}/${preset.id}.png`, `${OUT}/${preset.id}.webp`].find(existsSync);
      if (!file) { console.error(`[title-art] ${preset.id}: 그림 없음`); continue; }
      const mime = file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg";
      await fitAndWrite(preset, `data:${mime};base64,${(await readFile(file)).toString("base64")}`);
      continue;
    }
    const request = prepareTitleArtRequest({ preset: preset.id, ...(BRIEFS[preset.id] ? { prompt: BRIEFS[preset.id] } : {}) });
    const started = Date.now();
    const result = await handleCompanionRequest(
      { method: "POST", url: "/v1/images/generations", headers: { "x-oprn-provider": "google-antigravity" }, body: { prompt: buildTitleArtPrompt(request) } },
      adapters,
    );
    if (result.status !== 200) {
      console.error(`[title-art] ${preset.id}: HTTP ${result.status} ${JSON.stringify(result.body).slice(0, 300)}`);
      continue;
    }
    const { dataUrl, mimeType, model } = result.body.image;
    const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const file = `${OUT}/${preset.id}.${extension}`;
    await writeFile(file, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
    console.log(`[title-art] ${preset.id} → ${file} (${model}, ${Math.round((Date.now() - started) / 1000)}s)`);
    if (fit) await fitAndWrite(preset, dataUrl);
  }
} finally {
  stopOhMyPiWorker();
}
process.exit(0);
