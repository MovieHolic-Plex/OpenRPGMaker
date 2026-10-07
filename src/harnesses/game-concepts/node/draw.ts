// draw — 컨셉마다 도트 썸네일을 생성한다. 앱의 그림 경로(동반 서비스 /v1/images/generations)를 그대로 쓴다.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { conceptArtPrompt } from "../../../concepts/art";
import type { GameConcept } from "../../../concepts/format";
import { ensureDirs, imagePath, listCandidates, log, pool } from "./data";

const DEFAULT_ENDPOINT = process.env.GC_IMAGE_ENDPOINT ?? "http://mdc-server:9888/v1/images/generations";
const DEFAULT_PROVIDER = process.env.GC_IMAGE_PROVIDER ?? "openai-codex";
const DEFAULT_MODEL = process.env.GC_IMAGE_MODEL ?? "codex-image-default";

export async function generateImage(prompt: string, endpoint = DEFAULT_ENDPOINT): Promise<Uint8Array> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Oprn-Provider": DEFAULT_PROVIDER },
    body: JSON.stringify({ prompt, model: DEFAULT_MODEL }),
    signal: AbortSignal.timeout(240_000),
  });
  const payload = await response.json() as { image?: { dataUrl?: string }; error?: string };
  const dataUrl = payload.image?.dataUrl;
  if (!response.ok || !dataUrl?.startsWith("data:image/")) throw new Error(payload.error ?? `그림 생성 실패 HTTP ${response.status}`);
  return Uint8Array.from(Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
}

/** 원본 → 16:9 로 가운데 자른 960×540 / 480×270 webp. */
export function writeThumbs(slug: string, bytes: Uint8Array): void {
  const dir = mkdtempSync(join(tmpdir(), "gc-draw-"));
  try {
    const source = join(dir, "source.img");
    writeFileSync(source, bytes);
    for (const [size, geometry] of [["full", "960x540"], ["card", "480x270"]] as const) {
      const result = spawnSync("convert", [source, "-resize", `${geometry}^`, "-gravity", "center", "-extent", geometry, "-quality", "82", imagePath(slug, size)]);
      if (result.status !== 0) throw new Error(`convert 실패: ${result.stderr.toString().slice(-300)}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function drawOne(concept: GameConcept): Promise<void> {
  writeThumbs(concept.slug, await generateImage(conceptArtPrompt(concept)));
}

export async function draw(argv: string[]): Promise<number> {
  ensureDirs();
  const parallel = argv.includes("--parallel") ? Number(argv[argv.indexOf("--parallel") + 1]) : 4;
  const only = argv.includes("--slug") ? argv[argv.indexOf("--slug") + 1] : undefined;
  const force = argv.includes("--force");
  const targets = listCandidates().filter((concept) => (only ? concept.slug === only : true) && (force || !existsSync(imagePath(concept.slug, "full"))));
  console.log(`[draw] 그릴 컨셉 ${targets.length}개`);
  let done = 0;
  await pool(targets, parallel, async (concept) => {
    try {
      await drawOne(concept);
      done += 1;
      if (done % 10 === 0 || done === targets.length) console.log(`[draw] ${done}/${targets.length}`);
    } catch (error) {
      log("draw", `${concept.slug} 실패 — ${error instanceof Error ? error.message : String(error)}`);
      console.warn(`[draw] ${concept.slug} 실패`, error instanceof Error ? error.message : error);
    }
  });
  return 0;
}
