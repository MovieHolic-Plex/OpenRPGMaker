import { mkdir, writeFile } from "node:fs/promises";
import { createOhMyPiAdapters, stopOhMyPiWorker } from "./lib/ohMyPiPiAi.mjs";
import { handleCompanionRequest } from "./lib/ohMyPiHttp.mjs";

const OUT = "verify-shots/ai-db-generate";

const SUBJECTS = [
  {
    slug: "enemy-frost-wolf",
    prompt: "A single 2D JRPG battle monster sprite of 서슬 늑대 — an ice-cave frost wolf, fast physical attacker."
      + " Full body, centered, front view facing the viewer, clean thick outline, flat saturated colors,"
      + " no text, no ground shadow, on a pure flat white background.",
  },
  {
    slug: "item-hi-potion",
    prompt: "A single 2D JRPG inventory item icon of 상급 회복약 — a high potion that restores a lot of HP."
      + " Centered, front view, clean thick outline, flat saturated colors, no text, no frame, no shadow,"
      + " on a pure flat white background.",
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const adapters = await createOhMyPiAdapters();
  const manifest = [];
  try {
    for (const subject of SUBJECTS) {
      const started = Date.now();
      const result = await handleCompanionRequest(
        {
          method: "POST",
          url: "/v1/images/generations",
          headers: { "x-oprn-provider": "google-antigravity" },
          body: { prompt: subject.prompt },
        },
        adapters,
      );
      if (result.status !== 200) {
        throw new Error(`${subject.slug}: HTTP ${result.status} ${JSON.stringify(result.body).slice(0, 300)}`);
      }
      const { dataUrl, mimeType, model, provider } = result.body.image;
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const bytes = Buffer.from(base64, "base64");
      const extension = mimeType === "image/png" ? "png" : "jpg";
      const file = `${OUT}/raw-${subject.slug}.${extension}`;
      await writeFile(file, bytes);
      manifest.push({
        slug: subject.slug,
        file,
        mimeType,
        model,
        provider,
        bytes: bytes.length,
        elapsedMs: Date.now() - started,
        dataUrlLength: dataUrl.length,
      });
      console.log(`[art] ${subject.slug} → ${file} (${bytes.length} bytes, ${mimeType}, ${model})`);
    }
    await writeFile(`${OUT}/artwork-manifest.json`, JSON.stringify(manifest, null, 2), "utf8");
  } finally {
    stopOhMyPiWorker();
  }
}

await main();
process.exit(0);
